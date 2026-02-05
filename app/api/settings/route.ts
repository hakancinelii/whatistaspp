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

        // Ensure settings table exists
        await db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        min_delay INTEGER DEFAULT 50,
        max_delay INTEGER DEFAULT 100,
        daily_limit INTEGER DEFAULT 250,
        night_mode BOOLEAN DEFAULT 1,
        message_variation BOOLEAN DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        let settings = await db.get(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [user.userId]
        );

        if (!settings) {
            await db.run(
                'INSERT INTO user_settings (user_id) VALUES (?)',
                [user.userId]
            );
            settings = await db.get(
                'SELECT * FROM user_settings WHERE user_id = ?',
                [user.userId]
            );
        }

        return NextResponse.json({
            settings: {
                minDelay: settings.min_delay,
                maxDelay: settings.max_delay,
                dailyLimit: settings.daily_limit,
                nightMode: Boolean(settings.night_mode),
                messageVariation: Boolean(settings.message_variation),
            },
        });
    } catch (error: any) {
        console.error('Settings error:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { minDelay, maxDelay, dailyLimit, nightMode, messageVariation } =
            await request.json();

        const db = await getDatabase();

        await db.run(
            `INSERT OR REPLACE INTO user_settings 
       (user_id, min_delay, max_delay, daily_limit, night_mode, message_variation, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [user.userId, minDelay, maxDelay, dailyLimit, nightMode ? 1 : 0, messageVariation ? 1 : 0]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update settings error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
