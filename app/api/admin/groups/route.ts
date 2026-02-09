import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession } from '@/lib/whatsapp';

export const dynamic = "force-dynamic";

// Keşfedilen grupları listele
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        const groups = await db.all(`
            SELECT gd.*, u.email as found_by 
            FROM group_discovery gd
            LEFT JOIN users u ON gd.found_by_user_id = u.id
            ORDER BY gd.created_at DESC
        `);

        return NextResponse.json(groups);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Gruba katıl
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { code } = await request.json();
        if (!code) return NextResponse.json({ error: 'Invite code required' }, { status: 400 });

        const session = await getSession(user.userId);
        if (!session.sock || !session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });
        }

        const result = await session.sock.groupAcceptInvite(code);

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('[Groups API] Join Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
