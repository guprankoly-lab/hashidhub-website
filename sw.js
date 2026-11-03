var CACHE = "hashidhub-v19";
var ASSETS = ["./index.html", "./manifest.json", "./icon.svg", "./firebase-config.js"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k !== CACHE) return caches.delete(k); }));
  }).then(function(){ self.clients.claim(); }));
});
function putCache(req, res){
  if(res && res.ok){ var clone = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, clone); }); }
  return res;
}
self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  if(url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/media/") === 0) return; // الوسائط لا تُخزَّن في SW
  if(req.url.indexOf("firestore") > -1 || req.url.indexOf("googleapis") > -1) return;
  if(url.origin !== location.origin) return; // CDN والوسائط: كاش المتصفح
  // الصفحة والسكربتات: الشبكة أولاً (تحديثات فورية) ثم الكاش دون اتصال
  if(req.mode === "navigate" || /\.(html|js|json)$/.test(url.pathname) || url.pathname === "/"){
    e.respondWith(fetch(req).then(function(res){ return putCache(req, res); }).catch(function(){
      return caches.match(req).then(function(m){ return m || caches.match("./index.html"); });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function(c){ return c || fetch(req).then(function(res){ return putCache(req, res); }); }));
});

self.addEventListener("push", function(event){
  var data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(e){ data = { title: event.data ? event.data.text() : "" }; }
  var d = data.data || {}, n = data.notification || {};
  var title = d.title || n.title || data.title || "HashidHub";
  var body = d.body || n.body || data.body || "لديك إشعار جديد";
  var isCall = d.type === "call";
  var opts = {
    body: body, icon: "icon.svg", badge: "icon.svg",
    tag: d.tag || d.type || "hh", renotify: true, dir: "rtl", lang: "ar",
    data: { url: d.url || "./", type: d.type || "" },
    requireInteraction: isCall,
    vibrate: isCall ? [400, 200, 400, 200, 400, 200, 400] : [120]
  };
  // إن كانت المنصة مفتوحة ومرئية فهي تتولى التنبيه بنفسها
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
    for(var i = 0; i < list.length; i++){ if(list[i].visibilityState === "visible") return; }
    return self.registration.showNotification(title, opts);
  }));
});
self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
    for(var i = 0; i < list.length; i++){ if(list[i].focus) return list[i].focus(); }
    if(clients.openWindow) return clients.openWindow(url);
  }));
});
