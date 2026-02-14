'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DriverWhatsAppPage() {
    const router = useRouter();
    const [status, setStatus] = useState({ isConnected: false, isConnecting: false, qrCode: null });
    const [actionLoading, setActionLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp/status?instanceId=main');
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (e) {
            console.error('Status fetch error:', e);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleConnect = async () => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/whatsapp/connect?instanceId=main', { method: 'POST' });
            if (res.ok) {
                setTimeout(fetchStatus, 1000);
            }
        } catch (e) {
            console.error('Connect error:', e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setActionLoading(true);
        try {
            await fetch('/api/whatsapp/disconnect?instanceId=main', { method: 'POST' });
            setStatus({ isConnected: false, isConnecting: false, qrCode: null });
        } catch (e) {
            console.error('Disconnect error:', e);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="fade-in max-w-2xl mx-auto">
            <div className="mb-8">
                <button
                    onClick={() => router.push('/dashboard/driver')}
                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold"
                >
                    ← Geri Dön
                </button>
            </div>

            <div className="bg-slate-800 rounded-[2.5rem] border border-white/5 p-10 shadow-2xl relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 pointer-events-none"></div>

                {/* Header */}
                <div className="relative mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4 shadow-lg shadow-green-900/50">
                        <span className="text-4xl">📱</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">WhatsApp Bağlantısı</h1>
                    <p className="text-slate-400 text-sm font-medium">Kendi WhatsApp hesabınızı bağlayarak gruplarınızdan iş yakalayın</p>
                </div>

                {/* Connection Status */}
                <div className="flex flex-col items-center justify-center mb-10">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 transition-all duration-500 ${status.isConnected ? 'bg-green-500/20 border-2 border-green-500 shadow-lg shadow-green-900/50 animate-pulse' :
                            status.isConnecting ? 'bg-yellow-500/20 border-2 border-yellow-500 shadow-lg shadow-yellow-900/50 animate-spin' :
                                'bg-slate-700/50 border-2 border-slate-600'
                        }`}>
                        {status.isConnected ? '✓' : status.isConnecting ? '⟳' : '○'}
                    </div>
                    <div className={`text-lg font-black tracking-tight ${status.isConnected ? 'text-green-400' :
                            status.isConnecting ? 'text-yellow-400' :
                                'text-slate-500'
                        }`}>
                        {status.isConnected ? 'BAĞLANDI' : status.isConnecting ? 'BAĞLANIYOR...' : 'BAĞLI DEĞİL'}
                    </div>
                </div>

                {/* QR Code Section */}
                {status.qrCode && !status.isConnected && (
                    <div className="text-center mb-10 animate-in fade-in zoom-in duration-700">
                        <div className="inline-block p-6 bg-white rounded-3xl shadow-2xl mb-6">
                            <img src={status.qrCode} alt="QR Code" className="w-64 h-64" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-white font-bold text-lg">📱 WhatsApp'ı Aç</p>
                            <p className="text-slate-400 text-sm">Ayarlar → Bağlı Cihazlar → Cihaz Bağla</p>
                            <p className="text-slate-500 text-xs mt-4">QR kod 60 saniye içinde yenilenir</p>
                        </div>
                    </div>
                )}

                {/* Connected State */}
                {status.isConnected && (
                    <div className="text-center mb-10 p-10 bg-green-500/5 rounded-[2rem] border border-green-500/10 relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem]"></div>
                        <div className="relative">
                            <div className="text-5xl mb-4">🎉</div>
                            <p className="text-green-400 font-black text-xl mb-2">Bağlantı Başarılı!</p>
                            <p className="text-slate-400 text-sm">WhatsApp hesabınız aktif. Artık gruplarınızdan otomatik iş yakalayabilirsiniz.</p>
                            <div className="mt-6 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                                <p className="text-xs text-slate-500 mb-2">✨ Aktif Özellikler:</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-bold border border-green-500/20">Otomatik İş Yakalama</span>
                                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold border border-blue-500/20">Grup Keşfi</span>
                                    <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-xs font-bold border border-purple-500/20">Anlık Bildirim</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Idle State */}
                {!status.isConnected && !status.isConnecting && !status.qrCode && (
                    <div className="text-center mb-10 py-10 opacity-60">
                        <div className="text-6xl mb-4">📴</div>
                        <p className="text-slate-400 font-bold">Bağlantı bekleniyor...</p>
                        <p className="text-slate-600 text-sm mt-2">Başlamak için aşağıdaki butona tıklayın</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-4">
                    {!status.isConnected && !status.isConnecting && (
                        <button
                            onClick={handleConnect}
                            disabled={actionLoading}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl shadow-lg shadow-green-900/30 active:scale-95 transition-all text-sm uppercase tracking-widest"
                        >
                            {actionLoading ? '⟳ HAZIRLANIYOR...' : '🚀 WHATSAPP BAĞLA'}
                        </button>
                    )}

                    {(status.isConnected || status.isConnecting || status.qrCode) && (
                        <button
                            onClick={handleDisconnect}
                            disabled={actionLoading}
                            className="w-full bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 font-black py-5 rounded-2xl border-2 border-red-500/30 hover:border-red-500/50 active:scale-95 transition-all text-sm uppercase tracking-widest"
                        >
                            {actionLoading ? '⟳ İŞLENİYOR...' : '🔌 BAĞLANTIYI KES'}
                        </button>
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-8 p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                    <p className="text-blue-400 font-bold text-sm mb-2">ℹ️ Bilgi</p>
                    <ul className="text-slate-400 text-xs space-y-2">
                        <li>• WhatsApp hesabınızı bağladığınızda, gruplarınızdan gelen işler otomatik olarak yakalanır</li>
                        <li>• Gruplarınızdaki yeni grup linkleri otomatik keşfedilir ve sisteme eklenir</li>
                        <li>• Bağlantınız 7/24 aktif kalır, telefon kapalı olsa bile işler yakalanmaya devam eder</li>
                        <li>• Güvenlik: Mesajlarınız sadece iş tespiti için işlenir, hiçbir veri saklanmaz</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
