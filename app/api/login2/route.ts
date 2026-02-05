import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email ve şifre gerekli' },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            return NextResponse.json(
                { error: 'Kullanıcı bulunamadı' },
                { status: 401 }
            );
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Geçersiz şifre' },
                { status: 401 }
            );
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                credits: user.credits
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                credits: user.credits
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Giriş başarısız: ' + error.message },
            { status: 500 }
        );
    }
}

// GET handler for testing
export async function GET() {
    return NextResponse.json({ message: 'Login API working. Use POST to login.' });
}
