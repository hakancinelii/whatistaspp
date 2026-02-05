import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
        if (!GEMINI_API_KEY) {
            return NextResponse.json({
                replies: ["API Anahtarı eksik.", "Lütfen yöneticiyle iletişim kurun.", "Bu özellik şu an devre dışı."]
            });
        }

        const db = await getDatabase();
        const dbUser = await db.get('SELECT package, role FROM users WHERE id = ?', [user.userId]);
        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { lastMessages } = await request.json();
        if (!lastMessages || lastMessages.length === 0) {
            return NextResponse.json({ error: 'Mesaj geçmişi bulunamadı.' }, { status: 400 });
        }

        const kbItems = await db.all('SELECT title, content FROM knowledge_base WHERE user_id = ?', [user.userId]);
        const kbContext = kbItems.map((i: any) => `${i.title}: ${i.content}`).join('\n');

        const prompt = `Sen bir işletme asistanısın. Aşağıdaki 'İşletme Bilgileri'ni temel alarak, 'Müşteri Mesajları'na en uygun, kısa ve profesyonel 3 farklı Türkçe yanıt taslağı hazırla. 
        Eğer müşteri bir soru soruyorsa ve cevabı 'İşletme Bilgileri'nde yoksa, dürüstçe bilmediğini ve yetkiliye ileteceğini söyle. 
        Yanıtları JSON formatında bir dizi olarak gönder: ["yanıt1", "yanıt2", "yanıt3"].

        İşletme Bilgileri:
        ${kbContext}

        Müşteri Mesaj Geçmişi:
        ${lastMessages.map((m: any) => `${m.is_from_me ? 'Ben' : 'Müşteri'}: ${m.content}`).join('\n')}`;

        // Try v1beta first, then v1 as fallback
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (response.status === 404) {
            response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
        }

        const data = await response.json();
        if (!response.ok) {
            console.error("AI Generate Reply Gemini Error:", data);
            return NextResponse.json({ replies: ["Anlaşıldı, teşekkürler.", "Hemen kontrol ediyorum.", "Nasıl yardımcı olabilirim?"] });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        try {
            const jsonMatch = aiText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const replies = JSON.parse(jsonMatch[0]);
                return NextResponse.json({ replies });
            }
        } catch (e) {
            console.error("AI reply parse error:", e);
        }

        return NextResponse.json({ replies: ["Anlaşıldı, teşekkürler.", "Hemen kontrol ediyorum.", "Nasıl yardımcı olabilirim?"] });

    } catch (error: any) {
        console.error("AI Generate Reply Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
