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

  // EN | RU switch for movie names (in the profile menu on computers; in the side menu on phones)
  const langToggle = (where) => `<div class="lang-toggle ${where}" role="group" aria-label="Movie names language">
      ${where === "in-menu" ? "<span>Movie names</span>" : ""}
      ${where === "in-profile" ? `<i class="fa-solid fa-language"></i><span>Movie names</span>` : ""}
      <button type="button" data-lang="en" aria-pressed="${!Lang.isRu()}" class="${Lang.isRu() ? "" : "active"}">EN</button>
      <button type="button" data-lang="ru" aria-pressed="${Lang.isRu()}" class="${Lang.isRu() ? "active" : ""}">RU</button>
    </div>`;
  const profile = Store.getProfile();

  /* ---------------- navbar ---------------- */

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `
    <div class="nav-bar">
      <button class="icon-btn nav-back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
      <button class="nav-toggle" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>
      <a class="nav-logo" href="index.html"><img src="images/logo.png" alt="Movie Nights" /></a>
      <div class="nav-menu">
        <div class="nav-menu-head">
          <a class="nav-logo" href="index.html"><img src="images/logo.png" alt="Movie Nights" /></a>
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
            <input type="search" placeholder="Search your library..." aria-label="Search your library" autocomplete="off" />
            <ul class="search-results"></ul>
          </div>
        </div>
        <div class="profile">
          <button class="user-pic-btn" aria-label="Profile menu">
            <img src="images/avatar.jpg" class="user-pic" alt="" />
          </button>
          <div class="profile-menu">
            <div class="user-info">
              <img src="images/avatar.jpg" alt="" />
              <h2>${esc(profile.name)}</h2>
            </div>
            <hr />
            <a href="profile.html"><i class="fa-solid fa-user"></i><span>Profile &amp; stats</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="#" data-action="add-title"><i class="fa-solid fa-plus"></i><span>Add a title</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="profile.html#settings"><i class="fa-solid fa-gear"></i><span>Settings &amp; backup</span><i class="fa-solid fa-chevron-right"></i></a>
            <a href="#" class="install-app" hidden><i class="fa-solid fa-mobile-screen"></i><span>Install the app</span><i class="fa-solid fa-chevron-right"></i></a>
            ${langToggle("in-profile")}
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

  /* ---------------- movie names language ---------------- */

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn || btn.dataset.lang === Lang.get()) return;
    Lang.set(btn.dataset.lang);
    location.reload(); // every list, card and title picks up the new names
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
  });

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

  function renderResults() {
    const q = searchInput.value.trim().toLowerCase();
    focused = -1;
    if (!q) {
      resultsList.innerHTML = "";
      return;
    }
    const hits = Store.all()
      .map((item) => {
        // match the English and the Russian name
        const names = [item.title, item.titleRu].filter(Boolean).map((n) => n.toLowerCase());
        const score = names.includes(q) ? 0 : names.some((n) => n.startsWith(q)) ? 1 : names.some((n) => n.includes(q)) ? 2 : String(item.year) === q ? 3 : -1;
        return { item, score };
      })
      .filter((h) => h.score >= 0)
      .sort((a, b) => a.score - b.score || Lang.title(a.item).localeCompare(Lang.title(b.item)))
      .slice(0, 8);

    resultsList.innerHTML = hits.length
      ? hits
          .map(
            ({ item }) => `<li><a href="title.html?id=${encodeURIComponent(item.id)}">
              <img src="${Store.poster(item.poster, "w92")}" alt="" loading="lazy" />
              <span>${esc(Lang.title(item))}<small>${item.year} · ${Store.TYPE_LABEL[item.type] || ""}${
              item.rating != null ? " · ★ " + item.rating : ""
            }</small></span></a></li>`
          )
          .join("")
      : `<li class="search-empty">No titles match "${esc(searchInput.value)}"</li>`;
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
  footer.innerHTML = `
    <div class="footer-inner">
      <div>
        <a href="index.html"><img src="images/logo.png" alt="Movie Nights" /></a>
        <p>Movie Nights: a personal list of the movies, TV shows and anime we've watched,
        rated and ranked, plus everything still waiting on the watchlist.</p>
      </div>
      <div>
        <h3>Browse</h3>
        <ul>${PAGES.slice(0, 5).map((p) => `<li><a href="${p.href}">${p.label}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h3>My lists</h3>
        <ul>
          ${PAGES.slice(5).map((p) => `<li><a href="${p.href}">${p.label}</a></li>`).join("")}
          <li><a href="profile.html">Profile &amp; stats</a></li>
        </ul>
      </div>
    </div>
    <div class="copyright">&copy; 2023&ndash;${year} Movie Nights by Mirzac Nicolae &amp; Alexandru Donoaga</div>`;
  document.body.append(footer);

  /* ---------------- installed app (PWA) ---------------- */

  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) document.documentElement.classList.add("standalone");

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

  window.UI = { esc, toast, download, PAGES };
})();
