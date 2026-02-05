import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'AI Service configuration missing' }, { status: 500 });
        }

        const db = await getDatabase();
        const dbUser = await db.get('SELECT package FROM users WHERE id = ?', [user.userId]);
        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { chatHistory } = await request.json();

        const prompt = `Sen bir turizm acentesi asistanısın. Aşağıdaki WhatsApp sohbet geçmişini analiz ederek bir transfer rezervasyonu için gerekli bilgileri çıkar. 
        Bilgileri bulamazsan boş bırak. Tarih formatı YYYY-MM-DD, saat formatı HH:mm olmalı.
        Yanıtı SADECE şu JSON formatında ver:
        {
            "date": "YYYY-MM-DD",
            "time": "HH:mm",
            "pickup": "Alış Noktası",
            "dropoff": "Varış Noktası",
            "flightCode": "Uçuş Kodu",
            "price": "Tahmini Fiyat (Sadece sayı)",
            "notes": "Ek notlar (valiz sayısı, kişi sayısı vb.)"
        }

        Sohbet Geçmişi:
        ${chatHistory}`;

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
            console.error('Gemini API Error (Parse):', data);
            throw new Error(data.error?.message || 'Gemini API connection failed');
        }

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // JSON'ı temizle
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const info = JSON.parse(jsonMatch[0]);
            return NextResponse.json({ info });
        }

        return NextResponse.json({ error: 'Bilgi çıkarılamadı.' }, { status: 404 });
    } catch (error: any) {
        console.error("AI Parse Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
