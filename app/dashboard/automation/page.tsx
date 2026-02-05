"use client";

import { useEffect, useState } from "react";

interface AutoReply {
    id: number;
    keyword: string;
    reply: string;
    is_active: boolean;
    created_at: string;
}

export default function AutomationPage() {
    const [replies, setReplies] = useState<AutoReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [newReply, setNewReply] = useState({ keyword: "", reply: "" });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchData();
        const token = localStorage.getItem("token");
        if (token) {
            try {
                setUser(JSON.parse(atob(token.split(".")[1])));
            } catch (e) { }
        }
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/automation", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setReplies(data.replies || []);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user?.package === 'standard') {
            alert("🛑 Otomatik yanıt özelliği Gold ve Platinum paketlere özeldir.");
            return;
        }

        setIsSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/automation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(newReply),
            });

            if (res.ok) {
                setNewReply({ keyword: "", reply: "" });
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error || "Hata oluştu");
            }
        } catch (error) {
            alert("İşlem başarısız");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (replyId: number) => {
        if (!confirm("Bu otomatik yanıtı silmek istediğinize emin misiniz?")) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/automation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'delete', replyId }),
            });

            if (res.ok) {
                fetchData();
            }
        } catch (err) {
            alert("Silinemedi");
        }
    };

    return (
        <div className="fade-in max-w-4xl">
            <h1 className="text-3xl font-bold text-white mb-2">🤖 Otomatik Cevaplayıcı</h1>
            <p className="text-gray-400 mb-8">Belirlediğiniz anahtar kelimeler gelen mesajlarda geçtiğinde sistem otomatik yanıt gönderir.</p>

            {/* Add Form */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span>✨</span> Yeni Otomatik Yanıt Ekle
                </h2>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Anahtar Kelime</label>
                        <input
                            type="text"
                            value={newReply.keyword}
                            onChange={(e) => setNewReply({ ...newReply, keyword: e.target.value })}
                            placeholder="Örn: fiyat, saatleri, adres"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Otomatik Yanıt</label>
                        <input
                            type="text"
                            value={newReply.reply}
                            onChange={(e) => setNewReply({ ...newReply, reply: e.target.value })}
                            placeholder="Gönderilecek mesaj..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                            required
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
                        >
                            {isSaving ? "Kaydediliyor..." : "Yanıtı Kaydet"}
                        </button>
                    </div>
                </form>
            </div>

            {/* List */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white px-2">Kayıtlı Yanıtlar</h2>
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
                ) : replies.length === 0 ? (
                    <div className="bg-slate-800/50 p-12 rounded-2xl border border-dotted border-slate-700 text-center text-gray-500">
                        Henüz hiç otomatik yanıt eklenmemiş.
                    </div>
                ) : (
                    replies.map((reply) => (
                        <div key={reply.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center group hover:border-purple-500/50 transition-all">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] bg-slate-900 text-gray-400 px-2 py-0.5 rounded-full border border-slate-700">Anahtar Kelime</span>
                                    <span className="font-bold text-purple-400">{reply.keyword}</span>
                                </div>
                                <p className="text-gray-300 text-sm">{reply.reply}</p>
                            </div>
                            <button
                                onClick={() => handleDelete(reply.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                title="Sil"
                            >
                                🗑️
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
