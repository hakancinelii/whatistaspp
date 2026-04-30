import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getUserFromToken } from '@/lib/auth';
import { connectWhatsApp } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return corsJson(request, { error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const instanceId = searchParams.get('instanceId') || 'main';

        // Start connection in background (force fresh start)
        connectWhatsApp(user.userId, instanceId, true);

        return corsJson(request, { success: true, message: 'Connection started' });
    } catch (error: any) {
        console.error('WhatsApp connect error:', error);
        return corsJson(request, { error: 'Failed to connect' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
