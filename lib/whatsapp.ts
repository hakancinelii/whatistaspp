import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, downloadMediaMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import qrcode from 'qrcode';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { tryGemini } from './ai';
import * as dbLib from './db';

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

    if (!force && session.isConnected && session.sock) {
        setupMessageListeners(userId, session.sock, instanceId);
        return;
    }

    const now = Date.now();
    if (!force && session.isConnecting && session.lastAttempt && (now - session.lastAttempt < 15000)) return;

    session.isConnecting = true;
    session.lastAttempt = now;

    try {
        const authDir = path.join(process.cwd(), 'data', 'auth_info', `user_${sessionKey}`);
        if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        let version: [number, number, number] = [2, 3000, 1015901307];
        try { const latest = await fetchLatestBaileysVersion(); if (latest.version) version = latest.version; } catch (vErr) { }

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
            shouldSyncHistoryMessage: () => false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            generateHighQualityLinkPreview: false,
            markOnlineOnConnect: false,
            getMessage: async (key: any) => { return { conversation: "" } }
        });

        session.sock = sock;
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const db = await dbLib.getDatabase();
            if (qr) {
                session.qrCode = await qrcode.toDataURL(qr);
                await db.run('INSERT INTO whatsapp_sessions (user_id, session_id, qr_code, is_connected) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET qr_code = ?, is_connected = 0', [userId, sessionKey, session.qrCode, 0, session.qrCode]).catch(() => { });
            }
            if (connection === 'close') {
                const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
                session.isConnected = false; session.isConnecting = false; session.qrCode = null;
                await db.run('INSERT INTO whatsapp_sessions (user_id, session_id, is_connected, qr_code) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET is_connected = 0, qr_code = NULL', [userId, sessionKey, 0, null]).catch(() => { });
                if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 405) {
                    session.sock = null; if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true }); sessions.delete(sessionKey);
                }
            } else if (connection === 'open') {
                session.isConnected = true; session.isConnecting = false; session.qrCode = null;
                await db.run('INSERT INTO whatsapp_sessions (user_id, session_id, is_connected, qr_code, last_connected) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET is_connected = 1, qr_code = NULL, last_connected = CURRENT_TIMESTAMP', [userId, sessionKey, 1, null]).catch(() => { });
            }
        });

        setupMessageListeners(userId, sock, instanceId);
    } catch (error) { session.isConnecting = false; }
}

const groupMetadataCache = new Map<string, { subject: string, timestamp: number }>();
const userCache = new Map<number, { role: string, package: string, timestamp: number }>();

function setupMessageListeners(userId: number, sock: any, instanceId: string = 'main') {
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
                if (cached && (Date.now() - cached.timestamp < 3600000)) groupName = cached.subject;
                else { try { const metadata = await sock.groupMetadata(fromJid); groupName = metadata.subject; groupMetadataCache.set(fromJid, { subject: groupName, timestamp: Date.now() }); } catch (err) { } }
            }

            try {
                const db = await dbLib.getDatabase();
                let dbUser = await db.get('SELECT role, package FROM users WHERE id = ?', [userId]);
                const isDriverPackage = dbUser?.package === 'driver' || dbUser?.role === 'admin';
                
                let text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
                
                if (isGroup && isDriverPackage && text) {
                    const job = await parseTransferJob(text);
                    if (job) {
                        const senderJid = msg.key.participant || fromJid;
                        let finalPhone = job.phone === "Belirtilmedi" ? senderJid.split('@')[0].split(':')[0] : job.phone;
                        await db.run('INSERT INTO captured_jobs (user_id, instance_id, group_jid, group_name, sender_jid, from_loc, to_loc, price, time, phone, raw_message, is_high_reward, is_swap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [userId, instanceId, fromJid, groupName, senderJid, job.from_loc, job.to_loc, job.price, job.time, finalPhone, text, job.is_high_reward ? 1 : 0, job.is_swap ? 1 : 0]);
                        const { runJobAutomation } = await import('./job_automation');
                        runJobAutomation(userId).catch(() => {});
                    }
                }

                if (!isFromMe && text) {
                    await db.run('INSERT INTO incoming_messages (user_id, phone_number, name, content) VALUES (?, ?, ?, ?)', [userId, from, msg.pushName || 'Bilinmeyen', text]);
                }
            } catch (err) { }
        }
    });
}

export async function sendMessage(userId: number, to: string, message: string, options?: any): Promise<boolean> {
    const session = await getSession(userId, options?.instanceId || 'main');
    if (!session.isConnected || !session.sock) return false;
    try { let jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`; await session.sock.sendMessage(jid, { text: message }); return true; } catch (e) { return false; }
}

export function initScheduler() { }

async function parseTransferJob(text: string) {
    const phoneRegex = /(?:\+90|0)?\s*\(?\s*5\d{2}\s*\)?[\s\.\-]*\d{3}[\s\.\-]*\d{2}[\s\.\-]*\d{2}/g;
    const phoneMatch = text.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : "Belirtilmedi";
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (apiKey) {
        try {
            const prompt = `Aşağıdaki WhatsApp mesajındaki transfer işini analiz et ve verileri ayıkla JSON olarak ver: {"from_loc": "...", "to_loc": "...", "price": "...", "time": "...", "is_high_reward": boolean, "is_swap": boolean} Mesaj: "${text}"`;
            const aiText = await tryGemini(prompt, apiKey);
            if (aiText) { const match = aiText.match(/\{[\s\S]*\}/); if (match) { const data = JSON.parse(match[0]); return { ...data, phone }; } }
        } catch (e) { }
    }
    return null; // AI yoksa veya bulamadıysa şimdilik null dön
}
