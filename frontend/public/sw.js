const OFFLINE_PAGE = "/mobile/offline.html";
const CACHE = "przemai-offline-v2";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE_PAGE)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("przemai-offline-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" ||
      url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(url.pathname)) return;

  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(OFFLINE_PAGE) || Response.error();
  }));
});

self.addEventListener("message", event => {
  if (event.data === "ACTIVATE_UPDATE" && event.source?.type === "window")
    event.waitUntil(self.skipWaiting());
});
