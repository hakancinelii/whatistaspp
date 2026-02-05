import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import fs from 'fs';

export async function GET() {
    try {
        const db = await getDatabase();
        const users = await db.all('SELECT id, name, email, role, credits FROM users');

        // Veritabanı dosya bilgilerini al
        const dbPath = '/app/data/database.db';
        let fileStats = {};
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            fileStats = {
                size: stats.size,
                mtime: stats.mtime,
                ctime: stats.ctime
            };
        }

        return NextResponse.json({
            status: 'Debug Info',
            dbPath,
            fileStats,
            count: users.length,
            users
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
