import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();

        // Fetch last 100 messages
        const reports = await db.all(
            'SELECT * FROM sent_messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT 100',
            [user.userId]
        );

        // Calculate stats
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM sent_messages 
            WHERE user_id = ?
        `, [user.userId]);

        return NextResponse.json({
            reports,
            stats: stats || { total: 0, sent: 0, failed: 0 }
        });
    } catch (error: any) {
        console.error('Reports error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
