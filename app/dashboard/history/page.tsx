"use client";

import { useEffect, useState } from "react";

interface Message {
    id: number;
    phone_number: string;
    message: string;
    status: string;
    sent_at: string;
}

export default function HistoryPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/messages/history", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredMessages = messages.filter((m) => {
        if (filter === "all") return true;
        return m.status === filter;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "sent":
                return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Gönderildi</span>;
            case "failed":
                return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">Başarısız</span>;
            case "pending":
                return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">Bekliyor</span>;
            default:
                return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs">{status}</span>;
        }
    };

    return (
        <div className="fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <h1 className="text-3xl font-bold text-white">Mesaj Geçmişi</h1>
                <div className="flex gap-2">
                    {["all", "sent", "pending", "failed"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f
                                    ? "bg-purple-600 text-white"
                                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                                }`}
                        >
                            {f === "all" ? "Tümü" : f === "sent" ? "Gönderilen" : f === "pending" ? "Bekleyen" : "Başarısız"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                        Yükleniyor...
                    </div>
                ) : filteredMessages.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="text-gray-400">Henüz mesaj geçmişi yok</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">#</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Telefon</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Mesaj</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Durum</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Tarih</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {filteredMessages.map((msg, index) => (
                                    <tr key={msg.id} className="hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                                        <td className="px-6 py-4 text-white font-mono">{msg.phone_number}</td>
                                        <td className="px-6 py-4 text-gray-300 max-w-xs truncate">{msg.message}</td>
                                        <td className="px-6 py-4">{getStatusBadge(msg.status)}</td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            {new Date(msg.sent_at).toLocaleString("tr-TR")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="mt-4 text-sm text-gray-400">
                Toplam: {filteredMessages.length} mesaj
            </div>
        </div>
    );
}
