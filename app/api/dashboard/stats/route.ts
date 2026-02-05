import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();

        // 1. Toplam Müşteri
        const customers = await db.get('SELECT COUNT(*) as count FROM customers WHERE user_id = ?', [user.userId]);

        // 2. Toplam Gönderilen (Başarılı)
        const sent = await db.get("SELECT COUNT(*) as count FROM sent_messages WHERE user_id = ? AND status = 'sent'", [user.userId]);

        // 3. Bekleyen Zamanlanmış Mesajlar
        const pending = await db.get("SELECT COUNT(*) as count FROM scheduled_messages WHERE user_id = ? AND status = 'pending'", [user.userId]);

        // 4. Bugün Gönderilen
        const today = await db.get("SELECT COUNT(*) as count FROM sent_messages WHERE user_id = ? AND DATE(sent_at) = DATE('now') AND status = 'sent'", [user.userId]);

        // 5. Haftalık İstatistikler
        const weeklyRaw = await db.all(`
            SELECT 
                CASE CAST(strftime('%w', sent_at) AS INTEGER)
                    WHEN 0 THEN 'Paz' WHEN 1 THEN 'Pzt' WHEN 2 THEN 'Sal' 
                    WHEN 3 THEN 'Çar' WHEN 4 THEN 'Per' WHEN 5 THEN 'Cum' WHEN 6 THEN 'Cmt'
                END as day,
                COUNT(*) as count
            FROM sent_messages
            WHERE user_id = ? AND sent_at >= date('now', '-7 days') AND status = 'sent'
            GROUP BY day
        `, [user.userId]);

        // 6. Son Aktiviteler (Son 5 mesaj)
        const activities = await db.all(`
            SELECT phone_number, status, sent_at 
            FROM sent_messages 
            WHERE user_id = ? 
            ORDER BY sent_at DESC LIMIT 5
        `, [user.userId]);

        return NextResponse.json({
            totalCustomers: customers.count || 0,
            sentMessages: sent.count || 0,
            pendingMessages: pending.count || 0,
            todayCount: today.count || 0,
            weeklyStats: weeklyRaw || [],
            activities: activities || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
