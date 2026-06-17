# whatistaspp (Social Transfer) — Devam Notları (Kaldığımız Yer)

> PC sıfırlandıktan sonra VS Code + Claude kurulunca buradan devam et.
> Son güncelleme: 17 Haziran 2026

---

## 🟢 EN SON NE YAPILDI (bu oturum)

### 1. Google Play paketleme (TWA)
Web uygulaması (PWA), **TWA = Trusted Web Activity** ile Android paketine sarıldı (Bubblewrap).
- `android-twa/app-release-bundle.aab` → **Play Console'a yüklenecek olan**
- `android-twa/app-release-signed.apk` → test için (adb ile telefona kuruldu, çalışıyor)
- `android-twa/android.keystore` → **imza anahtarı, PAROLA: `Whatistaspp2026!`** (kaybedersen uygulamayı güncelleyemezsin!)
- Paket adı: `app.socialtransfer.twa` · domain: `whatistaspp-plum.vercel.app`
- Rehber: `android-twa/GOOGLE_PLAY_REHBER.md`

### 2. Aşama 1 — Arka planda polling duraklatma (ısınma/pil çözümü)
Tüm dashboard panellerinde polling artık sadece sayfa görünürken çalışıyor; arka planda durur.
- Yeni hook: `lib/useVisiblePolling.ts`
- Düzenlenenler: `app/dashboard/driver/page.tsx`, `operation`, `messages`, 3× `whatsapp` durum sayfası, `app/dashboard/layout.tsx` (heartbeat)

### 3. Aşama 2 — Push bildirimi (Web Push / VAPID)
Yeni iş düşünce, uygulama kapalı olsa bile sürücüye bildirim gider.
- `lib/push.ts` (web-push, abonelik + gönderim), `app/api/notifications/subscribe/route.ts`
- `worker/index.js` (service worker push handler — next-pwa custom worker)
- `components/PushSetup.tsx` (izin/abonelik butonu, dashboard layout'ta)
- `lib/job_automation.ts` — `runJobAutomation` filtreye uyan sürücülere push gönderiyor (`jobMatchesDriver` ayrıştırıldı)
- `lib/db.ts` — `push_subscriptions` tablosu (+ `isPostgres` export); SQLite'ta `ensurePushTable` ile otomatik oluşur

**ÖNEMLİ keşif:** Otomatik iş alma (`action_mode='auto'`) ZATEN sunucuda çalışıyor (`runJobAutomation`), tarayıcı gerekmez. Arka planda polling'i durdursak bile iş alınır; push bunu "haber verme" ile tamamlıyor.

---

## 🏗️ CANLIDA NE NEREDE ÇALIŞIYOR

| Parça | Teknoloji | Nerede | Deploy |
|-------|-----------|--------|--------|
| **Frontend** | Next.js 14 (PWA) | **Vercel** → `whatistaspp-plum.vercel.app` | `git push` → Vercel otomatik (git bağlantısı bu oturumda yeniden kuruldu) |
| **Backend / API** | Aynı Next.js app (`next start -p 3010`) | **Hetzner** `46.224.206.123`, dizin **`/opt/whatistaspp`**, PM2 **`whatistaspp-api`** | SSH + git pull + npm install + build + pm2 restart |
| **Veritabanı** | **SQLite** (`DATABASE_URL` yok) | Sunucuda `/opt/whatistaspp/data/database.db` | — |
| **WhatsApp** | baileys | Sunucuda (auth_info sunucuda) | — |

- Vercel'deki `/api/*` istekleri sunucuya yönleniyor: `.env`'deki `API_PROXY_TARGET=http://46.224.206.123`
- Başlatma scripti (sunucuda): `/opt/whatistaspp/start-whatistaspp.sh` → `next start -H 0.0.0.0 -p 3010`

---

## 🚀 DEPLOY KOMUTLARI

**Frontend (Vercel):**
```bash
git push origin main      # Vercel otomatik deploy eder
```

**Backend (Hetzner sunucu):**
```bash
ssh root@46.224.206.123 \
  "cd /opt/whatistaspp && git pull && npm install && npm run build && pm2 restart whatistaspp-api"
```
> Not: `next build` belleği zorlarsa sunucuda swap var; gerekirse `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.
> PM2 adı: **`whatistaspp-api`**. Durum: `pm2 status whatistaspp-api`.

---

## 🔔 PUSH İÇİN VAPID ENV (zaten ayarlandı)
Hem sunucu `.env.local`'de hem Vercel'de tanımlı:
- `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (ikisi de aynı public key) — public:
  `BMm7SnG1V9icO9oxijkeAKjrksNkqHJPjqzrJQACVNDHpR9oypmXiFEjAovbGouBidOEkVKKFeNbPiSO2HdIc6g`
- `VAPID_PRIVATE_KEY` (yalnızca sunucuda!), `VAPID_SUBJECT`
> Detay: `PUSH_BILDIRIM_KURULUM.md`

---

## ⏳ YARIM KALAN / SONRAKİ ADIMLAR
1. **Play Console'a yükleme:** `android-twa/app-release-bundle.aab` yüklenecek (Uygulama oluştur → Üretim/Test).
2. **KRİTİK:** Yükleme sonrası Play "Uygulama imzalama" **SHA-256** parmak izini al → `public/.well-known/assetlinks.json` içine ekle → tekrar deploy. (Bu olmadan uygulamada adres çubuğu tam gizlenmez.)
3. Telefonda push testi: uygulama → 🔔 Bildirimleri Aç → izin → filtreye uyan iş düşünce bildirim gelmeli.

---

## 🔄 SIFIRLAMADAN SONRA KURULUM
1. `git clone https://github.com/hakancinelii/whatistaspp.git`
2. `cd whatistaspp && npm install`
3. USB yedeğinden geri koy (GitHub'da YOK): `.env.local`, `.env.production`, `.env.vercel`, `database.db`, `data/`, `auth_info/`, **`android-twa/android.keystore`**
   - Tek arşiv: `PC_YEDEK_2026-06-16/_ARSIVLER/whatistaspp-KRITIK.tgz` → `tar -xzf`
4. Sunucu erişimi: USB'den `~/.ssh/hetzner_nopass` (chmod 600), ya da `ssh root@46.224.206.123` (parola)
5. `npm run dev` ile çalış.

## ⚠️ GİZLİ / GitHub'da YOK — geri konması şart
- `android-twa/android.keystore` (Play imza anahtarı, parola `Whatistaspp2026!`)
- `.env.local`, `.env.production`, `.env.vercel`
- `database.db`, `data/database.db`, `data/auth_info/`, `auth_info/`
