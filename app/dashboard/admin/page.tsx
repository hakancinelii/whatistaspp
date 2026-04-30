"use client";

import { useEffect, useState } from "react";

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    credits: number;
    package: string;
    plain_password?: string;
    is_connected?: number | boolean;
    is_online?: boolean;
    won_count?: number;
    called_count?: number;
    created_at: string;
    status?: 'active' | 'restricted' | 'banned';
    profile_picture?: string | null;
    driver_phone?: string;
}

interface Stats {
    totalUsers: number;
    onlineUsers: number;
    activeSessions: number;
    totalGroups?: number;
    joinedGroups?: number;
}

interface UserDetail {
    user: any;
    waSession: any;
    stats: {
        okMessages: number;
        wonJobs: number;
        ignoredJobs: number;
        totalEarnings: number;
    };
    recentInteractions: any[];
    filters: any;
}

const PACKAGES_LIST = [
    { id: 'standard', label: "Standart Paket", color: "bg-blue-500/20 text-blue-300" },
    { id: 'gold', label: "Gold Paket", color: "bg-yellow-500/20 text-yellow-300" },
    { id: 'platinum', label: "Platin Paket", color: "bg-purple-500/20 text-purple-300" },
    { id: 'driver', label: "Driver (Social Transfer)", color: "bg-green-500/20 text-green-300" },
];

const CREDIT_PACKAGES = [
    { label: "1.000 Kredi", value: 1000 },
    { label: "2.000 Kredi", value: 2000 },
    { label: "5.000 Kredi", value: 5000 },
    { label: "10.000 Kredi", value: 10000 },
    { label: "20.000 Kredi", value: 20000 },
];

export default function AdminPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedPackageUser, setSelectedPackageUser] = useState<User | null>(null);
    const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'users' | 'analytics'>('users');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);


    useEffect(() => {
        if (activeTab === 'users') fetchData();
        if (activeTab === 'analytics') fetchAnalytics();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/users", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
                setStats(data.stats);
            } else if (res.status === 401 || res.status === 403) {
                window.location.href = '/dashboard';
            }
        } catch (error) {
            console.error("Fetch failed", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserDetail = async (userId: number) => {
        setDetailLoading(true);
        setDetailUser(null);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.user) {
                    setDetailUser(data);
                } else {
                    alert("Kullanıcı verisi eksik.");
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                alert("Kullanıcı detayları alınamadı: " + (errData.error || "Sunucu hatası"));
            }
        } catch (error) {
            console.error("User detail fetch failed", error);
            alert("Sistem veya bağlantı hatası oluştu.");
        } finally {
            setDetailLoading(false);
        }
    };

    const addCredits = async (userId: number, amount: number) => {
        if (!confirm(`Kullanıcıya ${amount} kredi eklensin mi?`)) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/users", {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'add_credits', userId, amount })
            });

            if (res.ok) {
                fetchData();
                setSelectedUser(null);
            }
        } catch (err) {
            alert("İşlem başarısız");
        }
    };

    const setPackage = async (userId: number, packageName: string) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/users", {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'set_package', userId, packageName })
            });

            if (res.ok) {
                fetchData();
                setSelectedPackageUser(null);
            }
        } catch (err) {
            alert("Paket güncellenemedi");
        }
    };
    const makeAdmin = async (userId: number) => {
        if (!confirm("Bu kullanıcıyı Yönetici yapmak istediğinize emin misiniz?")) return;

        try {
            const token = localStorage.getItem("token");
            await fetch("/api/admin/users", {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'make_admin', userId })
            });
            fetchData();
        } catch (err) {
            alert("İşlem başarısız");
        }
    };

    const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/analytics", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setAnalyticsData(data);
            }
        } catch (error) {
            console.error("Analytics fetch failed", error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const handleStatusAction = async (userId: number, action: 'ban_user' | 'restrict_user' | 'unban_user') => {
        let msg = "";
        if (action === 'ban_user') msg = "Bu kullanıcıyı tamamen BANLAMAK istediğinize emin misiniz?";
        if (action === 'restrict_user') msg = "Bu kullanıcıyı KISITLAMAK (sadece izleme modu) istediğinize emin misiniz?";
        if (action === 'unban_user') msg = "Bu kullanıcının engelini KALDIRMAK istediğinize emin misiniz?";

        if (!confirm(msg)) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/users", {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, userId })
            });

            if (res.ok) {
                fetchData();
                setDetailUser(null);
            }
        } catch (err) {
            alert("İşlem başarısız");
        }
    };


    const changePassword = async (userId: number) => {
        const newPassword = prompt("Yeni şifreyi giriniz:");
        if (!newPassword || newPassword.length < 6) {
            if (newPassword) alert("Şifre en az 6 karakter olmalı!");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/admin/users", {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'change_password', userId, newPassword })
            });

            if (res.ok) {
                alert("Şifre başarıyla güncellendi.");
                fetchData();
            }
        } catch (err) {
            alert("İşlem başarısız");
        }
    };

    // Filtrelenmiş kullanıcılar
    const filteredUsers = users.filter(u => {
        if (statusFilter === 'active') return !!u.is_connected;
        if (statusFilter === 'inactive') return !u.is_connected;
        return true;
    });

    const activeCount = users.filter(u => !!u.is_connected).length;
    const inactiveCount = users.filter(u => !u.is_connected).length;

    if (loading) return <div className="p-8 text-center text-app-muted">Yükleniyor...</div>;

    return (
        <div className="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-app-fg tracking-tight flex items-center gap-3">
                        👑 Yönetim Paneli
                    </h1>
                    <p className="text-app-muted mt-2 font-medium">Sistem durumu ve kullanıcı yönetimi</p>
                </div>

                <div className="flex bg-app-card/50 p-1.5 rounded-2xl border border-app-border/50">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-app-muted hover:text-app-fg'}`}
                    >
                        👥 KULLANICILAR
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'analytics' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-app-muted hover:text-app-fg'}`}
                    >
                        📊 ANALİZLER
                    </button>
                </div>
            </div>

            {activeTab === 'users' ? (
                <>
                    {stats && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-app-card p-6 rounded-xl border border-app-border">
                                <div className="text-app-muted text-sm mb-1">Toplam Kullanıcı</div>
                                <div className="text-3xl font-bold text-app-fg">{stats.totalUsers}</div>
                            </div>
                            <div className="bg-app-card p-6 rounded-xl border border-app-border">
                                <div className="text-app-muted text-sm mb-1">Online Kullanıcı</div>
                                <div className="flex items-center gap-2">
                                    <div className="text-3xl font-bold text-blue-400">{stats.onlineUsers}</div>
                                    <span className="animate-pulse w-3 h-3 bg-blue-500 rounded-full"></span>
                                </div>
                            </div>
                            <div className="bg-app-card p-6 rounded-xl border border-app-border focus-within:ring-2 focus-within:ring-green-500/20 transition-all">
                                <div className="text-app-muted text-sm mb-1">Aktif Oturumlar (WA)</div>
                                <div className="text-3xl font-bold text-green-400">{stats.activeSessions}</div>
                            </div>
                            <div className="bg-app-card p-6 rounded-xl border border-app-border hover:border-blue-500/30 transition-all cursor-pointer group" onClick={() => window.location.href = '/dashboard/admin/groups'}>
                                <div className="flex justify-between items-start">
                                    <div className="text-app-muted text-sm mb-1 uppercase font-black tracking-widest text-xs">Keşfedilen Gruplar</div>
                                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                                </div>
                                <div className="text-3xl font-bold text-blue-400">{stats.totalGroups || 0}</div>
                            </div>
                            <div className="bg-app-card p-6 rounded-xl border border-app-border hover:border-green-500/30 transition-all cursor-pointer group" onClick={() => window.location.href = '/dashboard/admin/groups'}>
                                <div className="flex justify-between items-start">
                                    <div className="text-app-muted text-sm mb-1 uppercase font-black tracking-widest text-xs">Takip Edilen Gruplar</div>
                                    <span className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                                </div>
                                <div className="text-3xl font-bold text-green-400">{stats.joinedGroups || 0}</div>
                            </div>
                        </div>
                    )}

                    <div className="bg-app-card rounded-xl border border-app-border">
                        <div className="p-6 border-b border-app-border flex flex-col md:flex-row items-center justify-between gap-4">
                            <h2 className="text-xl font-bold text-app-fg">Tenant (Müşteri) Yönetimi</h2>

                            {/* Aktif / İnaktif Filtre */}
                            <div className="flex gap-2 p-1 bg-app-bg rounded-xl border border-app-border/60">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-app-subtle hover:text-app-muted'}`}
                                >
                                    TÜMÜ ({users.length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('active')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${statusFilter === 'active' ? 'bg-green-600 text-white shadow-lg' : 'text-app-subtle hover:text-app-muted'}`}
                                >
                                    🟢 AKTİF ({activeCount})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('inactive')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${statusFilter === 'inactive' ? 'bg-red-600 text-white shadow-lg' : 'text-app-subtle hover:text-app-muted'}`}
                                >
                                    ⚫ İNAKTİF ({inactiveCount})
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto min-h-[600px]">
                            <table className="w-full text-left">
                                <thead className="bg-app-bg/50 text-app-muted text-sm">
                                    <tr>
                                        <th className="p-4">Kullanıcı</th>
                                        <th className="p-4">Şifre</th>
                                        <th className="p-4">Mevcut Paket</th>
                                        <th className="p-4">Bakiye</th>
                                        <th className="p-4">Performans</th>
                                        <th className="p-4">İletişim</th>
                                        <th className="p-4">Durum</th>
                                        <th className="p-4 text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="text-app-muted hover:bg-app-elevated/30 transition cursor-pointer" onClick={() => fetchUserDetail(user.id)}>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden border border-app-border bg-app-elevated flex items-center justify-center">
                                                            <img
                                                                src={user.profile_picture || "/android-chrome-512x512.png"}
                                                                alt={user.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        {user.is_online && (
                                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-app-border rounded-full animate-pulse" title="Çevrimiçi"></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-app-fg">{user.name}</div>
                                                        <div className="text-xs text-app-subtle">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4" onClick={e => e.stopPropagation()}>
                                                <div className="text-xs font-mono text-app-muted bg-app-bg/50 px-2 py-1 rounded inline-block">
                                                    {user.plain_password || '********'}
                                                </div>
                                            </td>
                                            <td className="p-4 relative" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setSelectedPackageUser(selectedPackageUser?.id === user.id ? null : user)}
                                                    className={`px-3 py-1 rounded text-xs font-bold transition-all hover:scale-105 ${PACKAGES_LIST.find(p => p.id === user.package)?.color || 'bg-app-elevated text-app-muted'
                                                        }`}>
                                                    {user.package?.toUpperCase() || 'STANDARD'} ▾
                                                </button>

                                                {selectedPackageUser?.id === user.id && (
                                                    <div className="absolute left-4 top-12 z-30 w-48 bg-app-bg border border-app-border rounded-lg shadow-2xl p-2 animate-in fade-in zoom-in-95">
                                                        <div className="text-xs text-app-subtle mb-2 px-2">Paket Değiştir:</div>
                                                        {PACKAGES_LIST.map(pkg => (
                                                            <button
                                                                key={pkg.id}
                                                                onClick={() => setPackage(user.id, pkg.id)}
                                                                className={`w-full text-left px-3 py-2 text-sm rounded mb-1 hover:brightness-125 ${pkg.color}`}
                                                            >
                                                                {pkg.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono text-green-400">{user.credits.toLocaleString()}</div>
                                                <div className="text-xs text-app-subtle">Kredi</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-4">
                                                    <div>
                                                        <div className="text-xs font-bold text-green-400">{user.won_count || 0}</div>
                                                        <div className="text-[11px] text-app-subtle">Kazanılan</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-blue-400">{user.called_count || 0}</div>
                                                        <div className="text-[11px] text-app-subtle">Arama</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-xs font-bold text-app-muted">{user.driver_phone || 'Belirtilmedi'}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    {user.is_connected ? (
                                                        <span className="flex items-center gap-1.5 text-green-500 text-xs font-black uppercase bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20 w-fit">
                                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                            WA BAĞLI
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-app-subtle text-xs font-black uppercase bg-app-elevated/60 px-2 py-1 rounded-lg border border-app-border w-fit">
                                                            <span className="w-1.5 h-1.5 bg-app-subtle rounded-full" />
                                                            WA KOPUK
                                                        </span>
                                                    )}

                                                    {user.is_online ? (
                                                        <span className="flex items-center gap-1.5 text-blue-400 text-xs font-black uppercase bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 w-fit">
                                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                                            ONLINE
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-app-subtle px-2">Offline</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right relative" onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                                                        className="px-3 py-1 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600 hover:text-app-fg text-xs font-black uppercase tracking-wider transition-all"
                                                    >
                                                        Kredi
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusAction(user.id, user.status === 'restricted' ? 'unban_user' : 'restrict_user')}
                                                        className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${user.status === 'restricted' ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600' : 'bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600'} hover:text-app-fg`}
                                                    >
                                                        {user.status === 'restricted' ? 'Kısıtı Aç' : 'Kısıtla'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusAction(user.id, user.status === 'banned' ? 'unban_user' : 'ban_user')}
                                                        className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${user.status === 'banned' ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600' : 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600'} hover:text-app-fg`}
                                                    >
                                                        {user.status === 'banned' ? 'Ban Aç' : 'Banla'}
                                                    </button>
                                                </div>

                                                {selectedUser?.id === user.id && (
                                                    <div className="absolute right-0 top-12 z-20 w-48 bg-app-bg border border-app-border rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95">
                                                        <div className="grid grid-cols-1 gap-1">
                                                            {CREDIT_PACKAGES.map(pkg => (
                                                                <button
                                                                    key={pkg.value}
                                                                    onClick={() => addCredits(user.id, pkg.value)}
                                                                    className="w-full text-left px-3 py-2 text-xs font-black uppercase text-app-muted hover:bg-app-card rounded-lg flex justify-between group transition-all"
                                                                >
                                                                    <span>{pkg.label}</span>
                                                                    <span className="text-green-500">+</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {analyticsLoading ? (
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                        </div>
                    ) : analyticsData ? (
                        <>
                            {/* Analytics Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-app-card/40 p-6 rounded-[2rem] border border-app-border/60 space-y-2 backdrop-blur-sm">
                                    <span className="text-app-subtle font-black text-xs uppercase tracking-widest">Tüm Zamanlar İş</span>
                                    <div className="text-3xl font-black text-app-fg">{analyticsData.summary.total_jobs.toLocaleString()}</div>
                                </div>
                                <div className="bg-app-card/40 p-6 rounded-[2rem] border border-app-border/60 space-y-2 backdrop-blur-sm shadow-xl shadow-blue-500/5">
                                    <span className="text-blue-500 font-black text-xs uppercase tracking-widest">Son 24 Saat İş Akışı</span>
                                    <div className="text-3xl font-black text-blue-400">{analyticsData.summary.jobs_24h.toLocaleString()}</div>
                                </div>
                                <div className="bg-app-card/40 p-6 rounded-[2rem] border border-app-border/60 space-y-2 backdrop-blur-sm">
                                    <span className="text-app-subtle font-black text-xs uppercase tracking-widest">Başarılı İş Kazanımı</span>
                                    <div className="text-3xl font-black text-green-400">{analyticsData.summary.total_wins.toLocaleString()}</div>
                                </div>
                                <div className="bg-app-card/40 p-6 rounded-[2rem] border border-app-border/60 space-y-2 backdrop-blur-sm">
                                    <span className="text-app-subtle font-black text-xs uppercase tracking-widest">Toplam Aktif Driver</span>
                                    <div className="text-3xl font-black text-purple-400">{analyticsData.summary.total_drivers.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Daily Job Trend */}
                                <div className="bg-app-card/40 p-8 rounded-[2.5rem] border border-app-border/60 backdrop-blur-sm">
                                    <h3 className="text-sm font-black text-app-fg mb-8 uppercase tracking-[0.2em] flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Haftalık İş Yakalama Trendi
                                    </h3>
                                    <div className="h-72 flex items-end justify-between gap-4 pt-10 border-b border-app-border/60 pb-4">
                                        {analyticsData.dailyJobs.map((day: any, idx: number) => {
                                            const max = Math.max(...analyticsData.dailyJobs.map((d: any) => d.count), 1);
                                            const height = (day.count / max) * 100;
                                            return (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                                                    <div className="relative w-full flex flex-col items-center justify-end h-full">
                                                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-white text-slate-900 text-xs font-black px-2 py-1.5 rounded-xl z-20 shadow-xl after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-white">
                                                            {day.count}
                                                        </div>
                                                        <div
                                                            style={{ height: `${height}%` }}
                                                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-xl group-hover:scale-x-110 transition-all duration-300"
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-black text-app-subtle uppercase">
                                                        {new Date(day.date).toLocaleDateString('tr-TR', { weekday: 'short' })}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Hourly Job Trend (Last 24h) */}
                                <div className="bg-app-card/40 p-8 rounded-[2.5rem] border border-app-border/60 backdrop-blur-sm">
                                    <h3 className="text-sm font-black text-app-fg mb-8 uppercase tracking-[0.2em] flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        24 Saatlik İş Yakalama Akışı
                                    </h3>
                                    <div className="h-72 flex items-end justify-between gap-1 pt-10 border-b border-app-border/60 pb-4 overflow-x-auto custom-scrollbar">
                                        {(analyticsData.hourlyJobs || []).map((hourData: any, idx: number) => {
                                            const max = Math.max(...(analyticsData.hourlyJobs || []).map((d: any) => d.count), 1);
                                            const height = (hourData.count / max) * 100;
                                            return (
                                                <div key={idx} className="flex-1 min-w-[30px] flex flex-col items-center gap-3 group h-full justify-end">
                                                    <div className="relative w-full flex flex-col items-center justify-end h-full">
                                                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-purple-500 text-white text-xs font-black px-2 py-1.5 rounded-xl z-20 shadow-xl whitespace-nowrap after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-purple-500">
                                                            {hourData.count} İş
                                                        </div>
                                                        <div
                                                            style={{ height: `${height}%` }}
                                                            className="w-[60%] bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-lg group-hover:scale-x-125 transition-all duration-300"
                                                        ></div>
                                                    </div>
                                                    <span className="text-[11px] font-black text-app-subtle">
                                                        {hourData.hour}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Interaction Distribution */}
                                <div className="bg-app-card/40 p-8 rounded-[2.5rem] border border-app-border/60 backdrop-blur-sm">
                                    <h3 className="text-sm font-black text-app-fg mb-8 uppercase tracking-[0.2em]">Sistem Etkileşim Oranı</h3>
                                    <div className="space-y-8 flex flex-col justify-center h-64">
                                        {analyticsData.interactionStats.map((stat: any, idx: number) => {
                                            const total = (analyticsData.interactionStats as any[]).reduce((acc: number, s: any) => acc + s.count, 0);
                                            const percentage = ((stat.count / total) * 100).toFixed(1);
                                            const colors: any = { 'won': 'bg-green-500', 'called': 'bg-blue-500', 'ignored': 'bg-app-elevated' };
                                            const labels: any = { 'won': 'Kazanılan İşler', 'called': 'Sadece Aramalar', 'ignored': 'Pas Geçilenler' };
                                            return (
                                                <div key={idx} className="space-y-3">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-xs font-black text-app-muted uppercase tracking-widest">{labels[stat.status] || stat.status}</span>
                                                        <span className="text-sm font-black text-app-fg">{percentage}%</span>
                                                    </div>
                                                    <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden p-0.5 border border-app-border/60">
                                                        <div style={{ width: `${percentage}%` }} className={`${colors[stat.status] || 'bg-app-subtle'} h-full rounded-full`}></div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Top Drivers Ranking */}
                                <div className="bg-app-card/40 p-8 rounded-[2.5rem] border border-app-border/60 backdrop-blur-sm">
                                    <h3 className="text-sm font-black text-app-fg mb-8 uppercase tracking-[0.2em]">En Başarılı Operatörler</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {analyticsData.topDrivers.map((driver: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-5 bg-app-bg/40 rounded-3xl border border-app-border/60 hover:border-blue-500/20 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-yellow-500 text-yellow-950 shadow-lg shadow-yellow-500/20' : 'bg-app-card text-app-muted'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <span className="font-bold text-app-fg text-sm">{driver.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-blue-400">{driver.win_count}</div>
                                                    <div className="text-[11px] font-black text-app-subtle uppercase tracking-tighter">BAŞARI</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Top Groups Ranking */}
                                <div className="bg-app-card/40 p-8 rounded-[2.5rem] border border-app-border/60 backdrop-blur-sm">
                                    <h3 className="text-sm font-black text-app-fg mb-8 uppercase tracking-[0.2em]">Popüler Kaynak Gruplar</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {analyticsData.topGroups.map((group: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-5 bg-app-bg/40 rounded-3xl border border-app-border/60">
                                                <div className="flex items-center gap-4 overflow-hidden">
                                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                    <span className="font-bold text-app-muted truncate text-xs">{group.group_name}</span>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="text-sm font-black text-purple-400">{group.count}</div>
                                                    <div className="text-[11px] font-black text-app-subtle uppercase tracking-tighter">İş AKIŞI</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-app-subtle py-12">Analiz verisi yüklenemedi.</div>
                    )}
                </div>
            )}

            {/* Kullanıcı Detay Modalı */}
            {
                (detailUser || detailLoading) && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setDetailUser(null); setDetailLoading(false); }}>
                        <div className="bg-app-card rounded-3xl border border-app-border max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                            {detailLoading ? (
                                <div className="p-12 text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                                    <div className="text-app-muted font-bold">Yükleniyor...</div>
                                </div>
                            ) : detailUser && (
                                <>
                                    {/* Header */}
                                    <div className="p-6 border-b border-app-border flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-xl">
                                                {detailUser.user.name?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-app-fg">{detailUser.user.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-app-muted">{detailUser.user.email}</p>
                                                    {detailUser.user.status === 'banned' ? (
                                                        <span className="text-[11px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded tracking-tighter">BANNED</span>
                                                    ) : detailUser.user.status === 'restricted' ? (
                                                        <span className="text-[11px] font-black bg-orange-600 text-white px-1.5 py-0.5 rounded tracking-tighter">RESTRICTED</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setDetailUser(null)} className="text-app-muted hover:text-app-fg text-2xl">✕</button>
                                    </div>

                                    {/* İstatistik Kartları */}
                                    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-app-bg/50 p-4 rounded-2xl border border-app-border/60 text-center">
                                            <div className="text-2xl font-black text-blue-400">{detailUser.stats.okMessages}</div>
                                            <div className="text-[11px] font-black text-app-subtle uppercase tracking-widest mt-1">OK Mesajı</div>
                                        </div>
                                        <div className="bg-app-bg/50 p-4 rounded-2xl border border-app-border/60 text-center">
                                            <div className="text-2xl font-black text-green-400">{detailUser.stats.wonJobs}</div>
                                            <div className="text-[11px] font-black text-app-subtle uppercase tracking-widest mt-1">Kazanılan İş</div>
                                        </div>
                                        <div className="bg-app-bg/50 p-4 rounded-2xl border border-app-border/60 text-center">
                                            <div className="text-2xl font-black text-red-400">{detailUser.stats.ignoredJobs}</div>
                                            <div className="text-[11px] font-black text-app-subtle uppercase tracking-widest mt-1">Yoksayılan</div>
                                        </div>
                                        <div className="bg-app-bg/50 p-4 rounded-2xl border border-app-border/60 text-center">
                                            <div className="text-2xl font-black text-emerald-400">{detailUser.stats.totalEarnings.toLocaleString()} ₺</div>
                                            <div className="text-[11px] font-black text-app-subtle uppercase tracking-widest mt-1">Toplam Kazanç</div>
                                        </div>
                                    </div>

                                    {/* Profil & Bağlantı Bilgisi */}
                                    <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-app-bg/50 p-4 rounded-2xl border border-app-border/60 space-y-3">
                                            <div className="text-xs font-black text-app-subtle uppercase tracking-widest">👤 Şoför Profili</div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-app-subtle">Telefon:</span>
                                                    <span className="text-app-fg font-bold">{detailUser.user.driver_phone || 'Belirtilmedi'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-app-subtle">Plaka:</span>
                                                    <span className="text-app-fg font-bold">{detailUser.user.driver_plate || 'Belirtilmedi'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-app-subtle">Kayıt:</span>
                                                    <span className="text-app-muted">{new Date(detailUser.user.created_at).toLocaleDateString('tr-TR')}</span>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-app-border/60">
                                                <div className="text-xs font-black text-app-subtle uppercase tracking-widest mb-2">📡 WhatsApp Durumu</div>
                                                {detailUser.waSession ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${detailUser.waSession.is_connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                                                        <span className={`text-xs font-bold ${detailUser.waSession.is_connected ? 'text-green-400' : 'text-red-400'}`}>
                                                            {detailUser.waSession.is_connected ? 'BAĞLI' : 'BAĞLI DEĞİL'}
                                                        </span>
                                                        {detailUser.waSession.updated_at && (
                                                            <span className="text-xs text-app-subtle ml-2">
                                                                Son: {new Date(detailUser.waSession.updated_at).toLocaleString('tr-TR')}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-app-subtle">Oturum bulunamadı</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-app-bg/50 p-4 rounded-2xl border border-app-border/60">
                                            <div className="text-xs font-black text-app-subtle uppercase tracking-widest mb-3">🎯 Aktif Filtreler</div>
                                            {detailUser.filters ? (
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <span className="bg-app-card px-2 py-1 rounded-lg text-xs font-bold text-green-400 border border-app-border/60">
                                                            💰 {detailUser.filters.min_price || 0}+ ₺
                                                        </span>
                                                        <span className="bg-app-card px-2 py-1 rounded-lg text-xs font-bold text-app-muted border border-app-border/60">
                                                            📋 {detailUser.filters.job_mode?.toUpperCase() || 'TÜMÜ'}
                                                        </span>
                                                        <span className="bg-app-card px-2 py-1 rounded-lg text-xs font-bold text-app-muted border border-app-border/60">
                                                            {detailUser.filters.action_mode === 'auto' ? '⚡ OTO-ARA' : '👤 MANUEL'}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[11px] text-app-subtle font-bold uppercase">Nereden (Kalkış):</span>
                                                            {detailUser.filters.regions?.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {detailUser.filters.regions.map((reg: string) => (
                                                                        <span key={reg} className="text-[11px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">{reg}</span>
                                                                    ))}
                                                                </div>
                                                            ) : <span className="text-[11px] text-app-subtle italic">Seçilmedi</span>}
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[11px] text-app-subtle font-bold uppercase">Nereye (Varış):</span>
                                                            {detailUser.filters.to_regions?.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {detailUser.filters.to_regions.map((reg: string) => (
                                                                        <span key={reg} className="text-[11px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">{reg}</span>
                                                                    ))}
                                                                </div>
                                                            ) : <span className="text-[11px] text-app-subtle italic">Seçilmedi</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-app-subtle">Filtre ayarlanmamış</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Son Etkileşimler */}
                                    <div className="px-6 pb-6">
                                        <div className="text-xs font-black text-app-subtle uppercase tracking-widest mb-3">📜 Son İş Etkileşimleri</div>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                            {detailUser.recentInteractions.length > 0 ? detailUser.recentInteractions.map((item: any, i: number) => (
                                                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${item.status === 'called' ? 'bg-blue-500/5 border-blue-500/20' :
                                                    item.status === 'won' ? 'bg-green-500/5 border-green-500/20' :
                                                        'bg-red-500/5 border-red-500/20'
                                                    }`}>
                                                    <div className="text-xl">
                                                        {item.status === 'called' ? '📞' : item.status === 'won' ? '✅' : '❌'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-app-fg truncate">
                                                                {item.from_loc || '?'} → {item.to_loc || '?'}
                                                            </span>
                                                            <span className="text-xs font-bold text-green-400">
                                                                {item.price || '-'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-app-subtle">
                                                                {item.phone || '-'}
                                                            </span>
                                                            <span className="text-xs text-app-subtle">
                                                                {item.interaction_at ? new Date(item.interaction_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className={`text-[11px] font-black uppercase px-2 py-1 rounded-lg ${item.status === 'called' ? 'bg-blue-500/20 text-blue-400' :
                                                        item.status === 'won' ? 'bg-green-500/20 text-green-400' :
                                                            'bg-red-500/20 text-red-400'
                                                        }`}>
                                                        {item.status === 'called' ? 'ARADI' : item.status === 'won' ? 'KAZANDI' : 'GEÇTİ'}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-app-subtle text-sm">Henüz etkileşim kaydı yok</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
