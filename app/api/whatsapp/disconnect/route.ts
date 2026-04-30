import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/cors';
import { getUserFromToken } from '@/lib/auth';
import { disconnectWhatsApp } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return corsJson(request, { error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const instanceId = searchParams.get('instanceId') || 'main';

        await disconnectWhatsApp(user.userId, instanceId);

        return corsJson(request, { success: true, message: 'Disconnected successfully' });
    } catch (error: any) {
        console.error('WhatsApp disconnect error:', error);
        return corsJson(request, { error: 'Failed to disconnect' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
