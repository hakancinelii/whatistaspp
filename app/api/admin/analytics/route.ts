import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();

        // 1. Son 7 Günlük İş Yakalama Trendi
        const dailyJobs = await db.all(`
            SELECT date(created_at) as date, COUNT(*) as count 
            FROM captured_jobs 
            WHERE created_at >= date('now', '-7 days')
            GROUP BY date(created_at)
            ORDER BY date ASC
        `);

        // 2. Etkileşim Dağılımı (Kazanılan, Aranan, Pas Geçilen)
        const interactionStats = await db.all(`
            SELECT status, COUNT(*) as count 
            FROM job_interactions 
            GROUP BY status
        `);

        // 3. En İyi Performans Gösteren 10 Şoför (Kazanılan İş Sayısına Göre)
        const topDrivers = await db.all(`
            SELECT u.name, COUNT(ji.id) as win_count
            FROM users u
            JOIN job_interactions ji ON u.id = ji.user_id
            WHERE ji.status = 'won'
            GROUP BY u.id
            ORDER BY win_count DESC
            LIMIT 10
        `);

        // 4. En Çok İş Gelen İlk 10 Grup
        const topGroups = await db.all(`
            SELECT group_name, COUNT(*) as count 
            FROM captured_jobs 
            WHERE group_name IS NOT NULL AND group_name != ''
            GROUP BY group_name
            ORDER BY count DESC
            LIMIT 10
        `);

        // 5. Genel Özet Veriler
        const summary = await db.get(`
            SELECT 
                (SELECT COUNT(*) FROM captured_jobs) as total_jobs,
                (SELECT COUNT(*) FROM users WHERE role = 'user') as total_drivers,
                (SELECT COUNT(*) FROM job_interactions WHERE status = 'won') as total_wins
            FROM users LIMIT 1
        `);

        return NextResponse.json({
            dailyJobs,
            interactionStats,
            topDrivers,
            topGroups,
            summary
        });
    } catch (error: any) {
        console.error('[Analytics API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
