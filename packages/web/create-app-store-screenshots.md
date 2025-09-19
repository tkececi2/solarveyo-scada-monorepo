# 📸 App Store Ekran Görüntüleri Rehberi

## Gerekli Boyutlar

### iPhone Screenshots:
1. **iPhone 6.7" (Pro Max):** 1290 x 2796 piksel
2. **iPhone 6.5":** 1242 x 2688 piksel  
3. **iPhone 5.5":** 1242 x 2208 piksel

### iPad Screenshots:
1. **iPad Pro 12.9":** 2048 x 2732 piksel
2. **iPad Pro 11":** 1668 x 2388 piksel

## Çekilmesi Gereken Ekranlar

### 1. Dashboard Ana Ekranı
- Gerçek zamanlı üretim verileri görünür
- Güneş ikonu ve aktif santral sayısı
- Günlük/aylık üretim grafikleri

### 2. Santral Listesi
- Birden fazla santral kartı
- Her santralın durumu ve üretim bilgisi
- Temiz ve düzenli liste görünümü

### 3. Santral Detay Sayfası
- İnverter listesi
- Detaylı performans metrikleri
- Harita görünümü (opsiyonel)

### 4. Raporlama Ekranı
- Grafik ve tablolar
- Tarih aralığı seçiciler
- Excel export butonu

### 5. Ekip Yönetimi
- Kullanıcı rolleri
- Personel listesi
- Yönetim paneli

## Çekim Talimatları

### Hazırlık:
1. Uygulamayı geliştirme modunda çalıştırın
2. Demo verilerle santral ve üretim bilgileri doldurun
3. Temiz, profesyonel görünüm için UI'ı düzenleyin

### Çekim:
1. **Tarayıcıda F12** → Device Mode
2. **iPhone 14 Pro Max** seçin (1290x2796)
3. Her ekranı tam sayfa olarak çekin
4. Aynı işlemi iPad Pro 12.9" için tekrarlayın

### Düzenleme:
- Arka planı temizleyin
- Gereksiz bilgileri maskeleyın
- Yüksek kalitede PNG olarak kaydedin

## Alternatif Yöntem - Simulator

```bash
# iOS Simulator açın
npx cap open ios

# Xcode'da:
# 1. iPhone 14 Pro Max simulator seçin
# 2. Command + Shift + 4 ile ekran görüntüsü alın
# 3. Her gerekli ekranı çekin
```

## Dosya Adlandırma

```
screenshots/
├── iphone-6.7/
│   ├── 01-dashboard.png
│   ├── 02-sites.png
│   ├── 03-site-detail.png
│   ├── 04-reports.png
│   └── 05-team.png
└── ipad-12.9/
    ├── 01-dashboard.png
    ├── 02-sites.png
    └── 03-reports.png
```

## ⚠️ Önemli Notlar

1. **Kişisel veri göstermeyin** (gerçek şirket isimleri, adresler)
2. **Yüksek kalite** kullanın (PNG, sıkıştırmasız)
3. **Status bar temiz** olsun (tam sinyal, tam batarya)
4. **Aynı içerik** farklı boyutlarda olabilir
5. **5 ekran** iPhone için, **3 ekran** iPad için yeterli
