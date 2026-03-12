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

        let onlineCount = 0;
        try {
            const onlineUsers = await db.get(`SELECT COUNT(*) as count FROM user_heartbeat WHERE last_seen >= datetime('now', '-60 seconds')`);
            onlineCount = onlineUsers?.count || 0;
        } catch (e) { }

        let activeSessionCount = 0;
        try {
            const activeSessions = await db.get('SELECT COUNT(*) as count FROM whatsapp_sessions WHERE is_connected = 1');
            activeSessionCount = activeSessions?.count || 0;
        } catch (e) { }

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

        // Users - basit ve güvenli sorgu
        const users = await db.all(`
            SELECT u.id, u.name, u.email, u.role, u.status, u.credits, u.package, u.plain_password, u.driver_phone, u.created_at
            FROM users u
            ORDER BY u.created_at DESC
        `);

        // Ek bilgileri ayrı sorgularla güvenli şekilde al
        const enrichedUsers = [];
        for (const u of users) {
            let is_online = false;
            let won_count = 0;
            let called_count = 0;

            try {
                const hb = await db.get('SELECT last_seen >= datetime(\'now\', \'-60 seconds\') as online FROM user_heartbeat WHERE user_id = ?', [u.id]);
                is_online = !!hb?.online;
            } catch (e) { }

            try {
                const won = await db.get('SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = \'won\'', [u.id]);
                won_count = won?.count || 0;
                const called = await db.get('SELECT COUNT(*) as count FROM job_interactions WHERE user_id = ? AND status = \'called\'', [u.id]);
                called_count = called?.count || 0;
            } catch (e) { }

            enrichedUsers.push({ ...u, is_online, won_count, called_count, is_connected: false });
        }

        return NextResponse.json({
            users: enrichedUsers,
            stats: {
                totalUsers: totalUsers?.count || 0,
                onlineUsers: onlineCount,
                activeSessions: activeSessionCount,
                totalGroups: totalGroups,
                joinedGroups: joinedGroups
            }
        });
    } catch (error: any) {
        console.error('[Admin Users] Error:', error.message);
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
            await db.run("UPDATE users SET role = 'admin' WHERE id = ?", [userId]);
        }
        else if (action === 'change_password') {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await db.run('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', [hashedPassword, newPassword, userId]);
        }
        else if (action === 'restrict_user') {
            await db.run("UPDATE users SET status = 'restricted' WHERE id = ?", [userId]);
        }
        else if (action === 'ban_user') {
            await db.run("UPDATE users SET status = 'banned' WHERE id = ?", [userId]);
        }
        else if (action === 'unban_user') {
            await db.run("UPDATE users SET status = 'active' WHERE id = ?", [userId]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
