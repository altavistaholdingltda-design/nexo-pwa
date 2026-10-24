'use strict';

const RELEASE = '05c8ef4108d108a2feffde03916d2fdd50f9159d';
const CORE_FILES = /* NEXO_CORE_START */ ["assets/AssetManifest.bin", "assets/AssetManifest.bin.json", "assets/FontManifest.json", "assets/assets/fonts/Lato-Bold.ttf", "assets/assets/fonts/Lato-BoldItalic.ttf", "assets/assets/fonts/Lato-Italic.ttf", "assets/assets/fonts/Lato-Regular.ttf", "assets/fonts/MaterialIcons-Regular.otf", "assets/packages/cupertino_icons/assets/CupertinoIcons.ttf", "favicon.png", "flutter_bootstrap.05c8ef4108d108a2feffde03916d2fdd50f9159d.js", "icons/Icon-192.png", "icons/Icon-512.png", "icons/Icon-maskable-512.png", "icons/nexo-mark.svg", "index.html", "main.05c8ef4108d108a2feffde03916d2fdd50f9159d.dart.js", "main.dart.js_1.05c8ef4108d108a2feffde03916d2fdd50f9159d.part.js", "manifest.json", "nexo_practice.05c8ef4108d108a2feffde03916d2fdd50f9159d.js", "nexo_pwa.05c8ef4108d108a2feffde03916d2fdd50f9159d.js", "offline.html"] /* NEXO_CORE_END */;
const RENDERER_FILES = /* NEXO_RENDERERS_START */ {"full": ["canvaskit/canvaskit.js", "canvaskit/canvaskit.wasm"], "chromium": ["canvaskit/chromium/canvaskit.js", "canvaskit/chromium/canvaskit.wasm"], "webparagraph": ["canvaskit/webparagraph/canvaskit.js", "canvaskit/webparagraph/canvaskit.wasm"]} /* NEXO_RENDERERS_END */;
const SCOPE = new URL(self.registration.scope);
const renderer = new URL(self.location.href).searchParams.get('renderer') || 'full';
const CACHE_PREFIX = 'nexo-static-v1:' + SCOPE.pathname + ':';
const CACHE_NAME = CACHE_PREFIX + RELEASE + ':' + renderer;
const INDEX_URL = new URL('index.html', SCOPE).href;
const OFFLINE_URL = new URL('offline.html', SCOPE).href;

function publicStaticUrl(value) {
  let url;
  try { url = new URL(value, SCOPE); } catch (_) { return null; }
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return null;
  if ([...url.searchParams].some(([key, val]) => key !== 'v' || !/^[a-z0-9_-]+$/i.test(val))) return null;
  const path = url.pathname.slice(SCOPE.pathname.length);
  const rootFile = /^(?:flutter(?:_bootstrap)?(?:\.[a-f0-9]{7,40})?\.js|main(?:\.[a-f0-9]{7,40})?\.dart\.js|main\.dart\.js_\d+(?:\.[a-f0-9]{7,40})?\.part\.js|nexo_pwa(?:\.[a-f0-9]{7,40})?\.js|nexo_practice(?:\.[a-f0-9]{7,40})?\.js|manifest\.json|version\.json|favicon\.png|index\.html|offline\.html)$/;
  const assetFile = /^(?:assets|canvaskit|icons)\/[a-z0-9_./@+-]+\.(?:js|wasm|json|bin|png|jpe?g|webp|gif|svg|ttf|otf|woff2?|frag|mp3|ogg|wav|zip|txt)$/i;
  if (!rootFile.test(path) && !assetFile.test(path)) return null;
  return url.href;
}

function trustedClient(event) {
  if (!event.source || !event.source.url) return false;
  try {
    const url = new URL(event.source.url);
    return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
  } catch (_) { return false; }
}

function cacheable(response) {
  return response.ok && !response.redirected &&
    (response.type === 'basic' || response.type === 'default') &&
    !/\b(?:private|no-store)\b/i.test(response.headers.get('cache-control') || '');
}

async function cacheStatic(url, cache, mandatory) {
  const response = await fetch(new Request(url, {
    credentials: 'omit',
    // Revalidate mutable assets for each release. A new CacheStorage bucket
    // must not inherit stale fonts, manifests or lessons from the HTTP cache.
    cache: /[./][a-f0-9]{7,40}[./]/.test(new URL(url).pathname) ? 'default' : 'no-cache',
  }));
  if (!cacheable(response)) {
    if (mandatory) throw new Error('NEXO offline asset unavailable');
    return response;
  }
  if (url === INDEX_URL) {
    const html = await response.clone().text();
    if (!html.includes('name="nexo-release" content="' + RELEASE + '"')) {
      throw new Error('NEXO release changed during installation');
    }
  }
  await cache.put(url, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const existed = (await caches.keys()).includes(CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);
    try {
      const selectedRenderer = RENDERER_FILES[renderer] || RENDERER_FILES.full || [];
      const files = [...new Set([...CORE_FILES, ...selectedRenderer])]
        .map((path) => publicStaticUrl(path));
      if (!files.length || files.some((url) => !url)) throw new Error('Invalid offline asset list');
      // Registration starts after the first frame; recently loaded assets can
      // be reused from the HTTP cache instead of delaying the application.
      await Promise.all(files.map((url) => cacheStatic(url, cache, true)));
      if (!self.registration.active) await self.skipWaiting();
    } catch (_) {
      if (!existed) await caches.delete(CACHE_NAME);
      throw new Error('NEXO offline installation incomplete');
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const previous = (await caches.keys()).filter((name) =>
      name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME);
    const keep = new Set([CACHE_NAME, ...previous.slice(-2)]);
    await Promise.all(previous.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (!trustedClient(event)) return;
  if (event.data?.type === 'NEXO_ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === 'NEXO_WARM_STATIC' && Array.isArray(event.data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const urls = [...new Set(event.data.urls.slice(0, 150)
        .filter((value) => typeof value === 'string' && value.length < 2048)
        .map(publicStaticUrl).filter(Boolean))];
      await Promise.all(urls.map(async (url) => {
        if (!await cache.match(url)) await cacheStatic(url, cache, false).catch(() => {});
      }));
    })());
  }
});

async function navigate(request) {
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Navigation timeout')), 6000);
    });
    // Never store navigation URLs: OAuth redirects can contain private codes.
    return await Promise.race([fetch(request), timeout]);
  } catch (_) {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(INDEX_URL) || await cache.match(OFFLINE_URL) ||
      new Response('Sem conexão. Reconecte-se e abra o NEXO novamente.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
  } finally {
    clearTimeout(timer);
  }
}

async function staticResponse(url) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) return cached;
  // Existing tabs may still request an immutable module from a prior release.
  if (/[./][a-f0-9]{7,40}[./]/.test(new URL(url).pathname)) {
    for (const name of await caches.keys()) {
      if (!name.startsWith(CACHE_PREFIX) || name === CACHE_NAME) continue;
      const previous = await (await caches.open(name)).match(url);
      if (previous) return previous;
    }
  }
  return cacheStatic(url, cache, false);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  const file = publicStaticUrl(request.url);
  if (file) event.respondWith(staticResponse(file));
});

