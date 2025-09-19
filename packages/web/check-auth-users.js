// Firebase Authentication kullanıcılarını kontrol etmek için
// Browser console'da çalıştır

async function checkAuthUsers() {
  try {
    const { auth } = window.firebase;
    
    console.log("📋 Mevcut Authentication Kullanıcıları:");
    
    // Firebase Console'da Authentication → Users bölümüne git
    console.log("1. Firebase Console → Authentication → Users");
    console.log("2. tolgattkececi@gmail.com kullanıcısını ara");
    console.log("3. UID'sini kontrol et: 806zGzfoScU56BQu2hDSF7bqVDo1");
    
    // Mevcut kullanıcı bilgisi
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log("✅ Şu anda giriş yapmış:", currentUser.email);
      console.log("🆔 UID:", currentUser.uid);
    } else {
      console.log("❌ Hiç kimse giriş yapmamış");
    }
    
    // Test login denemesi
    console.log("\n🔐 Test Login:");
    console.log("Email: tolgattkececi@gmail.com");
    console.log("Şifre: [oluştururken girdiğin şifre]");
    
  } catch (error) {
    console.error("❌ Hata:", error);
  }
}

window.checkAuthUsers = checkAuthUsers;
console.log("checkAuthUsers() fonksiyonu hazır");
