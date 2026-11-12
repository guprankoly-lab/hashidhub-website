/* HashidHub PWA worker: bounded, same-origin shell cache; never cache APIs, auth, Firestore, or media. */
'use strict';

var CACHE = 'hashidhub-v23';
var SHELL = ['./index.html', './manifest.json', './icon.svg', './firebase-config.js', './media-config.js'];
var MAX_ENTRIES = 80;

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    // A single missing/temporarily unavailable asset must not prevent the worker install.
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
  return url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/media/') === 0 ||
    url.pathname.indexOf('/f/') === 0 || /firestore|googleapis/i.test(url.hostname);
}

function cacheSuccessful(cache, request, response) {
  if (!response || !response.ok || response.type === 'opaque') return response;
  return caches.open(CACHE).then(function (store) {
    return store.put(request, response.clone()).then(function () {
      return store.keys().then(function (keys) {
        if (keys.length <= MAX_ENTRIES) return;
        return Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map(function (key) {
          return store.delete(key);
        }));
      });
    }).then(function () { return response; });
  }).catch(function () { return response; });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitiveOrMedia(url)) return;

  // Navigation stays network-first so deployments become visible immediately.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(function (response) {
      return cacheSuccessful(CACHE, request, response);
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match(new URL('./index.html', self.location.href).href);
      });
    }));
    return;
  }

  // Only immutable-looking static assets are cache-first. Other same-origin GETs
  // are not cached to avoid retaining private or rapidly changing responses.
  if (!/\.(?:css|js|json|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname)) return;
  event.respondWith(caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      return cacheSuccessful(CACHE, request, response);
    });
  }));
});

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    data = { title: event.data ? event.data.text() : '' };
  }
  var payload = data.data || {}, notification = data.notification || {};
  var title = String(payload.title || notification.title || data.title || 'HashidHub').slice(0, 100);
  var body = String(payload.body || notification.body || data.body || 'لديك إشعار جديد').slice(0, 300);
  var path = String(payload.url || './');
  // Notifications can only navigate to this origin; reject arbitrary external URLs.
  var safeUrl = './';
  try {
    var parsed = new URL(path, self.location.origin);
    if (parsed.origin === self.location.origin) safeUrl = parsed.pathname + parsed.search + parsed.hash;
  } catch (_) {}
  var isCall = payload.type === 'call';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].visibilityState === 'visible') return;
    }
    return self.registration.showNotification(title, {
      body: body, icon: './icon.svg', badge: './icon.svg',
      tag: String(payload.tag || payload.type || 'hh').slice(0, 80),
      renotify: isCall, dir: 'rtl', lang: 'ar', data: { url: safeUrl, type: payload.type || '' },
      requireInteraction: isCall, vibrate: isCall ? [400, 200, 400] : [120]
    });
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.location.origin) === 0) {
        return list[i].focus().then(function (client) {
          if (client && 'navigate' in client) return client.navigate(target);
          return client;
        });
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});
