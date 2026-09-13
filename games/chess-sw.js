// Chess service worker: the game must open and be playable with no network.
// Network-first for the page itself so an edit is never masked by the cache (which also keeps the
// local test suite honest); cache-first for the static assets, which never change under their name.
const CACHE = 'chess-v1';
const CORE = [
  './chess.html',
  './chess.webmanifest',
  './assets/icons/chess-192.png',
  './assets/icons/chess-512.png',
  './chess-celebration.js', './chess-coach.js', './chess-personality.js', './chess-modes.js',
  './chess-sfx-bank.js', './chess-memes.js', './audio/memes/catalog.js',
  './audio/chess/manifest-natural.json',
  './assets/pieces/w_king.png', './assets/pieces/w_queen.png', './assets/pieces/w_rook.png',
  './assets/pieces/w_bishop.png', './assets/pieces/w_knight.png', './assets/pieces/w_pawn.png',
  './assets/pieces/b_king.png', './assets/pieces/b_queen.png', './assets/pieces/b_rook.png',
  './assets/pieces/b_bishop.png', './assets/pieces/b_knight.png', './assets/pieces/b_pawn.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // add individually so one missing file cannot fail the whole install
    await Promise.all(CORE.map(url => cache.add(url).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./chess.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match('./chess.html');
        return cached || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return Response.error();
    }
  })());
});
