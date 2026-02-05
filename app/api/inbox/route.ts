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

        // Arşivlenmemiş mesajları çek (Baileys'ten gelen arşiv bilgisini kullanır)
        const messages = await db.all(`
            SELECT 'msg_in_' || id as id, phone_number, name, content, media_url, media_type, received_at as timestamp, received_at, is_read, 0 as is_from_me 
            FROM incoming_messages im
            WHERE user_id = ? 
            AND NOT EXISTS (
                SELECT 1 FROM customers c 
                WHERE c.phone_number = im.phone_number 
                AND c.user_id = im.user_id 
                AND c.is_archived = 1
            )
            UNION ALL
            SELECT 'msg_sent_' || id as id, phone_number, 'Siz' as name, message as content, media_url, media_type, sent_at as timestamp, sent_at as received_at, 1 as is_read, 1 as is_from_me 
            FROM sent_messages sm
            WHERE user_id = ?
            AND NOT EXISTS (
                SELECT 1 FROM customers c 
                WHERE c.phone_number = sm.phone_number 
                AND c.user_id = sm.user_id 
                AND c.is_archived = 1
            )
            ORDER BY timestamp DESC LIMIT 300
        `, [user.userId, user.userId]);

        return NextResponse.json({
            messages: messages.map((m: any) => ({
                ...m,
                received_at: m.timestamp // Map for UI compatibility
            }))
        });
    } catch (error: any) {
        console.error('Inbox error:', error);
        return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
    }
}
