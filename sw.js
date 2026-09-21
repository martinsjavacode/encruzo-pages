/// <reference lib="webworker" />

const CACHE_NAME = 'encruzo-cache-v2'

// O SW é registrado com scope = BASE_URL (ex '/encruzo/' no GitHub Pages, '/' em dev).
// Derivamos o base do próprio escopo para cachear os caminhos certos sob qualquer base.
const BASE = new URL(self.registration.scope).pathname // termina em '/'

const STATIC_ASSETS = [BASE, BASE + 'index.html', BASE + 'manifest.json']

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return

  // Skip API requests (let them go to network)
  if (event.request.url.includes('/rest/') || event.request.url.includes('/auth/')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone()
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        
        return response
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }
          
          // If it's a navigation request, return the cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match(BASE + 'index.html')
          }
          
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
