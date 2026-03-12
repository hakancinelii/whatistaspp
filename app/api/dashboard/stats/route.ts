import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const isPostgres = !!process.env.DATABASE_URL;

        // 1. Toplam Müşteri
        const customers = await db.get('SELECT COUNT(*) as count FROM customers WHERE user_id = ?', [user.userId]);

        // 2. Toplam Gönderilen
        const sent = await db.get("SELECT COUNT(*) as count FROM sent_messages WHERE user_id = ? AND status = 'sent'", [user.userId]);

        // 3. Bekleyenler
        const pending = await db.get("SELECT COUNT(*) as count FROM scheduled_messages WHERE user_id = ? AND status = 'pending'", [user.userId]);

        // 4. Bugün Gönderilen (Postgres ve SQLite uyumlu)
        let todayQuery = "SELECT COUNT(*) as count FROM sent_messages WHERE user_id = ? AND status = 'sent' AND sent_at >= CURRENT_DATE";
        if (!isPostgres) {
            todayQuery = "SELECT COUNT(*) as count FROM sent_messages WHERE user_id = ? AND status = 'sent' AND DATE(sent_at) = DATE('now')";
        }
        const today = await db.get(todayQuery, [user.userId]);

        // 5. Son Aktiviteler
        const activities = await db.all(`
            SELECT phone_number, status, sent_at 
            FROM sent_messages 
            WHERE user_id = ? 
            ORDER BY sent_at DESC LIMIT 5
        `, [user.userId]);

        return NextResponse.json({
            totalCustomers: parseInt(customers?.count || 0),
            sentMessages: parseInt(sent?.count || 0),
            pendingMessages: parseInt(pending?.count || 0),
            todayCount: parseInt(today?.count || 0),
            weeklyStats: [], // Grafiği basitlik için şimdilik boş bıkırakalım
            activities: activities || []
        });
    } catch (error: any) {
        console.error("Stats Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
