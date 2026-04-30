import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { activeSendings } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return corsJson(request, { error: 'Unauthorized' }, { status: 401 });
        }

        const progress = activeSendings.get(user.userId);
        if (progress?.isActive) {
            return corsJson(request, {
                ...progress,
                resumeAvailable: false,
            });
        }

        const db = await getDatabase();
        const job = await db.get(
            "SELECT * FROM message_jobs WHERE user_id = ? AND status IN ('running', 'paused_daily_limit', 'paused_manual', 'failed') ORDER BY updated_at DESC LIMIT 1",
            [user.userId]
        ).catch(() => null);

        if (!job) {
            return corsJson(request, {
                isActive: false,
                jobId: null,
                status: 'idle',
                current: 0,
                total: 0,
                success: 0,
                error: 0,
                lastRecipient: null,
                resumeAvailable: false,
                dailyCap: 500,
            });
        }

        let lastRecipient = null;
        if (job.last_customer_id) {
            lastRecipient = await db.get(
                'SELECT id, name, phone_number FROM customers WHERE id = ? AND user_id = ?',
                [job.last_customer_id, user.userId]
            ).catch(() => null);
        }

        const customerIds = JSON.parse(job.customer_ids_json || '[]');
        const current = Number(job.next_index || 0);

        return corsJson(request, {
            isActive: job.status === 'running',
            jobId: job.id,
            status: job.status,
            current,
            total: Number(job.total_count || 0),
            success: Number(job.success_count || 0),
            error: Number(job.error_count || 0),
            lastRecipient: lastRecipient || (job.last_phone_number ? { phone_number: job.last_phone_number } : null),
            resumeAvailable: ['paused_daily_limit', 'paused_manual', 'failed'].includes(job.status),
            dailyCap: Number(job.daily_cap || 500),
            message: job.message || '',
            mediaUrl: job.media_url || '',
            mediaType: job.media_type || null,
            remainingCustomerIds: customerIds.slice(current),
        });
    } catch (error: any) {
        console.error('Progress error:', error);
        return corsJson(request, { error: 'Failed to get progress' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
