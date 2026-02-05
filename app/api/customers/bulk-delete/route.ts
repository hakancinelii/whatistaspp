import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { ids } = await request.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const db = await getDatabase();

        // Delete customers that belong to this user
        const placeholders = ids.map(() => '?').join(',');
        await db.run(
            `DELETE FROM customers WHERE id IN (${placeholders}) AND user_id = ?`,
            [...ids, user.userId]
        );

        return NextResponse.json({
            success: true,
            deleted: ids.length,
            message: `${ids.length} müşteri silindi`
        });
    } catch (error: any) {
        console.error('Bulk delete error:', error);
        return NextResponse.json({ error: 'Failed to delete customers' }, { status: 500 });
    }
}
