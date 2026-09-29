/*
 * Profile page: your name, stats, watch diary (with Wrapped) and charts.
 * Settings (theme, streaming services, import, backup, owner tools) are on their own
 * page: js/pages/settings.js
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("profile-app");

  root.innerHTML = `
    <div class="profile-grid">
      <div>
        <div class="panel profile-card">
          <img src="${esc((window.Cloud && Cloud.account() && Cloud.account().photo) || "images/placeholders/user.svg")}" alt="Profile picture" referrerpolicy="no-referrer" />
          <h1 class="p-name"></h1>
          <p class="muted p-joined"></p>
          <form class="name-form">
            <input class="input" name="displayName" aria-label="Display name" maxlength="40" />
            <button class="btn" type="submit">Save</button>
          </form>
          <button class="btn btn-primary p-signin" type="button" hidden><i class="fa-brands fa-google"></i> Sign in</button>
        </div>

        <a class="panel settings-link" href="settings.html">
          <i class="fa-solid fa-gear"></i>
          <span><strong>Settings</strong><small>Theme, streaming services, import, backup</small></span>
          <i class="fa-solid fa-chevron-right"></i>
        </a>
      </div>

      <div class="p-guest"${Store.guest ? "" : " hidden"}>${Store.guest ? UI.signInPrompt() : ""}</div>
      <div${Store.guest ? " hidden" : ""}>
        <div class="stat-strip stats-tiles" style="margin-top:0"></div>
        <div class="panel diary" id="diary" style="margin-top:24px">
          <h2><i class="fa-solid fa-book-open"></i> Watch diary</h2>
          <div class="diary-body"></div>
        </div>
        <div class="panel" style="margin-top:24px">
          <h2>My ratings</h2>
          <div class="bar-chart rating-chart"></div>
        </div>
        <div class="two-col" style="margin-top:24px">
          <div class="panel">
            <h2>Top rated</h2>
            <ol class="top-list top-rated"></ol>
          </div>
          <div class="panel">
            <h2>By decade</h2>
            <div class="bar-chart decade-chart"></div>
          </div>
        </div>
        <div class="panel" style="margin-top:24px">
          <h2>Average rating by type</h2>
          <div class="bar-chart type-chart"></div>
        </div>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);

  /* ---------------- profile ---------------- */

  function renderProfile() {
    const p = Store.getProfile();
    $(".p-name").textContent = p.name;
    // signed out: no name to edit, just a way to sign in
    $(".p-joined").textContent = p.guest ? "Not signed in. Sign in to keep your own ratings and lists." : p.joined ? `Joined: ${p.joined}` : "";
    $(".name-form").hidden = !!p.guest;
    $(".p-signin").hidden = !(p.guest && window.Cloud && Cloud.enabled);
    $(".name-form").elements.displayName.value = p.name;
    document.querySelectorAll(".profile-menu .user-info h2").forEach((h) => (h.textContent = p.name));
  }

  $(".p-signin").addEventListener("click", () => Cloud.signIn());
  // signed out: get Google sign-in ready so the button opens its window instantly (Safari needs that)
  if (Store.getProfile().guest && window.Cloud && Cloud.enabled) Cloud.prepare();

  $(".name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = e.target.elements.displayName.value.trim();
    if (!name) return;
    Store.setProfile({ name });
    renderProfile();
    toast("Name saved");
  });

  /* ---------------- stats ---------------- */

  function bars(el, rows, format) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    el.innerHTML = rows
      .map(
        (r) => `<div class="bar-row"><span>${esc(r.label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(r.value / max) * 100}%"></div></div>
          <span class="val">${format ? format(r.value) : r.value}</span></div>`
      )
      .join("");
  }

  /* ---------------- watch diary ---------------- */

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const niceDate = (d) => {
    const x = new Date(`${d}T00:00:00`);
    return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
  };

  function renderDiary() {
    const dated = Store.all()
      .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.watchedAt || ""))
      .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
    const box = $(".diary-body");
    if (!dated.length) {
      box.innerHTML = `<p class="help">Every title you rate or mark <b>Watched</b> gets the day you watched it, and shows up here
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
      months.push({ label: MONTHS[d.getMonth()], value: dated.filter((i) => i.watchedAt.startsWith(key)).length, key });
    }
    const max = Math.max(1, ...months.map((m) => m.value));

    // "a year ago": watched within a week of this day, last year
    const ago = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const from = new Date(ago - 7 * 86400000).toISOString().slice(0, 10);
    const to = new Date(+ago + 7 * 86400000).toISOString().slice(0, 10);
    const memory = dated.filter((i) => i.watchedAt >= from && i.watchedAt <= to).slice(0, 3);

    const line = (i) => `<li><a href="title.html?id=${encodeURIComponent(i.id)}">
        <img src="${Store.poster(Cards.posterOf(i), "w92")}" alt="" loading="lazy" />
        <span><strong>${esc(Lang.title(i))}</strong><small>${niceDate(i.watchedAt)}</small></span>
        ${i.rating != null ? `<b class="diary-score">★ ${Cards.formatRating(i.rating)}</b>` : ""}</a></li>`;

    box.innerHTML = `
      ${window.Wrapped ? `<button class="btn btn-primary wr-open" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> Your ${Wrapped.yearToShow()} Wrapped</button>` : ""}
      <div class="diary-tiles">
        <div><strong>${thisYear}</strong><span>watched in ${year}</span></div>
        <div><strong>${month}</strong><span>this month</span></div>
        <div><strong>${dated.length}</strong><span>in your diary</span></div>
      </div>
      <div class="diary-chart" role="img" aria-label="Titles watched per month, last 12 months"${months.some((m) => m.value) ? "" : " hidden"}>
        ${months
          .map(
            (m) => `<div class="dc-col" title="${m.value} in ${m.label}">
              <span class="dc-num">${m.value || ""}</span>
              <span class="dc-bar" style="height:${(m.value / max) * 100}%"></span>
              <small>${m.label}</small></div>`
          )
          .join("")}
      </div>
      ${memory.length ? `<h3 class="diary-sub"><i class="fa-solid fa-clock-rotate-left"></i> A year ago you watched</h3><ul class="diary-list">${memory.map(line).join("")}</ul>` : ""}
      <h3 class="diary-sub">Recently watched</h3>
      <ul class="diary-list">${dated.slice(0, 8).map(line).join("")}</ul>`;
  }

  $(".diary").addEventListener("click", (e) => {
    const b = e.target.closest(".wr-open");
    if (b && !b.disabled) {
      b.disabled = true;
      Wrapped.open(b).finally(() => (b.disabled = false));
    }
  });

  function renderStats() {
    renderDiary();
    const all = Store.all();
    const rated = all.filter((i) => i.rating != null);
    const avg = (list) => (list.length ? list.reduce((s, i) => s + i.rating, 0) / list.length : 0);

    const tiles = [
      ["Titles", all.length],
      ["Rated", rated.length],
      ["Average rating", rated.length ? avg(rated).toFixed(1) : "–"],
      ["Perfect 10s", rated.filter((i) => i.rating === 10).length],
      ["Favorites", all.filter((i) => i.favorite).length],
      ["Watchlist", all.filter((i) => i.watchlist).length],
    ];
    $(".stats-tiles").innerHTML = tiles
      .map(([label, num]) => `<div class="stat-tile"><div class="num">${num}</div><div class="label">${label}</div></div>`)
      .join("");

    // distribution of ratings, 10 down to 0
    const buckets = [];
    for (let n = 10; n >= 0; n--) {
      buckets.push({
        label: n === 10 ? "10" : `${n}–${n}.9`,
        value: rated.filter((i) => (n === 10 ? i.rating === 10 : i.rating >= n && i.rating < n + 1)).length,
      });
    }
    bars($(".rating-chart"), buckets);

    const decades = {};
    all.forEach((i) => {
      if (!i.year) return;
      const d = Math.floor(i.year / 10) * 10;
      decades[d] = (decades[d] || 0) + 1;
    });
    bars(
      $(".decade-chart"),
      Object.keys(decades)
        .sort()
        .map((d) => ({ label: `${d}s`, value: decades[d] }))
    );

    bars(
      $(".type-chart"),
      ["movie", "tv", "anime"].map((t) => {
        const list = rated.filter((i) => i.type === t);
        return { label: Store.TYPE_LABEL[t], value: Math.round(avg(list) * 10) / 10 };
      }),
      (v) => (v ? v.toFixed(1) : "–")
    );

    $(".top-rated").innerHTML = rated
      .slice()
      .sort((a, b) => b.rating - a.rating || a.order - b.order)
      .slice(0, 10)
      .map(
        (i) => `<li><a href="title.html?id=${encodeURIComponent(i.id)}">${esc(Lang.title(i))} <span class="muted">(${i.year})</span></a>
          <span>★ ${Cards.formatRating(i.rating)}</span></li>`
      )
      .join("");
  }

  Store.onChange(renderStats);
  renderProfile();
  renderStats();

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
