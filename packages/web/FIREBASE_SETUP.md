# Firebase Firestore Kuralları Güncellemesi

Bu dosya, otomatik kayıt sisteminin düzgün çalışması için gerekli Firebase Firestore kurallarını içerir.

## Mevcut Durum

10 dakikalık otomatik kayıt sistemi şu anda `daily_production` koleksiyonunu kullanıyor çünkü `realtime_production` koleksiyonuna yazma izni yok.

## Çözüm 1: Mevcut Sistem (Şu anda aktif)

Sistem şu anda `daily_production` koleksiyonunda hem günlük hem de 10 dakikalık verileri saklıyor:

```
daily_production/
├── 2025-01-20           (günlük veri)
├── 2025-01-20_14-30     (10 dakikalık veri)
├── 2025-01-20_14-40     (10 dakikalık veri)
└── ...
```

## Çözüm 2: Ayrı Koleksiyon İçin Firestore Rules Güncellemesi

Eğer `realtime_production` koleksiyonunu kullanmak istiyorsanız:

### 1. Firebase Console'a gidin
- https://console.firebase.google.com/
- Projenizi seçin: `tkececi-b86ba`
- Firestore Database → Rules

### 2. Mevcut rules'a ekleyin:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Mevcut kurallarınız...
    
    // Günlük üretim verileri için izin
    match /daily_production/{document} {
      allow read, write: if request.auth != null;
    }
    
    // YENI: 10 dakikalık gerçek zamanlı veriler için izin
    match /realtime_production/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Diğer mevcut kurallarınız...
  }
}
```

### 3. Servisi güncelleyin

Rules güncellenirse, `src/services/dailyProductionService.ts` dosyasında:

```typescript
// Bu satırı değiştirin:
const docRef = doc(db, 'daily_production', data.date)

// Buna:
const docRef = doc(db, 'realtime_production', data.date)
```

## Avantajlar

### Ayrı Koleksiyon Kullanmanın Faydaları:
1. **Veri Organizasyonu**: Günlük ve 10 dakikalık veriler ayrı
2. **Query Performansı**: Daha hızlı sorgular
3. **Veri Yönetimi**: Kolay temizleme ve arşivleme

### Mevcut Sistem Kullanmanın Faydaları:
1. **Hemen Çalışır**: Ek konfigürasyon gerektirmez
2. **Tek Koleksiyon**: Tüm veriler bir yerde
3. **Basit Yönetim**: Tek yerden kontrol

## Güvenlik

Her iki durumda da:
- Sadece authenticate edilmiş kullanıcılar veri okuyabilir/yazabilir
- Anonymous erişim engellenir
- Firebase Authentication gereklidir

## Test Etme

Rules güncellemesi sonrasında:
1. Console'da "Test" tab'ına gidin
2. Auth durumunu ayarlayın
3. Koleksiyona yazma işlemini test edin

```javascript
// Test kuralı:
allow write: if request.auth.uid != null
```

## Sorun Giderme

Eğer hala izin hatası alıyorsanız:

1. **Browser Cache**: Temiz bir browser tab'da test edin
2. **Auth Durumu**: Kullanıcının giriş yaptığından emin olun
3. **Rules Syntax**: Firebase Console'da syntax hatası kontrol edin
4. **Deployment**: Rules'un deploy edildiğinden emin olun

## Current Status

✅ **Çalışıyor**: daily_production koleksiyonu ile 10 dakikalık kayıt  
⏳ **İsteğe Bağlı**: realtime_production koleksiyonu kurulumu

