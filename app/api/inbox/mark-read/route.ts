import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { phone_number } = await request.json();
        if (!phone_number) return NextResponse.json({ error: 'Phone required' }, { status: 400 });

        const db = await getDatabase();
        await db.run(
            'UPDATE incoming_messages SET is_read = 1 WHERE user_id = ? AND phone_number = ?',
            [user.userId, phone_number]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
