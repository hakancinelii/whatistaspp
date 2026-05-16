"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api-client";

interface AccountingEntry {
    id: number;
    job_id: number;
    agency_name: string;
    from_loc: string;
    to_loc: string;
    price: string;
    price_numeric: number;
    contact_phone: string;
    job_time: string;
    taken_at: string;
    is_confirmed: boolean;
    payment_status: 'pending' | 'received' | 'cancelled';
    payment_received_at: string | null;
    notes: string | null;
}

interface AgencySummary {
    agency_name: string;
    total: number;
    pending: number;
    received: number;
    count: number;
}

interface Stats {
    total_jobs: number;
    total_amount: number;
    pending_amount: number;
    received_amount: number;
    confirmed_jobs: number;
}

export default function AccountingPage() {
    const [entries, setEntries] = useState<AccountingEntry[]>([]);
    const [agencySummary, setAgencySummary] = useState<AgencySummary[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterAgency, setFilterAgency] = useState<string>('');
    const [filterDays, setFilterDays] = useState<number>(30);
    const [activeTab, setActiveTab] = useState<'table' | 'agencies'>('table');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [editNoteId, setEditNoteId] = useState<number | null>(null);
    const [noteText, setNoteText] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [filterStatus, filterDays]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const params = new URLSearchParams({
                days: filterDays.toString(),
                ...(filterStatus !== 'all' && { status: filterStatus }),
                ...(filterAgency && { agency: filterAgency }),
            });
            const res = await apiFetch(`/api/accounting?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setEntries(data.entries || []);
                setAgencySummary(data.agency_summary || []);
                setStats(data.stats || null);
                setError(null);
            } else {
                const errData = await res.json().catch(() => ({}));
                setError(errData.error || 'Veriler alınırken bir hata oluştu.');
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Sunucu bağlantı hatası.');
        } finally {
            setLoading(false);
        }
    };

    const updateEntry = async (id: number, updates: Partial<{ payment_status: string; is_confirmed: boolean; notes: string }>) => {
        setUpdatingId(id);
        try {
            const token = localStorage.getItem("token");
            const res = await apiFetch('/api/accounting', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id, ...updates })
            });
            if (res.ok) {
                fetchData();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingId(null);
        }
    };

    const deleteEntry = async (id: number) => {
        if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;
        const token = localStorage.getItem("token");
        await apiFetch(`/api/accounting?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchData();
    };

    const formatDate = (d: string) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            if (filterAgency && !e.agency_name?.toLowerCase().includes(filterAgency.toLowerCase())) return false;
            return true;
        });
    }, [entries, filterAgency]);

    const sortedAgencies = [...agencySummary].sort((a, b) => b.pending - a.pending);

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="bg-app-card rounded-3xl border border-app-border p-6 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-green-500/10 p-4 rounded-2xl">
                            <span className="text-3xl">💰</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-app-fg">MUHASEBEm</h1>
                            <p className="text-app-subtle text-sm mt-1">Alınan işler ve acente ödemeleri</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {[7, 30, 90].map(d => (
                            <button
                                key={d}
                                onClick={() => setFilterDays(d)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${filterDays === d ? 'bg-green-600 text-white' : 'bg-app-elevated text-app-subtle hover:text-app-muted border border-app-border'}`}
                            >
                                Son {d} Gün
                            </button>
                        ))}
                        <button
                            onClick={fetchData}
                            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-app-elevated text-app-subtle hover:text-app-muted border border-app-border transition-all active:scale-95"
                        >
                            🔄 YENİLE
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-1">
                        <div className="text-xs font-black text-app-subtle uppercase tracking-widest">Toplam İş</div>
                        <div className="text-3xl font-black text-app-fg">{stats.total_jobs}</div>
                        <div className="text-xs text-app-subtle">Onaylı: {stats.confirmed_jobs}</div>
                    </div>
                    <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-1">
                        <div className="text-xs font-black text-app-subtle uppercase tracking-widest">Toplam Tutar</div>
                        <div className="text-3xl font-black text-green-400">{stats.total_amount.toLocaleString('tr-TR')} ₺</div>
                        <div className="text-xs text-app-subtle">Tüm işler</div>
                    </div>
                    <div className="bg-red-500/5 rounded-2xl border border-red-500/20 p-5 space-y-1">
                        <div className="text-xs font-black text-red-400 uppercase tracking-widest">⏳ Bekleyen</div>
                        <div className="text-3xl font-black text-red-400">{stats.pending_amount.toLocaleString('tr-TR')} ₺</div>
                        <div className="text-xs text-red-400/60">Tahsil edilmedi</div>
                    </div>
                    <div className="bg-green-500/5 rounded-2xl border border-green-500/20 p-5 space-y-1">
                        <div className="text-xs font-black text-green-400 uppercase tracking-widest">✅ Tahsil</div>
                        <div className="text-3xl font-black text-green-400">{stats.received_amount.toLocaleString('tr-TR')} ₺</div>
                        <div className="text-xs text-green-400/60">Alındı</div>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-500 text-sm font-bold animate-in fade-in slide-in-from-top-2">
                    ⚠️ {error}
                    <button onClick={fetchData} className="ml-4 underline hover:text-red-400">Tekrar Dene</button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-2 bg-app-card/50 p-1 rounded-2xl border border-app-border w-fit">
                <button onClick={() => setActiveTab('table')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'table' ? 'bg-green-600 text-white shadow-lg' : 'text-app-subtle hover:text-app-muted'}`}>📋 İş Tablosu</button>
                <button onClick={() => setActiveTab('agencies')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'agencies' ? 'bg-orange-600 text-white shadow-lg' : 'text-app-subtle hover:text-app-muted'}`}>🏢 Acenteler</button>
            </div>

            {/* Filters */}
            {activeTab === 'table' && (
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        placeholder="Acente ara..."
                        value={filterAgency}
                        onChange={e => setFilterAgency(e.target.value)}
                        className="bg-app-card border border-app-border rounded-xl px-4 py-2 text-sm font-medium text-app-fg placeholder:text-app-subtle focus:ring-2 focus:ring-green-500/30 focus:outline-none"
                    />
                    {['all', 'pending', 'received', 'cancelled'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${filterStatus === s
                                ? s === 'pending' ? 'bg-red-600 text-white border-red-500'
                                    : s === 'received' ? 'bg-green-600 text-white border-green-500'
                                        : s === 'cancelled' ? 'bg-gray-600 text-white border-gray-500'
                                            : 'bg-app-fg text-app-bg border-app-fg'
                                : 'bg-app-elevated text-app-subtle border-app-border hover:text-app-muted'}`}
                        >
                            {s === 'all' ? 'Tümü' : s === 'pending' ? '⏳ Bekleyen' : s === 'received' ? '✅ Tahsil' : '❌ İptal'}
                        </button>
                    ))}
                </div>
            )}

            {/* Table Tab */}
            {activeTab === 'table' && (
                <div className="bg-app-card rounded-2xl border border-app-border overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="text-center py-16 text-app-subtle font-medium">
                            <div className="text-4xl mb-3">📭</div>
                            Kayıt bulunamadı. İş alındığında otomatik kaydedilecek.
                        </div>
                    ) : (
                        <table className="w-full text-left min-w-[900px]">
                            <thead>
                                <tr className="bg-app-bg/50 border-b border-app-border">
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase">Tarih / Saat</th>
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase">Acente</th>
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase">Güzergah</th>
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase">Telefon</th>
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase">Fiyat</th>
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase text-center">Onay</th>
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase text-center">Ödeme</th>
                                    <th className="px-4 py-3 text-xs font-black text-app-subtle uppercase text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-app-border">
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id} className={`transition-colors hover:bg-app-elevated/30 ${entry.payment_status === 'received' ? 'opacity-60' : ''}`}>
                                        {/* Tarih */}
                                        <td className="px-4 py-3">
                                            <div className="text-xs font-bold text-app-fg">{formatDate(entry.taken_at)}</div>
                                            {entry.job_time && <div className="text-[11px] text-app-subtle mt-0.5">İş: {entry.job_time}</div>}
                                        </td>
                                        {/* Acente */}
                                        <td className="px-4 py-3">
                                            <div className="text-xs font-black text-orange-400 max-w-[140px] truncate" title={entry.agency_name}>
                                                🏢 {entry.agency_name || '-'}
                                            </div>
                                        </td>
                                        {/* Güzergah */}
                                        <td className="px-4 py-3">
                                            <div className="text-xs font-bold text-app-fg">
                                                <span className="text-blue-400">{entry.from_loc || '?'}</span>
                                                <span className="text-app-subtle mx-1">→</span>
                                                <span className="text-purple-400">{entry.to_loc || '?'}</span>
                                            </div>
                                        </td>
                                        {/* Telefon */}
                                        <td className="px-4 py-3">
                                            <a href={`tel:${entry.contact_phone}`} className="text-xs font-mono text-blue-400 hover:text-blue-300">
                                                {entry.contact_phone || '-'}
                                            </a>
                                        </td>
                                        {/* Fiyat */}
                                        <td className="px-4 py-3">
                                            <span className={`text-sm font-black ${entry.payment_status === 'received' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {entry.price_numeric > 0 ? `${entry.price_numeric.toLocaleString('tr-TR')} ₺` : entry.price || '-'}
                                            </span>
                                        </td>
                                        {/* Onay */}
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => updateEntry(entry.id, { is_confirmed: !entry.is_confirmed })}
                                                disabled={updatingId === entry.id}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase transition-all ${entry.is_confirmed
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}
                                            >
                                                {entry.is_confirmed ? '✅ ONAYLANDI' : '❓ BEKLİYOR'}
                                            </button>
                                        </td>
                                        {/* Ödeme */}
                                        <td className="px-4 py-3 text-center">
                                            {entry.payment_status === 'pending' ? (
                                                <button
                                                    onClick={() => updateEntry(entry.id, { payment_status: 'received' })}
                                                    disabled={updatingId === entry.id}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30 transition-all"
                                                >
                                                    ⏳ BORÇLU
                                                </button>
                                            ) : entry.payment_status === 'received' ? (
                                                <button
                                                    onClick={() => updateEntry(entry.id, { payment_status: 'pending' })}
                                                    disabled={updatingId === entry.id}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase bg-green-500/20 text-green-400 border border-green-500/30 transition-all"
                                                >
                                                    ✅ TAHSİL
                                                </button>
                                            ) : (
                                                <span className="px-2 py-1 rounded-lg text-[11px] font-black uppercase bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                                    ❌ İPTAL
                                                </span>
                                            )}
                                        </td>
                                        {/* İşlem */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {editNoteId === entry.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            autoFocus
                                                            value={noteText}
                                                            onChange={e => setNoteText(e.target.value)}
                                                            placeholder="Not..."
                                                            className="bg-app-elevated border border-app-border rounded-lg px-2 py-1 text-xs text-app-fg w-32"
                                                        />
                                                        <button
                                                            onClick={() => { updateEntry(entry.id, { notes: noteText }); setEditNoteId(null); }}
                                                            className="px-2 py-1 rounded-lg text-[10px] font-black bg-green-600 text-white"
                                                        >✓</button>
                                                        <button onClick={() => setEditNoteId(null)} className="px-2 py-1 rounded-lg text-[10px] font-black bg-app-elevated text-app-subtle">✕</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setEditNoteId(entry.id); setNoteText(entry.notes || ''); }}
                                                        className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-app-elevated text-app-subtle hover:text-app-muted border border-app-border transition-all"
                                                        title={entry.notes || 'Not ekle'}
                                                    >
                                                        {entry.notes ? '📝' : '+ NOT'}
                                                    </button>
                                                )}
                                                {entry.payment_status === 'pending' && (
                                                    <button
                                                        onClick={() => updateEntry(entry.id, { payment_status: 'cancelled' })}
                                                        disabled={updatingId === entry.id}
                                                        className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-app-elevated text-red-400/50 hover:text-red-400 border border-app-border transition-all"
                                                        title="İptal et"
                                                    >
                                                        ❌
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteEntry(entry.id)}
                                                    className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-app-elevated text-app-subtle hover:text-red-400 border border-app-border transition-all"
                                                    title="Sil"
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Agencies Tab */}
            {activeTab === 'agencies' && (
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : sortedAgencies.length === 0 ? (
                        <div className="text-center py-16 text-app-subtle font-medium bg-app-card rounded-2xl border border-app-border">
                            <div className="text-4xl mb-3">🏢</div>
                            Acente kaydı bulunamadı.
                        </div>
                    ) : (
                        sortedAgencies.map(ag => (
                            <div key={ag.agency_name} className={`bg-app-card rounded-2xl border p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${ag.pending > 0 ? 'border-red-500/20' : 'border-app-border'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${ag.pending > 0 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-green-500'}`} />
                                    <div>
                                        <div className="font-black text-app-fg">{ag.agency_name}</div>
                                        <div className="text-xs text-app-subtle mt-0.5">{ag.count} iş</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 flex-wrap">
                                    <div className="text-center">
                                        <div className="text-xs font-black text-app-subtle uppercase">Toplam</div>
                                        <div className="text-lg font-black text-app-fg">{ag.total.toLocaleString('tr-TR')} ₺</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-black text-red-400 uppercase">Borçlu</div>
                                        <div className={`text-lg font-black ${ag.pending > 0 ? 'text-red-400' : 'text-app-subtle'}`}>{ag.pending.toLocaleString('tr-TR')} ₺</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-black text-green-400 uppercase">Tahsil</div>
                                        <div className="text-lg font-black text-green-400">{ag.received.toLocaleString('tr-TR')} ₺</div>
                                    </div>
                                    <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase border ${ag.pending > 0 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                                        {ag.pending > 0 ? `⏳ ${ag.pending.toLocaleString('tr-TR')} ₺ BORÇLU` : '✅ KAPALI'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
