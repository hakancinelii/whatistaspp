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
        const templates = await db.all(
            'SELECT * FROM message_templates WHERE user_id = ? ORDER BY id DESC',
            [user.userId]
        );

        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('Templates error:', error);
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, content } = await request.json();

        if (!name || !content) {
            return NextResponse.json({ error: 'Name and content required' }, { status: 400 });
        }

        const db = await getDatabase();

        // Check template limit for Standard package
        const dbUser = await db.get('SELECT package, role FROM users WHERE id = ?', [user.userId]);
        if (dbUser?.role !== 'admin' && dbUser?.package === 'standard') {
            const count = await db.get('SELECT COUNT(*) as count FROM message_templates WHERE user_id = ?', [user.userId]);
            if (count.count >= 3) {
                return NextResponse.json({ error: 'Standart paket için şablon limiti 3 adettir. Daha fazla şablon için Gold veya Platinum pakete geçin.' }, { status: 403 });
            }
        }

        const result = await db.run(
            'INSERT INTO message_templates (user_id, name, content) VALUES (?, ?, ?)',
            [user.userId, name, content]
        );

        return NextResponse.json({ success: true, id: result.lastID });
    } catch (error: any) {
        console.error('Create template error:', error);
        return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }
}
