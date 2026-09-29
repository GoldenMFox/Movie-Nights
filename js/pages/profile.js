/*
 * Profile page, in the site's own style: a header like a title page (a blurred backdrop
 * from your favourite, your photo, name and pill buttons), glass stat cards with small red
 * labels (like X-Ray), the Wrapped banner, the watch diary with real poster rows, your
 * Top 10 (like Home's) and a few charts in the red accent.
 * Settings (theme, streaming services, import, backup, owner tools) are on their own
 * page: js/pages/settings.js
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("profile-app");
  const photo = (window.Cloud && Cloud.account() && Cloud.account().photo) || "images/placeholders/user.svg";
  const label = (icon, text) => `<span class="xr-label"><i class="fa-solid ${icon}"></i> ${text}</span>`;

  root.innerHTML = `
    <div class="pv">
      <header class="pv-hero">
        <div class="pv-backdrop" aria-hidden="true"></div>
        <div class="pv-hero-inner">
          <div class="pv-avatar"><img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" /></div>
          <div class="pv-who">
            <span class="hero-kicker"><i class="fa-solid fa-user"></i> Your profile</span>
            <h1 class="p-name"></h1>
            <p class="p-joined"></p>
            <form class="name-form" hidden>
              <input class="input" name="displayName" aria-label="Display name" maxlength="40" />
              <button class="btn btn-primary" type="submit">Save</button>
              <button class="btn pv-cancel" type="button">Cancel</button>
            </form>
            <div class="pv-actions">
              <button class="btn pv-edit" type="button"${Store.guest ? " hidden" : ""}><i class="fa-solid fa-pen"></i> Edit name</button>
              <a class="btn" href="settings.html"><i class="fa-solid fa-gear"></i> Settings</a>
              <button class="btn btn-primary p-signin" type="button" hidden><i class="fa-brands fa-google"></i> Sign in</button>
            </div>
          </div>
        </div>
      </header>

      <div class="p-guest"${Store.guest ? "" : " hidden"}>${Store.guest ? UI.signInPrompt() : ""}</div>

      <div class="pv-body"${Store.guest ? " hidden" : ""}>
        <div class="xr-grid pv-stats"></div>
        <div class="pv-wrapped-slot"></div>

        <section class="pv-section diary" id="diary">
          <div class="row-head"><h2><i class="fa-solid fa-book-open"></i> Watch diary</h2></div>
          <div class="diary-body"></div>
        </section>

        <section class="row-section top10 pv-top"></section>

        <section class="pv-section">
          <div class="row-head"><h2><i class="fa-solid fa-chart-simple"></i> Your taste</h2></div>
          <div class="xr-grid pv-charts">
            <div class="xr-card xr-money pv-histo-card">${label("fa-star", "My ratings")}<div class="pv-histo rating-chart"></div></div>
            <div class="xr-card">${label("fa-hourglass-half", "By decade")}<div class="pv-bars decade-chart"></div></div>
            <div class="xr-card">${label("fa-layer-group", "Average by type")}<div class="pv-bars type-chart"></div></div>
          </div>
        </section>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);

  /* ---------------- you ---------------- */

  function renderProfile() {
    const p = Store.getProfile();
    const all = Store.all();
    $(".p-name").textContent = p.name;
    // signed out: no name to edit, just a way to sign in
    $(".p-joined").innerHTML = p.guest
      ? "Not signed in"
      : [p.joined ? `Member since ${esc(p.joined)}` : "", `${all.length} title${all.length === 1 ? "" : "s"}`, `${all.filter((i) => i.rating != null).length} rated`]
          .filter(Boolean)
          .join('<span class="dot">·</span>');
    $(".p-signin").hidden = !(p.guest && window.Cloud && Cloud.enabled);
    $(".name-form").elements.displayName.value = p.name;
    document.querySelectorAll(".profile-menu .user-info h2").forEach((h) => (h.textContent = p.name));

    // the backdrop: your favourite (or best-rated) title, like a title page's header
    const fav = all
      .filter((i) => i.backdrop || Cards.posterOf(i))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.rating ?? -1) - (a.rating ?? -1))[0];
    $(".pv-backdrop").innerHTML = fav
      ? fav.backdrop
        ? `<img src="${Store.img(fav.backdrop, "w1280")}" alt="" />`
        : `<img class="pv-backdrop-blur" src="${Store.poster(Cards.posterOf(fav), "w500")}" alt="" />`
      : "";
  }

  $(".p-signin").addEventListener("click", () => Cloud.signIn());
  // signed out: get Google sign-in ready so the button opens its window instantly (Safari needs that)
  if (Store.getProfile().guest && window.Cloud && Cloud.enabled) Cloud.prepare();

  const editing = (on) => {
    $(".name-form").hidden = !on;
    $(".p-name").hidden = on;
    $(".pv-actions").hidden = on;
    if (on) $(".name-form").elements.displayName.focus();
  };
  $(".pv-edit").addEventListener("click", () => editing(true));
  $(".pv-cancel").addEventListener("click", () => editing(false));
  $(".name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = e.target.elements.displayName.value.trim();
    if (!name) return;
    Store.setProfile({ name });
    renderProfile();
    editing(false);
    toast("Name saved");
  });

  /* ---------------- helpers ---------------- */

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const bar = (name, value, max, text) =>
    `<div class="pv-bar"><span>${name}</span><div><i style="width:${max ? Math.max(2, (value / max) * 100) : 0}%"></i></div><b>${text ?? value}</b></div>`;

  /* ---------------- stat cards (X-Ray style) ---------------- */

  function renderStatCards(all, rated, avg) {
    const pct = all.length ? Math.round((rated.length / all.length) * 100) : 0;
    const card = (icon, name, big, sub, href, extra = "") =>
      `<${href ? `a href="${href}"` : "div"} class="xr-card pv-stat">
        ${label(icon, name)}
        <div class="pv-big">${big}</div>
        ${sub ? `<small>${sub}</small>` : ""}${extra}
      </${href ? "a" : "div"}>`;
    $(".pv-stats").innerHTML = [
      card("fa-film", "Titles", all.length, "in your library", "movies.html"),
      card("fa-star", "Rated", rated.length, `${pct}% of your library`, "", `<div class="col-bar pv-progress"><span style="width:${pct}%"></span></div>`),
      card("fa-chart-line", "Average", rated.length ? avg.toFixed(1) : "–", "out of 10"),
      card("fa-crown", "Perfect 10s", rated.filter((i) => i.rating === 10).length, "the very best", "movies.html?sort=rating-desc"),
      card("fa-heart", "Favorites", all.filter((i) => i.favorite).length, "hearted", "watchlist.html?list=fav"),
      card("fa-bookmark", "Watchlist", all.filter((i) => i.watchlist).length, "waiting to be watched", "watchlist.html"),
    ].join("");
  }

  /* ---------------- Wrapped banner ---------------- */

  function renderWrapped() {
    const slot = $(".pv-wrapped-slot");
    if (!window.Wrapped) return (slot.innerHTML = "");
    const year = Wrapped.yearToShow();
    const seen = Store.all().filter((i) => String(i.watchedAt || "").startsWith(String(year)));
    const pics = seen.filter((i) => Cards.posterOf(i)).slice(-6).reverse();
    slot.innerHTML = `<button class="pv-wrapped wr-open" type="button">
        <span class="pv-wrapped-art" aria-hidden="true">${pics.map((i) => `<img src="${Store.poster(Cards.posterOf(i), "w185")}" alt="" loading="lazy" />`).join("")}</span>
        <span class="pv-wrapped-text">
          ${label("fa-wand-magic-sparkles", "Movie Nights Wrapped")}
          <strong>Your ${year} in movies</strong>
          <span>${seen.length >= 3 ? `${seen.length} titles so far. Tap to relive them.` : "Rate or mark a few titles as watched to unlock it."}</span>
        </span>
        <span class="hero-play pv-wrapped-play"><i class="fa-solid fa-play"></i> Play</span>
      </button>`;
  }

  /* ---------------- watch diary ---------------- */

  function renderDiary() {
    const dated = Store.all()
      .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.watchedAt || ""))
      .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
    const box = $(".diary-body");
    if (!dated.length) {
      box.innerHTML = `<div class="xr-card"><p class="pv-empty">Every title you rate or mark <b>Watched</b> gets the day you watched it, and shows up here
        (an import from IMDb or Letterboxd brings its dates too).</p></div>`;
      return;
    }
    const now = new Date();
    const year = String(now.getFullYear());
    const thisYear = dated.filter((i) => i.watchedAt.startsWith(year)).length;
    const month = dated.filter((i) => i.watchedAt.startsWith(Store.today().slice(0, 7))).length;

    // the last 12 months, oldest first
    const months = [];
    for (let n = 11; n >= 0; n--) {
      const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ label: MONTHS[d.getMonth()], value: dated.filter((i) => i.watchedAt.startsWith(key)).length });
    }
    const max = Math.max(1, ...months.map((m) => m.value));

    // "a year ago": watched within a week of this day, last year
    const ago = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const from = new Date(ago - 7 * 86400000).toISOString().slice(0, 10);
    const to = new Date(+ago + 7 * 86400000).toISOString().slice(0, 10);
    const memory = dated.filter((i) => i.watchedAt >= from && i.watchedAt <= to);

    const row = (title, icon, list) => `<section class="row-section pv-row">
        <div class="row-head"><h2><i class="fa-solid ${icon}"></i> ${title}</h2></div>
        <div class="movie-row">${list.slice(0, 20).map(Cards.card).join("")}</div>
      </section>`;

    box.innerHTML = `
      <div class="xr-grid pv-diary">
        <div class="xr-card pv-stat">${label("fa-calendar", `In ${year}`)}<div class="pv-big">${thisYear}</div><small>watched</small></div>
        <div class="xr-card pv-stat">${label("fa-calendar-day", "This month")}<div class="pv-big">${month}</div><small>watched</small></div>
        <div class="xr-card pv-stat">${label("fa-book-open", "All time")}<div class="pv-big">${dated.length}</div><small>in your diary</small></div>
        <div class="xr-card xr-money pv-months-card"${months.some((m) => m.value) ? "" : " hidden"}>
          ${label("fa-chart-column", "Last 12 months")}
          <div class="pv-months" role="img" aria-label="Titles watched per month, last 12 months">
            ${months
              .map(
                (m, n) => `<div class="pv-month${n === 11 ? " now" : ""}" title="${m.value} in ${m.label}">
                  <span class="pv-month-num">${m.value || ""}</span>
                  <span class="pv-month-bar"><i style="height:${Math.max(3, (m.value / max) * 100)}%"></i></span>
                  <small>${m.label}</small></div>`
              )
              .join("")}
          </div>
        </div>
      </div>
      ${memory.length ? row("A year ago you watched", "fa-clock-rotate-left", memory) : ""}
      ${row("Recently watched", "fa-play", dated)}`;
  }

  // the Wrapped banner opens the story
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".wr-open");
    if (b && !b.disabled && window.Wrapped) {
      b.disabled = true;
      Wrapped.open(b).finally(() => (b.disabled = false));
    }
  });

  /* ---------------- your Top 10 (like Home's) ---------------- */

  function renderTop(rated) {
    const top = rated
      .slice()
      .sort((a, b) => b.rating - a.rating || a.order - b.order)
      .slice(0, 10);
    $(".pv-top").hidden = top.length < 3;
    $(".pv-top").innerHTML = `
      <div class="row-head top10-head"><h2><span class="top10-word">TOP 10</span><span class="top10-sub">yours</span></h2></div>
      <div class="movie-row top10-row">${top
        .map(
          (i, n) => `<a class="top10-item" href="title.html?id=${encodeURIComponent(i.id)}" title="#${n + 1} · ${esc(Lang.title(i))} · ★ ${Cards.formatRating(i.rating)}">
            <span class="top10-num" aria-hidden="true">${n + 1}</span>
            <img src="${Store.poster(Cards.posterOf(i), "w342")}" alt="${esc(Lang.title(i))}" loading="lazy" decoding="async" />
          </a>`
        )
        .join("")}</div>`;
  }

  /* ---------------- charts ---------------- */

  function renderStats() {
    const all = Store.all();
    const rated = all.filter((i) => i.rating != null);
    const avg = (list) => (list.length ? list.reduce((s, i) => s + i.rating, 0) / list.length : 0);

    renderProfile();
    renderStatCards(all, rated, avg(rated));
    renderWrapped();
    renderDiary();
    renderTop(rated);

    // how you rate: a column for each score, 0 → 10
    const buckets = [];
    for (let n = 0; n <= 10; n++) buckets.push({ label: String(n), value: rated.filter((i) => (n === 10 ? i.rating === 10 : i.rating >= n && i.rating < n + 1)).length });
    const hMax = Math.max(1, ...buckets.map((b) => b.value));
    const peak = buckets.reduce((a, b) => (b.value > a.value ? b : a), buckets[0]);
    $(".rating-chart").innerHTML = `
      <div class="pv-months pv-histo-cols">${buckets
        .map(
          (b) => `<div class="pv-month${b === peak && b.value ? " now" : ""}" title="${b.value} rated ${b.label}">
            <span class="pv-month-num">${b.value || ""}</span>
            <span class="pv-month-bar"><i style="height:${Math.max(3, (b.value / hMax) * 100)}%"></i></span>
            <small>${b.label}</small></div>`
        )
        .join("")}</div>
      ${rated.length ? `<small class="pv-caption">You give <b>${peak.label}s</b> most often · average <b>${avg(rated).toFixed(1)}</b></small>` : ""}`;

    // decades
    const decades = {};
    all.forEach((i) => {
      if (!i.year) return;
      const d = Math.floor(i.year / 10) * 10;
      decades[d] = (decades[d] || 0) + 1;
    });
    const dMax = Math.max(1, ...Object.values(decades));
    $(".decade-chart").innerHTML =
      Object.keys(decades)
        .sort()
        .map((d) => bar(`${d}s`, decades[d], dMax))
        .join("") || '<p class="pv-empty">Nothing yet.</p>';

    // average by type
    $(".type-chart").innerHTML = ["movie", "tv", "anime"]
      .map((t) => {
        const list = rated.filter((i) => i.type === t);
        const v = avg(list);
        return bar(Store.TYPE_LABEL[t], v, 10, v ? v.toFixed(1) : "–");
      })
      .join("");
  }

  Store.onChange(renderStats);
  renderStats();

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
