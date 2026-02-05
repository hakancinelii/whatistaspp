"use client";

import { useEffect, useState } from "react";

interface SentMessage {
    id: number;
    phone_number: string;
    message: string;
    status: string;
    sent_at: string;
    media_url?: string;
}

export default function ReportsPage() {
    const [reports, setReports] = useState<SentMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/reports", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setReports(data.reports || []);
                setStats(data.stats || { total: 0, sent: 0, failed: 0 });
            }
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredReports = reports.filter(r => {
        if (filter === "all") return true;
        return r.status === filter;
    });

    return (
        <div className="fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">Gönderim Raporları</h1>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <StatCard title="Toplam Mesaj" value={stats.total} color="blue" icon="📨" />
                <StatCard title="Başarıyla İletilen" value={stats.sent} color="emerald" icon="✅" />
                <StatCard title="Hata Alan" value={stats.failed} color="red" icon="⚠️" />
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700 w-full md:w-auto">
                    <button
                        onClick={() => setFilter("all")}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition ${filter === 'all' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Tümü
                    </button>
                    <button
                        onClick={() => setFilter("sent")}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition ${filter === 'sent' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Başarılı
                    </button>
                    <button
                        onClick={() => setFilter("failed")}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition ${filter === 'failed' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Hatalı
                    </button>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => {
                            const BOM = "\uFEFF";
                            const csv = [
                                "Tarih;Telefon;Mesaj;Durum",
                                ...filteredReports.map(r => `${new Date(r.sent_at).toLocaleString('tr-TR')};${r.phone_number};${r.message.replace(/[\n\r;]/g, ' ')};${r.status === 'sent' ? 'Başarılı' : 'Hatalı'}`)
                            ].join("\n");
                            const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `rapor_${new Date().toISOString().slice(0, 10)}.csv`;
                            a.click();
                        }}
                        className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
                    >
                        📥 CSV Olarak İndir
                    </button>
                    <button
                        onClick={fetchReports}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white rounded-xl border border-slate-700 transition"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {/* Reports List */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-gray-400 text-xs uppercase tracking-widest font-black">
                            <tr>
                                <th className="p-4">Tarih / Saat</th>
                                <th className="p-4">Alıcı</th>
                                <th className="p-4">Mesaj İçeriği</th>
                                <th className="p-4">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={4} className="p-12 text-center text-gray-500">Raporlar yükleniyor...</td></tr>
                            ) : filteredReports.length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center text-gray-500">Gönderim kaydı bulunamadı.</td></tr>
                            ) : (
                                filteredReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-slate-700/30 transition group">
                                        <td className="p-4 whitespace-nowrap">
                                            <div className="text-gray-300 text-sm">{new Date(report.sent_at).toLocaleDateString('tr-TR')}</div>
                                            <div className="text-gray-500 text-[10px]">{new Date(report.sent_at).toLocaleTimeString('tr-TR')}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-white font-mono text-sm leading-none mb-1">+{report.phone_number}</div>
                                            <div className="text-[10px] text-gray-500">WhatsApp</div>
                                        </td>
                                        <td className="p-4 min-w-[300px]">
                                            <div className="text-gray-400 text-sm line-clamp-2 italic leading-relaxed">
                                                "{report.message}"
                                            </div>
                                            {report.media_url && (
                                                <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                    📎 Medya Eki
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${report.status === 'sent' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                'bg-red-500/10 text-red-500 border border-red-500/20'
                                                }`}>
                                                {report.status === 'sent' ? 'İLETİLDİ' : 'HATALI'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, color, icon }: any) {
    const colors: any = {
        blue: "from-blue-600/20 text-blue-400 border-blue-500/20 shadow-blue-500/5",
        emerald: "from-emerald-600/20 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5",
        red: "from-red-600/20 text-red-400 border-red-500/20 shadow-red-500/5"
    };

    return (
        <div className={`p-6 rounded-3xl bg-slate-800 border bg-gradient-to-br ${colors[color]} shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">{icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Canlı Veri</span>
            </div>
            <div className="text-3xl font-black text-white mb-1">{value.toLocaleString()}</div>
            <div className="text-xs font-bold opacity-60 uppercase tracking-wider">{title}</div>
        </div>
    );
}
