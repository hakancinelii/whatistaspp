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
        console.log(`[JobsAPI] Fetching jobs for user ${user.userId}...`);

        // Sadece son 24 saatteki işleri getir
        // datetime string formatına ve SQL tırnaklarına dikkat edelim
        const jobs = await db.all(
            "SELECT * FROM captured_jobs WHERE user_id = ? AND created_at >= datetime('now', '-1 day') ORDER BY created_at DESC",
            [user.userId]
        );

        console.log(`[JobsAPI] Found ${jobs?.length || 0} jobs.`);
        return NextResponse.json(jobs || []);
    } catch (error: any) {
        console.error('Jobs GET error detailed:', error.message);
        return NextResponse.json({
            error: 'Failed to fetch jobs',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

        if (status === 'won') {
            await db.run(
                'UPDATE captured_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                [status, jobId, user.userId]
            );
        } else {
            await db.run(
                'UPDATE captured_jobs SET status = ? WHERE id = ? AND user_id = ?',
                [status, jobId, user.userId]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Jobs POST error:', error);
        return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
    }
}
