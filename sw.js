// Level Up service worker — offline shell (PRD §2.2).
// Static assets are cached; Supabase API calls always go to the network.

var CACHE = "levelup-v16"; // bumped for progression ladders (BUILD-SPEC-progression-ladders.md)
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

// ---------------- Web Push (closed-app notifications) ----------------
// Payloads come from the send-reminders Edge Function as JSON:
//   { title, body, url }

self.addEventListener("push", function (e) {
  var data = { title: "Level Up", body: "Time for your daily flow.", url: "./" };
  try { data = Object.assign(data, e.data.json()); } catch (err) { /* keep defaults */ }
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      var visible = list.filter(function (c) { return c.visibilityState === "visible"; });
      // App already on screen: hand the payload to the page, which shows an
      // in-app toast. One reminder is always one signal — never a notification
      // stacked on top of the UI it's telling you to open. Browsers only allow
      // a silent push handler when a visible client exists, which is this case.
      if (visible.length) {
        visible.forEach(function (c) {
          c.postMessage({ type: "push", title: data.title, body: data.body, url: data.url });
        });
        return;
      }
      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: "icon.svg",
        badge: "icon.svg",
        data: { url: data.url }
      });
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) {
          // Focusing an existing window doesn't change its URL, so the deep
          // link has to travel as a message instead of a hash.
          list[i].postMessage({ type: "open", url: url });
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
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
