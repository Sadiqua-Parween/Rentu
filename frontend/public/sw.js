// Rentu⁺ Web Push Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Rentu⁺ Alert';
    const options = {
      body: data.body || 'You have a new update in Rentu⁺.',
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      tag: data.tag || 'rentu-push',
      renotify: true,
      data: {
        url: data.url || '/',
        payload: data.data || {},
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn('Error displaying push notification:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if a Rentu window is already open
      for (const client of windowClients) {
        if ('focus' in client) {
          if (targetUrl && client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
