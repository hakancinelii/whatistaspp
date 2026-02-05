"use client";

import { useEffect, useState } from "react";

interface Template {
    id: number;
    name: string;
    content: string;
    created_at: string;
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ name: "", content: "" });

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/templates", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (error) {
            console.error("Failed to fetch templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
            const method = editingId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setShowModal(false);
                setFormData({ name: "", content: "" });
                setEditingId(null);
                fetchTemplates();
            }
        } catch (error) {
            console.error("Save failed:", error);
        }
    };

    const handleEdit = (template: Template) => {
        setFormData({ name: template.name, content: template.content });
        setEditingId(template.id);
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Bu şablonu silmek istediğinizden emin misiniz?")) return;

        try {
            const token = localStorage.getItem("token");
            await fetch(`/api/templates/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchTemplates();
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    return (
        <div className="fade-in">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Mesaj Şablonları</h1>
                <button
                    onClick={() => {
                        setFormData({ name: "", content: "" });
                        setEditingId(null);
                        setShowModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                    ➕ Yeni Şablon
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    Yükleniyor...
                </div>
            ) : templates.length === 0 ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                    <div className="text-6xl mb-4">📝</div>
                    <p className="text-gray-400 mb-4">Henüz şablon oluşturmadınız</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        İlk Şablonunuzu Oluşturun
                    </button>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-purple-500/50 transition"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(template)}
                                        className="text-blue-400 hover:text-blue-300 text-sm"
                                    >
                                        Düzenle
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        className="text-red-400 hover:text-red-300 text-sm"
                                    >
                                        Sil
                                    </button>
                                </div>
                            </div>
                            <p className="text-gray-400 text-sm whitespace-pre-wrap line-clamp-4">
                                {template.content}
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <span className="text-xs text-gray-500">
                                    {new Date(template.created_at).toLocaleDateString("tr-TR")}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            {editingId ? "Şablonu Düzenle" : "Yeni Şablon"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Şablon Adı
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Örn: Hoş Geldiniz Mesajı"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Mesaj İçeriği
                                </label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    required
                                    rows={5}
                                    placeholder="Mesaj içeriğini yazın..."
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    İpucu: {"{{isim}}"} yazarak müşteri ismini ekleyebilirsiniz
                                </p>
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                                >
                                    {editingId ? "Güncelle" : "Oluştur"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
