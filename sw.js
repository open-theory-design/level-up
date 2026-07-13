// Level Up service worker — offline shell (PRD §2.2).
// Static assets are cached; Supabase API calls always go to the network.

var CACHE = "levelup-v5";
var ASSETS = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.json",
  "./icon.svg",
  "./css/styles.css",
  "./js/streak.js",
  "./js/exercises.js",
  "./js/illustrations-color.js",
  "./js/badges.js",
  "./js/store.js",
  "./js/app.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return; // CDN / Supabase go straight to network

  // Network-first: always try to serve the freshest file so app updates are
  // picked up immediately. The cache is refreshed on every success and used
  // only as an offline fallback (keeps the PWA working with no connection).
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
