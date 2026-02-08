import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { tryGemini } from '@/lib/ai';


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
