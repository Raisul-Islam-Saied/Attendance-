const CACHE_NAME = 'student-app-v5.0';

// শুধু মূল ফাইলগুলো প্রথমে সেভ হবে (এতে কোনো থার্ড-পার্টি লিংক দিয়ে ক্র্যাশ করবে না)
const CORE_ASSETS = [
    './',
    './index.html',
    './logo.png',
    './manifest.json'
];

// ১. Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching core files...');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// ২. Activate Event - পুরনো ক্যাশ ডিলিট করা
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ৩. Fetch Event - অফলাইনে অ্যাপ চালানোর মেইন লজিক
self.addEventListener('fetch', (event) => {
    // সমস্যা ফিক্স ১: অফলাইনে অ্যাপ ওপেন করলে সরাসরি ক্যাশ থেকে index.html দেখাবে
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // সমস্যা ফিক্স ২: API বাদে বাকি সব লিংক (CDN, Images) ক্যাশ করবে এবং অফলাইনে দেখাবে
    if (!event.request.url.includes('script.google.com')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse; // ক্যাশে থাকলে সাথে সাথে দেখাবে
                }

                // ক্যাশে না থাকলে নেট থেকে আনবে এবং ভবিষ্যতে অফলাইনের জন্য সেভ করে রাখবে
                return fetch(event.request).then((networkResponse) => {
                    // ভুল রেসপন্স ক্যাশ করবে না
                    if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'opaque')) {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    console.log('[SW] You are completely offline!');
                });
            })
        );
    }
});
