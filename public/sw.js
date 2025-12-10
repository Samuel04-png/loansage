// Service Worker for PWA
const CACHE_NAME = 'loansage-v1';
const urlsToCache = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch((err) => {
          console.log('Cache addAll failed:', err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch((err) => {
              // Silently fail cache operations - network errors are expected
              console.debug('Cache put failed (non-critical):', err);
            });
          }).catch((err) => {
            // Silently fail cache operations
            console.debug('Cache open failed (non-critical):', err);
          });
          return response;
        }).catch((err) => {
          // If fetch fails, try to return cached response
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache, return offline response
            throw err;
          });
        });
      })
      .catch(() => {
        // Return offline page or fallback
        return new Response('Offline', { status: 503 });
      })
  );
});

