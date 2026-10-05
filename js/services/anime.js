/*
 * Anime: the anime explorer (anime-explore.html) and the MyAnimeList card on anime title pages.
 *
 * Two free services, no keys:
 *   Jikan    (api.jikan.moe, MyAnimeList's data): first choice. Limits: 3 requests a second,
 *            60 a minute: js/services/api.js spaces them out and keeps every answer a day.
 *   AniList  (graphql.anilist.co): stands in whenever Jikan can't be reached (it has outages,
 *            and some networks can't reach it at all), or is switched off in the Admin Control Center.
 * Both are turned into the same shapes here, so the pages never know which one answered:
 *   card     { key, mal, al, title, titleEn, image, type, episodes, score, year, season, status }
 *   details  card + { titleJp, synonyms, status, airing, from, to, duration, rating, scoredBy, rank,
 *            popularity, members, favorites, synopsis, background, broadcast, producers, licensors,
 *            studios, genres, themes, demographics, source, trailer, url, next, banner, src }
 * An anime's key is its MyAnimeList id ("mal-5114"), or AniList's when MAL has none ("al-21").
 */
(function () {
  const JIKAN = "https://api.jikan.moe/v4";
  const ANILIST = "https://graphql.anilist.co";
  const hours = (p) => (window.Site ? Site.api(p).hours : 24) || 24;

  const jikan = (path, opts) => Api.get("jikan", JIKAN + path, Object.assign({ hours: hours("jikan") }, opts || {}));
  // a short fingerprint of a whole query (the cache key: two queries never share answers)
  const hash = (str) => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  const anilist = (query, variables, opts) =>
    Api.get(
      "anilist",
      ANILIST,
      Object.assign(
        {
          hours: hours("anilist"),
          key: `${hash(query)}|${JSON.stringify(variables)}`,
          init: { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables }) },
        },
        opts || {}
      )
    ).then((r) => {
      if (r && r.errors && r.errors.length) throw new Error(r.errors[0].message || "AniList error");
      return r && r.data;
    });

  // Jikan first; AniList when Jikan fails, is off, or failed a moment ago. Jikan slow to answer
  // (3.5 s): AniList is asked too, and the first good answer wins. -> { v, src }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function either(fromJikan, fromAnilist) {
    const jOk = !!fromJikan && Api.enabled("jikan") && !Api.failingNow("jikan");
    const aOk = !!fromAnilist && Api.enabled("anilist");
    if (!jOk) {
      if (!aOk) throw new Error("Anime data is switched off");
      return { v: await fromAnilist(), src: "anilist" };
    }
    const jp = fromJikan().then((v) => ({ v, src: "jikan" }));
    if (!aOk) return jp;
    let early;
    try {
      early = await Promise.race([jp, sleep(3500).then(() => null)]);
    } catch (e) {
      return { v: await fromAnilist(), src: "anilist" }; // Jikan said no straight away
    }
    if (early) return early;
    const ap = fromAnilist().then((v) => ({ v, src: "anilist" }));
    return Promise.any([jp, ap]).catch((e) => Promise.reject((e.errors && e.errors[0]) || e));
  }

  /* ---------------- Jikan -> our shapes ---------------- */

  const jImage = (x) => (x.images && ((x.images.webp && x.images.webp.large_image_url) || (x.images.jpg && (x.images.jpg.large_image_url || x.images.jpg.image_url)))) || "";
  const names = (list) => (list || []).map((p) => p.name).filter(Boolean);
  function jCard(x) {
    return {
      key: `mal-${x.mal_id}`,
      mal: x.mal_id,
      al: null,
      title: x.title_english || x.title || "",
      titleRomaji: x.title || "",
      titleEn: x.title_english || "",
      image: jImage(x),
      type: x.type || "",
      episodes: x.episodes || null,
      score: x.score || null,
      year: x.year || (x.aired && x.aired.prop && x.aired.prop.from && x.aired.prop.from.year) || null,
      season: x.season || "",
      status: x.status || "",
      members: x.members || null,
    };
  }
  function jDetails(x) {
    const ytFromUrl = (u) => (/(?:embed\/|v=)([\w-]{11})/.exec(u || "") || [])[1] || "";
    return Object.assign(jCard(x), {
      titleJp: x.title_japanese || "",
      synonyms: (x.title_synonyms || []).concat((x.titles || []).filter((t) => t.type === "Synonym").map((t) => t.title)).filter((v, i, a) => v && a.indexOf(v) === i),
      airing: !!x.airing,
      from: (x.aired && x.aired.from && x.aired.from.slice(0, 10)) || "",
      to: (x.aired && x.aired.to && x.aired.to.slice(0, 10)) || "",
      duration: x.duration || "",
      rating: x.rating || "",
      scoredBy: x.scored_by || null,
      rank: x.rank || null,
      popularity: x.popularity || null,
      favorites: x.favorites || null,
      synopsis: (x.synopsis || "").replace(/\s*\[Written by MAL Rewrite\]\s*$/i, ""),
      background: x.background || "",
      broadcast: (x.broadcast && x.broadcast.string) || "",
      producers: names(x.producers),
      licensors: names(x.licensors),
      studios: (x.studios || []).map((s) => ({ id: s.mal_id, name: s.name })),
      genres: names(x.genres),
      themes: names(x.themes),
      demographics: names(x.demographics),
      source: x.source || "",
      trailer: (x.trailer && (x.trailer.youtube_id || ytFromUrl(x.trailer.embed_url || x.trailer.url))) || "",
      url: x.url || "",
      relations: (x.relations || []).map((r) => ({
        relation: r.relation,
        entries: (r.entry || []).map((e) => ({ key: e.type === "anime" ? `mal-${e.mal_id}` : null, title: e.name, kind: e.type })),
      })),
      streaming: (x.streaming || []).map((s) => ({ name: s.name, url: s.url })),
      next: null,
      banner: "",
      src: "jikan",
    });
  }

  /* ---------------- AniList -> our shapes ---------------- */

  const FORMAT = { TV: "TV", TV_SHORT: "TV", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music" };
  const STATUS = { FINISHED: "Finished Airing", RELEASING: "Currently Airing", NOT_YET_RELEASED: "Not yet aired", CANCELLED: "Cancelled", HIATUS: "On hiatus" };
  const SEASON = { WINTER: "winter", SPRING: "spring", SUMMER: "summer", FALL: "fall" };
  const RELATION = { SEQUEL: "Sequel", PREQUEL: "Prequel", SIDE_STORY: "Side Story", SPIN_OFF: "Spin-Off", ALTERNATIVE: "Alternative version", PARENT: "Parent story", SUMMARY: "Summary", ADAPTATION: "Adaptation", SOURCE: "Adaptation", CHARACTER: "Character", OTHER: "Other", COMPILATION: "Summary", CONTAINS: "Other" };
  const date = (d) => (d && d.year ? `${d.year}-${String(d.month || 1).padStart(2, "0")}-${String(d.day || 1).padStart(2, "0")}` : "");
  const aKey = (m) => (m.idMal ? `mal-${m.idMal}` : `al-${m.id}`);
  const CARD_FIELDS = "id idMal title { romaji english } coverImage { large extraLarge } format episodes averageScore seasonYear season status popularity startDate { year } genres isAdult";
  // rows and grids leave out adult and fan-service anime (a page of its own still opens)
  const ADULT = /^(ecchi|hentai|erotica)$/i;
  const adultJ = (x) => [...(x.genres || []), ...(x.explicit_genres || [])].some((g) => ADULT.test(g.name));
  const adultA = (m) => m.isAdult || (m.genres || []).some((g) => ADULT.test(g));
  function aCard(m) {
    return {
      key: aKey(m),
      mal: m.idMal || null,
      al: m.id,
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
  function aDetails(m) {
    const ranked = (type) => (m.rankings || []).find((r) => r.type === type && r.allTime);
    const studios = (m.studios && m.studios.edges) || [];
    return Object.assign(aCard(m), {
      titleJp: (m.title && m.title.native) || "",
      synonyms: m.synonyms || [],
      airing: m.status === "RELEASING",
      from: date(m.startDate),
      to: date(m.endDate),
      duration: m.duration ? `${m.duration} min${m.format === "MOVIE" ? "" : " per ep"}` : "",
      rating: "",
      scoredBy: null,
      rank: ranked("RATED") ? ranked("RATED").rank : null,
      popularity: ranked("POPULAR") ? ranked("POPULAR").rank : null,
      favorites: m.favourites || null,
      synopsis: clean(m.description),
      background: "",
      broadcast: "",
      producers: studios.filter((e) => !e.node.isAnimationStudio).map((e) => e.node.name),
      licensors: [],
      studios: studios.filter((e) => e.node.isAnimationStudio).map((e) => ({ id: null, al: e.node.id, name: e.node.name })),
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
            key: e.node.type === "ANIME" ? aKey(e.node) : null,
            title: (e.node.title && (e.node.title.english || e.node.title.romaji)) || "",
            kind: e.node.type === "ANIME" ? "anime" : "manga",
          });
          return acc;
        }, {})
      ),
      streaming: ((m.externalLinks || []).filter((l) => l.type === "STREAMING") || []).map((l) => ({ name: l.site, url: l.url })),
      next: m.nextAiringEpisode ? { episode: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt * 1000 } : null,
      banner: m.bannerImage || "",
      src: "anilist",
    });
  }

  /* ---------------- one anime ---------------- */

  const split = (key) => {
    const [kind, n] = String(key || "").split("-");
    return { kind, n: Number(n) };
  };

  async function details(key) {
    const { kind, n } = split(key);
    if (!n) throw new Error("That anime link doesn't look right");
    const r = await either(
      kind === "mal" ? async () => {
        const res = await jikan(`/anime/${n}/full`);
        if (!res || !res.data) throw Object.assign(new Error("Not found"), { notFound: true });
        return jDetails(res.data);
      } : null,
      async () => {
        const res = await anilist(DETAIL_QUERY, kind === "mal" ? { idMal: n } : { id: n });
        if (!res || !res.Media) throw new Error("Not found");
        return aDetails(res.Media);
      }
    ).catch(async (e) => {
      // an AniList-only anime asked of Jikan: AniList straight away
      if (kind === "al") return { v: aDetails((await anilist(DETAIL_QUERY, { id: n })).Media), src: "anilist" };
      throw e;
    });
    return r.v;
  }
  // (an AniList key can't be asked of Jikan)
  const jikanFor = (key, fn) => (split(key).kind === "mal" ? fn : null);

  // characters with their voice actors: [{ name, role, image, va: [{ name, lang, image }] }]
  async function characters(key) {
    const { kind, n } = split(key);
    const r = await either(
      jikanFor(key, async () => {
        const res = await jikan(`/anime/${n}/characters`);
        return ((res && res.data) || [])
          .sort((a, b) => (a.role === "Main" ? 0 : 1) - (b.role === "Main" ? 0 : 1) || (b.favorites || 0) - (a.favorites || 0))
          .slice(0, 24)
          .map((c) => ({
            name: c.character.name,
            role: c.role,
            image: jImage(c.character),
            url: c.character.url,
            va: (c.voice_actors || []).map((v) => ({ name: v.person.name, lang: v.language, image: jImage(v.person), url: v.person.url })),
          }));
      }),
      async () => {
        const q = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { characters(sort: [ROLE, RELEVANCE, ID], perPage: 24) { edges { role node { name { full } image { large } siteUrl } voiceActors { name { full } image { large } languageV2 siteUrl } } } } }`;
        const res = await anilist(q, kind === "mal" ? { idMal: n } : { id: n });
        return ((res && res.Media && res.Media.characters.edges) || []).map((e) => ({
          name: e.node.name.full,
          role: e.role === "MAIN" ? "Main" : "Supporting",
          image: e.node.image ? e.node.image.large : "",
          url: e.node.siteUrl,
          va: (e.voiceActors || []).map((v) => ({ name: v.name.full, lang: v.languageV2, image: v.image ? v.image.large : "", url: v.siteUrl })),
        }));
      }
    );
    return r.v;
  }

  // the staff: [{ name, image, jobs: ["Director", …] }], directors and writers first
  const STAFF_ORDER = /director|series composition|script|original creator|character design|music/i;
  async function staff(key) {
    const { kind, n } = split(key);
    const r = await either(
      jikanFor(key, async () => {
        const res = await jikan(`/anime/${n}/staff`);
        return ((res && res.data) || []).map((s) => ({ name: s.person.name, image: jImage(s.person), jobs: s.positions || [], url: s.person.url }));
      }),
      async () => {
        const q = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { staff(sort: [RELEVANCE, ID], perPage: 25) { edges { role node { name { full } image { large } siteUrl } } } } }`;
        const res = await anilist(q, kind === "mal" ? { idMal: n } : { id: n });
        const people = new Map();
        ((res && res.Media && res.Media.staff.edges) || []).forEach((e) => {
          const p = people.get(e.node.name.full) || { name: e.node.name.full, image: e.node.image ? e.node.image.large : "", jobs: [], url: e.node.siteUrl };
          p.jobs.push(e.role);
          people.set(p.name, p);
        });
        return [...people.values()];
      }
    );
    return r.v.sort((a, b) => (STAFF_ORDER.test(b.jobs.join(" ")) ? 1 : 0) - (STAFF_ORDER.test(a.jobs.join(" ")) ? 1 : 0)).slice(0, 18);
  }

  // what fans of it also like: [card]
  async function recommendations(key) {
    const { kind, n } = split(key);
    const r = await either(
      jikanFor(key, async () => {
        const res = await jikan(`/anime/${n}/recommendations`);
        return ((res && res.data) || []).slice(0, 16).map((x) => Object.assign(jCard(x.entry), { votes: x.votes }));
      }),
      async () => {
        const q = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { recommendations(sort: RATING_DESC, perPage: 16) { nodes { rating mediaRecommendation { ${CARD_FIELDS} } } } } }`;
        const res = await anilist(q, kind === "mal" ? { idMal: n } : { id: n });
        return ((res && res.Media && res.Media.recommendations.nodes) || []).filter((x) => x.mediaRecommendation && !adultA(x.mediaRecommendation)).map((x) => Object.assign(aCard(x.mediaRecommendation), { votes: x.rating }));
      }
    );
    return r.v;
  }

  /* ---------------- lists (the explorer's rows) ---------------- */

  const SEASONS = ["winter", "spring", "summer", "fall"];
  function seasonNow(d = new Date()) {
    return { year: d.getFullYear(), season: SEASONS[Math.floor(d.getMonth() / 3)] };
  }
  const PER = 24;

  // kind: "trending" | "airing" | "season" | "upcoming" | "top" | "popular" | "completed" |
  //       "genre" | "studio" | "search". opts: { page, year, season, genre, genreName, studio, q }
  // -> { list: [card], more: boolean, src }
  async function list(kind, opts = {}) {
    const page = opts.page || 1;
    const now = seasonNow();
    const j = async (path) => {
      const res = await jikan(path.includes("?") ? `${path}&sfw=true` : `${path}?sfw=true`);
      // (the same anime can come twice in a row of Jikan's: once each)
      const seen = new Set();
      const listed = ((res && res.data) || []).filter((x) => !adultJ(x)).map(jCard).filter((c) => !seen.has(c.key) && seen.add(c.key));
      return { list: listed, more: !!(res && res.pagination && res.pagination.has_next_page) };
    };
    const a = async (vars) => {
      const q = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $status: MediaStatus, $genre: String, $search: String) {
        Page(page: $page, perPage: $perPage) { pageInfo { hasNextPage }
          media(type: ANIME, isAdult: false, genre_not_in: ["Ecchi", "Hentai"], sort: $sort, season: $season, seasonYear: $seasonYear, status: $status, genre: $genre, search: $search) { ${CARD_FIELDS} } } }`;
      if (vars.studio) {
        const sq = `query ($studio: Int, $page: Int, $perPage: Int) { Studio(id: $studio) { media(sort: POPULARITY_DESC, isMain: true, page: $page, perPage: $perPage) { pageInfo { hasNextPage } nodes { ${CARD_FIELDS} type } } } }`;
        const res = await anilist(sq, { studio: vars.studio, page, perPage: PER });
        const m = res && res.Studio && res.Studio.media;
        return { list: ((m && m.nodes) || []).filter((x) => (!x.type || x.type === "ANIME") && !adultA(x)).map(aCard), more: !!(m && m.pageInfo.hasNextPage) };
      }
      const res = await anilist(q, Object.assign({ page, perPage: PER }, vars));
      const p = res && res.Page;
      return { list: ((p && p.media) || []).filter((m) => !adultA(m)).map(aCard), more: !!(p && p.pageInfo.hasNextPage) };
    };
    const S = (s) => String(s || "").toUpperCase();
    const routes = {
      trending: [() => j(`/top/anime?filter=airing&page=${page}&limit=${PER}`), () => a({ sort: ["TRENDING_DESC", "POPULARITY_DESC"] })],
      airing: [() => j(`/seasons/now?page=${page}&limit=${PER}`), () => a({ sort: ["POPULARITY_DESC"], status: "RELEASING" })],
      season: [
        () => j(`/seasons/${opts.year || now.year}/${opts.season || now.season}?page=${page}&limit=${PER}`),
        () => a({ sort: ["POPULARITY_DESC"], season: S(opts.season || now.season), seasonYear: opts.year || now.year }),
      ],
      upcoming: [() => j(`/seasons/upcoming?page=${page}&limit=${PER}`), () => a({ sort: ["POPULARITY_DESC"], status: "NOT_YET_RELEASED" })],
      top: [() => j(`/top/anime?page=${page}&limit=${PER}`), () => a({ sort: ["SCORE_DESC"] })],
      popular: [() => j(`/top/anime?filter=bypopularity&page=${page}&limit=${PER}`), () => a({ sort: ["POPULARITY_DESC"] })],
      completed: [
        () => j(`/anime?status=complete&order_by=end_date&sort=desc&min_score=6.5&page=${page}&limit=${PER}`),
        () => a({ sort: ["END_DATE_DESC", "POPULARITY_DESC"], status: "FINISHED" }),
      ],
      genre: [() => j(`/anime?genres=${opts.genre}&order_by=members&sort=desc&page=${page}&limit=${PER}`), () => a({ sort: ["POPULARITY_DESC"], genre: opts.genreName })],
      studio: [
        opts.studio ? () => j(`/anime?producers=${opts.studio}&order_by=members&sort=desc&page=${page}&limit=${PER}`) : null,
        opts.studioAl ? () => a({ studio: opts.studioAl }) : null,
      ],
      search: [() => j(`/anime?q=${encodeURIComponent(opts.q || "")}&order_by=members&sort=desc&page=${page}&limit=${PER}`), () => a({ search: opts.q, sort: ["SEARCH_MATCH", "POPULARITY_DESC"] })],
    };
    const [fj, fa] = routes[kind] || [];
    const r = await either(fj || null, fa);
    return Object.assign(r.v, { src: r.src });
  }

  // genres to browse by: [{ id (Jikan's), name }] (a fixed list: AniList knows these names too)
  const GENRES = [
    [1, "Action"], [2, "Adventure"], [4, "Comedy"], [8, "Drama"], [10, "Fantasy"], [14, "Horror"], [7, "Mystery"],
    [22, "Romance"], [24, "Sci-Fi"], [36, "Slice of Life"], [30, "Sports"], [37, "Supernatural"], [41, "Suspense"],
    [18, "Mecha"], [19, "Music"], [40, "Psychological"],
  ].map(([id, name]) => ({ id, name: name === "Sci-Fi" ? "Sci-Fi" : name }));

  // studios to browse by (Jikan's producer ids, AniList's studio ids)
  const STUDIOS = [
    ["MAPPA", 569, 569], ["Kyoto Animation", 2, 2], ["Madhouse", 11, 11], ["Bones", 4, 4], ["Wit Studio", 858, 858],
    ["ufotable", 43, 43], ["Studio Ghibli", 21, 21], ["Production I.G", 10, 10], ["Sunrise", 14, 14], ["CloverWorks", 1835, 1835],
    ["A-1 Pictures", 56, 56], ["Trigger", 803, 803], ["Toei Animation", 18, 18], ["Shaft", 44, 44], ["David Production", 287, 287],
  ].map(([name, mal, al]) => ({ name, mal, al }));

  // the most-loved characters: [{ name, image, favorites, anime }]
  async function topCharacters() {
    const r = await either(
      async () => {
        const res = await jikan(`/top/characters?limit=20`);
        return ((res && res.data) || []).map((c) => ({ name: c.name, image: jImage(c), favorites: c.favorites, url: c.url, nick: (c.nicknames || [])[0] || "" }));
      },
      async () => {
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
    );
    return r.v;
  }

  // a TMDB title -> its anime (for the MyAnimeList card on an anime's title page)
  async function findFor(d) {
    const name = d.originalTitle && /[a-z]/i.test(d.originalTitle) ? d.title : d.title;
    if (!name) return null;
    const year = Number(String(d.released || "").slice(0, 4)) || null;
    const type = d.media === "movie" ? "movie" : "tv";
    const pickBest = (cards) => {
      const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const want = norm(name);
      const ok = cards.filter((c) => (type === "movie" ? c.type === "Movie" : c.type !== "Movie"));
      return ok.find((c) => (norm(c.titleEn) === want || norm(c.titleRomaji) === want || norm(c.title) === want) && (!year || !c.year || Math.abs(c.year - year) <= 1)) ||
        ok.find((c) => !year || !c.year || Math.abs(c.year - year) <= 1) || null;
    };
    const r = await list("search", { q: name });
    return pickBest(r.list || []);
  }

  window.Anime = { details, characters, staff, recommendations, list, topCharacters, findFor, seasonNow, SEASONS, GENRES, STUDIOS };
})();
