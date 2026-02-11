"use client";

import { useEffect, useState } from "react";

export default function DriverProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        name: "",
        email: "",
        driver_phone: "",
        driver_plate: "",
        profile_picture: null as string | null
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/profile", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch (error) {
            console.error("Profile fetch failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Dosya boyutu kontrolü (örn. 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert("❌ Dosya boyutu çok büyük (Maksimum 2MB)");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            setProfile(prev => ({ ...prev, profile_picture: base64String }));

            // Hemen kaydet
            try {
                const token = localStorage.getItem("token");
                await fetch("/api/profile", {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        profile_picture: base64String
                    })
                });
            } catch (err) {
                console.error("Fotoğraf kaydı başarısız", err);
            }
        };
        reader.readAsDataURL(file);
    };

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/profile", {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    driver_phone: profile.driver_phone,
                    driver_plate: profile.driver_plate
                })
            });

            if (res.ok) {
                alert("✅ Profil bilgileriniz kaydedildi!");
            } else {
                alert("❌ Kayıt başarısız");
            }
        } catch (err) {
            alert("❌ Bir hata oluştu");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Yükleniyor...</div>;

    return (
        <div className="fade-in max-w-2xl">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                <div className="relative group">
                    <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-slate-700 shadow-2xl relative">
                        <img
                            src={profile.profile_picture || "/android-chrome-512x512.png"}
                            alt="Profil"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                            <span className="text-white text-[10px] font-black uppercase tracking-widest text-center px-4">Fotoğrafı Değiştir</span>
                        </div>
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        title="Fotoğraf seç"
                    />
                    <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white p-2 rounded-xl shadow-lg">
                        📷
                    </div>
                </div>
                <div className="text-center md:text-left">
                    <h1 className="text-4xl font-black text-white mb-2">{profile.name}</h1>
                    <p className="text-slate-400 font-medium">Şoför bilgilerinizi buradan güncelleyebilirsiniz.</p>
                </div>
            </div>

            <form onSubmit={saveProfile}>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
                    {/* Genel Bilgiler */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Genel Bilgiler</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                    Ad Soyad
                                </label>
                                <input
                                    type="text"
                                    value={profile.name}
                                    disabled
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                    E-Posta
                                </label>
                                <input
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Şoför Bilgileri */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">🚗 Şoför Bilgileri</h3>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                            <div className="text-xs text-blue-300">
                                💡 <strong>Önemli:</strong> Bu bilgiler, WhatsApp bağlantınız olmadan iş aldığınızda müşteriye gönderilir.
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                    📞 Telefon Numarası
                                </label>
                                <input
                                    type="text"
                                    value={profile.driver_phone}
                                    onChange={(e) => setProfile({ ...profile, driver_phone: e.target.value })}
                                    placeholder="0532 123 45 67"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                    🚗 Plaka
                                </label>
                                <input
                                    type="text"
                                    value={profile.driver_plate}
                                    onChange={(e) => setProfile({ ...profile, driver_plate: e.target.value })}
                                    placeholder="34 ABC 123"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition uppercase"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Kaydet Butonu */}
                    <div className="flex justify-end pt-4 border-t border-slate-700">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl transition hover:scale-105 active:scale-95 shadow-xl shadow-purple-600/30 disabled:opacity-50"
                        >
                            {saving ? "Kaydediliyor..." : "KAYDET"}
                        </button>
                    </div>
                </div>
            </form>

            {/* Mesaj Önizleme */}
            <div className="mt-6 bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">📩 Mesaj Önizleme</h3>
                <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5">
                    <div className="text-xs text-slate-400 mb-2">Müşteriye gönderilecek mesaj (örnek):</div>
                    <div className="text-sm text-white font-mono bg-slate-900 p-3 rounded whitespace-pre-line">
                        ✅ Araç hazır!<br />
                        <br />
                        📍 Sabiha Gökçen → Taksim<br />
                        💰 1200₺<br />
                        🕐 HAZIR<br />
                        <br />
                        ━━━━━━━━━━━━━━━━<br />
                        Şoför: {profile.name || 'Belirtilmedi'}<br />
                        📞 {profile.driver_phone || 'Belirtilmedi'}<br />
                        {profile.driver_plate && `🚗 Plaka: ${profile.driver_plate}`}
                    </div>
                </div>
            </div>
        </div>
    );
}
