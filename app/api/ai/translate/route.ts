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
                console.warn(`Gemini Try Failed (${endpoint.v}/${endpoint.m}):`, errData.error?.message);
                lastError = errData.error?.message;
            }
        } catch (e: any) {
            lastError = e.message;
        }
    }
    throw new Error(lastError || 'All Gemini endpoints failed');
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
        if (!GEMINI_API_KEY) return NextResponse.json({ error: 'AI Service configuration missing' }, { status: 500 });

        const { text, targetLanguage, detectOnly } = await request.json();
        if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

        const prompt = detectOnly
            ? `Aşağıdaki metnin dilini tespit et. Sadece dil kodunu döndür (örn: "en", "de", "fr", "ar", "ru", "tr", "es", "it"). Başka bir şey yazma. Metin: ${text}`
            : `Sen profesyonel bir çevirmenisin. Aşağıdaki metni ${targetLanguage || 'Türkçe'} diline çevir. Sadece çeviriyi döndür, başka hiçbir şey yazma. Orijinal anlamı koru. Metin: ${text}`;

        const aiText = await tryGemini(prompt, GEMINI_API_KEY);
        if (!aiText) throw new Error('AI produced empty response');

        const cleanedText = aiText.trim();
        if (detectOnly) return NextResponse.json({ detectedLanguage: cleanedText.toLowerCase() });

        return NextResponse.json({ original: text, translation: cleanedText, targetLanguage: targetLanguage || 'tr' });
    } catch (error: any) {
        console.error('Translation error detailed:', error);
        return NextResponse.json({ error: `Translation failed: ${error.message}` }, { status: 500 });
    }
}
