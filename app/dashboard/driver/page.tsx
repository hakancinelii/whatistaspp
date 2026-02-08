"use client";

import { useEffect, useState, useRef } from "react";

export default function DriverDashboard() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoCall, setAutoCall] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [minPrice, setMinPrice] = useState<number>(0);
    const [regionSearch, setRegionSearch] = useState("");
    const [isWakeLockActive, setIsWakeLockActive] = useState(false);
    const [waStatus, setWaStatus] = useState({ isConnected: false, isConnecting: false });
    const [loadingJobId, setLoadingJobId] = useState<number | null>(null);
    const [view, setView] = useState<'active' | 'history'>('active');
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
                setJobs(data);
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

    useEffect(() => {
        fetchJobs();
        checkWAStatus();
        const interval = setInterval(fetchJobs, 10000); // 10 saniyede bir kontrol et
        waStatusIntervalRef.current = setInterval(checkWAStatus, 5000); // 5 saniyede bir WP durumu

        return () => {
            clearInterval(interval);
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

        const priceNum = parseInt(job.price.replace(/\D/g, '')) || 0;
        const textMatch = (job.from_loc + job.to_loc + job.raw_message).toLowerCase().includes(regionSearch.toLowerCase());
        const priceMatch = minPrice === 0 || priceNum >= minPrice;
        return textMatch && priceMatch;
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

                <div className="flex items-center gap-8">
                    <div className="text-center">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">BUGÜNKÜ İŞLER</div>
                        <div className="text-2xl font-black text-white">{todayWonCount}</div>
                    </div>
                    <div className="h-8 w-px bg-slate-700" />
                    <div className="text-center">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">TOPLAM KAZANÇ</div>
                        <div className="text-2xl font-black text-green-400">{totalEarnings.toLocaleString()} ₺</div>
                    </div>
                </div>
            </div>

            {/* Smart Filters */}
            <div className="bg-slate-900/50 p-4 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Nereye veya nereden? (SAW, Beşiktaş...)"
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 transition-all font-bold"
                    />
                </div>
                <div className="flex items-center gap-4 px-2 text-white">
                    <span className="text-xs font-black text-slate-500 uppercase whitespace-nowrap">Min Fiyat:</span>
                    <input
                        type="range"
                        min="0"
                        max="5000"
                        step="100"
                        value={minPrice}
                        onChange={(e) => setMinPrice(parseInt(e.target.value))}
                        className="flex-1 accent-green-500"
                    />
                    <span className="text-sm font-black text-green-400 w-16">{minPrice}₺</span>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-2xl text-red-400 text-sm font-medium">
                    ⚠️ Hata: {error}
                </div>
            )}


            <div className="space-y-4">
                {filteredJobs.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-700">
                        <p className="text-slate-500 font-bold">Aradığınız kriterde iş bulunamadı...</p>
                        <p className="text-slate-600 text-sm mt-1">Filtreleri esneterek daha fazla iş görebilirsiniz.</p>
                    </div>
                ) : (
                    filteredJobs.map((job) => (
                        <div
                            key={job.id}
                            className={`group bg-slate-800 rounded-3xl p-6 border-2 transition-all duration-300 ${job.status === 'called' ? 'border-green-500/50 shadow-lg shadow-green-500/10' :
                                job.status === 'ignored' ? 'border-red-900/30 opacity-40' :
                                    'border-slate-700'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-green-500/20 text-green-400 text-[10px] font-black px-2 py-1 rounded-lg uppercase">
                                                {new Date(job.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            {job.time && job.time !== 'Belirtilmedi' && (
                                                <div className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase flex items-center gap-1 ${job.time.includes('ACİL') ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg' : 'bg-slate-700 text-slate-300 border border-white/10'}`}>
                                                    {job.time.includes('ACİL') && '🚨'} {job.time}
                                                </div>
                                            )}
                                            {job.status === 'pending' && (
                                                <div className="animate-pulse bg-red-500 w-2 h-2 rounded-full" />
                                            )}
                                        </div>
                                        <div className="flex gap-2 text-[10px] font-bold">
                                            <a
                                                href={`https://www.google.com/maps/search/${encodeURIComponent(job.from_loc)}`}
                                                target="_blank"
                                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-lg"
                                            >
                                                📍 ALIM
                                            </a>
                                            <a
                                                href={`https://www.google.com/maps/search/${encodeURIComponent(job.to_loc)}`}
                                                target="_blank"
                                                className="text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-lg"
                                            >
                                                🏁 VARIŞ
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-4 text-white">
                                            <span className="text-2xl font-black">{job.from_loc}</span>
                                            <span className="text-slate-600">→</span>
                                            <span className="text-2xl font-black">{job.to_loc}</span>
                                        </div>
                                        <div className="text-3xl font-black text-green-400 font-mono tracking-tighter">
                                            {job.price}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-900/50 rounded-xl text-xs text-slate-400 border border-white/5 font-medium italic">
                                        "{job.raw_message}"
                                    </div>
                                </div>

                                <div className="flex flex-row md:flex-col gap-3 min-w-[200px]">
                                    {view === 'active' ? (
                                        <>
                                            <button
                                                onClick={() => handleCall(job.phone, job.id)}
                                                className={`flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg ${job.status === 'called'
                                                    ? 'bg-slate-800 border-2 border-slate-600 text-slate-400'
                                                    : 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/20 active:scale-95'
                                                    }`}
                                            >
                                                <span className="text-lg font-black tracking-widest uppercase">ARA</span>
                                                <span className="text-[10px] font-bold font-mono opacity-80">{job.phone}</span>
                                            </button>

                                            {job.status === 'called' ? (
                                                <button
                                                    onClick={() => handleWonJob(job.id)}
                                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-600/30 animate-pulse border-2 border-white/10 active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    İŞ BENDE / ALDIM ✅
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleTakeJob(job.id, job.group_jid, job.phone)}
                                                        disabled={!!loadingJobId}
                                                        className={`flex-1 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${loadingJobId === job.id ? 'bg-orange-600 animate-pulse cursor-wait' : 'bg-blue-600 hover:bg-blue-500'}`}
                                                    >
                                                        {loadingJobId === job.id ? 'GÖNDERİLİYOR...' : 'İŞİ AL 👋'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleIgnore(job.id)}
                                                        className="py-3 px-3 rounded-xl bg-slate-700 text-slate-400 text-[10px] font-black uppercase hover:bg-red-500/20 hover:text-red-400 transition-all font-mono"
                                                    >
                                                        YOKSAY
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col gap-2 h-full justify-center">
                                            <div className="bg-slate-700/50 p-4 rounded-2xl text-center border border-white/5 space-y-1">
                                                <div className="text-[10px] text-slate-500 font-black uppercase">TAMAMLANMA</div>
                                                <div className="text-xs text-white font-black">
                                                    {new Date(job.completed_at || job.created_at).toLocaleDateString('tr-TR')}
                                                </div>
                                            </div>
                                            <div className="bg-green-500/10 p-4 rounded-2xl text-center border border-green-500/20 space-y-1">
                                                <div className="text-[10px] text-green-500 font-black uppercase">KAZANILAN</div>
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
