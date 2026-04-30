"use client";

import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
    const [proxyMode, setProxyMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/settings", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setProxyMode(data.proxy_message_mode);
            }
        } catch (error) {
            console.error("Settings fetch failed", error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (newProxyMode: boolean) => {
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            await fetch("/api/admin/settings", {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ proxy_message_mode: newProxyMode })
            });
        } catch (err) {
            alert("Kayıt başarısız");
        } finally {
            setSaving(false);
        }
    };

    const toggleProxyMode = () => {
        const newValue = !proxyMode;
        setProxyMode(newValue);
        saveSettings(newValue);
    };

    if (loading) return <div className="p-8 text-center text-app-muted">Yükleniyor...</div>;

    return (
        <div className="fade-in max-w-4xl">
            <h1 className="text-3xl font-bold text-app-fg mb-8">⚙️ Admin Ayarları</h1>

            <div className="bg-app-card rounded-xl border border-app-border p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-app-fg mb-2">📩 Proxy Mesaj Modu</h3>
                        <p className="text-sm text-app-muted mb-4">
                            Bu mod açıkken, WhatsApp bağlantısı olmayan şoförler de işlere "OK" mesajı atabilir.
                            Mesaj admin WhatsApp hesabından gönderilir ve şoför bilgileri (isim, telefon, plaka) otomatik eklenir.
                        </p>

                        <div className="bg-app-bg/50 p-4 rounded-lg border border-app-border/60 space-y-3">
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">✅</span>
                                <div className="text-xs text-app-muted">
                                    <strong>Açık:</strong> Şoförün WA bağlıysa kendi hesabından, değilse admin hesabından mesaj gider (şoför bilgileriyle birlikte)
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-red-400 mt-0.5">❌</span>
                                <div className="text-xs text-app-muted">
                                    <strong>Kapalı:</strong> Sadece WhatsApp bağlantısı olan şoförler OK mesajı atabilir
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <div className="text-xs text-blue-300 font-bold mb-1">💡 Mesaj Formatı (Proxy Modunda)</div>
                            <div className="text-[11px] text-app-muted font-mono bg-app-bg/50 p-2 rounded whitespace-pre-line">
                                ✅ Araç hazır!<br />
                                <br />
                                📍 Sabiha Gökçen → Taksim<br />
                                💰 1200₺<br />
                                🕐 HAZIR<br />
                                <br />
                                ━━━━━━━━━━━━━━━━<br />
                                Şoför: Mehmet Yılmaz<br />
                                📞 0532 123 45 67<br />
                                🚗 Plaka: 34 ABC 123
                            </div>
                        </div>
                    </div>

                    <div className="ml-6 flex flex-col items-center">
                        <div className="text-xs font-black text-app-subtle uppercase tracking-widest mb-2">
                            {proxyMode ? 'AÇIK' : 'KAPALI'}
                        </div>
                        <button
                            onClick={toggleProxyMode}
                            disabled={saving}
                            className={`w-16 h-9 rounded-full transition-all relative ${proxyMode ? 'bg-green-500' : 'bg-app-elevated'} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className={`w-7 h-7 bg-white rounded-full absolute top-1 transition-all ${proxyMode ? 'right-1' : 'left-1'}`} />
                        </button>
                        {saving && (
                            <div className="text-xs text-app-subtle mt-2">Kaydediliyor...</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <div className="text-sm font-bold text-amber-300 mb-1">Önemli Uyarı</div>
                        <div className="text-xs text-app-muted">
                            Proxy mod açıkken şoförlerin profil bilgilerini (telefon ve plaka) eksiksiz doldurması gerekir.
                            Aksi takdirde müşteriye gönderilen mesajda "Belirtilmedi" yazacaktır.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
