"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        package: "driver", // Default to driver
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (formData.password !== formData.confirmPassword) {
            setError("Şifreler eşleşmiyor");
            setLoading(false);
            return;
        }

        try {
            const res = await apiFetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    package: formData.package,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Kayıt başarısız");
            }

            localStorage.setItem("token", data.token);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgb(124_58_237_/_0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgb(219_39_119_/_0.14),transparent_34%)] bg-app-bg flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-app-elevated/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-app-border/70 p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-app-fg mb-2 font-black italic tracking-tighter">WhatIstaspp</h1>
                        <p className="text-app-muted">Yeni hesap oluşturun</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Hesap Türü Seçimi */}
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, package: 'driver' })}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.package === 'driver'
                                    ? 'bg-green-600/20 border-green-500 text-white shadow-lg shadow-green-500/20 scale-[1.02]'
                                    : 'bg-app-card/70 border-app-border/70 text-app-muted hover:bg-app-elevated/70'}`}
                            >
                                <span className="text-2xl">🚕</span>
                                <span className="text-xs font-black uppercase tracking-widest">Şoförüm</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, package: 'company' })}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.package === 'company'
                                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]'
                                    : 'bg-app-card/70 border-app-border/70 text-app-muted hover:bg-app-elevated/70'}`}
                            >
                                <span className="text-2xl">🏢</span>
                                <span className="text-xs font-black uppercase tracking-widest">Şirketim</span>
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-app-fg mb-2">
                                Ad Soyad
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full px-4 py-3 bg-app-card/70 border border-app-border/70 rounded-lg text-app-fg placeholder:text-app-subtle focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="Adınız Soyadınız"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-app-fg mb-2">
                                E-posta
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="w-full px-4 py-3 bg-app-card/70 border border-app-border/70 rounded-lg text-app-fg placeholder:text-app-subtle focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="ornek@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-app-fg mb-2">
                                Şifre
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                minLength={6}
                                className="w-full px-4 py-3 bg-app-card/70 border border-app-border/70 rounded-lg text-app-fg placeholder:text-app-subtle focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="En az 6 karakter"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-app-fg mb-2">
                                Şifre Tekrar
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                required
                                className="w-full px-4 py-3 bg-app-card/70 border border-app-border/70 rounded-lg text-app-fg placeholder:text-app-subtle focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="Şifrenizi tekrar girin"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] font-black"
                        >
                            {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-app-muted">
                            Zaten hesabınız var mı?{" "}
                            <Link
                                href="/login"
                                className="text-purple-400 hover:text-purple-300 font-semibold transition"
                            >
                                Giriş Yap
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
