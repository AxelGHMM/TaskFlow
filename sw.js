// sw.js

const CACHE_NAME = 'taskflow-cache-v1';

// ¡RUTAS CORREGIDAS!
// Estas rutas son relativas AL ARCHIVO sw.js
const urlsToCache = [
  '.',
  'index.html',
  'app.js',
  'manifest.json',
  'images/icons/icono-192.png', // Asumo que esta es la ruta correcta
  'images/icons/icono-512.png'  // Asumo que esta es la ruta correcta
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Falló el cache.addAll() - revisa las rutas en urlsToCache: ', err);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});