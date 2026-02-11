
import { getDatabase } from './db';
import { getSession, connectWhatsApp } from './whatsapp';

export async function processJobTaking(userId: number, jobId: number, clientGroupJid?: string, clientPhone?: string) {
    const db = await getDatabase();

    // 1. Get User Profile
    const userProfile = await db.get(
        'SELECT id, name, driver_phone, driver_plate FROM users WHERE id = ?',
        [userId]
    );
    if (!userProfile) throw new Error('User not found');

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

    // 4. Determine Targets
    const targetGroupJid = job.group_jid || clientGroupJid;
    const targetSenderJid = job.sender_jid;
    const customerPhone = job.phone || clientPhone;

    if (!targetGroupJid) throw new Error('Grup bilgisi bulunamadı');

    // 5. Check WA Connection
    let userSession = await getSession(userId);
    const userHasWA = userSession.sock && userSession.isConnected;

    if (!proxyMode && !userHasWA) {
        throw new Error('WhatsApp bağlantınız yok. Lütfen önce WhatsApp\'ı bağlayın.');
    }

    let session;
    let isUsingProxy = false;

    if (proxyMode && !userHasWA) {
        session = await getSession(adminUser.id);
        isUsingProxy = true;

        if (!session.sock || !session.isConnected) {
            await connectWhatsApp(adminUser.id).catch(console.error);
            // Wait a bit for connection
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                session = await getSession(adminUser.id);
                if (session.isConnected && session.sock) break;
            }
        }
    } else {
        session = userSession;
        if (!session.sock || !session.isConnected) {
            await connectWhatsApp(userId).catch(console.error);
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                session = await getSession(userId);
                if (session.isConnected && session.sock) break;
            }
        }
    }

    if (!session.sock || !session.isConnected) {
        throw new Error('WhatsApp bağlantısı kurulamadı.');
    }

    // 6. Prepare Messages
    const jobDetails = `📍 ${job.from_loc || '?'} → ${job.to_loc || '?'}${job.price ? `\n💰 ${job.price}` : ''}${job.time ? `\n🕐 ${job.time}` : ''}`;
    const customerMessage = `✅ Araç hazır!\n\n${jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${userProfile?.name || 'Belirtilmedi'}\n📞 ${userProfile?.driver_phone || 'Belirtilmedi'}${userProfile?.driver_plate ? `\n🚗 Plaka: ${userProfile.driver_plate}` : ''}`;
    let groupMessage = 'Araç hazır, işi alıyorum. 👍';

    if (isUsingProxy) {
        groupMessage = `✅ Araç hazır, işi alıyorum!\n\n${jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${userProfile?.name || 'Belirtilmedi'}\n📞 ${userProfile?.driver_phone || 'Belirtilmedi'}${userProfile?.driver_plate ? `\n🚗 Plaka: ${userProfile.driver_plate}` : ''}`;
    }

    // 7. Send to Customer
    if (customerPhone && customerPhone !== "Belirtilmedi") {
        let cleanPhone = customerPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
        else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;
        const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
        await session.sock.sendMessage(jid, { text: customerMessage });

        if (isUsingProxy && adminUser) {
            const myJid = session.sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const adminNotify = `📢 *PROXY BİLGİSİ*\n\nŞoför *${userProfile?.name}*, sizin numaranız üzerinden bir işe mesaj gönderdi.\n\n👤 *Müşteri:* ${customerPhone}\n🚕 *İş:* ${job.from_loc} -> ${job.to_loc}\n💰 *Fiyat:* ${job.price}`;
            await session.sock.sendMessage(myJid, { text: adminNotify });

            if (userProfile.driver_phone) {
                try {
                    let drPhone = userProfile.driver_phone.replace(/\D/g, '');
                    if (drPhone.startsWith('0')) drPhone = '90' + drPhone.substring(1);
                    else if (drPhone.startsWith('5') && drPhone.length === 10) drPhone = '90' + drPhone;
                    const drJid = `${drPhone}@s.whatsapp.net`;
                    const driverNotify = `✅ *İŞ SAHİPLENİLDİ*\n\nWhatsApp bağlantınız olmadığı için mesaj müşteri (${customerPhone}) ve gruba *Vekaleten (Admin)* üzerinden gönderildi.\n\n🚕 *İş:* ${job.from_loc} -> ${job.to_loc}\n💰 *Fiyat:* ${job.price}`;
                    await session.sock.sendMessage(drJid, { text: driverNotify });
                } catch (e) { }
            }
        }
    } else if (targetSenderJid) {
        let jid = targetSenderJid;
        if (!jid.includes('@')) jid += '@s.whatsapp.net';
        await session.sock.sendMessage(jid, { text: customerMessage });

        if (isUsingProxy) {
            const myJid = session.sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const adminNotify = `📢 *PROXY BİLGİSİ*\n\nŞoför *${userProfile?.name}*, sizin numaranız üzerinden grup mesaj sahibine ulaştı.\n\n👤 *Müşteri JID:* ${jid}\n🚕 *İş:* ${job.from_loc} -> ${job.to_loc}`;
            await session.sock.sendMessage(myJid, { text: adminNotify });

            if (userProfile.driver_phone) {
                try {
                    let drPhone = userProfile.driver_phone.replace(/\D/g, '');
                    if (drPhone.startsWith('0')) drPhone = '90' + drPhone.substring(1);
                    else if (drPhone.startsWith('5') && drPhone.length === 10) drPhone = '90' + drPhone;
                    const drJid = `${drPhone}@s.whatsapp.net`;
                    const driverNotify = `✅ *İŞ SAHİPLENİLDİ*\n\nWhatsApp bağlantınız olmadığı için *Grup Sahibine* mesaj *Vekaleten (Admin)* üzerinden gönderildi.\n\n🚕 *İş:* ${job.from_loc} -> ${job.to_loc}`;
                    await session.sock.sendMessage(drJid, { text: driverNotify });
                } catch (e) { }
            }
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
