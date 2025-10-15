const CACHE_NAME = 'my-pwa-cache-v1.1';

// Add version parameter to force update
//const SW_VERSION = '2.0'; // Change this when you update
//navigator.serviceWorker.register('/sw.js?v=' + SW_VERSION);

// Start with just caching the essential files
const urlsToCache = [
  './',              // root
  './index.html',    // main HTML file
  './book.json',     // your JSON file - add this line
  './app.js',        // if you have JS  
  './style.css'      // if you have CSS
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Cache addAll error:', error);
        // This prevents the install from failing completely
      })
  );
});

// Add fetch event handler for better debugging
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
