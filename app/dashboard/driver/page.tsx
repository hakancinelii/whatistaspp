"use client";

import { useEffect, useState, useRef, useMemo } from "react";

import { useRouter } from "next/navigation";

export default function DriverDashboard() {
    const router = useRouter();

    const [jobs, setJobs] = useState<any[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [minPrice, setMinPrice] = useState<number>(0);
    const [regionSearch, setRegionSearch] = useState("");
    const [isWakeLockActive, setIsWakeLockActive] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [waStatus, setWaStatus] = useState({ isConnected: false, isConnecting: false });
    const [showOnlyReady, setShowOnlyReady] = useState(false);
    const [showOnlyAirport, setShowOnlyAirport] = useState(false);
    const [showOnlyVip, setShowOnlyVip] = useState(false);
    const [loadingJobId, setLoadingJobId] = useState<number | null>(null);
    const [view, setView] = useState<'active' | 'history'>('active');

    // Görünür iş limiti (Performans için)
    const [visibleCount, setVisibleCount] = useState(50);

    // Gelişmiş Rota Ayarları
    const [showSettings, setShowSettings] = useState(false);
    const [showTopPanel, setShowTopPanel] = useState(false);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [jobMode, setJobMode] = useState<'all' | 'ready' | 'scheduled'>('all');
    const [filterSprinter, setFilterSprinter] = useState(false);
    const [filterSwap, setFilterSwap] = useState(false);
    const [actionMode, setActionMode] = useState<'manual' | 'auto'>('manual');
    const autoCall = actionMode === 'auto';
    const [isSaving, setIsSaving] = useState(false);
    const [rotaName, setRotaName] = useState("STRATEJİ 1");
    // Profil Zorunluluğu State
    const [userProfile, setUserProfile] = useState<any>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileFormData, setProfileFormData] = useState({
        name: '',
        driver_phone: '',
        driver_plate: ''
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isBanned, setIsBanned] = useState(false);
    const [isRestricted, setIsRestricted] = useState(false);

    // Manuel İş Ekleme State
    const [isAddingJob, setIsAddingJob] = useState(false);
    const [newJobData, setNewJobData] = useState({
        from_loc: '',
        to_loc: '',
        price: '',
        description: '',
        time: '',
        contact_phone: ''
    });

    // Filtre State'leri
    // selectedRegions yukarıda tanımlıydı
    const [selectedToRegions, setSelectedToRegions] = useState<string[]>([]); // TO (Varış)
    const [regionTab, setRegionTab] = useState<'from' | 'to'>('from'); // UI Tab State

    // Harici Şoför Atama State'leri
    const [externalDrivers, setExternalDrivers] = useState<any[]>([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningJob, setAssigningJob] = useState<any>(null);



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

    // Yardımcı: Türkçe karakterleri normalize et
    const normalize = (str: string) => {
        return str
            .replace(/İ/g, 'i')
            .replace(/I/g, 'ı')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/g/g, 'g')
            .replace(/u/g, 'u')
            .replace(/s/g, 's')
            .replace(/o/g, 'o')
            .replace(/c/g, 'c')
            .toUpperCase();
    };

    // MERKEZİ FİLTRELEME FONKSİYONU
    const checkJobMatch = (job: any, isForAutoCall = false) => {
        // Görünüm Modu (Aktif/Geçmiş) - Sadece liste için geçerli
        if (!isForAutoCall) {
            if (view === 'active') {
                if (job.status === 'won' || job.status === 'ignored') return false;
            } else {
                if (job.status !== 'won') return false;
            }
        } else {
            // Otomatik Arama için sadece beklemede olan işler
            if (job.status !== 'pending') return false;
        }

        const priceNum = parseInt(job.price?.toString().replace(/\D/g, '')) || 0;
        const normalizedSearch = normalize(regionSearch || '');
        const jobContent = normalize((job.from_loc || '') + (job.to_loc || '') + (job.raw_message || '') + (job.time || ''));

        // 1. Manuel Arama Kutusu
        if (regionSearch && !jobContent.includes(normalizedSearch)) return false;

        // 2. Minimum Fiyat
        if (minPrice > 0 && priceNum < minPrice) return false;

        // 3. İş Modu (Hazır / İleri Tarihli)
        if (jobMode === 'ready' && !job.time?.includes('HAZIR')) return false;
        if (jobMode === 'scheduled' && (job.time?.includes('HAZIR') || job.time === 'Belirtilmedi')) return false;

        // 4. Sprinter Filtresi
        if (filterSprinter) {
            const sprinterKeywords = ['SPRINTER', '10+', '13+', '16+', '10LUK', '13LUK', '16LIK', '10 LUK', '13 LUK', '16 LIK', '10LIK', '13LUK', '16LUK', '10 VE UZERI', '13 VE UZERI', '16 VE UZERI', 'BUYUK ARAC', 'MINIBUS'];
            if (!sprinterKeywords.some(kw => jobContent.includes(kw))) return false;
        }

        // 5. Takas Filtresi
        if (filterSwap) {
            if (job.is_swap !== 1 && job.from_loc !== 'ÇOKLU / TAKAS') return false;
        } else {
            if (job.is_swap === 1 || job.from_loc === 'ÇOKLU / TAKAS') return false;
        }

        // 6. Bölge Filtresi (Kalkış)
        if (selectedRegions.length > 0) {
            const normalizedFrom = normalize(job.from_loc || '');
            const normalizedRaw = normalize(job.raw_message || '');
            const hasFromMatch = selectedRegions.some(regId => {
                const reg = ISTANBUL_REGIONS.find(r => r.id === regId);
                if (!reg) return false;
                return reg.keywords.some(key => {
                    const normalizedKey = normalize(key);
                    if (job.is_swap === 1 || job.from_loc === 'ÇOKLU / TAKAS') return normalizedRaw.includes(normalizedKey);
                    return normalizedFrom.includes(normalizedKey);
                });
            });
            if (!hasFromMatch) return false;
        }

        // 7. Bölge Filtresi (Varış)
        if (selectedToRegions.length > 0) {
            const normalizedTo = normalize(job.to_loc || '');
            const normalizedRaw = normalize(job.raw_message || '');
            const hasToMatch = selectedToRegions.some(regId => {
                const reg = ISTANBUL_REGIONS.find(r => r.id === regId);
                if (!reg) return false;
                return reg.keywords.some(key => {
                    const normalizedKey = normalize(key);
                    if (job.is_swap === 1 || job.from_loc === 'ÇOKLU / TAKAS') return normalizedRaw.includes(normalizedKey);
                    return normalizedTo.includes(normalizedKey);
                });
            });
            if (!hasToMatch) return false;
        }

        // 8. Havalimanı Filtresi (Buton)
        if (showOnlyAirport) {
            const airportKeywords = ["IHL", "İHL", "SAW", "HAVALİMANI", "AIRPORT", "İSTANBUL HAVALİMANI", "SABİHA"];
            const rawLocs = (job.from_loc + job.to_loc).toUpperCase();
            if (!airportKeywords.some(key => rawLocs.includes(key))) return false;
        }

        // 9. VIP Filtresi
        if (showOnlyVip && priceNum < 2000) return false;

        return true;
    };

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
            // Kullanıcı bilgilerini de çekelim (telefon için)
            // Endpoint /api/profile olarak düzeltildi
            const meRes = await fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
            if (meRes.ok) {
                const me = await meRes.json();
                // API profile ne dönüyor kontrol etmeliyiz ama genellikle user objesi döner
                // driver_phone veya phone alanını alalım
                if (me.phone || me.driver_phone || me.user?.driver_phone) {
                    setNewJobData(prev => ({ ...prev, contact_phone: me.driver_phone || me.user?.driver_phone || me.phone || '' }));
                }
            }

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
                setSelectedToRegions(data.to_regions || []);
                setMinPrice(data.min_price || 0);
                const mode = data.job_mode || 'all';
                if (mode === 'all' || mode === 'ready' || mode === 'scheduled') setJobMode(mode);
                setFilterSprinter(!!data.filter_sprinter);
                setFilterSwap(!!data.filter_swap);
                setActionMode(data.action_mode || 'manual');
                if (data.rota_name) setRotaName(data.rota_name);
            }
        } catch (e) {
            console.error("Fetch Filters Error:", e);
        }
    };

    const saveFilters = async (newRegions?: string[], newJobMode?: string, newActionMode?: string, newMinPrice?: number, newRotaName?: string, newFilterSprinter?: boolean, newFilterSwap?: boolean, newToRegions?: string[]) => {
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
                    to_regions: newToRegions ?? selectedToRegions,
                    min_price: newMinPrice ?? minPrice,
                    job_mode: newJobMode ?? jobMode,
                    filter_sprinter: newFilterSprinter ?? filterSprinter,
                    filter_swap: newFilterSwap ?? filterSwap,
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
                        // Sadece filtrelerime uyan İLK işi otomatik ara
                        const matchingNewJob = newJobs.find(job => checkJobMatch(job, true));
                        if (matchingNewJob) {
                            console.log("[OTO-ARA] Filtrelere uyan iş bulundu, aranıyor:", matchingNewJob.id);
                            handleCall(matchingNewJob.phone, matchingNewJob.id);
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
        if (soundEnabled && audioRef.current) {
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

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/profile", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }
            if (data) {
                setUserProfile(data);
                setProfileFormData({
                    name: data.name || '',
                    driver_phone: data.driver_phone || '',
                    driver_plate: data.driver_plate || ''
                });

                // Ban/Kısıt Kontrolü
                if (data.status === 'banned') {
                    setIsBanned(true);
                    alert("🚫 Hesabınız kapatılmıştır. Lütfen yönetici ile iletişime geçin.");
                    localStorage.removeItem("token");
                    window.location.href = "/login";
                    return;
                }
                if (data.status === 'restricted') {
                    setIsRestricted(true);
                }

                // Eksik bilgi kontrolü (Admin hariç)
                if (data.role !== 'admin') {
                    if (!data.name || !data.driver_phone || !data.driver_plate) {
                        setShowProfileModal(true);
                    }
                }
            }
        } catch (e) {
            console.error("Profile fetch error:", e);
        }
    };

    const handleUpdateProfile = async () => {
        if (!profileFormData.name || !profileFormData.driver_phone || !profileFormData.driver_plate) {
            alert("⚠️ Lütfen tüm alanları doldurun.");
            return;
        }
        setIsSavingProfile(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(profileFormData)
            });
            if (res.ok) {
                setShowProfileModal(false);
                fetchProfile();
            } else {
                const data = await res.json();
                alert("❌ Hata: " + (data.error || "Güncelleme başarısız."));
            }
        } catch (e: any) {
            alert("🚨 Sistem hatası: " + e.message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    useEffect(() => {
        fetchProfile();
        fetchJobs();
        fetchStats();
        fetchFilters();
        const interval = setInterval(fetchJobs, 10000); // 10 saniyede bir
        const statsInterval = setInterval(fetchStats, 60000); // İstatistikleri 1 dakikada bir güncelle
        const profileInterval = setInterval(fetchProfile, 120000); // Profil/Statü 2 dakikada bir kontrol
        waStatusIntervalRef.current = setInterval(checkWAStatus, 5000);

        return () => {
            clearInterval(interval);
            clearInterval(statsInterval);
            clearInterval(profileInterval);
            if (waStatusIntervalRef.current) clearInterval(waStatusIntervalRef.current);
            if (wakeLockRef.current) wakeLockRef.current.release();
        };
    }, []);

    // Filter Logic - useMemo ile optimize edildi
    const filteredJobs = useMemo(() => {
        return jobs.filter(job => checkJobMatch(job));
    }, [jobs, view, regionSearch, minPrice, jobMode, filterSprinter, filterSwap, selectedRegions, selectedToRegions, showOnlyAirport, showOnlyVip, view]);

    // OTO-ARA Logic (useEffect ile)
    useEffect(() => {
        if (actionMode === 'auto' && jobs.length > 0) {
            // Sadece pending olan işleri
            const pendingJobs = filteredJobs.filter(j => j.status === 'pending');
        }
    }, [actionMode, jobs, filteredJobs]);

    const fetchExternalDrivers = async () => {
        if (userProfile?.role !== 'admin') return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/external-drivers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setExternalDrivers(data.filter((d: any) => d.is_active));
            }
        } catch (e) {
            console.error('Failed to fetch external drivers:', e);
        }
    };

    useEffect(() => {
        if (userProfile?.role === 'admin') {
            fetchExternalDrivers();
        }
    }, [userProfile]);

    const handleTakeJob = async (jobId: number, groupJid: string, phone: string, externalDriverId?: number) => {
        if (isRestricted) {
            alert("🚫 Hesabınız kısıtlı moddadır, iş alamazsınız.");
            return;
        }

        // Eğer kullanıcı adminse ve harici şoför seçilmemişse modalı aç (sadece ilk tıklamada)
        if (userProfile?.role === 'admin' && !externalDriverId) {
            const job = jobs.find(j => j.id === jobId);
            if (job) {
                setAssigningJob({ jobId, groupJid, phone, details: job });
                setShowAssignModal(true);
                return;
            }
        }

        setLoadingJobId(jobId);
        const token = localStorage.getItem("token");
        try {
            console.log(`[Driver] Taking job ${jobId} for group ${groupJid}${externalDriverId ? ` (Assigning to External: ${externalDriverId})` : ''}`);
            const res = await fetch("/api/jobs/take", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ jobId, groupJid, phone, externalDriverId })
            });
            const data = await res.json();

            if (res.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "/login";
                return;
            }

            if (res.ok && data.success) {
                setShowAssignModal(false);
                setAssigningJob(null);
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

    const handleAddJob = async () => {
        if (!newJobData.from_loc || !newJobData.to_loc || !newJobData.price || !newJobData.contact_phone) {
            alert("Lütfen zorunlu alanları doldurun (Nereden, Nereye, Fiyat, Telefon).");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/jobs/manual", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(newJobData)
            });

            if (res.ok) {
                alert("✅ İş başarıyla paylaşıldı!");
                setIsAddingJob(false);
                setNewJobData({ from_loc: '', to_loc: '', price: '', description: '', time: '', contact_phone: '' });
                fetchJobs();
            } else {
                const err = await res.json();
                alert("❌ Hata: " + (err.error || "Bilinmeyen hata"));
            }
        } catch (e: any) {
            alert("🚨 Sistem hatası: " + e.message);
        }
    };

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
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            {/* Hidden audio for alerts */}
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />

            {/* Compact Top Bar - Always Visible */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
                <div className="flex items-center justify-between p-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl flex-shrink-0">🚕</span>
                        <div className="min-w-0">
                            <div className="text-sm font-black text-white truncate">SOSYAL TRANSFER</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${waStatus.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                                <span className={`text-[9px] font-bold ${waStatus.isConnected ? 'text-green-400' : 'text-red-400'}`}>
                                    {waStatus.isConnected ? 'BAĞLI' : 'KOPUK'}
                                </span>
                                <span className="text-[9px] text-slate-500">•</span>
                                <span className="text-[9px] font-bold text-slate-400">{filteredJobs.length} İŞ</span>
                                <span className="text-[9px] text-slate-500">•</span>
                                <span className={`text-[9px] font-bold ${autoCall ? 'text-green-400' : 'text-slate-500'}`}>{autoCall ? '⚡OTO' : '👤MAN'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => setIsAddingJob(true)}
                            className="bg-green-600 hover:bg-green-500 text-white font-black px-3 py-2 rounded-xl shadow-lg active:scale-95 transition-all text-[10px] uppercase tracking-wider"
                        >
                            ➕ EKLE
                        </button>
                        <button
                            onClick={() => setShowTopPanel(!showTopPanel)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 border ${showTopPanel ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'}`}
                        >
                            {showTopPanel ? '▲ KAPAT' : '⚙️ PANEL'}
                        </button>
                    </div>
                </div>

                {/* Expandable Full Panel */}
                {showTopPanel && (
                    <div className="border-t border-slate-700 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={toggleWakeLock}
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all border ${isWakeLockActive ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-slate-700 text-slate-400 border-transparent'}`}
                            >
                                {isWakeLockActive ? '🔅 UYANIK KAL: AÇIK' : '💤 UYANIK KAL: KAPALI'}
                            </button>
                            <button
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all border ${soundEnabled ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-slate-700 text-slate-400 border-transparent'}`}
                            >
                                {soundEnabled ? '🔔 SES: AÇIK' : '🔕 SES: KAPALI'}
                            </button>
                            <button
                                onClick={checkWAStatus}
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border flex items-center gap-1.5 transition-all active:scale-95 ${waStatus.isConnected ? 'bg-green-500/20 text-green-400 border-green-500/40' : waStatus.isConnecting ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse' : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${waStatus.isConnected ? 'bg-green-400' : waStatus.isConnecting ? 'bg-yellow-400' : 'bg-red-400'}`} />
                                {waStatus.isConnected ? 'WHATSAPP: BAĞLI' : waStatus.isConnecting ? 'WHATSAPP: BAĞLANIYOR...' : 'WHATSAPP: BAĞLI DEĞİL (BAĞLAN)'}
                            </button>
                        </div>

                        <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OTOMATİK ARA</span>
                                <span className={`text-xs font-bold ${autoCall ? 'text-green-400' : 'text-slate-400'}`}>
                                    {autoCall ? 'AKTİF' : 'KAPALI'}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    const newMode = autoCall ? 'manual' : 'auto';
                                    setActionMode(newMode as any);
                                    saveFilters(undefined, undefined, newMode);
                                }}
                                className={`w-14 h-8 rounded-full transition-all relative ${autoCall ? 'bg-green-500' : 'bg-slate-700'}`}
                            >
                                <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${autoCall ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Earnings & View Switcher - Compact */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                <div className="flex gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/5">
                    <button
                        onClick={() => setView('active')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${view === 'active' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        AKTİF İŞLER
                    </button>
                    <button
                        onClick={() => setView('history')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${view === 'history' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        İŞ GEÇMİŞİM
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">HAVUZ</div>
                        <div className="text-lg font-black text-blue-400">{jobs.length}</div>
                    </div>
                    <div className="h-6 w-px bg-slate-700" />
                    <div className="text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">BUGÜN</div>
                        <div className="text-lg font-black text-white">{todayWonCount}</div>
                    </div>
                    <div className="h-6 w-px bg-slate-700" />
                    <div className="text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">KAZANÇ</div>
                        <div className="text-lg font-black text-green-400 font-mono">{totalEarnings.toLocaleString()} ₺</div>
                    </div>
                </div>
            </div>

            {/* Smart Rota & Automation Section - Only visible when panel is open */}
            {showTopPanel && (
                <div className="bg-slate-800 rounded-[2rem] border border-slate-700/50 shadow-2xl overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                        placeholder="STRATEJİ ADI"
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
                                {filterSprinter && (
                                    <div className="bg-amber-600/20 px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-2">
                                        <span className="text-xs">🚐</span>
                                        <span className="text-[10px] font-black text-amber-400 uppercase">SPRİNTER</span>
                                    </div>
                                )}
                                {filterSwap && (
                                    <div className="bg-purple-600/20 px-3 py-1.5 rounded-xl border border-purple-500/30 flex items-center gap-2">
                                        <span className="text-xs">🔁</span>
                                        <span className="text-[10px] font-black text-purple-400 uppercase">TAKAS</span>
                                    </div>
                                )}
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
                                                <div className="flex flex-wrap gap-2">
                                                    {/* Zaman Filtresi (Radyo — tek seçim) */}
                                                    {[
                                                        { id: 'all', label: 'TÜMÜ', icon: '📋' },
                                                        { id: 'ready', label: 'HAZIR', icon: '🚨' },
                                                        { id: 'scheduled', label: 'İLERİ', icon: '📅' }
                                                    ].map(m => (
                                                        <button
                                                            key={m.id}
                                                            onClick={() => { setJobMode(m.id as any); saveFilters(undefined, m.id); }}
                                                            className={`flex-1 min-w-[60px] py-3 rounded-xl border text-[9px] font-black transition-all flex flex-col items-center gap-1.5 ${jobMode === m.id ? 'bg-green-600 border-green-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                                                        >
                                                            <span className="text-base">{m.icon}</span>
                                                            {m.label}
                                                        </button>
                                                    ))}

                                                    {/* Ayırıcı */}
                                                    <div className="w-px bg-slate-700 mx-1 self-stretch" />

                                                    {/* Araç Tipi Filtreleri (Toggle — bağımsız) */}
                                                    <button
                                                        onClick={() => { const newVal = !filterSwap; setFilterSwap(newVal); saveFilters(undefined, undefined, undefined, undefined, undefined, undefined, newVal); }}
                                                        className={`flex-1 min-w-[60px] py-3 rounded-xl border text-[9px] font-black transition-all flex flex-col items-center gap-1.5 ${filterSwap ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                                                    >
                                                        <span className="text-base">🔁</span>
                                                        TAKAS
                                                    </button>
                                                    <button
                                                        onClick={() => { const newVal = !filterSprinter; setFilterSprinter(newVal); saveFilters(undefined, undefined, undefined, undefined, undefined, newVal); }}
                                                        className={`flex-1 min-w-[60px] py-3 rounded-xl border text-[9px] font-black transition-all flex flex-col items-center gap-1.5 ${filterSprinter ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/30' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                                                    >
                                                        <span className="text-base">🚐</span>
                                                        SPRİNTER
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="text-[10px] font-black text-slate-400 ml-1">AKSİYON MODU</div>
                                                <div className="flex gap-2">
                                                    {[
                                                        { id: 'manual', label: 'MANUEL', icon: '👤', color: 'bg-blue-600' },
                                                        { id: 'auto', label: 'OTO-İŞ AL', icon: '⚡', color: 'bg-orange-600' }
                                                    ].map(m => (
                                                        <button
                                                            key={m.id}
                                                            onClick={() => { setActionMode(m.id as any); saveFilters(undefined, undefined, m.id); }}
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
                                                    Şu an <strong>{rotaName}</strong> stratejisi aktif. Seçtiğiniz bölgelerden ve belirlediğiniz fiyattan bir iş geldiğinde panel saniyeler içinde sizi uyarır. Otomasyon modunda ise müşteri hem aranır, hem de <strong>otomatik olarak iş alınır</strong> (WhatsApp mesajı gönderilir).
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Detailed Region Selection */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700/50">
                                            <button
                                                onClick={() => setRegionTab('from')}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${regionTab === 'from'
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                🛫 NEREDEN {selectedRegions.length > 0 && `(${selectedRegions.length})`}
                                            </button>
                                            <button
                                                onClick={() => setRegionTab('to')}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${regionTab === 'to'
                                                    ? 'bg-green-600 text-white shadow-lg'
                                                    : 'text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                🏁 NEREYE {selectedToRegions.length > 0 && `(${selectedToRegions.length})`}
                                            </button>
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => {
                                                    const newRegs = ISTANBUL_REGIONS.map(r => r.id);
                                                    if (regionTab === 'from') {
                                                        setSelectedRegions(newRegs);
                                                        saveFilters(newRegs);
                                                    } else {
                                                        setSelectedToRegions(newRegs);
                                                        saveFilters(undefined, undefined, undefined, undefined, undefined, undefined, undefined, newRegs);
                                                    }
                                                }}
                                                className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase underline-offset-4 hover:underline"
                                            >
                                                Hepsini Seç
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (regionTab === 'from') {
                                                        setSelectedRegions([]);
                                                        saveFilters([]);
                                                    } else {
                                                        setSelectedToRegions([]);
                                                        saveFilters(undefined, undefined, undefined, undefined, undefined, undefined, undefined, []);
                                                    }
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
                                            <div className="space-y-2">
                                                <div className="sticky top-0 bg-slate-900 z-10 py-2 border-b border-slate-800 mb-2">
                                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-2">Avrupa Yakası</h4>
                                                </div>
                                                {ISTANBUL_REGIONS.filter(r => r.side === 'Avrupa').map(reg => {
                                                    const isActive = regionTab === 'from' ? selectedRegions.includes(reg.id) : selectedToRegions.includes(reg.id);
                                                    return (
                                                        <div
                                                            key={reg.id}
                                                            onClick={() => {
                                                                if (regionTab === 'from') {
                                                                    const newRegs = isActive
                                                                        ? selectedRegions.filter(id => id !== reg.id)
                                                                        : [...selectedRegions, reg.id];
                                                                    setSelectedRegions(newRegs);
                                                                    saveFilters(newRegs);
                                                                } else {
                                                                    const newRegs = isActive
                                                                        ? selectedToRegions.filter(id => id !== reg.id)
                                                                        : [...selectedToRegions, reg.id];
                                                                    setSelectedToRegions(newRegs);
                                                                    saveFilters(undefined, undefined, undefined, undefined, undefined, undefined, undefined, newRegs);
                                                                }
                                                            }}
                                                            className={`group p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${isActive
                                                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                                                : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                                                                }`}
                                                        >
                                                            <span className="text-xs font-bold">{reg.label}</span>
                                                            {isActive && <span className="text-xs">✓</span>}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Anadolu Yakası Grubu */}
                                            <div className="space-y-2">
                                                <div className="sticky top-0 bg-slate-900 z-10 py-2 border-b border-slate-800 mb-2">
                                                    <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest pl-2">Anadolu Yakası</h4>
                                                </div>
                                                {ISTANBUL_REGIONS.filter(r => r.side === 'Anadolu').map(reg => {
                                                    const isActive = regionTab === 'from' ? selectedRegions.includes(reg.id) : selectedToRegions.includes(reg.id);
                                                    return (
                                                        <div
                                                            key={reg.id}
                                                            onClick={() => {
                                                                if (regionTab === 'from') {
                                                                    const newRegs = isActive
                                                                        ? selectedRegions.filter(id => id !== reg.id)
                                                                        : [...selectedRegions, reg.id];
                                                                    setSelectedRegions(newRegs);
                                                                    saveFilters(newRegs);
                                                                } else {
                                                                    const newRegs = isActive
                                                                        ? selectedToRegions.filter(id => id !== reg.id)
                                                                        : [...selectedToRegions, reg.id];
                                                                    setSelectedToRegions(newRegs);
                                                                    saveFilters(undefined, undefined, undefined, undefined, undefined, undefined, undefined, newRegs);
                                                                }
                                                            }}
                                                            className={`group p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${isActive
                                                                ? 'bg-green-600 border-green-500 text-white shadow-lg'
                                                                : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                                                                }`}
                                                        >
                                                            <span className="text-xs font-bold">{reg.label}</span>
                                                            {isActive && <span className="text-xs">✓</span>}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quick Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <input
                    type="text"
                    placeholder="Varış yeri veya kelime ara..."
                    className="bg-slate-800 border-none text-white text-xs font-bold rounded-xl px-4 py-3 min-w-[200px] flex-1 focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
                    value={regionSearch}
                    onChange={(e) => setRegionSearch(e.target.value)}
                />
                <button
                    onClick={() => setShowOnlyAirport(!showOnlyAirport)}
                    className={`px-4 py-3 rounded-xl min-w-fit text-xs font-black uppercase tracking-tight transition-all active:scale-95 border ${showOnlyAirport ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                >
                    ✈️ HAVALİMANI
                </button>
                <button
                    onClick={() => setShowOnlyVip(!showOnlyVip)}
                    className={`px-4 py-3 rounded-xl min-w-fit text-xs font-black uppercase tracking-tight transition-all active:scale-95 border ${showOnlyVip ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                >
                    👑 VIP (2000+)
                </button>
            </div>

            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white tracking-tighter flex items-center gap-2">
                    📋 {filteredJobs.length} UYGUN İŞ BULUNDU
                </h2>
            </div>

            {/* Jobs List */}
            <div className="space-y-4">
                {filteredJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-800/50 rounded-3xl border border-slate-700/50 border-dashed">
                        <div className="text-4xl mb-4">📭</div>
                        <div className="font-black text-lg">HİÇ İŞ YOK</div>
                        <div className="text-sm opacity-60">Şu an kriterlerinize uygun iş bulunamadı.</div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredJobs.slice(0, visibleCount).map((job: any) => (
                                <div
                                    key={job.id}
                                    className={`relative group bg-slate-800 rounded-3xl p-5 border transition-all hover:scale-[1.01] hover:shadow-2xl ${job.status === 'won' ? 'border-red-500 shadow-red-900/40' :
                                        job.status === 'ignored' ? 'border-red-500/50 opacity-60 grayscale' :
                                            job.status === 'called' ? 'border-blue-500/50 shadow-blue-900/20' :
                                                'border-slate-700 hover:border-slate-500'
                                        }`}
                                >
                                    {/* ... (Job card header remains same) ... */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                title={job.status === 'won' ? 'İşi Kazandınız' : job.status === 'ignored' ? 'Yoksayıldı' : job.status === 'called' ? 'Arandı / İlgilenildi' : 'Yeni İş / Bekliyor'}
                                                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg cursor-help ${job.status === 'won' ? 'bg-red-600' :
                                                    job.status === 'ignored' ? 'bg-red-500' :
                                                        job.status === 'called' ? 'bg-blue-500' :
                                                            'bg-gradient-to-br from-slate-600 to-slate-700'
                                                    }`}>
                                                {job.status === 'won' ? '✓' : job.status === 'ignored' ? '✕' : job.status === 'called' ? '📞' : '⚡'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase tracking-tight whitespace-nowrap ${job.status === 'won' ? 'text-red-500' : 'text-slate-500'}`}>
                                                        {job.status === 'won' ? '🚀 İŞ SENDE' : (job.time || 'SAAT BELİRSİZ')}
                                                    </span>
                                                    {job.created_at && (
                                                        <span className="text-[9px] font-bold text-slate-600 bg-slate-900/50 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                            {(() => {
                                                                try {
                                                                    const date = new Date(job.created_at);
                                                                    // Geçerli tarih kontrolü
                                                                    if (isNaN(date.getTime())) return '';
                                                                    const hours = date.getHours().toString().padStart(2, '0');
                                                                    const minutes = date.getMinutes().toString().padStart(2, '0');
                                                                    return `${hours}:${minutes}`;
                                                                } catch (e) { return ''; }
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-bold text-slate-300 text-[10px] mt-0.5 max-w-[150px] truncate opacity-70">
                                                    {job.raw_message?.slice(0, 40)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                            <div className="text-lg font-black text-white tracking-tighter whitespace-nowrap">{job.price}</div>
                                            {job.is_swap === 1 && (
                                                <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded uppercase mt-1 border border-purple-500/20 whitespace-nowrap">
                                                    🔁 TAKASLI
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Route Visual */}
                                    {job.is_swap === 1 || job.from_loc === 'ÇOKLU / TAKAS' ? (
                                        <div className="bg-slate-900/50 p-4 rounded-2xl mb-4 border border-purple-500/20 relative overflow-hidden group-hover:border-purple-500/40 transition-colors">
                                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                                <span className="text-4xl">🔁</span>
                                            </div>
                                            <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <span>🔁 TAKAS / ÇOKLU İŞ DETAYI</span>
                                                <div className="h-px bg-purple-500/20 flex-1"></div>
                                            </div>
                                            <p className="text-sm font-bold text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                {job.raw_message}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-2xl mb-4 border border-white/5">
                                            <div className="flex-1 min-w-0 text-right">
                                                <div className="text-sm font-black text-white truncate" title={job.from_loc}>{job.from_loc || '?'}</div>
                                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">NEREDEN</div>
                                            </div>
                                            <div className="flex flex-col items-center justify-center px-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mb-1" />
                                                <div className="h-8 w-px bg-gradient-to-b from-slate-600 via-green-500 to-slate-600" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1" />
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className="text-sm font-black text-white truncate" title={job.to_loc}>{job.to_loc || '?'}</div>
                                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">NEREYE</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {job.status === 'won' ? (
                                            <div className="col-span-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-center animate-in zoom-in-95 duration-300">
                                                <div className="text-red-500 font-black text-sm uppercase">İŞ SENİN! 🚀</div>
                                                <div className="text-[10px] text-red-500/60 font-bold mt-1 uppercase tracking-widest">Müşteriye mesajın gönderildi.</div>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleIgnore(job.id)}
                                                    className="bg-slate-700/50 hover:bg-slate-700 text-slate-400 font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest border border-transparent hover:border-slate-600"
                                                >
                                                    Yoksay
                                                </button>

                                                {(job.status === 'called' || job.phone) ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={() => handleCall(job.phone, job.id)}
                                                            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 flex items-center justify-center gap-1.5"
                                                        >
                                                            <span>📞 ARA</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleTakeJob(job.id, job.group_jid, job.phone)}
                                                            disabled={loadingJobId === job.id}
                                                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest shadow-lg shadow-green-900/20"
                                                        >
                                                            {loadingJobId === job.id ? (
                                                                <span className="animate-pulse">...</span>
                                                            ) : (
                                                                "İŞİ AL"
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleTakeJob(job.id, job.group_jid, job.phone)}
                                                        disabled={loadingJobId === job.id}
                                                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest shadow-lg shadow-green-900/20"
                                                    >
                                                        {loadingJobId === job.id ? (
                                                            <span className="animate-pulse">...</span>
                                                        ) : (
                                                            "İŞİ AL"
                                                        )}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Quick Ignore for already called jobs (if needed) */}
                                    {job.status === 'called' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleIgnore(job.id); }}
                                            className="absolute top-2 right-2 p-2 text-slate-600 hover:text-red-400 transition-colors"
                                            title="Listeden Kaldır"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Load More Button */}
                        {visibleCount < filteredJobs.length && (
                            <button
                                onClick={() => setVisibleCount(prev => prev + 50)}
                                className="w-full py-4 mt-6 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold rounded-2xl transition-all border border-slate-700 hover:border-slate-600"
                            >
                                DAHA FAZLA GÖSTER ({filteredJobs.length - visibleCount} İŞ DAHA)
                            </button>
                        )}
                    </>
                )}
            </div>
            {/* Manual Job Modal */}
            {isAddingJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                                ➕ YENİ İŞ EKLE
                            </h3>
                            <button
                                onClick={() => setIsAddingJob(false)}
                                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">NEREDEN *</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                                        placeholder="Örn: Havalimanı"
                                        value={newJobData.from_loc}
                                        onChange={e => setNewJobData({ ...newJobData, from_loc: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">NEREYE *</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                                        placeholder="Örn: Taksim"
                                        value={newJobData.to_loc}
                                        onChange={e => setNewJobData({ ...newJobData, to_loc: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">FİYAT (TL) *</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-green-400 font-black text-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                                        placeholder="0"
                                        value={newJobData.price}
                                        onChange={e => setNewJobData({ ...newJobData, price: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SAAT / TARİH</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                                        placeholder="Örn: HEMEN veya 14:30"
                                        value={newJobData.time}
                                        onChange={e => setNewJobData({ ...newJobData, time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">İLETİŞİM NUMARASI *</label>
                                <input
                                    type="tel"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600"
                                    placeholder="05xxxxxxxxx"
                                    value={newJobData.contact_phone}
                                    onChange={e => setNewJobData({ ...newJobData, contact_phone: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-500 ml-1">Diğer sürücüler sizi bu numaradan arayacaktır.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">AÇIKLAMA / NOT</label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-600 h-24 resize-none"
                                    placeholder="Araç tipi, yolcu sayısı veya diğer detaylar..."
                                    value={newJobData.description}
                                    onChange={e => setNewJobData({ ...newJobData, description: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={handleAddJob}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl shadow-lg shadow-green-900/20 active:scale-95 transition-all text-sm uppercase tracking-widest mt-2"
                            >
                                ✅ İŞİ YAYINLA
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profil Tamamlama Modal */}
            {showProfileModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 border border-blue-500/30">👤</div>
                            <h2 className="text-2xl font-black text-white tracking-tight uppercase">Profilini Tamamla</h2>
                            <p className="text-slate-400 text-sm font-medium">İş alabilmek için profil bilgilerini doldurman zorunludur.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">AD SOYAD</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3.5 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Mustafa Çoban"
                                    value={profileFormData.name}
                                    onChange={e => setProfileFormData({ ...profileFormData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">TELEFON NUMARASI</label>
                                <input
                                    type="tel"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3.5 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="05xxxxxxxxx"
                                    value={profileFormData.driver_phone}
                                    onChange={e => setProfileFormData({ ...profileFormData, driver_phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ARAÇ PLAKASI</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3.5 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="34 ABC 123"
                                    value={profileFormData.driver_plate}
                                    onChange={e => setProfileFormData({ ...profileFormData, driver_plate: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <button
                                onClick={handleUpdateProfile}
                                disabled={isSavingProfile}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all text-sm uppercase tracking-widest mt-4"
                            >
                                {isSavingProfile ? 'KAYDEDİLİYOR...' : 'PROFİLİ KAYDET'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isRestricted && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-orange-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 border border-white/20 animate-bounce">
                    <span>🚫 HESABINIZ KISITLANDI (SADECE İZLEME MODU)</span>
                </div>
            )}

            {/* Harici Şoför Atama Modalı */}
            {showAssignModal && assigningJob && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-8 space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-purple-500/30">🚕</div>
                            <h2 className="text-2xl font-black text-white tracking-tight uppercase">İşi Kim Alıyor?</h2>
                            <p className="text-slate-400 text-sm font-medium">Bu işi kendiniz alabilir veya bir harici şoföre atayabilirsiniz.</p>
                        </div>

                        <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 mb-6">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">SEÇİLEN İŞ</p>
                            <p className="text-white font-bold">{assigningJob.details.from_loc} → {assigningJob.details.to_loc}</p>
                            <p className="text-green-400 font-bold text-sm">{assigningJob.details.price}</p>
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {/* Admin Kendi Alması */}
                            <button
                                onClick={() => handleTakeJob(assigningJob.jobId, assigningJob.groupJid, assigningJob.phone, -1)}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl flex items-center justify-between group transition-all"
                            >
                                <div className="text-left">
                                    <p className="font-black text-sm uppercase">KENDİM ALIYORUM</p>
                                    <p className="text-white/60 text-xs">Kendi şoför bilgilerimle mesaj atılsın</p>
                                </div>
                                <span className="text-2xl group-hover:translate-x-1 transition-transform">➡</span>
                            </button>

                            <div className="relative py-2 flex items-center">
                                <div className="flex-grow border-t border-white/5"></div>
                                <span className="flex-shrink mx-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">VEYA HARİCİ ŞOFÖRE ATAYIN</span>
                                <div className="flex-grow border-t border-white/5"></div>
                            </div>

                            {/* Harici Şoför Listesi */}
                            {externalDrivers.length === 0 ? (
                                <div className="text-center py-4 bg-slate-800/30 rounded-2xl border border-dashed border-white/10">
                                    <p className="text-slate-500 text-xs font-bold uppercase">Henüz aktif harici şoför yok.</p>
                                    <button
                                        onClick={() => router.push('/dashboard/admin/external-drivers')}
                                        className="text-blue-400 text-[10px] font-black mt-2 underline"
                                    >
                                        ŞOFÖR EKLEMEK İÇİN TIKLAYIN
                                    </button>
                                </div>
                            ) : (
                                externalDrivers.map(dr => (
                                    <button
                                        key={dr.id}
                                        onClick={() => handleTakeJob(assigningJob.jobId, assigningJob.groupJid, assigningJob.phone, dr.id)}
                                        className="w-full bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-purple-500/50 text-white p-4 rounded-2xl flex items-center justify-between group transition-all"
                                    >
                                        <div className="text-left">
                                            <p className="font-bold text-sm uppercase">{dr.name}</p>
                                            <p className="text-slate-400 text-[10px] font-medium">{dr.plate} • {dr.vehicle_type}</p>
                                        </div>
                                        <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">İş Ver</span>
                                    </button>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setShowAssignModal(false);
                                setAssigningJob(null);
                            }}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-black py-4 rounded-2xl transition-all text-[10px] uppercase tracking-widest mt-4"
                        >
                            Vazgeç
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
