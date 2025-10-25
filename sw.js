// sw.js

// El nombre de tu caché
const CACHE_NAME = 'taskflow-cache-v1';

// Los archivos que quieres guardar en caché para que la app funcione offline.
// ¡Asegúrate de que las rutas sean correctas!
const urlsToCache = [
  '/',
  '/index.html',
  // Agrega aquí tu CSS, JS e íconos principales
  // Ejemplo: '/style.css',
  // Ejemplo: '/app.js',
  // Ejemplo: '/iconos/icono-192.png'
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