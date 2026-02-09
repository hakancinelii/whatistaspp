import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = "force-dynamic";

// Ayarları getir
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        let filters = await db.get('SELECT * FROM driver_filters WHERE user_id = ?', [user.userId]);

        if (!filters) {
            // Varsayılan ayarlar
            filters = {
                regions: JSON.stringify([]),
                min_price: 0,
                job_mode: 'all',
                action_mode: 'manual',
                rota_name: 'ROTA 1'
            };
        }

        if (typeof filters.regions === 'string') {
            filters.regions = JSON.parse(filters.regions || '[]');
        }

        return NextResponse.json(filters);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Ayarları kaydet (Upsert)
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { regions, min_price, job_mode, action_mode, rota_name } = await request.json();
        const db = await getDatabase();

        await db.run(`
            INSERT INTO driver_filters (user_id, regions, min_price, job_mode, action_mode, rota_name)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                regions = EXCLUDED.regions,
                min_price = EXCLUDED.min_price,
                job_mode = EXCLUDED.job_mode,
                action_mode = EXCLUDED.action_mode,
                rota_name = EXCLUDED.rota_name
        `, [
            user.userId,
            JSON.stringify(regions || []),
            min_price || 0,
            job_mode || 'all',
            action_mode || 'manual',
            rota_name || 'ROTA 1'
        ]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
