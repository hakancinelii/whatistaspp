"use client";

import { useEffect, useState } from "react";
import { useNotification } from "@/context/NotificationContext";

interface Customer {
    id: number;
    phone_number: string;
    name: string;
    tags?: string;
}

interface Template {
    id: number;
    name: string;
    content: string;
}

export default function MessagesPage() {
    const { showNotification } = useNotification();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Tag & Schedule
    const [tagFilter, setTagFilter] = useState("");
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledAt, setScheduledAt] = useState("");
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetchData();
        checkConnection();
        const token = localStorage.getItem("token");
        if (token) {
            try {
                setUser(JSON.parse(atob(token.split(".")[1])));
            } catch (e) { }
        }
    }, []);

    const fetchData = async () => {
        const token = localStorage.getItem("token");

        // Fetch customers
        const custRes = await fetch("/api/customers", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (custRes.ok) {
            const data = await custRes.json();
            setCustomers(data.customers || []);
        }

        // Fetch templates
        const tempRes = await fetch("/api/templates", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (tempRes.ok) {
            const data = await tempRes.json();
            setTemplates(data.templates || []);
        }
    };

    const checkConnection = async (retryCount = 0) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/whatsapp/status", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIsConnected(data.isConnected);
                setIsConnecting(data.isConnecting);

                if ((!data.isConnected || data.isConnecting) && retryCount < 5) {
                    setTimeout(() => checkConnection(retryCount + 1), 3000);
                }
            }
        } catch (error) {
            console.error("Connection check failed:", error);
        }
    };

    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaUrl, setMediaUrl] = useState("");
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/upload/image", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                setMediaUrl(data.url);
                showNotification("Görsel yüklendi!", "success");
            } else {
                showNotification("Görsel yüklenemedi!", "error");
            }
        } catch (error) {
            showNotification("Görsel yükleme hatası!", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleSend = async () => {
        if ((!message.trim() && !mediaUrl) || selectedCustomers.length === 0) return;
        if (!isConnected) {
            showNotification("WhatsApp bağlantısı yok! Önce WhatsApp'ı bağlayın.", "warning");
            return;
        }

        setSending(true);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/messages/send", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    customerIds: selectedCustomers,
                    message: message,
                    mediaUrl: mediaUrl,
                    mediaType: mediaUrl ? 'image' : null,
                    scheduledAt: isScheduled ? scheduledAt : null
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.scheduled) {
                    showNotification("Mesaj zamanlandı!", "success");
                } else {
                    showNotification("Gönderim başlatıldı.", "success");
                }
                setMessage("");
                setMediaUrl("");
                setSelectedCustomers([]);
                setIsScheduled(false);
                setScheduledAt("");
            } else {
                const data = await res.json();
                alert(`❌ ${data.error || "Gönderim başarısız"}`);
            }
        } catch (error) {
            console.error("Send failed:", error);
            alert("❌ Mesaj gönderilirken hata oluştu");
        } finally {
            setSending(false);
        }
    };

    const selectByTag = (tag: string) => {
        if (!tag) return;
        const ids = customers
            .filter(c => c.tags?.toLowerCase().includes(tag.toLowerCase()))
            .map(c => c.id);

        // Mevcut seçime ekle (duplicate'leri önleyerek)
        setSelectedCustomers(prev => Array.from(new Set([...prev, ...ids])));
        setTagFilter("");
    };

    const toggleSelectAll = () => {
        if (selectedCustomers.length === filteredCustomers.length) {
            setSelectedCustomers([]);
        } else {
            setSelectedCustomers(filteredCustomers.map((c) => c.id));
        }
    };

    const applyTemplate = (template: Template) => {
        setMessage(template.content);
    };

    const filteredCustomers = customers.filter(
        (c) =>
            c.phone_number.includes(searchTerm) ||
            c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const allTags = Array.from(new Set(customers.flatMap(c => c.tags?.split(',').map(t => t.trim()).filter(t => t) || [])));

    return (
        <div className="fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">Mesaj Gönder</h1>

            {!isConnected && (
                <div className={`border rounded-xl p-4 mb-6 flex items-center ${isConnecting ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <span className="text-2xl mr-3">{isConnecting ? '🔄' : '⚠️'}</span>
                    <div>
                        <div className={`font-medium ${isConnecting ? 'text-blue-200' : 'text-red-200'}`}>
                            {isConnecting ? 'WhatsApp Bağlanıyor...' : 'WhatsApp Bağlı Değil'}
                        </div>
                        <div className={`text-sm opacity-70 ${isConnecting ? 'text-blue-300' : 'text-red-300'}`}>
                            {isConnecting
                                ? 'Lütfen bekleyin, WhatsApp bağlantısı kuruluyor...'
                                : 'Mesaj göndermek için önce WhatsApp\'ı bağlamanız gerekiyor.'}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Customer Selection */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col h-[600px]">
                    <h2 className="text-lg font-semibold text-white mb-4">Alıcıları Seç</h2>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="🔍 Müşteri ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                        <select
                            value={tagFilter}
                            onChange={(e) => selectByTag(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-lg text-white px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="">🏷️ Etikete Göre Seç</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center justify-between mb-2 px-1">
                        <button
                            onClick={toggleSelectAll}
                            className="text-xs text-purple-400 hover:text-purple-300 font-bold"
                        >
                            {selectedCustomers.length === filteredCustomers.length
                                ? "Seçimi Kaldır"
                                : "Tümünü Seç"}
                        </button>
                        <span className="text-xs text-gray-400 font-mono">
                            {selectedCustomers.length} / {customers.length} Kişi Seçili
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {filteredCustomers.map((customer) => (
                            <label
                                key={customer.id}
                                className={`flex items-center p-3 rounded-lg cursor-pointer transition border ${selectedCustomers.includes(customer.id)
                                    ? "bg-purple-500/10 border-purple-500/50"
                                    : "bg-slate-700/30 border-slate-700 hover:bg-slate-700"
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCustomers.includes(customer.id)}
                                    onChange={() => {
                                        setSelectedCustomers((prev) =>
                                            prev.includes(customer.id)
                                                ? prev.filter((id) => id !== customer.id)
                                                : [...prev, customer.id]
                                        );
                                    }}
                                    className="w-4 h-4 rounded-full accent-purple-500 mr-3"
                                />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <div className="text-white text-sm font-semibold truncate w-32">
                                            {customer.name || "İsimsiz"}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono">
                                            {customer.phone_number}
                                        </div>
                                    </div>
                                    {customer.tags && (
                                        <div className="flex flex-wrap gap-1">
                                            {customer.tags.split(',').map((t, i) => (
                                                <span key={i} className="text-[9px] bg-slate-900 text-gray-400 px-1.5 py-0.5 rounded border border-slate-700">
                                                    {t.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                    {selectedCustomers.length > 0 && (
                        <button
                            onClick={() => setSelectedCustomers([])}
                            className="mt-4 text-center text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest"
                        >
                            Temizle
                        </button>
                    )}
                </div>

                {/* Message Composition */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col h-[600px]">
                    <h2 className="text-lg font-semibold text-white mb-4">Mesaj Yaz</h2>

                    {templates.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">Hızlı Şablonlar</label>
                            <div className="flex flex-wrap gap-2">
                                {templates.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => applyTemplate(t)}
                                        className="px-3 py-1 bg-slate-700 text-gray-300 rounded-lg text-xs hover:bg-slate-600 transition border border-slate-600"
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 relative mb-4">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mesajınızı buraya yazın... Ad değişkeni için {{isim}} kullanabilirsiniz."
                            className="w-full h-full p-4 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm placeholder:text-gray-600"
                        />
                        <div className="absolute bottom-3 right-4 text-[10px] text-gray-500 font-mono">
                            {message.length} karakter
                        </div>
                    </div>

                    {/* Media Upload Section */}
                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Görsel Ekle (Opsiyonel)</label>
                        {!mediaUrl ? (
                            <button
                                type="button"
                                onClick={() => document.getElementById('media-upload')?.click()}
                                disabled={uploading}
                                className="w-full py-4 bg-slate-700/30 border-2 border-dashed border-slate-600 rounded-xl text-gray-400 hover:text-white hover:border-purple-500 transition-all flex flex-col items-center justify-center gap-2 group"
                            >
                                <span className="text-2xl group-hover:scale-110 transition-transform">{uploading ? '⏳' : '🖼️'}</span>
                                <span className="text-xs font-bold">{uploading ? 'Yükleniyor...' : 'Görsel Seçmek İçin Tıklayın'}</span>
                                <input id="media-upload" type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                            </button>
                        ) : (
                            <div className="relative group">
                                <img src={mediaUrl} alt="Selected" className="w-full h-32 object-cover rounded-xl border border-purple-500/50" />
                                <button
                                    onClick={() => setMediaUrl("")}
                                    className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="text-xs">✕</span>
                                </button>
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none">
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Görsel Yüklendi</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                ⏰ Mesajı Zamanla
                            </label>
                            <input
                                type="checkbox"
                                checked={isScheduled}
                                onChange={(e) => {
                                    if (user?.package === 'standard') {
                                        alert("🛑 Zamanlama özelliği Gold ve Platinum paketlere özeldir.");
                                        return;
                                    }
                                    setIsScheduled(e.target.checked);
                                }}
                                className="w-5 h-5 rounded accent-purple-500"
                            />
                        </div>
                        {isScheduled && (
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-purple-500"
                                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                            />
                        )}
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={sending || !message.trim() || selectedCustomers.length === 0 || (!isScheduled && !isConnected)}
                        className={`w-full py-4 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95 ${isScheduled
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20"
                            : "bg-gradient-to-r from-purple-600 to-pink-600 shadow-purple-500/20"
                            }`}
                    >
                        {sending ? "⏳ İşlem Yapılıyor..." :
                            isScheduled ? `⏰ ${selectedCustomers.length} Kişiye Zamanla` :
                                `🚀 ${selectedCustomers.length} Kişiye Gönder`}
                    </button>

                    <p className="mt-4 text-[10px] text-gray-500 text-center italic">
                        * Gönderim arka planda yapılır. Limitlerinize göre belirli aralıklarla mesajlar iletilecektir.
                    </p>
                </div>
            </div>
        </div>
    );
}
