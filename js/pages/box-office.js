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
    app.innerHTML = `<div class="bo-empty"><i class="fa-solid fa-key"></i><p>The box office charts need a TMDB API key. Add one in <a href="settings.html#keys">Settings</a>.</p></div>`;
    return;
  }

  const params = new URLSearchParams(location.search);
  const GENRES = TMDB.genresFor("movie");
  const state = {
    year: /^\d{4}$/.test(params.get("year") || "") ? Number(params.get("year")) : null,
    genre: GENRES.includes(params.get("genre")) ? params.get("genre") : "",
    sort: "gross",
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
        <h2 class="section-title"><i class="fa-solid fa-magnifying-glass-chart"></i> Budget vs box office</h2>
        <p class="bo-sub">Every film by what it cost and what it made. Point at one (or tap it) for the numbers.</p>
      </div>
      <div class="bo-plot-wrap"><div class="bo-tip" hidden></div></div>
    </section>
    <div class="bo-head bo-chart-head">
      <h2 class="section-title bo-chart-title"></h2>
      <div class="top10-switch bo-sort" role="group" aria-label="Sort the chart by">
        ${Object.entries(SORTS).map(([k, s]) => `<button type="button" class="top10-tab${k === state.sort ? " active" : ""}" data-sort="${k}"><i class="fa-solid ${s.icon}"></i> ${s.label}</button>`).join("")}
      </div>
    </div>
    <ol class="bo-chart"></ol>
    <div class="bo-more"></div>
    <p class="bo-note"><i class="fa-solid fa-circle-info"></i> Worldwide gross and budgets from TMDB, in US dollars and not adjusted for inflation. The verdict compares the gross with the budget (5× Blockbuster, 2× Hit, 1× Broke even, less: Flop); profit is before the cinemas' share and marketing. TMDB has no weekend or daily numbers.</p>`;

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
    history.replaceState(null, "", `box-office.html${q.toString() ? `?${q}` : ""}`);
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
      tile("s-total", "fa-solid fa-sack-dollar", `The top ${list.length} together`, total, "money", `worldwide, ${scopeLabel()}`),
      median ? tile("s-median", "fa-solid fa-scale-balanced", "Typical return", median, "x", "their budget, for the film in the middle") : "",
      best ? tile("s-best", "fa-solid fa-rocket", "Best return", ratioOf(best), "x", `${esc(Lang.title(best))}: ${money(best.budget)} → ${money(best.revenue)}`, best) : "",
      priciest ? tile("s-price", "fa-solid fa-coins", "Most expensive", priciest.budget, "money", `${esc(Lang.title(priciest))} (${priciest.year || "–"})`, priciest) : "",
    ].join("");
  }

  /* ---------------- budget vs box office ---------------- */

  const W = 1000;
  const H = 440;
  const PAD = { l: 64, r: 110, t: 18, b: 44 };
  function plotHtml(list) {
    const pts = list.filter((f) => f.budget > 0 && f.revenue > 0);
    if (pts.length < 4) return "";
    const lb = pts.map((f) => Math.log10(f.budget));
    const lg = pts.map((f) => Math.log10(f.revenue));
    const x0 = Math.min(...lb) - 0.12;
    const x1 = Math.max(...lb) + 0.12;
    const y0 = Math.min(...lg) - 0.12;
    const y1 = Math.max(...lg) + 0.1;
    const X = (v) => PAD.l + ((Math.log10(v) - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
    const Y = (v) => H - PAD.b - ((Math.log10(v) - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
    const bx0 = 10 ** x0;
    const bx1 = 10 ** x1;
    // the zones between the lines gross = k × budget
    const zone = (k1, k2, cls) =>
      `<polygon class="bo-zone ${cls}" points="${[
        [X(bx0), Y(k1 * bx0)],
        [X(bx1), Y(k1 * bx1)],
        [X(bx1), Y(k2 * bx1)],
        [X(bx0), Y(k2 * bx0)],
      ]
        .map((p) => p.map((n) => n.toFixed(1)).join(","))
        .join(" ")}" />`;
    const line = (k, label) => {
      // the part of gross = k × budget inside the plot (log k + budget, on log scales)
      const lk = Math.log10(k);
      const xs = Math.max(x0, y0 - lk);
      const xe = Math.min(x1, y1 - lk);
      if (xs >= xe) return "";
      const a = 10 ** xs;
      const b = 10 ** xe;
      const end = xe < x1; // (leaves through the top: the label goes above the end)
      return `<line class="bo-kline" x1="${X(a).toFixed(1)}" y1="${Y(k * a).toFixed(1)}" x2="${X(b).toFixed(1)}" y2="${Y(k * b).toFixed(1)}" />
        <text class="bo-klabel" x="${(X(b) + (end ? 0 : 8)).toFixed(1)}" y="${(Y(k * b) + (end ? -8 : 4)).toFixed(1)}"${end ? ' text-anchor="middle"' : ""}>${label}</text>`;
    };
    // round amounts for the axes: 1 / 2 / 5, or finer when the films are close together
    const ticks = (a, b) => {
      const steps = b - a < 0.8 ? [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8] : [1, 2, 5];
      const out = [];
      for (let e = Math.floor(a); e <= Math.ceil(b); e++) steps.forEach((m) => Math.log10(m * 10 ** e) >= a && Math.log10(m * 10 ** e) <= b && out.push(m * 10 ** e));
      return out;
    };
    const tickMoney = (v) => (v >= 1e9 ? `$${+(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${+(v / 1e6).toFixed(0)}M` : `$${Math.round(v / 1e3)}K`);
    const top = list[0] ? list[0].revenue : 1;
    const dots = pts
      .map((f, n) => {
        const r = 11 + Math.sqrt(f.revenue / top) * 9;
        const v = verdictOf(ratioOf(f));
        return `<g class="bo-dot ${v[1]}" data-i="${films.indexOf(f)}" tabindex="0" role="link" aria-label="${esc(Lang.title(f))}: ${money(f.budget)} budget, ${money(f.revenue)} gross"
            transform="translate(${X(f.budget).toFixed(1)} ${Y(f.revenue).toFixed(1)})" style="--d:${Math.min(n, 40) * 25}ms">
          <g class="bo-dot-in">
            <circle r="${(r + 2.5).toFixed(1)}" class="bo-ring" />
            <image href="${posterOf(f, "w92")}" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMin slice" clip-path="url(#bo-round)" />
          </g>
        </g>`;
      })
      .join("");
    return `<svg class="bo-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Budget against worldwide gross">
        <defs><clipPath id="bo-round" clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath><clipPath id="bo-clip"><rect x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${H - PAD.t - PAD.b}" rx="14" /></clipPath></defs>
        <g clip-path="url(#bo-clip)">
          ${zone(0.001, 1, "red")}${zone(1, 2, "grey")}${zone(2, 5, "green")}${zone(5, 1e4, "gold")}
          ${ticks(x0, x1).map((v) => `<line class="bo-grid" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${PAD.t}" y2="${H - PAD.b}" />`).join("")}
          ${ticks(y0, y1).map((v) => `<line class="bo-grid" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" x1="${PAD.l}" x2="${W - PAD.r}" />`).join("")}
        </g>
        ${line(1, "1× Broke even")}${line(2, "2× Hit")}${line(5, "5× Blockbuster")}
        ${ticks(x0, x1).map((v) => `<text class="bo-tick" x="${X(v).toFixed(1)}" y="${H - PAD.b + 22}" text-anchor="middle">${tickMoney(v)}</text>`).join("")}
        ${ticks(y0, y1).map((v) => `<text class="bo-tick" x="${PAD.l - 10}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${tickMoney(v)}</text>`).join("")}
        <text class="bo-axis" x="${(W - PAD.r + PAD.l) / 2}" y="${H - 4}" text-anchor="middle">Budget →</text>
        <text class="bo-axis" x="14" y="${(H - PAD.b + PAD.t) / 2}" text-anchor="middle" transform="rotate(-90 14 ${(H - PAD.b + PAD.t) / 2})">Worldwide gross →</text>
        <g class="bo-dots">${dots}</g>
      </svg>`;
  }

  function paintPlot() {
    const html = plotHtml(films);
    const sec = $(".bo-plot");
    sec.hidden = !html;
    if (!html) return;
    const wrap = $(".bo-plot-wrap");
    wrap.querySelector("svg") && wrap.querySelector("svg").remove();
    wrap.insertAdjacentHTML("afterbegin", html);
    const svg = wrap.querySelector("svg");
    if (revealer) {
      const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (svg.classList.add("in"), io.disconnect()), { threshold: 0.2 });
      io.observe(svg);
    } else svg.classList.add("in");
  }

  function showTip(dot) {
    const f = films[Number(dot.dataset.i)];
    const tip = $(".bo-tip");
    if (!f) return;
    app.querySelectorAll(".bo-dot.hot").forEach((d) => d !== dot && d.classList.remove("hot"));
    dot.classList.add("hot");
    dot.parentNode.appendChild(dot); // (on top of the others)
    tip.innerHTML = `<img src="${posterOf(f, "w92")}" alt="" />
      <span><b>${esc(Lang.title(f))}</b> <small>${f.year || ""}</small>
      <span class="bo-tip-nums">${money(f.budget)} <i class="fa-solid fa-arrow-right"></i> <b>${money(f.revenue)}</b></span>
      ${verdictHtml(f)}</span>`;
    tip.hidden = false;
    const w = $(".bo-plot-wrap").getBoundingClientRect();
    const d = dot.getBoundingClientRect();
    const left = d.left + d.width / 2 - w.left;
    const flip = left > w.width - 250;
    tip.style.left = `${flip ? left - d.width / 2 - 12 : left + d.width / 2 + 12}px`;
    tip.style.top = `${d.top + d.height / 2 - w.top}px`;
    tip.classList.toggle("flip", flip);
  }
  function hideTip() {
    $(".bo-tip").hidden = true;
    app.querySelectorAll(".bo-dot.hot").forEach((d) => d.classList.remove("hot"));
  }

  /* ---------------- the chart ---------------- */

  function sorted() {
    const by = SORTS[state.sort].by;
    return films.slice().sort((a, b) => by(b) - by(a) || b.revenue - a.revenue);
  }

  function rowHtml(f, n, top) {
    const lib = Cards.inLibrary(f);
    const seen = lib && (lib.rating != null || !!lib.watchedAt || !lib.watchlist);
    const w = Math.max(3, (f.revenue / top) * 100);
    const b = f.budget ? Math.min(100, (f.budget / f.revenue) * 100) : 0;
    return `<li class="bo-row" data-id="${f.tmdbId}">
        <div class="bo-line" role="button" tabindex="0" aria-expanded="false">
          <span class="bo-rank${n < 3 ? ` top${n + 1}` : ""}">${n + 1}</span>
          <span class="bo-poster"><img src="${posterOf(f, "w185")}" alt="" loading="lazy" /></span>
          <div class="bo-main">
            <div class="bo-name">
              <strong>${esc(Lang.title(f))}</strong>
              <small>${f.year || ""}${f.genres && f.genres.length ? ` · ${esc(f.genres.slice(0, 2).join(", "))}` : ""}</small>
              ${
                lib
                  ? `<span class="bo-mine" title="In your library">${seen ? `<i class="fa-solid fa-check"></i> Watched${lib.rating != null ? ` · <i class="fa-solid fa-star"></i> ${Cards.formatRating(lib.rating)}` : ""}` : '<i class="fa-solid fa-bookmark"></i> Watchlist'}</span>`
                  : ""
              }
            </div>
            <div class="bo-bar" style="--w:${w}%" title="Gross ${money(f.revenue)}${f.budget ? ` · budget ${money(f.budget)}` : ""}">
              <span class="bo-fill">${b ? `<span class="bo-budget" style="--b:${b}%"></span>` : ""}</span>
            </div>
          </div>
          <div class="bo-nums">
            <b>${money(f.revenue)}</b>
            <small>${f.budget ? `budget ${money(f.budget)}` : "budget –"}</small>
            ${verdictHtml(f)}
          </div>
          <i class="fa-solid fa-chevron-down bo-chev" aria-hidden="true"></i>
        </div>
        <div class="bo-detail"><div></div></div>
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
          ${f.score ? fact("TMDB rating", `${f.score.toFixed(1)}`, "out of 10") : ""}
        </div>
        ${f.overview ? `<p class="bo-overview">${esc(f.overview)}</p>` : ""}
        <div class="bo-actions">
          <button class="btn btn-primary bo-trailer" type="button" data-id="${f.tmdbId}"><i class="fa-solid fa-play"></i> Trailer</button>
          <a class="btn" href="${titleUrl(f)}"><i class="fa-solid fa-circle-info"></i> Open</a>
        </div>
      </div>`;
  }

  function paintChart() {
    const list = sorted();
    const top = films.length ? Math.max(...films.map((f) => f.revenue)) : 1;
    const chart = $(".bo-chart");
    const open = new Set([...chart.querySelectorAll(".bo-row.open")].map((r) => r.dataset.id));
    chart.innerHTML = list.map((f, n) => rowHtml(f, n, top)).join("");
    open.forEach((id) => toggleRow(chart.querySelector(`.bo-row[data-id="${id}"]`), true));
    reveal([...chart.querySelectorAll(".bo-row")]);
    $(".bo-more").innerHTML = page < pages ? `<button class="btn bo-load" type="button"><i class="fa-solid fa-chevron-down"></i> Show the next 20</button>` : "";
  }

  // a new order: the rows glide from where they were to where they go (FLIP)
  function resort() {
    const chart = $(".bo-chart");
    const before = new Map([...chart.querySelectorAll(".bo-row")].map((r) => [r.dataset.id, r.getBoundingClientRect().top]));
    const list = sorted();
    list.forEach((f, n) => {
      const row = chart.querySelector(`.bo-row[data-id="${f.tmdbId}"]`);
      if (!row) return;
      chart.appendChild(row);
      const rank = row.querySelector(".bo-rank");
      rank.textContent = n + 1;
      rank.className = `bo-rank${n < 3 ? ` top${n + 1}` : ""}`;
    });
    if (still) return;
    chart.querySelectorAll(".bo-row").forEach((row) => {
      const was = before.get(row.dataset.id);
      if (was == null) return;
      const dy = was - row.getBoundingClientRect().top;
      if (!dy) return;
      row.classList.add("in");
      row.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 550, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    });
  }

  function toggleRow(row, force) {
    if (!row) return;
    const on = force != null ? force : !row.classList.contains("open");
    const f = films.find((x) => String(x.tmdbId) === row.dataset.id);
    if (on && f) row.querySelector(".bo-detail > div").innerHTML = detailHtml(f);
    row.classList.toggle("open", on);
    row.querySelector(".bo-line").setAttribute("aria-expanded", on);
  }

  /* ---------------- loading ---------------- */

  async function load() {
    const me = ++run;
    page = 1;
    paintControls();
    setAddress();
    hideTip();
    clearTimeout(stageTimer);
    $(".bo-chart-title").textContent = `Highest-grossing ${state.genre ? `${state.genre.toLowerCase()} ` : ""}films ${scopeLabel()}`;
    $(".bo-stage").innerHTML = '<div class="bo-stage-skel"></div>';
    $(".bo-stage").classList.remove("ready");
    $(".bo-stats").innerHTML = '<div class="xr-card bo-stat skeleton"></div>'.repeat(4);
    $(".bo-chart").innerHTML = '<li class="bo-row skeleton"></li>'.repeat(6);
    $(".bo-more").innerHTML = "";
    try {
      const res = await TMDB.boxOffice({ year: state.year, genre: state.genre, page: 1 });
      if (me !== run) return;
      films = res.results;
      pages = res.totalPages;
      if (!films.length) {
        $(".bo-stage").innerHTML = "";
        $(".bo-stats").innerHTML = "";
        $(".bo-plot").hidden = true;
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
      paintPlot();
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
      const res = await TMDB.boxOffice({ year: state.year, genre: state.genre, page: page + 1 });
      if (me !== run) return;
      page++;
      const seen = new Set(films.map((f) => f.tmdbId));
      films = films.concat(res.results.filter((f) => !seen.has(f.tmdbId)));
      const known = new Set([...app.querySelectorAll(".bo-row")].map((r) => r.dataset.id));
      paintChart();
      // (the ones already there don't come in again)
      app.querySelectorAll(".bo-row").forEach((r) => known.has(r.dataset.id) && r.classList.add("in"));
      paintPlot();
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
    const so = e.target.closest("[data-sort]");
    if (so) {
      if (so.dataset.sort === state.sort) return;
      state.sort = so.dataset.sort;
      app.querySelectorAll("[data-sort]").forEach((b) => b.classList.toggle("active", b === so));
      return resort();
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
    const dot = e.target.closest(".bo-dot");
    if (dot) {
      // a mouse: straight to the film; a finger: first the numbers, then (tapped again) the film
      const f = films[Number(dot.dataset.i)];
      if (e.pointerType === "mouse" || dot.classList.contains("hot") || !e.pointerType) return f && (location.href = titleUrl(f));
      return showTip(dot);
    }
    if (!e.target.closest(".bo-plot-wrap")) hideTip();
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
    const dot = e.target.closest(".bo-dot");
    if (dot && e.key === "Enter") location.href = titleUrl(films[Number(dot.dataset.i)]);
  });
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
    const dot = e.target.closest(".bo-dot");
    if (dot) showTip(dot);
  });
  app.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const dot = e.target.closest(".bo-dot");
    if (dot && !(e.relatedTarget && dot.contains(e.relatedTarget))) hideTip();
  });
  app.addEventListener("focusin", (e) => e.target.closest && e.target.closest(".bo-dot") && showTip(e.target.closest(".bo-dot")));
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
  // (a hidden tab doesn't turn the podium)
  document.addEventListener("visibilitychange", () => (document.hidden ? clearTimeout(stageTimer) : schedule()));
  window.addEventListener("resize", () => {
    moveChip();
    hideTip();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveChip);

  /* ---------------- your box office: the films you've watched ---------------- */

  async function yours() {
    if (Store.guest || !window.Watch) return;
    const mine = Store.all().filter((i) => i.type === "movie" && (i.rating != null || !!i.watchedAt || !i.watchlist));
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
      return `<a class="xr-card bo-stat by-card by-${kind}" href="${url(f)}">
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

  load();
  yours();
})();
