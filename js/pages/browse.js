/*
 * Browse pages (Movies, TV Shows, Anime, Watchlist):
 * search, sort and filter the list, and load cards in batches so the page
 * stays fast even with hundreds of posters.
 *
 * The Watchlist page holds two lists, Plan to watch and Favorites: a row of each on
 * top, and "See all" opens the full list below them (with a switch between the two).
 */
(function () {
  const { esc } = UI;
  const root = document.getElementById("browse");
  const page = document.body.dataset.page;
  const BATCH = 60;

  // signed out: there's no library to show, only the invitation to start your own
  if (Store.guest) {
    root.innerHTML = UI.signInPrompt();
    return;
  }

  const LISTS = {
    watch: {
      label: "Plan to watch",
      icon: "fa-bookmark",
      base: (i) => i.watchlist,
      chips: "type",
      empty: "Nothing planned yet. Tap the bookmark on any title to save it for later.",
    },
    fav: {
      label: "Favorites",
      icon: "fa-heart",
      base: (i) => i.favorite,
      chips: "type",
      empty: "No favorites yet. Tap the heart on any title to add it here.",
    },
  };
  const isLists = page === "watchlist";
  // your own lists (Store.lists()) join Plan to watch and Favorites as "c-<id>"
  function syncLists() {
    Object.keys(LISTS).forEach((k) => k.startsWith("c-") && delete LISTS[k]);
    Store.lists().forEach((l) => {
      const ids = new Set(l.items);
      LISTS[`c-${l.id}`] = {
        label: l.name,
        icon: "fa-list-ul",
        custom: l.id,
        order: l.items,
        base: (i) => ids.has(i.id),
        chips: "type",
        empty: `Nothing in "${l.name}" yet.`,
      };
    });
  }
  if (isLists) syncLists();
  const startParams = new URLSearchParams(location.search);
  let PAGE = isLists
    ? LISTS[startParams.get("list")] || LISTS.watch
    : {
        movie: { base: (i) => i.type === "movie", chips: "status" },
        tv: { base: (i) => i.type === "tv", chips: "status" },
        anime: { base: (i) => i.type === "anime", chips: "status" },
      }[page];

  // watched = in your library, unless it's only on your Watchlist (a score or a watch date
  // always counts)
  const seen = (i) => i.rating != null || !!i.watchedAt || !i.watchlist;
  const STATUS_CHIPS = [
    { id: "all", label: "All", test: () => true },
    { id: "watched", label: "Watched", test: seen },
    { id: "rated", label: "Rated", test: (i) => i.rating != null },
    { id: "unrated", label: "Not rated", test: (i) => i.rating == null },
    { id: "fav", label: "Favorites", test: (i) => i.favorite },
    { id: "watch", label: "Watchlist", test: (i) => i.watchlist },
    { id: "new", label: "New releases", test: (i) => Store.isRecent(i) },
  ];
  const TYPE_CHIPS = [
    { id: "all", label: "All", test: () => true },
    { id: "movie", label: "Movies", test: (i) => i.type === "movie" },
    { id: "tv", label: "TV Shows", test: (i) => i.type === "tv" },
    { id: "anime", label: "Anime", test: (i) => i.type === "anime" },
  ];
  const CHIPS = PAGE.chips === "type" ? TYPE_CHIPS.slice() : STATUS_CHIPS;
  // Watchlist page: what you can watch tonight on the streaming services you picked in Profile
  if (isLists && window.Watch) CHIPS.push({ id: "services", label: "On my services", test: (i) => (Watch.onMine(i) || []).length > 0 });

  // IMDb rating (or TMDB when IMDb isn't known yet); titles not looked up yet go last
  const outside = (i) => {
    const d = window.Ratings ? Ratings.display(i) : {};
    return typeof d.value === "number" ? d.value : -1;
  };

  // when a title went on the list you're looking at (Watchlist / Favorites; before these were
  // recorded: when it joined your library), and its release date (or its year)
  const addedAt = (i) => (state.list === "fav" ? i.favoriteAt : state.list === "watch" ? i.watchlistAt : 0) || 0;
  const releasedAt = (i) => Store.releaseOf(i) || (i.year ? `${i.year}-07-01` : "");

  const SORTS = {
    default: { label: "My order", fn: (a, b) => a.order - b.order },
    added: { label: "Recently added", fn: (a, b) => addedAt(b) - addedAt(a) || b.order - a.order },
    released: { label: "Newest releases", fn: (a, b) => releasedAt(b).localeCompare(releasedAt(a)) || b.order - a.order },
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
    list: isLists && LISTS[params.get("list")] ? params.get("list") : "",
  };
  let shown = BATCH;

  const listHtml = `
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

  // Watchlist page: a row per list, then the full list (opened by "See all")
  root.innerHTML = isLists
    ? `<div class="wl-welcome"></div>
      <section class="wl-coming" hidden>
        <div class="row-head"><h2><i class="fa-regular fa-calendar"></i> Coming up</h2><div class="top10-switch wl-type" role="group" aria-label="Show" data-type-row="coming"></div></div>
        <div class="wl-coming-list"></div>
      </section>
      <div class="wl-rows"></div>
      <div class="wl-new">
        <button type="button" class="btn wl-new-btn"><i class="fa-solid fa-plus"></i> New list</button>
        <form class="wl-new-form" hidden>
          <input class="input" name="name" maxlength="40" placeholder="e.g. Halloween marathon, Date night" aria-label="New list name" autocomplete="off" />
          <button class="btn btn-primary" type="submit">Create</button>
          <button class="btn wl-new-cancel" type="button">Cancel</button>
        </form>
      </div>
      <section class="wl-panel"${state.list ? "" : " hidden"}>
        <h2 class="wl-title">All titles</h2>
        <div class="wl-switch-row">
          <div class="wl-switch" role="group" aria-label="Which list"></div>
          <button type="button" class="wl-close" aria-label="Close the full list" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="wl-list-tools" hidden>
          <button type="button" class="btn btn-primary wl-add-panel"><i class="fa-solid fa-plus"></i> Add titles</button>
          <button type="button" class="btn wl-rename"><i class="fa-solid fa-pen"></i> Rename</button>
          <button type="button" class="btn wl-delete"><i class="fa-solid fa-trash-can"></i> Delete list</button>
        </div>
        ${listHtml}
      </section>`
    : listHtml;
  const panel = root.querySelector(".wl-panel");

  // Watchlist page: "What should I watch?" next to the page title (js/components/picker.js)
  if (isLists) {
    const title = document.querySelector(".page-title");
    const head = document.createElement("div");
    head.className = "page-head wl-head";
    title.before(head);
    head.append(title);
    head.insertAdjacentHTML(
      "beforeend",
      '<button class="btn btn-primary random-pick" type="button"><i class="fa-solid fa-shuffle"></i><span>What should I watch?</span></button>'
    );
  }

  const grid = root.querySelector(".movie-grid");
  const chipsBox = root.querySelector(".chips");
  const countEl = root.querySelector(".result-count");
  const moreBtn = root.querySelector(".load-more button");
  const emptyEl = root.querySelector(".empty-state");
  const genreSel = root.querySelector('[name="genre"]');

  // Movies / TV Shows / Anime: the page's motion (css: "Library pages: motion"), unless motion
  // is turned down. The grid is redrawn on every change (rating, removing...), so posters only
  // flow in when the view itself changes: opening the page, a chip, a search or filter, Show more.
  const fx = !isLists && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let animateFrom = 0; // posters from this one on flow in at the next draw (null: none)
  const pill = document.createElement("span");
  pill.className = "chip-indicator intro";
  pill.setAttribute("aria-hidden", "true");
  if (fx) {
    document.documentElement.classList.add("lb-fx");
    chipsBox.classList.add("lb-intro");
    setTimeout(() => chipsBox.classList.remove("lb-intro"), 1200);
    pill.addEventListener("animationend", () => pill.classList.remove("intro"));
    window.addEventListener("resize", () => movePill());
  }
  // the red pill sits behind the picked chip and glides to the next one
  function movePill() {
    if (!fx) return;
    if (pill.parentNode !== chipsBox) chipsBox.prepend(pill);
    const on = chipsBox.querySelector(".chip.active");
    pill.classList.toggle("off", !on);
    if (!on) return;
    pill.style.left = `${on.offsetLeft}px`;
    pill.style.top = `${on.offsetTop}px`;
    pill.style.width = `${on.offsetWidth}px`;
    pill.style.height = `${on.offsetHeight}px`;
  }

  const filtersInUse = () => !!(state.sort !== "default" || state.min || state.from || state.to || state.genre);
  const tools = UI.foldTools(isLists ? root.querySelector(".wl-title") : document.querySelector(".page-title"), {
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
    // only the chips are redrawn: the red pill stays, so it can glide. (On phones the row
    // scrolls sideways: it stays where it was, then the picked chip glides into view.)
    const scrolled = chipsBox.scrollLeft;
    const first = !chipsBox.querySelector(".chip");
    chipsBox.querySelectorAll(".chip").forEach((c) => c.remove());
    chipsBox.insertAdjacentHTML("beforeend", CHIPS.map((c) => {
      const n = list.filter(c.test).length;
      if (!n && c.id !== "all") return "";
      return `<button class="chip${c.id === state.chip ? " active" : ""}" data-chip="${c.id}" aria-pressed="${c.id === state.chip}">
        ${c.label}<span class="count">${n}</span></button>`;
    }).join(""));
    chipsBox.scrollLeft = scrolled;
    movePill();
    if (UI.chipIntoView) UI.chipIntoView(chipsBox, !first);
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

  // Watchlist page: an All / Movies / TV / Anime switch next to each row's title (Coming up
  // too). Each row keeps its own choice (remembered in mn:wlTypes); a type only gets a
  // button when that row has some of it. "See all" opens the full list on the same type.
  const TYPE_TABS = [
    ["all", "All"],
    ["movie", "Movies"],
    ["tv", "TV"],
    ["anime", "Anime"],
  ];
  let rowType = Store.read("mn:wlTypes", {});
  const typeOf = (row) => rowType[row] || "all";
  const ofType = (type) => (i) => type === "all" || i.type === type;
  function paintTypes(sw, items) {
    const row = sw.dataset.typeRow;
    const have = new Set(items.map((i) => i.type));
    // (a choice with nothing left in it goes back to All)
    if (typeOf(row) !== "all" && !have.has(typeOf(row))) delete rowType[row];
    const on = typeOf(row);
    const tabs = TYPE_TABS.filter(([t]) => t === "all" || have.has(t));
    sw.hidden = tabs.length < 3; // only one kind of title: nothing to switch
    // (the buttons are only redrawn when the choices change; the red pill that glides to the
    // picked one comes from js/core/layout.js)
    const key = tabs.map(([t]) => t).join();
    if (sw.dataset.tabs !== key) {
      sw.dataset.tabs = key;
      sw.innerHTML = tabs.map(([t, label]) => `<button type="button" class="top10-tab" data-type="${t}">${label}</button>`).join("");
    }
    sw.querySelectorAll("[data-type]").forEach((b) => {
      const active = b.dataset.type === on;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", active);
    });
  }

  // Plan to watch and Favorites: "Recently added" (when it went on that list) or "Newest"
  // (release date), a switch on each row, remembered (mn:wlSort). "See all" opens the full list
  // in the same order.
  const ORDER_ROWS = ["watch", "fav"];
  let rowSort = Store.read("mn:wlSort", {});
  const sortOf = (row) => (rowSort[row] === "released" ? "released" : "added");
  const orderFn = (row) => {
    const at = row === "fav" ? (i) => i.favoriteAt || 0 : (i) => i.watchlistAt || 0;
    return sortOf(row) === "released"
      ? (a, b) => releasedAt(b).localeCompare(releasedAt(a)) || b.order - a.order
      : (a, b) => at(b) - at(a) || b.order - a.order;
  };
  function paintSort(sw) {
    const on = sortOf(sw.dataset.sortRow);
    sw.querySelectorAll("[data-order]").forEach((b) => {
      b.classList.toggle("active", b.dataset.order === on);
      b.setAttribute("aria-pressed", b.dataset.order === on);
    });
  }
  if (isLists)
    root.addEventListener("click", (e) => {
      const b = e.target.closest(".wl-sort [data-order]");
      if (!b) return;
      const row = b.closest(".wl-sort").dataset.sortRow;
      if (sortOf(row) === b.dataset.order) return;
      if (b.dataset.order === "added") delete rowSort[row];
      else rowSort[row] = b.dataset.order;
      Store.write("mn:wlSort", rowSort);
      const sec = b.closest(".wl-row");
      sec.dataset.resort = "1"; // (the row starts at the beginning, its posters settle in)
      renderRows();
    });

  // after a switch, the row's posters (or Coming up's titles) settle in, one after another
  function settle(box) {
    [...box.children].slice(0, 12).forEach((c, n) => {
      c.classList.remove("wl-in");
      void c.offsetWidth;
      c.style.setProperty("--wl-d", `${n * 35}ms`);
      c.classList.add("wl-in");
    });
  }
  if (isLists)
    root.addEventListener("click", (e) => {
      const b = e.target.closest(".wl-type [data-type]");
      if (!b) return;
      const row = b.closest(".wl-type").dataset.typeRow;
      if (b.dataset.type === "all") delete rowType[row];
      else rowType[row] = b.dataset.type;
      Store.write("mn:wlTypes", rowType);
      renderRows();
    });

  // Watchlist page: a row per list (newest first) and the switch above the full list
  function renderRows() {
    syncLists();
    if (state.list && !LISTS[state.list]) {
      // that list was just deleted
      state.list = "";
      panel.hidden = true;
      syncUrl();
    }
    PAGE = LISTS[state.list] || LISTS.watch;
    const all = Store.all();
    root.querySelector(".wl-welcome").innerHTML = all.length ? "" : UI.welcome();
    renderComing(all);

    // one section per list: add the new ones, drop deleted ones, keep the rest (and their scroll)
    const box = root.querySelector(".wl-rows");
    const keys = Object.keys(LISTS);
    box.querySelectorAll(".wl-row").forEach((sec) => !keys.includes(sec.dataset.list) && sec.remove());
    keys.forEach((k, n) => {
      let sec = box.querySelector(`.wl-row[data-list="${CSS.escape(k)}"]`);
      if (!sec) {
        sec = document.createElement("section");
        sec.className = "row-section wl-row";
        sec.dataset.list = k;
        const custom = LISTS[k].custom;
        const addBtn = (cls, label) =>
          custom ? `<button type="button" class="${cls}" data-add-to="${esc(custom)}"><i class="fa-solid fa-plus"></i> ${label}</button>` : "";
        const sortSwitch = ORDER_ROWS.includes(k)
          ? `<div class="top10-switch wl-sort" role="group" aria-label="Order" data-sort-row="${esc(k)}">
              <button type="button" class="top10-tab" data-order="added" title="Recently added to this list"><i class="fa-regular fa-clock"></i><span class="wl-sort-l"> Recently added</span><span class="wl-sort-s"> Added</span></button>
              <button type="button" class="top10-tab" data-order="released" title="Newest releases first"><i class="fa-solid fa-film"></i><span class="wl-sort-l"> Newest releases</span><span class="wl-sort-s"> Newest</span></button>
            </div>`
          : "";
        sec.innerHTML = `<div class="row-head"><h2><i class="fa-solid ${LISTS[k].icon}"></i> <span class="wl-name"></span></h2>
            <div class="top10-switch wl-type" role="group" aria-label="Show" data-type-row="${esc(k)}"></div>
            ${sortSwitch}
            <span class="wl-row-tools">${addBtn("wl-add", "Add titles")}<a href="?list=${encodeURIComponent(k)}" class="wl-see" data-see="${esc(k)}"></a></span></div>
          <div class="movie-row"></div>
          <div class="wl-row-empty" hidden><span></span>${addBtn("btn btn-primary wl-add-big", "Add titles")}</div>`;
      }
      if (box.children[n] !== sec) box.insertBefore(sec, box.children[n] || null);
      sec.querySelector(".wl-name").textContent = LISTS[k].label;
      sec.querySelector(".wl-row-empty span").textContent = LISTS[k].empty;
    });
    root.querySelector(".wl-switch").innerHTML = keys
      .map((k) => `<button type="button" data-list-switch="${esc(k)}"><i class="fa-solid ${LISTS[k].icon}"></i> ${esc(LISTS[k].label)}<span class="count"></span></button>`)
      .join("");
    root.querySelector(".wl-list-tools").hidden = !PAGE.custom;

    root.querySelectorAll(".wl-row").forEach((sec) => {
      const k = sec.dataset.list;
      const row = sec.querySelector(".movie-row");
      const scroll = row.scrollLeft;
      // your own lists: in the order you added them (newest first)
      const order = LISTS[k].order;
      const inList = all.filter(LISTS[k].base);
      paintTypes(sec.querySelector(".wl-type"), inList);
      const sortSw = sec.querySelector(".wl-sort");
      if (sortSw) paintSort(sortSw);
      const items = inList
        .filter(ofType(typeOf(k)))
        .sort(order ? (a, b) => order.indexOf(a.id) - order.indexOf(b.id) : ORDER_ROWS.includes(k) ? orderFn(k) : (a, b) => b.order - a.order);
      const typeChanged = (row.dataset.type != null && row.dataset.type !== typeOf(k)) || sec.dataset.resort === "1";
      delete sec.dataset.resort;
      row.dataset.type = typeOf(k);
      row.innerHTML = items.slice(0, 20).map(Cards.card).join("");
      row.hidden = !items.length;
      row.scrollLeft = typeChanged ? 0 : scroll; // (a new type starts at the beginning)
      if (typeChanged) settle(row);
      sec.querySelector(".wl-row-empty").hidden = !!items.length;
      const see = sec.querySelector(".wl-see");
      see.hidden = !items.length;
      see.innerHTML = `See all ${items.length} <i class="fa-solid fa-arrow-down"></i>`;
    });
    root.querySelectorAll("[data-list-switch]").forEach((b) => {
      const k = b.dataset.listSwitch;
      b.classList.toggle("active", LISTS[k] === PAGE);
      b.setAttribute("aria-pressed", LISTS[k] === PAGE);
      b.querySelector(".count").textContent = all.filter(LISTS[k].base).length;
    });
  }

  // "Coming up": movies you're waiting for and new seasons / episodes of your shows
  function renderComing(all) {
    const box = root.querySelector(".wl-coming");
    if (!window.Watch) return;
    const upcoming = Watch.candidates(all)
      .map((i) => ({ i, u: Watch.upcoming(i) }))
      .filter((x) => x.u)
      .sort((a, b) => a.u.date.localeCompare(b.u.date));
    paintTypes(box.querySelector(".wl-type"), upcoming.map((x) => x.i));
    const list = upcoming.filter((x) => ofType(typeOf("coming"))(x.i)).slice(0, 12);
    box.hidden = !upcoming.length;
    const comingList = box.querySelector(".wl-coming-list");
    const typeChanged = comingList.dataset.type != null && comingList.dataset.type !== typeOf("coming");
    comingList.dataset.type = typeOf("coming");
    if (typeChanged) requestAnimationFrame(() => settle(comingList));
    box.querySelector(".wl-coming-list").innerHTML = list
      .map(
        ({ i, u }) => `<a class="coming-item${u.soon ? " soon" : ""}" href="${i.reminder ? `title.html?tmdb=${encodeURIComponent(i.key)}` : `title.html?id=${encodeURIComponent(i.id)}`}">
          <img src="${Store.poster(Cards.posterOf(i), "w154")}" alt="" loading="lazy" />
          <span><strong>${i.reminder ? '<i class="fa-solid fa-bell" title="Reminder"></i> ' : ""}${esc(Lang.title(i))}</strong><small>${esc(u.label)}</small></span>
        </a>`
      )
      .join("");
  }

  // open the full list (or switch it) and bring it into view
  function openList(k, scroll) {
    if (!LISTS[k]) return;
    PAGE = LISTS[k];
    const q = root.querySelector('[name="q"]');
    if (q) q.value = "";
    // (on the type picked on that row: Movies there = Movies here; Plan to watch / Favorites in
    // the order picked there too)
    const patch = { list: k, chip: typeOf(k), q: "", genre: "" };
    if (ORDER_ROWS.includes(k)) {
      patch.sort = sortOf(k);
      const sortSel = root.querySelector('[name="sort"]');
      if (sortSel) sortSel.value = patch.sort;
    }
    set(patch);
    panel.hidden = false;
    if (scroll) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function render() {
    if (isLists) renderRows();
    const items = filtered();
    const total = baseList().length;
    renderChips();
    renderGenres();
    tools.mark(state.q.trim(), filtersInUse());
    const count = items.length === total ? `${total} titles` : `Showing ${items.length} of ${total} titles`;
    if (count !== countEl.textContent) {
      countEl.textContent = count;
      // the count slides in afresh when it changes
      if (fx) {
        countEl.classList.remove("lb-count");
        void countEl.offsetWidth;
        countEl.classList.add("lb-count");
      }
    }

    emptyEl.hidden = items.length > 0;
    if (!items.length) {
      emptyEl.innerHTML = total
        ? '<i class="fa-regular fa-face-meh"></i>Nothing matches these filters.<br><br><button class="btn reset-inline" type="button">Reset filters</button>'
        : `<i class="fa-regular fa-face-smile"></i>${esc(PAGE.empty || "Nothing here yet.")}`;
    }

    grid.innerHTML = items.slice(0, shown).map(Cards.card).join("");
    if (fx && animateFrom != null)
      [...grid.children].slice(animateFrom).forEach((c, i) => {
        c.classList.add("lb-in");
        c.style.setProperty("--lb-d", `${Math.min(i, 12) * 12}ms`);
      });
    animateFrom = null;
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
    if (state.list) p.set("list", state.list);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  function set(patch) {
    Object.assign(state, patch);
    shown = BATCH;
    animateFrom = 0;
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
    const see = e.target.closest("[data-see]");
    if (see) {
      e.preventDefault();
      openList(see.dataset.see, true);
    }
    const sw = e.target.closest("[data-list-switch]");
    if (sw) openList(sw.dataset.listSwitch, false);
    if (e.target.closest(".wl-close")) {
      panel.hidden = true;
      set({ list: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // your own lists: new, rename, delete
    const form = root.querySelector(".wl-new-form");
    if (e.target.closest(".wl-new-btn")) {
      form.hidden = false;
      root.querySelector(".wl-new-btn").hidden = true;
      form.elements.name.focus();
    }
    if (e.target.closest(".wl-new-cancel")) {
      form.hidden = true;
      root.querySelector(".wl-new-btn").hidden = false;
    }
    const add = e.target.closest("[data-add-to]");
    if (add) Cards.openListAdder(add.dataset.addTo);
    if (e.target.closest(".wl-add-panel") && PAGE.custom) Cards.openListAdder(PAGE.custom);
    if (e.target.closest(".wl-rename") && PAGE.custom) {
      const listId = PAGE.custom;
      UI.ask({ icon: "fa-pen", title: "Rename this list", value: PAGE.label, placeholder: "List name", ok: "Rename" }).then((name) => {
        if (name) Store.renameList(listId, name);
      });
    }
    if (e.target.closest(".wl-delete") && PAGE.custom) {
      const listId = PAGE.custom;
      UI.confirm({
        icon: "fa-trash-can",
        title: `Delete "${PAGE.label}"?`,
        text: "The list goes away; the titles stay in your library.",
        ok: "Delete list",
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        Store.deleteList(listId);
        UI.toast("List deleted");
      });
    }
  });

  if (isLists)
    root.querySelector(".wl-new-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = e.target.elements.name;
      if (!input.value.trim()) return input.focus();
      const id = Store.createList(input.value);
      UI.toast(`List "${input.value.trim()}" made`);
      input.value = "";
      e.target.hidden = true;
      root.querySelector(".wl-new-btn").hidden = false;
      openList(`c-${id}`, true);
      Cards.openListAdder(id); // straight on to filling it
    });

  moreBtn.addEventListener("click", () => {
    animateFrom = shown;
    shown += BATCH;
    render();
  });

  // load the next batch automatically when you scroll near the bottom
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !moreBtn.hidden) {
          animateFrom = shown;
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
  // Watchlist page: look up streaming services and release dates (a few at a time, kept for days)
  if (isLists && window.Watch) {
    Watch.onChange(() => render());
    const lists = () => Store.all().filter((i) => i.watchlist || i.favorite);
    Watch.loadNext(Watch.candidates(Store.all())).then(() => Watch.loadProviders(lists()));
  }
  // opened straight on a list (e.g. from Favorites in the menu): show it
  if (isLists && state.list) setTimeout(() => panel.scrollIntoView({ block: "start" }), 50);
})();
