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

        // Admin ayarlarını kontrol et
        const adminUser = await db.get('SELECT id FROM users WHERE role = ?', ['admin']);
        const adminSettings = await db.get('SELECT proxy_message_mode FROM user_settings WHERE user_id = ?', [adminUser?.id]);
        const proxyMode = !!adminSettings?.proxy_message_mode;

        // Kullanıcı profil bilgilerini al
        const userProfile = await db.get(
            'SELECT name, driver_phone, driver_plate FROM users WHERE id = ?',
            [user.userId]
        );

        // Ortak havuzda iş tüm kullanıcılara gösterildiği için user_id filtresi kaldırıldı
        let job = await db.get('SELECT * FROM captured_jobs WHERE id = ?', [jobId]);

        // Eğer exact id ile bulunamadıysa, aynı telefon+rota+fiyat ile son 24 saat içinde eşleşen bir kayıt ara
        if (!job) {
            console.warn(`[API Take Job] Job ID ${jobId} not found directly, trying fallback...`);
            const fallbackJob = await db.get(
                `SELECT * FROM captured_jobs WHERE phone = ? AND created_at >= datetime('now', '-1 day') ORDER BY created_at DESC LIMIT 1`,
                [clientPhone]
            );
            if (fallbackJob) {
                job = fallbackJob;
                console.log(`[API Take Job] Found fallback job: ${job.id}`);
            }
        }

        if (!job) {
            return NextResponse.json({ error: 'İş kaydı bulunamadı' }, { status: 404 });
        }

        const targetGroupJid = job.group_jid || clientGroupJid;
        const targetSenderJid = job.sender_jid;
        const customerPhone = job.phone || clientPhone;

        if (!targetGroupJid) {
            return NextResponse.json({ error: 'Grup bilgisi bulunamadı' }, { status: 400 });
        }

        // Kullanıcının WA bağlantısını kontrol et
        let userSession = await getSession(user.userId);
        const userHasWA = userSession.sock && userSession.isConnected;

        // Proxy mode kapalıysa ve kullanıcının WA'sı yoksa hata ver
        if (!proxyMode && !userHasWA) {
            return NextResponse.json({
                error: 'WhatsApp bağlantınız yok. Lütfen önce WhatsApp\'ı bağlayın.'
            }, { status: 400 });
        }

        let session;
        let isUsingProxy = false;

        // Proxy mode açıksa ve kullanıcının WA'sı yoksa admin WA'sını kullan
        if (proxyMode && !userHasWA) {
            console.log(`[API Take Job] Proxy mode: Using admin WA for user ${user.userId}`);
            session = await getSession(adminUser.id);
            isUsingProxy = true;

            // Admin WA bağlı değilse bağlanmayı dene
            if (!session.sock || !session.isConnected) {
                console.log(`[API Take Job] Admin WA not connected. Reconnecting...`);
                await connectWhatsApp(adminUser.id).catch(console.error);
                for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    session = await getSession(adminUser.id);
                    if (session.isConnected && session.sock) break;
                }
            }
        } else {
            // Kullanıcının kendi WA'sını kullan
            session = userSession;

            // Bağlı değilse bağlanmayı dene
            if (!session.sock || !session.isConnected) {
                console.log(`[API Take Job] User WA not connected. Reconnecting...`);
                await connectWhatsApp(user.userId).catch(console.error);
                for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    session = await getSession(user.userId);
                    if (session.isConnected && session.sock) break;
                }
            }
        }

        if (!session.sock || !session.isConnected) {
            return NextResponse.json({
                error: 'WhatsApp bağlantısı kurulamadı. Lütfen tekrar deneyin.'
            }, { status: 400 });
        }

        console.log(`[API Take Job] Customer: ${customerPhone}, Group: ${targetGroupJid}, Sender: ${targetSenderJid}, Proxy: ${isUsingProxy}`);

        // Mesaj içeriğini hazırla
        let customerMessage = 'OK';
        let groupMessage = 'Araç hazır, işi alıyorum. 👍';

        if (isUsingProxy) {
            // İş detaylarını hazırla
            const jobDetails = `📍 ${job.from_loc || '?'} → ${job.to_loc || '?'}${job.price ? `\n💰 ${job.price}` : ''}${job.time ? `\n🕐 ${job.time}` : ''}`;

            // Proxy kullanılıyorsa şoför bilgilerini ve iş detaylarını ekle
            customerMessage = `✅ Araç hazır!\n\n${jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${userProfile?.name || 'Belirtilmedi'}\n📞 ${userProfile?.driver_phone || 'Belirtilmedi'}${userProfile?.driver_plate ? `\n🚗 Plaka: ${userProfile.driver_plate}` : ''}`;
            groupMessage = `✅ Araç hazır, işi alıyorum!\n\n${jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${userProfile?.name || 'Belirtilmedi'}\n📞 ${userProfile?.driver_phone || 'Belirtilmedi'}${userProfile?.driver_plate ? `\n🚗 Plaka: ${userProfile.driver_plate}` : ''}`;
        }

        // 1. Mesaj içindeki numaraya mesaj gönder
        if (customerPhone && customerPhone !== "Belirtilmedi") {
            try {
                let cleanPhone = customerPhone.replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
                else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

                const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
                console.log(`[API Take Job] Sending message to Customer Phone: ${jid}`);
                await session.sock.sendMessage(jid, { text: customerMessage });
            } catch (dmError: any) {
                console.error('[API Take Job] Customer DM Error:', dmError.message);
            }
        } else if (targetSenderJid) {
            try {
                let jid = targetSenderJid;
                if (!jid.includes('@')) jid += '@s.whatsapp.net';
                console.log(`[API Take Job] Backup: Sending message to Owner (Sender): ${jid}`);
                await session.sock.sendMessage(jid, { text: customerMessage });
            } catch (backupError: any) {
                console.error('[API Take Job] Backup DM Error:', backupError.message);
            }
        }

        // 2. Gruba mesaj gönder (Eğer MANUEL değilse)
        // Eğer iş manuel eklendiyse grup yoktur, sadece kişiye mesaj gitmesi yeterlidir.
        let sent = false;
        let lastError = null;

        if (targetGroupJid === 'MANUEL') {
            console.log('[API Take Job] Manual job detected, skipping group notification.');
            sent = true;
        } else {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    console.log(`[API Take Job] Group Notify (Attempt ${attempt}) to ${targetGroupJid}...`);
                    if (attempt > 1) await new Promise(resolve => setTimeout(resolve, 1000));

                    await session.sock.sendMessage(targetGroupJid, { text: groupMessage });
                    sent = true;
                    break;
                } catch (sendError: any) {
                    lastError = sendError;
                    console.error(`[API Take Job] Group Error:`, sendError.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        if (!sent) {
            return NextResponse.json({
                error: 'Gruba mesaj gidemedi (Hata: ' + (lastError?.message || 'Zaman aşımı') + '). İş sahibine mesaj gitmiş olabilir.'
            }, { status: 500 });
        }

        // 3. Job interactions tablosuna kaydet
        await db.run(`
            INSERT INTO job_interactions (user_id, job_id, status)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, job_id) DO UPDATE SET status = 'called'
        `, [user.userId, job.id, 'called']);

        return NextResponse.json({
            success: true,
            message: isUsingProxy ? 'İş sahiplenildi (Admin WhatsApp üzerinden)' : 'İş sahiplenildi.'
        });
    } catch (error: any) {
        console.error('[API Take Job Global Error]', error);
        return NextResponse.json({ error: 'Sistem hatası: ' + error.message }, { status: 500 });
    }
}
