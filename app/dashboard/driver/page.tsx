"use client";

import { useEffect, useState, useRef } from "react";

export default function DriverDashboard() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoCall, setAutoCall] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [minPrice, setMinPrice] = useState<number>(0);
    const [regionSearch, setRegionSearch] = useState("");
    const [isWakeLockActive, setIsWakeLockActive] = useState(false);
    const [waStatus, setWaStatus] = useState({ isConnected: false, isConnecting: false });
    const [showOnlyReady, setShowOnlyReady] = useState(false);
    const [showOnlyAirport, setShowOnlyAirport] = useState(false);
    const [showOnlyVip, setShowOnlyVip] = useState(false);
    const [loadingJobId, setLoadingJobId] = useState<number | null>(null);
    const [view, setView] = useState<'active' | 'history'>('active');

    // Gelişmiş Rota Ayarları
    const [showSettings, setShowSettings] = useState(false);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [jobMode, setJobMode] = useState<'all' | 'ready' | 'scheduled'>('all');
    const [actionMode, setActionMode] = useState<'manual' | 'auto'>('manual');
    const [isSaving, setIsSaving] = useState(false);
    const [rotaName, setRotaName] = useState("ROTA 1");

    const ISTANBUL_REGIONS = [
        // Avrupa Yakası
        { id: "İHL", label: "İstanbul Havalimanı (İHL)", side: "Avrupa", keywords: ["İHL", "IHL", "IST", "İST", "ISL", "İSL", "İGA", "IGA", "İSTANBUL HAVALİMANI", "YENİ HAVALİMANI"] },
        { id: "ARNAVUTKÖY", label: "Arnavutköy", side: "Avrupa", keywords: ["ARNAVUTKÖY"] },
        { id: "AVCILAR", label: "Avcılar", side: "Avrupa", keywords: ["AVCILAR"] },
        { id: "BAĞCILAR", label: "Bağcılar", side: "Avrupa", keywords: ["BAĞCILAR", "GÜNEŞLİ"] },
        { id: "BAHÇELİEVLER", label: "Bahçelievler", side: "Avrupa", keywords: ["BAHÇELİEVLER", "YENİBOSNA", "ŞİRİNEVLER"] },
        { id: "BAKIRKÖY", label: "Bakırköy", side: "Avrupa", keywords: ["BAKIRKÖY", "YEŞİLKÖY", "ATAKÖY", "FLORYA"] },
        { id: "BAŞAKŞEHİR", label: "Başakşehir", side: "Avrupa", keywords: ["BAŞAKŞEHİR", "KAYAŞEHİR"] },
        { id: "BAYRAMPAŞA", label: "Bayrampaşa", side: "Avrupa", keywords: ["BAYRAMPAŞA"] },
        { id: "BEŞİKTAŞ", label: "Beşiktaş", side: "Avrupa", keywords: ["BEŞİKTAŞ", "ORTAKÖY", "LEVENT", "ETİLER", "BEBEK"] },
        { id: "BEYLİKDÜZÜ", label: "Beylikdüzü", side: "Avrupa", keywords: ["BEYLİKDÜZÜ"] },
        { id: "BEYOĞLU", label: "Beyoğlu / Taksim", side: "Avrupa", keywords: ["BEYOĞLU", "TAKSİM", "GALATA", "KARAKÖY"] },
        { id: "BÜYÜKÇEKMECE", label: "Büyükçekmece", side: "Avrupa", keywords: ["BÜYÜKÇEKMECE"] },
        { id: "ESENLER", label: "Esenler", side: "Avrupa", keywords: ["ESENLER"] },
        { id: "ESENYURT", label: "Esanyurt", side: "Avrupa", keywords: ["ESENYURT"] },
        { id: "EYÜPSULTAN", label: "Eyüpsultan", side: "Avrupa", keywords: ["EYÜP", "GÖKTÜRK", "KEMERBURGAZ"] },
        { id: "FATİH", label: "Fatih / Aksaray", side: "Avrupa", keywords: ["FATİH", "AKSARAY", "KUMKAPI", "SULTANAHMET"] },
        { id: "GAZİOSMANPAŞA", label: "Gaziosmanpaşa", side: "Avrupa", keywords: ["GAZİOSMANPAŞA"] },
        { id: "GÜNGÖREN", label: "Güngören", side: "Avrupa", keywords: ["GÜNGÖREN"] },
        { id: "KAĞITHANE", label: "Kağıthane", side: "Avrupa", keywords: ["KAĞITHANE"] },
        { id: "KÜÇÜKÇEKMECE", label: "Küçükçekmece", side: "Avrupa", keywords: ["KÜÇÜKÇEKMECE", "HALKALI", "SEFAKÖY"] },
        { id: "SARIYER", label: "Sarıyer", side: "Avrupa", keywords: ["SARIYER", "MASLAK", "TARABYA", "İSTİNYE"] },
        { id: "SULTANGAZİ", label: "Sultangazi", side: "Avrupa", keywords: ["SULTANGAZİ"] },
        { id: "ŞİŞLİ", label: "Şişli", side: "Avrupa", keywords: ["ŞİŞLİ", "NİŞANTAŞI", "MECİDİYEKÖY"] },
        { id: "ZEYTİNBURNU", label: "Zeytinburnu", side: "Avrupa", keywords: ["ZEYTİNBURNU"] },

        // Anadolu Yakası
        { id: "SAW", label: "Sabiha Gökçen (SAW)", side: "Anadolu", keywords: ["SAW", "SABİHA"] },
        { id: "ATAŞEHİR", label: "Ataşehir", side: "Anadolu", keywords: ["ATAŞEHİR"] },
        { id: "BEYKOZ", label: "Beykoz", side: "Anadolu", keywords: ["BEYKOZ", "KAVACIK"] },
        { id: "ÇEKMEKÖY", label: "Çekmeköy", side: "Anadolu", keywords: ["ÇEKMEKÖY"] },
        { id: "KADIKÖY", label: "Kadıköy", side: "Anadolu", keywords: ["KADIKÖY", "GÖZTEPE", "BOSTANCI", "MODA"] },
        { id: "KARTAL", label: "Kartal", side: "Anadolu", keywords: ["KARTAL"] },
        { id: "MALTEPE", label: "Maltepe", side: "Anadolu", keywords: ["MALTEPE"] },
        { id: "PENDİK", label: "Pendik", side: "Anadolu", keywords: ["PENDİK"] },
        { id: "SANCAKTEPE", label: "Sancaktepe", side: "Anadolu", keywords: ["SANCAKTEPE"] },
        { id: "SULTANBEYLİ", label: "Sultanbeyli", side: "Anadolu", keywords: ["SULTANBEYLİ"] },
        { id: "TUZLA", label: "Tuzla", side: "Anadolu", keywords: ["TUZLA"] },
        { id: "ÜMRANİYE", label: "Ümraniye", side: "Anadolu", keywords: ["ÜMRANİYE"] },
        { id: "ÜSKÜDAR", label: "Üsküdar", side: "Anadolu", keywords: ["ÜSKÜDAR", "ÇENGELKÖY", "BEYLERBEYİ"] },
    ];

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const wakeLockRef = useRef<any>(null);
    const waStatusIntervalRef = useRef<any>(null);

    // Ekranı uyanık tutma (Wake Lock)
    const toggleWakeLock = async () => {
        if ("wakeLock" in navigator) {
            try {
                if (!isWakeLockActive) {
                    wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
                    setIsWakeLockActive(true);
                } else {
                    if (wakeLockRef.current) {
                        await wakeLockRef.current.release();
                        wakeLockRef.current = null;
                        setIsWakeLockActive(false);
                    }
                }
            } catch (err: any) {
                console.error(`Wake Lock failed: ${err.name}, ${err.message}`);
            }
        } else {
            alert("Tarayıcınız ekran uyanık tutma özelliğini desteklemiyor.");
        }
    };

    const checkWAStatus = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await fetch("/api/whatsapp/status", {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            const data = await res.json();
            setWaStatus({
                isConnected: !!data.isConnected,
                isConnecting: !!data.isConnecting
            });
        } catch (e: any) {
            console.error("WA Status Error:", e);
        }
    };

    const fetchFilters = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await fetch("/api/driver/filters", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSelectedRegions(data.regions || []);
                setMinPrice(data.min_price || 0);
                setJobMode(data.job_mode || 'all');
                setActionMode(data.action_mode || 'manual');
                setAutoCall(data.action_mode === 'auto');
                if (data.rota_name) setRotaName(data.rota_name);
            }
        } catch (e) {
            console.error("Fetch Filters Error:", e);
        }
    };

    const saveFilters = async (newRegions?: string[], newJobMode?: string, newActionMode?: string, newMinPrice?: number, newRotaName?: string) => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem("token");
            await fetch("/api/driver/filters", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    regions: newRegions ?? selectedRegions,
                    min_price: newMinPrice ?? minPrice,
                    job_mode: newJobMode ?? jobMode,
                    action_mode: newActionMode ?? actionMode,
                    rota_name: newRotaName ?? rotaName
                })
            });
        } catch (e) {
            console.error("Save Filters Error:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const fetchJobs = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/jobs", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            if (res.status === 500) {
                setError(data.details || data.error || "Sunucu hatası");
                return;
            }

            if (!data.error && Array.isArray(data)) {
                setError(null);
                // Eğer yeni bir iş geldiyse ve liste boş değilse ses çal
                if (jobs.length > 0 && data.length > jobs.length) {
                    playAlert();

                    const newJobs = data.filter((dj: any) => !jobs.some((j: any) => j.id === dj.id));
                    if (autoCall && newJobs.length > 0) {
                        const bestJob = newJobs[0];
                        // Fiyat filtresine uyuyorsa otomatik ara
                        const priceNum = parseInt(bestJob.price.replace(/\D/g, '')) || 0;
                        if (priceNum >= minPrice) {
                            handleCall(bestJob.phone, bestJob.id);
                        }
                    }
                }
                const formattedData = data.map((job: any) => ({
                    ...job,
                    created_at: job.created_at?.includes(' ') && !job.created_at?.includes('T')
                        ? job.created_at.replace(' ', 'T') + 'Z'
                        : job.created_at
                }));
                setJobs(formattedData);
            } else if (data.error) {
                setError(data.error);
            }
        } catch (e: any) {
            console.error("Jobs fetch error:", e);
            // İnternet kopması veya ağ değişikliği (Failed to fetch) hatalarında ekranı kırmızıya boyama
            if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                console.warn("[Driver] Network glitch detected, retrying in next interval...");
            } else {
                setError(e.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const playAlert = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(() => { });
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/jobs/stats", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!data.error && Array.isArray(data)) {
                setStats(data);
            }
        } catch (e) { }
    };

    useEffect(() => {
        fetchJobs();
        fetchStats();
        fetchStats();
        fetchFilters();
        const interval = setInterval(fetchJobs, 10000); // 10 saniyede bir
        const statsInterval = setInterval(fetchStats, 60000); // İstatistikleri 1 dakikada bir güncelle
        waStatusIntervalRef.current = setInterval(checkWAStatus, 5000);

        return () => {
            clearInterval(interval);
            clearInterval(statsInterval);
            if (waStatusIntervalRef.current) clearInterval(waStatusIntervalRef.current);
            if (wakeLockRef.current) wakeLockRef.current.release();
        };
    }, [jobs.length, autoCall, minPrice]);

    const handleCall = async (phone: string, jobId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/jobs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ jobId, status: 'called' })
            });

            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            // Telefonu ara
            window.location.href = `tel:${phone}`;
        } catch (e: any) {
            console.error("[Driver] Call Error:", e);
        }
    };

    const handleTakeJob = async (jobId: number, groupJid: string, phone: string) => {
        setLoadingJobId(jobId);
        const token = localStorage.getItem("token");
        try {
            console.log(`[Driver] Taking job ${jobId} for group ${groupJid}`);
            const res = await fetch("/api/jobs/take", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ jobId, groupJid, phone })
            });
            const data = await res.json();

            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            if (res.ok && data.success) {
                // Başarı durumunda alert kaldırıldı (Hızı artırmak için)
                fetchJobs();
            } else {
                console.error("[Driver] Take Job API Error:", data);
                alert("❌ Hata: " + (data.error || "Bilinmeyen bir hata oluştu."));
            }
        } catch (e: any) {
            console.error("[Driver] Take Job Global Error:", e);
            if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
                alert("🚨 Bağlantı Hatası: İnternet bağlantınız koptu veya kararsız. Lütfen kontrol edip tekrar deneyin.");
            } else {
                alert("🚨 Sistem hatası: " + e.message);
            }
        } finally {
            setLoadingJobId(null);
        }
    };

    const handleWonJob = async (jobId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/jobs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ jobId, status: 'won' })
            });

            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            fetchJobs();
        } catch (e: any) {
            console.error("[Driver] Won Job Error:", e);
        }
    };

    const handleIgnore = async (jobId: number) => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/jobs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ jobId, status: 'ignored' })
            });

            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            fetchJobs();
        } catch (e: any) {
            console.error("[Driver] Ignore Error:", e);
        }
    };

    // Filter Logic
    const filteredJobs = jobs.filter(job => {
        if (view === 'active') {
            if (job.status === 'won' || job.status === 'ignored') return false;
        } else {
            if (job.status !== 'won') return false;
        }

        // Türkçe karakterleri normalize eden ve büyük harfe çeviren yardımcı fonksiyon
        const normalize = (str: string) => {
            return str
                .replace(/İ/g, 'i')
                .replace(/I/g, 'ı')
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/g/g, 'g') // yumuşak g için düzeltme
                .replace(/u/g, 'u')
                .replace(/s/g, 's')
                .replace(/o/g, 'o')
                .replace(/c/g, 'c')
                .toUpperCase();
        };

        const priceNum = parseInt(job.price.replace(/\D/g, '')) || 0;
        const normalizedSearch = normalize(regionSearch);
        const jobContent = normalize(job.from_loc + job.to_loc + job.raw_message + (job.time || ''));
        const textMatch = !regionSearch || jobContent.includes(normalizedSearch);
        const priceMatch = minPrice === 0 || priceNum >= minPrice;

        // Gelişmiş Filtreleme Mantığı
        // 1. İş Modu (Hazır / İleri Tarihli)
        let readyMatch = true;
        if (jobMode === 'ready') readyMatch = !!job.time?.includes('HAZIR');
        if (jobMode === 'scheduled') readyMatch = !job.time?.includes('HAZIR') && job.time !== 'Belirtilmedi';
        // Eski "Sadece Hazır" butonuyla da uyumlu olsun
        if (showOnlyReady && !job.time?.includes('HAZIR')) readyMatch = false;

        // 2. Bölge Filtresi (Kalkış & Varış Kontrolü)
        let regionMatch = true;
        if (selectedRegions.length > 0) {
            regionMatch = selectedRegions.some(regId => {
                const reg = ISTANBUL_REGIONS.find(r => r.id === regId);
                if (!reg) return false;

                // Havalimanları için hem kalkış hem varış kontrol et (Havalimanında bekleyenler için)
                const isAirportReg = reg.id === 'İHL' || reg.id === 'SAW';

                return reg.keywords.some(key => {
                    const normalizedKey = normalize(key);
                    const fromMatch = normalize(job.from_loc).includes(normalizedKey);
                    const toMatch = isAirportReg && normalize(job.to_loc).includes(normalizedKey);
                    const msgMatch = normalize(job.raw_message).includes(normalizedKey);

                    return fromMatch || toMatch || msgMatch;
                });
            });
        }

        // 3. Havalimanı Filtresi (Buton için)
        const airportKeywords = ["IHL", "İHL", "SAW", "HAVALİMANI", "AIRPORT", "İSTANBUL HAVALİMANI", "SABİHA"];
        const isAirport = airportKeywords.some(key =>
            (job.from_loc + job.to_loc).toUpperCase().includes(key)
        );
        const airportBtnMatch = !showOnlyAirport || isAirport;

        // 4. VIP Filtresi (Buton için)
        const vipMatch = !showOnlyVip || priceNum >= 2000;

        // OTOMATİK ARAMA TETİKLEYİCİ
        // Eğer bu iş tüm kriterlere uyuyorsa veactionMode 'auto' ise, ve daha önce aranmadıysa
        if (actionMode === 'auto' && job.status === 'pending' && priceMatch && readyMatch && regionMatch) {
            // Sadece son 3 dakika içindeki yeni işleri otomatik ara (Eski işleri arama!)
            const jobTime = new Date(job.created_at).getTime();
            const now = Date.now();
            if (now - jobTime < 180000) {
                handleCall(job.phone, job.id);
            }
        }

        return textMatch && priceMatch && readyMatch && regionMatch && airportBtnMatch && vipMatch;
    });

    const totalEarnings = jobs
        .filter(j => j.status === 'won')
        .reduce((sum, j) => sum + (parseInt(j.price.replace(/\D/g, '')) || 0), 0);

    const todayWonCount = jobs
        .filter(j => j.status === 'won' && new Date(j.created_at).toDateString() === new Date().toDateString())
        .length;

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            {/* Hidden audio for alerts */}
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                        🚕 SOSYAL TRANSFER
                    </h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleWakeLock}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all border ${isWakeLockActive ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-slate-700 text-slate-400 border-transparent'}`}
                        >
                            {isWakeLockActive ? '🔅 UYANIK KAL: AÇIK' : '💤 UYANIK KAL: KAPALI'}
                        </button>
                        <button
                            onClick={checkWAStatus}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border flex items-center gap-1.5 transition-all active:scale-95 ${waStatus.isConnected ? 'bg-green-500/20 text-green-400 border-green-500/40' : waStatus.isConnecting ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse' : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'}`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${waStatus.isConnected ? 'bg-green-400' : waStatus.isConnecting ? 'bg-yellow-400' : 'bg-red-400'}`} />
                            {waStatus.isConnected ? 'WHATSAPP: BAĞLI' : waStatus.isConnecting ? 'WHATSAPP: BAĞLANIYOR...' : 'WHATSAPP: BAĞLI DEĞİL (BAĞLAN)'}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OTOMATİK ARA</span>
                        <span className={`text-xs font-bold ${autoCall ? 'text-green-400' : 'text-slate-400'}`}>
                            {autoCall ? 'AKTİF' : 'KAPALI'}
                        </span>
                    </div>
                    <button
                        onClick={() => setAutoCall(!autoCall)}
                        className={`w-14 h-8 rounded-full transition-all relative ${autoCall ? 'bg-green-500' : 'bg-slate-700'}`}
                    >
                        <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${autoCall ? 'right-1' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            {/* Earnings & View Switcher */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50">
                <div className="flex gap-2 p-1 bg-slate-900 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setView('active')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${view === 'active' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        AKTİF İŞLER
                    </button>
                    <button
                        onClick={() => setView('history')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${view === 'history' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        İŞ GEÇMİŞİM
                    </button>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center hidden sm:block">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">HAVUZDAKİ İŞLER</div>
                        <div className="text-2xl font-black text-blue-400">{jobs.length}</div>
                    </div>
                    <div className="h-8 w-px bg-slate-700 hidden sm:block" />
                    <div className="text-center">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">BUGÜNKÜ İŞLER</div>
                        <div className="text-2xl font-black text-white">{todayWonCount}</div>
                    </div>
                    <div className="h-8 w-px bg-slate-700" />
                    <div className="text-center">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">TOPLAM KAZANÇ</div>
                        <div className="text-2xl font-black text-green-400 font-mono">{totalEarnings.toLocaleString()} ₺</div>
                    </div>
                </div>
            </div>

            {/* Smart Rota & Automation Section */}
            <div className="bg-slate-800 rounded-[2rem] border border-slate-700/50 shadow-2xl overflow-hidden transition-all duration-500">
                {/* Header / Summary Bar */}
                <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-slate-800 to-slate-800/50">
                    <div className="flex flex-col gap-1 w-full md:w-auto">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
                                <span className="text-xl">🎯</span>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    value={rotaName}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setRotaName(val);
                                        saveFilters(undefined, undefined, undefined, undefined, val);
                                    }}
                                    className="bg-transparent border-none text-white font-black text-xl focus:ring-0 p-0 w-32 tracking-tighter"
                                    placeholder="ROTA ADI"
                                />
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Aktif Strateji</div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats / Active Filters Info */}
                    {!showSettings && (
                        <div className="flex flex-wrap items-center gap-2 justify-center">
                            <div className="bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2">
                                <span className="text-xs">💰</span>
                                <span className="text-[10px] font-black text-green-400">{minPrice}+ ₺</span>
                            </div>
                            <div className="bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2">
                                <span className="text-xs">{jobMode === 'ready' ? '🚨' : jobMode === 'scheduled' ? '📅' : '📋'}</span>
                                <span className="text-[10px] font-black text-slate-300 uppercase">{jobMode === 'all' ? 'TÜMÜ' : jobMode === 'ready' ? 'HAZIR' : 'İLERİ'}</span>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${actionMode === 'auto' ? 'bg-orange-600/20 border-orange-500/30 text-orange-400' : 'bg-slate-900/80 border-white/5 text-slate-400'}`}>
                                <span className="text-xs">{actionMode === 'auto' ? '⚡' : '👤'}</span>
                                <span className="text-[10px] font-black uppercase text-center">{actionMode === 'auto' ? 'OTO-ARA' : 'MANUEL'}</span>
                            </div>
                            {selectedRegions.length > 0 && (
                                <div className="bg-blue-600/20 px-3 py-1.5 rounded-xl border border-blue-500/30 flex items-center gap-2 text-blue-400">
                                    <span className="text-xs">🚩</span>
                                    <span className="text-[10px] font-black uppercase">{selectedRegions.length} BÖLGE</span>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`w-full md:w-auto px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${showSettings ? 'bg-slate-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20'}`}
                    >
                        {showSettings ? 'AYARLARI KAPAT ▲' : 'ROTA AYARLARI ▼'}
                    </button>
                </div>

                {/* Expanded Settings Content */}
                {showSettings && (
                    <div className="p-6 border-t border-slate-700/50 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column: Side Selection & Logic */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        ⚙️ TEMEL YAPILANDIRMA
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <div className="text-[10px] font-black text-slate-400 ml-1">İŞ TÜRÜ SEÇİMİ</div>
                                            <div className="flex gap-2">
                                                {[
                                                    { id: 'all', label: 'TÜMÜ', icon: '📋' },
                                                    { id: 'ready', label: 'HAZIR', icon: '🚨' },
                                                    { id: 'scheduled', label: 'İLERİ', icon: '📅' }
                                                ].map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => { setJobMode(m.id as any); saveFilters(undefined, m.id); }}
                                                        className={`flex-1 py-3 rounded-xl border text-[9px] font-black transition-all flex flex-col items-center gap-1.5 ${jobMode === m.id ? 'bg-green-600 border-green-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                                                    >
                                                        <span className="text-base">{m.icon}</span>
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="text-[10px] font-black text-slate-400 ml-1">AKSİYON MODU</div>
                                            <div className="flex gap-2">
                                                {[
                                                    { id: 'manual', label: 'MANUEL', icon: '👤', color: 'bg-blue-600' },
                                                    { id: 'auto', label: 'OTO-ARA', icon: '⚡', color: 'bg-orange-600' }
                                                ].map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => { setActionMode(m.id as any); setAutoCall(m.id === 'auto'); saveFilters(undefined, undefined, m.id); }}
                                                        className={`flex-1 py-3 rounded-xl border text-[9px] font-black transition-all flex flex-col items-center gap-1.5 ${actionMode === m.id ? `${m.color} border-white/20 text-white shadow-lg` : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                                                    >
                                                        <span className="text-base">{m.icon}</span>
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">💰 MİNİMUM ÜCRET LİMİTİ</span>
                                            <span className="text-[9px] text-slate-600 font-bold">BU RAKAMIN ALTINDAKİ İŞLER GİZLENİR</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={minPrice}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value);
                                                    setMinPrice(v);
                                                    saveFilters(undefined, undefined, undefined, v);
                                                }}
                                                className="bg-slate-800 border border-slate-700 rounded-lg py-1 px-3 text-sm font-black text-green-400 w-24 text-right focus:ring-1 focus:ring-green-500/50"
                                            />
                                            <span className="text-sm font-black text-slate-500">₺</span>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10000"
                                        step="250"
                                        value={minPrice}
                                        onChange={(e) => { const v = Number(e.target.value); setMinPrice(v); saveFilters(undefined, undefined, undefined, v); }}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400 transition-all"
                                    />
                                    <div className="flex justify-between mt-2 px-1">
                                        <span className="text-[10px] font-bold text-slate-600">0 ₺</span>
                                        <span className="text-[10px] font-bold text-slate-600">10.000 ₺</span>
                                    </div>
                                </div>

                                <div className="bg-blue-600/5 border border-blue-500/20 p-4 rounded-2xl">
                                    <div className="flex items-start gap-4">
                                        <div className="text-xl">ℹ️</div>
                                        <div>
                                            <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-tight mb-1">Rota Bilgilendirmesi</h4>
                                            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                                Şu an <strong>{rotaName}</strong> stratejisi aktif. Seçtiğiniz bölgelerden ve belirlediğiniz fiyattan bir iş geldiğinde panel saniyeler içinde sizi uyarır. Otomasyon modunda ise müşteri doğrudan aranır.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Detailed Region Selection */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        🚩 ÇALIŞILACAK BÖLGELER
                                    </h3>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => {
                                                const newRegs = ISTANBUL_REGIONS.map(r => r.id);
                                                setSelectedRegions(newRegs);
                                                saveFilters(newRegs);
                                            }}
                                            className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase underline-offset-4 hover:underline"
                                        >
                                            Hepsini Seç
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedRegions([]);
                                                saveFilters([]);
                                            }}
                                            className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase underline-offset-4 hover:underline"
                                        >
                                            Temizle
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-900/50 border border-slate-700/50 rounded-3xl p-4 overflow-hidden">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
                                        {/* Avrupa Yakası Grubu */}
                                        <div className="space-y-3">
                                            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-sm py-2 px-1 z-10 border-b border-slate-700/50 flex items-center justify-between">
                                                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">🏰 Avrupa Yakası</span>
                                                <span className="text-[9px] font-bold text-slate-600">{ISTANBUL_REGIONS.filter(r => r.side === 'Avrupa').length} Bölge</span>
                                            </div>
                                            <div className="space-y-1.5 pt-1">
                                                {ISTANBUL_REGIONS.filter(r => r.side === "Avrupa").map((reg) => (
                                                    <label key={reg.id} className="flex items-center gap-3 p-2.5 bg-slate-800/30 rounded-xl cursor-pointer hover:bg-slate-700 transition-all border border-transparent has-[:checked]:border-blue-500/30 has-[:checked]:bg-blue-600/10 group">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded-lg accent-blue-600 bg-slate-900 border-slate-700 transition-all cursor-pointer"
                                                            checked={selectedRegions.includes(reg.id)}
                                                            onChange={(e) => {
                                                                const newRegs = e.target.checked
                                                                    ? [...selectedRegions, reg.id]
                                                                    : selectedRegions.filter(id => id !== reg.id);
                                                                setSelectedRegions(newRegs);
                                                                saveFilters(newRegs);
                                                            }}
                                                        />
                                                        <span className="text-[11px] font-bold uppercase truncate text-slate-400 group-hover:text-white group-has-[:checked]:text-blue-200 transition-colors">
                                                            {reg.label}
                                                        </span>
                                                        {selectedRegions.includes(reg.id) && <span className="ml-auto text-[10px]">✅</span>}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Anadolu Yakası Grubu */}
                                        <div className="space-y-3">
                                            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-sm py-2 px-1 z-10 border-b border-slate-700/50 flex items-center justify-between">
                                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">🌉 Anadolu Yakası</span>
                                                <span className="text-[9px] font-bold text-slate-600">{ISTANBUL_REGIONS.filter(r => r.side === 'Anadolu').length} Bölge</span>
                                            </div>
                                            <div className="space-y-1.5 pt-1">
                                                {ISTANBUL_REGIONS.filter(r => r.side === "Anadolu").map((reg) => (
                                                    <label key={reg.id} className="flex items-center gap-3 p-2.5 bg-slate-800/30 rounded-xl cursor-pointer hover:bg-slate-700 transition-all border border-transparent has-[:checked]:border-blue-500/30 has-[:checked]:bg-blue-600/10 group">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded-lg accent-blue-600 bg-slate-900 border-slate-700 transition-all cursor-pointer"
                                                            checked={selectedRegions.includes(reg.id)}
                                                            onChange={(e) => {
                                                                const newRegs = e.target.checked
                                                                    ? [...selectedRegions, reg.id]
                                                                    : selectedRegions.filter(id => id !== reg.id);
                                                                setSelectedRegions(newRegs);
                                                                saveFilters(newRegs);
                                                            }}
                                                        />
                                                        <span className="text-[11px] font-bold uppercase truncate text-slate-400 group-hover:text-white group-has-[:checked]:text-blue-200 transition-colors">
                                                            {reg.label}
                                                        </span>
                                                        {selectedRegions.includes(reg.id) && <span className="ml-auto text-[10px]">✅</span>}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status Footer */}
                        <div className="flex items-center justify-center pt-6 border-t border-slate-700/50">
                            <div className={`flex items-center gap-2.5 px-6 py-2 rounded-full border transition-all duration-500 ${isSaving ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                                {isSaving ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-[10px] font-black tracking-widest uppercase">Ayarlar Buluta Yazılıyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm">🛡️</span>
                                        <span className="text-[10px] font-black tracking-widest uppercase">Tüm Ayarlarınız Senkronize Edildi</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Search (Mini) */}
            <div className="relative group">
                <input
                    type="text"
                    placeholder="Rota içinde ara... (Örn: Beşiktaş, 15:00, IST)"
                    value={regionSearch}
                    onChange={(e) => setRegionSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl py-4 px-6 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium shadow-xl"
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 text-lg group-focus-within:text-blue-400 transition-colors">🔍</div>
            </div>

            {/* Live Heatmap - Yoğunluk Haritası */}
            {stats.length > 0 && (
                <div className="bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-6 border border-slate-700/50 shadow-2xl">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex flex-col">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                🔥 Canlı Bölge Yoğunluğu
                            </h2>
                            <span className="text-[9px] text-slate-600 font-bold uppercase mt-0.5">Son 24 saatlik transfer trafiği</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                            <span className="text-[9px] text-slate-400 font-black uppercase">Canlı Veri</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {stats.slice(0, 10).map((item, i) => (
                            <div key={i} className="flex-1 min-w-[130px] bg-slate-900/40 rounded-2xl p-3 border border-slate-700/30 relative overflow-hidden group hover:border-orange-500/30 transition-all">
                                <div
                                    className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000 opacity-50 group-hover:opacity-100"
                                    style={{ width: `${Math.min(100, (item.count / stats[0].count) * 100)}%` }}
                                />
                                <div className="flex justify-between items-center relative z-10">
                                    <span className="text-[10px] font-black text-slate-300 uppercase truncate pr-2 tracking-tight">{item.location}</span>
                                    <span className="bg-slate-800 text-orange-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-orange-500/20">{item.count} İŞ</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl text-red-400 flex items-center gap-4 animate-pulse">
                    <span className="text-2xl">⚠️</span>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest">Sistem Hatası</span>
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                </div>
            )}

            {/* İş Listesi Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        📋 {filteredJobs.length} UYGUN İŞ BULUNDU
                    </h2>
                </div>

                {filteredJobs.length === 0 ? (
                    <div className="text-center py-24 bg-slate-900/30 rounded-[2rem] border-2 border-dashed border-slate-700/50">
                        <div className="text-5xl mb-4">📭</div>
                        <p className="text-slate-400 font-black tracking-tight text-lg">Şu an kriterlerinize uygun iş yok</p>
                        <p className="text-slate-600 font-bold text-sm mt-2">Daha fazla iş görmek için Rota Ayarlarından bölgelerinizi <br />veya minimum fiyat limitinizi güncelleyebilirsiniz.</p>
                    </div>
                ) : (
                    filteredJobs.map((job) => (
                        <div
                            key={job.id}
                            className={`group bg-slate-800 rounded-[2rem] p-6 border-2 transition-all duration-300 ${job.status === 'called' ? 'border-green-500/40 shadow-xl shadow-green-500/5 bg-green-500/5' :
                                job.status === 'ignored' ? 'border-red-900/20 opacity-40 blur-[1px] hover:blur-0' :
                                    'border-slate-700/50 hover:border-blue-500/30'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="space-y-5 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="bg-slate-900 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-400 border border-white/5 flex items-center gap-2 shadow-inner">
                                            <span>🕒 {new Date(job.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <div className="w-px h-3 bg-slate-700 mx-1" />
                                            <RelativeTimer createdAt={job.created_at} />
                                        </div>

                                        {job.group_name && (
                                            <div className="bg-slate-900 px-3 py-1.5 rounded-xl text-[10px] font-black text-blue-400 border border-blue-500/10 shadow-inner max-w-[150px] truncate" title={job.group_name}>
                                                👥 {job.group_name}
                                            </div>
                                        )}

                                        {job.time && job.time !== 'Belirtilmedi' && (
                                            <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-xl ${job.time.includes('HAZIR') ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-100 border border-white/10'}`}>
                                                {job.time.includes('HAZIR') && '⚡'} {job.time}
                                            </div>
                                        )}

                                        {job.status === 'pending' && (
                                            <div className="flex items-center gap-1.5 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                                                <span className="text-[9px] text-green-500 font-bold uppercase">CANLI</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-5 text-white">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-1">KALKIŞ</span>
                                                <span className="text-3xl font-black tracking-tighter">{job.from_loc}</span>
                                            </div>
                                            <div className="text-2xl text-slate-700 mt-5 leading-none">→</div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-1">VARIŞ</span>
                                                <span className="text-3xl font-black tracking-tighter">{job.to_loc}</span>
                                            </div>
                                        </div>
                                        <div className="text-4xl font-black text-green-400 font-mono tracking-tighter mt-1">
                                            {job.price}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-900/50 rounded-2xl text-xs text-slate-400 border border-white/5 font-medium leading-relaxed">
                                        <span className="opacity-40 italic mr-1 text-base">"</span>
                                        {job.raw_message}
                                        <span className="opacity-40 italic ml-1 text-base">"</span>
                                    </div>
                                </div>

                                <div className="flex flex-row md:flex-col gap-3 min-w-[220px] justify-center">
                                    {view === 'active' ? (
                                        <>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleCall(job.phone, job.id)}
                                                    className={`flex-1 py-5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-2xl relative overflow-hidden ${job.status === 'called'
                                                        ? 'bg-slate-900 border-2 border-slate-700 text-slate-500'
                                                        : 'bg-green-600 hover:bg-green-500 text-white active:scale-95 group/btn'
                                                        }`}
                                                >
                                                    <span className="text-base font-black tracking-widest uppercase">ARA</span>
                                                    <span className="text-[10px] font-bold font-mono opacity-60 tracking-wider group-hover/btn:opacity-100">{job.phone}</span>
                                                    {job.status !== 'called' && <div className="absolute top-0 right-0 p-1">📞</div>}
                                                </button>
                                                <a
                                                    href={`https://wa.me/${job.phone.startsWith('5') ? '90' + job.phone : job.phone}`}
                                                    target="_blank"
                                                    onClick={() => handleCall(job.phone, job.id)}
                                                    className="w-16 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-95 group"
                                                    title="WhatsApp ile Mesaj At"
                                                >
                                                    <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current group-hover:scale-110 transition-transform" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.55 4.12 1.515 5.86L.044 23.956l6.23-1.635C7.89 23.36 9.873 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22.03c-1.92 0-3.722-.515-5.285-1.413l-.38-.218-3.89 1.02.585-3.793-.243-.385a10.03 10.03 0 01-1.54-5.24c0-5.534 4.5-10.034 10.033-10.034 2.68 0 5.2 1.045 7.093 2.938A9.98 9.98 0 0122.033 12c0 5.534-4.5 10.03-10.033 10.03zm5.626-7.85c-.308-.154-1.822-.9-2.104-1.003-.284-.103-.49-.154-.696.154-.206.308-.798 1.003-.977 1.208-.18.206-.36.23-.668.077-.31-.154-1.303-.48-2.484-1.533-.918-.82-1.537-1.83-1.716-2.14-.18-.307-.02-.473.136-.627.14-.14.308-.36.463-.54.154-.178.205-.307.31-.512.102-.205.051-.384-.027-.538-.077-.154-.694-1.67-.95-2.285-.25-.6-.505-.518-.696-.528-.18-.01-.385-.01-.59-.01-.205 0-.54.077-.822.385-.282.308-1.078 1.054-1.078 2.568s1.104 2.978 1.258 3.184c.154.205 2.172 3.32 5.263 4.656.735.317 1.31.507 1.758.648.738.235 1.41.202 1.94.123.59-.088 1.822-.744 2.078-1.463.257-.718.257-1.336.18-1.464-.076-.128-.282-.205-.59-.359z" />
                                                    </svg>
                                                </a>
                                            </div>

                                            {job.status === 'called' ? (
                                                <button
                                                    onClick={() => handleWonJob(job.id)}
                                                    className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 animate-pulse border border-white/20 active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    ✅ İŞİ ALDIM
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleTakeJob(job.id, job.group_jid, job.phone)}
                                                        disabled={!!loadingJobId}
                                                        className={`flex-1 py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg ${loadingJobId === job.id ? 'bg-orange-600 animate-pulse cursor-wait' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}`}
                                                    >
                                                        {loadingJobId === job.id ? '...' : 'OK MESAJI AT 📩'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleIgnore(job.id)}
                                                        className="py-4 px-4 rounded-2xl bg-slate-900 text-slate-500 text-[10px] font-black uppercase hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/5"
                                                    >
                                                        SİL
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col gap-2 h-full justify-center">
                                            <div className="bg-slate-900/50 p-4 rounded-2xl text-center border border-white/5">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Tarih</div>
                                                <div className="text-xs text-white font-black">
                                                    {new Date(job.completed_at || job.created_at).toLocaleDateString('tr-TR')}
                                                </div>
                                            </div>
                                            <div className="bg-green-500/10 p-4 rounded-2xl text-center border border-green-500/20">
                                                <div className="text-[10px] text-green-500 font-bold uppercase mb-1">Kazanç</div>
                                                <div className="text-xl text-green-400 font-black font-mono">{job.price}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function RelativeTimer({ createdAt }: { createdAt: string }) {
    const [elapsed, setElapsed] = useState("");

    useEffect(() => {
        const update = () => {
            const now = new Date();
            const created = new Date(createdAt);
            const diffSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);

            if (diffSeconds < 60) {
                setElapsed(`${diffSeconds}sn`);
            } else if (diffSeconds < 3600) {
                setElapsed(`${Math.floor(diffSeconds / 60)}dk`);
            } else {
                setElapsed(`${Math.floor(diffSeconds / 3600)}sa`);
            }
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);

    return (
        <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/80 border border-white/5 shadow-inner">
            {elapsed}
        </span>
    );
}
