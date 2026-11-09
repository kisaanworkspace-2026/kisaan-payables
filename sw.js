/* Kisaan Payables service worker.
   - App shell: cached on install, served fast/offline (stale-while-revalidate).
   - Apps Script API calls (script.google.com / googleusercontent) are NEVER cached: money data must be live.
   Change VERSION whenever you deploy a new build so users get the update prompt. */
const VERSION = 'kisaan-payables-v1.0.0';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/config.js',
  'js/app.js',
  'manifest.webmanifest',
  'assets/kisaan-logo.png',
  'assets/welcome-bg.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  // Optional files (logo/background you add yourself) must not break the install if absent.
  e.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API and CDN: straight to network

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return cached || network;
    })
  );
});
