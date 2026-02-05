import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { activeSendings } from '../send-bulk/route';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const progress = activeSendings.get(user.userId);

        if (progress) {
            progress.isActive = false;
        }

        return NextResponse.json({ success: true, message: 'Sending stopped' });
    } catch (error: any) {
        console.error('Stop error:', error);
        return NextResponse.json({ error: 'Failed to stop' }, { status: 500 });
    }
}
