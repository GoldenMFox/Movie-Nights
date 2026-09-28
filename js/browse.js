/*
 * Browse pages (Movies, TV Shows, Anime, Favorites, Watchlist):
 * search, sort and filter the list, and load cards in batches so the page
 * stays fast even with hundreds of posters.
 */
(function () {
  const { esc } = UI;
  const root = document.getElementById("browse");
  const page = document.body.dataset.page;
  const BATCH = 60;

  const PAGE = {
    movie: { base: (i) => i.type === "movie", chips: "status" },
    tv: { base: (i) => i.type === "tv", chips: "status" },
    anime: { base: (i) => i.type === "anime", chips: "status" },
    favorites: {
      base: (i) => i.favorite,
      chips: "type",
      empty: "No favorites yet. Tap the heart on any title to add it here.",
    },
    watchlist: {
      base: (i) => i.watchlist,
      chips: "type",
      empty: "Your watchlist is empty. Tap the bookmark on any title to save it for later.",
    },
  }[page];

  const STATUS_CHIPS = [
    { id: "all", label: "All", test: () => true },
    { id: "rated", label: "Rated", test: (i) => i.rating != null },
    { id: "unrated", label: "Not rated", test: (i) => i.rating == null },
    { id: "fav", label: "Favorites", test: (i) => i.favorite },
    { id: "watch", label: "Watchlist", test: (i) => i.watchlist },
    { id: "new", label: "New", test: (i) => i.isNew },
  ];
  const TYPE_CHIPS = [
    { id: "all", label: "All", test: () => true },
    { id: "movie", label: "Movies", test: (i) => i.type === "movie" },
    { id: "tv", label: "TV Shows", test: (i) => i.type === "tv" },
    { id: "anime", label: "Anime", test: (i) => i.type === "anime" },
  ];
  const CHIPS = PAGE.chips === "type" ? TYPE_CHIPS : STATUS_CHIPS;

  // IMDb rating (or TMDB when IMDb isn't known yet); titles not looked up yet go last
  const outside = (i) => {
    const d = window.Ratings ? Ratings.display(i) : {};
    return typeof d.value === "number" ? d.value : -1;
  };

  const SORTS = {
    default: { label: "My order", fn: (a, b) => a.order - b.order },
    "rating-desc": { label: "My rating: high to low", fn: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.order - b.order },
    "rating-asc": { label: "My rating: low to high", fn: (a, b) => (a.rating ?? 99) - (b.rating ?? 99) || a.order - b.order },
    "outside-desc": { label: "IMDb rating: high to low", fn: (a, b) => outside(b) - outside(a) || a.order - b.order },
    "year-desc": { label: "Newest first", fn: (a, b) => b.year - a.year || a.order - b.order },
    "year-asc": { label: "Oldest first", fn: (a, b) => a.year - b.year || a.order - b.order },
    title: { label: "Title A-Z", fn: (a, b) => Lang.title(a).localeCompare(Lang.title(b)) },
  };

  // state lives in the URL, so refresh / back button keep your filters
  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get("q") || "",
    chip: params.get("show") || "all",
    sort: SORTS[params.get("sort")] ? params.get("sort") : "default",
    from: params.get("from") || "",
    to: params.get("to") || "",
    min: params.get("min") || "",
    genre: params.get("genre") || "",
  };
  let shown = BATCH;

  root.innerHTML = `
    <form class="glass-search list-search" role="search">
      <i class="fa-solid fa-magnifying-glass gs-icon" aria-hidden="true"></i>
      <input type="search" name="q" placeholder="Search this list…" aria-label="Search this list" value="${esc(state.q)}" autocomplete="off" />
      <button class="gs-btn" type="submit" aria-label="Search"><i class="fa-solid fa-magnifying-glass"></i></button>
    </form>
    <div class="glass-filters list-filters">
      <span class="glass-select grow">
        <i class="fa-solid fa-masks-theater" aria-hidden="true"></i>
        <select name="genre" aria-label="Genre"></select>
      </span>
      <span class="glass-select">
        <i class="fa-solid fa-arrow-down-wide-short" aria-hidden="true"></i>
        <select name="sort" aria-label="Sort by">
          ${Object.entries(SORTS).map(([k, s]) => `<option value="${k}"${k === state.sort ? " selected" : ""}>${s.label}</option>`).join("")}
        </select>
      </span>
      <span class="glass-select">
        <i class="fa-solid fa-star" aria-hidden="true"></i>
        <select name="min" aria-label="My rating">
          ${[["", "Any rating"], ["5", "Rated 5+"], ["7", "Rated 7+"], ["8", "Rated 8+"], ["9", "Rated 9+"], ["10", "Rated 10"]]
            .map(([v, l]) => `<option value="${v}"${v === state.min ? " selected" : ""}>${l}</option>`)
            .join("")}
        </select>
      </span>
      <span class="glass-years" title="Years">
        <i class="fa-regular fa-calendar" aria-hidden="true"></i>
        <input type="number" name="from" placeholder="1900" aria-label="Year from" value="${esc(state.from)}" />
        <span aria-hidden="true">–</span>
        <input type="number" name="to" placeholder="${new Date().getFullYear()}" aria-label="Year to" value="${esc(state.to)}" />
      </span>
      <button class="glass-round reset" type="button" aria-label="Reset filters" title="Reset filters"><i class="fa-solid fa-rotate-left"></i></button>
    </div>
    <div class="chips" role="group" aria-label="Show"></div>
    <p class="result-count" aria-live="polite"></p>
    <div class="movie-grid"></div>
    <div class="empty-state" hidden></div>
    <div class="load-more"><button class="btn" type="button" hidden>Show more</button></div>`;

  const grid = root.querySelector(".movie-grid");
  const chipsBox = root.querySelector(".chips");
  const countEl = root.querySelector(".result-count");
  const moreBtn = root.querySelector(".load-more button");
  const emptyEl = root.querySelector(".empty-state");
  const genreSel = root.querySelector('[name="genre"]');

  const filtersInUse = () => !!(state.sort !== "default" || state.min || state.from || state.to || state.genre);
  const tools = UI.foldTools(document.querySelector(".page-title"), {
    search: root.querySelector(".list-search"),
    filters: root.querySelector(".list-filters"),
    openSearch: !!state.q,
    openFilters: filtersInUse(),
  });

  function baseList() {
    return Store.all().filter(PAGE.base);
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const chip = CHIPS.find((c) => c.id === state.chip) || CHIPS[0];
    const from = parseInt(state.from, 10);
    const to = parseInt(state.to, 10);
    const min = parseFloat(state.min);
    return baseList()
      .filter(chip.test)
      .filter((i) => !q || Lang.matches(i, q))
      .filter((i) => !from || i.year >= from)
      .filter((i) => !to || i.year <= to)
      .filter((i) => isNaN(min) || (i.rating != null && i.rating >= min))
      .filter((i) => !state.genre || (i.genres || []).includes(state.genre))
      .sort(SORTS[state.sort].fn);
  }

  function renderChips() {
    const list = baseList();
    chipsBox.innerHTML = CHIPS.map((c) => {
      const n = list.filter(c.test).length;
      if (!n && c.id !== "all") return "";
      return `<button class="chip${c.id === state.chip ? " active" : ""}" data-chip="${c.id}" aria-pressed="${c.id === state.chip}">
        ${c.label}<span class="count">${n}</span></button>`;
    }).join("");
  }

  // genres that appear in this list, with how many titles have each
  function renderGenres() {
    const counts = {};
    baseList().forEach((i) => (i.genres || []).forEach((g) => (counts[g] = (counts[g] || 0) + 1)));
    if (page === "anime") delete counts.Animation; // every anime has it
    const names = Object.keys(counts).sort();
    if (state.genre && !counts[state.genre]) names.unshift(state.genre);
    genreSel.innerHTML =
      `<option value="">All genres</option>` +
      names.map((g) => `<option value="${esc(g)}"${g === state.genre ? " selected" : ""}>${esc(g)} (${counts[g] || 0})</option>`).join("");
  }

  function render() {
    const items = filtered();
    const total = baseList().length;
    renderChips();
    renderGenres();
    tools.mark(state.q.trim(), filtersInUse());
    countEl.textContent = items.length === total ? `${total} titles` : `Showing ${items.length} of ${total} titles`;

    emptyEl.hidden = items.length > 0;
    if (!items.length) {
      emptyEl.innerHTML = total
        ? '<i class="fa-regular fa-face-meh"></i>Nothing matches these filters.<br><br><button class="btn reset-inline" type="button">Reset filters</button>'
        : `<i class="fa-regular fa-face-smile"></i>${esc(PAGE.empty || "Nothing here yet.")}`;
    }

    grid.innerHTML = items.slice(0, shown).map(Cards.card).join("");
    moreBtn.hidden = items.length <= shown;
    moreBtn.textContent = `Show more (${items.length - Math.min(shown, items.length)} left)`;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.chip !== "all") p.set("show", state.chip);
    if (state.sort !== "default") p.set("sort", state.sort);
    if (state.from) p.set("from", state.from);
    if (state.to) p.set("to", state.to);
    if (state.min) p.set("min", state.min);
    if (state.genre) p.set("genre", state.genre);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  function set(patch) {
    Object.assign(state, patch);
    shown = BATCH;
    syncUrl();
    render();
  }

  let typing;
  // the round button applies the search straight away (typing already filters live)
  root.querySelector(".list-search").addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(typing);
    set({ q: e.target.elements.q.value });
  });
  root.querySelector('[name="q"]').addEventListener("input", (e) => {
    clearTimeout(typing);
    typing = setTimeout(() => set({ q: e.target.value }), 150);
  });
  ["sort", "min", "from", "to", "genre"].forEach((name) =>
    root.querySelector(`[name="${name}"]`).addEventListener("change", (e) => set({ [name]: e.target.value }))
  );

  function reset() {
    root.querySelectorAll(".list-search input, .list-filters input").forEach((i) => (i.value = ""));
    root.querySelector('[name="sort"]').value = "default";
    root.querySelector('[name="min"]').value = "";
    set({ q: "", chip: "all", sort: "default", from: "", to: "", min: "", genre: "" });
  }

  root.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (chip) set({ chip: chip.dataset.chip });
    if (e.target.closest(".reset, .reset-inline")) reset();
  });

  moreBtn.addEventListener("click", () => {
    shown += BATCH;
    render();
  });

  // load the next batch automatically when you scroll near the bottom
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !moreBtn.hidden) {
          shown += BATCH;
          render();
        }
      },
      { rootMargin: "600px" }
    ).observe(moreBtn.parentElement);
  }

  // re-filter when you favorite / rate / remove something
  Store.onChange(() => render());

  render();
})();
