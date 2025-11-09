// sw.js

const CACHE_NAME = 'taskflow-cache-v1';
const OFFLINE_PAGE = 'offline.html';

// Asegúrate de que 'offline.html' esté en la lista
const urlsToCache = [
  '.',
  'index.html',
  'app.js',
  'manifest.json',
  'images/icons/icono-192.png', // Asegúrate de que esta ruta sea correcta
  'images/icons/icono-512.png',  // Asegúrate de que esta ruta sea correcta
  OFFLINE_PAGE
];

// Evento "install" (sin cambios, solo se asegura de cachear todo)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Falló el cache.addAll(): ', err);
      })
  );
});

// Evento "fetch" (¡MODIFICADO!)
self.addEventListener('fetch', event => {
  
  // Estrategia: "Network-First" (Red primero) solo para la página principal
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // 1. Intenta ir a la red (Internet)
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // 2. Si la red falla (sin WiFi), muestra la página offline
          console.log('Fetch falló; sirviendo página offline desde caché.');
          const cache = await caches.open(CACHE_NAME);
          return await cache.match(OFFLINE_PAGE);
        }
      })()
    );
    return; // Importante: salimos aquí
  }

  // Estrategia: "Cache-First" (Caché primero) para todo lo demás
  // (app.js, manifest.json, imágenes, etc.)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve desde el caché o (si no está) ve a la red
        return response || fetch(event.request);
      })
  );
});