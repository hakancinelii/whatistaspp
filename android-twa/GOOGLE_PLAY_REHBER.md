# Social Transfer — Google Play Yayınlama Rehberi

Bu uygulama, canlıdaki PWA'nın (https://whatistaspp-plum.vercel.app) bir **TWA (Trusted Web Activity)**
ile Android paketine sarılmış halidir. Yani Play Store'daki uygulama, doğrudan canlı web sitesini
tam ekran (adres çubuğu olmadan) gösterir. Web tarafında yaptığınız her değişiklik, uygulama
güncellemesine gerek kalmadan anında uygulamada da görünür.

## Üretilen dosyalar

| Dosya | Açıklama |
|-------|----------|
| `android-twa/android.keystore` | **Upload imzalama anahtarı. KAYBETMEYİN.** Parola: `Whatistaspp2026!`, alias: `android` |
| `android-twa/app-release-bundle.aab` | Play Console'a yüklenecek App Bundle |
| `android-twa/app-release-signed.apk` | (Opsiyonel) Cihazda test için imzalı APK |
| `public/.well-known/assetlinks.json` | Domain doğrulama dosyası (canlıya deploy edilmeli) |

## ÖNEMLİ: İmzalama anahtarı

- `android.keystore` dosyasını ve parolasını (`Whatistaspp2026!`) **güvenli bir yerde** saklayın.
  Bu anahtar olmadan uygulamayı **güncelleyemezsiniz**.
- Git'e EKLENMEMELİDİR (`.gitignore`'a eklendi).

## Adım adım Play Console'a yükleme

1. **Play Console** → uygulamalar listesi → **Uygulama oluştur**.
   - Uygulama adı: `Social Transfer`
   - Tür: Uygulama, Ücretsiz.
2. Sol menü → **Test** veya **Üretim** → **Yeni sürüm oluştur**.
3. **App Bundle** olarak `android-twa/app-release-bundle.aab` dosyasını yükleyin.
4. İlk yüklemede Google **Play App Signing**'i otomatik etkinleştirir. Bu, Google'ın uygulamayı
   kendi anahtarıyla imzalaması demektir (dün yayınladığınız uygulamadaki gibi).
5. **Sürüm adı / notları** girin → kaydedin.

## KRİTİK ADIM — Play App Signing parmak izini assetlinks'e ekleyin

TWA'nın adres çubuğunu gizleyebilmesi için, telefondaki uygulamayı imzalayan anahtarın SHA-256
parmak izi `assetlinks.json` içinde bulunmalıdır. Google kendi anahtarıyla imzaladığı için:

1. Play Console → uygulamanız → **Test ve yayınla** → **Uygulama bütünlüğü** (App integrity / App Signing).
2. **Uygulama imzalama anahtarı sertifikası**ndaki **SHA-256 parmak izini** kopyalayın.
3. Bu parmak izini `public/.well-known/assetlinks.json` içindeki
   `sha256_cert_fingerprints` dizisine ekleyin (mevcut upload anahtarının yanına).
4. Değişikliği canlıya tekrar deploy edin.

Mevcut `assetlinks.json` şu an sadece upload anahtarının parmak izini içeriyor:
`49:F8:EE:82:51:B6:46:98:52:C6:EB:D1:E2:25:D2:85:9A:44:EE:B4:6C:80:72:F5:BC:BB:39:23:EE:60:45:0F`

## Yeniden derleme (web/manifest değişince genelde gerekmez)

```bash
cd android-twa
export JAVA_HOME=$(ls -d ~/.bubblewrap/jdk/jdk-17* | head -1)   # Contents/Home varsa onu kullanın
bubblewrap build              # parola sorulunca: Whatistaspp2026!
```

Sürüm güncellerken `twa-manifest.json` içindeki `appVersionCode`'u +1 artırın
(`appVersionName`'i de isterseniz güncelleyin), sonra tekrar `bubblewrap build`.

## Notlar

- `start_url` = `/dashboard/driver`. Kullanıcı giriş yapmamışsa uygulama login sayfasına yönlenir.
- Uygulama içeriği tamamen canlı siteden gelir; mağaza açıklamasında "internet bağlantısı gerekir" belirtin.
- Play Console içerik derecelendirmesi, gizlilik politikası URL'si ve veri güvenliği formunu
  doldurmanız gerekir (WhatsApp tabanlı veri işlediği için gizlilik politikası önemli).
