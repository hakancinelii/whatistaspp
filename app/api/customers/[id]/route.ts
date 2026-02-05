import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const customerId = params.id;

        const db = await getDatabase();
        await db.run(
            'DELETE FROM customers WHERE id = ? AND user_id = ?',
            [customerId, user.userId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete customer error:', error);
        return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
    }
}
