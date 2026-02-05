import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, downloadMediaMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';

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

export async function connectWhatsApp(userId: number): Promise<void> {
    const session = await getSession(userId);

    // If already connected, we refresh listeners to ensure HMR code updates are active
    if (session.isConnected && session.sock) {
        console.log(`[WA] User ${userId} already connected. Refreshing listeners for HMR...`);
        setupMessageListeners(userId, session.sock);
        return;
    }

    // Prevent spamming connection attempts
    const now = Date.now();
    if (session.isConnecting && session.lastAttempt && (now - session.lastAttempt < 15000)) {
        console.log(`[WA] Connection attempt already in progress for user ${userId}.`);
        return;
    }

    console.log(`[WA] 🚀 User ${userId}: Initiating connection...`);
    session.isConnecting = true;
    session.lastAttempt = now;
    session.qrCode = null;

    try {
        const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${userId}`);
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        let version: [number, number, number] = [2, 3000, 1019014164];
        try {
            const latest = await fetchLatestBaileysVersion();
            version = latest.version;
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
            browser: Browsers.macOS('Desktop'),
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });

        session.sock = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`[WA] 🔳 New QR generated for user ${userId}`);
                session.qrCode = await qrcode.toDataURL(qr);
                session.isConnecting = false;
            }

            if (connection === 'close') {
                const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
                console.log(`[WA] ❌ Connection closed for user ${userId}. Reason: ${reason}`);

                session.isConnected = false;
                session.isConnecting = false;
                session.qrCode = null;

                if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 405) {
                    session.sock = null;
                    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
                    sessions.delete(userId);
                }
            } else if (connection === 'open') {
                console.log(`[WA] ✅ User ${userId} connected successfully!`);
                session.isConnected = true;
                session.isConnecting = false;
                session.qrCode = null;
            }
        });

        // Arşivleme Durumu Senkronizasyonu
        sock.ev.on('chats.update', async (chats) => {
            for (const chat of chats) {
                if (chat.archived !== undefined && chat.id) {
                    const jid = chat.id.split('@')[0];
                    const isArchived = chat.archived ? 1 : 0;
                    try {
                        const { getDatabase } = require('./db');
                        const db = await getDatabase();
                        // Önce müşterinin var olduğundan emin ol, yoksa oluştur, sonra arşiv durumunu güncelle
                        await db.run('INSERT OR IGNORE INTO customers (user_id, phone_number, name) VALUES (?, ?, ?)', [userId, jid, chat.name || jid]);
                        await db.run(
                            'UPDATE customers SET is_archived = ? WHERE user_id = ? AND phone_number = ?',
                            [isArchived, userId, jid]
                        );
                        // Profil bilgisini çek
                        syncContactProfile(userId, sock, jid).catch(() => { });
                        console.log(`[WA] Chat ${jid} archive status updated: ${isArchived}`);
                    } catch (e) { }
                }
            }
        });

        sock.ev.on('chats.upsert', async (chats) => {
            for (const chat of chats) {
                if (chat.archived !== undefined && chat.id) {
                    const jid = chat.id.split('@')[0];
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

        const from = msg.key.remoteJid?.split('@')[0] || '';
        const isFromMe = msg.key.fromMe || false;

        console.log(`[WA] 📥 Message detected: ${from} (fromMe: ${isFromMe})`);

        let text = msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            msg.message.buttonsResponseMessage?.selectedDisplayText ||
            msg.message.listResponseMessage?.title || '';

        let mediaUrl = '';
        let mediaType = '';

        try {
            const { getDatabase } = require('./db');
            const db = await getDatabase();

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
            const statusData = await sock.fetchStatus(jid);
            status = statusData?.status;
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

    const authDir = path.join(process.cwd(), 'auth_info', `user_${userId}`);
    if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });

    sessions.delete(userId);
    console.log(`[WA] User ${userId} cleared.`);
}

export async function sendMessage(userId: number, to: string, message: string, options?: { mediaUrl?: string, mediaType?: string, mediaMimeType?: string, duration?: number }): Promise<boolean> {
    const session = await getSession(userId);
    if (!session.isConnected || !session.sock) return false;

    try {
        const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;

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
                        // Small natural delay between messages
                        await new Promise(resolve => setTimeout(resolve, 5000));
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

