import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        let settings = await db.get('SELECT * FROM user_settings WHERE user_id = ?', [user.userId]);

        if (!settings) {
            // Create default settings if they don't exist
            await db.run(
                'INSERT INTO user_settings (user_id, min_delay, max_delay, night_mode, message_variation) VALUES (?, ?, ?, ?, ?)',
                [user.userId, 5, 10, 1, 1]
            );
            settings = await db.get('SELECT * FROM user_settings WHERE user_id = ?', [user.userId]);
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { min_delay, night_mode, name } = await request.json();
        const db = await getDatabase();

        // Update user settings
        await db.run(
            'UPDATE user_settings SET min_delay = ?, max_delay = ?, night_mode = ? WHERE user_id = ?',
            [min_delay, min_delay + 2, night_mode ? 1 : 0, user.userId]
        );

        // Update user profile name if provided
        if (name) {
            await db.run('UPDATE users SET name = ? WHERE id = ?', [name, user.userId]);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings POST error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
