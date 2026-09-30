/*
 * Discover page: browse and search all of TMDB (trending, popular, in cinemas,
 * coming soon, top rated, anime) and add anything to your library or watchlist.
 * Needs a TMDB key (js/config.js or Settings).
 */
(function () {
  const { esc } = UI;
  const root = document.getElementById("discover");

  if (!TMDB.enabled()) {
    const step = (n, html) => `<li><span class="dk-num">${n}</span><span>${html}</span></li>`;
    root.innerHTML = `<section class="xr-card dx-nokey">
      <span class="xr-label"><i class="fa-solid fa-key"></i> Connect TMDB</span>
      <h2>Connect TMDB to discover new titles</h2>
      <p class="dk-lead">Discover shows what's trending, popular, in cinemas and coming soon, using TMDB's free API.
         It needs a TMDB API key, which takes about 2 minutes:</p>
      <ol class="dk-steps">
        ${step(1, 'Create a free account at <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org/signup</a> and confirm your email.')}
        ${step(2, 'Go to <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Settings → API</a> and request a key (choose "Personal / Developer").')}
        ${step(3, "Copy the <strong>API Key</strong> (or the API Read Access Token).")}
        ${step(4, 'Paste it in <a href="settings.html#keys">Settings</a>, or into <code>js/config.js</code> so it works everywhere.')}
      </ol>
      <a class="btn btn-primary dk-go" href="settings.html#keys"><i class="fa-solid fa-gear"></i> Open Settings</a>
    </section>`;
    return;
  }

  const TYPES = { movie: "Movies", tv: "TV shows", anime: "Anime" };
  const GSORTS = { popular: "Most popular", top: "Top rated", new: "Newest" };
  const SEARCH_IN = { all: "Everything", movie: "Movies", tv: "TV shows", anime: "Anime" };

  const params = new URLSearchParams(location.search);
  const state = {
    cat: TMDB.CATEGORIES[params.get("cat")] ? params.get("cat") : "trending",
    q: params.get("q") || "",
    sin: SEARCH_IN[params.get("in")] ? params.get("in") : "all", // search in
    // browse by genre
    genre: params.get("genre") || "",
    gtype: TYPES[params.get("type")] ? params.get("type") : "movie",
    gsort: GSORTS[params.get("sort")] ? params.get("sort") : "popular",
    page: 0,
    totalPages: 1,
    loading: false,
    run: 0, // ignores answers that arrive after you've switched to something else
    seen: new Set(),
  };
  if (state.genre && !TMDB.genresFor(state.gtype).includes(state.genre)) state.genre = "";

  root.innerHTML = `
    <form class="glass-search discover-search" role="search">
      <i class="fa-solid fa-magnifying-glass gs-icon" aria-hidden="true"></i>
      <input type="search" name="q" placeholder="Search movies, TV shows and anime…" aria-label="Search all movies, TV shows and anime" value="${esc(state.q)}" autocomplete="off" />
      <span class="glass-select small">
        <select name="sin" aria-label="Search in">
          ${Object.entries(SEARCH_IN).map(([k, l]) => `<option value="${k}"${k === state.sin ? " selected" : ""}>${l}</option>`).join("")}
        </select>
      </span>
      <button class="gs-btn" type="submit" aria-label="Search"><i class="fa-solid fa-magnifying-glass"></i></button>
    </form>
    <div class="glass-filters genre-bar">
      <span class="gf-label">Browse by genre</span>
      <div class="segmented" role="group" aria-label="Type">
        <span class="seg-indicator" aria-hidden="true"></span>
        ${Object.entries(TYPES).map(([k, l]) => `<button type="button" data-gtype="${k}">${l}</button>`).join("")}
      </div>
      <span class="glass-select grow">
        <i class="fa-solid fa-masks-theater" aria-hidden="true"></i>
        <select name="genre" aria-label="Genre"></select>
      </span>
      <span class="glass-select">
        <i class="fa-solid fa-arrow-down-wide-short" aria-hidden="true"></i>
        <select name="gsort" aria-label="Sort by">
          ${Object.entries(GSORTS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}
        </select>
      </span>
      <a class="btn gf-adv" href="search.html"><i class="fa-solid fa-sliders"></i> Advanced search</a>
    </div>
    <div class="chips" role="group" aria-label="Category">
      <span class="chip-indicator intro" aria-hidden="true"></span>
      ${Object.entries(TMDB.CATEGORIES)
        .map(([k, c]) => `<button class="chip" type="button" data-cat="${k}">${c.label}</button>`)
        .join("")}
    </div>
    <p class="result-count" aria-live="polite"></p>
    <div class="movie-grid"></div>
    <div class="movie-grid dx-skeletons" aria-hidden="true" hidden></div>
    <div class="empty-state" hidden></div>
    <div class="load-more"><button class="btn" type="button" hidden>Load more</button></div>
    <p class="tmdb-note">Data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
      Titles already in your library show your own rating.</p>`;

  const grid = root.querySelector(".movie-grid");
  const countEl = root.querySelector(".result-count");
  const moreBtn = root.querySelector(".load-more button");
  const emptyEl = root.querySelector(".empty-state");
  const skeletons = root.querySelector(".dx-skeletons");
  // the page's motion (css: "Discover page: motion"), unless motion is turned down
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("dx-fx");
  const form = root.querySelector("form");
  const genreSel = root.querySelector('[name="genre"]');
  const gsortSel = root.querySelector('[name="gsort"]');

  const tools = UI.foldTools(document.querySelector(".page-title"), {
    search: form,
    filters: root.querySelector(".genre-bar"),
    openSearch: !!state.q,
    openFilters: !!state.genre,
  });

  function fillGenres() {
    const list = TMDB.genresFor(state.gtype);
    genreSel.innerHTML =
      `<option value="">Pick a genre…</option>` + list.map((g) => `<option value="${esc(g)}"${g === state.genre ? " selected" : ""}>${esc(g)}</option>`).join("");
  }

  // the dark pill slides to the selected type, like the navbar
  function moveSegment() {
    const seg = root.querySelector(".segmented");
    const on = seg.querySelector("button.active");
    const ind = seg.querySelector(".seg-indicator");
    if (!on) return;
    ind.style.left = `${on.offsetLeft}px`;
    ind.style.width = `${on.offsetWidth}px`;
  }
  // the red pill glides to the picked category (and fades out while searching or browsing a genre)
  function moveChip() {
    const ind = root.querySelector(".chip-indicator");
    const on = root.querySelector(".chips .chip.active");
    ind.classList.toggle("off", !on);
    if (!on) return;
    ind.style.left = `${on.offsetLeft}px`;
    ind.style.top = `${on.offsetTop}px`;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.height = `${on.offsetHeight}px`;
  }
  // after its entrance the pill keeps only the glide
  root.querySelector(".chip-indicator").addEventListener("animationend", (e) => e.currentTarget.classList.remove("intro"));

  window.addEventListener("resize", moveSegment);
  window.addEventListener("resize", moveChip);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => (moveSegment(), moveChip()));

  function syncUi() {
    root.querySelectorAll("[data-cat]").forEach((c) => {
      const on = !state.q && !state.genre && c.dataset.cat === state.cat;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", on);
    });
    root.querySelectorAll("[data-gtype]").forEach((b) => {
      const on = b.dataset.gtype === state.gtype;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    gsortSel.value = state.gsort;
    gsortSel.disabled = !state.genre;
    moveSegment();
    moveChip();
    tools.mark(state.q, state.genre);
    let p = {};
    if (state.q) p = state.sin === "all" ? { q: state.q } : { q: state.q, in: state.sin };
    else if (state.genre) p = { genre: state.genre, type: state.gtype, sort: state.gsort };
    else if (state.cat !== "trending") p = { cat: state.cat };
    const qs = new URLSearchParams(p).toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  function heading(shown) {
    if (state.q) return `${shown} result${shown === 1 ? "" : "s"} for "${state.q}"${state.sin === "all" ? "" : ` in ${SEARCH_IN[state.sin]}`}`;
    if (state.genre) return `${state.genre} · ${TYPES[state.gtype]} · ${GSORTS[state.gsort]}: ${shown} titles`;
    return `${TMDB.CATEGORIES[state.cat].label}: ${shown} titles`;
  }

  // "Coming soon · Dec 15" on titles that aren't out yet (only here on Discover). Not on
  // the "Coming soon" list itself, where every title would have it.
  // Movies use their release date in your country (Settings → Streaming), looked up for
  // recent and upcoming ones; until it arrives (or if your country has none) the worldwide date.
  const today = () => new Date().toISOString().slice(0, 10);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  function soonLabel(card, date) {
    const old = card.querySelector(".soon-label");
    if (old) old.remove();
    const img = card.querySelector(".poster-link .movie-poster");
    if (!img || !date || date <= today()) return;
    const when = new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
      ...(date.slice(0, 4) !== today().slice(0, 4) ? { year: "numeric" } : {}),
    });
    img.insertAdjacentHTML(
      "afterend",
      `<span class="soon-label" title="In cinemas in ${esc(TMDB.countryName())} from ${esc(when)}"><i class="fa-regular fa-clock"></i> <span class="soon-word">Coming soon · </span>${esc(when)}</span>`
    );
  }

  function markComingSoon(results) {
    if (!state.q && !state.genre && state.cat === "upcoming") return;
    const cards = [...grid.children].slice(-results.length); // one card per result, just added
    const lookups = [];
    results.forEach((r, i) => {
      const card = cards[i];
      if (!card) return;
      if (r.mediaType !== "movie") return soonLabel(card, r.released);
      const known = TMDB.knownLocalDate(r.tmdbId);
      soonLabel(card, known || r.released);
      // anything from the last ~7 months or later can still be ahead in Romania
      if (known == null && (!r.released || r.released >= daysAgo(210))) lookups.push([card, r]);
    });
    // a few at a time
    const next = async () => {
      const job = lookups.shift();
      if (!job) return;
      const [card, r] = job;
      try {
        const local = await TMDB.localDate(r.tmdbId);
        if (card.isConnected) soonLabel(card, local || r.released);
      } catch (e) {}
      return next();
    };
    for (let k = 0; k < 4; k++) next();
  }

  // the page shows 5 rows of posters; each "Load more" adds 5 more
  const ROWS = 5;
  const columns = () => Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
  const fiveRows = () => columns() * ROWS;

  async function load(reset) {
    if (state.loading && !reset) return;
    // how many posters were on show before: the new ones flow in after them
    const before = reset ? 0 : Math.min(grid.children.length, state.limit);
    if (reset) {
      state.run++;
      state.loading = false;
      state.page = 0;
      state.totalPages = 1;
      state.seen.clear();
      grid.innerHTML = "";
      emptyEl.hidden = true;
      state.limit = fiveRows();
      // shimmering placeholders while the first posters load
      skeletons.innerHTML = '<div class="movie-item skeleton"></div>'.repeat(state.limit);
      skeletons.hidden = false;
      moreBtn.hidden = true;
    } else {
      state.limit = before + fiveRows();
      moreBtn.disabled = true;
      moreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading…';
    }
    const run = state.run;
    state.loading = true;
    countEl.textContent = "Loading…";
    try {
      // fetch TMDB pages until there are enough posters for the rows to show
      while (grid.children.length < state.limit && state.page < state.totalPages) {
        let results = [];
        // a filtered search (e.g. Anime) can have pages with nothing left after
        // filtering, so look up to 3 pages ahead before giving up
        for (let tries = 0; tries < 3 && !results.length && state.page < state.totalPages; tries++) {
          const page = state.page + 1;
          const data = state.q
            ? await TMDB.searchSmart(state.q, state.sin, page)
            : state.genre
            ? await TMDB.byGenre(state.gtype, state.genre, state.gsort, page)
            : await TMDB.list(state.cat, page);
          if (run !== state.run) return;
          state.page = page;
          state.totalPages = data.totalPages;
          // TMDB lists sometimes repeat a title across pages
          results = data.results.filter((r) => !state.seen.has(`${r.mediaType}-${r.tmdbId}`));
        }
        if (!results.length) break;
        results.forEach((r) => state.seen.add(`${r.mediaType}-${r.tmdbId}`));
        grid.insertAdjacentHTML("beforeend", results.map(Cards.tmdbCard).join(""));
        markComingSoon(results);
      }
      // posters past the last full row wait, hidden, for the next "Load more"
      [...grid.children].forEach((c, i) => {
        c.classList.toggle("dc-later", i >= state.limit);
        // the newly shown posters come in one after another
        if (i >= before && i < state.limit) c.style.setProperty("--dx-d", `${Math.min(i - before, 12) * 12}ms`);
      });

      const shown = Math.min(grid.children.length, state.limit);
      countEl.textContent = heading(shown);
      // the count slides in afresh each time it changes
      countEl.classList.remove("dx-count");
      void countEl.offsetWidth;
      countEl.classList.add("dx-count");
      if (!shown) {
        emptyEl.hidden = false;
        emptyEl.innerHTML = `<i class="fa-regular fa-face-meh"></i>${
          state.q ? `Nothing found for "${esc(state.q)}"${state.sin === "all" ? "" : ` in ${SEARCH_IN[state.sin]}`}.` : "Nothing found."
        }`;
        countEl.textContent = "";
      }
      moreBtn.hidden = grid.children.length <= state.limit && state.page >= state.totalPages;
    } catch (e) {
      if (run !== state.run) return;
      countEl.textContent = "";
      emptyEl.hidden = false;
      emptyEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>${esc(e.message)}.<br>
        Check your key in <a href="settings.html#keys">Settings</a> or <code>js/config.js</code>.`;
    } finally {
      if (run === state.run) {
        state.loading = false;
        skeletons.hidden = true;
        skeletons.innerHTML = "";
        moreBtn.disabled = false;
        moreBtn.textContent = "Load more";
      }
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(typing);
    state.q = form.elements.q.value.trim();
    if (state.q) {
      state.genre = "";
      fillGenres();
    }
    syncUi();
    load(true);
  });

  // results update as you type (a short pause after the last letter, so TMDB isn't asked
  // for every keystroke); clearing the box goes back to the list you were on
  let typing;
  form.elements.q.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      const q = form.elements.q.value.trim();
      if (q === state.q) return;
      state.q = q;
      if (q) {
        state.genre = "";
        fillGenres();
      }
      syncUi();
      load(true);
    }, 300);
  });

  // changing "Search in" re-runs the current search straight away
  form.elements.sin.addEventListener("change", () => {
    state.sin = form.elements.sin.value;
    if (!state.q) return syncUi();
    syncUi();
    load(true);
  });

  genreSel.addEventListener("change", () => {
    state.genre = genreSel.value;
    state.q = "";
    form.elements.q.value = "";
    syncUi();
    load(true);
  });

  gsortSel.addEventListener("change", () => {
    state.gsort = gsortSel.value;
    syncUi();
    load(true);
  });

  root.addEventListener("click", (e) => {
    const typeBtn = e.target.closest("[data-gtype]");
    if (typeBtn) {
      state.gtype = typeBtn.dataset.gtype;
      if (state.genre && !TMDB.genresFor(state.gtype).includes(state.genre)) {
        UI.toast(`TMDB has no ${state.genre} category for ${TYPES[state.gtype]}`);
        state.genre = "";
      }
      fillGenres();
      syncUi();
      if (state.genre) load(true);
      return;
    }
    const chip = e.target.closest("[data-cat]");
    if (!chip) return;
    state.cat = chip.dataset.cat;
    state.q = "";
    state.genre = "";
    form.elements.q.value = "";
    fillGenres();
    syncUi();
    load(true);
  });

  moreBtn.addEventListener("click", () => load(false));

  fillGenres();
  syncUi();
  load(true);
})();