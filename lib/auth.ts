import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-123';

export interface AuthUser {
    userId: number;
    email: string;
    name: string;
    role?: 'admin' | 'user';
    credits?: number;
    package?: 'standard' | 'gold' | 'platinum';
}

export async function getUserFromToken(request: NextRequest): Promise<AuthUser | null> {
    try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

        return decoded;
    } catch (error) {
        return null;
    }
}
