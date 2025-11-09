// sw.js

const CACHE_NAME = 'taskflow-cache-v1';

// ¡RUTAS CORREGIDAS!
// Tu sw.js está en la raíz, pero tus archivos están en 'TaskFlow'
const urlsToCache = [
  'TaskFlow/',
  'TaskFlow/index.html',
  'TaskFlow/app.js',
  'TaskFlow/manifest.json',
  // Asumo que tus imágenes están en TaskFlow/images/
  'TaskFlow/images/icono-192.png',
  'TaskFlow/images/icono-512.png'
];

// Evento "install": Se dispara cuando el Service Worker se instala.
self.addEventListener('install', event => {
  // Espera a que la promesa de "abrir caché" y "agregar todo" se complete.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        // Agrega todos nuestros archivos al caché
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Falló el cache.addAll() - revisa las rutas en urlsToCache: ', err);
      })
  );
});

// Evento "fetch": Se dispara CADA VEZ que la app pide un recurso (CSS, JS, imagen, etc.)
self.addEventListener('fetch', event => {
  event.respondWith(
    // Revisa si la petición ya está en nuestro caché
    caches.match(event.request)
      .then(response => {
        // Si está en caché, devuelve la respuesta del caché
        if (response) {
          return response;
        }
        
        // Si NO está en caché, ve a la red a buscarlo
        return fetch(event.request);
      })
  );
});