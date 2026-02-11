import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Profil bilgilerini getir
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        const profile = await db.get(
            'SELECT name, email, driver_phone, driver_plate FROM users WHERE id = ?',
            [user.userId]
        );

        return NextResponse.json({
            name: profile?.name || '',
            email: profile?.email || '',
            driver_phone: profile?.driver_phone || '',
            driver_plate: profile?.driver_plate || ''
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Profil bilgilerini güncelle
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { driver_phone, driver_plate } = await request.json();
        const db = await getDatabase();

        await db.run(`
            UPDATE users 
            SET driver_phone = ?, driver_plate = ?
            WHERE id = ?
        `, [driver_phone || null, driver_plate || null, user.userId]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
