import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();

        // Rezervasyonları müşterileriyle birlikte çek
        const reservations = await db.all(`
            SELECT r.*, c.name as customer_name, c.phone_number as customer_phone, d.name as driver_name 
            FROM reservations r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN drivers d ON r.driver_id = d.id
            WHERE r.user_id = ? 
            ORDER BY r.date DESC, r.time DESC
        `, [user.userId]);

        return NextResponse.json({ reservations });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const data = await request.json();

        if (data.action === 'assign_driver') {
            await db.run("UPDATE reservations SET driver_phone = ?, status = 'confirmed' WHERE id = ? AND user_id = ?", [data.driverPhone, data.reservationId, user.userId]);
            return NextResponse.json({ success: true });
        }

        // Yeni Rezervasyon Oluştur
        const voucherNum = 'TR' + Date.now().toString().slice(-8);

        // Müşteri kontrolü veya oluşturma
        let customerId;
        const existingCustomer = await db.get('SELECT id FROM customers WHERE user_id = ? AND phone_number = ?', [user.userId, data.customerPhone]);

        if (existingCustomer) {
            customerId = existingCustomer.id;
        } else {
            const result = await db.run('INSERT INTO customers (user_id, phone_number, name) VALUES (?, ?, ?)', [user.userId, data.customerPhone, data.customerName]);
            customerId = result.lastID;
        }

        await db.run(`
            INSERT INTO reservations (
                user_id, customer_id, voucher_number, date, time, 
                pickup_location, dropoff_location, flight_code, passenger_count, passenger_names, price, currency, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            user.userId, customerId, voucherNum, data.date, data.time,
            data.pickup, data.dropoff, data.flightCode || null,
            data.passengers || 1, JSON.stringify(data.passengerNames || []), data.price || 0, data.currency || 'TRY', data.notes || null
        ]);

        return NextResponse.json({ success: true, voucher: voucherNum });
    } catch (error: any) {
        console.error('[API Reservations] ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const data = await request.json();

        await db.run(`
            UPDATE reservations 
            SET date = ?, time = ?, pickup_location = ?, dropoff_location = ?, 
                flight_code = ?, passenger_count = ?, passenger_names = ?, 
                price = ?, currency = ?, driver_phone = ?, notes = ?, status = ?
            WHERE id = ? AND user_id = ?
        `, [
            data.date, data.time, data.pickup, data.dropoff,
            data.flightCode, data.passengers, JSON.stringify(data.passengerNames || []),
            data.price, data.currency, data.driverPhone, data.notes, data.status,
            data.id, user.userId
        ]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const { reservationId } = await request.json();

        await db.run('DELETE FROM reservations WHERE id = ? AND user_id = ?', [reservationId, user.userId]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
