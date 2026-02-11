import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Admin ayarlarını getir
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        let settings = await db.get('SELECT * FROM user_settings WHERE user_id = ?', [user.userId]);

        if (!settings) {
            // Varsayılan ayarlar
            await db.run(`
                INSERT INTO user_settings (user_id, proxy_message_mode) VALUES (?, ?)
            `, [user.userId, 0]);
            settings = { proxy_message_mode: 0 };
        }

        return NextResponse.json({
            proxy_message_mode: !!settings.proxy_message_mode
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Admin ayarlarını güncelle
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { proxy_message_mode } = await request.json();
        const db = await getDatabase();

        await db.run(`
            INSERT INTO user_settings (user_id, proxy_message_mode)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                proxy_message_mode = EXCLUDED.proxy_message_mode
        `, [user.userId, proxy_message_mode ? 1 : 0]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
