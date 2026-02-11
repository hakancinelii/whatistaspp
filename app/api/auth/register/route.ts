import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
    try {
        const { name, email, password } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Tüm alanlar gerekli' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Şifre en az 6 karakter olmalı' },
                { status: 400 }
            );
        }

        const db = await getDatabase();

        // Check if user exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);

        if (existingUser) {
            return NextResponse.json(
                { error: 'Bu email zaten kayıtlı' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.run(
            'INSERT INTO users (name, email, password, plain_password) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, password]
        );

        const userId = result.lastID;

        // Generate JWT
        const token = jwt.sign(
            { userId, email, name, status: 'active' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            token,
            user: {
                id: userId,
                name,
                email,
                status: 'active'
            },
        }, { status: 201 });
    } catch (error: any) {
        console.error('Register error:', error);
        return NextResponse.json(
            { error: 'Kayıt başarısız' },
            { status: 500 }
        );
    }
}
