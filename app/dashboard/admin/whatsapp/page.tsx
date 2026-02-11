"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function AdminWhatsAppBotPage() {
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

    // This instance is specifically for the gathering bot
    const instanceId = 'gathering';

    const fetchStatus = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/whatsapp/status?instanceId=${instanceId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                if (loading) setLoading(false);
            }
        } catch (error) {
            console.error("Failed to fetch status:", error);
        }
    }, [loading, instanceId]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleConnect = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        setStatus(prev => ({ ...prev, isConnecting: true, qrCode: null }));

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/whatsapp/connect?instanceId=${instanceId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                setTimeout(fetchStatus, 1000);
            }
        } catch (error) {
            console.error("Failed to connect:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("Bu bot cihazının bağlantısını kesmek istediğinize emin misiniz?")) return;

        setActionLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/whatsapp/disconnect?instanceId=${instanceId}`, {
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
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-green-500/10 p-3 rounded-2xl">
                    <span className="text-3xl">🤖</span>
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Grup Toplayıcı Bot</h1>
                    <p className="text-slate-400 text-sm">2. WhatsApp Cihaz Yönetimi (Sadece Admin)</p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-[2.5rem] border border-white/5 p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[100px] -mr-32 -mt-32"></div>

                {/* Connection Status */}
                <div className="flex flex-col items-center justify-center mb-10">
                    <div className="flex items-center bg-black/20 px-6 py-3 rounded-2xl border border-white/5">
                        <div
                            className={`w-3 h-3 rounded-full mr-3 transition-colors duration-500 ${status.isConnected
                                ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]"
                                : status.isConnecting
                                    ? "bg-yellow-500 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.6)]"
                                    : "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                                }`}
                        ></div>
                        <span
                            className={`text-sm font-black uppercase tracking-widest ${status.isConnected
                                ? "text-green-400"
                                : status.isConnecting
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                }`}
                        >
                            {status.isConnected
                                ? "BOT AKTİF"
                                : status.isConnecting
                                    ? "BAĞLANIYOR..."
                                    : "BOT DEVRE DIŞI"}
                        </span>
                    </div>
                </div>

                {/* QR Code Section */}
                {status.qrCode && !status.isConnected && (
                    <div className="text-center mb-10 animate-in fade-in zoom-in duration-700">
                        <div className="mb-8 p-8 bg-white rounded-[2rem] inline-block shadow-2xl relative group">
                            <div className="absolute inset-0 bg-green-500/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src={status.qrCode}
                                alt="WhatsApp QR Code"
                                className="w-64 h-64 relative z-10"
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold border border-blue-500/20">
                                <span>📱</span>
                                <span>BAĞLI CİHAZ OLARAK EKLEYİN</span>
                            </div>
                            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                                Bu cihazın amacı sadece <strong>kendi bulunduğu gruplardaki</strong> iş mesajlarını yakalayıp sisteme aktarmaktır.
                            </p>
                        </div>
                    </div>
                )}

                {/* Connected State */}
                {status.isConnected && (
                    <div className="text-center mb-10 p-10 bg-green-500/5 rounded-[2rem] border border-green-500/10 relative group">
                        <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform duration-500">🛡️</div>
                        <h3 className="text-green-400 text-2xl font-black mb-3">SİSTEM KORUMADA</h3>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                            Bot şu an aktif ve grupları dinliyor. Yakalanan her iş anında şoför ekranına düşecektir.
                        </p>
                    </div>
                )}

                {/* Idle State */}
                {!status.isConnected && !status.isConnecting && !status.qrCode && (
                    <div className="text-center mb-10 py-10 opacity-60">
                        <div className="text-6xl mb-6">🔌</div>
                        <p className="text-slate-400 font-medium">
                            Grup toplayıcı bot bağlantısı kesik.
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-4">
                    {!status.isConnected && !status.isConnecting && (
                        <button
                            onClick={handleConnect}
                            disabled={actionLoading}
                            className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-900/40 disabled:opacity-50"
                        >
                            {actionLoading ? "HAZIRLANIYOR..." : "BOTU BAŞLAT VE QR ÜRET"}
                        </button>
                    )}

                    {(status.isConnected || status.isConnecting || status.qrCode) && (
                        <button
                            onClick={handleDisconnect}
                            disabled={actionLoading}
                            className="w-full py-5 bg-slate-700/50 text-red-400 font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-500/20 hover:text-red-400 transition-all disabled:opacity-50 border border-red-500/20"
                        >
                            {actionLoading ? "İŞLENİYOR..." : "BOT BAĞLANTISINI SIFIRLA"}
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <h4 className="text-white font-black text-[10px] uppercase tracking-widest mb-2 text-blue-400">NASIL ÇALIŞIR?</h4>
                    <p className="text-slate-500 text-xs leading-relaxed">
                        Bu hesabı bağladığınızda, hesabın üye olduğu tüm gruplar izlenmeye başlar. Mesajlardaki transfer işleri AI tarafından otomatik ayıklanır.
                    </p>
                </div>
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <h4 className="text-white font-black text-[10px] uppercase tracking-widest mb-2 text-purple-400">AVANTAJLAR</h4>
                    <p className="text-slate-500 text-xs leading-relaxed">
                        Kendi ana telefonunuzu bağlamanıza gerek kalmadan, boşta duran bir hattı sadece iş toplamak için kullanabilirsiniz.
                    </p>
                </div>
            </div>
        </div>
    );
}
