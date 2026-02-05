import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not defined in environment variables');
            return NextResponse.json({ error: 'AI Service configuration missing' }, { status: 500 });
        }

        const db = await getDatabase();
        const dbUser = await db.get('SELECT package, role FROM users WHERE id = ?', [user.userId]);
        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { text, targetLanguage, detectOnly } = await request.json();
        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const prompt = detectOnly
            ? `Aşağıdaki metnin dilini tespit et. Sadece dil kodunu döndür (örn: "en", "de", "fr", "ar", "ru", "tr", "es", "it"). Başka bir şey yazma. Metin: ${text}`
            : `Sen profesyonel bir çevirmenisin. Aşağıdaki metni ${targetLanguage || 'Türkçe'} diline çevir. Sadece çeviriyi döndür, başka hiçbir şey yazma. Orijinal anlamı koru. Metin: ${text}`;

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
            console.error('Gemini API Error:', data);
            throw new Error(data.error?.message || 'Gemini API connection failed');
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleanedText = aiText.trim();

        if (detectOnly) {
            return NextResponse.json({ detectedLanguage: cleanedText.toLowerCase() });
        }

        return NextResponse.json({
            original: text,
            translation: cleanedText,
            targetLanguage: targetLanguage || 'tr'
        });
    } catch (error: any) {
        console.error('Translation error detailed:', error);
        return NextResponse.json({ error: `Translation failed: ${error.message}` }, { status: 500 });
    }
}
