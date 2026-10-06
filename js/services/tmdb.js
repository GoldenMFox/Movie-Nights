/*
 * TMDB (themoviedb.org) integration.
 * The key comes from js/config.js, or from Settings (this browser only).
 * It powers the Discover page, overviews / cast / trailers on title pages,
 * recommendations, and poster search when adding a title.
 * The rest of the site works without it.
 */
(function () {
  const API = "https://api.themoviedb.org/3";
  const CACHE_LIMIT = 800; // title pages, franchises and recommendations kept in this browser
  const DETAILS_MAX_AGE = 7 * 24 * 3600 * 1000; // streaming services change, so refresh weekly
  const ANIMATION = 16; // TMDB genre id
  const NOT_SHOWS = "10763|10764|10766|10767"; // News, Reality, Soap, Talk

  // One genre list for movies and TV. TMDB uses different ids for TV, and merges
  // some genres there ("Action & Adventure", "Sci-Fi & Fantasy", "War & Politics").
  // TMDB has no Horror / Romance / Thriller / History / Music genre for TV shows.
  const GENRES = [
    // name, movie id, tv id
    ["Action", 28, 10759],
    ["Adventure", 12, 10759],
    ["Animation", 16, 16],
    ["Comedy", 35, 35],
    ["Crime", 80, 80],
    ["Documentary", 99, 99],
    ["Drama", 18, 18],
    ["Family", 10751, 10751],
    ["Fantasy", 14, 10765],
    ["History", 36, null],
    ["Horror", 27, null],
    ["Kids", null, 10762],
    ["Music", 10402, null],
    ["Mystery", 9648, 9648],
    ["Romance", 10749, null],
    ["Science Fiction", 878, 10765],
    ["Thriller", 53, null],
    ["War", 10752, 10768],
    ["Western", 37, 37],
  ];

  // TMDB genre ids -> genre names, e.g. [10759, 18] (tv) -> ["Action", "Adventure", "Drama"]
  function genreNames(ids, media) {
    const col = media === "movie" ? 1 : 2;
    const names = [];
    (ids || []).forEach((id) => GENRES.forEach((g) => g[col] === id && !names.includes(g[0]) && names.push(g[0])));
    return names;
  }

  // genres TMDB can search for this type ("movie" | "tv" | "anime")
  function genresFor(type) {
    const col = type === "movie" ? 1 : 2;
    return GENRES.filter((g) => g[col] && !(type === "anime" && g[0] === "Animation")).map((g) => g[0]);
  }

  const CATEGORIES = {
    trending: { label: "Trending this week", path: "/trending/all/week" },
    // Explore (movies-explore.html, tv-explore.html): one kind each
    "trending-movies": { label: "Trending this week", path: "/trending/movie/week", media: "movie" },
    "trending-tv": { label: "Trending this week", path: "/trending/tv/week", media: "tv" },
    // shows with an episode this week or next (soaps, talk shows, news and reality left out)
    "airing-tv": {
      label: "On the air",
      path: "/discover/tv",
      media: "tv",
      params: { sort_by: "popularity.desc", without_genres: `${NOT_SHOWS}|${ANIMATION}`, "vote_count.gte": 30 },
      airing: true,
    },
    // shows that haven't started yet, most anticipated first
    "upcoming-tv": {
      label: "Premiering soon",
      path: "/discover/tv",
      media: "tv",
      params: { sort_by: "popularity.desc", without_genres: `${NOT_SHOWS}|${ANIMATION}` },
      futureTv: true,
    },
    "popular-movies": { label: "Popular movies", path: "/movie/popular", media: "movie" },
    // worldwide lists (only the release dates on the labels are Romania's)
    "now-playing": { label: "In cinemas", path: "/movie/now_playing", media: "movie" },
    // films whose cinema release is still ahead, most anticipated first (TMDB's own
    // "upcoming" list is mostly films already out); the date is filled in by list()
    upcoming: {
      label: "Coming soon",
      path: "/discover/movie",
      media: "movie",
      params: { sort_by: "popularity.desc", with_release_type: "2|3" },
      future: true,
    },
    // TMDB's own "top rated" lists let in titles with only a few hundred votes,
    // so these ask for well-known titles only (thousands of votes)
    "top-movies": {
      label: "Top rated movies",
      path: "/discover/movie",
      media: "movie",
      params: { sort_by: "vote_average.desc", "vote_count.gte": 8000 },
    },
    // leave out soaps, talk shows, news and reality TV, which flood TMDB's popular list
    "popular-tv": {
      label: "Popular TV",
      path: "/discover/tv",
      media: "tv",
      params: { sort_by: "popularity.desc", without_genres: NOT_SHOWS, "vote_count.gte": 50 },
    },
    "top-tv": {
      label: "Top rated TV",
      path: "/discover/tv",
      media: "tv",
      params: { sort_by: "vote_average.desc", "vote_count.gte": 3000, without_genres: NOT_SHOWS },
    },
    anime: {
      label: "Popular anime",
      path: "/discover/tv",
      media: "tv",
      params: { with_genres: ANIMATION, with_original_language: "ja", sort_by: "popularity.desc", "vote_count.gte": 150 },
    },
    "top-anime": {
      label: "Top rated anime",
      path: "/discover/tv",
      media: "tv",
      params: { with_genres: ANIMATION, with_original_language: "ja", sort_by: "vote_average.desc", "vote_count.gte": 1000 },
    },
  };

  function key() {
    let k = "";
    try {
      k = localStorage.getItem(Store.KEYS.tmdbKey) || "";
    } catch (e) {}
    if (!k.trim() && window.MN_CONFIG) k = MN_CONFIG.TMDB_KEY || "";
    return k.trim();
  }

  function enabled() {
    return !!key();
  }

  function keySource() {
    try {
      if ((localStorage.getItem(Store.KEYS.tmdbKey) || "").trim()) return "browser";
    } catch (e) {}
    return window.MN_CONFIG && MN_CONFIG.TMDB_KEY ? "config" : "";
  }

  // The same request already on its way (the title page, trivia and the soundtrack asking for
  // the same details at once): they share it instead of each going out. And none waits forever:
  // after TIMEOUT a bad connection gets a message instead of an endless spinner.
  const pending = new Map();
  const TIMEOUT = 15000;
  function request(path, params) {
    const k = key();
    if (!k) return Promise.reject(new Error("No TMDB key set"));
    const url = new URL(API + path);
    Object.entries(params || {}).forEach(([p, v]) => v != null && v !== "" && url.searchParams.set(p, v));
    const headers = {};
    // Works with both the short "API key" and the long "read access token"
    if (k.startsWith("eyJ")) headers.Authorization = `Bearer ${k}`;
    else url.searchParams.set("api_key", k);
    const id = url.toString();
    if (pending.has(id)) return pending.get(id);
    const job = (async () => {
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), TIMEOUT);
      try {
        const res = await fetch(url, { headers, signal: stop.signal });
        if (!res.ok) throw new Error(res.status === 401 ? "TMDB rejected the API key" : `TMDB error ${res.status}`);
        return await res.json();
      } catch (err) {
        if (err.name === "AbortError") throw new Error("TMDB is taking too long to answer. Check your connection and try again");
        throw err;
      } finally {
        clearTimeout(timer);
        pending.delete(id);
      }
    })();
    pending.set(id, job);
    return job;
  }

  function yearOf(date) {
    return date ? Number(String(date).slice(0, 4)) : null;
  }

  // A TMDB search/list result in the shape the site uses
  function simplify(r, mediaType) {
    const media = r.media_type || mediaType;
    const genres = r.genre_ids || (r.genres || []).map((g) => g.id);
    // Japanese animation counts as anime, series or film (e.g. "Your Name.")
    const anime = isAnime(r);
    return {
      tmdbId: r.id,
      mediaType: media,
      type: anime ? "anime" : media === "movie" ? "movie" : "tv",
      title: r.title || r.name,
      year: yearOf(r.release_date || r.first_air_date),
      released: r.release_date || r.first_air_date || "", // "2026-12-15" (Discover's "Coming soon" label)
      poster: r.poster_path || "",
      backdrop: r.backdrop_path || "",
      overview: r.overview || "",
      score: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
      popularity: r.popularity || 0,
      genres: genreNames(genres, media),
    };
  }

  const isTitle = (r) => r.media_type === "movie" || r.media_type === "tv";

  const wantRu = () => !!(window.Lang && Lang.isRu());

  // Same request twice at once: as normal, and (when movie names are set to RU)
  // in Russian, to pick up the Russian names. Returns [data, ruData | null].
  function requestWithRu(path, params) {
    return Promise.all([
      request(path, params),
      wantRu() ? request(path, Object.assign({}, params, { language: "ru-RU" })).catch(() => null) : null,
    ]);
  }

  // put the Russian names and posters onto simplified results ("titleRu", "posterRu")
  function applyRu(results, ruData, media) {
    if (!ruData || !ruData.results) return results;
    const ru = {};
    ruData.results.forEach((r) => (ru[`${r.media_type || media}-${r.id}`] = r));
    results.forEach((h) => {
      const r = ru[`${h.mediaType}-${h.tmdbId}`];
      if (!r) return;
      if (r.title || r.name) h.titleRu = r.title || r.name;
      if (r.poster_path && r.poster_path !== h.poster) h.posterRu = r.poster_path;
    });
    return results;
  }

  // Russian name and poster of one title (for library titles)
  async function ruInfo(media, id) {
    const d = await request(`/${media}/${id}`, { language: "ru-RU" });
    return { title: d.title || d.name || "", poster: d.poster_path || "" };
  }
  // Russian trailers / teasers of a title (YouTube keys, best quality first), for when RU is
  // on. Only HD ones (720p and up): a blurry Russian upload loses to the HD original.
  // Remembered for two weeks (mn:ruVideos2).
  async function ruVideos(media, id) {
    const key = `${media}-${id}`;
    const cache = Store.read("mn:ruVideos2", {});
    if (cache[key] && Date.now() - cache[key].at < 14 * 86400000) return cache[key].keys;
    const d = await request(`/${media}/${id}/videos`, { language: "ru-RU" });
    const keys = (d.results || [])
      .filter((v) => v.site === "YouTube" && /Trailer|Teaser/.test(v.type) && (v.size || 0) >= 720)
      .sort(byQuality)
      .map((v) => v.key);
    const fresh = Store.read("mn:ruVideos2", {});
    fresh[key] = { keys, at: Date.now() };
    const all = Object.keys(fresh);
    if (all.length > 400) all.sort((a, b) => fresh[a].at - fresh[b].at).slice(0, all.length - 400).forEach((k) => delete fresh[k]);
    Store.write("mn:ruVideos2", fresh);
    return keys;
  }

  // one TV season's videos: [{ key, type }] — trailers / teasers first (Russian HD ones
  // first while RU is on), then anything else TMDB has for it (clips, bloopers…), best
  // quality first. Many seasons have few or none. Kept for this visit.
  const seasonCache = new Map();
  // one episode's own videos (TMDB keeps the promos, previews, clips and behind-the-scenes of many
  // shows per episode): [{ key, name, type }], its trailer / preview first, then clips, then the
  // rest. Kept 3 days; none: []
  const EP_ORDER = ["Trailer", "Teaser", "Clip", "Recap", "Featurette", "Behind the Scenes"];
  async function episodeVideos(id, s, e) {
    const ck = `ev1:${id}-${s}-${e}`;
    const saved = await cacheGet(ck);
    if (saved && Date.now() - saved.at < 3 * 86400000) return saved.list;
    const d = await request(`/tv/${id}/season/${s}/episode/${e}/videos`, { include_video_language: "en,null" });
    const rank = (v) => (EP_ORDER.indexOf(v.type) + 1 || 9) * 10 - (v.official ? 1 : 0);
    const list = ((d && d.results) || [])
      .filter((v) => v.site === "YouTube" && v.key)
      .sort((a, b) => rank(a) - rank(b) || (b.size || 0) - (a.size || 0))
      .slice(0, 12)
      .map((v) => ({ key: v.key, name: v.name || v.type, type: v.type }));
    cacheSet(ck, { at: Date.now(), list });
    return list;
  }

  function seasonVideos(id, n) {
    const ck = `${id}-${n}-${wantRu() ? "ru" : "en"}`;
    if (seasonCache.has(ck)) return seasonCache.get(ck);
    const p = (async () => {
      const yt = (d) => ((d && d.results) || []).filter((v) => v.site === "YouTube");
      const [en, ru] = await Promise.all([
        request(`/tv/${id}/season/${n}/videos`, { include_video_language: "en,null" }),
        wantRu() ? request(`/tv/${id}/season/${n}/videos`, { language: "ru-RU" }).catch(() => null) : null,
      ]);
      const isTrailer = (v) => /Trailer|Teaser/.test(v.type);
      const list = [
        ...yt(ru).filter((v) => isTrailer(v) && (v.size || 0) >= 720).sort(byQuality),
        ...yt(en).filter(isTrailer).sort(byQuality),
        ...yt(en).filter((v) => !isTrailer(v)).sort((a, b) => (b.size || 0) - (a.size || 0)),
      ];
      const seen = new Set();
      return list.filter((v) => !seen.has(v.key) && seen.add(v.key)).map((v) => ({ key: v.key, type: v.type }));
    })();
    p.catch(() => seasonCache.delete(ck));
    seasonCache.set(ck, p);
    return p;
  }

  function isAnime(r) {
    const genres = r.genre_ids || (r.genres || []).map((g) => g.id);
    return genres.includes(ANIMATION) && (r.original_language === "ja" || (r.origin_country || []).includes("JP"));
  }

  // Search results worth showing: they need a poster, and some sign anyone knows them
  // (a vote on TMDB, or a little popularity). That drops the flood of 7-minute shorts,
  // student films and fan uploads; well-known titles, even unreleased ones, stay.
  const worthShowing = (r) => !!r.poster_path && ((r.vote_count || 0) >= 1 || (r.popularity || 0) >= 1.5);

  // Search with a type filter, for the Discover page: "all" | "movie" | "tv" | "anime"
  async function searchIn(query, type, page) {
    if (type === "movie" || type === "tv") {
      const [data, ru] = await requestWithRu(`/search/${type}`, { query, page });
      const keep = (r) => worthShowing(r) && (type !== "tv" || !(r.genre_ids || []).includes(ANIMATION)); // (TV shows: no anime, no cartoons)
      return { results: applyRu(data.results.filter(keep).map((r) => simplify(r, type)), ru, type), totalPages: data.total_pages || 1 };
    }
    if (type === "anime") {
      // anime can be a series or a film: search both, keep Japanese animation,
      // most popular first
      const [[tv, tvRu], [movie, movieRu]] = await Promise.all([requestWithRu("/search/tv", { query, page }), requestWithRu("/search/movie", { query, page })]);
      const results = tv.results
        .map((r) => [r, "tv"])
        .concat(movie.results.map((r) => [r, "movie"]))
        .filter(([r]) => isAnime(r) && worthShowing(r))
        .sort(([a], [b]) => (b.popularity || 0) - (a.popularity || 0))
        .map(([r, media]) => simplify(r, media));
      applyRu(results, tvRu, "tv");
      applyRu(results, movieRu, "movie");
      return { results, totalPages: Math.max(tv.total_pages || 1, movie.total_pages || 1) };
    }
    const [data, ru] = await requestWithRu("/search/multi", { query, page });
    return { results: applyRu(data.results.filter((r) => isTitle(r) && worthShowing(r)).map((r) => simplify(r)), ru), totalPages: data.total_pages || 1 };
  }

  // Typo-tolerant search: TMDB only finds exact words, so when nothing it returns is close
  // to what was typed, also try shorter versions of the words ("the notebok" -> "the noteb",
  // "notebo") and put the titles closest to what was typed first.
  async function searchSmart(query, type, page) {
    page = page || 1;
    const first = await searchIn(query, type, page);
    if (page > 1 || !window.Lang || !Lang.words) return first;

    const typed = Lang.words(query);
    const phrase = typed.join(" ");
    const exact = first.results.filter((r) => [r.title, r.titleRu].some((n) => n && Lang.words(n).join(" ").includes(phrase)));
    // (few results also get a second try: "interstelar" exactly matches an obscure film,
    // but you most likely meant Interstellar; a well-known exact match needs no second try)
    const knownExact = exact.some((r) => (r.popularity || 0) >= 5);
    if ((exact.length && (first.results.length >= 5 || knownExact)) || !typed.some((w) => w.length >= 5)) return first;

    // other tries: each word on its own ("forest gump": "gump" finds Forrest Gump), long words
    // cut by 2 letters, and the longest word cut
    const cut = (w) => (w.length >= 5 ? w.slice(0, Math.max(4, w.length - 2)) : w);
    const longest = typed.slice().sort((a, b) => b.length - a.length)[0];
    const STOP = ["the", "and", "of", "a", "an", "in", "on", "to", "for", "with"];
    const single = typed.length > 1 ? typed.filter((w) => w.length >= 4 && !STOP.includes(w)) : [];
    // (and each long word cut on its own: "shawshenk redemtion" -> "shawshe" finds Shawshank)
    const singleCut = typed.filter((w) => w.length >= 5 && !STOP.includes(w)).map(cut);
    // (a typo near the end needs a shorter start: "inceptoin" -> "incept", "shawshenk" -> "shawsh")
    const stem = (w) => w.slice(0, Math.max(4, Math.ceil(w.length * 0.6)));
    const stems = typed.filter((w) => w.length >= 7 && !STOP.includes(w)).map(stem);
    const variants = [...new Set([...single, typed.map(cut).join(" "), cut(longest), ...singleCut, ...stems])].filter((v) => v && v !== phrase).slice(0, 7);
    const extra = await Promise.all(variants.map((v) => searchIn(v, type, 1).catch(() => ({ results: [] }))));

    const seen = new Set();
    const merged = [];
    [first].concat(extra).forEach((res, n) =>
      res.results.forEach((r, i) => {
        const key = `${r.mediaType}-${r.tmdbId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const close = Math.max(Lang.similarity(r.title, query), r.titleRu ? Lang.similarity(r.titleRu, query) : 0);
        merged.push({ r, close, order: n * 100 + i });
      })
    );
    // closest to what was typed first; nearly as close: the better-known title first
    merged.sort((a, b) => (Math.abs(b.close - a.close) > 0.05 ? b.close - a.close : (b.r.popularity || 0) - (a.r.popularity || 0) || a.order - b.order));
    return { results: merged.map((m) => m.r).slice(0, 20), totalPages: 1, corrected: true };
  }

  // Free-text search (Add a title form + Discover page)
  async function search(query, type, page) {
    if (type === "movie") {
      const data = await request("/search/movie", { query, page });
      return data.results.map((r) => simplify(r, "movie"));
    }
    if (type === "tv" || type === "anime") {
      const data = await request("/search/tv", { query, page });
      return data.results.map((r) => simplify(r, "tv"));
    }
    const data = await request("/search/multi", { query, page });
    return data.results.filter(isTitle).map((r) => simplify(r));
  }

  // One page of a Discover category
  async function list(category, page) {
    const c = CATEGORIES[category];
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const params = Object.assign(
      { page: page || 1 },
      c.params || {},
      c.future ? { "primary_release_date.gte": tomorrow } : {},
      c.futureTv ? { "first_air_date.gte": tomorrow } : {},
      c.airing ? { "air_date.gte": day(-6), "air_date.lte": day(7) } : {}
    );
    const [data, ru] = await requestWithRu(c.path, params);
    // "now playing" is a date window that reaches a little into the future, and a film can
    // be out in one country and not another: coming soon = not out yet, in cinemas = out
    const byDate = (r) =>
      category === "upcoming" ? !!r.release_date && r.release_date > today : category === "now-playing" ? !r.release_date || r.release_date <= today : true;
    // (titles without a poster yet are left out, like on Home's Top 10; TV lists leave out
    // animation: anime has its own page, and cartoons aren't what the TV Shows page is for; the
    // anime lists are animation themselves)
    const notCartoon = (r) => c.media !== "tv" || /anime/.test(category) || !(r.genre_ids || []).includes(ANIMATION);
    return {
      results: applyRu(data.results.filter((r) => r.poster_path && (c.media || isTitle(r)) && byDate(r) && notCartoon(r)).map((r) => simplify(r, c.media)), ru, c.media),
      totalPages: Math.min(data.total_pages || 1, 500),
    };
  }

  // Today's top 10 movies or TV shows (TMDB's daily trending list), for the home page
  async function top10(media) {
    const [data, ru] = await requestWithRu(`/trending/${media}/day`, {});
    return applyRu(
      data.results.filter((r) => r.poster_path).map((r) => simplify(r, media)),
      ru,
      media
    ).slice(0, 10);
  }

  // Browse by genre (Discover page): type "movie" | "tv" | "anime", sort "popular" | "top" | "new"
  async function byGenre(type, genre, sort, page) {
    const media = type === "movie" ? "movie" : "tv";
    const g = GENRES.find((x) => x[0] === genre);
    const id = g && g[media === "movie" ? 1 : 2];
    if (!id) return { results: [], totalPages: 1 };
    const today = new Date().toISOString().slice(0, 10);
    const params = { page: page || 1, with_genres: type === "anime" ? `${ANIMATION},${id}` : id };
    if (type === "anime") params.with_original_language = "ja";
    if (type === "tv") params.without_genres = `${NOT_SHOWS}|${ANIMATION}`; // (no anime, no cartoons)
    if (sort === "top") {
      params.sort_by = "vote_average.desc";
      params["vote_count.gte"] = type === "movie" ? 2000 : type === "tv" ? 500 : 300;
    } else if (sort === "new") {
      params.sort_by = media === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
      params[media === "movie" ? "primary_release_date.lte" : "first_air_date.lte"] = today;
      params["vote_count.gte"] = 20;
    } else {
      params.sort_by = "popularity.desc";
      params["vote_count.gte"] = type === "anime" ? 50 : 100;
    }
    const [data, ru] = await requestWithRu(`/discover/${media}`, params);
    return { results: applyRu(data.results.filter((r) => r.poster_path).map((r) => simplify(r, media)), ru, media), totalPages: Math.min(data.total_pages || 1, 500) };
  }

  async function findMatch(item) {
    if (item.tmdbId && item.tmdbMedia) return { id: item.tmdbId, media: item.tmdbMedia };
    const toMatch = (r, media) => ({
      id: r.id,
      media,
      score: r.vote_count ? Math.round(r.vote_average * 10) / 10 : null,
      votes: r.vote_count || 0,
      genres: genreNames(r.genre_ids, media),
    });
    const searchYear = async (media) => {
      const yearParam = media === "movie" ? { primary_release_year: item.year } : { first_air_date_year: item.year };
      const data = await request(`/search/${media}`, Object.assign({ query: item.title }, yearParam));
      // prefer an exact title match (e.g. "Hunger" shouldn't become "The Hunger Games")
      const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const best = data.results.find((r) => norm(r.title || r.name) === norm(item.title)) || data.results[0];
      return best ? toMatch(best, media) : null;
    };

    if (item.type === "movie") {
      const m = await searchYear("movie");
      if (m) return m;
    } else {
      // anime can be a series or a film (e.g. "A Silent Voice"): take the better-known match
      const found = (await Promise.all([searchYear("tv"), item.type === "anime" ? searchYear("movie") : null])).filter(Boolean);
      found.sort((a, b) => b.votes - a.votes);
      if (found.length) return found[0];
    }

    // nothing for that exact year: try the title alone
    const order = item.type === "movie" ? ["movie", "tv"] : ["tv", "movie"];
    for (const media of order) {
      const data = await request(`/search/${media}`, { query: item.title });
      if (data.results.length) return toMatch(data.results[0], media);
    }
    return null;
  }

  // Just the TMDB score and IMDb id of a movie / show (used by js/services/ratings.js)
  async function basic(media, id) {
    const d = await request(`/${media}/${id}`, { append_to_response: "external_ids" });
    return {
      score: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null,
      imdbId: d.imdb_id || (d.external_ids && d.external_ids.imdb_id) || null,
      genres: genreNames((d.genres || []).map((g) => g.id), media),
    };
  }
  /* ---------------- your country: streaming, age ratings, cinema dates ---------------- */

  // one country for everything (picked in Settings → Streaming, saved with your profile);
  // until you pick one, the site's default (MN_CONFIG.RELEASE_COUNTRY, Romania)
  function country() {
    const picked = window.Store && Store.getProfile ? Store.getProfile().country : "";
    return String(picked || (window.MN_CONFIG || {}).RELEASE_COUNTRY || "RO").toUpperCase();
  }
  // a saved answer is for this country ("c"; older ones, from before you could pick, were Romania's)
  const sameCountry = (s) => (s.c || "RO") === country();
  // "RO" -> "Romania"
  function countryName(code) {
    code = code || country();
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
    } catch (e) {
      return code;
    }
  }

  const LOCAL_DATES = "mn:localDates2"; // { movieId: { d: "2026-10-03" | "", at, c } }, "" = no cinema date there
  try {
    ["mn:localDates", "mn:ruVideos"].forEach((k) => localStorage.removeItem(k)); // older versions
  } catch (e) {}

  // TMDB release types: 1 premiere, 2 limited, 3 cinemas, 4 digital, 5 physical, 6 TV.
  // Only the cinema release counts: a festival premiere isn't "out", and a country's
  // TV / digital dates are often a local broadcast years later (streaming films come
  // out everywhere on their worldwide date, which is used when there's no cinema date).
  function countryDate(list) {
    const entry = (list || []).find((r) => r.iso_3166_1 === country());
    if (!entry) return "";
    return (
      entry.release_dates
        .filter((x) => (x.type === 2 || x.type === 3) && x.release_date)
        .map((x) => x.release_date.slice(0, 10))
        .sort()[0] || ""
    );
  }

  // the day a movie is out to stream / rent / buy (TMDB's "digital" release, type 4): in your
  // country, else in the US, else anywhere ("" when nobody has one)
  function digitalDate(list) {
    const of = (entry) =>
      entry
        ? entry.release_dates
            .filter((x) => x.type === 4 && x.release_date)
            .map((x) => x.release_date.slice(0, 10))
            .sort()[0] || ""
        : "";
    list = list || [];
    return of(list.find((r) => r.iso_3166_1 === country())) || of(list.find((r) => r.iso_3166_1 === "US")) || list.map(of).filter(Boolean).sort()[0] || "";
  }
  // TMDB's last / next episode, small: { date, s, e, name, runtime }
  const episodeOf = (x) => (x && x.air_date ? { date: x.air_date, s: x.season_number, e: x.episode_number, name: x.name || "", runtime: x.runtime || 0 } : null);

  // a movie's release date in your country ("" if it has none there): remembered, and
  // checked again after a few days while it isn't out yet
  async function localDate(id) {
    const saved = Store.read(LOCAL_DATES, {});
    const s = saved[id];
    const today = new Date().toISOString().slice(0, 10);
    if (s && sameCountry(s) && (Date.now() - s.at < 3 * 86400000 || (s.d && s.d <= today))) return s.d;
    const d = await request(`/movie/${id}/release_dates`);
    const date = countryDate(d.results);
    const fresh = Store.read(LOCAL_DATES, {});
    fresh[id] = { d: date, at: Date.now(), c: country() };
    const keys = Object.keys(fresh);
    if (keys.length > 800) keys.sort((a, b) => fresh[a].at - fresh[b].at).slice(0, keys.length - 800).forEach((k) => delete fresh[k]);
    Store.write(LOCAL_DATES, fresh);
    return date;
  }
  const knownLocalDate = (id) => {
    const s = Store.read(LOCAL_DATES, {})[id];
    return s && sameCountry(s) ? s.d : null;
  };

  // the release date that counts for you: movies in your country (worldwide date when
  // the country has none on TMDB), TV shows their first air date
  async function releaseDate(media, id) {
    if (media === "movie") {
      const local = await localDate(id);
      if (local) return local;
    }
    const d = await request(`/${media}/${id}`);
    return d.release_date || d.first_air_date || "";
  }

  // Best video first: trailers, then teasers; the highest quality (TMDB's "size": 360…2160);
  // official ones win a tie
  const videoRank = (v) => (v.type === "Trailer" ? 20000 : v.type === "Teaser" ? 10000 : 0) + (v.size || 0) + (v.official ? 1 : 0);
  const byQuality = (a, b) => videoRank(b) - videoRank(a);

  function pickTrailer(videos) {
    const yt = ((videos && videos.results) || []).filter((v) => v.site === "YouTube").sort(byQuality);
    return yt[0] ? yt[0].key : null;
  }

  function formatRuntime(min) {
    if (!min) return "";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h ${m}min` : `${m}min`;
  }

  /* ---------------- the cache: the browser's database (IndexedDB) ---------------- */

  // Title pages, franchises and recommendations are kept here for a week. Each one is its own
  // record, so reading or saving one never touches the others (it used to be one big
  // localStorage block, read and rewritten whole every time). Oldest records go first
  // past CACHE_LIMIT. No database (some private windows): kept for this visit only.
  const DB_NAME = "mn-cache";
  const STORE_NAME = "tmdb";
  const mem = new Map();
  let dbPromise = null;
  try {
    localStorage.removeItem(Store.KEYS.tmdbCache); // the old localStorage cache
  } catch (e) {}

  function db() {
    if (!dbPromise)
      dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: "k" }).createIndex("at", "at");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    return dbPromise;
  }

  async function cacheGet(key) {
    if (mem.has(key)) return mem.get(key);
    const d = await db();
    if (!d) return null;
    return new Promise((resolve) => {
      try {
        const req = d.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
        req.onsuccess = () => {
          const v = req.result ? req.result.v : null;
          if (v) mem.set(key, v);
          resolve(v);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  let writes = 0;
  async function cacheSet(key, value) {
    mem.set(key, value);
    const d = await db();
    if (!d) return;
    try {
      d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ k: key, at: Date.now(), v: value });
    } catch (e) {}
    if (++writes % 25 === 1) trimCache(d);
  }

  // past the limit: delete the oldest records
  function trimCache(d) {
    try {
      const store = d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
      const count = store.count();
      count.onsuccess = () => {
        let extra = count.result - CACHE_LIMIT;
        if (extra <= 0) return;
        store.index("at").openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (!cur || extra-- <= 0) return;
          cur.delete();
          cur.continue();
        };
      };
    } catch (e) {}
  }

  // Settings → Remove key: start over
  async function clearCache() {
    mem.clear();
    const d = await db();
    try {
      if (d) d.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
    } catch (e) {}
  }

  // a title's details depend on your country (streaming services, age rating)
  const detailsKey = (media, id) => `d4:${country()}:${media}-${id}`; // d4: release dates, episodes, keywords, more pictures

  function certificationOf(d, media, country) {
    if (media === "movie") {
      const all = (d.release_dates && d.release_dates.results) || [];
      for (const c of [country, "US"]) {
        const entry = all.find((r) => r.iso_3166_1 === c);
        const rel = entry && entry.release_dates.find((x) => x.certification);
        if (rel) return rel.certification;
      }
      return "";
    }
    const all = (d.content_ratings && d.content_ratings.results) || [];
    const entry = all.find((r) => r.iso_3166_1 === country) || all.find((r) => r.iso_3166_1 === "US");
    return (entry && entry.rating) || "";
  }

  // where to watch it (data by JustWatch, via TMDB)
  function providersOf(d, country) {
    const all = (d["watch/providers"] && d["watch/providers"].results) || {};
    const here = all[country] || all.US;
    if (!here) return null;
    const pack = (list) => (list || []).slice(0, 6).map((p) => ({ name: p.provider_name, logo: p.logo_path }));
    const stream = pack(here.flatrate);
    return {
      country: all[country] ? country : "US",
      link: here.link || "",
      kind: stream.length ? "stream" : "rent",
      list: stream.length ? stream : pack((here.rent || []).concat(here.buy || [])).filter((p, i, a) => a.findIndex((x) => x.name === p.name) === i),
    };
  }

  // Full details for a TMDB movie / show (cached for a week)
  async function detailsById(media, id) {
    const cacheKey = detailsKey(media, id);
    const cached = await cacheGet(cacheKey);
    if (cached && Date.now() - cached.savedAt < DETAILS_MAX_AGE) return withRuNames(cached, media, id);

    const where = country();
    const d = await request(`/${media}/${id}`, {
      append_to_response: `videos,credits,recommendations,external_ids,images,reviews,watch/providers,keywords,${media === "movie" ? "release_dates" : "content_ratings"}`,
      include_image_language: "en,null",
    });
    // Many TV shows keep their trailers on the seasons, not the show (Breaking Bad has
    // none of its own): then take season 1's videos, or the latest season's
    if (media === "tv" && !((d.videos && d.videos.results) || []).some((v) => v.site === "YouTube")) {
      const seasons = [...new Set([1, d.number_of_seasons].filter((n) => n > 0))];
      for (const n of seasons) {
        try {
          const s = await request(`/tv/${id}/season/${n}/videos`);
          if ((s.results || []).some((v) => v.site === "YouTube")) {
            d.videos = s;
            break;
          }
        } catch (e) {}
      }
    }
    const crew = (d.credits && d.credits.crew) || [];
    const base = simplify(d, media);

    const result = Object.assign(base, {
      media,
      genres: genreNames((d.genres || []).map((g) => g.id), media),
      runtime:
        media === "movie"
          ? formatRuntime(d.runtime)
          : [d.number_of_seasons ? `${d.number_of_seasons} season${d.number_of_seasons > 1 ? "s" : ""}` : "", formatRuntime((d.episode_run_time || [])[0])]
              .filter(Boolean)
              .join(" · "),
      director: media === "movie" ? crew.filter((c) => c.job === "Director").map((c) => c.name).join(", ") : (d.created_by || []).map((c) => c.name).join(", "),
      directorLabel: media === "movie" ? "Director" : "Created by",
      // the same people with their TMDB ids (for links to their pages)
      directorPeople: (media === "movie" ? crew.filter((c) => c.job === "Director") : d.created_by || []).map((c) => ({ id: c.id, name: c.name })),
      trailer: pickTrailer(d.videos),
      // TV: the seasons (for the Seasons section: each one's trailer)
      seasons:
        media === "tv"
          ? (d.seasons || [])
              .filter((s) => s.season_number > 0)
              .map((s) => ({ n: s.season_number, name: s.name || `Season ${s.season_number}`, poster: s.poster_path || "", year: yearOf(s.air_date), episodes: s.episode_count || 0 }))
          : [],
      cast: ((d.credits && d.credits.cast) || []).slice(0, 12).map((c) => ({ id: c.id, name: c.name, character: c.character, photo: c.profile_path || "" })),
      tmdbScore: base.score,
      imdbId: d.imdb_id || (d.external_ids && d.external_ids.imdb_id) || null,
      recommendations: ((d.recommendations && d.recommendations.results) || [])
        .filter((r) => r.poster_path)
        .slice(0, 16)
        .map((r) => simplify(r, r.media_type || media)),
      certification: certificationOf(d, media, where),
      providers: providersOf(d, where),
      videos: ((d.videos && d.videos.results) || [])
        .filter((v) => v.site === "YouTube")
        .sort(byQuality)
        .slice(0, 12)
        .map((v) => ({ key: v.key, name: v.name, type: v.type })),
      // the scenes themselves first (pictures with no words on them: stills from the film), up to 40,
      // then a few of the promotional ones with the title on them
      images: (() => {
        const all = (d.images && d.images.backdrops) || [];
        return all
          .filter((i) => !i.iso_639_1)
          .slice(0, 40)
          .concat(all.filter((i) => i.iso_639_1).slice(0, 4))
          .map((i) => i.file_path);
      })(),
      // poster art without the title printed on it: used as the tall header image on phones
      artPoster: (((d.images && d.images.posters) || []).find((p) => p.iso_639_1 === null) || {}).file_path || "",
      // (TMDB lists them oldest first: the newest 10 of them, newest first)
      reviews: ((d.reviews && d.reviews.results) || []).slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 10).map((r) => ({
        author: r.author || (r.author_details && r.author_details.username) || "TMDB user",
        rating: r.author_details && r.author_details.rating,
        date: (r.created_at || "").slice(0, 10),
        text: (r.content || "").length > 1200 ? r.content.slice(0, 1200) + "…" : r.content || "",
        url: r.url || "",
      })),
      tmdbUrl: `https://www.themoviedb.org/${media}/${id}`,
      // who wrote what it's based on (crew "Novel", "Book", "Comic Book"…): Books' "Based on"
      sourceAuthors: crew
        .filter((c) => /^(Novel|Book|Author|Short Story|Original Story|Comic Book|Graphic Novel|Characters|Story|Play|Memoir|Article)$/i.test(c.job))
        .map((c) => ({ name: c.name, job: c.job }))
        .filter((c, i, list) => list.findIndex((x) => x.name === c.name) === i)
        .slice(0, 4),
      // what it's about, in TMDB's words ("based on novel or book", "space"…): Books
      keywords: (((d.keywords && (d.keywords.keywords || d.keywords.results)) || []).map((k) => ({ id: k.id, name: k.name }))).slice(0, 40),
      originalTitle: d.original_title || d.original_name || "",
      // the franchise it belongs to (e.g. "Harry Potter Collection"): the Collection section
      collection: d.belongs_to_collection ? { id: d.belongs_to_collection.id, name: d.belongs_to_collection.name } : null,
      // X-Ray: behind-the-scenes facts
      xray: {
        tagline: d.tagline || "",
        budget: d.budget || 0,
        revenue: d.revenue || 0,
        status: d.status || "",
        released: d.release_date || d.first_air_date || "",
        lastAir: d.last_air_date || "",
        episodes: d.number_of_episodes || 0,
        // release dates (title page: Released / Coming soon / Not announced yet)
        //  movies: the cinema date in your country, and when it's out to stream / buy
        local: media === "movie" ? countryDate(d.release_dates && d.release_dates.results) : "",
        digital: media === "movie" ? digitalDate(d.release_dates && d.release_dates.results) : "",
        //  shows: seasons, the episode that aired last and the next one (TVmaze may know newer)
        seasons: d.number_of_seasons || 0,
        inProduction: !!d.in_production,
        type: d.type || "",
        lastEp: episodeOf(d.last_episode_to_air),
        nextEp: episodeOf(d.next_episode_to_air),
        language: d.original_language || "",
        languages: (d.spoken_languages || []).map((l) => l.english_name || l.name).filter(Boolean).slice(0, 4),
        // with their codes (for flags) and logos
        countries: (d.production_countries || (d.origin_country || []).map((c) => ({ iso_3166_1: c, name: c })))
          .map((c) => ({ code: (c.iso_3166_1 || "").toLowerCase(), name: c.name || c.iso_3166_1 }))
          .filter((c) => c.code)
          .slice(0, 4),
        companies: (d.production_companies || []).map((c) => ({ name: c.name, logo: c.logo_path || "" })).slice(0, 4),
        networks: (d.networks || []).map((n) => ({ name: n.name, logo: n.logo_path || "" })).slice(0, 3),
      },
      savedAt: Date.now(),
    });
    cacheSet(cacheKey, result);
    return withRuNames(result, media, id);
  }

  // RU mode: add the Russian name of the title and of its recommendations (saved with the details)
  async function withRuNames(result, media, id) {
    if (!wantRu() || result.ruDone2) return result;
    try {
      const ru = await request(`/${media}/${id}`, { language: "ru-RU", append_to_response: "recommendations" });
      result.titleRu = ru.title || ru.name || "";
      if (ru.poster_path && ru.poster_path !== result.poster) result.posterRu = ru.poster_path;
      applyRu(result.recommendations || [], ru.recommendations, media);
      result.ruDone2 = true;
      cacheSet(detailsKey(media, id), result);
    } catch (e) {}
    return result;
  }

  // Details for an item in your library (finds it on TMDB first)
  async function details(item) {
    // reuse the TMDB match js/services/ratings.js already found, if any
    let ref = window.Ratings ? Ratings.refOf(item) : null;
    if (!ref) {
      const match = await findMatch(item);
      ref = match ? `${match.media}-${match.id}` : "none";
      if (window.Ratings) Ratings.setLink(item.id, ref);
    }
    if (ref === "none") return null;
    const [media, id] = ref.split("-");
    const d = await detailsById(media, Number(id));
    if (d && window.Ratings) Ratings.seed(ref, d.tmdbScore, d.imdbId);
    return d;
  }

  /* ---------------- people (cast pages) ---------------- */

  const NOT_ACTING = /^(self|himself|herself|themselves|narrator|host|guest|various)\b/i;
  const TALK_NEWS = [10763, 10764, 10767]; // news, reality, talk shows

  // One person: bio, photos and everything they were in (kept for this visit)
  async function person(id) {
    const key = `mn:person2:${id}:${Lang.get()}`;
    try {
      const c = JSON.parse(sessionStorage.getItem(key) || "null");
      if (c) return c;
    } catch (e) {}
    const [d, ru] = await Promise.all([
      request(`/person/${id}`, { append_to_response: "combined_credits,images,external_ids" }),
      wantRu() ? request(`/person/${id}/combined_credits`, { language: "ru-RU" }).catch(() => null) : null,
    ]);
    const ruNames = {};
    if (ru) (ru.cast || []).concat(ru.crew || []).forEach((r) => (ruNames[`${r.media_type}-${r.id}`] = r.title || r.name));

    // the same title can appear several times (several roles / jobs): keep one, with
    // the characters played, the jobs done and the departments ("Acting", "Directing",
    // "Production", "Writing"…) collected
    const byTitle = new Map();
    const add = (r, kind) => {
      if (r.media_type !== "movie" && r.media_type !== "tv") return;
      const k = `${r.media_type}-${r.id}`;
      let t = byTitle.get(k);
      if (!t) {
        t = Object.assign(simplify(r, r.media_type), {
          characters: [],
          jobs: [],
          depts: [],
          kind,
          popularity: r.popularity || 0,
          votes: r.vote_count || 0,
          episodes: 0,
          talk: (r.genre_ids || []).some((g) => TALK_NEWS.includes(g)),
        });
        if (ruNames[k]) t.titleRu = ruNames[k];
        byTitle.set(k, t);
      }
      const dept = kind === "cast" ? "Acting" : r.department || "Crew";
      if (!t.depts.includes(dept)) t.depts.push(dept);
      if (kind === "cast") {
        t.kind = "cast";
        if (r.character && !t.characters.includes(r.character)) t.characters.push(r.character);
        t.self = NOT_ACTING.test(r.character || "");
        t.episodes = Math.max(t.episodes, r.episode_count || 0);
      } else if (r.job && !t.jobs.includes(r.job)) t.jobs.push(r.job);
    };
    const credits = d.combined_credits || {};
    (credits.cast || []).forEach((r) => add(r, "cast"));
    (credits.crew || []).forEach((r) => add(r, "crew"));
    const titles = [...byTitle.values()];

    const out = {
      id: d.id,
      name: d.name,
      photo: d.profile_path || "",
      bio: d.biography || "",
      birthday: d.birthday || "",
      deathday: d.deathday || "",
      place: d.place_of_birth || "",
      department: d.known_for_department || "",
      aka: (d.also_known_as || []).slice(0, 4),
      photos: ((d.images && d.images.profiles) || []).map((p) => p.file_path).slice(0, 20),
      imdbId: (d.external_ids && d.external_ids.imdb_id) || d.imdb_id || "",
      instagram: (d.external_ids && d.external_ids.instagram_id) || "",
      titles,
      tmdbUrl: `https://www.themoviedb.org/person/${d.id}`,
    };
    try {
      sessionStorage.setItem(key, JSON.stringify(out));
    } catch (e) {}
    return out;
  }

  // a person by name (library titles store their cast without TMDB ids)
  async function findPerson(name) {
    const d = await request("/search/person", { query: name });
    const hit = (d.results || [])[0];
    return hit ? hit.id : null;
  }

  async function test() {
    await request("/configuration");
    return true;
  }

  /* ---------------- import, streaming services, what's coming ---------------- */

  // a title by its IMDb id ("tt0816692"), for importing an IMDb export
  async function findByImdb(imdbId) {
    const d = await request(`/find/${imdbId}`, { external_source: "imdb_id" });
    const r = (d.movie_results || [])[0] ? { r: d.movie_results[0], media: "movie" } : (d.tv_results || [])[0] ? { r: d.tv_results[0], media: "tv" } : null;
    return r ? simplify(r.r, r.media) : null;
  }

  // a film by its name and year (Letterboxd exports have no ids): exact name first
  async function findFilm(title, year) {
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const params of [{ query: title, primary_release_year: year }, { query: title }]) {
      if (!params.primary_release_year && !year) continue;
      const d = await request("/search/movie", params);
      const list = d.results || [];
      const best = list.find((r) => norm(r.title) === norm(title) || norm(r.original_title) === norm(title)) || list[0];
      if (best) return simplify(best, "movie");
    }
    return null;
  }

  // streaming services (subscription) a title is on in your country: [{ id, name, logo }]
  async function providersFor(media, id) {
    const d = await request(`/${media}/${id}/watch/providers`);
    const here = (d.results || {})[country()];
    return ((here && here.flatrate) || []).map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path }));
  }

  // every streaming service in your country, most popular first (to pick yours)
  async function providerCatalog() {
    const where = country();
    const [m, t] = await Promise.all([
      request("/watch/providers/movie", { watch_region: where }),
      request("/watch/providers/tv", { watch_region: where }),
    ]);
    const seen = new Map();
    (m.results || []).concat(t.results || []).forEach((p) => {
      const prio = (p.display_priorities || {})[where] ?? p.display_priority ?? 999;
      const old = seen.get(p.provider_id);
      if (!old || prio < old.prio) seen.set(p.provider_id, { id: p.provider_id, name: p.provider_name, logo: p.logo_path, prio });
    });
    // the big ones first (TMDB's own order puts niche services high), without the
    // "… Amazon Channel" / "with Ads" copies of the same service
    const BIG = /^(netflix|hbo max|max|amazon prime video|disney plus|apple tv\+?|apple tv plus|skyshowtime|voyo|paramount\+?|paramount plus|crunchyroll|mubi|antena play|youtube premium|google play movies|canal\+.*|orange tv.*|focus sat.*)$/i;
    return [...seen.values()]
      .filter((p) => !/channel|with ads|amazon video$/i.test(p.name))
      .sort((a, b) => (BIG.test(b.name) ? 1 : 0) - (BIG.test(a.name) ? 1 : 0) || a.prio - b.prio);
  }

  // what's next for a title: a movie's release date (in your country), a show's next
  // episode. { date: "2026-10-12", kind: "release" | "episode", season, episode } or null
  async function nextUp(media, id) {
    if (media === "movie") {
      const date = await releaseDate("movie", id);
      return date ? { date, kind: "release" } : null;
    }
    const d = await request(`/tv/${id}`);
    const n = d.next_episode_to_air;
    // (the episode that aired last too: an alert for it isn't missed on a day the site wasn't open)
    const l = d.last_episode_to_air;
    const last = l && l.air_date ? { date: l.air_date, season: l.season_number, episode: l.episode_number } : null;
    if (n && n.air_date) return { date: n.air_date, kind: "episode", season: n.season_number, episode: n.episode_number, last };
    if (d.first_air_date && d.first_air_date > new Date().toISOString().slice(0, 10)) return { date: d.first_air_date, kind: "release" };
    return last ? { date: "", kind: "episode", last } : null;
  }

  // a franchise: every film in it, in release order (kept a week)
  async function collection(id) {
    const key = `col:${id}`;
    const cached = await cacheGet(key);
    if (cached && Date.now() - cached.savedAt < DETAILS_MAX_AGE) return cached;
    const d = await request(`/collection/${id}`);
    const result = {
      id,
      name: d.name || "",
      parts: (d.parts || [])
        .filter((p) => p.poster_path || p.release_date)
        .sort((a, b) => (a.release_date || "9999").localeCompare(b.release_date || "9999"))
        .map((p) => simplify(p, "movie")),
      savedAt: Date.now(),
    };
    cacheSet(key, result);
    return result;
  }

  // "Because you liked …" (Home): TMDB's recommendations for a title, well-known ones only
  // (enough votes that most people have heard of them), two pages deep, kept a week
  const KNOWN_VOTES = { movie: 2000, tv: 500 };
  async function knownRecommendations(media, id) {
    const key = `rec3:${media}-${id}`; // rec3: best-known first
    const cached = await cacheGet(key);
    if (cached && Date.now() - cached.savedAt < DETAILS_MAX_AGE) return cached.results;
    const pages = await Promise.all([1, 2].map((page) => request(`/${media}/${id}/recommendations`, { page }).catch(() => ({ results: [] }))));
    const seen = new Set();
    const results = pages
      .flatMap((p) => p.results || [])
      .filter((r) => r.poster_path && (r.vote_count || 0) >= KNOWN_VOTES[r.media_type === "tv" ? "tv" : "movie"])
      .filter((r) => !seen.has(`${r.media_type}-${r.id}`) && seen.add(`${r.media_type}-${r.id}`))
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)) // the best-known first
      .map((r) => simplify(r, r.media_type || media));
    cacheSet(key, { results, savedAt: Date.now() });
    return results;
  }

  /* ---------------- Box Office page ----------------
     TMDB's worldwide gross ("revenue") and budget, in US dollars, not adjusted for inflation.
     A film's two numbers: all of them in one cached record ("bo:films", { id: [budget, gross, at] }),
     so a big library doesn't push the title pages out of the cache. New films (under a year)
     are asked again after 3 days (their gross still grows), older ones after a month. */
  let boFilms = null;
  let boSave = null;
  async function boMap() {
    if (!boFilms) boFilms = (await cacheGet("bo:films")) || {};
    return boFilms;
  }
  function boStore() {
    clearTimeout(boSave);
    boSave = setTimeout(() => cacheSet("bo:films", boFilms), 400);
  }
  // { budget, revenue } of one film (0 = TMDB doesn't know)
  async function boxOfficeOf(id, released) {
    const map = await boMap();
    const had = map[id];
    const age = released ? Date.now() - new Date(released).getTime() : 0;
    const fresh = released && age < 365 * 86400000 ? 3 * 86400000 : 30 * 86400000;
    if (had && Date.now() - had[2] < fresh) return { budget: had[0], revenue: had[1] };
    // the film facts (Profile, Wrapped, the tier list) already hold its budget and gross: no
    // need to ask TMDB again. (A film over two years old doesn't earn any more: facts up to
    // half a year old will do; a newer one needs fresh numbers.)
    const f = (await factsAll())[`movie-${id}`];
    if (f && (f.b || f.v) && Date.now() - f.at < (age > 2 * 365 * 86400000 ? 180 * 86400000 : fresh)) {
      map[id] = [f.b || 0, f.v || 0, f.at];
      boStore();
      return { budget: f.b || 0, revenue: f.v || 0 };
    }
    const d = await request(`/movie/${id}`);
    map[id] = [d.budget || 0, d.revenue || 0, Date.now()];
    boStore();
    return { budget: d.budget || 0, revenue: d.revenue || 0 };
  }
  // a few at a time
  async function mapLimit(list, n, fn) {
    const out = new Array(list.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(n, list.length) }, async () => {
        while (next < list.length) {
          const i = next++;
          out[i] = await fn(list[i], i);
        }
      })
    );
    return out;
  }
  // the highest-grossing films worldwide: all time, or of one year, of one genre ("Action").
  // 20 a page with their budget and gross (kept a day)
  // (company: a studio's TMDB id, e.g. 420 = Marvel Studios)
  // (after / before: release dates, "1990-01-01" / "1989-12-31": the classics for the inflation-adjusted chart)
  async function boxOffice({ year, genre, page, company, after, before } = {}) {
    const g = genre && GENRES.find((x) => x[0] === genre);
    const key = `bo:list:${year || "all"}:${g ? g[1] : "all"}:${company || "any"}:${after || ""}-${before || ""}:${page || 1}:${wantRu() ? "ru" : "en"}`;
    const cached = await cacheGet(key);
    if (cached && Date.now() - cached.savedAt < 86400000) return cached;
    const [d, ru] = await requestWithRu("/discover/movie", {
      sort_by: "revenue.desc",
      primary_release_year: year || "",
      with_genres: g ? g[1] : "",
      with_companies: company || "",
      "primary_release_date.gte": after || "",
      "primary_release_date.lte": before || "",
      page: page || 1,
    });
    const films = await mapLimit(d.results || [], 5, async (r) => {
      const n = await boxOfficeOf(r.id, r.release_date).catch(() => null);
      return n && n.revenue > 0 ? Object.assign(simplify(r, "movie"), n) : null;
    });
    const result = { results: applyRu(films.filter(Boolean), ru, "movie"), totalPages: Math.min(d.total_pages || 1, 25), savedAt: Date.now() };
    cacheSet(key, result);
    return result;
  }

  // a franchise's films that are out, in release order, with their budget and gross
  async function franchiseBoxOffice(id) {
    const c = await collection(id);
    const today = new Date().toISOString().slice(0, 10);
    const films = await mapLimit(c.parts.filter((p) => p.released && p.released <= today), 5, async (p) => {
      const n = await boxOfficeOf(p.tmdbId, p.released).catch(() => null);
      return n && n.revenue > 0 ? Object.assign({}, p, n) : null;
    });
    return { name: c.name, results: films.filter(Boolean) };
  }
  // franchises by name: [{ id, name, poster }]
  async function searchCollections(query) {
    const d = await request("/search/collection", { query });
    return (d.results || []).slice(0, 8).map((c) => ({ id: c.id, name: c.name, poster: c.poster_path || "" }));
  }
  // the films a person directed that are out, in release order, with their budget and gross
  // (their 25 best-known, so a long career doesn't mean a hundred lookups)
  async function directorBoxOffice(personId) {
    const key = `bo:dir2:${personId}:${wantRu() ? "ru" : "en"}`;
    const cached = await cacheGet(key);
    if (cached && Date.now() - cached.savedAt < 7 * 86400000) return cached;
    const [d, ru] = await Promise.all([
      request(`/person/${personId}`, { append_to_response: "movie_credits" }),
      wantRu() ? request(`/person/${personId}/movie_credits`, { language: "ru-RU" }).catch(() => null) : null,
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set();
    const directed = ((d.movie_credits && d.movie_credits.crew) || [])
      // (not concert films or documentaries)
      .filter((c) => c.job === "Director" && c.release_date && c.release_date <= today && !(c.genre_ids || []).some((g) => g === 99 || g === 10402) && !seen.has(c.id) && seen.add(c.id))
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
      .slice(0, 25);
    const films = await mapLimit(directed, 5, async (r) => {
      const n = await boxOfficeOf(r.id, r.release_date).catch(() => null);
      return n && n.revenue > 0 ? Object.assign(simplify(r, "movie"), n) : null;
    });
    const list = applyRu(films.filter(Boolean), ru && { results: ru.crew || [] }, "movie").sort((a, b) => a.released.localeCompare(b.released));
    const result = { name: d.name || "", photo: d.profile_path || "", results: list, savedAt: Date.now() };
    cacheSet(key, result);
    return result;
  }
  // directors by name: [{ id, name, photo }]
  async function searchDirectors(query) {
    const d = await request("/search/person", { query });
    return (d.results || [])
      .filter((p) => p.known_for_department === "Directing")
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name, photo: p.profile_path || "" }));
  }
  // each year's highest-grossing film (a year's #1 is kept a day while the year is recent, a month after)
  async function yearTop(year) {
    const key = `bo:top:${year}:${wantRu() ? "ru" : "en"}`;
    const cached = await cacheGet(key);
    const age = year >= new Date().getFullYear() - 1 ? 86400000 : 30 * 86400000;
    if (cached && Date.now() - cached.savedAt < age) return cached.film;
    const [d, ru] = await requestWithRu("/discover/movie", { sort_by: "revenue.desc", primary_release_year: year });
    let film = null;
    for (const r of (d.results || []).slice(0, 3)) {
      const n = await boxOfficeOf(r.id, r.release_date).catch(() => null);
      if (n && n.revenue > 0) {
        film = Object.assign(applyRu([simplify(r, "movie")], ru, "movie")[0], n);
        break;
      }
    }
    cacheSet(key, { film, savedAt: Date.now() });
    return film;
  }

  /* Film facts: the few things stats need about a title (Wrapped, achievements, trivia), light
     to ask for and kept long, all in one cache record ("facts": { "movie-603": {...} }):
     r runtime (minutes; a series: one episode), e episodes (series), y year, l language,
     k countries ["US", "GB"], g genres, d directors (a series: its creators) and c the top
     cast as [id, name, photo(, character)], f the franchise [id, name], b budget, v revenue,
     s TMDB score, at when asked. Asked again after half a year. */
  const FACTS_AGE = 180 * 86400000;
  let factsMap = null;
  let factsSave = null;
  async function factsAll() {
    if (!factsMap) factsMap = (await cacheGet("facts")) || {};
    return factsMap;
  }
  async function facts(media, id) {
    const map = await factsAll();
    const ref = `${media}-${id}`;
    const had = map[ref];
    if (had && Date.now() - had.at < FACTS_AGE) return had;
    const d = await request(`/${media}/${id}`, { append_to_response: "credits" });
    const crew = (d.credits && d.credits.crew) || [];
    const people = (list) => list.map((p) => [p.id, p.name, p.profile_path || ""]);
    const f = {
      r: (media === "movie" ? d.runtime : (d.episode_run_time || [])[0]) || 0,
      e: media === "tv" ? d.number_of_episodes || 0 : 0,
      y: yearOf(d.release_date || d.first_air_date),
      l: d.original_language || "",
      k: media === "movie" ? (d.production_countries || []).map((c) => c.iso_3166_1) : d.origin_country || [],
      g: genreNames((d.genres || []).map((g) => g.id), media),
      d: people((media === "movie" ? crew.filter((c) => c.job === "Director") : d.created_by || []).slice(0, 3)),
      c: ((d.credits && d.credits.cast) || []).slice(0, 10).map((p) => [p.id, p.name, p.profile_path || "", p.character || ""]),
      f: d.belongs_to_collection ? [d.belongs_to_collection.id, d.belongs_to_collection.name] : null,
      b: d.budget || 0,
      v: d.revenue || 0,
      s: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      at: Date.now(),
    };
    map[ref] = f;
    clearTimeout(factsSave);
    factsSave = setTimeout(() => cacheSet("facts", factsMap), 600);
    return f;
  }

  /* ---------------- Advanced search and the Awards Explorer ---------------- */

  // TMDB's discover, any filters: { results (the site's shape), totalPages, total }
  async function discover(media, params) {
    const [d, ru] = await requestWithRu(`/discover/${media}`, params);
    const results = (d.results || []).map((r) => simplify(r, media));
    return { results: applyRu(results, ru, media), totalPages: Math.min(d.total_pages || 1, 500), total: d.total_results || 0 };
  }

  // people by name, the best-known first: [{ id, name, photo, dept, known }]
  async function searchPeople(query) {
    const d = await request("/search/person", { query });
    return (d.results || [])
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        photo: p.profile_path || "",
        dept: p.known_for_department || "",
        known: (p.known_for || []).map((k) => k.title || k.name).filter(Boolean).slice(0, 2),
      }));
  }

  // a keyword's TMDB id ("black and white" -> 1417), looked up once (mn:keywords)
  async function keywordId(name) {
    const all = Store.read("mn:keywords", {});
    if (all[name]) return all[name];
    const d = await request("/search/keyword", { query: name });
    const hit = (d.results || []).find((k) => k.name.toLowerCase() === name.toLowerCase()) || (d.results || [])[0];
    if (!hit) return null;
    all[name] = hit.id;
    Store.write("mn:keywords", all);
    return hit.id;
  }

  // films by TMDB id, as cards (title, year, poster…), a few at a time; kept in one record
  // ("cards": { "movie-13": {...} }) for a month
  let cardMap = null;
  let cardSave = null;
  async function cardsFor(ids, media = "movie") {
    if (!cardMap) cardMap = (await cacheGet("cards")) || {};
    const out = new Map();
    const todo = [];
    ids.forEach((id) => {
      const had = cardMap[`${media}-${id}`];
      if (had && Date.now() - had.at < 30 * 86400000) out.set(id, had);
      else todo.push(id);
    });
    await mapLimit(todo, 6, async (id) => {
      try {
        const d = await request(`/${media}/${id}`);
        const c = Object.assign(simplify(d, media), { at: Date.now() });
        cardMap[`${media}-${id}`] = c;
        out.set(id, c);
      } catch (e) {}
    });
    if (todo.length) {
      clearTimeout(cardSave);
      cardSave = setTimeout(() => cacheSet("cards", cardMap), 600);
    }
    return out;
  }

  // Trivia (js/components/trivia.js): a title's whole cast and crew ({ cast: [names], crew:
  // [{ name, job }] }), and a title's tagline. Kept for this visit only.
  const triviaMem = new Map();
  function remembered(key, fn) {
    if (!triviaMem.has(key)) triviaMem.set(key, fn().catch((e) => (triviaMem.delete(key), Promise.reject(e))));
    return triviaMem.get(key);
  }
  const credits = (media, id) =>
    remembered(`c:${media}-${id}`, async () => {
      const d = await request(`/${media}/${id}/${media === "tv" ? "aggregate_credits" : "credits"}`);
      return {
        cast: (d.cast || []).map((c) => c.name),
        crew: (d.crew || []).flatMap((c) => (c.jobs ? c.jobs.map((j) => ({ name: c.name, job: j.job })) : [{ name: c.name, job: c.job }])),
      };
    });
  const tagline = (media, id) => remembered(`t:${media}-${id}`, async () => (await request(`/${media}/${id}`)).tagline || "");

  // "What should I watch?" → Discover: well-liked titles for a mood (js/components/picker.js).
  // type "movie" | "tv" | "anime"; genres: any of these names (with need: all of need, and
  // the first of genres); without: none of these;
  // from / to: years; maxRuntime: minutes (a movie, or a show's episode); providers: your
  // streaming services' ids; family: movies rated PG at most. -> { results, totalPages }
  async function moodPicks({ type, genres, need, without, from, to, maxRuntime, providers, family, page } = {}) {
    const media = type === "movie" ? "movie" : "tv";
    const col = media === "movie" ? 1 : 2;
    const ids = (names) => [...new Set((names || []).map((n) => (GENRES.find((g) => g[0] === n) || [])[col]).filter(Boolean))];
    const dateKey = media === "movie" ? "primary_release_date" : "first_air_date";
    const params = {
      page: page || 1,
      sort_by: "popularity.desc",
      "vote_average.gte": 6.5,
      "vote_count.gte": type === "movie" ? 400 : type === "anime" ? 80 : 150,
      [`${dateKey}.lte`]: to ? `${to}-12-31` : new Date().toISOString().slice(0, 10),
    };
    if (from) params[`${dateKey}.gte`] = `${from}-01-01`;
    if (type === "anime") {
      params.with_genres = ANIMATION;
      params.with_original_language = "ja";
    } else if (need && need.length) params.with_genres = ids([...need, ...(genres || []).slice(0, 1)]).join(",");
    else if (ids(genres).length) params.with_genres = ids(genres).join("|");
    const avoid = ids(without);
    if (media === "tv") avoid.push(...NOT_SHOWS.split("|").map(Number));
    if (avoid.length) params.without_genres = avoid.join(",");
    if (maxRuntime) params["with_runtime.lte"] = maxRuntime;
    if (family && media === "movie") Object.assign(params, { certification_country: "US", "certification.lte": "PG" });
    if (providers && providers.length) Object.assign(params, { with_watch_providers: providers.join("|"), watch_region: country() });
    const [data, ru] = await requestWithRu(`/discover/${media}`, params);
    const results = (data.results || []).filter((r) => r.poster_path).map((r) => simplify(r, media));
    return { results: applyRu(results, ru, media), totalPages: Math.min(data.total_pages || 1, 500) };
  }

  // every country TMDB has streaming data for: [{ code, name }] (Settings → Streaming), kept a month
  async function regions() {
    const saved = Store.read("mn:regions", null);
    if (saved && Date.now() - saved.at < 30 * 86400000) return saved.list;
    const d = await request("/watch/providers/regions");
    const list = (d.results || []).map((r) => ({ code: r.iso_3166_1, name: r.english_name || r.native_name || r.iso_3166_1 })).sort((a, b) => a.name.localeCompare(b.name));
    Store.write("mn:regions", { list, at: Date.now() });
    return list;
  }

  /* ---------------- an AniList anime's TMDB poster (the anime explorer) ----------------
   * AniList's covers are mostly art without the name; TMDB's posters carry it, like the ones in
   * your library. Found by name (English, then romaji) and year, among Japanese animation; a
   * later season ("… Season 3", "Part 2") gets the show's poster. Kept a month in this browser,
   * "" when there's no good match (the AniList cover stays). */
  const AP_KEY = "mn:animePosters";
  const AP_DAYS = 30;
  let apMap = null;
  const apLoad = () => {
    if (apMap) return apMap;
    try {
      apMap = JSON.parse(localStorage.getItem(AP_KEY) || "{}") || {};
    } catch (e) {
      apMap = {};
    }
    return apMap;
  };
  let apSaveT = 0;
  const apSave = () => {
    clearTimeout(apSaveT);
    apSaveT = setTimeout(() => {
      const all = Object.entries(apLoad()).sort((a, b) => b[1].at - a[1].at).slice(0, 1500);
      apMap = Object.fromEntries(all);
      try {
        localStorage.setItem(AP_KEY, JSON.stringify(apMap));
      } catch (e) {}
    }, 400);
  };
  const apPending = new Map();
  const apQueue = [];
  let apBusy = 0;
  const apRun = () => {
    while (apBusy < 4 && apQueue.length) {
      const job = apQueue.shift();
      apBusy++;
      job().finally(() => {
        apBusy--;
        apRun();
      });
    }
  };
  const stripSeason = (t) =>
    String(t || "")
      .replace(/[:\-–]?\s*(season|part|cour)\s*\d+.*$/i, "")
      .replace(/[:\-–]?\s*(the\s+)?final\s+season.*$/i, "")
      .replace(/\s+(\d+(st|nd|rd|th)\s+season|2nd|3rd|ii|iii|iv)\b.*$/i, "")
      .replace(/\s*\(\d{4}\)\s*$/, "")
      .trim();

  async function findAnimePoster(a) {
    const media = a.type === "Movie" ? "movie" : "tv";
    // (last: the name before a colon, "BLEACH: Thousand-Year Blood War - …" is TMDB's "Bleach")
    const head = (t) => (/^(.{4,}?)\s*[:：]\s/.exec(String(t || "")) || [])[1] || "";
    const names = [...new Set([a.titleEn, a.titleRomaji, stripSeason(a.titleEn), stripSeason(a.titleRomaji), head(a.titleEn), head(a.titleRomaji)].filter(Boolean))];
    const close = (r) => Math.max(...names.map((n) => (window.Lang ? Lang.similarity(r.title || r.name || "", n) : 0)), ...names.map((n) => (window.Lang && r.original_name ? Lang.similarity(r.original_name, n) : 0)));
    const ok = (r) => r.poster_path && (r.genre_ids || []).includes(ANIMATION);
    for (const [n, withYear] of names.flatMap((n) => [[n, true], [n, false]])) {
      if (withYear && !a.year) continue;
      const year = withYear ? (media === "movie" ? { primary_release_year: a.year } : { first_air_date_year: a.year }) : {};
      const data = await request(`/search/${media}`, Object.assign({ query: n }, year)).catch(() => null);
      const list = ((data && data.results) || []).filter(ok);
      const best = list.map((r) => [r, close(r)]).sort((x, y) => y[1] - x[1] || (y[0].popularity || 0) - (x[0].popularity || 0))[0];
      if (best && best[1] >= 0.8) return best[0].poster_path;
      // a Japanese name only (TMDB knows it in English): the one or two anime that year
      if (withYear && n === a.titleRomaji && !a.titleEn && list.length && list.length <= 2) return list[0].poster_path;
    }
    return "";
  }

  // the poster's address (w342), "" if there's none; null without a TMDB key
  function animePoster(a) {
    if (!key() || !a || !a.key) return Promise.resolve(null);
    const map = apLoad();
    const hit = map[a.key];
    if (hit && Date.now() - hit.at < AP_DAYS * 864e5) return Promise.resolve(hit.p ? `https://image.tmdb.org/t/p/w342${hit.p}` : "");
    if (apPending.has(a.key)) return apPending.get(a.key);
    const p = new Promise((resolve) => {
      apQueue.push(() =>
        findAnimePoster(a)
          .then((path) => {
            map[a.key] = { p: path, at: Date.now() };
            apSave();
            resolve(path ? `https://image.tmdb.org/t/p/w342${path}` : "");
          })
          .catch(() => resolve(""))
          .finally(() => apPending.delete(a.key))
      );
      apRun();
    });
    apPending.set(a.key, p);
    return p;
  }

  window.TMDB = {
    animePoster,
    genreId: (name, media) => (GENRES.find((g) => g[0] === name) || [])[media === "movie" ? 1 : 2] || null,
    discover, searchPeople, keywordId, cardsFor, store: { get: (k) => cacheGet(k), set: (k, v) => cacheSet(k, v) },
    facts, credits, tagline, moodPicks, boxOffice, boxOfficeOf, franchiseBoxOffice, searchCollections, yearTop, directorBoxOffice, searchDirectors,
    knownRecommendations, collection, findByImdb, findFilm, providersFor, providerCatalog, nextUp, enabled, keySource, search, searchIn, searchSmart, ruInfo, ruVideos,
    seasonVideos, episodeVideos, list, top10, byGenre, details, detailsById, basic, releaseDate, localDate, knownLocalDate, findMatch, person, findPerson, test, CATEGORIES,
    genreNames, genresFor, country, countryName, sameCountry, regions, clearCache,
    // the country picked in Settings (or the site's default)
    get COUNTRY() {
      return country();
    },
  };
})();
