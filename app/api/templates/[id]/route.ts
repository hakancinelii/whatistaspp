import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, content } = await request.json();
        const templateId = params.id;

        const db = await getDatabase();
        await db.run(
            'UPDATE message_templates SET name = ?, content = ? WHERE id = ? AND user_id = ?',
            [name, content, templateId, user.userId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Update template error:', error);
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const templateId = params.id;

        const db = await getDatabase();
        await db.run(
            'DELETE FROM message_templates WHERE id = ? AND user_id = ?',
            [templateId, user.userId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete template error:', error);
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }
}
