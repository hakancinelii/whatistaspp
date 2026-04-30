import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { activeSendings } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return corsJson(request, { error: 'Unauthorized' }, { status: 401 });
        }

        const progress = activeSendings.get(user.userId);
        if (progress) {
            progress.isActive = false;
            progress.status = 'paused_manual';
        }

        const db = await getDatabase();
        await db.run(
            "UPDATE message_jobs SET status = 'paused_manual', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'running'",
            [user.userId]
        ).catch(() => { });

        return corsJson(request, { success: true, message: 'Sending stopped' });
    } catch (error: any) {
        console.error('Stop error:', error);
        return corsJson(request, { error: 'Failed to stop' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
