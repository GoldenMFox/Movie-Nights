/*
 * Service worker: makes Movie Nights work as an installed app and offline.
 *
 *  - Pages, styles, scripts and data/library.js: always fetched fresh when
 *    online (so published changes show up straight away), with the saved copy
 *    used when there is no connection.
 *  - Icons and fonts from other sites: saved the first time they load.
 *  - Notifications (js/services/alerts.js): a tap opens the title; on Android's installed app
 *    the browser may also wake this worker now and then ("mn-alerts", Periodic Background
 *    Sync) to check for releases with the page's snapshot and show them while the site is closed.
 *  - Posters, TMDB / OMDb / YouTube: left to the browser. (Browsers count every
 *    saved image from another site as several MB, so saving posters here would
 *    quickly fill the phone's storage allowance; the normal browser cache
 *    already keeps them.)
 *
 * Bump VERSION when the list of app files below changes.
 */
const VERSION = "v199";
const APP_CACHE = `mn-app-${VERSION}`;

const APP_FILES = [
  "./",
  "index.html",
  "discover.html",
  "movies-explore.html",
  "tv-explore.html",
  "search.html",
  "movies.html",
  "tv-shows.html",
  "anime.html",
  "favorites.html",
  "watchlist.html",
  "tier-list.html",
  "box-office.html",
  "title.html",
  "share.html",
  "s/index.html",
  "person.html",
  "profile.html",
  "settings.html",
  "news.html",
  "anime-explore.html",
  "admin.html",
  "manifest.webmanifest",
  "css/style.css",
  "data/library.js",
  "js/config.js",
  "js/core/store.js",
  "js/core/cloud.js",
  "js/core/site.js",
  "js/core/lang.js",
  "js/core/layout.js",
  "js/services/api.js",
  "js/services/tmdb.js",
  "js/services/tvmaze.js",
  "js/services/anime.js",
  "js/services/books.js",
  "js/services/news.js",
  "js/services/alerts.js",
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
  "js/components/share.js",
  "js/components/list-themes.js",
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
  "js/pages/news.js",
  "js/pages/anime-explore.js",
  "js/pages/admin.js",
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

// fresh from the network, saved copy when offline. ("no-cache": the browser asks the site
// whether its copy is still current, every time. Without it, GitHub Pages lets browsers reuse a
// file for 10 minutes, so right after a publish a page could get the new script with the old
// styles.)
async function networkFirst(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(req, { cache: "no-cache" });
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

/* ---------------- notifications (js/services/alerts.js) ---------------- */

// a tap on a notification: the title's page (in the open app / tab when there is one)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "./", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) return open.navigate(url).then((c) => (c || open).focus()).catch(() => open.focus());
      return self.clients.openWindow(url);
    })
  );
});

// Android's installed app: now and then (the phone decides when, about twice a day at most) the
// browser wakes this worker to look for releases, with the snapshot the page left
// ("alerts-snapshot": the titles to watch, what was already shown, your choices). What it shows
// is left in "alerts-shown" for the page to pick up next time.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "mn-alerts") event.waitUntil(checkReleases());
});

async function checkReleases() {
  const box = await caches.open("mn-alerts");
  const r = await box.match("alerts-snapshot");
  if (!r) return;
  const snap = await r.json();
  if (!snap.on || !snap.key || !snap.items || !snap.items.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const shown = new Set(snap.shown || []);
  const prev = await box.match("alerts-shown");
  const out = prev ? await prev.json() : [];
  out.forEach((a) => shown.add(a.key));
  const tmdb = (path) => fetch(`https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(snap.key)}`).then((x) => (x.ok ? x.json() : null));
  for (const item of snap.items.slice(0, 40)) {
    try {
      const [media, id] = item.ref.split("-");
      let alert = null;
      if (media === "movie") {
        const d = await tmdb(`/movie/${id}/release_dates`);
        const entry = ((d && d.results) || []).find((x) => x.iso_3166_1 === snap.country);
        const local = entry ? entry.release_dates.filter((x) => (x.type === 2 || x.type === 3) && x.release_date).map((x) => x.release_date.slice(0, 10)).sort()[0] : "";
        let date = local;
        if (!date) {
          const m = await tmdb(`/movie/${id}`);
          date = (m && m.release_date) || "";
        }
        if (date === today && snap.kinds.release) alert = { kind: "release", date, title: `${item.title} is out`, body: "Out today: it's on your Watchlist." };
      } else {
        const d = await tmdb(`/tv/${id}`);
        const e = d && [d.next_episode_to_air, d.last_episode_to_air].find((x) => x && x.air_date === today);
        if (e) {
          const kind = e.episode_number === 1 ? "season" : "episode";
          if (snap.kinds[kind])
            alert = {
              kind,
              date: today,
              season: e.season_number,
              episode: e.episode_number,
              title: kind === "season" ? `${item.title}: Season ${e.season_number}` : `${item.title}: S${e.season_number} E${e.episode_number}`,
              body: kind === "season" ? "The new season starts today." : "A new episode is out today.",
            };
        }
      }
      if (!alert) continue;
      const key = `${item.ref}|${alert.kind}|${alert.date}|${alert.season || (alert.kind === "release" ? 1 : "")}-${alert.episode || (alert.kind === "release" ? 1 : "")}`;
      if (shown.has(key)) continue;
      shown.add(key);
      await self.registration.showNotification(alert.title, {
        body: alert.body,
        tag: key,
        icon: item.poster ? `https://image.tmdb.org/t/p/w185${item.poster}` : "images/icons/icon-192.png",
        badge: "images/icons/icon-192.png",
        data: { url: item.url || `title.html?tmdb=${item.ref}` },
      });
      out.push({ key, ref: item.ref, title: item.title, poster: item.poster, kind: alert.kind, date: alert.date, season: alert.season || null, episode: alert.episode || null, id: null });
    } catch (e) {
      // offline or TMDB busy: next time
    }
  }
  await box.put("alerts-shown", new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } }));
}
