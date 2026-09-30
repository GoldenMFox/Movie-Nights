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
        <img src="${esc(Store.myPhoto() || "images/placeholders/user.svg")}" data-my-pic alt="" referrerpolicy="no-referrer" />
        <span class="sv-name"><strong>${esc(profile.name)}</strong><small>${guest ? "Not signed in" : acct ? "Signed in with Google" : "Your profile"}</small></span>
        <span class="btn sv-account-btn">Profile &amp; stats <i class="fa-solid fa-arrow-right"></i></span>
      </a>

      ${guest ? `<div class="p-guest">${UI.signInPrompt("Sign in for the rest of your settings")}</div>` : ""}

      <div class="sv-grid">
        <div class="sv-col">
          ${
            guest
              ? ""
              : card(
                  "avatar",
                  "fa-user-astronaut",
                  "Profile picture",
                  `<div class="av-now">
                    <img class="av-now-pic" data-my-pic src="${esc(Store.myPhoto() || "images/placeholders/user.svg")}" alt="" referrerpolicy="no-referrer" />
                    <span class="sv-name"><strong class="av-now-name"></strong><small class="av-now-sub"></small></span>
                  </div>
                  <div class="sv-buttons">
                    <button class="btn btn-primary av-choose" type="button"><i class="fa-solid fa-masks-theater"></i> Choose a character</button>
                    <button class="btn av-reset" type="button" hidden><i class="fa-brands fa-google"></i> Use my Google photo</button>
                  </div>`
                )
          }

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
            `${row(
              "fa-earth-europe",
              "Your country",
              "Where to watch, age ratings and cinema dates",
              `<span class="glass-select small sv-country-box"><select class="sv-country" aria-label="Your country"><option value="${esc(TMDB.COUNTRY)}">${esc(TMDB.countryName())}</option></select></span>`
            )}
            <div class="services">
              <div class="svc-mine"></div>
              <div class="svc-all" hidden></div>
            </div>
            <p class="sv-note sv-svc-note"></p>`,
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
            <p class="sv-note">Free at themoviedb.org → Settings → API. A key typed here is stored only in this browser and overrides the one in <code>js/config.js</code>.</p>
            ${row("fa-star", "IMDb ratings (OMDb)", '<span class="omdb-state"></span>')}
            <div class="omdb-status sv-meter"></div>`,
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
        <span class="sv-meter-label" title="Counted in this browser. If OMDb's own limit is reached from any device, lookups stop for the day by themselves.">lookups today on this device</span>
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
    } catch (e) {}
    TMDB.clearCache();
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
    e.target.value = "";
    if (!file) return;
    let text;
    let data;
    try {
      text = await file.text();
      data = JSON.parse(text);
      if (data.app !== "movie-nights") throw new Error("This is not a Movie Nights backup file.");
    } catch (err) {
      return toast(`Could not restore: ${err.message.startsWith("This") ? err.message : "the file can't be read"}`);
    }
    // it replaces everything: say what's in it and ask first
    const n = (data.custom || []).length;
    const when = data.exported ? new Date(data.exported).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" }) : "";
    const ok = await UI.confirm({
      icon: "fa-clock-rotate-left",
      title: "Restore this backup?",
      text: `${n} title${n === 1 ? "" : "s"}${when ? `, saved on ${esc(when)}` : ""}. It <strong>replaces</strong> your whole library as it is now (titles, scores, lists and tiers).`,
      ok: "Restore",
      danger: true,
    });
    if (!ok) return;
    try {
      Store.importBackup(text);
      toast("Backup restored");
    } catch (err) {
      toast(`Could not restore: ${err.message}`);
    }
  });

  $(".reset-all").addEventListener("click", async () => {
    const ok = await UI.confirm({
      icon: "fa-trash-can",
      title: "Delete your whole library?",
      text: "Every title, rating, favorite, watchlist entry, list and tier. There's no undo: download a backup first if you might want it back.",
      ok: "Delete everything",
      danger: true,
    });
    if (!ok) return;
    Store.resetAll();
    toast("Your library is empty now");
  });

  /* ---------------- streaming services ---------------- */

  const logo = (p) => (p.logo ? `https://image.tmdb.org/t/p/w92${p.logo}` : "");

  // your country: every country TMDB has streaming data for
  const countrySel = $(".sv-country");
  function paintCountryNote() {
    $(".sv-svc-note").textContent = `Used by "On my services" on the Watchlist, by "What should I watch?" and by "Where to watch" on title pages. Availability in ${TMDB.countryName()}, from JustWatch.`;
  }
  paintCountryNote();
  if (!guest && TMDB.enabled())
    TMDB.regions()
      .then((list) => {
        const now = TMDB.COUNTRY;
        if (!list.some((c) => c.code === now)) list.unshift({ code: now, name: TMDB.countryName(now) });
        countrySel.innerHTML = list.map((c) => `<option value="${esc(c.code)}"${c.code === now ? " selected" : ""}>${esc(c.name)}</option>`).join("");
      })
      .catch(() => {});
  countrySel.addEventListener("change", () => {
    Store.setProfile({ country: countrySel.value });
    catalog = null; // the services list is per country
    const all = $(".svc-all");
    if (!all.hidden) {
      all.hidden = true;
      openServices();
    }
    paintCountryNote();
    toast(`Country: ${TMDB.countryName()}`);
  });

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

  /* ---------------- profile picture: a character from a movie or show ---------------- */

  // Like picking a Netflix avatar: characters grouped by title (the actor's TMDB photo, named
  // after the character), or search any movie / show and pick from its cast. Saved with your
  // profile (so it follows your account): { path, character, title, actor }.
  const AVATAR_TITLES = [
    ["tv", 1396], ["movie", 155], ["tv", 66732], ["movie", 671], ["tv", 1399], ["movie", 299534],
    ["tv", 1668], ["movie", 603], ["tv", 2316], ["movie", 11], ["tv", 100088], ["movie", 22],
    ["tv", 60574], ["movie", 680], ["tv", 119051], ["movie", 238], ["tv", 76479], ["movie", 245891],
    ["tv", 93405], ["movie", 346698], ["tv", 19885], ["movie", 693134],
  ];
  // "Walter White / Heisenberg" -> "Walter White"; "Hermione Granger (voice)" -> "Hermione Granger"
  const charName = (c) => String(c.character || "").split(/\s+\/\s+/)[0].replace(/\s*\((voice|uncredited)\)/gi, "").trim() || c.name;

  function paintAvatarCard() {
    if (guest) return;
    const av = Store.getProfile().avatar;
    $(".av-now-name").textContent = av ? av.character : acct && acct.photo ? "Your Google photo" : "No picture yet";
    $(".av-now-sub").textContent = av ? `${av.title} · ${av.actor}` : "Pick a character from a movie or show";
    $(".av-reset").hidden = !av;
  }

  function setAvatar(av) {
    Store.setProfile({ avatar: av || undefined });
    UI.paintMyPic();
    paintAvatarCard();
    if (avOverlay) avOverlay.querySelectorAll(".av-pick").forEach((b) => b.classList.toggle("on", !!av && b.dataset.avPath === av.path));
  }

  // one title's characters (up to max)
  function avGroup(d, max) {
    const cur = (Store.getProfile().avatar || {}).path;
    const cast = (d.cast || []).filter((c) => c.photo).slice(0, max);
    if (!cast.length) return "";
    const title = Lang.title(d);
    return `<section class="av-group">
        <h4>${esc(title)}${d.year ? ` <small>${d.year}</small>` : ""}</h4>
        <div class="av-grid">${cast
          .map(
            (c) => `<button type="button" class="av-pick${c.photo === cur ? " on" : ""}" data-av-path="${esc(c.photo)}"
                data-av-character="${esc(charName(c))}" data-av-actor="${esc(c.name)}" data-av-title="${esc(title)}" title="${esc(charName(c))} · ${esc(c.name)}">
              <img src="${Store.img(c.photo, "w185")}" alt="" loading="lazy" />
              <span>${esc(charName(c))}</span>
            </button>`
          )
          .join("")}</div>
      </section>`;
  }

  let avOverlay = null;
  let avTyping;
  function openAvatars() {
    if (!avOverlay) {
      avOverlay = Cards.makeOverlay(
        "avatar-modal",
        `<div class="pk-icon"><i class="fa-solid fa-user-astronaut"></i></div>
         <h3>Choose your profile picture</h3>
         <p class="pk-sub">A character from a movie or show you love.</p>
         <form class="glass-search av-search" role="search">
           <i class="fa-solid fa-magnifying-glass gs-icon" aria-hidden="true"></i>
           <input type="search" name="q" placeholder="Search a movie or show for its cast…" aria-label="Search a movie or show" autocomplete="off" />
         </form>
         <div class="av-found" hidden></div>
         <div class="av-picked"></div>
         <div class="av-groups"></div>`
      );
      // the popular titles, each filled in as it arrives (TMDB answers are kept a week)
      const box = avOverlay.querySelector(".av-groups");
      box.innerHTML = AVATAR_TITLES.map((_, n) => `<div class="av-slot" data-n="${n}"><div class="av-skel"></div></div>`).join("");
      AVATAR_TITLES.forEach(([media, id], n) =>
        TMDB.detailsById(media, id)
          .then((d) => (box.querySelector(`[data-n="${n}"]`).outerHTML = avGroup(d, 6) || ""))
          .catch(() => box.querySelector(`[data-n="${n}"]`).remove())
      );

      // search: titles first, then that title's whole cast on top
      const input = avOverlay.querySelector('[name="q"]');
      const found = avOverlay.querySelector(".av-found");
      const search = async () => {
        const q = input.value.trim();
        if (!q) return (found.hidden = true);
        found.hidden = false;
        found.innerHTML = '<p class="sv-note"><i class="fa-solid fa-spinner fa-spin"></i> Searching…</p>';
        try {
          const { results } = await TMDB.searchSmart(q, "all", 1);
          if (input.value.trim() !== q) return;
          const hits = results.filter((h) => h.poster).slice(0, 8);
          found.innerHTML = hits.length
            ? hits
                .map(
                  (h) => `<button type="button" class="av-title" data-av-ref="${h.mediaType}-${h.tmdbId}">
                    <img src="${Store.poster(h.poster, "w92")}" alt="" loading="lazy" /><span>${esc(Lang.title(h))}${h.year ? ` <small>${h.year}</small>` : ""}</span></button>`
                )
                .join("")
            : '<p class="sv-note">Nothing found. Try another spelling.</p>';
        } catch (e) {
          found.innerHTML = `<p class="sv-note">Couldn't search: ${esc(e.message)}</p>`;
        }
      };
      avOverlay.querySelector(".av-search").addEventListener("submit", (e) => {
        e.preventDefault();
        clearTimeout(avTyping);
        search();
      });
      input.addEventListener("input", () => {
        clearTimeout(avTyping);
        avTyping = setTimeout(search, 350);
      });

      avOverlay.addEventListener("click", async (e) => {
        const t = e.target.closest("[data-av-ref]");
        if (t) {
          const [media, id] = t.dataset.avRef.split("-");
          const picked = avOverlay.querySelector(".av-picked");
          picked.innerHTML = '<div class="av-skel"></div>';
          try {
            const d = await TMDB.detailsById(media, Number(id));
            picked.innerHTML = avGroup(d, 12) || '<p class="sv-note">TMDB has no cast photos for this one.</p>';
          } catch (err) {
            picked.innerHTML = `<p class="sv-note">Couldn't load the cast: ${esc(err.message)}</p>`;
          }
          found.hidden = true;
          picked.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return;
        }
        const b = e.target.closest("[data-av-path]");
        if (!b) return;
        setAvatar({ path: b.dataset.avPath, character: b.dataset.avCharacter, title: b.dataset.avTitle, actor: b.dataset.avActor });
        toast(`You're ${b.dataset.avCharacter} now`);
        setTimeout(() => Cards.closeModal(avOverlay), 350);
      });
    }
    Cards.openModal(avOverlay);
  }

  if (!guest) {
    paintAvatarCard();
    $(".av-choose").addEventListener("click", () => (TMDB.enabled() ? openAvatars() : toast("Choosing a character needs TMDB")));
    $(".av-reset").addEventListener("click", () => {
      setAvatar(null);
      toast("Back to your Google photo");
    });
  }

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
