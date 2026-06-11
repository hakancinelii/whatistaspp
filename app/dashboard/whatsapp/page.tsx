"use client";

import { useEffect, useState, useCallback } from "react";
import { useVisiblePolling } from "@/lib/useVisiblePolling";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function WhatsAppPage() {
    const router = useRouter();
    const [status, setStatus] = useState<{
        isConnected: boolean;
        isConnecting: boolean;
        qrCode: string | null;
    }>({
        isConnected: false,
        isConnecting: false,
        qrCode: null,
    });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/whatsapp/status", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                // If we got real data, stop initial loading
                if (loading) setLoading(false);
            }
        } catch (error) {
            console.error("Failed to fetch status:", error);
        }
    }, [loading]);

    // Sayfa görünürken 3 sn'de bir durum kontrolü; arka planda durur.
    useVisiblePolling(fetchStatus, 3000);

    const handleConnect = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        // Optimistic UI update
        setStatus(prev => ({ ...prev, isConnecting: true, qrCode: null }));

        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/whatsapp/connect", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                // Refresh status immediately
                setTimeout(fetchStatus, 1000);
            }
        } catch (error) {
            console.error("Failed to connect:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("WhatsApp bağlantısını kesmek istediğinize emin misiniz?")) return;

        setActionLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/whatsapp/disconnect", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                setStatus({ isConnected: false, isConnecting: false, qrCode: null });
            }
        } catch (error) {
            console.error("Failed to disconnect:", error);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !status.qrCode && !status.isConnected) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="fade-in max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-app-fg mb-8">WhatsApp Bağla!</h1>

            <div className="bg-app-card rounded-xl border border-app-border p-8">
                {/* Connection Status */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="flex items-center mb-1">
                        <div
                            className={`w-4 h-4 rounded-full mr-3 transition-colors duration-500 ${status.isConnected
                                ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                : status.isConnecting
                                    ? "bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                                    : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                }`}
                        ></div>
                        <span
                            className={`text-lg font-medium transition-colors duration-500 ${status.isConnected
                                ? "text-green-400"
                                : status.isConnecting
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                }`}
                        >
                            {status.isConnected
                                ? "Cihaz Bağlı"
                                : status.isConnecting && status.qrCode
                                    ? "Bağlantı Kuruluyor..."
                                    : "Bağlı Değil"}
                        </span>
                    </div>
                    {status.isConnecting && !status.qrCode && (
                        <p className="text-app-muted text-sm animate-pulse mt-2">
                            WhatsApp ile güvenli kanal açılıyor, 5-10 saniye sürebilir...
                        </p>
                    )}
                </div>

                {/* QR Code Section */}
                {status.qrCode && !status.isConnected && (
                    <div className="text-center mb-8 animate-in fade-in zoom-in duration-500">
                        <p className="text-purple-400 font-bold mb-6 text-xl animate-bounce">
                            🚀 KAREKOD HAZIR!
                        </p>
                        <div className="inline-block bg-white p-6 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.3)] border-4 border-purple-500">
                            <img
                                src={status.qrCode}
                                alt="WhatsApp QR Code"
                                className="w-64 h-64"
                            />
                        </div>
                        <div className="mt-6 text-app-muted space-y-1">
                            <p>WhatsApp → Menü → Bağlı Cihazlar → Cihaz Bağla</p>
                            <p className="text-xs text-yellow-400 mt-3 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20">
                                💡 İpucu: Aynı telefondan giriyorsanız, QR kodun fotoğrafını başka bir telefonla çekin ve kendi telefonunuzla taratın.
                            </p>
                            <p className="text-xs text-app-subtle mt-2">Bu kod otomatik olarak yenilenir.</p>
                        </div>
                    </div>
                )}

                {/* Connected State */}
                {status.isConnected && (
                    <div className="text-center mb-8 bg-green-500/10 p-8 rounded-2xl border border-green-500/20">
                        <div className="text-6xl mb-4">✅</div>
                        <p className="text-green-400 text-2xl font-bold mb-2">
                            WhatsApp Bağlandı!
                        </p>
                        <p className="text-app-muted">
                            Artık sistem üzerinden mesaj gönderebilirsiniz.
                        </p>
                    </div>
                )}

                {/* Idle / Not Connected State */}
                {!status.isConnected && !status.isConnecting && !status.qrCode && (
                    <div className="text-center mb-8 py-10">
                        <div className="text-6xl mb-4">📱</div>
                        <p className="text-app-muted text-lg mb-2">
                            WhatsApp hesabınız henüz bağlı değil.
                        </p>
                        <p className="text-app-subtle text-sm">
                            Bağlantıyı başlatmak için aşağıdaki butona tıklayın.
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center gap-4 border-t border-app-border pt-8 mt-4">
                    {!status.isConnected && !status.isConnecting && (
                        <button
                            onClick={handleConnect}
                            disabled={actionLoading}
                            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                        >
                            {actionLoading ? "Hazırlanıyor..." : "Bağlantıyı Başlat"}
                        </button>
                    )}

                    {(status.isConnected || status.isConnecting || status.qrCode) && (
                        <button
                            onClick={handleDisconnect}
                            disabled={actionLoading}
                            className="px-6 py-3 bg-app-elevated/50 text-red-400 font-semibold rounded-lg hover:bg-red-500 hover:text-app-fg transition-all disabled:opacity-50 border border-red-500/20"
                        >
                            {actionLoading ? "Kesiliyor..." : "Bağlantıyı Kes / Sıfırla"}
                        </button>
                    )}

                    <button
                        onClick={() => router.push("/dashboard")}
                        className="px-6 py-3 bg-app-elevated text-app-fg font-semibold rounded-lg hover:bg-app-elevated transition"
                    >
                        Dashboard'a Dön
                    </button>
                </div>
            </div>

            {/* Help Card */}
            <div className="mt-8 bg-app-card/30 rounded-xl border border-app-border/50 p-6">
                <h2 className="text-lg font-semibold text-app-fg mb-4 flex items-center">
                    <span className="mr-2">💡</span> İpucu
                </h2>
                <p className="text-app-muted text-sm leading-relaxed">
                    Eğer karekod uzun süre gelmezse veya bağlantı hatası alırsanız,
                    <strong> "Bağlantıyı Kes / Sıfırla"</strong> butonuna basarak süreci tertemiz bir şekilde yeniden başlatabilirsiniz.
                </p>
            </div>
        </div>
    );
}
