"use client";

import { useEffect, useState } from "react";

interface ScheduledMessage {
    id: number;
    customer_ids: string;
    message: string;
    scheduled_at: string;
    status: string;
}

export default function ScheduledPage() {
    const [messages, setMessages] = useState<ScheduledMessage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchScheduled();
    }, []);

    const fetchScheduled = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/scheduled", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.scheduled || []);
            }
        } catch (error) {
            console.error("Fetch failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id: number) => {
        if (!confirm("Bu zamanlanmış gönderimi iptal etmek istediğinize emin misiniz?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/scheduled", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action: "cancel", id }),
            });

            if (res.ok) {
                setMessages(messages.filter(m => m.id !== id));
            }
        } catch (error) {
            alert("İptal işlemi başarısız oldu.");
        }
    };

    return (
        <div className="fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">⏳ Bekleyen Mesajlar</h1>
                    <p className="text-gray-400">Gelecekte gönderilmek üzere ayarlanmış kampanyalarınız.</p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-gray-400 text-xs uppercase tracking-widest font-black">
                        <tr>
                            <th className="p-4">Gönderim Zamanı</th>
                            <th className="p-4">Hedef Kitle</th>
                            <th className="p-4">Mesaj Özet</th>
                            <th className="p-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {loading ? (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-500">Yükleniyor...</td></tr>
                        ) : messages.length === 0 ? (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-500 italic">Bekleyen zamanlanmış mesaj bulunmuyor.</td></tr>
                        ) : (
                            messages.map((m) => {
                                const count = JSON.parse(m.customer_ids).length;
                                return (
                                    <tr key={m.id} className="hover:bg-slate-700/30 transition">
                                        <td className="p-4">
                                            <div className="text-purple-400 font-bold">
                                                {new Date(m.scheduled_at).toLocaleDateString('tr-TR')}
                                            </div>
                                            <div className="text-white text-lg font-black leading-none">
                                                {new Date(m.scheduled_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-slate-700 px-3 py-1 rounded-full text-xs text-white border border-slate-600">
                                                    👥 {count} Kişi
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-gray-400 text-sm line-clamp-1 max-w-xs italic">
                                                "{m.message}"
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleCancel(m.id)}
                                                className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold border border-red-500/20 transition-all active:scale-95"
                                            >
                                                İptal Et
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
