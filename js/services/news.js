/*
 * News: movie and TV news for news.html, from the film trade's own feeds.
 *
 * Where it comes from: the public RSS feeds of Variety, /Film, Screen Rant, Collider and The
 * Hollywood Reporter (made to be read by news readers), turned into JSON by rss2json.com (free, no
 * key, 10,000 requests a day; it keeps each feed about an hour). Only the headline, the date, the
 * picture the feed offers and a short excerpt are shown, always with the source's name, and every
 * story opens on the source's own site: nothing is copied beyond what the feed itself shares.
 *
 * The owner can change the feeds and hide sources (Admin Control Center → News); answers are
 * kept 30 minutes (Admin → API integrations), so the feeds are asked at most twice an hour.
 * Fast: every feed is asked at once and the page gets each one's stories as it answers; the last
 * news is kept in this browser (mn:newsSnap) and shown straight away the next time.
 */
(function () {
  const FEEDS = [
    { id: "variety-film", name: "Variety", url: "https://variety.com/v/film/feed/", kind: "movies", site: "https://variety.com" },
    { id: "variety-tv", name: "Variety", url: "https://variety.com/v/tv/feed/", kind: "tv", site: "https://variety.com" },
    { id: "slashfilm", name: "/Film", url: "https://www.slashfilm.com/feed/", kind: "movies", site: "https://www.slashfilm.com" },
    { id: "screenrant", name: "Screen Rant", url: "https://screenrant.com/feed/movie-news/", kind: "movies", site: "https://screenrant.com" },
    { id: "collider", name: "Collider", url: "https://collider.com/feed/category/movie-news/", kind: "movies", site: "https://collider.com" },
    { id: "thr", name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/c/movies/movie-news/feed/", kind: "movies", site: "https://www.hollywoodreporter.com" },
  ];
  const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
  const minutes = () => (window.Site ? Site.api("news").minutes : 30) || 30;

  // the categories, in the order of the chips; the first rule that fits a story wins
  const CATEGORIES = [
    ["trailers", "Trailers", "fa-play", /\b(trailer|teaser|first look|clip|sneak peek)\b/i],
    ["boxoffice", "Box Office", "fa-sack-dollar", /\b(box office|opening weekend|grosses?|ticket sales|debuts? (to|with) \$|\$\d+(\.\d+)?\s?(m|million|b|billion)\b)/i],
    ["casting", "Casting", "fa-user-plus", /\b(cast(s|ing)?|joins|to star|set to star|in talks|tapped|boards|lands role|to play|will play)\b/i],
    ["awards", "Awards", "fa-trophy", /\b(oscars?|academy awards?|emmys?|golden globes?|baftas?|cannes|venice|sundance|tiff|berlinale|awards?|nominations?|festival)\b/i],
    ["streaming", "Streaming", "fa-tv", /\b(netflix|disney\+|hbo max|\bmax\b|prime video|apple tv\+?|hulu|peacock|paramount\+|streaming|streamer)\b/i],
    ["upcoming", "Upcoming", "fa-calendar-day", /\b(release date|coming soon|delayed|moves? to|dated|sets? .* release|premiere date|arrives?)\b/i],
    ["production", "Production", "fa-clapperboard", /\b(filming|production|wraps?|shoot(ing)?|sequel|greenlit|green-lit|in development|reboot|remake|adaptation|to direct|director)\b/i],
  ];
  const KIND_LABEL = { movies: "Movies", tv: "TV" };

  const parser = new DOMParser();
  // feeds write in HTML: just the words (an inert document: nothing in it can run or load)
  const text = (html) => (parser.parseFromString(String(html || ""), "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
  const firstImg = (html) => {
    const img = parser.parseFromString(String(html || ""), "text/html").querySelector("img[src]");
    return img ? img.getAttribute("src") : "";
  };
  const safe = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");

  function feeds() {
    const custom = window.Site && Site.get().news.feeds;
    const list = Array.isArray(custom) && custom.length ? custom : FEEDS;
    const hidden = (window.Site && Site.get().news.hiddenSources) || [];
    return list.filter((f) => f && f.url && !hidden.includes(f.id));
  }

  // one feed -> [story]
  async function feed(f) {
    const r = await Api.get("news", RSS2JSON + encodeURIComponent(f.url), { minutes: minutes() });
    if (!r || r.status !== "ok") throw new Error((r && r.message) || `${f.name} couldn't be read`);
    return (r.items || []).map((it) => {
      const title = text(it.title);
      const excerpt = text(it.description || it.content);
      const cats = (it.categories || []).join(" ");
      const hay = `${title} ${cats}`;
      const cat = CATEGORIES.find((c) => c[3].test(hay));
      return {
        id: it.link || it.guid,
        title,
        link: safe(it.link) || (/^http:\/\//i.test(it.link || "") ? it.link : ""),
        // (rss2json gives the time in UTC: "2026-10-05 10:00:00")
        date: it.pubDate ? new Date(`${it.pubDate.replace(" ", "T")}Z`).getTime() || 0 : 0,
        image: safe(it.thumbnail) || safe(it.enclosure && it.enclosure.link) || safe(firstImg(it.description || it.content)),
        excerpt: excerpt.length > 220 ? `${excerpt.slice(0, 217).replace(/\s+\S*$/, "")}…` : excerpt,
        source: f.name,
        sourceId: f.id,
        site: safe(f.site),
        kind: f.kind === "tv" || /\b(season \d+|series|showrunner|episode)\b/i.test(hay) ? "tv" : "movies",
        cat: cat ? cat[0] : "",
      };
    });
  }

  // stories from several feeds: newest first, the same story once
  function merge(results) {
    const seen = new Set();
    return results
      .flatMap((r) => r.s || [])
      .filter((s) => s.title && s.link)
      .filter((s) => {
        const k = s.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 60);
        if (seen.has(k) || seen.has(s.link)) return false;
        seen.add(k);
        seen.add(s.link);
        return true;
      })
      .sort((a, b) => b.date - a.date);
  }

  // every feed at once. -> { stories, failed: [names], at }. onPart (optional) gets the stories so
  // far each time a feed answers, so the page can show them without waiting for the slowest one
  async function latest(onPart) {
    const list = feeds();
    const results = [];
    await Promise.all(
      list.map((f) =>
        feed(f)
          .then((s) => results.push({ s }))
          .catch((e) => results.push({ e, f }))
          .then(() => onPart && results.some((r) => r.s) && onPart({ stories: merge(results), failed: [], at: Date.now(), partial: true }))
      )
    );
    const stories = merge(results);
    const failed = results.filter((r) => r.e).map((r) => r.f.name);
    if (!stories.length && failed.length) throw new Error("The news feeds couldn't be reached");
    const out = { stories, failed, at: Date.now() };
    keep(out);
    return out;
  }

  // the last news this browser got, shown the moment the page opens (then the fresh news comes in)
  const SNAP = "mn:newsSnap";
  function keep(r) {
    try {
      localStorage.setItem(SNAP, JSON.stringify({ at: r.at, stories: r.stories.slice(0, 120) }));
    } catch (e) {}
  }
  function saved() {
    try {
      const v = JSON.parse(localStorage.getItem(SNAP) || "null");
      return v && Array.isArray(v.stories) && v.stories.length ? v : null;
    } catch (e) {
      return null;
    }
  }

  window.News = { FEEDS, CATEGORIES, KIND_LABEL, feeds, latest, saved };
})();
