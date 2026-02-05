import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        const messages = await db.all(
            'SELECT * FROM sent_messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT 500',
            [user.userId]
        );

        return NextResponse.json({ messages });
    } catch (error: any) {
        console.error('History error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
