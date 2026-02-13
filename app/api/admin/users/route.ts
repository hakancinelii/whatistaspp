import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { getSession } from '@/lib/whatsapp';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();

        const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
        const onlineUsers = await db.get(`SELECT COUNT(*) as count FROM user_heartbeat WHERE last_seen >= datetime('now', '-60 seconds')`);
        const activeSessions = await db.get('SELECT COUNT(*) as count FROM whatsapp_sessions WHERE is_connected = 1');

        // WhatsApp Grup Sayıları
        let totalGroups = 0;
        let joinedGroups = 0;

        try {
            const groupCount = await db.get('SELECT COUNT(*) as count FROM group_discovery');
            totalGroups = groupCount?.count || 0;

            const botSession = await getSession(user.userId, 'gathering');
            if (botSession?.sock?.groupFetchAllParticipating) {
                const parts = await botSession.sock.groupFetchAllParticipating();
                joinedGroups = Object.keys(parts).length;
            } else {
                const mainSession = await getSession(user.userId, 'main');
                if (mainSession?.sock?.groupFetchAllParticipating) {
                    const parts = await mainSession.sock.groupFetchAllParticipating();
                    joinedGroups = Object.keys(parts).length;
                }
            }
        } catch (e) { }

        // Users
        const users = await db.all(`
            SELECT u.id, u.name, u.email, u.role, u.status, u.credits, u.package, u.plain_password, u.driver_phone, u.profile_picture, u.created_at,
                   (SELECT MAX(is_connected) FROM whatsapp_sessions WHERE user_id = u.id) as is_connected,
                   (SELECT last_seen >= datetime('now', '-60 seconds') FROM user_heartbeat WHERE user_id = u.id) as is_online,
                   (SELECT COUNT(*) FROM job_interactions WHERE user_id = u.id AND status = 'won') as won_count,
                   (SELECT COUNT(*) FROM job_interactions WHERE user_id = u.id AND status = 'called') as called_count
            FROM users u
            ORDER BY u.created_at DESC
        `);

        return NextResponse.json({
            users: users.map((u: any) => ({ ...u, is_online: !!u.is_online })),
            stats: {
                totalUsers: totalUsers?.count || 0,
                onlineUsers: onlineUsers?.count || 0,
                activeSessions: activeSessions?.count || 0,
                totalGroups: totalGroups,
                joinedGroups: joinedGroups
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
        else if (action === 'restrict_user') {
            await db.run('UPDATE users SET status = "restricted" WHERE id = ?', [userId]);
        }
        else if (action === 'ban_user') {
            await db.run('UPDATE users SET status = "banned" WHERE id = ?', [userId]);
        }
        else if (action === 'unban_user') {
            await db.run('UPDATE users SET status = "active" WHERE id = ?', [userId]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
