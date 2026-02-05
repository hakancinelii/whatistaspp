import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const drivers = await db.all('SELECT * FROM drivers WHERE user_id = ?', [user.userId]);

        return NextResponse.json({ drivers });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const { name, phone_number, license_plate, vehicle_type } = await request.json();

        await db.run(
            'INSERT INTO drivers (user_id, name, phone_number, license_plate, vehicle_type) VALUES (?, ?, ?, ?, ?)',
            [user.userId, name, phone_number, license_plate, vehicle_type]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
