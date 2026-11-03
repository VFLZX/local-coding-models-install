const APP_VERSION = "2.6.0";
const CACHE_NAME = "coder-shell-v12";
const APP_ROOT = new URL("./", self.registration.scope);
const IS_PUBLIC_APP = self.location.origin === "https://vflzx.github.io";
const SHELL_ASSETS = [
  ...(IS_PUBLIC_APP ? [`./?v=${APP_VERSION}`] : []),
  `./styles.css?v=${APP_VERSION}`,
  `./app.js?v=${APP_VERSION}`,
  `./manifest.webmanifest?v=${APP_VERSION}`,
  `./icon.svg?v=${APP_VERSION}`,
  `./icon-192.png?v=${APP_VERSION}`,
  `./icon-512.png?v=${APP_VERSION}`,
].map((asset) => new URL(asset, APP_ROOT).href);
const SHELL_PATHS = new Set(SHELL_ASSETS.map((asset) => new URL(asset).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldCaches = keys.filter((key) => key.startsWith("coder-shell-") && key !== CACHE_NAME);
    await Promise.all(oldCaches.map((key) => caches.delete(key)));
    await self.clients.claim();

    if (oldCaches.length) {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map(async (client) => {
        const url = new URL(client.url);
        if (url.origin !== self.location.origin || url.searchParams.get("coder-version") === APP_VERSION) return;
        url.searchParams.set("coder-version", APP_VERSION);
        url.searchParams.set("coder-updated", "1");
        try {
          await client.navigate(url.href);
        } catch (error) {
          console.warn("Could not reload an LCM window after its service-worker update.", error);
        }
      }));
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith(`${APP_ROOT.pathname}api/`)) return;
  if (event.request.mode === "navigate") {
    if (!IS_PUBLIC_APP) return;
    event.respondWith(
      fetch(event.request).catch(async () =>
        (await caches.match(new URL(`./?v=${APP_VERSION}`, APP_ROOT).href)) ||
        Response.error(),
      ),
    );
    return;
  }
  if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
      ),
    );
  }
});
