"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface DiscoveredGroup {
    id: number;
    invite_code: string;
    invite_link: string;
    found_by: string;
    created_at: string;
    is_joined?: boolean;
}

export default function GroupDiscovery() {
    const [groups, setGroups] = useState<DiscoveredGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState<number | null>(null);
    const [isJoiningAll, setIsJoiningAll] = useState(false);
    const [instanceId, setInstanceId] = useState<'main' | 'gathering'>('gathering');
    const [instanceStatus, setInstanceStatus] = useState<{ isConnected: boolean; isConnecting: boolean } | null>(null);

    useEffect(() => {
        fetchGroups();
        checkInstanceStatus();
    }, [instanceId]);

    const checkInstanceStatus = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch(`/api/whatsapp/status?instanceId=${instanceId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setInstanceStatus(await res.json());
            }
        } catch (e) { }
    };

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch(`/api/admin/groups?instanceId=${instanceId}`, {
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
            const res = await apiFetch("/api/admin/groups", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code, instanceId })
            });

            const data = await res.json();
            if (res.ok) {
                alert("✅ Gruba başarıyla katıldınız!");
                fetchGroups();
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-card p-6 rounded-[2rem] border border-app-border/60 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-4 rounded-3xl">
                        <span className="text-3xl">🔍</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-app-fg">Grup Keşfi</h1>
                        <p className="text-app-subtle text-sm mt-1">
                            Grupları hangi cihazla yönetmek istediğinizi seçin.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    {/* Instance Toggle */}
                    <div className="flex bg-black/20 p-1.5 rounded-2xl border border-app-border/60">
                        <button
                            onClick={() => setInstanceId('main')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${instanceId === 'main' ? 'bg-blue-600 text-white shadow-lg' : 'text-app-subtle hover:text-app-muted'}`}
                        >
                            Ana Cihaz
                        </button>
                        <button
                            onClick={() => setInstanceId('gathering')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${instanceId === 'gathering' ? 'bg-green-600 text-white shadow-lg' : 'text-app-subtle hover:text-app-muted'}`}
                        >
                            Bot (Gathering)
                        </button>
                    </div>

                    <div className="h-8 w-px bg-app-card/70 hidden md:block"></div>

                    {/* Connection Info */}
                    <div className="flex items-center gap-2 bg-app-bg/50 px-4 py-2 rounded-xl border border-app-border/60">
                        <div className={`w-2 h-2 rounded-full ${instanceStatus?.isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                        <span className="text-xs font-black text-app-muted uppercase tracking-widest">
                            {instanceId === 'main' ? 'Ana Cihaz' : 'Bot'} {instanceStatus?.isConnected ? 'Bağlı' : 'Bağlı Değil'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        if (!instanceStatus?.isConnected) {
                            alert(`❌ Seçilen cihaz (${instanceId === 'main' ? 'Ana Cihaz' : 'Bot'}) bağlı değil! Önce WhatsApp bağlantısını kurun.`);
                            return;
                        }
                        if (!confirm(`${instanceId === 'main' ? 'Ana Cihaz' : 'Bot'} cihazı ile tüm gruplara katılmak istediğinize emin misiniz?\n\nNot: Bu işlem arka planda çalışacaktır, lütfen bitene kadar bekleyin.`)) return;

                        setIsJoiningAll(true);
                        try {
                            const token = localStorage.getItem("token");
                            const res = await apiFetch("/api/admin/groups/join-all", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({ instanceId })
                            });
                            const data = await res.json();

                            if (res.ok && data.success) {
                                alert(`✅ İşlem Tamamlandı!\nBaşarılı: ${data.stats.success}\nBaşarısız: ${data.stats.failed}\nZaten Üye: ${data.stats.already_joined}`);
                                fetchGroups();
                            } else {
                                alert("❌ Hata: " + (data.error || "Beklenmeyen bir hata oluştu."));
                            }
                        } catch (e: any) {
                            alert("🚨 Bağlantı hatası: " + e.message);
                        } finally {
                            setIsJoiningAll(false);
                        }
                    }}
                    disabled={isJoiningAll}
                    className={`w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-95 text-white font-black px-8 py-4 rounded-2xl shadow-xl transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 ${isJoiningAll ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] shadow-blue-500/20'}`}
                >
                    {isJoiningAll ? (
                        <>
                            <div className="w-4 h-4 border-2 border-app-border/70 border-t-white rounded-full animate-spin"></div>
                            İşlem Yapılıyor...
                        </>
                    ) : (
                        <>🚀 TÜM GRUPLARA KATIL</>
                    )}
                </button>
            </div>

            <div className="bg-app-card rounded-2xl border border-app-border overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-app-bg/50 border-b border-app-border">
                            <th className="px-6 py-4 text-xs font-black text-app-subtle uppercase">Tarih</th>
                            <th className="px-6 py-4 text-xs font-black text-app-subtle uppercase">Davet Linki</th>
                            <th className="px-6 py-4 text-xs font-black text-app-subtle uppercase">Keşfeden</th>
                            <th className="px-6 py-4 text-xs font-black text-app-subtle uppercase text-center">Durum</th>
                            <th className="px-6 py-4 text-xs font-black text-app-subtle uppercase text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                        {groups.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-app-subtle font-medium">
                                    Henüz keşfedilen bir grup davet linki bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            groups.map((group: DiscoveredGroup) => (
                                <tr key={group.id} className={`transition-colors ${group.is_joined ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-app-elevated/30'}`}>
                                    <td className="px-6 py-4 text-sm text-app-muted">
                                        {new Date(group.created_at).toLocaleString('tr-TR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-mono text-blue-400 truncate max-w-xs" title={group.invite_link}>
                                            {group.invite_link}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs px-2 py-0.5 bg-app-elevated text-app-muted rounded-full font-bold">
                                            {group.found_by}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {group.is_joined ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-green-500/20 text-green-400 border border-green-500/30">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                                KATILDIN
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-app-elevated text-app-muted border border-app-border">
                                                <span className="w-1.5 h-1.5 rounded-full bg-app-subtle"></span>
                                                BEKLİYOR
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {group.is_joined ? (
                                            <button
                                                disabled
                                                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-app-card text-green-500/50 cursor-default border border-green-900/30 opacity-60"
                                            >
                                                ZATEN ÜYESİNİZ
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleJoin(group.id, group.invite_code)}
                                                disabled={joiningId === group.id}
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${joiningId === group.id
                                                    ? 'bg-app-elevated text-app-subtle cursor-not-allowed'
                                                    : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 active:scale-95'
                                                    }`}
                                            >
                                                {joiningId === group.id ? 'KATILINIYOR...' : 'GRUBA KATIL ✅'}
                                            </button>
                                        )}
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
