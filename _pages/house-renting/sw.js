---
permalink: /house-renting/sw.js
sitemap: false
---
/* Service worker for the /house-renting/ tool (scope: /house-renting/ only).
 * - pages: network first, cached copy offline (ad/?id=… reuses the cached page shell)
 * - data (index / notes / ad.json …): network first, cached copy offline
 * - scripts, styles, icons, photos, CDN files: cache first
 * - map tiles: cached as you browse, capped */
const VERSION = "{{ site.time | date: '%s' }}";
const SHELL = "house-shell-" + VERSION;
const DATA = "house-data";
const STATIC = "house-static";
const TILES = "house-tiles";
const MAX_TILES = 800;
const ROOT = "{{ '/house-renting/' | relative_url }}";
const ASSETS = "{{ '/assets/house-renting/' | relative_url }}";
const DB = "{{ '/assets/database/' | relative_url }}";
const V = "?v=" + VERSION;

const PRECACHE = [
  ROOT, ROOT + "ad/", ROOT + "compare/", ROOT + "notes/", ROOT + "triage/", ROOT + "score/",
  ASSETS + "house.css" + V, ASSETS + "common.js" + V,
  ASSETS + "list.js" + V, ASSETS + "detail.js" + V, ASSETS + "compare.js" + V, ASSETS + "notes.js" + V, ASSETS + "triage.js" + V, ASSETS + "score.js" + V, ASSETS + "score-engine.js" + V,
  ASSETS + "photos.json" + V, ASSETS + "rail.json" + V,
  DB + "index.json", "{{ '/assets/notes.json' | relative_url }}",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("house-shell-") && k !== SHELL).map((k) => caches.delete(k)));
      // Drop scripts / styles of older deploys (they carry ?v=<build time>).
      const stat = await caches.open(STATIC);
      for (const r of await stat.keys()) {
        const v = new URL(r.url).searchParams.get("v");
        if (v && v !== VERSION) await stat.delete(r);
      }
      await self.clients.claim();
    })()
  );
});

async function networkFirst(req, cacheName, matchOpts) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(req, matchOpts)) || (await caches.match(req, matchOpts));
    if (hit) return hit;
    throw e;
  }
}
async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") (await caches.open(cacheName)).put(req, res.clone());
  return res;
}
async function tile(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) cache.delete(k);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    // Page HTML never depends on the query string (?id=…, filters), so offline any variant works.
    event.respondWith(networkFirst(req, SHELL, { ignoreSearch: true }));
    return;
  }
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(tile(req));
    return;
  }
  if (url.origin === location.origin) {
    if (url.pathname.endsWith(".json") || url.pathname.endsWith(".webmanifest")) event.respondWith(networkFirst(req, DATA));
    else if (url.pathname.startsWith(DB) || url.pathname.startsWith(ASSETS)) event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  // Leaflet, fonts, sahibinden's large photos.
  if (/(^|\.)(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|shbdn\.com)$/.test(url.hostname)) event.respondWith(cacheFirst(req, STATIC));
});
