import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

// Bu fonksiyonu browser console'dan çağırarak admin kullanıcısı oluşturabilirsiniz
export async function createCurrentUserAsAdmin() {
  try {
    const firebaseUser = auth.currentUser;
    
    if (!firebaseUser) {
      console.error('❌ Kullanıcı giriş yapmamış!');
      console.log('💡 Önce Firebase Auth ile giriş yapın');
      return;
    }

    console.log('🔧 Admin kullanıcısı oluşturuluyor...');
    console.log('📧 Email:', firebaseUser.email);
    console.log('🆔 UID:', firebaseUser.uid);

    // Mevcut kullanıcıyı admin olarak kaydet
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || 'Admin User',
      role: 'admin',
      createdAt: serverTimestamp(),
    });

    console.log('✅ Admin kullanıcısı başarıyla oluşturuldu!');
    console.log('🔄 Sayfayı yenileyin (F5) veya logout/login yapın');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    console.log('💡 Firebase Console\'dan manuel olarak ekleyin:');
    console.log(`Collection: users, Document: ${auth.currentUser?.uid}, Data: {role: "admin", email: "${auth.currentUser?.email}"}`);
  }
}

// Browser console'dan çağırmak için global hale getir
(window as any).createAdminUser = createCurrentUserAsAdmin;
