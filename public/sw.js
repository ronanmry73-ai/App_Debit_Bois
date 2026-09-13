/* Débit Bois — app shell only. Le stock n’est jamais une vérité réseau. */
const CACHE = "debit-bois-shell-v1";

function isShell(url) {
  const p = url.pathname;
  if (p === "/" || p === "/index.html") return true;
  if (p === "/manifest.webmanifest" || p === "/favicon.svg") return true;
  if (p.startsWith("/icons/")) return true;
  if (p.startsWith("/assets/")) return true;
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/favicon.svg"]).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  if (url.pathname.endsWith(".json") && url.pathname !== "/manifest.webmanifest") return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/") || caches.match("/index.html")),
    );
    return;
  }
  if (!isShell(url)) return;
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
