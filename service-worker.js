/**
 * ========================================================
 * NEXT-LEVEL SERVICE WORKER FOR STUDENT INFO FINDER
 * Version: 4.0.0
 * ========================================================
 */

const APP_VERSION = 'student-info-v4.0.0';

// আলাদা আলাদা ক্যাশ মেমোরি
const CACHE_STATIC = `static-${APP_VERSION}`;
const CACHE_DYNAMIC = `dynamic-${APP_VERSION}`;
const CACHE_FONTS = `fonts-${APP_VERSION}`;
const CACHE_IMAGES = `images-${APP_VERSION}`;

// যে ফাইলগুলো অ্যাপ ইন্সটল হওয়ার সাথেই অফলাইনের জন্য সেভ হবে
const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './logo.png',
    // --- CDNs (Offline Fallback) ---
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/html5-qrcode',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// ১. Install Event - ফাইলগুলো ক্যাশ করা
self.addEventListener('install', (event) => {
    self.skipWaiting(); // নতুন ভার্সন এলে সাথে সাথে আপডেট হবে
    event.waitUntil(
        caches.open(CACHE_STATIC).then((cache) => {
            console.log('[Service Worker] Pre-caching core assets...');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// ২. Activate Event - পুরনো ক্যাশ মুছে ফেলা
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (![CACHE_STATIC, CACHE_DYNAMIC, CACHE_FONTS, CACHE_IMAGES].includes(cache)) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // ইন্সটল হওয়ার সাথে সাথেই পেজ কন্ট্রোল করবে
    );
});

// ৩. Fetch Event - স্মার্ট রাউটিং (Smart Routing)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // স্ট্র্যাটেজি ১: Google Fonts -> Cache First
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(cacheFirst(event.request, CACHE_FONTS));
        return;
    }

    // স্ট্র্যাটেজি ২: CDNs (Scripts/Styles) -> Cache First (যেহেতু এগুলো পরিবর্তন হয় না)
    if (url.origin.includes('cdn.') || url.origin.includes('cdnjs.') || url.origin.includes('unpkg.')) {
        event.respondWith(cacheFirst(event.request, CACHE_STATIC));
        return;
    }

    // স্ট্র্যাটেজি ৩: UI Avatars / Images -> Stale-While-Revalidate
    if (url.origin.includes('ui-avatars.com') || event.request.destination === 'image') {
        event.respondWith(staleWhileRevalidate(event.request, CACHE_IMAGES));
        return;
    }

    // স্ট্র্যাটেজি ৪: Google Script API -> Network First (অফলাইনে থাকলে ক্যাশ থেকে দেখাবে)
    if (url.origin.includes('script.google.com')) {
        event.respondWith(networkFirst(event.request, CACHE_DYNAMIC));
        return;
    }

    // স্ট্র্যাটেজি ৫: বাকি সব লোকাল ফাইল -> Network First, Fallback to Cache
    event.respondWith(networkFirst(event.request, CACHE_STATIC));
});

/**
 * ==========================================
 * CACHING STRATEGIES (হেল্পার ফাংশন)
 * ==========================================
 */

// Cache First: আগে ক্যাশ দেখবে, না পেলে নেটওয়ার্ক থেকে আনবে
async function cacheFirst(request, cacheName) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok || networkResponse.type === 'opaque') {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Cache First Failed:', error);
        return new Response('', { status: 404, statusText: 'Offline' });
    }
}

// Network First: আগে নেটওয়ার্ক থেকে নতুন ডেটা আনবে, অফলাইনে থাকলে ক্যাশ থেকে দিবে
async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok || networkResponse.type === 'opaque') {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network failed, serving from cache:', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        
        throw error;
    }
}

// Stale-While-Revalidate: সাথে সাথে ক্যাশ থেকে দেখাবে, কিন্তু ব্যাকগ্রাউন্ডে নেটওয়ার্ক থেকে আপডেট করে রাখবে
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    const networkFetch = fetch(request).then((networkResponse) => {
        if (networkResponse.ok || networkResponse.type === 'opaque') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(err => console.log('[Service Worker] SWR Fetch Failed', err));

    return cachedResponse || networkFetch;
}
