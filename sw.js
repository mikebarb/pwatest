
// Add version parameter to force update
let APP_VERSION = '2.0'; // Default Fall back value

// Get version from query string or message
const urlParams = new URL(self.location.href).searchParams;
APP_VERSION = urlParams.get('v') || APP_VERSION;

// Also listen for messages from app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_VERSION') {
        APP_VERSION = event.data.version;
        console.log('Service Worker version updated to:', APP_VERSION);
    }
});

const CACHE_NAME = 'rcsongs-cache-' + APP_VERSION;

// Start with just caching the essential files
const urlsToCache = [
  './',              // root
  './sw.js',        // service worker
  './index.html',    // main HTML file
  './book.json',     // your JSON file - add this line
  './app.js',        // if you have JS  
  './style.css',      // if you have CSS
  './favicon.ico',   // favicon
  './manifest.json', // manifest file
  './android-chrome-192x192.png', // app icon
  './android-chrome-512x512.png' // app icon
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, adding assets:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All assets cached successfully');
        return self.skipWaiting(); // Activate worker immediately
      })
      .catch(error => {
        console.error('Cache addAll error:', error);
        // This prevents the install from failing completely
      })
  );
});

self.addEventListener('fetch', event => {
  console.log('***********Fetch event***********');
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          console.log('Serving from cache:', event.request.url);
          return response;
        }
        
        // Fetch from network with error handling
        return fetch(event.request)
          .then(networkResponse => {
            // Optional: Cache the successful response
            if (networkResponse && networkResponse.status == 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(error => {
            // Handle network errors gracefully
            console.warn('Network failed, serving offline page: ', error);
            // You could return a custom offline page here
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Offline - content not available', {
              status: 503,
              headers: {'Content-Type': 'text/plain'}
            });
          });
      })
  );
});

// cleanup old caches during activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating version', APP_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Activation completed, claiming clients');
      return self.clients.claim(); // Take control immediately
    })
  );
});




