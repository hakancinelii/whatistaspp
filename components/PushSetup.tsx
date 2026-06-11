"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

async function doSubscribe(): Promise<{ ok: boolean; reason?: string }> {
    if (typeof window === "undefined") return { ok: false, reason: "no-window" };
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return { ok: false, reason: "unsupported" };
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return { ok: false, reason: "no-vapid" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid),
        });
    }

    const res = await apiFetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, userAgent: navigator.userAgent }),
    });
    if (!res.ok) return { ok: false, reason: "save-failed" };
    return { ok: true };
}

/**
 * Bildirim aboneliğini yönetir. İzin zaten verilmişse sessizce abone olur;
 * verilmemişse sağ altta bir "Bildirimleri Aç" butonu gösterir.
 */
export default function PushSetup() {
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

        if (Notification.permission === "granted") {
            // İzin var: arka planda (sessizce) abone ol / aboneliği tazele
            doSubscribe().catch(() => { });
            setShow(false);
        } else if (Notification.permission === "default") {
            // Henüz sorulmamış: butonu göster (izin istemek kullanıcı etkileşimi gerektirir)
            setShow(true);
        }
    }, []);

    const handleEnable = async () => {
        setBusy(true);
        try {
            const r = await doSubscribe();
            if (r.ok || r.reason === "denied") setShow(false);
        } finally {
            setBusy(false);
        }
    };

    if (!show) return null;

    return (
        <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-purple-700 disabled:opacity-60"
        >
            🔔 {busy ? "Açılıyor…" : "Bildirimleri Aç"}
        </button>
    );
}
