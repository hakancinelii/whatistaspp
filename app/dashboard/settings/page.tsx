"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const [user, setUser] = useState<any>(null);
    const [settings, setSettings] = useState<any>({ min_delay: 5, night_mode: true });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
    });

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem("token");
            if (token) {
                try {
                    const decoded = JSON.parse(atob(token.split(".")[1]));
                    setUser(decoded);
                    setFormData({ name: decoded.name, email: decoded.email });

                    // Fetch settings from API
                    const res = await fetch('/api/settings', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const data = await res.json();
                    if (!data.error) {
                        setSettings({
                            min_delay: data.min_delay || 5,
                            night_mode: !!data.night_mode
                        });
                    }
                } catch (e) { }
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    min_delay: parseInt(settings.min_delay),
                    night_mode: settings.night_mode,
                    name: formData.name
                })
            });

            if (res.ok) {
                alert("✅ Ayarlarınız başarıyla güncellendi!");
                // Update local storage token name if needed (optional)
            }
        } catch (error) {
            alert("❌ Ayarlar kaydedilirken bir hata oluştu.");
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-app-fg">Yükleniyor...</div>;

    return (
        <div className="fade-in max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-app-fg mb-2">⚙️ Ayarlar</h1>
            <p className="text-app-muted mb-8">Profil bilgilerinizi ve hesap ayarlarınızı buradan yönetebilirsiniz.</p>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Profile Overview Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-app-card p-6 rounded-2xl border border-app-border text-center">
                        <div className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold border-4 border-app-border shadow-xl">
                            {formData.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <h2 className="text-xl font-bold text-app-fg mb-1">{formData.name}</h2>
                        <p className="text-sm text-app-subtle mb-4">{formData.email}</p>
                        <div className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${user?.package === 'platinum' ? 'bg-purple-500 text-white' :
                            user?.package === 'gold' ? 'bg-yellow-500 text-slate-900' :
                                'bg-blue-500 text-white'
                            }`}>
                            {user?.package || "Standard"} PAKET
                        </div>
                    </div>

                    <div className="bg-app-card p-6 rounded-2xl border border-app-border">
                        <h3 className="text-xs font-black text-app-subtle uppercase tracking-widest mb-4">Üyelik Bilgisi</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-app-muted">Kredi Bakiyesi:</span>
                                <span className="text-app-fg font-bold">{user?.credits || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-app-muted">Durum:</span>
                                <span className="text-green-400 font-bold">Aktif</span>
                            </div>
                        </div>
                        <button className="w-full mt-6 py-3 bg-app-elevated hover:bg-app-elevated text-app-fg text-xs font-bold rounded-xl transition uppercase tracking-widest">
                            Paketi Yükselt
                        </button>
                    </div>
                </div>

                {/* Form Section */}
                <div className="md:col-span-2 space-y-8">
                    {/* General Info */}
                    <div className="bg-app-card p-8 rounded-3xl border border-app-border shadow-xl">
                        <h3 className="text-xl font-bold text-app-fg mb-6">Profil Bilgileri</h3>
                        <div className="space-y-6">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-app-subtle mb-2 uppercase tracking-widest">Ad Soyad</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-fg focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-app-subtle mb-2 uppercase tracking-widest">E-Posta Adresi</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        disabled
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-subtle cursor-not-allowed outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Application Settings (Restored) */}
                    <div className="bg-app-card p-8 rounded-3xl border border-app-border shadow-xl">
                        <h3 className="text-xl font-bold text-app-fg mb-6">Uygulama Ayarları</h3>
                        <div className="grid sm:grid-cols-2 gap-8">
                            <div className="p-4 bg-app-surface/70 rounded-2xl border border-app-border">
                                <h4 className="font-bold text-app-fg text-sm mb-2">Arayüz Teması</h4>
                                <p className="text-xs text-app-muted mb-3">Panel görünümünü aydınlık, karanlık veya sistem tercihine göre ayarla.</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['light', 'dark', 'system'] as const).map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setTheme(option)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${theme === option
                                                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20'
                                                : 'bg-app-card text-app-muted border-app-border hover:text-app-fg hover:border-purple-400'
                                                }`}
                                        >
                                            {option === 'light' ? 'Aydınlık' : option === 'dark' ? 'Karanlık' : 'Sistem'}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-app-subtle mt-2">Aktif görünüm: {resolvedTheme === 'dark' ? 'Karanlık' : 'Aydınlık'}</p>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-app-surface/70 rounded-2xl border border-app-border">
                                <div>
                                    <h4 className="font-bold text-app-fg text-sm">Gece Gönderim Koruması</h4>
                                    <p className="text-xs text-app-muted mt-1">Gece saatlerinde toplu gönderimi bekletir; tema rengini değiştirmez.</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input
                                        type="checkbox"
                                        title="Gece gönderim koruması"
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-6 border-purple-500"
                                        checked={settings.night_mode}
                                        onChange={(e) => setSettings({ ...settings, night_mode: e.target.checked })}
                                    />
                                    <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.night_mode ? 'bg-purple-500' : 'bg-app-elevated'}`}></label>
                                </div>
                            </div>

                            <div className="p-4 bg-app-surface/70 rounded-2xl border border-app-border">
                                <label className="block text-xs font-bold text-app-subtle mb-2 uppercase tracking-widest">Mesaj Gönderim Gecikmesi</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="1"
                                        max="300"
                                        value={settings.min_delay}
                                        onChange={(e) => setSettings({ ...settings, min_delay: parseInt(e.target.value) || 5 })}
                                        className="w-20 bg-app-card border border-app-border rounded-xl px-3 py-2 text-app-fg font-mono text-center focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                    <span className="text-sm text-app-muted">saniye</span>
                                </div>
                                <p className="text-xs text-app-subtle mt-2">Daha güvenli gönderim için mesajlar arası bekleme.</p>
                            </div>
                        </div>

                        <div className="flex justify-end mt-8">
                            <button
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="px-10 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-2xl transition hover:scale-105 active:scale-95 shadow-xl shadow-purple-600/30 disabled:opacity-50"
                            >
                                {saving ? "Kaydediliyor..." : "AYARLARI KAYDET"}
                            </button>
                        </div>
                    </div>

                    {/* Change Password */}
                    <div className="bg-app-card p-8 rounded-3xl border border-app-border shadow-xl">
                        <h3 className="text-xl font-bold text-app-fg mb-6">Şifre Değiştir</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-app-subtle mb-2 uppercase tracking-widest">Mevcut Şifre</label>
                                <input
                                    type="password"
                                    className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-fg focus:ring-2 focus:ring-purple-500 outline-none transition"
                                />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-app-subtle mb-2 uppercase tracking-widest">Yeni Şifre</label>
                                    <input
                                        type="password"
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-fg focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-app-subtle mb-2 uppercase tracking-widest">Yeni Şifre (Tekrar)</label>
                                    <input
                                        type="password"
                                        className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-fg focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button className="px-8 py-3 bg-app-elevated hover:bg-app-elevated text-app-fg font-bold rounded-xl transition-all">
                                    Şifreyi Güncelle
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
