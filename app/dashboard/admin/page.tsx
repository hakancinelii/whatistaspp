"use client";

import { useEffect, useState } from "react";

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    credits: number;
    package: string;
    created_at: string;
}

interface Stats {
    totalUsers: number;
    totalMessages: number;
    activeSessions: number;
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
                        <div className="text-gray-400 text-sm mb-1">Toplam Mesaj</div>
                        <div className="text-3xl font-bold text-purple-400">{stats.totalMessages}</div>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="text-gray-400 text-sm mb-1">Aktif Oturumlar</div>
                        <div className="text-3xl font-bold text-green-400">{stats.activeSessions}</div>
                    </div>
                </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">Tenant (Müşteri) Yönetimi</h2>
                </div>

                <div className="overflow-x-auto min-h-[600px]">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-gray-400 text-sm">
                            <tr>
                                <th className="p-4">Kullanıcı</th>
                                <th className="p-4">Mevcut Paket</th>
                                <th className="p-4">Bakiye</th>
                                <th className="p-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {users.map(user => (
                                <tr key={user.id} className="text-gray-300 hover:bg-slate-700/30 transition">
                                    <td className="p-4">
                                        <div className="font-medium text-white">{user.name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </td>
                                    <td className="p-4 relative">
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
                                    <td className="p-4 text-right relative">
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
        </div>
    );
}
