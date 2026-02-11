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
    created_at: string;
}

interface Stats {
    totalUsers: number;
    onlineUsers: number;
    activeSessions: number;
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
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

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
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`/api/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDetailUser(data);
            }
        } catch (error) {
            console.error("User detail fetch failed", error);
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

    if (loading) return <div className="p-8 text-center text-gray-400">Yükleniyor...</div>;

    return (
        <div className="fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">👑 Yönetim Paneli</h1>

            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="text-gray-400 text-sm mb-1">Toplam Kullanıcı</div>
                        <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="text-gray-400 text-sm mb-1">Online Kullanıcı</div>
                        <div className="flex items-center gap-2">
                            <div className="text-3xl font-bold text-blue-400">{stats.onlineUsers}</div>
                            <span className="animate-pulse w-3 h-3 bg-blue-500 rounded-full"></span>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="text-gray-400 text-sm mb-1">Aktif Oturumlar (WA)</div>
                        <div className="text-3xl font-bold text-green-400">{stats.activeSessions}</div>
                    </div>
                </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-white">Tenant (Müşteri) Yönetimi</h2>

                    {/* Aktif / İnaktif Filtre */}
                    <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-white/5">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            TÜMÜ ({users.length})
                        </button>
                        <button
                            onClick={() => setStatusFilter('active')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${statusFilter === 'active' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            🟢 AKTİF ({activeCount})
                        </button>
                        <button
                            onClick={() => setStatusFilter('inactive')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${statusFilter === 'inactive' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            ⚫ İNAKTİF ({inactiveCount})
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[600px]">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-gray-400 text-sm">
                            <tr>
                                <th className="p-4">Kullanıcı</th>
                                <th className="p-4">Şifre</th>
                                <th className="p-4">Mevcut Paket</th>
                                <th className="p-4">Bakiye</th>
                                <th className="p-4">Durum</th>
                                <th className="p-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="text-gray-300 hover:bg-slate-700/30 transition cursor-pointer" onClick={() => fetchUserDetail(user.id)}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-white">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                {user.is_online && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-800 rounded-full animate-pulse" title="Çevrimiçi"></div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{user.name}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4" onClick={e => e.stopPropagation()}>
                                        <div className="text-xs font-mono text-gray-400 bg-slate-900/50 px-2 py-1 rounded inline-block">
                                            {user.plain_password || '********'}
                                        </div>
                                    </td>
                                    <td className="p-4 relative" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => setSelectedPackageUser(selectedPackageUser?.id === user.id ? null : user)}
                                            className={`px-3 py-1 rounded text-xs font-bold transition-all hover:scale-105 ${PACKAGES_LIST.find(p => p.id === user.package)?.color || 'bg-slate-700 text-gray-300'
                                                }`}>
                                            {user.package?.toUpperCase() || 'STANDARD'} ▾
                                        </button>

                                        {selectedPackageUser?.id === user.id && (
                                            <div className="absolute left-4 top-12 z-30 w-48 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl p-2 animate-in fade-in zoom-in-95">
                                                <div className="text-[10px] text-gray-500 mb-2 px-2">Paket Değiştir:</div>
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
                                        <div className="text-[10px] text-gray-500">Kredi</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            {user.is_connected ? (
                                                <span className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20 w-fit">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                    WA BAĞLI
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase bg-slate-500/10 px-2 py-1 rounded-lg border border-slate-500/20 w-fit">
                                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                                                    WA KOPUK
                                                </span>
                                            )}

                                            {user.is_online ? (
                                                <span className="flex items-center gap-1.5 text-blue-400 text-[10px] font-black uppercase bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 w-fit">
                                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                                    ONLINE
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-600 px-2">Offline</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right relative" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                                                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                                            >
                                                Kredi Yükle
                                            </button>
                                            {user.role !== 'admin' && (
                                                <button
                                                    onClick={() => makeAdmin(user.id)}
                                                    className="px-3 py-1 bg-slate-700 text-gray-300 rounded hover:bg-slate-600 text-xs"
                                                >
                                                    Admin Yap
                                                </button>
                                            )}
                                            <button
                                                onClick={() => changePassword(user.id)}
                                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                            >
                                                Şifre Değiştir
                                            </button>
                                        </div>

                                        {selectedUser?.id === user.id && (
                                            <div className="absolute right-4 top-12 z-20 w-64 bg-slate-900 border border-slate-600 rounded-lg shadow-xl p-2 animate-in fade-in zoom-in-95">
                                                <div className="text-xs text-gray-400 mb-2 px-2">Eklenecek Kredi:</div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {CREDIT_PACKAGES.map(pkg => (
                                                        <button
                                                            key={pkg.value}
                                                            onClick={() => addCredits(user.id, pkg.value)}
                                                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-800 rounded flex justify-between group"
                                                        >
                                                            <span>{pkg.label}</span>
                                                            <span className="text-green-500 group-hover:text-green-400">+</span>
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

            {/* Kullanıcı Detay Modalı */}
            {(detailUser || detailLoading) && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setDetailUser(null); setDetailLoading(false); }}>
                    <div className="bg-slate-800 rounded-3xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        {detailLoading ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                                <div className="text-slate-400 font-bold">Yükleniyor...</div>
                            </div>
                        ) : detailUser && (
                            <>
                                {/* Header */}
                                <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-xl">
                                            {detailUser.user.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white">{detailUser.user.name}</h3>
                                            <p className="text-xs text-slate-400">{detailUser.user.email}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                                </div>

                                {/* İstatistik Kartları */}
                                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                                        <div className="text-2xl font-black text-blue-400">{detailUser.stats.okMessages}</div>
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">OK Mesajı</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                                        <div className="text-2xl font-black text-green-400">{detailUser.stats.wonJobs}</div>
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Kazanılan İş</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                                        <div className="text-2xl font-black text-red-400">{detailUser.stats.ignoredJobs}</div>
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Yoksayılan</div>
                                    </div>
                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                                        <div className="text-2xl font-black text-emerald-400">{detailUser.stats.totalEarnings.toLocaleString()} ₺</div>
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Toplam Kazanç</div>
                                    </div>
                                </div>

                                {/* Bağlantı & Filtre Bilgisi */}
                                <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">📡 WhatsApp Durumu</div>
                                        {detailUser.waSession ? (
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${detailUser.waSession.is_connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                                                <span className={`text-xs font-bold ${detailUser.waSession.is_connected ? 'text-green-400' : 'text-red-400'}`}>
                                                    {detailUser.waSession.is_connected ? 'BAĞLI' : 'BAĞLI DEĞİL'}
                                                </span>
                                                {detailUser.waSession.updated_at && (
                                                    <span className="text-[10px] text-slate-600 ml-2">
                                                        Son: {new Date(detailUser.waSession.updated_at).toLocaleString('tr-TR')}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-500">Oturum bulunamadı</span>
                                        )}
                                    </div>

                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">🎯 Aktif Filtreler</div>
                                        {detailUser.filters ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                <span className="bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold text-green-400 border border-white/5">
                                                    💰 {detailUser.filters.min_price || 0}+ ₺
                                                </span>
                                                <span className="bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 border border-white/5">
                                                    📋 {detailUser.filters.job_mode || 'all'}
                                                </span>
                                                <span className="bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 border border-white/5">
                                                    {detailUser.filters.action_mode === 'auto' ? '⚡ OTO' : '👤 MANUEL'}
                                                </span>
                                                {detailUser.filters.regions?.length > 0 && (
                                                    <span className="bg-blue-600/20 px-2 py-1 rounded-lg text-[10px] font-bold text-blue-400 border border-blue-500/20">
                                                        🚩 {detailUser.filters.regions.length} Bölge
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-500">Filtre ayarlanmamış</span>
                                        )}
                                    </div>
                                </div>

                                {/* Son Etkileşimler */}
                                <div className="px-6 pb-6">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">📜 Son İş Etkileşimleri</div>
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
                                                        <span className="text-xs font-black text-white truncate">
                                                            {item.from_loc || '?'} → {item.to_loc || '?'}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-green-400">
                                                            {item.price || '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-slate-500">
                                                            {item.phone || '-'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-600">
                                                            {item.interaction_at ? new Date(item.interaction_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${item.status === 'called' ? 'bg-blue-500/20 text-blue-400' :
                                                    item.status === 'won' ? 'bg-green-500/20 text-green-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {item.status === 'called' ? 'ARADI' : item.status === 'won' ? 'KAZANDI' : 'GEÇTİ'}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 text-slate-500 text-sm">Henüz etkileşim kaydı yok</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
