const SHELL = 'withlove-shell-v1';
const SHELL_FILES = ['./', 'index-2.html', 'm.css', 'm.js', 'blink.gif', 'manifest.webmanifest', 'icon-192.png', 'eyes-blink.gif', 'eyes.png', 'paper-bg.jpg', 'favicon-64.png', 'lily-strip.jpg', 'tagline/1.jpg', 'fonts/ArchivoNarrow-Variable.ttf'];

self.addEventListener('install', (event) => { event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))); self.clients.claim(); });

// Network-first for the app shell so edits show up immediately; renders and API calls are never cached.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.pathname.startsWith('index.html')) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(SHELL).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});

// Push notifications (check-in reminders, announcements, With Lovees earned). Tapping one opens With Love
// at the notification's page, reusing an open window when there is one.
self.addEventListener('push', (event) => {
  let data = {}; try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'with love', { body: data.body || '', icon: './icon-192.png', badge: './favicon-64.png', data: { url: data.url || '/m/' } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/m/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.location.origin));
    return open ? open.navigate(url).then((c) => (c || open).focus()) : self.clients.openWindow(url);
  }));
});
