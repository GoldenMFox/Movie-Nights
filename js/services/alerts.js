/*
 * Alerts: "it's out" news about your titles, the red number on Watchlist, and notifications.
 *
 * What makes an alert (from what js/services/watch.js already looks up once a day):
 *   release   a movie on your Watchlist (or one you asked to be reminded of) comes out
 *   season    a show you follow starts a new season (its episode 1)
 *   episode   a new episode of a show you follow
 * Each one is kept with your profile (so it follows you to your other devices), as
 *   { key, ref, id, title, poster, kind, season, episode, date, read, notified }
 * and dropped a month later. Key: the title, the kind and the day, so it's never made twice.
 *
 * Read / unread: the red number counts the unread ones. Opening the Watchlist page (where they're
 * listed under "New for you") marks them read; each has its own ✕, and "Clear all" empties the list.
 *
 * Notifications (Settings → Notifications, after the browser asks you): a new alert also shows as
 * a notification on this device, once (notified), for the kinds you picked. On Android's installed
 * app the browser can also check in the background now and then (Periodic Background Sync, sw.js),
 * so a release can arrive while the app is closed; elsewhere they come when you open the site.
 * The installed app's icon carries the unread count too, where the phone supports it.
 */
(function () {
  const DAY = 86400000;
  const KEEP = 30 * DAY; // an alert is kept a month
  const RECENT = 7; // something out in the last week still makes an alert
  const PREFS = "mn:notify"; // this device: { on, release, season, episode }
  const listeners = [];

  const site = (k) => !window.Site || Site.get().notifications[k] !== false;
  const enabled = () => !Store.guest && (!window.Site || (Site.feature("notifications") && site("on")));

  /* ---------------- the list ---------------- */

  const all = () => (Store.getProfile().alerts || []).filter((a) => a && a.key && Date.now() - (a.at || 0) < KEEP);
  function save(list) {
    Store.setProfile({ alerts: list.slice(-40) });
    listeners.forEach((fn) => fn());
    paint();
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
  function dismiss(key) {
    save(all().filter((a) => a.key !== key));
  }
  function clear() {
    save([]);
  }

  /* ---------------- finding new ones ---------------- */

  const daysAgo = (date) => Math.round((new Date(`${Store.today()}T00:00:00`) - new Date(`${date}T00:00:00`)) / DAY);
  const fresh = (date) => !!date && date <= Store.today() && daysAgo(date) <= RECENT;

  // the titles worth an alert, as Watch looked them up -> new alerts added (returns how many)
  function scan() {
    if (!enabled() || !window.Watch) return 0;
    const list = all();
    const have = new Set(list.map((a) => a.key));
    const found = [];
    Watch.candidates(Store.all()).forEach((item) => {
      const v = Watch.nextOf(item);
      const ref = Watch.knownRef(item);
      if (!v || !ref) return;
      const base = {
        ref,
        id: item.id || null,
        title: Lang.title(item),
        poster: Cards.posterOf ? Cards.posterOf(item) : item.poster || "",
      };
      const add = (kind, date, season, episode) => {
        const key = `${ref}|${kind}|${date}|${season || ""}-${episode || ""}`;
        if (have.has(key)) return;
        have.add(key);
        found.push(Object.assign({ key, kind, date, season: season || null, episode: episode || null, read: false, notified: false, at: Date.now() }, base));
      };
      if (v.kind === "release" && fresh(v.date)) add(ref.startsWith("movie") ? "release" : "season", v.date, 1, 1);
      if (v.kind === "episode") {
        [v, v.last].forEach((e) => {
          if (e && fresh(e.date) && e.season) add(e.episode === 1 ? "season" : "episode", e.date, e.season, e.episode);
        });
      }
    });
    if (!found.length) return 0;
    save(list.concat(found));
    notify(found);
    return found.length;
  }

  /* ---------------- words ---------------- */

  function words(a) {
    if (a.kind === "release") return { title: `${a.title} is out`, body: a.date === Store.today() ? "Out today: it's on your Watchlist." : "Now out: it's on your Watchlist." };
    if (a.kind === "season") return { title: `${a.title}: Season ${a.season || 1}`, body: a.date === Store.today() ? "The new season starts today." : "The new season has started." };
    return { title: `${a.title}: S${a.season} E${a.episode}`, body: a.date === Store.today() ? "A new episode is out today." : "A new episode is out." };
  }
  const href = (a) => (a.id ? `title.html?id=${encodeURIComponent(a.id)}` : `title.html?tmdb=${encodeURIComponent(a.ref)}`);

  /* ---------------- notifications on this device ---------------- */

  const supported = () => "Notification" in window && "serviceWorker" in navigator;
  const prefs = () => Object.assign({ on: false, release: true, season: true, episode: true }, Store.read(PREFS, {}));
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
  // what the background check showed while the site was closed: marked as shown here too
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

  /* ---------------- the red number ---------------- */

  function paint() {
    const n = Store.guest ? 0 : unread().length;
    document.querySelectorAll('.nav-links a[href="watchlist.html"], .tab-bar a[href="watchlist.html"]').forEach((a) => {
      let b = a.querySelector(".nav-badge");
      if (!n) {
        if (b) b.remove();
        a.removeAttribute("aria-label");
        return;
      }
      if (!b) {
        b = document.createElement("span");
        b.className = "nav-badge";
        a.append(b);
      }
      b.textContent = n > 9 ? "9+" : n;
      b.title = `${n} new: out now`;
      a.setAttribute("aria-label", `Watchlist, ${n} new`);
    });
    // the installed app's icon (Android / desktop / iOS 16.4+ when added to the Home Screen)
    try {
      if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (Store.guest || !window.Watch) return;
    paint();
    pickUpShown().then(scan);
    Watch.onChange(() => scan() || paint());
    Store.onChange(() => paint());
    // release dates are looked up again once a day (on any page), then checked for alerts
    if (window.TMDB && TMDB.enabled()) setTimeout(() => Watch.loadNext(Watch.candidates(Store.all())).then(() => (scan(), snapshot())), 4000);
    if (prefs().on && permission() === "granted") backgroundCheck();
  });

  window.Alerts = { all, unread, markRead, dismiss, clear, scan, words, href, prefs, setPrefs, permission, ask, supported, backgroundCheck, snapshot, paint, onChange: (fn) => listeners.push(fn) };
})();
