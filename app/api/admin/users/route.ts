import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

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
        const users = await db.all(`
            SELECT u.id, u.name, u.email, u.role, u.credits, u.package, u.plain_password, u.created_at,
                   (SELECT MAX(is_connected) FROM whatsapp_sessions WHERE user_id = u.id) as is_connected
            FROM users u
            ORDER BY u.created_at DESC
        `);

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

        const { action, userId, amount, packageName, newPassword } = await request.json();
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
        else if (action === 'change_password') {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await db.run('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', [hashedPassword, newPassword, userId]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
