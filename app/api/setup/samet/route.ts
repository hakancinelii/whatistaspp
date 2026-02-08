
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDatabase } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDatabase();

        // Önce tüm kullanıcıları bir görelim (Sadece log için)
        const allUsers = await db.all('SELECT email FROM users');
        console.log('[DEBUG] Current Users:', allUsers.map((u: any) => u.email));

        const email = 'samettravel@whatistaspp.com'.toLowerCase();
        const password = 'Samettravel34';
        const name = 'Samet Travel';

        const hashedPassword = await bcrypt.hash(password, 10);

        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);

        if (existing) {
            await db.run(
                'UPDATE users SET password = ?, role = ?, package = ? WHERE id = ?',
                [hashedPassword, 'driver', 'driver', existing.id]
            );
            return NextResponse.json({
                success: true,
                message: 'Kullanıcı güncellendi.',
                debug_email: email,
                total_users: allUsers.length
            });
        } else {
            await db.run(
                'INSERT INTO users (name, email, password, role, package) VALUES (?, ?, ?, ?, ?)',
                [name, email, hashedPassword, 'driver', 'driver']
            );
            return NextResponse.json({
                success: true,
                message: 'Kullanıcı sıfırdan oluşturuldu.',
                debug_email: email,
                total_users: allUsers.length + 1
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
