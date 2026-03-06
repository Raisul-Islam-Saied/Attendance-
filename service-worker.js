// ===============================
// SALARY SHEET FAST OFFLINE SW
// ===============================

const CACHE_NAME = "salary-sheet-cache";


// ------------ INSTALL ------------
self.addEventListener("install", event => {
  self.skipWaiting();
});


// ------------ ACTIVATE ------------
self.addEventListener("activate", event => {
  self.clients.claim();
});


// ------------ FETCH ------------
self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // external resource bypass
  if (url.origin !== location.origin) return;

  event.respondWith(

    caches.match(event.request)
      .then(cachedResponse => {

        const networkFetch = fetch(event.request)
          .then(networkResponse => {

            const clone = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone));

            return networkResponse;

          })
          .catch(() => cachedResponse);

        // cache থাকলে instant load
        return cachedResponse || networkFetch;

      })

  );

});
