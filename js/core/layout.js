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
    { id: "watchlist", href: "watchlist.html", label: "Watchlist", icon: "fa-solid fa-bookmark" },
    { id: "tiers", href: "tier-list.html", label: "Tier List", icon: "fa-solid fa-ranking-star" },
    { id: "boxoffice", href: "box-office.html", label: "Box Office", icon: "fa-solid fa-sack-dollar" },
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
      <button type="button" data-lang="en" aria-pressed="${!Lang.isRu()}" class="${Lang.isRu() ? "" : "active"}">EN</button>
      <button type="button" data-lang="ru" aria-pressed="${Lang.isRu()}" class="${Lang.isRu() ? "active" : ""}">RU</button>
    </div>`;
  const profile = Store.getProfile();

  // signed in: your Google photo; signed out: a plain user icon
  const USER_ICON = "images/placeholders/user.svg";
  const acct = window.Cloud && Cloud.account();
  const pic = (a) => (a && a.photo) || USER_ICON;
  // yours: the character you picked in Settings, or your Google photo (marked data-my-pic,
  // so a new pick shows everywhere at once: UI.paintMyPic())
  const avatar = Store.myPhoto() || USER_ICON;

  // sign in / "Who's watching?" / sign out
  // (someone who already signed in on this device before stays one tap away under "Who's watching?")
  function accountMenu() {
    if (!window.Cloud || !Cloud.enabled) return "";
    const others = Cloud.accounts().filter((a) => !acct || a.uid !== acct.uid);
    const row = (attrs, icon, label) => `<a href="#" ${attrs}>${icon}<span>${label}</span><i class="fa-solid fa-chevron-right"></i></a>`;
    const who = others.length
      ? `<div class="menu-label">Who's watching?</div><div class="menu-group">${others
          .map((a) => row(`data-cloud-switch="${esc(a.uid)}"`, `<img class="acct-pic" src="${esc(pic(a))}" alt="" referrerpolicy="no-referrer" />`, esc(a.name)))
          .join("")}</div>`
      : "";
    return acct
      ? `${who}<div class="menu-group">${row('data-cloud="sign-out" class="menu-danger"', '<i class="fa-solid fa-right-from-bracket"></i>', "Sign out")}</div>`
      : `${who}<div class="menu-group">${row('data-cloud="add" class="menu-signin"', '<i class="fa-brands fa-google"></i>', "Sign in with Google")}</div>`;
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
            <img src="${esc(avatar)}" class="user-pic" data-my-pic alt="" referrerpolicy="no-referrer" />
          </button>
          <div class="profile-menu">
            <div class="user-info">
              <img src="${esc(avatar)}" data-my-pic alt="" referrerpolicy="no-referrer" />
              <div>
                <h2>${esc(profile.name)}</h2>
                ${acct ? '<small class="sync-status"></small>' : '<small class="sync-status"><i class="fa-regular fa-circle-user"></i> Not signed in</small>'}
              </div>
            </div>
            <div class="menu-group">
              <a href="tier-list.html" class="tablet-link"><i class="fa-solid fa-ranking-star"></i><span>Tier List</span><i class="fa-solid fa-chevron-right"></i></a>
              <a href="box-office.html" class="bo-menu-link"><i class="fa-solid fa-sack-dollar"></i><span>Box Office</span><i class="fa-solid fa-chevron-right"></i></a>
              <a href="profile.html"><i class="fa-solid fa-user"></i><span>Profile &amp; stats</span><i class="fa-solid fa-chevron-right"></i></a>
              <a href="#" data-action="add-title" class="owner-only"><i class="fa-solid fa-plus"></i><span>Add a title</span><i class="fa-solid fa-chevron-right"></i></a>
              <a href="settings.html"><i class="fa-solid fa-gear"></i><span>Settings</span><i class="fa-solid fa-chevron-right"></i></a>
              <a href="#" class="install-app" hidden><i class="fa-solid fa-mobile-screen"></i><span>Install the app</span><i class="fa-solid fa-chevron-right"></i></a>
            </div>
            <div class="menu-prefs">
              ${langToggle("in-profile")}
              ${
                Store.guest
                  ? ""
                  : `<label class="menu-switch" title="On: your own rating on the posters in your library. Off: their IMDb rating">
                <i class="fa-solid fa-star"></i><span>My rating</span>
                <input type="checkbox" class="my-rating-switch" />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>`
              }
              ${
                Store.guest
                  ? ""
                  : `<label class="menu-switch fade-row" title="On Discover and Home, what you've already watched is dimmed (like Letterboxd)">
                <i class="fa-solid fa-eye-low-vision"></i><span>Dim watched</span>
                <input type="checkbox" class="fade-switch" />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>`
              }
              <label class="menu-switch" title="Title, ratings and buttons under each poster (off: posters only)">
                <i class="fa-solid fa-table-cells-large"></i><span>Poster details</span>
                <input type="checkbox" class="card-details-switch" />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>
              <label class="menu-switch" title="How much you'll probably like each title (86%), on the posters and in the hover preview">
                <i class="fa-solid fa-percent"></i><span>Match %</span>
                <input type="checkbox" class="match-switch" />
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
    else if (act.dataset.cloud === "sign-out")
      confirmBox({ icon: "fa-right-from-bracket", title: "Sign out on this device?", text: "Your library stays saved in your account.", ok: "Sign out", danger: true }).then(
        (ok) => ok && Cloud.signOut()
      );
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
              <span>${esc(Lang.title(item))}<small>${[item.year, Store.TYPE_LABEL[item.type], item.rating != null ? `★ ${item.rating}` : ""]
                .filter(Boolean)
                .join(" · ")}</small></span></a></li>`
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
        <p>Your own private diary of movies, TV shows and anime: rate and rank what you've
          watched, and keep track of everything still waiting on your watchlist.</p>
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
        <ul>${PAGES.slice(5, 6).map(footLink).join("")}${footLink({ href: "watchlist.html?list=fav", label: "Favorites", icon: "fa-solid fa-heart" })}${PAGES.slice(6).map(footLink).join("")}${footLink({ href: "profile.html", label: "Profile &amp; stats", icon: "fa-solid fa-user" })}${footLink({ href: "settings.html", label: "Settings", icon: "fa-solid fa-gear" })}</ul>
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

  // "Match %" off: no match on the posters or in the hover preview (title pages keep it).
  // Only with Poster details on: with posters only, the match is just in the hover preview,
  // and it stays there (the switch is greyed out)
  try {
    if (localStorage.getItem("mn:showMatch") === "off") document.documentElement.classList.add("no-match");
  } catch (e) {}
  const matchSwitch = nav.querySelector(".match-switch");
  const matchRow = matchSwitch.closest(".menu-switch");
  matchSwitch.checked = !document.documentElement.classList.contains("no-match");
  matchSwitch.addEventListener("change", () => {
    document.documentElement.classList.toggle("no-match", !matchSwitch.checked);
    try {
      if (matchSwitch.checked) localStorage.removeItem("mn:showMatch");
      else localStorage.setItem("mn:showMatch", "off");
    } catch (e) {}
  });
  // "My rating": the posters of your library show your own rating (on, at first) or their
  // IMDb rating (off, html.ext-ratings). One or the other, never both.
  try {
    if (localStorage.getItem("mn:myRatings") === "off") document.documentElement.classList.add("ext-ratings");
  } catch (e) {}
  const myRatingSwitch = nav.querySelector(".my-rating-switch");
  if (myRatingSwitch) {
    myRatingSwitch.checked = !document.documentElement.classList.contains("ext-ratings");
    myRatingSwitch.addEventListener("change", () => {
      document.documentElement.classList.toggle("ext-ratings", !myRatingSwitch.checked);
      try {
        if (myRatingSwitch.checked) localStorage.removeItem("mn:myRatings");
        else localStorage.setItem("mn:myRatings", "off");
      } catch (e) {}
      // (IMDb shown now: look up the ones still missing)
      if (!myRatingSwitch.checked && window.Cards && Cards.scanForScores) Cards.scanForScores();
    });
  }
  // "Dim watched" (like Letterboxd's "fade watched"): titles you've already
  // watched are dimmed on Discover and Home's rows, so the new ones stand out. Off at first.
  try {
    if (localStorage.getItem("mn:fadeWatched") === "on") document.documentElement.classList.add("fade-watched");
  } catch (e) {}
  const fadeSwitch = nav.querySelector(".fade-switch");
  if (fadeSwitch) {
    fadeSwitch.checked = document.documentElement.classList.contains("fade-watched");
    fadeSwitch.addEventListener("change", () => {
      document.documentElement.classList.toggle("fade-watched", fadeSwitch.checked);
      try {
        if (fadeSwitch.checked) localStorage.setItem("mn:fadeWatched", "on");
        else localStorage.removeItem("mn:fadeWatched");
      } catch (e) {}
    });
  }

  function syncMatchSwitch() {
    const usable = detailsSwitch.checked;
    matchSwitch.disabled = !usable;
    // posters only: shown as on (the hover preview has it); back to your choice with details on
    matchSwitch.checked = usable ? !document.documentElement.classList.contains("no-match") : true;
    matchRow.classList.toggle("disabled", !usable);
    matchRow.title = usable
      ? "How much you'll probably like each title (86%), on the posters and in the hover preview"
      : "With posters only, the match shows in the hover preview. Turn on Poster details to switch it off.";
  }
  syncMatchSwitch();
  detailsSwitch.addEventListener("change", syncMatchSwitch);

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
    const LIBRARY_PAGES = ["movie", "tv", "anime", "tiers"];
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
      { href: "watchlist.html?list=fav", label: "Favorites", icon: "fa-heart", n: count((i) => i.favorite) },
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

  /* ---------------- chip rows that scroll sideways (phones) ----------------
     The picked chip is brought into view (on opening a page and when you tap one), and each
     row knows its ends (.at-start / .at-end), so the fade shows only where there's more. */
  function chipEdges(row) {
    row.classList.toggle("at-start", row.scrollLeft < 4);
    row.classList.toggle("at-end", row.scrollLeft + row.clientWidth >= row.scrollWidth - 4);
  }
  function chipIntoView(row, smooth, index) {
    // (the tapped chip by its place in the row: the page may mark it active a moment later)
    const on = index != null ? row.querySelectorAll(".chip")[index] : row.querySelector(".chip.active");
    if (on && row.scrollWidth > row.clientWidth) {
      const left = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
      row.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
    }
    chipEdges(row);
  }
  const allChipRows = (smooth) => document.querySelectorAll(".chips").forEach((row) => chipIntoView(row, smooth));
  // (caught on the way down, before the page's own handler: a page may redraw its chips on the
  // tap, and the tapped chip isn't in the page any more by the time the click bubbles up)
  document.addEventListener(
    "click",
    (e) => {
      const chip = e.target.closest && e.target.closest(".chips .chip");
      const row = chip && chip.closest(".chips");
      if (!row) return;
      const index = [...row.querySelectorAll(".chip")].indexOf(chip);
      setTimeout(() => chipIntoView(row, true, index), 60);
    },
    true
  );
  // (scroll doesn't bubble: caught on the way down)
  document.addEventListener("scroll", (e) => e.target.classList && e.target.classList.contains("chips") && chipEdges(e.target), true);
  // Phones: how you'd know a row scrolls. A small › button at its right end (while there are more
  // chips that way: tap it to move along), and a one-time "peek" when the page opens: the row
  // slides a little to the left and back (once per page per visit, not with motion turned down).
  const phoneRows = () =>
    window.matchMedia("(max-width: 700px)").matches ? [...document.querySelectorAll(".chips:not(.bo-genres):not(.sk-chips)")] : [];
  function addMoreButton(row) {
    if (row.parentElement.classList.contains("chips-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "chips-wrap";
    row.before(wrap);
    wrap.appendChild(row);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "chips-more";
    more.setAttribute("aria-label", "More");
    more.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    more.addEventListener("click", () => row.scrollBy({ left: row.clientWidth * 0.7, behavior: "smooth" }));
    wrap.appendChild(more);
  }
  function peek(row) {
    const key = `mn:chipsPeek:${location.pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch (e) {}
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (row.scrollWidth <= row.clientWidth || row.scrollLeft > 4) return;
    let stop = false;
    const cancel = () => (stop = true);
    row.addEventListener("pointerdown", cancel, { once: true });
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1300);
      if (stop) return;
      row.scrollLeft = Math.sin(Math.PI * p) * 70; // out and back
      if (p < 1) requestAnimationFrame(step);
      else row.scrollLeft = 0;
    };
    requestAnimationFrame(step);
  }
  window.addEventListener("load", () => {
    allChipRows(false);
    phoneRows().forEach(addMoreButton);
    setTimeout(() => {
      allChipRows(false); // (rows a page fills in a moment later)
      phoneRows().forEach(addMoreButton);
      phoneRows().forEach((row) => row.scrollLeft < 4 && peek(row));
    }, 900);
  });
  window.addEventListener("resize", () => document.querySelectorAll(".chips").forEach(chipEdges));

  /* ---------------- pill switches: the red pill glides to the picked option ---------------- */

  // Every switch made of pill buttons (Home's Top 10 Movies / TV, the theme in Settings, the
  // Watchlist's list switch and its All / Movies / TV rows, the picker's choices) gets one red
  // pill behind the picked button, which glides to the next pick. Pages just toggle .active /
  // .on as before; this watches for it. A switch that's drawn again (new buttons) keeps its
  // pill's last place, so it still glides from there.
  const PILL_SWITCHES = ".top10-switch, .pk-seg, .wl-switch";
  const pillAt = new WeakMap(); // switch -> the pill's last { left, top, width, height }
  const px = (b) => ({ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });

  function placePill(sw) {
    let pill = sw.querySelector(":scope > .sw-pill");
    const known = pillAt.get(sw);
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "sw-pill";
      pill.setAttribute("aria-hidden", "true");
      sw.prepend(pill);
      sw.classList.add("has-pill");
      // (first time: straight to its place; drawn again: from where it was)
      pill.style.transition = "none";
      if (known) Object.assign(pill.style, px(known));
      void pill.offsetWidth;
      if (known) pill.style.transition = "";
      else requestAnimationFrame(() => requestAnimationFrame(() => (pill.style.transition = "")));
    }
    const on = sw.querySelector(":scope > .active, :scope > .on");
    if (!on || !on.offsetWidth) return (pill.style.opacity = "0");
    const box = { left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight };
    pill.style.opacity = "1";
    Object.assign(pill.style, px(box));
    pillAt.set(sw, box);
  }

  const pending = new Set();
  let pillFrame = 0;
  function queuePill(sw) {
    pending.add(sw);
    if (!pillFrame)
      pillFrame = requestAnimationFrame(() => {
        pillFrame = 0;
        pending.forEach((s) => s.isConnected && placePill(s));
        pending.clear();
      });
  }
  new MutationObserver((muts) =>
    muts.forEach((m) => {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      const sw = t && t.closest(PILL_SWITCHES);
      if (sw) queuePill(sw);
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches(PILL_SWITCHES)) queuePill(n);
        n.querySelectorAll(PILL_SWITCHES).forEach(queuePill);
      });
      // a hidden switch shown again (e.g. the picker's rows): measure it now
      if (m.type === "attributes" && m.attributeName === "hidden") t.querySelectorAll(PILL_SWITCHES).forEach(queuePill);
    })
  ).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  document.addEventListener("DOMContentLoaded", () => document.querySelectorAll(PILL_SWITCHES).forEach(queuePill));
  window.addEventListener("resize", () => document.querySelectorAll(PILL_SWITCHES).forEach(queuePill));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll(PILL_SWITCHES).forEach(queuePill));

  /* ---------------- "out today" badge on Watchlist ---------------- */

  // how many titles in Coming up come out (or get a new episode) today: a red number on the
  // Watchlist link and tab. Release dates are kept fresh on any page (a day old at most).
  document.addEventListener("DOMContentLoaded", () => {
    if (Store.guest || !window.Watch) return;
    const paint = () => {
      const n = Watch.outToday(Store.all()).length;
      document.querySelectorAll('.nav-links a[href="watchlist.html"], .tab-bar a[href="watchlist.html"]').forEach((a) => {
        let b = a.querySelector(".nav-badge");
        if (!n) return b && b.remove();
        if (!b) {
          b = document.createElement("span");
          b.className = "nav-badge";
          a.append(b);
        }
        b.textContent = n;
        b.title = `${n} out today`;
        a.setAttribute("aria-label", `Watchlist, ${n} out today`);
      });
    };
    paint();
    Watch.onChange(paint);
    if (window.TMDB && TMDB.enabled()) setTimeout(() => Watch.loadNext(Watch.candidates(Store.all())), 4000);
  });

  /* ---------------- shared helpers ---------------- */

  // a short message at the bottom; with { label, run } it gets a button (e.g. Undo)
  // and stays a little longer
  let toastTimer;
  function toast(message, action) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.append(el);
    }
    el.textContent = message;
    el.classList.toggle("has-action", !!action);
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast-action";
      btn.textContent = action.label;
      btn.addEventListener("click", () => {
        el.classList.remove("show");
        action.run();
      });
      el.append(btn);
    }
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), action ? 6000 : 2200);
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

  // signed out (with sign-in set up): nobody's library is shown, so lists ask you to sign in
  function signInPrompt(text) {
    return `<div class="guest-state">
      <i class="fa-solid fa-film"></i>
      <h3>${esc(text || "Sign in to start your own list")}</h3>
      <p>Everyone gets their own private library: ratings, favorites, watchlist and tier list. Only you can see yours.</p>
      <button class="btn btn-primary" type="button" data-cloud="add"><i class="fa-brands fa-google"></i> Sign in with Google</button>
    </div>`;
  }

  // signed in with an empty library: three ways to start (Home, Watchlist)
  function welcome() {
    const step = (n, icon, title, text, action) => `<div class="welcome-step">
        <span class="ws-num">${n}</span><i class="fa-solid ${icon}"></i>
        <h4>${title}</h4><p>${text}</p>${action}</div>`;
    return `<div class="welcome">
      <div class="welcome-head">
        <h3>Welcome${profile.name && !profile.guest ? `, ${esc(String(profile.name).split(" ")[0])}` : ""}! Let's fill your library</h3>
        <p>It's all yours and private: only you see what you add, rate and plan to watch.</p>
      </div>
      <div class="welcome-steps">
        ${step(1, "fa-compass", "Find something", "Browse what's trending, in cinemas or coming soon, or search any title.",
          '<a class="btn btn-primary" href="discover.html"><i class="fa-solid fa-compass"></i> Discover</a>')}
        ${step(2, "fa-bookmark", "Save or rate it", "<b>Watchlist</b> to see it later, <b>Watched</b> or <b>Rate</b> if you've seen it, the heart for favorites.",
          '<button class="btn" type="button" data-open-search><i class="fa-solid fa-magnifying-glass"></i> Search a title</button>')}
        ${step(3, "fa-file-import", "Bring your history", "Rated films on IMDb or Letterboxd? Import them all at once.",
          '<a class="btn" href="settings.html#import"><i class="fa-solid fa-file-import"></i> Import</a>')}
      </div>
    </div>`;
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-open-search]")) return;
    const btn = document.querySelector(".tab-bar [data-tab='search']") || document.querySelector(".search-toggle");
    // after this click is done (a click elsewhere closes the search)
    if (btn) setTimeout(() => btn.click(), 0);
  });

  /* A question in the site's own glass pop-up (instead of the browser's grey box).
     UI.confirm({ icon, title, text, ok, danger }) -> Promise<true | false>
     UI.ask({ icon, title, text, value, placeholder, ok }) -> Promise<"typed text" | null>
     (text is HTML: escape anything that comes from the user) */
  function dialog(opts, withInput) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `<div class="modal notice-modal ui-dialog" role="alertdialog" aria-modal="true" aria-label="${esc(opts.title)}">
          <div class="notice-icon${opts.danger ? " danger" : ""}"><i class="fa-solid ${opts.icon || (opts.danger ? "fa-triangle-exclamation" : "fa-circle-question")}"></i></div>
          <h2>${esc(opts.title)}</h2>
          ${opts.text ? `<p>${opts.text}</p>` : ""}
          ${withInput ? `<input class="input ui-d-input" maxlength="${opts.max || 40}" value="${esc(opts.value || "")}" placeholder="${esc(opts.placeholder || "")}" aria-label="${esc(opts.title)}" autocomplete="off" />` : ""}
          <div class="ui-d-buttons">
            <button class="btn ui-d-cancel" type="button">${esc(opts.cancel || "Cancel")}</button>
            <button class="btn ${opts.danger ? "btn-danger" : "btn-primary"} ui-d-ok" type="button">${esc(opts.ok || "OK")}</button>
          </div>
        </div>`;
      document.body.append(overlay);
      const field = overlay.querySelector(".ui-d-input");
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        overlay.classList.remove("active");
        setTimeout(() => overlay.remove(), 300);
        resolve(withInput ? (ok ? field.value.trim() || null : null) : ok);
      };
      overlay.onclose = () => finish(false); // Esc (js/components/cards.js closes open pop-ups)
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest(".ui-d-cancel")) finish(false);
        else if (e.target.closest(".ui-d-ok")) finish(true);
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") finish(false);
        if (e.key === "Enter" && field) {
          e.preventDefault();
          finish(true);
        }
      });
      requestAnimationFrame(() => overlay.classList.add("active"));
      // (a risky question starts on Cancel, so Enter doesn't delete anything by accident)
      setTimeout(() => {
        const first = field || overlay.querySelector(opts.danger ? ".ui-d-cancel" : ".ui-d-ok");
        first.focus();
        if (field) field.select();
      }, 60);
    });
  }
  const confirmBox = (opts) => dialog(opts, false);
  const ask = (opts) => dialog(opts, true);

  // a library action while signed out: explain and open the menu with the Sign in button
  function needSignIn() {
    toast("Sign in to start your own list");
    const box = document.querySelector(".profile");
    if (!box) return;
    if (window.Cloud && Cloud.enabled) Cloud.prepare();
    // after this click has finished (clicks outside the menu close it)
    setTimeout(() => box.classList.add("open"), 0);
  }

  // show your (new) picture everywhere it's on the page
  function paintMyPic() {
    const src = Store.myPhoto() || USER_ICON;
    document.querySelectorAll("img[data-my-pic]").forEach((i) => (i.src = src));
  }

  /* A character's photo is a tall, tight close-up (the head fills the width), so a circle
     would cut the chin or the top of the head. It's drawn once into a square picture made for
     a circle, the same way as in the gallery: the photo a bit smaller, the face in the middle
     with even room above and below, the strips around it filled with a soft, blurred copy of
     it and its edges faded in. From the large photo (sharp at any size); kept in this browser
     (mn:myPicFramed: { path, url }). Resolves once it's ready (false if it couldn't be made). */
  function frameMyPic() {
    const av = Store.getProfile().avatar;
    if (!av || !av.path) return Promise.resolve(false);
    const saved = Store.read("mn:myPicFramed", null);
    if (saved && saved.path === av.path) return Promise.resolve(true);
    return new Promise((resolve) => {
      const photo = new Image();
      photo.crossOrigin = "anonymous";
      photo.onerror = () => resolve(false);
      photo.onload = () => {
        try {
          const S = 360;
          const ratio = photo.naturalHeight / photo.naturalWidth;
          const out = document.createElement("canvas");
          out.width = out.height = S;
          const g = out.getContext("2d");
          // the soft fill: the photo shrunk to a few pixels and stretched back (a blur that
          // works in every browser), a little darker
          const tiny = document.createElement("canvas");
          tiny.width = 18;
          tiny.height = Math.round(18 * ratio);
          tiny.getContext("2d").drawImage(photo, 0, 0, tiny.width, tiny.height);
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = "high";
          const bw = S * 1.25;
          g.drawImage(tiny, (S - bw) / 2, -bw * ratio * 0.1, bw, bw * ratio);
          g.fillStyle = "rgba(0, 0, 0, 0.22)";
          g.fillRect(0, 0, S, S);
          // the photo: 80% as wide as the circle, its top 7% down (as in the gallery), with
          // its side and top edges faded into the fill
          const pw = S * 0.8;
          const px = (S - pw) / 2;
          const py = S * 0.07;
          const layer = document.createElement("canvas");
          layer.width = layer.height = S;
          const l = layer.getContext("2d");
          l.imageSmoothingQuality = "high";
          l.drawImage(photo, px, py, pw, pw * ratio);
          l.globalCompositeOperation = "destination-in";
          let fade = l.createLinearGradient(px, 0, px + pw, 0);
          fade.addColorStop(0, "rgba(0,0,0,0)");
          fade.addColorStop(0.12, "#000");
          fade.addColorStop(0.88, "#000");
          fade.addColorStop(1, "rgba(0,0,0,0)");
          l.fillStyle = fade;
          l.fillRect(0, 0, S, S);
          fade = l.createLinearGradient(0, py, 0, py + S * 0.09);
          fade.addColorStop(0, "rgba(0,0,0,0)");
          fade.addColorStop(1, "#000");
          l.fillStyle = fade;
          l.fillRect(0, 0, S, S);
          g.drawImage(layer, 0, 0);
          Store.write("mn:myPicFramed", { path: av.path, url: out.toDataURL("image/jpeg", 0.88) });
          resolve(true);
        } catch (e) {
          resolve(false); // (e.g. the photo's server didn't allow drawing it)
        }
      };
      photo.src = Store.img(av.path, "h632");
    });
  }
  // (a character picked on another device: make its framed picture here)
  frameMyPic().then((made) => made && paintMyPic());

  /* ---------------- the site's own date picker (instead of the browser's) ----------------
     UI.pickDate(anchor, { value: "2026-09-12", max: "2026-09-30", title, clear })
       -> Promise: "YYYY-MM-DD" when a day is picked, "" for Clear, null when closed.
     A dark glass pop-over under the button (a sheet at the bottom on phones): the month with
     arrows, tap its name to jump by month / year, Today / Yesterday shortcuts. */
  const CAL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? new Date(`${s}T00:00:00`) : null);
  let calEl = null;
  let calDone = null;

  function pickDate(anchor, opts = {}) {
    if (calDone) calDone(null);
    const today = ymd(new Date());
    const max = opts.max || "";
    const picked = opts.value || "";
    const start = parseYmd(picked) || parseYmd(max) || new Date();
    let year = start.getFullYear();
    let month = start.getMonth();
    let view = "days"; // or "months"
    if (!calEl) {
      calEl = document.createElement("div");
      calEl.className = "cal-pop";
      calEl.setAttribute("role", "dialog");
      calEl.setAttribute("aria-modal", "true");
      document.body.appendChild(calEl);
    }
    calEl.setAttribute("aria-label", opts.title || "Pick a day");
    const after = (s) => max && s > max;

    function paint() {
      let body;
      if (view === "days") {
        const first = new Date(year, month, 1);
        const lead = (first.getDay() + 6) % 7; // weeks start on Monday
        const days = new Date(year, month + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < lead; i++) cells.push('<span class="cal-gap"></span>');
        for (let d = 1; d <= days; d++) {
          const s = ymd(new Date(year, month, d));
          const cls = ["cal-day", s === picked ? "on" : "", s === today ? "today" : ""].filter(Boolean).join(" ");
          cells.push(`<button type="button" class="${cls}" data-day="${s}"${after(s) ? " disabled" : ""}${s === picked ? ' aria-pressed="true"' : ""}>${d}</button>`);
        }
        body = `<div class="cal-week">${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((w) => `<span>${w}</span>`).join("")}</div><div class="cal-grid">${cells.join("")}</div>`;
      } else {
        const maxD = parseYmd(max);
        body = `<div class="cal-months">${CAL_MONTHS.map((m, n) => {
          const off = maxD && (year > maxD.getFullYear() || (year === maxD.getFullYear() && n > maxD.getMonth()));
          return `<button type="button" class="cal-month${n === month ? " on" : ""}" data-month="${n}"${off ? " disabled" : ""}>${m.slice(0, 3)}</button>`;
        }).join("")}</div>`;
      }
      const maxD = parseYmd(max);
      const nextOff = maxD && (view === "days" ? new Date(year, month + 1, 1) > maxD : year >= maxD.getFullYear());
      const yesterday = ymd(new Date(Date.now() - 86400000));
      calEl.innerHTML = `
        <div class="cal-head">
          <button type="button" class="cal-title" aria-label="${view === "days" ? "Pick a month" : "Back to the days"}">${view === "days" ? `${CAL_MONTHS[month]} ${year}` : year} <i class="fa-solid fa-chevron-${view === "days" ? "down" : "up"}"></i></button>
          <span class="cal-arrows">
            <button type="button" class="cal-nav" data-step="-1" aria-label="${view === "days" ? "Previous month" : "Previous year"}"><i class="fa-solid fa-chevron-left"></i></button>
            <button type="button" class="cal-nav" data-step="1" aria-label="${view === "days" ? "Next month" : "Next year"}"${nextOff ? " disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>
          </span>
        </div>
        <div class="cal-body cal-view-${view}">${body}</div>
        <div class="cal-foot">
          <button type="button" class="cal-chip" data-day="${today}"${after(today) ? " disabled" : ""}>Today</button>
          <button type="button" class="cal-chip" data-day="${yesterday}"${after(yesterday) ? " disabled" : ""}>Yesterday</button>
          ${opts.clear && picked ? '<button type="button" class="cal-chip cal-clear"><i class="fa-solid fa-xmark"></i> Clear</button>' : ""}
        </div>`;
    }

    function place() {
      if (window.matchMedia("(max-width: 600px)").matches) {
        calEl.classList.add("sheet");
        calEl.style.left = calEl.style.top = "";
        return;
      }
      calEl.classList.remove("sheet");
      const r = anchor.getBoundingClientRect();
      const w = calEl.offsetWidth;
      const h = calEl.offsetHeight;
      const left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
      const below = r.bottom + 10;
      const top = below + h > window.innerHeight - 12 && r.top - h - 10 > 12 ? r.top - h - 10 : below;
      calEl.style.left = `${left}px`;
      calEl.style.top = `${top}px`;
    }

    return new Promise((resolve) => {
      const finish = (v) => {
        calDone = null;
        calEl.classList.remove("open");
        document.removeEventListener("pointerdown", outside, true);
        document.removeEventListener("keydown", keys, true);
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", onScroll, true);
        if (anchor && anchor.focus) anchor.focus({ preventScroll: true });
        resolve(v);
      };
      const outside = (e) => !calEl.contains(e.target) && !anchor.contains(e.target) && finish(null);
      const keys = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          finish(null);
        }
      };
      const onScroll = (e) => !calEl.contains(e.target) && place();
      calDone = finish;
      calEl.onclick = (e) => {
        const b = e.target.closest("button");
        if (!b || b.disabled) return;
        if (b.dataset.day) return finish(b.dataset.day);
        if (b.classList.contains("cal-clear")) return finish("");
        if (b.classList.contains("cal-title")) view = view === "days" ? "months" : "days";
        else if (b.dataset.month) {
          month = Number(b.dataset.month);
          view = "days";
        } else if (b.dataset.step) {
          const step = Number(b.dataset.step);
          if (view === "days") {
            month += step;
            if (month < 0) (month = 11), year--;
            if (month > 11) (month = 0), year++;
          } else year += step;
        }
        paint();
        // (keyboard: stay on the button you used; a tap or click: no focus ring)
        if (!e.detail) calEl.querySelector(b.dataset.step ? `[data-step="${b.dataset.step}"]` : ".cal-title").focus({ preventScroll: true });
      };
      paint();
      place();
      requestAnimationFrame(() => calEl.classList.add("open"));
      (calEl.querySelector(".cal-day.on") || calEl.querySelector(".cal-day.today") || calEl.querySelector(".cal-title")).focus({ preventScroll: true });
      document.addEventListener("pointerdown", outside, true);
      document.addEventListener("keydown", keys, true);
      window.addEventListener("resize", place);
      window.addEventListener("scroll", onScroll, true);
    });
  }

  /* ---------------- the site's own dropdown lists (instead of the browser's) ----------------
     Every <select> on the site opens this list instead of the browser's own: a dark glass
     pop-over under it (a sheet at the bottom on phones), the picked option in red with a ✓,
     a search box for long lists (the countries). The <select> stays and keeps the value:
     picking sets it and sends "change", so the pages work as before. Keys: ↑ ↓ Home End, Enter,
     Esc, and typing a letter jumps to it. */
  let menuEl = null;
  let menuSelect = null;
  let menuAt = -1;
  let menuTyped = "";
  let menuTypedAt = 0;

  function menuItems() {
    return [...menuEl.querySelectorAll(".sm-opt:not([hidden])")];
  }
  function menuMark(i, scroll) {
    const items = menuItems();
    if (!items.length) return;
    menuAt = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((b, n) => b.classList.toggle("hot", n === menuAt));
    if (scroll) items[menuAt].scrollIntoView({ block: "nearest" });
  }
  function menuPlace() {
    if (!menuSelect) return;
    if (window.matchMedia("(max-width: 700px)").matches) {
      menuEl.classList.add("sheet");
      menuEl.style.left = menuEl.style.top = menuEl.style.width = "";
      return;
    }
    menuEl.classList.remove("sheet");
    const box = (menuSelect.closest(".glass-select") || menuSelect).getBoundingClientRect();
    const w = Math.max(box.width, 220);
    menuEl.style.width = `${w}px`;
    const h = menuEl.offsetHeight;
    const left = Math.min(Math.max(12, box.left), window.innerWidth - w - 12);
    const below = box.bottom + 8;
    const top = below + h > window.innerHeight - 12 && box.top - h - 8 > 12 ? box.top - h - 8 : below;
    menuEl.style.left = `${left}px`;
    menuEl.style.top = `${top}px`;
  }
  function closeMenu() {
    if (!menuEl || !menuSelect) return;
    menuEl.classList.remove("open");
    const sel = menuSelect;
    menuSelect = null;
    document.documentElement.classList.remove("sm-lock");
    sel.focus({ preventScroll: true });
  }
  function pickFromMenu(i) {
    const sel = menuSelect;
    const opt = menuItems()[i];
    if (!sel || !opt) return;
    const changed = sel.value !== opt.dataset.value;
    sel.value = opt.dataset.value;
    closeMenu();
    if (changed) {
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function openMenu(sel) {
    if (sel.disabled || !sel.options.length) return;
    if (!menuEl) {
      menuEl = document.createElement("div");
      menuEl.className = "sm-pop";
      menuEl.setAttribute("role", "listbox");
      document.body.appendChild(menuEl);
      menuEl.addEventListener("click", (e) => {
        const b = e.target.closest(".sm-opt");
        if (b) pickFromMenu(menuItems().indexOf(b));
      });
      menuEl.addEventListener("mousemove", (e) => {
        const b = e.target.closest(".sm-opt");
        if (b) menuMark(menuItems().indexOf(b), false);
      });
      menuEl.addEventListener("input", (e) => {
        if (!e.target.classList.contains("sm-search")) return;
        const q = e.target.value.trim().toLowerCase();
        menuEl.querySelectorAll(".sm-opt").forEach((b) => (b.hidden = !!q && !b.textContent.toLowerCase().includes(q)));
        menuEl.querySelector(".sm-none").hidden = !!menuItems().length;
        menuMark(0, true);
      });
    }
    menuSelect = sel;
    const opts = [...sel.options];
    const long = opts.length > 25; // (years, countries: a search box)
    const label = sel.getAttribute("aria-label") || "";
    menuEl.setAttribute("aria-label", label);
    menuEl.innerHTML = `
      ${label ? `<div class="sm-title">${esc(label)}</div>` : ""}
      ${long ? `<label class="sm-find"><i class="fa-solid fa-magnifying-glass"></i><input class="sm-search" type="search" placeholder="Search…" autocomplete="off" aria-label="Search ${esc(label)}" /></label>` : ""}
      <div class="sm-list">${opts
        .map(
          (o) => `<button type="button" class="sm-opt${o.selected ? " on" : ""}" role="option" aria-selected="${o.selected}" data-value="${esc(o.value)}"${o.disabled ? " disabled" : ""}>
            <span>${esc(o.textContent)}</span>${o.selected ? '<i class="fa-solid fa-check"></i>' : ""}</button>`
        )
        .join("")}<p class="sm-none" hidden>Nothing matches</p></div>`;
    menuPlace();
    if (menuEl.classList.contains("sheet")) document.documentElement.classList.add("sm-lock");
    menuMark(Math.max(0, sel.selectedIndex), true);
    requestAnimationFrame(() => {
      menuEl.classList.add("open");
      // (a long list: the cursor in its search box, once the list shows; not on phones, where
      // the keyboard would cover the list)
      const find = menuEl.querySelector(".sm-search");
      if (find && !menuEl.classList.contains("sheet")) find.focus({ preventScroll: true });
    });
  }

  // opening: a click / tap on any <select> (the browser's own list is kept closed), or the
  // keys that would open it (Space, Enter, Alt + ↓)
  document.addEventListener(
    "mousedown",
    (e) => {
      const sel = e.target.closest && e.target.closest("select");
      if (!sel || e.button !== 0) return;
      e.preventDefault();
      if (menuSelect === sel) return closeMenu();
      sel.focus({ preventScroll: true });
      openMenu(sel);
    },
    true
  );
  // (a finger that starts on a list but scrolls the page doesn't open it: only a tap does)
  let touchFrom = null;
  document.addEventListener("touchstart", (e) => (touchFrom = e.touches[0] ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null), { capture: true, passive: true });
  document.addEventListener(
    "touchend",
    (e) => {
      const sel = e.target.closest && e.target.closest("select");
      if (!sel) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      if (touchFrom && t && Math.hypot(t.clientX - touchFrom.x, t.clientY - touchFrom.y) > 10) return;
      openMenu(sel);
    },
    { capture: true, passive: false }
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (menuSelect) {
        const items = menuItems();
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          return closeMenu();
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          return menuMark(menuAt + (e.key === "ArrowDown" ? 1 : -1), true);
        }
        if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          return menuMark(e.key === "Home" ? 0 : items.length - 1, true);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          return pickFromMenu(menuAt);
        }
        // type-ahead (not while typing in the search box)
        if (e.key.length === 1 && !e.target.classList.contains("sm-search")) {
          menuTyped = Date.now() - menuTypedAt > 700 ? e.key.toLowerCase() : menuTyped + e.key.toLowerCase();
          menuTypedAt = Date.now();
          const i = items.findIndex((b) => b.textContent.trim().toLowerCase().startsWith(menuTyped));
          if (i >= 0) menuMark(i, true);
        }
        return;
      }
      const sel = e.target.tagName === "SELECT" ? e.target : null;
      if (sel && (e.key === " " || e.key === "Enter" || (e.altKey && e.key === "ArrowDown"))) {
        e.preventDefault();
        openMenu(sel);
      }
    },
    true
  );
  document.addEventListener("pointerdown", (e) => menuSelect && !menuEl.contains(e.target) && !e.target.closest("select") && closeMenu(), true);
  window.addEventListener("resize", menuPlace);
  window.addEventListener("scroll", (e) => menuSelect && !menuEl.contains(e.target) && !menuEl.classList.contains("sheet") && closeMenu(), true);

  window.UI = { esc, toast, download, PAGES, foldTools, signInPrompt, needSignIn, welcome, confirm: confirmBox, ask, paintMyPic, frameMyPic, pickDate, chipIntoView };
})();
