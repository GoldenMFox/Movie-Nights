/*
 * Settings page: theme, your streaming services, import from IMDb / Letterboxd, backup.
 * The owner also gets the TMDB / OMDb settings and the Members panel.
 * (Your name, stats and watch diary are on the Profile page: js/pages/profile.js)
 */
(function () {
  const { esc, toast, download } = UI;
  const root = document.getElementById("settings-app");
  const guest = Store.guest;

  // iOS Settings style: sections with a small heading, rows in rounded glass groups, a small
  // coloured icon square on each row
  const acct = window.Cloud && Cloud.account();
  const profile = Store.getProfile();
  const icon = (fa, color) => `<span class="st-ic" style="--ic:${color}"><i class="fa-solid ${fa}"></i></span>`;
  const section = (id, title, body, extra = "", cls = "") =>
    `<section class="st-sec${cls ? ` ${cls}` : ""}" id="${id}"${extra}><h3 class="st-head">${title}</h3>${body}</section>`;

  root.innerHTML = `
    <div class="st">
      <a class="st-account" href="profile.html">
        <img src="${esc((acct && acct.photo) || "images/placeholders/user.svg")}" alt="" referrerpolicy="no-referrer" />
        <span><strong>${esc(profile.name)}</strong><small>${guest ? "Not signed in" : acct ? "Signed in with Google · Profile & stats" : "Profile & stats"}</small></span>
        <i class="fa-solid fa-chevron-right st-chev"></i>
      </a>

      ${section(
        "appearance",
        "Appearance",
        `<div class="st-group">
          <div class="st-row">${icon("fa-circle-half-stroke", "#5e5ce6")}<span class="st-label">Theme</span>
            <div class="st-seg" role="group" aria-label="Theme">
              <button type="button" data-theme-pick="dark"><i class="fa-solid fa-moon"></i> Dark</button>
              <button type="button" data-theme-pick="light"><i class="fa-solid fa-sun"></i> Light</button>
            </div>
          </div>
        </div>
        <p class="st-foot">Russian titles, Poster details and Match % are switches in the profile menu (your picture, top right).</p>`
      )}

      ${guest ? `<div class="p-guest">${UI.signInPrompt("Sign in for the rest of your settings")}</div>` : ""}

      ${section(
        "services",
        "Streaming",
        `<div class="st-group services">
          <div class="st-row st-stack">
            <div class="st-row-line">${icon("fa-tv", "#ff453a")}<span class="st-label">My streaming services</span></div>
            <div class="svc-mine"></div>
            <div class="svc-all" hidden></div>
          </div>
        </div>
        <p class="st-foot">Used by "On my services" on the Watchlist and by "What should I watch?". Availability in ${esc(TMDB.COUNTRY)}, from JustWatch.</p>`,
        guest ? " hidden" : ""
      )}

      ${section("import", "Import", `<div class="st-group"><div class="st-pad import-panel"></div></div>`, guest ? " hidden" : "")}

      ${section(
        "backup",
        "Backup",
        `<div class="st-group">
          <button class="st-row st-btn export-backup" type="button">${icon("fa-cloud-arrow-down", "#0a84ff")}<span class="st-label">Download backup</span><i class="fa-solid fa-chevron-right st-chev"></i></button>
          <label class="st-row st-btn">${icon("fa-clock-rotate-left", "#30d158")}<span class="st-label">Restore backup</span><i class="fa-solid fa-chevron-right st-chev"></i>
            <input type="file" accept=".json,application/json" class="import-file" hidden />
          </label>
          <button class="st-row st-btn st-danger reset-all" type="button">${icon("fa-trash-can", "#ff453a")}<span class="st-label">Delete my library</span></button>
        </div>
        <p class="st-foot">Your library is saved in your account and synced to every device you sign in on. A backup is an extra copy you keep yourself.</p>`,
        guest ? " hidden" : ""
      )}

      ${section(
        "members",
        "Members",
        `<div class="st-group members"><div class="member-list"><p class="st-pad st-muted">Loading…</p></div></div>
        <p class="st-foot">Everyone who has signed in: you see how big their library is, never their ratings. To let someone in, add their Google email to the rules in the Firebase console (Firestore → Rules).</p>`,
        guest ? " hidden" : "",
        "owner-only"
      )}

      ${section(
        "keys",
        "TMDB & IMDb",
        `<div class="st-group">
          <div class="st-row st-stack">
            <div class="st-row-line">${icon("fa-key", "#ff9f0a")}<span class="st-label">TMDB API key</span><span class="st-value tmdb-status"></span></div>
            <input class="input st-input" name="tmdb" type="password" autocomplete="off" placeholder="Paste your key or read access token (optional)" />
            <div class="st-buttons">
              <button class="btn btn-primary save-key" type="button">Save</button>
              <button class="btn test-key" type="button">Test</button>
              <button class="btn clear-key" type="button">Remove</button>
            </div>
          </div>
          <div class="st-row">${icon("fa-star", "#ffd60a")}<span class="st-label">IMDb ratings (OMDb)</span></div>
          <p class="st-pad st-muted omdb-status"></p>
        </div>
        <p class="st-foot">Free at themoviedb.org → Settings → API. A key typed here is stored only in this browser and overrides the one in <code>js/config.js</code>.</p>`,
        "",
        "owner-only"
      )}
    </div>`;

  const $ = (s) => root.querySelector(s);

  /* ---------------- appearance ---------------- */

  function paintTheme() {
    const light = document.documentElement.dataset.theme === "light";
    root.querySelectorAll("[data-theme-pick]").forEach((b) => {
      const on = (b.dataset.themePick === "light") === light;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on);
    });
  }
  paintTheme();
  root.querySelector(".st-seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-pick]");
    if (!b) return;
    if (b.dataset.themePick === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("mn:theme", b.dataset.themePick);
    } catch (err) {}
    paintTheme();
  });

  /* ---------------- TMDB / OMDb (owner) ---------------- */

  const keyInput = $('[name="tmdb"]');
  function showKeyStatus() {
    const src = TMDB.keySource();
    // short, on the right of the row (like a value in iOS Settings)
    $(".tmdb-status").textContent = src === "config" ? "On · js/config.js" : src === "browser" ? "On · this browser" : "Off";
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

  if (!guest && window.Importer) Importer.mount($("#import .import-panel"));

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
        : '<p class="st-pad st-muted">Nobody yet.</p>';
    } catch (e) {
      membersLoaded = false;
      box.innerHTML = `<p class="st-pad st-muted">Couldn't load members: ${esc(e.message)}</p>`;
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
