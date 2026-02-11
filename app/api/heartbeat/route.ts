import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Heartbeat kaydet (kullanıcı aktif)
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();

        // user_heartbeat tablosuna kaydet
        await db.run(`
            INSERT INTO user_heartbeat (user_id, last_seen)
            VALUES (?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET last_seen = datetime('now')
        `, [user.userId]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Çevrimiçi kullanıcı sayısını getir
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();

        // Son 60 saniye içinde heartbeat gönderenleri say
        const result = await db.get(`
            SELECT COUNT(*) as online_count
            FROM user_heartbeat
            WHERE last_seen >= datetime('now', '-60 seconds')
        `);

        return NextResponse.json({ online_count: result?.online_count || 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
