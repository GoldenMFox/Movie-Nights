/*
 * TVmaze (api.tvmaze.com, free, no key): what TMDB doesn't do well for shows.
 *
 * Who's in charge of what on a show's page (so the two never contradict each other):
 *   TMDB   title, overview, pictures, genres, cast, ratings, where to watch, seasons for "Your progress"
 *   TVmaze when it airs (days, time, time zone), network / streaming channel, the next and the last
 *          episode (TVmaze updates these within hours), the episode guide (titles, dates, air times,
 *          runtimes, summaries, stills, ratings), the show's type, official site, and the people
 *          behind it (creators, producers)
 * TVmaze has no "related shows" or spin-offs: those stay TMDB's recommendations.
 *
 * Asked through js/services/api.js (kept, shared, within TVmaze's limit of 20 requests per 10 s).
 */
(function () {
  const BASE = "https://api.tvmaze.com";
  const hours = () => (window.Site ? Site.api("tvmaze").hours : 12) || 12;
  const ask = (path, opts) => Api.get("tvmaze", BASE + path, Object.assign({ hours: hours() }, opts || {}));

  // TVmaze writes summaries in HTML ("<p>Walter…</p>"): just the words. (DOMParser: an inert
  // document, so nothing in someone else's HTML can run or load)
  const parser = new DOMParser();
  const text = (html) => {
    const doc = parser.parseFromString(String(html || "").replace(/<\/p>\s*<p>/gi, "\n\n"), "text/html");
    return (doc.body.textContent || "").trim();
  };

  // TMDB show -> TVmaze show id (by its IMDb id; else by name, if the year matches)
  async function find(d) {
    if (!d) return null;
    if (d.imdbId) {
      const hit = await ask(`/lookup/shows?imdb=${encodeURIComponent(d.imdbId)}`, { days: 30 }).catch(() => null);
      if (hit && hit.id) return hit.id;
    }
    const name = d.originalTitle && d.originalTitle !== d.title ? d.title : d.title;
    if (!name) return null;
    const list = await ask(`/search/shows?q=${encodeURIComponent(name)}`, { days: 7 }).catch(() => []);
    const year = String(d.released || "").slice(0, 4);
    const best = (list || []).map((x) => x.show).find((s) => s && (!year || String(s.premiered || "").slice(0, 4) === year));
    return best ? best.id : null;
  }

  const epOf = (e) =>
    e && {
      id: e.id,
      s: e.season,
      e: e.number, // null for a special
      name: e.name || "",
      date: e.airdate || "",
      time: e.airtime || "",
      stamp: e.airstamp || "",
      runtime: e.runtime || 0,
      rating: e.rating && e.rating.average ? e.rating.average : null,
      image: e.image ? e.image.medium || e.image.original : "",
      imageBig: e.image ? e.image.original || e.image.medium : "",
      summary: text(e.summary),
      url: e.url || "",
      special: e.type && e.type !== "regular",
    };

  // the show: its facts, seasons, the next / last episode, and the people behind it
  async function show(id) {
    const s = await ask(`/shows/${id}?embed[]=seasons&embed[]=nextepisode&embed[]=previousepisode&embed[]=crew`);
    if (!s) return null;
    const em = s._embedded || {};
    const net = s.network || null;
    const web = s.webChannel || null;
    const crew = {};
    (em.crew || []).forEach((c) => {
      if (!c || !c.person) return;
      const role = c.type || "Crew";
      (crew[role] = crew[role] || []).push({ name: c.person.name, image: c.person.image ? c.person.image.medium : "", url: c.person.url || "" });
    });
    return {
      id: s.id,
      url: s.url || "",
      name: s.name || "",
      type: s.type || "",
      language: s.language || "",
      genres: s.genres || [],
      status: s.status || "",
      runtime: s.runtime || 0,
      averageRuntime: s.averageRuntime || 0,
      premiered: s.premiered || "",
      ended: s.ended || "",
      officialSite: s.officialSite || "",
      rating: s.rating && s.rating.average ? s.rating.average : null,
      schedule: { time: (s.schedule && s.schedule.time) || "", days: (s.schedule && s.schedule.days) || [] },
      network: net ? { name: net.name, country: net.country ? net.country.name : "", code: net.country ? net.country.code : "", zone: net.country ? net.country.timezone : "", site: net.officialSite || "" } : null,
      web: web ? { name: web.name, site: web.officialSite || "", country: web.country ? web.country.name : "" } : null,
      seasons: (em.seasons || []).map((x) => ({
        id: x.id,
        n: x.number,
        name: x.name || "",
        episodes: x.episodeOrder || 0,
        start: x.premiereDate || "",
        end: x.endDate || "",
        network: (x.network && x.network.name) || (x.webChannel && x.webChannel.name) || "",
        image: x.image ? x.image.medium : "",
      })),
      next: epOf(em.nextepisode),
      previous: epOf(em.previousepisode),
      crew,
      summary: text(s.summary),
    };
  }

  // one season's episodes (specials too), when you open it
  async function season(seasonId) {
    const list = await ask(`/seasons/${seasonId}/episodes?specials=1`);
    return (list || []).map(epOf).filter(Boolean);
  }

  // everything for a TMDB show's page (null when TVmaze doesn't have it)
  async function forShow(d) {
    const id = await find(d);
    return id ? show(id) : null;
  }

  window.TVmaze = { find, show, season, forShow, text };
})();
