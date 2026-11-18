/* BlindChess service worker: rende l'app installabile e disponibile offline. */
// Aggiorna il numero di versione a ogni modifica dell'app: così i dispositivi
// che hanno già installato la PWA scaricano i file nuovi invece della vecchia cache.
const CACHE_NAME = 'blindchess-v3';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './src/board.js',
  './src/engine.js',
  './src/move-parser.js',
  './src/notation.js',
  './src/speech.js',
  './src/storage.js',
  './vendor/chess.js',
  './vendor/stockfish/stockfish-17.1-lite-single-03e3232.js',
  './vendor/stockfish/stockfish-17.1-lite-single-03e3232.wasm',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/cover.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => console.error('BlindChess: cache install failed', error))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
