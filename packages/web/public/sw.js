const CACHE_NAME = 'solarveyo-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  // POST, PUT, DELETE isteklerini cache'leme
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Sadece aynı origin'den gelen istekleri cache'le
  const url = new URL(event.request.url);
  const isLocalRequest = url.origin === location.origin;
  
  // Firebase ve diğer external API'leri cache'leme
  if (!isLocalRequest || url.pathname.includes('/api/') || url.hostname.includes('firebase')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Başarılı response'ları cache'le (200 OK)
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          })
          .catch(err => {
            console.error('Cache put error:', err);
          });
        
        return response;
      })
      .catch(() => {
        // Offline durumda cache'den dön
        return caches.match(event.request);
      })
  );
});

// Push Notification Event
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Yeni bildirim!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    silent: false,
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Görüntüle',
        icon: '/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Kapat',
        icon: '/icon-72x72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('SolarVeyo SCADA', options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    // Uygulamayı aç
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background Sync Event
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
  if (event.tag === 'auto-save-production') {
    event.waitUntil(performBackgroundAutoSave());
  }
});

// Periodic Background Sync Event (PWA kapalıyken)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'production-data-sync') {
    event.waitUntil(performPeriodicSync());
  }
});

async function syncData() {
  // Offline'dayken biriken verileri senkronize et
  console.log('🔄 SW: Veri senkronizasyonu başladı');
}

async function performBackgroundAutoSave() {
  console.log('🔄 SW: Background auto-save triggered');
  
  // Saat kontrolü
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 22 || hour < 6) {
    console.log('⏰ SW: Auto-save skipped - Outside operating hours');
    return;
  }
  
  try {
    // Ana uygulama ile iletişim kur
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'BACKGROUND_AUTO_SAVE',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ SW: Background auto-save error:', error);
  }
}

async function performPeriodicSync() {
  console.log('🔄 SW: Periodic sync (PWA closed) triggered');
  
  // Saat kontrolü
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 22 || hour < 6) {
    console.log('⏰ SW: Periodic sync skipped - Outside operating hours');
    return;
  }
  
  // PWA kapalıyken de veri kaydetmeye çalış
  try {
    await performBackgroundAutoSave();
  } catch (error) {
    console.error('❌ SW: Periodic sync error:', error);
  }
}