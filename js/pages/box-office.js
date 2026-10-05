/*
 * Box Office (box-office.html): the highest-grossing films worldwide, from TMDB (its "revenue"
 * and "budget", in US dollars, not adjusted for inflation; TMDB has no weekend numbers).
 *   - All time / this year / last year, or any year, and any genre (genre chips); kept in the
 *     address: box-office.html?year=2025&genre=Horror
 *   - the podium: the top 3, the big backdrop turning between them (point at one, or tap it)
 *   - four numbers about the chart (they count up as they come into view)
 *   - Budget vs box office: every film as a dot on a map of the two, over the verdict zones
 *   - the chart: sort by gross / budget / return / profit (the rows glide to their new
 *     places), tap a row for its details (profit, what every $1 made, the trailer); 20 at a time
 *   - Your box office: the same numbers for the films you've watched
 *   The verdict is the X-Ray's (title page): 5× Blockbuster, 2× Hit, 1× Broke even, less: Flop.
 */
(function () {
  const app = document.getElementById("bo-app");
  const { esc } = UI;
  const THIS_YEAR = new Date().getFullYear();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const money = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : n > 0 ? `$${Math.round(n).toLocaleString("en-US")}` : "–");
  const ratioOf = (f) => (f.budget > 0 && f.revenue > 0 ? f.revenue / f.budget : null);
  const verdictOf = (r) => (r == null ? null : r >= 5 ? ["Blockbuster", "gold"] : r >= 2 ? ["Hit", "green"] : r >= 1 ? ["Broke even", "grey"] : ["Flop", "red"]);
  const verdictHtml = (f) => {
    const r = ratioOf(f);
    const v = verdictOf(r);
    return v ? `<span class="xr-verdict ${v[1]}">${v[0]} · ${r.toFixed(1)}×</span>` : '<span class="xr-verdict grey">Budget unknown</span>';
  };
  const titleUrl = (f) => `title.html?tmdb=movie-${f.tmdbId}`;
  const posterOf = (f, size) => Store.poster(f.posterRu && Lang.isRu() ? f.posterRu : f.poster, size);

  if (!TMDB.enabled()) {
    app.innerHTML = `<div class="bo-empty"><i class="fa-solid fa-key"></i><p>The box office charts need a TMDB API key. The owner of the site adds one in the Admin Control Center.</p></div>`;
    return;
  }

  const params = new URLSearchParams(location.search);
  const GENRES = TMDB.genresFor("movie");
  const state = {
    year: /^\d{4}$/.test(params.get("year") || "") ? Number(params.get("year")) : null,
    genre: GENRES.includes(params.get("genre")) ? params.get("genre") : "",
    real: params.get("real") === "1", // adjusted for inflation
    sort: "gross",
    show: "all", // all | seen | unseen
    view: Store.read("mn:boView", "list") === "posters" ? "posters" : "list",
  };
  let films = [];
  let page = 1;
  let pages = 1;
  let run = 0; // (answers for a choice you've left are dropped)

  const scope = () => (state.year == null ? "all" : state.year === THIS_YEAR ? "this" : state.year === THIS_YEAR - 1 ? "last" : "year");
  const scopeLabel = () => (state.year == null ? "of all time" : `of ${state.year}`);

  const SORTS = {
    gross: { label: "Gross", icon: "fa-sack-dollar", by: (f) => f.revenue },
    budget: { label: "Budget", icon: "fa-coins", by: (f) => f.budget || -1 },
    return: { label: "Return", icon: "fa-rocket", by: (f) => ratioOf(f) || -1 },
    profit: { label: "Profit", icon: "fa-chart-line", by: (f) => (f.budget ? f.revenue - f.budget : -Infinity) },
  };

  app.innerHTML = `
    <div class="bo-controls">
      <div class="top10-switch bo-scope" role="group" aria-label="Which years">
        <button type="button" class="top10-tab" data-scope="all"><i class="fa-solid fa-infinity"></i> All time</button>
        <button type="button" class="top10-tab" data-scope="this">${THIS_YEAR}</button>
        <button type="button" class="top10-tab" data-scope="last">${THIS_YEAR - 1}</button>
      </div>
      <span class="glass-select">
        <i class="fa-regular fa-calendar" aria-hidden="true"></i>
        <select name="year" aria-label="Year">
          <option value="">Any year</option>
          ${Array.from({ length: THIS_YEAR - 1969 }, (_, n) => THIS_YEAR - n).map((y) => `<option value="${y}">${y}</option>`).join("")}
        </select>
      </span>
      <button type="button" class="bo-infl${state.real ? " on" : ""}" aria-pressed="${state.real}" aria-label="Adjusted for inflation" title="Adjusted for inflation: every amount on the page in today's dollars, the classics ranked with today's films">
        <i class="fa-solid fa-scale-balanced"></i> Inflation <i class="fa-solid fa-check bi-check" aria-hidden="true"></i>
      </button>
    </div>
    <div class="chips bo-genres" role="group" aria-label="Genre">
      <span class="chip-indicator" aria-hidden="true"></span>
      <button class="chip" type="button" data-genre="">All genres</button>
      ${GENRES.map((g) => `<button class="chip" type="button" data-genre="${esc(g)}">${esc(g)}</button>`).join("")}
    </div>
    <section class="bo-stage" aria-label="The top 3"></section>
    <div class="bo-stats"></div>
    <section class="bo-yours" hidden></section>
    <section class="bo-plot" hidden>
      <div class="bo-head">
        <h2 class="section-title"><i class="fa-solid fa-city"></i> What they cost vs what they made</h2>
        <p class="bo-sub">Each column is a film: as tall as what it made, the striped part at its foot what it cost. Point at one (or tap it) for its numbers.</p>
      </div>
      <div class="sk-controls"></div>
      <div class="bo-plot-wrap"></div>
    </section>
    <div class="bo-head bo-chart-head">
      <h2 class="section-title bo-chart-title"></h2>
      <!-- (phones: List / Posters as two icons beside the title, the sort below at full width) -->
      <div class="bo-head-tools">
        <div class="top10-switch bo-sort" role="group" aria-label="Sort the chart by">
          ${Object.entries(SORTS).map(([k, s]) => `<button type="button" class="top10-tab${k === state.sort ? " active" : ""}" data-sort="${k}"><i class="fa-solid ${s.icon}"></i> ${s.label}</button>`).join("")}
        </div>
        <div class="top10-switch bo-view" role="group" aria-label="View">
          <button type="button" class="top10-tab${state.view === "list" ? " active" : ""}" data-view="list" aria-label="List" title="List"><i class="fa-solid fa-list"></i><span class="bo-view-label"> List</span></button>
          <button type="button" class="top10-tab${state.view === "posters" ? " active" : ""}" data-view="posters" aria-label="Posters" title="Posters"><i class="fa-solid fa-table-cells"></i><span class="bo-view-label"> Posters</span></button>
        </div>
      </div>
    </div>
    ${
      Store.guest
        ? ""
        : `<div class="bo-tools">
      <div class="top10-switch bo-show" role="group" aria-label="Which films">
        <button type="button" class="top10-tab active" data-show="all">All <small></small></button>
        <button type="button" class="top10-tab" data-show="seen"><i class="fa-solid fa-check"></i> Watched <small></small></button>
        <button type="button" class="top10-tab" data-show="unseen"><i class="fa-regular fa-eye-slash"></i> Not seen yet <small></small></button>
      </div>
    </div>`
    }
    <ol class="bo-chart"></ol>
    <div class="bo-more"></div>
    <p class="bo-note"><i class="fa-solid fa-circle-info"></i> Worldwide gross and budgets from TMDB, in US dollars. "Adjusted for inflation" turns them into this year's dollars with US inflation (the CPI; this year's figure is an estimate until it's published), counting a film at its release year's prices, so classics that were re-released come out a little high. The verdict compares the gross with the budget (5× Blockbuster, 2× Hit, 1× Broke even, less: Flop); profit is before the cinemas' share and marketing. TMDB has no weekend or daily numbers.</p>`;

  const $ = (s) => app.querySelector(s);

  /* ---------------- choosing ---------------- */

  function moveChip() {
    const ind = $(".bo-genres .chip-indicator");
    const on = $(".bo-genres .chip.active");
    if (!on) return;
    ind.style.left = `${on.offsetLeft}px`;
    ind.style.top = `${on.offsetTop}px`;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.height = `${on.offsetHeight}px`;
  }

  function paintControls() {
    app.querySelectorAll("[data-scope]").forEach((b) => b.classList.toggle("active", b.dataset.scope === scope()));
    $('[name="year"]').value = state.year == null ? "" : String(state.year);
    app.querySelectorAll("[data-genre]").forEach((b) => b.classList.toggle("active", b.dataset.genre === state.genre));
    moveChip();
    // (the picked genre scrolled into view on narrow screens)
    const on = $(".bo-genres .chip.active");
    const row = $(".bo-genres");
    if (on && row.scrollWidth > row.clientWidth) row.scrollTo({ left: on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2, behavior: still ? "auto" : "smooth" });
  }

  function setAddress() {
    const q = new URLSearchParams();
    if (state.year != null) q.set("year", state.year);
    if (state.genre) q.set("genre", state.genre);
    if (state.real) q.set("real", "1");
    history.replaceState(null, "", `box-office.html${q.toString() ? `?${q}` : ""}`);
  }

  /* ---------------- adjusted for inflation ----------------
     "Adjusted for inflation" turns every amount into this year's dollars with the US consumer
     price index (CPI-U, yearly averages, 1982-84 = 100; the current year estimated until its
     official average is out). A film's gross is counted
     at its release year's prices (re-releases were later, so old films with many come out a
     little high). For all time, the classics join the chart too: the biggest films from before
     1990 and from 1990-2004 are fetched as well, then all ranked in today's money. */
  const CPI = {
    1913: 9.9, 1914: 10, 1915: 10.1, 1916: 10.9, 1917: 12.8, 1918: 15.1, 1919: 17.3, 1920: 20, 1921: 17.9, 1922: 16.8, 1923: 17.1, 1924: 17.1,
    1925: 17.5, 1926: 17.7, 1927: 17.4, 1928: 17.1, 1929: 17.1, 1930: 16.7, 1931: 15.2, 1932: 13.7, 1933: 13, 1934: 13.4, 1935: 13.7, 1936: 13.9,
    1937: 14.4, 1938: 14.1, 1939: 13.9, 1940: 14, 1941: 14.7, 1942: 16.3, 1943: 17.3, 1944: 17.6, 1945: 18, 1946: 19.5, 1947: 22.3, 1948: 24.1,
    1949: 23.8, 1950: 24.1, 1951: 26, 1952: 26.5, 1953: 26.7, 1954: 26.9, 1955: 26.8, 1956: 27.2, 1957: 28.1, 1958: 28.9, 1959: 29.1, 1960: 29.6,
    1961: 29.9, 1962: 30.2, 1963: 30.6, 1964: 31, 1965: 31.5, 1966: 32.4, 1967: 33.4, 1968: 34.8, 1969: 36.7, 1970: 38.8, 1971: 40.5, 1972: 41.8,
    1973: 44.4, 1974: 49.3, 1975: 53.8, 1976: 56.9, 1977: 60.6, 1978: 65.2, 1979: 72.6, 1980: 82.4, 1981: 90.9, 1982: 96.5, 1983: 99.6, 1984: 103.9,
    1985: 107.6, 1986: 109.6, 1987: 113.6, 1988: 118.3, 1989: 124, 1990: 130.7, 1991: 136.2, 1992: 140.3, 1993: 144.5, 1994: 148.2, 1995: 152.4,
    1996: 156.9, 1997: 160.5, 1998: 163, 1999: 166.6, 2000: 172.2, 2001: 177.1, 2002: 179.9, 2003: 184, 2004: 188.9, 2005: 195.3, 2006: 201.6,
    2007: 207.3, 2008: 215.3, 2009: 214.5, 2010: 218.1, 2011: 224.9, 2012: 229.6, 2013: 233, 2014: 236.7, 2015: 237, 2016: 240, 2017: 245.1,
    2018: 251.1, 2019: 255.7, 2020: 258.8, 2021: 271, 2022: 292.7, 2023: 304.7, 2024: 313.7, 2025: 322.2,
    // (estimated: 2025 + about 2.8%, until the year's official average is out)
    2026: 331.2,
  };
  const CPI_ESTIMATED = [2026];
  // today's money: this year's dollars (or the latest year in the table)
  const CPI_BASE_YEAR = CPI[THIS_YEAR] ? THIS_YEAR : Math.max(...Object.keys(CPI).map(Number));
  // how many of today's dollars one dollar of that year is worth
  const inflation = (year) => {
    const y = Math.max(1913, Math.min(CPI_BASE_YEAR, Number(year) || CPI_BASE_YEAR));
    return CPI[CPI_BASE_YEAR] / CPI[y];
  };
  // a film in today's dollars (its original amounts kept, for the details)
  const adjust = (f) => {
    const k = inflation(f.year);
    return Object.assign({}, f, { revenue: f.revenue * k, budget: f.budget * k, nominal: { revenue: f.revenue, budget: f.budget, k } });
  };

  // one page (20) of the chart: TMDB's, or (adjusted for inflation) of the pool ranked in today's dollars
  const pools = new Map(); // "genre|year" -> Promise of the adjusted, ranked films
  function realPool() {
    const key = `${state.genre}|${state.year || ""}`;
    if (!pools.has(key)) {
      const q = { genre: state.genre };
      // one year: the same order, only in today's money; all time: the classics join in
      const asks =
        state.year != null
          ? [1, 2, 3].map((p) => ({ ...q, year: state.year, page: p }))
          : [
              ...[1, 2, 3].map((p) => ({ ...q, page: p })),
              ...[1, 2].map((p) => ({ ...q, before: "1989-12-31", page: p })),
              { ...q, after: "1990-01-01", before: "2004-12-31", page: 1 },
            ];
      pools.set(
        key,
        Promise.all(asks.map((a) => TMDB.boxOffice(a).catch(() => ({ results: [] })))).then((pages) => {
          const seen = new Set();
          return pages
            .flatMap((p) => p.results)
            // (not a film dated before cinemas had box offices: a wrong date on TMDB, e.g. "1886")
            .filter((f) => f.year >= 1915 && !seen.has(f.tmdbId) && seen.add(f.tmdbId))
            .map(adjust)
            .sort((a, b) => b.revenue - a.revenue);
        })
      );
      pools.get(key).catch(() => pools.delete(key));
    }
    return pools.get(key);
  }
  // (the skyline's franchises, directors, studios and years: in today's dollars too when it's on)
  const inToday = (list) => (state.real ? list.map(adjust) : list);
  async function getPage(p) {
    if (!state.real) return TMDB.boxOffice({ year: state.year, genre: state.genre, page: p });
    const pool = await realPool();
    return { results: pool.slice((p - 1) * 20, p * 20), totalPages: Math.max(1, Math.ceil(pool.length / 20)) };
  }

  /* ---------------- counting up (the big numbers, as they come into view) ---------------- */

  const fmt = { money, x: (n) => `${n.toFixed(1)}×` };
  function countUp(el) {
    const to = Number(el.dataset.count);
    const f = fmt[el.dataset.fmt || "money"];
    if (still || !to) return (el.textContent = f(to));
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1200);
      el.textContent = f(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const counter =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              counter.unobserve(en.target);
              countUp(en.target);
            }),
          { threshold: 0.4 }
        )
      : null;
  const watchCounts = (root) => root.querySelectorAll("[data-count]").forEach((el) => (counter ? counter.observe(el) : countUp(el)));

  // rows / cards come in as you scroll to them
  const revealer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              revealer.unobserve(en.target);
              en.target.classList.add("in");
            }),
          { rootMargin: "0px 0px -40px 0px" }
        )
      : null;
  const reveal = (els) => els.forEach((el) => (revealer ? revealer.observe(el) : el.classList.add("in")));

  /* ---------------- the podium: the top 3 ---------------- */

  const ROTATE = 7000;
  let stageAt = 0;
  let stageTimer = null;
  let stageHold = false;

  function stageHtml(top) {
    const medal = ["gold", "silver", "bronze"];
    // (2nd, 1st, 3rd: a podium)
    const order = [1, 0, 2].filter((i) => top[i]);
    return `
      <div class="bo-bg"></div><div class="bo-bg"></div>
      <div class="bo-shade"></div>
      <div class="bo-stage-info" aria-live="polite"></div>
      <div class="bo-podium">${order
        .map(
          (i) => `<a class="bo-pod ${medal[i]}" href="${titleUrl(top[i])}" data-pod="${i}">
            <span class="bo-pod-poster"><img src="${posterOf(top[i], "w342")}" alt="" /></span>
            <span class="bo-pod-step">
              <span class="bo-medal">${i + 1}</span>
              <b>${money(top[i].revenue)}</b>
              <span class="bo-pod-time"></span>
            </span>
          </a>`
        )
        .join("")}</div>`;
  }

  function stageInfo(f, i) {
    const r = ratioOf(f);
    return `<div class="bo-stage-text">
        <span class="bo-top-rank"><i class="fa-solid fa-crown"></i> #${i + 1} ${esc(scopeLabel())}${state.genre ? ` · ${esc(state.genre)}` : ""}</span>
        <a class="bo-top-title" href="${titleUrl(f)}">${esc(Lang.title(f))} <small>${f.year || ""}</small></a>
        <span class="bo-top-gross"><b data-count="${f.revenue}">${money(f.revenue)}</b> worldwide</span>
        <span class="bo-top-meta"><span>${f.budget ? `Made for ${money(f.budget)}` : "Budget unknown"}</span>${r ? verdictHtml(f) : ""}</span>
        ${f.nominal ? `<span class="bo-top-then"><i class="fa-solid fa-clock-rotate-left"></i> ${money(f.nominal.revenue)} at the time (${f.year}) · in ${CPI_BASE_YEAR} dollars</span>` : ""}
      </div>`;
  }

  function showStage(i) {
    const top = films.slice(0, 3);
    if (!top[i]) return;
    stageAt = i;
    const stage = $(".bo-stage");
    // the backdrop: cross-fade to the other layer
    const [a, b] = stage.querySelectorAll(".bo-bg");
    const next = a.classList.contains("on") ? b : a;
    const prev = next === a ? b : a;
    next.style.backgroundImage = top[i].backdrop ? `url('${Store.img(top[i].backdrop, "w1280")}')` : "";
    next.classList.remove("on");
    void next.offsetWidth; // (restart its slow zoom)
    next.classList.add("on");
    prev.classList.remove("on");
    stage.querySelector(".bo-stage-info").innerHTML = stageInfo(top[i], i);
    countUp(stage.querySelector(".bo-top-gross b"));
    stage.querySelectorAll(".bo-pod").forEach((p) => {
      p.classList.toggle("on", Number(p.dataset.pod) === i);
      const bar = p.querySelector(".bo-pod-time");
      bar.style.animation = "none";
      void bar.offsetWidth;
      bar.style.animation = "";
    });
    stage.classList.toggle("hold", stageHold);
    schedule();
  }

  function schedule() {
    clearTimeout(stageTimer);
    const n = Math.min(3, films.length);
    if (still || stageHold || n < 2) return;
    stageTimer = setTimeout(() => showStage((stageAt + 1) % n), ROTATE);
  }

  function hold(on) {
    stageHold = on;
    $(".bo-stage").classList.toggle("hold", on);
    schedule();
  }

  /* ---------------- four numbers ---------------- */

  function statsHtml(list) {
    const total = list.reduce((s, f) => s + f.revenue, 0);
    const withBudget = list.filter((f) => ratioOf(f));
    const best = withBudget.slice().sort((a, b) => ratioOf(b) - ratioOf(a))[0];
    const priciest = list.filter((f) => f.budget).sort((a, b) => b.budget - a.budget)[0];
    const ratios = withBudget.map(ratioOf).sort((a, b) => a - b);
    const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
    const tile = (cls, icon, label, count, f, sub, film) =>
      `<${film ? `a href="${titleUrl(film)}"` : "div"} class="xr-card bo-stat ${cls}">
        ${film && film.backdrop ? `<span class="bo-stat-bg" style="background-image:url('${Store.img(film.backdrop, "w780")}')"></span>` : ""}
        <span class="xr-label"><i class="${icon}"></i> ${label}</span>
        <b data-count="${count}" data-fmt="${f}">${fmt[f](count)}</b><small>${sub}</small>
      </${film ? "a" : "div"}>`;
    return [
      tile("s-total", "fa-solid fa-sack-dollar", `The top ${list.length} together`, total, "money", `worldwide, ${scopeLabel()}${state.real ? ` in ${CPI_BASE_YEAR} dollars` : ""}`),
      median ? tile("s-median", "fa-solid fa-scale-balanced", "Typical return", median, "x", "their budget, for the film in the middle") : "",
      best ? tile("s-best", "fa-solid fa-rocket", "Best return", ratioOf(best), "x", `${esc(Lang.title(best))}: ${money(best.budget)} → ${money(best.revenue)}`, best) : "",
      priciest ? tile("s-price", "fa-solid fa-coins", "Most expensive", priciest.budget, "money", `${esc(Lang.title(priciest))} (${priciest.year || "–"})`, priciest) : "",
    ].join("");
  }

  /* ---------------- what they cost vs what they made: the poster skyline ----------------
     Films as columns made of their posters: a column's height is what the film made worldwide,
     the striped band at its foot what it cost. The readout above tells the film you point at.
     Which films: the chart above (the page's year / genre), a franchise, a director, a studio
     (their films in release order, or a studio's biggest), the #1 of each of the last 20 years,
     or the biggest films you've watched. */

  const SKY = 20;
  let skyFilms = [];
  let skyOpts = {};
  const sky = { mode: "chart", pick: {} }; // pick: the franchise / director / studio picked, by mode
  let skyRun = 0;
  let mineFilms = null; // (the films you've watched, once Your box office has added them up)

  const FRANCHISES = [
    [1241, "Harry Potter"], [10, "Star Wars"], [86311, "The Avengers"], [328, "Jurassic Park"], [9485, "Fast & Furious"], [645, "James Bond"],
    [119, "The Lord of the Rings"], [87096, "Avatar"], [295, "Pirates of the Caribbean"], [10194, "Toy Story"], [87359, "Mission: Impossible"], [263, "The Dark Knight"],
    [531241, "Spider-Man (MCU)"], [86066, "Despicable Me"], [2150, "Shrek"], [131635, "The Hunger Games"], [8650, "Transformers"], [404609, "John Wick"], [33514, "Twilight"],
  ];
  const DIRECTORS = [
    [525, "Christopher Nolan"], [488, "Steven Spielberg"], [2710, "James Cameron"], [137427, "Denis Villeneuve"], [138, "Quentin Tarantino"], [19271, "Anthony Russo"],
    [45400, "Greta Gerwig"], [108, "Peter Jackson"], [1032, "Martin Scorsese"], [578, "Ridley Scott"], [7467, "David Fincher"], [510, "Tim Burton"], [865, "Michael Bay"], [15217, "Zack Snyder"],
  ];
  const STUDIOS = [
    [420, "Marvel Studios"], [3, "Pixar"], [2, "Walt Disney Pictures"], [174, "Warner Bros."], [33, "Universal"], [1, "Lucasfilm"], [4, "Paramount"], [5, "Columbia (Sony)"],
    [25, "20th Century"], [6704, "Illumination"], [521, "DreamWorks Animation"], [923, "Legendary"], [128064, "DC"], [1632, "Lionsgate"], [3172, "Blumhouse"], [41077, "A24"], [10342, "Studio Ghibli"],
  ];
  const SKY_MODES = {
    chart: { label: "This chart", icon: "fa-ranking-star" },
    franchise: { label: "Franchises", icon: "fa-layer-group", picks: FRANCHISES, search: "Find a franchise…" },
    director: { label: "Directors", icon: "fa-clapperboard", picks: DIRECTORS, search: "Find a director…" },
    studio: { label: "Studios", icon: "fa-building", picks: STUDIOS },
    years: { label: "Year by year", icon: "fa-calendar-days" },
    mine: { label: "Your films", icon: "fa-ticket" },
  };

  function skyControlsHtml() {
    return `<div class="top10-switch sk-modes" role="group" aria-label="Which films to compare">${Object.entries(SKY_MODES)
      .map(([k, m]) => `<button type="button" class="top10-tab${k === sky.mode ? " active" : ""}" data-sky-mode="${k}"${k === "mine" && !(mineFilms && mineFilms.length > 2) ? " hidden" : ""}><i class="fa-solid ${m.icon}"></i> ${m.label}</button>`)
      .join("")}</div>
      <div class="sk-picks"></div>`;
  }

  function paintPicks() {
    const m = SKY_MODES[sky.mode];
    const box = $(".sk-picks");
    if (!m.picks) return (box.innerHTML = "");
    const on = sky.pick[sky.mode] || m.picks[0][0];
    const extra = (sky.found || []).filter((f) => f.mode === sky.mode);
    box.innerHTML = `
      ${m.search ? `<label class="sk-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="${m.search}" aria-label="${m.search.replace("…", "")}" autocomplete="off" /></label>` : ""}
      <div class="chips sk-chips">${extra
        .concat(m.picks.map(([id, name]) => ({ id, name })))
        .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i)
        .map((p) => `<button type="button" class="chip${String(p.id) === String(on) ? " active" : ""}" data-sky-pick="${p.id}">${esc(p.name)}</button>`)
        .join("")}</div>`;
  }

  function readoutHtml(f, n) {
    const r = ratioOf(f);
    const v = verdictOf(r) || ["Budget unknown", "grey"];
    const tag =
      skyOpts.what === "year" ? `The biggest film of ${f.year || ""}` : skyOpts.axis === "year" ? `${f.year || ""} · film ${n + 1} of ${skyFilms.length}` : `#${n + 1} · ${f.year || ""}`;
    return `<div class="sk-read-in ${v[1]}">
        <img src="${posterOf(f, "w185")}" alt="" />
        <div class="sk-read-text">
          <small>${esc(tag)}</small>
          <strong>${esc(Lang.title(f))}</strong>
          <span class="sk-flow">
            <span><em>Cost</em><b>${f.budget ? money(f.budget) : "?"}</b></span>
            <i class="fa-solid fa-arrow-right-long"></i>
            <span><em>Made</em><b>${money(f.revenue)}</b></span>
            ${f.budget ? `<span class="sk-net"><em>${f.revenue >= f.budget ? "Profit" : "Loss"}</em><b>${f.revenue >= f.budget ? "+" : "−"}${money(Math.abs(f.revenue - f.budget))}</b></span>` : ""}
          </span>
        </div>
        <div class="sk-mult"><b>${r ? `${r.toFixed(1)}×` : "?"}</b><small>${v[0]}</small></div>
      </div>`;
  }

  // (opts.axis: "rank" (1, 2, 3…) or "year" (under each column, in release order); opts.what: "year" for each year's #1)
  function plotHtml(list, opts = {}) {
    skyOpts = opts;
    skyFilms = list.filter((f) => f.revenue > 0).slice(0, SKY);
    if (skyFilms.length < 2) return "";
    const top = Math.max(...skyFilms.map((f) => Math.max(f.revenue, f.budget || 0)));
    const lines = [0.25, 0.5, 0.75, 1].map((p) => top * p);
    const first = opts.axis === "year" ? skyFilms.indexOf(skyFilms.slice().sort((a, b) => b.revenue - a.revenue)[0]) : 0;
    return `
      <div class="sk-read" aria-live="polite" data-n="${first}">${readoutHtml(skyFilms[first], first)}</div>
      <div class="sk-chart${skyFilms.length < 8 ? " few" : ""}">
        <div class="sk-cols" style="--n:${skyFilms.length}">
          <div class="sk-lines" aria-hidden="true">${lines.map((v) => `<span style="bottom:${((v / top) * 100).toFixed(2)}%"><em>${money(v)}</em></span>`).join("")}</div>
${skyFilms
          .map((f, n) => {
            const r = ratioOf(f);
            const v = verdictOf(r) || ["", "grey"];
            const h = (f.revenue / top) * 100;
            return `<a class="sk-col ${v[1]}${n === first ? " on" : ""}${h < 16 ? " low" : ""}" href="${titleUrl(f)}" data-sk="${n}" style="--h:${((f.revenue / top) * 100).toFixed(2)}%;--b:${f.budget ? Math.min(100, (f.budget / f.revenue) * 100).toFixed(2) : 0}%;--d:${n * 55}ms"
                aria-label="${esc(Lang.title(f))}: ${f.budget ? `cost ${money(f.budget)}, ` : ""}made ${money(f.revenue)}">
              <span class="sk-bar">
                <span class="sk-poster" style="background-image:url('${posterOf(f, "w342")}')"></span>
                <span class="sk-budget"></span>
              </span>
              <span class="sk-tag">${r ? `${r.toFixed(1)}×` : "?"}</span>
              <span class="sk-rank">${opts.axis === "year" ? f.year || "" : n + 1}</span>
            </a>`;
          })
          .join("")}</div>
      </div>
      <div class="sk-legend">
        <span><i class="sk-key made"></i> Height: what it made worldwide</span>
        <span><i class="sk-key cost"></i> Striped: what it cost</span>
        <span class="sk-verdicts"><span class="xr-verdict gold">5×+ Blockbuster</span><span class="xr-verdict green">2×+ Hit</span><span class="xr-verdict grey">Broke even</span><span class="xr-verdict red">Flop</span></span>
      </div>`;
  }

  function skyShow(n) {
    const f = skyFilms[n];
    if (!f) return;
    const read = $(".sk-read");
    if (!read || read.dataset.n === String(n)) return;
    read.dataset.n = n;
    read.innerHTML = readoutHtml(f, n);
    app.querySelectorAll(".sk-col").forEach((c) => c.classList.toggle("on", c.dataset.sk === String(n)));
  }

  function showSky(html, empty) {
    const wrap = $(".bo-plot-wrap");
    wrap.innerHTML = html || `<p class="sk-empty"><i class="fa-regular fa-face-meh"></i> ${empty || "Not enough box office numbers to compare here."}</p>`;
    const chart = wrap.querySelector(".sk-chart");
    if (!chart) return;
    // (a skyline wider than the screen: open it on the film the readout shows)
    const on = chart.querySelector(".sk-col.on");
    if (on && chart.scrollWidth > chart.clientWidth) chart.scrollLeft = on.offsetLeft - chart.clientWidth / 2 + on.offsetWidth / 2;
    // (the edge fades: only where there's more to scroll)
    const edges = () => {
      chart.classList.toggle("at-start", chart.scrollLeft < 4);
      chart.classList.toggle("at-end", chart.scrollLeft + chart.clientWidth >= chart.scrollWidth - 4);
    };
    chart.addEventListener("scroll", edges, { passive: true });
    edges();
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (chart.classList.add("in"), io.disconnect()), { threshold: 0.2 });
      io.observe(chart);
    } else chart.classList.add("in");
  }

  const skyLoading = (text) =>
    `<div class="sk-loading"><div class="sk-skel">${Array.from({ length: 14 }, (_, n) => `<span style="--h:${30 + ((n * 37) % 60)}%"></span>`).join("")}</div><p>${text || "Loading…"}</p></div>`;

  // the films for the picked comparison
  async function paintPlot() {
    const me = ++skyRun;
    $(".bo-plot").hidden = sky.mode === "chart" && !films.length;
    app.querySelectorAll("[data-sky-mode]").forEach((b) => b.classList.toggle("active", b.dataset.skyMode === sky.mode));
    paintPicks();
    const m = SKY_MODES[sky.mode];
    const pickId = m.picks ? Number(sky.pick[sky.mode] || m.picks[0][0]) : null;
    try {
      if (sky.mode === "chart") return showSky(plotHtml(films.slice().sort((a, b) => b.revenue - a.revenue)));
      if (sky.mode === "mine") return showSky(plotHtml((mineFilms || []).slice().sort((a, b) => b.revenue - a.revenue)));
      $(".bo-plot-wrap").innerHTML = skyLoading();
      if (sky.mode === "franchise") {
        const r = await TMDB.franchiseBoxOffice(pickId);
        if (me !== skyRun) return;
        return showSky(plotHtml(inToday(r.results), { axis: "year", what: "film" }), `No box office numbers for ${esc(r.name)} yet.`);
      }
      if (sky.mode === "director") {
        const r = await TMDB.directorBoxOffice(pickId);
        if (me !== skyRun) return;
        return showSky(plotHtml(inToday(r.results), { axis: "year", what: "film" }), `No box office numbers for ${esc(r.name)}'s films yet.`);
      }
      if (sky.mode === "studio") {
        const r = await TMDB.boxOffice({ company: pickId });
        if (me !== skyRun) return;
        return showSky(plotHtml(inToday(r.results)));
      }
      if (sky.mode === "years") {
        const years = Array.from({ length: SKY }, (_, n) => THIS_YEAR - SKY + 1 + n);
        const tops = new Array(years.length);
        let done = 0;
        let next = 0;
        await Promise.all(
          Array.from({ length: 4 }, async () => {
            while (next < years.length) {
              const i = next++;
              tops[i] = await TMDB.yearTop(years[i]).catch(() => null);
              done++;
              const p = me === skyRun && $(".sk-loading p");
              if (p) p.textContent = `Finding each year's #1… ${done} of ${years.length}`;
            }
          })
        );
        if (me !== skyRun) return;
        return showSky(plotHtml(inToday(tops.filter(Boolean)), { axis: "year", what: "year" }));
      }
    } catch (e) {
      if (me === skyRun) showSky("", `Couldn't load it right now (${esc(e.message)}).`);
    }
  }

  // franchise / director search
  let skyTyping;
  async function skySearch(input) {
    clearTimeout(skyTyping);
    const q = input.value.trim();
    const mode = sky.mode;
    if (q.length < 2) return;
    skyTyping = setTimeout(async () => {
      try {
        const found = mode === "franchise" ? await TMDB.searchCollections(q) : await TMDB.searchDirectors(q);
        if (mode !== sky.mode || input.value.trim() !== q) return;
        const chips = $(".sk-chips");
        chips.querySelectorAll(".sk-hit").forEach((c) => c.remove());
        chips.insertAdjacentHTML(
          "afterbegin",
          found.length
            ? found.map((f) => `<button type="button" class="chip sk-hit" data-sky-pick="${f.id}" data-name="${esc(f.name)}"><i class="fa-solid fa-magnifying-glass"></i> ${esc(f.name)}</button>`).join("")
            : `<span class="chip sk-hit sk-none">Nothing found for "${esc(q)}"</span>`
        );
        chips.scrollLeft = 0;
      } catch (e) {}
    }, 350);
  }

  /* ---------------- the chart ----------------
     A list (a bar per film in its verdict's colour: the budget marked inside it, the profit
     under it; the film's backdrop slides in behind the row you point at; tap a row for its
     details) or a wall of posters. Quick buttons on each: Trailer, Watchlist, Watched (the
     site's own actions, js/components/cards.js). Show all, only what you've watched, or only
     what you haven't. */

  const libOf = (f) => {
    const lib = Cards.inLibrary(f);
    return { lib, seen: Store.isWatched(lib) };
  };

  function sorted() {
    const by = SORTS[state.sort].by;
    return films
      .filter((f) => state.show === "all" || (state.show === "seen") === libOf(f).seen)
      .sort((a, b) => by(b) - by(a) || b.revenue - a.revenue);
  }

  function mineHtml(f) {
    const { lib, seen } = libOf(f);
    if (!lib) return "";
    return `<span class="bo-mine${seen ? "" : " later"}" title="In your library">${
      seen ? `<i class="fa-solid fa-check"></i> Watched${lib.rating != null ? ` · <i class="fa-solid fa-star"></i> ${Cards.formatRating(lib.rating)}` : ""}` : '<i class="fa-solid fa-bookmark"></i> Watchlist'
    }</span>`;
  }

  // Trailer / Watchlist / Watched: data-action inside data-tmdb runs the site's own actions
  function actsHtml(f) {
    const { lib, seen } = libOf(f);
    Cards.tmdbCard(f); // (registers the film, so the actions know it)
    const b = (action, icon, label, on) =>
      `<button type="button" class="bo-act${on ? " on" : ""}" data-action="${action}" title="${label}" aria-label="${label}"><i class="${icon}"></i></button>`;
    return `<span class="bo-acts" data-tmdb="movie-${f.tmdbId}">
        ${b("t-trailer", "fa-solid fa-play", "Trailer")}
        ${seen ? "" : b("t-watch", lib ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark", lib ? "On your Watchlist" : "Add to Watchlist", !!lib)}
        ${b("t-watched", seen ? "fa-solid fa-circle-check" : "fa-regular fa-circle-check", seen ? "Watched (rate it)" : "Watched it", seen)}
      </span>`;
  }

  function rowHtml(f, n, top) {
    const r = ratioOf(f);
    const v = verdictOf(r) || ["", "none"];
    const w = Math.max(3, (f.revenue / top) * 100);
    const b = f.budget ? Math.min(100, (f.budget / f.revenue) * 100) : 0;
    const bg = f.backdrop ? ` style="--bg:url('${Store.img(f.backdrop, "w780")}')"` : "";
    return `<li class="bo-row v-${v[1]}${n < 3 ? ` medal m${n + 1}` : ""}" data-id="${f.tmdbId}">
        <div class="bo-line" role="button" tabindex="0" aria-expanded="false"${bg}>
          <span class="bo-rank${n < 3 ? ` top${n + 1}` : ""}">${n + 1}</span>
          <span class="bo-poster"><img src="${posterOf(f, "w185")}" alt="" loading="lazy" /></span>
          <div class="bo-main">
            <div class="bo-name">
              <strong>${esc(Lang.title(f))}</strong>
              <small>${f.year || ""}${f.genres && f.genres.length ? ` · ${esc(f.genres.slice(0, 2).join(", "))}` : ""}</small>
              ${mineHtml(f)}
            </div>
            <div class="bo-bar" style="--w:${w}%">
              <span class="bo-fill">${b ? `<span class="bo-budget" style="--b:${b}%"></span>` : ""}</span>
            </div>
            <div class="bo-barnote" style="--w:${w}%">
              <span>${f.budget ? `<i class="fa-solid fa-coins"></i> cost ${money(f.budget)}` : "cost unknown"}</span>
              ${f.budget ? `<span class="bo-pl">${f.revenue >= f.budget ? "+" : "−"}${money(Math.abs(f.revenue - f.budget))} ${f.revenue >= f.budget ? "profit" : "loss"}</span>` : ""}
            </div>
          </div>
          <div class="bo-nums">
            <b>${money(f.revenue)}</b>
            ${verdictHtml(f)}
          </div>
          ${actsHtml(f)}
          <i class="fa-solid fa-chevron-down bo-chev" aria-hidden="true"></i>
        </div>
        <div class="bo-detail"><div></div></div>
      </li>`;
  }

  // the poster wall: the rank as a medal, the gross and the verdict on the poster
  function tileHtml(f, n) {
    const r = ratioOf(f);
    const v = verdictOf(r) || ["Budget unknown", "none"];
    return `<li class="bo-row bo-tile v-${v[1]}${n < 3 ? ` medal m${n + 1}` : ""}" data-id="${f.tmdbId}">
        <a class="bo-tile-in" href="${titleUrl(f)}">
          <img src="${posterOf(f, "w342")}" alt="" loading="lazy" />
          <span class="bo-tile-rank">${n + 1}</span>
          ${mineHtml(f)}
          <span class="bo-tile-info">
            <strong>${esc(Lang.title(f))}</strong>
            <b>${money(f.revenue)}</b>
            <span class="bo-tile-meta"><span>${f.budget ? `cost ${money(f.budget)}` : "cost ?"}</span><span class="bo-tile-x">${r ? `${r.toFixed(1)}×` : ""}</span></span>
          </span>
        </a>
        ${actsHtml(f)}
      </li>`;
  }

  function detailHtml(f) {
    const r = ratioOf(f);
    const grossRank = films.slice().sort((a, b) => b.revenue - a.revenue).indexOf(f) + 1;
    const fact = (label, value, sub) => `<div class="bo-fact"><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ""}</div>`;
    return `<div class="bo-detail-in"${f.backdrop ? ` style="--bg:url('${Store.img(f.backdrop, "w780")}')"` : ""}>
        <div class="bo-facts">
          ${f.budget ? fact(f.revenue >= f.budget ? "Profit" : "Loss", `${f.revenue >= f.budget ? "" : "−"}${money(Math.abs(f.revenue - f.budget))}`, "gross minus budget") : fact("Budget", "Unknown", "TMDB doesn't have it")}
          ${r ? fact("Every $1 spent made", `$${r.toFixed(2)}`, verdictOf(r)[0]) : ""}
          ${fact("Rank by gross", `#${grossRank}`, esc(scopeLabel()))}
          ${f.nominal ? fact("At the time", money(f.nominal.revenue), `in ${f.year} dollars (×${f.nominal.k.toFixed(1)} today)`) : ""}
          ${f.score ? fact("TMDB rating", `${f.score.toFixed(1)}`, "out of 10") : ""}
        </div>
        ${f.overview ? `<p class="bo-overview">${esc(f.overview)}</p>` : ""}
        <div class="bo-actions">
          <button class="btn btn-primary bo-trailer" type="button" data-id="${f.tmdbId}"><i class="fa-solid fa-play"></i> Trailer</button>
          <a class="btn" href="${titleUrl(f)}"><i class="fa-solid fa-circle-info"></i> Open</a>
        </div>
      </div>`;
  }

  // the poster wall: how many posters a row holds (it depends on the screen)
  function posterCols() {
    const t = getComputedStyle($(".bo-chart")).gridTemplateColumns;
    return t && t !== "none" ? t.split(" ").length : 1;
  }
  // the poster wall shows whole rows only: at least 3 (the next page is loaded to fill them),
  // and the few left over wait for the next "Show more" (unless there's nothing more to load)
  function shownPosters(list) {
    const cols = posterCols();
    if (page >= pages || list.length <= cols) return list;
    return list.slice(0, Math.floor(list.length / cols) * cols);
  }
  let filling = false;
  async function fillRows() {
    // (not for "Watched": more pages rarely add films you've seen)
    if (filling || state.view !== "posters" || state.show === "seen") return;
    const me = run;
    filling = true;
    try {
      // (3 rows' worth, a few pages at most)
      for (let tries = 0; tries < 3 && page < pages && sorted().length < posterCols() * 3; tries++) {
        const res = await getPage(page + 1);
        if (me !== run) return;
        page++;
        const seen = new Set(films.map((f) => f.tmdbId));
        films = films.concat(res.results.filter((f) => !seen.has(f.tmdbId)));
      }
    } catch (e) {
    } finally {
      filling = false;
    }
    if (me === run && state.view === "posters") {
      const known = new Set([...app.querySelectorAll(".bo-row")].map((r) => r.dataset.id));
      paintChart(true);
      app.querySelectorAll(".bo-row").forEach((r) => known.has(r.dataset.id) && r.classList.add("in"));
    }
  }

  function paintChart(filled) {
    const chart = $(".bo-chart");
    const posters = state.view === "posters";
    chart.classList.toggle("posters", posters);
    const all = sorted();
    const list = posters ? shownPosters(all) : all;
    const top = films.length ? Math.max(...films.map((f) => f.revenue)) : 1;
    // (fewer than 3 rows: the next page is loaded, then the wall is drawn again)
    if (posters && !filled && state.show !== "seen" && all.length < posterCols() * 3 && page < pages) fillRows();
    const open = new Set([...chart.querySelectorAll(".bo-row.open")].map((r) => r.dataset.id));
    chart.innerHTML = list.length
      ? list.map((f, n) => (posters ? tileHtml(f, n) : rowHtml(f, n, top))).join("")
      : `<li class="bo-none">${state.show === "seen" ? "You haven't watched any of these yet." : "You've watched all of these!"}</li>`;
    if (!posters) open.forEach((id) => toggleRow(chart.querySelector(`.bo-row[data-id="${id}"]`), true));
    reveal([...chart.querySelectorAll(".bo-row")]);
    $(".bo-more").innerHTML =
      page < pages || list.length < all.length
        ? `<button class="btn bo-load" type="button"><i class="fa-solid fa-chevron-down"></i> ${posters ? "Show more" : "Show the next 20"}</button>`
        : "";
    paintShow();
  }
  // (the wall drawn again when the screen fits a different number of posters in a row)
  let wallCols = 0;
  window.addEventListener("resize", () => {
    if (state.view !== "posters" || !films.length) return;
    const cols = posterCols();
    if (cols === wallCols) return;
    wallCols = cols;
    const known = new Set([...app.querySelectorAll(".bo-row")].map((r) => r.dataset.id));
    paintChart();
    app.querySelectorAll(".bo-row").forEach((r) => known.has(r.dataset.id) && r.classList.add("in"));
  });

  // All / Watched / Not seen: with how many of each
  function paintShow() {
    const seen = films.filter((f) => libOf(f).seen).length;
    const counts = { all: films.length, seen, unseen: films.length - seen };
    app.querySelectorAll("[data-show]").forEach((b) => {
      b.classList.toggle("active", b.dataset.show === state.show);
      const c = b.querySelector("small");
      if (c) c.textContent = counts[b.dataset.show];
    });
  }

  // a new order: the rows (or posters) glide from where they were to where they go (FLIP)
  function resort() {
    const chart = $(".bo-chart");
    if (state.view === "posters") {
      const want = shownPosters(sorted()).map((f) => String(f.tmdbId)).sort().join();
      const have = [...chart.querySelectorAll(".bo-row")].map((r) => r.dataset.id).sort().join();
      if (want !== have) return paintChart();
    }
    const before = new Map([...chart.querySelectorAll(".bo-row")].map((r) => [r.dataset.id, r.getBoundingClientRect()]));
    const list = sorted();
    list.forEach((f, n) => {
      const row = chart.querySelector(`.bo-row[data-id="${f.tmdbId}"]`);
      if (!row) return;
      chart.appendChild(row);
      row.classList.toggle("medal", n < 3);
      ["m1", "m2", "m3"].forEach((m, i) => row.classList.toggle(m, n === i));
      const rank = row.querySelector(".bo-rank, .bo-tile-rank");
      rank.textContent = n + 1;
      if (rank.classList.contains("bo-rank")) rank.className = `bo-rank${n < 3 ? ` top${n + 1}` : ""}`;
    });
    if (still) return;
    chart.querySelectorAll(".bo-row").forEach((row) => {
      const was = before.get(row.dataset.id);
      if (!was) return;
      const now = row.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (!dx && !dy) return;
      row.classList.add("in");
      row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 550, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    });
  }

  function toggleRow(row, force) {
    if (!row || row.classList.contains("bo-tile")) return;
    const on = force != null ? force : !row.classList.contains("open");
    const f = films.find((x) => String(x.tmdbId) === row.dataset.id);
    if (on && f) row.querySelector(".bo-detail > div").innerHTML = detailHtml(f);
    row.classList.toggle("open", on);
    row.querySelector(".bo-line").setAttribute("aria-expanded", on);
  }

  // something added / watched / rated: the tags and buttons follow (the rows stay where they are)
  function refreshMine() {
    app.querySelectorAll(".bo-row[data-id]").forEach((row) => {
      const f = films.find((x) => String(x.tmdbId) === row.dataset.id);
      if (!f) return;
      const mine = row.querySelector(".bo-mine");
      const html = mineHtml(f);
      if (mine) mine.outerHTML = html || "";
      else if (html) (row.querySelector(".bo-name") || row.querySelector(".bo-tile-rank")).insertAdjacentHTML(row.classList.contains("bo-tile") ? "afterend" : "beforeend", html);
      const acts = row.querySelector(".bo-acts");
      if (acts) acts.outerHTML = actsHtml(f);
    });
    paintShow();
  }
  Store.onChange(() => films.length && refreshMine());

  /* ---------------- loading ---------------- */

  async function load() {
    const me = ++run;
    page = 1;
    paintControls();
    setAddress();
    clearTimeout(stageTimer);
    $(".bo-chart-title").textContent = `Highest-grossing ${state.genre ? `${state.genre.toLowerCase()} ` : ""}films ${scopeLabel()}`;
    $(".bo-chart-title").insertAdjacentHTML("beforeend", state.real ? ` <small class="bo-real-tag"><i class="fa-solid fa-scale-balanced"></i> in ${CPI_BASE_YEAR} dollars${CPI_ESTIMATED.includes(CPI_BASE_YEAR) ? " (estimated)" : ""}</small>` : "");
    $(".bo-stage").innerHTML = '<div class="bo-stage-skel"></div>';
    $(".bo-stage").classList.remove("ready");
    $(".bo-stats").innerHTML = '<div class="xr-card bo-stat skeleton"></div>'.repeat(4);
    $(".bo-chart").innerHTML = '<li class="bo-row skeleton"></li>'.repeat(6);
    $(".bo-more").innerHTML = "";
    try {
      const res = await getPage(1);
      if (me !== run) return;
      films = res.results;
      pages = res.totalPages;
      if (!films.length) {
        $(".bo-stage").innerHTML = "";
        $(".bo-stats").innerHTML = "";
        if (sky.mode === "chart") $(".bo-plot").hidden = true;
        $(".bo-chart").innerHTML = `<li class="bo-none">No box office numbers for ${state.genre ? `${esc(state.genre.toLowerCase())} films ` : "films "}${esc(scopeLabel())} yet.</li>`;
        return;
      }
      $(".bo-stage").innerHTML = stageHtml(films.slice(0, 3));
      requestAnimationFrame(() => $(".bo-stage").classList.add("ready"));
      stageHold = false;
      showStage(0);
      $(".bo-stats").innerHTML = statsHtml(films);
      watchCounts($(".bo-stats"));
      reveal([...app.querySelectorAll(".bo-stats .bo-stat")]);
      // (the skyline follows the chart only when it shows the chart; the others stay)
      if (sky.mode === "chart" || !$(".sk-col, .sk-empty, .sk-loading")) paintPlot();
      paintChart();
    } catch (e) {
      if (me !== run) return;
      $(".bo-stage").innerHTML = "";
      $(".bo-stats").innerHTML = "";
      $(".bo-chart").innerHTML = `<li class="bo-none">Couldn't load the box office right now (${esc(e.message)}).</li>`;
    }
  }

  async function loadMore(btn) {
    const me = run;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Loading…';
    try {
      const res = await getPage(page + 1);
      if (me !== run) return;
      page++;
      const seen = new Set(films.map((f) => f.tmdbId));
      films = films.concat(res.results.filter((f) => !seen.has(f.tmdbId)));
      const known = new Set([...app.querySelectorAll(".bo-row")].map((r) => r.dataset.id));
      paintChart();
      // (the ones already there don't come in again)
      app.querySelectorAll(".bo-row").forEach((r) => known.has(r.dataset.id) && r.classList.add("in"));
      if (sky.mode === "chart") paintPlot();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Try again";
    }
  }

  /* ---------------- what you do ---------------- */

  app.addEventListener("click", (e) => {
    const s = e.target.closest("[data-scope]");
    if (s) {
      state.year = { all: null, this: THIS_YEAR, last: THIS_YEAR - 1 }[s.dataset.scope];
      return load();
    }
    const g = e.target.closest("[data-genre]");
    if (g) {
      if (g.dataset.genre === state.genre) return;
      state.genre = g.dataset.genre;
      return load();
    }
    // the skyline: which films to compare, and which franchise / director / studio
    const sm = e.target.closest("[data-sky-mode]");
    if (sm) {
      if (sm.dataset.skyMode === sky.mode) return;
      sky.mode = sm.dataset.skyMode;
      return paintPlot();
    }
    const sp = e.target.closest("[data-sky-pick]");
    if (sp) {
      sky.pick[sky.mode] = sp.dataset.skyPick;
      // (one found by searching stays among the chips)
      if (sp.dataset.name) (sky.found = sky.found || []).unshift({ mode: sky.mode, id: Number(sp.dataset.skyPick), name: sp.dataset.name });
      return paintPlot();
    }
    const sh = e.target.closest("[data-show]");
    if (sh) {
      if (sh.dataset.show === state.show) return;
      state.show = sh.dataset.show;
      return paintChart();
    }
    const infl = e.target.closest(".bo-infl");
    if (infl) {
      state.real = !state.real;
      infl.classList.toggle("on", state.real);
      infl.setAttribute("aria-pressed", state.real);
      // (the whole page: the chart, the skyline's other comparisons, your box office)
      paintYours();
      if (sky.mode !== "chart") paintPlot();
      return load();
    }
    const vw = e.target.closest("[data-view]");
    if (vw) {
      if (vw.dataset.view === state.view) return;
      state.view = vw.dataset.view;
      Store.write("mn:boView", state.view);
      app.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b === vw));
      return paintChart();
    }
    // (a quick button on a row: the site's own action, js/components/cards.js)
    if (e.target.closest(".bo-acts")) return;
    const so = e.target.closest("[data-sort]");
    if (so) {
      if (so.dataset.sort === state.sort) return;
      state.sort = so.dataset.sort;
      app.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("active", b === so));
      return resort();
    }
    // the skyline: a tap on a column that isn't showing shows its numbers (the next tap opens it)
    const col = e.target.closest(".sk-col");
    if (col && !col.classList.contains("on") && e.pointerType !== "mouse") {
      e.preventDefault();
      return skyShow(Number(col.dataset.sk));
    }
    // the podium: a tap on one that isn't showing shows it (the next tap opens its page)
    const pod = e.target.closest(".bo-pod");
    if (pod && !pod.classList.contains("on")) {
      e.preventDefault();
      hold(true);
      return showStage(Number(pod.dataset.pod));
    }
    const tr = e.target.closest(".bo-trailer");
    if (tr) {
      const f = films.find((x) => String(x.tmdbId) === tr.dataset.id);
      const details = () => TMDB.detailsById("movie", f.tmdbId);
      return Cards.showTrailer(
        { title: Lang.title(f), year: f.year || "" },
        () => details().then((d) => d.trailer || null),
        () => details().then((d) => (d.videos || []).map((v) => v.key))
      );
    }
    const line = e.target.closest(".bo-line");
    if (line && !e.target.closest("a")) return toggleRow(line.closest(".bo-row"));
    const more = e.target.closest(".bo-load");
    if (more) loadMore(more);
  });
  app.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const line = e.target.closest(".bo-line");
    if (line) {
      e.preventDefault();
      toggleRow(line.closest(".bo-row"));
    }
  });
  app.addEventListener("input", (e) => e.target.closest(".sk-search") && skySearch(e.target));
  app.addEventListener("change", (e) => {
    if (e.target.name !== "year") return;
    state.year = e.target.value ? Number(e.target.value) : null;
    load();
  });
  // the podium: pointing at one shows it and stops the turning (until the pointer leaves)
  app.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const pod = e.target.closest(".bo-pod");
    if (pod && !pod.classList.contains("on")) showStage(Number(pod.dataset.pod));
    const col = e.target.closest(".sk-col");
    if (col) skyShow(Number(col.dataset.sk));
  });
  app.addEventListener(
    "mouseenter",
    (e) => e.target.classList && e.target.classList.contains("bo-stage") && hold(true),
    true
  );
  app.addEventListener(
    "mouseleave",
    (e) => e.target.classList && e.target.classList.contains("bo-stage") && hold(false),
    true
  );
  // (the keyboard: the column you move to)
  app.addEventListener("focusin", (e) => e.target.closest && e.target.closest(".sk-col") && skyShow(Number(e.target.closest(".sk-col").dataset.sk)));
  // (a hidden tab doesn't turn the podium)
  document.addEventListener("visibilitychange", () => (document.hidden ? clearTimeout(stageTimer) : schedule()));
  window.addEventListener("resize", moveChip);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveChip);

  /* ---------------- your box office: the films you've watched ---------------- */

  async function yours() {
    if (Store.guest || !window.Watch) return;
    const mine = Store.all().filter((i) => i.type === "movie" && Store.isWatched(i));
    if (mine.length < 3) return;
    const box = $(".bo-yours");
    box.hidden = false;
    const head = `<h2 class="section-title"><i class="fa-solid fa-ticket"></i> Your box office</h2>`;
    box.innerHTML = `${head}<div class="bo-progress"><span>Adding up the films you've watched… <b>0</b> of ${mine.length}</span><span class="bo-progress-bar"><i></i></span></div>`;
    const found = [];
    let done = 0;
    let next = 0;
    let last = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < mine.length) {
          const item = mine[next++];
          try {
            const ref = await Watch.refOf(item);
            if (ref && ref.startsWith("movie-")) {
              const id = Number(ref.split("-")[1]);
              const n = await TMDB.boxOfficeOf(id, item.released || (item.year ? `${item.year}-06-01` : ""));
              if (n.revenue > 0) found.push(Object.assign({ item, tmdbId: id }, n));
            }
          } catch (e) {}
          done++;
          if (Date.now() - last > 120) {
            last = Date.now();
            const b = box.querySelector(".bo-progress b");
            if (b) b.textContent = done;
            const bar = box.querySelector(".bo-progress-bar i");
            if (bar) bar.style.width = `${(done / mine.length) * 100}%`;
          }
        }
      })
    );
    if (found.length < 3) return (box.hidden = true);
    myFound = found;
    const mineBtn = app.querySelector('[data-sky-mode="mine"]');
    if (mineBtn) mineBtn.hidden = false;
    paintYours();
  }

  // the cards, in the films' own dollars or (adjusted for inflation) in today's: drawn again
  // when the switch changes, without adding everything up again
  let myFound = null; // [{ item, tmdbId, budget, revenue }]
  let yourTops = null; // each card's ranking: { kind: { icon, label, shown, list, value, bar, sub } }

  /* A card's top 10: a click on the card (not its poster: that opens the film, as before)
     opens a pop-up with the ten films of that ranking; each row opens its film */
  let topOverlay = null;
  function openTop(kind) {
    const t = yourTops && yourTops[kind];
    if (!t) return;
    if (!topOverlay) topOverlay = Cards.makeOverlay("by-top-modal", `<div class="byt-in"></div>`);
    const list = t.list.slice(0, 10);
    const max = t.bar ? Math.max(...list.map(t.bar)) || 1 : 0;
    topOverlay.querySelector(".byt-in").innerHTML = `
      <div class="byt-head by-${kind}">
        <span class="xr-label"><i class="${t.icon}"></i> Your top ${list.length}</span>
        <h3>${esc(t.label)}${state.real ? ` <small class="bo-real-tag"><i class="fa-solid fa-scale-balanced"></i> in ${CPI_BASE_YEAR} dollars</small>` : ""}</h3>
      </div>
      <ol class="byt-list by-${kind}">${list
        .map(
          (f, n) => `<li style="--d:${n * 40}ms">
            <a class="byt-row${f === t.shown ? " on" : ""}" href="title.html?id=${encodeURIComponent(f.item.id)}">
              <span class="byt-rank">${n + 1}</span>
              <img src="${Store.poster(f.item.poster, "w154")}" alt="" loading="lazy" />
              <span class="byt-text">
                <strong>${esc(Lang.title(f.item))} <small>${f.item.year || ""}</small></strong>
                <small>${esc(t.sub(f))}</small>
                ${t.bar ? `<span class="byt-bar"><i style="--w:${Math.max(3, (t.bar(f) / max) * 100).toFixed(1)}%"></i></span>` : ""}
              </span>
              <b class="byt-value${t.loss ? " loss" : ""}">${t.value(f)}</b>
            </a>
          </li>`
        )
        .join("")}</ol>`;
    Cards.openModal(topOverlay);
  }
  app.addEventListener("click", (e) => {
    const cardEl = e.target.closest(".by-card[data-top]");
    // the poster, or a click meant for a new tab: the film, as before
    if (!cardEl || e.target.closest(".by-poster") || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault();
    openTop(cardEl.dataset.top);
  });
  function paintYours() {
    if (!myFound) return;
    const box = $(".bo-yours");
    const head = `<h2 class="section-title"><i class="fa-solid fa-ticket"></i> Your box office${
      state.real ? ` <small class="bo-real-tag"><i class="fa-solid fa-scale-balanced"></i> in ${CPI_BASE_YEAR} dollars</small>` : ""
    }</h2>`;
    const found = state.real
      ? myFound.map((f) => {
          const k = inflation(f.item.year);
          return Object.assign({}, f, { revenue: f.revenue * k, budget: f.budget * k });
        })
      : myFound;
    // (the skyline's "Your films")
    mineFilms = found.map((f) => Object.assign({}, f.item, { tmdbId: f.tmdbId, budget: f.budget, revenue: f.revenue }));

    const total = found.reduce((s, f) => s + f.revenue, 0);
    const spent = found.reduce((s, f) => s + f.budget, 0);
    const byGross = found.slice().sort((a, b) => b.revenue - a.revenue);
    const flops = found.filter((f) => ratioOf(f) != null && ratioOf(f) < 1).sort((a, b) => b.budget - b.revenue - (a.budget - a.revenue));
    const rated = found.filter((f) => f.item.rating != null);
    const name = (f) => esc(Lang.title(f.item));
    const url = (f) => `title.html?id=${encodeURIComponent(f.item.id)}`;
    // each one about its film: the poster (tilted, straightening when you point at it), the
    // film blurred behind, its own colour, and a small picture of the number
    const avg = total / found.length;
    const stars = (r) => {
      const full = Math.round(r) / 2; // 0..5, halves
      return `<span class="by-stars" aria-label="${Cards.formatRating(r)} out of 10">${[1, 2, 3, 4, 5]
        .map((n) => `<i class="fa-solid ${full >= n ? "fa-star" : full >= n - 0.5 ? "fa-star-half-stroke" : "fa-star by-off"}"></i>`)
        .join("")}<b>${Cards.formatRating(r)}</b></span>`;
    };
    const meter = (pct, caption, cls) =>
      `<span class="by-meter ${cls || ""}"><span class="by-track"><i style="--w:${Math.max(3, Math.min(100, pct)).toFixed(1)}%"></i></span><small>${caption}</small></span>`;
    const card = (kind, icon, label, count, f, sub, extra, opts = {}) => {
      const poster = Store.poster(f.item.poster, "w342");
      return `<a class="xr-card bo-stat by-card by-${kind}" href="${url(f)}" data-top="${kind}" title="See your top 10">
          <span class="by-blur" style="background-image:url('${poster}')"></span>
          <img class="by-poster" src="${poster}" alt="" loading="lazy" />
          <span class="by-body">
            <span class="xr-label"><i class="${icon}"></i> ${label}</span>
            <b>${opts.minus ? "−" : ""}<span data-count="${count}" data-fmt="${opts.fmt || "money"}">${fmt[opts.fmt || "money"](count)}</span></b>
            <strong class="by-name">${name(f)} <small>${f.item.year || ""}</small></strong>
            ${sub ? `<small>${sub}</small>` : ""}
            ${extra || ""}
          </span>
        </a>`;
    };
    // (each card a different film: the first of its list not on another card yet)
    const used = new Set();
    const pick = (list) => {
      const f = list.find((x) => !used.has(x));
      if (f) used.add(f);
      return f;
    };
    const top = pick(byGross);
    const flop = pick(flops);
    const love = pick(rated.filter((f) => f.item.rating >= 8).sort((a, b) => b.revenue - a.revenue));
    // (a hidden gem made at least $1M: not a streaming film with a few dollars on TMDB)
    const hidden = pick(rated.filter((f) => f.item.rating >= 8 && f.revenue >= 1e6).sort((a, b) => a.revenue - b.revenue));
    const best = pick(found.filter((f) => ratioOf(f) != null && f.revenue >= 1e6).sort((a, b) => ratioOf(b) - ratioOf(a)));
    const priciest = pick(found.filter((f) => f.budget).sort((a, b) => b.budget - a.budget));
    // each card's whole ranking, for its top 10 pop-up (the card's own film is marked there)
    const loved = rated.filter((f) => f.item.rating >= 8);
    const x1 = (f) => `${ratioOf(f).toFixed(1)}×`;
    yourTops = {
      top: { icon: "fa-solid fa-crown", label: "Biggest you've seen", shown: top, list: byGross, value: (f) => money(f.revenue), bar: (f) => f.revenue,
        sub: (f) => `${(f.revenue / avg).toFixed(1)}× your average film` },
      flop: { icon: "fa-solid fa-arrow-trend-down", label: "Biggest flops you've seen", shown: flop, list: flops, value: (f) => `−${money(f.budget - f.revenue)}`,
        bar: (f) => f.budget - f.revenue, sub: (f) => `made ${money(f.revenue)} of its ${money(f.budget)} budget`, loss: true },
      love: { icon: "fa-solid fa-heart", label: "Your 8+ money makers", shown: love, list: loved.slice().sort((a, b) => b.revenue - a.revenue),
        value: (f) => money(f.revenue), bar: (f) => f.revenue, sub: (f) => `★ ${Cards.formatRating(f.item.rating)}` },
      gem: { icon: "fa-solid fa-gem", label: "Your 8+ hidden gems", shown: hidden, list: loved.filter((f) => f.revenue >= 1e6).sort((a, b) => a.revenue - b.revenue),
        value: (f) => money(f.revenue), sub: (f) => `★ ${Cards.formatRating(f.item.rating)} · the smallest grosses you loved` },
      roi: { icon: "fa-solid fa-rocket", label: "Best returns you've seen", shown: best,
        list: found.filter((f) => ratioOf(f) != null && f.revenue >= 1e6).sort((a, b) => ratioOf(b) - ratioOf(a)),
        value: x1, bar: (f) => ratioOf(f), sub: (f) => `${money(f.budget)} → ${money(f.revenue)}` },
      cost: { icon: "fa-solid fa-coins", label: "Most expensive you've seen", shown: priciest, list: found.filter((f) => f.budget).sort((a, b) => b.budget - a.budget),
        value: (f) => money(f.budget), bar: (f) => f.budget, sub: (f) => `it made ${money(f.revenue)}${ratioOf(f) ? ` (${x1(f)})` : ""}` },
    };
    const cards = [
      card("top", "fa-solid fa-crown", "Biggest you've seen", top.revenue, top, "", meter(100, `${(top.revenue / avg).toFixed(1)}× your average film (${money(avg)})`)),
      flop
        ? card("flop", "fa-solid fa-arrow-trend-down", "Biggest flop you've seen", flop.budget - flop.revenue, flop, "",
            meter((flop.revenue / flop.budget) * 100, `made ${money(flop.revenue)} of its ${money(flop.budget)} budget`, "loss"), { minus: true })
        : "",
      love ? card("love", "fa-solid fa-heart", "Your 8+ money maker", love.revenue, love, "", stars(love.item.rating)) : "",
      hidden ? card("gem", "fa-solid fa-gem", "Your 8+ hidden gem", hidden.revenue, hidden, "the smallest gross you loved", stars(hidden.item.rating)) : "",
      best ? card("roi", "fa-solid fa-rocket", "Best return you've seen", ratioOf(best), best, `${money(best.budget)} → ${money(best.revenue)}`, meter(Math.min(100, (ratioOf(best) / 10) * 100), verdictOf(ratioOf(best))[0], "gold"), { fmt: "x" }) : "",
      priciest ? card("cost", "fa-solid fa-coins", "Most expensive you've seen", priciest.budget, priciest, "", meter((priciest.revenue / (priciest.budget * 5)) * 100, `it made ${money(priciest.revenue)} (${ratioOf(priciest) ? `${ratioOf(priciest).toFixed(1)}×` : "–"})`)) : "",
    ].filter(Boolean);

    box.innerHTML = `${head}
      <div class="bo-yours-hero xr-card">
        <div class="bo-yours-posters" aria-hidden="true">${byGross
          .slice(0, 7)
          .map((f, n) => `<img src="${Store.poster(f.item.poster, "w185")}" alt="" style="--n:${n}" />`)
          .join("")}</div>
        <span class="xr-label"><i class="fa-solid fa-sack-dollar"></i> The ${found.length} films you've watched made</span>
        <b data-count="${total}">${money(total)}</b>
        <small>worldwide, on ${money(spent)} of budgets${spent ? ` (${(total / spent).toFixed(1)}×)` : ""}. That's ${money(total / found.length)} a film.</small>
      </div>
      <div class="bo-stats by-cards n${cards.length}">${cards.join("")}</div>`;
    watchCounts(box);
    reveal([...box.querySelectorAll(".bo-stat, .bo-yours-hero")]);
  }

  $(".sk-controls").innerHTML = skyControlsHtml();
  load();
  yours();
})();
