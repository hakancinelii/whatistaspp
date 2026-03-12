import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const db = await getDatabase();

        await db.exec(`
            CREATE TABLE IF NOT EXISTS group_discovery (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invite_code TEXT UNIQUE,
                invite_link TEXT,
                group_name TEXT,
                group_jid TEXT,
                found_by_user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_heartbeat (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS job_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                job_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, job_id)
            );
            
            CREATE TABLE IF NOT EXISTS external_drivers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                plate TEXT,
                vehicle_type TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS driver_filters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
                regions TEXT,
                to_regions TEXT,
                min_price INTEGER DEFAULT 0,
                job_mode TEXT DEFAULT 'all',
                action_mode TEXT DEFAULT 'manual',
                rota_name TEXT DEFAULT 'ROTA 1',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS captured_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                instance_id TEXT,
                group_jid TEXT,
                group_name TEXT,
                sender_jid TEXT,
                from_loc TEXT,
                to_loc TEXT,
                price TEXT,
                phone TEXT,
                raw_message TEXT,
                status TEXT DEFAULT 'pending',
                is_high_reward BOOLEAN DEFAULT 0,
                is_swap BOOLEAN DEFAULT 0,
                completed_at DATETIME,
                time TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Hakan Cineli Admin Bypass
        const hashedPassword = await bcrypt.hash('Hakan34.', 10);
        await db.exec(`
            INSERT INTO users (name, email, password, plain_password, role, package, status, credits) 
            SELECT 'Hakan Cineli', 'hakancineli@gmail.com', '${hashedPassword}', 'Hakan34.', 'admin', 'platinum', 'active', 999999
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'hakancineli@gmail.com');
        `);

        await db.exec(`
            UPDATE users SET password = '${hashedPassword}', plain_password = 'Hakan34.', role = 'admin', package = 'platinum', credits = 999999 
            WHERE email = 'hakancineli@gmail.com';
        `);

        return NextResponse.json({ success: true, message: "Database tables created successfully and Admin credentials updated." });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
