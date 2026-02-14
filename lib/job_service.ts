
import { getDatabase } from './db';
import { getSession, connectWhatsApp } from './whatsapp';

export async function processJobTaking(userId: number, jobId: number, clientGroupJid?: string, clientPhone?: string) {
    const db = await getDatabase();

    // 1. Get User Profile
    const userProfile = await db.get(
        'SELECT id, name, driver_phone, driver_plate, role FROM users WHERE id = ?',
        [userId]
    );
    if (!userProfile) throw new Error('Kullanıcı bulunamadı.');

    // ⛔ GÜVENLİK: Profil Bilgisi Kontrolü (Admin hariç)
    if (userProfile.role !== 'admin') {
        const missingFields = [];
        if (!userProfile.name || userProfile.name.trim().length < 3) missingFields.push("Ad Soyad");
        if (!userProfile.driver_phone || userProfile.driver_phone.trim().length < 10) missingFields.push("Telefon");
        if (!userProfile.driver_plate || userProfile.driver_plate.trim().length < 5) missingFields.push("Plaka");

        if (missingFields.length > 0) {
            throw new Error(`⚠️ Profil bilgileriniz eksik: ${missingFields.join(', ')}. Lütfen önce profilinizi doldurun.`);
        }
    }

    // ⛔ GÜVENLİK: Hız Sınırı (Rate Limiting)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recentInteractions = await db.all(
        "SELECT created_at FROM job_interactions WHERE user_id = ? AND status = 'won' AND created_at >= ?",
        [userId, tenMinAgo]
    );

    if (recentInteractions.length >= 3) {
        throw new Error('⚠️ Çok hızlı iş alıyorsunuz! Lütfen biraz bekleyin (10 dakikada en fazla 3 iş alabilirsiniz).');
    }


    // 2. Get Admin Settings (Proxy Mode)
    const adminUser = await db.get('SELECT id FROM users WHERE role = ?', ['admin']);
    const adminSettings = await db.get('SELECT proxy_message_mode FROM user_settings WHERE user_id = ?', [adminUser?.id]);
    const proxyMode = !!adminSettings?.proxy_message_mode;

    // 3. Get Job Details
    let job = await db.get('SELECT * FROM captured_jobs WHERE id = ?', [jobId]);
    if (!job && clientPhone) {
        job = await db.get(
            `SELECT * FROM captured_jobs WHERE phone = ? AND created_at >= datetime('now', '-1 day') ORDER BY created_at DESC LIMIT 1`,
            [clientPhone]
        );
    }
    if (!job) throw new Error('İş kaydı bulunamadı');

    // ⛔ GÜVENLİK: İnsani Tepki Süresi Kontrolü (Anti-Bot)
    // Bir iş oluşturulduktan sonra 500ms (yarım saniye) içinde alınmaya çalışılırsa bu şüphelidir.
    // Çünkü insanın okuyup, karar verip tıklaması en az 1-2 saniye sürer.
    const jobCreationTime = new Date(job.created_at).getTime();
    const now = Date.now();
    const reactionTime = now - jobCreationTime;

    if (reactionTime < 500) {
        console.warn(`[ANTI-BOT] User ${userId} attempted to take job ${job.id} in ${reactionTime}ms! This is suspiciously fast.`);
        // Şimdilik sadece logluyoruz, ileride otomatik ban/kısıtlama eklenebilir.
        // await db.run('INSERT INTO suspicious_activity (user_id, action, details) VALUES (?, ?, ?)', [userId, 'auto_clicker_suspect', `Reaction: ${reactionTime}ms`]);
    }


    // ⛔ GÜVENLİK: Bu iş zaten birisi tarafından kazanılarak 'won' yapıldı mı?
    const alreadyTaken = await db.get("SELECT id FROM job_interactions WHERE job_id = ? AND status = 'won'", [job.id]);
    if (alreadyTaken) {
        throw new Error('⚠️ Bu iş az önce başka birisi tarafından alındı.');
    }

    // 4. Determine Targets
    const targetGroupJid = job.group_jid || clientGroupJid;
    const targetSenderJid = job.sender_jid;
    const customerPhone = job.phone || clientPhone;

    if (!targetGroupJid) throw new Error('Grup bilgisi bulunamadı');

    // 4.1. Second-Pass Phone Extraction (If phone is missing but exists in raw_message)
    let finalCustomerPhone = customerPhone;
    if ((!finalCustomerPhone || finalCustomerPhone === "Belirtilmedi") && job.raw_message) {
        const phoneRegex = /(?:\+90|0)?\s*\(?\s*5\d{2}\s*\)?[\s\.\-]*\d{3}[\s\.\-]*\d{2}[\s\.\-]*\d{2}/g;
        const phoneMatch = job.raw_message.match(phoneRegex);
        if (phoneMatch) {
            finalCustomerPhone = phoneMatch[0].replace(/\D/g, '');
            console.log(`[JobService] Found phone in raw_message during take: ${finalCustomerPhone}`);
        }
    }

    // 5. Check WA Connection
    let userSession = await getSession(userId);
    const userHasWA = userSession.sock && userSession.isConnected;

    console.log(`[JobService] User WA Status: ${userHasWA ? 'Connected' : 'Disconnected'}, Proxy Mode: ${proxyMode}`);

    if (!proxyMode && !userHasWA) {
        throw new Error(
            '⚠️ WhatsApp Bağlantısı Gerekli!\n\n' +
            'İşi alabilmek için WhatsApp hesabınızı sisteme bağlamanız gerekiyor.\n\n' +
            '📱 Nasıl Bağlarım?\n' +
            '1. Sol menüden "🟢 WhatsApp Bağla!" butonuna tıklayın\n' +
            '2. Ekrana gelen QR kodu telefonunuzla taratın\n' +
            '3. WhatsApp → Ayarlar → Bağlı Cihazlar → Cihaz Bağla\n\n' +
            '💡 İpucu: Aynı telefondan giriyorsanız, QR kodun fotoğrafını başka bir telefonla çekin ve kendi telefonunuzla taratın.\n\n' +
            '✅ Bağlantı kurulduktan sonra işleri alabilirsiniz!'
        );
    }

    let session: any;
    let isUsingProxy = false;

    if (proxyMode && !userHasWA) {
        session = await getSession(adminUser.id);
        isUsingProxy = true;

        if (!session.sock || !session.isConnected) {
            console.log(`[JobService] Admin session disconnected, attempting connect...`);
            await connectWhatsApp(adminUser.id).catch(console.error);
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                session = await getSession(adminUser.id);
                if (session.isConnected && session.sock) break;
            }
        }
    } else {
        session = userSession;
        if (!session.sock || !session.isConnected) {
            console.log(`[JobService] User session disconnected, attempting connect...`);
            await connectWhatsApp(userId).catch(console.error);
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                session = await getSession(userId);
                if (session.isConnected && session.sock) break;
            }
        }
    }

    if (!session.sock || !session.isConnected) {
        throw new Error('WhatsApp bağlantısı kurulamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
    }

    // 6. Prepare Messages
    const jobDetails = `📍 ${job.from_loc || '?'} → ${job.to_loc || '?'}${job.price ? `\n💰 ${job.price}` : ''}${job.time ? `\n🕐 ${job.time}` : ''}`;
    const customerMessage = `✅ Araç hazır!\n\n${jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${userProfile?.name || 'Belirtilmedi'}\n📞 ${userProfile?.driver_phone || 'Belirtilmedi'}${userProfile?.driver_plate ? `\n🚗 Plaka: ${userProfile.driver_plate}` : ''}`;
    let groupMessage = 'Araç hazır, işi alıyorum. 👍';

    if (isUsingProxy) {
        groupMessage = `✅ Araç hazır, işi alıyorum!\n\n${jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${userProfile?.name || 'Belirtilmedi'}\n📞 ${userProfile?.driver_phone || 'Belirtilmedi'}${userProfile?.driver_plate ? `\n🚗 Plaka: ${userProfile.driver_plate}` : ''}`;
    }

    // 7. Send to Customer
    if (finalCustomerPhone && finalCustomerPhone !== "Belirtilmedi" && finalCustomerPhone.length >= 10) {
        let cleanPhone = finalCustomerPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
        else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

        const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
        console.log(`[JobService] Sending message to customer: ${jid}`);

        try {
            await session.sock.sendMessage(jid, { text: customerMessage });

            // Admin Proxy Bildirimi
            if (isUsingProxy && adminUser && session.sock.user) {
                const myJid = (session.sock.user.id || session.sock.user.jid || '').split(':')[0] + '@s.whatsapp.net';
                const adminNotify = `📢 *PROXY BİLGİSİ*\n\nŞoför *${userProfile?.name}*, sizin numaranız üzerinden bir işe mesaj gönderdi.\n\n👤 *Müşteri:* ${finalCustomerPhone}\n🚕 *İş:* ${job.from_loc} -> ${job.to_loc}\n💰 *Fiyat:* ${job.price}`;
                await session.sock.sendMessage(myJid, { text: adminNotify }).catch(() => { });

                if (userProfile.driver_phone) {
                    let drPhone = userProfile.driver_phone.replace(/\D/g, '');
                    if (drPhone.startsWith('0')) drPhone = '90' + drPhone.substring(1);
                    else if (drPhone.startsWith('5') && drPhone.length === 10) drPhone = '90' + drPhone;
                    const drJid = `${drPhone}@s.whatsapp.net`;
                    const driverNotify = `✅ *İŞ SAHİPLENİLDİ*\n\nWhatsApp bağlantınız olmadığı için mesaj müşteri (${finalCustomerPhone}) ve gruba *Vekaleten (Admin)* üzerinden gönderildi.\n\n🚕 *İş:* ${job.from_loc} -> ${job.to_loc}\n💰 *Fiyat:* ${job.price}`;
                    await session.sock.sendMessage(drJid, { text: driverNotify }).catch(() => { });
                }
            }
        } catch (err: any) {
            console.error(`[JobService] Individual Message Error (Customer):`, err.message);
            throw new Error(`Müşteriye mesaj gönderilemedi: ${err.message}`);
        }
    } else if (targetSenderJid && !targetSenderJid.includes('@g.us')) {
        console.log(`[JobService] Sending message to sender/participant: ${targetSenderJid}`);
        try {
            let jid = targetSenderJid;
            if (!jid.includes('@')) jid += '@s.whatsapp.net';

            await session.sock.sendMessage(jid, { text: customerMessage });

            if (isUsingProxy && adminUser && session.sock.user) {
                const myJid = (session.sock.user.id || session.sock.user.jid || '').split(':')[0] + '@s.whatsapp.net';
                const adminNotify = `📢 *PROXY BİLGİSİ*\n\nŞoför *${userProfile?.name}*, sizin numaranız üzerinden grup mesaj sahibine ulaştı.\n\n👤 *Müşteri JID:* ${jid}\n🚕 *İş:* ${job.from_loc} -> ${job.to_loc}`;
                await session.sock.sendMessage(myJid, { text: adminNotify }).catch(() => { });
            }
        } catch (err: any) {
            console.error(`[JobService] Individual Message Error (Sender):`, err.message);
            // Don't throw here to allow group message to be sent as fallback
        }
    }

    // 8. Send to Group
    if (targetGroupJid !== 'MANUEL') {
        let sent = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await session.sock.sendMessage(targetGroupJid, { text: groupMessage });
                sent = true;
                break;
            } catch (e) {
                if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // 9. Save Interaction
    await db.run(`
        INSERT INTO job_interactions (user_id, job_id, status)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, job_id) DO UPDATE SET status = 'won'
    `, [userId, jobId, 'won']);

    return { success: true, isUsingProxy };
}
