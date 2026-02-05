import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';

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
        if (!GEMINI_API_KEY) return NextResponse.json({ error: 'AI Service configuration missing' }, { status: 500 });

        const { chatHistory } = await request.json();
        const prompt = `Sen bir turizm acentesi asistanısın. Aşağıdaki WhatsApp sohbet geçmişini analiz ederek bir transfer rezervasyonu için gerekli bilgileri çıkar. Yanıtı SADECE şu JSON formatında ver:
        {
            "date": "YYYY-MM-DD",
            "time": "HH:mm",
            "pickup": "Alış Noktası",
            "dropoff": "Varış Noktası",
            "flightCode": "Uçuş Kodu",
            "price": "Tahmini Fiyat",
            "notes": "Ek notlar"
        }
        Sohbet Geçmişi: ${chatHistory}`;

        const aiText = await tryGemini(prompt, GEMINI_API_KEY);
        const jsonMatch = aiText?.match(/\{[\s\S]*\}/);
        if (jsonMatch) return NextResponse.json({ info: JSON.parse(jsonMatch[0]) });

        return NextResponse.json({ error: 'Bilgi çıkarılamadı.' }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
