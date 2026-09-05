// Every build preloads its own shell before replacing the previous worker.
// Only Hearthlight's caches and scope are touched.
const CACHE = "hearthlight-v2-__BUILD_STAMP__";
const ROOT = new URL("./", self.location.href).href;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(new URL("precache.json", ROOT), {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Offline manifest unavailable");
      const files = await response.json();
      const cache = await caches.open(CACHE);
      await cache.addAll(files.map((file) => new URL(file, ROOT).href));
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("hearthlight-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(ROOT)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (request.mode === "navigate") {
        try {
          const response = await fetch(request);
          if (!response.ok) throw new Error("Page unavailable");
          await cache.put(request, response.clone());
          return response;
        } catch {
          return (
            (await cache.match(request)) ||
            (await cache.match(new URL("index.html", ROOT).href)) ||
            Response.error()
          );
        }
      }
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })(),
  );
});
