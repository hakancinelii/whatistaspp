
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDatabase } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDatabase();
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
        } else {
            await db.run(
                'INSERT INTO users (name, email, password, role, package) VALUES (?, ?, ?, ?, ?)',
                [name, email, hashedPassword, 'driver', 'driver']
            );
        }
        return NextResponse.json({ success: true, user: email });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
