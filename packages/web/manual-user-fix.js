// Manuel kullanıcı ekleme - console'da çalıştır
async function fixMissingUser() {
  try {
    const { doc, setDoc } = window.firebase.firestore;
    const { db } = window.firebase;
    
    // Eksik kullanıcı bilgileri
    const uid = "806zGzfoScU56BQu2hDSF7bqVDo1";
    
    // Firebase Console → Authentication'dan email'i kontrol et
    const email = prompt("Kullanıcının email adresini gir:");
    const role = prompt("Kullanıcının rolünü gir (manager/viewer):");
    const displayName = prompt("Kullanıcının adını gir:");
    
    if (!email || !role || !displayName) {
      console.error("Tüm bilgileri giriniz!");
      return;
    }
    
    const userData = {
      uid: uid,
      email: email,
      displayName: displayName,
      role: role,
      assignedSites: [],
      createdAt: new Date()
    };
    
    console.log("🔧 Manuel user ekleniyor:", userData);
    
    await setDoc(doc(db, 'users', uid), userData);
    
    console.log("✅ User başarıyla eklendi!");
    console.log("🔄 Sayfayı yenile (F5)");
    
  } catch (error) {
    console.error("❌ Hata:", error);
  }
}

// Global fonksiyon
window.fixMissingUser = fixMissingUser;
console.log("Manuel düzeltme hazır. Çalıştır: fixMissingUser()");
