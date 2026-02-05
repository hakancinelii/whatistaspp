import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { activeSendings } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const progress = activeSendings.get(user.userId);

        if (!progress) {
            return NextResponse.json({
                isActive: false,
                current: 0,
                total: 0,
                success: 0,
                error: 0,
            });
        }

        return NextResponse.json(progress);
    } catch (error: any) {
        console.error('Progress error:', error);
        return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
    }
}
