/*
 * Profile page: your name, stats about your library, settings and backup.
 * The owner also gets the TMDB / OMDb settings and the Members panel.
 */
(function () {
  const { esc, toast, download } = UI;
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

        <div class="panel" id="settings">
          <h2><i class="fa-solid fa-gear"></i> Settings</h2>
          <div class="stack">
            <label class="field">Theme
              <select class="select" name="theme"><option value="dark">Dark</option><option value="light">Light</option></select>
            </label>
            <div class="stack owner-only">
            <label class="field">TMDB API key (optional)
              <input class="input" name="tmdb" type="password" autocomplete="off" placeholder="Paste your key or read access token" />
            </label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary save-key" type="button">Save key</button>
              <button class="btn test-key" type="button">Test</button>
              <button class="btn clear-key" type="button">Remove</button>
            </div>
            <p class="help tmdb-status"></p>
            <p class="help omdb-status"></p>
            <p class="help">Free at themoviedb.org → Settings → API. A key typed here is stored only in this browser
              and overrides the one in <code>js/config.js</code>.</p>
            </div>
          </div>
        </div>

        <div class="panel" id="backup"${Store.guest ? " hidden" : ""}>
          <h2><i class="fa-solid fa-floppy-disk"></i> Backup</h2>
          <div class="stack">
            <button class="btn export-backup" type="button"><i class="fa-solid fa-file-export"></i> Download backup</button>
            <label class="btn" style="cursor:pointer"><i class="fa-solid fa-file-import"></i> Restore backup
              <input type="file" accept=".json,application/json" class="import-file" hidden />
            </label>
            <p class="help">Your library is saved in your account and synced to every device you sign in on. A backup is an extra copy you keep yourself.</p>
            <button class="btn btn-danger reset-all" type="button"><i class="fa-solid fa-trash-can"></i> Delete my library</button>
          </div>
        </div>
      </div>

      <div class="p-guest"${Store.guest ? "" : " hidden"}>${Store.guest ? UI.signInPrompt() : ""}</div>
      <div${Store.guest ? " hidden" : ""}>
        <div class="panel members owner-only" id="members">
          <h2><i class="fa-solid fa-users"></i> Members</h2>
          <p class="help">Everyone who has signed in. You see how big their library is, never their ratings.</p>
          <div class="member-list"><p class="help">Loading…</p></div>
          <p class="help">To let someone in, add their Google email to the rules in the Firebase console
            (Firestore → Rules), then ask them to sign in here.</p>
        </div>
        <div class="stat-strip stats-tiles" style="margin-top:0"></div>
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

  function renderStats() {
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

  /* ---------------- settings ---------------- */

  const themeSel = $('[name="theme"]');
  themeSel.value = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  themeSel.addEventListener("change", () => {
    if (themeSel.value === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("mn:theme", themeSel.value);
    } catch (e) {}
  });

  const keyInput = $('[name="tmdb"]');
  function showKeyStatus() {
    const src = TMDB.keySource();
    $(".tmdb-status").textContent = src === "config" ? "✔ Using the TMDB key from js/config.js." : src === "browser" ? "✔ Using the TMDB key saved in this browser." : "No TMDB key yet: Discover and trailers are off.";
  }
  showKeyStatus();

  function showOmdbStatus() {
    const s = Ratings.status();
    $(".omdb-status").textContent = !s.enabled
      ? s.keyRejected
        ? "✖ OMDb rejected the key in js/config.js: IMDb ratings are off."
        : "No OMDb key: cards show the TMDB score instead of IMDb."
      : `✔ IMDb ratings on. OMDb lookups today: ${s.used} of ${s.limit}${s.blocked ? " (daily limit reached, more tomorrow)" : ""}. Ratings saved: ${s.cached}.`;
  }
  showOmdbStatus();
  Ratings.onChange(showOmdbStatus);
  try {
    keyInput.value = localStorage.getItem(Store.KEYS.tmdbKey) || "";
  } catch (e) {}

  function saveKey() {
    try {
      localStorage.setItem(Store.KEYS.tmdbKey, keyInput.value.trim());
      return true;
    } catch (e) {
      toast("Could not save the key in this browser");
      return false;
    }
  }

  $(".save-key").addEventListener("click", () => {
    if (saveKey()) toast(keyInput.value.trim() ? "TMDB key saved" : "TMDB key removed");
    showKeyStatus();
  });

  $(".test-key").addEventListener("click", async () => {
    if (!saveKey()) return;
    try {
      await TMDB.test();
      toast("✔ TMDB key works");
    } catch (e) {
      toast(`✖ ${e.message}`);
    }
  });

  $(".clear-key").addEventListener("click", () => {
    keyInput.value = "";
    try {
      localStorage.removeItem(Store.KEYS.tmdbKey);
      localStorage.removeItem(Store.KEYS.tmdbCache);
    } catch (e) {}
    toast("Browser key removed");
    showKeyStatus();
  });

  /* ---------------- backup ---------------- */

  $(".export-backup").addEventListener("click", () => {
    const date = new Date().toISOString().slice(0, 10);
    download(`movie-nights-backup-${date}.json`, Store.exportBackup(), "application/json");
  });

  $(".import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      Store.importBackup(await file.text());
      toast("Backup restored");
      renderProfile();
    } catch (err) {
      toast(`Could not restore: ${err.message}`);
    }
    e.target.value = "";
  });

  $(".reset-all").addEventListener("click", () => {
    if (!confirm("Delete every title, rating, favorite, watchlist entry and tier in your library? Download a backup first if you might want it back.")) return;
    Store.resetAll();
    renderProfile();
    toast("Your library is empty now");
  });

  /* ---------------- members (owner only) ---------------- */

  function ago(ms) {
    if (!ms) return "never";
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 2) return "just now";
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return d < 30 ? `${d} days ago` : new Date(ms).toLocaleDateString();
  }

  // names, photos and counts only: nobody's ratings, not even for the owner
  let membersLoaded = false;
  async function renderMembers() {
    if (membersLoaded || !(window.Cloud && Cloud.isOwner())) return;
    membersLoaded = true;
    const box = $(".member-list");
    try {
      const list = (await Cloud.members()).sort((a, b) => b.me - a.me || (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
      box.innerHTML = list.length
        ? list
            .map(
              (m) => `<div class="member">
                <img src="${esc(m.photo || "images/placeholders/user.svg")}" alt="" referrerpolicy="no-referrer" />
                <div class="member-info">
                  <strong>${esc(m.name || "Someone")}${m.me ? ' <span class="member-you">you</span>' : ""}</strong>
                  <small>Last sync: ${ago(Number(m.updatedAt))}</small>
                </div>
                <div class="member-counts">
                  <span title="Titles"><i class="fa-solid fa-film"></i> ${m.titles}</span>
                  <span title="Rated"><i class="fa-solid fa-star"></i> ${m.rated}</span>
                  <span title="On the watchlist"><i class="fa-solid fa-bookmark"></i> ${m.watchlist}</span>
                </div>
              </div>`
            )
            .join("")
        : '<p class="help">Nobody yet.</p>';
    } catch (e) {
      membersLoaded = false;
      box.innerHTML = `<p class="help">Couldn't load members: ${esc(e.message)}</p>`;
    }
  }
  if (window.Cloud) Cloud.onOwner((on) => on && renderMembers());
  renderMembers();

  Store.onChange(renderStats);
  renderProfile();
  renderStats();

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
