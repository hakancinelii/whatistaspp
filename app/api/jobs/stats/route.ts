import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();

        // Son 24 saat içindeki işleri bölgelere göre grupla (From Loc)
        const stats = await db.all(
            `SELECT from_loc as location, COUNT(*) as count 
             FROM captured_jobs 
             WHERE user_id = ? AND created_at >= datetime('now', '-24 hours')
             GROUP BY from_loc 
             ORDER BY count DESC 
             LIMIT 10`,
            [user.userId]
        );

        return NextResponse.json(stats || []);
    } catch (error: any) {
        console.error('Stats GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
