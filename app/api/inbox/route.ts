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

        // Arşivlenmemiş mesajları çek ve profil bilgilerini ekle
        const messages = await db.all(`
            SELECT 
                'msg_in_' || im.id as id, im.phone_number, 
                COALESCE(c.name, im.name) as name, 
                im.content, im.media_url, im.media_type, 
                im.received_at as timestamp, im.received_at, im.is_read, 0 as is_from_me,
                c.profile_picture_url, c.status as bio_status
            FROM incoming_messages im
            LEFT JOIN customers c ON c.phone_number = im.phone_number AND c.user_id = im.user_id
            WHERE im.user_id = ? 
            AND (c.id IS NULL OR c.is_archived = 0)
            UNION ALL
            SELECT 
                'msg_sent_' || sm.id as id, sm.phone_number, 
                COALESCE(c.name, sm.phone_number) as name, 
                sm.message as content, sm.media_url, sm.media_type, 
                sm.sent_at as timestamp, sm.sent_at as received_at, 1 as is_read, 1 as is_from_me,
                c.profile_picture_url, c.status as bio_status
            FROM sent_messages sm
            LEFT JOIN customers c ON c.phone_number = sm.phone_number AND c.user_id = sm.user_id
            WHERE sm.user_id = ?
            AND (c.id IS NULL OR c.is_archived = 0)
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
