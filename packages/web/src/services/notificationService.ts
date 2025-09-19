import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  NotificationSettings, 
  NotificationAlert, 
  NotificationRule, 
  NotificationStats,
  User 
} from '../types';
import { toast } from 'react-toastify';

export class NotificationService {
  // Kullanıcı bildirim ayarlarını getir
  static async getUserNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      const docRef = doc(db, 'notificationSettings', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as NotificationSettings;
      }
      
      return null;
    } catch (error) {
      console.error('Bildirim ayarları alınırken hata:', error);
      throw error;
    }
  }

  // Kullanıcı bildirim ayarlarını kaydet/güncelle
  static async saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const docRef = doc(db, 'notificationSettings', settings.userId!);
      await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp(),
        createdAt: settings.createdAt || serverTimestamp(),
      }, { merge: true });
      
      toast.success('Bildirim ayarları kaydedildi');
    } catch (error) {
      console.error('Bildirim ayarları kaydedilirken hata:', error);
      toast.error('Bildirim ayarları kaydedilemedi');
      throw error;
    }
  }

  // Varsayılan bildirim ayarlarını oluştur
  static async createDefaultSettings(userId: string, assignedSites: string[] = []): Promise<NotificationSettings> {
    const defaultSettings: NotificationSettings = {
      userId,
      assignedSites,
      inverterAlerts: {
        enabled: true,
        offlineAlert: true,
        faultAlert: true,
        alarmAlert: true,
      },
      pvStringAlerts: {
        enabled: true,
        lowPerformanceAlert: true,
        faultAlert: true,
        offlineAlert: true,
        performanceThreshold: 80, // %80'in altında uyarı
      },
      temperatureAlerts: {
        enabled: true,
        highTempThreshold: 65, // °C
        criticalTempThreshold: 80, // °C
      },
      notificationMethods: {
        browser: true,
        email: false,
        sound: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveNotificationSettings(defaultSettings);
    return defaultSettings;
  }

  // Bildirim oluştur
  static async createAlert(alert: Omit<NotificationAlert, 'id' | 'timestamp'>): Promise<string> {
    try {
      const alertData = {
        ...alert,
        timestamp: serverTimestamp(),
        resolvedAt: null,  // Çözümlenmemiş olarak işaretle
        acknowledgedAt: null  // Onaylanmamış olarak işaretle
      };
      
      console.log('🔔 Creating alert in Firebase:', alertData);
      
      const docRef = await addDoc(collection(db, 'notificationAlerts'), alertData);
      
      // Browser bildirimi gönder - DEVRE DIŞI
      // this.showBrowserNotification(alert);
      
      return docRef.id;
    } catch (error) {
      console.error('Bildirim oluşturulurken hata:', error);
      throw error;
    }
  }

  // Bildirimi onayla
  static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'notificationAlerts', alertId);
      await updateDoc(docRef, {
        acknowledged: true,
        acknowledgedAt: serverTimestamp(),
        acknowledgedBy: userId,
      });
      
      toast.success('Bildirim onaylandı');
    } catch (error) {
      console.error('Bildirim onaylanırken hata:', error);
      toast.error('Bildirim onaylanamadı');
      throw error;
    }
  }

  // Bildirimi çözümle
  static async resolveAlert(alertId: string, autoResolved: boolean = false): Promise<void> {
    try {
      const docRef = doc(db, 'notificationAlerts', alertId);
      await updateDoc(docRef, {
        resolvedAt: serverTimestamp(),
        autoResolved,
      });
      
      if (!autoResolved) {
        toast.success('Bildirim çözümlendi');
      }
    } catch (error) {
      console.error('Bildirim çözümlenirken hata:', error);
      if (!autoResolved) {
        toast.error('Bildirim çözümlenemedi');
      }
      throw error;
    }
  }

  // Bildirimi sil
  static async deleteAlert(alertId: string): Promise<void> {
    try {
      if (!alertId) {
        console.error('Alert ID boş, silme işlemi iptal edildi');
        return;
      }
      
      const docRef = doc(db, 'notificationAlerts', alertId);
      await deleteDoc(docRef);
      console.log('Bildirim silindi:', alertId);
    } catch (error) {
      console.error('Bildirim silinirken hata:', error);
      throw error;
    }
  }

  // Kullanıcının tüm bildirimlerini sil
  static async deleteAllUserAlerts(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notificationAlerts'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      console.log(`${snapshot.size} bildirim silindi`);
    } catch (error) {
      console.error('Tüm bildirimler silinirken hata:', error);
      throw error;
    }
  }

  // Kullanıcının aktif bildirimlerini getir
  static async getUserActiveAlerts(userId: string): Promise<NotificationAlert[]> {
    try {
      const q = query(
        collection(db, 'notificationAlerts'),
        where('userId', '==', userId),
        where('resolvedAt', '==', null),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate(),
      })) as NotificationAlert[];
    } catch (error) {
      console.error('Aktif bildirimler alınırken hata:', error);
      throw error;
    }
  }

  // Kullanıcının bildirim geçmişini getir
  static async getUserAlertHistory(userId: string, limitCount: number = 100): Promise<NotificationAlert[]> {
    try {
      const q = query(
        collection(db, 'notificationAlerts'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate(),
      })) as NotificationAlert[];
    } catch (error) {
      console.error('Bildirim geçmişi alınırken hata:', error);
      throw error;
    }
  }

  // Gerçek zamanlı bildirim dinleyicisi - Site bazlı izolasyon ile
  static subscribeToUserAlerts(userId: string, userRole: string, assignedSites: string[], callback: (alerts: NotificationAlert[]) => void): Unsubscribe {
    console.log('🔔 NotificationService: Setting up subscription for user:', userId, 'role:', userRole);
    
    let q;
    
    // Sadece admin/manager notification subscription yapabilir
    if (userRole !== 'admin' && userRole !== 'manager') {
      console.log('🔔 NotificationService: Skipping subscription for non-manager role:', userRole);
      // Boş callback ile hemen dön
      return () => {}; // Empty unsubscribe function
    }

    if (userRole === 'admin' || userRole === 'manager') {
      // Admin ve manager tüm bildirimleri görebilir (basitleştirilmiş query)
      q = query(
        collection(db, 'notificationAlerts'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    } else {
      // Bu duruma hiç gelmemeli ama güvenlik için
      console.warn('🔔 NotificationService: Unexpected role in subscription:', userRole);
      return () => {};
    }
    
    return onSnapshot(q, 
      (snapshot) => {
        console.log('🔔 NotificationService: Snapshot received, docs:', snapshot.docs.length);
        const alerts = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('🔔 Alert data:', doc.id, data);
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate(),
            acknowledgedAt: data.acknowledgedAt?.toDate(),
            resolvedAt: data.resolvedAt?.toDate(),
          };
        }) as NotificationAlert[];
        
        // Client-side filtering for unresolved alerts (index-free solution)
        const unresolvedAlerts = alerts.filter(alert => !alert.resolvedAt);
        
        callback(unresolvedAlerts);
      },
      (error) => {
        console.error('🔔 NotificationService: Subscription error:', error);
        // Fallback: Boş array döndür, sistem çalışmaya devam etsin
        callback([]);
      }
    );
  }

  // Browser bildirimi göster
  private static async showBrowserNotification(alert: Omit<NotificationAlert, 'id' | 'timestamp'>) {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      // Service Worker kullanarak bildirim gönder (iOS PWA için)
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.showNotification(alert.title, {
              body: alert.message,
              icon: '/icon-192x192.png',
              badge: '/icon-72x72.png',
              tag: `alert-${alert.type}-${alert.deviceId || alert.siteId}`,
              requireInteraction: alert.severity === 'critical',
              silent: false,
              renotify: true,
              data: {
                alertId: alert.deviceId || alert.siteId,
                severity: alert.severity,
                url: '/'
              }
            } as any);
            console.log('Service Worker notification sent');
            return;
          }
        } catch (error) {
          console.warn('Service Worker notification failed:', error);
        }
      }

      // Fallback: Normal notification
      const notification = new Notification(alert.title, {
        body: alert.message,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: `alert-${alert.type}-${alert.deviceId || alert.siteId}`,
        requireInteraction: alert.severity === 'critical',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 10 saniye sonra otomatik kapat (critical değilse)
      if (alert.severity !== 'critical') {
        setTimeout(() => notification.close(), 10000);
      }
    }
  }

  // Bildirim izni iste
  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('Bu tarayıcı bildirimleri desteklemiyor');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  // Bildirim istatistiklerini hesapla
  static async calculateNotificationStats(userId: string): Promise<NotificationStats> {
    try {
      const q = query(
        collection(db, 'notificationAlerts'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const alerts = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
        acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
        resolvedAt: doc.data().resolvedAt?.toDate(),
      })) as NotificationAlert[];

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats: NotificationStats = {
        userId,
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        warningAlerts: alerts.filter(a => a.severity === 'warning').length,
        acknowledgedAlerts: alerts.filter(a => a.acknowledged).length,
        resolvedAlerts: alerts.filter(a => a.resolvedAt).length,
        lastWeekAlerts: alerts.filter(a => a.timestamp && a.timestamp > weekAgo).length,
        mostFrequentType: this.getMostFrequentType(alerts),
        averageResponseTime: this.calculateAverageResponseTime(alerts),
      };

      return stats;
    } catch (error) {
      console.error('Bildirim istatistikleri hesaplanırken hata:', error);
      throw error;
    }
  }

  private static getMostFrequentType(alerts: NotificationAlert[]): string {
    const typeCounts = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'inverter';
  }

  private static calculateAverageResponseTime(alerts: NotificationAlert[]): number {
    const acknowledgedAlerts = alerts.filter(a => a.acknowledged && a.acknowledgedAt && a.timestamp);
    
    if (acknowledgedAlerts.length === 0) return 0;

    const totalResponseTime = acknowledgedAlerts.reduce((sum, alert) => {
      const responseTime = (alert.acknowledgedAt!.getTime() - alert.timestamp!.getTime()) / (1000 * 60);
      return sum + responseTime;
    }, 0);

    return Math.round(totalResponseTime / acknowledgedAlerts.length);
  }
}
