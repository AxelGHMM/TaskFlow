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
  'images/icons/icono-512.png',
  'offline.html'  // Asumo que esta es la ruta correcta
];
// Evento "install"
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

// Evento "fetch" (MODIFICADO)
self.addEventListener('fetch', event => {
  event.respondWith(
    // 1. Intenta buscar en el caché primero
    caches.match(event.request)
      .then(response => {
        // Si está en caché, devuelve la respuesta del caché
        if (response) {
          return response;
        }
        
        // 2. Si NO está en caché, ve a la red a buscarlo
        return fetch(event.request)
          .catch(() => {
            // 3. SI EL FETCH FALLA (sin red), muestra la página offline
            return caches.match('offline.html');
          });
      })
  );
});