"use client";

import { useEffect, useState, useRef } from "react";

interface Customer {
    id: number;
    phone_number: string;
    name: string;
    tags?: string;
    additional_data?: string;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ phone: "", name: "", tags: "" });
    const [user, setUser] = useState<any>(null);
    const [tagFilter, setTagFilter] = useState("");
    const [editingTags, setEditingTags] = useState<{ id: number, tags: string } | null>(null);
    const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchCustomers();
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split(".")[1]));
                setUser(payload);
            } catch (e) { }
        }
    }, []);

    const fetchCustomers = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/customers", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setCustomers(data.customers || []);
            }
        } catch (error) {
            console.error("Failed to fetch customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const token = localStorage.getItem("token");
            const res = await fetch("/api/customers/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                alert(`✅ ${data.count} müşteri başarıyla yüklendi!`);
                fetchCustomers();
            } else {
                throw new Error("Yükleme başarısız");
            }
        } catch (error) {
            console.error("Upload failed:", error);
            alert("❌ Dosya yüklenirken hata oluştu");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    phone_number: newCustomer.phone.replace(/\D/g, ""),
                    name: newCustomer.name,
                    tags: newCustomer.tags
                }),
            });

            if (res.ok) {
                setShowAddModal(false);
                setNewCustomer({ phone: "", name: "", tags: "" });
                fetchCustomers();
            }
        } catch (error) {
            console.error("Add failed:", error);
        }
    };

    const handleUpdateTags = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTags) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "update_tags",
                    customerIds: [editingTags.id],
                    tags: editingTags.tags
                }),
            });

            if (res.ok) {
                setEditingTags(null);
                fetchCustomers();
            }
        } catch (error) {
            console.error("Tag update failed:", error);
        }
    };

    const deleteCustomers = async () => {
        if (!confirm(`${selectedIds.length} müşteriyi silmek istediğinize emin misiniz?`)) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ action: "delete", customerIds: selectedIds }),
            });

            if (res.ok) {
                setSelectedIds([]);
                fetchCustomers();
            }
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    const exportToCSV = () => {
        const BOM = "\uFEFF";
        const csv = [
            "Telefon;İsim;Etiketler;Ek Veriler",
            ...filteredCustomers.map((c) => `${c.phone_number};${c.name || ""};${c.tags || ""};${c.additional_data || ""}`),
        ].join("\n");

        const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "musteri_listesi.csv";
        a.click();
    };

    const downloadTemplate = () => {
        const BOM = "\uFEFF";
        const csv = "Telefon;İsim;Etiketler;Ek_Veri_Basligi\n905xxxxxxxxx;Örnek İsim;VIP,Yeni;Ek bilgi buraya";
        const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "whatistaspp_sablon.csv";
        a.click();
    };

    const filteredCustomers = customers.filter(
        (c) =>
            (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone_number.includes(searchTerm)) &&
            (tagFilter === "" || c.tags?.toLowerCase().includes(tagFilter.toLowerCase()))
    );

    const allTags = Array.from(new Set(customers.flatMap(c => c.tags?.split(',').map(t => t.trim()).filter(t => t) || [])));

    return (
        <div className="fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Müşteriler</h1>
                    <p className="text-gray-400 text-sm">Toplam {customers.length} kayıtlı müşteri.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => {
                            if (user?.package === 'standard') {
                                alert("🛑 Toplu Excel/CSV yükleme özelliği Gold ve Platinum paketlere özeldir. Lütfen paketinizi yükseltin.");
                                return;
                            }
                            fileInputRef.current?.click();
                        }}
                        disabled={uploading}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50"
                    >
                        {uploading ? "⏳ Yükleniyor..." : "📁 Excel/CSV Yükle"}
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                    >
                        ➕ Manuel Ekle
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                    >
                        📥 CSV İndir
                    </button>
                    {selectedIds.length > 0 && (
                        <button
                            onClick={deleteCustomers}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                            🗑️ Sil ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <input
                    type="text"
                    placeholder="🔍 Müşteri ara (isim veya telefon)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                />

                <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50 min-w-[200px]"
                >
                    <option value="">🏷️ Tüm Etiketler</option>
                    {allTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-gray-400 text-xs font-black uppercase tracking-widest">
                        <tr>
                            <th className="p-4 w-12 text-center">
                                <input
                                    type="checkbox"
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedIds(filteredCustomers.map(c => c.id));
                                        else setSelectedIds([]);
                                    }}
                                />
                            </th>
                            <th className="p-4">Müşteri</th>
                            <th className="p-4">Etiketler</th>
                            <th className="p-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {loading ? (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-500">Yükleniyor...</td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-500">Kayıt bulunamadı.</td></tr>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <tr key={customer.id} className="text-gray-300 hover:bg-white/5 transition group">
                                    <td className="p-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(customer.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedIds([...selectedIds, customer.id]);
                                                else setSelectedIds(selectedIds.filter(id => id !== customer.id));
                                            }}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <div
                                            onClick={() => setViewingCustomer(customer)}
                                            className="font-bold text-white cursor-pointer hover:text-purple-400 transition"
                                        >
                                            {customer.name || "İsimsiz"}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono">+{customer.phone_number}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {customer.tags ? customer.tags.split(',').map((tag, i) => (
                                                <span key={i} className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                                                    {tag.trim()}
                                                </span>
                                            )) : <span className="text-[10px] text-gray-600">—</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setViewingCustomer(customer)}
                                                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition font-bold"
                                            >
                                                👁️ Profil
                                            </button>
                                            <button
                                                onClick={() => setEditingTags({ id: customer.id, tags: customer.tags || "" })}
                                                className="text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg border border-purple-500/20 transition font-bold"
                                            >
                                                🏷️ Etiketle
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* View Customer Detail Modal */}
            {viewingCustomer && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-8 text-center relative">
                            <button onClick={() => setViewingCustomer(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl">×</button>
                            <div className="w-20 h-20 bg-slate-900 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold border-4 border-slate-800">
                                {viewingCustomer.name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-1">{viewingCustomer.name || "İsimsiz"}</h2>
                            <p className="text-purple-200 text-sm font-mono">+{viewingCustomer.phone_number}</p>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Tags Section */}
                            <div>
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Etiketler</h3>
                                <div className="flex flex-wrap gap-2">
                                    {viewingCustomer.tags ? viewingCustomer.tags.split(',').map((tag, i) => (
                                        <span key={i} className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-[10px] font-bold border border-purple-500/20">
                                            {tag.trim()}
                                        </span>
                                    )) : <span className="text-gray-500 text-sm">Etiket bulunmuyor.</span>}
                                </div>
                            </div>

                            {/* Additional Data Section */}
                            <div>
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Ek Bilgiler (CRM)</h3>
                                <div className="bg-slate-900 rounded-2xl p-4 border border-white/5 space-y-3">
                                    {viewingCustomer.additional_data ? (() => {
                                        try {
                                            const data = JSON.parse(viewingCustomer.additional_data);
                                            const keys = Object.keys(data);
                                            if (keys.length === 0) return <span className="text-gray-600 text-sm italic">Ek veri bulunmuyor.</span>;
                                            return keys.map(key => (
                                                <div key={key} className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                                                    <span className="text-white font-medium">{data[key]}</span>
                                                </div>
                                            ));
                                        } catch (e) {
                                            return <span className="text-gray-600 text-sm italic">Veri okunamadı.</span>;
                                        }
                                    })() : <span className="text-gray-600 text-sm italic">Bu müşteri için ek veri yüklenmemiş.</span>}
                                </div>
                            </div>

                            <button
                                onClick={() => setViewingCustomer(null)}
                                className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl transition"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Tags Modal (Existing) */}
            {editingTags && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Etiketleri Düzenle</h2>
                        <form onSubmit={handleUpdateTags}>
                            <input
                                type="text"
                                value={editingTags.tags}
                                onChange={(e) => setEditingTags({ ...editingTags, tags: e.target.value })}
                                placeholder="Örn: VIP, Yeni Müşteri..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50 mb-6"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setEditingTags(null)} className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl transition font-bold">Vazgeç</button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl transition font-bold">Güncelle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Add Modal (Existing) */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold text-white mb-6">Yeni Müşteri Ekle</h2>
                        <form onSubmit={handleAddCustomer} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Telefon Numarası</label>
                                <input
                                    type="text"
                                    value={newCustomer.phone}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    placeholder="905xxxxxxxxx"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">İsim (Opsiyonel)</label>
                                <input
                                    type="text"
                                    value={newCustomer.name}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-1">Etiketler (Virgülle ayırın)</label>
                                <input
                                    type="text"
                                    value={newCustomer.tags}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, tags: e.target.value })}
                                    placeholder="VIP, Yeni, Potansiyel"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition font-bold">Vazgeç</button>
                                <button type="submit" className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-500 hover:to-pink-500 transition font-bold">Ekle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
