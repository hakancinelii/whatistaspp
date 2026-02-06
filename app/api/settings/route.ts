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

        const body = await request.json();
        const { min_delay, night_mode, name } = body;
        const db = await getDatabase();

        console.log('[Settings] Saving for user:', user.userId, 'min_delay:', min_delay, 'night_mode:', night_mode);

        // Check if settings exist for this user
        const existing = await db.get('SELECT id FROM user_settings WHERE user_id = ?', [user.userId]);

        if (existing) {
            // Update existing settings
            await db.run(
                'UPDATE user_settings SET min_delay = ?, max_delay = ?, night_mode = ? WHERE user_id = ?',
                [min_delay, min_delay + 2, night_mode ? 1 : 0, user.userId]
            );
        } else {
            // Insert new settings
            await db.run(
                'INSERT INTO user_settings (user_id, min_delay, max_delay, night_mode, message_variation) VALUES (?, ?, ?, ?, ?)',
                [user.userId, min_delay, min_delay + 2, night_mode ? 1 : 0, 1]
            );
        }

        // Update user profile name if provided
        if (name) {
            await db.run('UPDATE users SET name = ? WHERE id = ?', [name, user.userId]);
        }

        console.log('[Settings] Saved successfully for user:', user.userId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Settings POST error:', error.message, error.stack);
        return NextResponse.json({ error: 'Failed to update settings: ' + error.message }, { status: 500 });
    }
}
