/*
 * News: movie and TV news for news.html (and a title's / a person's latest news on their pages).
 *
 * Where it comes from: the public RSS feeds of the film trade (made to be read by news readers),
 * turned into JSON by rss2json.com (free, no key). Only the headline, the date, the picture the feed
 * offers and a short excerpt are shown, always with the source's name, and every story opens on the
 * source's own site: nothing is copied beyond what the feed itself shares.
 *
 * Not an RSS list: a curated feed that answers "what matters in film and TV right now".
 *  - Sources have an authority (priority 0-100) and a tier: Primary (Variety, The Hollywood
 *    Reporter: 100), Film publications (/Film 85, Collider 75), Supplementary (Screen Rant 55). Each
 *    source has its feeds by kind (movie news, TV news, industry). The owner changes priorities,
 *    switches feeds off and adds their own (Admin → News: news.priority, hiddenSources, extraSources).
 *  - Every story gets its kind from what it says (a movie, a show, or neither), not from its feed,
 *    and its categories (several when they fit): Trailers, Casting, Production, Release dates, Box
 *    Office, Awards, Industry.
 *  - The same story told by several outlets is one story: told by its best source, "also reported
 *    by" the others (title words and names, within two days; how close they must be: news.dupes).
 *  - Each story is scored: authority + recency + importance (what kind of news it is, how many
 *    outlets have it) + relevance to you (the titles in your library), with the owner's weights
 *    (news.weights). Breaking: recent and important enough (news.breaking: threshold, hours), or
 *    marked by the owner. The owner can also promote, hide and merge stories.
 *  - Notifications: a breaking story, or a trailer for a title on your Watchlist (js/services/alerts.js).
 *
 * Fast: every feed asked at once (answers kept 30 minutes: Admin → API integrations), the page gets
 * each feed's stories as it answers, and the work (categories, grouping, scores) is done once per
 * fetch; the last news is kept in this browser (mn:newsSnap) and shown the moment a page opens.
 */
(function () {
  // the sources: name, authority, tier (1 primary, 2 film publications, 3 supplementary), site
  const SOURCES = {
    // (wp: a WordPress site whose feed leaves its pictures out: they're asked from its posts API)
    variety: { name: "Variety", priority: 100, tier: 1, site: "https://variety.com", wp: "https://variety.com" },
    thr: { name: "The Hollywood Reporter", priority: 100, tier: 1, site: "https://www.hollywoodreporter.com", wp: "https://www.hollywoodreporter.com" },
    slashfilm: { name: "/Film", priority: 85, tier: 2, site: "https://www.slashfilm.com" },
    collider: { name: "Collider", priority: 75, tier: 2, site: "https://collider.com" },
    screenrant: { name: "Screen Rant", priority: 55, tier: 3, site: "https://screenrant.com" },
  };
  const TIERS = { 1: "Primary sources", 2: "Film publications", 3: "Supplementary" };
  // the feeds: each source's movie news, TV news and industry news
  const FEEDS = [
    // (wp: the same section from the site's WordPress posts API, which goes back as far as the news is
    // kept, with pictures; the RSS feed is what's read when that can't be had)
    { id: "variety-film", source: "variety", kind: "movies", url: "https://variety.com/v/film/feed/", wp: "vertical=524" },
    { id: "thr", source: "thr", kind: "movies", url: "https://www.hollywoodreporter.com/c/movies/movie-news/feed/", wp: "categories=65852" },
    { id: "slashfilm", source: "slashfilm", kind: "movies", url: "https://www.slashfilm.com/feed/" },
    { id: "collider", source: "collider", kind: "movies", url: "https://collider.com/feed/category/movie-news/" },
    { id: "screenrant", source: "screenrant", kind: "movies", url: "https://screenrant.com/feed/movie-news/" },
    { id: "variety-tv", source: "variety", kind: "tv", url: "https://variety.com/v/tv/feed/", wp: "vertical=462" },
    { id: "thr-tv", source: "thr", kind: "tv", url: "https://www.hollywoodreporter.com/c/tv/tv-news/feed/", wp: "categories=65855" },
    { id: "collider-tv", source: "collider", kind: "tv", url: "https://collider.com/feed/category/tv-news/" },
    { id: "screenrant-tv", source: "screenrant", kind: "tv", url: "https://screenrant.com/feed/tv-news/" },
    { id: "variety-biz", source: "variety", kind: "industry", url: "https://variety.com/v/biz/feed/", wp: "vertical=20095" },
    { id: "thr-biz", source: "thr", kind: "industry", url: "https://www.hollywoodreporter.com/c/business/feed/", wp: "categories=65850" },
  ];
  const KIND_LABEL = { movies: "Movies", tv: "TV", industry: "Industry" };
  const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
  const cfg = () => (window.Site && Site.get().news) || {};
  const DAY = 86400000;
  // how far back the news goes (Admin → News → Ranking: news.maxAgeDays, 7 days unless set)
  const maxAge = () => Math.max(1, Math.min(30, Number(cfg().maxAgeDays) || 7)) * DAY;
  const minutes = () => (window.Site ? Site.api("news").minutes : 30) || 30;

  // the categories (a story can have several), in the order of the chips
  const CATEGORIES = [
    ["trailers", "Trailers", "fa-play", /\b(trailers?|teasers?|first[- ]look|clip|sneak peek|footage)\b/i],
    ["casting", "Casting", "fa-user-plus", /\b(cast(s|ing)?|joins?|to star|set to star|in talks|tapped|boards|lands (lead )?role|to play|will play|co-?stars?|ensemble|recast)\b/i],
    ["production", "Production", "fa-clapperboard", /\b(filming|in production|production (begins|starts|wraps|update)|wraps?|shoot(ing)?|greenlit|green-?lit|in development|sequel|reboot|remake|adaptation|to direct|attached to direct|set to helm|helm|script|screenplay|showrunner|renewed|cancel(l)?ed|picked up)\b/i],
    ["release", "Release dates", "fa-calendar-day", /\b(release date|dated|delayed|postponed|pushed (back|to)|moves? (up |back )?to|sets? .{0,40}(release|premiere|debut)|premiere date|in theaters|theatrical release|streaming date|arrives? (on|in)|coming (to|in) )/i],
    ["boxoffice", "Box Office", "fa-sack-dollar", /\b(box office|opening weekend|grosses?|ticket sales|global haul|debuts? (to|with) \$|\$\d+(\.\d+)?\s?(m|million|b|billion)\b)/i],
    ["awards", "Awards", "fa-trophy", /\b(oscars?|academy awards?|emmys?|golden globes?|baftas?|sag awards?|cannes|venice|sundance|tiff|berlinale|awards?|nominations?|nominees?|festival)\b/i],
    ["industry", "Industry", "fa-building", /\b(studios?|mergers?|acquisitions?|acquires?|buys|deal|exec(utive)?s?|ceo|chairman|chief|president|layoffs?|strike|union|wga|sag-aftra|agency|caa|wme|uta|signs with|distribution|rights|investors?|earnings|stock|revenue|subscribers)\b/i],
  ];

  const parser = new DOMParser();
  // feeds write in HTML: just the words (an inert document: nothing in it can run or load)
  const text = (html) => (parser.parseFromString(String(html || ""), "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
  const firstImg = (html) => {
    const img = parser.parseFromString(String(html || ""), "text/html").querySelector("img[src]");
    return img ? img.getAttribute("src") : "";
  };
  const safe = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");

  /* ---------------- the sources (the owner's changes on top) ---------------- */

  // every source: the site's, then the owner's own ({ id, name, url, kind, priority, site })
  function sources() {
    const out = {};
    const pri = cfg().priority || {};
    Object.entries(SOURCES).forEach(([k, s]) => (out[k] = Object.assign({}, s, { key: k, priority: pri[k] != null ? Number(pri[k]) : s.priority })));
    (cfg().extraSources || []).forEach((x) => {
      if (!x || !x.id) return;
      out[x.id] = { key: x.id, name: x.name || x.id, priority: Number(x.priority) || 60, tier: Number(x.priority) >= 90 ? 1 : Number(x.priority) >= 70 ? 2 : 3, site: safe(x.site) || "", custom: true };
    });
    return out;
  }
  // every feed (the site's and the owner's own), whether it's on or not
  function allFeeds() {
    const custom = cfg().feeds;
    const base = Array.isArray(custom) && custom.length ? custom : FEEDS;
    const extra = (cfg().extraSources || []).filter((x) => x && x.id && /^https:\/\//.test(x.url || "")).map((x) => ({ id: x.id, source: x.id, kind: x.kind || "movies", url: x.url, custom: true }));
    const src = sources();
    return base.concat(extra).map((f) => {
      const s = src[f.source] || { name: f.name || f.source, priority: 60, tier: 3 };
      return Object.assign({}, f, { name: s.name, priority: s.priority, tier: s.tier, site: s.site || f.site || "" });
    });
  }
  // the feeds in use: switched on, and their kind on (Movie news / TV news, Admin → News)
  function feeds() {
    const c = cfg();
    const hidden = c.hiddenSources || [];
    return allFeeds().filter((f) => f.url && !hidden.includes(f.id) && !(f.kind === "movies" && c.movies === false) && !(f.kind === "tv" && c.tv === false));
  }

  /* ---------------- reading a feed ---------------- */

  const STATUS = "mn:newsStatus"; // { feedId: { ok, n, at, error } } (Admin → News: Feeds)
  function noteStatus(id, v) {
    try {
      const all = JSON.parse(localStorage.getItem(STATUS) || "{}");
      all[id] = Object.assign({ at: Date.now() }, v);
      localStorage.setItem(STATUS, JSON.stringify(all));
    } catch (e) {}
  }
  const status = () => {
    try {
      return JSON.parse(localStorage.getItem(STATUS) || "{}");
    } catch (e) {
      return {};
    }
  };

  // a movie or a show? (what the story says, the feed only when it says nothing)
  const TV_WORDS = /\b(series|season \d+|seasons?|episodes?|showrunner|renewed|cancel(l)?ed|pilot|miniseries|limited series|docuseries|sitcom|emmys?|tv show|the show|spinoff|spin-off|streaming series|late-night|talk show)\b/i;
  const MOVIE_WORDS = /\b(film|films|movie|movies|box office|theatrical|in theaters|sequel|oscars?|director'?s cut|feature|biopic|blockbuster|trilogy)\b/i;
  function kindOf(hay, feedKind) {
    const tv = (hay.match(new RegExp(TV_WORDS, "gi")) || []).length;
    const mv = (hay.match(new RegExp(MOVIE_WORDS, "gi")) || []).length;
    if (tv > mv) return "tv";
    if (mv > tv) return "movies";
    return feedKind === "industry" ? "industry" : feedKind;
  }

  // a WordPress section, as far back as the news is kept (at most 200 stories): its posts API, asked
  // straight (the site lets any page read it), kept like the feeds; 8 seconds at most
  async function wpItems(f) {
    const base = (SOURCES[f.source] || {}).wp;
    if (!base || !f.wp) return null;
    const key = `news|wp|${f.id}|${cfg().maxAgeDays || 7}`;
    const saved = await Api.cacheGet(key);
    if (saved && saved.v && Date.now() - saved.at < minutes() * 60000) return saved.v;
    // (from the hour: the same address for an hour)
    const after = new Date(Math.floor((Date.now() - maxAge()) / 3600000) * 3600000).toISOString().slice(0, 19);
    const ask = async (page) => {
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), 8000);
      try {
        const res = await fetch(`${base}/wp-json/wp/v2/posts?${f.wp}&after=${after}&per_page=100&page=${page}&_fields=id,link,date_gmt,title,excerpt,jetpack_featured_media_url`, { signal: stop.signal, credentials: "omit" });
        if (!res.ok) throw new Error(`${f.name} answered ${res.status}`);
        return { items: await res.json(), pages: Number(res.headers.get("X-WP-TotalPages")) || 1 };
      } finally {
        clearTimeout(timer);
      }
    };
    const first = await ask(1);
    let items = Array.isArray(first.items) ? first.items : [];
    if (first.pages > 1) items = items.concat((await ask(2).catch(() => ({ items: [] }))).items || []);
    // (as the RSS items look: title, link, pubDate, thumbnail, description)
    const out = items.map((x) => ({
      title: (x.title && x.title.rendered) || "",
      link: x.link,
      guid: `?p=${x.id}`,
      pubDate: String(x.date_gmt || "").replace("T", " "),
      thumbnail: x.jetpack_featured_media_url ? `${x.jetpack_featured_media_url}?w=800` : "",
      description: (x.excerpt && x.excerpt.rendered) || "",
      categories: [],
    }));
    Api.cacheSet(key, out);
    return out;
  }

  // one feed -> [story] (a WordPress section from its API when it can, else its RSS feed)
  async function feed(f) {
    let items = null;
    try {
      items = await wpItems(f);
    } catch (e) {}
    if (!items) {
      let r;
      try {
        r = await Api.get("news", RSS2JSON + encodeURIComponent(f.url), { minutes: minutes() });
        if (!r || r.status !== "ok") throw new Error((r && r.message) || `${f.name} couldn't be read`);
      } catch (e) {
        noteStatus(f.id, { ok: false, n: 0, error: e.message });
        throw e;
      }
      items = r.items || [];
    }
    noteStatus(f.id, { ok: true, n: items.length });
    const stories = items.map((it) => {
      const title = text(it.title);
      const excerpt = text(it.description || it.content);
      const tags = (it.categories || []).join(" ");
      const hay = `${title} ${tags}`;
      const cats = CATEGORIES.filter((c) => c[3].test(hay)).map((c) => c[0]);
      if (f.kind === "industry" && !cats.includes("industry")) cats.push("industry");
      return {
        id: it.link || it.guid,
        title,
        link: safe(it.link) || (/^http:\/\//i.test(it.link || "") ? it.link : ""),
        // (rss2json gives the time in UTC: "2026-10-05 10:00:00")
        date: it.pubDate ? new Date(`${it.pubDate.replace(" ", "T")}Z`).getTime() || 0 : 0,
        image: safe(it.thumbnail) || safe(it.enclosure && it.enclosure.link) || safe(firstImg(it.content)) || safe(firstImg(it.description)),
        excerpt: excerpt.length > 220 ? `${excerpt.slice(0, 217).replace(/\s+\S*$/, "")}…` : excerpt,
        source: f.name,
        sourceKey: f.source,
        sourceId: f.id,
        priority: f.priority,
        tier: f.tier,
        site: safe(f.site),
        kind: kindOf(`${hay} ${excerpt}`, f.kind),
        cats,
        cat: cats[0] || "",
        // (its number on a WordPress site: "?p=1236723194" or the link's end)
        post: (String(it.guid || "").match(/[?&]p=(\d+)/) || String(it.link || "").match(/-(\d{6,})\/?$/) || [])[1] || "",
      };
    });
    return withPictures(f, stories);
  }

  // a WordPress source's stories without a picture (The Hollywood Reporter's feed has none): their
  // featured pictures from the site's posts API, all of a feed's in one request. Its own little ask
  // (4 seconds at most, never holding the news up), and the pictures found are kept (mn:newsPics), so
  // a story's picture is asked for once; when it can't be had, the story keeps its source's card
  const PICS = "mn:newsPics";
  const picsKept = () => {
    try {
      return JSON.parse(localStorage.getItem(PICS) || "{}");
    } catch (e) {
      return {};
    }
  };
  async function withPictures(f, stories) {
    const wp = (SOURCES[f.source] || {}).wp;
    if (!wp) return stories;
    const kept = picsKept();
    const sized = (u) => `${u}${u.includes("?") ? "&" : "?"}w=800`;
    stories.forEach((x) => !x.image && x.post && kept[x.post] && (x.image = sized(kept[x.post])));
    const need = stories.filter((x) => !x.image && x.post);
    if (!need.length) return stories;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 4000);
    try {
      const res = await fetch(`${wp}/wp-json/wp/v2/posts?include=${need.map((x) => x.post).join(",")}&per_page=${need.length}&_fields=id,jetpack_featured_media_url`, { signal: stop.signal, credentials: "omit" });
      const posts = res.ok ? await res.json() : [];
      (Array.isArray(posts) ? posts : []).forEach((x) => {
        const u = safe(x.jetpack_featured_media_url);
        if (u) kept[String(x.id)] = u;
      });
      need.forEach((x) => kept[x.post] && (x.image = sized(kept[x.post])));
      // (the newest 400 kept)
      const keys = Object.keys(kept);
      if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((k) => delete kept[k]);
      localStorage.setItem(PICS, JSON.stringify(kept));
    } catch (e) {
    } finally {
      clearTimeout(timer);
    }
    return stories;
  }

  /* ---------------- what kind of news it is (importance 0-100) ---------------- */

  const IMPORTANT = [
    [/\b(dies|dead at|passes away|has died|death of|obituary|rip)\b/i, 30],
    [/\bexclusive\b/i, 14],
    [/\b(announce[sd]?|unveil(s|ed)?)\b/i, 12],
    [/\b(first reactions|first reviews|world premiere)\b/i, 6],
    [/\b(casts?|joins|to star|set to star|lands role|in talks)\b/i, 12],
    [/\b(first[- ]look|official trailer|teaser trailer|trailer)\b/i, 10],
    [/\b(release date|delayed|postponed|moves? to|sets? .{0,30}(release|premiere))\b/i, 12],
    [/\b(greenlit|green-?lit|renewed|cancel(l)?ed|picked up)\b/i, 11],
    [/\b(acquires?|acquisition|merger|buys|sells|deal)\b/i, 12],
    [/\b(names|hires|appoints|exits|exiting|steps down|ousted|promoted to)\b/i, 9],
    [/\b(box office|opening weekend|record)\b/i, 9],
    [/\b(oscars?|emmys?|golden globes?) (nominations?|winners?|nominees?)\b/i, 12],
    [/\b(sequel|franchise|marvel|dc studios|star wars|pixar|disney|warner bros|universal|paramount|sony|netflix|a24|lionsgate|amazon mgm)\b/i, 5],
    [/\b(officially|confirmed|confirms)\b/i, 6],
  ];
  const MINOR = [
    [/\b(review|reviews|recap|ranked|ranking|best|worst|every|top \d+|\d+ (movies|films|shows|series|moments|things|reasons))\b/i, -14],
    [/\b(explained|ending explained|theory|theories|easter eggs?|why|how|what we know|everything we know|quiz|guide)\b/i, -14],
    [/\b(where to watch|how to watch|streaming now|you need to watch|you should watch|underrated|hidden gem)\b/i, -16],
    [/\b(interview|podcast|opinion|essay|column)\b/i, -5],
    // (someone talking about something isn't the news itself)
    [/\b(wants? to see|would love|explains why|says|said|talks|teases|hopes|opens up|reflects|addresses|responds|recalls|remembers|admits|weighs in|praises|slams|reacts)\b/i, -12],
  ];
  function importanceOf(s) {
    const t = s.title;
    let v = 14;
    IMPORTANT.forEach(([re, w]) => re.test(t) && (v += w));
    MINOR.forEach(([re, w]) => re.test(t) && (v += w));
    return Math.max(0, Math.min(100, v));
  }

  /* ---------------- the same story from several outlets ---------------- */

  const STOP = new Set(
    "a an the and or of to in on for with at by from as is are was were be been it its this that these those his her their our your my new first after over into about up out off more most than then just will would could should can may might has have had do does did not no but so if says said report reports reportedly how why what who when where which official officially confirmed confirms reveals revealed exclusive update news sets set gets get takes take makes make film movie series season show tv trailer star stars".split(
      " "
    )
  );
  const tokens = (t) =>
    String(t)
      .toLowerCase()
      .replace(/['’]s\b/g, "")
      .replace(/[^a-z0-9$]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w));
  // what's in quotes in a headline (a title: 'Artificial', 'The Social Reckoning')
  const quoted = (t) =>
    (String(t).match(/[‘'"“]([^’'"”]{3,60})[’'"”]/g) || [])
      .map((q) => q.slice(1, -1).toLowerCase().trim())
      .filter((q) => q.length >= 4);
  // how close two headlines are (0-1): the words they share, a rare word (a name: Sorkin, Skydance,
  // CAA) counting for much more than a common one; they must share a rare word or a quoted title
  // ("first reactions" alone doesn't make two films' stories one)
  const SENSITIVITY = { strict: 0.45, balanced: 0.34, loose: 0.24 };
  function similarity(a, b, weight, rare) {
    let shared = 0;
    let union = 0;
    let hasRare = false;
    new Set([...a._t, ...b._t]).forEach((w) => {
      const x = weight(w);
      union += x;
      if (a._t.has(w) && b._t.has(w)) {
        shared += x;
        if (rare(w)) hasRare = true;
      }
    });
    const lowA = a.title.toLowerCase();
    const lowB = b.title.toLowerCase();
    const sameTitle = a._q.some((q) => lowB.includes(q)) || b._q.some((q) => lowA.includes(q));
    if (!hasRare && !sameTitle) return 0;
    return shared / (union || 1) + (sameTitle ? 0.2 : 0);
  }
  // stories -> [story]: one per real story, told by its best source (then the newest), the others in its
  // "also" ({ source, sourceKey, link, title })
  function cluster(stories) {
    const c = cfg();
    const need = SENSITIVITY[c.dupes] || SENSITIVITY.balanced;
    const TWO_DAYS = 2 * 86400000;
    // (how many headlines have each word: the fewer, the more it says)
    const df = new Map();
    stories.forEach((s) => {
      s._t = new Set(tokens(s.title));
      s._q = quoted(s.title);
      s._t.forEach((w) => df.set(w, (df.get(w) || 0) + 1));
    });
    const N = stories.length || 1;
    const weight = (w) => Math.log(1 + N / (df.get(w) || 1));
    const rare = (w) => (df.get(w) || 0) <= 3;
    const order = stories.slice().sort((a, b) => b.priority - a.priority || b.date - a.date);
    const groups = [];
    order.forEach((s) => {
      const g = groups.find((x) => x.members.some((m) => Math.abs(m.date - s.date) < TWO_DAYS && m.sourceKey !== s.sourceKey && similarity(m, s, weight, rare) >= need));
      if (g) g.members.push(s);
      else groups.push({ members: [s] });
    });
    // the owner's merges: stories they put together
    (c.merges || []).filter(Array.isArray).forEach((pair) => {
      const gs = groups.filter((g) => g.members.some((m) => pair.includes(m.link)));
      if (gs.length < 2) return;
      gs.slice(1).forEach((g) => {
        gs[0].members.push(...g.members);
        groups.splice(groups.indexOf(g), 1);
      });
    });
    return groups.map((g) => {
      const members = g.members.sort((a, b) => b.priority - a.priority || b.date - a.date);
      const lead = Object.assign({}, members[0]);
      // (one story, everything it is: every outlet's categories, the newest time, a picture if any has one)
      lead.cats = [...new Set(members.flatMap((m) => m.cats))];
      lead.cat = lead.cats[0] || "";
      lead.date = Math.max(...members.map((m) => m.date));
      // (every outlet's picture: the page tries the next one when one doesn't load)
      lead.images = [...new Set(members.map((m) => m.image).filter(Boolean))];
      if (!lead.image) lead.image = lead.images[0] || "";
      lead.also = members.slice(1).map((m) => ({ source: m.source, sourceKey: m.sourceKey, link: m.link, title: m.title }));
      members.forEach((m) => {
        delete m._t;
        delete m._q;
      });
      delete lead._t;
      delete lead._q;
      return lead;
    });
  }

  /* ---------------- scores ---------------- */

  // the titles in your library (and their alternatives), for "relevant to you" and the links to them
  function libraryTitles() {
    if (!window.Store || Store.guest) return [];
    const seen = new Set();
    return Store.all()
      .filter((i) => i.title && String(i.title).length >= 4)
      .map((i) => ({ id: i.id, title: String(i.title), watch: !!i.watchlist, weight: i.favorite ? 1 : i.watchlist ? 0.9 : typeof i.rating === "number" && i.rating >= 8 ? 0.8 : 0.5 }))
      .filter((x) => !seen.has(x.title.toLowerCase()) && seen.add(x.title.toLowerCase()));
  }
  const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // does a story name this title (or person)? Written as it is, capitals and all ("Groundhog Day",
  // not "groundhog day"); a one-word title only in quotes ('From', not "from" in a sentence)
  function mentions(hay, title) {
    const t = String(title).trim();
    if (!/\s/.test(t)) return new RegExp(`[‘'"“]${reEsc(t)}[’'"”]`).test(hay);
    return new RegExp(`(^|[^\\w])${reEsc(t)}([^\\w]|$)`).test(hay);
  }

  // the scores' weights (the owner can change them: Admin → News → Ranking)
  const WEIGHTS = { authority: 35, recency: 30, importance: 30, relevance: 15 };
  const BREAKING = { threshold: 50, hours: 6 };

  // every story's score, Breaking, and the title of yours it's about
  function score(list) {
    const c = cfg();
    const w = Object.assign({}, WEIGHTS, c.weights || {});
    const total = w.authority + w.recency + w.importance + w.relevance || 1;
    const br = Object.assign({}, BREAKING, c.breaking || {});
    const mine = libraryTitles();
    const now = Date.now();
    const promoted = new Set((c.promote || []).filter((x) => !x.until || x.until > now).map((x) => x.link || x));
    const marked = new Set((c.breakingMarks || []).map((x) => x.link || x));
    list.forEach((s) => {
      const hours = Math.max(0, (now - s.date) / 3600000);
      // (more outlets telling it = it matters more)
      s.importance = Math.min(100, importanceOf(s) + Math.min(30, (s.also || []).length * 12));
      const recency = 100 * Math.exp(-hours / 12);
      // (about a title only when its headline names it: an excerpt mentions others in passing, "ahead of
      // Avengers: Doomsday"; several named: the longest, the most particular)
      const about = mine.filter((m) => mentions(s.title, m.title)).sort((a, b) => b.title.length - a.title.length)[0];
      s.about = about ? { id: about.id, title: about.title, watch: about.watch } : null;
      const relevance = about ? 100 * about.weight : 0;
      s.score = (w.authority * s.priority + w.recency * recency + w.importance * s.importance + w.relevance * relevance) / total;
      s.promoted = promoted.has(s.link);
      if (s.promoted) s.score += 1000;
      s.breaking = (marked.has(s.link) && hours < 48) || (hours <= br.hours && s.importance >= br.threshold);
    });
    return list;
  }

  // the owner's hidden stories out; then by score
  function rank(list) {
    const hidden = new Set((cfg().hidden || []).map((x) => x.link || x));
    return score(list.filter((s) => !hidden.has(s.link) && !(s.also || []).some((a) => hidden.has(a.link)))).sort((a, b) => b.score - a.score);
  }

  // which stories to show, for the way you read the news (News preferences on news.html):
  //  "recommended": every source, the supplementary ones weighed down and kept to about a quarter
  //  "all": every source on the site, as scored · "mine": only the sources you picked
  function view(list, mode, mySources) {
    if (mode === "mine" && Array.isArray(mySources)) return list.filter((s) => mySources.includes(s.sourceKey) || (s.also || []).some((a) => mySources.includes(a.sourceKey)));
    if (mode !== "recommended") return list;
    const out = [];
    const later = [];
    let low = 0;
    list.forEach((s) => {
      if (s.tier >= 3 && !s.promoted) {
        if (low + 1 > Math.max(1, Math.round(out.length * 0.25))) return later.push(s);
        low++;
      }
      out.push(s);
    });
    return out.concat(later);
  }

  /* ---------------- getting the news ---------------- */

  // stories from several feeds: newest first, the same link once, nothing older than the news goes back
  function merge(results) {
    const seen = new Set();
    const since = Date.now() - maxAge();
    return results
      .flatMap((r) => r.s || [])
      .filter((s) => s.title && s.link && s.date >= since && !seen.has(s.link) && seen.add(s.link))
      .sort((a, b) => b.date - a.date);
  }

  // the stories this browser has seen (mn:newsArchive), as far back as the news goes: the feeds that
  // only give their newest ten (/Film, Collider, Screen Rant) build up a week this way
  const ARCHIVE = "mn:newsArchive";
  function archived() {
    try {
      const list = JSON.parse(localStorage.getItem(ARCHIVE) || "[]");
      const since = Date.now() - maxAge();
      return Array.isArray(list) ? list.filter((s) => s && s.link && s.date >= since) : [];
    } catch (e) {
      return [];
    }
  }
  function archive(fresh) {
    try {
      const seen = new Set();
      const keep = fresh
        .concat(archived())
        .filter((s) => s.link && !seen.has(s.link) && seen.add(s.link))
        .sort((a, b) => b.date - a.date)
        .slice(0, 900)
        .map((s) => ({ id: s.id, title: s.title, link: s.link, date: s.date, image: s.image, excerpt: s.excerpt, source: s.source, sourceKey: s.sourceKey, sourceId: s.sourceId, priority: s.priority, tier: s.tier, site: s.site, kind: s.kind, cats: s.cats, cat: s.cat, post: s.post }));
      localStorage.setItem(ARCHIVE, JSON.stringify(keep));
    } catch (e) {}
  }

  // every feed at once. -> { stories (grouped and ranked), failed: [names], at }. onPart (optional)
  // gets the stories so far as the feeds answer (at most every 400 ms), so the page can show them
  // without waiting for the slowest one
  async function latest(onPart) {
    const list = feeds();
    const results = [];
    const old = archived().filter((s) => list.some((f) => f.id === s.sourceId));
    let partTimer = null;
    const part = () => {
      if (!onPart || partTimer) return;
      partTimer = setTimeout(() => {
        partTimer = null;
        if (results.some((r) => r.s)) onPart({ stories: rank(cluster(merge(results.concat([{ s: old }])))), failed: [], at: Date.now(), partial: true });
      }, 400);
    };
    await Promise.all(
      list.map((f) =>
        feed(f)
          .then((s) => results.push({ s }))
          .catch((e) => results.push({ e, f }))
          .then(part)
      )
    );
    clearTimeout(partTimer);
    const fresh = merge(results);
    archive(fresh);
    // (what the feeds give now first, then what was seen before)
    const raw = merge([{ s: fresh }, { s: old }]);
    const failed = results.filter((r) => r.e).map((r) => r.f.name);
    if (!raw.length && failed.length) throw new Error("The news feeds couldn't be reached");
    const out = { stories: rank(cluster(raw)), failed, at: Date.now() };
    keep(out);
    return out;
  }

  // the last news this browser got (grouped), shown the moment a page opens
  const SNAP = "mn:newsSnap";
  function keep(r) {
    try {
      localStorage.setItem(SNAP, JSON.stringify({ v: 2, at: r.at, stories: r.stories.slice(0, 400) }));
    } catch (e) {}
  }
  function saved() {
    try {
      const v = JSON.parse(localStorage.getItem(SNAP) || "null");
      if (!v || v.v !== 2 || !Array.isArray(v.stories) || !v.stories.length) return null;
      // (scored again: the time has moved on, and the owner may have changed something; too old: out)
      const since = Date.now() - maxAge();
      v.stories = rank(v.stories.filter((s) => s.date >= since || s.pinned));
      return v;
    } catch (e) {
      return null;
    }
  }

  // a title's or a person's news, from the last news this browser got (no asking)
  // -> [story], newest first: the ones whose headline names it (a title said whole, a person's full name)
  function about(names, max) {
    const snap = saved();
    if (!snap) return [];
    const ns = (names || []).filter((n) => n && String(n).trim().length >= 4).map(String);
    if (!ns.length) return [];
    return snap.stories
      .filter((s) => ns.some((n) => mentions(s.title, n) || (s.also || []).some((a) => mentions(a.title, n))))
      .sort((a, b) => b.date - a.date)
      .slice(0, max || 6);
  }

  /* ---------------- notifications: breaking news, a trailer for a title on your Watchlist ---------------- */

  function alertsFrom(stories) {
    if (!window.Alerts || !Alerts.add) return;
    const now = Date.now();
    const items = [];
    stories
      .filter((s) => s.breaking && now - s.date < 3 * 3600000)
      .slice(0, 2)
      .forEach((s) => items.push({ key: `news|${s.link}`, kind: "breaking", title: s.title, date: Store.today(), poster: "", extra: { link: s.link, source: s.source } }));
    stories
      .filter((s) => s.about && s.about.watch && s.cats.includes("trailers") && now - s.date < 2 * 86400000)
      .slice(0, 2)
      .forEach((s) => items.push({ key: `trailer|${s.link}`, kind: "trailer", title: s.about.title, id: s.about.id, date: Store.today(), poster: "", extra: { link: s.link, source: s.source, headline: s.title } }));
    if (items.length) Alerts.add(items);
  }

  // on other pages: now and then (at most every 45 minutes, when the page has been open a while),
  // the news in the background, for these notifications
  function backgroundCheck() {
    if (!window.Site || !Site.feature("news") || !window.Alerts || Store.guest) return;
    const nt = Site.get().notifications || {};
    if (nt.on === false || (nt.breaking === false && nt.trailer === false)) return;
    const snap = saved();
    if (snap && Date.now() - snap.at < 45 * 60000) return alertsFrom(snap.stories);
    setTimeout(() => latest().then((r) => alertsFrom(r.stories), () => {}), 8000);
  }

  // (Home: the background check, once the page has settled)
  document.addEventListener("DOMContentLoaded", () => document.body.dataset.page === "home" && backgroundCheck());

  window.News = { WEIGHTS, BREAKING, SENSITIVITY, SOURCES, TIERS, FEEDS, CATEGORIES, KIND_LABEL, sources, allFeeds, feeds, latest, saved, about, rank, view, status, alertsFrom, backgroundCheck };
})();
