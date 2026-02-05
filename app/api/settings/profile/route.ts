import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function PUT(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, currentPassword, newPassword } = await request.json();

        const db = await getDatabase();
        const dbUser = await db.get('SELECT * FROM users WHERE id = ?', [user.userId]);

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // If changing password, verify current password
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json({ error: 'Mevcut şifre gerekli' }, { status: 400 });
            }

            const isValid = await bcrypt.compare(currentPassword, dbUser.password);
            if (!isValid) {
                return NextResponse.json({ error: 'Mevcut şifre yanlış' }, { status: 400 });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await db.run(
                'UPDATE users SET name = ?, password = ? WHERE id = ?',
                [name, hashedPassword, user.userId]
            );
        } else {
            await db.run('UPDATE users SET name = ? WHERE id = ?', [name, user.userId]);
        }

        // Generate new token with updated info
        const token = jwt.sign(
            { userId: user.userId, email: user.email, name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return NextResponse.json({ success: true, token });
    } catch (error: any) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
