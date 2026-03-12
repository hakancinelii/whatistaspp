import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, downloadMediaMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { tryGemini } from './ai';
import * as dbLib from './db';


// Use a global variable to persist sessions across HMR reloads in dev mode
const globalForWhatsApp = global as unknown as {
    whatsappSessions: Map<string, WhatsAppSession> | undefined;
    activeSendings: Map<number, any> | undefined;
};

const sessions = globalForWhatsApp.whatsappSessions ?? new Map<string, WhatsAppSession>();
export const activeSendings = globalForWhatsApp.activeSendings ?? new Map<number, any>();

if (process.env.NODE_ENV !== 'production') {
    globalForWhatsApp.whatsappSessions = sessions;
    globalForWhatsApp.activeSendings = activeSendings;
}

export interface WhatsAppSession {
    userId: number;
    sock: any | null;
    qrCode: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    lastAttempt?: number;
}

export async function getSession(userId: number, instanceId: string = 'main'): Promise<WhatsAppSession> {
    const sessionKey = `${userId}_${instanceId}`;
    if (!sessions.has(sessionKey)) {
        sessions.set(sessionKey, {
            userId,
            sock: null,
            qrCode: null,
            isConnected: false,
            isConnecting: false,
        });

        // Auth state folder inside data directory for persistence
        const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${sessionKey}`);
        const sessionInMap = sessions.get(sessionKey);
        if (sessionInMap && !sessionInMap.isConnected && !sessionInMap.isConnecting && fs.existsSync(authDir) && fs.readdirSync(authDir).length > 0) {
            console.log(`[WA] Found existing session for ${sessionKey}. Auto-connecting...`);
            setTimeout(() => {
                import('./whatsapp').then(m => m.connectWhatsApp(userId, instanceId)).catch(e => console.error('[WA] Auto-connect failed:', e));
            }, 100);
        }
    }
    return sessions.get(sessionKey)!;
}

export async function connectWhatsApp(userId: number, instanceId: string = 'main', force = false): Promise<void> {
    const sessionKey = `${userId}_${instanceId}`;
    const session = await getSession(userId, instanceId);

    // If already connected, we refresh listeners to ensure HMR code updates are active
    if (!force && session.isConnected && session.sock) {
        console.log(`[WA] Session ${sessionKey} already connected. Refreshing listeners...`);
        setupMessageListeners(userId, session.sock, instanceId);
        return;
    }

    // Prevent spamming connection attempts (unless forced)
    const now = Date.now();
    if (!force && session.isConnecting && session.lastAttempt && (now - session.lastAttempt < 15000)) {
        console.log(`[WA] Connection attempt already in progress for ${sessionKey}.`);
        return;
    }

    console.log(`[WA] 🚀 Session ${sessionKey}: Initiating connection...`);
    session.isConnecting = true;
    session.lastAttempt = now;
    session.qrCode = null;

    try {
        const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${sessionKey}`);
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        let version: [number, number, number] = [2, 3000, 1015901307];
        try {
            const latest = await fetchLatestBaileysVersion();
            if (latest.version) version = latest.version;
        } catch (vErr) {
            console.warn(`[WA] Could not fetch version, using fallback.`);
        }

        if (session.sock) {
            try {
                session.sock.ev.removeAllListeners('connection.update');
                session.sock.ev.removeAllListeners('messages.upsert');
                session.sock.end(undefined);
            } catch (e) { }
        }

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ["WhatIstaspp", "Chrome", "114.0.0.0"],
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false, // Geçmiş senkronizasyonunu kapat, telefonu yormasın
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            generateHighQualityLinkPreview: false,
            markOnlineOnConnect: false, // Bağlanınca hemen online olma (CPU tasarrufu)
            getMessage: async (key: any) => { return { conversation: "" } } // Hafıza tasarrufu
        });

        session.sock = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            const db = await dbLib.getDatabase();


            if (qr) {
                console.log(`[WA] 🔳 New QR generated for user ${userId}`);
                session.qrCode = await qrcode.toDataURL(qr);

                // QR bilgisini DB'ye kaydet
                await db.run(
                    'INSERT INTO whatsapp_sessions (user_id, session_id, qr_code, is_connected) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET qr_code = ?, is_connected = 0',
                    [userId, sessionKey, session.qrCode, 0, session.qrCode]
                ).catch(() => { });
            }

            if (connection === 'close') {
                const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
                console.log(`[WA] ❌ Connection closed for ${sessionKey}. Reason: ${reason}`);

                session.isConnected = false;
                session.isConnecting = false;
                session.qrCode = null;

                // DB Güncelle: Bağlantı koptu
                await db.run(
                    'INSERT INTO whatsapp_sessions (user_id, session_id, is_connected, qr_code) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET is_connected = 0, qr_code = NULL',
                    [userId, sessionKey, 0, null]
                ).catch(() => { });

                if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 405) {
                    console.log(`[WA] 🏹 Session invalidated for ${sessionKey}. Clearing auth...`);
                    session.sock = null;
                    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
                    sessions.delete(sessionKey);
                }
            } else if (connection === 'open') {
                console.log(`[WA] ✅ Session ${sessionKey} connected successfully!`);
                session.isConnected = true;
                session.isConnecting = false;
                session.qrCode = null;

                // DB Güncelle: Bağlantı başarılı
                await db.run(
                    'INSERT INTO whatsapp_sessions (user_id, session_id, is_connected, qr_code, last_connected) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET is_connected = 1, qr_code = NULL, last_connected = CURRENT_TIMESTAMP',
                    [userId, sessionKey, 1, null]
                ).catch(() => { });
            }
        });

        // Rehber İsimlerini Senkronize Et
        const updateContacts = async (contacts: any[]) => {
            for (const contact of contacts) {
                const jid = contact.id?.split('@')[0];
                if (!jid || jid === 'status' || jid.includes('broadcast')) continue;

                const name = contact.name || contact.verifiedName || contact.notify;
                const lid = contact.lid; // Capture LID

                if (name || lid) {
                    try {
                        const db = await dbLib.getDatabase();

                        await db.run(
                            'INSERT INTO customers (user_id, phone_number, name, lid) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, phone_number) DO UPDATE SET name = COALESCE(excluded.name, name), lid = COALESCE(excluded.lid, lid)',
                            [userId, jid, name, lid]
                        );
                    } catch (e) { }
                }
            }
        };

        sock.ev.on('contacts.upsert', updateContacts);
        sock.ev.on('contacts.update', updateContacts);

        // Arşivleme ve Okundu Bilgisi Senkronizasyonu
        sock.ev.on('chats.update', async (chats) => {
            for (const chat of chats) {
                const jid = chat.id?.split('@')[0];
                if (!jid || jid === 'status' || jid.includes('broadcast')) continue;

                try {
                    const db = await dbLib.getDatabase();


                    // --- Arşivleme Senkronizasyonu ---
                    if (chat.archived !== undefined) {
                        const isArchived = chat.archived ? 1 : 0;
                        await db.run('INSERT OR IGNORE INTO customers (user_id, phone_number, name) VALUES (?, ?, ?)', [userId, jid, chat.name || jid]);
                        await db.run(
                            'UPDATE customers SET is_archived = ? WHERE user_id = ? AND phone_number = ?',
                            [isArchived, userId, jid]
                        );
                        console.log(`[WA] Chat ${jid} archive status synced: ${isArchived}`);
                    }

                    // Chat güncellendiğinde profil bilgisini de tazelemeyi dene
                    syncContactProfile(userId, sock, jid).catch(() => { });

                    // --- Okundu (Görüldü) Bilgisi Senkronizasyonu ---
                    // unreadCount 0 ise telefonda bu sohbet okunmuş demektir.
                    if (chat.unreadCount === 0) {
                        await db.run(
                            'UPDATE incoming_messages SET is_read = 1 WHERE user_id = ? AND phone_number = ? AND is_read = 0',
                            [userId, jid]
                        );
                        console.log(`[WA] Chat ${jid} marked as READ via phone sync`);
                    }
                } catch (e) {
                    console.error('[WA] chats.update sync error:', e);
                }
            }
        });

        sock.ev.on('chats.upsert', async (chats) => {
            for (const chat of chats) {
                const jid = chat.id?.split('@')[0];
                if (!jid || jid === 'status' || jid.includes('broadcast')) continue;

                if (chat.archived !== undefined && chat.id) {
                    const isArchived = chat.archived ? 1 : 0;
                    try {
                        const db = await dbLib.getDatabase();

                        await db.run('INSERT OR IGNORE INTO customers (user_id, phone_number, name) VALUES (?, ?, ?)', [userId, jid, chat.name || jid]);
                        await db.run(
                            'UPDATE customers SET is_archived = ? WHERE user_id = ? AND phone_number = ?',
                            [isArchived, userId, jid]
                        );
                    } catch (e) { }
                }

                // Yeni chat eklendiğinde de profili hemen çek
                syncContactProfile(userId, sock, jid).catch(() => { });
            }
        });



        // Mesaj Durumu Güncellemesi (Tek Tik, Çift Tik, Mavi Tik)
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                if (update.update.status) {
                    const status = update.update.status;
                    const msgId = update.key.id;
                    const remoteJid = update.key.remoteJid;

                    if (!msgId || !remoteJid) continue;

                    try {
                        const db = await dbLib.getDatabase();

                        // 4 = READ (Mavi Tik), 3 = DELIVERED (İletildi), 2 = SERVER_ACK (Sunucu aldı)
                        // Veritabanında status sütunu yoksa bile is_read'i güncelleyebiliriz
                        if (status === 4 || status === 5) { // 4: READ, 5: PLAYED
                            // Gönderilen mesajın okunduğunu işaretle
                            await db.run(
                                `UPDATE sent_messages SET is_read = 1 WHERE user_id = ? AND (id = (SELECT id FROM sent_messages WHERE user_id = ? AND message LIKE '%' || ? || '%') OR phone_number = ?)`, // ID match is tricky without storing WA ID, falling back to heuristic or exact ID if stored
                                [userId, userId, msgId, remoteJid.split('@')[0]]
                            );

                            // Daha güvenli yöntem: WA message ID'sini saklamak gerekir ama şimdilik phone_number ve son mesaj üzerinden gidelim
                            // VEYA: sent_messages tablosuna wa_msg_id eklenmeli. Şimdilik sadece consola basalım.
                            console.log(`[WA] Message status updated to READ for ${remoteJid}`);
                        }
                    } catch (e) {
                        console.error('[WA] Message status update error:', e);
                    }
                }
            }
        });

        setupMessageListeners(userId, sock, instanceId);

    } catch (error) {
        console.error(`[WA] 🚨 Fatal error for ${sessionKey}:`, error);
        session.isConnecting = false;
        session.qrCode = null;
    }
}

const groupMetadataCache = new Map<string, { subject: string, timestamp: number }>();
const userCache = new Map<number, { role: string, package: string, timestamp: number }>();

function setupMessageListeners(userId: number, sock: any, instanceId: string = 'main') {
    const sessionKey = `${userId}_${instanceId}`;
    console.log(`[WA] 📡 Setting up message listeners for ${sessionKey}...`);
    sock.ev.removeAllListeners('messages.upsert');

    sock.ev.on('messages.upsert', async (m: any) => {
        for (const msg of m.messages) {
            if (!msg || !msg.message) continue;

            const fromJid = msg.key.remoteJid || '';
            let from = fromJid.split('@')[0] || '';
            const isFromMe = msg.key.fromMe || false;

            if (fromJid === 'status@broadcast' || fromJid.includes('@broadcast')) continue;

            const isGroup = fromJid.includes('@g.us');
            let groupName = null;

            if (isGroup) {
                const cached = groupMetadataCache.get(fromJid);
                if (cached && (Date.now() - cached.timestamp < 3600000)) {
                    groupName = cached.subject;
                } else {
                    try {
                        const metadata = await sock.groupMetadata(fromJid);
                        groupName = metadata.subject;
                        groupMetadataCache.set(fromJid, { subject: groupName, timestamp: Date.now() });
                    } catch (err) { }
                }
            }


            try {
                const db = await dbLib.getDatabase();


                // User Cache (Fetch every 5 mins)
                let cachedUser = userCache.get(userId);
                let dbUser: { role: string, package: string } | undefined;

                if (!cachedUser || (Date.now() - cachedUser.timestamp > 300000)) {
                    const freshUser = await db.get('SELECT role, package FROM users WHERE id = ?', [userId]);
                    if (freshUser) {
                        const newCache = { ...freshUser, timestamp: Date.now() };
                        userCache.set(userId, newCache);
                        dbUser = freshUser;
                    }
                } else {
                    dbUser = { role: cachedUser.role, package: cachedUser.package };
                }

                const isDriverPackage = dbUser?.package === 'driver' || dbUser?.role === 'admin';

                // Sadece log ekle (Takip için) - SPAM ÖNLEME: YORUMA ALINDI
                // if (isGroup) {
                //    console.log(`[WA] 📥 Group Message: ${fromJid} | User ${userId} isDriver: ${isDriverPackage}`);
                // }

                if (isGroup && !isDriverPackage) continue;

                let text = '';
                const mData = msg.message;
                if (mData) {
                    text = mData.conversation ||
                        mData.extendedTextMessage?.text ||
                        mData.imageMessage?.caption ||
                        mData.videoMessage?.caption ||
                        mData.buttonsResponseMessage?.selectedDisplayText ||
                        mData.listResponseMessage?.title ||
                        mData.templateButtonReplyMessage?.selectedDisplayText ||
                        mData.viewOnceMessage?.message?.imageMessage?.caption ||
                        mData.viewOnceMessageV2?.message?.imageMessage?.caption ||
                        mData.ephemeralMessage?.message?.extendedTextMessage?.text ||
                        mData.ephemeralMessage?.message?.conversation || '';
                }

                // Sadece log ekle (Takip için) - SPAM ÖNLEME: LOGLAMA AZALTILDI
                // if (isGroup && text && text.trim().length > 2) {
                //    console.log(`[WA] 📥 Group [${groupName || fromJid}]: ${text.substring(0, 100).replace(/\n/g, ' ')}... | User: ${userId}`);
                // }

                // --- TRANSFER ŞOFÖRÜ PAKETİ: İŞ YAKALAMA MANTIĞI ---
                if (isDriverPackage) {
                    if (!text) {
                        // Sadece link discovery için devam et (eğer mesaj boşsa ama link varsa - nadir)
                    } else {
                        // 1. Yeni Grup Linklerini Keşfet - İPTAL EDİLDİ (SPAM VE BAN RİSKİ NEDENİYLE)
                        /*
                        if (text.includes('chat.whatsapp.com')) {
                            const inviteRegex = /chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9]{20,26})/g;
                            const invites = Array.from(text.matchAll(inviteRegex));
                            for (const match of invites) {
                                const code = match[1];
                                const link = `https://chat.whatsapp.com/${code}`;
                                db.run(
                                    'INSERT OR IGNORE INTO group_discovery (invite_code, invite_link, found_by_user_id) VALUES (?, ?, ?)',
                                    [code, link, userId]
                                ).catch(() => { });
                            }
                        }
                        */

                        // 2. İş Analizi
                        const job = await parseTransferJob(text);
                        if (job) {
                            // FİYAT FİLTRESİ: 400 TL altı ve belirsiz düşük fiyatlı işleri yoksay (Korsan taksi/dolmuş engelleme)
                            const priceNum = parseInt(job.price.replace(/\D/g, ''));
                            if (!isNaN(priceNum) && priceNum < 400) {
                                // console.log(`[WA] ⏭️ Job skipped (Low Price): ${job.price}`);
                                continue;
                            }
                            const senderJid = msg.key.participant || msg.key.remoteJid || fromJid;

                            // Telefon numarası mesajda yoksa, gönderen kişinin numarasını kullan
                            let finalPhone = job.phone;
                            if (!finalPhone || finalPhone === "Belirtilmedi") {
                                // SADECE person JID (@s.whatsapp.net veya @lid) olanlardan numara/JID almalıyız.
                                // Grup JID'lerini (@g.us) kesinlikle telefon numarası olarak kaydetmemeliyiz.
                                if (senderJid && (senderJid.endsWith('@s.whatsapp.net') || senderJid.endsWith('@lid'))) {
                                    finalPhone = senderJid;
                                    // Eğer sadece rakamlı bir s.whatsapp.net ise numarayı ayıkla, LID ise JID kalsın
                                    if (senderJid.endsWith('@s.whatsapp.net')) {
                                        finalPhone = senderJid.split('@')[0];
                                    }
                                } else {
                                    finalPhone = "Belirtilmedi";
                                }
                            }

                            console.log(`[WA] 🎯 Job Parsed: ${job.from_loc} -> ${job.to_loc} | Phone: ${finalPhone}`);

                            // Gelişmiş Mükerrer Kontrolü: 
                            // Lokasyonlar biliniyorsa rota bazlı, bilinmiyorsa mesaj bazlı kontrol et.
                            const isUnknown = job.from_loc === "Bilinmeyen Konum" && job.to_loc === "Bilinmeyen Konum";
                            const duplicateCheck = await db.get(
                                `SELECT id FROM captured_jobs 
                             WHERE (
                                 (? = 0 AND from_loc = ? AND to_loc = ? AND phone = ?) 
                                 OR 
                                 (raw_message = ?)
                             )
                             AND created_at >= datetime('now', '-30 seconds')
                             LIMIT 1`,
                                [isUnknown ? 1 : 0, job.from_loc, job.to_loc, finalPhone, text]
                            );

                            if (!duplicateCheck) {
                                const result = await db.run(
                                    'INSERT INTO captured_jobs (user_id, instance_id, group_jid, group_name, sender_jid, from_loc, to_loc, price, time, phone, raw_message, is_high_reward, is_swap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                    [userId, instanceId, fromJid, groupName, senderJid, job.from_loc, job.to_loc, job.price, job.time, finalPhone, text, job.is_high_reward || 0, job.is_swap || 0]
                                );

                                console.log(`[WA] ✅ Job Captured! ID: ${result.lastID} in ${groupName || fromJid}`);

                                if (result.lastID) {
                                    const { runJobAutomation } = await import('./job_automation');
                                    runJobAutomation(result.lastID).catch((e: any) => { });

                                }
                            } else {
                                console.log(`[WA] ⏭️ Duplicate job skipped.`);
                            }
                        } else if (isGroup && text.length > 10) {
                            // console.log(`[WA] ℹ️ Group msg ignored (No job found in text).`);
                        }
                    }
                }

                let mediaUrl = '';
                let mediaType = '';

                // Eğer benden gidiyorsa (Telefondan manuel gönderim kontrolü)
                if (isFromMe) {
                    // Son 5 saniye içinde sistem tarafından gönderilmiş mi kontrol et (Duplicate önlemek için)
                    const recentlySent = await db.get(
                        "SELECT id FROM sent_messages WHERE user_id = ? AND phone_number = ? AND sent_at >= datetime('now', '-5 seconds') LIMIT 1",
                        [userId, from]
                    );

                    if (!recentlySent) {
                        console.log(`[WA] 📱 Manual message from phone detected. Recording...`);
                        await db.run(
                            'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                            [userId, from, text || '🖼️ Medya Mesajı', 'sent']
                        );
                    }
                    continue; // Benden giden mesajın işlenmesi burada biter, auto-reply tetiklenmez.
                }

                // --- Gelen Mesaj İşleme ---
                // Medya İndirme Kapatıldı (Disk Doluluğunu Önlemek İçin)
                /*
                if (msg.message.audioMessage) {
                    console.log(`[WA] 🎵 Audio detected. Skipping download to save space.`);
                    // ... (indirme mantığı yoruma alındı)
                    text = text || '🎤 Sesli Mesaj (İndirilmedi)';
                }
                else if (msg.message.imageMessage) {
                    console.log(`[WA] 🖼️ Image detected. Skipping download to save space.`);
                    // ... (indirme mantığı yoruma alındı)
                    text = text || '🖼️ Fotoğraf (İndirilmedi)';
                }
                */

                if (!text && !mediaUrl) continue;

                const pushName = msg.pushName || 'Bilinmeyen';

                await db.run(
                    'INSERT INTO incoming_messages (user_id, phone_number, name, content, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, from, pushName, text, mediaUrl, mediaType]
                );
                console.log(`[WA] ✅ Incoming message saved: ${from}`);

                // Profil Bilgilerini Senkronize Et (Arka Planda) - SPAM ÖNLEME: SADECE GEREKİRSE
                // syncContactProfile(userId, sock, from).catch(e => console.error('[WA] Profile sync error:', e));

                // --- Auto Reply Logic ---
                if (text) {
                    const cleanText = text.toLowerCase().trim();
                    const autoReply = await db.get(
                        "SELECT reply FROM auto_replies WHERE user_id = ? AND is_active = 1 AND ? LIKE '%' || keyword || '%' LIMIT 1",
                        [userId, cleanText]
                    );

                    if (autoReply) {
                        console.log(`[WA] 🤖 Auto-reply triggered for keyword: ${cleanText}`);
                        setTimeout(async () => {
                            const success = await sendMessage(userId, from, autoReply.reply);
                            if (success) {
                                await db.run(
                                    'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                                    [userId, from, autoReply.reply, 'sent']
                                );
                                const dbUser = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
                                if (dbUser.role !== 'admin') {
                                    await db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [userId]);
                                }
                            }
                        }, 2500);
                    }
                }
            } catch (err) {
                console.error('[WA] ❌ Error processing message:', err);
            }
        }
    });
}


async function syncContactProfile(userId: number, sock: any, phone: string) {
    try {
        const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
        const db = await dbLib.getDatabase();


        // Profil Resmi Sorgula
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(jid, 'image');
        } catch (e) { /* Resim yoksa hata verebilir, geçiyoruz */ }

        // Durum (Bio) Sorgula
        let status = null;
        try {
            // LID (Gizli ID) için status sorgulanamayabilir, normal numaralarda deneyelim
            if (!jid.includes('@lid')) {
                const statusData = await sock.fetchStatus(jid);
                status = statusData?.status;
            }
        } catch (e) { /* Bio yoksa hata verebilir, geçiyoruz */ }

        if (ppUrl || status) {
            await db.run(
                'UPDATE customers SET profile_picture_url = ?, status = ? WHERE user_id = ? AND phone_number = ?',
                [ppUrl, status, userId, phone.split('@')[0]]
            );
            console.log(`[WA] Profile synced for ${phone}: ${ppUrl ? 'Image' : 'No Image'}, ${status ? 'Bio' : 'No Bio'}`);
        }
    } catch (err: any) {
        console.error(`[WA] syncContactProfile error for ${phone}:`, err.message);
    }
}

export async function disconnectWhatsApp(userId: number, instanceId: string = 'main'): Promise<void> {
    const sessionKey = `${userId}_${instanceId}`;
    console.log(`[WA] 🧹 Explicitly disconnecting ${sessionKey}...`);
    const session = await getSession(userId, instanceId);

    if (session.sock) {
        try {
            session.sock.ev.removeAllListeners('connection.update');
            session.sock.end(undefined);
        } catch (e) { }
    }

    session.isConnected = false;
    session.isConnecting = false;
    session.qrCode = null;
    session.sock = null;

    const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${sessionKey}`);
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });

    sessions.delete(sessionKey);
    console.log(`[WA] ${sessionKey} cleared.`);
}

export async function sendMessage(userId: number, to: string, message: string, options?: { mediaUrl?: string, mediaType?: string, mediaMimeType?: string, duration?: number, instanceId?: string }): Promise<boolean> {
    const instanceId = options?.instanceId || 'main';
    const session = await getSession(userId, instanceId);
    if (!session.isConnected || !session.sock) return false;

    try {
        let jid = to;
        if (to.includes('@lid') || to.includes('@g.us') || to.includes('@s.whatsapp.net')) {
            jid = to;
        } else {
            // Numarayı temizle ve 90 ekle (Türkiye için)
            let clean = to.replace(/\D/g, '');
            if (clean.length === 11 && clean.startsWith('0')) clean = '90' + clean.substring(1);
            else if (clean.length === 10 && clean.startsWith('5')) clean = '90' + clean;

            jid = `${clean}@s.whatsapp.net`;
        }

        if (options?.mediaUrl && options.mediaType === 'audio') {
            const audioPath = path.join(process.cwd(), 'data', options.mediaUrl);

            // Wait slightly to ensure file is ready
            await new Promise(resolve => setTimeout(resolve, 500));

            if (!fs.existsSync(audioPath)) {
                console.error(`[WA] Audio NOT FOUND: ${audioPath}`);
                return false;
            }

            const tempOutputPath = audioPath + '.converted.ogg';
            let finalBuffer: Buffer;
            let finalMime = 'audio/ogg; codecs=opus';

            try {
                console.log(`[WA] Transcoding audio to OGG Opus for compatibility...`);
                // Use FFmpeg to convert to WhatsApp compatible OGG Opus (Mono, 16kHz, Opus)
                // We use absolute path for ffmpeg to be safe
                const ffmpegPath = 'ffmpeg';
                execSync(`"${ffmpegPath}" -i "${audioPath}" -c:a libopus -ac 1 -ar 16000 -b:a 32k -y "${tempOutputPath}"`);

                finalBuffer = fs.readFileSync(tempOutputPath);
                // Clean up temp file
                if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
                console.log(`[WA] Transcoding success. Size: ${finalBuffer.length} bytes`);
            } catch (transcodeError) {
                console.error(`[WA] Transcoding failed, falling back to original:`, transcodeError);
                finalBuffer = fs.readFileSync(audioPath);
                finalMime = 'audio/mp4'; // Fallback mime
            }

            await session.sock.sendMessage(jid, {
                audio: finalBuffer,
                mimetype: finalMime,
                ptt: true,
                seconds: Math.floor(options.duration || 0)
            });
            console.log(`[WA] Sent PTT success to ${to}`);
        } else if (options?.mediaUrl && options.mediaType === 'image') {
            const imagePath = path.join(process.cwd(), 'data', options.mediaUrl);
            if (!fs.existsSync(imagePath)) return false;

            const imageBuffer = fs.readFileSync(imagePath);
            await session.sock.sendMessage(jid, {
                image: imageBuffer,
                caption: message || ''
            });
            console.log(`[WA] Sent Image success to ${to}`);
        } else {
            await session.sock.sendMessage(jid, { text: message });
        }
        return true;
    } catch (error: any) {
        console.error('[WA] Send message error details:', error);
        return false;
    }
}

// --- Scheduler Worker ---
let schedulerInterval: NodeJS.Timeout | null = null;

export function initScheduler() {
    if (schedulerInterval) return;

    console.log('[Scheduler] ⏰ Starting background worker...');
    schedulerInterval = setInterval(async () => {
        const db = await dbLib.getDatabase();


        // Find pending messages that are due
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];
        const pending = await db.all(
            "SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_at <= ?",
            [now]
        );

        for (const job of pending) {
            console.log(`[Scheduler] 🚀 Processing job ${job.id} for user ${job.userId}`);

            try {
                // Update status to prevent double processing
                await db.run("UPDATE scheduled_messages SET status = 'processing' WHERE id = ?", [job.id]);

                const customerIds = JSON.parse(job.customer_ids);
                const placeholders = customerIds.map(() => '?').join(',');
                const customers = await db.all(
                    `SELECT * FROM customers WHERE id IN (${placeholders}) AND user_id = ?`,
                    [...customerIds, job.userId]
                );

                if (customers.length > 0) {
                    // Send using the existing process
                    // We can't use the API route here, so we call sendMessage directly or a helper
                    for (const customer of customers) {
                        let personalizedMsg = job.message;
                        personalizedMsg = personalizedMsg.replace(/{{isim}}/gi, customer.name || "");

                        if (customer.additional_data) {
                            try {
                                const extra = JSON.parse(customer.additional_data);
                                Object.keys(extra).forEach(key => {
                                    const regex = new RegExp(`{{${key}}}`, 'gi');
                                    personalizedMsg = personalizedMsg.replace(regex, extra[key]);
                                });
                            } catch (e) { }
                        }

                        const success = await sendMessage(job.userId, customer.phone_number, personalizedMsg);
                        if (success) {
                            await db.run(
                                'INSERT INTO sent_messages (user_id, phone_number, message, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                                [job.userId, customer.phone_number, personalizedMsg, 'sent']
                            );
                            // Deduct credit
                            const u = await db.get('SELECT role FROM users WHERE id = ?', [job.userId]);
                            if (u.role !== 'admin') {
                                await db.run('UPDATE users SET credits = credits - 1 WHERE id = ?', [job.userId]);
                            }
                        }
                        // Get user settings for delay
                        let userSettings = await db.get('SELECT min_delay FROM user_settings WHERE user_id = ?', [job.userId]);
                        const delaySeconds = userSettings?.min_delay || 5;
                        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                    }
                }

                await db.run("UPDATE scheduled_messages SET status = 'sent' WHERE id = ?", [job.id]);
            } catch (err) {
                console.error(`[Scheduler] ❌ Job ${job.id} failed:`, err);
                await db.run("UPDATE scheduled_messages SET status = 'failed' WHERE id = ?", [job.id]);
            }
        }
    }, 60000); // Check every minute
}

/**
 * Transfer gruplarından gelen mesajları analiz eder.
 * AI Desteği ile lokasyon ve fiyat ayıklama.
 */
async function parseTransferJob(text: string) {
    if (!text) return null;

    // 1. Telefon numarasını yakala (Çok daha esnek regex)
    const phoneRegex = /(?:\+90|0)?\s*\(?\s*5\d{2}\s*\)?[\s\.\-]*\d{3}[\s\.\-]*\d{2}[\s\.\-]*\d{2}/g;
    const phoneMatch = text.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : null;

    // Telefon zorunluluğunu kaldırdık, çünkü gönderen JID'den de alınabiliyor.
    // Ancak mesajda bir iş olduğunu anlamak için başka kriterlere bakacağız.

    // 2. Yapay Zeka ile Analiz Denemesi
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (apiKey) {
        try {
            const prompt = `Aşağıdaki WhatsApp mesajındaki transfer işini analiz et ve verileri ayıkla.
            
            ÖNEMLİ KURALLAR:
            1. LOKASYON AYIRMA: Mesajda "İHL Fatih", "SAW Taksim", "Havalimanı Beşiktaş" gibi yan yana iki lokasyon varsa; İLKİ "from_loc" (Nereden), İKİNCİSİ "to_loc" (Nereye) olarak kabul edilir.
            2. ÖRNEKLER: 
               - "Hazır ihl fatih 1500" -> {"from_loc": "İHL", "to_loc": "Fatih", "price": "1500", "time": "HAZIR 🚨", "is_high_reward": false, "is_swap": false}
               - "saw taksim lüks araç 2000" -> {"from_loc": "SAW", "to_loc": "Taksim", "price": "2000", "time": "Belirtilmedi", "is_high_reward": true, "is_swap": false}
             3. **TAKAS (SWAP) VE İŞ DEĞİŞİMİ ANALİZİ:** 
               - Eğer mesajda "verilir", "veirlir", "veİrlir", "alınır", "takas", "boş araç", "iş istenir", "karşılama alınır", "çıkış verilir", "yerine iş alınır" gibi ifadeler geçiyorsa;
               - VEYA mesajda birden fazla farklı iş/zaman dilimi varsa (Örn: "05:00 Tuzla-IHL verilir, 10:00 SAW alınır");
               - Bu bir TAKAS (SWAP) işidir. "is_swap": true yap. 
               - Bu durumda "from_loc" değerini "ÇOKLU / TAKAS" olarak ayarla.
             4. KISALTMALAR: "İHL", "IHL", "İst", "İsl", "IST", "ISL", "İGA" kelimelerinin tamamı "İstanbul Havalimanı" anlamına gelir.
             5. ZAMAN: "Hazır", "Hemen", "Acil", "Azır", "Azir" gibi kelimeler varsa time="HAZIR 🚨" yap.
            6. FİYAT: Fiyatı sadece rakam olarak ayıkla. Eğer fiyat yoksa "Belirtilmedi" yaz.
            7. FİYAT ANALİZİ: Rota ve fiyatı değerlendir. Eğer fiyat piyasa ortalamasının üzerindeyse "is_high_reward": true yap. 

            Yanıtı SADECE şu JSON formatında ver: {"from_loc": "...", "to_loc": "...", "price": "...", "time": "...", "is_high_reward": boolean, "is_swap": boolean}

            Mesaj: "${text}"`;

            const aiText = await tryGemini(prompt, apiKey);

            if (aiText) {
                const match = aiText.match(/\{[\s\S]*\}/);
                if (match) {
                    const data = JSON.parse(match[0]);
                    if (data.from_loc || data.price !== "Belirtilmedi") {
                        let from = data.from_loc || "Bilinmiyor";
                        let to = data.to_loc || "Bilinmiyor";

                        // Akıllı Ayırma: Eğer to_loc boşsa ve from_loc içinde boşluk varsa (Örn: "İHL Fatih"), bunları ayör.
                        if (!data.is_swap && (to === "Bilinmiyor" || to === "Bilinmeyen Konum") && from.includes(' ')) {
                            const parts = from.split(/\s+/).filter((p: string) => p.length > 1);
                            if (parts.length >= 2) {
                                from = parts[0];
                                to = parts.slice(1).join(' ');
                            }
                        }

                        // Fiyata ₺ işareti ekle (eğer yoksa)
                        let aiPrice = data.price || "Belirtilmedi";
                        if (aiPrice !== "Belirtilmedi" && !aiPrice.includes("₺") && !aiPrice.includes("TL")) {
                            aiPrice = aiPrice.replace(/(\d+).*/, "$1₺");
                        }

                        return {
                            from_loc: from,
                            to_loc: to,
                            price: aiPrice,
                            time: data.time || "Belirtilmedi",
                            is_high_reward: data.is_high_reward ? 1 : 0,
                            is_swap: data.is_swap ? 1 : 0,
                            phone: phone || "Belirtilmedi" // Regex ile bulunan telefon
                        };
                    }
                }
            }
        } catch (e) {
            console.error("[WA AI Parser Error]", e);
        }
    }

    // 3. Fallback: Eski Regex Mantığı (Eğer AI başarısız olursa veya anahtar yoksa)
    // Önce telefon numaralarını metinden temizleyelim ki fiyatla karışmasın
    const cleanTextForPrice = text.replace(phoneRegex, ' [TEL] ');

    // Fiyat regexini daha esnek ama kontrollü yapalım: 300 ile 50000 arası değerler
    const priceRegex = /\b(\d{3,4}|[1-5]\d{4}|[1-9][\.\,]\d{3})\b\s*(?:TL|₺|TRY|LİRA|Lira|Nakit|nakit|EFT|eft|\+)?/i;
    const priceMatch = cleanTextForPrice.match(priceRegex);
    let price = priceMatch ? priceMatch[0].trim() : "Belirtilmedi";

    // Fiyata ₺ işareti ekle (eğer yoksa)
    if (price !== "Belirtilmedi" && !price.includes("₺") && !price.includes("TL") && !price.includes("+")) {
        // Sadece rakam varsa sonuna ₺ ekle
        price = price.replace(/(\d+).*/, "$1₺");
    }

    // Fallback için Zaman Analizi
    let time = "Belirtilmedi";
    const lowerText = text.toLowerCase();
    const readyKeywords = ["hazır", "acil", "hemen", "bekleyen", "yolcu hazır", "azır", "azir", "hazir"];
    if (readyKeywords.some(kw => lowerText.includes(kw))) {
        time = "HAZIR 🚨";
    }

    // Fallback için Takas (Swap) Analizi
    const isSwapKeywords = ["alınır", "verilir", "veirlir", "veİrlir", "takas", "yerine", "boş araç", "iş istenir", "karşılama", "çıkış"];

    const isSwap = isSwapKeywords.some(kw => lowerText.includes(kw));

    const locations = [
        // Havalimanları ve Ana Noktalar
        "SAW", "İHL", "IHL", "IST", "İST", "ISL", "İSL", "SABİHA", "İSTANBUL HAVALİMANI", "HAVALİMANI", "İGA", "OTOGAR", "PORT", "MARİNA", "GALATAPORT", "TERSANE", "VADİ İSTANBUL", "ZORLU", "İSTİNYE PARK", "METROPOL", "FİŞEKHANE",
        // Avrupa Yakası İlçeler & Semtler
        "ARNAVUTKÖY", "AVCILAR", "BAĞCILAR", "BAHÇELİEVLER", "BAKIRKÖY", "BAŞAKŞEHİR", "BAYRAMPAŞA", "BEŞİKTAŞ", "BEYLİKDÜZÜ", "BEYOĞLU", "BÜYÜKÇEKMECE", "ÇATALCA", "ESENLER", "ESENYURT", "EYÜPSULTAN", "EYÜP", "FATİH", "GAZİOSMANPAŞA", "GÜNGÖREN", "KAĞITHANE", "KÜÇÜKÇEKMECE", "SARIYER", "SİLİVRI", "SULTANGAZİ", "ŞİŞLİ", "ZEYTİNBURNU",
        "TAKSİM", "ORTAKÖY", "BEBEK", "ETİLER", "ULUS", "NİŞANTAŞI", "MECİDİYEKÖY", "LEVENT", "MASLAK", "TARABYA", "İSTİNYE", "YENİKÖY", "EMİRGAN", "KARAKÖY", "EMİNÖNÜ", "SULTANAHMET", "SİRKECİ", "LALELİ", "AKSARAY", "YENİKAPI", "TOPKAPI", "CEVİZLİBAĞ", "MERTER", "GÜNEŞLİ", "HALKALI", "İKİTELLİ", "KAYABAŞI", "ISPARTAKULE", "BAHÇEŞEHİR", "HADIMKÖY", "KIRAÇ", "KUMBURGAZ", "SELİMPAŞA", "GÜRPİNAR", "YAKUPLU", "KAVAKLI", "ALİBEYKÖY", "KAZLIÇEŞME", "YENİBOSNA", "FLORYA", "YEŞİLYURT", "YEŞİLKÖY", "SİLAHTARAĞA",
        // Anadolu Yakası İlçeler & Semtler
        "ADALAR", "ATAŞEHİR", "BEYKOZ", "ÇEKMEKÖY", "KADIKÖY", "KARTAL", "MALTEPE", "PENDİK", "SANCAKTEPE", "SULTANBEYLİ", "ŞİLE", "TUZLA", "ÜMRANİYE", "ÜSKÜDAR",
        "MODA", "FENERBAHÇE", "CADDEBOSTAN", "ERENKÖY", "SUADİYE", "BOSTANCI", "KÜÇÜKYALI", "İDEALTEPE", "ACIBADEM", "KOŞUYOLU", "BEYLERBEYİ", "ÇENGELKÖY", "KANDİLLİ", "KANLICA", "ÇUBUKLU", "PAŞABAHÇE", "KAVACIK", "POLONEZKÖY", "RİVA", "AĞVA", "KURTKÖY", "KAYNARCA", "GÜZELYALI", "AYDINLI", "İÇMELER", "ŞEKERPINAR", "ÇAYIROVA",
        // Yakın Şehirler & Tatil Yerleri
        "GEBZE", "DARICA", "DİLOVASI", "KOCAELİ", "İZMİT", "SAKARYA", "ADAPAZARI", "SAPANCA", "MAŞUKİYE", "KARTEPE", "BURSA", "YALOVA", "MUDANYA", "GEMLİK", "BOLU", "ABANT", "KARTALKAYA", "TEKİRDAĞ", "ÇORLU", "ÇERKEZKÖY", "EDİRNE", "KIRKLARELİ"
    ];

    const foundLocations: { name: string, index: number }[] = [];
    const normalizedText = text.toUpperCase();

    locations.forEach(loc => {
        const idx = normalizedText.indexOf(loc);
        if (idx !== -1) {
            foundLocations.push({ name: loc, index: idx });
        }
    });

    // Mesaj içindeki sırasına göre sırala
    foundLocations.sort((a, b) => a.index - b.index);

    // Dinamik Lokasyon Ayıklama (Eğer listeden bulunamadıysa)
    let from_loc = foundLocations[0]?.name || "Bilinmeyen Konum";
    let to_loc = foundLocations[1]?.name || "Bilinmeyen Konum";

    if (from_loc === "Bilinmeyen Konum" || to_loc === "Bilinmeyen Konum") {
        // "A - B" veya "A / B" formatını ara
        const patternRegex = /([A-ZÇĞİÖŞÜ]{3,})\s*[\-\/]\s*([A-ZÇĞİÖŞÜ]{3,})/i;
        const patternMatch = text.match(patternRegex);
        if (patternMatch) {
            if (from_loc === "Bilinmeyen Konum") from_loc = patternMatch[1].toUpperCase();
            if (to_loc === "Bilinmeyen Konum") to_loc = patternMatch[2].toUpperCase();
        }
    }

    if (isSwap) {
        from_loc = "ÇOKLU / TAKAS";
        to_loc = "BÖLGE";
    }

    if (foundLocations.length > 0 || price !== "Belirtilmedi" || isSwap || phone) {
        return {
            from_loc,
            to_loc,
            price: price.toUpperCase(),
            time,
            is_high_reward: 0,
            is_swap: isSwap ? 1 : 0,
            phone: phone || "Belirtilmedi"
        };
    }

    return null;
}
