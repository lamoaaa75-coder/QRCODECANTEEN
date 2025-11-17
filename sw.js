// Service Worker pour KRAKEN Pointage Cantine
// Permet le fonctionnement 100% offline

const CACHE_NAME = 'kraken-cantine-v1';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './manifest.json'
];

// Installation - Mise en cache des ressources
self.addEventListener('install', event => {
    console.log('[SW] Installation...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cache ouvert');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[SW] Ressources mises en cache');
                return self.skipWaiting();
            })
    );
});

// Activation - Nettoyage des anciens caches
self.addEventListener('activate', event => {
    console.log('[SW] Activation...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Suppression ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Activation terminée');
            return self.clients.claim();
        })
    );
});

// Fetch - Stratégie Cache First (offline-first)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retourner du cache si disponible
                if (response) {
                    return response;
                }

                // Sinon, faire la requête réseau
                return fetch(event.request).then(response => {
                    // Ne pas mettre en cache si réponse invalide
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Cloner la réponse
                    const responseToCache = response.clone();

                    // Mettre en cache pour les prochaines fois
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
            .catch(() => {
                // En cas d'erreur réseau, retourner index.html si c'est une navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});
