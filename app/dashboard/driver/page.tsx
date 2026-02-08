"use client";

import { useEffect, useState, useRef } from "react";

export default function DriverDashboard() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoCall, setAutoCall] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchJobs = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await fetch("/api/jobs", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.status === 500) {
                setError(data.details || data.error || "Sunucu hatası");
                return;
            }

            if (!data.error && Array.isArray(data)) {
                setError(null);
                // Eğer yeni bir iş geldiyse ve liste boş değilse ses çal
                if (jobs.length > 0 && data.length > jobs.length) {
                    playAlert();
                    if (autoCall) {
                        const newJob = data[0];
                        handleCall(newJob.phone, newJob.id);
                    }
                }
                setJobs(data);
            } else if (data.error) {
                setError(data.error);
            }
        } catch (e: any) {
            console.error("Jobs fetch error:", e);
            setError(e.message);
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
        const interval = setInterval(fetchJobs, 10000); // 10 saniyede bir kontrol et
        return () => clearInterval(interval);
    }, [jobs.length, autoCall]);

    const handleCall = async (phone: string, jobId: number) => {
        const token = localStorage.getItem("token");
        // Durumu güncelle
        await fetch("/api/jobs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ jobId, status: 'called' })
        });

        // Telefonu ara
        window.location.href = `tel:${phone}`;
    };

    const handleIgnore = async (jobId: number) => {
        const token = localStorage.getItem("token");
        await fetch("/api/jobs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ jobId, status: 'ignored' })
        });
        fetchJobs();
    };

    if (loading) return <div className="p-8 text-white">Yükleniyor...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            {/* Hidden audio for alerts */}
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">🚕 SOSYAL TRANSFER</h1>
                    <p className="text-slate-400 text-sm font-medium">Gruplardaki işleri anında yakala!</p>
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

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-2xl text-red-400 text-sm font-medium">
                    ⚠️ Hata: {error}
                </div>
            )}


            <div className="space-y-4">
                {jobs.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-700">
                        <p className="text-slate-500 font-bold">Henüz yeni iş düşmedi...</p>
                        <p className="text-slate-600 text-sm mt-1">Gruplarınız taranıyor.</p>
                    </div>
                ) : (
                    jobs.map((job) => (
                        <div
                            key={job.id}
                            className={`group bg-slate-800 rounded-3xl p-6 border-2 transition-all duration-300 transform active:scale-[0.98] ${job.status === 'called' ? 'border-slate-700 opacity-60' :
                                job.status === 'ignored' ? 'border-red-900/30 opacity-40' :
                                    'border-green-500 shadow-xl shadow-green-500/10'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-500/20 text-green-400 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                                            {new Date(job.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {job.status === 'pending' && (
                                            <div className="animate-pulse bg-red-500 w-2 h-2 rounded-full" />
                                        )}
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
                                        "{job.raw_message.substring(0, 100)}..."
                                    </div>
                                </div>

                                <div className="flex flex-row md:flex-col gap-3 min-w-[160px]">
                                    <button
                                        onClick={() => handleCall(job.phone, job.id)}
                                        className={`flex-1 py-5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg ${job.status === 'called'
                                            ? 'bg-slate-700 text-slate-400'
                                            : 'bg-green-600 hover:bg-green-500 text-white shadow-green-600/20 active:translate-y-1'
                                            }`}
                                    >
                                        <span className="text-lg font-black tracking-widest uppercase">HEMEN ARA</span>
                                        <span className="text-xs font-bold font-mono opacity-80">{job.phone}</span>
                                    </button>

                                    <button
                                        onClick={() => handleIgnore(job.id)}
                                        className="py-3 px-4 rounded-xl text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                    >
                                        YOKSAY
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
