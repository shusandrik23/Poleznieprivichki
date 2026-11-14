// Офлайн-режим: всё приложение кладётся в кэш при первом открытии
const CACHE = 'kompas-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/speech.js', 'js/feelings.js', 'js/techniques.js', 'js/engine.js',
  'js/canvas.js', 'js/timeline.js', 'js/burn.js', 'js/beliefs.js', 'js/course.js', 'js/remind.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Сначала сеть (чтобы обновления приходили), без сети — кэш
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = './' + (e.notification.data?.url || '');
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { c.focus(); c.navigate(url); return; }
    return self.clients.openWindow(url);
  }));
});
