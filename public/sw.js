/**
 * Smart Absensi Guru - Progressive Web App (PWA) Service Worker
 * Handles offline caching strategies, background sync, and local push reminders
 */

const CACHE_NAME = 'smart-absensi-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/version.json',
];

// Install Event - Pre-cache core static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core application shell...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting legacy cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Hybrid Network-First & Stale-While-Revalidate Caching Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Supabase REST API calls from Cache
  if (request.method !== 'GET' || url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // OpenStreetMap tile images - Cache First
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open('map-tiles-cache').then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Static Assets / Fonts / Images - Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok && request.url.startsWith('http')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is for page navigation, fallback to root index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Event - Handle Web Push Notifications
self.addEventListener('push', (event) => {
  let payload = {
    title: '🔔 Smart Absensi Guru',
    body: 'Pemberitahuan presensi baru tersedia.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    url: '/',
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const targetUrl = payload.action_url || payload.url || '/';

  const options = {
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    tag: payload.tag || `sag_push_${Date.now()}`,
    data: {
      url: targetUrl,
      action_url: targetUrl,
      notificationId: payload.id,
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open_app', title: '📱 Buka Aplikasi' },
      { action: 'close', title: 'Tutup' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Notification Click Event - Contextual Navigation to targetUrl
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  let targetUrl =
    (event.notification.data && (event.notification.data.action_url || event.notification.data.url)) || '/';

  // Handle contextual action buttons
  if (event.action === 'open_leaves') {
    targetUrl = '/?tab=LEAVES';
  } else if (event.action === 'open_attendance') {
    targetUrl = '/?tab=TEACHERS';
  } else if (event.action === 'checkout_now') {
    targetUrl = '/?action=checkout';
  }

  // Ensure internal route
  const sanitizedUrl = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl.replace(/^https?:\/\/[^/]+/, '')}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, navigate and focus it
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && client.url !== sanitizedUrl) {
            client.navigate(sanitizedUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(sanitizedUrl);
      }
    })
  );
});

// Message Event from Client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_ATTENDANCE_REMINDER') {
    const { title, body, delayMs, tag } = event.data;
    // Note: Long setTimeout (>30s) in dormant Service Worker can be terminated by OS.
    // For immediate or short alarms, trigger notification directly.
    if (!delayMs || delayMs <= 1000) {
      self.registration.showNotification(title || '🔔 Waktu Pulang Sekolah Tiba!', {
        body: body || 'Jangan lupa scan QR / Absen Pulang sebelum meninggalkan area sekolah.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: tag || 'checkout-reminder',
        requireInteraction: true,
        data: { url: '/?action=checkout' },
        actions: [
          { action: 'checkout_now', title: '📱 Absen Pulang Sekarang' },
          { action: 'close', title: 'Tutup' },
        ],
      });
    }
  }
});
