/*
 * Title page: details for one movie / show / anime.
 *   title.html?id=interstellar-2014   a title in your library
 *   title.html?tmdb=movie-157336      any title on TMDB (from Discover / recommendations)
 *
 * Layout (same markup for phone and computer):
 *   big backdrop + title, IMDb rating / runtime / year, genres, where to stream,
 *   Trailer button, three action buttons, overview + director,
 *   Cast & Crew, Media and Reviews (one under the other), then recommendations.
 */
(function () {
  const { esc, toast } = UI;
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const tmdbRef = params.get("tmdb");
  const heroEl = document.getElementById("title-hero");
  const mainEl = document.getElementById("title-main");
  // opened from a shared link (js/components/share.js): who sent it, their score, their note
  const shared = (() => {
    const from = (params.get("from") || "").trim().slice(0, 30);
    const r = parseFloat(params.get("r"));
    const note = (params.get("note") || "").trim().slice(0, 140);
    const score = Number.isFinite(r) && r >= 0 && r <= 10 ? r : null;
    if (!from && score == null && !note) return null;
    const keep = new URLSearchParams();
    if (from) keep.set("from", from);
    if (score != null) keep.set("r", params.get("r"));
    if (note) keep.set("note", note);
    return { from, score, note, query: `&${keep}` };
  })();
  // a shared episode (?ep=2-5): its season opens first, and the page goes to it
  let epTarget = (() => {
    const m = /^(\d+)-(\d+)$/.exec(params.get("ep") || "");
    return m ? { s: Number(m[1]), e: Number(m[2]) } : null;
  })();
  let extra = null; // details fetched from TMDB
  let tmdbDetails = null; // a title.html?tmdb= page: its TMDB details (for Share)

  let overviewOpen = false;

  function message(icon, html) {
    heroEl.hidden = true;
    mainEl.innerHTML = `<div class="empty-state"><i class="${icon}"></i>${html}<br><br><a class="btn btn-primary" href="index.html">Back home</a></div>`;
  }

  // fields stored in the library take priority over TMDB
  function pick(item) {
    const out = {};
    ["backdrop", "genres", "runtime", "certification", "director", "overview", "cast"].forEach((k) => {
      if (item[k] != null && !(Array.isArray(item[k]) && !item[k].length)) out[k] = item[k];
    });
    return out;
  }

  /* ---------------- pieces ---------------- */

  // "IMDb 8.6 / 10 · 1h 48m · 2025 · 🍅 86%"
  function metaHtml(t, d, e) {
    const parts = [];
    // how much you'll probably like it (js/services/taste.js), for every title, seen or not
    if (window.Taste) {
      const m = Taste.badge({ genres: d.genres && d.genres.length ? d.genres : t.genres, score: d.tmdbScore ?? t.score });
      if (m) parts.push(m);
    }
    if (e && typeof e.imdb === "number") {
      parts.push(`<span class="t-score" title="${e.votes ? `IMDb rating from ${esc(e.votes)} votes` : "IMDb rating"}"><span class="imdb-tag">IMDb</span>${Cards.formatRating(e.imdb)}<span class="t-long"> / 10</span></span>`);
    } else {
      const tmdb = e && typeof e.tmdb === "number" ? e.tmdb : d.tmdbScore;
      if (typeof tmdb === "number") parts.push(`<span class="t-score" title="TMDB rating"><span class="tmdb-tag">TMDB</span>${tmdb.toFixed(1)}<span class="t-long"> / 10</span></span>`);
    }
    // (phones: "2h 25m", "8.1" without "/ 10": the whole row fits on one line; .t-long hides)
    if (d.runtime) parts.push(esc(d.runtime).replace(/(\d)min\b/g, '$1m<span class="t-long">in</span>'));
    if (t.year) parts.push(t.year);
    if (e && e.rt) {
      const rotten = parseInt(e.rt, 10) < 60;
      parts.push(`<span class="t-rt${rotten ? " rotten" : ""}" title="Rotten Tomatoes Tomatometer (critics)"><span class="rt-icon">🍅</span>${esc(e.rt)}</span>`);
    }
    // (each in a span of its own: the row lays them out side by side, "2h 25min" stays one piece)
    return parts.map((p) => `<span>${p}</span>`).join('<span class="dot">·</span>');
  }

  // "[14+] Animation • Comedy • Adventure"
  function genresHtml(t, d) {
    const genres = (d.genres && d.genres.length ? d.genres : []).slice(0, 4);
    const label = Store.TYPE_LABEL[t.type] || "";
    return `${d.certification ? `<span class="t-cert">${esc(d.certification)}</span>` : ""}${esc(genres.length ? genres.join(" • ") : label)}`;
  }

  // Each streaming / rental service's own search for this title (TMDB only tells us which
  // services have it, not the exact page). Unknown services: the JustWatch page, which
  // lists the direct links.
  // (specific services first, so "Paramount+ Amazon Channel" goes to Paramount+, not Amazon)
  const PROVIDER_SEARCH = [
    [/netflix/, (q) => `https://www.netflix.com/search?q=${q}`],
    [/disney/, (q) => `https://www.disneyplus.com/search?q=${q}`],
    [/\bmax\b|hbo/, (q) => `https://play.max.com/search?q=${q}`],
    [/hulu/, (q) => `https://www.hulu.com/search?q=${q}`],
    [/paramount/, (q) => `https://www.paramountplus.com/search/?q=${q}`],
    [/peacock/, (q) => `https://www.peacocktv.com/search?q=${q}`],
    [/crunchyroll/, (q) => `https://www.crunchyroll.com/search?q=${q}`],
    [/skyshowtime/, (q) => `https://www.skyshowtime.com/search?q=${q}`],
    [/starz/, (q) => `https://www.starz.com/us/en/search?q=${q}`],
    [/showtime/, (q) => `https://www.sho.com/search?q=${q}`],
    [/amc\+|amc plus/, (q) => `https://www.amcplus.com/search?q=${q}`],
    [/mgm/, (q) => `https://www.mgmplus.com/search?q=${q}`],
    [/mubi/, (q) => `https://mubi.com/en/search/films?query=${q}`],
    [/rakuten/, (q) => `https://www.rakuten.tv/search?q=${q}`],
    [/fubo/, (q) => `https://www.fubo.tv/welcome/search?q=${q}`],
    [/philo/, (q) => `https://www.philo.com/player/search?query=${q}`],
    [/tubi/, (q) => `https://tubitv.com/search/${q}`],
    [/pluto/, (q) => `https://pluto.tv/search/details?query=${q}`],
    [/plex/, (q) => `https://watch.plex.tv/search?q=${q}`],
    [/prime video|amazon prime/, (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`],
    [/amazon/, (q) => `https://www.amazon.com/s?k=${q}&i=instant-video`],
    [/apple tv|itunes/, (q) => `https://tv.apple.com/search?term=${q}`],
    [/youtube/, (q) => `https://www.youtube.com/results?search_query=${q}`],
    [/google play/, (q) => `https://play.google.com/store/search?q=${q}&c=movies`],
    [/microsoft/, (q) => `https://www.microsoft.com/en-us/search/shop/movies?q=${q}`],
    [/fandango|vudu/, (q) => `https://athome.fandango.com/content/browse/search?searchString=${q}`],
  ];
  function providerUrl(name, title, fallback) {
    const n = String(name || "").toLowerCase();
    const found = PROVIDER_SEARCH.find(([re]) => re.test(n));
    return found ? found[1](encodeURIComponent(title)) : fallback;
  }

  function providersHtml(p, t) {
    if (!p || !p.list || !p.list.length) return "";
    const label = p.kind === "stream" ? "Available on:" : "Rent or buy on:";
    const title = t ? t.title : "";
    return `<div class="t-providers">
      <span>${label}</span>
      <div class="t-provider-list">${p.list
        .map(
          (x) => `<a href="${esc(providerUrl(x.name, title, p.link))}" target="_blank" rel="noopener" title="Watch on ${esc(x.name)}" aria-label="Watch on ${esc(x.name)}">
            <img src="${Store.img(x.logo, "w92")}" alt="${esc(x.name)}" /></a>`
        )
        .join("")}</div>
      <small title="Streaming data by JustWatch">${esc(p.country)} · JustWatch</small>
    </div>`;
  }

  // "Zach Cregger, Someone Else" -> links to each person's page (by TMDB id when known, else by name)
  function directorLinks(d) {
    const people = d.directorPeople || [];
    return String(d.director)
      .split(/\s*,\s*/)
      .filter(Boolean)
      .map((name) => {
        const known = people.find((x) => x.name === name);
        const href = `person.html?${known ? `id=${encodeURIComponent(known.id)}` : `name=${encodeURIComponent(name)}`}`;
        return `<a class="t-director-link" href="${href}">${esc(name)}</a>`;
      })
      .join(", ");
  }

  function aboutHtml(d) {
    if (!d.overview && !d.director) return "";
    const long = d.overview && d.overview.length > 180;
    return `<div class="t-about">
      ${d.overview ? `<p class="t-overview${long && !overviewOpen ? " clamp" : ""}">${esc(d.overview)}</p>` : ""}
      ${long ? `<button class="t-link t-read-more" type="button">${overviewOpen ? "Show less" : "Read more"}</button>` : ""}
      ${d.director ? `<p class="t-director"><span>${esc(d.directorLabel || "Director")}:</span> ${directorLinks(d)}</p>` : ""}
    </div>`;
  }

  // back, share, and "Add to a list" (a badge: how many of your lists it's in).
  // listAction: "lists" (a library title) or "t-lists" (a TMDB title: it joins your library first)
  function topbarHtml(listAction, inLists) {
    return `<div class="t-topbar">
      <button class="t-round" data-t="back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
      <span class="t-spacer"></span>
      <button class="t-round" data-t="share" data-feature="share" aria-label="Share"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
      <button class="t-round t-lists${inLists ? " on" : ""}" data-action="${listAction}" aria-label="Add to a list" title="Add to a list"><i class="fa-solid fa-list-ul"></i>${
        inLists ? `<b class="t-lists-n">${inLists}</b>` : ""
      }</button>
    </div>`;
  }

  // phones: the facts row stays on one line; when it's still too wide (a show's "5 seasons",
  // a narrow phone) its text gets a little smaller until it fits, 11.5px at the least
  function fitMeta() {
    const row = heroEl.querySelector(".t-meta");
    if (!row) return;
    row.style.fontSize = "";
    if (getComputedStyle(row).flexWrap !== "nowrap") return; // (computers: it may wrap)
    let size = parseFloat(getComputedStyle(row).fontSize);
    while (row.scrollWidth > row.clientWidth + 1 && size > 11.5) {
      size -= 0.5;
      row.style.fontSize = `${size}px`;
    }
  }
  addEventListener("resize", () => fitMeta());

  // computers and tablets: the ⋯ menu at the picture's top right (Share, Add to a list); phones
  // have the same in the round buttons of the top bar
  function moreMenuHtml(listAction, inLists) {
    return `<div class="t-more">
      <button class="t-more-btn" type="button" aria-label="More" title="More" aria-haspopup="menu" aria-expanded="false"><i class="fa-solid fa-ellipsis-vertical"></i></button>
      <div class="t-more-menu" role="menu">
        <button type="button" role="menuitem" data-t="share" data-feature="share"><i class="fa-solid fa-arrow-up-from-bracket"></i><span>Share</span></button>
        <button type="button" role="menuitem" data-action="${listAction}"><i class="fa-solid fa-list-ul"></i><span>Add to a list</span>${
          inLists ? `<b>${inLists}</b>` : ""
        }</button>
      </div>
    </div>`;
  }
  // open / close it (a tap anywhere else, or Escape, closes it)
  function moreMenu(open) {
    const box = heroEl.querySelector(".t-more");
    if (!box) return;
    box.classList.toggle("open", open);
    box.querySelector(".t-more-btn").setAttribute("aria-expanded", open);
  }
  document.addEventListener("click", (e) => {
    const box = heroEl.querySelector(".t-more");
    if (!box) return;
    if (e.target.closest(".t-more-btn")) return moreMenu(!box.classList.contains("open"));
    moreMenu(false);
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && moreMenu(false));

  // the whole top block: backdrop, title, info, buttons, overview
  function heroHtml(t, d, e, buttons, listAction, inLists) {
    const backdrop = d.backdrop ? Store.img(d.backdrop, "w1280") : Store.img(t.poster, "w780");
    heroEl.hidden = false;
    return `
      <div class="t-backdrop">${
        backdrop
          ? `<picture>${d.artPoster ? `<source media="(max-width: 700px)" srcset="${Store.img(d.artPoster, "w780")}" />` : ""}<img src="${backdrop}" alt="" /></picture>`
          : ""
      }</div>
      ${topbarHtml(listAction, inLists)}
      ${moreMenuHtml(listAction, inLists)}
      <div class="container t-hero-inner">
        <img class="t-poster" src="${Store.poster(Lang.isRu() && d.posterRu ? d.posterRu : Cards.posterOf(t), "w500")}" alt="${esc(Lang.title(t))} poster" />
        <div class="t-head">
          <h1>${esc(Lang.title(t))}${t.year ? ` <span class="year">(${t.year})</span>` : ""}</h1>
          ${Lang.altTitle(t) ? `<div class="t-alt-title">${esc(Lang.altTitle(t))}</div>` : ""}
          <div class="t-meta">${metaHtml(t, d, e)}</div>
          <div class="t-genres">${genresHtml(t, d)}</div>
          ${releaseHtml(d)}
          ${providersHtml(d.providers, t)}
          <div class="t-cta">${buttons}</div>
          ${aboutHtml(d)}
        </div>
      </div>`;
  }

  // the sections are redrawn when something changes: keep each sideways row where you
  // scrolled it. rowScrolls() reads them, rowScrolls(saved) puts them back
  function rowScrolls(saved) {
    const rows = [...mainEl.querySelectorAll(".movie-row, .t-cast, .t-media-row, .md-list, .ep-seasons")];
    if (!saved) return rows.map((r) => [r.scrollLeft, r.scrollTop]);
    rows.forEach((r, n) => {
      if (!saved[n]) return;
      r.scrollLeft = saved[n][0];
      r.scrollTop = saved[n][1];
    });
  }

  /* ---------------- franchise (like HBO Max's collections) ---------------- */

  let colData = null; // the franchise this movie belongs to, once loaded

  function loadCollection(d, done) {
    if (!d || !d.collection || colData || !TMDB.enabled()) return;
    TMDB.collection(d.collection.id)
      .then((c) => {
        if (c && c.parts.length > 1) {
          colData = c;
          done();
        }
      })
      .catch(() => {});
  }

  // "Harry Potter Collection · you've seen 5 of 8" + every film in it
  function collectionPanel(c) {
    const today = Store.today();
    const out = c.parts.filter((p) => p.released && p.released <= today);
    // "seen" = in your library (that means watched), unless it's only on your Watchlist;
    // a score or a watch date always counts
    const seen = (p) => {
      const lib = Cards.inLibrary(p);
      return Store.isWatched(lib);
    };
    const n = out.filter(seen).length;
    const planned = c.parts.filter((p) => Cards.inLibrary(p) && !seen(p)).length;
    const pct = out.length ? Math.round((n / out.length) * 100) : 0;
    const note =
      (!out.length ? "Nothing out yet" : n === out.length ? "You've seen them all" : `You've seen ${n} of ${out.length}`) +
      (planned ? ` · ${planned} on your Watchlist` : "");
    return `<div class="col-progress${n && n === out.length ? " done" : ""}">
        <div class="col-bar"><span style="width:${pct}%"></span></div><span>${note}</span>
      </div>
      <div class="movie-row">${c.parts
        .map((p) => {
          const lib = Cards.inLibrary(p);
          return lib ? Cards.card(lib) : Cards.tmdbCard(p);
        })
        .join("")}</div>`;
  }

  /* ---------------- X-Ray (like Prime Video): behind the scenes ---------------- */

  let seenBefore = null; // [{ name, id, photo, titles: [{ id, title, character }] }], once loaded
  let seenLoading = false;
  // the cast as TMDB has it (with ids): library titles may keep their own list of names only
  const castWithIds = (d) => ((extra && extra.cast) || d.cast || []).filter((c) => c && c.id);

  const money = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : `$${n.toLocaleString("en-US")}`);
  const langName = (code) => {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    } catch (e) {
      return code;
    }
  };
  // IMDb's awards line (via OMDb), e.g. "Won 2 Oscars. 132 wins & 139 nominations total",
  // "Nominated for 1 Primetime Emmy. 5 wins & 20 nominations total", "3 wins & 4 nominations"
  function parseAwards(s) {
    const out = { major: null, wins: null, noms: null };
    const m = /(Won|Nominated for) (\d+) (Oscars?|Primetime Emmys?|Emmys?|Golden Globes?|BAFTA(?: Film)? Awards?)/i.exec(s);
    if (m) {
      const name = /oscar/i.test(m[3]) ? "Oscar" : /emmy/i.test(m[3]) ? "Emmy" : /globe/i.test(m[3]) ? "Golden Globe" : "BAFTA";
      out.major = { won: /^won/i.test(m[1]), n: Number(m[2]), name };
    }
    const w = /(\d+) wins?/i.exec(s);
    const n = /(\d+) nominations?/i.exec(s);
    if (w) out.wins = Number(w[1]);
    if (n) out.noms = Number(n[1]);
    return out;
  }

  // "in 5 days", "today", "3 months ago", "12 years ago"
  const fromNow = (s) => {
    const days = Math.round((new Date(`${s}T00:00:00`) - new Date(`${Store.today()}T00:00:00`)) / 86400000);
    if (days === 0) return "Today";
    const n = Math.abs(days);
    const [v, unit] = n < 31 ? [n, "day"] : n < 365 ? [Math.round(n / 30.4), "month"] : [Math.round(n / 365.25), "year"];
    const text = `${v} ${unit}${v === 1 ? "" : "s"}`;
    return days > 0 ? `In ${text}` : `${text} ago`;
  };
  const niceDay = (s) => {
    const x = new Date(`${s}T00:00:00`);
    return isNaN(x) ? s : `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
  };
  const daysTo = (s) => Math.round((new Date(`${s}T00:00:00`) - new Date(`${Store.today()}T00:00:00`)) / 86400000);
  // "in 25 days", "tomorrow", "today"
  const countdown = (s) => {
    const n = daysTo(s);
    return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
  };
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const epDay = (s) => {
    const x = new Date(`${s}T00:00:00`);
    return isNaN(x) ? s : `${WEEKDAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? ` ${x.getFullYear()}` : ""}`;
  };
  const NOT_YET = /^(Rumored|Planned|In Production|Post Production|Pilot)$/;

  // Where a title stands, in one place (the line under the genres and X-Ray's date card):
  //  movies: "released" | "soon" (a date ahead) | "unknown" (no date announced yet)
  //  shows: "soon" (premieres ahead) | "airing" (a next episode / returning) | "ended" | "released"
  // The cinema date in your country counts for movies (as on Discover's labels), the worldwide
  // date when your country has none. A show's next episode: TVmaze's when it's loaded (it's
  // updated more often), else TMDB's.
  function releaseOf(d) {
    const x = d.xray || {};
    const today = Store.today();
    if (d.media !== "tv") {
      const date = x.local || x.released || d.released || "";
      if (!date) return { state: "unknown", status: x.status || "" };
      const out = { date, world: x.released && x.local && x.released !== x.local ? x.released : "", digital: x.digital || "" };
      return Object.assign(out, { state: date > today ? "soon" : "released" });
    }
    const tm = d.tvmaze || null;
    const premiere = x.released || d.released || (tm && tm.premiered) || "";
    const status = (tm && tm.status) || x.status || "";
    const next = (tm && tm.next) || (x.nextEp && x.nextEp.date >= today ? x.nextEp : null);
    const last = (tm && tm.previous) || x.lastEp || null;
    const base = { premiere, next, last, seasons: x.seasons || 0, status, ended: (tm && tm.ended) || x.lastAir || "" };
    if (!premiere) return Object.assign(base, { state: "unknown" });
    if (premiere > today) return Object.assign(base, { state: "soon", date: premiere });
    if (/^(Ended|Canceled)$/i.test(status)) return Object.assign(base, { state: "ended" });
    return Object.assign(base, { state: next ? "airing" : "returning" });
  }

  // the line under the genres: a small pill that says where it stands
  function releaseHtml(d) {
    if (!d || (!d.xray && !d.released)) return "";
    const r = releaseOf(d);
    const pill = (cls, icon, html, title) => `<div class="t-release ${cls}"${title ? ` title="${esc(title)}"` : ""}><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${html}</span></div>`;
    if (d.media !== "tv") {
      if (r.state === "unknown") return pill("unknown", "fa-circle-question", `Release date not announced${r.status && NOT_YET.test(r.status) ? ` · <b>${esc(r.status)}</b>` : ""}`);
      if (r.state === "soon")
        return pill("soon", "fa-hourglass-half", `Coming <b>${niceDay(r.date)}</b> · ${countdown(r.date)}`, r.world ? `Worldwide: ${niceDay(r.world)}` : "");
      const stream = r.digital && r.digital > Store.today() ? ` · streaming / digital <b>${countdown(r.digital)}</b>` : "";
      return pill("out", "fa-circle-check", `Released <b>${niceDay(r.date)}</b>${stream}`);
    }
    if (r.state === "unknown") return pill("unknown", "fa-circle-question", "Premiere date not announced");
    if (r.state === "soon") return pill("soon", "fa-hourglass-half", `Premieres <b>${niceDay(r.date)}</b> · ${countdown(r.date)}`);
    const years = `${r.premiere.slice(0, 4)}${r.ended ? `–${r.ended.slice(0, 4)}` : ""}`;
    if (r.state === "ended") return pill("ended", "fa-flag-checkered", `Ended · ${years}${r.seasons ? ` · ${r.seasons} season${r.seasons === 1 ? "" : "s"}` : ""}`);
    if (r.state === "airing") {
      const n = r.next;
      const what = n.e === 1 ? `Season ${n.s} premiere` : `S${n.s} E${n.e}`;
      return pill("soon airing", "fa-tower-broadcast", `<b>${what}</b> ${epDay(n.date)} · ${countdown(n.date)}`, n.name || "");
    }
    return pill("out", "fa-rotate", `Returning series · next episode not announced${r.last ? ` · last aired ${epDay(r.last.date)}` : ""}`);
  }

  /* Studio / network logos (TMDB: mostly transparent PNGs, some with a white box of their own).
     Each logo is looked at once, small, and what it is remembered in this browser (mn:logoTone):
       "mono-dark"  a dark one-colour logo (black text): drawn white on the dark card
       "mono-light" a light one-colour logo: as it is (dark ink in the light theme)
       "color"      colourful: as it is, in its own colours
       "solid"      not transparent (its own background): kept on a light rounded card
     Until it's known (or when the picture can't be read): the light card, as before. */
  //   A logo on a plain white box: the white is taken out here (a copy without it, kept in the
  //   browser's database as "logo:<path>"), and then it's one of the above.
  const LOGO_KEY = "mn:logoTone2";
  const logoTones = Store.read(LOGO_KEY, {}); // { path: "color" | "mono-dark" | … , "path!": 1 = knocked out }
  const logoClass = (path) => (logoTones[path] ? `tone-${logoTones[path]}` : "tone-pending");
  const logoBusy = new Set();
  const logoCut = new Map(); // path -> the copy without its white box (a data: address)
  // what a logo's pixels say: { tone, clear (share of see-through pixels) }
  //   "mixed"      colour and dark ink together (Marvel Studios: a red box, black "STUDIOS"):
  //                no single treatment reads well on dark, so the light card
  function readTone(px) {
    let clear = 0, ink = 0, dark = 0, light = 0, color = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 24) {
        clear++;
        continue;
      }
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      ink++;
      if (sat > 0.3) color++;
      else if (lum < 0.35) dark++;
      else if (lum > 0.65) light++;
    }
    const total = px.length / 4;
    if (!ink || clear / total < 0.08) return { tone: "solid", clear: clear / total };
    const share = (n) => n / ink;
    let tone;
    if (share(color) > 0.12) tone = share(dark) > 0.1 ? "mixed" : "color";
    else if (share(dark) >= share(light)) tone = share(light) > 0.15 ? "mixed" : "mono-dark";
    else tone = "mono-light";
    return { tone, clear: clear / total };
  }
  // the four corners all (nearly) white and opaque: a logo on a white box
  function onWhiteBox(px, w, h) {
    const at = (x, y) => {
      const i = (y * w + x) * 4;
      return px[i + 3] > 230 && px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235;
    };
    return at(0, 0) && at(w - 1, 0) && at(0, h - 1) && at(w - 1, h - 1);
  }
  function paintLogo(path) {
    const tone = logoTones[path];
    document.querySelectorAll(`.xr-logo[data-logo="${CSS.escape(path)}"]`).forEach((el) => {
      el.className = `xr-logo tone-${tone}`;
      const img = el.querySelector("img");
      if (logoCut.has(path) && img.src !== logoCut.get(path)) img.src = logoCut.get(path);
    });
  }
  function logoTone(path) {
    // knocked out before: its copy from the database
    if (logoTones[`${path}!`] && !logoCut.has(path) && !logoBusy.has(path) && TMDB.store) {
      logoBusy.add(path);
      TMDB.store.get(`logo:${path}`).then((url) => {
        logoBusy.delete(path);
        if (url) {
          logoCut.set(path, url);
          paintLogo(path);
        } else {
          delete logoTones[path];
          delete logoTones[`${path}!`];
          logoTone(path);
        }
      });
      return;
    }
    if (logoTones[path] || logoBusy.has(path)) return;
    logoBusy.add(path);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let tone = "";
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const data = g.getImageData(0, 0, w, h);
        const px = data.data;
        tone = readTone(px).tone;
        if (tone === "solid" && onWhiteBox(px, w, h)) {
          // white → see-through, softly (anti-aliased edges keep their shape)
          for (let i = 0; i < px.length; i += 4) {
            const white = Math.min(px[i], px[i + 1], px[i + 2]);
            if (white > 200) px[i + 3] = Math.round(px[i + 3] * Math.max(0, (255 - white) / 55));
          }
          const cut = readTone(px);
          if (cut.tone !== "solid") {
            g.putImageData(data, 0, 0);
            const url = c.toDataURL("image/png");
            logoCut.set(path, url);
            if (TMDB.store) TMDB.store.set(`logo:${path}`, url);
            logoTones[`${path}!`] = 1;
            tone = cut.tone;
          }
        }
      } catch (e) {
        tone = ""; // couldn't read it: stays on the light card
      }
      logoBusy.delete(path);
      if (!tone) return;
      logoTones[path] = tone;
      const keys = Object.keys(logoTones);
      if (keys.length > 600) keys.slice(0, keys.length - 600).forEach((k) => delete logoTones[k]);
      Store.write(LOGO_KEY, logoTones);
      paintLogo(path);
    };
    img.onerror = () => logoBusy.delete(path);
    // (an address of its own: the card's copy of the picture was loaded without permission to
    // read its pixels, and the browser would hand that one back)
    img.src = `https://image.tmdb.org/t/p/w185${path}?px=1`;
  }

  function xrayPanel(d) {
    if (d.xray) [...(d.xray.networks || []).slice(0, 1), ...(d.xray.companies || []).slice(0, 1)].forEach((c) => c.logo && setTimeout(() => logoTone(c.logo), 0));
    const x = d.xray;
    const e = window.Ratings ? Ratings.entry(tmdbRef || Ratings.refOf(Store.get(id) || {})) || {} : {};
    const tv = d.media === "tv";
    const label = (icon, text) => `<span class="xr-label"><i class="fa-solid ${icon}"></i> ${text}</span>`;
    const cards = [];

    // money: budget vs box office as two bars, and the verdict
    const budget = x.budget || 0;
    const gross = x.revenue || 0;
    if (budget || gross || e.boxOffice) {
      const max = Math.max(budget, gross) || 1;
      const ratio = budget && gross ? gross / budget : null;
      const verdict = ratio == null ? null : ratio >= 5 ? ["Blockbuster", "gold"] : ratio >= 2 ? ["Hit", "green"] : ratio >= 1 ? ["Broke even", "grey"] : ["Flop", "red"];
      const bar = (name, v, cls) => `<div class="xr-bar-row">
          <div class="xr-bar-top"><span>${name}</span><b>${money(v)}</b></div>
          <div class="xr-bar"><i class="${cls}" style="width:${Math.max(3, (v / max) * 100)}%"></i></div>
        </div>`;
      cards.push(`<div class="xr-card xr-money">
          <div class="xr-head">${label("fa-sack-dollar", "Budget & box office")}${
            verdict ? `<span class="xr-verdict ${verdict[1]}">${verdict[0]} · ${ratio.toFixed(1)}× its budget</span>` : ""
          }</div>
          ${budget ? bar("Budget", budget, "budget") : ""}
          ${gross ? bar("Box office, worldwide", gross, "gross") : e.boxOffice ? `<div class="xr-bar-top"><span>Box office, US</span><b>${esc(e.boxOffice)}</b></div>` : ""}
          ${gross && !tv && x.released ? `<a class="xr-money-link" href="box-office.html?year=${x.released.slice(0, 4)}"><i class="fa-solid fa-ranking-star"></i> The box office chart of ${x.released.slice(0, 4)} <i class="fa-solid fa-chevron-right"></i></a>` : ""}
        </div>`);
    }

    // when: the date large, and how long ago / how soon. Not out yet: not "Released" but a
    // countdown card of its own ("Coming soon": the days left, the exact date)
    const rel = releaseOf(d);
    if (rel.state === "soon") {
      const n = daysTo(rel.date);
      cards.push(`<div class="xr-card xr-date xr-soon">
          ${label("fa-hourglass-half", tv ? "Premieres in" : "Coming soon")}
          <div class="xr-body">
            <div class="xr-count"><b>${n <= 0 ? "Today" : n}</b>${n > 0 ? `<span>day${n === 1 ? "" : "s"} to go</span>` : ""}</div>
            <div class="xr-soon-date"><i class="fa-regular fa-calendar"></i> ${tv ? "First episode" : x.local ? `In cinemas in ${esc(TMDB.countryName())}` : "Release"}: <b>${niceDay(rel.date)}</b></div>
            ${rel.world ? `<small>Worldwide ${niceDay(rel.world)}</small>` : ""}
            ${x.status && !/^Released$/.test(x.status) ? `<small>${esc(x.status)}</small>` : ""}
          </div>
        </div>`);
    } else if (rel.state === "unknown" && !tv) {
      cards.push(`<div class="xr-card xr-date xr-soon xr-tba">
          ${label("fa-circle-question", "Release")}
          <div class="xr-body">
            <div class="xr-big">Not announced yet</div>
            ${x.status ? `<small>${esc(x.status)}</small>` : ""}
          </div>
        </div>`);
    } else if (x.released) {
      const status = x.status && !/^(Released|Ended|Returning Series)$/.test(x.status) ? ` · ${esc(x.status)}` : "";
      cards.push(`<div class="xr-card xr-date">
          ${label("fa-calendar-day", tv ? "First aired" : "Released")}
          <div class="xr-body">
            <div class="xr-big">${niceDay(x.released)}</div>
            <small>${fromNow(x.released)}${status}</small>
            ${
              tv && (x.episodes || x.lastAir)
                ? `<div class="xr-mini">${x.episodes ? `<span><b>${x.episodes}</b> episodes</span>` : ""}${x.lastAir ? `<span>Last aired <b>${niceDay(x.lastAir)}</b></span>` : ""}${
                    rel.next ? `<span>Next <b>S${rel.next.s} E${rel.next.e}</b> ${epDay(rel.next.date)}</span>` : ""
                  }</div>`
                : ""
            }
          </div>
        </div>`);
    }

    // anime: AniList's score, and the way to the full anime page
    if (d.anime) cards.push(animeCard(d.anime, label));

    // shows: when and where it airs (TVmaze)
    if (tv && d.tvmaze) {
      const air = airingCard(d.tvmaze, label);
      if (air) cards.push(air);
    }

    if (e.awards) {
      const a = parseAwards(e.awards);
      const stat = (n, word) => (n != null ? `<span><b>${n}</b> ${word}${n === 1 ? "" : "s"}</span>` : "");
      // the big one: Oscars (or Emmys / Golden Globes / BAFTAs), else all the wins
      const main = a.major
        ? { n: a.major.n, text: a.major.won ? `${a.major.name}${a.major.n === 1 ? "" : "s"} won` : `${a.major.name} nomination${a.major.n === 1 ? "" : "s"}` }
        : a.wins != null
          ? { n: a.wins, text: `award${a.wins === 1 ? "" : "s"} won` }
          : a.noms != null
            ? { n: a.noms, text: `nomination${a.noms === 1 ? "" : "s"}` }
            : null;
      cards.push(`<div class="xr-card xr-awards">
          ${label("fa-trophy", "Awards")}
          <div class="xr-body">
            ${
              main
                ? `<div class="xr-award-big"><i class="fa-solid fa-trophy"></i><b>${main.n}</b></div>
                   <div class="xr-award-name">${esc(main.text)}</div>
                   <div class="xr-award-stats">${a.major ? stat(a.wins, "win") : ""}${a.major || a.wins != null ? stat(a.noms, "nomination") : ""}</div>`
                : `<p>${esc(e.awards)}</p>`
            }
          </div>
        </div>`);
    }

    // studios / networks: their logos straight on the card (see logoTone), or the name when
    // TMDB has no logo
    const brands = (list) =>
      list
        .map((c) =>
          c.logo
            ? `<span class="xr-logo ${logoClass(c.logo)}" data-logo="${esc(c.logo)}" title="${esc(c.name)}"><img src="${logoCut.get(c.logo) || `https://image.tmdb.org/t/p/w185${c.logo}`}" alt="${esc(c.name)}" loading="lazy" /></span>`
            : `<span class="xr-chip">${esc(c.name)}</span>`
        )
        .join("");
    // only the main one (TMDB lists it first), not every company that took part
    if (x.networks.length) cards.push(`<div class="xr-card xr-brands">${label("fa-tower-broadcast", "Network")}<div class="xr-body">${brands(x.networks.slice(0, 1))}</div></div>`);
    if (x.companies.length) cards.push(`<div class="xr-card xr-brands">${label("fa-clapperboard", "Made by")}<div class="xr-body">${brands(x.companies.slice(0, 1))}</div></div>`);

    // where from: flags, a thin line, the original language
    if (x.countries.length || x.language)
      cards.push(`<div class="xr-card xr-origin">
          ${label("fa-earth-europe", "Made in")}
          <div class="xr-body">
            ${x.countries.length ? `<div class="xr-flags xr-flags-big">${x.countries
              .map(
                (c, k) => `<span class="xr-flag" style="--d:${k * 90}ms" title="${esc(c.name)}" aria-label="${esc(c.name)}"><img src="https://flagcdn.com/w160/${esc(c.code)}.png" alt="" loading="lazy" /></span>`
              )
              .join("")}</div>` : ""}
            ${x.countries.length && x.language ? '<hr class="xr-line" />' : ""}
            ${x.language ? `<div class="xr-lang"><i class="fa-solid fa-language"></i> Original language: <b>${esc(langName(x.language))}</b></div>` : ""}
          </div>
        </div>`);

    // one card per person: photo, name, who they play here, then small posters of your titles
    // they're in (the role on hover)
    const person = (p) => `<div class="xr-cast">
        <a class="xr-cast-head" href="person.html?id=${p.id}">
          ${p.photo ? `<img class="xr-face" src="${Store.img(p.photo, "w185")}" alt="" loading="lazy" />` : '<span class="xr-face xr-noimg"><i class="fa-solid fa-user"></i></span>'}
          <span><strong>${esc(p.name)}</strong>${p.here ? `<small>Here: ${esc(p.here)}</small>` : ""}</span>
        </a>
        <div class="xr-cast-label">You've seen them in</div>
        <div class="xr-cast-titles xr-deck${p.titles.length > 1 ? "" : " single"}" style="--n:${p.titles.length}">${p.titles
          .map((t, k) => {
            const item = Store.get(t.id);
            // a fanned deck: the middle one on top, the others tilted out (spread on hover / tap)
            const m = k - (p.titles.length - 1) / 2;
            return `<a class="xr-mini-poster" style="--m:${m};--a:${Math.abs(m)};--z:${20 - Math.round(Math.abs(m) * 2)}" href="title.html?id=${encodeURIComponent(t.id)}" title="${esc(t.title)}${t.character ? ` as ${esc(t.character)}` : ""}">
                <img src="${Store.poster(item ? Cards.posterOf(item) : "", "w185")}" alt="" loading="lazy" />
                <span>${esc(t.title)}</span>
              </a>`;
          })
          .join("")}</div>
      </div>`;
    const seen = seenBefore
      ? seenBefore.length
        ? `<div class="xr-cast-grid">${seenBefore.map(person).join("")}</div>`
        : '<p class="muted">None of the main cast is in anything else you\'ve watched.</p>'
      : '<p class="muted xr-seen-wait"><i class="fa-solid fa-spinner fa-spin"></i> Checking your library…</p>';

    return `${x.tagline ? `<blockquote class="xr-tagline">“${esc(x.tagline)}”</blockquote>` : ""}
      ${cards.length ? `<div class="xr-grid">${cards.join("")}</div>` : ""}
      ${castWithIds(d).length ? `<h3 class="xr-sub"><i class="fa-solid fa-user-check"></i> Where you've seen the cast</h3><div class="xr-seen">${seen}</div>` : ""}`;
  }

  // "where you've seen the cast": looked up when the X-Ray section comes into view
  function watchXray(d, done) {
    const box = mainEl.querySelector(".t-xray");
    if (!box || seenBefore || seenLoading || !castWithIds(d).length) return;
    const start = async () => {
      if (seenLoading || seenBefore) return;
      seenLoading = true;
      // watched = in your library, unless it's only on your Watchlist (same as the franchise counter)
      const mine = new Set(Store.all().filter(Store.isWatched).map((i) => i.id));
      const here = tmdbRef || (Store.get(id) && Ratings.refOf(Store.get(id)));
      const out = [];
      for (const c of castWithIds(d).slice(0, 8)) {
        try {
          const p = await TMDB.person(c.id);
          const titles = p.titles
            .filter((t) => `${t.mediaType}-${t.tmdbId}` !== here)
            .map((t) => ({ t, lib: Cards.inLibrary(t) }))
            .filter(({ lib }) => lib && mine.has(lib.id) && lib.id !== id)
            .slice(0, 3)
            .map(({ t, lib }) => ({ id: lib.id, title: Lang.title(lib), character: (t.characters || [])[0] || "" }));
          if (titles.length) out.push({ id: c.id, name: c.name, photo: c.photo, here: c.character || "", titles });
        } catch (e) {}
      }
      seenBefore = out;
      done();
    };
    if (!("IntersectionObserver" in window)) return start();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: "300px" });
    io.observe(box);
  }

  /* ---------------- sections: Cast & Crew, Media, Reviews (one under the other) ---------------- */

  function sectionsHtml(d, loading) {
    const cast = d.cast || [];
    const videos = d.videos || [];
    const images = d.images || [];
    const reviews = d.reviews || [];
    const block = (title, count, body, cls) =>
      `<section class="t-section${cls ? ` ${cls}` : ""}"><h2 class="t-section-title">${title}${count ? ` <small>${count}</small>` : ""}</h2>${body}</section>`;

    let html = "";
    const seasons = d.seasons || [];
    if (colData) html += block(esc(colData.name), colData.parts.length, collectionPanel(colData), "t-collection");
    if (d.media === "tv" && d.tmdbId && seasons.length > 1) html += block("Seasons", seasons.length, seasonsPanel(d, seasons));
    if (d.media === "tv" && d.tvmaze) {
      const eps = episodesPanel(d);
      if (eps) html += block("Episodes", 0, eps, "t-episodes");
    }
    if (cast.length || (d.tvmaze && Object.keys(d.tvmaze.crew || {}).length))
      html += block("Cast &amp; Crew", 0, (cast.length ? castPanel(cast) : "") + (d.tvmaze ? crewHtml(d.tvmaze) : ""));
    if (loading) return html + '<p class="muted t-empty">Loading more details…</p>';
    if (d.xray) html += block('<i class="fa-solid fa-bolt"></i> X-Ray', 0, xrayPanel(d), "t-xray");
    if (videos.length || images.length) html += block("Media", 0, mediaPanel(videos, images));
    if (window.Soundtrack) html += Soundtrack.html(d); // (js/components/soundtrack.js: filled in when it's near)
    html += booksHtml(d);
    if (reviews.length) html += block("Reviews", reviews.length, reviewsPanel(reviews, d.tmdbUrl));
    return html;
  }
  /* ---------------- Episodes (shows, from TVmaze: js/services/tvmaze.js) ----------------
     The next and the latest episode as two cards, then the episode guide: a season switch and
     a card per episode (still, number, title, when it aired / airs, runtime, rating, the story
     on a tap). The season you're at (Your progress), else the one airing, opens first; episodes
     you've seen get a tick. Each season is asked for when it's opened, and kept. */
  const EP_SHOWN = 6;
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
  let epSeason = null; // TVmaze season id on screen
  let epAll = false; // "Show all N episodes"
  const epData = new Map(); // season id -> [episodes] | "loading" | "error"
  let tvmazeFor = null; // the TMDB show TVmaze was asked about (once per page)

  // ask TVmaze about a show (once), then draw again with what it knows
  function loadTvmaze(d, done) {
    if (!d || d.media !== "tv" || !window.TVmaze || !window.Site || !Site.feature("tvmaze") || !Api.enabled("tvmaze")) return;
    const key = d.tmdbId || d.title;
    if (tvmazeFor === key) return;
    tvmazeFor = key;
    TVmaze.forShow(d)
      .then((tm) => {
        if (!tm) return;
        d.tvmaze = tm;
        done();
      })
      .catch(() => {});
  }

  const seenEp = (ep) => {
    const item = id && Store.get(id);
    const p = item && item.progress;
    if (!p || !ep.e || !ep.s) return false;
    return p.done || ep.s < p.s || (ep.s === p.s && ep.e <= p.e);
  };
  const epCode = (ep) => (ep.e ? `S${ep.s} E${ep.e}` : `S${ep.s} Special`);
  const airWhen = (ep) => {
    if (!ep.date) return "Date not announced";
    const n = daysTo(ep.date);
    return n > 0 ? `${epDay(ep.date)} · ${countdown(ep.date)}` : n === 0 ? "Today" : epDay(ep.date);
  };
  // the time it airs where you are (TVmaze gives the exact moment: "2026-10-12T01:00:00+00:00")
  const localTime = (stamp) => {
    if (!stamp) return "";
    const t = new Date(stamp);
    return isNaN(t) ? "" : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  function epCard(ep, big) {
    const future = ep.date && ep.date > Store.today();
    const seen = seenEp(ep);
    return `<article class="ep-card${future ? " future" : ""}${seen ? " seen" : ""}${big ? " big" : ""}" data-ep="${ep.id}" data-se="${ep.s}-${ep.e || ""}">
        <div class="ep-still">${
          safeUrl(ep.image) ? `<img src="${esc(safeUrl(ep.image))}" alt="" loading="lazy" />` : '<span class="ep-noimg"><i class="fa-solid fa-film"></i></span>'
        }<span class="ep-code">${epCode(ep)}</span>${seen ? '<span class="ep-seen" title="You\'ve seen it"><i class="fa-solid fa-check"></i></span>' : ""}</div>
        <div class="ep-text">
          <strong>${esc(ep.name || epCode(ep))}</strong>
          <div class="ep-meta">
            <span class="${future ? "ep-soon" : ""}"><i class="fa-regular fa-calendar"></i> ${airWhen(ep)}${future && ep.stamp && localTime(ep.stamp) ? ` · ${localTime(ep.stamp)}` : ""}</span>
            ${ep.runtime ? `<span><i class="fa-regular fa-clock"></i> ${ep.runtime} min</span>` : ""}
            ${ep.rating ? `<span><i class="fa-solid fa-star"></i> ${ep.rating.toFixed(1)}</span>` : ""}
          </div>
          ${ep.summary ? `<p class="ep-sum clamp">${esc(ep.summary)}</p>` : ""}
          <div class="ep-foot">${safeUrl(ep.url) ? `<a class="ep-link" href="${esc(safeUrl(ep.url))}" target="_blank" rel="noopener">TVmaze <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ""}${
            ep.e ? `<button class="ep-share" type="button" data-feature="share" data-ep-share="${ep.s}-${ep.e}" aria-label="Share this episode" title="Share this episode"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>` : ""
          }</div>
        </div>
      </article>`;
  }

  function episodesPanel(d) {
    const tm = d.tvmaze;
    const seasons = (tm.seasons || []).filter((s) => s.episodes || s.start);
    if (!seasons.length) return "";
    // which season opens first: where you are, else the one with the next episode, else the latest
    if (!epSeason || !seasons.some((s) => s.id === epSeason)) {
      const item = id && Store.get(id);
      const at = item && item.progress && !item.progress.done ? item.progress.s : null;
      const want = (epTarget && epTarget.s) || at || (tm.next && tm.next.s) || (tm.previous && tm.previous.s);
      epSeason = (seasons.find((s) => s.n === want) || seasons[seasons.length - 1]).id;
    }
    const list = epData.get(epSeason);
    if (list === undefined) setTimeout(() => openSeason(epSeason), 0);
    const top = [tm.next && ["Next episode", "fa-forward", tm.next], tm.previous && ["Latest episode", "fa-clock-rotate-left", tm.previous]].filter(Boolean);
    const total = seasons.reduce((a, s) => a + (s.episodes || 0), 0);
    let body;
    if (list === undefined || list === "loading") body = '<p class="muted ep-wait"><i class="fa-solid fa-spinner fa-spin"></i> Loading the episodes…</p>';
    else if (list === "error") body = '<p class="muted">Couldn\'t load this season\'s episodes. <button class="t-link ep-retry" type="button">Try again</button></p>';
    else if (!list.length) body = '<p class="muted">No episodes listed for this season yet.</p>';
    else
      body = `<div class="ep-list">${list
        .slice(0, epAll ? list.length : EP_SHOWN)
        .map((ep) => epCard(ep))
        .join("")}</div>${list.length > EP_SHOWN ? `<button class="btn ep-more" type="button">${epAll ? "Show fewer" : `Show all ${list.length} episodes`}</button>` : ""}`;
    return `${top.length ? `<div class="ep-top">${top.map(([t, icon, ep]) => `<div class="ep-top-card"><span class="xr-label"><i class="fa-solid ${icon}"></i> ${t}</span>${epCard(ep, true)}</div>`).join("")}</div>` : ""}
      <div class="ep-head"><div class="top10-switch ep-seasons" role="tablist" aria-label="Season">${seasons
        .map((s) => `<button class="top10-tab${s.id === epSeason ? " active" : ""}" type="button" role="tab" aria-selected="${s.id === epSeason}" data-ep-season="${s.id}">${s.n ? `Season ${s.n}` : esc(s.name || "Specials")}</button>`)
        .join("")}</div></div>
      ${(() => {
        const s = seasons.find((x) => x.id === epSeason);
        return s ? `<p class="ep-season-info">${[s.start ? `${niceDay(s.start)}${s.end && s.end !== s.start ? ` – ${niceDay(s.end)}` : ""}` : "", s.episodes ? `${s.episodes} episodes` : "", s.network].filter(Boolean).map(esc).join(" · ")}</p>` : "";
      })()}
      ${body}
      <p class="ep-credit">Episode guide by <a href="${esc(safeUrl(tm.url) || "https://www.tvmaze.com")}" target="_blank" rel="noopener">TVmaze</a>${total ? ` · ${total} episodes` : ""}</p>`;
  }

  function openSeason(seasonId) {
    if (epData.get(seasonId) === "loading" || Array.isArray(epData.get(seasonId))) return;
    epData.set(seasonId, "loading");
    TVmaze.season(seasonId)
      .then((list) => {
        epData.set(seasonId, list);
        // the shared episode: shown (even past the first few) and brought into view, once
        if (epTarget) {
          const at = list.findIndex((x) => x.s === epTarget.s && x.e === epTarget.e);
          if (at >= EP_SHOWN) epAll = true;
        }
      })
      .catch(() => epData.set(seasonId, "error"))
      .then(() => {
        redrawEpisodes();
        if (!epTarget) return;
        const card = mainEl.querySelector(`.ep-list .ep-card[data-se="${epTarget.s}-${epTarget.e}"]`);
        epTarget = null;
        if (!card) return;
        card.classList.add("target");
        const p = card.querySelector(".ep-sum");
        if (p) p.classList.remove("clamp");
        setTimeout(() => card.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
      });
  }
  // only the Episodes section is drawn again (not the whole page)
  function redrawEpisodes() {
    const box = mainEl.querySelector(".t-episodes");
    const d = currentDetails();
    if (!box || !d || !d.tvmaze) return;
    const row = box.querySelector(".ep-seasons");
    const x = row ? row.scrollLeft : 0;
    box.innerHTML = `<h2 class="t-section-title">Episodes</h2>${episodesPanel(d)}`;
    const nrow = box.querySelector(".ep-seasons");
    if (nrow) nrow.scrollLeft = x;
  }
  // the details the page is showing (a library title: TMDB's merged with yours)
  const currentDetails = () => (tmdbDetails ? tmdbDetails : extra);

  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-ep-season]");
    if (s) {
      epSeason = Number(s.dataset.epSeason);
      epAll = false;
      if (epData.get(epSeason) === "error") epData.delete(epSeason);
      redrawEpisodes();
      const b = mainEl.querySelector(`[data-ep-season="${epSeason}"]`);
      if (b) b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      return;
    }
    const shareEp = e.target.closest("[data-ep-share]");
    if (shareEp) {
      const d = currentDetails();
      const [sn, en] = shareEp.dataset.epShare.split("-").map(Number);
      const card = shareEp.closest(".ep-card");
      const name = card ? (card.querySelector("strong") || {}).textContent || "" : "";
      const show = d ? Lang.title(d) : document.title.split(" · ")[0];
      if (d && d.tmdbId)
        UI.shareLink({ title: `${show}: S${sn} E${en}`, text: `📺 ${show} · S${sn} E${en}${name ? ` “${name}”` : ""}`, url: `title.html?tmdb=tv-${d.tmdbId}&ep=${sn}-${en}` });
      return;
    }
    if (e.target.closest(".ep-retry")) {
      epData.delete(epSeason);
      return redrawEpisodes();
    }
    if (e.target.closest(".ep-more")) {
      epAll = !epAll;
      redrawEpisodes();
      if (!epAll) mainEl.querySelector(".t-episodes").scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    // tap an episode: its whole story
    const card = e.target.closest(".ep-card");
    if (card && !e.target.closest("a")) {
      const p = card.querySelector(".ep-sum");
      if (p) p.classList.toggle("clamp");
    }
  });

  /* ---------------- anime: its AniList card (js/services/anime.js) ---------------- */
  // Japanese animation on TMDB: found on AniList by name and year, once
  let animeFor = null;
  const isAnimeTitle = (d) => !!d && (d.genres || []).includes("Animation") && d.xray && d.xray.language === "ja";
  function loadAnime(d, done) {
    if (!isAnimeTitle(d) || !window.Anime || !window.Site || !Site.feature("animeDetails")) return;
    const key = d.tmdbId || d.title;
    if (animeFor === key) return;
    animeFor = key;
    Anime.findFor(d)
      .then((a) => {
        if (!a) return;
        d.anime = a;
        done();
      })
      .catch(() => {});
  }
  function animeCard(a, label) {
    const stat = (big, small) => `<span><b>${big}</b><small>${small}</small></span>`;
    return `<div class="xr-card xr-anime">
        <div class="xr-head">${label("fa-dragon", "Anime")}${a.score ? `<span class="xr-verdict gold"><i class="fa-solid fa-star"></i> ${a.score.toFixed(1)}</span>` : ""}</div>
        <div class="xr-anime-stats">${[a.type && stat(esc(a.type), "Type"), a.episodes && stat(a.episodes, "Episodes"), a.season && a.year && stat(`${a.season.charAt(0).toUpperCase()}${a.season.slice(1)} ${a.year}`, "Season")].filter(Boolean).join("")}</div>
        <a class="btn xr-anime-link" href="anime-explore.html?id=${encodeURIComponent(a.key)}"><i class="fa-solid fa-dragon"></i> Characters, voices, studio &amp; more <i class="fa-solid fa-chevron-right"></i></a>
      </div>`;
  }

  // X-Ray's "On air" card: when it airs (in your time), where, what kind of show
  function airingCard(tm, label) {
    const days = tm.schedule.days || [];
    const short = days.length === 7 ? "Every day" : days.length === 5 && !days.includes("Saturday") && !days.includes("Sunday") ? "Weekdays" : days.map((x) => `${x}s`).join(", ");
    const where = tm.network ? `${tm.network.name}${tm.network.country ? ` (${tm.network.country})` : ""}` : tm.web ? `${tm.web.name} (streaming)` : "";
    const yourTime = tm.next && tm.next.stamp ? localTime(tm.next.stamp) : "";
    const live = !/^(Ended)$/i.test(tm.status);
    const rows = [
      live && (short || tm.schedule.time) ? ["fa-calendar-week", "Airs", `${esc(short || "")}${tm.schedule.time ? ` at ${esc(tm.schedule.time)}${tm.network && tm.network.zone ? ` <small>(${esc(tm.network.zone.split("/").pop().replace(/_/g, " "))})</small>` : ""}` : ""}`] : null,
      live && yourTime ? ["fa-clock", "Your time", `${esc(yourTime)}`] : null,
      where ? ["fa-tower-broadcast", tm.network ? "Network" : "Streaming", esc(where)] : null,
      tm.type ? ["fa-masks-theater", "Type", esc(tm.type)] : null,
      tm.averageRuntime || tm.runtime ? ["fa-hourglass-half", "Runtime", `${tm.averageRuntime || tm.runtime} min${tm.averageRuntime && tm.runtime && tm.runtime !== tm.averageRuntime ? " on average" : ""}`] : null,
      tm.rating ? ["fa-star", "TVmaze rating", `${tm.rating.toFixed(1)} / 10`] : null,
    ].filter(Boolean);
    if (!rows.length) return "";
    const status = tm.status === "Running" ? ["On air", "green"] : tm.status === "Ended" ? ["Ended", "grey"] : tm.status === "To Be Determined" ? ["Waiting for news", "gold"] : tm.status === "In Development" ? ["In development", "gold"] : [tm.status, "grey"];
    return `<div class="xr-card xr-air">
        <div class="xr-head">${label("fa-satellite-dish", "When it airs")}${status[0] ? `<span class="xr-verdict ${status[1]}">${esc(status[0])}</span>` : ""}</div>
        <dl class="xr-air-rows">${rows.map(([icon, k, v]) => `<div><dt><i class="fa-solid ${icon}"></i> ${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        <div class="xr-air-links">${safeUrl(tm.officialSite) ? `<a href="${esc(safeUrl(tm.officialSite))}" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> Official site</a>` : ""}${
          safeUrl(tm.url) ? `<a href="${esc(safeUrl(tm.url))}" target="_blank" rel="noopener"><i class="fa-solid fa-tv"></i> TVmaze</a>` : ""
        }</div>
      </div>`;
  }

  // the people behind the show (TVmaze): creators first, then producers
  function crewHtml(tm) {
    const order = ["Creator", "Developer", "Executive Producer", "Co-Executive Producer", "Producer", "Showrunner", "Music"];
    const groups = Object.entries(tm.crew || {}).sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
    if (!groups.length) return "";
    return `<div class="t-crew"><h3 class="xr-sub"><i class="fa-solid fa-clapperboard"></i> Behind the show</h3><div class="t-crew-groups">${groups
      .slice(0, 4)
      .map(
        ([role, people]) => `<div class="t-crew-group"><span>${esc(role)}${people.length > 1 && !/s$/.test(role) ? "s" : ""}</span><div>${people
          .slice(0, 6)
          .map((p) => `<a class="t-crew-chip" href="person.html?name=${encodeURIComponent(p.name)}">${safeUrl(p.image) ? `<img src="${esc(safeUrl(p.image))}" alt="" loading="lazy" />` : '<i class="fa-solid fa-user"></i>'}${esc(p.name)}</a>`)
          .join("")}</div></div>`
      )
      .join("")}</div></div>`;
  }

  /* ---------------- Books (js/services/books.js, Google Books): Based on, Related novels, Further reading ----------------
     Looked for once, when the section comes near the screen; a title with no books has no section. */
  let booksData = null; // { based, related, reference } once looked for
  let booksBusy = false;
  let booksTab = null;
  const booksOn = (d) => !!(window.Books && window.Site && Site.feature("books") && Books.ready() && d && d.tmdbId && d.xray);
  const bookUrl = (u) => (/^https:\/\//.test(u || "") ? u : "");
  function bookCard(b) {
    return `<a class="bk-card" href="${esc(bookUrl(b.url) || "#")}" target="_blank" rel="noopener" title="${esc(b.title)}">
        <span class="bk-cover">${bookUrl(b.cover) ? `<img src="${esc(b.cover)}" alt="" loading="lazy" />` : '<i class="fa-solid fa-book"></i>'}</span>
        <strong>${esc(b.title)}</strong>
        <small>${esc([b.authors[0], b.year].filter(Boolean).join(" · "))}</small>
        ${b.rating ? `<small class="bk-rate"><i class="fa-solid fa-star"></i> ${b.rating.toFixed(1)}</small>` : ""}
      </a>`;
  }
  function booksHtml(d) {
    if (!booksOn(d)) return "";
    const head = '<h2 class="t-section-title"><i class="fa-solid fa-book-open"></i> Books</h2>';
    if (!booksData) return `<section class="t-section t-books">${head}<p class="muted"><i class="fa-solid fa-spinner fa-spin"></i> Looking for books…</p></section>`;
    const { based, related, reference } = booksData;
    const tabs = [based && ["based", "fa-book", "Based on"], related && ["related", "fa-book-bookmark", "Related novels"], reference && ["reference", "fa-flask", "Further reading"]].filter(Boolean);
    if (!tabs.length) return "";
    if (!booksTab || !tabs.some((t) => t[0] === booksTab)) booksTab = tabs[0][0];
    let body = "";
    if (booksTab === "based") {
      const b = based.book;
      const kind = String(based.kind || "novel").toLowerCase();
      body = b
        ? `<div class="bk-main">
            <a class="bk-main-cover" href="${esc(bookUrl(b.url) || "#")}" target="_blank" rel="noopener">${bookUrl(b.coverBig) ? `<img src="${esc(b.coverBig)}"${bookUrl(b.cover) ? ` data-small="${esc(b.cover)}"` : ""} alt="${esc(b.title)} cover" loading="lazy" />` : '<i class="fa-solid fa-book"></i>'}</a>
            <div class="bk-main-text">
              <span class="xr-label"><i class="fa-solid fa-book"></i> ${esc(kind === "characters" ? "Based on characters from" : `Based on the ${kind}`)}</span>
              <h3>${esc(b.title)}</h3>
              <p class="bk-by">by <b>${esc(b.authors.join(", ") || based.author)}</b>${b.year ? ` · this edition ${b.year}` : ""}</p>
              <div class="bk-facts">${[
                b.rating ? `<span><i class="fa-solid fa-star"></i> ${b.rating.toFixed(1)} <small>(${b.ratings.toLocaleString()} ratings)</small></span>` : "",
                b.pages ? `<span><i class="fa-solid fa-file-lines"></i> ${b.pages} pages</span>` : "",
                b.editions ? `<span><i class="fa-solid fa-layer-group"></i> ${b.editions} editions</span>` : "",
                b.isbn ? `<span><i class="fa-solid fa-barcode"></i> ISBN ${esc(b.isbn)}</span>` : "",
              ].join("")}</div>
              ${b.description ? `<p class="bk-desc clamp">${esc(b.description)}</p>${b.description.length > 260 ? '<button class="t-link bk-more" type="button">Read more</button>' : ""}` : ""}
              ${bookUrl(b.url) ? `<a class="btn bk-ol" href="${esc(b.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> On Google Books</a>` : ""}
            </div>
          </div>`
        : `<p class="muted">Based on the work of <b>${esc(based.author)}</b>. Their best-known books:</p><div class="movie-row bk-row">${(based.others || []).map(bookCard).join("")}</div>`;
    } else if (booksTab === "related") {
      body = `<p class="muted bk-why">Novels on the same themes: ${esc(related.subject)}</p><div class="movie-row bk-row">${related.books.map(bookCard).join("")}</div>`;
    } else {
      body = `<p class="muted bk-why"><i class="fa-solid fa-circle-info"></i> Reading around the subject, for the curious: not a check of how accurate the film is.</p>${reference.topics
        .map((t) => `<h3 class="xr-sub">${esc(t.label)}</h3><div class="movie-row bk-row">${t.books.map(bookCard).join("")}</div>`)
        .join("")}`;
    }
    return `<section class="t-section t-books">${head}
        ${tabs.length > 1 ? `<div class="top10-switch bk-tabs" role="tablist" aria-label="Books">${tabs.map(([k, icon, l]) => `<button class="top10-tab${k === booksTab ? " active" : ""}" type="button" role="tab" aria-selected="${k === booksTab}" data-books="${k}"><i class="fa-solid ${icon}"></i> ${l}</button>`).join("")}</div>` : ""}
        <div class="bk-body">${body}</div>
        <p class="ep-credit">Books from <a href="https://books.google.com" target="_blank" rel="noopener">Google Books</a></p>
      </section>`;
  }
  function watchBooks(d, done) {
    const box = mainEl.querySelector(".t-books");
    if (!box || booksData || booksBusy) return;
    const start = async () => {
      if (booksBusy || booksData) return;
      booksBusy = true;
      const based = await Books.basedOn(d).catch(() => null);
      const related = await Books.related(d, based && based.book ? [based.book.key] : []).catch(() => null);
      const reference = await Books.reference(d).catch(() => null);
      booksData = { based, related, reference };
      booksBusy = false;
      done();
    };
    if (!("IntersectionObserver" in window)) return start();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: "500px" });
    io.observe(box);
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-books]");
    if (t) {
      booksTab = t.dataset.books;
      const box = mainEl.querySelector(".t-books");
      const d = currentDetails();
      if (box && d) {
        const tmp = document.createElement("div");
        tmp.innerHTML = booksHtml(d);
        if (tmp.firstElementChild) box.replaceWith(tmp.firstElementChild);
      }
      return;
    }
    const more = e.target.closest(".bk-more");
    if (more) {
      const p = more.previousElementSibling;
      p.classList.toggle("clamp");
      more.textContent = p.classList.contains("clamp") ? "Read more" : "Show less";
    }
  });

  // TV shows: one card per season; tap it for that season's trailer. Each season's videos
  // are checked in the background: the card then says what plays ("Trailer", "Teaser",
  // "Bloopers"…), or "No trailer yet" (dimmed) when TMDB has nothing for that season.
  const seasonVids = new Map(); // "showId-n" -> [{key, type}]

  function seasonTag(list) {
    if (!list) return '<span class="ts-tag loading"><i class="fa-solid fa-spinner fa-spin"></i></span>';
    if (!list.length) return '<span class="ts-tag none">No trailer yet</span>';
    return `<span class="ts-tag"><i class="fa-solid fa-play"></i> ${esc(list[0].type)}</span>`;
  }

  function seasonsPanel(d, seasons) {
    const fallback = d.poster || "";
    setTimeout(() => checkSeasons(d.tmdbId, seasons), 0);
    return `<div class="t-seasons">${seasons
      .map((s) => {
        const list = seasonVids.get(`${d.tmdbId}-${s.n}`);
        return `<button class="t-season${list && !list.length ? " no-video" : ""}" type="button" data-season="${s.n}" data-show="${d.tmdbId}"
            data-name="${esc(s.name)}" data-year="${s.year || ""}" aria-label="${esc(s.name)} trailer">
          <span class="ts-poster">
            <img src="${Store.poster(s.poster || fallback, "w342")}" alt="" loading="lazy" />
            <span class="ts-num">${s.n}</span>
            <span class="ts-play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>
            ${seasonTag(list)}
          </span>
          <strong>${esc(s.name)}</strong>
          <span>${[s.year, s.episodes ? `${s.episodes} episodes` : ""].filter(Boolean).join(" · ")}</span>
        </button>`;
      })
      .join("")}</div>`;
  }

  function checkSeasons(show, seasons) {
    seasons.forEach((s) => {
      const k = `${show}-${s.n}`;
      if (seasonVids.has(k)) return;
      TMDB.seasonVideos(show, s.n)
        .then((list) => {
          list = list.filter((v) => !Cards.isBadTrailer(v.key));
          seasonVids.set(k, list);
          document.querySelectorAll(`.t-season[data-show="${show}"][data-season="${s.n}"]`).forEach((card) => {
            card.classList.toggle("no-video", !list.length);
            const tag = card.querySelector(".ts-tag");
            if (tag) tag.outerHTML = seasonTag(list);
          });
        })
        .catch(() => {});
    });
  }

  function castPanel(cast) {
    if (!cast.length) return '<p class="muted t-empty">No cast information yet.</p>';
    return `<div class="t-cast">${cast
      .map(
        // opens the person's page (library titles may store the cast without TMDB ids: found by name)
        (c) => `<a class="t-person" href="person.html?${c.id ? `id=${encodeURIComponent(c.id)}` : `name=${encodeURIComponent(c.name)}`}">
          <img src="${c.photo ? Store.img(c.photo, "w185") : "images/placeholders/avatar-placeholder.svg"}" alt="" loading="lazy" />
          <strong>${esc(c.name)}</strong><span>${esc(c.character || "")}</span>
        </a>`
      )
      .join("")}</div>`;
  }

  // Media: Videos / Images (the site's pill switch; the tab stays picked while you're here)
  //  - Videos: the best one big (trailers come first), the rest as a playlist beside it
  //  - Images: a mosaic (the first still big); tap one for the full-screen viewer
  let mediaTab = "videos";
  let mediaImages = []; // for the viewer
  const MOSAIC = 7; // shown (5 on phones)
  const MOSAIC_PHONE = 5;
  const ytThumb = (key, size) => `https://i.ytimg.com/vi/${encodeURIComponent(key)}/${size}.jpg`;
  function mediaPanel(videos, images) {
    if (!videos.length && !images.length) return '<p class="muted t-empty">No videos or images yet.</p>';
    mediaImages = images;
    const tab = !videos.length ? "images" : !images.length ? "videos" : mediaTab;
    const [top, ...rest] = videos;
    const switcher =
      videos.length && images.length
        ? `<div class="top10-switch md-switch" role="tablist" aria-label="Media">
            <button class="top10-tab${tab === "videos" ? " active" : ""}" type="button" role="tab" aria-selected="${tab === "videos"}" data-md="videos"><i class="fa-solid fa-play"></i> Videos <small>${videos.length}</small></button>
            <button class="top10-tab${tab === "images" ? " active" : ""}" type="button" role="tab" aria-selected="${tab === "images"}" data-md="images"><i class="fa-regular fa-image"></i> Images <small>${images.length}</small></button>
          </div>`
        : "";
    const videosPane = top
      ? `<div class="md-pane md-videos" data-pane="videos"${tab === "videos" ? "" : " hidden"}>
          <button class="md-feature" type="button" data-video="${esc(top.key)}" data-name="${esc(top.name)}">
            <img src="${ytThumb(top.key, "hqdefault")}" alt="" loading="lazy" />
            <span class="md-shade"></span>
            <span class="md-play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>
            <span class="md-info"><span class="md-type">${esc(top.type)}</span><strong>${esc(top.name)}</strong></span>
          </button>
          ${
            rest.length
              ? `<div class="md-list" aria-label="More videos">${rest
                  .map(
                    (v) => `<button class="md-item" type="button" data-video="${esc(v.key)}" data-name="${esc(v.name)}">
                      <span class="md-thumb"><img src="${ytThumb(v.key, "mqdefault")}" alt="" loading="lazy" /><i class="fa-solid fa-play"></i></span>
                      <span class="md-text"><strong>${esc(v.name)}</strong><small>${esc(v.type)}</small></span>
                    </button>`
                  )
                  .join("")}</div>`
              : ""
          }
        </div>`
      : "";
    const extra = images.length - MOSAIC;
    const imagesPane = images.length
      ? `<div class="md-pane" data-pane="images"${tab === "images" ? "" : " hidden"}>
          <div class="md-mosaic n${Math.min(images.length, MOSAIC)}">${images
            .slice(0, MOSAIC)
            .map(
              (p, n) => `<button class="md-shot" type="button" data-shot="${n}" aria-label="Image ${n + 1} of ${images.length}">
                <img src="${Store.img(p, n ? "w500" : "w780")}" alt="" loading="lazy" />
                ${n === MOSAIC - 1 && extra > 0 ? `<span class="md-more">+${extra}</span>` : ""}
                ${n === MOSAIC_PHONE - 1 && images.length > MOSAIC_PHONE ? `<span class="md-more md-more-phone">+${images.length - MOSAIC_PHONE}</span>` : ""}
              </button>`
            )
            .join("")}</div>
        </div>`
      : "";
    return switcher + videosPane + imagesPane;
  }

  // a video taken down from YouTube only has its grey 120 × 90 placeholder picture: left out
  mainEl.addEventListener(
    "load",
    (e) => {
      const img = e.target;
      if (img.tagName === "IMG" && img.closest(".md-item") && img.naturalWidth === 120) img.closest(".md-item").remove();
    },
    true
  );

  // the full-screen image viewer: arrows / swipe / keyboard, the count, Esc or tap outside to close
  let viewer = null;
  let viewerAt = 0;
  function showShot(n) {
    viewerAt = (n + mediaImages.length) % mediaImages.length;
    const img = viewer.querySelector(".mv-img");
    img.classList.remove("in");
    img.src = Store.img(mediaImages[viewerAt], "w1280");
    requestAnimationFrame(() => img.classList.add("in"));
    viewer.querySelector(".mv-count").textContent = `${viewerAt + 1} / ${mediaImages.length}`;
    viewer.querySelector(".mv-full").href = Store.img(mediaImages[viewerAt], "original");
    // (the next one is fetched ahead)
    new Image().src = Store.img(mediaImages[(viewerAt + 1) % mediaImages.length], "w1280");
  }
  function openViewer(n) {
    if (!viewer) {
      viewer = document.createElement("div");
      viewer.className = "md-viewer";
      viewer.setAttribute("role", "dialog");
      viewer.setAttribute("aria-modal", "true");
      viewer.setAttribute("aria-label", "Images");
      viewer.innerHTML = `
        <img class="mv-img" alt="" />
        <button class="mv-btn mv-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <button class="mv-btn mv-prev" type="button" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="mv-btn mv-next" type="button" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="mv-bar"><span class="mv-count"></span><a class="mv-full" target="_blank" rel="noopener"><i class="fa-solid fa-up-right-from-square"></i> Full size</a></div>`;
      document.body.appendChild(viewer);
      viewer.addEventListener("click", (e) => {
        if (e.target.closest(".mv-prev")) showShot(viewerAt - 1);
        else if (e.target.closest(".mv-next")) showShot(viewerAt + 1);
        else if (e.target.closest(".mv-close") || e.target === viewer) closeViewer();
      });
      let x0 = null;
      viewer.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
      viewer.addEventListener("touchend", (e) => {
        const dx = x0 == null ? 0 : e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) showShot(viewerAt + (dx < 0 ? 1 : -1));
        x0 = null;
      });
      document.addEventListener("keydown", (e) => {
        if (!viewer.classList.contains("open")) return;
        if (e.key === "Escape") closeViewer();
        else if (e.key === "ArrowLeft") showShot(viewerAt - 1);
        else if (e.key === "ArrowRight") showShot(viewerAt + 1);
      });
    }
    viewer.querySelectorAll(".mv-prev, .mv-next").forEach((b) => (b.hidden = mediaImages.length < 2));
    showShot(n);
    document.documentElement.classList.add("mv-lock");
    requestAnimationFrame(() => viewer.classList.add("open"));
    viewer.querySelector(".mv-close").focus({ preventScroll: true });
  }
  function closeViewer() {
    viewer.classList.remove("open");
    document.documentElement.classList.remove("mv-lock");
  }

  // the newest 3 reviews; "See more reviews" shows the rest (stays open while you're on the page)
  const REVIEWS_SHOWN = 3;
  // reviews are written with HTML (<em>, <br>, links, &amp;) and Markdown (**bold**, _italic_,
  // > quotes, [link](url)): just the words, with the paragraphs kept
  const decoder = document.createElement("textarea");
  function reviewText(s) {
    let t = String(s || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<\/?[a-z][^>]*>/gi, "") // tags
      .replace(/<\/?[a-z][^>]*$/i, "") // (one cut off at the end)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](link)
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(^|[\s(])[*_]([^*_\n]+?)[*_](?=[\s).,!?:;]|$)/g, "$1$2")
      .replace(/^\s*(>|#{1,6})\s?/gm, "")
      .replace(/^\s*([-*_]\s*){3,}$/gm, "");
    decoder.innerHTML = t; // &amp; &quot; &#39; …
    t = decoder.value;
    return t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  // your like / dislike on a review (kept in this browser): { key: 1 | -1 }
  const VOTES_KEY = "mn:reviewVotes";
  const reviewKey = (r) => r.url || `${r.author}|${r.date}`;
  const voteButtons = (key) => {
    const v = Store.read(VOTES_KEY, {})[key] || 0;
    return `<span class="t-votes" data-review="${esc(key)}">
        <button class="t-vote${v === 1 ? " on" : ""}" type="button" data-vote="1" aria-pressed="${v === 1}" aria-label="Like this review"><i class="fa-${v === 1 ? "solid" : "regular"} fa-thumbs-up"></i></button>
        <button class="t-vote${v === -1 ? " on" : ""}" type="button" data-vote="-1" aria-pressed="${v === -1}" aria-label="Dislike this review"><i class="fa-${v === -1 ? "solid" : "regular"} fa-thumbs-down"></i></button>
      </span>`;
  };
  // "Read more" only on reviews longer than the 2 lines they show
  function fitReviews() {
    mainEl.querySelectorAll(".t-review:not([hidden]) p.clamp").forEach((p) => {
      p.closest(".t-review").querySelector(".t-review-more").hidden = p.scrollHeight <= p.clientHeight + 2;
    });
  }
  new MutationObserver(() => requestAnimationFrame(fitReviews)).observe(mainEl, { childList: true, subtree: true });
  let fitTimer;
  window.addEventListener("resize", () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitReviews, 200);
  });
  let reviewsOpen = false;
  function reviewsPanel(reviews, tmdbUrl) {
    if (!reviews.length) return '<p class="muted t-empty">No reviews yet.</p>';
    const more = reviews.length - REVIEWS_SHOWN;
    return `<div class="t-reviews">${reviews
      .map(
        (r, n) => `<article class="t-review"${n >= REVIEWS_SHOWN && !reviewsOpen ? " hidden" : ""}>
          <header><strong>${esc(r.author)}</strong>${r.rating != null ? `<span class="t-review-score"><i class="fa-solid fa-star"></i> ${r.rating} / 10</span>` : ""}<small>${esc(r.date)}</small></header>
          <p class="clamp">${esc(reviewText(r.text))}</p>
          <footer class="t-review-foot">
            <button class="t-link t-review-more" type="button">Read more</button>
            ${voteButtons(reviewKey(r))}
          </footer>
        </article>`
      )
      .join("")}</div>
      ${more > 0 ? `<p><button class="btn t-reviews-more" type="button">${reviewsOpen ? "Show fewer reviews" : `See more reviews (${more})`}</button></p>` : ""}
      ${tmdbUrl ? `<p><a class="t-link" href="${esc(tmdbUrl)}/reviews" target="_blank" rel="noopener">All reviews on TMDB <i class="fa-solid fa-arrow-up-right-from-square"></i></a></p>` : ""}`;
  }

  function recommendationsHtml(d) {
    const recs = (d && d.recommendations) || [];
    return recs.length ? `<h2 class="section-title">Recommended on TMDB</h2><div class="movie-row">${recs.map(Cards.tmdbCard).join("")}</div>` : "";
  }

  // "More like this": from your library (the titles of yours most like it) or from Discover
  // (TMDB's recommendations you don't have yet), a switch between the two
  let moreFrom = null; // "library" | "discover" (null: whichever has something)
  let moreLike = { library: [], discover: [] };
  function moreLikeHtml(similar, d) {
    moreLike = {
      library: similar,
      discover: ((d && d.recommendations) || []).filter((h) => !Cards.inLibrary(h)).slice(0, 20),
    };
    const from = moreFrom && moreLike[moreFrom].length ? moreFrom : moreLike.library.length ? "library" : "discover";
    const list = moreLike[from];
    if (!moreLike.library.length && !moreLike.discover.length) return "";
    const tab = (k, icon, label) =>
      `<button class="top10-tab${from === k ? " active" : ""}" type="button" data-more="${k}"${moreLike[k].length ? "" : " disabled"}><i class="fa-solid ${icon}"></i> ${label}</button>`;
    return `<div class="t-more-head"><h2 class="section-title">More like this</h2>
        <div class="top10-switch t-more-switch" role="tablist" aria-label="More like this from">${tab("library", "fa-film", "Your library")}${tab("discover", "fa-compass", "Discover")}</div></div>
      <div class="movie-row">${list.map(from === "library" ? Cards.card : Cards.tmdbCard).join("")}</div>`;
  }
  // "You've seen them in": on a touch screen the first tap spreads the deck of posters, the
  // next one opens a title (with a mouse, pointing at the card spreads it)
  document.addEventListener("click", (e) => {
    const deck = e.target.closest(".xr-deck");
    if (!deck || deck.classList.contains("single") || deck.classList.contains("spread")) return;
    if (!window.matchMedia("(hover: none)").matches) return;
    e.preventDefault();
    document.querySelectorAll(".xr-deck.spread").forEach((d) => d.classList.remove("spread"));
    deck.classList.add("spread");
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-more]");
    if (!b || b.disabled) return;
    moreFrom = b.dataset.more;
    const box = mainEl.querySelector(".t-more-like");
    if (box) {
      box.innerHTML = moreLikeHtml(moreLike.library, { recommendations: moreLike.discover });
      if (window.Cards && Cards.scanForScores) Cards.scanForScores();
    }
  });

  const TMDB_NOTE =
    "Details from TMDB, ratings from IMDb and Rotten Tomatoes via OMDb, streaming data by JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.";

  /* ---------------- page-level buttons (back, share, menu, read more, videos) ---------------- */

  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-t]");
    if (t) {
      if (t.dataset.t === "back") history.length > 1 ? history.back() : (location.href = "index.html");
      if (t.dataset.t === "share") {
        // the share sheet (js/components/share.js): a link anyone can open, by TMDB's id (a
        // library id only means something in your own library), and a picture card
        let details = tmdbDetails || (extra && extra.tmdbId ? extra : null);
        const item = id ? Store.get(id) : details && Cards.inLibrary(details);
        if (!details && item && TMDB.enabled()) details = await TMDB.details(item).catch(() => null);
        if (window.Share && details && details.tmdbId) return Share.open({ details, item });
        toast("This title isn't on TMDB, so it can't be shared");
      }
      return;
    }

    if (e.target.closest(".t-read-more")) {
      overviewOpen = !overviewOpen;
      const p = heroEl.querySelector(".t-overview");
      p.classList.toggle("clamp", !overviewOpen);
      e.target.closest(".t-read-more").textContent = overviewOpen ? "Show less" : "Read more";
      return;
    }
    const allReviews = e.target.closest(".t-reviews-more");
    if (allReviews) {
      reviewsOpen = !reviewsOpen;
      const list = allReviews.closest("p").previousElementSibling;
      [...list.children].forEach((a, n) => (a.hidden = n >= REVIEWS_SHOWN && !reviewsOpen));
      fitReviews();
      allReviews.textContent = reviewsOpen ? "Show fewer reviews" : `See more reviews (${list.children.length - REVIEWS_SHOWN})`;
      return;
    }
    const vote = e.target.closest(".t-vote");
    if (vote) {
      const box = vote.closest(".t-votes");
      const votes = Store.read(VOTES_KEY, {});
      const v = Number(vote.dataset.vote);
      if (votes[box.dataset.review] === v) delete votes[box.dataset.review];
      else votes[box.dataset.review] = v;
      Store.write(VOTES_KEY, votes);
      box.outerHTML = voteButtons(box.dataset.review);
      return;
    }
    const reviewMore = e.target.closest(".t-review-more");
    if (reviewMore) {
      const p = reviewMore.closest(".t-review").querySelector("p");
      p.classList.toggle("clamp");
      reviewMore.textContent = p.classList.contains("clamp") ? "Read more" : "Show less";
      return;
    }
    // a season card: that season's trailer in the pop-up ("Breaking Bad · Season 2")
    const season = e.target.closest("[data-season]");
    if (season) {
      const show = Number(season.dataset.show);
      const n = Number(season.dataset.season);
      const known = seasonVids.get(`${show}-${n}`);
      if (known && !known.length) {
        toast(`TMDB has no trailer for ${season.dataset.name} yet`);
        return;
      }
      const showName = (heroEl.querySelector(".t-head h1") || {}).firstChild ? heroEl.querySelector(".t-head h1").firstChild.textContent.trim() : "";
      const load = () => (known ? Promise.resolve(known) : TMDB.seasonVideos(show, n)).then((l) => l.map((v) => v.key));
      Cards.showTrailer(
        { title: `${showName} · ${season.dataset.name}`, year: season.dataset.year || "" },
        () => load().then((k) => k[0] || null),
        () => load().then((k) => k.slice(1))
      );
      return;
    }
    const mdTab = e.target.closest("[data-md]");
    if (mdTab) {
      mediaTab = mdTab.dataset.md;
      const sec = mdTab.closest(".t-section");
      sec.querySelectorAll("[data-md]").forEach((b) => {
        b.classList.toggle("active", b === mdTab);
        b.setAttribute("aria-selected", b === mdTab);
      });
      sec.querySelectorAll(".md-pane").forEach((p) => {
        p.hidden = p.dataset.pane !== mediaTab;
        if (!p.hidden) {
          p.classList.remove("md-in");
          requestAnimationFrame(() => p.classList.add("md-in"));
        }
      });
      return;
    }
    const shot = e.target.closest("[data-shot]");
    if (shot) return openViewer(Number(shot.dataset.shot));
    const video = e.target.closest("[data-video]");
    if (video) Cards.showTrailer({ title: video.dataset.name, trailer: video.dataset.video }, () => null);
  });



  /* ---------------- a title in your library ---------------- */

  // the watch diary: the day you watched it (change it, or add it to an older rating)
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function watchedOnHtml(item) {
    if (item.watchedAt) {
      const d = new Date(`${item.watchedAt}T00:00:00`);
      return `<div class="t-watched-on"><i class="fa-regular fa-calendar-check"></i> Watched on ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}
        <button type="button" class="twd-edit">Change</button></div>`;
    }
    if (item.rating == null) return "";
    return `<div class="t-watched-on"><i class="fa-regular fa-calendar"></i>
      <button type="button" class="twd-edit">When did you watch it?</button></div>`;
  }

  function renderLibrary() {
    const item = Store.get(id);
    if (!item) return message("fa-regular fa-face-frown", "This title isn't in your library any more.");
    const d = Object.assign({}, extra || {}, pick(item));
    document.title = `${Lang.title(item)}${item.year ? ` (${item.year})` : ""} · Movie Nights`;
    heroEl.dataset.id = item.id;
    mainEl.dataset.id = item.id;
    const e = TMDB.enabled() ? Ratings.entry(Ratings.refOf(item)) : null;

    const buttons = `
      <button class="btn t-trailer" data-action="trailer"><i class="fa-solid fa-play"></i> Trailer</button>
      <div class="t-actions">
        ${
          // in your library = watched: no Watchlist button. Still on the Watchlist (not seen
          // yet): take it off, or mark it Watched
          item.watchlist
            ? `<button class="btn is-on" data-action="watch" aria-pressed="true" aria-label="On your Watchlist (tap to take it off)"><i class="fa-solid fa-bookmark"></i> <span class="t-btn-l"><span class="t-on-word">On </span>Watchlist</span></button>
               <button class="btn" data-action="watched"><i class="fa-regular fa-circle-check"></i> <span class="t-btn-l">Watched</span></button>`
            : ""
        }
        <button class="btn${item.favorite ? " is-on" : ""}" data-action="fav" aria-pressed="${!!item.favorite}">
          <i class="fa-${item.favorite ? "solid" : "regular"} fa-heart"></i> <span class="t-btn-l">Favorite</span></button>
        <button class="btn${item.rating != null ? " is-rated" : ""}" data-action="rate">
          ${item.rating != null ? `<i class="fa-solid fa-star"></i> ${Cards.formatRating(item.rating)}` : '<i class="fa-regular fa-thumbs-up"></i> Rate'}</button>
      </div>
      ${watchedOnHtml(item)}`;
    const inLists = Store.lists().filter((l) => l.items.includes(item.id)).length;
    heroEl.innerHTML = heroHtml(item, d, e, buttons, "lists", inLists);
    fitMeta();

    // more like this: the titles of yours that share the most genres with it (the same kind of
    // title counts a little too), then your likely favourites (Match %) and the closest years
    const mineG = new Set((d.genres || item.genres || []).map((g) => g.toLowerCase()));
    const overlap = (i) => {
      const g = (i.genres || []).map((x) => x.toLowerCase());
      const shared = g.filter((x) => mineG.has(x)).length;
      return shared ? shared / (mineG.size + g.length - shared) + (i.type === item.type ? 0.15 : 0) : 0;
    };
    const liked = (i) => (window.Taste && Taste.match(i)) || 0;
    const similar = Store.all()
      .filter((i) => i.id !== item.id)
      .map((i) => ({ i, o: overlap(i) }))
      .filter((x) => x.o > 0)
      .sort((a, b) => b.o - a.o || liked(b.i) - liked(a.i) || Math.abs((a.i.year || 0) - (item.year || 0)) - Math.abs((b.i.year || 0) - (item.year || 0)))
      .slice(0, 16)
      .map((x) => x.i);

    const loading = TMDB.enabled() && !extra;
    const keep = rowScrolls();
    // (typing a note while something redraws the page: the note keeps its text and cursor)
    const noteEl = mainEl.querySelector(".tn-text");
    const typing = noteEl && document.activeElement === noteEl ? { v: noteEl.value, a: noteEl.selectionStart, b: noteEl.selectionEnd } : null;
    mainEl.innerHTML = `
      <div class="t-yours">${progressHtml(item, d)}${notesHtml(item)}${triviaHtml(item)}</div>
      <div class="t-sections">${sectionsHtml(d, loading)}</div>
      <section class="t-more-like">${moreLikeHtml(similar, extra)}</section>
      <p class="tmdb-note">${
        TMDB.enabled() ? TMDB_NOTE : 'Tip: with a TMDB key (the owner adds it in the Admin Control Center) you would see the overview, cast, trailer and recommendations for every title.'
      }</p>
      <p><button class="btn btn-danger remove-title" type="button"><i class="fa-solid fa-trash"></i> Remove from library</button></p>`;
    rowScrolls(keep);
    if (window.Soundtrack) Soundtrack.mount(mainEl, d);
    if (booksOn(d)) watchBooks(d, renderLibrary);
    const n = mainEl.querySelector(".tn-text");
    if (typing) {
      n.value = typing.v;
      n.focus({ preventScroll: true });
      n.setSelectionRange(typing.a, typing.b);
    }
    if (n) fitNote(n);
    if (extra && extra.xray) watchXray(d, renderLibrary);
  }

  /* ---------------- yours: episode progress (shows) and your notes ---------------- */

  // episodes per season from TMDB ([10, 13, 8]); null while it isn't known
  function episodesOf(d) {
    const seasons = (d && d.seasons) || [];
    if (!seasons.length) return null;
    const eps = [];
    seasons.forEach((s) => (eps[s.n - 1] = s.episodes || 0));
    return Array.from(eps, (n) => n || 0);
  }
  const isShow = (item, d) => (d && d.media ? d.media === "tv" : window.Watch && Watch.isSeries(item));

  function progressHtml(item, d) {
    if (!window.Watch || !isShow(item, d)) return "";
    const label = (icon, text) => `<span class="xr-label"><i class="fa-solid ${icon}"></i> ${text}</span>`;
    const fresh = episodesOf(d);
    let p = item.progress;
    // TMDB knows more episodes now (a new season): count them, and a finished show can go on
    if (p && fresh && JSON.stringify(fresh) !== JSON.stringify(p.eps)) {
      const np = Object.assign({}, p, { eps: fresh });
      if (np.done && Watch.nextEpisode(Object.assign({}, np, { done: false }))) np.done = false;
      setTimeout(() => Store.update(item.id, { progress: np }), 0);
      p = np;
    }
    if (!p) {
      if (!fresh) return "";
      return `<div class="xr-card tp-card tp-off">
          ${label("fa-tv", "Your progress")}
          <p class="tp-lead">Keep track of the episodes you've seen: the show sits in <b>Continue watching</b> on Home, and one tap moves you on to the next episode.</p>
          <button class="btn btn-primary tp-start" type="button"><i class="fa-solid fa-play"></i> I'm watching it</button>
        </div>`;
    }
    const eps = p.eps || [];
    const { seen, total, pct } = Watch.progressOf(p);
    const n = p.done ? null : Watch.nextEpisode(p);
    const seasonOpts = eps.map((c, i) => (c ? `<option value="${i + 1}"${i + 1 === p.s ? " selected" : ""}>Season ${i + 1}</option>` : "")).join("");
    const epOpts = Array.from({ length: (eps[p.s - 1] || 0) + 1 }, (_, e) => `<option value="${e}"${e === p.e ? " selected" : ""}>${e ? `Episode ${e}` : "Not started"}</option>`).join("");
    return `<div class="xr-card tp-card${p.done ? " done" : ""}">
        <div class="xr-head">${label("fa-tv", "Your progress")}<span class="tp-pct">${pct}%</span></div>
        <div class="tp-now">
          <b>${p.done ? '<i class="fa-solid fa-trophy"></i> Finished' : `Season ${p.s} · Episode ${p.e}`}</b>
          <small>${seen} of ${total} episodes watched</small>
        </div>
        <div class="tp-bar"><i style="--w:${pct}%"></i></div>
        <div class="tp-actions">
          ${n ? `<button class="btn btn-primary" type="button" data-action="next-ep"><i class="fa-solid fa-check"></i> Watched S${n.s} E${n.e}</button>` : ""}
          <span class="glass-select small"><select class="tp-season" aria-label="Season">${seasonOpts}</select></span>
          <span class="glass-select small"><select class="tp-episode" aria-label="The last episode you watched">${epOpts}</select></span>
          <button class="btn tp-stop" type="button">${p.done ? "Watch it again" : "Stop tracking"}</button>
        </div>
      </div>`;
  }

  // Your notes: the box grows with what you write; prompts start a line for you ("Favourite
  // scene: "), each one until you've used it; "Edited 3 days ago" (noteAt); a counter near the limit
  const NOTE_MAX = 2000;
  const NOTE_PROMPTS = [
    ["fa-user-group", "Recommended by"],
    ["fa-clapperboard", "Favourite scene"],
    ["fa-quote-left", "Best line"],
    ["fa-rotate", "Would I rewatch?"],
  ];
  function editedAgo(at) {
    const min = Math.round((Date.now() - at) / 60000);
    if (min < 1) return "Edited just now";
    if (min < 60) return `Edited ${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `Edited ${h} h ago`;
    const days = Math.round(h / 24);
    if (days === 1) return "Edited yesterday";
    if (days < 30) return `Edited ${days} days ago`;
    const d = new Date(at);
    return `Edited ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
  }
  const noteState = (item) => (item.note && item.noteAt ? editedAgo(item.noteAt) : "");
  function notePrompts(note) {
    return NOTE_PROMPTS.filter(([, l]) => !note.includes(`${l}:`) && !note.includes(l))
      .map(([icon, l]) => `<button type="button" class="tn-prompt" data-prompt="${esc(l)}"><i class="fa-solid ${icon}"></i> ${esc(l)}</button>`)
      .join("");
  }
  // (folded or not: the header opens / closes it; remembered in this browser, open at first)
  // your notes start folded on every title (movie, series, anime): tap to open them
  let notesFolded = true;
  function notesHtml(item) {
    const note = item.note || "";
    const preview = note.split("\n").find((l) => l.trim()) || "";
    return `<div class="xr-card tn-card${note ? " has-note" : ""}${notesFolded ? " folded" : ""}">
        <button type="button" class="xr-head tn-toggle" aria-expanded="${!notesFolded}" aria-controls="tn-body">
          <span class="xr-label"><i class="fa-solid fa-pen-to-square"></i> Your notes</span>
          <span class="tn-preview">${esc(preview)}</span>
          <small class="tn-state">${esc(noteState(item))}</small>
          <i class="fa-solid fa-chevron-down tn-chev" aria-hidden="true"></i>
        </button>
        <div class="tn-body" id="tn-body"><div>
          <textarea class="tn-text" rows="2" maxlength="${NOTE_MAX}" aria-label="Your notes" placeholder="What did you think? Who recommended it? A favourite scene…"${notesFolded ? " tabindex=\"-1\"" : ""}>${esc(note)}</textarea>
          <div class="tn-foot">
            <div class="tn-prompts">${notePrompts(note)}</div>
            <small class="tn-count" hidden></small>
          </div>
        </div></div>
      </div>`;
  }
  // (the box as tall as its text, up to a limit; the counter near the limit)
  function fitNote(el) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 460)}px`;
    const count = el.closest(".tn-card").querySelector(".tn-count");
    count.hidden = el.value.length < NOTE_MAX - 300;
    count.textContent = `${el.value.length.toLocaleString()} / ${NOTE_MAX.toLocaleString()}`;
    count.classList.toggle("full", el.value.length >= NOTE_MAX);
  }

  /* ---------------- yours: trivia (js/components/trivia.js), for what you've watched ---------------- */

  const seenIt = Store.isWatched;
  function triviaHtml(item) {
    if (!window.Trivia || !TMDB.enabled() || !seenIt(item)) return "";
    const b = Trivia.best(item);
    const r = b != null ? Trivia.rankOf(b) : null;
    // one row, like the folded notes beside it: your best as a small ring, the rank, Play
    const tier = b == null ? "none" : b >= 9 ? "gold" : b >= 7 ? "buff" : b >= 4 ? "fan" : "low";
    return `<div class="xr-card tq-card">
        <span class="tq-ring-s t-${tier}" style="--p:${b == null ? 0 : (b / Trivia.COUNT) * 100}%" aria-hidden="true">
          <span>${b == null ? '<i class="fa-solid fa-brain"></i>' : `<b>${b}</b><small>/${Trivia.COUNT}</small>`}</span>
        </span>
        <div class="tq-txt">
          <span class="xr-label"><i class="fa-solid fa-brain"></i> Trivia</span>
          <b>${r ? `${r[1]} ${esc(r[2])}` : `Test yourself <small>${Trivia.COUNT} questions</small>`}</b>
        </div>
        <button class="btn tq-play" type="button"><i class="fa-solid fa-play"></i> ${r ? "Play again" : "Play"}</button>
      </div>`;
  }
  // just marked Watched: offer the trivia once the rating pop-up is closed
  function offerTrivia() {
    if (!window.Trivia || !TMDB.enabled()) return;
    let tries = 0;
    const wait = setInterval(() => {
      if (document.querySelector(".overlay.active") && ++tries < 120) return;
      clearInterval(wait);
      const item = Store.get(id);
      if (item && tries < 120) toast("Seen it? Test yourself: 10 quick questions", { label: "Play trivia", run: () => Trivia.open(Store.get(id)) });
    }, 500);
  }

  function initYours() {
    document.addEventListener("click", (e) => e.target.closest(".tq-play") && Trivia.open(Store.get(id)));
    document.addEventListener("mn:trivia", () => renderLibrary());
    let wasSeen = seenIt(Store.get(id));
    Store.onChange((changedId) => {
      if (changedId && changedId !== id) return;
      const now = seenIt(Store.get(id));
      if (now && !wasSeen) offerTrivia();
      wasSeen = now;
    });
    // marked Watched on its TMDB page (which then opens this one)
    try {
      const flag = sessionStorage.getItem("mn:triviaOffer");
      const item = Store.get(id);
      if (flag && item && flag === `${item.tmdbMedia}-${item.tmdbId}`) {
        sessionStorage.removeItem("mn:triviaOffer");
        offerTrivia();
      }
    } catch (e) {}

    const setProgress = (patch) => {
      const item = Store.get(id);
      if (!item) return;
      const p = Object.assign({}, item.progress, patch);
      p.done = !Watch.nextEpisode(p) && p.e > 0;
      Store.update(id, { progress: p, progressAt: Date.now() });
    };
    document.addEventListener("click", (e) => {
      if (e.target.closest(".tp-start")) {
        const eps = episodesOf(extra);
        if (!eps) return;
        Store.update(id, { progress: { s: 1, e: 1, eps }, progressAt: Date.now() });
        toast("Tracking it: find it in Continue watching on Home");
      }
      if (e.target.closest(".tp-stop")) {
        const item = Store.get(id);
        if (item && item.progress && item.progress.done) setProgress({ s: 1, e: 0, done: false });
        else {
          Store.update(id, { progress: undefined, progressAt: undefined });
          toast("Stopped tracking");
        }
      }
    });
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("tp-season")) setProgress({ s: Number(e.target.value), e: 1 });
      if (e.target.classList.contains("tp-episode")) setProgress({ e: Number(e.target.value) });
    });
    // your notes: saved a moment after you stop typing (and when you leave the box)
    let timer;
    let stateTimer;
    const setState = (html, cls) => {
      const state = mainEl.querySelector(".tn-state");
      if (!state) return;
      state.innerHTML = html;
      state.className = `tn-state${cls ? ` ${cls}` : ""}`;
    };
    const saveNote = (el) => {
      clearTimeout(timer);
      const item = Store.get(id);
      const note = el.value.trim();
      if (!item || (item.note || "") === note) return setState(esc(item ? noteState(item) : ""));
      Store.update(id, { note: note || undefined, noteAt: note ? Date.now() : undefined });
      setState('<i class="fa-solid fa-check"></i> Saved', "ok");
      clearTimeout(stateTimer);
      stateTimer = setTimeout(() => {
        const now = Store.get(id);
        if (now && !mainEl.querySelector(".tn-state.busy")) setState(esc(noteState(now)));
      }, 2500);
    };
    document.addEventListener("input", (e) => {
      if (!e.target.classList.contains("tn-text")) return;
      fitNote(e.target);
      setState('<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…', "busy");
      clearTimeout(timer);
      timer = setTimeout(() => saveNote(e.target), 900);
    });
    document.addEventListener("focusout", (e) => e.target.classList && e.target.classList.contains("tn-text") && saveNote(e.target));
    // (in and out of the box its sides change a little: the height follows)
    ["focusin", "focusout"].forEach((t) =>
      document.addEventListener(t, (e) => e.target.classList && e.target.classList.contains("tn-text") && requestAnimationFrame(() => fitNote(e.target)))
    );
    // Ctrl / ⌘ + Enter: done (saved, and out of the box)
    document.addEventListener("keydown", (e) => {
      if (e.target.classList && e.target.classList.contains("tn-text") && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.target.blur();
      }
    });
    // fold / unfold (opening it puts you in the box)
    document.addEventListener("click", (e) => {
      const t = e.target.closest(".tn-toggle");
      if (!t) return;
      const card = t.closest(".tn-card");
      notesFolded = !card.classList.contains("folded");
      card.classList.toggle("folded", notesFolded);
      t.setAttribute("aria-expanded", !notesFolded);
      const el = card.querySelector(".tn-text");
      if (notesFolded) {
        el.setAttribute("tabindex", "-1");
        el.blur();
      } else {
        el.removeAttribute("tabindex");
        fitNote(el);
        if (!el.value) setTimeout(() => el.focus({ preventScroll: true }), 250);
      }
    });
    // a prompt: starts its line at the end of the note, the cursor after it
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".tn-prompt");
      if (!b) return;
      const el = b.closest(".tn-card").querySelector(".tn-text");
      const text = el.value.replace(/\s+$/, "");
      el.value = `${text}${text ? "\n" : ""}${b.dataset.prompt}${b.dataset.prompt.endsWith("?") ? " " : ": "}`;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      b.remove();
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function initLibrary() {
    // "On Watchlist" tapped on a title you haven't watched (no score, no watch date): it leaves
    // your library altogether, with Undo, and the page becomes the title's "add it" page again,
    // with its Watchlist button. (Left in the library it would count as watched, and the page
    // would have no Watchlist button to put it back.)
    heroEl.addEventListener(
      "click",
      (e) => {
        const b = e.target.closest('[data-action="watch"]');
        const item = Store.get(id);
        // (only titles added on the site, isNew: the owner's original library stays as it was)
        if (!b || !item || !item.isNew || !item.watchlist || item.rating != null || item.watchedAt || Store.guest) return;
        const ref = window.Watch ? Watch.knownRef(item) : null;
        if (!ref) return; // (not on TMDB: the usual toggle)
        e.preventDefault();
        e.stopPropagation();
        // the title as it was, for the Undo on the next page (its lists keep its id)
        try {
          sessionStorage.setItem("mn:undoRemove", JSON.stringify({ ref, item: JSON.parse(JSON.stringify(item)) }));
        } catch (err) {}
        Store.remove(id);
        location.replace(`title.html?tmdb=${encodeURIComponent(ref)}`);
      },
      true
    );

    // "Watched on …": the site's date picker opens from the Change button
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".twd-edit");
      if (!btn) return;
      const item = Store.get(id);
      const day = await UI.pickDate(btn, { value: item.watchedAt || "", max: Store.today(), title: "The day you watched it", clear: true });
      if (day === null || day === (item.watchedAt || "")) return;
      Store.update(id, { watchedAt: day || null });
      toast(day ? "Watch date saved" : "Watch date removed");
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".remove-title")) return;
      // no confirm: the message has an Undo button (js/components/cards.js)
      Cards.removeTitle(id);
    });

    Store.onChange((changedId) => {
      // this title, or (with a franchise shown) any title: its counter may change
      if (!changedId || changedId === id || colData) renderLibrary();
    });

    initYours();
    renderLibrary();

    const item = Store.get(id);
    if (item && TMDB.enabled()) {
      // IMDb rating (uses one OMDb lookup if it isn't saved yet)
      Ratings.onChange((changedId) => changedId === id && renderLibrary());
      Ratings.request(item);

      TMDB.details(item)
        .then((details) => {
          extra = details || {};
          loadCollection(extra, renderLibrary); // its franchise, if it's part of one
          loadTvmaze(extra, renderLibrary); // a show: episodes, when it airs (TVmaze)
          loadAnime(extra, renderLibrary); // anime: its AniList card
          if (details && details.titleRu && !Store.get(id).titleRu) Store.update(id, { titleRu: details.titleRu });
          Ratings.request(Store.get(id)); // now that the IMDb id is known
          // remember the trailer so it also works on cards and in the exported library
          if (details && !item.trailer && details.trailer) Store.update(id, { trailer: details.trailer });
          else renderLibrary();
        })
        .catch((err) => {
          console.warn("TMDB:", err.message);
          extra = {};
          renderLibrary();
        });
    }
  }

  /* ---------------- any title from TMDB ---------------- */

  async function initTmdb() {
    const [media, tmdbId] = tmdbRef.split("-");
    if (!TMDB.enabled()) return message("fa-solid fa-key", 'This page needs a TMDB API key. The owner of the site adds one in the Admin Control Center.');
    if (!/^(movie|tv)$/.test(media) || !/^\d+$/.test(tmdbId)) return message("fa-regular fa-face-frown", "That link doesn't look right.");

    heroEl.hidden = true;
    mainEl.innerHTML = '<p class="result-count">Loading…</p>';
    let d;
    try {
      d = await TMDB.detailsById(media, Number(tmdbId));
    } catch (err) {
      return message("fa-solid fa-triangle-exclamation", esc(err.message));
    }

    const goToLibrary = () => {
      const lib = Cards.inLibrary(d);
      if (lib) location.replace(`title.html?id=${encodeURIComponent(lib.id)}${shared ? shared.query : ""}${params.get("ep") ? `&ep=${encodeURIComponent(params.get("ep"))}` : ""}`);
      return !!lib;
    };
    if (goToLibrary()) return;
    tmdbDetails = d;
    // just taken off your Watchlist (and so out of your library) on its library page: Undo
    try {
      const undo = JSON.parse(sessionStorage.getItem("mn:undoRemove") || "null");
      if (undo && undo.ref === tmdbRef && undo.item) {
        sessionStorage.removeItem("mn:undoRemove");
        setTimeout(
          () =>
            toast(`${Lang.title(undo.item)} is off your Watchlist`, {
              label: "Undo",
              run: () => {
                if (!Store.get(undo.item.id)) Store.add(undo.item);
                location.replace(`title.html?id=${encodeURIComponent(undo.item.id)}`);
              },
            }),
          300
        );
      }
    } catch (err) {}

    Cards.tmdbCard(d); // registers it so the buttons below work
    document.title = `${Lang.title(d)}${d.year ? ` (${d.year})` : ""} · Movie Nights`;
    heroEl.dataset.tmdb = tmdbRef;
    mainEl.dataset.tmdb = tmdbRef;
    Ratings.seed(tmdbRef, d.tmdbScore, d.imdbId);
    renderExternal(d);
    // a show: "I'm watching it" adds it (on your Watchlist) and starts tracking the episodes
    const eps = d.media === "tv" && (d.released || "") <= Store.today() ? episodesOf(d) : null;
    const track = eps
      ? `<div class="t-yours"><div class="xr-card tp-card tp-off">
          <span class="xr-label"><i class="fa-solid fa-tv"></i> Your progress</span>
          <p class="tp-lead">Watching it? Keep track of your episodes: it goes on your Watchlist and into <b>Continue watching</b> on Home.</p>
          <button class="btn btn-primary tp-add" type="button"><i class="fa-solid fa-play"></i> I'm watching it</button>
        </div></div>`
      : "";
    if (eps)
      mainEl.addEventListener("click", (e) => {
        if (!e.target.closest(".tp-add")) return;
        if (Store.guest) return UI.needSignIn();
        const lib = Cards.addHit(d, { watchlist: true, progress: { s: 1, e: 1, eps }, progressAt: Date.now() });
        location.replace(`title.html?id=${encodeURIComponent(lib.id)}${shared ? shared.query : ""}`);
      });
    const renderMain = () => {
      const keep = rowScrolls();
      mainEl.innerHTML = `${track}<div class="t-sections">${sectionsHtml(d, false)}</div>${recommendationsHtml(d)}<p class="tmdb-note">${TMDB_NOTE}</p>`;
      rowScrolls(keep);
      if (window.Soundtrack) Soundtrack.mount(mainEl, d);
      watchXray(d, renderMain);
      if (booksOn(d)) watchBooks(d, renderMain);
    };
    renderMain();
    loadCollection(d, renderMain);
    loadTvmaze(d, () => {
      renderExternal(d);
      renderMain();
    });
    loadAnime(d, renderMain);
    // the franchise counter follows what you add / rate (not this title: it goes to its library page)
    Store.onChange(() => colData && !Cards.inLibrary(d) && renderMain());

    // IMDb rating (one OMDb lookup the first time you open this title)
    Ratings.forRef(tmdbRef).then(() => heroEl.dataset.tmdb === tmdbRef && renderExternal(d));
    if (window.Watch) Watch.onChange(() => heroEl.dataset.tmdb === tmdbRef && renderExternal(d)); // Remind me on / off

    // once it's added, show the normal library page (but not while a pop-up is open,
    // e.g. the rating you're about to give it)
    document.addEventListener("click", () => setTimeout(() => !document.querySelector(".overlay.active") && goToLibrary(), 400));
    // Watched here: its library page offers the trivia
    heroEl.addEventListener("click", (e) => {
      if (!e.target.closest('[data-action="t-watched"]')) return;
      try {
        sessionStorage.setItem("mn:triviaOffer", tmdbRef);
      } catch (err) {}
    });
    document.addEventListener("keydown", (e) => e.key === "Escape" && setTimeout(goToLibrary, 400));
  }

  function renderExternal(d) {
    // not out yet: "Remind me" (into Coming up on the Watchlist page) instead of Watched / Rate
    const soon = d.released && d.released > Store.today();
    const reminded = soon && window.Watch && Watch.isReminded(tmdbRef);
    const buttons = `
      <button class="btn t-trailer" data-action="t-trailer"><i class="fa-solid fa-play"></i> Trailer</button>
      <div class="t-actions">
        <button class="btn" data-action="t-watch"><i class="fa-regular fa-bookmark"></i> Watchlist</button>
        ${
          soon
            ? `<button class="btn${reminded ? " is-on" : ""}" data-action="t-remind" aria-pressed="${!!reminded}"><i class="fa-${reminded ? "solid" : "regular"} fa-bell"></i> ${reminded ? "Reminder on" : "Remind me"}</button>`
            : `<button class="btn" data-action="t-watched"><i class="fa-regular fa-circle-check"></i> Watched</button>
               <button class="btn" data-action="t-rate"><i class="fa-regular fa-thumbs-up"></i> Rate</button>`
        }
      </div>`;
    heroEl.innerHTML = heroHtml(d, d, Ratings.entry(tmdbRef), buttons, "t-lists", 0);
    fitMeta();
  }

  // opened from a shared link: a small card at the foot of the screen with who sent it, their
  // score and their note, until it's closed
  function showShared() {
    if (!shared) return;
    const el = document.createElement("aside");
    el.className = "t-shared";
    el.setAttribute("aria-label", "Shared with you");
    const initial = shared.from ? shared.from.charAt(0).toUpperCase() : "";
    el.innerHTML = `
      <span class="t-shared-av">${initial ? esc(initial) : '<i class="fa-solid fa-gift"></i>'}</span>
      <div class="t-shared-text">
        <p><span>${shared.from ? `<b>${esc(shared.from)}</b> shared this with you` : "Someone shared this with you"}</span></p>
        ${shared.note ? `<q>${esc(shared.note)}</q>` : ""}
      </div>
      ${shared.score != null ? `<span class="t-shared-score"><i class="fa-solid fa-star"></i>${Cards.formatRating(shared.score)}<small>/10</small></span>` : ""}
      <button type="button" class="t-shared-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>`;
    el.querySelector(".t-shared-x").addEventListener("click", () => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 350);
    });
    document.body.append(el);
  }

  if (tmdbRef) initTmdb();
  else initLibrary();
  showShared();
})();
