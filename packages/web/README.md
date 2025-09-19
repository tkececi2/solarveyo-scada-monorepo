# 🌞 SolarVeyo SCADA İzleme Sistemi

Modern güneş enerjisi santralları için geliştirilmiş gerçek zamanlı izleme ve raporlama sistemi.

## ✨ Özellikler

### 🔐 Kullanıcı Yönetimi
- **Role-based Access Control (RBAC)**
  - **Admin**: Tüm yetkilere sahip
  - **Manager**: Saha yönetimi ve raporlama
  - **Viewer**: Sadece atanan sahaları görüntüleme
- Firebase Authentication ile güvenli giriş
- Ekip üyesi ekleme ve yönetimi

### 📊 Real-time İzleme
- **FUSION ve SANGROW** inverter sistemleri desteği
- Gerçek zamanlı veri akışı (Firebase Firestore)
- **PV String Monitoring** - String bazında detaylı izleme
- **MPPT Tracking** - Maximum Power Point izleme
- **Manuel String Kontrolü** - Force-inactive özelliği

### 📈 Raporlama ve Analiz
- **Gelişmiş Grafik Türleri**: Line, Bar, Area, Candlestick
- **Tarih Bazlı Filtreleme**: Günlük, Aylık, Yıllık
- **Excel Export/Import**: Geçmiş veri yükleme
- **Performance Analytics**: Verimlilik analizleri
- **Türkçe Lokalizasyon**: Tam Türkçe arayüz

### 🏭 Santral Yönetimi
- Saha ekleme/düzenleme/silme
- Custom inverter isimlendirme
- Saha bazlı erişim kontrolü
- Dashboard özet istatistikleri

### 📋 Veri Yönetimi
- **Excel Import**: Basit 3 sütunlu format (Tarih, Saha Adı, Üretim)
- **Detaylı Veri Silme**: Santral/kayıt bazında seçimli silme
- **Duplicate Protection**: Çakışan kayıt kontrolü
- **Batch Operations**: Toplu veri işlemleri

## 🚀 Teknologi Stack

### Frontend
- **React 18** + **TypeScript**
- **Material-UI (MUI)** - Modern komponent kütüphanesi
- **Recharts** - Grafik ve chart kütüphanesi
- **React Router** - SPA routing
- **Zustand** - State management

### Backend & Database
- **Firebase Firestore** - NoSQL veritabanı
- **Firebase Authentication** - Kullanıcı doğrulama
- **Real-time listeners** - Canlı veri akışı

### Build & Deploy
- **Vite** - Hızlı build tool
- **TypeScript** - Type safety
- **ESLint** - Code quality
- **Netlify** - Hosting ve CI/CD

## 📦 Kurulum

### Gereksinimler
- Node.js ≥ 18.0.0
- npm ≥ 8.0.0
- Firebase projesi

### 1. Repository'yi klonlayın
```bash
git clone https://github.com/yourusername/solarveyo-scada.git
cd solarveyo-scada
```

### 2. Bağımlılıkları yükleyin
```bash
npm install
```

### 3. Environment variables ayarlayın
```bash
# env.example dosyasını .env olarak kopyalayın
cp env.example .env

# Firebase config değerlerini düzenleyin
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
# ... diğer değerler
```

### 4. Development server'ı başlatın
```bash
npm run dev
```

## 🔧 Build ve Deploy

### Production build
```bash
npm run build
```

### 📱 Mobil (Capacitor)

```bash
# Web varlıklarını üret
npm run build

# Native projelerle senkronize et
npx cap sync

# Android'i Android Studio ile aç
npx cap open android

# iOS için (yalnızca macOS):
npx cap add ios
npx cap open ios
```

### Netlify'ye deploy
1. GitHub'a push yapın
2. Netlify'de projeyi bağlayın
3. Environment variables'ları Netlify'de set edin
4. Auto-deploy aktif olsun

## 📊 Veri Yapısı

### Firestore Collections
```
📁 users/
  └── role: 'admin' | 'manager' | 'viewer'
  └── assignedSites: string[]

📁 sites/
  └── name: string
  └── sources: { collection: string, type: string }[]

📁 daily_production/
  └── date: string (YYYY-MM-DD)
  └── siteId: string
  └── dailyProduction: number

📁 Voyag_*/ (FUSION verileri)
📁 *_arazi_ges_Inverters/ (SANGROW verileri)
```

### Excel Import Format
```
Tarih           | Saha Adı          | Günlük Üretim (kWh)
2024-01-15      | Ankara GES        | 2500
16/01/2024      | İstanbul Santralı | 1800
```

## 🔒 Güvenlik

- **Firebase Security Rules** ile backend güvenlik
- **Role-based UI** - Rol bazlı arayüz kontrolü
- **Environment Variables** - Sensitive data protection
- **HTTPS Only** - Güvenli bağlantı
- **XSS Protection** - Cross-site scripting koruması

## 🎯 Kullanım Scenarios

### Admin Kullanımı
```typescript
// Yeni ekip üyesi ekleme
await addTeamMember({
  email: 'user@company.com',
  role: 'manager',
  assignedSites: ['site1', 'site2']
});

// Saha ekleme
await addSite({
  name: 'Yeni GES',
  location: 'Ankara',
  capacityMWp: 50,
  systemType: 'FUSION'
});
```

### Manager Kullanımı
```typescript
// Excel'den veri import
const data = await HistoricalDataService.parseExcelFile(file);
await HistoricalDataService.importData(data);

// Rapor export
exportToExcel(reportData);
```

### Viewer Kullanımı
```typescript
// Sadece atanan sahaları görüntüleme
const accessibleSites = getAccessibleSites();
const filteredData = data.filter(site => 
  accessibleSites.includes(site.id)
);
```

## 📈 Performance

- **Lazy Loading** - Component bazlı kod splitting
- **Real-time Updates** - Optimized Firestore listeners
- **Caching** - Browser cache ve CDN
- **Bundle Optimization** - Tree shaking ve minification

## 🐛 Troubleshooting

### Firebase Bağlantı Sorunları
```bash
# Firebase config kontrolü
npm run dev
# Console'da Firebase errors kontrol edin
```

### Build Hataları
```bash
# Type check
npm run type-check

# Linting
npm run lint:fix
```

## 📞 Destek

- **Issues**: GitHub Issues üzerinden
- **Dokümantasyon**: Bu README
- **Updates**: Release notes

## 📱 Appflow iOS Build
- Detaylı rehber: `docs/appflow-ios.md`

## 📄 Lisans

MIT License - Detaylar için `LICENSE` dosyasına bakın.

---

**🌞 SolarVeyo** - Güneş enerjisinin geleceğini izleyin! ☀️