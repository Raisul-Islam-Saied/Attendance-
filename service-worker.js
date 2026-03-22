const CACHE_NAME = 'student_info';

// যে ফাইলগুলো অফলাইনে চলার জন্য সেভ থাকবে
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 🚨 Google Apps Script, SMS API এবং Proxy রিকোয়েস্ট কখনোই ক্যাশ করবে না
    if (url.pathname.includes('/proxy') || url.hostname.includes('script.google.com') || url.pathname.includes('balance')) {
        event.respondWith(fetch(req)); 
        return;
    }

    // বাকি সব কিছুর জন্য "Stale-While-Revalidate" রুল
    event.respondWith(
        caches.match(req).then((cachedRes) => {
            const networkFetch = fetch(req).then((networkRes) => {
                if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return networkRes;
            }).catch(() => {
                // অফলাইনে থাকলে ক্যাশ থেকে দেখাবে
            });
            return cachedRes || networkFetch;
        })
    );
});
