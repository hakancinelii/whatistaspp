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
        console.log(`[JobsAPI] Fetching global jobs for user ${user.userId}...`);

        // AKILLI TEKİLLEŞTİRME & ÖZEL DURUM TAKİBİ
        // Aynı işi tekilleştirirken, mevcut kullanıcının o işin içeriğine (telefon+rota+fiyat) 
        // daha önce verdiği tepkiyi (status) de getiriyoruz.
        const jobs = await db.all(`
            SELECT c.*, 
                   COALESCE(
                       (SELECT jix.status 
                        FROM job_interactions jix 
                        JOIN captured_jobs cx ON jix.job_id = cx.id 
                        WHERE jix.user_id = ? 
                          AND cx.phone = c.phone 
                          AND cx.from_loc = c.from_loc 
                          AND cx.to_loc = c.to_loc 
                          AND cx.price = c.price
                        LIMIT 1), 
                       'pending'
                   ) as status,
                   MAX(c.created_at) as latest_at,
                   COUNT(*) as repeat_count
            FROM captured_jobs c
            WHERE c.created_at >= datetime('now', '-1 day')
            GROUP BY c.phone, c.from_loc, c.to_loc, c.price
            ORDER BY latest_at DESC
        `, [user.userId]);

        console.log(`[JobsAPI] Global Pool: Found ${jobs?.length || 0} unique jobs for user ${user.userId}.`);
        return NextResponse.json(jobs || []);
    } catch (error: any) {
        console.error('Jobs GET error detailed:', error.message);
        return NextResponse.json({
            error: 'Failed to fetch jobs',
            details: error.message
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId, status } = await request.json();
        const db = await getDatabase();

        // Ortak havuzda her şoförün kendi durumu (Called, Ignored, Won) olması için
        // job_interactions tablosunu kullanıyoruz.
        await db.run(
            'INSERT INTO job_interactions (user_id, job_id, status) VALUES (?, ?, ?) ON CONFLICT(user_id, job_id) DO UPDATE SET status = EXCLUDED.status',
            [user.userId, jobId, status]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Jobs POST error:', error);
        return NextResponse.json({ error: 'Failed to update job interaction' }, { status: 500 });
    }
}
