/*
 * Discover page: browse and search all of TMDB (trending, popular, in cinemas,
 * coming soon, top rated, anime) and add anything to your library or watchlist.
 * Needs a TMDB key (js/config.js or Profile -> Settings).
 */
(function () {
  const { esc } = UI;
  const root = document.getElementById("discover");

  if (!TMDB.enabled()) {
    root.innerHTML = `<div class="panel" style="max-width:720px">
      <h2><i class="fa-solid fa-key"></i> Connect TMDB to discover new titles</h2>
      <p>Discover shows what's trending, popular, in cinemas and coming soon, using TMDB's free API.
         It needs a TMDB API key (takes about 2 minutes):</p>
      <ol style="line-height:2">
        <li>Create a free account at <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org/signup</a> and confirm your email.</li>
        <li>Go to <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Settings → API</a> and request a key (choose "Personal / Developer").</li>
        <li>Copy the <strong>API Key</strong> (or the API Read Access Token).</li>
        <li>Paste it in <a href="profile.html#settings">Profile → Settings</a>, or into <code>js/config.js</code> so it works everywhere.</li>
      </ol>
    </div>`;
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
    </div>
    <div class="chips" role="group" aria-label="Category">
      ${Object.entries(TMDB.CATEGORIES)
        .map(([k, c]) => `<button class="chip" type="button" data-cat="${k}">${c.label}</button>`)
        .join("")}
    </div>
    <p class="result-count" aria-live="polite"></p>
    <div class="movie-grid"></div>
    <div class="empty-state" hidden></div>
    <div class="load-more"><button class="btn" type="button" hidden>Load more</button></div>
    <p class="tmdb-note">Data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
      Titles already in your library show your own rating.</p>`;

  const grid = root.querySelector(".movie-grid");
  const countEl = root.querySelector(".result-count");
  const moreBtn = root.querySelector(".load-more button");
  const emptyEl = root.querySelector(".empty-state");
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
  window.addEventListener("resize", moveSegment);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveSegment);

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

  async function load(reset) {
    if (reset) {
      state.run++;
      state.loading = false;
      state.page = 0;
      state.totalPages = 1;
      state.seen.clear();
      grid.innerHTML = "";
      emptyEl.hidden = true;
    }
    if (state.loading || state.page >= state.totalPages) return;
    const run = state.run;
    state.loading = true;
    moreBtn.hidden = true;
    countEl.textContent = "Loading…";
    try {
      let results = [];
      // a filtered search (e.g. Anime) can have pages with nothing left after
      // filtering, so look up to 3 pages ahead before giving up
      for (let tries = 0; tries < 3 && !results.length && state.page < state.totalPages; tries++) {
        const page = state.page + 1;
        const data = state.q
          ? await TMDB.searchIn(state.q, state.sin, page)
          : state.genre
          ? await TMDB.byGenre(state.gtype, state.genre, state.gsort, page)
          : await TMDB.list(state.cat, page);
        if (run !== state.run) return;
        state.page = page;
        state.totalPages = data.totalPages;
        // TMDB lists sometimes repeat a title across pages
        results = data.results.filter((r) => !state.seen.has(`${r.mediaType}-${r.tmdbId}`));
      }
      results.forEach((r) => state.seen.add(`${r.mediaType}-${r.tmdbId}`));
      grid.insertAdjacentHTML("beforeend", results.map(Cards.tmdbCard).join(""));

      const shown = grid.children.length;
      countEl.textContent = heading(shown);
      if (!shown) {
        emptyEl.hidden = false;
        emptyEl.innerHTML = `<i class="fa-regular fa-face-meh"></i>${
          state.q ? `Nothing found for "${esc(state.q)}"${state.sin === "all" ? "" : ` in ${SEARCH_IN[state.sin]}`}.` : "Nothing found."
        }`;
        countEl.textContent = "";
      }
      moreBtn.hidden = state.page >= state.totalPages;
    } catch (e) {
      if (run !== state.run) return;
      countEl.textContent = "";
      emptyEl.hidden = false;
      emptyEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>${esc(e.message)}.<br>
        Check your key in <a href="profile.html#settings">Profile → Settings</a> or <code>js/config.js</code>.`;
    } finally {
      if (run === state.run) state.loading = false;
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

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => entries[0].isIntersecting && !moreBtn.hidden && load(false), { rootMargin: "600px" }).observe(
      moreBtn.parentElement
    );
  }

  fillGenres();
  syncUi();
  load(true);
})();