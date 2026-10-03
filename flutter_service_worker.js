'use strict';

const CACHE_PREFIX = 'nexo-app-shell-';
const CACHE_NAME = CACHE_PREFIX + '20261003111531';
const APP_SCOPE = self.registration.scope;
const APP_INDEX = new URL('index.html', APP_SCOPE).href;
const PRECACHE_URLS = ["index.html","manifest.json","favicon.png","flutter.js","flutter_bootstrap.js?v=20261003111531","version.json","main.8ccf9f077932aa26.dart.js","assets/AssetManifest.bin","assets/AssetManifest.bin.json","assets/FontManifest.json","assets/NOTICES","assets/assets/fonts/Lato-Bold.ttf","assets/assets/fonts/Lato-BoldItalic.ttf","assets/assets/fonts/Lato-Italic.ttf","assets/assets/fonts/Lato-Regular.ttf","assets/assets/images/nexo_logo_mark.png","assets/fonts/MaterialIcons-Regular.otf","assets/packages/cupertino_icons/assets/CupertinoIcons.ttf","assets/packages/flutter_local_notifications_web/web/notifications_service_worker.js","assets/packages/nexo_ai/assets/fonts/Lato-Bold.ttf","assets/packages/nexo_ai/assets/fonts/Lato-BoldItalic.ttf","assets/packages/nexo_ai/assets/fonts/Lato-Italic.ttf","assets/packages/nexo_ai/assets/fonts/Lato-Regular.ttf","assets/packages/nexo_ai/assets/images/nexo_logo_mark.png","assets/packages/record_web/assets/js/record.worklet.js","assets/shaders/ink_sparkle.frag","assets/shaders/stretch_effect.frag","icons/Icon-192.png","icons/Icon-512.png","icons/Icon-maskable-512.png","pdfjs/pdf.worker.min.mjs","canvaskit/canvaskit.js","canvaskit/canvaskit.wasm","canvaskit/chromium/canvaskit.js","canvaskit/chromium/canvaskit.wasm"];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin ||
      !requestUrl.pathname.startsWith(new URL(APP_SCOPE).pathname)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch (_) {
        // The shell fallback below keeps installed navigation usable offline.
      }
      return (await caches.match(APP_INDEX)) || Response.error();
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    return fetch(request);
  })());
});
