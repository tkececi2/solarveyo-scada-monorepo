# Admin Kullanıcısı Oluşturma Kılavuzu

## 1. Firebase Console'dan Users Koleksiyonuna Admin Ekleyin

1. **Firebase Console'a gidin:** https://console.firebase.google.com/
2. **Projenizi seçin** (tkececi-b86ba)
3. **Firestore Database** sekmesine gidin
4. **"Start collection"** butonuna tıklayın
5. **Collection ID:** `users` yazın
6. **Document ID:** Kendi UID'inizi yazın (Authentication sekmesinden bulabilirsiniz)

### Document fields:
```
uid: "your-firebase-uid-here"
email: "tolgatkceci@gmail.com"
displayName: "Tolga Admin" 
role: "admin"
createdAt: (şu anki timestamp)
```

## 2. Alternatif: Authentication'dan UID Bulma

1. **Firebase Console** → **Authentication** → **Users**
2. Email adresinizi bulun
3. **UID** kolonundaki değeri kopyalayın
4. Bu UID'yi yukarıdaki Document ID'ye yapıştırın

## 3. Test Etme

1. Uygulamaya giriş yapın
2. **Ekip** sayfasına gidin
3. **"Ekip Üyesi Ekle"** butonunu test edin

Artık admin olarak tüm işlemleri yapabilirsiniz!

## Troubleshooting

Eğer hala "Firebase kuralları henüz ayarlanmamış" hatası alıyorsanız:

1. Browser cache'ini temizleyin (Ctrl+Shift+Del)
2. Sayfayı yenileyin (F5)
3. 5-10 dakika bekleyin (Firebase kuralları bazen gecikmeyle aktif olur)
