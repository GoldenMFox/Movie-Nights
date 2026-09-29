/*
 * Ratings: the second score shown next to yours.
 *
 *  - IMDb rating (plus the Rotten Tomatoes Tomatometer when there is one), from OMDb.
 *    The free OMDb key allows 1,000 lookups a day, so the site uses at most
 *    DAILY_BUDGET a day and remembers every answer.
 *  - TMDB score as the fallback: when IMDb has no rating, or today's OMDb
 *    lookups are used up. Titles waiting for a lookup get upgraded to IMDb on a
 *    later day, the next time they show up on screen.
 *
 * Everything is cached in this browser:
 *   mn:links       library id  -> "movie-123" / "tv-456" (its TMDB entry) or "none"
 *   mn:ratings     "movie-123" -> { tmdb, tmdbAt, imdbId, imdb, votes, rt, omdb, omdbAt }
 *   mn:omdbBudget  { day, used, blocked }
 */
(function () {
  const OMDB = "https://www.omdbapi.com/";
  const DAILY_BUDGET = 900; // stay safely under OMDb's 1,000 a day
  const DAY = 24 * 3600 * 1000;
  const TMDB_MAX_AGE = 14 * DAY;
  const IMDB_MAX_AGE = 30 * DAY;
  const NONE_RETRY = 30 * DAY; // no IMDb rating / no TMDB match: ask again after a month
  const KEYS = { links: "mn:links", ratings: "mn:ratings", budget: "mn:omdbBudget", omdbKey: "mn:omdbKey" };

  let links = Store.read(KEYS.links, {});
  let ratings = Store.read(KEYS.ratings, {});
  const listeners = [];
  let keyRejected = false;

  // the old TMDB-only cache isn't used any more
  try {
    localStorage.removeItem("mn:tmdbScores");
  } catch (e) {}

  /* ---------------- OMDb key + daily budget ---------------- */

  function omdbKey() {
    let k = "";
    try {
      k = localStorage.getItem(KEYS.omdbKey) || "";
    } catch (e) {}
    if (!k.trim() && window.MN_CONFIG) k = MN_CONFIG.OMDB_KEY || "";
    return k.trim();
  }

  function omdbEnabled() {
    return !!omdbKey() && !keyRejected;
  }

  function today() {
    return new Date().toISOString().slice(0, 10); // OMDb counts per day
  }

  function budget() {
    const b = Store.read(KEYS.budget, null);
    return b && b.day === today() ? b : { day: today(), used: 0, blocked: false };
  }

  function canSpend() {
    const b = budget();
    return !b.blocked && b.used < DAILY_BUDGET;
  }

  function spend() {
    const b = budget();
    b.used++;
    Store.write(KEYS.budget, b);
  }

  function block() {
    const b = budget();
    b.blocked = true;
    Store.write(KEYS.budget, b);
  }

  /* ---------------- cache helpers ---------------- */

  function refOf(item) {
    if (item.tmdbId && item.tmdbMedia) return `${item.tmdbMedia}-${item.tmdbId}`;
    const l = links[item.id];
    return l ? l.ref : null;
  }

  function setLink(libId, ref) {
    links[libId] = { ref, at: Date.now() };
    Store.write(KEYS.links, links);
  }

  function entry(ref) {
    return ref && ref !== "none" ? ratings[ref] || null : null;
  }

  function saveEntry(ref, e) {
    ratings[ref] = e;
    Store.write(KEYS.ratings, ratings);
  }

  // TMDB score we already know (e.g. from a Discover card), so it shows at once
  function seed(ref, tmdbScore, imdbId) {
    if (!ref) return;
    const e = ratings[ref] || {};
    if (tmdbScore !== undefined && !e.tmdbAt) {
      e.tmdb = tmdbScore;
      e.tmdbAt = Date.now();
    }
    if (imdbId && !e.imdbId) e.imdbId = imdbId;
    saveEntry(ref, e);
  }

  /* ---------------- what to show ---------------- */

  // { kind: "imdb" | "tmdb" | "loading" | "none", value, rt, votes }
  function display(item) {
    const ref = refOf(item);
    const e = entry(ref);
    if (e && typeof e.imdb === "number") return { kind: "imdb", value: e.imdb, rt: e.rt || null, votes: e.votes || null };
    if (e && typeof e.tmdb === "number") return { kind: "tmdb", value: e.tmdb, rt: null };
    if (ref === "none" || (e && e.tmdbAt && (!omdbDue(e) || !canSpend()))) return { kind: "none" };
    return { kind: window.TMDB && TMDB.enabled() ? "loading" : "none" };
  }

  function omdbDue(e) {
    if (!omdbEnabled() || !e || !e.imdbId) return false;
    if (!e.omdb) return true; // never looked up (or waiting since the budget ran out)
    if (e.omdb === "ok") return Date.now() - e.omdbAt > IMDB_MAX_AGE;
    return Date.now() - e.omdbAt > NONE_RETRY;
  }

  // Does this card still need something fetched?
  function needsWork(item) {
    if (!(window.TMDB && TMDB.enabled())) return false;
    const ref = refOf(item);
    if (!ref) return true;
    if (ref === "none") return Date.now() - (links[item.id] || {}).at > NONE_RETRY;
    const e = entry(ref);
    if (!e || !e.tmdbAt || !("imdbId" in e) || Date.now() - e.tmdbAt > TMDB_MAX_AGE) return true;
    return omdbDue(e) && canSpend();
  }

  /* ---------------- fetching (a few at a time, in the background) ---------------- */

  const queue = [];
  const queued = new Set();
  let running = 0;

  function request(item) {
    if (!needsWork(item) || queued.has(item.id)) return;
    queued.add(item.id);
    queue.push(item);
    pump();
  }

  function pump() {
    while (running < 4 && queue.length) {
      const item = queue.shift();
      running++;
      work(item)
        .catch((e) => console.warn("Ratings:", item.title, e.message))
        .finally(() => {
          running--;
          queued.delete(item.id);
          notify(item.id);
          pump();
        });
    }
  }

  async function work(item) {
    let ref = refOf(item);
    if (!ref || (ref === "none" && needsWork(item))) {
      const match = await TMDB.findMatch(item);
      ref = match ? `${match.media}-${match.id}` : "none";
      setLink(item.id, ref);
      if (match && match.score !== undefined) seed(ref, match.score);
    }
    if (ref === "none") return;
    const e = await refresh(ref);
    // titles added by hand have no genres yet: fill them in from TMDB
    const current = Store.get(item.id);
    if (current && !(current.genres && current.genres.length) && e && e.genres && e.genres.length) Store.update(item.id, { genres: e.genres });
  }

  // Bring one TMDB entry up to date: TMDB score + IMDb id, then the IMDb rating
  async function refresh(ref) {
    const [media, id] = ref.split("-");
    const e = ratings[ref] || {};
    if (!e.tmdbAt || !("imdbId" in e) || Date.now() - e.tmdbAt > TMDB_MAX_AGE) {
      const basic = await TMDB.basic(media, Number(id));
      e.tmdb = basic.score;
      e.imdbId = basic.imdbId;
      e.genres = basic.genres;
      e.tmdbAt = Date.now();
      saveEntry(ref, e);
    }
    if (omdbDue(e) && canSpend()) await lookupImdb(ref, e);
    return ratings[ref];
  }

  async function lookupImdb(ref, e) {
    spend();
    const url = `${OMDB}?apikey=${encodeURIComponent(omdbKey())}&i=${encodeURIComponent(e.imdbId)}`;
    const res = await fetch(url);
    let data = null;
    try {
      data = await res.json();
    } catch (err) {}

    if (!data || data.Response === "False") {
      const msg = (data && data.Error) || `HTTP ${res.status}`;
      if (/limit/i.test(msg)) return block(); // stays "waiting": upgraded on a later day
      if (/invalid api key|no api key/i.test(msg)) {
        keyRejected = true;
        console.warn("OMDb rejected the API key:", msg);
        return;
      }
      e.omdb = "none"; // e.g. IMDb doesn't know this id
      e.omdbAt = Date.now();
      return saveEntry(ref, e);
    }

    const imdb = parseFloat(data.imdbRating);
    const rt = (data.Ratings || []).find((r) => r.Source === "Rotten Tomatoes");
    e.imdb = isNaN(imdb) ? null : imdb;
    e.votes = data.imdbVotes && data.imdbVotes !== "N/A" ? data.imdbVotes : null;
    e.rt = rt ? rt.Value : null;
    // for the X-Ray section on title pages
    e.awards = data.Awards && data.Awards !== "N/A" ? data.Awards : null;
    e.boxOffice = data.BoxOffice && data.BoxOffice !== "N/A" ? data.BoxOffice : null;
    e.omdb = isNaN(imdb) ? "none" : "ok";
    e.omdbAt = Date.now();
    saveEntry(ref, e);
  }

  // For a title page of something not in the library: get its ratings now
  async function forRef(ref) {
    try {
      return await refresh(ref);
    } catch (e) {
      console.warn("Ratings:", ref, e.message);
      return ratings[ref] || null;
    }
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function notify(libId) {
    listeners.forEach((fn) => fn(libId));
  }

  function status() {
    const b = budget();
    return { enabled: omdbEnabled(), keyRejected, used: b.used, limit: DAILY_BUDGET, blocked: b.blocked, cached: Object.keys(ratings).length };
  }

  window.Ratings = { display, needsWork, request, forRef, seed, setLink, refOf, entry, onChange, status, omdbEnabled };
})();
