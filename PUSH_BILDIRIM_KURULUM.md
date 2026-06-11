# Push Bildirimi — Kurulum (Aşama 2)

Kod hazır. Çalışması için **VAPID anahtarları** üretilip 3 ortama da env olarak
girilmeli: tarayıcı (Vercel frontend), backend sunucu (Hetzner).

## 1) VAPID anahtarı üret

```bash
npx web-push generate-vapid-keys
```

İki anahtar verir: **Public Key** ve **Private Key**.
> Private Key gizlidir — kimseyle paylaşmayın, git'e koymayın.

## 2) Env değişkenlerini ayarla

Aşağıdaki 3 değişken **hem Vercel'de hem Hetzner backend'de** tanımlı olmalı:

| Değişken | Değer | Nerede |
|---|---|---|
| `VAPID_PUBLIC_KEY` | üretilen public key | Vercel + Backend |
| `VAPID_PRIVATE_KEY` | üretilen private key | **Sadece Backend** (push'u backend gönderiyor) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | üretilen public key (aynısı) | Vercel + Backend (tarayıcıya gömülür) |
| `VAPID_SUBJECT` | `mailto:siz@firma.com` (opsiyonel) | Backend |

- **Vercel**: Project → Settings → Environment Variables → ekle → redeploy.
- **Hetzner backend** (`/api/*` buraya proxy'leniyor): sunucudaki `.env` dosyasına ekle.

> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` build zamanında tarayıcıya gömülür; bu yüzden
> Vercel'de tanımlanıp **yeniden deploy** edilmesi şart.

## 3) Backend'i (Hetzner) güncelle

```bash
ssh <sunucu>
cd <proje-dizini>
git pull
npm install            # web-push paketi için
# .env dosyasına VAPID_* değişkenlerini ekle
npm run build
pm2 restart <app>      # veya systemctl restart <servis>
```

`push_subscriptions` tablosu ilk DB erişiminde otomatik oluşur (runMigrations).

## 4) Vercel'i güncelle

`git push` → otomatik deploy. Env değişkenleri eklendikten sonra **bir kez daha
redeploy** gerekir (NEXT_PUBLIC_* build'e gömülür).

## Nasıl çalışır?

1. Sürücü uygulamada (veya web'de) sağ alttaki **🔔 Bildirimleri Aç** butonuna basar
   → tarayıcı izin ister → abonelik backend'e kaydedilir.
2. WhatsApp'tan yeni iş yakalanınca (`runJobAutomation`):
   - Filtreye uyan sürücülere **push** gider — uygulama kapalı olsa bile.
   - `auto` modundaki sürücü işi otomatik alır → ona "✅ İş otomatik alındı".
   - Diğer uyumlu sürücülere → "🚖 Sana uygun yeni iş".
3. Bildirime dokununca uygulama açılır ve sürücü panele gider.

## Test

- Env'ler ayarlı + deploy yapıldıktan sonra: bir sürücü hesabıyla bildirimleri aç,
  ardından uygun bir iş düşmesini bekle (veya test grubuna iş mesajı at).
- Telefon kilitliyken bile bildirim gelmeli.

## Notlar

- Android'de (TWA / Chrome) Web Push tam desteklenir. iOS'ta yalnızca
  PWA "Ana Ekrana Ekle" ile (iOS 16.4+) çalışır; normal Safari sekmesinde sınırlıdır.
- Bildirim, sürücünün cihazda en az bir kez izin vermesini gerektirir.
