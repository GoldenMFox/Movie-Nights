/*
 * Watch: your streaming services and what's coming (Watchlist page, picker, Profile).
 *
 *  - Your services: picked in Profile → Settings, saved in your profile (so they follow
 *    your account to every device).
 *  - Which services a title is on in your country (TMDB / JustWatch): mn:providers,
 *    { "movie-157336": { v: [8, 337], at } }, looked up again after a week.
 *  - What's next for a title (a movie's release date, a show's next episode): mn:nextUp,
 *    { ref: { v: { date, kind, season, episode } | null, at } }, looked up again after a day.
 */
(function () {
  const PROV = "mn:providers";
  const NEXT = "mn:nextUp";
  const WEEK = 7 * 86400000;
  const DAY = 86400000;
  const listeners = [];

  /* ---------------- your services ---------------- */

  // [{ id, name, logo }]
  const mine = () => (Store.getProfile().services || []).filter((s) => s && s.id);
  function setMine(list) {
    Store.setProfile({ services: list });
    listeners.forEach((fn) => fn());
  }

  /* ---------------- which TMDB entry a library title is ---------------- */

  function knownRef(item) {
    if (item.tmdbId && item.tmdbMedia) return `${item.tmdbMedia}-${item.tmdbId}`;
    const r = window.Ratings && Ratings.refOf(item);
    return r && r !== "none" ? r : null;
  }

  async function refOf(item) {
    const known = knownRef(item);
    if (known) return known;
    if (window.Ratings && Ratings.refOf(item) === "none") return null;
    const m = await TMDB.findMatch(item);
    const ref = m ? `${m.media}-${m.id}` : "none";
    if (window.Ratings) Ratings.setLink(item.id, ref);
    return m ? ref : null;
  }

  /* ---------------- lookups, kept in this browser ---------------- */

  function saved(key, item) {
    const ref = knownRef(item);
    const s = ref && Store.read(key, {})[ref];
    return s ? s.v : undefined; // undefined = not looked up yet
  }

  const busy = new Set();
  async function fill(items, key, maxAge, fetcher) {
    if (!window.TMDB || !TMDB.enabled()) return;
    const now = Date.now();
    const store = Store.read(key, {});
    const todo = items.filter((i) => {
      const ref = knownRef(i);
      const s = ref && store[ref];
      return !(s && now - s.at < maxAge);
    });
    if (!todo.length) return;
    let found = false;
    const worker = async () => {
      while (todo.length) {
        const item = todo.shift();
        let ref;
        try {
          ref = await refOf(item);
          if (!ref || busy.has(key + ref)) continue;
          busy.add(key + ref);
          const [media, id] = ref.split("-");
          const v = await fetcher(media, Number(id));
          const fresh = Store.read(key, {});
          fresh[ref] = { v, at: Date.now() };
          const keys = Object.keys(fresh);
          if (keys.length > 600) keys.sort((a, b) => fresh[a].at - fresh[b].at).slice(0, keys.length - 600).forEach((k) => delete fresh[k]);
          Store.write(key, fresh);
          found = true;
        } catch (e) {
          // offline / TMDB hiccup: try again next time
        } finally {
          if (ref) busy.delete(key + ref);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (found) listeners.forEach((fn) => fn());
  }

  /* ---------------- streaming ---------------- */

  const loadProviders = (items) => (mine().length ? fill(items, PROV, WEEK, (m, id) => TMDB.providersFor(m, id).then((l) => l.map((p) => p.id))) : Promise.resolve());

  // your services that have this title: [service] ([] = none of yours, null = don't know yet)
  function onMine(item) {
    const ids = saved(PROV, item);
    if (!ids) return null;
    return mine().filter((s) => ids.includes(s.id));
  }

  /* ---------------- what's coming ---------------- */

  const loadNext = (items) => fill(items, NEXT, DAY, (m, id) => TMDB.nextUp(m, id));

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function when(date) {
    const t = new Date(`${Store.today()}T00:00:00`);
    const d = new Date(`${date}T00:00:00`);
    const days = Math.round((d - t) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days < 14) return `in ${days} days`;
    return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== t.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
  }

  // { date, days, label } for a title with something coming (today or later), else null
  function upcoming(item) {
    const v = saved(NEXT, item);
    if (!v || !v.date || v.date < Store.today()) return null;
    const w = when(v.date);
    let label;
    if (v.kind === "episode") label = v.episode === 1 ? `Season ${v.season} starts ${w}` : `S${v.season} E${v.episode} ${w}`;
    else label = item.type === "movie" || knownRef(item).startsWith("movie") ? `Out ${w}` : `Premieres ${w}`;
    return { date: v.date, label, soon: (new Date(`${v.date}T00:00:00`) - new Date(`${Store.today()}T00:00:00`)) / 86400000 < 14 };
  }

  /* ---------------- "Remind me" (titles not out yet, without adding them anywhere) ---------------- */

  // saved in your profile (so they follow your account): [{ key: "movie-123", title, poster, type, year, released }]
  // a month after release they drop off by themselves
  function reminders() {
    const limit = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    return (Store.getProfile().reminders || []).filter((r) => r && r.key && !(r.released && r.released < limit));
  }
  const isReminded = (key) => reminders().some((r) => r.key === key);

  function toggleReminder(hit, key) {
    const list = reminders();
    const on = !list.some((r) => r.key === key);
    const entry = { key, title: hit.title, poster: hit.poster || "", type: hit.type, year: hit.year || null, released: hit.released || "" };
    if (hit.titleRu) entry.titleRu = hit.titleRu;
    Store.setProfile({ reminders: on ? list.concat(entry) : list.filter((r) => r.key !== key) });
    listeners.forEach((fn) => fn());
    return on;
  }

  // reminders in the shape of library titles (what "Coming up" works with)
  function reminderItems() {
    return reminders().map((r) => {
      const [media, id] = r.key.split("-");
      return Object.assign({ id: null, reminder: true, tmdbId: Number(id), tmdbMedia: media }, r);
    });
  }

  // titles worth checking: movies on your Watchlist from this year on, the shows on your
  // Watchlist or Favorites (for new seasons), and your reminders
  function candidates(all) {
    const year = new Date().getFullYear();
    const lib = all
      .filter((i) => i.watchlist || i.favorite)
      .filter((i) => (i.type === "movie" ? i.watchlist && Number(i.year) >= year : true))
      .slice(0, 60);
    const have = new Set(all.map(knownRef).filter(Boolean));
    return lib.concat(reminderItems().filter((r) => !have.has(r.key)));
  }

  window.Watch = {
    mine,
    setMine,
    refOf,
    loadProviders,
    onMine,
    loadNext,
    upcoming,
    candidates,
    reminders,
    isReminded,
    toggleReminder,
    onChange: (fn) => listeners.push(fn),
  };
})();
