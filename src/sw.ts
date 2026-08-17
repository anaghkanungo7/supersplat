import { version as appVersion } from '../package.json';

// export default null
declare let self: ServiceWorkerGlobalScope;

const cacheName = `svg-genie-splat-studio-v${appVersion}`;

const cacheUrls = [
    './',
    './index.css',
    './index.html',
    './index.js',
    './manifest.json',
    './static/icons/svg-genie.svg',
    './static/lib/webp/webp.mjs',
    './static/lib/webp/webp.wasm',
    './static/locales/de.json',
    './static/locales/en.json',
    './static/locales/es.json',
    './static/locales/fr.json',
    './static/locales/ja.json',
    './static/locales/ko.json',
    './static/locales/pt-BR.json',
    './static/locales/ru.json',
    './static/locales/zh-CN.json'
];

self.addEventListener('install', (event) => {
    console.log(`installing v${appVersion}`);

    event.waitUntil(
        caches.open(cacheName)
        .then(cache => cache.addAll(cacheUrls))
        .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log(`activating v${appVersion}`);

    event.waitUntil(
        caches.keys()
        .then(names => Promise.all(names
        .filter(name => name.startsWith('svg-genie-splat-studio-') && name !== cacheName)
        .map(name => caches.delete(name))))
        .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    const fetchAndCache = async () => {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, response.clone());
        }
        return response;
    };

    if (request.mode === 'navigate') {
        event.respondWith(
            fetchAndCache().catch(async () => {
                return (await caches.match(request)) ??
                    (await caches.match('./index.html')) ??
                    Response.error();
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => cached ?? fetchAndCache())
    );
});
