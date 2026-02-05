import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

async function tryGemini(prompt: string, apiKey: string) {
    const endpoints = [
        { v: 'v1beta', m: 'gemini-2.0-flash' },
        { v: 'v1beta', m: 'gemini-flash-latest' },
        { v: 'v1', m: 'gemini-1.5-flash-latest' }
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
        const db = await getDatabase();
        const { lastMessages } = await request.json();
        const kbItems = await db.all('SELECT title, content FROM knowledge_base WHERE user_id = ?', [user.userId]);
        const kbContext = kbItems.map((i: any) => `${i.title}: ${i.content}`).join('\n');

        const prompt = `Yalnızca bir JSON dizisi olarak 3 profesyonel yanıt döndür. Bilgi: ${kbContext}. Mesajlar: ${lastMessages.map((m: any) => m.content).join('\n')}`;

        const aiText = await tryGemini(prompt, GEMINI_API_KEY);
        const jsonMatch = aiText?.match(/\[[\s\S]*\]/);
        if (jsonMatch) return NextResponse.json({ replies: JSON.parse(jsonMatch[0]) });

        return NextResponse.json({ replies: ["Tamamdır.", "İlgileniyorum.", "Anlaşıldı."] });
    } catch (error: any) {
        return NextResponse.json({ replies: ["Sistem hatası.", "Tekrar deneyin."] });
    }
}
