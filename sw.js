/*
 * Service worker: makes Movie Nights work as an installed app and offline.
 *
 *  - Pages, styles, scripts and data/library.js: always fetched fresh when
 *    online (so published changes show up straight away), with the saved copy
 *    used when there is no connection.
 *  - Icons and fonts from other sites: saved the first time they load.
 *  - Posters, TMDB / OMDb / YouTube: left to the browser. (Browsers count every
 *    saved image from another site as several MB, so saving posters here would
 *    quickly fill the phone's storage allowance; the normal browser cache
 *    already keeps them.)
 *
 * Bump VERSION when the list of app files below changes.
 */
const VERSION = "v143";
const APP_CACHE = `mn-app-${VERSION}`;

const APP_FILES = [
  "./",
  "index.html",
  "discover.html",
  "search.html",
  "movies.html",
  "tv-shows.html",
  "anime.html",
  "favorites.html",
  "watchlist.html",
  "tier-list.html",
  "box-office.html",
  "title.html",
  "person.html",
  "profile.html",
  "settings.html",
  "manifest.webmanifest",
  "css/style.css",
  "data/library.js",
  "js/config.js",
  "js/core/store.js",
  "js/core/cloud.js",
  "js/core/lang.js",
  "js/core/layout.js",
  "js/services/tmdb.js",
  "js/services/ratings.js",
  "js/services/watch.js",
  "js/services/taste.js",
  "js/services/facts.js",
  "js/components/cards.js",
  "js/components/add-title.js",
  "js/components/preview.js",
  "js/components/scrollbars.js",
  "js/components/picker.js",
  "js/components/import.js",
  "js/components/wrapped.js",
  "js/components/achievements.js",
  "js/components/trivia.js",
  "js/components/soundtrack.js",
  "js/pages/browse.js",
  "js/pages/home.js",
  "js/pages/discover.js",
  "js/pages/search.js",
  "js/pages/title.js",
  "js/pages/person.js",
  "js/pages/tier-list.js",
  "js/pages/box-office.js",
  "js/pages/profile.js",
  "js/pages/settings.js",
  "images/brand/logo.png",
  "images/brand/favicon.png",
  "images/placeholders/avatar-placeholder.svg",
  "images/placeholders/user.svg",
  "images/placeholders/poster-placeholder.svg",
  "images/icons/icon-192.png",
  "images/icons/icon-512.png",
  "images/icons/apple-touch-icon.png",
];

// hosts whose files never change once published: cache-first
// (www.gstatic.com: the Google sign-in library, a fixed version)
const STATIC_HOSTS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com", "www.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mn-app-") && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // everything else (TMDB API, OMDb, YouTube...) goes straight to the network
});

// fresh from the network, saved copy when offline
async function networkFirst(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    // title.html?id=... etc: any saved copy of the page will do
    const saved = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
    if (saved) return saved;
    if (req.mode === "navigate") return cache.match("index.html");
    throw e;
  }
}

// saved copy if we have one, otherwise fetch and save it
async function cacheFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const saved = await cache.match(req);
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
