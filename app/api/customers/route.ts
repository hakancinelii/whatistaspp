import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const customers = await db.all(
            'SELECT * FROM customers WHERE user_id = ? ORDER BY id DESC',
            [user.userId]
        );

        return NextResponse.json({ customers });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { phone_number, name, tags, action, customerIds } = await request.json();
        const db = await getDatabase();

        if (action === 'delete') {
            const placeholders = customerIds.map(() => '?').join(',');
            await db.run(`DELETE FROM customers WHERE user_id = ? AND id IN (${placeholders})`, [user.userId, ...customerIds]);
            return NextResponse.json({ success: true });
        }

        if (action === 'update_tags') {
            await db.run('UPDATE customers SET tags = ? WHERE user_id = ? AND id = ?', [tags, user.userId, customerIds[0]]);
            return NextResponse.json({ success: true });
        }

        if (!phone_number) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

        const result = await db.run(
            'INSERT OR IGNORE INTO customers (user_id, phone_number, name, tags) VALUES (?, ?, ?, ?)',
            [user.userId, phone_number, name || null, tags || null]
        );

        return NextResponse.json({ success: true, id: result.lastID });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
