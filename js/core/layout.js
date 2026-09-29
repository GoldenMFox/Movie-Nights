/*
 * Layout: builds the navbar and footer on every page (so they only exist in
 * one place), and handles dark/light mode, search and the profile menu.
 */
(function () {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const PAGES = [
    { id: "home", href: "index.html", label: "Home", icon: "fa-solid fa-house" },
    { id: "discover", href: "discover.html", label: "Discover", icon: "fa-solid fa-compass" },
    { id: "movie", href: "movies.html", label: "Movies", icon: "fa-solid fa-film" },
    { id: "tv", href: "tv-shows.html", label: "TV Shows", icon: "fa-solid fa-tv" },
    { id: "anime", href: "anime.html", label: "Anime", icon: "fa-solid fa-clapperboard" },
    { id: "favorites", href: "favorites.html", label: "Favorites", icon: "fa-solid fa-heart" },
    { id: "watchlist", href: "watchlist.html", label: "Watchlist", icon: "fa-solid fa-bookmark" },
    { id: "tiers", href: "tier-list.html", label: "Tier List", icon: "fa-solid fa-ranking-star" },
  ];

  const current = document.body.dataset.page;

  // Russian names (and posters) on / off: a switch in the profile menu, EN | RU in the side menu
  const langToggle = (where) =>
    where === "in-profile"
      ? `<label class="menu-switch lang-switch" title="Movie, show and anime names and posters in Russian">
          <i class="fa-solid fa-language"></i><span>Russian titles</span>
          <input type="checkbox" class="lang-switch-input"${Lang.isRu() ? " checked" : ""} />
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>`
      : `<div class="lang-toggle ${where}" role="group" aria-label="Movie names language">
      ${where === "in-menu" ? "<span>Movie names</span>" : ""}
      ${where === "in-profile" ? `<i class="fa-solid fa-language"></i><span>Movie names</span>` : ""}
      <button type="button" data-lang="en" aria-pressed="${!Lang.isRu()}" class="${Lang.isRu() ? "" : "active"}">EN</button>
      <button type="button" data-lang="ru" aria-pressed="${Lang.isRu()}" class="${Lang.isRu() ? "active" : ""}">RU</button>
    </div>`;
  const profile = Store.getProfile();

  // signed in: your Google photo; signed out: a plain user icon
  const USER_ICON = "images/placeholders/user.svg";
  const acct = window.Cloud && Cloud.account();
  const pic = (a) => (a && a.photo) || USER_ICON;
  const avatar = pic(acct);

  // sign in / "Who's watching?" / sign out
  function accountMenu() {
    if (!window.Cloud || !Cloud.enabled) return "";
    const others = Cloud.accounts().filter((a) => !acct || a.uid !== acct.uid);
    const row = (attrs, icon, label) => `<a href="#" ${attrs}>${icon}<span>${label}</span><i class="fa-solid fa-chevron-right"></i></a>`;
    const who = others.length
      ? `<div class="menu-label">Who's watching?</div>${others
          .map((a) => row(`data-cloud-switch="${esc(a.uid)}"`, `<img class="acct-pic" src="${esc(pic(a))}" alt="" referrerpolicy="no-referrer" />`, esc(a.name)))
          .join("")}`
      : "";
    return acct
      ? `<hr />${who}${row('data-cloud="add"', '<i class="fa-solid fa-user-plus"></i>', "Add a profile")}${row(
          'data-cloud="sign-out"',
          '<i class="fa-solid fa-right-from-bracket"></i>',
          "Sign out"
        )}`
      : `<hr />${who}${row('data-cloud="add"', '<i class="fa-brands fa-google"></i>', "Sign in to sync")}`;
  }

  /* ---------------- navbar ---------------- */

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `
    <div class="nav-bar">
      <button class="icon-btn nav-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
      <button class="nav-toggle" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>
      <a class="nav-logo" href="index.html"><img src="images/brand/logo.png" alt="Movie Nights" /></a>
      <div class="nav-menu">
        <div class="nav-menu-head">
          <a class="nav-logo" href="index.html"><img src="images/brand/logo.png" alt="Movie Nights" /></a>
          <button class="nav-close" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <ul class="nav-links">
          <li class="nav-indicator" aria-hidden="true"></li>
          ${PAGES.map(
            (p) =>
              `<li><a href="${p.href}" class="${p.id === current ? "active" : ""}"${p.id === current ? ' aria-current="page"' : ""}><i class="${p.icon}"></i>${p.label}</a></li>`
          ).join("")}
        </ul>
        ${langToggle("in-menu")}
      </div>
      <div class="nav-tools">
        <button class="icon-btn theme-toggle" aria-label="Toggle dark mode">
          <i class="fa-solid fa-moon"></i><i class="fa-solid fa-sun"></i>
        </button>
        <div class="search">
          <button class="icon-btn search-toggle" aria-label="Search (press /)"><i class="fa-solid fa-magnifying-glass"></i></button>
          <div class="search-panel">
            <input type="search" placeholder="Search movies, TV shows & anime..." aria-label="Search movies, TV shows and anime" autocomplete="off" />
            <ul class="search-results"></ul>
          </div>
        </div>
        <div class="profile">
          <button class="user-pic-btn" aria-label="Profile menu">
            <img src="${esc(avatar)}" class="user-pic" alt="" referrerpolicy="no-referrer" />
          </button>
          <div class="profile-menu">
            <div class="user-info">
              <img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer" />
              <div>
                <h2>${esc(profile.name)}</h2>
                ${acct ? '<small class="sync-status"></small>' : '<small class="sync-status">Not signed in</small>'}
              </div>
            </div>
            <hr />
            <a href="favorites.html" class="tablet-link"><i class="fa-solid fa-heart"></i><span>Favorites</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="tier-list.html" class="tablet-link"><i class="fa-solid fa-ranking-star"></i><span>Tier List</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="profile.html"><i class="fa-solid fa-user"></i><span>Profile &amp; stats</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="#" data-action="add-title"><i class="fa-solid fa-plus"></i><span>Add a title</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="profile.html#settings"><i class="fa-solid fa-gear"></i><span>Settings &amp; backup</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="#" class="install-app" hidden><i class="fa-solid fa-mobile-screen"></i><span>Install the app</span><i class="fa-solid fa-chevron-right"></i></a>
            <div class="menu-prefs">
              ${langToggle("in-profile")}
              <label class="menu-switch" title="Title, ratings and buttons under each poster (off: posters only)">
                <i class="fa-solid fa-table-cells-large"></i><span>Poster details</span>
                <input type="checkbox" class="card-details-switch" />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>
            </div>
            ${accountMenu()}
          </div>
        </div>
      </div>
    </div>`;
  document.body.prepend(nav);

  const menu = nav.querySelector(".nav-menu");
  const profileBox = nav.querySelector(".profile");
  const searchBox = nav.querySelector(".search");
  const searchInput = searchBox.querySelector("input");
  const resultsList = searchBox.querySelector(".search-results");

  nav.querySelector(".nav-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.add("open");
  });
  nav.querySelector(".nav-close").addEventListener("click", () => menu.classList.remove("open"));

  /* ---------------- sliding pill behind the nav links ---------------- */

  const linksEl = nav.querySelector(".nav-links");
  const indicator = linksEl.querySelector(".nav-indicator");
  const activeLink = linksEl.querySelector("a.active");

  function moveIndicator(link, instant) {
    if (!link || window.innerWidth <= 1330) return indicator.classList.remove("show");
    const r = link.getBoundingClientRect();
    const box = linksEl.getBoundingClientRect();
    if (instant) indicator.style.transition = "none";
    indicator.style.left = `${r.left - box.left}px`;
    indicator.style.width = `${r.width}px`;
    indicator.classList.add("show");
    if (instant) requestAnimationFrame(() => (indicator.style.transition = ""));
  }

  linksEl.addEventListener("mouseover", (e) => {
    const link = e.target.closest("a");
    if (link) moveIndicator(link);
  });
  linksEl.addEventListener("mouseleave", () => moveIndicator(activeLink));
  window.addEventListener("resize", () => moveIndicator(activeLink, true));
  moveIndicator(activeLink, true);
  // text widths change once the font has loaded
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveIndicator(activeLink, true));

  /* ---------------- only one red search button at a time ---------------- */

  // When a page has its own search pill (e.g. Discover) and its red button is
  // on screen, the navbar search button goes neutral; once you scroll past it,
  // the navbar one turns red again.
  // wait until every page script has run (Discover builds its search bar after this file)
  document.addEventListener("DOMContentLoaded", () => {
    const pageSearch = [...document.querySelectorAll(".gs-btn")];
    if (!pageSearch.length) return;
    const check = () => {
      const top = nav.getBoundingClientRect().bottom; // hidden under the sticky navbar = out of sight
      const onScreen = pageSearch.some((el) => {
        if (el.closest(".fold:not(.open)")) return false; // folded away
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.bottom > top && r.top < window.innerHeight;
      });
      nav.classList.toggle("page-search-visible", onScreen);
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    window.addEventListener("mn:layout", check);
    check();
  });
  /* ---------------- movie names language ---------------- */

  // (listens on the whole page: the switch is also on the app's Profile page)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn || btn.dataset.lang === Lang.get()) return;
    Lang.set(btn.dataset.lang);
    location.reload(); // every list, card and title picks up the new names
  });
  document.addEventListener("change", (e) => {
    if (!e.target.classList.contains("lang-switch-input")) return;
    Lang.set(e.target.checked ? "ru" : "en");
    setTimeout(() => location.reload(), 250); // (lets the switch finish sliding)
  });

  /* ---------------- theme ---------------- */

  nav.querySelector(".theme-toggle").addEventListener("click", () => {
    const light = document.documentElement.dataset.theme !== "light";
    if (light) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("mn:theme", light ? "light" : "dark");
    } catch (e) {}
  });

  /* ---------------- profile menu ---------------- */

  profileBox.querySelector(".user-pic-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    searchBox.classList.remove("open");
    profileBox.classList.toggle("open");
    // get Google sign-in ready now, so tapping "Sign in" can open its window instantly (Safari needs that)
    if (profileBox.classList.contains("open") && window.Cloud && Cloud.enabled) Cloud.prepare();
  });

  // sign in / switch / sign out (profile menu, and the app's Profile page)
  document.addEventListener("click", (e) => {
    const sw = e.target.closest("[data-cloud-switch]");
    const act = e.target.closest("[data-cloud]");
    if (!sw && !act) return;
    e.preventDefault();
    profileBox.classList.remove("open");
    if (sw) Cloud.switchTo(sw.dataset.cloudSwitch);
    else if (act.dataset.cloud === "add") Cloud.signIn();
    else if (act.dataset.cloud === "sign-out" && confirm("Sign out on this device? Your library stays saved in your account.")) Cloud.signOut();
  });

  // "Synced" / "Syncing…" under your name
  const syncEl = nav.querySelector(".sync-status");
  if (syncEl && acct) {
    const LABELS = {
      syncing: '<i class="fa-solid fa-rotate"></i> Syncing…',
      synced: '<i class="fa-solid fa-cloud"></i> Synced',
      offline: '<i class="fa-solid fa-cloud-arrow-up"></i> Offline: will sync later',
      "signed-out": '<i class="fa-solid fa-triangle-exclamation"></i> Sign in again to sync',
    };
    const show = (s) => {
      syncEl.innerHTML = LABELS[s] || "";
      syncEl.dataset.status = s;
    };
    Cloud.onStatus(show);
    show(Cloud.status());
  }

  /* ---------------- search ---------------- */

  let focused = -1;

  function openSearch() {
    profileBox.classList.remove("open");
    searchBox.classList.add("open");
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeSearch() {
    searchBox.classList.remove("open");
  }

  searchBox.querySelector(".search-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    searchBox.classList.contains("open") ? closeSearch() : openSearch();
  });

  // your library straight away, then everything else on TMDB (the same search as Discover,
  // a moment after you stop typing), and a link to all the results on Discover
  let navTyping;
  let navRun = 0;
  const tmdbHit = (hit) => `<li><a href="title.html?tmdb=${hit.mediaType}-${hit.tmdbId}">
      <img src="${Store.poster(hit.poster, "w92")}" alt="" loading="lazy" />
      <span>${esc(Lang.title(hit))}<small>${[hit.year, Store.TYPE_LABEL[hit.type], hit.score ? `TMDB ${hit.score.toFixed(1)}` : ""]
        .filter(Boolean)
        .join(" · ")}</small></span></a></li>`;

  function renderResults() {
    focused = -1;
    const q = searchInput.value.trim();
    const mine = resultsHtml(q);
    const hasMine = mine && !mine.includes("search-empty");
    const tmdbOn = window.TMDB && TMDB.enabled();
    clearTimeout(navTyping);
    const token = ++navRun;
    if (!q) return (resultsList.innerHTML = "");
    if (!tmdbOn) return (resultsList.innerHTML = mine);
    const allLink = `<li class="search-all"><a href="discover.html?q=${encodeURIComponent(q)}"><i class="fa-solid fa-compass"></i><span>All results for "${esc(q)}"</span></a></li>`;
    const head = (label) => `<li class="search-group">${label}</li>`;
    const libPart = hasMine ? head("In your library") + mine : "";
    resultsList.innerHTML = `${libPart}${head("More from TMDB")}<li class="search-empty"><i class="fa-solid fa-spinner fa-spin"></i> Searching…</li>`;
    navTyping = setTimeout(async () => {
      let tmdbPart;
      try {
        const data = await TMDB.searchSmart(q, "all", 1);
        if (token !== navRun) return;
        const hits = data.results.filter((h) => !(window.Cards && Cards.inLibrary(h))).slice(0, 10);
        tmdbPart = hits.length ? head("More from TMDB") + hits.map(tmdbHit).join("") : hasMine ? "" : `<li class="search-empty">Nothing found for "${esc(q)}"</li>`;
      } catch (err) {
        if (token !== navRun) return;
        tmdbPart = `<li class="search-empty">Couldn't search TMDB: ${esc(err.message)}</li>`;
      }
      resultsList.innerHTML = libPart + tmdbPart + allLink;
      focused = -1;
    }, 250);
  }

  // library search results (navbar search, and the app's Library panel)
  // (type: "movie" / "tv" / "anime" to search only those; anything else = everything)
  function resultsHtml(raw, type) {
    const q = String(raw || "").trim().toLowerCase();
    if (!q) return "";
    const hits = Store.all()
      .filter((item) => !["movie", "tv", "anime"].includes(type) || item.type === type)
      .map((item) => {
        // match the English and the Russian name
        const raw = [item.title, item.titleRu].filter(Boolean);
        const names = raw.map((n) => n.toLowerCase());
        let score = names.includes(q) ? 0 : names.some((n) => n.startsWith(q)) ? 1 : names.some((n) => n.includes(q)) ? 2 : String(item.year) === q ? 3 : -1;
        // allow small typos ("the notebok" finds The Notebook); closest names first
        let close = 0;
        if (score < 0 && raw.some((n) => Lang.fuzzyName(n, q))) {
          score = 4;
          close = Math.max(...raw.map((n) => Lang.similarity(n, q)));
        }
        return { item, score, close };
      })
      .filter((h) => h.score >= 0)
      .sort((a, b) => a.score - b.score || b.close - a.close || Lang.title(a.item).localeCompare(Lang.title(b.item)))
      .slice(0, 8);

    return hits.length
      ? hits
          .map(
            ({ item }) => `<li><a href="title.html?id=${encodeURIComponent(item.id)}">
              <img src="${Store.poster(item.poster, "w92")}" alt="" loading="lazy" />
              <span>${esc(Lang.title(item))}<small>${item.year} · ${Store.TYPE_LABEL[item.type] || ""}${
              item.rating != null ? " · ★ " + item.rating : ""
            }</small></span></a></li>`
          )
          .join("")
      : `<li class="search-empty">No titles match "${esc(String(raw).trim())}"</li>`;
  }

  searchInput.addEventListener("input", renderResults);
  searchInput.addEventListener("keydown", (e) => {
    const links = resultsList.querySelectorAll("a");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!links.length) return;
      focused = (focused + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links.forEach((l, i) => l.classList.toggle("focused", i === focused));
      links[focused].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const target = links[focused] || links[0];
      if (target) location.href = target.href;
    } else if (e.key === "Escape") {
      closeSearch();
    }
  });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === "Escape") {
      profileBox.classList.remove("open");
      menu.classList.remove("open");
    }
  });

  document.addEventListener("click", (e) => {
    if (!searchBox.contains(e.target)) closeSearch();
    if (!profileBox.contains(e.target)) profileBox.classList.remove("open");
    if (!menu.contains(e.target)) menu.classList.remove("open");
  });

  /* ---------------- footer ---------------- */

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  const year = new Date().getFullYear();
  const footLink = (p) => `<li><a href="${p.href}"><i class="${p.icon}"></i><span>${p.label}</span></a></li>`;
  footer.innerHTML = `
    <div class="footer-card">
      <div class="footer-brand">
        <a class="footer-logo" href="index.html"><img src="images/brand/logo.png" alt="Movie Nights" /></a>
        <p>A personal list of the movies, TV shows and anime we've watched, rated and ranked,
          plus everything still waiting on the watchlist.</p>
        <div class="footer-cta">
          <a class="footer-btn primary" href="discover.html"><i class="fa-solid fa-compass"></i> Discover something new</a>
          <a class="footer-btn" href="watchlist.html"><i class="fa-solid fa-bookmark"></i> My watchlist</a>
        </div>
      </div>
      <nav class="footer-col" aria-label="Browse">
        <h3>Browse</h3>
        <ul>${PAGES.slice(0, 5).map(footLink).join("")}</ul>
      </nav>
      <nav class="footer-col" aria-label="My lists">
        <h3>My lists</h3>
        <ul>${PAGES.slice(5).map(footLink).join("")}${footLink({ href: "profile.html", label: "Profile &amp; stats", icon: "fa-solid fa-user" })}</ul>
      </nav>
    </div>
    <div class="footer-bottom">
      <span>&copy; 2023&ndash;${year} Movie Nights by Mirzac Nicolae</span>
      <span class="footer-credit">Movie data and images from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a></span>
      <button class="footer-top" type="button" aria-label="Back to top" title="Back to top"><i class="fa-solid fa-arrow-up"></i></button>
    </div>`;
  footer.querySelector(".footer-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.append(footer);

  /* ---------------- installed app (PWA) ---------------- */

  // (add ?app=1 to a link to preview the app layout in a normal browser tab; ?app=0 turns it off)
  try {
    const force = new URLSearchParams(location.search).get("app");
    if (force === "1") sessionStorage.setItem("mn:previewApp", "1");
    if (force === "0") sessionStorage.removeItem("mn:previewApp");
  } catch (e) {}
  const previewApp = (() => {
    try {
      return sessionStorage.getItem("mn:previewApp") === "1";
    } catch (e) {
      return false;
    }
  })();
  const standalone = previewApp || window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) document.documentElement.classList.add("standalone");
  // Tablets (iPad…) get their own layout: the pill navbar on top, a full-width slideshow and
  // poster-only cards (css: html.tablet). Decided by touch + a screen whose short side is at
  // least 600px, in the browser and the installed app. (?tablet=1 previews it, ?tablet=0 stops.)
  // Phones get the phone layout (tab bar at the bottom): the installed app and phones in the
  // browser, decided by touch, not by pixel counts, so every phone gets it.
  const touchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const previewTablet = (() => {
    try {
      const t = new URLSearchParams(location.search).get("tablet");
      if (t === "1") sessionStorage.setItem("mn:previewTablet", "1");
      if (t === "0") sessionStorage.removeItem("mn:previewTablet");
      return sessionStorage.getItem("mn:previewTablet") === "1";
    } catch (e) {
      return false;
    }
  })();
  const tablet = previewTablet || (touchOnly && Math.min(screen.width, screen.height) >= 600);
  if (tablet) document.documentElement.classList.add("tablet");
  const appUi = (standalone || touchOnly) && !tablet;
  if (appUi) document.documentElement.classList.add("app-ui");

  // Settings → "Show details under posters" off: computers show posters only too (phones
  // and tablets always do)
  try {
    if (localStorage.getItem("mn:cardStyle") === "posters") document.documentElement.classList.add("posters-only");
  } catch (e) {}
  // the switch for it lives in the profile menu (computers only)
  const detailsSwitch = nav.querySelector(".card-details-switch");
  detailsSwitch.checked = !document.documentElement.classList.contains("posters-only");
  detailsSwitch.addEventListener("change", () => {
    document.documentElement.classList.toggle("posters-only", !detailsSwitch.checked);
    try {
      if (detailsSwitch.checked) localStorage.removeItem("mn:cardStyle");
      else localStorage.setItem("mn:cardStyle", "posters");
    } catch (e) {}
  });

  // the navbar turns see-through over the top of the page (tablet slideshow) and
  // frosted once you scroll
  const onScroll = () => document.documentElement.classList.toggle("scrolled", window.scrollY > 30);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // the installed app has no browser back button, so the navbar gets one
  const backBtn = nav.querySelector(".nav-back");
  if (standalone && current !== "home") backBtn.classList.add("show");
  backBtn.addEventListener("click", () => (history.length > 1 ? history.back() : (location.href = "index.html")));

  // offline support + installable app (not available when opened as a file)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker:", e.message));
  }

  // "Install the app" in the profile menu
  const installLink = nav.querySelector(".install-app");
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show it from our menu instead of the browser's banner
    installPrompt = e;
    installLink.hidden = false;
  });
  if (isIos && !standalone) installLink.hidden = false;
  window.addEventListener("appinstalled", () => {
    installLink.hidden = true;
    installPrompt = null;
  });
  installLink.addEventListener("click", async (e) => {
    e.preventDefault();
    profileBox.classList.remove("open");
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installLink.hidden = true;
    } else if (isIos) {
      toast("In Safari: tap the Share button, then \"Add to Home Screen\"");
    }
  });

  /* ---------------- installed app on a phone: tab bar at the bottom ---------------- */

  // In the installed app and on touch phones / tablets, only at phone / small tablet width (CSS):
  // the top bar keeps just the logo and your profile picture (with the full profile menu),
  // and these five tabs sit at the bottom in a floating pill, like a native app.
  // Search and Library open panels that slide up from the bottom.
  if (appUi) {
    const LIBRARY_PAGES = ["movie", "tv", "anime", "favorites", "tiers"];
    const TABS = [
      { id: "home", href: "index.html", label: "Home", icon: "fa-house", on: ["home"] },
      { id: "discover", href: "discover.html", label: "Discover", icon: "fa-compass", on: ["discover"] },
      { id: "search", label: "Search", icon: "fa-magnifying-glass", on: [] },
      { id: "library", label: "Library", icon: "fa-clapperboard", on: LIBRARY_PAGES },
      { id: "list", href: "watchlist.html", label: "Watchlist", icon: "fa-bookmark", on: ["watchlist"] },
    ];

    const bar = document.createElement("nav");
    bar.className = "tab-bar";
    bar.setAttribute("aria-label", "Main");
    bar.innerHTML = TABS.map((t) => {
      const on = t.on.includes(current);
      const attrs = `class="tab${on ? " on" : ""}"${on ? ' aria-current="page"' : ""}`;
      const inner = `<i class="fa-solid ${t.icon}"></i><span>${t.label}</span>`;
      return t.href ? `<a href="${t.href}" ${attrs}>${inner}</a>` : `<button type="button" data-tab="${t.id}" ${attrs}>${inner}</button>`;
    }).join("");
    document.body.append(bar);

    // a panel that slides up from the bottom; only one is open at a time
    const sheets = [];
    function makeSheet(tabId, title, html) {
      const el = document.createElement("div");
      el.className = "app-sheet";
      el.innerHTML = `
        <div class="sheet-backdrop"></div>
        <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="${title}">
          <div class="sheet-grip" aria-hidden="true"></div>
          <h2 class="sheet-title">${title}</h2>
          ${html}
        </div>`;
      document.body.append(el);
      const tab = bar.querySelector(`[data-tab="${tabId}"]`);
      const sheet = {
        el,
        open() {
          sheets.forEach((s) => s !== sheet && s.close());
          el.classList.add("open");
          tab.classList.add("open");
        },
        close() {
          el.classList.remove("open");
          tab.classList.remove("open");
          const input = el.querySelector("input");
          if (input) input.blur();
        },
        isOpen: () => el.classList.contains("open"),
      };
      tab.addEventListener("click", () => (sheet.isOpen() ? sheet.close() : sheet.open()));
      el.querySelector(".sheet-backdrop").addEventListener("click", sheet.close);
      sheets.push(sheet);
      return sheet;
    }
    document.addEventListener("keydown", (e) => e.key === "Escape" && sheets.forEach((s) => s.close()));

    // Search: your library as you type, and "search everything" on Discover
    const search = makeSheet(
      "search",
      "Search",
      `<form class="sheet-search" role="search">
         <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
         <input type="search" name="q" placeholder="Movies, TV shows, anime…" aria-label="Search" autocomplete="off" enterkeyhint="search" />
       </form>
       <label class="sheet-type">
         <i class="fa-solid fa-filter" aria-hidden="true"></i>
         <span>Search in</span>
         <select name="in" aria-label="Search in">
           <option value="all">Everything</option>
           <option value="movie">Movies</option>
           <option value="tv">TV Shows</option>
           <option value="anime">Anime</option>
         </select>
         <i class="fa-solid fa-chevron-down sheet-type-arrow" aria-hidden="true"></i>
       </label>
       <a class="sheet-more" href="discover.html" hidden></a>
       <h3 class="sheet-group" hidden>In your library</h3>
       <ul class="search-results sheet-results"></ul>`
    );
    const searchForm = search.el.querySelector("form");
    const searchInput2 = searchForm.elements.q;
    const more = search.el.querySelector(".sheet-more");
    const searchResults = search.el.querySelector(".sheet-results");
    const typeSel = search.el.querySelector('.sheet-type select');
    const TYPE_WORDS = { all: "everything", movie: "movies", tv: "TV shows", anime: "anime" };
    // Discover link for the current search and type
    const discoverUrl = (q) => `discover.html?q=${encodeURIComponent(q)}${typeSel.value !== "all" ? `&in=${typeSel.value}` : ""}`;
    // results: your library straight away, then everything else on TMDB (the same search
    // as the Discover page), in the chosen type
    const tmdbBox = document.createElement("div");
    tmdbBox.className = "sheet-tmdb";
    searchResults.after(tmdbBox);
    let typing;
    let run = 0;
    const tmdbRow = (hit) => `<li><a href="title.html?tmdb=${hit.mediaType}-${hit.tmdbId}">
        <img src="${Store.poster(hit.poster, "w92")}" alt="" loading="lazy" />
        <span>${esc(Lang.title(hit))}<small>${[hit.year, Store.TYPE_LABEL[hit.type], hit.score ? `TMDB ${hit.score.toFixed(1)}` : ""]
          .filter(Boolean)
          .join(" · ")}</small></span></a></li>`;
    async function searchTmdb(q, type, token) {
      try {
        const data = await TMDB.searchSmart(q, type, 1);
        if (token !== run) return;
        const hits = data.results.filter((h) => !(window.Cards && Cards.inLibrary(h))).slice(0, 15);
        tmdbBox.innerHTML = hits.length
          ? `<h3 class="sheet-group">More from TMDB</h3><ul class="search-results sheet-results">${hits.map(tmdbRow).join("")}</ul>`
          : searchResults.innerHTML
          ? ""
          : `<p class="sheet-note">Nothing found for "${esc(q)}".</p>`;
      } catch (err) {
        if (token === run) tmdbBox.innerHTML = `<p class="sheet-note">Couldn't search TMDB: ${esc(err.message)}</p>`;
      }
    }
    const refresh = () => {
      const q = searchInput2.value.trim();
      const type = typeSel.value;
      const mine = resultsHtml(q, type);
      const hasMine = mine && !mine.includes("search-empty");
      searchResults.innerHTML = hasMine ? mine : "";
      searchResults.previousElementSibling.hidden = !hasMine; // "In your library" heading
      more.hidden = !q;
      more.href = discoverUrl(q);
      more.innerHTML = `<i class="fa-solid fa-compass"></i><span>Open all results for "${esc(q)}"</span><i class="fa-solid fa-chevron-right"></i>`;
      clearTimeout(typing);
      const token = ++run;
      if (!q || !(window.TMDB && TMDB.enabled())) {
        tmdbBox.innerHTML = q && !hasMine ? `<p class="sheet-note">No titles in your library match "${esc(q)}".</p>` : "";
        return;
      }
      tmdbBox.innerHTML = `<p class="sheet-note"><i class="fa-solid fa-spinner fa-spin"></i> Searching…</p>`;
      typing = setTimeout(() => searchTmdb(q, type, token), 250);
    };
    searchInput2.addEventListener("input", refresh);
    typeSel.addEventListener("change", refresh);
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = searchInput2.value.trim();
      if (q) location.href = discoverUrl(q);
    });
    // focus straight from the tap, so the phone keyboard opens
    // (the last search is selected, so typing replaces it)
    bar.querySelector('[data-tab="search"]').addEventListener("click", () => {
      if (!search.isOpen()) return;
      searchInput2.focus();
      searchInput2.select();
    });

    // Library: the list pages
    const count = (test) => Store.all().filter(test).length;
    const LINKS = [
      { href: "movies.html", label: "Movies", icon: "fa-film", n: count((i) => i.type === "movie") },
      { href: "tv-shows.html", label: "TV Shows", icon: "fa-tv", n: count((i) => i.type === "tv") },
      { href: "anime.html", label: "Anime", icon: "fa-clapperboard", n: count((i) => i.type === "anime") },
      { href: "favorites.html", label: "Favorites", icon: "fa-heart", n: count((i) => i.favorite) },
      { href: "tier-list.html", label: "Tier List", icon: "fa-ranking-star", n: null },
    ];
    makeSheet(
      "library",
      "Library",
      `<div class="sheet-links">${LINKS.map(
        (l) => `<a href="${l.href}"${PAGES.find((p) => p.href === l.href && p.id === current) ? ' class="on"' : ""}>
          <i class="fa-solid ${l.icon}"></i><span>${l.label}</span>${l.n != null ? `<small>${l.n}</small>` : ""}</a>`
      ).join("")}</div>`
    );
  }

  /* ---------------- shared helpers ---------------- */

  let toastTimer;
  function toast(message) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.append(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  /*
   * Folding search / filters: puts a search icon and a filter icon next to
   * `head` (usually the page title); each one opens its panel below.
   * Panels start closed unless something in them is already in use.
   * Returns { mark(searchInUse, filtersInUse) } to show a dot on an icon
   * whose panel is closed but still filtering.
   */
  function foldTools(head, { search, filters, openSearch = false, openFilters = false }) {
    let row = head.parentElement;
    if (!row.classList.contains("page-head")) {
      row = document.createElement("div");
      row.className = "page-head";
      head.before(row);
      row.append(head);
    }
    const tools = document.createElement("div");
    tools.className = "page-tools";
    row.append(tools);

    function fold(panel, icon, label, open) {
      const box = document.createElement("div");
      box.className = "fold";
      const inner = document.createElement("div");
      panel.before(box);
      box.append(inner);
      inner.append(panel);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tool-btn";
      btn.setAttribute("aria-label", label);
      btn.title = label;
      btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
      tools.append(btn);

      const set = (on) => {
        box.classList.toggle("open", on);
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-expanded", on);
      };
      set(open);
      btn.addEventListener("click", () => {
        const on = !box.classList.contains("open");
        set(on);
        const input = panel.querySelector('input[type="search"]');
        if (on && input) input.focus({ preventScroll: true });
      });
      // tell the navbar (red search button) once the panel has finished moving
      box.addEventListener("transitionend", () => window.dispatchEvent(new Event("mn:layout")));
      return btn;
    }

    const searchBtn = search && fold(search, "fa-magnifying-glass", "Search", openSearch);
    const filterBtn = filters && fold(filters, "fa-sliders", "Filters", openFilters);
    return {
      mark(searchInUse, filtersInUse) {
        if (searchBtn) searchBtn.classList.toggle("dot", !!searchInUse);
        if (filterBtn) filterBtn.classList.toggle("dot", !!filtersInUse);
      },
    };
  }

  window.UI = { esc, toast, download, PAGES, foldTools };
})();
