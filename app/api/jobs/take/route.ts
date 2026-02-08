import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getSession } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { jobId, groupJid } = await request.json();

        if (!groupJid) {
            return NextResponse.json({ error: 'Grup bilgisi bulunamadı' }, { status: 400 });
        }

        const session = await getSession(user.userId);
        if (!session.sock || !session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp bağlantısı aktif değil' }, { status: 400 });
        }

        // Gruba mesajı gönder
        await session.sock.sendMessage(groupJid, { text: 'Araç hazır, işi alıyorum. 👍' });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API Take Job Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
