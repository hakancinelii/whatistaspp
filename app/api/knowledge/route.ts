import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const items = await db.all(
            'SELECT * FROM knowledge_base WHERE user_id = ? ORDER BY created_at DESC',
            [user.userId]
        );

        return NextResponse.json({ items });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Pakete göre kısıtlama (Sadece Platinum ve Gold)
        const db = await getDatabase();
        const dbUser = await db.get('SELECT package FROM users WHERE id = ?', [user.userId]);
        if (dbUser.package === 'standard') {
            return NextResponse.json({ error: 'Bilgi bankası özelliği Gold ve Platinum paketlere özeldir.' }, { status: 403 });
        }

        const { action, id, title, content } = await request.json();

        if (action === 'delete') {
            await db.run('DELETE FROM knowledge_base WHERE id = ? AND user_id = ?', [id, user.userId]);
            return NextResponse.json({ success: true });
        }

        if (!title || !content) {
            return NextResponse.json({ error: 'Başlık ve içerik zorunludur.' }, { status: 400 });
        }

        await db.run(
            'INSERT INTO knowledge_base (user_id, title, content) VALUES (?, ?, ?)',
            [user.userId, title, content]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
