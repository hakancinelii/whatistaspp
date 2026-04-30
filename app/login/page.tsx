"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await apiFetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Giriş başarısız");
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
                        <h1 className="text-3xl font-bold text-app-fg mb-2">Giriş Yap</h1>
                        <p className="text-app-muted">WhatIstaspp hesabınıza giriş yapın</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-app-fg mb-2">
                                E-posta
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-app-card/70 border border-app-border/70 rounded-lg text-app-fg placeholder:text-app-subtle focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="bg-app-card/70 border border-app-border/70 rounded-xl p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <input
                                    id="kvkk"
                                    type="checkbox"
                                    required
                                    className="mt-1 w-4 h-4 rounded border-app-border/70 bg-app-card/70 text-purple-600 focus:ring-purple-500 focus:ring-offset-app-bg"
                                />
                                <label htmlFor="kvkk" className="text-[11px] leading-relaxed text-app-muted">
                                    <span className="text-app-fg font-semibold">WhatsApp & KVKK Onayı:</span> Bu sistemi kullanarak; WhatsApp altyapısının kullanımı nedeniyle oluşabilecek <span className="text-orange-400">hesap kısıtlaması (Ban) risklerini</span>, verilerimin hizmet sunumu için işlenmesini ve WhatIstaspp'ın WhatsApp INC. ile resmi bir bağı olmadığını kabul ediyorum. Tüm sorumluluk kullanıcıya aittir.
                                </label>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Giriş yapılıyor..." : "Kullanım Şartlarını Kabul Et ve Giriş Yap"}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-app-muted">
                            Hesabınız yok mu?{" "}
                            <Link
                                href="/register"
                                className="text-purple-400 hover:text-purple-300 font-semibold transition"
                            >
                                Kayıt Ol
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
