import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
    try {
        const { name, email, password, package: userPackage } = await request.json();

        if (!name || !email || !password) {
            return corsJson(request, { error: 'Tüm alanlar gerekli' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return corsJson(request, { error: 'Şifre en az 6 karakter olmalı' },
                { status: 400 }
            );
        }

        const db = await getDatabase();

        // Check if user exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);

        if (existingUser) {
            return corsJson(request, { error: 'Bu email zaten kayıtlı' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.run(
            'INSERT INTO users (name, email, password, plain_password, package) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, password, userPackage || 'driver']
        );

        const userId = result.lastID;

        // Generate JWT
        const token = jwt.sign(
            { userId, email, name, status: 'active', package: userPackage || 'driver' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return corsJson(request, {
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
        return corsJson(request,
            { error: 'Kayıt başarısız' },
            { status: 500 }
        );
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
