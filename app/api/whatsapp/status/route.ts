import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getSession } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await getSession(user.userId);

        // Ensure listeners and scheduler are active
        const { initScheduler } = require('@/lib/whatsapp');
        initScheduler();

        // If not connected and not connecting, try to connect (auto-reconnect logic)
        if (!session.isConnected && !session.isConnecting) {
            const { connectWhatsApp } = require('@/lib/whatsapp');
            connectWhatsApp(user.userId).catch(console.error);
        }

        return NextResponse.json({
            isConnected: session.isConnected,
            isConnecting: session.isConnecting,
            qrCode: session.qrCode,
        });
    } catch (error: any) {
        console.error('WhatsApp status error:', error);
        return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
    }
}
