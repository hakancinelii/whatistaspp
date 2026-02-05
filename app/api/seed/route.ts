import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import bcrypt from 'bcryptjs';

// BU SATIR ÇOK ÖNEMLİ: Next.js'in bu sayfayı önbelleğe almasını engeller.
export const dynamic = 'force-dynamic';

export async function GET() {
    const logs: string[] = [];
    try {
        const db = await getDatabase();
        logs.push('Database connected');

        const adminEmail = 'admin@whatistaspp.com';
        const adminPw = await bcrypt.hash('admin123', 10);

        // Önce temizleyelim ki garanti olsun (Debug mod: Her seed sıfırlar)
        await db.run('DELETE FROM users WHERE email = ?', [adminEmail]);
        logs.push('Old admin cleared if existed');

        await db.run(
            'INSERT INTO users (name, email, password, role, credits) VALUES (?, ?, ?, ?, ?)',
            ['Admin User', adminEmail, adminPw, 'admin', 9999]
        );
        logs.push('New Admin inserted successfully');

        const countRes = await db.get('SELECT COUNT(*) as count FROM users');

        return NextResponse.json({
            status: 'Success',
            totalInDB: countRes.count,
            logs
        });
    } catch (e: any) {
        return NextResponse.json({ status: 'Error', error: e.message, logs }, { status: 500 });
    }
}
