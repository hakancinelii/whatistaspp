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

        // Yeni sütunlar yoksa ekle
        try {
            await db.run('ALTER TABLE driver_filters ADD COLUMN filter_sprinter INTEGER DEFAULT 0');
        } catch (e) { /* column already exists */ }
        try {
            await db.run('ALTER TABLE driver_filters ADD COLUMN filter_swap INTEGER DEFAULT 0');
        } catch (e) { /* column already exists */ }

        let filters = await db.get('SELECT * FROM driver_filters WHERE user_id = ?', [user.userId]);

        if (!filters) {
            // Varsayılan ayarlar
            filters = {
                regions: JSON.stringify([]),
                min_price: 0,
                job_mode: 'all',
                action_mode: 'manual',
                rota_name: 'ROTA 1',
                filter_sprinter: 0,
                filter_swap: 0
            };
        }

        if (typeof filters.regions === 'string') {
            filters.regions = JSON.parse(filters.regions || '[]');
        }

        // Boolean olarak döndür
        filters.filter_sprinter = !!filters.filter_sprinter;
        filters.filter_swap = !!filters.filter_swap;

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

        const { regions, min_price, job_mode, action_mode, rota_name, filter_sprinter, filter_swap } = await request.json();
        const db = await getDatabase();

        // Yeni sütunlar yoksa ekle
        try {
            await db.run('ALTER TABLE driver_filters ADD COLUMN filter_sprinter INTEGER DEFAULT 0');
        } catch (e) { /* column already exists */ }
        try {
            await db.run('ALTER TABLE driver_filters ADD COLUMN filter_swap INTEGER DEFAULT 0');
        } catch (e) { /* column already exists */ }

        await db.run(`
            INSERT INTO driver_filters (user_id, regions, min_price, job_mode, action_mode, rota_name, filter_sprinter, filter_swap)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                regions = EXCLUDED.regions,
                min_price = EXCLUDED.min_price,
                job_mode = EXCLUDED.job_mode,
                action_mode = EXCLUDED.action_mode,
                rota_name = EXCLUDED.rota_name,
                filter_sprinter = EXCLUDED.filter_sprinter,
                filter_swap = EXCLUDED.filter_swap
        `, [
            user.userId,
            JSON.stringify(regions || []),
            min_price || 0,
            job_mode || 'all',
            action_mode || 'manual',
            rota_name || 'ROTA 1',
            filter_sprinter ? 1 : 0,
            filter_swap ? 1 : 0
        ]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
