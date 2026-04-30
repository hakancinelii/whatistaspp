import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession, sendMessage, activeSendings } from '@/lib/whatsapp';

type BulkProgress = {
    isActive: boolean;
    jobId: number;
    status: string;
    current: number;
    total: number;
    success: number;
    error: number;
    dailyCap: number;
};

const PACKAGE_LIMITS = { standard: 250, gold: 1000, platinum: 10000 } as const;
const DEFAULT_DAILY_CAP = 500;

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return corsJson(request, { error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        console.log('[API] Message send request:', body);
        const { customerIds, message, isDirect, mediaUrl, mediaType, mediaMimeType, duration, scheduledAt, resume, jobId, replacePausedJob } = body;

        const db = await getDatabase();

        if (!resume && !message && !mediaUrl) {
            return corsJson(request, { error: 'Message or Media required' }, { status: 400 });
        }

        if (scheduledAt) {
            if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
                return corsJson(request, { error: 'Customer IDs required' }, { status: 400 });
            }

            const dbUser = await db.get('SELECT package, role FROM users WHERE id = ?', [user.userId]);
            if (dbUser?.role !== 'admin' && dbUser?.package === 'standard') {
                return corsJson(request, { error: 'Mesaj zamanlama özelliği sadece Gold ve Platinum paketlere özeldir.' }, { status: 403 });
            }

            await db.run(
                'INSERT INTO scheduled_messages (user_id, recipients, content, scheduled_at, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)',
                [user.userId, JSON.stringify(customerIds), message || '', scheduledAt, mediaUrl || null, mediaType || null]
            );
            return corsJson(request, { success: true, scheduled: true });
        }

        const session = await getSession(user.userId);
        if (!session.isConnected) {
            return corsJson(request, { error: 'WhatsApp not connected' }, { status: 400 });
        }

        if (isDirect) {
            const phone = customerIds?.[0];
            if (!phone) {
                return corsJson(request, { error: 'Recipient required' }, { status: 400 });
            }

            const success = await sendMessage(user.userId, phone, message || '', { mediaUrl, mediaType, mediaMimeType, duration });
            if (success) {
                const displayMessage = message || (mediaType === 'audio' ? `Sesli Mesaj (${duration} sn)` : '');
                await db.run(
                    'INSERT INTO sent_messages (user_id, phone_number, message, status, media_url, media_type, sent_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [user.userId, phone, displayMessage, 'sent', mediaUrl, mediaType]
                );
                return corsJson(request, { success: true });
            }

            return corsJson(request, { error: 'Failed to send direct message' }, { status: 500 });
        }

        const dbUser = await db.get('SELECT credits, role, package FROM users WHERE id = ?', [user.userId]);
        const settings = await getUserSettings(db, user.userId);
        const dailyCap = getDailyCap(dbUser, settings);

        let job: any;
        let customers: any[];

        if (resume) {
            job = await db.get(
                "SELECT * FROM message_jobs WHERE id = ? AND user_id = ? AND status IN ('paused_daily_limit', 'paused_manual', 'failed')",
                [jobId, user.userId]
            );

            if (!job) {
                return corsJson(request, { error: 'Devam edilecek gönderim bulunamadı' }, { status: 404 });
            }

            if (message !== undefined || mediaUrl !== undefined || mediaType !== undefined) {
                await db.run(
                    "UPDATE message_jobs SET message = ?, media_url = ?, media_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                    [message ?? job.message ?? '', mediaUrl ?? job.media_url ?? null, mediaType ?? job.media_type ?? null, job.id, user.userId]
                );
                job = await db.get('SELECT * FROM message_jobs WHERE id = ? AND user_id = ?', [job.id, user.userId]);
            }

            customers = await getCustomersForJob(db, user.userId, JSON.parse(job.customer_ids_json || '[]'));
        } else {
            if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
                return corsJson(request, { error: 'Customer IDs required' }, { status: 400 });
            }

            const activeJob = await db.get(
                "SELECT id, status FROM message_jobs WHERE user_id = ? AND status IN ('running', 'paused_daily_limit', 'paused_manual') ORDER BY updated_at DESC LIMIT 1",
                [user.userId]
            );

            if (activeJob) {
                if (activeJob.status === 'running' || !replacePausedJob) {
                    return corsJson(request, {
                        error: 'Devam eden veya duraklatılmış bir gönderim var. Önce mevcut gönderimi tamamlayın veya yeni gönderim olarak başlatın.',
                        jobId: activeJob.id,
                        status: activeJob.status,
                        resumeAvailable: activeJob.status !== 'running'
                    }, { status: 409 });
                }

                await db.run(
                    "UPDATE message_jobs SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status IN ('paused_daily_limit', 'paused_manual', 'failed')",
                    [activeJob.id, user.userId]
                );
            }

            customers = await getCustomersForJob(db, user.userId, customerIds);

            if (customers.length === 0) {
                return corsJson(request, { error: 'No customers found' }, { status: 400 });
            }

            if (dbUser.role !== 'admin' && (dbUser?.credits || 0) < customers.length) {
                return corsJson(request, { error: `Yetersiz Bakiye. ${customers.length} mesaj için ${dbUser?.credits || 0} krediniz var.` }, { status: 402 });
            }

            const result = await db.run(
                `INSERT INTO message_jobs (
                    user_id, status, message, media_url, media_type, customer_ids_json, total_count,
                    next_index, success_count, error_count, daily_cap, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [user.userId, 'queued', message || '', mediaUrl || null, mediaType || null, JSON.stringify(customers.map((c) => c.id)), customers.length, dailyCap]
            );

            job = await db.get('SELECT * FROM message_jobs WHERE id = ? AND user_id = ?', [result.lastID, user.userId]);
        }

        if (!job || !customers.length) {
            return corsJson(request, { error: 'No customers found' }, { status: 400 });
        }

        const sentToday = await getSentToday(db, user.userId);
        if (sentToday >= dailyCap) {
            await db.run(
                "UPDATE message_jobs SET status = 'paused_daily_limit', daily_cap = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                [dailyCap, job.id, user.userId]
            );
            return corsJson(request, {
                success: false,
                paused: true,
                status: 'paused_daily_limit',
                jobId: job.id,
                error: `Günlük gönderim sınırına ulaşıldı. Bugün ${sentToday}/${dailyCap} mesaj gönderildi.`
            }, { status: 429 });
        }

        await db.run(
            "UPDATE message_jobs SET status = 'running', daily_cap = ?, started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            [dailyCap, job.id, user.userId]
        );

        const progress: BulkProgress = {
            isActive: true,
            jobId: job.id,
            status: 'running',
            current: job.next_index || 0,
            total: job.total_count || customers.length,
            success: job.success_count || 0,
            error: job.error_count || 0,
            dailyCap,
        };

        activeSendings.set(user.userId, progress);

        processMessages(user.userId, job.id, customers, db, { mediaUrl: job.media_url, mediaType: job.media_type });

        return corsJson(request, {
            success: true,
            jobId: job.id,
            total: job.total_count || customers.length,
            current: job.next_index || 0,
            dailyCap,
            message: resume ? 'Sending resumed' : 'Sending started'
        });
    } catch (error: any) {
        console.error('Send message error:', error);
        return corsJson(request, { error: 'Failed to start sending' }, { status: 500 });
    }
}

async function getUserSettings(db: any, userId: number) {
    return await db.get('SELECT * FROM user_settings WHERE user_id = ?', [userId]).catch(() => null);
}

function getDailyCap(dbUser: any, settings: any) {
    const settingLimit = Number(settings?.daily_limit || 0);
    const requestedCap = settingLimit > 0 ? Math.min(settingLimit, DEFAULT_DAILY_CAP) : DEFAULT_DAILY_CAP;

    if (dbUser?.role === 'admin') return requestedCap;

    const userPackage = (dbUser?.package || 'standard') as keyof typeof PACKAGE_LIMITS;
    return Math.min(PACKAGE_LIMITS[userPackage] || PACKAGE_LIMITS.standard, requestedCap);
}

async function getSentToday(db: any, userId: number) {
    const sentToday = await db.get(
        "SELECT COUNT(*) as count FROM sent_messages WHERE user_id = ? AND DATE(sent_at) = DATE('now') AND status = 'sent'",
        [userId]
    );
    return Number(sentToday?.count || 0);
}

async function getCustomersForJob(db: any, userId: number, customerIds: number[]) {
    const normalizedIds = customerIds.map((id) => Number(id)).filter(Boolean);
    if (normalizedIds.length === 0) return [];

    const placeholders = normalizedIds.map(() => '?').join(',');
    const customers = await db.all(
        `SELECT * FROM customers WHERE id IN (${placeholders}) AND user_id = ?`,
        [...normalizedIds, userId]
    );

    const byId = new Map(customers.map((customer: any) => [Number(customer.id), customer]));
    return normalizedIds.map((id) => byId.get(id)).filter(Boolean);
}

async function processMessages(
    userId: number,
    jobId: number,
    customers: any[],
    db: any,
    options?: { mediaUrl?: string | null, mediaType?: string | null }
) {
    const progress = activeSendings.get(userId)!;

    let settings = await getUserSettings(db, userId);
    if (!settings) {
        settings = { min_delay: 5, max_delay: 7, daily_limit: DEFAULT_DAILY_CAP, night_mode: 1, message_variation: 1 };
    }

    settings.min_delay = parseInt(settings.min_delay);
    settings.max_delay = parseInt(settings.max_delay);

    if (isNaN(settings.min_delay) || settings.min_delay < 1) settings.min_delay = 5;
    if (isNaN(settings.max_delay) || settings.max_delay <= settings.min_delay) settings.max_delay = settings.min_delay + 2;

    console.log(`[Batch] Settings loaded - Min: ${settings.min_delay}s, Max: ${settings.max_delay}s`);

    try {
        const currentJob = await db.get('SELECT * FROM message_jobs WHERE id = ? AND user_id = ?', [jobId, userId]);
        let sentToday = await getSentToday(db, userId);
        const dailyCap = Number(currentJob?.daily_cap || progress.dailyCap || DEFAULT_DAILY_CAP);

        for (let i = Number(currentJob?.next_index || 0); i < customers.length; i++) {
            if (!progress.isActive) {
                await db.run(
                    "UPDATE message_jobs SET status = 'paused_manual', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'running'",
                    [jobId, userId]
                );
                progress.status = 'paused_manual';
                break;
            }

            if (sentToday >= dailyCap) {
                await db.run(
                    "UPDATE message_jobs SET status = 'paused_daily_limit', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                    [jobId, userId]
                );
                progress.status = 'paused_daily_limit';
                break;
            }

            if (settings.night_mode) {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                const nightStart = 23 * 60;
                const nightEnd = 8 * 60 + 30;

                if (currentTime >= nightStart || currentTime <= nightEnd) {
                    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
                    i--;
                    continue;
                }
            }

            const customer = customers[i];
            progress.current = i;

            try {
                let personalizedMessage = currentJob.message || '';
                personalizedMessage = personalizedMessage.replace(/{{isim}}/gi, customer.name || '');

                if (customer.additional_data) {
                    try {
                        const extra = JSON.parse(customer.additional_data);
                        Object.keys(extra).forEach(key => {
                            const regex = new RegExp(`{{${key}}}`, 'gi');
                            personalizedMessage = personalizedMessage.replace(regex, extra[key]);
                        });
                    } catch (e) {
                        console.error('JSON parse error for customer data:', e);
                    }
                }

                if (settings.message_variation) {
                    const variations = ['', ' ', ' .', '.', '..'];
                    personalizedMessage += variations[Math.floor(Math.random() * variations.length)];
                }

                const success = await sendMessage(userId, customer.phone_number, personalizedMessage, {
                    mediaUrl: options?.mediaUrl || undefined,
                    mediaType: options?.mediaType || undefined,
                });

                if (success) {
                    progress.success++;
                    sentToday++;
                    await db.run(
                        'INSERT INTO sent_messages (user_id, phone_number, message, status, media_url, media_type, job_id, customer_id, queue_index, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                        [userId, customer.phone_number, personalizedMessage, 'sent', options?.mediaUrl, options?.mediaType, jobId, customer.id, i]
                    );

                    const u = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
                    if (u.role !== 'admin') {
                        await db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [userId]);
                    }
                } else {
                    progress.error++;
                    await db.run(
                        'INSERT INTO sent_messages (user_id, phone_number, message, status, job_id, customer_id, queue_index, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                        [userId, customer.phone_number, personalizedMessage, 'failed', jobId, customer.id, i]
                    );
                }
            } catch (error) {
                console.error(`Failed to send message to ${customer.phone_number}:`, error);
                progress.error++;
                await db.run(
                    'INSERT INTO sent_messages (user_id, phone_number, message, status, job_id, customer_id, queue_index, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [userId, customer.phone_number, currentJob.message || '', 'failed', jobId, customer.id, i]
                );
            }

            progress.current = i + 1;
            await db.run(
                `UPDATE message_jobs
                 SET next_index = ?, success_count = ?, error_count = ?, last_customer_id = ?, last_phone_number = ?, last_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`,
                [i + 1, progress.success, progress.error, customer.id, customer.phone_number, jobId, userId]
            );

            if (i < customers.length - 1 && sentToday < dailyCap) {
                const min = parseInt(settings.min_delay) || 5;
                const max = parseInt(settings.max_delay) || (min + 2);
                const delay = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
                console.log(`[Batch] Waiting ${delay}ms before next message (Settings: ${min}-${max}s)`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        const finalJob = await db.get('SELECT next_index, total_count, status FROM message_jobs WHERE id = ? AND user_id = ?', [jobId, userId]);
        if (Number(finalJob?.next_index || 0) >= Number(finalJob?.total_count || customers.length) && finalJob?.status === 'running') {
            await db.run(
                "UPDATE message_jobs SET status = 'completed', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                [jobId, userId]
            );
            progress.status = 'completed';
        }
    } catch (error) {
        console.error(`[Batch] Job ${jobId} failed:`, error);
        progress.status = 'failed';
        await db.run(
            "UPDATE message_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            [jobId, userId]
        );
    } finally {
        progress.isActive = false;
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
