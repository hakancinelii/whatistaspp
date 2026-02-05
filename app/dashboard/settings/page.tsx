"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const decoded = JSON.parse(atob(token.split(".")[1]));
                setUser(decoded);
                setFormData(prev => ({ ...prev, name: decoded.name, email: decoded.email }));
            } catch (e) { }
        }
        setLoading(false);
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        // Profil güncelleme API'si henüz yok, şimdilik UI simülasyonu
        setTimeout(() => {
            alert("✅ Profil bilgileriniz güncellendi!");
            setSaving(false);
        }, 1000);
    };

    if (loading) return <div className="p-8 text-white">Yükleniyor...</div>;

    return (
        <div className="fade-in max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-2">⚙️ Ayarlar</h1>
            <p className="text-gray-400 mb-8">Profil bilgilerinizi ve hesap ayarlarınızı buradan yönetebilirsiniz.</p>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Profile Overview Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center">
                        <div className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold border-4 border-slate-900 shadow-xl">
                            {user?.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">{user?.name}</h2>
                        <p className="text-sm text-gray-500 mb-4">{user?.email}</p>
                        <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user?.package === 'platinum' ? 'bg-purple-500 text-white' :
                            user?.package === 'gold' ? 'bg-yellow-500 text-slate-900' :
                                'bg-blue-500 text-white'
                            }`}>
                            {user?.package || "Standard"} PAKET
                        </div>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Üyelik Bilgisi</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Kredi Bakiyesi:</span>
                                <span className="text-white font-bold">{user?.credits || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Durum:</span>
                                <span className="text-green-400 font-bold">Aktif</span>
                            </div>
                        </div>
                        <button className="w-full mt-6 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition uppercase tracking-widest">
                            Paketi Yükselt
                        </button>
                    </div>
                </div>

                {/* Form Section */}
                <div className="md:col-span-2 space-y-8">
                    {/* General Info */}
                    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-6">Profil Bilgileri</h3>
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Ad Soyad</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">E-Posta Adresi</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        disabled
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50"
                                >
                                    {saving ? "Güncelleniyor..." : "Profil Güncelle"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Application Settings (Restored) */}
                    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-6">Uygulama Ayarları</h3>
                        <div className="grid sm:grid-cols-2 gap-8">
                            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                                <div>
                                    <h4 className="font-bold text-white text-sm">Gece Modu</h4>
                                    <p className="text-xs text-gray-500 mt-1">Koyu renkli tema kullan.</p>
                                </div>
                                <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input
                                        type="checkbox"
                                        name="toggle"
                                        id="theme-toggle"
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-6 border-purple-500"
                                        checked={true}
                                        readOnly
                                    />
                                    <label htmlFor="theme-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-purple-500 cursor-pointer"></label>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Mesaj Gönderim Gecikmesi</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        defaultValue="5"
                                        className="w-20 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white font-mono text-center focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                    <span className="text-sm text-gray-400">saniye</span>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">Daha güvenli gönderim için mesajlar arası bekleme.</p>
                            </div>
                        </div>
                    </div>

                    {/* Change Password */}
                    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
                        <h3 className="text-xl font-bold text-white mb-6">Şifre Değiştir</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Mevcut Şifre</label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                                />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Yeni Şifre</label>
                                    <input
                                        type="password"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Yeni Şifre (Tekrar)</label>
                                    <input
                                        type="password"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all">
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
