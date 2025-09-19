# iOS Transfer Paketi Oluşturma Scripti
# Windows'tan Mac'e transfer için gerekli dosyaları hazırlar

Write-Host "📦 iOS Transfer Paketi Hazırlanıyor..." -ForegroundColor Green

# Transfer klasörü oluştur
$transferDir = "ios-transfer-package"
if (Test-Path $transferDir) {
    Remove-Item $transferDir -Recurse -Force
}
New-Item -ItemType Directory -Path $transferDir

# Gerekli dosyaları kopyala
Write-Host "📁 Dosyalar kopyalanıyor..."

# iOS klasörünün tamamı
Copy-Item -Path "ios" -Destination "$transferDir/ios" -Recurse

# Capacitor config
Copy-Item -Path "capacitor.config.ts" -Destination "$transferDir/"

# Package.json (bağımlılık bilgileri için)
Copy-Item -Path "package.json" -Destination "$transferDir/"

# Build çıktısı
Copy-Item -Path "dist" -Destination "$transferDir/dist" -Recurse

# App Store metadata
Copy-Item -Path "APP_STORE_METADATA.md" -Destination "$transferDir/"
Copy-Item -Path "create-app-store-screenshots.md" -Destination "$transferDir/"

# Firebase config (eğer varsa)
if (Test-Path "GoogleService-Info.plist") {
    Copy-Item -Path "GoogleService-Info.plist" -Destination "$transferDir/"
}

# Talimatlar dosyası oluştur
$instructions = @"
# 🍎 Mac'te iOS Build Talimatları

## 1. Gerekli Kurulumlar (Mac'te)
```bash
# Node.js ve npm kurulu olmalı
# Xcode kurulu olmalı
# Capacitor CLI kur
npm install -g @capacitor/cli

# CocoaPods kur (eğer yoksa)
sudo gem install cocoapods
```

## 2. Proje Kurulumu
```bash
# Transfer klasörüne git
cd ios-transfer-package

# iOS bağımlılıklarını kur
cd ios/App
pod install
cd ../..
```

## 3. Xcode'da Açma
```bash
# iOS projesini Xcode'da aç
open ios/App/App.xcworkspace
```

## 4. Xcode'da Yapılacaklar
1. **Signing & Capabilities** → Team seçin (Apple Developer hesabınız)
2. **Bundle Identifier** kontrol edin: com.solarveyo.scada
3. **Version** kontrol edin: 1.0.0
4. **Build Configuration** → Release seçin
5. **Generic iOS Device** seçin
6. **Product** → **Archive** tıklayın

## 5. App Store'a Upload
1. Archive tamamlandığında **Organizer** açılır
2. **Distribute App** → **App Store Connect**
3. **Upload** → **Next** → **Upload**

## 6. App Store Connect
- appstoreconnect.apple.com'a gidin
- APP_STORE_METADATA.md dosyasındaki bilgileri kullanın
- Screenshots çekin (create-app-store-screenshots.md rehberini takip edin)

## ⚠️ Önemli Notlar
- Apple Developer hesabınız aktif olmalı (\$99/yıl)
- Bundle ID'yi değiştirmeyin: com.solarveyo.scada
- İlk upload'tan sonra TestFlight'ta test yapın
"@

$instructions | Out-File -FilePath "$transferDir/MAC_BUILD_INSTRUCTIONS.md" -Encoding UTF8

# Zip paketi oluştur
Write-Host "🗜️ Zip paketi oluşturuluyor..."
Compress-Archive -Path "$transferDir/*" -DestinationPath "solarveyo-ios-package.zip" -Force

Write-Host "✅ Transfer paketi hazır!" -ForegroundColor Green
Write-Host "📦 Dosya: solarveyo-ios-package.zip" -ForegroundColor Yellow
Write-Host "📁 Boyut: $((Get-Item 'solarveyo-ios-package.zip').Length / 1MB) MB" -ForegroundColor Yellow

Write-Host "`n🔄 Sonraki Adımlar:" -ForegroundColor Cyan
Write-Host "1. solarveyo-ios-package.zip dosyasını Mac'e transfer edin" -ForegroundColor White
Write-Host "2. Mac'te zip'i açın" -ForegroundColor White
Write-Host "3. MAC_BUILD_INSTRUCTIONS.md dosyasını takip edin" -ForegroundColor White
