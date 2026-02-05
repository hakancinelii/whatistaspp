"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { href: "/dashboard/inbox", icon: "💬", label: "Sohbetler" },
  { href: "/dashboard/messages", icon: "📨", label: "Toplu Mesaj Gönder" },
  { href: "/dashboard/operation", icon: "🏝️", label: "Operasyon" },
  { href: "/dashboard/customers", icon: "👥", label: "Müşteriler" },
  { href: "/dashboard/automation", icon: "🤖", label: "Otomasyon" },
  { href: "/dashboard/knowledge", icon: "🧠", label: "Bilgi Bankası" },
  { href: "/dashboard/templates", icon: "📝", label: "Şablonlar" },
  { href: "/dashboard/reports", icon: "📈", label: "Raporlar" },
  { href: "/dashboard/scheduled", icon: "⏳", label: "Bekleyenler" },
  { href: "/dashboard/history", icon: "📜", label: "Geçmiş" },
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/dashboard/settings", icon: "⚙️", label: "Ayarlar" },
  { href: "/dashboard/whatsapp", icon: "🟢", label: "WhatsApp" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Desktopta sidebar default açık gelsin
    if (window.innerWidth > 1024) {
      setSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      setLoading(false); // Set loading to false even if no token
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser(payload);
    } catch (error) {
      console.error("Failed to parse token:", error);
      router.push("/login");
      setLoading(false); // Set loading to false if token is invalid
      return;
    }

    setLoading(false); // Set loading to false after successful token parsing

    // Poll scheduler every minute
    const interval = setInterval(() => {
      fetch("/api/scheduler/run").catch((err) =>
        console.error("Scheduler poll failed", err)
      );
    }, 60000);

    return () => clearInterval(interval);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
          <div className="text-white">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-slate-800 border-r border-slate-700 z-50 transform transition-all duration-500 ease-in-out flex flex-col overflow-y-auto ${sidebarOpen ? "translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)]" : "-translate-x-full"
          }`}
      >
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">WhatIstaspp</h1>
            <p className="text-sm text-gray-400 mt-1">Hoş geldin, {user?.name}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <nav className="mt-6 flex-grow">
          <ul className="space-y-2 px-4">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${pathname === item.href
                    ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                    : "text-gray-400 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            ))}

            {/* Admin Link */}
            {user?.role === 'admin' && (
              <li>
                <Link
                  href="/dashboard/admin"
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${pathname === "/dashboard/admin"
                    ? "bg-gradient-to-r from-red-600/20 to-orange-600/20 text-red-300 border border-red-500/30"
                    : "text-gray-400 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  <span className="text-xl">👑</span>
                  <span className="font-medium">Admin</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Credit Display */}
        <div className="px-6 py-4 border-t border-slate-700">
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Paket</div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${user?.package === 'platinum' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                user?.package === 'gold' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                {user?.package || 'Standard'}
              </span>
            </div>
            <div className="text-xs text-gray-400 mb-1">Mevcut Bakiye</div>
            <div className="text-xl font-bold text-green-400 font-mono">
              {user?.credits?.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Kredi
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center"
          >
            <span className="mr-2">🚪</span>
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-500 ${sidebarOpen ? 'lg:ml-72' : 'ml-0'}`}>
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 px-4 md:px-8 py-3 md:py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-3 text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h2 className="text-lg md:text-xl font-semibold text-white truncate max-w-[150px] md:max-w-none">
                {menuItems.find((i) => i.href === pathname)?.label || "Panel"}
              </h2>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="hidden md:block text-sm text-gray-400">{user?.email}</div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 md:p-8">{children}</main>
      </div>
    </div>
  );
}
