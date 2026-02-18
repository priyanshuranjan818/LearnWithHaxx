const CACHE_NAME = 'learncheck-v1';
const ASSETS = [
    '/',
    '/static/style.css',
    '/static/script.js',
    '/static/manifest.json',
    '/static/icon-192.png',
    '/static/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // Simple cache-first strategy for static assets, network-first for pages.
    // Additional safety: when network fails return a cached fallback (root page) to
    // avoid uncaught TypeError in console.
    if (e.request.url.includes('/static/') || e.request.url.includes('fonts')) {
        e.respondWith(
            caches.match(e.request).then((res) => res || fetch(e.request))
        );
        return;
    }

    // For navigation requests or other API calls, try network first and then cache.
    e.respondWith(
        fetch(e.request)
            .catch(() =>
                caches.match(e.request).then((res) => {
                    // if nothing found, fall back to root (index page) which should be cached
                    return res || caches.match('/');
                })
            )
    );
});
