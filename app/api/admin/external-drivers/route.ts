import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Harici şoförleri listele
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        const drivers = await db.all(`
            SELECT * FROM external_drivers 
            ORDER BY is_active DESC, created_at DESC
        `);

        return NextResponse.json(drivers || []);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Yeni harici şoför ekle
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, phone, plate, vehicle_type, notes } = await request.json();

        if (!name || !phone) {
            return NextResponse.json({ error: 'İsim ve telefon zorunludur' }, { status: 400 });
        }

        const db = await getDatabase();
        const result = await db.run(
            `INSERT INTO external_drivers (name, phone, plate, vehicle_type, notes) 
             VALUES (?, ?, ?, ?, ?)`,
            [name, phone, plate || null, vehicle_type || null, notes || null]
        );

        return NextResponse.json({ success: true, id: result.lastID });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Harici şoför güncelle veya sil
export async function PUT(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, action, name, phone, plate, vehicle_type, notes, is_active } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'ID gerekli' }, { status: 400 });
        }

        const db = await getDatabase();

        if (action === 'delete') {
            await db.run('DELETE FROM external_drivers WHERE id = ?', [id]);
            return NextResponse.json({ success: true });
        }

        if (action === 'toggle_active') {
            await db.run(
                'UPDATE external_drivers SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [is_active ? 1 : 0, id]
            );
            return NextResponse.json({ success: true });
        }

        // Update
        await db.run(
            `UPDATE external_drivers 
             SET name = ?, phone = ?, plate = ?, vehicle_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [name, phone, plate || null, vehicle_type || null, notes || null, id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
