import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

async function tryGemini(prompt: string, apiKey: string) {
    const endpoints = [
        { v: 'v1beta', m: 'gemini-1.5-flash-latest' },
        { v: 'v1beta', m: 'gemini-1.5-flash' },
        { v: 'v1', m: 'gemini-1.5-flash-latest' },
        { v: 'v1', m: 'gemini-1.5-flash' }
    ];
    let lastError = null;
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/${endpoint.v}/models/${endpoint.m}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (response.ok) {
                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
            } else {
                const errData = await response.json();
                lastError = errData.error?.message;
            }
        } catch (e: any) { lastError = e.message; }
    }
    throw new Error(lastError || 'All Gemini endpoints failed');
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
        if (!GEMINI_API_KEY) return NextResponse.json({ replies: ["API Anahtarı eksik.", "Lütfen yöneticiyle iletişim kurun.", "Bu özellik şu an devre dışı."] });

        const db = await getDatabase();
        const { lastMessages } = await request.json();
        const kbItems = await db.all('SELECT title, content FROM knowledge_base WHERE user_id = ?', [user.userId]);
        const kbContext = kbItems.map((i: any) => `${i.title}: ${i.content}`).join('\n');

        const prompt = `Sen bir işletme asistanısın. Müşteri mesajlarına en uygun 3 farklı Türkçe yanıt hazırla. Yanıtları JSON listesi olarak ver: ["yanıt1", "yanıt2", "yanıt3"]
        Bilgi: ${kbContext}
        Geçmiş: ${lastMessages.map((m: any) => `${m.is_from_me ? 'Ben' : 'Müşteri'}: ${m.content}`).join('\n')}`;

        const aiText = await tryGemini(prompt, GEMINI_API_KEY);
        const jsonMatch = aiText?.match(/\[[\s\S]*\]/);
        if (jsonMatch) return NextResponse.json({ replies: JSON.parse(jsonMatch[0]) });

        return NextResponse.json({ replies: ["Anlaşıldı, teşekkürler.", "Hemen kontrol ediyorum.", "Nasıl yardımcı olabilirim?"] });
    } catch (error: any) {
        console.error("AI Reply Error:", error);
        return NextResponse.json({ replies: ["Sistem yoğunluğu nedeniyle şu an yanıt verilemiyor.", "Üzgünüz, bir hata oluştu.", "Lütfen tekrar deneyin."] });
    }
}
