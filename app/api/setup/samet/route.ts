
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDatabase } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDatabase();
        const email = 'samettravel@whatistaspp.com';
        const password = 'Samettravel34';
        const name = 'Samet Travel';

        // Şifreyi şifreleyelim
        const hashedPassword = await bcrypt.hash(password, 10);

        // Kullanıcı var mı kontrol et
        const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);

        if (existing) {
            await db.run(
                'UPDATE users SET password = ?, role = ?, package = ? WHERE id = ?',
                [hashedPassword, 'driver', 'driver', existing.id]
            );
            return NextResponse.json({ message: 'Kullanıcı güncellendi.' });
        } else {
            await db.run(
                'INSERT INTO users (name, email, password, role, package) VALUES (?, ?, ?, ?, ?)',
                [name, email, hashedPassword, 'driver', 'driver']
            );
            return NextResponse.json({ message: 'Kullanıcı başarıyla oluşturuldu.' });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
