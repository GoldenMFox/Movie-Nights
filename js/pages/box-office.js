/*
 * Box Office (box-office.html): the highest-grossing films worldwide, from TMDB (its "revenue"
 * and "budget", in US dollars, not adjusted for inflation; TMDB has no weekend numbers).
 *   - All time / This year / Last year, or any year, and any genre (kept in the address:
 *     box-office.html?year=2025&genre=Horror)
 *   - the #1 big on top, four numbers about the chart, then the chart itself: a bar for the
 *     gross with the budget inside it, and the verdict (the X-Ray's: Blockbuster 5×, Hit 2×,
 *     Broke even, Flop), 20 at a time
 *   - Your box office: the same numbers for the films you've watched
 */
(function () {
  const app = document.getElementById("bo-app");
  const { esc } = UI;
  const THIS_YEAR = new Date().getFullYear();

  const money = (n) => (n >= 1e9 ? `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : n > 0 ? `$${n.toLocaleString("en-US")}` : "–");
  const ratioOf = (f) => (f.budget > 0 && f.revenue > 0 ? f.revenue / f.budget : null);
  // (the same verdict as the title page's X-Ray)
  const verdictOf = (r) => (r == null ? null : r >= 5 ? ["Blockbuster", "gold"] : r >= 2 ? ["Hit", "green"] : r >= 1 ? ["Broke even", "grey"] : ["Flop", "red"]);
  const verdictHtml = (f) => {
    const r = ratioOf(f);
    const v = verdictOf(r);
    return v ? `<span class="xr-verdict ${v[1]}">${v[0]} · ${r.toFixed(1)}×</span>` : '<span class="xr-verdict grey">Budget unknown</span>';
  };
  const titleUrl = (f) => `title.html?tmdb=movie-${f.tmdbId}`;

  if (!TMDB.enabled()) {
    app.innerHTML = `<div class="bo-empty"><i class="fa-solid fa-key"></i><p>The box office charts need a TMDB API key. Add one in <a href="settings.html#keys">Settings</a>.</p></div>`;
    return;
  }

  // what's picked: "all" | a year; "" | a genre (from the address, so it can be shared)
  const params = new URLSearchParams(location.search);
  const state = {
    year: /^\d{4}$/.test(params.get("year") || "") ? Number(params.get("year")) : null,
    genre: TMDB.genresFor("movie").includes(params.get("genre")) ? params.get("genre") : "",
  };
  let films = [];
  let page = 1;
  let pages = 1;
  let run = 0; // (answers for a choice you've left are dropped)

  const scope = () => (state.year == null ? "all" : state.year === THIS_YEAR ? "this" : state.year === THIS_YEAR - 1 ? "last" : "year");
  const scopeLabel = () => (state.year == null ? "of all time" : `of ${state.year}`);

  app.innerHTML = `
    <div class="bo-controls">
      <div class="top10-switch bo-scope" role="group" aria-label="Which years">
        <button type="button" class="top10-tab" data-scope="all">All time</button>
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
      <span class="glass-select">
        <i class="fa-solid fa-masks-theater" aria-hidden="true"></i>
        <select name="genre" aria-label="Genre">
          <option value="">All genres</option>
          ${TMDB.genresFor("movie").map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("")}
        </select>
      </span>
    </div>
    <div class="bo-hero"></div>
    <div class="bo-stats"></div>
    <h2 class="section-title bo-chart-title"></h2>
    <ol class="bo-chart"></ol>
    <div class="bo-more"></div>
    <section class="bo-yours" hidden></section>
    <p class="bo-note"><i class="fa-solid fa-circle-info"></i> Worldwide gross and budgets from TMDB, in US dollars and not adjusted for inflation. The verdict compares the gross with the budget (5× Blockbuster, 2× Hit, 1× Broke even, less: Flop). TMDB has no weekend or daily numbers.</p>`;

  const $ = (s) => app.querySelector(s);

  function paintControls() {
    app.querySelectorAll("[data-scope]").forEach((b) => b.classList.toggle("active", b.dataset.scope === scope()));
    $('[name="year"]').value = state.year == null ? "" : String(state.year);
    $('[name="genre"]').value = state.genre;
  }

  function setAddress() {
    const q = new URLSearchParams();
    if (state.year != null) q.set("year", state.year);
    if (state.genre) q.set("genre", state.genre);
    history.replaceState(null, "", `box-office.html${q.toString() ? `?${q}` : ""}`);
  }

  /* ---------------- the #1 ---------------- */

  function heroHtml(f) {
    const r = ratioOf(f);
    return `<a class="bo-top" href="${titleUrl(f)}">
        <span class="bo-top-bg" style="background-image:url('${Store.img(f.backdrop, "w1280")}')"></span>
        <span class="bo-top-shade"></span>
        <img class="bo-top-poster" src="${Store.poster(f.posterRu && Lang.isRu() ? f.posterRu : f.poster, "w342")}" alt="" />
        <span class="bo-top-info">
          <span class="bo-top-rank"><i class="fa-solid fa-crown"></i> #1 ${esc(scopeLabel())}${state.genre ? ` · ${esc(state.genre)}` : ""}</span>
          <strong class="bo-top-title">${esc(Lang.title(f))} <small>${f.year || ""}</small></strong>
          <span class="bo-top-gross"><b data-count="${f.revenue}">${money(f.revenue)}</b> worldwide</span>
          <span class="bo-top-meta"><span>${f.budget ? `Made for ${money(f.budget)}` : "Budget unknown"}</span>${r ? verdictHtml(f) : ""}</span>
        </span>
      </a>`;
  }

  /* ---------------- four numbers about the chart ---------------- */

  function statsHtml(list) {
    const total = list.reduce((s, f) => s + f.revenue, 0);
    const withBudget = list.filter((f) => ratioOf(f));
    const best = withBudget.slice().sort((a, b) => ratioOf(b) - ratioOf(a))[0];
    const priciest = list.filter((f) => f.budget).sort((a, b) => b.budget - a.budget)[0];
    const ratios = withBudget.map(ratioOf).sort((a, b) => a - b);
    const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
    const tile = (icon, label, value, sub, href) =>
      `<${href ? `a href="${href}"` : "div"} class="xr-card bo-stat">
        <span class="xr-label"><i class="${icon}"></i> ${label}</span>
        <b>${value}</b><small>${sub}</small>
      </${href ? "a" : "div"}>`;
    return [
      tile("fa-solid fa-sack-dollar", `The top ${list.length} together`, money(total), `worldwide, ${scopeLabel()}`),
      median ? tile("fa-solid fa-scale-balanced", "Typical return", `${median.toFixed(1)}×`, "their budget, for the film in the middle") : "",
      best ? tile("fa-solid fa-rocket", "Best return", `${ratioOf(best).toFixed(1)}×`, `${esc(Lang.title(best))}: ${money(best.budget)} → ${money(best.revenue)}`, titleUrl(best)) : "",
      priciest ? tile("fa-solid fa-coins", "Most expensive", money(priciest.budget), `${esc(Lang.title(priciest))} (${priciest.year || "–"})`, titleUrl(priciest)) : "",
    ].join("");
  }

  /* ---------------- the chart ---------------- */

  function rowHtml(f, n, top) {
    const lib = Cards.inLibrary(f);
    const seen = lib && (lib.rating != null || !!lib.watchedAt || !lib.watchlist);
    const w = Math.max(3, (f.revenue / top) * 100);
    const b = f.budget ? Math.min(100, (f.budget / f.revenue) * 100) : 0;
    return `<li class="bo-row" style="--d:${Math.min(n % 20, 12) * 40}ms">
        <span class="bo-rank${n < 3 ? ` top${n + 1}` : ""}">${n + 1}</span>
        <a class="bo-poster" href="${titleUrl(f)}" tabindex="-1" aria-hidden="true"><img src="${Store.poster(f.posterRu && Lang.isRu() ? f.posterRu : f.poster, "w185")}" alt="" loading="lazy" /></a>
        <div class="bo-main">
          <div class="bo-name">
            <a href="${titleUrl(f)}">${esc(Lang.title(f))}</a>
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
      </li>`;
  }

  function paintChart(from) {
    const top = films.length ? films[0].revenue : 1;
    const html = films.slice(from).map((f, n) => rowHtml(f, from + n, top)).join("");
    if (from) $(".bo-chart").insertAdjacentHTML("beforeend", html);
    else $(".bo-chart").innerHTML = html;
    requestAnimationFrame(() => app.querySelectorAll(".bo-row:not(.in)").forEach((r) => r.classList.add("in")));
    $(".bo-more").innerHTML =
      page < pages ? `<button class="btn bo-load" type="button"><i class="fa-solid fa-chevron-down"></i> Show the next 20</button>` : "";
  }

  async function load() {
    const me = ++run;
    page = 1;
    paintControls();
    setAddress();
    $(".bo-chart-title").textContent = `Highest-grossing ${state.genre ? `${state.genre.toLowerCase()} ` : ""}films ${scopeLabel()}`;
    $(".bo-hero").innerHTML = '<div class="bo-top skeleton"></div>';
    $(".bo-stats").innerHTML = '<div class="xr-card bo-stat skeleton"></div>'.repeat(4);
    $(".bo-chart").innerHTML = '<li class="bo-row skeleton"></li>'.repeat(6);
    $(".bo-more").innerHTML = "";
    try {
      const res = await TMDB.boxOffice({ year: state.year, genre: state.genre, page: 1 });
      if (me !== run) return;
      films = res.results;
      pages = res.totalPages;
      if (!films.length) {
        $(".bo-hero").innerHTML = "";
        $(".bo-stats").innerHTML = "";
        $(".bo-chart").innerHTML = `<li class="bo-none">No box office numbers for ${state.genre ? `${esc(state.genre.toLowerCase())} films ` : "films "}${esc(scopeLabel())} yet.</li>`;
        return;
      }
      $(".bo-hero").innerHTML = heroHtml(films[0]);
      countUp($(".bo-top-gross b"));
      $(".bo-stats").innerHTML = statsHtml(films);
      paintChart(0);
    } catch (e) {
      if (me !== run) return;
      $(".bo-hero").innerHTML = "";
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
      const from = films.length;
      const seen = new Set(films.map((f) => f.tmdbId));
      films = films.concat(res.results.filter((f) => !seen.has(f.tmdbId)));
      paintChart(from);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Try again";
    }
  }

  // the #1's gross counts up
  function countUp(el) {
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = Number(el.dataset.count);
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1100);
      el.textContent = money(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = money(to);
    };
    requestAnimationFrame(step);
  }

  app.addEventListener("click", (e) => {
    const s = e.target.closest("[data-scope]");
    if (s) {
      state.year = { all: null, this: THIS_YEAR, last: THIS_YEAR - 1 }[s.dataset.scope];
      return load();
    }
    const more = e.target.closest(".bo-load");
    if (more) loadMore(more);
  });
  app.addEventListener("change", (e) => {
    if (e.target.name === "year") state.year = e.target.value ? Number(e.target.value) : null;
    else if (e.target.name === "genre") state.genre = e.target.value;
    else return;
    load();
  });

  /* ---------------- your box office: the films you've watched ---------------- */

  async function yours() {
    if (Store.guest || !window.Watch) return;
    const mine = Store.all().filter((i) => i.type === "movie" && (i.rating != null || !!i.watchedAt || !i.watchlist));
    if (mine.length < 3) return;
    const box = $(".bo-yours");
    box.hidden = false;
    const head = `<h2 class="section-title"><i class="fa-solid fa-ticket"></i> Your box office</h2>`;
    box.innerHTML = `${head}<p class="bo-progress">Adding up the films you've watched… <b>0</b> of ${mine.length}</p>`;
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
              const n = await TMDB.boxOfficeOf(Number(ref.split("-")[1]), item.released || (item.year ? `${item.year}-06-01` : ""));
              if (n.revenue > 0) found.push(Object.assign({ item, tmdbId: Number(ref.split("-")[1]) }, n));
            }
          } catch (e) {}
          done++;
          if (Date.now() - last > 150) {
            last = Date.now();
            const b = box.querySelector(".bo-progress b");
            if (b) b.textContent = done;
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
    const loved = rated.filter((f) => f.item.rating >= 8).sort((a, b) => b.revenue - a.revenue)[0];
    const gem = rated.filter((f) => f.item.rating >= 8).sort((a, b) => a.revenue - b.revenue)[0];
    const name = (f) => esc(Lang.title(f.item));
    const url = (f) => `title.html?id=${encodeURIComponent(f.item.id)}`;
    const tile = (icon, label, value, sub, f) =>
      `<a class="xr-card bo-stat" href="${url(f)}"><span class="xr-label"><i class="${icon}"></i> ${label}</span><b>${value}</b><small>${sub}</small></a>`;

    box.innerHTML = `${head}
      <div class="bo-yours-hero xr-card">
        <span class="xr-label"><i class="fa-solid fa-sack-dollar"></i> The ${found.length} films you've watched made</span>
        <b>${money(total)}</b>
        <small>worldwide, on ${money(spent)} of budgets${spent ? ` (${(total / spent).toFixed(1)}×)` : ""}. That's ${money(total / found.length)} a film.</small>
      </div>
      <div class="bo-stats">
        ${tile("fa-solid fa-crown", "Biggest you've seen", money(byGross[0].revenue), name(byGross[0]), byGross[0])}
        ${flops.length ? tile("fa-solid fa-arrow-trend-down", "Biggest flop you've seen", `−${money(flops[0].budget - flops[0].revenue)}`, `${name(flops[0])}: ${money(flops[0].budget)} → ${money(flops[0].revenue)}`, flops[0]) : ""}
        ${loved ? tile("fa-solid fa-heart", "Your 8+ money maker", money(loved.revenue), `${name(loved)} · ★ ${Cards.formatRating(loved.item.rating)}`, loved) : ""}
        ${gem && gem !== loved ? tile("fa-solid fa-gem", "Your 8+ hidden gem", money(gem.revenue), `${name(gem)} · ★ ${Cards.formatRating(gem.item.rating)} · the smallest gross you loved`, gem) : ""}
      </div>`;
  }

  load();
  yours();
})();
