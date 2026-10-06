/*
 * Alerts: your notifications. The bell in the navbar lists them (with the number of unread ones),
 * and they can also show as notifications on your devices.
 *
 * Kinds (TYPES below: each says its icon, its words and where it leads). A new kind = one more
 * entry in TYPES, and something that calls Alerts.add() with it:
 *   release         a movie on your Watchlist (or one you asked to be reminded of) comes out
 *   season          a show you follow starts a new season (its episode 1)
 *   episode         a new episode of a show you follow
 *   recommendation  once a week: a well-known title like one you loved ("Because you loved Dune")
 *   announcement    the site owner's message to everyone (Admin → Notifications)
 *   breaking        an important story that's just broken (Movie News: js/services/news.js)
 *   trailer         a new trailer for a title on your Watchlist (Movie News)
 * The first three come from what js/services/watch.js already looks up once a day.
 *
 * Each is kept with your profile (so it follows you to your other devices), as
 *   { key, kind, ref, id, title, poster, date, season, episode, extra, read, notified, at }
 * and dropped a month later. The key says what it is and when, so it's never made twice.
 *
 * Read / unread: opening the bell marks what it shows as read (the number goes away); each one has
 * its own ✕, and "Clear all" empties the list.
 *
 * Notifications (Settings → Notifications, after the browser asks you): a new alert also shows as a
 * notification on this device, once (notified), for the kinds you picked. On Android's installed app
 * the phone can also check in the background now and then (Periodic Background Sync, sw.js), so a
 * release can arrive while the app is closed; elsewhere they come when you open the site. The
 * installed app's icon carries the unread number too, where the phone supports it.
 */
(function () {
  const DAY = 86400000;
  const KEEP = 30 * DAY; // an alert is kept a month
  const RECENT = 7; // something out in the last week still makes an alert
  const PREFS = "mn:notify"; // this device: { on, release, season, episode, recommendation }
  const listeners = [];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------------- the kinds ---------------- */

  const today = () => Store.today();
  const libOrTmdb = (a) => (a.id && Store.get(a.id) ? `title.html?id=${encodeURIComponent(a.id)}` : `title.html?tmdb=${encodeURIComponent(a.ref)}`);
  const TYPES = {
    release: {
      icon: "fa-film",
      label: "Movie releases",
      words: (a) => ({ title: `${a.title} is out`, body: a.date === today() ? "Out today: it's on your Watchlist." : "Now out: it's on your Watchlist." }),
      href: libOrTmdb,
    },
    season: {
      icon: "fa-layer-group",
      label: "New seasons",
      words: (a) => ({ title: `${a.title}: Season ${a.season || 1}`, body: a.date === today() ? "The new season starts today." : "The new season has started." }),
      href: libOrTmdb,
    },
    episode: {
      icon: "fa-tv",
      label: "New episodes",
      words: (a) => ({ title: `${a.title}: S${a.season} E${a.episode}`, body: a.date === today() ? "A new episode is out today." : "A new episode is out." }),
      href: (a) => `${libOrTmdb(a)}&ep=${a.season}-${a.episode}`,
    },
    recommendation: {
      icon: "fa-wand-magic-sparkles",
      label: "Recommendations",
      words: (a) => ({ title: `You might like ${a.title}`, body: a.extra && a.extra.because ? `Because you loved ${a.extra.because}.` : "Picked for you." }),
      href: (a) => `title.html?tmdb=${encodeURIComponent(a.ref)}`,
    },
    // Movie News (js/services/news.js): only what's important, never every story
    breaking: {
      icon: "fa-bolt",
      label: "Breaking news",
      words: (a) => ({ title: `Breaking: ${a.title}`, body: (a.extra && a.extra.source) || "Movie News" }),
      href: (a) => (a.extra && /^https:\/\//.test(a.extra.link || "") ? a.extra.link : "news.html?cat=breaking"),
    },
    trailer: {
      icon: "fa-play",
      label: "New trailers",
      words: (a) => ({ title: `New trailer: ${a.title}`, body: (a.extra && a.extra.headline) || "It's on your Watchlist." }),
      href: (a) => (a.extra && /^https:\/\//.test(a.extra.link || "") ? a.extra.link : "news.html?cat=trailers"),
    },
    // from the site's owner (Admin → Notifications → Announcement)
    announcement: {
      icon: "fa-bullhorn",
      label: "Announcements",
      words: (a) => ({ title: a.title, body: (a.extra && a.extra.text) || "" }),
      href: (a) => (a.extra && /^(https:\/\/|[\w-]+\.html)/.test(a.extra.link || "") ? a.extra.link : "#"),
    },
  };
  const typeOf = (a) => TYPES[a.kind] || { icon: "fa-bell", words: (x) => ({ title: x.title, body: "" }), href: () => "#" };
  const words = (a) => typeOf(a).words(a);
  const href = (a) => typeOf(a).href(a);

  // the owner can turn a kind (or all of them) off for everyone (Admin → Notifications)
  const site = (k) => !window.Site || Site.get().notifications[k] !== false;
  const enabled = () => !Store.guest && (!window.Site || (Site.feature("notifications") && site("on")));

  /* ---------------- the list ---------------- */

  const all = () => (Store.getProfile().alerts || []).filter((a) => a && a.key && Date.now() - (a.at || 0) < KEEP && site(a.kind) !== false);
  function save(list) {
    Store.setProfile({ alerts: list.slice(-40) });
    listeners.forEach((fn) => fn());
    paint();
    if (panelEl) renderPanel();
  }
  const unread = () => all().filter((a) => !a.read);

  function markRead(keys) {
    const list = all();
    let changed = false;
    list.forEach((a) => {
      if (!a.read && (!keys || keys.includes(a.key))) {
        a.read = true;
        changed = true;
      }
    });
    if (changed) save(list);
  }
  const dismiss = (key) => save(all().filter((a) => a.key !== key));
  const clear = () => save([]);

  // add new alerts (any kind): the ones not had before; returns the new ones
  function add(items) {
    if (!enabled()) return [];
    const list = all();
    const have = new Set(list.map((a) => a.key));
    const fresh = items.filter((a) => a && a.key && TYPES[a.kind] && !have.has(a.key) && have.add(a.key));
    if (!fresh.length) return [];
    fresh.forEach((a) => Object.assign(a, { read: false, notified: false, at: a.at || Date.now() }));
    save(list.concat(fresh));
    notify(fresh);
    return fresh;
  }

  /* ---------------- finding new ones: releases, seasons, episodes ---------------- */

  const daysAgo = (date) => Math.round((new Date(`${today()}T00:00:00`) - new Date(`${date}T00:00:00`)) / DAY);
  const fresh = (date) => !!date && date <= today() && daysAgo(date) <= RECENT;

  function scan() {
    if (!enabled() || !window.Watch) return 0;
    const found = [];
    Watch.candidates(Store.all()).forEach((item) => {
      const v = Watch.nextOf(item);
      const ref = Watch.knownRef(item);
      if (!v || !ref) return;
      const base = { ref, id: item.id || null, title: Lang.title(item), poster: Cards.posterOf ? Cards.posterOf(item) : item.poster || "" };
      const make = (kind, date, season, episode) =>
        found.push(Object.assign({ key: `${ref}|${kind}|${date}|${season || ""}-${episode || ""}`, kind, date, season: season || null, episode: episode || null }, base));
      if (v.kind === "release" && fresh(v.date)) make(ref.startsWith("movie") ? "release" : "season", v.date, 1, 1);
      if (v.kind === "episode") [v, v.last].forEach((e) => e && fresh(e.date) && e.season && make(e.episode === 1 ? "season" : "episode", e.date, e.season, e.episode));
    });
    return add(found).length;
  }

  /* ---------------- the owner's announcement ---------------- */

  // the site's current announcement into the bell, once (a month at most)
  function announced() {
    const a = window.Site && Site.get().announce;
    if (!a || !a.id || !a.title || Date.now() - (a.at || 0) > 30 * DAY) return;
    const d = new Date(a.at || Date.now());
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // (the day it was sent: the bell's order)
    add([{ key: `announce|${a.id}`, kind: "announcement", title: String(a.title).slice(0, 120), date, extra: { text: String(a.text || "").slice(0, 400), link: a.link || "" }, at: a.at }]);
  }

  /* ---------------- a recommendation, once a week ---------------- */

  // one of your best (8+ or a favorite), and a well-known title TMDB recommends for it that you
  // don't have yet (js/services/tmdb.js: knownRecommendations, kept a week)
  async function recommend() {
    if (!enabled() || !site("recommendation") || !window.TMDB || !TMDB.enabled() || !window.Watch) return;
    const last = Store.getProfile().alertsRecAt || 0;
    if (Date.now() - last < 7 * DAY) return;
    const loved = Store.all().filter((i) => (typeof i.rating === "number" ? i.rating >= 8 : i.favorite));
    if (!loved.length) return;
    Store.setProfile({ alertsRecAt: Date.now() }); // (tried this week, found or not)
    for (let n = 0; n < 4 && loved.length; n++) {
      const seed = loved.splice(Math.floor(Math.random() * loved.length), 1)[0];
      try {
        const ref = await Watch.refOf(seed);
        if (!ref) continue;
        const [media, id] = ref.split("-");
        const recs = (await TMDB.knownRecommendations(media, Number(id))).filter((h) => !Cards.inLibrary(h) && h.poster);
        const pick = recs[Math.floor(Math.random() * Math.min(5, recs.length))];
        if (!pick) continue;
        const r = `${pick.mediaType}-${pick.tmdbId}`;
        add([{ key: `rec|${r}`, kind: "recommendation", ref: r, id: null, title: pick.title, poster: pick.poster, date: today(), extra: { because: Lang.title(seed) } }]);
        return;
      } catch (e) {}
    }
  }

  /* ---------------- notifications on this device ---------------- */

  const supported = () => "Notification" in window && "serviceWorker" in navigator;
  const prefs = () => Object.assign({ on: false, release: true, season: true, episode: true, recommendation: true, announcement: true, breaking: true, trailer: true }, Store.read(PREFS, {}));
  function setPrefs(p) {
    Store.write(PREFS, Object.assign(prefs(), p));
    snapshot();
  }
  const permission = () => (supported() ? Notification.permission : "unsupported"); // "default" | "granted" | "denied"

  // ask the browser (only ever from a tap on the switch in Settings)
  async function ask() {
    if (!supported()) return "unsupported";
    const r = await Notification.requestPermission();
    if (r === "granted") {
      setPrefs({ on: true });
      backgroundCheck();
    }
    return r;
  }

  async function notify(list) {
    const p = prefs();
    if (!p.on || permission() !== "granted" || !list.length) return;
    let reg;
    try {
      reg = await navigator.serviceWorker.ready;
    } catch (e) {
      return;
    }
    const sent = [];
    for (const a of list) {
      if (a.notified || !site(a.kind) || p[a.kind] === false) continue;
      const w = words(a);
      try {
        await reg.showNotification(w.title, {
          body: w.body,
          tag: a.key, // the same alert never twice (another device may show it too)
          icon: a.poster ? Store.img(a.poster, "w185") : "images/icons/icon-192.png",
          badge: "images/icons/icon-192.png",
          data: { url: href(a) },
        });
        sent.push(a.key);
      } catch (e) {}
    }
    if (sent.length) {
      const list2 = all();
      list2.forEach((a) => sent.includes(a.key) && (a.notified = true));
      save(list2);
    }
  }

  // Android, installed app: let the browser check in the background now and then (about twice a
  // day at most; the phone decides). sw.js does the checking with this snapshot of what to watch.
  async function backgroundCheck() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.periodicSync) return false;
      const status = await navigator.permissions.query({ name: "periodic-background-sync" }).catch(() => null);
      if (status && status.state !== "granted") return false;
      await reg.periodicSync.register("mn-alerts", { minInterval: 12 * 3600 * 1000 });
      return true;
    } catch (e) {
      return false;
    }
  }
  // what the background check needs: the titles to watch, what was already shown, your choices
  async function snapshot() {
    if (!("caches" in window) || Store.guest || !window.TMDB) return;
    try {
      const p = prefs();
      const items = window.Watch
        ? Watch.candidates(Store.all())
            .map((i) => ({ ref: Watch.knownRef(i), title: Lang.title(i), poster: Cards.posterOf ? Cards.posterOf(i) : "", url: i.id ? `title.html?id=${encodeURIComponent(i.id)}` : "" }))
            .filter((x) => x.ref)
            .slice(0, 60)
        : [];
      const body = JSON.stringify({
        on: p.on && permission() === "granted" && enabled(),
        kinds: { release: p.release && site("release"), season: p.season && site("season"), episode: p.episode && site("episode") },
        key: (window.MN_CONFIG || {}).TMDB_KEY || "",
        country: TMDB.country(),
        items,
        shown: all().filter((a) => a.notified).map((a) => a.key),
        at: Date.now(),
      });
      const c = await caches.open("mn-alerts");
      await c.put("alerts-snapshot", new Response(body, { headers: { "Content-Type": "application/json" } }));
    } catch (e) {}
  }
  // what the background check showed while the site was closed: added here too, as shown
  async function pickUpShown() {
    if (!("caches" in window)) return;
    try {
      const c = await caches.open("mn-alerts");
      const r = await c.match("alerts-shown");
      if (!r) return;
      const shown = await r.json();
      await c.delete("alerts-shown");
      if (!Array.isArray(shown) || !shown.length) return;
      const list = all();
      const have = new Set(list.map((a) => a.key));
      shown.forEach((s) => {
        if (!s || !s.key) return;
        if (have.has(s.key)) list.forEach((a) => a.key === s.key && (a.notified = true));
        else list.push(Object.assign({ read: false, notified: true, at: Date.now() }, s));
      });
      save(list);
    } catch (e) {}
  }

  /* ---------------- the bell ---------------- */

  function paint() {
    const n = Store.guest ? 0 : unread().length;
    document.querySelectorAll(".notif-badge").forEach((b) => {
      b.hidden = !n;
      b.textContent = n > 9 ? "9+" : n;
    });
    document.querySelectorAll(".notif-btn").forEach((b) => b.setAttribute("aria-label", n ? `Notifications, ${n} new` : "Notifications"));
    // the installed app's icon (Android / desktop / iOS 16.4+ when added to the Home Screen)
    try {
      if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
    } catch (e) {}
  }

  // the panel under the bell: newest first, unread ones with a red dot; opening it marks
  // what it shows as read (a moment later, so the dots are seen)
  let panelEl = null;
  let readTimer;
  const ago = (a) => {
    const n = daysAgo(a.date || today());
    return n <= 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`;
  };
  function renderPanel() {
    if (!panelEl) return;
    if (Store.guest) {
      panelEl.innerHTML = `<div class="notif-head"><h2>Notifications</h2></div><p class="notif-empty"><i class="fa-regular fa-bell"></i>Sign in to hear when the titles you're waiting for come out.</p>`;
      return;
    }
    const list = all().sort((a, b) => (a.read === b.read ? String(b.date || "").localeCompare(String(a.date || "")) || (b.at || 0) - (a.at || 0) : a.read ? 1 : -1));
    panelEl.innerHTML = `<div class="notif-head"><h2>Notifications</h2>${list.length ? '<button type="button" class="t-link notif-clear"><i class="fa-solid fa-broom"></i> Clear all</button>' : ""}</div>
      ${
        list.length
          ? `<ul class="notif-list">${list
              .map((a) => {
                const w = words(a);
                return `<li class="notif-item${a.read ? "" : " unread"}">
                  <a href="${esc(href(a))}" data-notif="${esc(a.key)}">
                    <span class="notif-pic">${a.poster ? `<img src="${esc(Store.poster(a.poster, "w92"))}" alt="" loading="lazy" />` : ""}<i class="fa-solid ${typeOf(a).icon}"></i></span>
                    <span class="notif-text"><strong>${esc(w.title)}</strong><small>${esc(w.body)} · ${ago(a)}</small></span>
                  </a>
                  <button type="button" class="notif-x" data-notif-x="${esc(a.key)}" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
                </li>`;
              })
              .join("")}</ul>`
          : '<p class="notif-empty"><i class="fa-regular fa-bell"></i>You\'re all caught up. New releases, seasons and episodes of what you follow show up here.</p>'
      }
      <a class="notif-foot" href="settings.html#notifications"><i class="fa-solid fa-gear"></i> Notification settings</a>`;
  }
  function openPanel(el) {
    if (panelEl !== el) {
      panelEl = el;
      el.addEventListener("click", (e) => {
        const x = e.target.closest("[data-notif-x]");
        if (x) {
          e.preventDefault();
          e.stopPropagation();
          return dismiss(x.dataset.notifX);
        }
        if (e.target.closest(".notif-clear")) {
          e.stopPropagation();
          return clear();
        }
        const a = e.target.closest("[data-notif]");
        if (a) markRead([a.dataset.notif]);
      });
    }
    renderPanel();
    clearTimeout(readTimer);
    if (unread().length) readTimer = setTimeout(() => markRead(), 2500);
  }
  // closed within a moment of opening: what it showed stays unread
  const closePanel = () => clearTimeout(readTimer);

  document.addEventListener("DOMContentLoaded", () => {
    paint();
    if (Store.guest) return;
    announced();
    if (window.Site) Site.onChange(announced);
    if (!window.Watch) return;
    pickUpShown().then(scan);
    Watch.onChange(() => scan() || paint());
    Store.onChange(() => paint());
    // release dates are looked up again once a day (on any page), then checked for alerts;
    // the weekly recommendation a little later
    if (window.TMDB && TMDB.enabled()) {
      setTimeout(() => Watch.loadNext(Watch.candidates(Store.all())).then(() => (scan(), snapshot())), 4000);
      setTimeout(recommend, 9000);
    }
    if (prefs().on && permission() === "granted") backgroundCheck();
  });

  window.Alerts = {
    TYPES,
    register: (kind, def) => (TYPES[kind] = def),
    all,
    unread,
    add,
    markRead,
    dismiss,
    clear,
    scan,
    recommend,
    words,
    href,
    prefs,
    setPrefs,
    permission,
    ask,
    supported,
    backgroundCheck,
    snapshot,
    paint,
    openPanel,
    closePanel,
    onChange: (fn) => listeners.push(fn),
  };
})();
