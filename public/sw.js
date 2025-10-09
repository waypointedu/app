self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('waypoint-shell-v1').then((cache) => cache.addAll(['/','/manifest.json','/search/index.json']))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
