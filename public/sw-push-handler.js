/**
 * Smart Absensi Guru - Web Push Notifications & Background Service Worker Handler
 * Handles Push Events from Google FCM / Apple APNs when browser or PWA is closed.
 */

// 1. Push Event Listener (Incoming Web Push from Server)
self.addEventListener('push', (event) => {
  let payload = {
    title: '🔔 Smart Absensi Guru',
    body: 'Pemberitahuan presensi atau warta sekolah baru tersedia.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'smart-absensi-push',
    url: '/',
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.tag || `push_${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || '/',
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open_app', title: '📱 Buka Aplikasi' },
      { action: 'close', title: 'Tutup' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// 2. Notification Click Listener (When user taps the notification banner in Android / iOS / Windows)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing open window if available
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl) || targetUrl === '/') {
            return client.focus();
          }
        }
      }
      // Open new window if app was closed
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. Push Subscription Change Listener (Handled if browser rotates the push token)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW Push] Push subscription changed or refreshed by browser/OS');
});
