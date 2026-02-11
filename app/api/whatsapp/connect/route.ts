import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { connectWhatsApp } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const instanceId = searchParams.get('instanceId') || 'main';

        // Start connection in background (force fresh start)
        connectWhatsApp(user.userId, instanceId, true);

        return NextResponse.json({ success: true, message: 'Connection started' });
    } catch (error: any) {
        console.error('WhatsApp connect error:', error);
        return NextResponse.json({ error: 'Failed to connect' }, { status: 500 });
    }
}
