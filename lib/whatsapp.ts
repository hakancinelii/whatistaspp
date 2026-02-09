import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, downloadMediaMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { tryGemini } from './ai';

// Use a global variable to persist sessions across HMR reloads in dev mode
const globalForWhatsApp = global as unknown as {
    whatsappSessions: Map<number, WhatsAppSession> | undefined;
    activeSendings: Map<number, any> | undefined;
};

const sessions = globalForWhatsApp.whatsappSessions ?? new Map<number, WhatsAppSession>();
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

export async function getSession(userId: number): Promise<WhatsAppSession> {
    if (!sessions.has(userId)) {
        sessions.set(userId, {
            userId,
            sock: null,
            qrCode: null,
            isConnected: false,
            isConnecting: false,
        });

        // Auth state folder inside data directory for persistence
        const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${userId}`);
        if (!sessions.get(userId)?.isConnected && !sessions.get(userId)?.isConnecting && fs.existsSync(authDir) && fs.readdirSync(authDir).length > 0) {
            console.log(`[WA] Found existing session for user ${userId}. Auto-connecting...`);
            setTimeout(() => {
                import('./whatsapp').then(m => m.connectWhatsApp(userId)).catch(e => console.error('[WA] Auto-connect failed:', e));
            }, 100);
        }
    }
    return sessions.get(userId)!;
}

export async function connectWhatsApp(userId: number, force = false): Promise<void> {
    const session = await getSession(userId);

    // If already connected, we refresh listeners to ensure HMR code updates are active
    if (!force && session.isConnected && session.sock) {
        console.log(`[WA] User ${userId} already connected. Refreshing listeners for HMR...`);
        setupMessageListeners(userId, session.sock);
        return;
    }

    // Prevent spamming connection attempts (unless forced)
    const now = Date.now();
    if (!force && session.isConnecting && session.lastAttempt && (now - session.lastAttempt < 15000)) {
        console.log(`[WA] Connection attempt already in progress for user ${userId}.`);
        return;
    }

    console.log(`[WA] 🚀 User ${userId}: Initiating connection (force: ${force})...`);
    session.isConnecting = true;
    session.lastAttempt = now;
    session.qrCode = null;

    try {
        const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${userId}`);
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
            browser: ["Ubuntu", "Chrome", "114.0.5735.196"],
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 90000,
            keepAliveIntervalMs: 30000,
            generateHighQualityLinkPreview: true,
        });

        session.sock = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            const { getDatabase } = require('./db');
            const db = await getDatabase();

            if (qr) {
                console.log(`[WA] 🔳 New QR generated for user ${userId}`);
                session.qrCode = await qrcode.toDataURL(qr);

                // QR bilgisini DB'ye kaydet
                await db.run(
                    'INSERT INTO whatsapp_sessions (user_id, session_id, qr_code, is_connected) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET qr_code = ?, is_connected = 0',
                    [userId, `session_${userId}`, session.qrCode, 0, session.qrCode]
                ).catch(() => { });
            }

            if (connection === 'close') {
                const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
                console.log(`[WA] ❌ Connection closed for user ${userId}. Reason: ${reason}`);

                session.isConnected = false;
                session.isConnecting = false;
                session.qrCode = null;

                // DB Güncelle: Bağlantı koptu
                await db.run(
                    'INSERT INTO whatsapp_sessions (user_id, session_id, is_connected, qr_code) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET is_connected = 0, qr_code = NULL',
                    [userId, `session_${userId}`, 0, null]
                ).catch(() => { });

                if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 405) {
                    console.log(`[WA] 🏹 Session invalidated for user ${userId}. Clearing auth...`);
                    session.sock = null;
                    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
                    sessions.delete(userId);
                }
            } else if (connection === 'open') {
                console.log(`[WA] ✅ User ${userId} connected successfully!`);
                session.isConnected = true;
                session.isConnecting = false;
                session.qrCode = null;

                // DB Güncelle: Bağlantı başarılı
                await db.run(
                    'INSERT INTO whatsapp_sessions (user_id, session_id, is_connected, qr_code, last_connected) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET is_connected = 1, qr_code = NULL, last_connected = CURRENT_TIMESTAMP',
                    [userId, `session_${userId}`, 1, null]
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
                        const { getDatabase } = require('./db');
                        const db = await getDatabase();
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
                    const { getDatabase } = require('./db');
                    const db = await getDatabase();

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
                        const { getDatabase } = require('./db');
                        const db = await getDatabase();
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
                        const { getDatabase } = require('./db');
                        const db = await getDatabase();
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

        setupMessageListeners(userId, sock);

    } catch (error) {
        console.error(`[WA] 🚨 Fatal error for user ${userId}:`, error);
        session.isConnecting = false;
        session.qrCode = null;
    }
}

function setupMessageListeners(userId: number, sock: any) {
    console.log(`[WA] 📡 Setting up message listeners for user ${userId}...`);
    sock.ev.removeAllListeners('messages.upsert');

    sock.ev.on('messages.upsert', async (m: any) => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        const fromJid = msg.key.remoteJid || '';
        let from = fromJid.split('@')[0] || '';

        // Eğer mesaj LID (Gizli ID) üzerinden geliyorsa
        if (fromJid.includes('@lid')) {
            from = fromJid; // Default to LID if lookup fails
            try {
                const { getDatabase } = require('./db');
                const db = await getDatabase();
                const matchedContact = await db.get('SELECT phone_number FROM customers WHERE lid = ? AND user_id = ?', [fromJid, userId]);
                if (matchedContact && matchedContact.phone_number) {
                    from = matchedContact.phone_number;
                    console.log(`[WA] LID ${fromJid} mapped to Phone ${from}`);
                }
            } catch (e) {
                console.error('[WA] LID Lookup Error:', e);
            }
        }

        const isFromMe = msg.key.fromMe || false;

        // WhatsApp Durum (Story) ve Yayın mesajlarını yoksay
        if (fromJid === 'status@broadcast' || fromJid.includes('@broadcast')) {
            return;
        }

        const isGroup = fromJid.includes('@g.us');

        try {
            const { getDatabase } = require('./db');
            const db = await getDatabase();
            const dbUser = await db.get('SELECT package FROM users WHERE id = ?', [userId]);
            const isDriverPackage = dbUser?.package === 'driver';

            // Grup mesajıysa ve şoför paketi değilse yoksay
            if (isGroup && !isDriverPackage) {
                return;
            }

            console.log(`[WA] 📥 Message detected: ${from} (Group: ${isGroup}, fromMe: ${isFromMe})`);

            let text = msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                msg.message.videoMessage?.caption ||
                msg.message.buttonsResponseMessage?.selectedDisplayText ||
                msg.message.listResponseMessage?.title || '';

            if (!text) return;

            // --- TRANSFER ŞOFÖRÜ PAKETİ: İŞ YAKALAMA MANTIĞI ---
            // Hem Grup Hem Bireysel Mesajlarda Çalışır
            if (isDriverPackage) {
                // 1. Yeni Grup Linklerini Keşfet
                const inviteRegex = /chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9]{20,26})/g;
                const invites = [...text.matchAll(inviteRegex)];
                for (const match of invites) {
                    const code = match[1];
                    const link = `https://chat.whatsapp.com/${code}`;
                    try {
                        await db.run(
                            'INSERT OR IGNORE INTO group_discovery (invite_code, invite_link, found_by_user_id) VALUES (?, ?, ?)',
                            [code, link, userId]
                        );
                    } catch (e) { }
                }

                const job = await parseTransferJob(text);
                if (job) {
                    const senderJid = msg.key.participant || msg.key.remoteJid || fromJid;
                    let groupName = null;
                    if (isGroup) {
                        try {
                            const metadata = await sock.groupMetadata(fromJid);
                            groupName = metadata.subject;
                        } catch (err) {
                            console.warn(`[WA] Could not fetch group metadata for ${fromJid}`);
                        }
                    }

                    console.log(`[WA] 🚕 JOB CAPTURED! ${job.from_loc} -> ${job.to_loc} from ${senderJid} (Group: ${groupName || 'PM'})`);
                    await db.run(
                        'INSERT INTO captured_jobs (user_id, group_jid, group_name, sender_jid, from_loc, to_loc, price, time, phone, raw_message, is_high_reward, is_swap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [userId, fromJid, groupName, senderJid, job.from_loc, job.to_loc, job.price, job.time, job.phone, text, job.is_high_reward || 0, job.is_swap || 0]
                    );
                }
                if (isGroup) return; // Grup mesajları inbox'a düşmesin, sadece yakalansın. PM ise devam etsin.
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
                return; // Benden giden mesajın işlenmesi burada biter, auto-reply tetiklenmez.
            }

            // --- Gelen Mesaj İşleme ---
            // Handle Audio
            if (msg.message.audioMessage) {
                console.log(`[WA] 🎵 Audio detected. Downloading...`);
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'audio');
                if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

                const fileName = `${Date.now()}_voice.ogg`;
                await writeFile(path.join(uploadDir, fileName), buffer as Buffer);
                mediaUrl = `/uploads/audio/${fileName}`;
                mediaType = 'audio';
                text = text || '🎤 Sesli Mesaj';
            }
            // Handle Image
            else if (msg.message.imageMessage) {
                console.log(`[WA] 🖼️ Image detected. Downloading...`);
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'images');
                if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

                const fileName = `${Date.now()}_received.jpg`;
                await writeFile(path.join(uploadDir, fileName), buffer as Buffer);
                mediaUrl = `/uploads/images/${fileName}`;
                mediaType = 'image';
                text = text || '🖼️ Fotoğraf';
            }

            if (!text && !mediaUrl) return;

            const pushName = msg.pushName || 'Bilinmeyen';

            await db.run(
                'INSERT INTO incoming_messages (user_id, phone_number, name, content, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, from, pushName, text, mediaUrl, mediaType]
            );
            console.log(`[WA] ✅ Incoming message saved: ${from}`);

            // Profil Bilgilerini Senkronize Et (Arka Planda)
            syncContactProfile(userId, sock, from).catch(e => console.error('[WA] Profile sync error:', e));

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
    });
}


async function syncContactProfile(userId: number, sock: any, phone: string) {
    try {
        const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
        const { getDatabase } = require('./db');
        const db = await getDatabase();

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

export async function disconnectWhatsApp(userId: number): Promise<void> {
    console.log(`[WA] 🧹 Explicitly disconnecting user ${userId}...`);
    const session = await getSession(userId);

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

    const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${userId}`);
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });

    sessions.delete(userId);
    console.log(`[WA] User ${userId} cleared.`);
}

export async function sendMessage(userId: number, to: string, message: string, options?: { mediaUrl?: string, mediaType?: string, mediaMimeType?: string, duration?: number }): Promise<boolean> {
    const session = await getSession(userId);
    if (!session.isConnected || !session.sock) return false;

    try {
        let jid = to;
        if (to.includes('@lid') || to.includes('@g.us')) {
            jid = to; // LID veya Grup ise olduğu gibi bırak
        } else if (!to.includes('@s.whatsapp.net')) {
            jid = `${to}@s.whatsapp.net`; // Normal numaraysa uzantı ekle
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
        const { getDatabase } = require('./db');
        const db = await getDatabase();

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

    // 1. Telefon numarasını yakala (Daha esnek regex)
    const phoneRegex = /(?:\+90|0)?\s*5\d{2}[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g;
    const phoneMatch = text.match(phoneRegex);
    if (!phoneMatch) return null;
    const phone = phoneMatch[0].replace(/\D/g, '');

    // 2. Yapay Zeka ile Analiz Denemesi
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (apiKey) {
        try {
            const prompt = `Aşağıdaki WhatsApp mesajındaki transfer işini analiz et ve verileri ayıkla.
            
            ÖNEMLİ KURALLAR:
            1. LOKASYON AYIRMA: Mesajda "İHL Fatih", "SAW Taksim", "Havalimanı Beşiktaş" gibi yan yana iki lokasyon varsa; İLKİ "from_loc" (Nereden), İKİNCİSİ "to_loc" (Nereye) olarak kabul edilir. Asla bu iki kelimeyi tek bir lokasyon sanma.
            2. ÖRNEKLER: 
               - "Hazır ihl fatih 1500" -> {"from_loc": "İHL", "to_loc": "Fatih", "price": "1500", "time": "HAZIR 🚨", "is_high_reward": false, "is_swap": false}
               - "saw taksim lüks araç 2000" -> {"from_loc": "SAW", "to_loc": "Taksim", "price": "2000", "time": "Belirtilmedi", "is_high_reward": true, "is_swap": false}
            3. **TAKAS (SWAP) ANALİZİ:** Eğer mesajda birden fazla iş varsa (Örn: 05:00 Tuzla-IHL, 10:00 Kumkapı-SAW) veya "verilir", "alınır", "takas", "boş araç", "iş istenir" gibi ifadeler geçiyorsa, bu bir TAKAS işidir. "is_swap": true yap ve "from_loc" değerini "ÇOKLU / TAKAS" olarak ayarla.
            4. KISALTMALAR: "İHL", "IHL", "İst", "İsl", "IST", "ISL" kelimelerinin tamamı "İstanbul Havalimanı" anlamına gelir.
            5. ZAMAN: "Hazır", "Hemen", "Acil" gibi kelimeler varsa time="HAZIR 🚨" yap.
            6. FİYAT: Fiyatı sadece rakam olarak ayıkla (Örn: 1500).
            7. FİYAT ANALİZİ: Rota ve fiyatı değerlendir. Eğer fiyat piyasa ortalamasının üzerindeyse (Yüksek kazançlıysa) "is_high_reward": true yap. 

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

                        return {
                            from_loc: from,
                            to_loc: to,
                            price: data.price || "Belirtilmedi",
                            time: data.time || "Belirtilmedi",
                            is_high_reward: data.is_high_reward ? 1 : 0,
                            is_swap: data.is_swap ? 1 : 0,
                            phone
                        };
                    }
                }
            }
        } catch (e) {
            console.error("[WA AI Parser Error]", e);
        }
    }

    // 3. Fallback: Eski Regex Mantığı (Eğer AI başarısız olursa veya anahtar yoksa)
    const priceRegex = /(\d{1,2}[\.\,]?\d{3})\s*(?:TL|₺|TRY|LİRA|Lira|Nakit|nakit|EFT|eft)?/i;
    const priceMatch = text.match(priceRegex);
    const price = priceMatch ? priceMatch[0].trim() : "Belirtilmedi";

    // Fallback için Zaman Analizi
    let time = "Belirtilmedi";
    const lowerText = text.toLowerCase();
    if (lowerText.includes("hazır") || lowerText.includes("acil") || lowerText.includes("hemen") || lowerText.includes("bekleyen") || lowerText.includes("yolcu hazır")) {
        time = "HAZIR 🚨";
    }

    const locations = [
        "SAW", "İHL", "IHL", "IST", "İST", "ISL", "İSL", "SABİHA", "İSTANBUL HAVALİMANI", "HAVALİMANI",
        "SULTANAHMET", "FATİH", "BEŞİKTAŞ", "ŞİŞLİ", "ESENLER", "ZEYTİNBURNU",
        "CANKURTARAN", "ÇEKMEKÖY", "LALELİ", "SİRKECİ", "YENİKAPI", "AKSARAY",
        "PAZARTEKKE", "VATAN", "BEYLİKDÜZÜ", "ESENYURT", "SARIYER", "MASLAK",
        "RİXOS", "TERSANE", "TAKSİM", "MECİDİYEKÖY", "BAKIRKÖY", "ATAŞEHİR",
        "KADIKÖY", "ÜSKÜDAR", "BEYOĞLU", "KARAKÖY", "EMİNÖNÜ", "BAYRAMPAŞA",
        "GAZİOSMANPAŞA", "ISPARTAKULE", "BAHÇEŞEHİR", "KÜÇÜKÇEKMECE", "BÜYÜKÇEKMECE",
        "AVCILAR", "BAĞCILAR", "GÜNGÖREN"
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

    // Lokasyon bulunamadıysa ama fiyat ve telefon varsa yine de kaydet (Genel İş)
    const from_loc = foundLocations[0]?.name || "Bilinmeyen Konum";
    const to_loc = foundLocations[1]?.name || "Bilinmeyen Konum";

    if (phone && (foundLocations.length > 0 || price !== "Belirtilmedi")) {
        return {
            from_loc,
            to_loc,
            price: price.toUpperCase(),
            time,
            phone
        };
    }

    return null;
}
