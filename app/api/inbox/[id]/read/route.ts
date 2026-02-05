import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        await db.run(
            'UPDATE incoming_messages SET is_read = 1 WHERE id = ? AND user_id = ?',
            [params.id, user.userId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Mark as read error:', error);
        return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
    }
}
