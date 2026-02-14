import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { connectWhatsApp, sendMessage, getSession } from '@/lib/whatsapp';

// Internal secret to prevent unauthorized access if exposed
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET || 'scheduler-secret-key';

export async function GET(request: NextRequest) {
    // Optional: Check for a secret header if called efficiently, 
    // but for local app with auth cookie it's fine to rely on session or just open if local.
    // We'll require a valid user token if triggered from frontend

    try {
        const db = await getDatabase();
        const now = new Date().toISOString();

        // Find pending messages due now or in the past
        // Limit to 5 to avoid timeouts in one run
        const pendingMessages = await db.all(
            `SELECT * FROM scheduled_messages 
       WHERE status = 'pending' AND scheduled_at <= ? 
       ORDER BY scheduled_at ASC LIMIT 5`,
            [now]
        );

        if (!pendingMessages || pendingMessages.length === 0) {
            return NextResponse.json({ processed: 0 });
        }

        let processedCount = 0;

        for (const msg of pendingMessages) {
            try {
                // Update status to processing to prevent double pick-up
                await db.run(
                    "UPDATE scheduled_messages SET status = 'processing' WHERE id = ?",
                    [msg.id]
                );

                // Get recipients
                let recipients: string[] = [];
                if (msg.recipients === 'all') {
                    const customers = await db.all(
                        'SELECT phone_number FROM customers WHERE user_id = ?',
                        [msg.user_id]
                    );
                    recipients = customers.map((c) => c.phone_number);
                } else {
                    const ids = JSON.parse(msg.recipients);
                    if (Array.isArray(ids) && ids.length > 0) {
                        const placeholders = ids.map(() => '?').join(',');
                        const customers = await db.all(
                            `SELECT phone_number FROM customers WHERE id IN (${placeholders})`,
                            ids
                        );
                        recipients = customers.map((c) => c.phone_number);
                    }
                }

                // Initialize WhatsApp connection for this user
                await connectWhatsApp(msg.user_id);
                const session = await getSession(msg.user_id);

                if (!session.sock || !session.isConnected) {
                    throw new Error('WhatsApp not connected');
                }

                // Send messages (in background/bulk logic)
                // For simplicity in this scheduler, we'll queue them into the bulk sender 
                // OR process them here with delays.
                // Since this is a simple scheduled run, we'll use a direct sending loop with minimal delay 
                // or trigger the bulk API internally. 
                // For robustness, we will send them here.

                let successCount = 0;
                let failCount = 0;

                for (const phone of recipients) {
                    try {
                        // Add variation if settings allow (skipped for now, raw content)
                        await sendMessage(msg.user_id, phone, msg.content);

                        // Log to sent_messages
                        await db.run(
                            'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                            [msg.user_id, phone, msg.content, 'sent']
                        );

                        successCount++;

                        // Small delay to be safe even in scheduler
                        await new Promise(r => setTimeout(r, 2000));

                    } catch (err) {
                        console.error(`Failed to send scheduled to ${phone}:`, err);
                        failCount++;
                        await db.run(
                            'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                            [msg.user_id, phone, msg.content, 'failed']
                        );
                    }
                }

                // Update status to completed
                await db.run(
                    "UPDATE scheduled_messages SET status = 'completed' WHERE id = ?",
                    [msg.id]
                );
                processedCount++;

            } catch (error) {
                console.error(`Failed to process scheduled msg ${msg.id}:`, error);
                await db.run(
                    "UPDATE scheduled_messages SET status = 'failed' WHERE id = ?",
                    [msg.id]
                );
            }
        }

        return NextResponse.json({ processed: processedCount });
    } catch (error: any) {
        console.error('Scheduler error:', error);
        return NextResponse.json({ error: 'Scheduler failed' }, { status: 500 });
    }
}
