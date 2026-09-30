/*
 * Store: your library (titles, ratings, favorites, watchlist, tiers, profile), kept in
 * the browser's localStorage and synced to your account (js/core/cloud.js). Everyone
 * has their own; visitors who aren't signed in have none.
 */
(function () {
  const KEYS = {
    overrides: "mn:overrides",
    custom: "mn:custom",
    tiers: "mn:tiers",
    profile: "mn:profile",
    tmdbKey: "mn:tmdbKey",
    tmdbCache: "mn:tmdbCache",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    const text = JSON.stringify(value);
    try {
      localStorage.setItem(key, text);
      if (SYNCED.includes(key)) saved();
      return true;
    } catch (e) {
      // storage full: the TMDB page cache can always be rebuilt, your changes can't
      if (key !== KEYS.tmdbCache) {
        try {
          localStorage.removeItem(KEYS.tmdbCache);
          localStorage.setItem(key, text);
          if (SYNCED.includes(key)) saved();
          return true;
        } catch (e2) {}
        if (window.UI) UI.toast("Couldn't save your change: this browser's storage is full or blocked");
      }
      console.warn("Could not save to localStorage", e);
      return false;
    }
  }

  // what's synced to your account (js/core/cloud.js)
  const SYNCED = [KEYS.overrides, KEYS.custom, KEYS.tiers, KEYS.profile];

  // Every person has their own private library, kept in their account (js/core/cloud.js):
  //   signed in: your library ("empty" = all yours in the account; "library" = the owner's
  //     from before it moved into the account: data/library.js plus your changes)
  //   signed out (with sign-in set up): no library at all, until you sign in
  //   no sign-in set up (MN_CONFIG.FIREBASE empty): data/library.js, as a local site
  const account = read("mn:account", null);
  const cloudOn = !!(window.MN_CONFIG && MN_CONFIG.FIREBASE && MN_CONFIG.FIREBASE.apiKey);
  const guest = cloudOn && !account;
  try {
    localStorage.removeItem("mn:public"); // the owner's library used to be shown to visitors
  } catch (e) {}

  const siteLibrary = Array.isArray(window.LIBRARY) ? window.LIBRARY : [];
  const base = guest ? [] : account ? (account.base === "library" ? siteLibrary : []) : siteLibrary;
  let overrides = guest ? {} : read(KEYS.overrides, {});
  let custom = guest ? [] : read(KEYS.custom, []);
  let cache = null;
  const listeners = [];
  const saveListeners = [];

  function build() {
    const byId = new Map();
    base.concat(custom).forEach((item, index) => {
      const merged = Object.assign({ order: index }, item, overrides[item.id] || {});
      // rated = watched, so it's not on the Watchlist (unless you put it back on to watch again)
      if (merged.watchlist && typeof merged.rating === "number" && !merged.rewatch) merged.watchlist = false;
      if (!merged.removed) byId.set(item.id, merged);
    });
    return byId;
  }

  function saved() {
    saveListeners.forEach((fn) => fn());
  }

  function all() {
    if (!cache) cache = build();
    return Array.from(cache.values());
  }

  function get(id) {
    if (!cache) cache = build();
    return cache.get(id) || null;
  }

  function changed(id) {
    cache = null;
    listeners.forEach((fn) => fn(id));
  }

  function update(id, patch) {
    // rating a title means you've watched it: it leaves the Watchlist
    const before = get(id);
    if (typeof patch.rating === "number" && !("watchlist" in patch)) {
      patch = Object.assign({}, patch, { watchlist: false, rewatch: undefined });
      if (before && before.watchlist) setTimeout(() => window.UI && UI.toast(`Rated, so "${before.title}" left your Watchlist`), 0);
    }
    // the watch diary: the day you first rated it (or pressed Watched) is the day you watched it
    if (typeof patch.rating === "number" && before && !before.watchedAt && !("watchedAt" in patch)) patch = Object.assign({}, patch, { watchedAt: today() });
    // putting a title you already rated back on the Watchlist (to watch it again) is allowed
    if (patch.watchlist === true && before && typeof before.rating === "number") patch = Object.assign({}, patch, { rewatch: true });
    if (patch.watchlist === false) patch = Object.assign({}, patch, { rewatch: undefined });
    const current = Object.assign({}, overrides[id] || {}, patch);
    Object.keys(current).forEach((k) => current[k] === undefined && delete current[k]);
    overrides[id] = current;
    write(KEYS.overrides, overrides);
    changed(id);
  }

  function toggle(id, field) {
    const item = get(id);
    if (!item) return false;
    const next = !item[field];
    update(id, { [field]: next });
    return next;
  }

  function slugify(title, year) {
    const clean = title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${clean}-${year || "na"}`;
  }

  // the id a new title will get (unique, like "dune-2021" or "dune-2021-2")
  function idFor(title, year) {
    let id = slugify(title, year);
    let n = 2;
    while (get(id)) id = `${slugify(title, year)}-${n++}`;
    return id;
  }

  // A new release: came out in the last 6 months (not upcoming ones). Needs the exact
  // release date, which js/components/cards.js looks up on TMDB for this and last
  // year's titles (movies: the date in your country, MN_CONFIG.RELEASE_COUNTRY) and
  // keeps in mn:releases3 ({ id: { d: "2026-05-01", at } }).
  // So the NEW label goes away by itself as titles get older.
  const RECENT_DAYS = 183;
  function releaseOf(item) {
    const r = read("mn:releases3", {})[item.id];
    return r ? r.d : null; // null = not looked up yet, "" = TMDB has no date
  }
  function isRecent(item) {
    const year = Number(item && item.year);
    if (!year || year < new Date().getFullYear() - 1) return false;
    const d = releaseOf(item);
    if (!d) return false;
    const days = (Date.now() - new Date(`${d}T00:00:00Z`).getTime()) / 86400000;
    return days >= 0 && days <= RECENT_DAYS;
  }

  // today as "2026-09-29" (local time)
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function entryFor(item) {
    const id = idFor(item.title, item.year);
    const entry = Object.assign({ id, isNew: true }, item);
    if (typeof entry.rating === "number") {
      entry.watchlist = false; // rated = watched
      if (!entry.watchedAt) entry.watchedAt = today();
    }
    return entry;
  }

  function add(item) {
    const entry = entryFor(item);
    custom.push(entry);
    write(KEYS.custom, custom);
    changed(entry.id);
    return entry;
  }

  // many new titles at once (an import): saved and synced once, not once per title
  function addMany(items) {
    const added = [];
    items.forEach((item) => {
      const entry = entryFor(item);
      custom.push(entry);
      cache = null; // so the next id is unique too
      added.push(entry);
    });
    write(KEYS.custom, custom);
    changed(null);
    return added;
  }

  // many changes at once (an import that updates titles you already have)
  function updateMany(patches) {
    Object.entries(patches).forEach(([id, patch]) => {
      const current = Object.assign({}, overrides[id] || {}, patch);
      Object.keys(current).forEach((k) => current[k] === undefined && delete current[k]);
      overrides[id] = current;
    });
    write(KEYS.overrides, overrides);
    changed(null);
  }

  // returns an "undo" function that puts it back exactly as it was (score, lists, tier)
  function remove(id) {
    const at = custom.findIndex((c) => c.id === id);
    const saved = {
      entry: at >= 0 ? custom[at] : null,
      override: overrides[id] ? Object.assign({}, overrides[id]) : undefined,
      tiers: JSON.parse(JSON.stringify(getTiers())),
    };
    removeNow(id);
    return function undo() {
      if (saved.entry && !custom.some((c) => c.id === id)) {
        custom.splice(Math.min(at, custom.length), 0, saved.entry);
        write(KEYS.custom, custom);
      }
      if (saved.override) overrides[id] = saved.override;
      else delete overrides[id];
      write(KEYS.overrides, overrides);
      setTiers(saved.tiers);
      changed(id);
    };
  }

  function removeNow(id) {
    const isCustom = custom.some((c) => c.id === id);
    if (isCustom) {
      custom = custom.filter((c) => c.id !== id);
      write(KEYS.custom, custom);
      delete overrides[id];
      write(KEYS.overrides, overrides);
    } else {
      update(id, { removed: true });
    }
    // take it out of the tier list too
    const tiers = getTiers();
    Object.keys(tiers).forEach((t) => (tiers[t] = tiers[t].filter((x) => x !== id)));
    setTiers(tiers);
    changed(id);
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // The site open in several tabs: a change made in another tab is picked up here at once.
  // (Without this, this tab would save its older copy over it the next time you change
  // something, and the other tab's change would be lost.) That tab uploads it.
  window.addEventListener("storage", (e) => {
    if (guest || (e.key && !SYNCED.includes(e.key))) return;
    if (!e.key || e.key === KEYS.overrides) overrides = read(KEYS.overrides, {});
    if (!e.key || e.key === KEYS.custom) custom = read(KEYS.custom, []);
    cache = null;
    listeners.forEach((fn) => fn(null));
  });

  function getTiers() {
    return (!guest && read(KEYS.tiers, null)) || { S: [], A: [], B: [], C: [], D: [] };
  }

  function setTiers(tiers) {
    write(KEYS.tiers, tiers);
  }

  // signed in: your own name (your Google name until you change it). Signed out: "Guest"
  function getProfile() {
    if (!account) return { name: "Guest", joined: "", guest: true };
    return Object.assign({ name: account.name || "Me", joined: "" }, read(KEYS.profile, {}));
  }

  function setProfile(patch) {
    write(KEYS.profile, Object.assign(getProfile(), patch));
  }

  /* ---------- your own lists ("Halloween marathon", "Date night"…), saved with your profile ---------- */

  // [{ id, name, items: [library ids] }]
  const lists = () => (getProfile().lists || []).filter((l) => l && l.id);
  function saveLists(l) {
    setProfile({ lists: l });
    changed(null);
  }
  function createList(name) {
    const id = `l${Date.now().toString(36)}`;
    saveLists(lists().concat({ id, name: String(name).trim().slice(0, 40) || "My list", items: [] }));
    return id;
  }
  function renameList(listId, name) {
    saveLists(lists().map((l) => (l.id === listId ? Object.assign({}, l, { name: String(name).trim().slice(0, 40) || l.name }) : l)));
  }
  function deleteList(listId) {
    saveLists(lists().filter((l) => l.id !== listId));
  }
  // put a title in a list, or take it out; returns true when it's in now
  function toggleInList(listId, itemId) {
    let on = false;
    saveLists(
      lists().map((l) => {
        if (l.id !== listId) return l;
        on = !l.items.includes(itemId);
        return Object.assign({}, l, { items: on ? [itemId].concat(l.items) : l.items.filter((x) => x !== itemId) });
      })
    );
    return on;
  }

  /* ---------- backup ---------- */

  function exportBackup() {
    return JSON.stringify(
      {
        app: "movie-nights",
        version: 2,
        exported: new Date().toISOString(),
        overrides,
        custom,
        tiers: getTiers(),
        profile: read(KEYS.profile, {}),
      },
      null,
      2
    );
  }

  function importBackup(text) {
    const data = JSON.parse(text);
    if (data.app !== "movie-nights") throw new Error("This is not a Movie Nights backup file.");
    overrides = data.overrides || {};
    custom = data.custom || [];
    write(KEYS.overrides, overrides);
    write(KEYS.custom, custom);
    if (data.tiers) setTiers(data.tiers);
    if (data.profile) write(KEYS.profile, data.profile);
    changed(null);
  }

  function resetAll() {
    [KEYS.overrides, KEYS.custom, KEYS.tiers, KEYS.profile].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    });
    overrides = {};
    custom = [];
    saved();
    changed(null);
  }

  /* ---------- account sync (used by js/core/cloud.js) ---------- */

  // everything that belongs to you, as one object
  function snapshot() {
    return { overrides, custom, tiers: read(KEYS.tiers, null), profile: read(KEYS.profile, {}) };
  }

  // replace what's in this browser with data from your account (doesn't upload it again)
  function replaceData(data) {
    data = data || {};
    overrides = data.overrides || {};
    custom = data.custom || [];
    try {
      localStorage.setItem(KEYS.overrides, JSON.stringify(overrides));
      localStorage.setItem(KEYS.custom, JSON.stringify(custom));
      if (data.tiers) localStorage.setItem(KEYS.tiers, JSON.stringify(data.tiers));
      else localStorage.removeItem(KEYS.tiers);
      localStorage.setItem(KEYS.profile, JSON.stringify(data.profile || {}));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
    changed(null);
  }

  function onSave(fn) {
    saveListeners.push(fn);
  }

  /* ---------- helpers used by several pages ---------- */

  const IMG = "https://image.tmdb.org/t/p/";

  function img(path, size) {
    if (!path) return "";
    if (/^https?:/.test(path)) return path;
    return IMG + (size || "w342") + path;
  }

  function poster(path, size) {
    return img(path, size) || "images/placeholders/poster-placeholder.svg";
  }

  const TYPE_LABEL = { movie: "Movie", tv: "TV Show", anime: "Anime" };

  window.Store = {
    KEYS,
    read,
    write,
    all,
    get,
    isRecent,
    update,
    toggle,
    add,
    addMany,
    updateMany,
    today,
    remove,
    onChange,
    getTiers,
    setTiers,
    getProfile,
    setProfile,
    lists,
    createList,
    renameList,
    deleteList,
    toggleInList,
    guest,
    exportBackup,
    importBackup,
    resetAll,
    snapshot,
    replaceData,
    onSave,
    SYNCED,
    account,
    img,
    poster,
    TYPE_LABEL,
  };
})();
