"use client";

import { useEffect, useState } from "react";

interface DiscoveredGroup {
    id: number;
    invite_code: string;
    invite_link: string;
    found_by: string;
    created_at: string;
}

export default function GroupDiscovery() {
    const [groups, setGroups] = useState<DiscoveredGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState<number | null>(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/groups", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (error) {
            console.error("Fetch failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (id: number, code: string) => {
        if (!confirm("Bu gruba admin hesabınızla katılmak istiyor musunuz?")) return;

        setJoiningId(id);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/groups", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            const data = await res.json();
            if (res.ok) {
                alert("✅ Gruba başarıyla katıldınız!");
            } else {
                alert("❌ Hata: " + (data.error || "Katılma başarısız oldu. WhatsApp bağlantınızı kontrol edin."));
            }
        } catch (e: any) {
            alert("🚨 Sistem hatası: " + e.message);
        } finally {
            setJoiningId(null);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">🔍 Grup Keşfi</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Sistemdeki kullanıcıların mesajlarından otomatik olarak yakalanan WhatsApp iş grupları.
                    </p>
                </div>
                <button
                    onClick={async () => {
                        if (!confirm("Tüm gruplara sırayla katılmak istediğinize emin misiniz? Bu işlem biraz zaman alabilir.")) return;

                        setLoading(true); // Loading maskesi yerine buton durumu da kullanılabilir ama sayfa blocklansın istenebilir.
                        try {
                            const token = localStorage.getItem("token");
                            const res = await fetch("/api/admin/groups/join-all", {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const data = await res.json();

                            if (res.ok && data.success) {
                                alert(`✅ İşlem Tamamlandı!\nBaşarılı: ${data.stats.success}\nBaşarısız: ${data.stats.failed}`);
                                fetchGroups(); // Listeyi güncelle (gerekirse statü güncellemesi için)
                            } else {
                                alert("❌ Hata: " + (data.error || "Beklenmeyen bir hata oluştu."));
                            }
                        } catch (e: any) {
                            alert("🚨 Bağlantı hatası: " + e.message);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
                >
                    🚀 TÜM GRUPLARA KATIL
                </button>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-700">
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">Tarih</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">Davet Linki</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">Keşfeden</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {groups.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                                    Henüz keşfedilen bir grup davet linki bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            groups.map((group) => (
                                <tr key={group.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-400">
                                        {new Date(group.created_at).toLocaleString('tr-TR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-mono text-blue-400 truncate max-w-xs" title={group.invite_link}>
                                            {group.invite_link}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full font-bold">
                                            {group.found_by}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleJoin(group.id, group.invite_code)}
                                            disabled={joiningId === group.id}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${joiningId === group.id
                                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 active:scale-95'
                                                }`}
                                        >
                                            {joiningId === group.id ? 'KATILINIYOR...' : 'GRUBA KATIL ✅'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
