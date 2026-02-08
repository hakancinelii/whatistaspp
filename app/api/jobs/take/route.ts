import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession, connectWhatsApp } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { jobId, groupJid: clientGroupJid, phone: clientPhone } = await request.json();

        const db = await getDatabase();
        const job = await db.get('SELECT * FROM captured_jobs WHERE id = ? AND user_id = ?', [jobId, user.userId]);

        if (!job) {
            return NextResponse.json({ error: 'İş kaydı bulunamadı' }, { status: 404 });
        }

        const targetGroupJid = job.group_jid || clientGroupJid;
        const targetSenderJid = job.sender_jid; // Bu asıl iş sahibi (gruba mesajı atan)
        const customerPhone = job.phone || clientPhone; // Bu da yolcu/müşteri nosu

        if (!targetGroupJid) {
            return NextResponse.json({ error: 'Grup bilgisi bulunamadı' }, { status: 400 });
        }

        let session = await getSession(user.userId);

        // Otomatik bağlanma mantığı
        if (!session.sock || !session.isConnected) {
            console.log(`[API Take Job] WA not connected. Reconnecting...`);
            await connectWhatsApp(user.userId).catch(console.error);
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                session = await getSession(user.userId);
                if (session.isConnected && session.sock) break;
            }
        }

        if (!session.sock || !session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp bağlantısı kurulamadı. Lütfen lambaya tıklayıp bağlanın.' }, { status: 400 });
        }

        console.log(`[API Take Job] Sender: ${targetSenderJid}, Group: ${targetGroupJid}, Customer: ${customerPhone}`);

        // 1. İş Sahibine (Gruba Atan Kişiye) "OK" gönder
        if (targetSenderJid) {
            try {
                let jid = targetSenderJid;
                if (!jid.includes('@')) jid += '@s.whatsapp.net';

                console.log(`[API Take Job] Sending "OK" to OWNER: ${jid}`);
                await session.sock.sendMessage(jid, { text: 'OK' });
            } catch (dmError: any) {
                console.error('[API Take Job] Owner DM Error:', dmError.message);
            }
        } else if (customerPhone && customerPhone !== "Belirtilmedi") {
            // Yedek: Eğer sender_jid yoksa eski usul temizlenmiş nosuna at (yeni işlerde sender_jid hep olacak)
            try {
                let cleanPhone = customerPhone.replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
                else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

                const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
                console.log(`[API Take Job] Fallback: Sending "OK" to Customer: ${jid}`);
                await session.sock.sendMessage(jid, { text: 'OK' });
            } catch (fallbackError: any) {
                console.error('[API Take Job] Fallback DM Error:', fallbackError.message);
            }
        }

        // 2. Gruba "İşi Alıyorum" mesajı gönder
        let sent = false;
        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[API Take Job] Group Notify (Attempt ${attempt}) to ${targetGroupJid}...`);
                // not-acceptable hatasını önlemek için bekleme ekliyoruz
                if (attempt > 1) await new Promise(resolve => setTimeout(resolve, 1000));

                await session.sock.sendMessage(targetGroupJid, { text: 'Araç hazır, işi alıyorum. 👍' });
                sent = true;
                break;
            } catch (sendError: any) {
                lastError = sendError;
                console.error(`[API Take Job] Group Error:`, sendError.message);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!sent) {
            return NextResponse.json({ error: 'Gruba mesaj gidemedi (Hata: ' + (lastError?.message || 'Zaman aşımı') + '). İş sahibine OK gitmiş olabilir.' }, { status: 500 });
        }

        // 3. Durumu güncelle
        await db.run(
            'UPDATE captured_jobs SET status = ? WHERE id = ? AND user_id = ?',
            ['called', jobId, user.userId]
        );

        return NextResponse.json({ success: true, message: 'İş sahiplenildi.' });
    } catch (error: any) {
        console.error('[API Take Job Global Error]', error);
        return NextResponse.json({ error: 'Sistem hatası: ' + error.message }, { status: 500 });
    }
}
