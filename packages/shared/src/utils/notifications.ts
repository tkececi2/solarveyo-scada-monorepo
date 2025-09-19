// Push Notification Yönetimi

export const requestNotificationPermission = async () => {
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
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === 'granted') {
    // Service Worker üzerinden bildirim gönder (PWA için)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          icon: '/icon-192x192.png',
          badge: '/icon-72x72.png',
          tag: 'solarveyo-notification',
          requireInteraction: false,
          ...options
        } as any);
      });
    } else {
      // Fallback: Normal bildirim
      new Notification(title, {
        icon: '/icon-192x192.png',
        ...options
      });
    }
  }
};

// Örnek bildirimler
export const sendAlarmNotification = (message: string) => {
  showNotification('⚠️ SolarVeyo Alarm', {
    body: message,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'alarm',
    requireInteraction: true, // Kullanıcı kapatana kadar kalır
  } as any);
};

export const sendProductionUpdate = (production: number) => {
  showNotification('📊 Üretim Güncellemesi', {
    body: `Güncel üretim: ${production.toFixed(2)} kW`,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'production',
    silent: true // Sessiz bildirim
  });
};

// Arka plan senkronizasyonu (offline'da bile çalışır)
export const setupBackgroundSync = async () => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    try {
      await (registration as any).sync.register('sync-data');
      console.log('Arka plan senkronizasyonu aktif');
    } catch (error) {
      console.log('Arka plan senkronizasyonu desteklenmiyor');
    }
  }
};

// Periyodik arka plan senkronizasyonu (her 1 saatte)
export const setupPeriodicBackgroundSync = async () => {
  if ('serviceWorker' in navigator && 'PeriodicSyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });
    
    if (status.state === 'granted') {
      try {
        await (registration as any).periodicSync.register('check-updates', {
          minInterval: 60 * 60 * 1000, // 1 saat
        });
        console.log('Periyodik senkronizasyon aktif');
      } catch (error) {
        console.log('Periyodik senkronizasyon hatası:', error);
      }
    }
  }
};
