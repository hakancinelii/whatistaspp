"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotification } from "@/context/NotificationContext";
import { apiFetch } from "@/lib/api-client";

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

interface SendProgress {
    isActive: boolean;
    jobId: number | null;
    status: string;
    current: number;
    total: number;
    success: number;
    error: number;
    lastRecipient?: {
        id?: number;
        name?: string;
        phone_number?: string;
    } | null;
    resumeAvailable: boolean;
    dailyCap: number;
    message?: string;
    mediaUrl?: string;
    mediaType?: string | null;
    remainingCustomerIds?: number[];
}

const getNumberedCustomerIndex = (name?: string) => {
    const normalizedName = name
        ?.trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s");
    const match = normalizedName?.match(/^musteri\s+(\d+)$/);
    return match ? Number(match[1]) : null;
};

export default function MessagesPage() {
    const { showNotification } = useNotification();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [rangeInput, setRangeInput] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [sendProgress, setSendProgress] = useState<SendProgress | null>(null);

    // Tag & Schedule
    const [tagFilter, setTagFilter] = useState("");
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledAt, setScheduledAt] = useState("");
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetchData();
        checkConnection();
        fetchProgress();
        const token = localStorage.getItem("token");
        if (token) {
            try {
                setUser(JSON.parse(atob(token.split(".")[1])));
            } catch (e) { }
        }
    }, []);

    useEffect(() => {
        // İlerleme polling'i yalnızca sayfa görünürken; arka planda durur.
        let interval: any = null;
        const start = () => { if (interval == null) interval = setInterval(fetchProgress, 3000); };
        const stop = () => { if (interval != null) { clearInterval(interval); interval = null; } };
        const onVisibility = () => {
            if (document.visibilityState === "visible") { fetchProgress(); start(); }
            else stop();
        };
        start();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            stop();
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    const fetchData = async () => {
        const token = localStorage.getItem("token");

        // Fetch customers
        const custRes = await apiFetch("/api/customers", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (custRes.ok) {
            const data = await custRes.json();
            setCustomers(data.customers || []);
        }

        // Fetch templates
        const tempRes = await apiFetch("/api/templates", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (tempRes.ok) {
            const data = await tempRes.json();
            setTemplates(data.templates || []);
        }
    };

    const fetchProgress = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const res = await apiFetch("/api/messages/progress", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setSendProgress(data);
            }
        } catch (error) {
            console.error("Progress check failed:", error);
        }
    };

    const checkConnection = async (retryCount = 0) => {
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/whatsapp/status", {
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

        setMediaFile(file);
        setUploading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/upload/image", {
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

    const hasActiveJob = sendProgress?.status === "running" || sendProgress?.resumeAvailable;

    const handleSend = async (options?: { replacePausedJob?: boolean }) => {
        if ((!message.trim() && !mediaUrl) || selectedCustomers.length === 0) return;
        if (!isConnected) {
            showNotification("WhatsApp bağlantısı yok! Önce WhatsApp'ı bağlayın.", "warning");
            return;
        }
        if (!isScheduled && hasActiveJob && !options?.replacePausedJob) {
            showNotification("Devam eden bir toplu gönderim var. Düzenleyerek devam edin veya yeni gönderim olarak başlatın.", "warning");
            return;
        }

        setSending(true);

        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/messages/send", {
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
                    scheduledAt: isScheduled ? scheduledAt : null,
                    replacePausedJob: options?.replacePausedJob || false
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
                setMediaFile(null);
                setSelectedCustomers([]);
                setIsScheduled(false);
                setScheduledAt("");
                fetchProgress();
            } else {
                const data = await res.json();
                alert(`❌ ${data.error || "Gönderim başarısız"}`);
                fetchProgress();
            }
        } catch (error) {
            console.error("Send failed:", error);
            alert("❌ Mesaj gönderilirken hata oluştu");
        } finally {
            setSending(false);
        }
    };

    const loadPausedJobForEditing = () => {
        if (!sendProgress?.resumeAvailable) return;
        setMessage(sendProgress.message || "");
        setMediaUrl(sendProgress.mediaUrl || "");
        setSelectedCustomers(sendProgress.remainingCustomerIds || []);
        showNotification("Kalan alıcılar ve mesaj düzenleme alanına yüklendi.", "success");
    };

    const handleResume = async () => {
        if (!sendProgress?.jobId || !isConnected) return;

        setSending(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/messages/send", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    resume: true,
                    jobId: sendProgress.jobId,
                    message,
                    mediaUrl,
                    mediaType: mediaUrl ? 'image' : null
                }),
            });

            if (res.ok) {
                showNotification("Düzenlenen mesajla kaldığı yerden devam ediyor.", "success");
                fetchProgress();
            } else {
                const data = await res.json();
                alert(`❌ ${data.error || "Gönderim devam ettirilemedi"}`);
            }
        } catch (error) {
            console.error("Resume failed:", error);
            alert("❌ Gönderim devam ettirilirken hata oluştu");
        } finally {
            setSending(false);
        }
    };

    const handleStartAsNew = async () => {
        if (!sendProgress?.resumeAvailable) return;
        if (!confirm("Duraklatılmış gönderim iptal edilecek ve seçili alıcılarla yeni gönderim başlatılacak. Emin misiniz?")) return;
        await handleSend({ replacePausedJob: true });
    };

    const handleStop = async () => {
        setSending(true);
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch("/api/messages/stop", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                showNotification("Gönderim duraklatıldı.", "success");
                fetchProgress();
            } else {
                showNotification("Gönderim durdurulamadı.", "error");
            }
        } catch (error) {
            showNotification("Gönderim durdurulurken hata oluştu.", "error");
        } finally {
            setSending(false);
        }
    };

    const selectByTag = (tag: string) => {
        if (!tag) return;
        const ids = customers
            .filter(c => c.tags?.toLowerCase().includes(tag.toLowerCase()))
            .map(c => c.id);

        setSelectedCustomers(prev => Array.from(new Set([...prev, ...ids])));
        setTagFilter("");
    };

    const filteredCustomers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLocaleLowerCase("tr-TR");
        return customers.filter((c) => {
            if (!normalizedSearch) return true;
            return c.phone_number.includes(normalizedSearch) || c.name?.toLocaleLowerCase("tr-TR").includes(normalizedSearch);
        });
    }, [customers, searchTerm]);

    const groupedCustomers = useMemo(() => {
        const numbered = filteredCustomers
            .map((customer) => ({ customer, number: getNumberedCustomerIndex(customer.name) }))
            .filter((item): item is { customer: Customer; number: number } => item.number !== null)
            .sort((a, b) => a.number - b.number)
            .map((item) => item.customer);

        const other = filteredCustomers.filter((customer) => getNumberedCustomerIndex(customer.name) === null);
        return { numbered, other };
    }, [filteredCustomers]);

    const visibleCustomerIds = filteredCustomers.map((customer) => customer.id);
    const allVisibleSelected = visibleCustomerIds.length > 0 && visibleCustomerIds.every((id) => selectedCustomers.includes(id));

    const toggleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedCustomers(prev => prev.filter(id => !visibleCustomerIds.includes(id)));
        } else {
            setSelectedCustomers(prev => Array.from(new Set([...prev, ...visibleCustomerIds])));
        }
    };

    const toggleCustomerGroup = (ids: number[]) => {
        const allGroupSelected = ids.length > 0 && ids.every((id) => selectedCustomers.includes(id));
        if (allGroupSelected) {
            setSelectedCustomers(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedCustomers(prev => Array.from(new Set([...prev, ...ids])));
        }
    };

    const getCustomersInRange = () => {
        const match = rangeInput.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
        if (!match) return null;

        const first = Number(match[1]);
        const second = Number(match[2]);
        const start = Math.min(first, second);
        const end = Math.max(first, second);

        return groupedCustomers.numbered.filter((customer) => {
            const number = getNumberedCustomerIndex(customer.name);
            return number !== null && number >= start && number <= end;
        });
    };

    const selectRange = () => {
        const rangeCustomers = getCustomersInRange();
        if (!rangeCustomers) {
            showNotification("Aralığı 100-200 gibi yazın.", "warning");
            return;
        }

        if (rangeCustomers.length === 0) {
            showNotification("Bu aralıkta numaralı müşteri bulunamadı.", "warning");
            return;
        }

        setSelectedCustomers(prev => Array.from(new Set([...prev, ...rangeCustomers.map((customer) => customer.id)])));
        showNotification(`${rangeCustomers.length} numaralı müşteri seçildi.`, "success");
    };

    const clearRange = () => {
        const rangeCustomers = getCustomersInRange();
        if (!rangeCustomers) {
            showNotification("Aralığı 100-200 gibi yazın.", "warning");
            return;
        }

        const ids = rangeCustomers.map((customer) => customer.id);
        setSelectedCustomers(prev => prev.filter(id => !ids.includes(id)));
        showNotification(`${rangeCustomers.length} numaralı müşteri seçimden kaldırıldı.`, "success");
    };

    const applyTemplate = (template: Template) => {
        setMessage(template.content);
    };

    const allTags = Array.from(new Set(customers.flatMap(c => c.tags?.split(',').map(t => t.trim()).filter(t => t) || [])));

    const progressPercent = sendProgress?.total ? Math.min(100, Math.round((sendProgress.current / sendProgress.total) * 100)) : 0;
    const statusLabel = sendProgress?.status === "running"
        ? "Gönderim sürüyor"
        : sendProgress?.status === "paused_daily_limit"
            ? "Günlük limite ulaşıldı"
            : sendProgress?.status === "paused_manual"
                ? "Manuel duraklatıldı"
                : sendProgress?.status === "failed"
                    ? "Hata nedeniyle durdu"
                    : "Hazır";

    const renderCustomer = (customer: Customer) => (
        <label
            key={customer.id}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition border ${selectedCustomers.includes(customer.id)
                ? "bg-purple-500/10 border-purple-500/50"
                : "bg-app-elevated/30 border-app-border hover:bg-app-elevated"
                }`}
        >
            <input
                type="checkbox"
                title={`${customer.name || "İsimsiz"} alıcısını seç`}
                checked={selectedCustomers.includes(customer.id)}
                onChange={() => {
                    setSelectedCustomers((prev) =>
                        prev.includes(customer.id)
                            ? prev.filter((id) => id !== customer.id)
                            : [...prev, customer.id]
                    );
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded-full accent-purple-500 mr-3"
            />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5 gap-2">
                    <div className="text-app-fg text-sm font-semibold truncate">
                        {customer.name || "İsimsiz"}
                    </div>
                    <div className="text-xs text-app-subtle font-mono shrink-0">
                        {customer.phone_number}
                    </div>
                </div>
                {customer.tags && (
                    <div className="flex flex-wrap gap-1">
                        {customer.tags.split(',').map((t, i) => (
                            <span key={i} className="text-[11px] bg-app-bg text-app-muted px-1.5 py-0.5 rounded border border-app-border">
                                {t.trim()}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </label>
    );

    const renderCustomerGroup = (title: string, list: Customer[], emptyText: string) => {
        const ids = list.map((customer) => customer.id);
        const selectedInGroup = ids.filter((id) => selectedCustomers.includes(id)).length;
        const allGroupSelected = ids.length > 0 && selectedInGroup === ids.length;

        return (
            <div className="space-y-2">
                <div className="sticky top-0 z-10 bg-app-card/95 backdrop-blur border border-app-border rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-app-fg uppercase tracking-wider">{title}</div>
                        <div className="text-xs text-app-subtle">{selectedInGroup} / {list.length} seçili</div>
                    </div>
                    {list.length > 0 && (
                        <button
                            type="button"
                            onClick={() => toggleCustomerGroup(ids)}
                            className="text-xs text-purple-400 hover:text-purple-300 font-bold uppercase tracking-widest"
                        >
                            {allGroupSelected ? "Kaldır" : "Grubu Seç"}
                        </button>
                    )}
                </div>
                {list.length > 0 ? list.map(renderCustomer) : (
                    <div className="text-xs text-app-subtle bg-app-bg/50 border border-app-border rounded-lg p-3">{emptyText}</div>
                )}
            </div>
        );
    };

    return (
        <div className="fade-in">
            <h1 className="text-3xl font-bold text-app-fg mb-8">Mesaj Gönder</h1>

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

            {sendProgress && sendProgress.status !== "idle" && (sendProgress.isActive || sendProgress.resumeAvailable) && (
                <div className="bg-app-card border border-app-border rounded-xl p-5 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <div className="text-sm font-bold text-app-fg">{statusLabel}</div>
                                    <div className="text-xs text-app-muted">
                                        {sendProgress.current} / {sendProgress.total} alıcı işlendi · Başarılı: {sendProgress.success} · Hatalı: {sendProgress.error} · Günlük sınır: {sendProgress.dailyCap}
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-purple-300">%{progressPercent}</span>
                            </div>
                            <progress
                                value={progressPercent}
                                max={100}
                                className="w-full h-2 rounded-full overflow-hidden bg-app-bg accent-purple-500"
                                aria-label="Gönderim ilerlemesi"
                            />
                            {sendProgress.lastRecipient && (
                                <div className="mt-2 text-xs text-app-subtle">
                                    Son alıcı: {sendProgress.lastRecipient.name || "İsimsiz"} · {sendProgress.lastRecipient.phone_number || "numara yok"}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {sendProgress.resumeAvailable && (
                                <>
                                    <button
                                        type="button"
                                        onClick={loadPausedJobForEditing}
                                        className="px-4 py-2 bg-app-elevated hover:bg-app-elevated disabled:opacity-50 text-app-fg border border-app-border rounded-lg text-xs font-bold transition"
                                    >
                                        Düzenle
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResume}
                                        disabled={sending || !isConnected || (!message.trim() && !mediaUrl)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                                    >
                                        Düzenlenen Haliyle Devam Et
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleStartAsNew}
                                        disabled={sending || selectedCustomers.length === 0 || (!message.trim() && !mediaUrl)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                                    >
                                        Yeni Gönderim Başlat
                                    </button>
                                </>
                            )}
                            {sendProgress.isActive && (
                                <button
                                    type="button"
                                    onClick={handleStop}
                                    disabled={sending}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                                >
                                    Durdur
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Customer Selection */}
                <div className="bg-app-card rounded-xl border border-app-border p-6 flex flex-col h-[600px]">
                    <h2 className="text-lg font-semibold text-app-fg mb-4">Alıcıları Seç</h2>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="🔍 Müşteri ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 px-4 py-2 bg-app-elevated border border-app-border rounded-lg text-app-fg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                        <select
                            title="Etikete göre alıcı seç"
                            value={tagFilter}
                            onChange={(e) => selectByTag(e.target.value)}
                            className="bg-app-elevated border border-app-border rounded-lg text-app-fg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="">🏷️ Etikete Göre Seç</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center justify-between mb-2 px-1">
                        <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-xs text-purple-400 hover:text-purple-300 font-bold"
                        >
                            {allVisibleSelected ? "Görünen Seçimi Kaldır" : "Görünen Tümünü Seç"}
                        </button>
                        <span className="text-xs text-app-muted font-mono">
                            {selectedCustomers.length} / {customers.length} Kişi Seçili
                        </span>
                    </div>

                    <div className="mb-3 rounded-xl border border-app-border bg-app-bg/40 p-3">
                        <label htmlFor="customer-range" className="block text-xs font-bold text-app-muted mb-2 uppercase tracking-widest">
                            Numara Aralığı Seç
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="customer-range"
                                type="text"
                                inputMode="numeric"
                                placeholder="100-200 veya 1453-1650"
                                value={rangeInput}
                                onChange={(e) => setRangeInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") selectRange();
                                }}
                                className="flex-1 px-3 py-2 bg-app-card border border-app-border rounded-lg text-app-fg focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs placeholder:text-app-subtle"
                            />
                            <button
                                type="button"
                                onClick={selectRange}
                                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest"
                            >
                                Seç
                            </button>
                            <button
                                type="button"
                                onClick={clearRange}
                                className="px-3 py-2 bg-app-elevated hover:bg-app-elevated text-app-fg rounded-lg text-xs font-bold uppercase tracking-widest"
                            >
                                Kaldır
                            </button>
                        </div>
                        <div className="mt-2 text-xs text-app-subtle">
                            Örnek: 100-200 yazıp Seç’e basınca Musteri 100 ile Musteri 200 arası seçilir.
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
                        {renderCustomerGroup("Numaralı Müşteriler", groupedCustomers.numbered, "Bu aramada müşteri 100, müşteri 101 gibi numaralı kayıt bulunamadı.")}
                        {renderCustomerGroup("Diğer Alıcılar", groupedCustomers.other, "Bu aramada diğer alıcı bulunamadı.")}
                    </div>
                    {selectedCustomers.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedCustomers([])}
                            className="mt-4 text-center text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-widest"
                        >
                            Temizle
                        </button>
                    )}
                </div>

                {/* Message Composition */}
                <div className="bg-app-card rounded-xl border border-app-border p-6 flex flex-col h-[600px]">
                    <h2 className="text-lg font-semibold text-app-fg mb-4">Mesaj Yaz</h2>

                    {templates.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-app-subtle mb-2 uppercase tracking-wider">Hızlı Şablonlar</label>
                            <div className="flex flex-wrap gap-2">
                                {templates.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => applyTemplate(t)}
                                        className="px-3 py-1 bg-app-elevated text-app-muted rounded-lg text-xs hover:bg-app-elevated transition border border-app-border"
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
                            className="w-full h-full p-4 bg-app-bg border border-app-border rounded-xl text-app-fg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm placeholder:text-app-muted"
                        />
                        <div className="absolute bottom-3 right-4 text-xs text-app-subtle font-mono">
                            {message.length} karakter
                        </div>
                    </div>

                    {/* Media Upload Section */}
                    <div className="mb-4">
                        <label htmlFor="media-upload" className="block text-xs font-bold text-app-muted mb-2 uppercase tracking-widest">Görsel Ekle (Opsiyonel)</label>
                        <input id="media-upload" title="Gönderilecek görseli seç" type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                        {!mediaUrl ? (
                            <button
                                type="button"
                                onClick={() => document.getElementById('media-upload')?.click()}
                                disabled={uploading}
                                className="w-full py-4 bg-app-elevated/30 border-2 border-dashed border-app-border rounded-xl text-app-muted hover:text-app-fg hover:border-purple-500 transition-all flex flex-col items-center justify-center gap-2 group"
                            >
                                <span className="text-2xl group-hover:scale-110 transition-transform">{uploading ? '⏳' : '🖼️'}</span>
                                <span className="text-xs font-bold">{uploading ? 'Yükleniyor...' : 'Görsel Seçmek İçin Tıklayın'}</span>
                            </button>
                        ) : (
                            <div className="relative group">
                                <img src={mediaUrl} alt="Selected" className="w-full h-32 object-cover rounded-xl border border-purple-500/50" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMediaUrl("");
                                        setMediaFile(null);
                                    }}
                                    className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="text-xs">✕</span>
                                </button>
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none">
                                    <span className="text-xs font-bold text-app-fg uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Görsel Yüklendi</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-6 bg-app-bg/50 p-4 rounded-xl border border-app-border">
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="schedule-toggle" className="text-xs font-bold text-app-subtle uppercase tracking-wider flex items-center gap-2">
                                ⏰ Mesajı Zamanla
                            </label>
                            <input
                                id="schedule-toggle"
                                title="Mesajı zamanla"
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
                                title="Mesaj gönderim zamanı"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                className="w-full bg-app-card border border-app-border rounded-lg px-3 py-2 text-app-fg text-sm outline-none focus:ring-1 focus:ring-purple-500"
                                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                            />
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={sending || (!message.trim() && !mediaUrl) || selectedCustomers.length === 0 || (!isScheduled && !isConnected) || (!isScheduled && hasActiveJob)}
                        className={`w-full py-4 text-app-fg font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95 ${isScheduled
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20"
                            : "bg-gradient-to-r from-purple-600 to-pink-600 shadow-purple-500/20"
                            }`}
                    >
                        {sending ? "⏳ İşlem Yapılıyor..." :
                            isScheduled ? `⏰ ${selectedCustomers.length} Kişiye Zamanla` :
                                hasActiveJob ? "Önce Mevcut Gönderimi Tamamla" :
                                    `🚀 ${selectedCustomers.length} Kişiye Gönder`}
                    </button>

                    <p className="mt-4 text-xs text-app-subtle text-center italic">
                        * Gönderim arka planda yapılır. Günlük 500 sınırına gelirse otomatik durur ve kaldığı alıcıdan devam eder.
                    </p>
                </div>
            </div>
        </div>
    );
}
