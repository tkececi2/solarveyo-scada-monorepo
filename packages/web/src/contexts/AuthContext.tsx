import React, { createContext, useContext, useEffect, useState } from 'react'
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { User } from '@/types'
import { AlertMonitoringService } from '../services/alertMonitoringService'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isManager: boolean
  isViewer: boolean
  canAccessSite: (siteId: string) => boolean
  getAccessibleSites: () => string[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [alertMonitoring] = useState(AlertMonitoringService.getInstance())

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Firestore'dan kullanıcı bilgilerini al
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            
            const user: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: userData.role || 'customer',
              displayName: firebaseUser.displayName || userData.displayName,
              assignedSites: userData.assignedSites || [],
              createdAt: userData.createdAt?.toDate() || new Date(),
              createdBy: userData.createdBy
            }
            
            // Admin, manager ve viewer'lar sisteme girebilir
            if (['admin', 'manager', 'viewer'].includes(user.role)) {
              setUser(user)
              // Bildirim izlemeyi SADECE admin/manager için başlat
              if (user.role === 'admin' || user.role === 'manager') {
                console.log('🔔 Starting alert monitoring for manager/admin:', user.role)
                alertMonitoring.startMonitoring(user)
              } else {
                console.log('🔔 Skipping alert monitoring for viewer role')
              }
            } else {
              setUser(null)
              await signOut(auth) // Yetkisiz kullanıcıları çıkart
            }
          } else {
            // Kullanıcı belgesi henüz oluşturulmamış olabilir (ör. admin yeni kullanıcı eklerken)
            // Oturumu kapatma, aksi halde arka planda users belgesini yazmak yetkisiz kalır
            setUser(null)
          }
        } catch (error) {
          console.error('❌ Auth Debug - Error fetching user data:', error)
          setUser(null)
        }
      } else {
        setUser(null)
        // Kullanıcı çıkış yaptığında bildirim izlemeyi durdur
        alertMonitoring.stopMonitoring()
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      // Bildirim izlemeyi durdur
      alertMonitoring.stopMonitoring()
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  // Saha erişim kontrol fonksiyonları
  const canAccessSite = (siteId: string): boolean => {
    if (!user) return false;
    
    // Admin ve manager tüm sahalara erişebilir
    if (user.role === 'admin' || user.role === 'manager') {
      return true;
    }
    
    // Viewer sadece atanan sahalara erişebilir
    if (user.role === 'viewer') {
      return user.assignedSites?.includes(siteId) || false;
    }
    
    return false;
  };

  const getAccessibleSites = (): string[] => {
    if (!user) return [];
    
    // Admin ve manager tüm sahalara erişebilir (boş array = tümü)
    if (user.role === 'admin' || user.role === 'manager') {
      return [];
    }
    
    // Viewer sadece atanan sahalar
    return user.assignedSites || [];
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager' || user?.role === 'admin',
    isViewer: user?.role === 'viewer',
    canAccessSite,
    getAccessibleSites
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
