/* Waddl - offline support */
const CACHE = 'waddl-v3', TILES = 'lilypond-tiles-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'transit_data.js', 'airport_data.js', 'hotel_data.js', 'location.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const WAIT_MS = 1200;   // on a weak signal, use the saved copy after this long so the app still opens fast

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cache, max) { const ks = await cache.keys(); if (ks.length > max) await cache.delete(ks[0]); }
const saved = req => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));

// Network first so your updates arrive, but never make the traveller wait: fall back to the saved copy after WAIT_MS.
function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(async () => { const hit = await saved(req); if (hit) finish(hit); }, WAIT_MS);
    fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      clearTimeout(timer); finish(r);
    }).catch(async () => { clearTimeout(timer); finish((await saved(req)) || Response.error()); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const host = new URL(req.url).hostname;
  // Live data is never cached by the worker (the app keeps its own copy)
  if (host.endsWith('firestore.googleapis.com') || host.includes('open-meteo.com') || host.includes('nominatim') || host.includes('photon.komoot') || host.includes('frankfurter')) return;
  // Map tiles: keep the ones you have already looked at
  if (host.endsWith('tile.openstreetmap.org')) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); trim(c, 400); return r; } catch (err) { return Response.error(); }
    }));
    return;
  }
  e.respondWith(networkFirst(req));
});
