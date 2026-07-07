/* ==========================================================================
 * service-worker.js — PWA cache untuk Pasanggiri Persinas ASAD
 * --------------------------------------------------------------------------
 * Strategi:
 *  - App shell (HTML/CSS/JS/ikon): cache-first (cepat & bisa offline)
 *  - Permintaan ke Apps Script (data): network-only (selalu data terbaru)
 *  - Naikkan CACHE_VERSION setiap kali file app shell berubah.
 * ========================================================================== */

const CACHE_VERSION = 'pasanggiri-v9';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hanya tangani GET
  if (req.method !== 'GET') return;

  // Data dari Apps Script / API eksternal: network-only (jangan di-cache)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return; // biarkan browser menangani (network)
  }

  // Pusher: jangan cache (biarkan network langsung)
  if (url.hostname.includes('pusher.com') || url.hostname.includes('pusherapp.com')) {
    return;
  }

  // Font Google: cache-first
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdn-uicons.flaticon.com')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // App shell & aset lokal: cache-first dengan fallback network
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    // fallback ke index untuk navigasi offline
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}
