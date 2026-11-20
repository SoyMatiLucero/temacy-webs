// Cache para uso sin conexión. Cambia la versión con cada publicación.
const CACHE = "simulador-8c268fca";
const FILES = ["./", "index.html", "manifest.webmanifest", "favicon.svg", "fonts/fonts.css", "fonts/atkinson-hyperlegible-400.woff2", "fonts/atkinson-hyperlegible-700.woff2", "fonts/barlow-condensed-500.woff2", "fonts/barlow-condensed-600.woff2", "fonts/barlow-condensed-700.woff2", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "icons/maskable-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("simulador-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    // Red primero para tener siempre la última versión; si no hay señal, la copia guardada.
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("index.html", c)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
