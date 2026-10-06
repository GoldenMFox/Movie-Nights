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
 *
 * The explorer lists anime themselves, not their parts: only series, web series and films (no
 * OVAs, specials, music videos), and a later season, a film or a side story of a series is shown
 * as the series it belongs to ("Dandadan 3rd Season" -> Dandadan; see mainOnly). Its seasons,
 * films and specials are on its own page (franchise).
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
  // (first: ahead of the queue, the next step of a list that's already been asked for)
  async function anilist(query, variables, first) {
    if (!Api.enabled("anilist")) throw new Error("Anime data is switched off for now");
    const r = await Api.get("anilist", ANILIST, {
      first,
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
  // rows and grids leave out adult and fan-service anime (a page of its own still opens), unless
  // you turned "Mature anime" on in Settings (this browser: mn:adultAnime = "on")
  const ADULT = /^(ecchi|hentai|erotica)$/i;
  const adultOk = () => {
    try {
      return localStorage.getItem("mn:adultAnime") === "on";
    } catch (e) {
      return false;
    }
  };
  const adult = (m) => !adultOk() && (m.isAdult || (m.genres || []).some((g) => ADULT.test(g)));
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
    const q = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { recommendations(sort: RATING_DESC, perPage: 16) { nodes { rating mediaRecommendation { ${LIST_FIELDS} } } } } }`;
    const res = await anilist(q, vars(key));
    return mainOnly(((res && res.Media && res.Media.recommendations.nodes) || []).map((x) => x.mediaRecommendation).filter(Boolean));
  }

  /* ---------------- lists (the explorer's rows) ---------------- */

  const SEASONS = ["winter", "spring", "summer", "fall"];
  function seasonNow(d = new Date()) {
    return { year: d.getFullYear(), season: SEASONS[Math.floor(d.getMonth() / 3)] };
  }
  const PER = 24;

  /* ---------------- the anime itself, not its parts ---------------- */

  const MAIN_FORMATS = ["TV", "TV_SHORT", "ONA", "MOVIE"];
  const UP = ["PREQUEL", "PARENT"]; // where a season / film / side story comes from
  // (a list's anime come with their prequel / parent, and where that one comes from: most
  // seasons find their series in the list's own answer, with no more requests; AniList allows
  // only 30 a minute)
  const LIST_FIELDS = `${CARD_FIELDS} relations { edges { relationType node { ${CARD_FIELDS} type relations { edges { relationType node { id type format } } } } } }`;
  // where it comes from: its prequel / parent (followed through OVAs and specials too, but the
  // series is never one of those: One Piece's "prequel" is a 1998 special, so it stays One Piece)
  const upEdge = (m) => ((m && m.relations && m.relations.edges) || []).find((x) => UP.includes(x.relationType) && x.node && x.node.type === "ANIME");

  // an anime's series, remembered in this browser (a month): { id: [seriesId, at] }
  const ROOTS = "mn:animeSeries";
  let roots = null;
  const rootsLoad = () => {
    if (roots) return roots;
    try {
      roots = JSON.parse(localStorage.getItem(ROOTS) || "{}") || {};
    } catch (e) {
      roots = {};
    }
    const old = Date.now() - 30 * 864e5;
    Object.keys(roots).forEach((k) => roots[k][1] < old && delete roots[k]);
    return roots;
  };
  const rootsSave = () => {
    try {
      localStorage.removeItem("mn:animeRoots"); // (an earlier, wrong version)
      const all = Object.entries(rootsLoad()).sort((a, b) => b[1][1] - a[1][1]).slice(0, 3000);
      localStorage.setItem(ROOTS, JSON.stringify(Object.fromEntries(all)));
    } catch (e) {}
  };
  // two steps back at a time (AniList answers links two deep, no further), many anime at once.
  // The series is the first series / web series in the chain; a film when there's none. Each
  // anime met on the way is kept (met), so the series' card is usually known without asking
  const STEPS = `${CARD_FIELDS} relations { edges { relationType node { ${CARD_FIELDS} type relations { edges { relationType node { id type format } } } } } }`;
  const met = new Map(); // id -> AniList's anime (only with its card: a bare id is not kept)
  const meet = (m) => m && m.id && m.title && met.set(m.id, m);
  async function seriesOf(ids) {
    const map = rootsLoad();
    const out = {};
    const chain = {}; // anime asked about -> [{ id, format }] back to where it's got to
    let todo = [];
    ids.forEach((id) => (map[id] ? (out[id] = map[id][0]) : (todo.push(id), (chain[id] = [{ id, format: null }]))));
    for (let round = 0; round < 8 && todo.length; round++) {
      const ask = [...new Set(todo.map((id) => chain[id][chain[id].length - 1].id))];
      const res = await anilist(`query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id ${STEPS} } } }`, { ids: ask }, true);
      const got = {};
      ((res && res.Page && res.Page.media) || []).forEach((m) => {
        got[m.id] = m;
        meet(m);
        ((m.relations && m.relations.edges) || []).forEach((e) => e.node && e.node.type === "ANIME" && meet(e.node));
      });
      todo = todo.filter((id) => {
        const c = chain[id];
        const m = got[c[c.length - 1].id];
        if (!m) return false; // (not answered: left as it is, not remembered)
        c[c.length - 1].format = m.format;
        const e1 = upEdge(m);
        if (!e1) return (c.done = true), false;
        c.push({ id: e1.node.id, format: e1.node.format });
        const e2 = upEdge(e1.node);
        if (!e2) return (c.done = true), false;
        c.push({ id: e2.node.id, format: e2.node.format });
        return !c.some((x, i) => c.findIndex((y) => y.id === x.id) !== i); // (a loop: stop)
      });
    }
    ids.forEach((id) => {
      const c = chain[id];
      if (!c) return;
      const series = c.slice().reverse().find((x) => ["TV", "TV_SHORT", "ONA"].includes(x.format));
      const film = c.slice().reverse().find((x) => x.format === "MOVIE");
      out[id] = (series || film || c[0]).id;
      if (c.done) map[id] = [out[id], Date.now()];
    });
    rootsSave();
    return out;
  }

  // a list's anime -> the anime themselves: parts swapped for their series (each once), and no
  // OVAs / specials / music videos
  async function mainOnly(media) {
    const list = media.filter((m) => !adult(m) && MAIN_FORMATS.includes(m.format));
    const isSeries = (f) => ["TV", "TV_SHORT", "ONA"].includes(f);
    // each one's way back, as far as the answer goes: [{ id, format }], and anime met on the way
    const chains = new Map();
    const further = [];
    list.forEach((m) => {
      meet(m);
      const c = [{ id: m.id, format: m.format }];
      const e1 = upEdge(m);
      if (e1) {
        meet(e1.node);
        c.push({ id: e1.node.id, format: e1.node.format });
        const e2 = upEdge(e1.node);
        if (e2) {
          c.push({ id: e2.node.id, format: e2.node.format });
          further.push(e2.node.id);
        }
      }
      chains.set(m.id, c);
    });
    // farther back (a third season or later): one more request for all of them at once
    let beyond = {};
    if (further.length) beyond = await seriesOf([...new Set(further)]).catch(() => ({}));
    const seriesId = (m) => {
      const c = chains.get(m.id);
      const last = c[c.length - 1];
      // (where it goes from there: its card is asked for below if it isn't known yet)
      if (c.length === 3 && beyond[last.id]) return beyond[last.id];
      const s = c.slice().reverse().find((x) => isSeries(x.format));
      const film = c.slice().reverse().find((x) => x.format === "MOVIE");
      return (s || film || c[0]).id;
    };
    const ids = list.map(seriesId);
    const need = [...new Set(ids)].filter((id) => !met.has(id));
    if (need.length) {
      const res = await anilist(`query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${CARD_FIELDS} } } }`, { ids: need }, true).catch(() => null);
      ((res && res.Page && res.Page.media) || []).forEach((m) => met.set(m.id, m));
    }
    const seen = new Set();
    const out = [];
    ids.forEach((id) => {
      const s = met.get(id);
      if (!s || seen.has(id) || adult(s)) return;
      seen.add(id);
      out.push(card(s));
    });
    return out;
  }

  // an anime's seasons, films and specials, in order: { seasons: [card], extras: [card] }
  // (from the series, season after season; films and side stories along the way)
  const FRANCHISE_FIELDS = `${CARD_FIELDS} relations { edges { relationType node { ${CARD_FIELDS} type relations { edges { relationType node { id type } } } } } }`;
  async function franchise(key) {
    const start = vars(key);
    const first = await anilist(`query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { id } }`, start);
    const id0 = first && first.Media && first.Media.id;
    if (!id0) return { seasons: [], extras: [] };
    const top = (await seriesOf([id0]))[id0] || id0;
    const seasons = [];
    const extras = [];
    const seen = new Set();
    let id = top;
    for (let step = 0; step < 15 && id && !seen.has(id); step++) {
      const res = await anilist(`query ($id: Int) { Media(id: $id, type: ANIME) { ${FRANCHISE_FIELDS} } }`, { id });
      const m = res && res.Media;
      if (!m) break;
      seen.add(m.id);
      if (!adult(m)) (m.format === "MOVIE" || !MAIN_FORMATS.includes(m.format) ? extras : seasons).push(card(m));
      const edges = (m.relations && m.relations.edges) || [];
      // its side stories and specials (not its sequel: that's the next step)
      edges
        .filter((e) => e.node && e.node.type === "ANIME" && ["SIDE_STORY", "SPIN_OFF", "SUMMARY"].includes(e.relationType))
        .forEach((e) => {
          if (seen.has(e.node.id) || adult(e.node)) return;
          seen.add(e.node.id);
          extras.push(card(e.node));
        });
      const next = edges.find((e) => e.relationType === "SEQUEL" && e.node && e.node.type === "ANIME" && !seen.has(e.node.id));
      id = next ? next.node.id : null;
    }
    const byDate = (a, b) => (a.year || 9999) - (b.year || 9999);
    return { seasons, extras: extras.sort(byDate) };
  }

  // kind: "trending" | "airing" | "season" | "upcoming" | "top" | "popular" | "completed" |
  //       "genre" | "studio" | "search". opts: { page, year, season, genreName, studioAl, q }
  // -> { list: [card], more: boolean }
  async function list(kind, opts = {}) {
    const page = opts.page || 1;
    const now = seasonNow();
    if (kind === "studio") {
      if (!opts.studioAl) return { list: [], more: false };
      const sq = `query ($studio: Int, $page: Int, $perPage: Int) { Studio(id: $studio) { media(sort: POPULARITY_DESC, isMain: true, page: $page, perPage: $perPage) { pageInfo { hasNextPage } nodes { ${LIST_FIELDS} type } } } }`;
      const res = await anilist(sq, { studio: opts.studioAl, page, perPage: PER });
      const m = res && res.Studio && res.Studio.media;
      return { list: await mainOnly(((m && m.nodes) || []).filter((x) => !x.type || x.type === "ANIME")), more: !!(m && m.pageInfo.hasNextPage) };
    }
    // (Mature anime on: $isAdult and $notGenres are left empty, and AniList doesn't filter)
    const q = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $status: MediaStatus, $genre: String, $search: String, $isAdult: Boolean, $notGenres: [String]) {
      Page(page: $page, perPage: $perPage) { pageInfo { hasNextPage }
        media(type: ANIME, isAdult: $isAdult, genre_not_in: $notGenres, format_in: [TV, TV_SHORT, ONA, MOVIE], sort: $sort, season: $season, seasonYear: $seasonYear, status: $status, genre: $genre, search: $search) { ${LIST_FIELDS} } } }`;
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
    const mature = adultOk() ? {} : { isAdult: false, notGenres: ["Ecchi", "Hentai"] };
    const res = await anilist(q, Object.assign({ page, perPage: PER }, mature, routes[kind] || routes.top));
    const p = res && res.Page;
    return { list: await mainOnly((p && p.media) || []), more: !!(p && p.pageInfo.hasNextPage) };
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

  window.Anime = { details: detailsOf, characters, staff, recommendations, franchise, list, topCharacters, findFor, seasonNow, SEASONS, GENRES, STUDIOS };
})();
