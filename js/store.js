/*
 * Store: combines the library in data/library.js with the changes you make on
 * the site (ratings, favorites, watchlist, added/removed titles, tiers) which
 * are kept in the browser's localStorage.
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
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Could not save to localStorage", e);
      return false;
    }
  }

  const base = Array.isArray(window.LIBRARY) ? window.LIBRARY : [];
  let overrides = read(KEYS.overrides, {});
  let custom = read(KEYS.custom, []);
  let cache = null;
  const listeners = [];

  function build() {
    const byId = new Map();
    base.concat(custom).forEach((item, index) => {
      const merged = Object.assign({ order: index }, item, overrides[item.id] || {});
      if (!merged.removed) byId.set(item.id, merged);
    });
    return byId;
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

  function add(item) {
    const id = idFor(item.title, item.year);
    const entry = Object.assign({ id, isNew: true }, item);
    custom.push(entry);
    write(KEYS.custom, custom);
    changed(id);
    return entry;
  }

  function remove(id) {
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

  function getTiers() {
    return read(KEYS.tiers, { S: [], A: [], B: [], C: [], D: [] });
  }

  function setTiers(tiers) {
    write(KEYS.tiers, tiers);
  }

  function getProfile() {
    return Object.assign({ name: "Mirzac Nicolae", joined: "July 2023" }, read(KEYS.profile, {}));
  }

  function setProfile(patch) {
    write(KEYS.profile, Object.assign(getProfile(), patch));
  }

  /* ---------- export / import ---------- */

  const FILE_HEADER = `/*
 * Movie Nights library - every movie, TV show and anime on the site.
 *
 * To add a title, copy one line and change it. Fields:
 *   id        unique, lowercase-title-year
 *   type      "movie" | "tv" | "anime"
 *   rating    your score 0-10, or null if not rated yet
 *   poster    TMDB image path (the part after /t/p/original)
 *   titleRu   Russian name (shown when movie names are switched to RU)
 *   genres    e.g. ["Action", "Drama"] (used by the Genre filter)
 *   tmdbId / tmdbMedia   which TMDB entry it is (e.g. 157336 / "movie")
 *   optional: isNew, favorite, watchlist, backdrop, trailer (YouTube id),
 *             runtime, certification, director, overview, cast
 *
 * Changes you make on the site (ratings, favorites, tiers...) are saved in your
 * browser. Profile -> "Export library" downloads an updated copy of this file.
 */
`;

  // Produces a new data/library.js with every change baked in.
  function exportLibraryFile() {
    const fields = [
      "id", "title", "titleRu", "year", "type", "rating", "poster", "genres", "isNew", "favorite", "watchlist",
      "tmdbId", "tmdbMedia", "backdrop", "trailer", "runtime", "certification", "director", "overview", "cast",
    ];
    const lines = all()
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const clean = {};
        fields.forEach((f) => {
          if (item[f] !== undefined && item[f] !== false) clean[f] = item[f];
        });
        if (clean.rating === undefined) clean.rating = null;
        return "  " + JSON.stringify(clean) + ",";
      });
    return `${FILE_HEADER}window.LIBRARY = [\n${lines.join("\n")}\n];\n`;
  }

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
    changed(null);
  }

  /* ---------- helpers used by several pages ---------- */

  const IMG = "https://image.tmdb.org/t/p/";

  function img(path, size) {
    if (!path) return "";
    if (/^https?:/.test(path)) return path;
    return IMG + (size || "w342") + path;
  }

  function poster(path, size) {
    return img(path, size) || "images/poster-placeholder.svg";
  }

  const TYPE_LABEL = { movie: "Movie", tv: "TV Show", anime: "Anime" };

  window.Store = {
    KEYS,
    read,
    write,
    all,
    get,
    update,
    toggle,
    add,
    idFor,
    remove,
    onChange,
    getTiers,
    setTiers,
    getProfile,
    setProfile,
    exportLibraryFile,
    exportBackup,
    importBackup,
    resetAll,
    img,
    poster,
    TYPE_LABEL,
  };
})();
