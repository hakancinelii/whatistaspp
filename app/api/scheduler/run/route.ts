import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { sendMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

function personalizeMessage(template: string, customer: any) {
    let message = template.replace(/{{isim}}/gi, customer.name || '');

    if (customer.additional_data) {
        try {
            const extra = JSON.parse(customer.additional_data);
            Object.keys(extra).forEach((key) => {
                message = message.replace(new RegExp(`{{${key}}}`, 'gi'), extra[key]);
            });
        } catch (error) { }
    }

    return message;
}

export async function GET() {
    try {
        const db = await getDatabase();
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];
        const pending = await db.all(
            "SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC LIMIT 5",
            [now]
        );

        const results = [];

        for (const job of pending) {
            await db.run("UPDATE scheduled_messages SET status = 'processing' WHERE id = ?", [job.id]);

            try {
                const customerIds = JSON.parse(job.recipients || '[]').map((id: any) => Number(id)).filter(Boolean);
                if (customerIds.length === 0) {
                    await db.run("UPDATE scheduled_messages SET status = 'failed' WHERE id = ?", [job.id]);
                    results.push({ id: job.id, status: 'failed', reason: 'no_recipients' });
                    continue;
                }

                const placeholders = customerIds.map(() => '?').join(',');
                const customers = await db.all(
                    `SELECT * FROM customers WHERE id IN (${placeholders}) AND user_id = ?`,
                    [...customerIds, job.user_id]
                );
                const byId = new Map(customers.map((customer: any) => [Number(customer.id), customer]));
                const orderedCustomers = customerIds.map((id: number) => byId.get(id)).filter(Boolean);

                let sent = 0;
                let failed = 0;

                for (const customer of orderedCustomers) {
                    const message = personalizeMessage(job.content || '', customer);
                    const success = await sendMessage(job.user_id, customer.phone_number, message, {
                        mediaUrl: job.media_url || undefined,
                        mediaType: job.media_type || undefined,
                    });

                    await db.run(
                        'INSERT INTO sent_messages (user_id, phone_number, message, status, media_url, media_type, sent_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                        [job.user_id, customer.phone_number, message, success ? 'sent' : 'failed', job.media_url || null, job.media_type || null]
                    );

                    if (success) sent++;
                    else failed++;
                }

                await db.run("UPDATE scheduled_messages SET status = ? WHERE id = ?", [failed > 0 ? 'failed' : 'sent', job.id]);
                results.push({ id: job.id, status: failed > 0 ? 'failed' : 'sent', sent, failed });
            } catch (error: any) {
                await db.run("UPDATE scheduled_messages SET status = 'failed' WHERE id = ?", [job.id]);
                results.push({ id: job.id, status: 'failed', error: error.message });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, results });
    } catch (error: any) {
        console.error('[Scheduler API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
