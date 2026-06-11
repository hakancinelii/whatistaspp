import webpush from "web-push";
import { getDatabase } from "./db";

/**
 * Web Push (VAPID) servisi.
 * Anahtarlar env'den okunur:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
 * Anahtar üretmek için:  npx web-push generate-vapid-keys
 */

let configured = false;

function ensureConfigured(): boolean {
    if (configured) return true;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@toplumesajpaneli.com.tr";
    if (!publicKey || !privateKey) {
        return false;
    }
    try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        configured = true;
        return true;
    } catch (e: any) {
        console.error("[Push] VAPID yapılandırma hatası:", e.message);
        return false;
    }
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}

/** Bir kullanıcının abonelik bilgisini kaydeder/günceller. */
export async function saveSubscription(
    userId: number,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string
) {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        throw new Error("Geçersiz abonelik verisi");
    }
    const db = await getDatabase();
    await db.run(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent`,
        [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent || null]
    );
}

/** Bir kullanıcının tüm cihazlarına push bildirimi gönderir. Ölü abonelikleri temizler. */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
    if (!ensureConfigured()) {
        console.warn("[Push] VAPID anahtarları ayarlı değil; bildirim atlanıyor.");
        return;
    }
    const db = await getDatabase();
    const subs = await db.all("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", [userId]);
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.all(
        subs.map(async (s: any) => {
            try {
                await webpush.sendNotification(
                    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                    body
                );
            } catch (err: any) {
                // 404/410: abonelik geçersiz → temizle
                if (err?.statusCode === 404 || err?.statusCode === 410) {
                    await db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint]).catch(() => { });
                } else {
                    console.error("[Push] Gönderim hatası:", err?.statusCode, err?.message);
                }
            }
        })
    );
}
