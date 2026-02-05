"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotification } from "@/context/NotificationContext";

interface IncomingMessage {
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
    profile_picture_url?: string;
    bio_status?: string;
}

export default function InboxPage() {
    const router = useRouter();
    const { showNotification } = useNotification();
    const [messages, setMessages] = useState<IncomingMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [waConnected, setWaConnected] = useState(true);
    const [selectedContact, setSelectedContact] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiReplies, setAiReplies] = useState<string[]>([]);
    const [user, setUser] = useState<any>(null);
    const [showResModal, setShowResModal] = useState(false);
    const [isParsingAI, setIsParsingAI] = useState(false);
    const [reservationData, setReservationData] = useState({
        customerName: "",
        customerPhone: "",
        date: "",
        time: "",
        pickup: "",
        dropoff: "",
        flightCode: "",
        price: "0",
        currency: "TRY",
        notes: ""
    });

    // Translation states
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [isTranslating, setIsTranslating] = useState<string | null>(null);
    const [translatedReply, setTranslatedReply] = useState("");
    const [isTranslatingReply, setIsTranslatingReply] = useState(false);
    const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (showResModal && selectedContact) {
            const contact = contacts.find(c => c.phone === selectedContact);
            setReservationData(prev => ({
                ...prev,
                customerPhone: selectedContact,
                customerName: contact?.name || ""
            }));

            // AI ile mesajı analiz et
            if (user?.package === 'platinum') {
                parseReservationWithAI();
            }
        }
    }, [showResModal, selectedContact]);

    const parseReservationWithAI = async () => {
        setIsParsingAI(true);
        try {
            const token = localStorage.getItem("token");
            const chatHistory = messages
                .filter(m => m.phone_number === selectedContact)
                .slice(-10)
                .map(m => `${m.is_from_me ? 'Ben' : 'Müşteri'}: ${m.content}`)
                .join('\n');

            const res = await fetch("/api/ai/parse-reservation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ chatHistory }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.info) {
                    setReservationData(prev => ({
                        ...prev,
                        ...data.info
                    }));
                }
            }
        } catch (e) {
            console.error("AI parsing failed", e);
        } finally {
            setIsParsingAI(false);
        }
    };

    const handleCreateReservation = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/tourism/reservations", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(reservationData),
            });

            if (res.ok) {
                showNotification("Rezervasyon başarıyla oluşturuldu!", "success");
                setShowResModal(false);
            } else {
                const err = await res.json();
                showNotification(err.error || "Hata oluştu.", "error");
            }
        } catch (error) {
            showNotification("Bir hata oluştu.", "error");
        }
    };

    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds for better real-time feel

        // Handle visibility change (tab focus) to refresh immediately
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchMessages();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        // Only scroll if user is at bottom
        if (chatEndRef.current && isAtBottom) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isAtBottom]); // Messages change handles scroll

    useEffect(() => {
        if (selectedContact) {
            markAsRead(selectedContact);
            // Detect language of the last incoming message
            detectContactLanguage();
        }
    }, [selectedContact]); // ONLY when contact changes, not on every message update

    // Handle scroll to track if user is at bottom
    const handleScroll = () => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const atBottom = scrollHeight - scrollTop - clientHeight < 100;
            setIsAtBottom(atBottom);
        }
    };

    // Detect language of the conversation partner
    const detectContactLanguage = async () => {
        const incomingMsgs = messages.filter(m => m.phone_number === selectedContact && !m.is_from_me && m.content);
        if (incomingMsgs.length === 0) return;

        const lastMsg = incomingMsgs[0];
        // Simple detection based on content
        const isTurkish = /[şğüçöıİĞÜŞÖÇ]/.test(lastMsg.content);
        if (!isTurkish) {
            // Detect language via API
            try {
                const token = localStorage.getItem("token");
                const res = await fetch("/api/ai/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ text: lastMsg.content, detectOnly: true })
                });
                if (res.ok) {
                    const data = await res.json();
                    setDetectedLanguage(data.detectedLanguage);
                }
            } catch (e) { }
        } else {
            setDetectedLanguage('tr');
        }
    };

    // Translate a single message to Turkish
    const translateMessage = async (msgId: string | number, text: string) => {
        if (translations[String(msgId)] || isTranslating === String(msgId)) return;
        setIsTranslating(String(msgId));
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/ai/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

    // Translate reply to detected language
    const translateReplyToTargetLang = async () => {
        if (!replyText.trim() || !detectedLanguage || detectedLanguage === 'tr' || isTranslatingReply) return;
        setIsTranslatingReply(true);
        try {
            const langNames: Record<string, string> = {
                'en': 'İngilizce', 'de': 'Almanca', 'fr': 'Fransızca', 'ar': 'Arapça',
                'ru': 'Rusça', 'es': 'İspanyolca', 'it': 'İtalyanca', 'nl': 'Hollandaca'
            };
            const targetLang = langNames[detectedLanguage] || 'İngilizce';

            const token = localStorage.getItem("token");
            const res = await fetch("/api/ai/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ text: replyText, targetLanguage: targetLang })
            });
            if (res.ok) {
                const data = await res.json();
                setTranslatedReply(data.translation);
            }
        } catch (e) {
            console.error("Reply translation error:", e);
        } finally {
            setIsTranslatingReply(false);
        }
    };

    // Use translated reply
    const useTranslatedReply = () => {
        if (translatedReply) {
            setReplyText(translatedReply);
            setTranslatedReply("");
        }
    };

    const markAsRead = async (phone: string) => {
        try {
            const token = localStorage.getItem("token");
            await fetch("/api/inbox/mark-read", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ phone_number: phone }),
            });
            // Local state'i anında güncelle ki gecikme olmasın
            setMessages(prev => prev.map(m => m.phone_number === phone ? { ...m, is_read: true } : m));
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem("token");

            // Fetch messages and WA status in parallel
            const [msgRes, statusRes] = await Promise.all([
                fetch("/api/inbox", { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
                fetch("/api/whatsapp/status", { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
            ]);

            if (msgRes.status === 401 || statusRes.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            if (msgRes.ok) {
                const data = await msgRes.json();
                setMessages(data.messages || []);
            }

            if (statusRes.ok) {
                const status = await statusRes.json();
                setWaConnected(status.isConnected);
            }
        } catch (error) {
            console.error("Failed to fetch inbox/status:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async (e?: React.FormEvent, customBody?: any) => {
        if (e) e.preventDefault();
        if (!selectedContact) return;
        // Only block if sending a text message. Audio sets isSending manually.
        if (!customBody && isSending) return;

        // Prevent sending empty text messages
        if (!customBody && !replyText.trim()) return;

        if (!waConnected) {
            alert("WhatsApp bağlantısı aktif değil. Lütfen 'Ayarlar -> WhatsApp' sayfasından bağlantıyı kontrol edin.");
            setIsSending(false);
            return;
        }

        setIsSending(true);
        try {
            const token = localStorage.getItem("token");
            const body = customBody || {
                customerIds: [selectedContact],
                message: replyText,
                isDirect: true
            };

            console.log("[Inbox] Sending message:", body);

            const res = await fetch("/api/messages/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                if (!customBody) setReplyText("");
                fetchMessages();
            } else {
                const errorData = await res.json();
                console.error("[Inbox] Send failed:", errorData);
                alert(`Mesaj gönderilemedi: ${errorData.error || "Bilinmeyen hata"}`);
            }
        } catch (error) {
            console.error("Reply failed:", error);
        } finally {
            setIsSending(false);
        }
    };

    const generateAIResponse = async () => {
        if (!selectedContact || isGeneratingAI) return;

        setIsGeneratingAI(true);
        setAiReplies([]);

        try {
            const token = localStorage.getItem("token");
            const lastMsgs = messages
                .filter(m => m.phone_number === selectedContact)
                .slice(0, 5)
                .map(m => ({ content: m.content, is_from_me: m.is_from_me }));

            const res = await fetch("/api/ai/generate-reply", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ lastMessages: lastMsgs }),
            });

            if (res.ok) {
                const data = await res.json();
                setAiReplies(data.replies || []);
            } else {
                const err = await res.json();
                alert(err.error || "AI yanıt üretim hatası");
            }
        } catch (error) {
            console.error("AI Generation failed:", error);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // Voice Recording Logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Detect best supported mime type for PTT - Prefer OGG/Opus for WhatsApp compatibility
            const types = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
            const supportedType = types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
            console.log(`[Inbox] Recording with: ${supportedType}`);

            const recorder = new MediaRecorder(stream, { mimeType: supportedType });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                const finalDuration = recordingTime; // Capture the time before it resets
                const audioBlob = new Blob(chunks, { type: supportedType });
                await uploadAndSendAudio(audioBlob, supportedType, finalDuration);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start(1000); // Collect data in regular intervals
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Recording error:", err);
            alert("Mikrofon erişimi engellendi veya bulunamadı.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const uploadAndSendAudio = async (blob: Blob, mimeType: string, duration: number) => {
        setIsSending(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append('audio', blob);

            const uploadRes = await fetch("/api/upload/audio", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (uploadRes.ok) {
                const { url } = await uploadRes.json();
                await handleReply(undefined, {
                    customerIds: [selectedContact],
                    isDirect: true,
                    mediaUrl: url,
                    mediaType: 'audio',
                    mediaMimeType: mimeType,
                    duration: duration
                });
            }
        } catch (error) {
            console.error("Audio upload failed:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedContact) return;

        setIsSending(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append('image', file);

            const uploadRes = await fetch("/api/upload/image", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (uploadRes.ok) {
                const { url } = await uploadRes.json();
                await handleReply(undefined, {
                    customerIds: [selectedContact],
                    isDirect: true,
                    mediaUrl: url,
                    mediaType: 'image'
                });
            }
        } catch (error) {
            console.error("Image upload failed:", error);
        } finally {
            setIsSending(false);
            if (e.target) e.target.value = "";
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const contacts = Array.from(new Set(messages.map(m => m.phone_number))).map(phone => {
        const lastMsg = messages.find(m => m.phone_number === phone);
        return {
            phone,
            name: lastMsg?.name || "Bilinmeyen",
            lastContent: lastMsg?.content || "",
            lastDate: lastMsg?.received_at || "",
            profile_picture_url: lastMsg?.profile_picture_url,
            bio: lastMsg?.bio_status,
            unreadCount: messages.filter(m => m.phone_number === phone && !m.is_read).length
        };
    });

    const currentChat = messages.filter(m => m.phone_number === selectedContact).reverse();

    return (
        <div className="h-[calc(100vh-160px)] flex gap-4 fade-in overflow-hidden relative">
            {/* Contact List */}
            <div className={`w-full lg:w-80 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-xl ${selectedContact ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>💬</span> Mesajlar
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
                    {loading && messages.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 animate-pulse">Yükleniyor...</div>
                    ) : contacts.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Gelen mesaj yok</div>
                    ) : (
                        contacts.map((contact) => (
                            <div
                                key={contact.phone}
                                onClick={() => setSelectedContact(contact.phone)}
                                className={`p-4 cursor-pointer transition-all hover:bg-slate-700/30 flex items-center gap-3 ${selectedContact === contact.phone ? "bg-purple-500/10 border-l-4 border-purple-500" : "border-l-4 border-transparent"
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 shadow-lg">
                                    {contact.profile_picture_url ? (
                                        <img src={contact.profile_picture_url} alt={contact.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-sm">
                                            {contact.name[0]}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <span className="font-semibold text-white truncate text-sm">{contact.name}</span>
                                        <span className="text-[10px] text-gray-500">{new Date(contact.lastDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-gray-400 truncate pr-2">{contact.lastContent}</p>
                                        {contact.unreadCount > 0 && (
                                            <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                {contact.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Window */}
            <div className={`flex-1 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-xl relative ${!selectedContact ? 'hidden lg:flex' : 'flex'}`}>
                {!waConnected && (
                    <div className="bg-red-500/90 text-white px-4 py-2 flex justify-between items-center animate-in slide-in-from-top duration-500 z-10">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="text-xl">⚠️</span>
                            WhatsApp bağlantısı kesildi. Mesaj gönderemezsiniz.
                        </div>
                        <button
                            onClick={() => router.push('/dashboard/whatsapp')}
                            className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                        >
                            Bağlantıyı Onar
                        </button>
                    </div>
                )}
                {selectedContact ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedContact(null)}
                                    className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white"
                                >
                                    <span className="text-xl">⬅️</span>
                                </button>
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shadow-inner flex-shrink-0">
                                    {contacts.find(c => c.phone === selectedContact)?.profile_picture_url ? (
                                        <img src={contacts.find(c => c.phone === selectedContact)?.profile_picture_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                            {contacts.find(c => c.phone === selectedContact)?.name[0] || "?"}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white leading-none">{contacts.find(c => c.phone === selectedContact)?.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-gray-400">+{selectedContact}</span>
                                        {contacts.find(c => c.phone === selectedContact)?.bio && (
                                            <>
                                                <span className="text-[10px] text-gray-600">•</span>
                                                <span className="text-[10px] text-purple-400 italic truncate max-w-[200px]" title={contacts.find(c => c.phone === selectedContact)?.bio}>
                                                    {contacts.find(c => c.phone === selectedContact)?.bio}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowResModal(true)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-1 md:gap-2"
                                >
                                    <span>🚐</span> <span className="hidden sm:inline">Rezervasyon Oluştur</span><span className="sm:hidden">Rezerv.</span>
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={messagesContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"
                        >
                            {/* Language indicator */}
                            {detectedLanguage && detectedLanguage !== 'tr' && (
                                <div className="flex justify-center mb-2">
                                    <span className="bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full border border-purple-500/30">
                                        🌍 Algılanan dil: {detectedLanguage.toUpperCase()} • Mesajlara tıklayarak çevirebilirsiniz
                                    </span>
                                </div>
                            )}

                            {currentChat.map((msg) => (
                                <div key={`${msg.id}-${msg.received_at || msg.timestamp}`} className={`flex flex-col ${msg.is_from_me ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom duration-300`}>
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl shadow-md border cursor-pointer group relative ${msg.is_from_me
                                            ? "bg-purple-600 border-purple-500 text-white rounded-tr-none"
                                            : "bg-slate-700 border-slate-600 text-gray-100 rounded-tl-none"
                                            }`}
                                        onClick={() => !msg.is_from_me && msg.content && translateMessage(msg.id, msg.content)}
                                    >
                                        {/* Translate hint for incoming messages */}
                                        {!msg.is_from_me && msg.content && !translations[String(msg.id)] && (
                                            <div className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                                                <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-lg">🌍</span>
                                            </div>
                                        )}

                                        {msg.media_type === 'audio' ? (
                                            <div className="min-w-[200px] py-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xl">🎤</span>
                                                    <span className="text-xs font-semibold">{msg.is_from_me ? "Sesli Mesajınız" : "Sesli Mesaj"}</span>
                                                </div>
                                                <audio controls className="h-8 w-full brightness-90 contrast-125">
                                                    <source src={msg.media_url} />
                                                </audio>
                                            </div>
                                        ) : msg.media_type === 'image' ? (
                                            <div className="space-y-2">
                                                <img
                                                    src={msg.media_url}
                                                    alt="Media Content"
                                                    className="rounded-lg max-h-[300px] w-auto cursor-zoom-in hover:brightness-90 transition-all shadow-sm"
                                                    onClick={(e) => { e.stopPropagation(); window.open(msg.media_url, '_blank'); }}
                                                />
                                                {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                                            </div>
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        )}

                                        {/* Translation display */}
                                        {translations[String(msg.id)] && (
                                            <div className="mt-2 pt-2 border-t border-white/20">
                                                <p className="text-xs text-purple-200 font-medium mb-0.5">🌍 Türkçe:</p>
                                                <p className="text-sm opacity-90">{translations[String(msg.id)]}</p>
                                            </div>
                                        )}

                                        {/* Translation loading */}
                                        {isTranslating === String(msg.id) && (
                                            <div className="text-xs text-purple-200/70 mt-1 animate-pulse">Çevriliyor...</div>
                                        )}

                                        <span className={`text-[9px] mt-1 block text-right ${msg.is_from_me ? "text-purple-200" : "text-gray-400"}`}>
                                            {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        {/* AI Suggestions */}
                        {user?.package === 'platinum' && (
                            <div className="px-4 py-2 border-t border-slate-700/50 flex flex-wrap gap-2 bg-slate-900/40">
                                <button
                                    onClick={generateAIResponse}
                                    disabled={isGeneratingAI}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-300 rounded-lg border border-purple-500/30 hover:bg-purple-600/30 transition-all text-xs font-bold disabled:opacity-50"
                                >
                                    <span>{isGeneratingAI ? "⏳" : "🪄"}</span>
                                    {isGeneratingAI ? "Üretiliyor..." : "AI ile Yanıla"}
                                </button>
                                {aiReplies.map((reply, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setReplyText(reply)}
                                        className="px-3 py-1.5 bg-slate-700/50 text-gray-300 rounded-lg border border-slate-600/30 hover:bg-slate-700 transition-all text-[11px] max-w-[200px] truncate"
                                        title={reply}
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Reply Input */}
                        <div className="p-2 md:p-4 bg-slate-800/80 border-t border-slate-700">
                            {isRecording ? (
                                <div className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-3 animate-pulse border border-red-500/50">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <div className="w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full animate-ping" />
                                        <span className="text-red-500 font-bold text-xs md:text-base">Kayıt... {formatTime(recordingTime)}</span>
                                    </div>
                                    <button
                                        onClick={stopRecording}
                                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 md:px-6 md:py-1.5 rounded-lg text-[10px] md:text-sm font-bold transition-all active:scale-95"
                                    >
                                        BİTİR VE GÖNDER
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <form onSubmit={handleReply} className="flex gap-1 md:gap-2">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                id="image-upload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleImageSelect}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => document.getElementById('image-upload')?.click()}
                                                className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all active:scale-90 border border-slate-600 shadow-lg"
                                                title="Resim Gönder"
                                            >
                                                <span className="text-lg md:text-xl font-bold">+</span>
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl transition-all active:scale-95 shadow-lg border ${isRecording
                                                ? "bg-red-500 border-red-400 text-white animate-pulse"
                                                : "bg-purple-600 border-purple-500 text-white hover:bg-purple-500"
                                                }`}
                                        >
                                            <span className="text-lg md:text-2xl">{isRecording ? "⏹" : "🎤"}</span>
                                        </button>

                                        <input
                                            type="text"
                                            value={replyText}
                                            onChange={(e) => { setReplyText(e.target.value); setTranslatedReply(""); }}
                                            placeholder="Mesaj yazın..."
                                            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-3 md:px-4 py-2 md:py-3 text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all shadow-inner min-w-0"
                                        />

                                        {/* Translate button - only show if detected language is not Turkish */}
                                        {detectedLanguage && detectedLanguage !== 'tr' && replyText.trim() && (
                                            <button
                                                type="button"
                                                onClick={translateReplyToTargetLang}
                                                disabled={isTranslatingReply}
                                                className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 flex items-center justify-center bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded-xl transition-all active:scale-95 border border-purple-500/30"
                                                title={`${detectedLanguage.toUpperCase()} diline çevir`}
                                            >
                                                {isTranslatingReply ? '⏳' : '🌍'}
                                            </button>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isSending || (!replyText.trim() && !isRecording)}
                                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-3 md:px-6 py-2 md:py-3 rounded-xl text-sm md:text-base font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-purple-500/20 flex-shrink-0"
                                        >
                                            {isSending ? "..." : "Gönder"}
                                        </button>
                                    </form>

                                    {/* Translated reply preview */}
                                    {translatedReply && (
                                        <div className="mt-2 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-purple-300 font-medium">🌍 {detectedLanguage?.toUpperCase()} Çevirisi:</span>
                                                <button
                                                    onClick={useTranslatedReply}
                                                    className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded-lg transition-all"
                                                >
                                                    Kullan
                                                </button>
                                            </div>
                                            <p className="text-sm text-white">{translatedReply}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-12 text-center">
                        <div className="text-8xl mb-6 opacity-20">📩</div>
                        <h3 className="text-xl font-bold text-gray-400">Sohbet Başlatın</h3>
                        <p className="max-w-xs mt-2">Sol taraftan bir müşteri seçerek mesajlarını görebilir ve yanıtlayabilirsiniz.</p>
                    </div>
                )}
            </div>
            {/* Reservation Modal */}
            {
                showResModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                            <div className="p-8 border-b border-white/5 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">🚐 Talebi Rezervasyona Dönüştür</h2>
                                    <p className="text-gray-400 text-sm">WhatsApp üzerinden gelen talebi operasyon listesine kaydet.</p>
                                </div>
                                {isParsingAI && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 rounded-full border border-purple-500/30 animate-pulse">
                                        <span className="text-xs font-bold text-purple-400">✨ AI Analiz Ediyor...</span>
                                    </div>
                                )}
                            </div>
                            <form onSubmit={handleCreateReservation} className="p-8 grid md:grid-cols-2 gap-6">
                                <div className="col-span-2 md:col-span-1 space-y-4">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">Yolcu Bilgileri</h3>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">İsim Soyisim</label>
                                        <input type="text" required value={reservationData.customerName} onChange={e => setReservationData({ ...reservationData, customerName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">WhatsApp No</label>
                                        <input type="text" readOnly value={reservationData.customerPhone} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed text-sm" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">Fiyat</label>
                                            <input type="number" required value={reservationData.price} onChange={e => setReservationData({ ...reservationData, price: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all font-bold text-emerald-400" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">Birim</label>
                                            <select value={reservationData.currency} onChange={e => setReservationData({ ...reservationData, currency: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all">
                                                <option value="TRY">TRY</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="GBP">GBP</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 md:col-span-1 space-y-4">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">Transfer Detayları</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">Tarih</label>
                                            <input type="date" required value={reservationData.date} onChange={e => setReservationData({ ...reservationData, date: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">Saat</label>
                                            <input type="time" required value={reservationData.time} onChange={e => setReservationData({ ...reservationData, time: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all font-bold text-amber-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">Nereden (Alış)</label>
                                        <input type="text" required value={reservationData.pickup} onChange={e => setReservationData({ ...reservationData, pickup: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all" placeholder="Örn: Havalimanı" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">Nereye (Varış)</label>
                                        <input type="text" required value={reservationData.dropoff} onChange={e => setReservationData({ ...reservationData, dropoff: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all" placeholder="Örn: X Hotel" />
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-2 pt-2 border-t border-white/5">
                                    <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">Ek Notlar / Uçuş Kodu</label>
                                    <textarea
                                        value={reservationData.notes}
                                        onChange={e => setReservationData({ ...reservationData, notes: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all text-xs min-h-[60px]"
                                        placeholder="Uçuş kodu, valiz sayısı, bebek koltuğu vb..."
                                    />
                                </div>

                                <div className="col-span-2 flex gap-4 pt-4 border-t border-white/5">
                                    <button type="button" onClick={() => setShowResModal(false)} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl transition-all">İptal</button>
                                    <button type="submit" className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20">
                                        ✅ Rezervasyona Dönüştür
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
