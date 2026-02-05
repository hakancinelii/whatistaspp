import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import path from 'path';
import fs from 'fs';

export async function GET() {
    try {
        const cwd = process.cwd();
        const dataDir = path.join(cwd, 'data');
        const dbPath = path.join(dataDir, 'database.db');

        // Get file size
        let fileSize = 0;
        if (fs.existsSync(dbPath)) {
            fileSize = fs.statSync(dbPath).size;
        }

        const db = await getDatabase();
        const users = await db.all('SELECT id, name, email, role FROM users');
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");

        return NextResponse.json({
            cwd,
            dataDir,
            dbPath,
            fileSize,
            tables: (tables as any[]).map(t => t.name),
            userCount: users.length,
            users: users
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
