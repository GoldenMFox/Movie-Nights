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
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) timer = setInterval(() => go(index + 1), 8000);
    };

    hero.querySelector(".prev").onclick = () => go(index - 1);
    hero.querySelector(".next").onclick = () => go(index + 1);
    dots.forEach((d, n) => (d.onclick = () => go(n)));
    hero.onmouseenter = () => clearInterval(timer);
    hero.onmouseleave = restart;
    restart();
  }

  function shorten(text, max) {
    if (!text || text.length <= max) return text || "";
    return text.slice(0, text.lastIndexOf(" ", max)) + "…";
  }

  // one trending title as a slide (buttons work through js/cards.js)
  function trendingSlide(hit, rank) {
    const lib = Cards.inLibrary(hit);
    const tmdbKey = `${hit.mediaType}-${hit.tmdbId}`;
    Cards.tmdbCard(hit); // registers it so the buttons below work
    const url = lib ? `title.html?id=${encodeURIComponent(lib.id)}` : `title.html?tmdb=${tmdbKey}`;
    const kicker = [`#${rank} trending`, Store.TYPE_LABEL[hit.type], hit.year].filter(Boolean).join(" · ");
    const scores = [
      lib && lib.rating != null ? `<span class="hero-score mine"><i class="fa-solid fa-star"></i> ${Cards.formatRating(lib.rating)} <small>you</small></span>` : "",
      hit.score ? `<span class="hero-score"><span class="tmdb-tag">TMDB</span> ${hit.score.toFixed(1)}</span>` : "",
    ].join("");
    const buttons = lib
      ? `<button class="btn" data-action="trailer"><i class="fa-solid fa-play"></i> Trailer</button>
         <span class="hero-owned"><i class="fa-solid fa-check"></i> In your library</span>`
      : `<button class="btn" data-action="t-trailer"><i class="fa-solid fa-play"></i> Trailer</button>
         <button class="btn" data-action="t-watch"><i class="fa-regular fa-bookmark"></i> Watchlist</button>`;
    return {
      img: Store.img(hit.backdrop, "w1280"),
      attrs: lib ? ` data-id="${esc(lib.id)}"` : ` data-tmdb="${tmdbKey}"`,
      caption: `<span class="hero-kicker">${esc(kicker)}</span>
        <h2>${esc(Lang.title(hit))}</h2>
        ${scores ? `<div class="hero-scores">${scores}</div>` : ""}
        <p class="hero-overview">${esc(shorten(hit.overview, 190))}</p>
        <div class="hero-buttons"><a class="btn btn-primary" href="${url}"><i class="fa-solid fa-circle-info"></i> More info</a>${buttons}</div>`,
    };
  }

  function personalSlides() {
    const all = Store.all();
    const rated = all.filter((i) => i.rating != null).length;
    const caption = `<h2>Movie Nights: Your Cinematic Escape</h2>
      <p class="hero-overview">${all.length} titles, ${rated} rated, ${all.filter((i) => i.watchlist).length} waiting on the watchlist.</p>
      <div class="hero-buttons"><button class="btn btn-primary random-pick" type="button"><i class="fa-solid fa-shuffle"></i> What should I watch?</button></div>`;
    return ["/iDl0ZvK003PvOlcW4jEspntZ8hQ.jpg", "/6qiMjnqT3CFSOCwiBTHwnMwkR6I.jpg", "/wuI6zBnLI5EuqdKEMBMQrhIbvOA.jpg", "/8ykii0BhFxktfbS62fs7iFZxkCL.jpg"].map(
      (p) => ({ img: Store.img(p, "w1280"), caption })
    );
  }

  /* ---------------- live rows from TMDB ---------------- */

  const CACHE_MINUTES = 30;

  // lists are kept for 30 minutes, so going back to Home is instant
  async function cachedList(cat) {
    const key = `mn:home:${cat}:${Lang.get()}`;
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

  function rowShell(id, title, link) {
    return `<section class="row-section" data-row="${id}">
      <div class="row-head"><h2>${esc(title)}</h2>${link ? `<a href="${link}">See all <i class="fa-solid fa-arrow-right"></i></a>` : ""}</div>
      <div class="movie-row">${'<div class="movie-item skeleton"></div>'.repeat(8)}</div>
    </section>`;
  }

  function renderLive() {
    hero.innerHTML = '<div class="hero-slide active skeleton"></div>';
    rowsEl.innerHTML = LIVE_ROWS.map((r) => rowShell(r.cat, r.title, `discover.html?cat=${r.cat}`)).join("");

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
      { title: "Up next on your watchlist", items: all.filter((i) => i.watchlist), link: "watchlist.html" },
      { title: "Your favorites", items: all.filter((i) => i.favorite), link: "favorites.html" },
      { title: "Recently added", items: all.filter((i) => i.isNew).reverse(), link: null },
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
    const all = Store.all();
    const rated = all.filter((i) => i.rating != null);
    const avg = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : 0;
    const count = (fn) => all.filter(fn).length;
    const tiles = [
      ["Movies", count((i) => i.type === "movie"), "movies.html"],
      ["TV Shows", count((i) => i.type === "tv"), "tv-shows.html"],
      ["Anime", count((i) => i.type === "anime"), "anime.html"],
      ["Favorites", count((i) => i.favorite), "favorites.html"],
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

  // random pick: something from the watchlist, otherwise a highly rated title
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".random-pick")) return;
    const all = Store.all();
    let pool = all.filter((i) => i.watchlist);
    if (!pool.length) pool = all.filter((i) => i.rating >= 9);
    if (!pool.length) pool = all;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) location.href = `title.html?id=${encodeURIComponent(pick.id)}`;
  });

  Store.onChange(renderMine);

  if (live) renderLive();
  else slideshow(personalSlides());
  renderMine();
})();
