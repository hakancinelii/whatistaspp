import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';

async function tryGemini(prompt: string, apiKey: string) {
    // Sizin anahtarınızın desteklediği kesin modeller
    const endpoints = [
        { v: 'v1beta', m: 'gemini-2.0-flash' },        // En yeni model (Listenizde var)
        { v: 'v1beta', m: 'gemini-flash-latest' },     // Stabil güncel model (Listenizde var)
        { v: 'v1', m: 'gemini-1.5-flash-latest' }      // Fallback
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
                console.warn(`Attempt failed for ${endpoint.m}:`, lastError);
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
        const { text, targetLanguage, detectOnly } = await request.json();

        const prompt = detectOnly
            ? `Detect language code (e.g. "en", "tr"). Text: ${text}`
            : `Translate to ${targetLanguage || 'Turkish'}. Only return result. Text: ${text}`;

        const aiText = await tryGemini(prompt, GEMINI_API_KEY);
        if (!aiText) throw new Error('AI produced empty response');

        return NextResponse.json(detectOnly ? { detectedLanguage: aiText.trim().toLowerCase() } : { original: text, translation: aiText.trim() });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
