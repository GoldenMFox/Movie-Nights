/*
 * Settings page: theme, your streaming services, import from IMDb / Letterboxd, backup.
 * The owner also gets the TMDB / OMDb settings and the Members panel.
 * (Your name, stats and watch diary are on the Profile page: js/pages/profile.js)
 */
(function () {
  const { esc, toast, download } = UI;
  const root = document.getElementById("settings-app");
  const guest = Store.guest;

  root.innerHTML = `
    <div class="settings-page">
      <div class="panel" id="appearance">
        <h2><i class="fa-solid fa-palette"></i> Appearance</h2>
        <label class="field">Theme
          <select class="select" name="theme"><option value="dark">Dark</option><option value="light">Light</option></select>
        </label>
        <p class="help">Russian titles, Poster details and Match % are switches in the profile menu (your picture, top right).</p>
      </div>

      ${guest ? `<div class="p-guest">${UI.signInPrompt("Sign in for the rest of your settings")}</div>` : ""}

      <div class="panel services" id="services"${guest ? " hidden" : ""}>
        <h2><i class="fa-solid fa-tv"></i> My streaming services</h2>
        <div class="svc-mine"></div>
        <div class="svc-all" hidden></div>
        <p class="help">Used by "On my services" on the Watchlist and by "What should I watch?". Availability in ${esc(TMDB.COUNTRY)}, from JustWatch.</p>
      </div>

      <div class="panel import-panel" id="import"${guest ? " hidden" : ""}></div>

      <div class="panel" id="backup"${guest ? " hidden" : ""}>
        <h2><i class="fa-solid fa-floppy-disk"></i> Backup</h2>
        <div class="stack">
          <p class="help" style="margin:0">Your library is saved in your account and synced to every device you sign in on. A backup is an extra copy you keep yourself.</p>
          <div class="settings-row">
            <button class="btn export-backup" type="button"><i class="fa-solid fa-file-export"></i> Download backup</button>
            <label class="btn" style="cursor:pointer"><i class="fa-solid fa-file-import"></i> Restore backup
              <input type="file" accept=".json,application/json" class="import-file" hidden />
            </label>
          </div>
          <button class="btn btn-danger reset-all" type="button"><i class="fa-solid fa-trash-can"></i> Delete my library</button>
        </div>
      </div>

      <div class="panel members owner-only" id="members"${guest ? " hidden" : ""}>
        <h2><i class="fa-solid fa-users"></i> Members</h2>
        <p class="help">Everyone who has signed in. You see how big their library is, never their ratings.</p>
        <div class="member-list"><p class="help">Loading…</p></div>
        <p class="help">To let someone in, add their Google email to the rules in the Firebase console
          (Firestore → Rules), then ask them to sign in here.</p>
      </div>

      <div class="panel owner-only" id="keys">
        <h2><i class="fa-solid fa-key"></i> TMDB &amp; IMDb</h2>
        <div class="stack">
          <label class="field">TMDB API key (optional)
            <input class="input" name="tmdb" type="password" autocomplete="off" placeholder="Paste your key or read access token" />
          </label>
          <div class="settings-row">
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
    </div>`;

  const $ = (s) => root.querySelector(s);

  /* ---------------- appearance ---------------- */

  const themeSel = $('[name="theme"]');
  themeSel.value = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  themeSel.addEventListener("change", () => {
    if (themeSel.value === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("mn:theme", themeSel.value);
    } catch (e) {}
  });

  /* ---------------- TMDB / OMDb (owner) ---------------- */

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
    } catch (err) {
      toast(`Could not restore: ${err.message}`);
    }
    e.target.value = "";
  });

  $(".reset-all").addEventListener("click", () => {
    if (!confirm("Delete every title, rating, favorite, watchlist entry and tier in your library? Download a backup first if you might want it back.")) return;
    Store.resetAll();
    toast("Your library is empty now");
  });

  /* ---------------- streaming services ---------------- */

  const logo = (p) => (p.logo ? `https://image.tmdb.org/t/p/w92${p.logo}` : "");
  function renderServices() {
    const mine = Watch.mine();
    $(".svc-mine").innerHTML =
      mine
        .map((s) => `<span class="svc-chip"><img src="${esc(logo(s))}" alt="" />${esc(s.name)}</span>`)
        .join("") +
      `<button class="btn svc-edit" type="button"><i class="fa-solid fa-${mine.length ? "pen" : "plus"}"></i> ${mine.length ? "Change" : "Choose your services"}</button>`;
  }

  let catalog = null;
  async function openServices() {
    const all = $(".svc-all");
    all.hidden = !all.hidden;
    if (all.hidden) return;
    if (!catalog) {
      all.innerHTML = '<p class="help">Loading…</p>';
      try {
        catalog = (await TMDB.providerCatalog()).slice(0, 24);
      } catch (e) {
        all.innerHTML = `<p class="help">Couldn't load the list: ${esc(e.message)}</p>`;
        return;
      }
    }
    const ids = Watch.mine().map((s) => s.id);
    all.innerHTML = `<div class="svc-grid">${catalog
      .map(
        (p) => `<button type="button" class="svc-opt${ids.includes(p.id) ? " on" : ""}" data-svc="${p.id}" aria-pressed="${ids.includes(p.id)}" title="${esc(p.name)}">
          <img src="${esc(logo(p))}" alt="" loading="lazy" /><span>${esc(p.name)}</span></button>`
      )
      .join("")}</div>`;
  }

  if (!guest && window.Watch) {
    renderServices();
    $(".services").addEventListener("click", (e) => {
      if (e.target.closest(".svc-edit")) return openServices();
      const opt = e.target.closest("[data-svc]");
      if (!opt) return;
      const p = catalog.find((c) => c.id === Number(opt.dataset.svc));
      const mine = Watch.mine();
      const on = !mine.some((s) => s.id === p.id);
      Watch.setMine(on ? mine.concat({ id: p.id, name: p.name, logo: p.logo }) : mine.filter((s) => s.id !== p.id));
      opt.classList.toggle("on", on);
      opt.setAttribute("aria-pressed", on);
      renderServices();
    });
  }

  /* ---------------- import (js/components/import.js) ---------------- */

  if (!guest && window.Importer) Importer.mount($("#import"));

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

  // settings.html#import, #services…: straight to that part
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
