import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { jobId, groupJid } = await request.json();

        if (!groupJid) {
            return NextResponse.json({ error: 'Grup bilgisi bulunamadı' }, { status: 400 });
        }

        let session = await getSession(user.userId);

        // Eğer bağlı değilse ama oturum dosyaları varsa, otomatik bağlanmayı dene ve bekle
        if (!session.sock || !session.isConnected) {
            console.log(`[API Take Job] WA not connected for user ${user.userId}. Attempting quick reconnect...`);
            const { connectWhatsApp } = require('@/lib/whatsapp');
            await connectWhatsApp(user.userId).catch(console.error);

            // 5 saniye boyunca bağlantıyı kontrol et
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                session = await getSession(user.userId);
                if (session.isConnected && session.sock) {
                    console.log(`[API Take Job] Reconnected successfully after ${i + 1} seconds.`);
                    break;
                }
            }
        }

        if (!session.sock || !session.isConnected) {
            console.error('[API Take Job] WA Session still not connected for user', user.userId);
            return NextResponse.json({ error: 'WhatsApp bağlantınız aktif değil. Lütfen Dashboard sayfasından bağlantıyı kontrol edin ve tekrar deneyin.' }, { status: 400 });
        }

        console.log(`[API Take Job] Sending message to group ${groupJid} for user ${user.userId}`);

        // 1. Gruba mesajı gönder
        try {
            await session.sock.sendMessage(groupJid, { text: 'Araç hazır, işi alıyorum. 👍' });
        } catch (sendError: any) {
            console.error('[API Take Job] Message Send Error:', sendError);
            return NextResponse.json({ error: 'Gruba mesaj gönderilemedi: ' + (sendError.message || 'Bilinmeyen hata') }, { status: 500 });
        }

        // 2. İşin durumunu güncelle (Panelde grileşmesi için)
        const db = await getDatabase();
        await db.run(
            'UPDATE captured_jobs SET status = ? WHERE id = ? AND user_id = ?',
            ['called', jobId, user.userId]
        );

        return NextResponse.json({ success: true, message: 'Mesaj gruba iletildi ve iş rezerve edildi.' });
    } catch (error: any) {
        console.error('[API Take Job Global Error]', error);
        return NextResponse.json({ error: 'Sistem hatası: ' + error.message }, { status: 500 });
    }
}
