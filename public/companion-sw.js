const CACHE = "venturo-companion-v1";
const PRECACHE = [
  "/companion",
  "/companion/login",
  "/brand/logos/venturo-horizontal-light.svg",
  "/brand/logos/venturo-stacked-light.svg",
  "/brand/fonts/SocialGothic-Rough.otf",
  "/brand/fonts/Nunito-ExtraLight.ttf",
  "/brand/pattern/pathway.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldHandle(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/auth/")) return false;
  return (
    url.pathname === "/companion" ||
    url.pathname.startsWith("/companion/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/_next/static/")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !shouldHandle(url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (url.pathname.startsWith("/companion")) {
          const shell = await caches.match("/companion");
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
