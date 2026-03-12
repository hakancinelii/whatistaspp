import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const instanceId = searchParams.get('instanceId') || 'main';

        const { getSession, connectWhatsApp, initScheduler } = await import('@/lib/whatsapp');
        const session = await getSession(user.userId, instanceId);

        // Ensure listeners and scheduler are active
        initScheduler();

        // If not connected and not connecting and no QR, try to connect (auto-reconnect logic)
        if (!session.isConnected && !session.isConnecting && !session.qrCode) {
            connectWhatsApp(user.userId, instanceId).catch(console.error);
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
