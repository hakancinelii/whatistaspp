import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { connectWhatsApp } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Start connection in background
        connectWhatsApp(user.userId);

        return NextResponse.json({ success: true, message: 'Connection started' });
    } catch (error: any) {
        console.error('WhatsApp connect error:', error);
        return NextResponse.json({ error: 'Failed to connect' }, { status: 500 });
    }
}
