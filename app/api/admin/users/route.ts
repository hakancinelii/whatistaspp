import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();

        // Stats
        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
        const totalMessages = await db.get('SELECT COUNT(*) as count FROM sent_messages');
        const activeSessions = await db.get('SELECT COUNT(*) as count FROM whatsapp_sessions WHERE is_connected = 1');

        // Users
        const users = await db.all('SELECT id, name, email, role, credits, package, created_at FROM users ORDER BY created_at DESC');

        return NextResponse.json({
            users,
            stats: {
                totalUsers: totalUsers.count,
                totalMessages: totalMessages.count,
                activeSessions: activeSessions.count
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, userId, amount, packageName } = await request.json();
        const db = await getDatabase();

        if (action === 'add_credits') {
            await db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [amount, userId]);
        }
        else if (action === 'set_package') {
            await db.run('UPDATE users SET package = ? WHERE id = ?', [packageName, userId]);
        }
        else if (action === 'make_admin') {
            await db.run('UPDATE users SET role = "admin" WHERE id = ?', [userId]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
