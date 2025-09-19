# Firebase Firestore Kuralları - Manuel Güncelleme

Firebase Console'da aşağıdaki kuralları yapıştırın:

## 1. Firebase Console'a Gidin
- https://console.firebase.google.com/
- Projenizi seçin
- Firestore Database → Rules

## 2. Bu Kuralları Yapıştırın:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Authenticated users can read and write all documents
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 3. "Publish" Butonuna Tıklayın

Bu basit kural authenticated (giriş yapmış) tüm kullanıcılara tüm koleksiyonlara okuma/yazma izni verir.

**Not:** Production ortamı için daha katı kurallar yazılmalı!
