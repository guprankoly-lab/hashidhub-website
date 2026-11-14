/* HashidHub PWA v3 — never cache /api, /media, Firestore; bump CACHE on deploys */
'use strict';

var CACHE = 'hashidhub-v3-r1';
var SHELL = ['./index.html', './manifest.json', './icon.svg', './firebase-config.js', './media-config.js'];
var MAX_ENTRIES = 60;

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(SHELL.map(function (asset) {
      return cache.add(asset).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.indexOf('hashidhub-') === 0 && key !== CACHE;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

function isSensitiveOrMedia(url) {
  return url.pathname.indexOf('/api/') === 0 ||
    url.pathname.indexOf('/media/') === 0 ||
    url.pathname.indexOf('/f/') === 0 ||
    /firestore|googleapis|video|blob/i.test(url.hostname + url.pathname);
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  // Never intercept non-GET (POST upload / AI) or media — Range requests stay native
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitiveOrMedia(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(function (response) {
      return response;
    }).catch(function () {
      return caches.match('./index.html');
    }));
    return;
  }

  if (!/\.(?:css|js|json|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname)) return;
  event.respondWith(caches.match(request).then(function (cached) {
    var net = fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (store) { store.put(request, copy); });
      }
      return response;
    }).catch(function () { return cached; });
    return cached || net;
  }));
});
