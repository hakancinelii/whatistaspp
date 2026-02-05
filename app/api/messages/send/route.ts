import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession, sendMessage, activeSendings } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        console.log('[API] Message send request:', body);
        const { customerIds, message, isDirect, mediaUrl, mediaType, mediaMimeType, duration, scheduledAt } = body;

        const db = await getDatabase();

        // VALIDATION
        if (!message && !mediaUrl) {
            return NextResponse.json({ error: 'Message or Media required' }, { status: 400 });
        }

        if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
            return NextResponse.json({ error: 'Customer IDs required' }, { status: 400 });
        }

        // --- SCHEDULING LOGIC ---
        if (scheduledAt) {
            const dbUser = await db.get('SELECT package, role FROM users WHERE id = ?', [user.userId]);
            if (dbUser?.role !== 'admin' && dbUser?.package === 'standard') {
                return NextResponse.json({ error: 'Mesaj zamanlama özelliği sadece Gold ve Platinum paketlere özeldir.' }, { status: 403 });
            }

            await db.run(
                'INSERT INTO scheduled_messages (user_id, customer_ids, message, scheduled_at) VALUES (?, ?, ?, ?)',
                [user.userId, JSON.stringify(customerIds), message, scheduledAt]
            );
            return NextResponse.json({ success: true, scheduled: true });
        }

        // --- DIRECT SENDING LOGIC ---
        const session = await getSession(user.userId);
        if (!session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });
        }

        // Handle Direct/Single Reply from Inbox
        if (isDirect) {
            const phone = customerIds[0];
            const success = await sendMessage(user.userId, phone, message || '', { mediaUrl, mediaType, mediaMimeType, duration });
            if (success) {
                const displayMessage = message || (mediaType === 'audio' ? `🎤 Sesli Mesaj (${duration} sn)` : '');
                await db.run(
                    'INSERT INTO sent_messages (user_id, phone_number, message, status, media_url, media_type, sent_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [user.userId, phone, displayMessage, 'sent', mediaUrl, mediaType]
                );
                return NextResponse.json({ success: true });
            } else {
                return NextResponse.json({ error: 'Failed to send direct message' }, { status: 500 });
            }
        }

        // Fetch selected customers for bulk sending
        const placeholders = customerIds.map(() => '?').join(',');
        const customers = await db.all(
            `SELECT * FROM customers WHERE id IN (${placeholders}) AND user_id = ?`,
            [...customerIds, user.userId]
        );

        if (customers.length === 0) {
            return NextResponse.json({ error: 'No customers found' }, { status: 400 });
        }

        // Check credits and package limits
        const dbUser = await db.get('SELECT credits, role, package FROM users WHERE id = ?', [user.userId]);
        const credits = dbUser?.credits || 0;
        const userPackage = (dbUser?.package || 'standard') as 'standard' | 'gold' | 'platinum';

        if (dbUser.role !== 'admin') {
            const PACKAGE_LIMITS = { standard: 250, gold: 1000, platinum: 10000 };
            const dailyLimit = PACKAGE_LIMITS[userPackage];

            const sentToday = await db.get(
                "SELECT COUNT(*) as count FROM sent_messages WHERE user_id = ? AND DATE(sent_at) = DATE('now') AND status = 'sent'",
                [user.userId]
            );

            const requestedCount = customers.length;
            if (sentToday.count + requestedCount > dailyLimit) {
                return NextResponse.json({
                    error: `Günlük mesaj limitine ulaşıldı. ${userPackage.toUpperCase()} paket limiti: ${dailyLimit}. Bugün gönderilen: ${sentToday.count}. Lütfen paketinizi yükseltin.`
                }, { status: 403 });
            }
        }

        if (dbUser.role !== 'admin' && credits < customers.length) {
            return NextResponse.json({ error: `Yetersiz Bakiye. ${customers.length} mesaj için ${credits} krediniz var.` }, { status: 402 });
        }

        // Initialize progress tracking
        activeSendings.set(user.userId, {
            isActive: true,
            current: 0,
            total: customers.length,
            success: 0,
            error: 0,
        });

        // Start sending in background
        processMessages(user.userId, customers, message, db);

        return NextResponse.json({
            success: true,
            total: customers.length,
            message: 'Sending started'
        });
    } catch (error: any) {
        console.error('Send message error:', error);
        return NextResponse.json({ error: 'Failed to start sending' }, { status: 500 });
    }
}

async function processMessages(
    userId: number,
    customers: any[],
    message: string,
    db: any
) {
    const progress = activeSendings.get(userId)!;

    let settings = await db.get('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
    if (!settings) {
        settings = { min_delay: 50, max_delay: 100, daily_limit: 250, night_mode: 1, message_variation: 1 };
    }

    for (let i = 0; i < customers.length; i++) {
        if (!progress.isActive) break;

        // Check Night Mode
        if (settings.night_mode) {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            const currentTime = hour * 60 + minute;
            const nightStart = 23 * 60;
            const nightEnd = 8 * 60 + 30;

            if (currentTime >= nightStart || currentTime <= nightEnd) {
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
                i--;
                continue;
            }
        }

        const customer = customers[i];
        progress.current = i + 1;

        try {
            let personalizedMessage = message;

            // 1. Core Variables: {{isim}}
            const nameValue = customer.name || "";
            personalizedMessage = personalizedMessage.replace(/{{isim}}/gi, nameValue);

            // 2. Custom Variables from additional_data
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
                const randomVar = variations[Math.floor(Math.random() * variations.length)];
                personalizedMessage += randomVar;
            }

            const success = await sendMessage(userId, customer.phone_number, personalizedMessage);

            if (success) {
                progress.success++;
                await db.run(
                    'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [userId, customer.phone_number, personalizedMessage, 'sent']
                );

                const u = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
                if (u.role !== 'admin') {
                    await db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [userId]);
                }
            } else {
                progress.error++;
                await db.run(
                    'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [userId, customer.phone_number, personalizedMessage, 'failed']
                );
            }

            if (i < customers.length - 1) {
                const min = settings.min_delay || 50;
                const max = settings.max_delay || 100;
                const delay = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }

        } catch (error) {
            console.error(`Failed to send message to ${customer.phone_number}:`, error);
            progress.error++;
            await db.run(
                'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [userId, customer.phone_number, message, 'failed']
            );
        }
    }

    progress.isActive = false;
}
