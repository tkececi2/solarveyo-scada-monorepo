# Appflow ile iOS Build/Releasing Rehberi

Bu proje Capacitor + Vite kullanır. Aşağıdaki adımlar ile macOS olmadan Ionic Appflow üzerinde iOS build alıp TestFlight/App Store’a yükleyebilirsiniz.

## 1) Repo hazırlığı
- `capacitor.config.ts` → `appId` (Bundle ID) Apple’da kullanacağınız App ID ile aynı olmalı (örn: `com.solarveyo.scada`).
- `ios/` klasörünü commit etmeyin; Appflow build sırasında oluşturulur.
- Repoda bulunması gerekenler: `src/`, `public/`, `package.json`, `vite.config.ts`, `capacitor.config.ts`, vb.

## 2) Appflow’da uygulama oluştur ve repo bağla
- Appflow → New App → GitHub bağlantısını kurun, repo & branch seçin (örn. `main`).
- Build stack: macOS (Xcode 15+), Node 18+.

## 3) Build Script tanımı
- Appflow → App → Builds → Build Scripts (veya Custom Build Command) alanına şu scripti ekleyin:

```bash
bash scripts/appflow.ios.build.sh
```

> Not: Script, Firebase `GoogleService-Info.plist` dosyasını environment üzerinden otomatik yerleştirmeyi ve `resources/` klasöründen ikon/splash üretimini (varsa) destekler.

## 4) Environment değişkenleri
- Appflow → Environments → şu değişkenleri ekleyin:
  - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, vb. tüm `VITE_...` anahtarlar
  - `GOOGLE_SERVICE_INFO_PLIST_BASE64` (opsiyonel – plist’i environment ile vermek için)
  - `IOS_ALLOW_HTTP` (opsiyonel, `true` olursa ATS istisnası eklenir)

### GoogleService-Info.plist’i base64’e çevirme
- Windows PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("GoogleService-Info.plist")) | Out-File -Encoding ASCII GOOGLE_PLIST.txt
```
- macOS/Linux:
```bash
base64 -i GoogleService-Info.plist > GOOGLE_PLIST.txt
```
`GOOGLE_PLIST.txt` içeriğini `GOOGLE_SERVICE_INFO_PLIST_BASE64` environment’ına yapıştırın.

## 5) iOS imzalama (Signing)
- Appflow → Certificates & Profiles:
  - Otomatik (önerilir): Apple API Key (Issuer ID, Key ID, .p8) ekleyin ve Team seçin.
  - Manuel: Distribution `.p12` + şifresi ve doğru Bundle ID’ye ait Provisioning Profile yükleyin.

## 6) Build’i çalıştırma
- Appflow → Builds → New Build → Platform: iOS
- Build Type: iOS Package (IPA) veya App Store Connect Upload
- Signing seçin ve Build’i başlatın

## 7) TestFlight / App Store
- TestFlight: İç/dış test kullanıcılarını ekleyin.
- App Store: Metadata, privacy, screenshot vb. tamamlayıp “Submit for Review”.

## İsteğe bağlı notlar
- Prod’da canlı yenileme yok; `CAP_SERVER_URL` boş bırakın.
- HTTP trafiği gerekiyorsa `IOS_ALLOW_HTTP=true` ile Info.plist’e ATS istisnası eklenir.
- İkon/splash için `resources/icon.png` (1024x1024) ve `resources/splash.png` (2732x2732) ekleyin; script otomatik üretir.
