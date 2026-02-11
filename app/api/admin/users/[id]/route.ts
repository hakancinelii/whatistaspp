import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const admin = await getUserFromToken(request);
        if (!admin || admin.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        const userId = parseInt(params.id);

        if (isNaN(userId)) {
            return NextResponse.json({ error: 'Geçersiz kullanıcı ID' }, { status: 400 });
        }

        // 1. Kullanıcı bilgisi
        const user = await db.get('SELECT id, name, email, role, credits, package, driver_phone, driver_plate, created_at FROM users WHERE id = ?', [userId]);
        if (!user) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
        }

        // 2. WhatsApp bağlantı durumu
        let waSession = null;
        try {
            waSession = await db.get('SELECT is_connected, updated_at FROM whatsapp_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [userId]);
        } catch (e) {
            console.warn(`[Admin User Detail] whatsapp_sessions fetch failed for user ${userId}`);
        }

        // 3. İstatistikler
        let stats = { okMessages: 0, wonJobs: 0, ignoredJobs: 0, totalEarnings: 0 };
        try {
            const okMessageCount = await db.get(`SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = 'called'`, [userId]);
            const wonJobCount = await db.get(`SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = 'won'`, [userId]);
            const ignoredJobCount = await db.get(`SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = 'ignored'`, [userId]);

            stats.okMessages = okMessageCount?.count || 0;
            stats.wonJobs = wonJobCount?.count || 0;
            stats.ignoredJobs = ignoredJobCount?.count || 0;

            const totalEarnings = await db.get(`
                SELECT SUM(COALESCE(CAST(REPLACE(REPLACE(REPLACE(cj.price, '.', ''), ',', ''), ' ₺', '') AS INTEGER), 0)) as total
                FROM job_interactions ji
                JOIN captured_jobs cj ON ji.job_id = cj.id
                WHERE ji.user_id = ? AND ji.status = 'won'
            `, [userId]);
            stats.totalEarnings = totalEarnings?.total || 0;
        } catch (e) {
            console.warn(`[Admin User Detail] Stats fetch failed for user ${userId}`, e);
        }

        // 4. Son etkileşimler
        let recentInteractions = [];
        try {
            recentInteractions = await db.all(`
                SELECT ji.status, ji.created_at as interaction_at,
                       cj.from_loc, cj.to_loc, cj.price, cj.phone, cj.time as job_time
                FROM job_interactions ji
                LEFT JOIN captured_jobs cj ON ji.job_id = cj.id
                WHERE ji.user_id = ?
                ORDER BY ji.created_at DESC
                LIMIT 20
            `, [userId]);
        } catch (e) {
            console.warn(`[Admin User Detail] Recent interactions fetch failed for user ${userId}`);
        }

        // 5. Filtre ayarları
        let filters = null;
        try {
            const filterRow = await db.get('SELECT * FROM driver_filters WHERE user_id = ?', [userId]);
            if (filterRow) {
                filters = {
                    regions: [],
                    to_regions: [],
                    min_price: filterRow.min_price || 0,
                    job_mode: filterRow.job_mode || 'all',
                    action_mode: filterRow.action_mode || 'manual',
                    rota_name: filterRow.rota_name || 'ROTA 1'
                };

                try {
                    if (filterRow.regions) filters.regions = JSON.parse(filterRow.regions);
                } catch (pe) { console.error("JSON parse error regions", pe); }

                try {
                    if (filterRow.to_regions) filters.to_regions = JSON.parse(filterRow.to_regions);
                } catch (pe) { console.error("JSON parse error to_regions", pe); }
            }
        } catch (e) {
            console.warn(`[Admin User Detail] Filters fetch failed for user ${userId}`);
        }

        return NextResponse.json({
            user,
            waSession: waSession || null,
            stats,
            recentInteractions: recentInteractions || [],
            filters
        });
    } catch (error: any) {
        console.error('[Admin User Detail Global Error]', error);
        return NextResponse.json({ error: error.message || 'Sunucu hatası' }, { status: 500 });
    }
}
