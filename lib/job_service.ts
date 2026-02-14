
import { getDatabase } from './db';
import { getSession, connectWhatsApp } from './whatsapp';

export async function processJobTaking(userId: number, jobId: number, clientGroupJid?: string, clientPhone?: string, externalDriverId?: number) {
    const db = await getDatabase();

    // 1. Get User Profile
    const userProfile = await db.get(
        'SELECT id, name, driver_phone, driver_plate, role FROM users WHERE id = ?',
        [userId]
    );
    if (!userProfile) throw new Error('Kullanıcı bulunamadı.');

    // Harici şoför bilgisi çek (eğer varsa)
    let externalDriver = null;
    if (externalDriverId) {
        externalDriver = await db.get('SELECT * FROM external_drivers WHERE id = ?', [externalDriverId]);
        if (!externalDriver) throw new Error('Harici şoför bulunamadı.');
    }

    // ⛔ GÜVENLİK: Profil Bilgisi Kontrolü (Admin hariç)
    // Eğer harici şoför seçildiyse bu kontrolü atla (admin zaten seçti)
    if (userProfile.role !== 'admin' && !externalDriver) {
        const missingFields = [];
        if (!userProfile.name || userProfile.name.trim().length < 3) missingFields.push("Ad Soyad");
        if (!userProfile.driver_phone || userProfile.driver_phone.trim().length < 10) missingFields.push("Telefon");
        if (!userProfile.driver_plate || userProfile.driver_plate.trim().length < 5) missingFields.push("Plaka");

        if (missingFields.length > 0) {
            throw new Error(`⚠️ Profil bilgileriniz eksik: ${missingFields.join(', ')}. Lütfen önce profilinizi doldurun.`);
        }
    }

    // ⛔ GÜVENLİK: Hız Sınırı (Rate Limiting) - Admin ve Harici Şoför için kısıtlamayı esnetebiliriz ama şimdilik kalsın.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recentInteractions = await db.all(
        "SELECT created_at FROM job_interactions WHERE user_id = ? AND status = 'won' AND created_at >= ?",
        [userId, tenMinAgo]
    );

    if (recentInteractions.length >= 20 && userProfile.role === 'admin') {
        // Admin için sınır daha yüksek (örneğin 20)
    } else if (recentInteractions.length >= 3 && userProfile.role !== 'admin') {
        throw new Error('⚠️ Çok hızlı iş alıyorsunuz! Lütfen biraz bekleyin (10 dakikada en fazla 3 iş alabilirsiniz).');
    }

    // 2. Get Admin Settings (Proxy Mode)
    const adminUser = await db.get('SELECT id FROM users WHERE role = ?', ['admin']);
    const adminSettings = await db.get('SELECT proxy_message_mode FROM user_settings WHERE user_id = ?', [adminUser?.id]);
    const proxyMode = !!adminSettings?.proxy_message_mode || externalDriver !== null; // Harici şoför seçildiyse zaten admin üzerinden gider

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
    // Admin harici şoför atarken bot kontrolüne takılmasın
    if (userProfile.role !== 'admin') {
        const jobCreationTime = new Date(job.created_at).getTime();
        const now = Date.now();
        const reactionTime = now - jobCreationTime;

        if (reactionTime < 500) {
            console.warn(`[ANTI-BOT] User ${userId} attempted to take job ${job.id} in ${reactionTime}ms! This is suspiciously fast.`);
        }
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

    // 4.1. Second-Pass Phone Extraction
    let finalCustomerPhone = customerPhone;
    if ((!finalCustomerPhone || finalCustomerPhone === "Belirtilmedi") && job.raw_message) {
        const phoneRegex = /(?:\+90|0)?\s*\(?\s*5\d{2}\s*\)?[\s\.\-]*\d{3}[\s\.\-]*\d{2}[\s\.\-]*\d{2}/g;
        const phoneMatch = job.raw_message.match(phoneRegex);
        if (phoneMatch) {
            finalCustomerPhone = phoneMatch[0].replace(/\D/g, '');
        }
    }

    // 5. Check WA Connection
    let userSession = await getSession(userId);
    const userHasWA = userSession.sock && userSession.isConnected;

    if (!proxyMode && !userHasWA) {
        throw new Error('WhatsApp bağlantınız yok. Lütfen önce WhatsApp\'ı bağlayın.');
    }

    let session: any;
    let isUsingProxy = false;

    if (proxyMode && !userHasWA) {
        session = await getSession(adminUser.id);
        isUsingProxy = true;
    } else {
        session = userSession;
    }

    if (!session.sock || !session.isConnected) {
        // Yeniden bağlanmayı dene
        await connectWhatsApp(isUsingProxy ? adminUser.id : userId).catch(() => { });
        await new Promise(r => setTimeout(r, 2000));
        session = await getSession(isUsingProxy ? adminUser.id : userId);
    }

    if (!session.sock || !session.isConnected) {
        throw new Error('WhatsApp bağlantısı kurulamadı.');
    }

    // 6. Prepare Messages
    const driverName = externalDriver ? externalDriver.name : userProfile.name;
    const driverPhone = externalDriver ? externalDriver.phone : userProfile.driver_phone;
    const driverPlate = externalDriver ? externalDriver.plate : userProfile.driver_plate;

    const jobDetails = `📍 ${job.from_loc || '?'} → ${job.to_loc || '?'}${job.price ? `💰 ${job.price}` : ''}`;

    // Kullanıcı isteğine göre: Mesaj içeriğinde orijinal iş metni + şoför bilgileri
    const customerMessage = `✅ Araç hazır!\n\n${job.raw_message || jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${driverName}\n📞 ${driverPhone}${driverPlate ? `\n🚗 Plaka: ${driverPlate}` : ''}`;
    let groupMessage = 'Araç hazır, işi alıyorum. 👍';

    if (isUsingProxy || externalDriver) {
        groupMessage = `✅ Araç hazır, işi alıyorum!\n\n${jobDetails}\n\n━━━━━━━━━━━━━━━━\nŞoför: ${driverName}\n📞 ${driverPhone}${driverPlate ? `\n🚗 Plaka: ${driverPlate}` : ''}`;
    }

    // 7. Send to Customer
    if (finalCustomerPhone && finalCustomerPhone !== "Belirtilmedi" && finalCustomerPhone.length >= 10) {
        let cleanPhone = finalCustomerPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
        else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

        const jid = `${cleanPhone}@s.whatsapp.net`;
        try {
            await session.sock.sendMessage(jid, { text: customerMessage });
        } catch (err: any) {
            console.error(`[JobService] Customer Send Error:`, err.message);
            throw new Error(`Müşteriye mesaj gönderilemedi: ${err.message}`);
        }
    } else if (targetSenderJid && !targetSenderJid.includes('@g.us')) {
        let jid = targetSenderJid.includes('@') ? targetSenderJid : `${targetSenderJid}@s.whatsapp.net`;
        try {
            await session.sock.sendMessage(jid, { text: customerMessage });
        } catch (err: any) {
            console.error(`[JobService] Sender Send Error:`, err.message);
        }
    }

    // 8. Send to Group
    if (targetGroupJid !== 'MANUEL') {
        try {
            await session.sock.sendMessage(targetGroupJid, { text: groupMessage });
        } catch (e) { }
    }

    // 9. Save Interaction
    await db.run(`
        INSERT INTO job_interactions (user_id, job_id, status)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, job_id) DO UPDATE SET status = 'won'
    `, [userId, jobId, 'won']);

    return { success: true, isUsingProxy };
}
