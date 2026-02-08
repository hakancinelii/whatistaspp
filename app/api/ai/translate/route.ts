import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { tryGemini } from '@/lib/ai';


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
