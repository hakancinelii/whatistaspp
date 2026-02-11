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

        // Kullanıcı bilgisi
        const user = await db.get('SELECT id, name, email, role, credits, package, driver_phone, driver_plate, created_at FROM users WHERE id = ?', [userId]);
        if (!user) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
        }

        // WhatsApp bağlantı durumu
        const waSession = await db.get('SELECT is_connected, updated_at FROM whatsapp_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [userId]);

        // OK mesajı gönderme sayısı (Son 30 gün)
        const okMessageCount = await db.get(
            `SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = 'called'`,
            [userId]
        );

        // Kazanılan iş sayısı
        const wonJobCount = await db.get(
            `SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = 'won'`,
            [userId]
        );

        // Yoksayılan iş sayısı
        const ignoredJobCount = await db.get(
            `SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = 'ignored'`,
            [userId]
        );

        // Son 10 iş etkileşimi (Arama, kazanma, yoksayma detayları)
        const recentInteractions = await db.all(`
            SELECT ji.status, ji.created_at as interaction_at,
                   cj.from_loc, cj.to_loc, cj.price, cj.phone, cj.time as job_time
            FROM job_interactions ji
            LEFT JOIN captured_jobs cj ON ji.job_id = cj.id
            WHERE ji.user_id = ?
            ORDER BY ji.created_at DESC
            LIMIT 20
        `, [userId]);

        // Filtre ayarları
        const filters = await db.get('SELECT * FROM driver_filters WHERE user_id = ?', [userId]);

        // Toplam kazanç - SQLite'da daha güvenli hesaplama (sadece rakamları temizle ve topla)
        // Eğer karmaşık bir string ise 0 döner
        const totalEarnings = await db.get(`
            SELECT SUM(COALESCE(CAST(REPLACE(REPLACE(REPLACE(cj.price, '.', ''), ',', ''), ' ₺', '') AS INTEGER), 0)) as total
            FROM job_interactions ji
            JOIN captured_jobs cj ON ji.job_id = cj.id
            WHERE ji.user_id = ? AND ji.status = 'won'
        `, [userId]);

        return NextResponse.json({
            user,
            waSession: waSession || null,
            stats: {
                okMessages: okMessageCount?.count || 0,
                wonJobs: wonJobCount?.count || 0,
                ignoredJobs: ignoredJobCount?.count || 0,
                totalEarnings: totalEarnings?.total || 0
            },
            recentInteractions: recentInteractions || [],
            filters: filters ? {
                regions: filters.regions ? JSON.parse(filters.regions) : [],
                to_regions: filters.to_regions ? JSON.parse(filters.to_regions) : [],
                min_price: filters.min_price,
                job_mode: filters.job_mode,
                action_mode: filters.action_mode,
                rota_name: filters.rota_name
            } : null
        });
    } catch (error: any) {
        console.error('[Admin User Detail Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
