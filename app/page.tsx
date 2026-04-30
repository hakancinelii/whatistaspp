import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-app-bg text-app-fg selection:bg-purple-500/30 overflow-x-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-app-bg/50 backdrop-blur-xl border-b border-app-border/60">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-xl font-bold">W</span>
            </div>
            <span className="text-xl font-bold tracking-tight gradient-text">WhatIstaspp</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-app-muted">
            <a href="#features" className="hover:text-app-fg transition">Özellikler</a>
            <a href="#pricing" className="hover:text-app-fg transition">Fiyatlandırma</a>
            <a href="#faq" className="hover:text-app-fg transition">SSS</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-purple-400 transition">Giriş Yap</Link>
            <Link href="/register" className="px-5 py-2.5 bg-white text-slate-900 rounded-full text-sm font-bold hover:bg-gray-200 transition-all active:scale-95 shadow-xl shadow-white/10">Ücretsiz Dene</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8 animate-bounce">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">Yapay Zeka Destekli Otomasyon</span>
          </div>

          <h1 className="text-5xl md:text-8xl font-black mb-6 tracking-tight leading-[1.1]">
            WhatsApp'ta <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">Süper Güçlerin</span> Olsun
          </h1>

          <p className="text-lg md:text-xl text-app-muted max-w-3xl mx-auto mb-12 leading-relaxed">
            Yapay zeka yanıt asistanı, akıllı anahtar kelime cevaplayıcı ve gelişmiş zamanlama ile platformumuz, işletmenizi WhatsApp üzerinde otonom hale getirir.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-2xl shadow-purple-600/25">
              Hemen Ücretsiz Başla
            </Link>
            <a href="#features" className="w-full sm:w-auto px-10 py-5 bg-app-card rounded-2xl font-bold text-lg hover:bg-app-elevated transition-all border border-app-border">
              Özellikleri Keşfet
            </a>
          </div>

          {/* Minimal App Preview */}
          <div className="mt-20 relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent z-10 h-full"></div>
            <div className="bg-app-card/50 rounded-3xl border border-app-border/60 p-4 backdrop-blur-sm shadow-2xl skew-y-3">
              <div className="bg-app-bg rounded-2xl border border-app-border/60 overflow-hidden aspect-video flex items-center justify-center">
                <span className="text-app-subtle font-mono text-sm">Dashboard Önizlemesi</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 bg-app-bg/30">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Hız Kesmeden Büyüyün</h2>
            <p className="text-app-muted">İşletmenizi bir üst lige taşıyacak özellikler</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon="🪄"
              title="AI Yanıt Asistanı"
              description="Gemini 1.5 Flash desteğiyle gelen mesajları analiz eder, saniyeler içinde 3 farklı yanıt taslağı sunar."
              badge="PLATİN"
            />
            <FeatureCard
              icon="🤖"
              title="Otomatik Cevaplayıcı"
              description="Anahtar kelime bazlı otomatik yanıtlarla 7/24 müşterilerinizin sorularını cevapsız bırakmayın."
              badge="GOLD+"
            />
            <FeatureCard
              icon="⏰"
              title="Gelişmiş Zamanlama"
              description="Kampanyalarınızı planlayın, günü ve saati geldiğinde sistem otomatik olarak göndersin."
              badge="GOLD+"
            />
            <FeatureCard
              icon="🏷️"
              title="Segmentasyon"
              description="Müşterilerinizi etiketleyin, VIP grubunuza özel teklifleri tek tıkla toplu olarak gönderin."
              badge="STANDART"
            />
            <FeatureCard
              icon="🛡️"
              title="Güvenli Gönderim"
              description="Akıllı gecikme ve mesaj varyasyonları ile WhatsApp ban riskini en aza indiren altyapı."
              badge="STANDART"
            />
            <FeatureCard
              icon="📁"
              title="Değişken Motoru"
              description="Excel'den gelen tüm verileri {{isim}}, {{borc}} gibi etiketlerle kişiye özel mesaja dönüştürün."
              badge="STANDART"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Şeffaf Fiyatlandırma</h2>
            <p className="text-app-muted">İhtiyacınıza uygun paketi seçin, dilediğiniz zaman yükseltin.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            <PriceCard
              name="Standart"
              price="490"
              description="Hızlıca başlamak isteyen küçük işletmeler için."
              features={["Günlük 250 Mesaj Limiti", "3 Mesaj Şablonu", "Excel/CSV Dışa Aktar", "Manuel Müşteri Ekleme", "Değişken Motoru (Kısıtlı)"]}
            />
            <PriceCard
              name="Sosyal Transfer"
              price="3.000"
              highlight={true}
              badge="YENİ 🚕"
              description="İş kaçırmaya son! Bölge, saat ve fiyata göre filtrele, ilk arayan sen ol."
              features={["Yapay Zeka İş Avcısı", "Bölge/Saat/Fiyat Filtreleme", "Benzersiz 'İlk Arayan Ol' Özelliği", "ACİL (Hazır) İş Bildirimleri", "Anlık Kazanç ve Rakip Analizi", "7/24 Şoför Desteği"]}
            />
            <PriceCard
              name="Gold"
              price="990"
              description="Büyüyen ekipler ve otomasyon tutkunları için."
              features={["Günlük 1.000 Mesaj Limiti", "Sınırsız Şablon", "Excel/CSV İçe/Dışa Aktar", "Keyword Otomasyonu", "Mesaj Zamanlama", "Dinamik Değişkenler"]}
            />
            <PriceCard
              name="Platinum"
              price="1.990"
              description="En iyisini isteyen, AI gücünü kullanacak liderler için."
              features={["Günlük 10.000 Mesaj Limiti", "AI Yanıt Asistanı (Unlimited)", "Öncelikli Başlatma", "Gelişmiş Segmentasyon", "Sektörel Otomasyonlar", "7/24 VIP Destek"]}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-app-border/60 bg-app-bg/50">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="font-bold">W</span>
            </div>
            <span className="font-bold tracking-tight">WhatIstaspp</span>
          </div>
          <p className="text-sm text-app-subtle mb-8">© 2024 WhatIstaspp. Tüm hakları saklıdır. Türkiye'nin en gelişmiş WhatsApp SaaS platformu.</p>
          <div className="flex justify-center gap-8 text-xs font-bold text-app-muted uppercase tracking-widest">
            <a href="#" className="hover:text-purple-400">Gizlilik</a>
            <a href="#" className="hover:text-purple-400">Şartlar</a>
            <a href="#" className="hover:text-purple-400">İletişim</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description, badge }: any) {
  return (
    <div className="group p-8 rounded-3xl bg-app-card/30 border border-app-border/60 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-2">
      <div className="text-4xl mb-6">{icon}</div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xl font-bold">{title}</h3>
        {badge && (
          <span className="text-[9px] font-black bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">{badge}</span>
        )}
      </div>
      <p className="text-app-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function PriceCard({ name, price, description, features, highlight = false, badge }: any) {
  return (
    <div className={`relative p-8 rounded-3xl border transition-all duration-300 ${highlight ? 'bg-gradient-to-b from-purple-600/20 to-transparent border-purple-500 scale-105 shadow-2xl shadow-purple-500/10 z-10' : 'bg-app-card/30 border-app-border/60 hover:border-app-border/70'}`}>
      {highlight && !badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">en popüler</div>
      )}
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-yellow-400/20 whitespace-nowrap animate-pulse">{badge}</div>
      )}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-2">{name}</h3>
        <p className="text-app-muted text-sm">{description}</p>
      </div>
      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black">₺{price}</span>
          <span className="text-app-subtle text-sm">/ay</span>
        </div>
      </div>
      <div className="space-y-4 mb-8">
        {features.map((f: string, i: number) => (
          <div key={i} className="flex items-center gap-3 text-sm text-app-muted">
            <span className="text-green-500">✓</span>
            {f}
          </div>
        ))}
      </div>
      <Link href="/register" className={`block w-full py-4 rounded-2xl font-bold text-center transition-all active:scale-95 ${highlight ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20' : 'bg-app-elevated/70 hover:bg-app-elevated/80 text-app-fg'}`}>
        Seç ve Başla
      </Link>
    </div>
  );
}
