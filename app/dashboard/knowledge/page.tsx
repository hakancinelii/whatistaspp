"use client";

import { useEffect, useState } from "react";

interface KBItem {
    id: number;
    title: string;
    content: string;
    created_at: string;
}

export default function KnowledgeBasePage() {
    const [items, setItems] = useState<KBItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newItem, setNewItem] = useState({ title: "", content: "" });
    const [user, setUser] = useState<any>(null);

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
            const res = await fetch("/api/knowledge", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/knowledge", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newItem),
            });

            if (res.ok) {
                setShowModal(false);
                setNewItem({ title: "", content: "" });
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error || "Hata oluştu.");
            }
        } catch (error) {
            alert("Kaydedilemedi.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Bu bilgiyi silmek istediğinizden emin misiniz?")) return;
        try {
            const token = localStorage.getItem("token");
            await fetch("/api/knowledge", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action: "delete", id }),
            });
            fetchData();
        } catch (error) { }
    };

    return (
        <div className="fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">🧠 AI Bilgi Bankası</h1>
                    <p className="text-gray-400 text-sm">İşletmenizi yapay zekaya tanıtın. Eklediğiniz bilgiler AI asistanı tarafından kullanılır.</p>
                </div>
                <button
                    onClick={() => {
                        if (user?.package === 'standard') {
                            alert("🛑 Bilgi Bankası özelliği Gold ve Platinum paketlere özeldir.");
                            return;
                        }
                        setShowModal(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl hover:scale-105 transition-all shadow-lg shadow-purple-600/20"
                >
                    + Bilgi Ekle
                </button>
            </div>

            {user?.package === 'standard' && (
                <div className="bg-purple-500/10 border border-purple-500/20 p-6 rounded-3xl mb-8 flex items-center justify-between">
                    <div>
                        <h3 className="text-purple-400 font-bold mb-1">Paket Kısıtlaması</h3>
                        <p className="text-gray-400 text-sm">Üzgünüz, Bilgi Bankası özelliği sadece Gold ve Platinum paketlerde kullanılabilir.</p>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl">Paketi Yükselt</button>
                </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-gray-500">Yükleniyor...</div>
                ) : items.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-700">
                        <div className="text-4xl mb-4">📚</div>
                        <p className="text-gray-400">Henüz bilgi eklenmemiş. AI asistanının işletmenizi tanıması için veri girin.</p>
                    </div>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 hover:border-purple-500/50 transition-all group relative">
                            <button
                                onClick={() => handleDelete(item.id)}
                                className="absolute top-4 right-4 text-gray-600 hover:text-red-400 transition"
                            >
                                🗑️
                            </button>
                            <h3 className="text-lg font-bold text-white mb-3 pr-6">{item.title}</h3>
                            <p className="text-gray-400 text-sm line-clamp-4 leading-relaxed mb-6 italic">
                                "{item.content}"
                            </p>
                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                                    {new Date(item.created_at).toLocaleDateString('tr-TR')}
                                </span>
                                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-black">AI HAZIR</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-white/5">
                            <h2 className="text-2xl font-bold text-white">Yeni Bilgi Ekle</h2>
                            <p className="text-gray-400 text-sm">AI bu bilgiyi müşterilere cevap verirken kaynak olarak kullanacaktır.</p>
                        </div>
                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Başlık / Konu</label>
                                <input
                                    type="text"
                                    required
                                    value={newItem.title}
                                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                                    placeholder="Örn: İade Politikası, Menü Hakkında, Çalışma Saatleri"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Detaylı Bilgi / İçerik</label>
                                <textarea
                                    required
                                    rows={8}
                                    value={newItem.content}
                                    onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
                                    placeholder="Lütfen yapay zekanın bilmesi gereken tüm detayları buraya yazın..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 bg-slate-700 text-white font-bold rounded-2xl hover:bg-slate-600 transition"
                                >
                                    Vazgeç
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl hover:from-purple-500 hover:to-pink-500 transition shadow-lg shadow-purple-600/20"
                                >
                                    Bilgiyi Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
