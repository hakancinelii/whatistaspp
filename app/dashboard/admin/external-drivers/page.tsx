'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExternalDriversPage() {
    const router = useRouter();
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDriver, setEditingDriver] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        plate: '',
        vehicle_type: '',
        notes: ''
    });

    const fetchDrivers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/external-drivers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDrivers(data);
            }
        } catch (e) {
            console.error('Failed to fetch drivers:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrivers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        try {
            const url = editingDriver
                ? '/api/admin/external-drivers'
                : '/api/admin/external-drivers';

            const method = editingDriver ? 'PUT' : 'POST';
            const body = editingDriver
                ? { ...formData, id: editingDriver.id }
                : formData;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowModal(false);
                setEditingDriver(null);
                setFormData({ name: '', phone: '', plate: '', vehicle_type: '', notes: '' });
                fetchDrivers();
            }
        } catch (e) {
            console.error('Failed to save driver:', e);
        }
    };

    const handleEdit = (driver: any) => {
        setEditingDriver(driver);
        setFormData({
            name: driver.name,
            phone: driver.phone,
            plate: driver.plate || '',
            vehicle_type: driver.vehicle_type || '',
            notes: driver.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Bu şoförü silmek istediğinize emin misiniz?')) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/external-drivers', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ id, action: 'delete' })
            });

            if (res.ok) fetchDrivers();
        } catch (e) {
            console.error('Failed to delete driver:', e);
        }
    };

    const handleToggleActive = async (id: number, is_active: boolean) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/external-drivers', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ id, action: 'toggle_active', is_active: !is_active })
            });

            if (res.ok) fetchDrivers();
        } catch (e) {
            console.error('Failed to toggle active:', e);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Harici Şoförler</h1>
                    <p className="text-slate-400 text-sm">Topluluk şoförlerini yönetin</p>
                </div>
                <button
                    onClick={() => {
                        setEditingDriver(null);
                        setFormData({ name: '', phone: '', plate: '', vehicle_type: '', notes: '' });
                        setShowModal(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:scale-105 transition-all shadow-lg"
                >
                    + Yeni Şoför Ekle
                </button>
            </div>

            {drivers.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700">
                    <div className="text-6xl mb-4">👥</div>
                    <p className="text-slate-400 text-lg">Henüz harici şoför eklenmemiş</p>
                    <p className="text-slate-500 text-sm mt-2">Topluluktan gelen şoförleri buradan ekleyebilirsiniz</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {drivers.map((driver) => (
                        <div
                            key={driver.id}
                            className={`bg-slate-800 rounded-2xl border p-6 transition-all hover:scale-105 ${driver.is_active ? 'border-green-500/20' : 'border-slate-700 opacity-60'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                                        {driver.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{driver.name}</h3>
                                        <p className="text-slate-400 text-sm">{driver.phone}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggleActive(driver.id, driver.is_active)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold ${driver.is_active
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-slate-700 text-slate-400 border border-slate-600'
                                        }`}
                                >
                                    {driver.is_active ? 'Aktif' : 'Pasif'}
                                </button>
                            </div>

                            <div className="space-y-2 mb-4">
                                {driver.plate && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-slate-500">🚗</span>
                                        <span className="text-slate-300">{driver.plate}</span>
                                    </div>
                                )}
                                {driver.vehicle_type && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-slate-500">🚙</span>
                                        <span className="text-slate-300">{driver.vehicle_type}</span>
                                    </div>
                                )}
                                {driver.notes && (
                                    <div className="text-xs text-slate-400 mt-2 p-2 bg-slate-900/50 rounded-lg">
                                        {driver.notes}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-slate-700">
                                <button
                                    onClick={() => handleEdit(driver)}
                                    className="flex-1 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all text-sm font-semibold"
                                >
                                    Düzenle
                                </button>
                                <button
                                    onClick={() => handleDelete(driver.id)}
                                    className="flex-1 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all text-sm font-semibold"
                                >
                                    Sil
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 max-w-md w-full">
                        <h2 className="text-2xl font-bold text-white mb-6">
                            {editingDriver ? 'Şoför Düzenle' : 'Yeni Şoför Ekle'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    İsim Soyisim *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                                    placeholder="Ahmet Yılmaz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Telefon (WhatsApp) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                                    placeholder="905321234567"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Plaka
                                </label>
                                <input
                                    type="text"
                                    value={formData.plate}
                                    onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                                    placeholder="34 ABC 123"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Araç Türü
                                </label>
                                <select
                                    value={formData.vehicle_type}
                                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                                >
                                    <option value="">Seçiniz</option>
                                    <option value="Sedan">Sedan</option>
                                    <option value="Vito">Vito</option>
                                    <option value="Sprinter">Sprinter</option>
                                    <option value="Minibüs">Minibüs</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">
                                    Notlar
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 focus:outline-none"
                                    rows={3}
                                    placeholder="Ek bilgiler..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingDriver(null);
                                    }}
                                    className="flex-1 px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all font-semibold"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:scale-105 transition-all font-semibold"
                                >
                                    {editingDriver ? 'Güncelle' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
