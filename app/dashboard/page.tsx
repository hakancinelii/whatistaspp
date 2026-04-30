"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
    totalCustomers: number;
    sentMessages: number;
    pendingMessages: number;
    todayCount: number;
    weeklyStats: { day: string; count: number }[];
    activities: { phone_number: string; status: string; sent_at: string }[];
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats>({
        totalCustomers: 0,
        sentMessages: 0,
        pendingMessages: 0,
        todayCount: 0,
        weeklyStats: [],
        activities: []
    });
    const [loading, setLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetchStats();
        checkWhatsApp();

        const token = localStorage.getItem("token");
        if (token) {
            try {
                setUser(JSON.parse(atob(token.split(".")[1])));
            } catch (e) { }
        }

        const interval = setInterval(() => {
            fetchStats();
            checkWhatsApp();
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/dashboard/stats", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const checkWhatsApp = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/whatsapp/status", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIsConnected(data.isConnected);
            }
        } catch (error) { }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    const PACKAGE_LIMITS = { standard: 250, gold: 1000, platinum: 10000 };
    const userPackage = (user?.package || 'standard') as keyof typeof PACKAGE_LIMITS;
    const currentLimit = PACKAGE_LIMITS[userPackage] || 250;
    const limitPercentage = Math.min(((stats.todayCount || 0) / currentLimit) * 100, 100);

    return (
        <div className="fade-in">
            <div className="flex justify-between items-center mb-6 md:mb-10">
                <h1 className="text-2xl md:text-4xl font-black text-app-fg tracking-widest uppercase">Dashboard</h1>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`}></div>
                    <span className="text-xs md:text-xs font-bold text-app-muted">{isConnected ? 'Bağlı' : 'Kesik'}</span>
                </div>
            </div>

            {/* Top Row: Colorful Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <ColorfulStatCard
                    title="Toplam Müşteri"
                    value={stats.totalCustomers}
                    icon="👥"
                    gradient="from-blue-500 to-cyan-400"
                />
                <ColorfulStatCard
                    title="Gönderilen Mesaj"
                    value={stats.sentMessages}
                    icon="✅"
                    gradient="from-emerald-500 to-green-400"
                />
                <ColorfulStatCard
                    title="Bugün Gönderilen"
                    value={stats.todayCount}
                    icon="📅"
                    gradient="from-purple-500 to-pink-500"
                    subtitle={`Limit: ${currentLimit}`}
                />
                <ColorfulStatCard
                    title="Bekleyen Mesaj"
                    value={stats.pendingMessages}
                    icon="⏳"
                    gradient="from-orange-500 to-yellow-500"
                    link="/dashboard/scheduled"
                />
            </div>

            <div className="grid lg:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-10">
                {/* Haftalık Gönderim Chart Placeholder */}
                <div className="bg-[#1e293b] rounded-3xl md:rounded-[40px] p-6 md:p-8 border border-app-border/60 shadow-2xl min-h-[300px] md:min-h-[400px]">
                    <h2 className="text-lg md:text-xl font-bold text-app-fg mb-6">Haftalık Gönderim</h2>
                    <div className="h-48 md:h-64 flex items-end gap-1 md:gap-2 px-2">
                        {stats.weeklyStats.length === 0 ? (
                            <div className="w-full text-center text-app-subtle py-10">Veri toplanıyor...</div>
                        ) : (
                            stats.weeklyStats.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div
                                        className="w-full bg-gradient-to-t from-purple-600 to-pink-500 rounded-t-lg transition-all group-hover:opacity-80"
                                        style={{ height: `${Math.max((d.count / (Math.max(...stats.weeklyStats.map(x => x.count)) || 1)) * 100, 5)}%` }}
                                    ></div>
                                    <span className="text-[11px] md:text-xs text-app-muted font-bold uppercase">{d.day}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Hızlı İşlemler */}
                <div className="bg-[#1e293b] rounded-[40px] p-8 border border-app-border/60 shadow-2xl">
                    <h2 className="text-xl font-bold text-app-fg mb-8">Hızlı İşlemler</h2>
                    <div className="space-y-4">
                        <QuickActionCard href="/dashboard/messages" icon="📨" title="Mesaj Gönder" />
                        <QuickActionCard href="/dashboard/customers" icon="📁" title="Excel Yükle" />
                        <QuickActionCard href="/dashboard/templates" icon="📝" title="Şablon Oluştur" />
                    </div>
                </div>
            </div>

            {/* Bottom Section: Info Card */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/40 rounded-[40px] p-10 border border-app-border/60 relative overflow-hidden">
                <div className="relative z-10 grid md:grid-cols-2 gap-10">
                    <div>
                        <h3 className="text-2xl font-black text-app-fg mb-4 flex items-center gap-2">🚀 Başlangıç Rehberi</h3>
                        <div className="space-y-4">
                            <SmallGuideStep icon="✅" title="WhatsApp Bağla" desc="WhatsApp menüsünden QR kodu taratarak oturum açın." />
                            <SmallGuideStep icon="✅" title="Müşteri Yükle" desc="Excel veya manuel olarak müşteri listenizi ekleyin." />
                        </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6">
                        <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">⚠️ Önemli Uyarılar</h3>
                        <ul className="text-xs text-app-muted space-y-2 list-disc list-inside">
                            <li>WhatsApp SPAM politikalarına dikkat edin.</li>
                            <li>Şikayet alırsanız numaranız yasaklanabilir.</li>
                            <li>Yeni bağlanan numaralarla günlük 50-100 mesajı geçmeyin.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ColorfulStatCard({ title, value, icon, gradient, link, subtitle }: any) {
    const card = (
        <div className={`p-6 md:p-8 rounded-3xl md:rounded-[40px] bg-gradient-to-br ${gradient} shadow-2xl hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden group border-2 md:border-4 border-app-border/70`}>
            <div className="relative z-10 text-app-fg">
                <div className="text-2xl md:text-4xl mb-4 md:mb-6">{icon}</div>
                <div className="text-xs md:text-sm font-bold opacity-80 uppercase tracking-wider mb-1">{title}</div>
                <div className="text-2xl md:text-4xl font-black tracking-tighter">{value.toLocaleString()}</div>
                {subtitle && <div className="text-[11px] md:text-xs mt-2 font-black bg-white/20 inline-block px-2 py-0.5 rounded-full">{subtitle}</div>}
            </div>
            <div className="absolute right-[-10%] bottom-[-10%] text-6xl md:text-8xl opacity-20 rotate-12 group-hover:rotate-0 transition-transform">
                {icon}
            </div>
        </div>
    );

    return link ? <Link href={link}>{card}</Link> : card;
}

function QuickActionCard({ href, icon, title }: any) {
    return (
        <Link href={href} className="flex items-center justify-between p-6 bg-app-card/50 rounded-3xl border border-app-border/60 hover:bg-app-elevated/50 transition-all group">
            <div className="flex items-center gap-4">
                <div className="text-2xl grayscale group-hover:grayscale-0 transition-all">{icon}</div>
                <span className="font-bold text-app-fg group-hover:text-purple-400 transition-colors">{title}</span>
            </div>
            <span className="text-app-muted group-hover:translate-x-1 transition-transform">→</span>
        </Link>
    );
}

function SmallGuideStep({ icon, title, desc }: any) {
    return (
        <div className="flex gap-4 p-4 bg-app-card/70 rounded-2xl border border-app-border/60">
            <div className="text-xl">{icon}</div>
            <div>
                <div className="text-sm font-bold text-app-fg">{title}</div>
                <div className="text-xs text-app-subtle">{desc}</div>
            </div>
        </div>
    );
}
