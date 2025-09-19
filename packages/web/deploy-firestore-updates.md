# Firestore Security Rules ve Index Güncellemeleri

## Yapılan Değişiklikler

### 1. Security Rules Güncellemeleri
- **Notification Alerts** için site bazlı izolasyon eklendi
- Viewer rolündeki kullanıcılar sadece yetkili oldukları sitelerin bildirimlerini görebilir
- Manager ve Admin tüm bildirimleri görebilir

### 2. Index Güncellemeleri
Yeni index'ler eklendi:
- `siteId + resolvedAt + timestamp` (Viewer'lar için site bazlı sorgular)
- `resolvedAt + timestamp` (Admin/Manager için tüm bildirimler)

### 3. Kod Güncellemeleri
- `NotificationService.subscribeToUserAlerts()` artık role ve assignedSites parametreleri alıyor
- `NotificationCenter` komponenti güncellendi

## Deploy Komutları

PowerShell'de çalıştırın:

```powershell
# 1. Firestore Rules'ı deploy et
firebase deploy --only firestore:rules

# 2. Firestore Indexes'i deploy et
firebase deploy --only firestore:indexes

# 3. Her ikisini birlikte deploy et
firebase deploy --only firestore
```

## Önemli Notlar

1. Index'lerin oluşması birkaç dakika sürebilir
2. Deploy sonrası Firebase Console'dan kontrol edin:
   - https://console.firebase.google.com/project/yenisirket-2ec3b/firestore/indexes
   - https://console.firebase.google.com/project/yenisirket-2ec3b/firestore/rules

3. Test için:
   - Admin hesabıyla giriş yapın: Tüm bildirimleri görmeli
   - Viewer hesabıyla giriş yapın: Sadece atandığı sitelerin bildirimlerini görmeli

## Geri Alma
Eğer sorun olursa, Firebase Console'dan önceki versiyona dönebilirsiniz.
