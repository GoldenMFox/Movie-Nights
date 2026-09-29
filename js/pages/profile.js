/*
 * Profile page (Apple Fitness / Health style): a header with your photo and name, glass
 * stat tiles with a "rated" ring, the Wrapped banner, the watch diary (with a row of the
 * posters you watched lately) and the charts.
 * Settings (theme, streaming services, import, backup, owner tools) are on their own
 * page: js/pages/settings.js
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("profile-app");
  const photo = (window.Cloud && Cloud.account() && Cloud.account().photo) || "images/placeholders/user.svg";

  root.innerHTML = `
    <div class="pf">
      <header class="pf-hero">
        <div class="pf-hero-bg" style="background-image:url('${esc(photo)}')" aria-hidden="true"></div>
        <div class="pf-hero-tools">
          <button class="pf-round pf-edit" type="button" aria-label="Edit your name" title="Edit your name"${Store.guest ? " hidden" : ""}><i class="fa-solid fa-pen"></i></button>
          <a class="pf-round" href="settings.html" aria-label="Settings" title="Settings"><i class="fa-solid fa-gear"></i></a>
        </div>
        <div class="pf-avatar"><img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" /></div>
        <h1 class="p-name"></h1>
        <p class="p-joined"></p>
        <form class="name-form" hidden>
          <input class="input" name="displayName" aria-label="Display name" maxlength="40" />
          <button class="btn btn-primary" type="submit">Save</button>
          <button class="btn pf-cancel" type="button">Cancel</button>
        </form>
        <button class="btn btn-primary p-signin" type="button" hidden><i class="fa-brands fa-google"></i> Sign in</button>
      </header>

      <div class="p-guest"${Store.guest ? "" : " hidden"}>${Store.guest ? UI.signInPrompt() : ""}</div>

      <div class="pf-body"${Store.guest ? " hidden" : ""}>
        <div class="pf-stats"></div>
        <div class="pf-wrapped-slot"></div>

        <section class="pf-card diary" id="diary">
          <h2 class="pf-title"><i class="fa-solid fa-book-open" style="--ic:#ff9f0a"></i> Watch diary</h2>
          <div class="diary-body"></div>
        </section>

        <div class="pf-two">
          <section class="pf-card">
            <h2 class="pf-title"><i class="fa-solid fa-star" style="--ic:#ffd60a"></i> My ratings</h2>
            <div class="pf-histo rating-chart"></div>
          </section>
          <section class="pf-card">
            <h2 class="pf-title"><i class="fa-solid fa-trophy" style="--ic:#bf5af2"></i> Top rated</h2>
            <ol class="pf-top top-rated"></ol>
          </section>
        </div>

        <div class="pf-two">
          <section class="pf-card">
            <h2 class="pf-title"><i class="fa-solid fa-hourglass-half" style="--ic:#64d2ff"></i> By decade</h2>
            <div class="pf-bars decade-chart"></div>
          </section>
          <section class="pf-card">
            <h2 class="pf-title"><i class="fa-solid fa-layer-group" style="--ic:#30d158"></i> Average by type</h2>
            <div class="pf-types type-chart"></div>
          </section>
        </div>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);

  /* ---------------- you ---------------- */

  function renderProfile() {
    const p = Store.getProfile();
    $(".p-name").textContent = p.name;
    // signed out: no name to edit, just a way to sign in
    $(".p-joined").textContent = p.guest ? "Not signed in" : p.joined ? `Member since ${p.joined}` : "Movie Nights member";
    $(".p-signin").hidden = !(p.guest && window.Cloud && Cloud.enabled);
    $(".name-form").elements.displayName.value = p.name;
    document.querySelectorAll(".profile-menu .user-info h2").forEach((h) => (h.textContent = p.name));
  }

  $(".p-signin").addEventListener("click", () => Cloud.signIn());
  // signed out: get Google sign-in ready so the button opens its window instantly (Safari needs that)
  if (Store.getProfile().guest && window.Cloud && Cloud.enabled) Cloud.prepare();

  // ✏️ shows the name field instead of the name
  const editing = (on) => {
    $(".name-form").hidden = !on;
    $(".p-name").hidden = on;
    if (on) $(".name-form").elements.displayName.focus();
  };
  $(".pf-edit").addEventListener("click", () => editing(true));
  $(".pf-cancel").addEventListener("click", () => editing(false));
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
  const niceDate = (d) => {
    const x = new Date(`${d}T00:00:00`);
    return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
  };
  const poster = (i, size) => Store.poster(Cards.posterOf(i), size || "w185");

  /* ---------------- stat tiles + the "rated" ring ---------------- */

  function renderTiles(all, rated, avg) {
    const pct = all.length ? Math.round((rated.length / all.length) * 100) : 0;
    const tile = (icon, color, num, label, href) =>
      `<${href ? `a href="${href}"` : "div"} class="pf-tile" style="--ic:${color}">
        <i class="fa-solid ${icon}"></i><b>${num}</b><span>${label}</span>
      </${href ? "a" : "div"}>`;
    $(".pf-stats").innerHTML = `
      <div class="pf-ring-card">
        <div class="pf-ring" style="--p:${pct}"><div><b>${pct}%</b><span>rated</span></div></div>
        <div class="pf-ring-text"><b>${rated.length}</b> of <b>${all.length}</b> titles have your score</div>
      </div>
      <div class="pf-tiles">
        ${tile("fa-film", "#ff453a", all.length, "Titles", "movies.html")}
        ${tile("fa-star", "#ffd60a", rated.length ? avg.toFixed(1) : "–", "Average score")}
        ${tile("fa-crown", "#bf5af2", rated.filter((i) => i.rating === 10).length, "Perfect 10s", "movies.html?sort=rating-desc")}
        ${tile("fa-heart", "#ff375f", all.filter((i) => i.favorite).length, "Favorites", "watchlist.html?list=fav")}
        ${tile("fa-bookmark", "#30d158", all.filter((i) => i.watchlist).length, "Watchlist", "watchlist.html")}
        ${tile("fa-list-ul", "#64d2ff", Store.lists().length, "Your lists", "watchlist.html")}
      </div>`;
  }

  /* ---------------- Wrapped banner ---------------- */

  function renderWrapped() {
    const slot = $(".pf-wrapped-slot");
    if (!window.Wrapped) return (slot.innerHTML = "");
    const year = Wrapped.yearToShow();
    const seen = Store.all().filter((i) => String(i.watchedAt || "").startsWith(String(year)));
    const pics = seen.filter((i) => Cards.posterOf(i)).slice(-8).reverse();
    slot.innerHTML = `<button class="pf-wrapped wr-open" type="button">
        <span class="pf-wrapped-art" aria-hidden="true">${pics.map((i) => `<img src="${poster(i, "w185")}" alt="" loading="lazy" />`).join("")}</span>
        <span class="pf-wrapped-text">
          <small>Movie Nights Wrapped</small>
          <strong>Your ${year} in movies</strong>
          <span>${seen.length >= 3 ? `${seen.length} titles so far · tap to relive them` : "Rate or mark a few titles as watched to unlock it"}</span>
        </span>
        <i class="fa-solid fa-play pf-wrapped-play"></i>
      </button>`;
  }

  /* ---------------- watch diary ---------------- */

  function renderDiary() {
    const dated = Store.all()
      .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.watchedAt || ""))
      .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
    const box = $(".diary-body");
    if (!dated.length) {
      box.innerHTML = `<p class="pf-empty">Every title you rate or mark <b>Watched</b> gets the day you watched it, and shows up here
        (an import from IMDb or Letterboxd brings its dates too).</p>`;
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
    const memory = dated.filter((i) => i.watchedAt >= from && i.watchedAt <= to).slice(0, 6);

    const posterRow = (list) => `<div class="pf-posters">${list
      .map(
        (i) => `<a class="pf-poster" href="title.html?id=${encodeURIComponent(i.id)}" title="${esc(Lang.title(i))}">
          <img src="${poster(i)}" alt="" loading="lazy" />
          ${i.rating != null ? `<b>★ ${Cards.formatRating(i.rating)}</b>` : ""}
          <span>${esc(Lang.title(i))}</span><small>${niceDate(i.watchedAt)}</small>
        </a>`
      )
      .join("")}</div>`;

    box.innerHTML = `
      <div class="pf-diary-top">
        <div class="pf-mini"><b>${thisYear}</b><span>in ${year}</span></div>
        <div class="pf-mini"><b>${month}</b><span>this month</span></div>
        <div class="pf-mini"><b>${dated.length}</b><span>all time</span></div>
      </div>
      <div class="pf-months" role="img" aria-label="Titles watched per month, last 12 months"${months.some((m) => m.value) ? "" : " hidden"}>
        ${months
          .map(
            (m, n) => `<div class="pf-month${n === 11 ? " now" : ""}" title="${m.value} in ${m.label}">
              <span class="pf-month-num">${m.value || ""}</span>
              <span class="pf-month-bar"><i style="height:${Math.max(4, (m.value / max) * 100)}%"></i></span>
              <small>${m.label}</small></div>`
          )
          .join("")}
      </div>
      ${memory.length ? `<h3 class="pf-sub"><i class="fa-solid fa-clock-rotate-left"></i> A year ago you watched</h3>${posterRow(memory)}` : ""}
      <h3 class="pf-sub">Recently watched</h3>
      ${posterRow(dated.slice(0, 12))}`;
  }

  // Wrapped: the banner (or its button in the diary) opens the story
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".wr-open");
    if (b && !b.disabled && window.Wrapped) {
      b.disabled = true;
      Wrapped.open(b).finally(() => (b.disabled = false));
    }
  });

  /* ---------------- charts ---------------- */

  function renderStats() {
    const all = Store.all();
    const rated = all.filter((i) => i.rating != null);
    const avg = (list) => (list.length ? list.reduce((s, i) => s + i.rating, 0) / list.length : 0);

    renderTiles(all, rated, avg(rated));
    renderWrapped();
    renderDiary();

    // how you rate: a column for each score, 0 → 10
    const buckets = [];
    for (let n = 0; n <= 10; n++) buckets.push({ label: String(n), value: rated.filter((i) => (n === 10 ? i.rating === 10 : i.rating >= n && i.rating < n + 1)).length });
    const hMax = Math.max(1, ...buckets.map((b) => b.value));
    const peak = buckets.reduce((a, b) => (b.value > a.value ? b : a), buckets[0]);
    $(".rating-chart").innerHTML = `
      <div class="pf-histo-cols">${buckets
        .map(
          (b) => `<div class="pf-hcol${b === peak && b.value ? " peak" : ""}" title="${b.value} rated ${b.label}${b.label === "10" ? "" : `–${b.label}.9`}">
            <span class="pf-hnum">${b.value || ""}</span>
            <span class="pf-hbar"><i style="height:${Math.max(3, (b.value / hMax) * 100)}%"></i></span>
            <small>${b.label}</small></div>`
        )
        .join("")}</div>
      ${rated.length ? `<p class="pf-caption">You give <b>${peak.label}${peak.label === "10" ? "" : "s"}</b> most often · average <b>${avg(rated).toFixed(1)}</b></p>` : ""}`;

    // decades: horizontal bars
    const decades = {};
    all.forEach((i) => {
      if (!i.year) return;
      const d = Math.floor(i.year / 10) * 10;
      decades[d] = (decades[d] || 0) + 1;
    });
    const dKeys = Object.keys(decades).sort();
    const dMax = Math.max(1, ...Object.values(decades));
    $(".decade-chart").innerHTML = dKeys.length
      ? dKeys
          .map(
            (d) => `<div class="pf-bar"><span>${d}s</span><div><i style="width:${(decades[d] / dMax) * 100}%"></i></div><b>${decades[d]}</b></div>`
          )
          .join("")
      : '<p class="pf-empty">Nothing yet.</p>';

    // average by type: three rings
    $(".type-chart").innerHTML = ["movie", "tv", "anime"]
      .map((t) => {
        const list = rated.filter((i) => i.type === t);
        const v = avg(list);
        return `<div class="pf-type">
          <div class="pf-ring small" style="--p:${Math.round(v * 10)}"><div><b>${v ? v.toFixed(1) : "–"}</b></div></div>
          <strong>${Store.TYPE_LABEL[t]}</strong><small>${list.length} rated</small>
        </div>`;
      })
      .join("");

    // top rated: a ranked list with posters
    $(".top-rated").innerHTML =
      rated
        .slice()
        .sort((a, b) => b.rating - a.rating || a.order - b.order)
        .slice(0, 8)
        .map(
          (i, n) => `<li><a href="title.html?id=${encodeURIComponent(i.id)}">
            <span class="pf-rank">${n + 1}</span>
            <img src="${poster(i, "w92")}" alt="" loading="lazy" />
            <span class="pf-top-name"><strong>${esc(Lang.title(i))}</strong><small>${i.year || ""} · ${Store.TYPE_LABEL[i.type] || ""}</small></span>
            <b>★ ${Cards.formatRating(i.rating)}</b></a></li>`
        )
        .join("") || '<p class="pf-empty">Rate something to see your top list.</p>';
  }

  Store.onChange(renderStats);
  renderProfile();
  renderStats();

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
