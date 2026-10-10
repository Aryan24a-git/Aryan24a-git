const CACHE_NAME = 'naturenudge-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-512.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests, ignore API calls
    if (event.request.method !== 'GET' || event.request.url.includes('googleapis.com') || event.request.url.includes('open-meteo.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
