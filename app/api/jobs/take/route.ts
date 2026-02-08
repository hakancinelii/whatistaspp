import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession, connectWhatsApp } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { jobId, groupJid, phone } = await request.json();

        if (!groupJid) {
            return NextResponse.json({ error: 'Grup bilgisi bulunamadı' }, { status: 400 });
        }

        let session = await getSession(user.userId);

        // Eğer bağlı değilse ama oturum dosyaları varsa, otomatik bağlanmayı dene ve bekle
        if (!session.sock || !session.isConnected) {
            console.log(`[API Take Job] WA not connected for user ${user.userId}. Attempting quick reconnect...`);
            await connectWhatsApp(user.userId).catch(console.error);

            // 3 saniye boyunca bağlantıyı kontrol et
            for (let i = 0; i < 3; i++) {
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

        console.log(`[API Take Job] Target Group: ${groupJid}, Target Phone: ${phone}, JobId: ${jobId}`);

        // Reconnect sonrası socket'in tam oturması için mini bir mola
        await new Promise(resolve => setTimeout(resolve, 500));

        // 1. İş sahibine "OK" gönder (Direct Message) - Opsiyonel, hata olsa da devam eder
        if (phone && phone !== "Belirtilmedi") {
            try {
                const cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.length >= 10) {
                    const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
                    console.log(`[API Take Job] Sending DM "OK" to ${jid}`);
                    await session.sock.sendMessage(jid, { text: 'OK' });
                } else {
                    console.log(`[API Take Job] Skip DM: Phone number too short (${cleanPhone})`);
                }
            } catch (dmError: any) {
                console.error('[API Take Job] DM Error (Ignored):', dmError.message);
            }
        }

        // 2. Gruba mesajı gönder (Retry mantığı ile)
        let sent = false;
        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[API Take Job] Sending group message (Attempt ${attempt}) to ${groupJid}...`);
                await session.sock.sendMessage(groupJid, { text: 'Araç hazır, işi alıyorum. 👍' });
                sent = true;
                break;
            } catch (sendError: any) {
                lastError = sendError;
                console.error(`[API Take Job] Group Message Attempt ${attempt} failed:`, sendError.message);
                if (attempt === 1) {
                    console.log("[API Take Job] Retrying group message in 2 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        if (!sent) {
            return NextResponse.json({ error: 'Gruba mesaj gönderilemedi ama iş sahibine OK iletilmiş olabilir: ' + (lastError?.message || 'Zaman aşımı') }, { status: 500 });
        }

        // 2. İşin durumunu güncelle
        const db = await getDatabase();
        await db.run(
            'UPDATE captured_jobs SET status = ? WHERE id = ? AND user_id = ?',
            ['called', jobId, user.userId]
        );

        return NextResponse.json({ success: true, message: 'Mesaj gruba iletildi.' });
    } catch (error: any) {
        console.error('[API Take Job Global Error]', error);
        return NextResponse.json({ error: 'Sistem hatası: ' + error.message }, { status: 500 });
    }
}
