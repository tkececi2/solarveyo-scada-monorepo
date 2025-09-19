# Capacitor'dan Expo'ya Geçiş Planı - SolarVeyo SCADA

## 🚀 Adım 1: Expo Kurulumu

```bash
# Expo CLI kurulumu
npm install -g expo-cli eas-cli

# Yeni Expo projesi oluştur
npx create-expo-app solarveyo-expo --template blank-typescript

# Proje klasörüne gir
cd solarveyo-expo
```

## 📦 Adım 2: Gerekli Paketleri Kur

```bash
# Navigation
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# Firebase
npm install firebase

# UI Components (Material UI yerine)
npm install react-native-paper react-native-vector-icons

# Async Storage
npm install @react-native-async-storage/async-storage

# Diğer yardımcı paketler
npm install react-hook-form date-fns
```

## 📋 Adım 3: Dosya Transferi

### Kopyalanacak Dosyalar:
```
src/
├── services/          → app/services/
├── contexts/          → app/contexts/
├── types/            → app/types/
├── utils/            → app/utils/
└── components/       → app/components/ (UI düzenlemesi gerekecek)
```

### Dönüştürülecek Bileşenler:
- Material UI → React Native Paper
- React Router → React Navigation
- Web API'ler → React Native equivalents

## 🔧 Adım 4: Firebase Yapılandırması

`app/config/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBrlyyV7X54-Ysk338vXmLDdidimSHIeMI",
  authDomain: "yenisirket-2ec3b.firebaseapp.com",
  projectId: "yenisirket-2ec3b",
  storageBucket: "yenisirket-2ec3b.appspot.com",
  messagingSenderId: "1096617444018",
  appId: "1:788376105072:ios:e05fdeff2b26b56f2f04b5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

## 📱 Adım 5: EAS Build Yapılandırması

`eas.json`:
```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "ios": {
        "bundleIdentifier": "com.solarveyo.scada",
        "buildNumber": "1.0.0"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id"
      }
    }
  }
}
```

## 🏗️ Adım 6: İlk Build

```bash
# EAS hesabı oluştur/giriş yap
eas login

# Proje yapılandır
eas build:configure

# iOS build başlat
eas build --platform ios

# TestFlight'a yükle
eas submit -p ios
```

## 📝 Dönüştürme Örnekleri

### Material UI Button → React Native Paper
```typescript
// Eski (Web)
<Button variant="contained" color="primary" onClick={handleClick}>
  Giriş Yap
</Button>

// Yeni (React Native)
<Button mode="contained" onPress={handlePress}>
  Giriş Yap
</Button>
```

### Navigation
```typescript
// Eski (React Router)
<Route path="/dashboard" element={<Dashboard />} />

// Yeni (React Navigation)
<Stack.Screen name="Dashboard" component={Dashboard} />
```

## ⏱️ Tahmini Süre: 3-5 Gün

### Gün 1: Expo kurulum ve temel yapı
### Gün 2: Firebase ve servis katmanı
### Gün 3: UI bileşenleri dönüşümü
### Gün 4: Test ve düzeltmeler
### Gün 5: Build ve yayın

## 🆚 Alternatif: Ionic Appflow

Eğer Expo'ya geçmek istemezseniz:
- Mevcut Capacitor projenizi kullanabilirsiniz
- Ayda $49 (1 hafta ücretsiz)
- Windows'tan direkt çalışır
- Kurulum: 1 saat

## 💡 Tavsiye

**Uzun vadeli düşünüyorsanız**: Expo'ya geçin
**Hemen yayınlamak istiyorsanız**: Ionic Appflow kullanın
