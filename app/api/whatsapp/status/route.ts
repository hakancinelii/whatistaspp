import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return corsJson(request, { error: 'Unauthorized' }, { status: 401 });
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

        return corsJson(request, {
            isConnected: session.isConnected,
            isConnecting: session.isConnecting,
            qrCode: session.qrCode,
        });
    } catch (error: any) {
        console.error('WhatsApp status error:', error);
        return corsJson(request, { error: 'Failed to get status' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
