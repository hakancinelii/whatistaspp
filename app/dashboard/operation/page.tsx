"use client";

import { useEffect, useState, useRef } from "react";
import { useNotification } from "@/context/NotificationContext";

interface InboxMessage {
    id: string | number;
    phone_number: string;
    name: string;
    content: string;
    media_url?: string;
    media_type?: string;
    received_at: string;
    timestamp: string;
    is_read: boolean;
    is_from_me: boolean;
}

interface Reservation {
    id: number;
    voucher_number: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    driver_id: number | null;
    driver_phone: string | null;
    date: string;
    time: string;
    pickup_location: string;
    dropoff_location: string;
    status: string;
    price: number;
    currency: string;
    flight_code: string | null;
    passenger_count: number;
    passenger_names: string; // JSON
    notes: string | null;
}

export default function OperationPage() {
    const { showNotification } = useNotification();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editRes, setEditRes] = useState<Reservation | null>(null);
    const [assigningRes, setAssigningRes] = useState<Reservation | null>(null);
    const [driverPhoneInput, setDriverPhoneInput] = useState("");
    const [sendingVoucher, setSendingVoucher] = useState<{ id: number, target: string } | null>(null);

    const [viewMode, setViewMode] = useState<'grid' | 'whatsapp'>('grid');
    const [user, setUser] = useState<any>(null);
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [pinnedChats, setPinnedChats] = useState<number[]>([]);

    // Inbox Messages & Translation States
    const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
    const [replyText, setReplyText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [detectedLanguages, setDetectedLanguages] = useState<Record<string, string>>({});
    const [isTranslating, setIsTranslating] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const atBottom = scrollHeight - scrollTop - clientHeight < 100;
            setIsAtBottom(atBottom);
        }
    };

    // Initial load for pinned items from local storage
    useEffect(() => {
        const savedPins = localStorage.getItem('pinnedReservations');
        if (savedPins) setPinnedChats(JSON.parse(savedPins));

        const token = localStorage.getItem("token");
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split(".")[1]));
                setUser(payload);
            } catch (e) { }
        }
    }, []);

    const togglePin = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const newPins = pinnedChats.includes(id)
            ? pinnedChats.filter(pinId => pinId !== id)
            : [...pinnedChats, id];
        setPinnedChats(newPins);
        localStorage.setItem('pinnedReservations', JSON.stringify(newPins));
    };

    const whatsappReservations = (() => {
        let filtered = reservations.filter(res => {
            const searchLower = searchQuery.toLowerCase();
            return (
                res.customer_name?.toLowerCase().includes(searchLower) ||
                res.voucher_number?.toLowerCase().includes(searchLower) ||
                res.pickup_location?.toLowerCase().includes(searchLower) ||
                res.dropoff_location?.toLowerCase().includes(searchLower) ||
                res.driver_phone?.toString().includes(searchLower)
            );
        });

        // Sort: Pinned first, then Pending, then Date
        return filtered.sort((a, b) => {
            const isAPinned = pinnedChats.includes(a.id);
            const isBPinned = pinnedChats.includes(b.id);
            if (isAPinned && !isBPinned) return -1;
            if (!isAPinned && isBPinned) return 1;
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime();
        });
    })();

    const activeChat = reservations.find(r => r.id === selectedChatId);

    // Default values for new reservation
    const getDefaults = () => {
        const now = new Date();
        const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
        return {
            customerName: "",
            customerPhone: "",
            date: now.toISOString().split('T')[0],
            time: inOneHour.toTimeString().slice(0, 5),
            pickup: "",
            dropoff: "",
            flightCode: "",
            passengers: 1,
            passengerNames: [""],
            price: "",
            currency: "USD",
            notes: "",
            status: "pending"
        };
    };

    const [newRes, setNewRes] = useState(getDefaults());

    useEffect(() => {
        fetchData();
        fetchInboxMessages(); // Initial fetch
        const msgInterval = setInterval(fetchInboxMessages, 5000); // Poll every 5 seconds
        return () => clearInterval(msgInterval);
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (chatEndRef.current && viewMode === 'whatsapp' && selectedChatId && isAtBottom) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [inboxMessages, selectedChatId, viewMode, isAtBottom]);

    const fetchInboxMessages = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/inbox", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setInboxMessages(data.messages || []);
            }
        } catch (error) {
            console.error("Failed to fetch inbox messages:", error);
        }
    };

    // Get messages for the currently selected reservation's customer
    const getMessagesForActiveChat = () => {
        if (!activeChat) return [];
        const customerPhone = activeChat.customer_phone?.replace(/[^0-9]/g, '');
        return inboxMessages
            .filter(m => m.phone_number?.replace(/[^0-9]/g, '').includes(customerPhone) || customerPhone?.includes(m.phone_number?.replace(/[^0-9]/g, '')))
            .reverse(); // Show oldest first
    };

    // Translate a message
    const translateMessage = async (msgId: string | number, text: string) => {
        if (translations[String(msgId)] || isTranslating === String(msgId)) return;
        setIsTranslating(String(msgId));
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/ai/translate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text, targetLanguage: 'Türkçe' })
            });
            if (res.ok) {
                const data = await res.json();
                setTranslations(prev => ({ ...prev, [String(msgId)]: data.translation }));
            }
        } catch (e) {
            console.error("Translation error:", e);
        } finally {
            setIsTranslating(null);
        }
    };

    // Send a reply message
    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeChat || !replyText.trim() || isSending) return;

        setIsSending(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/messages/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    customerIds: [activeChat.customer_phone],
                    message: replyText,
                    isDirect: true
                })
            });
            if (res.ok) {
                setReplyText("");
                fetchInboxMessages(); // Refresh messages
                setIsAtBottom(true);
                showNotification("Mesaj gönderildi!", "success");
            } else {
                const err = await res.json();
                showNotification(err.error || "Mesaj gönderilemedi", "error");
            }
        } catch (error) {
            showNotification("Mesaj gönderilemedi", "error");
        } finally {
            setIsSending(false);
        }
    };

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/tourism/reservations", {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setReservations(data.reservations || []);
            }
        } catch (error) {
            console.error("Fetch failed", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddReservation = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/tourism/reservations", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newRes),
            });

            if (res.ok) {
                showNotification("Rezervasyon başarıyla oluşturuldu!", "success");
                setShowAddModal(false);
                setNewRes(getDefaults());
                fetchData();
            }
        } catch (error: any) {
            showNotification(error.message || "Rezervasyon oluşturulamadı.", "error");
        }
    };

    const handleUpdateReservation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editRes) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/tourism/reservations", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...editRes,
                    pickup: editRes.pickup_location,
                    dropoff: editRes.dropoff_location,
                    flightCode: editRes.flight_code,
                    passengers: editRes.passenger_count,
                    passengerNames: JSON.parse(editRes.passenger_names || '[]'),
                    driverPhone: editRes.driver_phone
                }),
            });

            if (res.ok) {
                showNotification("Rezervasyon başarıyla güncellendi!", "success");
                setEditRes(null);
                fetchData();
            }
        } catch (error) {
            showNotification("Güncelleme başarısız.", "error");
        }
    };

    const handleAssignDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assigningRes || !driverPhoneInput) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/tourism/reservations", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "assign_driver",
                    reservationId: assigningRes.id,
                    driverPhone: driverPhoneInput
                }),
            });

            if (res.ok) {
                showNotification("Sürücü başarıyla atandı!", "success");
                setAssigningRes(null);
                setDriverPhoneInput("");
                fetchData();
            } else {
                const err = await res.json();
                showNotification(err.error || "Atama başarısız.", "error");
            }
        } catch (error) {
            showNotification("Atama başarısız.", "error");
        }
    };

    const handleSendVoucher = async (reservationId: number, target: 'customer' | 'driver') => {
        setSendingVoucher({ id: reservationId, target });
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/tourism/reservations/send-voucher", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ reservationId, target }),
            });

            if (res.ok) {
                showNotification(`Voucher ${target === 'driver' ? 'sürücüye' : 'müşteriye'} gönderildi!`, "success");
            } else {
                const err = await res.json();
                showNotification(err.error || "Gönderim başarısız.", "error");
            }
        } catch (error) {
            showNotification("Bir hata oluştu.", "error");
        } finally {
            setSendingVoucher(null);
        }
    };

    const handleDeleteReservation = async (id: number) => {
        if (!confirm("Bu rezervasyonu silmek istediğinize emin misiniz?")) return;
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/tourism/reservations", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ reservationId: id }),
            });

            if (res.ok) {
                showNotification("Rezervasyon silindi.", "info");
                fetchData();
            }
        } catch (error) {
            showNotification("Silme başarısız.", "error");
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
            default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    const formatDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        const months = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
        return { day: d, month: months[parseInt(m) - 1] };
    };

    return (
        <div className="fade-in">
            {/* Top Bar for View Switcher */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">
                        {viewMode === 'grid' ? 'Operasyon Merkezi' : 'WhatsApp Operasyon'}
                    </h1>
                    <p className="text-app-muted text-sm mt-1">
                        {viewMode === 'grid' ? 'Turizm transfer ve tur operasyonlarınızı buradan yönetin.' : 'Hızlı iletişim ve yönetim modu.'}
                    </p>
                </div>
                <div className="flex bg-app-card p-1 rounded-xl border border-app-border">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-app-elevated text-app-fg shadow-lg' : 'text-app-muted hover:text-app-fg'}`}
                    >
                        <span>📋</span> Panel
                    </button>
                    <button
                        onClick={() => setViewMode('whatsapp')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'whatsapp' ? 'bg-[#00a884] text-app-fg shadow-lg' : 'text-app-muted hover:text-app-fg'}`}
                    >
                        <span>💬</span> WhatsApp
                    </button>
                </div>
            </div>

            {viewMode === 'grid' ? (
                // --- CLASSIC GRID VIEW ---
                <>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => {
                                setEditRes(null);
                                setShowAddModal(true);
                            }}
                            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-sm"
                        >
                            <span>+</span> Yeni Rezervasyon
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {reservations.map((res) => (
                            <div key={res.id} className="bg-[#1e293b] border border-app-border/50 rounded-3xl p-6 hover:border-app-border transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-bl-full -mr-10 -mt-10 transition-all group-hover:scale-110"></div>

                                {/* Header */}
                                <div className="flex items-start justify-between mb-6 relative">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xl shadow-inner border border-app-border/60">
                                            {formatDate(res.date).day}
                                            <span className="text-xs block -mt-1 text-app-muted uppercase">{formatDate(res.date).month}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-app-subtle bg-app-card/70 px-2 py-0.5 roundedElement">{res.voucher_number}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusStyle(res.status)}`}>
                                                    {res.status === 'confirmed' ? 'Onaylandı' : res.status === 'pending' ? 'Bekliyor' : 'İptal'}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-app-fg text-lg mt-1">{res.customer_name}</h3>
                                            <p className="text-xs text-app-muted">{res.customer_phone}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="space-y-4 relative">
                                    <div className="bg-app-bg/50 rounded-2xl p-4 border border-app-border/60 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <span className="text-app-subtle mt-1">📍</span>
                                            <div>
                                                <p className="text-xs text-app-subtle uppercase font-black tracking-wider">KARŞILAMA</p>
                                                <p className="text-sm font-medium text-app-fg">{res.pickup_location}</p>
                                                <p className="text-xs text-amber-500 font-mono mt-0.5">🕔 {res.time}</p>
                                            </div>
                                        </div>
                                        <div className="w-full h-px bg-app-card/70 border-t border-dashed border-gray-700"></div>
                                        <div className="flex items-start gap-3">
                                            <span className="text-app-subtle mt-1">🏁</span>
                                            <div>
                                                <p className="text-xs text-app-subtle uppercase font-black tracking-wider">VARIŞ</p>
                                                <p className="text-sm font-medium text-app-fg">{res.dropoff_location}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-2">
                                            {res.flight_code && (
                                                <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20">✈️ {res.flight_code}</span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-app-subtle font-black uppercase tracking-wider">FİYAT</p>
                                            <p className="text-lg font-bold text-app-fg">{res.price} <span className="text-sm text-app-muted">{res.currency}</span></p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-6 pt-4 border-t border-app-border/60">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSendVoucher(res.id, 'customer')}
                                                disabled={sendingVoucher?.id === res.id}
                                                className="flex-1 px-4 py-2 bg-app-card hover:bg-app-elevated text-app-muted text-[11px] font-black rounded-xl border border-app-border/70 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>{sendingVoucher?.id === res.id && sendingVoucher.target === 'customer' ? '⌛' : '📩'}</span>
                                                Müşteri Voucher
                                            </button>
                                            {(res.driver_phone && res.driver_phone.trim() !== "") ? (
                                                <button
                                                    onClick={() => handleSendVoucher(res.id, 'driver')}
                                                    disabled={sendingVoucher?.id === res.id}
                                                    className="px-4 py-2 bg-blue-500/10 text-blue-400 text-[11px] font-black rounded-xl border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span>👨‍✈️</span>
                                                    Şoför Voucher
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setAssigningRes(res);
                                                        setDriverPhoneInput("");
                                                    }}
                                                    className="px-4 py-2 bg-amber-500/10 text-amber-400 text-[11px] font-black rounded-xl border border-amber-500/20 hover:bg-amber-500/30 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span>➕</span> Sürücü Ata
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center gap-2">
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditRes(res); setShowAddModal(true); }} className="w-8 h-8 rounded-lg bg-app-card hover:bg-app-elevated text-app-muted flex items-center justify-center transition-colors">✏️</button>
                                                <button onClick={() => handleDeleteReservation(res.id)} className="w-8 h-8 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-500 flex items-center justify-center transition-colors">🗑️</button>
                                            </div>
                                        </div>
                                    </div>
                                    {res.driver_phone && (
                                        <div className="mt-4 pt-4 border-t border-app-border/60 flex items-center justify-between">
                                            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                Atanan Sürücü: +{res.driver_phone}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setAssigningRes(res);
                                                    setDriverPhoneInput(res.driver_phone || "");
                                                }}
                                                className="text-xs text-app-subtle hover:text-app-fg transition-colors"
                                            >
                                                Değiştir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                // --- WHATSAPP VIEW ---
                <div className="flex h-[80vh] bg-[#111b21] border border-gray-700 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Left List */}
                    <div className="w-[380px] border-r border-[#202c33] flex flex-col bg-[#111b21]">
                        {/* Header */}
                        <div className="h-[60px] bg-[#202c33] flex items-center justify-between px-4 border-b border-gray-800">
                            <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden">
                                <img src={`https://ui-avatars.com/api/?name=${user?.name || 'A'}&background=random`} alt="user" />
                            </div>
                            <div className="flex gap-4 text-app-muted">
                                <button onClick={() => { setEditRes(null); setShowAddModal(true); }} className="hover:text-app-fg" title="Yeni Rezervasyon">➕</button>
                                <button onClick={() => window.location.href = '/dashboard/settings'} className="hover:text-app-fg" title="Ayarlar">⋮</button>
                            </div>
                        </div>
                        {/* Search */}
                        <div className="p-3 bg-[#111b21] border-b border-[#202c33]">
                            <div className="bg-[#202c33] rounded-lg flex items-center px-3 py-1.5">
                                <span className="text-app-subtle mr-3">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Aratın ve yeni sohbet başlatın"
                                    className="bg-transparent border-none outline-none text-sm text-app-muted w-full placeholder:text-app-subtle"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        {/* Chat List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {whatsappReservations.map((res: any) => {
                                const isSelected = selectedChatId === res.id;
                                const isPinned = pinnedChats.includes(res.id);
                                return (
                                    <div
                                        key={res.id}
                                        onClick={() => { setSelectedChatId(res.id); setIsAtBottom(true); }}
                                        className={`flex items-center p-3 cursor-pointer border-b border-[#202c33] hover:bg-[#202c33] transition-colors group ${isSelected ? 'bg-[#2a3942]' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-[#dfe4e7] flex items-center justify-center flex-shrink-0 text-[#111b21] font-bold text-lg relative">
                                            {res.customer_name.charAt(0)}
                                            {/* Status Indicator */}
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111b21] ${res.status === 'confirmed' ? 'bg-green-500' : res.status === 'pending' ? 'bg-amber-500' : 'bg-gray-500'}`}></div>
                                        </div>
                                        <div className="ml-3 flex-1 overflow-hidden">
                                            <div className="flex justify-between items-baseline">
                                                <h3 className="text-[#e9edef] text-base truncate font-normal">{res.customer_name}</h3>
                                                <span className={`text-xs ${res.status === 'pending' ? 'text-[#00a884] font-bold' : 'text-[#8696a0]'}`}>
                                                    {res.time}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <p className="text-[#8696a0] text-xs truncate flex-1">
                                                    {res.pickup_location} ➔ {res.dropoff_location}
                                                </p>
                                                <div className="flex gap-1 ml-2">
                                                    {isPinned && <span className="text-[#8696a0] text-xs transform rotate-45">📌</span>}
                                                    <button
                                                        onClick={(e) => togglePin(e, res.id)}
                                                        className={`text-[#8696a0] opacity-0 group-hover:opacity-100 hover:text-app-fg px-1 ${isPinned ? 'opacity-100' : ''}`}
                                                    >
                                                        {isPinned ? '✕' : '📌'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right Chat Area */}
                    <div className="flex-1 flex flex-col bg-[#0b141a] relative">
                        {/* Default State BG */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>

                        {activeChat ? (
                            <>
                                {/* Chat Header */}
                                <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between border-b border-gray-800 z-10">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-full bg-[#dfe4e7] flex items-center justify-center text-[#111b21] font-bold text-lg">
                                            {activeChat.customer_name.charAt(0)}
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-[#e9edef] font-medium">{activeChat.customer_name}</h3>
                                            <span className="text-[#8696a0] text-xs truncate">
                                                {activeChat.customer_phone} • {activeChat.date}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-[#8696a0]">
                                        <button onClick={() => handleDeleteReservation(activeChat.id)} title="Rezervasyonu Sil" className="hover:text-red-400">🗑️</button>
                                        <button title="Ara" className="hover:text-app-fg">🔍</button>
                                        <button title="Ayarlar" className="hover:text-app-fg">⋮</button>
                                    </div>
                                </div>

                                {/* Chat Body */}
                                <div
                                    ref={messagesContainerRef}
                                    onScroll={handleScroll}
                                    className="flex-1 overflow-y-auto p-4 space-y-4 z-10 custom-scrollbar"
                                >
                                    <div className="flex justify-center mb-4">
                                        <span className="bg-[#1f2c34] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg shadow-sm">
                                            🔒 Mesajlar uçtan uca şifrelidir. 🌍 Çeviri için mesaja tıklayın.
                                        </span>
                                    </div>

                                    {/* Reservation Info Card */}
                                    <div className="flex gap-2 justify-end">
                                        <div className="bg-[#005c4b] p-3 rounded-lg rounded-tr-none max-w-[70%] text-[#e9edef] text-sm shadow-sm relative">
                                            <p className="text-xs text-[#25d366]/80 font-bold mb-1">📋 Rezervasyon Bilgisi</p>
                                            <div className="space-y-1 text-xs">
                                                <p>📍 {activeChat.pickup_location} → {activeChat.dropoff_location}</p>
                                                <p>📅 {activeChat.date} {activeChat.time} • 👥 {activeChat.passenger_count} kişi</p>
                                                <p>💰 {activeChat.price} {activeChat.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Real Messages from Inbox */}
                                    {getMessagesForActiveChat().length > 0 ? (
                                        getMessagesForActiveChat().map((msg) => (
                                            <div key={`${msg.id}-${msg.timestamp}`} className={`flex gap-2 ${msg.is_from_me ? 'justify-end' : ''}`}>
                                                <div
                                                    className={`p-3 rounded-lg max-w-[70%] text-sm shadow-sm relative group cursor-pointer ${msg.is_from_me
                                                        ? 'bg-[#005c4b] rounded-tr-none text-[#e9edef]'
                                                        : 'bg-[#202c33] rounded-tl-none text-[#e9edef]'
                                                        }`}
                                                    onClick={() => !msg.is_from_me && msg.content && translateMessage(msg.id, msg.content)}
                                                >
                                                    {/* Media Content */}
                                                    {msg.media_type === 'audio' && (
                                                        <div className="min-w-[200px] py-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-lg">🎤</span>
                                                                <span className="text-xs font-medium">{msg.is_from_me ? 'Sesli Mesaj' : 'Sesli Mesaj'}</span>
                                                            </div>
                                                            <audio controls className="h-8 w-full">
                                                                <source src={msg.media_url} />
                                                            </audio>
                                                        </div>
                                                    )}
                                                    {msg.media_type === 'image' && (
                                                        <img
                                                            src={msg.media_url}
                                                            alt="Media"
                                                            className="rounded-lg max-h-[200px] w-auto mb-2 cursor-pointer hover:opacity-80"
                                                            onClick={(e) => { e.stopPropagation(); window.open(msg.media_url, '_blank'); }}
                                                        />
                                                    )}

                                                    {/* Text Content */}
                                                    {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

                                                    {/* Translation */}
                                                    {translations[String(msg.id)] && (
                                                        <div className="mt-2 pt-2 border-t border-app-border/70">
                                                            <p className="text-xs text-[#00a884] font-medium mb-0.5">🌍 Türkçe Çeviri:</p>
                                                            <p className="text-sm opacity-90">{translations[String(msg.id)]}</p>
                                                        </div>
                                                    )}

                                                    {/* Translate Loading */}
                                                    {isTranslating === String(msg.id) && (
                                                        <div className="text-xs text-[#8696a0] mt-1 animate-pulse">Çevriliyor...</div>
                                                    )}

                                                    {/* Translate Hint for incoming messages */}
                                                    {!msg.is_from_me && msg.content && !translations[String(msg.id)] && (
                                                        <div className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <span className="bg-[#00a884] text-app-fg text-xs px-1.5 py-0.5 rounded-full">🌍</span>
                                                        </div>
                                                    )}

                                                    {/* Timestamp */}
                                                    <span className="text-xs text-[#8696a0] block text-right mt-1 flex justify-end gap-1 items-center">
                                                        {new Date(msg.received_at || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {msg.is_from_me && <span className="text-[#53bdeb]">✓✓</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex justify-center my-4">
                                            <span className="bg-[#1f2c34] text-[#8696a0] text-xs px-4 py-2 rounded-lg">
                                                Bu müşteriyle henüz mesaj geçmişi yok
                                            </span>
                                        </div>
                                    )}

                                    {/* System: Driver Assigned */}
                                    {activeChat.driver_phone && (
                                        <div className="flex justify-center my-2">
                                            <span className="bg-[#1f2c34] text-[#ffd279] text-xs px-4 py-1.5 rounded-lg shadow-sm border border-yellow-500/20 text-center">
                                                👨‍✈️ Sürücü Atandı: +{activeChat.driver_phone}
                                            </span>
                                        </div>
                                    )}

                                    {/* Action Prompt */}
                                    {activeChat.status === 'pending' && (
                                        <div className="flex justify-center my-2">
                                            <span className="bg-[#1f2c34] text-[#00a884] text-xs px-4 py-1.5 rounded-lg shadow-sm border border-emerald-500/20 text-center animate-pulse">
                                                ⚠️ Bu transfer için henüz sürücü atanmadı.
                                            </span>
                                        </div>
                                    )}

                                    <div ref={chatEndRef} />
                                </div>


                                {/* Chat Footer - Message Input */}
                                <div className="bg-[#202c33] p-3 z-10 border-t border-gray-800 space-y-3">
                                    {/* Message Input */}
                                    <form onSubmit={handleSendReply} className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setEditRes(activeChat); setShowAddModal(true); }}
                                            className="text-[#8696a0] hover:text-[#e9edef] text-lg" title="Düzenle"
                                        >
                                            ✏️
                                        </button>

                                        <input
                                            type="text"
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Mesaj yazın..."
                                            className="flex-1 bg-[#2a3942] border-none rounded-xl px-4 py-2.5 text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
                                        />

                                        <button
                                            type="submit"
                                            disabled={isSending || !replyText.trim()}
                                            className="bg-[#00a884] hover:bg-[#00c49a] disabled:opacity-50 disabled:hover:bg-[#00a884] text-app-fg w-10 h-10 rounded-full flex items-center justify-center transition-all"
                                        >
                                            {isSending ? '⏳' : '➤'}
                                        </button>
                                    </form>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                        {(activeChat.driver_phone && activeChat.driver_phone.trim() !== "") ? (
                                            <button
                                                onClick={() => handleSendVoucher(activeChat.id, 'driver')}
                                                disabled={sendingVoucher?.id === activeChat.id}
                                                className="bg-[#1e2a30] hover:bg-[#2a3942] text-[#00a884] px-4 py-2 rounded-lg text-sm font-medium border border-[#00a884]/30 flex-1 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                                            >
                                                <span>👨‍✈️ Şoför Voucher</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setAssigningRes(activeChat);
                                                    setDriverPhoneInput("");
                                                }}
                                                className="bg-[#1e2a30] hover:bg-[#2a3942] text-[#ffd279] px-4 py-2 rounded-lg text-sm font-medium border border-[#ffd279]/30 flex-1 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                                            >
                                                <span>➕ Sürücü Ata</span>
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleSendVoucher(activeChat.id, 'customer')}
                                            disabled={sendingVoucher?.id === activeChat.id}
                                            className="bg-[#1e2a30] hover:bg-[#2a3942] text-[#e9edef] px-4 py-2 rounded-lg text-sm font-medium border border-gray-600 flex-1 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                                        >
                                            <span>📩 Müşteri Voucher</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-[#8696a0] z-10">
                                <div className="w-64 h-64 opacity-50 bg-[url('https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae.svg')] bg-no-repeat bg-center"></div>
                                <h2 className="text-3xl font-light text-[#e9edef] mt-8">WhatsApp Web Operasyon</h2>
                                <p className="mt-4 text-sm text-center max-w-md">
                                    Sol taraftan bir rezervasyon seçerek detayları görüntüleyebilir, sürücü atayabilir veya voucher gönderebilirsiniz.
                                </p>
                                <div className="mt-8 pt-8 border-t border-[#202c33] text-xs flex gap-2 items-center">
                                    <span>🔒</span> Uçtan uca şifreli (gibi görünen) güvenli panel.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add / Edit Modal */}
            {(showAddModal || editRes) && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-[#1e293b] border border-app-border/70 rounded-[3rem] w-full max-w-4xl shadow-2xl relative my-auto">
                        <div className="p-8 md:p-12 border-b border-app-border/60 bg-gradient-to-r from-emerald-600/10 to-teal-600/10">
                            <h2 className="text-3xl font-black text-app-fg">{editRes ? 'Rezervasyonu Düzenle' : 'Yeni Transfer Rezervasyonu'}</h2>
                            <p className="text-app-muted text-sm mt-1">Lütfen transfer detaylarını eksiksiz doldurun.</p>
                            <button onClick={() => { setShowAddModal(false); setEditRes(null); }} className="absolute top-8 right-8 text-app-subtle hover:text-app-fg text-2xl font-bold transition-colors">✕</button>
                        </div>

                        <form onSubmit={editRes ? handleUpdateReservation : handleAddReservation} className="p-8 md:p-12 space-y-10">
                            {/* Section 1: Customer */}
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <span className="w-4 h-[2px] bg-emerald-400"></span> MÜŞTERİ BİLGİLERİ
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">İsim Soyisim</label>
                                            <input
                                                type="text" required
                                                value={editRes ? editRes.customer_name : newRes.customerName}
                                                onChange={e => editRes ? setEditRes({ ...editRes, customer_name: e.target.value }) : setNewRes({ ...newRes, customerName: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Telefon (WhatsApp)</label>
                                            <input
                                                type="text" required
                                                value={editRes ? editRes.customer_phone : newRes.customerPhone}
                                                onChange={e => editRes ? setEditRes({ ...editRes, customer_phone: e.target.value }) : setNewRes({ ...newRes, customerPhone: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-mono"
                                                placeholder="905xxxxxxxxx"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <span className="w-4 h-[2px] bg-blue-400"></span> ZAMAN & KONUM
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Tarih</label>
                                            <input
                                                type="date" required
                                                value={editRes ? editRes.date : newRes.date}
                                                onChange={e => editRes ? setEditRes({ ...editRes, date: e.target.value }) : setNewRes({ ...newRes, date: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Saat</label>
                                            <input
                                                type="time" required
                                                value={editRes ? editRes.time : newRes.time}
                                                onChange={e => editRes ? setEditRes({ ...editRes, time: e.target.value }) : setNewRes({ ...newRes, time: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Alış Noktası</label>
                                            <input
                                                type="text" required
                                                value={editRes ? editRes.pickup_location : newRes.pickup}
                                                onChange={e => editRes ? setEditRes({ ...editRes, pickup_location: e.target.value }) : setNewRes({ ...newRes, pickup: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                placeholder="Örn: Antalya Havalimanı"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Varış Noktası</label>
                                            <input
                                                type="text" required
                                                value={editRes ? editRes.dropoff_location : newRes.dropoff}
                                                onChange={e => editRes ? setEditRes({ ...editRes, dropoff_location: e.target.value }) : setNewRes({ ...newRes, dropoff: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                placeholder="Örn: Belek X Hotel"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Passengers & Pricing */}
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <span className="w-4 h-[2px] bg-purple-400"></span> YOLCU DETAYLARI
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Yolcu Sayısı</label>
                                            <input
                                                type="number" min="1" required
                                                value={editRes ? editRes.passenger_count : newRes.passengers}
                                                onChange={e => {
                                                    const count = parseInt(e.target.value) || 1;
                                                    if (editRes) {
                                                        const currentNames = JSON.parse(editRes.passenger_names || '[]');
                                                        const newNames = Array(count).fill("").map((_, i) => currentNames[i] || "");
                                                        setEditRes({ ...editRes, passenger_count: count, passenger_names: JSON.stringify(newNames) });
                                                    } else {
                                                        const newNames = Array(count).fill("").map((_, i) => newRes.passengerNames[i] || "");
                                                        setNewRes({ ...newRes, passengers: count, passengerNames: newNames });
                                                    }
                                                }}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Uçuş Kodu</label>
                                            <input
                                                type="text"
                                                value={editRes ? (editRes.flight_code || '') : newRes.flightCode}
                                                onChange={e => editRes ? setEditRes({ ...editRes, flight_code: e.target.value }) : setNewRes({ ...newRes, flightCode: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-purple-500/50 outline-none transition-all uppercase"
                                                placeholder="TK1234"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Yolcu İsimleri</label>
                                        {(editRes ? JSON.parse(editRes.passenger_names || '[]') : newRes.passengerNames).map((name: string, idx: number) => (
                                            <input
                                                key={idx}
                                                type="text"
                                                value={name}
                                                placeholder={`${idx + 1}. Yolcu İsmi`}
                                                onChange={e => {
                                                    if (editRes) {
                                                        const names = JSON.parse(editRes.passenger_names || '[]');
                                                        names[idx] = e.target.value;
                                                        setEditRes({ ...editRes, passenger_names: JSON.stringify(names) });
                                                    } else {
                                                        const names = [...newRes.passengerNames];
                                                        names[idx] = e.target.value;
                                                        setNewRes({ ...newRes, passengerNames: names });
                                                    }
                                                }}
                                                className="w-full bg-app-bg/40 border border-app-border/70 rounded-xl px-4 py-3 text-sm text-app-fg focus:ring-1 focus:ring-purple-500/50 outline-none mb-2"
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <span className="w-4 h-[2px] bg-amber-400"></span> FİYAT & NOTLAR
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Fiyat</label>
                                            <input
                                                type="text" required
                                                value={editRes ? editRes.price : newRes.price}
                                                onChange={e => editRes ? setEditRes({ ...editRes, price: parseFloat(e.target.value) || 0 }) : setNewRes({ ...newRes, price: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Döviz</label>
                                            <select
                                                value={editRes ? editRes.currency : newRes.currency}
                                                onChange={e => editRes ? setEditRes({ ...editRes, currency: e.target.value }) : setNewRes({ ...newRes, currency: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                            >
                                                <option value="USD">USD ($)</option>
                                                <option value="EUR">EUR (€)</option>
                                                <option value="TRY">TRY (₺)</option>
                                                <option value="GBP">GBP (£)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Operasyon Notları</label>
                                        <textarea
                                            rows={3}
                                            value={editRes ? (editRes.notes || '') : newRes.notes}
                                            onChange={e => editRes ? setEditRes({ ...editRes, notes: e.target.value }) : setNewRes({ ...newRes, notes: e.target.value })}
                                            className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-amber-500/50 outline-none transition-all resize-none"
                                            placeholder="Bagaj bilgisi, özel istekler vb."
                                        />
                                    </div>
                                    {editRes && (
                                        <div>
                                            <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Durum</label>
                                            <select
                                                value={editRes.status}
                                                onChange={e => setEditRes({ ...editRes, status: e.target.value })}
                                                className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                            >
                                                <option value="pending">Bekliyor</option>
                                                <option value="confirmed">Onaylandı</option>
                                                <option value="cancelled">İptal Edildi</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-6 pt-10 border-t border-app-border/60">
                                <button type="button" onClick={() => { setShowAddModal(false); setEditRes(null); }} className="flex-1 py-5 bg-app-card text-app-muted font-black rounded-3xl hover:bg-app-elevated hover:text-app-fg transition-all uppercase tracking-widest">İptal</button>
                                <button type="submit" className="flex-[2] py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-3xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-600/20 uppercase tracking-[0.2em]">
                                    {editRes ? 'GÜNCELLEMEYİ KAYDET' : 'REZERVASYONU OLUŞTUR'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Driver Modal */}
            {assigningRes && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
                    <div className="bg-[#1e293b] border border-app-border/70 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
                        <div className="p-8 border-b border-app-border/60 bg-gradient-to-r from-amber-600/10 to-orange-600/10">
                            <h2 className="text-2xl font-black text-app-fg">Sürücü Görevlendir</h2>
                            <p className="text-app-muted text-sm mt-1">{assigningRes.customer_name} - {assigningRes.voucher_number}</p>
                            <button onClick={() => setAssigningRes(null)} className="absolute top-8 right-8 text-app-subtle hover:text-app-fg text-xl">✕</button>
                        </div>
                        <form onSubmit={handleAssignDriver} className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-black text-app-subtle uppercase mb-2 ml-1">Sürücü WhatsApp Numarası</label>
                                <input
                                    type="text" required autoFocus
                                    value={driverPhoneInput}
                                    onChange={e => setDriverPhoneInput(e.target.value)}
                                    className="w-full bg-app-bg/60 border border-app-border/70 rounded-2xl px-5 py-4 text-app-fg focus:ring-2 focus:ring-amber-500/50 outline-none transition-all font-mono"
                                    placeholder="905xxxxxxxxx"
                                />
                                <p className="text-xs text-app-subtle mt-2 px-1">Başına ülke kodunu (90 gibi) eklemeyi unutmayın.</p>
                            </div>
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setAssigningRes(null)} className="flex-1 py-4 bg-app-card text-app-muted font-black rounded-2xl hover:bg-app-elevated transition-all uppercase text-xs">İptal</button>
                                <button type="submit" className="flex-[2] py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-amber-600/20 uppercase text-xs">ATAMAYI TAMAMLA</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(168, 85, 247, 0.3);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
