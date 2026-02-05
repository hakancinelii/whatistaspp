import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();

        // Sadece bekleyen (pending) ve gelecekteki mesajları getir
        const scheduled = await db.all(
            "SELECT * FROM scheduled_messages WHERE user_id = ? AND status = 'pending' ORDER BY scheduled_at ASC",
            [user.userId]
        );

        return NextResponse.json({ scheduled });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, id } = await request.json();
        const db = await getDatabase();

        if (action === 'cancel') {
            await db.run(
                "UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ? AND user_id = ?",
                [id, user.userId]
            );
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
