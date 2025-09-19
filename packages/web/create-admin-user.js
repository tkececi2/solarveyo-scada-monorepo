// Firebase Admin SDK kullanarak admin kullanıcısı oluşturma scripti
// Bu script'i bir kere çalıştırıp sonra silebilirsiniz

const admin = require('firebase-admin');

// Firebase Admin SDK'yı başlat (Service Account key gerekli)
// Service Account key'i Firebase Console > Project Settings > Service Accounts'tan indirin

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  // Veya service account key dosyası:
  // credential: admin.credential.cert(require('./path/to/serviceAccountKey.json')),
});

const db = admin.firestore();

async function createAdminUser() {
  try {
    // Mevcut kullanıcılarınızın email'ini buraya yazın
    const adminEmail = 'tolgatkceci@gmail.com'; // Kendi email'inizi yazın
    
    // Kullanıcıyı Firebase Auth'ta bulun
    const userRecord = await admin.auth().getUserByEmail(adminEmail);
    
    // Users koleksiyonuna admin rolü ile kaydedin
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || 'Admin User',
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`Admin kullanıcısı oluşturuldu: ${adminEmail}`);
    console.log(`UID: ${userRecord.uid}`);
    
  } catch (error) {
    console.error('Hata:', error);
  }
}

createAdminUser();
