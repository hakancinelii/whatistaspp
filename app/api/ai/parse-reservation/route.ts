import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { tryGemini } from '@/lib/ai';


export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
        const { chatHistory } = await request.json();

        const prompt = `Analiz et ve JSON dön: { "date": "YYYY-MM-DD", "time": "HH:mm", "pickup": "", "dropoff": "", "flightCode": "", "price": "", "notes": "" }. Mesajlar: ${chatHistory}`;

        const aiText = await tryGemini(prompt, GEMINI_API_KEY);
        const jsonMatch = aiText?.match(/\{[\s\S]*\}/);
        if (jsonMatch) return NextResponse.json({ info: JSON.parse(jsonMatch[0]) });
        return NextResponse.json({ error: 'Bilgi çıkarılamadı.' }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
