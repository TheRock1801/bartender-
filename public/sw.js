// Minimal service worker so browsers treat the site as installable.
// Deliberately caches nothing: on the night everyone must see the live menu
// and queue, never a stale copy. Requests go straight to the network.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request))
})
