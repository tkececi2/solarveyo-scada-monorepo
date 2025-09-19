// UID uyumsuzluğunu düzelt - console'da çalıştır
async function fixUIDMismatch() {
  try {
    const { doc, setDoc } = window.firebase.firestore;
    const { db } = window.firebase;
    
    // Authentication'daki gerçek UID'ler (resimden)
    const users = [
      {
        uid: "VudXVrQwRyRU4ewfAtQ1DYIR...", // tkececi - tamam eksik kısımları var
        email: "tkececi@gmail.com",
        displayName: "tkececi",
        role: "admin" // sen zaten admin'sin
      },
      {
        uid: "YMS5eRP1ARblHIXIwcNuy60CZ1p1", // tolgatkceci - bu tam
        email: "tolgatkceci@gmail.com", 
        displayName: "tolgatkceci",
        role: "viewer"
      }
    ];
    
    for (const userData of users) {
      console.log(`🔧 ${userData.email} ekleniyor...`);
      
      const userDoc = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        assignedSites: [],
        createdAt: new Date()
      };
      
      await setDoc(doc(db, 'users', userData.uid), userDoc);
      console.log(`✅ ${userData.email} users koleksiyonuna eklendi!`);
    }
    
    console.log('🎯 Tamamlandı! Şimdi giriş yapmayı dene:');
    console.log('Email: tolgatkceci@gmail.com');
    console.log('Şifre: [oluştururken girdiğin şifre]');
    
  } catch (error) {
    console.error('❌ Hata:', error);
  }
}

window.fixUIDMismatch = fixUIDMismatch;
console.log('fixUIDMismatch() hazır - çalıştır!');
