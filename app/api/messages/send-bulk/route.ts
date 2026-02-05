import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession, sendMessage } from '@/lib/whatsapp';

// Store active sending sessions
const activeSendings = new Map<number, {
    isActive: boolean;
    current: number;
    total: number;
    success: number;
    error: number;
}>();

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message required' }, { status: 400 });
        }

        const session = await getSession(user.userId);
        if (!session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });
        }

        const db = await getDatabase();
        const customers = await db.all(
            'SELECT * FROM customers WHERE user_id = ?',
            [user.userId]
        );

        if (customers.length === 0) {
            return NextResponse.json({ error: 'No customers found' }, { status: 400 });
        }

        // Check credits
        const dbUser = await db.get('SELECT credits FROM users WHERE id = ?', [user.userId]);
        const credits = dbUser?.credits || 0;

        if (credits < customers.length && user.role !== 'admin') {
            return NextResponse.json({ error: `Yetersiz Bakiye. ${customers.length} mesaj için ${credits} krediniz var.` }, { status: 402 });
        }

        // Initialize progress
        activeSendings.set(user.userId, {
            isActive: true,
            current: 0,
            total: customers.length,
            success: 0,
            error: 0,
        });

        // Start sending in background
        sendBulkMessages(user.userId, customers, message, db);

        return NextResponse.json({
            success: true,
            total: customers.length,
            message: 'Sending started'
        });
    } catch (error: any) {
        console.error('Send bulk error:', error);
        return NextResponse.json({ error: 'Failed to start sending' }, { status: 500 });
    }
}

async function sendBulkMessages(
    userId: number,
    customers: any[],
    message: string,
    db: any
) {
    const progress = activeSendings.get(userId)!;

    for (let i = 0; i < customers.length; i++) {
        if (!progress.isActive) break;

        const customer = customers[i];
        progress.current = i + 1;

        // Re-check credits before EACH message to prevent race conditions or negative balance if modified externally
        // Also enables stopping if credits run out mid-flight
        const user = await db.get('SELECT credits, role FROM users WHERE id = ?', [userId]);
        if (user.role !== 'admin' && user.credits <= 0) {
            console.log(`User ${userId} ran out of credits.`);
            progress.isActive = false;
            break;
        }

        try {
            // Add message variation
            const variedMessage = addMessageVariation(message);

            // Send message
            const success = await sendMessage(userId, customer.phone_number, variedMessage);

            if (success) {
                progress.success++;
                await db.run(
                    'INSERT INTO sent_messages (user_id, phone_number, message, status) VALUES (?, ?, ?, ?)',
                    [userId, customer.phone_number, variedMessage, 'sent']
                );

                // Deduct credit if not admin
                if (user.role !== 'admin') {
                    await db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [userId]);
                }

            } else {
                progress.error++;
                await db.run(
                    'INSERT INTO sent_messages (user_id, phone_number, message, status) VALUES (?, ?, ?, ?)',
                    [userId, customer.phone_number, variedMessage, 'failed']
                );
            }

            // Anti-spam delay (50-100 seconds)
            const delay = (50 + Math.random() * 50) * 1000;
            await new Promise((r) => setTimeout(r, delay));

        } catch (error) {
            console.error(`Error sending to ${customer.phone_number}:`, error);
            progress.error++;
        }
    }

    progress.isActive = false;
}

function addMessageVariation(message: string): string {
    const greetings = ['Merhaba', 'Selam', 'İyi günler', 'Merhabalar'];
    const closings = ['😊', '👍', '🙏', '✨', 'Teşekkürler', 'İyi çalışmalar'];

    let result = message.trim();

    // Add random greeting (50% chance)
    if (Math.random() > 0.5) {
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        result = greeting + ' ' + result;
    }

    // Add random closing
    const closing = closings[Math.floor(Math.random() * closings.length)];
    result = result + ' ' + closing;

    // Add invisible space for uniqueness
    const invisibleSpaces = '\u200B'.repeat(Math.floor(Math.random() * 5));
    return result + invisibleSpaces;
}

// Export for progress endpoint
export { activeSendings };
