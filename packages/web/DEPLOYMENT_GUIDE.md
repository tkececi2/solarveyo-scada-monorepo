# 🚀 SolarVeyo SCADA - Deployment Guide

## 📋 GitHub'a Yükleme Adımları

### 1. GitHub Repository Oluşturma
1. GitHub.com'a gidin
2. "New repository" butonuna tıklayın
3. Repository adı: `solarveyo-scada`
4. Description: `SolarVeyo - Güneş Enerjisi Santralları SCADA İzleme Sistemi`
5. **Public** veya **Private** seçin
6. README, .gitignore ve license **eklemeyin** (zaten var)
7. "Create repository" butonuna tıklayın

### 2. Git Remote Ekleme ve Push
```bash
# GitHub repository'nizin URL'ini kullanın
git remote add origin https://github.com/KULLANICI_ADINIZ/solarveyo-scada.git

# Ana branch'i main olarak ayarlayın
git branch -M main

# GitHub'a push yapın
git push -u origin main
```

## 🌐 Netlify'de Deployment

### 1. Netlify Hesabı ve Bağlantı
1. [Netlify.com](https://netlify.com)'a gidin
2. GitHub hesabınızla giriş yapın
3. "Add new site" → "Import an existing project"
4. GitHub'ı seçin ve `solarveyo-scada` repository'sini seçin

### 2. Build Ayarları
```
Build command: npm run build
Publish directory: dist
Node version: 18
```

### 3. Environment Variables (Zorunlu!)
Netlify'de **Site settings** → **Environment variables** bölümünde:

```
VITE_FIREBASE_API_KEY = AIzaSyCNWtgvSIKr8FMivtcd17LTbIo-Ml9s1wY
VITE_FIREBASE_AUTH_DOMAIN = tkececi-b86ba.firebaseapp.com
VITE_FIREBASE_DATABASE_URL = https://tkececi-b86ba-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID = tkececi-b86ba
VITE_FIREBASE_STORAGE_BUCKET = tkececi-b86ba.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 788376105072
VITE_FIREBASE_APP_ID = 1:788376105072:web:eab51a0b1c25b0792f04b5
NODE_ENV = production
```

### 4. Domain ve SSL
- Netlify otomatik SSL sertifikası sağlar
- Custom domain istiyorsanız: **Domain settings** → **Add custom domain**

## 🔒 Firebase Domain Ayarları

Firebase Console'da **Authentication** → **Settings** → **Authorized domains**:
```
localhost (development için)
yourdomain.netlify.app (Netlify domain)
your-custom-domain.com (varsa)
```

## 📊 Monitoring ve Maintenance

### Performance Monitoring
- Netlify Analytics kullanın
- Firebase Performance Monitoring aktif edin

### Auto Deployment
- GitHub'a her push otomatik deployment tetikler
- Production branch'ini koruyun

### Backup Strategy
- Firebase verileri otomatik backup
- GitHub repository regular backup

## 🐛 Troubleshooting

### Build Hatası
```bash
# Local'de test edin
npm run build
npm run preview
```

### Firebase Bağlantı Sorunu
1. Environment variables kontrolü
2. Firebase domain yetkilendirmesi
3. Browser console errors

### Netlify Deploy Fails
1. Build logs kontrol edin
2. Node version uyumluluğu (18.x)
3. Environment variables eksiksiz mi?

## 🎯 Post-Deployment Checklist

- [ ] Site açılıyor ve login çalışıyor
- [ ] Firebase bağlantısı aktif
- [ ] Dashboard verileri geliyor
- [ ] Reports sayfası çalışıyor
- [ ] Excel import/export test edildi
- [ ] Mobil uyumluluk kontrol edildi
- [ ] SSL sertifikası aktif
- [ ] Domain doğru yönlendiriliyor

## 📞 Support

Deployment sorunları için:
1. Bu guide'ı tekrar gözden geçirin
2. Netlify build logs'ları kontrol edin
3. Firebase Console errors bakın
4. GitHub Issues oluşturun

---

✅ **Başarıyla deploy edildikten sonra** URL'nizi kaydedin ve team üyelerinizle paylaşın!
