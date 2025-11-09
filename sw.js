// sw.js

const CACHE_NAME = 'taskflow-cache-v1';

// Los archivos que quieres guardar en caché para que la app funcione offline.
// ¡RUTAS CORREGIDAS!
const urlsToCache = [
  '.',
  'index.html',
  'app.js',
  'manifest.json',
  'images/icono-192.png', // Asegúrate de tener este ícono o actualiza la ruta
  'images/icono-512.png'  // Asegúrate de tener este ícono o actualiza la ruta
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