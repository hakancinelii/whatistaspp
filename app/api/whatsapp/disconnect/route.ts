import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { disconnectWhatsApp } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await disconnectWhatsApp(user.userId);

        return NextResponse.json({ success: true, message: 'Disconnected successfully' });
    } catch (error: any) {
        console.error('WhatsApp disconnect error:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }
}
