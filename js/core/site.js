/*
 * Site: the settings the owner sets for everyone in the Admin Control Center (admin.html).
 *
 *  - Saved in the account as one document, site/config (js/core/cloud.js: siteLoad / siteSave),
 *    which everyone may read and only the owner may change (docs/firestore.rules).
 *  - Every page uses this browser's copy straight away (mn:site) and asks for a fresh one in
 *    the background (at most once a minute; every page while maintenance is on), so a setting never
 *    slows a page down.
 *  - Anything not set falls back to DEFAULTS, so the site works the same with no settings at all.
 *
 * What's in it: branding, maintenance mode and a notice across the top, which pages show in the
 * navigation, features on / off, the outside services (TVmaze, AniList, Open Library, news) on / off with
 * their keys and how long their answers are kept, featured titles / books / news, themes and
 * notifications.
 */
(function () {
  const KEY = "mn:site"; // { data, blocked, updatedAt, at, state }
  const LOCAL = "mn:siteLocal"; // the owner's settings when the account couldn't take them yet
  const FRESH = 60 * 1000; // asked again at most once a minute (every page while maintenance is on)

  const DEFAULTS = {
    branding: { name: "Movie Nights", tagline: "Your own private diary of movies, TV shows and anime.", accent: "" },
    maintenance: { on: false, message: "We're making a few changes. Back in a moment!" },
    notice: { on: false, text: "", link: "", tone: "info", from: "", until: "" }, // (from / until: days, optional)
    // a message to every member's bell (Admin → Notifications): { id, title, text, link, at } or null
    announce: null,
    // the title page's rows, top to bottom, and the ones left out (Admin → Title page)
    titlePage: { order: [], hidden: [] },
    // the person page's rows under its top part (Admin → Person page)
    personPage: { order: [], hidden: [] },
    // pages left out of the navbar, the tab bar and the profile menu (by their id in layout.js)
    nav: { hidden: [] },
    features: {
      picker: true, // "What should I watch?"
      trivia: true,
      soundtrack: true,
      xray: true,
      books: true, // Books on title pages
      tvmaze: true, // Episodes & more from TVmaze on show pages
      animeDetails: true, // the AniList card on anime title pages
      news: true,
      animeExplore: true,
      listThemes: true,
      notifications: true,
      share: true,
      boxOffice: true,
    },
    discover: { phoneFirst: 24, desktopFirst: 40 },
    home: { featured: [], featuredTitle: "Our picks", featuredBooks: [], featuredBooksTitle: "Books behind the films" },
    anime: { featured: [] },
    // moderation: TMDB titles kept out of Discover, Home and search rows ({ ref, title })
    content: { hidden: [] },
    news: { featured: [], feeds: null, hiddenSources: [] },
    apis: {
      tvmaze: { on: true, hours: 12 },
      anilist: { on: true, hours: 24 },
      openlibrary: { on: true, days: 30 },
      news: { on: true, minutes: 30 },
      itunes: { on: true, days: 30 },
    },
    themes: { siteDefault: "dark", listThemes: true, animations: true, season: "auto", available: ["halloween", "christmas", "winter", "spring", "summer", "noir", "space"] },
    notifications: { on: true, release: true, season: true, episode: true, recommendation: true, announcement: true },
  };

  // DEFAULTS with the saved settings on top, one level at a time (a setting added to the site
  // later gets its default on older saved settings)
  function merge(base, over) {
    if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
    const out = Array.isArray(base) ? [] : Object.assign({}, base);
    Object.keys(over).forEach((k) => {
      const b = base ? base[k] : undefined;
      out[k] = b && typeof b === "object" && !Array.isArray(b) ? merge(b, over[k]) : over[k];
    });
    return out;
  }

  const listeners = [];
  let saved = Store.read(KEY, null);
  // the owner's own copy that the account couldn't take yet (the rules aren't published)
  const local = () => (Cloud && Cloud.isOwner && Cloud.isOwner() ? Store.read(LOCAL, null) : null);
  let config = merge(DEFAULTS, (local() && local().data) || (saved && saved.data) || {});

  function get() {
    return config;
  }
  const feature = (name) => config.features[name] !== false;
  const api = (name) => Object.assign({}, DEFAULTS.apis[name] || {}, config.apis[name] || {});
  const navHidden = (id) => (config.nav.hidden || []).includes(id);
  // "live": from the account · "default": nothing saved yet · "unpublished": the account's rules
  // don't take site settings yet (the owner's copy is on this device) · "offline"
  const state = () => (local() ? "unpublished" : saved ? saved.state || "live" : "default");
  const blocked = () => (saved && saved.blocked) || [];

  function set(data, extra) {
    config = merge(DEFAULTS, data || {});
    listeners.forEach((fn) => fn(config));
    apply();
    return config;
  }

  // ask the account for the latest settings (in the background; quietly keeps the copy offline)
  let loading = null;
  function refresh(force) {
    if (!window.Cloud || !Cloud.enabled) return Promise.resolve(config);
    if (!force && !config.maintenance.on && saved && Date.now() - (saved.at || 0) < FRESH) return Promise.resolve(config);
    if (loading) return loading;
    loading = Cloud.siteLoad()
      .then((doc) => {
        saved = { data: doc ? doc.data : null, blocked: (doc && doc.blocked) || [], updatedAt: doc ? doc.updatedAt : 0, at: Date.now(), state: doc && doc.data ? "live" : "default" };
        Store.write(KEY, saved);
        // a copy kept on this device while the account couldn't take it: dropped once the
        // account has a newer one (saved from here or another device after the rules were published)
        const mine = Store.read(LOCAL, null);
        if (mine && saved.updatedAt && saved.updatedAt > (mine.at || 0)) {
          try {
            localStorage.removeItem(LOCAL);
          } catch (e) {}
        }
        if (!local()) set(saved.data);
        checkBlocked();
        return config;
      })
      .catch((e) => {
        // 403: the rules don't let anyone read it yet (published rules without site/config)
        if (e && e.status === 403) {
          saved = Object.assign({}, saved || {}, { at: Date.now(), state: "unpublished" });
          Store.write(KEY, saved);
        }
        return config;
      })
      .finally(() => (loading = null));
    return loading;
  }

  // the owner saves: to the account; if the account refuses (the rules don't have site/config
  // yet), kept on this device and used here until it can go up
  async function save(data, blockedList) {
    const clean = JSON.parse(JSON.stringify(data));
    try {
      const at = await Cloud.siteSave(clean, blockedList || blocked());
      saved = { data: clean, blocked: blockedList || blocked(), updatedAt: at, at: Date.now(), state: "live" };
      Store.write(KEY, saved);
      try {
        localStorage.removeItem(LOCAL);
      } catch (e) {}
      set(clean);
      return "live";
    } catch (e) {
      if (e && (e.status === 403 || e.status === 400)) {
        Store.write(LOCAL, { data: clean, blocked: blockedList || blocked(), at: Date.now() });
        set(clean);
        return "unpublished";
      }
      throw e;
    }
  }

  /* ---------------- putting the settings to work on every page ---------------- */

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const isOwner = () => !!(window.Cloud && Cloud.isOwner && Cloud.isOwner());
  const isAdminPage = () => document.body && document.body.dataset.page === "admin";

  function apply() {
    const root = document.documentElement;
    // the accent colour (a #rrggbb picked in Branding)
    const accent = /^#[0-9a-f]{6}$/i.test(config.branding.accent || "") ? config.branding.accent : "";
    if (accent) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--accent-hover", accent);
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-hover");
    }
    // the theme for people who haven't picked one themselves (the <head> script reads mn:siteTheme)
    Store.write("mn:siteTheme", config.themes.siteDefault === "light" ? "light" : "dark");
    root.classList.toggle("no-list-fx", config.themes.animations === false);
    // (buttons drawn later, e.g. Share on news stories, are hidden by the stylesheet)
    root.classList.toggle("feat-off-share", !feature("share"));
    if (!document.body) return;
    paintNotice();
    paintMaintenance();
    paintNav();
  }

  // a notice across the top of every page ("New: Movie News!"), closable (until it changes)
  function paintNotice() {
    let el = document.querySelector(".site-notice");
    const n = config.notice;
    const sig = `${n.text}|${n.link}`;
    const closed = Store.read("mn:noticeClosed", "") === sig;
    // (only between its days, when it has them)
    const day = Store.today();
    const outside = (n.from && day < n.from) || (n.until && day > n.until);
    if (!n.on || !n.text || closed || outside) return el && el.remove();
    if (!el) {
      el = document.createElement("div");
      el.className = "site-notice";
      el.setAttribute("role", "status");
      document.body.prepend(el);
      el.addEventListener("click", (e) => {
        if (!e.target.closest(".site-notice-x")) return;
        Store.write("mn:noticeClosed", el.dataset.sig);
        el.remove();
      });
    }
    el.dataset.sig = sig;
    el.className = `site-notice ${n.tone === "warn" ? "warn" : ""}`;
    el.innerHTML = `<i class="fa-solid ${n.tone === "warn" ? "fa-triangle-exclamation" : "fa-bullhorn"}" aria-hidden="true"></i>
      <span>${esc(n.text)}${/^(https?:\/\/|[\w-]+\.html)/.test(n.link || "") ? ` <a href="${esc(n.link)}">Learn more</a>` : ""}</span>
      <button type="button" class="site-notice-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>`;
  }

  // maintenance mode: everyone but the owner sees a "back soon" screen (the owner gets a strip
  // that says it's on, so they can still check the site)
  function paintMaintenance() {
    let el = document.querySelector(".site-maint");
    const on = config.maintenance.on && !isAdminPage();
    document.documentElement.classList.toggle("maint-on", !!on && !isOwner());
    if (!on) return el && el.remove();
    if (!el) {
      el = document.createElement("div");
      document.body.append(el);
    }
    if (isOwner()) {
      el.className = "site-maint owner";
      el.innerHTML = `<i class="fa-solid fa-screwdriver-wrench"></i> Maintenance mode is on<span class="maint-long">: visitors see the "back soon" screen</span>. <a href="admin.html#website">Turn it off</a>`;
      return;
    }
    el.className = "site-maint";
    el.setAttribute("role", "alert");
    el.innerHTML = `<div class="site-maint-card">
        <img src="images/brand/logo.png" alt="${esc(config.branding.name)}" />
        <i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i>
        <h1>Back soon</h1>
        <p>${esc(config.maintenance.message || DEFAULTS.maintenance.message)}</p>
        <button type="button" class="btn btn-primary" onclick="location.reload()"><i class="fa-solid fa-rotate"></i> Try again</button>
      </div>`;
  }

  // pages the owner took out of the navigation (layout.js marks each link with data-nav)
  function paintNav() {
    // (a page whose feature is off is hidden too: News, Box Office, the anime explorer)
    const FEATURE_OF = { news: "news", boxoffice: "boxOffice", animeExplore: "animeExplore" };
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const li = a.closest("li") || a;
      const f = FEATURE_OF[a.dataset.nav];
      li.hidden = navHidden(a.dataset.nav) || (!!f && !feature(f));
    });
    // a feature that's off takes its way in with it
    document.querySelectorAll("[data-feature]").forEach((el) => (el.hidden = !feature(el.dataset.feature)));
  }

  // the brand name in the browser tab ("Interstellar · Movie Nights" → "… · Film Club")
  function brandTitle() {
    const name = config.branding.name;
    if (!name || name === DEFAULTS.branding.name) return;
    const t = document.querySelector("title");
    const fix = () => {
      if (document.title.includes(DEFAULTS.branding.name)) document.title = document.title.split(DEFAULTS.branding.name).join(name);
    };
    fix();
    if (t) new MutationObserver(fix).observe(t, { childList: true });
  }

  // someone the owner turned away (Admin → Users): signed out here too, with a word why
  // (the account's rules turn them away as well, once those are published)
  function checkBlocked() {
    const acct = window.Cloud && Cloud.account && Cloud.account();
    if (!acct || !acct.email || isOwner()) return;
    if (!blocked().includes(String(acct.email).toLowerCase())) return;
    if (window.UI) UI.toast("This account no longer has access to Movie Nights. Ask the site's owner.");
    setTimeout(() => Cloud.signOut && Cloud.signOut(), 2500);
  }

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    brandTitle();
    refresh();
    if (window.Cloud && Cloud.onOwner) Cloud.onOwner(() => apply());
  });

  // the title page's rows (js/pages/title.js), in the order they come: [id, name, what's in it, icon]
  const TITLE_ROWS = [
    ["yours", "Your progress, notes & trivia", "Episodes you're at, your note, the trivia game", "fa-user-pen"],
    ["collection", "Collection", "The other films of its franchise", "fa-layer-group"],
    ["seasons", "Seasons", "A card per season, with its trailer", "fa-tv"],
    ["episodes", "Episodes", "The episode guide (shows)", "fa-list-ol"],
    ["cast", "Cast & Crew", "The actors and the people behind it", "fa-users"],
    ["xray", "X-Ray", "Release, money, awards, studios, where you've seen the cast", "fa-bolt"],
    ["media", "Media", "Videos and images", "fa-photo-film"],
    ["soundtrack", "Soundtrack", "Its album with 30-second previews", "fa-music"],
    ["books", "Based on the book", "The book it's adapted from", "fa-book-open"],
    ["reviews", "Reviews", "What people wrote on TMDB", "fa-comments"],
    ["more", "More like this", "From your library or TMDB's recommendations", "fa-clapperboard"],
  ];
  // the person page's rows, under its top part (js/pages/person.js)
  const PERSON_ROWS = [
    ["known", "Best known for", "Their best-known films and shows", "fa-star"],
    ["filmography", "Filmography", "Everything they've done, with the filters", "fa-film"],
    ["books", "Books", "Books by them and about them, on a shelf", "fa-book-open"],
  ];
  // the rows in the saved order (rows added to the site later go where they come by default)
  const titleRows = () => rowsOf(TITLE_ROWS, "titlePage");
  const personRows = () => rowsOf(PERSON_ROWS, "personPage");
  function rowsOf(defs, key) {
    const t = (config && config[key]) || {};
    const known = defs.map((r) => r[0]);
    const order = (t.order || []).filter((k) => known.includes(k));
    known.forEach((k, i) => {
      if (order.includes(k)) return;
      const after = known.slice(0, i).reverse().find((x) => order.includes(x));
      order.splice(after ? order.indexOf(after) + 1 : 0, 0, k);
    });
    return { order, hidden: (t.hidden || []).filter((k) => known.includes(k)) };
  }

  window.Site = { TITLE_ROWS, PERSON_ROWS, titleRows, personRows, rowsOf, DEFAULTS, get, feature, api, navHidden, state, blocked, refresh, save, onChange: (fn) => listeners.push(fn), merge };
})();
