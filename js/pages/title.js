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
  let extra = null; // details fetched from TMDB

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
      parts.push(`<span class="t-score" title="${e.votes ? `IMDb rating from ${esc(e.votes)} votes` : "IMDb rating"}"><span class="imdb-tag">IMDb</span>${Cards.formatRating(e.imdb)} / 10</span>`);
    } else {
      const tmdb = e && typeof e.tmdb === "number" ? e.tmdb : d.tmdbScore;
      if (typeof tmdb === "number") parts.push(`<span class="t-score" title="TMDB rating"><span class="tmdb-tag">TMDB</span>${tmdb.toFixed(1)} / 10</span>`);
    }
    if (d.runtime) parts.push(esc(d.runtime));
    if (t.year) parts.push(t.year);
    if (e && e.rt) {
      const rotten = parseInt(e.rt, 10) < 60;
      parts.push(`<span class="t-rt${rotten ? " rotten" : ""}" title="Rotten Tomatoes Tomatometer (critics)"><span class="rt-icon">🍅</span>${esc(e.rt)}</span>`);
    }
    return parts.join('<span class="dot">·</span>');
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

  function topbarHtml(menuItems) {
    return `<div class="t-topbar">
      <button class="t-round" data-t="back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
      <span class="t-spacer"></span>
      <button class="t-round" data-t="share" aria-label="Share"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
      <div class="t-more-wrap">
        <button class="t-round" data-t="more" aria-label="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        <div class="t-menu" hidden>
          <a href="index.html"><i class="fa-solid fa-house"></i> Home</a>
          <a href="discover.html"><i class="fa-solid fa-compass"></i> Discover</a>
          ${menuItems}
        </div>
      </div>
    </div>`;
  }

  // the whole top block: backdrop, title, info, buttons, overview
  function heroHtml(t, d, e, buttons, menuItems) {
    const backdrop = d.backdrop ? Store.img(d.backdrop, "w1280") : Store.img(t.poster, "w780");
    heroEl.hidden = false;
    return `
      <div class="t-backdrop">${
        backdrop
          ? `<picture>${d.artPoster ? `<source media="(max-width: 700px)" srcset="${Store.img(d.artPoster, "w780")}" />` : ""}<img src="${backdrop}" alt="" /></picture>`
          : ""
      }</div>
      ${topbarHtml(menuItems)}
      <div class="container t-hero-inner">
        <img class="t-poster" src="${Store.poster(Lang.isRu() && d.posterRu ? d.posterRu : Cards.posterOf(t), "w500")}" alt="${esc(Lang.title(t))} poster" />
        <div class="t-head">
          <h1>${esc(Lang.title(t))}${t.year ? ` <span class="year">(${t.year})</span>` : ""}</h1>
          ${Lang.altTitle(t) ? `<div class="t-alt-title">${esc(Lang.altTitle(t))}</div>` : ""}
          <div class="t-meta">${metaHtml(t, d, e)}</div>
          <div class="t-genres">${genresHtml(t, d)}</div>
          ${providersHtml(d.providers, t)}
          <div class="t-cta">${buttons}</div>
          ${aboutHtml(d)}
        </div>
      </div>`;
  }

  // the sections are redrawn when something changes: keep each sideways row where you
  // scrolled it. rowScrolls() reads them, rowScrolls(saved) puts them back
  function rowScrolls(saved) {
    const rows = [...mainEl.querySelectorAll(".movie-row, .t-cast, .t-media-row")];
    if (!saved) return rows.map((r) => r.scrollLeft);
    rows.forEach((r, n) => saved[n] && (r.scrollLeft = saved[n]));
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
      return !!(lib && (lib.rating != null || lib.watchedAt || !lib.watchlist));
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
  const niceDay = (s) => {
    const x = new Date(`${s}T00:00:00`);
    return isNaN(x) ? s : `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
  };

  function xrayPanel(d) {
    const x = d.xray;
    const e = window.Ratings ? Ratings.entry(tmdbRef || Ratings.refOf(Store.get(id) || {})) || {} : {};
    const facts = [];
    const fact = (icon, label, value) => value && facts.push(`<div class="xr-fact"><i class="fa-solid ${icon}"></i><div><small>${label}</small><span>${value}</span></div></div>`);
    fact("fa-calendar-day", d.media === "tv" ? "First aired" : "Released", x.released ? niceDay(x.released) : "");
    if (x.status && !/^(Released|Ended)$/.test(x.status)) fact("fa-circle-info", "Status", esc(x.status));
    if (d.media === "tv") fact("fa-list-ol", "Episodes", x.episodes ? `${x.episodes}${x.lastAir ? ` · last aired ${niceDay(x.lastAir)}` : ""}` : "");
    fact("fa-sack-dollar", "Budget", x.budget ? money(x.budget) : "");
    const gross = x.revenue ? money(x.revenue) + " worldwide" : e.boxOffice ? `${esc(e.boxOffice)} in the US` : "";
    fact("fa-ticket", "Box office", gross && x.budget && x.revenue ? `${gross} · ${(x.revenue / x.budget).toFixed(1)}× its budget` : gross);
    fact("fa-trophy", "Awards", e.awards ? esc(e.awards) : "");
    fact("fa-tower-broadcast", "Network", esc(x.networks.join(", ")));
    fact("fa-building", "Made by", esc(x.companies.join(", ")));
    fact("fa-earth-europe", "Filmed in / from", esc(x.countries.join(", ")));
    fact("fa-language", "Original language", x.language ? esc(langName(x.language)) : "");

    const seen = seenBefore
      ? seenBefore.length
        ? `<ul class="xr-seen-list">${seenBefore
            .map(
              (p) => `<li>
                <a class="xr-person" href="person.html?id=${p.id}">${p.photo ? `<img src="${Store.img(p.photo, "w185")}" alt="" loading="lazy" />` : '<span class="xr-noimg"><i class="fa-solid fa-user"></i></span>'}<strong>${esc(p.name)}</strong></a>
                <span>you've seen them in ${p.titles
                  .map((t) => `<a href="title.html?id=${encodeURIComponent(t.id)}">${esc(t.title)}</a>${t.character ? ` <small>(${esc(t.character)})</small>` : ""}`)
                  .join(", ")}</span></li>`
            )
            .join("")}</ul>`
        : '<p class="muted">None of the main cast is in anything else you\'ve watched.</p>'
      : '<p class="muted xr-seen-wait"><i class="fa-solid fa-spinner fa-spin"></i> Checking your library…</p>';

    return `${x.tagline ? `<blockquote class="xr-tagline">“${esc(x.tagline)}”</blockquote>` : ""}
      ${facts.length ? `<div class="xr-facts">${facts.join("")}</div>` : ""}
      ${castWithIds(d).length ? `<h3 class="xr-sub"><i class="fa-solid fa-user-check"></i> Where you've seen the cast</h3><div class="xr-seen">${seen}</div>` : ""}
      ${x.keywords.length ? `<div class="xr-tags">${x.keywords.map((k) => `<span>${esc(k)}</span>`).join("")}</div>` : ""}`;
  }

  // "where you've seen the cast": looked up when the X-Ray section comes into view
  function watchXray(d, done) {
    const box = mainEl.querySelector(".t-xray");
    if (!box || seenBefore || seenLoading || !castWithIds(d).length) return;
    const start = async () => {
      if (seenLoading || seenBefore) return;
      seenLoading = true;
      // watched = in your library, unless it's only on your Watchlist (same as the franchise counter)
      const mine = new Set(Store.all().filter((i) => i.rating != null || i.watchedAt || !i.watchlist).map((i) => i.id));
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
          if (titles.length) out.push({ id: c.id, name: c.name, photo: c.photo, titles });
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
    if (cast.length) html += block("Cast &amp; Crew", 0, castPanel(cast));
    if (loading) return html + '<p class="muted t-empty">Loading more details…</p>';
    if (d.xray) html += block('<i class="fa-solid fa-bolt"></i> X-Ray', 0, xrayPanel(d), "t-xray");
    if (videos.length || images.length) html += block("Media", 0, mediaPanel(videos, images));
    if (reviews.length) html += block("Reviews", reviews.length, reviewsPanel(reviews, d.tmdbUrl));
    return html;
  }
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

  function mediaPanel(videos, images) {
    if (!videos.length && !images.length) return '<p class="muted t-empty">No videos or images yet.</p>';
    return `
      ${videos.length ? `<h3 class="t-sub">Videos</h3><div class="t-media-row">${videos
        .map(
          (v) => `<button class="t-video" data-video="${esc(v.key)}" data-name="${esc(v.name)}" type="button">
            <span class="t-thumb"><img src="https://i.ytimg.com/vi/${encodeURIComponent(v.key)}/mqdefault.jpg" alt="" loading="lazy" /><i class="fa-solid fa-play"></i></span>
            <strong>${esc(v.name)}</strong><span>${esc(v.type)}</span>
          </button>`
        )
        .join("")}</div>` : ""}
      ${images.length ? `<h3 class="t-sub">Images</h3><div class="t-media-row">${images
        .map((p) => `<a class="t-still" href="${Store.img(p, "original")}" target="_blank" rel="noopener"><img src="${Store.img(p, "w500")}" alt="" loading="lazy" /></a>`)
        .join("")}</div>` : ""}`;
  }

  function reviewsPanel(reviews, tmdbUrl) {
    if (!reviews.length) return '<p class="muted t-empty">No reviews yet.</p>';
    return `<div class="t-reviews">${reviews
      .map(
        (r) => `<article class="t-review">
          <header><strong>${esc(r.author)}</strong>${r.rating != null ? `<span class="t-review-score"><i class="fa-solid fa-star"></i> ${r.rating} / 10</span>` : ""}<small>${esc(r.date)}</small></header>
          <p class="clamp">${esc(r.text)}</p>
          <button class="t-link t-review-more" type="button">Read more</button>
        </article>`
      )
      .join("")}</div>
      ${tmdbUrl ? `<p><a class="t-link" href="${esc(tmdbUrl)}/reviews" target="_blank" rel="noopener">All reviews on TMDB <i class="fa-solid fa-arrow-up-right-from-square"></i></a></p>` : ""}`;
  }

  function recommendationsHtml(d) {
    const recs = (d && d.recommendations) || [];
    return recs.length ? `<h2 class="section-title">Recommended on TMDB</h2><div class="movie-row">${recs.map(Cards.tmdbCard).join("")}</div>` : "";
  }

  const TMDB_NOTE =
    "Details from TMDB, ratings from IMDb and Rotten Tomatoes via OMDb, streaming data by JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.";

  /* ---------------- page-level buttons (back, share, menu, read more, videos) ---------------- */

  document.addEventListener("click", async (e) => {
    const menu = heroEl.querySelector(".t-menu");
    const t = e.target.closest("[data-t]");
    if (menu && !e.target.closest(".t-more-wrap")) menu.hidden = true;
    if (t) {
      if (t.dataset.t === "back") history.length > 1 ? history.back() : (location.href = "index.html");
      if (t.dataset.t === "more" && menu) menu.hidden = !menu.hidden;
      if (t.dataset.t === "share") {
        const data = { title: document.title, url: location.href };
        try {
          if (navigator.share) await navigator.share(data);
          else {
            await navigator.clipboard.writeText(location.href);
            toast("Link copied");
          }
        } catch (err) {} // share sheet closed
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
    const reviewMore = e.target.closest(".t-review-more");
    if (reviewMore) {
      const p = reviewMore.previousElementSibling;
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
    const video = e.target.closest("[data-video]");
    if (video) Cards.showTrailer({ title: video.dataset.name, trailer: video.dataset.video }, () => null);
  });



  /* ---------------- a title in your library ---------------- */

  // the watch diary: the day you watched it (change it, or add it to an older rating)
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function watchedOnHtml(item) {
    const input = `<input type="date" class="twd-input" max="${Store.today()}" value="${esc(item.watchedAt || "")}" aria-label="The day you watched it" />`;
    if (item.watchedAt) {
      const d = new Date(`${item.watchedAt}T00:00:00`);
      return `<div class="t-watched-on"><i class="fa-regular fa-calendar-check"></i> Watched on ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}
        <button type="button" class="twd-edit">Change</button>${input}</div>`;
    }
    if (item.rating == null) return "";
    return `<div class="t-watched-on"><i class="fa-regular fa-calendar"></i>
      <button type="button" class="twd-edit">When did you watch it?</button>${input}</div>`;
  }

  function renderLibrary() {
    const item = Store.get(id);
    if (!item) return message("fa-regular fa-face-frown", "This title isn't in your library any more.");
    const d = Object.assign({}, extra || {}, pick(item));
    document.title = `${Lang.title(item)} (${item.year}) · Movie Nights`;
    heroEl.dataset.id = item.id;
    mainEl.dataset.id = item.id;
    const e = TMDB.enabled() ? Ratings.entry(Ratings.refOf(item)) : null;

    const buttons = `
      <button class="btn t-trailer" data-action="trailer"><i class="fa-solid fa-play"></i> Trailer</button>
      <div class="t-actions">
        <button class="btn${item.watchlist ? " is-on" : ""}" data-action="watch" aria-pressed="${!!item.watchlist}">
          <i class="fa-${item.watchlist ? "solid" : "regular"} fa-bookmark"></i> ${item.watchlist ? "On Watchlist" : "Watchlist"}</button>
        <button class="btn${item.favorite ? " is-on" : ""}" data-action="fav" aria-pressed="${!!item.favorite}">
          <i class="fa-${item.favorite ? "solid" : "regular"} fa-heart"></i> Favorite</button>
        <button class="btn${item.rating != null ? " is-rated" : ""}" data-action="rate">
          ${item.rating != null ? `<i class="fa-solid fa-star"></i> ${Cards.formatRating(item.rating)}` : '<i class="fa-regular fa-thumbs-up"></i> Rate'}</button>
      </div>
      ${watchedOnHtml(item)}`;
    const menu = `
      <button type="button" data-action="lists"><i class="fa-solid fa-list-ul"></i> Add to a list…</button>
      ${d.tmdbUrl ? `<a href="${esc(d.tmdbUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open on TMDB</a>` : ""}
      <button type="button" class="remove-title"><i class="fa-solid fa-trash"></i> Remove from library</button>`;
    heroEl.innerHTML = heroHtml(item, d, e, buttons, menu);

    const near = (a) => Math.abs((a.rating ?? 5) - (item.rating ?? 5));
    const similar = Store.all()
      .filter((i) => i.type === item.type && i.id !== item.id)
      .sort((a, b) => near(a) - near(b) || Math.abs(a.year - item.year) - Math.abs(b.year - item.year))
      .slice(0, 16);

    const loading = TMDB.enabled() && !extra;
    const keep = rowScrolls();
    mainEl.innerHTML = `
      <div class="t-sections">${sectionsHtml(d, loading)}</div>
      ${recommendationsHtml(extra)}
      ${similar.length ? `<h2 class="section-title">More like this in your library</h2><div class="movie-row">${similar.map(Cards.card).join("")}</div>` : ""}
      <p class="tmdb-note">${
        TMDB.enabled() ? TMDB_NOTE : 'Tip: add a free TMDB API key in <a href="profile.html#settings">Settings</a> to see the overview, cast, trailer and recommendations for every title.'
      }</p>
      <p><button class="btn btn-danger remove-title" type="button"><i class="fa-solid fa-trash"></i> Remove from library</button></p>`;
    rowScrolls(keep);
    if (extra && extra.xray) watchXray(d, renderLibrary);

  }

  function initLibrary() {
    // "Watched on …": the date picker opens from the Change button
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".twd-edit");
      if (!btn) return;
      const input = btn.parentElement.querySelector(".twd-input");
      try {
        input.showPicker();
      } catch (err) {
        input.classList.add("show"); // older browsers: show the date field itself
        input.focus();
      }
    });
    document.addEventListener("change", (e) => {
      if (!e.target.classList.contains("twd-input") || !e.target.value) return;
      Store.update(id, { watchedAt: e.target.value });
      toast("Watch date saved");
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
    if (!TMDB.enabled()) return message("fa-solid fa-key", 'This page needs a TMDB API key. Add one in <a href="profile.html#settings">Profile → Settings</a>.');
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
      if (lib) location.replace(`title.html?id=${encodeURIComponent(lib.id)}`);
      return !!lib;
    };
    if (goToLibrary()) return;

    Cards.tmdbCard(d); // registers it so the buttons below work
    document.title = `${Lang.title(d)}${d.year ? ` (${d.year})` : ""} · Movie Nights`;
    heroEl.dataset.tmdb = tmdbRef;
    mainEl.dataset.tmdb = tmdbRef;
    Ratings.seed(tmdbRef, d.tmdbScore, d.imdbId);
    renderExternal(d);
    const renderMain = () => {
      const keep = rowScrolls();
      mainEl.innerHTML = `<div class="t-sections">${sectionsHtml(d, false)}</div>${recommendationsHtml(d)}<p class="tmdb-note">${TMDB_NOTE}</p>`;
      rowScrolls(keep);
      watchXray(d, renderMain);
    };
    renderMain();
    loadCollection(d, renderMain);
    // the franchise counter follows what you add / rate (not this title: it goes to its library page)
    Store.onChange(() => colData && !Cards.inLibrary(d) && renderMain());

    // IMDb rating (one OMDb lookup the first time you open this title)
    Ratings.forRef(tmdbRef).then(() => heroEl.dataset.tmdb === tmdbRef && renderExternal(d));
    if (window.Watch) Watch.onChange(() => heroEl.dataset.tmdb === tmdbRef && renderExternal(d)); // Remind me on / off

    // once it's added, show the normal library page (but not while a pop-up is open,
    // e.g. the rating you're about to give it)
    document.addEventListener("click", () => setTimeout(() => !document.querySelector(".overlay.active") && goToLibrary(), 400));
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
    const menu = `<button type="button" data-action="t-lists"><i class="fa-solid fa-list-ul"></i> Add to a list…</button>
      <a href="${esc(d.tmdbUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open on TMDB</a>`;
    heroEl.innerHTML = heroHtml(d, d, Ratings.entry(tmdbRef), buttons, menu);
  }

  if (tmdbRef) initTmdb();
  else initLibrary();
})();
