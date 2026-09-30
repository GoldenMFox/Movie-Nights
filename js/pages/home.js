/*
 * Home page.
 *  - With a TMDB key: a real-world home page. The slideshow shows this week's
 *    trending titles, the rows show what's in cinemas, coming soon, popular and
 *    top rated (movies, TV, anime), all live from TMDB. Your own list is at the
 *    bottom ("Your Movie Nights").
 *  - Without a key: everything comes from your own list.
 */
(function () {
  const { esc } = UI;
  const hero = document.getElementById("hero");
  const rowsEl = document.getElementById("home-rows");
  const mineEl = document.getElementById("home-mine");
  const live = window.TMDB && TMDB.enabled();

  const LIVE_ROWS = [
    { cat: "trending", title: "Trending this week" },
    { cat: "now-playing", title: "In cinemas now" },
    { cat: "upcoming", title: "Coming soon" },
    { cat: "popular-movies", title: "Popular movies" },
    { cat: "popular-tv", title: "Popular TV shows" },
    { cat: "top-movies", title: "Top rated movies of all time" },
    { cat: "top-tv", title: "Top rated TV shows" },
    { cat: "anime", title: "Popular anime" },
    { cat: "top-anime", title: "Top rated anime" },
  ];

  /* ---------------- slideshow ---------------- */

  let timer;

  function slideshow(slides) {
    hero.innerHTML = `
      ${slides.map((s, i) => `<div class="hero-slide${i === 0 ? " active" : ""}"${s.attrs || ""}>
          <img src="${s.img}" alt="" ${i ? 'loading="lazy"' : ""} />
          <div class="hero-caption">${s.caption}</div>
        </div>`).join("")}
      <button class="hero-arrow prev" aria-label="Previous slide"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="hero-arrow next" aria-label="Next slide"><i class="fa-solid fa-chevron-right"></i></button>
      <div class="hero-dots">${slides.map((_, i) => `<button aria-label="Slide ${i + 1}" class="${i === 0 ? "active" : ""}"></button>`).join("")}</div>`;

    const els = hero.querySelectorAll(".hero-slide");
    const dots = hero.querySelectorAll(".hero-dots button");
    let index = 0;

    const go = (i) => {
      index = (i + els.length) % els.length;
      els.forEach((s, n) => s.classList.toggle("active", n === index));
      dots.forEach((d, n) => d.classList.toggle("active", n === index));
      restart();
    };
    const restart = () => {
      clearInterval(timer);
      // the active dot fills up as the time to the next slide runs out
      hero.classList.remove("ticking");
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        timer = setInterval(() => go(index + 1), 8000);
        void hero.offsetWidth;
        hero.classList.add("ticking");
      }
    };

    hero.querySelector(".prev").onclick = () => go(index - 1);
    hero.querySelector(".next").onclick = () => go(index + 1);
    dots.forEach((d, n) => (d.onclick = () => go(n)));
    hero.onmouseenter = () => {
      clearInterval(timer);
      hero.classList.remove("ticking");
    };
    hero.onmouseleave = restart;
    // swipe left / right on phones (the arrows are hidden there)
    let startX = null;
    hero.ontouchstart = (e) => (startX = e.touches[0].clientX);
    hero.ontouchend = (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    };
    restart();
  }

  function shorten(text, max) {
    if (!text || text.length <= max) return text || "";
    return text.slice(0, text.lastIndexOf(" ", max)) + "…";
  }

  // one trending title as a slide (buttons work through js/components/cards.js)
  function trendingSlide(hit, rank) {
    const lib = Cards.inLibrary(hit);
    const tmdbKey = `${hit.mediaType}-${hit.tmdbId}`;
    Cards.tmdbCard(hit); // registers it so the buttons below work
    const url = lib ? `title.html?id=${encodeURIComponent(lib.id)}` : `title.html?tmdb=${tmdbKey}`;
    // "★ 9 you · TMDB 7.0 · 2026 · Movie · Drama • Thriller" (same style as the title page)
    const meta = [
      lib && lib.rating != null ? `<span class="hero-score mine"><i class="fa-solid fa-star"></i> ${Cards.formatRating(lib.rating)} <small>you</small></span>` : "",
      hit.score ? `<span class="hero-score"><span class="tmdb-tag">TMDB</span> ${hit.score.toFixed(1)}</span>` : "",
      hit.year ? `<span>${hit.year}</span>` : "",
      Store.TYPE_LABEL[hit.type] ? `<span>${esc(Store.TYPE_LABEL[hit.type])}</span>` : "",
    ].filter(Boolean);
    const genres = (hit.genres || []).slice(0, 3);
    const onList = lib && lib.watchlist;
    const watchBtn = lib
      ? `<button class="hero-round hero-watch${onList ? " on" : ""}" data-action="watch" aria-label="Watchlist" title="${onList ? "On your Watchlist" : "Add to Watchlist"}">
           <i class="fa-${onList ? "solid" : "regular"} fa-bookmark"></i></button>`
      : `<button class="hero-round hero-watch" data-action="t-watch" aria-label="Add to Watchlist" title="Add to Watchlist"><i class="fa-regular fa-bookmark"></i></button>`;
    return {
      img: Store.img(hit.backdrop, "w1280"),
      attrs: lib ? ` data-id="${esc(lib.id)}"` : ` data-tmdb="${tmdbKey}"`,
      caption: `<div class="hero-tags">
          <span class="hero-kicker"><i class="fa-solid fa-fire"></i> #${rank} Trending</span>
          ${lib ? '<span class="hero-owned"><i class="fa-solid fa-check"></i> In your library</span>' : ""}
        </div>
        <h2>${esc(Lang.title(hit))}</h2>
        ${meta.length ? `<div class="hero-meta">${meta.join('<span class="dot">·</span>')}</div>` : ""}
        ${genres.length ? `<div class="hero-genres">${esc(genres.join(" • "))}</div>` : ""}
        <p class="hero-overview">${esc(shorten(hit.overview, 190))}</p>
        <div class="hero-buttons">
          <button class="hero-play" data-action="${lib ? "trailer" : "t-trailer"}"><i class="fa-solid fa-play"></i> Trailer</button>
          <a class="hero-glass" href="${url}"><i class="fa-solid fa-circle-info"></i> More info</a>
          ${watchBtn}
        </div>`,
    };
  }

  // the round Watchlist button on a slide shows whether the title is on your Watchlist
  function paintWatch(btn, on) {
    btn.classList.toggle("on", on);
    btn.title = on ? "On your Watchlist" : "Add to Watchlist";
    btn.innerHTML = `<i class="fa-${on ? "solid" : "regular"} fa-bookmark"></i>`;
  }
  Store.onChange((id) => {
    hero.querySelectorAll(".hero-slide[data-id]").forEach((slide) => {
      if (id && slide.dataset.id !== id) return;
      const item = Store.get(slide.dataset.id);
      const btn = slide.querySelector(".hero-watch");
      if (item && btn) paintWatch(btn, !!item.watchlist);
    });
  });
  hero.addEventListener("click", (e) => {
    const btn = e.target.closest('.hero-watch[data-action="t-watch"]');
    if (btn && !Store.guest) setTimeout(() => paintWatch(btn, true), 0); // just added from TMDB
  });

  function personalSlides() {
    const all = Store.all();
    const rated = all.filter((i) => i.rating != null).length;
    const caption = `<div class="hero-tags"><span class="hero-kicker"><i class="fa-solid fa-film"></i> Your library</span></div>
      <h2>Movie Nights: Your Cinematic Escape</h2>
      <p class="hero-overview">${all.length} titles, ${rated} rated, ${all.filter((i) => i.watchlist).length} waiting on the watchlist.</p>
      <div class="hero-buttons"><button class="hero-play random-pick" type="button"><i class="fa-solid fa-shuffle"></i> What should I watch?</button></div>`;
    return ["/iDl0ZvK003PvOlcW4jEspntZ8hQ.jpg", "/6qiMjnqT3CFSOCwiBTHwnMwkR6I.jpg", "/wuI6zBnLI5EuqdKEMBMQrhIbvOA.jpg", "/8ykii0BhFxktfbS62fs7iFZxkCL.jpg"].map(
      (p) => ({ img: Store.img(p, "w1280"), caption })
    );
  }

  /* ---------------- live rows from TMDB ---------------- */

  const CACHE_MINUTES = 30;

  // lists are kept for 30 minutes, so going back to Home is instant
  async function cachedList(cat) {
    const key = `mn:home3:${cat}:${Lang.get()}`;
    try {
      const c = JSON.parse(sessionStorage.getItem(key) || "null");
      if (c && Date.now() - c.at < CACHE_MINUTES * 60000) return c.results;
    } catch (e) {}
    const { results } = await TMDB.list(cat, 1);
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), results }));
    } catch (e) {}
    return results;
  }

  /* ---------------- Top 10 today (movies, TV shows): big numbers next to the posters ---------------- */

  // one row, with a Movies / TV shows switch (the choice is remembered)
  const TOP10_KEY = "mn:top10";
  let top10Media = "movie";
  try {
    if (localStorage.getItem(TOP10_KEY) === "tv") top10Media = "tv";
  } catch (e) {}

  function top10Shell() {
    const btn = (media, label) =>
      `<button type="button" class="top10-tab${media === top10Media ? " active" : ""}" data-top10="${media}" aria-pressed="${media === top10Media}">${label}</button>`;
    return `<section class="row-section top10" data-row="top10">
      <div class="row-head top10-head">
        <h2><span class="top10-word">TOP 10</span><span class="top10-sub">today</span></h2>
        <div class="top10-switch" role="group" aria-label="Top 10">${btn("movie", "Movies")}${btn("tv", "TV shows")}</div>
      </div>
      <div class="movie-row top10-row">${'<div class="top10-item skeleton"></div>'.repeat(5)}</div>
    </section>`;
  }

  rowsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-top10]");
    if (!b || b.dataset.top10 === top10Media) return;
    top10Media = b.dataset.top10;
    try {
      localStorage.setItem(TOP10_KEY, top10Media);
    } catch (err) {}
    rowsEl.querySelectorAll("[data-top10]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", x === b);
    });
    const row = rowsEl.querySelector(".top10-row");
    row.scrollLeft = 0;
    fillTop10(top10Media);
  });

  function top10Item(hit, i) {
    const lib = Cards.inLibrary(hit);
    const url = lib ? `title.html?id=${encodeURIComponent(lib.id)}` : `title.html?tmdb=${hit.mediaType}-${hit.tmdbId}`;
    return `<a class="top10-item" href="${url}" title="#${i + 1} · ${esc(Lang.title(hit))}">
      <span class="top10-num" aria-hidden="true">${i + 1}</span>
      <img src="${Store.poster(Cards.posterOf(hit), "w342")}" alt="${esc(Lang.title(hit))}" loading="lazy" decoding="async" />
    </a>`;
  }

  async function fillTop10(media) {
    const row = rowsEl.querySelector(".top10-row");
    const key = `mn:home3:top10-${media}:${Lang.get()}`;
    try {
      let results = null;
      try {
        const c = JSON.parse(sessionStorage.getItem(key) || "null");
        if (c && Date.now() - c.at < CACHE_MINUTES * 60000) results = c.results;
      } catch (e) {}
      if (!results) {
        row.innerHTML = '<div class="top10-item skeleton"></div>'.repeat(5);
        results = await TMDB.top10(media);
        try {
          sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), results }));
        } catch (e) {}
      }
      if (media !== top10Media) return; // switched while it loaded
      row.innerHTML = results.map(top10Item).join("");
    } catch (e) {
      if (media === top10Media) row.innerHTML = `<p class="muted" style="padding:20px">Couldn't load the Top 10: ${esc(e.message)}</p>`;
    }
  }

  function rowShell(id, title, link) {
    return `<section class="row-section" data-row="${id}">
      <div class="row-head"><h2>${esc(title)}</h2>${link ? `<a href="${link}">See all <i class="fa-solid fa-arrow-right"></i></a>` : ""}</div>
      <div class="movie-row">${'<div class="movie-item skeleton"></div>'.repeat(8)}</div>
    </section>`;
  }

  /* ---------------- "Because you liked …" (like Netflix): from your best-rated titles ---------------- */

  // some of your favorites / 8+ titles, different ones each visit: movies and shows for the
  // two rows at the top, anime for the one under the anime rows
  function becauseSeeds(anime, count) {
    if (Store.guest || !window.Watch) return [];
    const good = Store.all().filter(
      (i) => (i.type === "anime") === anime && (typeof i.rating === "number" ? i.rating >= 8 : i.favorite)
    );
    for (let i = good.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [good[i], good[j]] = [good[j], good[i]];
    }
    return good.slice(0, count);
  }

  // well-known titles TMDB recommends for one of yours (js/services/tmdb.js), minus what you
  // already have, what another row shows, and anime outside the anime row (and the reverse)
  async function recsFor(item, anime, shown) {
    const ref = await Watch.refOf(item);
    if (!ref) return [];
    const [media, id] = ref.split("-");
    const list = await TMDB.knownRecommendations(media, Number(id));
    return list.filter((h) => (h.type === "anime") === anime && !Cards.inLibrary(h) && !shown.has(`${h.mediaType}-${h.tmdbId}`));
  }

  // fill the rows one by one; a title of yours that doesn't lead to at least 6 well-known
  // picks makes way for the next one (a row with none left disappears)
  async function fillBecause(pool, rows, anime) {
    const shown = new Set();
    for (const row of rows) {
      const sec = rowsEl.querySelector(`[data-row="${row}"]`);
      let done = false;
      while (pool.length && !done) {
        const item = pool.shift();
        try {
          const recs = await recsFor(item, anime, shown);
          if (recs.length < 6) continue;
          sec.querySelector(".row-head h2").textContent = `Because you liked ${Lang.title(item)}`;
          sec.querySelector(".movie-row").innerHTML = recs.slice(0, 20).map(Cards.tmdbCard).join("");
          recs.forEach((h) => shown.add(`${h.mediaType}-${h.tmdbId}`));
          done = true;
        } catch (e) {}
      }
      if (!done) sec.remove();
    }
  }

  function renderLive() {
    hero.innerHTML = '<div class="hero-slide active skeleton"></div>';
    // up to 6 of your titles to try for the two movie / show rows, 3 for the anime one
    const seeds = becauseSeeds(false, 6);
    const animeSeeds = becauseSeeds(true, 3);
    const movieRows = seeds.slice(0, 2).map((s, n) => ({ row: `because-${n}`, s }));
    const because = ({ row, s }) => rowShell(row, `Because you liked ${Lang.title(s)}`, "");
    // movies / shows: right before the anime rows; anime: under them (the last ones)
    rowsEl.innerHTML =
      top10Shell() +
      LIVE_ROWS.map((r) => (r.cat === "anime" ? movieRows.map(because).join("") : "") + rowShell(r.cat, r.title, `discover.html?cat=${r.cat}`)).join("") +
      (animeSeeds.length ? because({ row: "because-anime", s: animeSeeds[0] }) : "");
    fillTop10(top10Media);
    if (movieRows.length) fillBecause(seeds, movieRows.map((r) => r.row), false);
    if (animeSeeds.length) fillBecause(animeSeeds, ["because-anime"], true);

    LIVE_ROWS.forEach(async (r) => {
      const row = rowsEl.querySelector(`[data-row="${r.cat}"] .movie-row`);
      try {
        const results = await cachedList(r.cat);
        if (r.cat === "trending") {
          const slides = results.filter((h) => h.backdrop).slice(0, 6);
          if (slides.length) slideshow(slides.map((h, i) => trendingSlide(h, i + 1)));
          else slideshow(personalSlides());
        }
        row.innerHTML = results.filter((h) => h.poster).map(Cards.tmdbCard).join("");
      } catch (e) {
        row.innerHTML = `<p class="muted" style="padding:20px">Couldn't load this row: ${esc(e.message)}</p>`;
        if (r.cat === "trending") slideshow(personalSlides());
      }
    });
  }

  /* ---------------- your own list ---------------- */

  const byRating = (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.order - b.order;

  function myRows(all) {
    const rows = [
      // the shows you're in the middle of (js/services/watch.js), the last one you watched first
      { title: "Continue watching", items: window.Watch ? Watch.continuing(all) : [], link: null },
      { title: "Up next on your watchlist", items: all.filter((i) => i.watchlist), link: "watchlist.html?list=watch" },
      { title: "Your favorites", items: all.filter((i) => i.favorite), link: "watchlist.html?list=fav" },
      // newest first: everything you added (imports too), in the order it came in
      { title: "Recently added", items: all.slice().sort((a, b) => b.order - a.order), link: null },
    ];
    if (!live) {
      rows.push(
        { title: "Your top rated movies", items: all.filter((i) => i.type === "movie" && i.rating != null).sort(byRating), link: "movies.html?sort=rating-desc" },
        { title: "Your top anime", items: all.filter((i) => i.type === "anime" && i.rating != null).sort(byRating), link: "anime.html?sort=rating-desc" },
        { title: "Your TV shows", items: all.filter((i) => i.type === "tv"), link: "tv-shows.html" }
      );
    }
    return rows.filter((r) => r.items.length);
  }

  function renderMine() {
    if (Store.guest) {
      mineEl.innerHTML = `<div class="mine-head"><h2 class="section-title">Your Movie Nights</h2></div>${UI.signInPrompt()}`;
      return;
    }
    const all = Store.all();
    // a brand-new library: how to get started, instead of a row of zeros
    if (!all.length) {
      mineEl.innerHTML = `<div class="mine-head"><h2 class="section-title">Your Movie Nights</h2></div>${UI.welcome()}`;
      return;
    }
    const rated = all.filter((i) => i.rating != null);
    const avg = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : 0;
    const count = (fn) => all.filter(fn).length;
    const tiles = [
      ["Movies", count((i) => i.type === "movie"), "movies.html"],
      ["TV Shows", count((i) => i.type === "tv"), "tv-shows.html"],
      ["Anime", count((i) => i.type === "anime"), "anime.html"],
      ["Favorites", count((i) => i.favorite), "watchlist.html?list=fav"],
      ["Watchlist", count((i) => i.watchlist), "watchlist.html"],
      ["My average", avg ? avg.toFixed(1) : "–", "profile.html"],
    ];

    // keep each row's horizontal scroll position when re-rendering
    const scroll = {};
    mineEl.querySelectorAll(".row-section").forEach((s) => (scroll[s.dataset.row] = s.querySelector(".movie-row").scrollLeft));

    mineEl.innerHTML = `
      <div class="mine-head">
        <h2 class="section-title">Your Movie Nights</h2>
        <button class="btn btn-primary random-pick" type="button"><i class="fa-solid fa-shuffle"></i> What should I watch?</button>
      </div>
      <div class="stat-strip">${tiles
        .map(([label, num, href]) => `<a class="stat-tile" href="${href}"><div class="num">${num}</div><div class="label">${label}</div></a>`)
        .join("")}</div>
      ${myRows(all)
        .map(
          (r) => `<section class="row-section" data-row="${esc(r.title)}">
            <div class="row-head"><h2>${esc(r.title)}</h2>${r.link ? `<a href="${r.link}">See all ${r.items.length} <i class="fa-solid fa-arrow-right"></i></a>` : ""}</div>
            <div class="movie-row">${r.items.slice(0, 20).map(Cards.card).join("")}</div>
          </section>`
        )
        .join("")}`;

    mineEl.querySelectorAll(".row-section").forEach((s) => {
      if (scroll[s.dataset.row]) s.querySelector(".movie-row").scrollLeft = scroll[s.dataset.row];
    });
  }

  // "What should I watch?" buttons open the picker (js/components/picker.js)

  Store.onChange(renderMine);

  // rows slide in as you scroll to them, their posters one after another. A row seen
  // once (by its name) stays put when the page redraws it, e.g. after you rate a title.
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("home-fx");
    const revealed = new Set();
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const sec = en.target;
          sec.classList.add("in");
          revealed.add(sec.dataset.row);
          // after the entrance, cards drawn again don't replay it
          setTimeout(() => sec.classList.add("shown"), 2500);
          io.unobserve(sec);
        }),
      { rootMargin: "0px 0px -60px 0px" }
    );
    const watch = (sec) => {
      if (sec.classList.contains("in")) return;
      if (revealed.has(sec.dataset.row)) sec.classList.add("in", "shown");
      else io.observe(sec);
    };
    const main = document.querySelector("main");
    main.querySelectorAll(".row-section").forEach(watch);
    new MutationObserver((muts) =>
      muts.forEach((m) =>
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches(".row-section")) watch(n);
          n.querySelectorAll(".row-section").forEach(watch);
        })
      )
    ).observe(main, { childList: true, subtree: true });
  }

  if (live) renderLive();
  else slideshow(personalSlides());
  renderMine();
})();
