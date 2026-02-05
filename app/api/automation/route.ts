import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        const replies = await db.all('SELECT * FROM auto_replies WHERE user_id = ? ORDER BY created_at DESC', [user.userId]);

        return NextResponse.json({ replies });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Package Check (Gold or Platinum only)
        const db = await getDatabase();
        const dbUser = await db.get('SELECT package, role FROM users WHERE id = ?', [user.userId]);
        if (dbUser?.role !== 'admin' && dbUser?.package === 'standard') {
            return NextResponse.json({ error: 'Bu özellik Gold ve Platinum paketlere özeldir.' }, { status: 403 });
        }

        const { keyword, reply, action, replyId } = await request.json();

        if (action === 'delete') {
            await db.run('DELETE FROM auto_replies WHERE id = ? AND user_id = ?', [replyId, user.userId]);
            return NextResponse.json({ success: true });
        }

        if (!keyword || !reply) {
            return NextResponse.json({ error: 'Anahtar kelime ve yanıt zorunludur.' }, { status: 400 });
        }

        await db.run(
            'INSERT INTO auto_replies (user_id, keyword, reply) VALUES (?, ?, ?)',
            [user.userId, keyword.toLowerCase().trim(), reply]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
