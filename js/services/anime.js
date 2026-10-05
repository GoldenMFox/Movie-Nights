/*
 * Anime: the anime explorer (anime-explore.html) and the anime card on anime title pages.
 *
 * Everything comes from AniList (graphql.anilist.co: free, no key, 90 requests a minute), asked
 * through js/services/api.js (each answer kept a day, the same question asked once, within the limit).
 * Turned into the site's own shapes here:
 *   card     { key, al, mal, title, titleRomaji, titleEn, image, type, episodes, score, year, season, status }
 *   details  card + { titleJp, synonyms, airing, from, to, duration, rank, popularity, members, favorites,
 *            synopsis, producers, studios, genres, themes, demographics, source, trailer, url, relations,
 *            streaming, next, banner }
 * An anime's key is AniList's id: "al-21". Older links with a MyAnimeList id ("mal-5114") still open:
 * AniList finds an anime by that number too.
 */
(function () {
  const ANILIST = "https://graphql.anilist.co";
  const hours = () => (window.Site ? Site.api("anilist").hours : 24) || 24;

  // a short fingerprint of a whole query (the cache key: two queries never share answers)
  const hash = (str) => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  async function anilist(query, variables) {
    if (!Api.enabled("anilist")) throw new Error("Anime data is switched off for now");
    const r = await Api.get("anilist", ANILIST, {
      hours: hours(),
      key: `${hash(query)}|${JSON.stringify(variables)}`,
      init: { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables }) },
    });
    if (r && r.errors && r.errors.length) throw new Error(r.errors[0].message || "AniList error");
    return r && r.data;
  }

  /* ---------------- AniList -> the site's shapes ---------------- */

  const FORMAT = { TV: "TV", TV_SHORT: "TV", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music" };
  const STATUS = { FINISHED: "Finished Airing", RELEASING: "Currently Airing", NOT_YET_RELEASED: "Not yet aired", CANCELLED: "Cancelled", HIATUS: "On hiatus" };
  const SEASON = { WINTER: "winter", SPRING: "spring", SUMMER: "summer", FALL: "fall" };
  const RELATION = { SEQUEL: "Sequel", PREQUEL: "Prequel", SIDE_STORY: "Side Story", SPIN_OFF: "Spin-Off", ALTERNATIVE: "Alternative version", PARENT: "Parent story", SUMMARY: "Summary", ADAPTATION: "Adaptation", SOURCE: "Adaptation", CHARACTER: "Character", OTHER: "Other", COMPILATION: "Summary", CONTAINS: "Other" };
  const date = (d) => (d && d.year ? `${d.year}-${String(d.month || 1).padStart(2, "0")}-${String(d.day || 1).padStart(2, "0")}` : "");
  const keyOf = (m) => `al-${m.id}`;
  const CARD_FIELDS = "id idMal title { romaji english } coverImage { large extraLarge } format episodes averageScore seasonYear season status popularity startDate { year } genres isAdult";
  // rows and grids leave out adult and fan-service anime (a page of its own still opens)
  const ADULT = /^(ecchi|hentai|erotica)$/i;
  const adult = (m) => m.isAdult || (m.genres || []).some((g) => ADULT.test(g));
  function card(m) {
    return {
      key: keyOf(m),
      al: m.id,
      mal: m.idMal || null,
      title: (m.title && (m.title.english || m.title.romaji)) || "",
      titleRomaji: (m.title && m.title.romaji) || "",
      titleEn: (m.title && m.title.english) || "",
      image: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || "",
      type: FORMAT[m.format] || m.format || "",
      episodes: m.episodes || null,
      score: m.averageScore ? Math.round(m.averageScore) / 10 : null,
      year: m.seasonYear || (m.startDate && m.startDate.year) || null,
      season: SEASON[m.season] || "",
      status: STATUS[m.status] || "",
      members: m.popularity || null,
    };
  }
  const DETAIL_QUERY = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) {
    ${CARD_FIELDS} siteUrl synonyms duration source title { native }
    startDate { year month day } endDate { year month day }
    meanScore favourites rankings { rank type allTime context }
    description(asHtml: false) bannerImage genres
    tags { name rank isMediaSpoiler category }
    studios { edges { isMain node { id name isAnimationStudio } } }
    trailer { id site } nextAiringEpisode { episode airingAt }
    externalLinks { site url type }
    relations { edges { relationType node { id idMal type format title { romaji english } } } }
  } }`;
  const clean = (s) => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
  function details(m) {
    const ranked = (type) => (m.rankings || []).find((r) => r.type === type && r.allTime);
    const studios = (m.studios && m.studios.edges) || [];
    return Object.assign(card(m), {
      titleJp: (m.title && m.title.native) || "",
      synonyms: m.synonyms || [],
      airing: m.status === "RELEASING",
      from: date(m.startDate),
      to: date(m.endDate),
      duration: m.duration ? `${m.duration} min${m.format === "MOVIE" ? "" : " per ep"}` : "",
      rank: ranked("RATED") ? ranked("RATED").rank : null,
      popularity: ranked("POPULAR") ? ranked("POPULAR").rank : null,
      favorites: m.favourites || null,
      synopsis: clean(m.description),
      producers: studios.filter((e) => !e.node.isAnimationStudio).map((e) => e.node.name),
      studios: studios.filter((e) => e.node.isAnimationStudio).map((e) => ({ al: e.node.id, name: e.node.name })),
      genres: m.genres || [],
      themes: (m.tags || []).filter((t) => !t.isMediaSpoiler && t.rank >= 70 && t.category !== "Demographic").slice(0, 6).map((t) => t.name),
      demographics: (m.tags || []).filter((t) => t.category === "Demographic").map((t) => t.name),
      source: m.source ? m.source.charAt(0) + m.source.slice(1).toLowerCase().replace(/_/g, " ") : "",
      trailer: m.trailer && m.trailer.site === "youtube" ? m.trailer.id : "",
      url: m.siteUrl || "",
      relations: Object.values(
        ((m.relations && m.relations.edges) || []).reduce((acc, e) => {
          const rel = RELATION[e.relationType] || "Other";
          (acc[rel] = acc[rel] || { relation: rel, entries: [] }).entries.push({
            key: e.node.type === "ANIME" ? keyOf(e.node) : null,
            title: (e.node.title && (e.node.title.english || e.node.title.romaji)) || "",
            kind: e.node.type === "ANIME" ? "anime" : "manga",
          });
          return acc;
        }, {})
      ),
      streaming: (m.externalLinks || []).filter((l) => l.type === "STREAMING").map((l) => ({ name: l.site, url: l.url })),
      next: m.nextAiringEpisode ? { episode: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt * 1000 } : null,
      banner: m.bannerImage || "",
    });
  }

  /* ---------------- one anime ---------------- */

  // "al-21" -> { id: 21 }; "mal-5114" (older links) -> { idMal: 5114 }
  function vars(key) {
    const [kind, n] = String(key || "").split("-");
    const num = Number(n);
    if (!num) throw new Error("That anime link doesn't look right");
    return kind === "mal" ? { idMal: num } : { id: num };
  }

  async function detailsOf(key) {
    const res = await anilist(DETAIL_QUERY, vars(key));
    if (!res || !res.Media) throw new Error("This anime couldn't be found");
    return details(res.Media);
  }

  // characters with their voice actors: [{ name, role, image, va: [{ name, lang, image }] }]
  async function characters(key) {
    const q = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { characters(sort: [ROLE, RELEVANCE, ID], perPage: 24) { edges { role node { name { full } image { large } siteUrl } voiceActors { name { full } image { large } languageV2 siteUrl } } } } }`;
    const res = await anilist(q, vars(key));
    return ((res && res.Media && res.Media.characters.edges) || []).map((e) => ({
      name: e.node.name.full,
      role: e.role === "MAIN" ? "Main" : "Supporting",
      image: e.node.image ? e.node.image.large : "",
      url: e.node.siteUrl,
      va: (e.voiceActors || []).map((v) => ({ name: v.name.full, lang: v.languageV2, image: v.image ? v.image.large : "", url: v.siteUrl })),
    }));
  }

  // the staff: [{ name, image, jobs: ["Director", …] }], directors and writers first
  const STAFF_ORDER = /director|series composition|script|original creator|character design|music/i;
  async function staff(key) {
    const q = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { staff(sort: [RELEVANCE, ID], perPage: 25) { edges { role node { name { full } image { large } siteUrl } } } } }`;
    const res = await anilist(q, vars(key));
    const people = new Map();
    ((res && res.Media && res.Media.staff.edges) || []).forEach((e) => {
      const p = people.get(e.node.name.full) || { name: e.node.name.full, image: e.node.image ? e.node.image.large : "", jobs: [], url: e.node.siteUrl };
      p.jobs.push(e.role);
      people.set(p.name, p);
    });
    return [...people.values()].sort((a, b) => (STAFF_ORDER.test(b.jobs.join(" ")) ? 1 : 0) - (STAFF_ORDER.test(a.jobs.join(" ")) ? 1 : 0)).slice(0, 18);
  }

  // what fans of it also like: [card]
  async function recommendations(key) {
    const q = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { recommendations(sort: RATING_DESC, perPage: 16) { nodes { rating mediaRecommendation { ${CARD_FIELDS} } } } } }`;
    const res = await anilist(q, vars(key));
    return ((res && res.Media && res.Media.recommendations.nodes) || [])
      .filter((x) => x.mediaRecommendation && !adult(x.mediaRecommendation))
      .map((x) => Object.assign(card(x.mediaRecommendation), { votes: x.rating }));
  }

  /* ---------------- lists (the explorer's rows) ---------------- */

  const SEASONS = ["winter", "spring", "summer", "fall"];
  function seasonNow(d = new Date()) {
    return { year: d.getFullYear(), season: SEASONS[Math.floor(d.getMonth() / 3)] };
  }
  const PER = 24;

  // kind: "trending" | "airing" | "season" | "upcoming" | "top" | "popular" | "completed" |
  //       "genre" | "studio" | "search". opts: { page, year, season, genreName, studioAl, q }
  // -> { list: [card], more: boolean }
  async function list(kind, opts = {}) {
    const page = opts.page || 1;
    const now = seasonNow();
    if (kind === "studio") {
      if (!opts.studioAl) return { list: [], more: false };
      const sq = `query ($studio: Int, $page: Int, $perPage: Int) { Studio(id: $studio) { media(sort: POPULARITY_DESC, isMain: true, page: $page, perPage: $perPage) { pageInfo { hasNextPage } nodes { ${CARD_FIELDS} type } } } }`;
      const res = await anilist(sq, { studio: opts.studioAl, page, perPage: PER });
      const m = res && res.Studio && res.Studio.media;
      return { list: ((m && m.nodes) || []).filter((x) => (!x.type || x.type === "ANIME") && !adult(x)).map(card), more: !!(m && m.pageInfo.hasNextPage) };
    }
    const q = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $status: MediaStatus, $genre: String, $search: String) {
      Page(page: $page, perPage: $perPage) { pageInfo { hasNextPage }
        media(type: ANIME, isAdult: false, genre_not_in: ["Ecchi", "Hentai"], sort: $sort, season: $season, seasonYear: $seasonYear, status: $status, genre: $genre, search: $search) { ${CARD_FIELDS} } } }`;
    const S = (s) => String(s || "").toUpperCase();
    const routes = {
      trending: { sort: ["TRENDING_DESC", "POPULARITY_DESC"] },
      airing: { sort: ["POPULARITY_DESC"], status: "RELEASING" },
      season: { sort: ["POPULARITY_DESC"], season: S(opts.season || now.season), seasonYear: opts.year || now.year },
      upcoming: { sort: ["POPULARITY_DESC"], status: "NOT_YET_RELEASED" },
      top: { sort: ["SCORE_DESC"] },
      popular: { sort: ["POPULARITY_DESC"] },
      completed: { sort: ["END_DATE_DESC", "POPULARITY_DESC"], status: "FINISHED" },
      genre: { sort: ["POPULARITY_DESC"], genre: opts.genreName },
      search: { search: opts.q, sort: ["SEARCH_MATCH", "POPULARITY_DESC"] },
    };
    const res = await anilist(q, Object.assign({ page, perPage: PER }, routes[kind] || routes.top));
    const p = res && res.Page;
    const seen = new Set();
    const listed = ((p && p.media) || []).filter((m) => !adult(m)).map(card).filter((c) => !seen.has(c.key) && seen.add(c.key));
    return { list: listed, more: !!(p && p.pageInfo.hasNextPage) };
  }

  // genres to browse by (AniList's own names)
  const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Mecha", "Music", "Psychological"].map(
    (name) => ({ id: name, name })
  );

  // studios to browse by (AniList's studio ids)
  const STUDIOS = [
    ["MAPPA", 569], ["Kyoto Animation", 2], ["Madhouse", 11], ["Bones", 4], ["Wit Studio", 858], ["ufotable", 43], ["Studio Ghibli", 21],
    ["Production I.G", 10], ["Sunrise", 14], ["CloverWorks", 1835], ["A-1 Pictures", 56], ["Trigger", 803], ["Toei Animation", 18], ["Shaft", 44], ["David Production", 287],
  ].map(([name, al]) => ({ name, al }));

  // the most-loved characters: [{ name, image, favorites, nick (their anime) }]
  async function topCharacters() {
    const q = `query { Page(perPage: 20) { characters(sort: FAVOURITES_DESC) { name { full } image { large } favourites siteUrl media(perPage: 1, type: ANIME) { nodes { title { english romaji } } } } } }`;
    const res = await anilist(q, {});
    return ((res && res.Page && res.Page.characters) || []).map((c) => ({
      name: c.name.full,
      image: c.image ? c.image.large : "",
      favorites: c.favourites,
      url: c.siteUrl,
      nick: c.media && c.media.nodes[0] ? c.media.nodes[0].title.english || c.media.nodes[0].title.romaji : "",
    }));
  }

  // a TMDB title -> its anime (for the anime card on an anime's title page)
  async function findFor(d) {
    const name = d.title;
    if (!name) return null;
    const year = Number(String(d.released || "").slice(0, 4)) || null;
    const movie = d.media === "movie";
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const r = await list("search", { q: name });
    const ok = (r.list || []).filter((c) => (movie ? c.type === "Movie" : c.type !== "Movie"));
    const near = (c) => !year || !c.year || Math.abs(c.year - year) <= 1;
    return ok.find((c) => [c.titleEn, c.titleRomaji, c.title].some((t) => norm(t) === norm(name)) && near(c)) || ok.find(near) || null;
  }

  window.Anime = { details: detailsOf, characters, staff, recommendations, list, topCharacters, findFor, seasonNow, SEASONS, GENRES, STUDIOS };
})();
