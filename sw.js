const SHELL_CACHE = "planner-shell-20260906d";
const TILE_CACHE = "planner-map-tiles";
const SHELL_FILES = [
  "/cpyc-race-tonight/",
  "/cpyc-race-tonight/index.html",
  "/cpyc-race-tonight/registerSW.js",
  "/cpyc-race-tonight/plan-offline.js?v=20260906d",
  "/cpyc-race-tonight/assets/index-D0jg6nnc.js",
  "/cpyc-race-tonight/assets/index-BbG0sm9Y.css",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(SHELL_FILES.map((url) =>
        fetch(url, { cache: "reload" }).then((response) => {
          if (response.ok) return cache.put(url, response);
        }),
      )),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names
        .filter((name) =>
          (name.startsWith("workbox-precache") || name.startsWith("planner-shell-")) &&
          name !== SHELL_CACHE,
        )
        .map((name) => caches.delete(name))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isTile =
    url.hostname === "tile.openstreetmap.org" ||
    url.hostname === "tiles.openseamap.org" ||
    url.hostname === "gis.charttools.noaa.gov";

  if (isTile) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok || response.type === "opaque") cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "reload" })
        .then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put("/cpyc-race-tonight/index.html", response.clone()));
          return response;
        })
        .catch(() => caches.match("/cpyc-race-tonight/index.html")),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(fetch(event.request, { cache: "reload" }).catch(() => caches.match(event.request)));
  }
});
