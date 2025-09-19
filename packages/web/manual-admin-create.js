// Manual admin kullanıcısı oluşturma scripti
// Bu dosyayı browser console'a kopyala ve çalıştır

async function createManualAdmin() {
  try {
    // Firebase modüllerini import et (browser global'dan)
    const { doc, setDoc, serverTimestamp } = window.firebase.firestore;
    const { auth, db } = window.firebase;
    
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ Kullanıcı giriş yapmamış!');
      return;
    }

    console.log('🔧 Admin kullanıcısı oluşturuluyor...');
    console.log('📧 Email:', user.email);
    console.log('🆔 UID:', user.uid);

    // Basit object ile admin oluştur
    const adminData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Admin User',
      role: 'admin',
      createdAt: new Date(),
    };

    await setDoc(doc(db, 'users', user.uid), adminData);
    
    console.log('✅ Admin başarıyla oluşturuldu!');
    console.log('🔄 Sayfayı yenileyin (F5)');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    
    // Firebase Console manual talimatları
    console.log('\n📋 MANUEL OLARAK EKLEYİN:');
    console.log('1. Firebase Console → Firestore Database');
    console.log('2. Collection: users');
    console.log('3. Document ID:', auth.currentUser?.uid);
    console.log('4. Fields:');
    console.log(`   uid: "${auth.currentUser?.uid}"`);
    console.log(`   email: "${auth.currentUser?.email}"`);
    console.log(`   role: "admin"`);
    console.log(`   displayName: "Admin User"`);
    console.log(`   createdAt: current timestamp`);
  }
}

// Global fonksiyon olarak ekle
window.createManualAdmin = createManualAdmin;
console.log('✅ createManualAdmin() fonksiyonu hazır. Çalıştırmak için: createManualAdmin()');
