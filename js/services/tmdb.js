/*
 * TMDB (themoviedb.org) integration.
 * The key comes from js/config.js, or from Profile -> Settings (this browser only).
 * It powers the Discover page, overviews / cast / trailers on title pages,
 * recommendations, and poster search when adding a title.
 * The rest of the site works without it.
 */
(function () {
  const API = "https://api.themoviedb.org/3";
  const CACHE_LIMIT = 120; // title pages kept in this browser (details now include reviews, images...)
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
    "popular-movies": { label: "Popular movies", path: "/movie/popular", media: "movie" },
    // worldwide lists (only the release dates on the labels are Romania's)
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
      released: r.release_date || r.first_air_date || "", // "2026-12-15" (Discover's "Coming soon" label)
      poster: r.poster_path || "",
      backdrop: r.backdrop_path || "",
      overview: r.overview || "",
      score: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
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

  // put the Russian names onto simplified results ("titleRu")
  function applyRu(results, ruData, media) {
    if (!ruData || !ruData.results) return results;
    const names = {};
    ruData.results.forEach((r) => (names[`${r.media_type || media}-${r.id}`] = r.title || r.name));
    results.forEach((h) => {
      const n = names[`${h.mediaType}-${h.tmdbId}`];
      if (n) h.titleRu = n;
    });
    return results;
  }

  // Russian name of one title (for library titles added later)
  async function ruTitle(media, id) {
    const d = await request(`/${media}/${id}`, { language: "ru-RU" });
    return d.title || d.name || "";
  }

  function isAnime(r) {
    const genres = r.genre_ids || (r.genres || []).map((g) => g.id);
    return genres.includes(ANIMATION) && (r.original_language === "ja" || (r.origin_country || []).includes("JP"));
  }

  // Search with a type filter, for the Discover page: "all" | "movie" | "tv" | "anime"
  async function searchIn(query, type, page) {
    if (type === "movie" || type === "tv") {
      const [data, ru] = await requestWithRu(`/search/${type}`, { query, page });
      return { results: applyRu(data.results.map((r) => simplify(r, type)), ru, type), totalPages: data.total_pages || 1 };
    }
    if (type === "anime") {
      // anime can be a series or a film: search both, keep Japanese animation,
      // most popular first
      const [[tv, tvRu], [movie, movieRu]] = await Promise.all([requestWithRu("/search/tv", { query, page }), requestWithRu("/search/movie", { query, page })]);
      const results = tv.results
        .map((r) => [r, "tv"])
        .concat(movie.results.map((r) => [r, "movie"]))
        .filter(([r]) => isAnime(r))
        .sort(([a], [b]) => (b.popularity || 0) - (a.popularity || 0))
        .map(([r, media]) => simplify(r, media));
      applyRu(results, tvRu, "tv");
      applyRu(results, movieRu, "movie");
      return { results, totalPages: Math.max(tv.total_pages || 1, movie.total_pages || 1) };
    }
    const [data, ru] = await requestWithRu("/search/multi", { query, page });
    return { results: applyRu(data.results.filter(isTitle).map((r) => simplify(r)), ru), totalPages: data.total_pages || 1 };
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
    const hasExact = first.results.some((r) => [r.title, r.titleRu].some((n) => n && Lang.words(n).join(" ").includes(phrase)));
    // (few results also get a second try: "interstelar" exactly matches an obscure film,
    // but you most likely meant Interstellar)
    if ((hasExact && first.results.length >= 5) || !typed.some((w) => w.length >= 5)) return first;

    // shorter versions: long words cut by 2 letters; then just the longest word, cut
    const cut = (w) => (w.length >= 5 ? w.slice(0, Math.max(4, w.length - 2)) : w);
    const longest = typed.slice().sort((a, b) => b.length - a.length)[0];
    const variants = [...new Set([typed.map(cut).join(" "), cut(longest)])].filter((v) => v && v !== phrase);
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
    merged.sort((a, b) => b.close - a.close || a.order - b.order);
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
    const [data, ru] = await requestWithRu(c.path, Object.assign({ page: page || 1 }, c.params || {}));
    return {
      results: applyRu(data.results.filter((r) => c.media || isTitle(r)).map((r) => simplify(r, c.media)), ru, c.media),
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
    const [data, ru] = await requestWithRu(`/discover/${media}`, params);
    return { results: applyRu(data.results.map((r) => simplify(r, media)), ru, media), totalPages: Math.min(data.total_pages || 1, 500) };
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
  /* ---------------- release dates in your country (Romania) ---------------- */

  const COUNTRY = ((window.MN_CONFIG || {}).RELEASE_COUNTRY || "RO").toUpperCase();
  const LOCAL_DATES = "mn:localDates2"; // { movieId: { d: "2026-10-03" | "", at } }, "" = no cinema date there
  try {
    localStorage.removeItem("mn:localDates");
  } catch (e) {}

  // TMDB release types: 1 premiere, 2 limited, 3 cinemas, 4 digital, 5 physical, 6 TV.
  // Only the cinema release counts: a festival premiere isn't "out", and a country's
  // TV / digital dates are often a local broadcast years later (streaming films come
  // out everywhere on their worldwide date, which is used when there's no cinema date).
  function countryDate(list) {
    const entry = (list || []).find((r) => r.iso_3166_1 === COUNTRY);
    if (!entry) return "";
    return (
      entry.release_dates
        .filter((x) => (x.type === 2 || x.type === 3) && x.release_date)
        .map((x) => x.release_date.slice(0, 10))
        .sort()[0] || ""
    );
  }

  // a movie's release date in your country ("" if it has none there): remembered, and
  // checked again after a few days while it isn't out yet
  async function localDate(id) {
    const saved = Store.read(LOCAL_DATES, {});
    const s = saved[id];
    const today = new Date().toISOString().slice(0, 10);
    if (s && (Date.now() - s.at < 3 * 86400000 || (s.d && s.d <= today))) return s.d;
    const d = await request(`/movie/${id}/release_dates`);
    const date = countryDate(d.results);
    const fresh = Store.read(LOCAL_DATES, {});
    fresh[id] = { d: date, at: Date.now() };
    const keys = Object.keys(fresh);
    if (keys.length > 800) keys.sort((a, b) => fresh[a].at - fresh[b].at).slice(0, keys.length - 800).forEach((k) => delete fresh[k]);
    Store.write(LOCAL_DATES, fresh);
    return date;
  }
  const knownLocalDate = (id) => {
    const s = Store.read(LOCAL_DATES, {})[id];
    return s ? s.d : null;
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
    Object.keys(cache).forEach((k) => /^v[23]:/.test(k) && delete cache[k]); // older formats
    const keys = Object.keys(cache);
    if (keys.length > CACHE_LIMIT) {
      keys
        .sort((a, b) => (cache[a].savedAt || 0) - (cache[b].savedAt || 0))
        .slice(0, keys.length - CACHE_LIMIT)
        .forEach((k) => delete cache[k]);
    }
    Store.write(Store.KEYS.tmdbCache, cache);
  }

  // your country, for age ratings and streaming services (e.g. "en-GB" -> "GB")
  function region() {
    for (const lang of navigator.languages || [navigator.language || ""]) {
      const m = /-([A-Z]{2})$/i.exec(lang);
      if (m) return m[1].toUpperCase();
    }
    return "US";
  }

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
    const cacheKey = `v4:${media}-${id}`; // v4: cast and director have TMDB person ids
    const cache = readCache();
    if (cache[cacheKey] && Date.now() - cache[cacheKey].savedAt < DETAILS_MAX_AGE) return withRuNames(cache[cacheKey], media, id);

    const country = region();
    const d = await request(`/${media}/${id}`, {
      append_to_response: `videos,credits,recommendations,external_ids,images,reviews,watch/providers,${media === "movie" ? "release_dates" : "content_ratings"}`,
      include_image_language: "en,null",
    });
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
      cast: ((d.credits && d.credits.cast) || []).slice(0, 12).map((c) => ({ id: c.id, name: c.name, character: c.character, photo: c.profile_path || "" })),
      tmdbScore: base.score,
      imdbId: d.imdb_id || (d.external_ids && d.external_ids.imdb_id) || null,
      recommendations: ((d.recommendations && d.recommendations.results) || [])
        .filter((r) => r.poster_path)
        .slice(0, 16)
        .map((r) => simplify(r, r.media_type || media)),
      certification: certificationOf(d, media, country),
      providers: providersOf(d, country),
      videos: ((d.videos && d.videos.results) || [])
        .filter((v) => v.site === "YouTube")
        .sort((a, b) => (b.type === "Trailer") - (a.type === "Trailer") || (b.official === true) - (a.official === true))
        .slice(0, 12)
        .map((v) => ({ key: v.key, name: v.name, type: v.type })),
      images: ((d.images && d.images.backdrops) || []).slice(0, 12).map((i) => i.file_path),
      // poster art without the title printed on it: used as the tall header image on phones
      artPoster: (((d.images && d.images.posters) || []).find((p) => p.iso_639_1 === null) || {}).file_path || "",
      reviews: ((d.reviews && d.reviews.results) || []).slice(0, 6).map((r) => ({
        author: r.author || (r.author_details && r.author_details.username) || "TMDB user",
        rating: r.author_details && r.author_details.rating,
        date: (r.created_at || "").slice(0, 10),
        text: (r.content || "").length > 1200 ? r.content.slice(0, 1200) + "…" : r.content || "",
        url: r.url || "",
      })),
      tmdbUrl: `https://www.themoviedb.org/${media}/${id}`,
      savedAt: Date.now(),
    });
    cache[cacheKey] = result;
    writeCache(cache);
    return withRuNames(result, media, id);
  }

  // RU mode: add the Russian name of the title and of its recommendations (saved with the details)
  async function withRuNames(result, media, id) {
    if (!wantRu() || result.ruDone) return result;
    try {
      const ru = await request(`/${media}/${id}`, { language: "ru-RU", append_to_response: "recommendations" });
      result.titleRu = ru.title || ru.name || "";
      applyRu(result.recommendations || [], ru.recommendations, media);
      result.ruDone = true;
      const cache = readCache();
      cache[`v4:${media}-${id}`] = result;
      writeCache(cache);
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

  window.TMDB = { enabled, keySource, search, searchIn, searchSmart, ruTitle, list, top10, byGenre, details, detailsById, basic, releaseDate, localDate, knownLocalDate, COUNTRY, findMatch, person, findPerson, test, CATEGORIES, genreNames, genresFor };
})();
