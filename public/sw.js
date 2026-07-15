// Service worker mínimo: existe só para o navegador considerar o site instalável como app (PWA).
// Não faz cache agressivo de páginas, já que os dados do sistema mudam o tempo todo.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
