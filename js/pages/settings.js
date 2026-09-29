/*
 * Settings page, in the site's own style (glass cards with small red labels, like X-Ray;
 * red icon circles; pill buttons; the red pill switch): theme, your streaming services,
 * import from IMDb / Letterboxd, backup. The owner also gets Members and TMDB / OMDb.
 * (Your name, stats and watch diary are on the Profile page: js/pages/profile.js)
 */
(function () {
  const { esc, toast, download } = UI;
  const root = document.getElementById("settings-app");
  const guest = Store.guest;
  const acct = window.Cloud && Cloud.account();
  const profile = Store.getProfile();

  const label = (icon, text) => `<span class="xr-label"><i class="fa-solid ${icon}"></i> ${text}</span>`;
  const card = (id, icon, title, body, extra = "") =>
    `<section class="xr-card sv-card" id="${id}"${extra}>${
      extra.includes("data-owner")
        ? `<div class="sv-head">${label(icon, title)}<span class="sv-admin" title="Only you see this, as the owner"><i class="fa-solid fa-shield-halved"></i> Admin only</span></div>`
        : label(icon, title)
    }${body}</section>`;
  // a row: red icon circle, name (+ a line under it), what you can do on the right
  const row = (icon, name, sub, right = "") => `<div class="sv-row">
      <span class="sv-ic"><i class="fa-solid ${icon}"></i></span>
      <span class="sv-name"><strong>${name}</strong>${sub ? `<small>${sub}</small>` : ""}</span>
      ${right}
    </div>`;

  root.innerHTML = `
    <div class="sv">
      <a class="sv-account" href="profile.html">
        <img src="${esc((acct && acct.photo) || "images/placeholders/user.svg")}" alt="" referrerpolicy="no-referrer" />
        <span class="sv-name"><strong>${esc(profile.name)}</strong><small>${guest ? "Not signed in" : acct ? "Signed in with Google" : "Your profile"}</small></span>
        <span class="btn sv-account-btn">Profile &amp; stats <i class="fa-solid fa-arrow-right"></i></span>
      </a>

      ${guest ? `<div class="p-guest">${UI.signInPrompt("Sign in for the rest of your settings")}</div>` : ""}

      <div class="sv-grid">
        <div class="sv-col">
          ${card(
            "appearance",
            "fa-palette",
            "Appearance",
            `${row(
              "fa-circle-half-stroke",
              "Theme",
              "The whole site, dark or light",
              `<div class="top10-switch sv-theme" role="group" aria-label="Theme">
                <button type="button" class="top10-tab" data-theme-pick="dark"><i class="fa-solid fa-moon"></i> Dark</button>
                <button type="button" class="top10-tab" data-theme-pick="light"><i class="fa-solid fa-sun"></i> Light</button>
              </div>`
            )}
            <p class="sv-note"><i class="fa-solid fa-circle-info"></i> Russian titles, Poster details and Match % are switches in the profile menu (your picture, top right).</p>`
          )}

          ${card(
            "services",
            "fa-tv",
            "Streaming",
            `<div class="services">
              <div class="svc-mine"></div>
              <div class="svc-all" hidden></div>
            </div>
            <p class="sv-note">Used by "On my services" on the Watchlist and by "What should I watch?". Availability in ${esc(TMDB.COUNTRY)}, from JustWatch.</p>`,
            guest ? " hidden" : ""
          )}

          ${card(
            "keys",
            "fa-key",
            "TMDB & IMDb",
            `${row("fa-film", "TMDB API key", '<span class="tmdb-status"></span>')}
            <input class="input" name="tmdb" type="password" autocomplete="off" placeholder="Paste your key or read access token (optional)" />
            <div class="sv-buttons">
              <button class="btn btn-primary save-key" type="button">Save key</button>
              <button class="btn test-key" type="button">Test</button>
              <button class="btn clear-key" type="button">Remove</button>
            </div>
            ${row("fa-star", "IMDb ratings (OMDb)", '<span class="omdb-state"></span>')}
            <div class="omdb-status sv-meter"></div>
            <p class="sv-note">Free at themoviedb.org → Settings → API. A key typed here is stored only in this browser and overrides the one in <code>js/config.js</code>.</p>`,
            " data-owner"
          )}
        </div>

        <div class="sv-col">
          ${card(
            "members",
            "fa-users",
            "Members",
            `<div class="member-list"><p class="sv-note">Loading…</p></div>
            <p class="sv-note">Everyone who has signed in: you see how big their library is, never their ratings. To let someone in, add their Google email to the rules in the Firebase console (Firestore → Rules).</p>`,
            ` data-owner${guest ? " hidden" : ""}`
          )}

          ${card("import", "fa-file-import", "Import", '<div class="import-panel"></div>', guest ? " hidden" : "")}

          ${card(
            "backup",
            "fa-floppy-disk",
            "Backup",
            `<p class="sv-note sv-lead">Your library is saved in your account and synced to every device you sign in on. A backup is an extra copy you keep yourself.</p>
            <div class="sv-buttons">
              <button class="btn export-backup" type="button"><i class="fa-solid fa-file-export"></i> Download backup</button>
              <label class="btn"><i class="fa-solid fa-file-import"></i> Restore backup
                <input type="file" accept=".json,application/json" class="import-file" hidden />
              </label>
            </div>
            <div class="sv-danger">
              ${row("fa-trash-can", "Delete my library", "Every title, score, list and tier. There's no undo.", '<button class="btn btn-danger reset-all" type="button">Delete</button>')}
            </div>`,
            guest ? " hidden" : ""
          )}
        </div>
      </div>
    </div>`;

  // owner-only cards
  root.querySelectorAll("[data-owner]").forEach((el) => el.classList.add("owner-only"));

  const $ = (s) => root.querySelector(s);

  /* ---------------- appearance ---------------- */

  function paintTheme() {
    const light = document.documentElement.dataset.theme === "light";
    root.querySelectorAll("[data-theme-pick]").forEach((b) => {
      const on = (b.dataset.themePick === "light") === light;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  }
  paintTheme();
  $(".sv-theme").addEventListener("click", (e) => {
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

  // today's OMDb lookups as a meter you can read at a glance: 211 / 900, a bar, what's left
  function showOmdbStatus() {
    const s = Ratings.status();
    const box = $(".omdb-status");
    if (!s.enabled) {
      $(".omdb-state").textContent = s.keyRejected ? "Off · the key was rejected" : "Off · no key";
      box.innerHTML = `<p class="sv-note">${s.keyRejected ? "OMDb rejected the key in js/config.js." : "No OMDb key: cards show the TMDB score instead of IMDb."}</p>`;
      return;
    }
    const pct = Math.min(100, Math.round((s.used / s.limit) * 100));
    const full = s.blocked || s.used >= s.limit;
    const level = full ? "full" : pct >= 75 ? "high" : "";
    // OMDb's day ends at midnight UTC: when that is here
    const now = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    $(".omdb-state").textContent = full ? "Daily limit reached" : "On";
    box.innerHTML = `
      <div class="sv-meter-top">
        <span class="sv-meter-num"><b>${s.used}</b> / ${s.limit}</span>
        <span class="sv-meter-label">lookups today</span>
        <span class="sv-meter-pct ${level}">${full ? "Limit reached" : `${pct}%`}</span>
      </div>
      <div class="sv-meter-bar ${level}"><i style="width:${pct}%"></i></div>
      <div class="sv-meter-facts">
        <span><i class="fa-solid fa-gauge-high"></i> <b>${Math.max(0, s.limit - s.used)}</b> left today</span>
        <span><i class="fa-solid fa-clock-rotate-left"></i> resets at <b>${reset}</b></span>
        <span><i class="fa-solid fa-database"></i> <b>${s.cached}</b> ratings saved</span>
      </div>`;
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
        : '<p class="sv-note">Nobody yet.</p>';
    } catch (e) {
      membersLoaded = false;
      box.innerHTML = `<p class="sv-note">Couldn't load members: ${esc(e.message)}</p>`;
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
