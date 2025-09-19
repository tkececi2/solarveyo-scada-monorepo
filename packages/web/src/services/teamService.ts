import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where,
  orderBy,
  Timestamp,
  setDoc 
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { User } from '@/types';

// Yeni ekip üyesi ekleme
export const addTeamMember = async (memberData: {
  email: string;
  displayName: string;
  role: 'manager' | 'viewer';
  assignedSites?: string[];
  createdBy: string;
}) => {
  try {
    // Önce users koleksiyonunda bu email'e sahip kullanıcı var mı kontrol et
    const usersRef = collection(db, 'users');
    const existingUserQuery = query(usersRef, where('email', '==', memberData.email));
    const existingUserSnap = await getDocs(existingUserQuery);
    
    if (!existingUserSnap.empty) {
      throw new Error('Bu email adresi ile zaten bir kullanıcı mevcut');
    }

    // Geçici şifre oluştur
    const tempPassword = generateTemporaryPassword();
    
    // Firebase Auth'da kullanıcı oluştur
    // Not: Bu işlem client-side'da çalışır ancak production'da Admin SDK kullanılması önerilir
    const userCredential = await createUserWithEmailAndPassword(auth, memberData.email, tempPassword);
    const user = userCredential.user;

    // users koleksiyonuna ekle
    const newUser: User = {
      uid: user.uid,
      email: memberData.email,
      displayName: memberData.displayName,
      role: memberData.role,
      assignedSites: memberData.assignedSites || [],
      createdAt: new Date(),
      createdBy: memberData.createdBy
    };

    await setDoc(doc(db, 'users', user.uid), newUser);

    // Şifre sıfırlama emaili gönder (kullanıcı kendi şifresini belirleyebilsin)
    await sendPasswordResetEmail(auth, memberData.email);

    return {
      success: true,
      userId: user.uid,
      message: 'Ekip üyesi başarıyla eklendi. Kullanıcıya şifre belirleme emaili gönderildi.'
    };

  } catch (error: any) {
    console.error('Ekip üyesi ekleme hatası:', error);
    throw new Error(error.message || 'Ekip üyesi eklenirken bir hata oluştu');
  }
};

// Geçici şifre oluşturucu
const generateTemporaryPassword = (): string => {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
};

// Tüm ekip üyelerini getir
export const getTeamMembers = async (): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as User[];
  } catch (error) {
    console.error('Ekip üyeleri getirme hatası:', error);
    throw error;
  }
};

// Belirli bir ekip üyesini getir
export const getTeamMember = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        ...userData,
        createdAt: userData.createdAt?.toDate() || new Date()
      } as User;
    }
    return null;
  } catch (error) {
    console.error('Ekip üyesi getirme hatası:', error);
    throw error;
  }
};

// Ekip üyesi güncelleme
export const updateTeamMember = async (
  userId: string, 
  updates: Partial<User>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Ekip üyesi güncelleme hatası:', error);
    throw error;
  }
};

// Ekip üyesi silme
export const deleteTeamMember = async (userId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    // Note: Firebase Auth kullanıcısını silmek için Admin SDK gerekir
    // Bu durumda sadece Firestore'dan siliyoruz
  } catch (error) {
    console.error('Ekip üyesi silme hatası:', error);
    throw error;
  }
};

// Saha ataması güncelleme
export const updateSiteAssignments = async (
  userId: string, 
  assignedSites: string[]
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      assignedSites,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Saha ataması güncelleme hatası:', error);
    throw error;
  }
};

// Belirli role sahip kullanıcıları getir
export const getUsersByRole = async (role: User['role']): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as User[];
  } catch (error) {
    console.error('Role göre kullanıcı getirme hatası:', error);
    throw error;
  }
};

// İzleyici kullanıcıların atanan sahalarını kontrol et
export const checkUserSiteAccess = (user: User, siteId: string): boolean => {
  // Admin ve manager her sahaya erişebilir
  if (user.role === 'admin' || user.role === 'manager') {
    return true;
  }
  
  // Viewer sadece atanan sahalara erişebilir
  if (user.role === 'viewer') {
    return user.assignedSites?.includes(siteId) || false;
  }
  
  return false;
};

// Kullanıcının erişebileceği sahaları getir
export const getUserAccessibleSites = (user: User): string[] => {
  if (user.role === 'admin' || user.role === 'manager') {
    return []; // Boş array = tüm sahalara erişim
  }
  
  return user.assignedSites || [];
};