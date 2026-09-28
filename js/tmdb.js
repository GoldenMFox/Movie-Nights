/*
 * TMDB (themoviedb.org) integration.
 * The key comes from js/config.js, or from Profile -> Settings (this browser only).
 * It powers the Discover page, overviews / cast / trailers on title pages,
 * recommendations, and poster search when adding a title.
 * The rest of the site works without it.
 */
(function () {
  const API = "https://api.themoviedb.org/3";
  const CACHE_LIMIT = 400;
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
    "popular-movies": { label: "Popular movies", path: "/movie/popular", media: "movie" },
    "now-playing": { label: "In cinemas", path: "/movie/now_playing", media: "movie" },
    upcoming: { label: "Coming soon", path: "/movie/upcoming", media: "movie" },
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

  async function request(path, params) {
    const k = key();
    if (!k) throw new Error("No TMDB key set");
    const url = new URL(API + path);
    Object.entries(params || {}).forEach(([p, v]) => v != null && v !== "" && url.searchParams.set(p, v));
    const headers = {};
    // Works with both the short "API key" and the long "read access token"
    if (k.startsWith("eyJ")) headers.Authorization = `Bearer ${k}`;
    else url.searchParams.set("api_key", k);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(res.status === 401 ? "TMDB rejected the API key" : `TMDB error ${res.status}`);
    return res.json();
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
      poster: r.poster_path || "",
      backdrop: r.backdrop_path || "",
      overview: r.overview || "",
      score: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
      genres: genreNames(genres, media),
    };
  }

  const isTitle = (r) => r.media_type === "movie" || r.media_type === "tv";

  function isAnime(r) {
    const genres = r.genre_ids || (r.genres || []).map((g) => g.id);
    return genres.includes(ANIMATION) && (r.original_language === "ja" || (r.origin_country || []).includes("JP"));
  }

  // Search with a type filter, for the Discover page: "all" | "movie" | "tv" | "anime"
  async function searchIn(query, type, page) {
    if (type === "movie" || type === "tv") {
      const data = await request(`/search/${type}`, { query, page });
      return { results: data.results.map((r) => simplify(r, type)), totalPages: data.total_pages || 1 };
    }
    if (type === "anime") {
      // anime can be a series or a film: search both, keep Japanese animation,
      // most popular first
      const [tv, movie] = await Promise.all([request("/search/tv", { query, page }), request("/search/movie", { query, page })]);
      const results = tv.results
        .map((r) => [r, "tv"])
        .concat(movie.results.map((r) => [r, "movie"]))
        .filter(([r]) => isAnime(r))
        .sort(([a], [b]) => (b.popularity || 0) - (a.popularity || 0))
        .map(([r, media]) => simplify(r, media));
      return { results, totalPages: Math.max(tv.total_pages || 1, movie.total_pages || 1) };
    }
    const data = await request("/search/multi", { query, page });
    return { results: data.results.filter(isTitle).map((r) => simplify(r)), totalPages: data.total_pages || 1 };
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
    const data = await request(c.path, Object.assign({ page: page || 1 }, c.params || {}));
    return {
      results: data.results.filter((r) => c.media || isTitle(r)).map((r) => simplify(r, c.media)),
      totalPages: Math.min(data.total_pages || 1, 500),
    };
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
    if (media === "tv") params.without_genres = NOT_SHOWS;
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
    const data = await request(`/discover/${media}`, params);
    return { results: data.results.map((r) => simplify(r, media)), totalPages: Math.min(data.total_pages || 1, 500) };
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

  // Just the TMDB score and IMDb id of a movie / show (used by js/ratings.js)
  async function basic(media, id) {
    const d = await request(`/${media}/${id}`, { append_to_response: "external_ids" });
    return {
      score: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null,
      imdbId: d.imdb_id || (d.external_ids && d.external_ids.imdb_id) || null,
      genres: genreNames((d.genres || []).map((g) => g.id), media),
    };
  }
  function pickTrailer(videos) {
    const yt = ((videos && videos.results) || []).filter((v) => v.site === "YouTube");
    const best =
      yt.find((v) => v.type === "Trailer" && v.official) || yt.find((v) => v.type === "Trailer") || yt.find((v) => v.type === "Teaser") || yt[0];
    return best ? best.key : null;
  }

  function formatRuntime(min) {
    if (!min) return "";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h ${m}min` : `${m}min`;
  }

  function readCache() {
    return Store.read(Store.KEYS.tmdbCache, {});
  }

  function writeCache(cache) {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_LIMIT) {
      keys
        .sort((a, b) => (cache[a].savedAt || 0) - (cache[b].savedAt || 0))
        .slice(0, keys.length - CACHE_LIMIT)
        .forEach((k) => delete cache[k]);
    }
    Store.write(Store.KEYS.tmdbCache, cache);
  }

  // Full details for a TMDB movie / show (cached)
  async function detailsById(media, id) {
    const cacheKey = `${media}-${id}`;
    const cache = readCache();
    if (cache[cacheKey]) return cache[cacheKey];

    const d = await request(`/${media}/${id}`, { append_to_response: "videos,credits,recommendations,external_ids" });
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
      trailer: pickTrailer(d.videos),
      cast: ((d.credits && d.credits.cast) || []).slice(0, 12).map((c) => ({ name: c.name, character: c.character, photo: c.profile_path || "" })),
      tmdbScore: base.score,
      imdbId: d.imdb_id || (d.external_ids && d.external_ids.imdb_id) || null,
      recommendations: ((d.recommendations && d.recommendations.results) || [])
        .filter((r) => r.poster_path)
        .slice(0, 16)
        .map((r) => simplify(r, r.media_type || media)),
      savedAt: Date.now(),
    });
    cache[cacheKey] = result;
    writeCache(cache);
    return result;
  }

  // Details for an item in your library (finds it on TMDB first)
  async function details(item) {
    // reuse the TMDB match js/ratings.js already found, if any
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

  async function test() {
    await request("/configuration");
    return true;
  }

  window.TMDB = { enabled, keySource, search, searchIn, list, byGenre, details, detailsById, basic, findMatch, test, CATEGORIES, genreNames, genresFor };
})();
