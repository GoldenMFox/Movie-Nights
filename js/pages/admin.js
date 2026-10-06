/*
 * Admin Control Center (admin.html): everything the owner can set for the whole site, without
 * touching the code. Only the owner gets in (the account's rules decide who that is: Cloud.isOwner).
 *
 * The settings live in js/core/site.js (Site): one document for everyone, read by every page.
 * Here a working copy is changed; "Save changes" sends it (or "Discard" drops it). If the account
 * doesn't take site settings yet (its rules need the site/config part, shown under Users), the
 * copy is kept on this device and used here until the rules are published.
 *
 * Sections: Overview · Look & feel (Website, Atmosphere & themes) · Pages (Pages & features, the order of the
 * rows on Home, title pages and person pages) · Content (Content, News, Notifications) · System (API
 * integrations, Users, Tools: service checks, this device's storage, change history · Backup)
 *
 * The look: a sidebar of the sections in groups (with badges: services down, maintenance on), a top
 * bar (where you are, a search through every setting, saved or not) and, on Overview, a dashboard:
 * a welcome card with the quick switches and the site's atmosphere (by the date, off, or locked to
 * one season), stat tiles, what needs attention, the atmosphere through the year, the latest saves,
 * and charts drawn here as SVG (what everyone watched month by month, the services' health,
 * movies / TV / anime, the scores, the members).
 *
 * Customize (top bar, every section): drag the boxes where you want them (mouse or finger), give
 * each one a size (one column, two, the whole row) or hide it; each section keeps its own layout,
 * saved with your profile (adminLayout), so it follows you to your other devices.
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("admin");
  const SECTIONS = [
    ["overview", "fa-gauge", "Overview"],
    ["website", "fa-globe", "Website"],
    ["pages", "fa-toggle-on", "Pages & features"],
    ["homepage", "fa-house", "Home page"],
    ["titlepage", "fa-table-list", "Title page"],
    ["personpage", "fa-id-card", "Person page"],
    ["content", "fa-star", "Content"],
    ["news", "fa-newspaper", "News"],
    ["apis", "fa-plug", "API integrations"],
    ["themes", "fa-palette", "Atmosphere & themes"],
    ["notifications", "fa-bell", "Notifications"],
    ["users", "fa-users", "Users"],
    ["backup", "fa-floppy-disk", "Backup"],
    ["tools", "fa-toolbox", "Tools"],
  ];
  const GROUPS = [
    ["Dashboard", ["overview"]],
    ["Look & feel", ["website", "themes"]],
    ["Pages", ["pages", "homepage", "titlepage", "personpage"]],
    ["Content", ["content", "news", "notifications"]],
    ["System", ["apis", "users", "tools", "backup"]],
  ];
  const PAGE_NAMES = [
    ["home", "Home"], ["movie", "Movies"], ["tv", "TV Shows"], ["anime", "Anime"], ["watchlist", "Watchlist"],
    ["tiers", "Tier List"], ["boxoffice", "Box Office"], ["news", "News"], ["animeExplore", "Explore anime (phones' Library tab, footer)"],
  ];
  const FEATURES = [
    ["picker", "What should I watch?", "The shuffle button in the navbar"],
    ["trivia", "Movie trivia", "10 questions on title pages"],
    ["soundtrack", "Soundtracks", "Apple Music previews on title pages"],
    ["xray", "X-Ray", "Behind-the-scenes facts on title pages"],
    ["tvmaze", "Episodes & air times", "TVmaze's episode guide on show pages"],
    ["animeDetails", "Anime details", "The AniList card on anime title pages"],
    ["animeExplore", "Anime explorer", "anime-explore.html"],
    ["books", "Books", "The book a title is based on, a person's books (Open Library)"],
    ["news", "Movie News", "news.html"],
    ["boxOffice", "Box Office", "box-office.html"],
    ["listThemes", "List themes", "Halloween, Christmas… on your own lists"],
    ["notifications", "Notifications", "Release alerts and the red number"],
    ["share", "Sharing", "The share sheet on title pages"],
  ];
  const API_NAMES = {
    tvmaze: ["TVmaze", "Show schedules, episodes, networks", "hours"],
    anilist: ["AniList", "Everything anime: the explorer and the anime card on title pages", "hours"],
    openlibrary: ["Open Library", "Books on title and person pages, featured books", "days"],
    news: ["News feeds (rss2json)", "Movie News", "minutes"],
    itunes: ["Apple Music (iTunes)", "Soundtracks and their previews on title pages", "days"],
  };

  // the site's seasonal looks (js/components/season.js): icon, colour, when
  const SEASON_LOOK = {
    halloween: ["fa-ghost", "#ff7a1a", "1 Oct – 1 Nov"],
    christmas: ["fa-tree", "#e8424a", "1–26 Dec"],
    easter: ["fa-egg", "#f39ad0", "The week before Easter Sunday – Easter Monday"],
    winter: ["fa-snowflake", "#8fd3ff", "27 Dec – end of Feb"],
    autumn: ["fa-leaf", "#c9a227", "22 Sep – 30 Nov (Halloween first)"],
  };
  const SEASON_IDS = Object.keys(SEASON_LOOK);

  // not the owner: nothing to see here
  const isOwner = () => window.Cloud && Cloud.isOwner && Cloud.isOwner();
  function gate() {
    if (isOwner()) return true;
    root.innerHTML = `<div class="empty-state"><i class="fa-solid fa-lock"></i><p>The Admin Control Center is for the site's owner.</p>${
      Store.guest ? UI.signInPrompt("Sign in as the owner") : '<a class="btn" href="index.html">Back home</a>'
    }</div>`;
    return false;
  }
  if (!gate()) {
    if (window.Cloud && Cloud.onOwner) Cloud.onOwner((yes) => yes && location.reload());
    return;
  }

  /* ---------------- the working copy ---------------- */

  const clone = (o) => JSON.parse(JSON.stringify(o));
  let draft = clone(Site.get());
  let blocked = Site.blocked().slice();
  let saved = JSON.stringify([draft, blocked]);
  const dirty = () => JSON.stringify([draft, blocked]) !== saved;
  const getPath = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), draft);
  function setPath(path, value) {
    const keys = path.split(".");
    let o = draft;
    keys.slice(0, -1).forEach((k) => (o = o[k] = o[k] && typeof o[k] === "object" ? o[k] : {}));
    o[keys[keys.length - 1]] = value;
    paintBar();
    if (typeof paintBadges === "function") paintBadges();
    if (typeof paintOverview === "function") paintOverview();
  }

  let section = (location.hash || "").slice(1);
  if (!SECTIONS.some((s) => s[0] === section)) section = "overview";

  const sec = (k) => SECTIONS.find((s) => s[0] === k);
  root.innerHTML = `
    <div class="ad-layout">
      <aside class="ad-side">
        <div class="ad-brand"><span class="ad-brand-icon"><i class="fa-solid fa-sliders"></i></span><span><strong>Control Center</strong><small>${esc((Site.get().branding && Site.get().branding.name) || "Movie Nights")}</small></span></div>
        <nav class="ad-nav" aria-label="Sections">${GROUPS.map(
          ([g, keys]) => `<span class="ad-nav-group">${g}</span>${keys
            .map((k) => {
              const [, icon, l] = sec(k);
              return `<a href="#${k}" data-sec="${k}"><i class="fa-solid ${icon}"></i><span>${l}</span><b class="ad-badge" data-badge="${k}" hidden></b></a>`;
            })
            .join("")}`
        ).join("")}</nav>
      </aside>
      <div class="ad-main">
        <header class="ad-top">
          <div class="ad-crumbs"><span>Admin</span><i class="fa-solid fa-chevron-right"></i><strong class="ad-crumb"></strong></div>
          <div class="ad-find"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Find a setting…" aria-label="Find a setting" autocomplete="off" /><div class="ad-find-list" hidden></div></div>
          <span class="ad-state"></span>
          <button type="button" class="btn ad-customize" aria-pressed="false"><i class="fa-solid fa-table-cells-large"></i><span> Customize</span></button>
        </header>
        <div class="ad-edit-bar" hidden><i class="fa-solid fa-hand-pointer"></i><span>Drag the boxes to move them (on a phone: hold one, then drag). Each one has its size (one column, two, the whole row) and an eye to hide it.</span><button type="button" class="btn ad-layout-reset"><i class="fa-solid fa-rotate-left"></i> Reset this page</button><button type="button" class="btn btn-primary ad-customize-done"><i class="fa-solid fa-check"></i> Done</button></div>
        <div class="ad-body"></div>
      </div>
    </div>
    <div class="ad-bar" hidden><span><i class="fa-solid fa-pen"></i> Unsaved changes</span><button class="btn ad-discard" type="button">Discard</button><button class="btn btn-primary ad-save" type="button"><i class="fa-solid fa-check"></i> Save changes</button></div>`;
  const body = root.querySelector(".ad-body");

  function paintBar() {
    root.querySelector(".ad-bar").hidden = !dirty();
  }
  function paintState() {
    const st = Site.state();
    const el = root.querySelector(".ad-state");
    const text = {
      live: ['<i class="fa-solid fa-circle-check"></i> Saved for everyone', "ok"],
      default: ['<i class="fa-solid fa-circle-info"></i> Defaults (nothing saved yet)', ""],
      unpublished: ['<i class="fa-solid fa-triangle-exclamation"></i> Only on this device: publish the rules (Users)', "warn"],
    }[st] || ["", ""];
    el.innerHTML = text[0];
    el.className = `ad-state ${text[1]}`;
  }

  /* ---------------- building blocks ---------------- */

  const card = (icon, title, inner, note) => `<section class="xr-card sv-card ad-card"><span class="xr-label"><i class="fa-solid ${icon}"></i> ${title}</span>${inner}${note ? `<p class="sv-note">${note}</p>` : ""}</section>`;
  const sw = (path, name, sub, on) => `<div class="sv-row"><span class="sv-name"><strong>${name}</strong>${sub ? `<small>${sub}</small>` : ""}</span>
      <label class="sv-switch"><input type="checkbox" data-k="${path}"${on ? " checked" : ""} aria-label="${esc(name)}" /><span class="switch-track"><span class="switch-thumb"></span></span></label></div>`;
  const text = (path, name, value, attrs = "") => `<label class="ad-field"><span>${name}</span><input class="input" data-k="${path}" value="${esc(value == null ? "" : value)}" ${attrs} /></label>`;
  const area = (path, name, value) => `<label class="ad-field"><span>${name}</span><textarea class="input" rows="3" data-k="${path}">${esc(value || "")}</textarea></label>`;
  const num = (path, name, value, min, max) => `<label class="ad-field ad-num"><span>${name}</span><input class="input" type="number" min="${min}" max="${max}" data-k="${path}" data-num value="${esc(value)}" /></label>`;
  const select = (path, name, value, options) => `<label class="ad-field"><span>${name}</span><span class="glass-select"><select data-k="${path}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></span></label>`;
  const ago = (t) => {
    if (!t) return "never";
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  };

  /* ---------------- the rows editor (Title page, Person page) ---------------- */

  function rowsEditor(defs, path, title, hero, note) {
    const known = defs.map((r) => r[0]);
    const saved = draft[path] || {};
    const order = (saved.order || []).filter((k) => known.includes(k));
    known.forEach((k, i) => {
      if (order.includes(k)) return;
      const after = known.slice(0, i).reverse().find((x) => order.includes(x));
      order.splice(after ? order.indexOf(after) + 1 : 0, 0, k);
    });
    const hidden = saved.hidden || [];
    const LOOK = { cast: 6, xray: 3, yours: 3, books: 1, soundtrack: 1, known: 5, filmography: 4, top10: 4, featured: 6, "featured-books": 6, because: 6, "because-anime": 6 };
    const row = (k) => {
      const [, name, what, icon] = defs.find((r) => r[0] === k);
      return `<li class="tp-row${hidden.includes(k) ? " off" : ""}" data-row="${k}">
          <span class="tp-grip" title="Drag to move"><i class="fa-solid fa-grip-vertical"></i></span>
          <span class="tp-icon"><i class="fa-solid ${icon}"></i></span>
          <span class="tp-text"><strong>${esc(name)}</strong><small>${esc(what)}</small></span>
          <span class="tp-look tp-look-${k}" aria-hidden="true">${"<i></i>".repeat(LOOK[k] || 5)}</span>
          <span class="tp-btns">
            <button type="button" class="tp-move" data-move="-1" title="Up" aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>
            <button type="button" class="tp-move" data-move="1" title="Down" aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>
            <button type="button" class="tp-eye" title="${hidden.includes(k) ? "Show it" : "Hide it"}" aria-label="Hide or show"><i class="fa-solid ${hidden.includes(k) ? "fa-eye-slash" : "fa-eye"}"></i></button>
          </span>
        </li>`;
    };
    return `<div class="ad-grid ad-grid-one">${card(
      { personPage: "fa-id-card", homePage: "fa-house" }[path] || "fa-table-list",
      title,
      `<div class="tp-page">
        <div class="tp-hero" aria-hidden="true">${hero}</div>
        <ol class="tp-rows" data-path="${path}">${order.map(row).join("")}</ol>
      </div>
      <div class="sv-buttons"><button type="button" class="btn tp-reset" data-path="${path}"><i class="fa-solid fa-rotate-left"></i> The site's own order</button></div>`,
      `Drag a row by its handle (or use the arrows) to move it; the eye leaves it out. ${note} Save changes to send it to everyone.`
    )}</div>`;
  }

  /* ---------------- Overview: the site's atmosphere, what needs attention, the latest saves ---------------- */

  const seasonName = (id) => (window.Season && Season.SEASONS[id] ? Season.SEASONS[id].label : id);
  const skipOf = () => (draft.themes && draft.themes.seasonsOff) || [];
  const dateOf = (id, now = new Date()) => (window.Season ? Season.byDate(now, skipOf()) : "") === id;
  // what everyone sees today with the settings being edited: { id, how: "date" | "locked" | "off" }
  function seasonNow() {
    const set = (draft.themes && draft.themes.season) || "auto";
    if (set === "off") return { id: "", how: "off" };
    if (SEASON_LOOK[set]) return { id: set, how: "locked" };
    return { id: window.Season ? Season.byDate(new Date(), skipOf()) : "", how: "date" };
  }
  // the next day a season starts by the date (skipping the ones switched off)
  function seasonNext() {
    if (!window.Season) return null;
    const now = new Date();
    let prev = Season.byDate(now, skipOf());
    for (let i = 1; i <= 366; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const id = Season.byDate(d, skipOf());
      if (id && id !== prev) return { id, at: d, days: i };
      prev = id;
    }
    return null;
  }
  // until when today's season lasts (by the date)
  function seasonEnd(id) {
    const now = new Date();
    for (let i = 1; i <= 120; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (!dateOf(id, d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    }
    return null;
  }
  const day = (d) => d.toLocaleDateString([], { day: "numeric", month: "short" });

  // the lock on the welcome card: by the date, off, or one season all the time
  function seasonPick() {
    const now = seasonNow();
    const set = (draft.themes && draft.themes.season) || "auto";
    const status =
      now.how === "off"
        ? "Off for everyone"
        : now.how === "locked"
          ? `Locked to ${esc(seasonName(now.id))}`
          : now.id
            ? `By the date · ${esc(seasonName(now.id))} now`
            : "By the date · the site's own look now";
    const chip = (v, icon, label, color) =>
      `<button type="button" data-season-set="${v}" class="${set === v ? "on" : ""}"${color ? ` style="--c:${color}"` : ""} aria-pressed="${set === v}" title="${esc(label)}"><i class="fa-solid ${icon}"></i><span>${esc(label)}</span></button>`;
    return `<div class="ad-season-head"><strong><i class="fa-solid ${now.how === "locked" ? "fa-lock" : now.how === "off" ? "fa-ban" : "fa-lock-open"}"></i> Site atmosphere</strong><small>${status}</small></div>
      <div class="ad-season-chips" role="group" aria-label="Site atmosphere">${chip("auto", "fa-calendar-days", "By date")}${chip("off", "fa-ban", "Off")}${SEASON_IDS.map((id) => chip(id, SEASON_LOOK[id][0], seasonName(id), SEASON_LOOK[id][1])).join("")}</div>`;
  }

  // the atmosphere panel: now, the year at a glance (by the date), what comes next
  function seasonPanel() {
    if (!window.Season) return '<p class="sv-note">The seasonal look isn\'t loaded on this page.</p>';
    const now = seasonNow();
    const y = new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const days = Math.round((new Date(y + 1, 0, 1) - start) / 86400000);
    // the year by the date, in stretches of one season
    const parts = [];
    for (let i = 0; i < days; i++) {
      const id = Season.byDate(new Date(y, 0, 1 + i), skipOf());
      const last = parts[parts.length - 1];
      if (last && last.id === id) last.to = i;
      else parts.push({ id, from: i, to: i });
    }
    const today = Math.floor((new Date() - start) / 86400000);
    const pct = (n) => ((n / days) * 100).toFixed(2);
    const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    const look = now.id ? SEASON_LOOK[now.id] : ["fa-film", "var(--accent)"];
    const end = now.how === "date" && now.id ? seasonEnd(now.id) : null;
    const nx = seasonNext();
    return `<div class="ad-season-now" style="--c:${look[1]}">
        <span class="ad-season-icon"><i class="fa-solid ${now.how === "off" ? "fa-ban" : look[0]}"></i></span>
        <span><small>Everyone sees now</small><strong>${now.how === "off" ? "No seasonal look" : now.id ? esc(seasonName(now.id)) : "The site's own look"}</strong>
        <em>${now.how === "locked" ? `<i class="fa-solid fa-lock"></i> Locked by you${dateOf(now.id) ? "" : ", outside its dates"}` : now.how === "off" ? "Switched off" : end ? `By the date, until ${day(end)}` : "By the date: nothing today"}</em></span>
      </div>
      <div class="ad-year" aria-label="The seasonal look through ${y}">
        <div class="ad-year-bar">${parts
          .filter((p) => p.id)
          .map((p) => `<i style="left:${pct(p.from)}%;width:${pct(p.to - p.from + 1)}%;--c:${SEASON_LOOK[p.id][1]}" title="${esc(seasonName(p.id))}: ${day(new Date(y, 0, 1 + p.from))} – ${day(new Date(y, 0, 1 + p.to))}"></i>`)
          .join("")}<b style="left:${pct(today + 0.5)}%" title="Today"></b></div>
        <div class="ad-year-months">${months.map((m) => `<span>${m}</span>`).join("")}</div>
      </div>
      ${nx ? `<p class="ad-season-next"><i class="fa-solid fa-forward"></i> Next by the date: <b style="color:${SEASON_LOOK[nx.id][1]}">${esc(seasonName(nx.id))}</b> from ${day(nx.at)} · in ${nx.days} day${nx.days === 1 ? "" : "s"}${now.how === "date" ? "" : " (when it's on By date)"}</p>` : ""}`;
  }

  // the things that may need you, each with where to fix it
  function attention() {
    const out = [];
    const add = (tone, icon, title, sub, go) => out.push({ tone, icon, title, sub, go });
    if (dirty()) add("gold", "fa-pen", "Unsaved changes", "Save them to send them to everyone", "");
    if (draft.maintenance.on) add("gold", "fa-screwdriver-wrench", "Maintenance mode is on", "Visitors see the “back soon” screen", "website");
    if (Site.state() === "unpublished") add("red", "fa-triangle-exclamation", "Settings only on this device", "Publish the rules so they reach everyone", "users");
    if (window.TMDB && !TMDB.keySource()) add("red", "fa-key", "No TMDB key", "Titles, posters and Explore need one", "apis");
    const down = Object.values(Api.status()).filter((x) => x.health === "down");
    if (down.length) add("red", "fa-plug-circle-xmark", `${down.length} service${down.length > 1 ? "s" : ""} not answering`, down.map((x) => x.label.replace(/ \(.*\)$/, "")).join(", "), "apis");
    const n = draft.notice;
    const todayStr = Store.today ? Store.today() : new Date().toISOString().slice(0, 10);
    if (n.on && !String(n.text || "").trim()) add("gold", "fa-bullhorn", "The notice is on but empty", "Write its text, or switch it off", "website");
    else if (n.on && n.until && n.until < todayStr) add("", "fa-bullhorn", "The notice has ended", `Its last day was ${n.until}: switch it off or give it new days`, "website");
    const sn = seasonNow();
    if (sn.how === "locked" && !dateOf(sn.id)) add("", "fa-lock", `${esc(seasonName(sn.id))} is locked on`, "Outside its dates: set the atmosphere back to By date when you're done", "themes");
    if (draft.announce && draft.announce.at && Date.now() - draft.announce.at > 30 * 86400000)
      add("", "fa-paper-plane", "An old announcement is still up", `Sent ${ago(draft.announce.at)}: withdraw it or send a new one`, "notifications");
    const off = FEATURES.filter(([k]) => draft.features[k] === false);
    if (off.length) add("", "fa-toggle-off", `${off.length} feature${off.length > 1 ? "s" : ""} switched off`, off.map((f) => f[1]).join(", "), "pages");
    const hiddenPages = (draft.nav.hidden || []).length;
    if (hiddenPages) add("", "fa-eye-slash", `${hiddenPages} page${hiddenPages > 1 ? "s" : ""} left out of the navigation`, "They still open from a link", "pages");
    if (window.Ratings) {
      const r = Ratings.status();
      if (r.enabled && (r.blocked || r.used >= r.limit)) add("", "fa-star-half-stroke", "IMDb lookups used up for today", "Cards show TMDB's score until tomorrow", "apis");
    }
    if (!out.length) return '<div class="ad-allgood"><i class="fa-solid fa-circle-check"></i><span><strong>All good</strong><small>Nothing needs you right now.</small></span></div>';
    return `<ul class="ad-attn">${out
      .map(
        (a) => `<li class="${a.tone}"><span class="ad-attn-icon"><i class="fa-solid ${a.icon}"></i></span><span class="ad-attn-text"><strong>${a.title}</strong><small>${esc(a.sub)}</small></span>${
          a.go
            ? `<button type="button" class="ad-attn-go" data-go="${a.go}" title="${esc(sec(a.go)[2])}">Open <i class="fa-solid fa-chevron-right"></i></button>`
            : '<button type="button" class="ad-attn-go ad-save-now">Save <i class="fa-solid fa-check"></i></button>'
        }</li>`
      )
      .join("")}</ul>`;
  }

  // the latest saves (this browser)
  function recentSaves() {
    const hist = changeLog().slice(0, 5);
    return hist.length
      ? `<ul class="ad-recent">${hist.map((h) => `<li><i></i><span><strong>${esc(h.what)}</strong><small>${ago(h.at)}</small></span></li>`).join("")}</ul>`
      : '<p class="sv-note">Nothing saved from this browser yet.</p>';
  }

  // the Overview's live parts, drawn again as the settings change (the charts stay)
  function paintOverview() {
    if (section !== "overview") return;
    const put = (sel, html) => {
      const el = root.querySelector(sel);
      if (el) el.innerHTML = html;
    };
    put("[data-season-pick]", seasonPick());
    put("[data-season-panel]", seasonPanel());
    put("[data-attention]", attention());
    put("[data-recent]", recentSaves());
    const n = root.querySelector("[data-attn-count]");
    if (n) {
      const c = root.querySelectorAll(".ad-attn li").length;
      n.textContent = c || "";
      n.hidden = !c;
    }
  }

  /* ---------------- the sections ---------------- */

  const render = {
    overview() {
      const st = Api.status();
      const prov = Object.entries(st);
      const answered = prov.reduce((n, [, x]) => n + x.ok + x.cached, 0);
      const failed = prov.reduce((n, [, x]) => n + x.fail, 0);
      const healthPct = answered + failed ? Math.round((answered / (answered + failed)) * 100) : 100;
      const cachedPct = answered ? Math.round((prov.reduce((n, [, x]) => n + x.cached, 0) / answered) * 100) : 0;
      const items = Store.all();
      const featuresOff = FEATURES.filter(([k]) => draft.features[k] === false);
      const hour = new Date().getHours();
      const hello = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      const name = ((Store.getProfile() || {}).name || "").split(" ")[0];
      const live = draft.maintenance.on ? ["Maintenance mode is on", "warn", "fa-screwdriver-wrench"] : { live: ["The site is live", "ok", "fa-circle-check"], default: ["Live, on the defaults", "ok", "fa-circle-check"], unpublished: ["Settings on this device only", "warn", "fa-triangle-exclamation"] }[Site.state()] || ["", "", ""];
      const tile = (icon, tone, value, label, extra, key) =>
        `<div class="ad-tile ${tone}"${key ? ` data-tile="${key}"` : ""}><span class="ad-tile-icon"><i class="fa-solid ${icon}"></i></span><div><b>${value}</b><small>${label}</small></div>${extra || ""}</div>`;
      return `<div class="ad-dash">
        <section class="ad-hero" data-box="hero">
          <div class="ad-hero-text">
            <span class="ad-hero-state ${live[1]}"><i class="fa-solid ${live[2]}"></i> ${live[0]}</span>
            <h2>${hello}${name ? `, ${esc(name)}` : ""}</h2>
            <p>Everything about the site in one place. Changes reach everyone when you save them.</p>
            <div class="ad-hero-stats" data-hero-stats><span><b>–</b><small>members</small></span><span><b>–</b><small>titles in libraries</small></span><span><b>–</b><small>scores given</small></span></div>
          </div>
          <div class="ad-hero-switches">
            ${sw("maintenance.on", "Maintenance mode", "Visitors see “back soon”", draft.maintenance.on)}
            ${sw("notice.on", "Notice across the top", draft.notice.text ? esc(draft.notice.text) : "Write it under Website", draft.notice.on)}
            <div class="ad-season-pick" data-season-pick>${seasonPick()}</div>
          </div>
          <i class="fa-solid fa-film ad-hero-art" aria-hidden="true"></i>
        </section>

        <div class="ad-tiles" data-box="tiles">
          ${tile("fa-users", "red", "–", "Members", '<span class="ad-tile-sub" data-tile-sub="members">loading…</span>', "members")}
          ${tile("fa-clapperboard", "gold", items.length, "In your library", `<span class="ad-tile-sub">${items.filter((i) => typeof i.rating === "number").length} rated · ${Store.lists().length} lists</span>`)}
          ${tile("fa-plug-circle-check", healthPct >= 95 ? "green" : healthPct >= 80 ? "gold" : "red", `${healthPct}%`, "Requests answered", `<span class="ad-tile-sub">${answered + failed} asked · ${cachedPct}% from memory</span>`)}
          ${tile("fa-toggle-on", featuresOff.length ? "gold" : "green", `${FEATURES.length - featuresOff.length}/${FEATURES.length}`, "Features on", `<span class="ad-tile-sub">${featuresOff.length ? `Off: ${esc(featuresOff.map((f) => f[1]).slice(0, 2).join(", "))}${featuresOff.length > 2 ? "…" : ""}` : "Everything is on"}</span>`)}
        </div>

        <section class="ad-panel" data-box="attention">
          <div class="ad-panel-head"><div><h3>Needs attention <b class="ad-count" data-attn-count hidden></b></h3><small>What's worth a look, and where to fix it</small></div></div>
          <div data-attention>${attention()}</div>
        </section>

        <section class="ad-panel ad-season-panel" data-box="season">
          <div class="ad-panel-head"><div><h3>Site atmosphere</h3><small>The seasonal look through the year, by the date</small></div><a class="t-link" href="#themes" data-sec="themes">Settings <i class="fa-solid fa-chevron-right"></i></a></div>
          <div data-season-panel>${seasonPanel()}</div>
          <div class="ad-season-switches">
            ${sw("themes.animations", "Animated atmosphere", "Snow, embers, mist… on lists and pages", draft.themes.animations !== false)}
            ${sw("themes.listThemes", "Atmospheres on people's lists", "Halloween, Christmas… on their own lists", draft.themes.listThemes !== false)}
          </div>
        </section>

        <section class="ad-panel" data-box="months">
          <div class="ad-panel-head"><div><h3>Watched, month by month</h3><small>Everyone's watch dates, the last 12 months</small></div><span class="ad-panel-big" data-months-total></span></div>
          <div class="ad-chart" data-chart="months"><div class="ad-chart-wait">Loading…</div></div>
        </section>

        <section class="ad-panel" data-box="services">
          <div class="ad-panel-head"><div><h3>Outside services</h3><small>Since the counts were last reset</small></div><a class="t-link" href="#apis" data-sec="apis">Details <i class="fa-solid fa-chevron-right"></i></a></div>
          <div class="ad-health-wrap">
            ${gauge(healthPct)}
            <ul class="ad-svc">${prov
              .map(
                ([, x]) => `<li class="${x.health}" title="${esc(x.lastError || "")}"><i></i><span>${esc(x.label.replace(/ \(.*\)$/, ""))}</span><b>${x.ok + x.cached}</b>${x.fail ? `<em>${x.fail} failed</em>` : ""}</li>`
              )
              .join("")}</ul>
          </div>
        </section>

        <section class="ad-panel" data-box="types">
          <div class="ad-panel-head"><div><h3>What people watch</h3><small>Every member's library</small></div></div>
          <div class="ad-chart" data-chart="types"><div class="ad-chart-wait">Loading…</div></div>
        </section>

        <section class="ad-panel" data-box="scores">
          <div class="ad-panel-head"><div><h3>The scores</h3><small>Every score given, 1 to 10</small></div><span class="ad-panel-big" data-score-avg></span></div>
          <div class="ad-chart" data-chart="scores"><div class="ad-chart-wait">Loading…</div></div>
        </section>

        <section class="ad-panel ad-actions" data-box="actions">
          <div class="ad-panel-head"><div><h3>Quick actions</h3><small>The things you do most</small></div></div>
          <div class="ad-action-grid">
            <button type="button" data-go="notifications" class="ad-action red"><i class="fa-solid fa-bullhorn"></i><span>Announce</span></button>
            <button type="button" data-go="content" class="ad-action gold"><i class="fa-solid fa-star"></i><span>Home picks</span></button>
            <button type="button" data-go="tools" data-then="checks" class="ad-action green"><i class="fa-solid fa-stethoscope"></i><span>Check services</span></button>
            <a href="index.html" target="_blank" rel="noopener" class="ad-action blue"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Open the site</span></a>
            <button type="button" class="ad-action ad-export"><i class="fa-solid fa-file-export"></i><span>Back up settings</span></button>
            <button type="button" data-go="tools" class="ad-action"><i class="fa-solid fa-clock-rotate-left"></i><span>History</span></button>
            <button type="button" data-go="homepage" class="ad-action purple"><i class="fa-solid fa-house"></i><span>Home rows</span></button>
            <button type="button" data-go="content" class="ad-action"><i class="fa-solid fa-eye-slash"></i><span>Hide a title</span></button>
            <button type="button" data-action="add-title" class="ad-action gold"><i class="fa-solid fa-plus"></i><span>Add a title</span></button>
          </div>
        </section>

        <section class="ad-panel" data-box="recent">
          <div class="ad-panel-head"><div><h3>Latest saves</h3><small>From this browser</small></div><a class="t-link" href="#tools" data-sec="tools">History <i class="fa-solid fa-chevron-right"></i></a></div>
          <div data-recent>${recentSaves()}</div>
        </section>

        <section class="ad-panel" data-box="members">
          <div class="ad-panel-head"><div><h3>Members</h3><small>Most titles first</small></div><a class="t-link" href="#users" data-sec="users">Manage <i class="fa-solid fa-chevron-right"></i></a></div>
          <div class="ad-chart" data-chart="members"><div class="ad-chart-wait">Loading…</div></div>
        </section>
      </div>`;
    },
    website() {
      return `<div class="ad-grid">
        ${card("fa-signature", "Branding", `${text("branding.name", "Site name (browser tabs)", draft.branding.name, 'maxlength="40"')}
          ${area("branding.tagline", "Tagline (footer)", draft.branding.tagline)}
          <label class="ad-field"><span>Accent colour</span><span class="ad-color"><input type="color" data-k="branding.accent" value="${esc(draft.branding.accent || "#b92222")}" />
          <button type="button" class="btn ad-reset-accent">Site red</button></span></label>`, "The logo stays the site's own picture.")}
        ${card("fa-screwdriver-wrench", "Maintenance", `${sw("maintenance.on", "Maintenance mode", "Everyone but you sees the “back soon” screen", draft.maintenance.on)}${area("maintenance.message", "Message", draft.maintenance.message)}`)}
        ${card("fa-bullhorn", "Notice across the top", `${sw("notice.on", "Show it", "On every page, until a visitor closes it", draft.notice.on)}
          ${text("notice.text", "Text", draft.notice.text, 'maxlength="160" placeholder="New: Movie News!"')}
          ${text("notice.link", "Link (optional)", draft.notice.link, 'placeholder="news.html or https://…"')}
          ${select("notice.tone", "Look", draft.notice.tone, [["info", "News (red bullhorn)"], ["warn", "Warning (amber)"]])}
          <div class="ad-two">${text("notice.from", "From (optional)", draft.notice.from, 'type="date"')}${text("notice.until", "Until (optional)", draft.notice.until, 'type="date"')}</div>`, "With days set, it shows only between them: switch it on now, it appears and goes by itself.")}
      </div>`;
    },
    pages() {
      return `<div class="ad-grid">
        ${card("fa-bars", "Pages in the navigation", PAGE_NAMES.map(([id, l]) => `<div class="sv-row"><span class="sv-name"><strong>${esc(l)}</strong></span>
          <label class="sv-switch"><input type="checkbox" data-nav-page="${id}"${(draft.nav.hidden || []).includes(id) ? "" : " checked"} aria-label="${esc(l)}" /><span class="switch-track"><span class="switch-thumb"></span></span></label></div>`).join(""),
          "Hidden pages still open from a link; they just leave the navbar, the tab bar's Library panel and the footer.")}
        ${card("fa-toggle-on", "Features", FEATURES.map(([k, l, sub]) => sw(`features.${k}`, l, sub, draft.features[k] !== false)).join(""))}
      </div>`;
    },
    content() {
      const featured = draft.home.featured || [];
      const books = draft.home.featuredBooks || [];
      const anime = draft.anime.featured || [];
      const hidden = (draft.content && draft.content.hidden) || [];
      const chip = (label, attr) => `<span class="ad-chip">${esc(label)}<button type="button" ${attr} aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`;
      return `<div class="ad-grid">
        ${card("fa-star", "Featured on Home", `${text("home.featuredTitle", "Row title", draft.home.featuredTitle)}
          <div class="ad-chips">${featured.map((h, i) => chip(`${h.title}${h.year ? ` (${h.year})` : ""}`, `data-rm="home.featured" data-i="${i}"`)).join("") || '<span class="muted">Nothing yet</span>'}</div>
          <div class="ad-search" data-search="tmdb"><input class="input" placeholder="Find a movie or show to feature…" /><div class="ad-results"></div></div>`, "Shown right after Top 10, for everyone.")}
        ${card("fa-dragon", "Featured anime", `<div class="ad-chips">${anime.map((a, i) => chip(a.title, `data-rm="anime.featured" data-i="${i}"`)).join("") || '<span class="muted">Nothing yet</span>'}</div>
          <div class="ad-search" data-search="anime"><input class="input" placeholder="Find an anime to feature…" /><div class="ad-results"></div></div>`, "Shown first on the anime explorer, as “Our picks”.")}
        ${card("fa-book", "Featured books", `${text("home.featuredBooksTitle", "Row title", draft.home.featuredBooksTitle)}
          <div class="ad-chips">${books.map((b, i) => chip(b.title, `data-rm="home.featuredBooks" data-i="${i}"`)).join("") || '<span class="muted">Nothing yet</span>'}</div>
          <div class="ad-search" data-search="books"><input class="input" placeholder="Find a book on Open Library…" /><div class="ad-results"></div></div>`, "A row of books on Home, under your picks.")}
        ${card("fa-eye-slash", "Hidden titles (moderation)", `<div class="ad-chips">${hidden.map((h, i) => chip(h.title || h.ref, `data-rm="content.hidden" data-i="${i}"`)).join("") || '<span class="muted">None</span>'}</div>
          <div class="ad-search" data-search="hide"><input class="input" placeholder="Find a title to hide…" /><div class="ad-results"></div></div>`, "Hidden from Discover, Home and search rows for everyone (people's own libraries keep it).")}
        ${card("fa-compass", "Explore pages", `${num("discover.phoneFirst", "Titles at first, phones", draft.discover.phoneFirst, 10, 40)}${num("discover.desktopFirst", "Titles at first, computers", draft.discover.desktopFirst, 20, 60)}`, "Movies and TV Shows → Explore, before “Load more”. Posters load as they come near the screen.")}
        ${card("fa-plus", "Add a title by hand", '<p class="sv-note sv-lead">A title TMDB doesn\'t have, straight into your own library.</p><button class="btn" type="button" data-action="add-title"><i class="fa-solid fa-plus"></i> Add a title</button>')}
      </div>`;
    },
    news() {
      const hidden = draft.news.hiddenSources || [];
      const pins = draft.news.featured || [];
      return `<div class="ad-grid">
        ${card("fa-rss", "Sources", News.FEEDS.map((f) => `<div class="sv-row"><span class="sv-name"><strong>${esc(f.name)}</strong><small>${esc(f.kind === "tv" ? "TV news" : "Movie news")} · ${esc(f.url.replace(/^https:\/\//, ""))}</small></span>
          <label class="sv-switch"><input type="checkbox" data-news-src="${f.id}"${hidden.includes(f.id) ? "" : " checked"} aria-label="${esc(f.name)}" /><span class="switch-track"><span class="switch-thumb"></span></span></label></div>`).join(""))}
        ${card("fa-thumbtack", "Pinned stories", `${pins.map((p, i) => `<span class="ad-chip">${esc(p.title)}<button type="button" data-rm="news.featured" data-i="${i}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`).join("") || '<p class="muted">None pinned.</p>'}
          <div class="ad-pin">
            <input class="input" name="title" placeholder="Headline" maxlength="160" />
            <input class="input" name="link" placeholder="https://… (the story)" />
            <input class="input" name="source" placeholder="Source (e.g. Variety)" maxlength="40" />
            <input class="input" name="image" placeholder="Picture address (https://…, optional)" />
            <textarea class="input" name="excerpt" rows="2" maxlength="300" placeholder="A line or two (optional)"></textarea>
            <button class="btn ad-pin-add" type="button"><i class="fa-solid fa-thumbtack"></i> Pin it</button>
          </div>`, "Pinned stories come first on Movie News, the top one as the big story.")}
      </div>`;
    },
    apis() {
      const st = Api.status();
      const src = TMDB.keySource();
      let browserKey = "";
      try {
        browserKey = localStorage.getItem(Store.KEYS.tmdbKey) || "";
      } catch (e) {}
      return `<div class="ad-grid">
        ${card("fa-film", "TMDB", `<div class="ad-api-head"><span class="ad-health ${src ? "ok" : "down"}"><i></i>${src === "config" ? "On · js/config.js" : src === "browser" ? "On · this browser's key" : "No key"}</span><small>Titles, posters, trailers, cast, Explore</small></div>
          <label class="ad-field"><span>A key for this browser only (overrides js/config.js)</span><input class="input ad-tmdb-key" type="password" autocomplete="off" placeholder="API key or read access token" value="${esc(browserKey)}" /></label>
          <div class="sv-buttons"><button class="btn btn-primary ad-key-save" type="button">Save key</button><button class="btn ad-key-test" type="button">Test</button><button class="btn ad-key-clear" type="button">Remove</button></div>`,
          "Free at themoviedb.org → Settings → API. The key everyone uses is the one in js/config.js.")}
        ${card("fa-star", "IMDb ratings (OMDb)", '<div class="ad-omdb"></div>', "1,000 free lookups a day: the site uses at most 900, one per title, and keeps every rating about a month.")}
        ${Object.entries(API_NAMES)
        .map(([k, [label, what, unit]]) => {
          const s = st[k] || {};
          const a = Object.assign({}, Site.DEFAULTS.apis[k] || {}, draft.apis[k] || {});
          const max = unit === "minutes" ? 720 : unit === "hours" ? 168 : 365;
          return card(
            "fa-plug",
            esc(label),
            `<div class="ad-api-head"><span class="ad-health ${s.health}"><i></i>${{ ok: "Working", down: "Not answering", off: "Switched off", unknown: "Not asked yet" }[s.health] || ""}</span><small>${esc(what)}</small></div>
            ${sw(`apis.${k}.on`, "On", "Off: the site doesn't ask it at all and shows what it can without it", a.on !== false)}
            ${num(`apis.${k}.${unit}`, `Keep answers for (${unit})`, a[unit], 1, max)}
            <div class="ad-api-stats"><span><b>${s.ok || 0}</b> answered</span><span><b>${s.cached || 0}</b> from memory</span><span><b>${s.fail || 0}</b> failed</span><span>Last good: ${ago(s.lastOk)}</span></div>
            ${s.lastError ? `<p class="sv-note ad-err"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(s.lastError)} (${ago(s.lastFail)})</p>` : ""}
            <div class="sv-buttons"><button class="btn" type="button" data-api-test="${k}"><i class="fa-solid fa-stethoscope"></i> Test</button><button class="btn" type="button" data-api-clear="${k}"><i class="fa-solid fa-broom"></i> Clear its memory</button></div>`
          );
        })
        .join("")}
        ${card("fa-chart-simple", "These numbers", '<p class="sv-note sv-lead">Counted in this browser since the last reset.</p><button class="btn ad-reset-stats" type="button">Reset the numbers</button>')}
      </div>`;
    },
    themes() {
      // (the ones switched off; a new atmosphere is on until switched off)
      const off = ListThemes.offOf(draft.themes);
      const seasonsOff = draft.themes.seasonsOff || [];
      const today = window.Season ? Season.byDate(new Date(), seasonsOff) : "";
      const easter = window.Season ? Season.easterOf(new Date().getFullYear()) : null;
      const dates = (id) =>
        id === "easter" && easter
          ? `${SEASON_LOOK.easter[2]} (this year ${day(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 7))} – ${day(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1))})`
          : SEASON_LOOK[id][2];
      return `<div class="ad-grid">
        ${card(
          "fa-calendar-days",
          "Seasonal look",
          `${select("themes.season", "The whole site in the season's look, for everyone", draft.themes.season || "auto", [
            ["auto", "By the date"],
            ["off", "Off"],
            ...SEASON_IDS.map((id) => [id, `${seasonName(id)}, locked on`]),
          ])}
          ${select("themes.seasonLevel", "How much of it", draft.themes.seasonLevel || "full", [
            ["full", "Full: everything drifting, mist and bats"],
            ["light", "Light: half as much drifting"],
            ["calm", "Calm: the colours and the navbar's decoration only"],
          ])}
          ${sw("themes.seasonPill", "Blood and snow on the navbar", "On computers and tablets, on the capsule of page links (Halloween, Christmas, Winter)", draft.themes.seasonPill !== false)}
          <p class="sv-note"><i class="fa-solid fa-circle-info"></i> Today by the date: <b>${today ? esc(seasonName(today)) : "none"}</b>. Locked on: that season all the time, whatever the date (to see it, or for an event). "Animated atmosphere" (below) stops its movement too.</p>`
        )}
        ${card(
          "fa-calendar-check",
          "Seasons by the date",
          SEASON_IDS.map(
            (id) => `<div class="sv-row"><span class="sv-name ad-season-row" style="--c:${SEASON_LOOK[id][1]}"><strong><i class="fa-solid ${SEASON_LOOK[id][0]}"></i> ${esc(seasonName(id))}</strong><small>${esc(dates(id))}</small></span>
          <label class="sv-switch"><input type="checkbox" data-season-off="${id}"${seasonsOff.includes(id) ? "" : " checked"} aria-label="${esc(seasonName(id))}" /><span class="switch-track"><span class="switch-thumb"></span></span></label></div>`
          ).join(""),
          "The ones “By the date” uses. Off: those days get the next season that fits (Autumn around a switched-off Halloween) or the site's own look."
        )}
        ${card("fa-wand-magic-sparkles", "List atmospheres", `${sw("themes.listThemes", "Atmospheres on people's lists", "Off: every list in the site's own look", draft.themes.listThemes !== false)}
          ${sw("themes.animations", "Animated atmosphere", "Snow, rain, embers, fog… on lists and pages. Off: the colours stay, nothing moves", draft.themes.animations !== false)}
          <p class="sv-note"><i class="fa-solid fa-circle-info"></i> A list on Auto gets one when its name or its titles point clearly at it (${Math.round(ListThemes.THRESHOLD * 100)}% sure or more).</p>`)}
        ${card("fa-circle-half-stroke", "Site theme", select("themes.siteDefault", "Theme for new visitors", draft.themes.siteDefault, [["dark", "Dark"], ["light", "Light"]]), "People who pick a theme themselves keep theirs.")}
        ${card(
          "fa-swatchbook",
          "Atmospheres on offer",
          ListThemes.GROUPS.map(
            ([g, title]) => `<h4 class="xr-sub ad-lt-sub">${title}</h4><div class="ad-lt-grid">${ListThemes.THEMES.filter((t) => t.group === g)
              .map(
                (t) => `<div class="sv-row"><span class="sv-name"><strong>${t.emoji} ${esc(t.label)}</strong><small>${esc(t.hint)}</small></span>
          <label class="sv-switch"><input type="checkbox" data-theme-avail="${t.id}"${off.includes(t.id) ? "" : " checked"} aria-label="${esc(t.label)}" /><span class="switch-track"><span class="switch-thumb"></span></span></label></div>`
              )
              .join("")}</div>`
          ).join("")
        ).replace("<section ", '<section data-box="lt-offer" ')}
      </div>`;
    },
    notifications() {
      return `<div class="ad-grid">
        ${card("fa-bell", "Release alerts", `${sw("notifications.on", "Alerts and notifications", "The bell in the navbar with its number, and notifications for those who turn them on", draft.notifications.on !== false)}
          ${sw("notifications.release", "Movie releases", "", draft.notifications.release !== false)}
          ${sw("notifications.season", "New seasons", "", draft.notifications.season !== false)}
          ${sw("notifications.episode", "New episodes", "", draft.notifications.episode !== false)}
          ${sw("notifications.recommendation", "Weekly recommendation", "A well-known title like one they loved", draft.notifications.recommendation !== false)}
          ${sw("notifications.announcement", "Announcements", "Your messages to everyone (below)", draft.notifications.announcement !== false)}`,
          "Each person turns notifications on for their own devices in Settings → Notifications, and picks the kinds they want.")}
        ${card(
          "fa-bullhorn",
          "Announcement to everyone",
          `${
            draft.announce && draft.announce.title
              ? `<div class="ad-announce-now"><span class="ad-announce-icon"><i class="fa-solid fa-bullhorn"></i></span><span><strong>${esc(draft.announce.title)}</strong><small>${esc(draft.announce.text || "")}</small><em>Sent ${ago(draft.announce.at)}</em></span><button class="btn ad-unannounce" type="button">Withdraw</button></div>`
              : '<p class="sv-note sv-lead">Nothing sent yet.</p>'
          }
          <div class="ad-pin ad-announce">
            <input class="input" name="title" placeholder="Title (e.g. New: Movie News!)" maxlength="120" />
            <textarea class="input" name="text" rows="2" maxlength="400" placeholder="A line or two (optional)"></textarea>
            <input class="input" name="link" placeholder="Link (news.html or https://…, optional)" />
            <button class="btn btn-primary ad-announce-send" type="button"><i class="fa-solid fa-paper-plane"></i> Send to everyone</button>
          </div>`,
          "It lands in every member's bell (and as a notification for those who turned them on) the next time they open the site. Sending another replaces it."
        )}
        ${card("fa-mobile-screen", "How they arrive", `<ul class="ad-list">
          <li><b>Android, installed app:</b> the phone checks in the background now and then (Periodic Background Sync), so they can come while the app is closed.</li>
          <li><b>Computers and Android in the browser:</b> when the site is open.</li>
          <li><b>iPhone / iPad:</b> after adding the site to the Home Screen; when the app is opened.</li>
          <li>Instant push while everything is closed would need a server (Firebase Cloud Messaging on the paid plan): not used, the site stays free.</li></ul>`)}
      </div>`;
    },
    users() {
      const rules = `match /site/config {
  allow get: if true;
  allow list, delete: if false;
  allow create, update: if owner()
    && request.resource.data.keys().hasOnly(['data', 'blocked', 'updatedAt'])
    && request.resource.data.data is string && request.resource.data.data.size() < 200000
    && request.resource.data.blocked is list && request.resource.data.blocked.size() <= 200
    && validTime(request.resource.data);
}`;
      return `<div class="ad-grid">
        ${card("fa-users", "Members", '<div class="member-list ad-members"><p class="sv-note">Loading…</p></div>', "Who may sign in is decided by the allowlist in your Firestore rules (Firebase console → Firestore → Rules). You see how big each library is, never anyone's ratings.")}
        ${card("fa-user-slash", "Turned away", `<div class="ad-chips">${blocked.map((e, i) => `<span class="ad-chip">${esc(e)}<button type="button" data-unblock="${i}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`).join("") || '<span class="muted">Nobody</span>'}</div>
          <div class="ad-inline"><input class="input ad-block-email" type="email" placeholder="their Google email" /><button class="btn ad-block" type="button">Turn away</button></div>`,
          "They're signed out on their next visit; with the rules below published, the account refuses them too.")}
        ${card("fa-shield-halved", "Roles", `<div class="sv-row"><span class="sv-name"><strong>Owner</strong><small>You: every setting here, Add a title, Members</small></span></div>
          <div class="sv-row"><span class="sv-name"><strong>Member</strong><small>Their own private library, lists, ratings, notifications</small></span></div>
          <div class="sv-row"><span class="sv-name"><strong>Visitor</strong><small>Discover, title pages, News, the anime explorer: no library</small></span></div>`)}
        ${card("fa-file-shield", "Rules for site settings", `<p class="sv-note sv-lead">So your settings reach everyone, add this inside <code>match /databases/{database}/documents</code> in the Firebase console (Firestore → Rules), then Publish. A full copy is in <code>docs/firestore.rules</code>.</p>
          <pre class="ad-pre">${esc(rules)}</pre><button class="btn ad-copy-rules" type="button"><i class="fa-regular fa-copy"></i> Copy</button>`)}
      </div>`;
    },
    // a title page / a person page, drawn small: its top part, then every row; drag them (or the
    // arrows) to put them in another order, the eye hides one. Saved for everyone with Save changes
    titlepage() {
      return rowsEditor(
        Site.TITLE_ROWS,
        "titlePage",
        "Title page: the order of its rows",
        `<span class="tp-poster"></span><span class="tp-hero-text"><b>A movie or a show</b><i></i><i></i><span><em></em><em></em><em></em></span></span>`,
        "A row shows only when the title has something for it (Episodes: shows, Collection: films of a franchise…)."
      );
    },
    homepage() {
      return rowsEditor(
        Site.HOME_ROWS,
        "homePage",
        "Home page: the order of its rows",
        `<span class="tp-hero-text"><b>The slideshow: this week's trending</b><i></i><i></i><span><em></em><em></em><em></em></span></span>`,
        "Under the slideshow; each member's own rows (Continue watching, favorites…) stay at the bottom. Our picks and the books show only with titles featured (Content); Trending still fills the slideshow when its row is left out."
      );
    },
    personpage() {
      return rowsEditor(
        Site.PERSON_ROWS,
        "personPage",
        "Person page: the order of its rows",
        `<span class="tp-poster tp-face"></span><span class="tp-hero-text"><b>An actor, a director, a writer</b><i></i><i></i><span><em></em><em></em></span></span>`,
        "Under the top part (their card, the photos, the numbers and the biography). Books show for people with books on Open Library; a writer's (or a book's author you tapped) come right before the Filmography."
      );
    },
    tools() {
      const hist = changeLog();
      return `<div class="ad-grid">
        ${card("fa-stethoscope", "Service checks", '<p class="sv-note sv-lead">Asks each outside service one small question, now, and times the answer.</p><div class="ad-checks"></div><button class="btn btn-primary ad-run-checks" type="button"><i class="fa-solid fa-play"></i> Run the checks</button>')}
        ${card("fa-hard-drive", "This device", '<div class="ad-storage">Measuring…</div><div class="sv-buttons"><button class="btn ad-clear-api" type="button"><i class="fa-solid fa-broom"></i> Forget saved answers</button><button class="btn ad-clear-tmdb" type="button"><i class="fa-solid fa-film"></i> Forget TMDB details</button><button class="btn ad-reset-counts" type="button"><i class="fa-solid fa-rotate-left"></i> Reset service counts</button></div>', "Only this browser: answers are asked for again as pages need them.")}
        ${card(
          "fa-clock-rotate-left",
          "Change history",
          hist.length
            ? `<ul class="ad-history">${hist
                .map(
                  (h, i) => `<li><span class="ad-history-dot"></span><span class="ad-history-text"><strong>${esc(h.what)}</strong><small>${new Date(h.at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${ago(h.at)}</small></span><button class="btn ad-restore" type="button" data-restore="${i}" title="The settings as they were before this save">Restore before</button></li>`
                )
                .join("")}</ul>`
            : '<p class="sv-note sv-lead">Nothing saved from this browser yet.</p>',
          "Every save from this browser, newest first (the last 15). Restore puts the settings back as they were before that save: check them, then Save changes."
        )}
      </div>`;
    },
    backup() {
      return `<div class="ad-grid">${card(
        "fa-floppy-disk",
        "Settings backup",
        `<p class="sv-note sv-lead">A file with every setting on this page (not anyone's library).</p>
        <div class="sv-buttons"><button class="btn ad-export" type="button"><i class="fa-solid fa-file-export"></i> Download</button>
        <label class="btn"><i class="fa-solid fa-file-import"></i> Restore<input type="file" accept=".json,application/json" class="ad-import" hidden /></label>
        <button class="btn btn-danger ad-defaults" type="button"><i class="fa-solid fa-rotate-left"></i> Back to defaults</button></div>`
      )}</div>`;
    },
  };

  /* ---------------- change history (this browser) ---------------- */

  const HISTORY = "mn:adminHistory";
  const changeLog = () => Store.read(HISTORY, []) || [];
  // what changed between two versions, in words ("Maintenance, Notice, Features")
  const LABELS = { branding: "Branding", maintenance: "Maintenance", notice: "Notice", nav: "Navigation", features: "Features", discover: "Explore pages", home: "Home picks", anime: "Featured anime", content: "Hidden titles", news: "News", apis: "API integrations", themes: "Themes", notifications: "Notifications", announce: "Announcement", titlePage: "Title page rows", personPage: "Person page rows", homePage: "Home page rows" };
  function changes(before, after, blockedBefore, blockedAfter) {
    const keys = [...new Set(Object.keys(before || {}).concat(Object.keys(after || {})))].filter((k) => JSON.stringify((before || {})[k]) !== JSON.stringify((after || {})[k]));
    const out = keys.map((k) => LABELS[k] || k);
    if (JSON.stringify(blockedBefore) !== JSON.stringify(blockedAfter)) out.push("Turned-away people");
    return out.join(", ") || "No changes";
  }
  function remember(before, blockedBefore) {
    const list = changeLog();
    list.unshift({ at: Date.now(), what: changes(before, draft, blockedBefore, blocked), before, blocked: blockedBefore });
    Store.write(HISTORY, list.slice(0, 15));
  }

  /* ---------------- Tools: the checks, this device ---------------- */

  async function runChecks(box) {
    const tm = async (label, job) => {
      const t0 = performance.now();
      try {
        const ok = await job();
        return [label, ok !== false, Math.round(performance.now() - t0)];
      } catch (e) {
        return [label, false, Math.round(performance.now() - t0), e.message];
      }
    };
    const okJson = (r) => (r.ok ? true : Promise.reject(new Error(`answered ${r.status}`)));
    const jobs = [
      ["TMDB", () => TMDB.test()],
      ["TVmaze", () => fetch("https://api.tvmaze.com/shows/1").then(okJson)],
      ["AniList", () => fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "query { Media(id: 1) { id } }" }) }).then(okJson)],
      ["Open Library", () => fetch("https://openlibrary.org/search.json?q=dune&limit=1&fields=key").then(okJson)],
      ["Apple Music", () => fetch("https://itunes.apple.com/search?term=inception&media=music&entity=album&limit=1").then(okJson)],
    ];
    box.innerHTML = jobs.map(([l]) => `<div class="ad-check wait"><i></i><span>${l}</span><b>…</b></div>`).join("");
    const results = await Promise.all(jobs.map(([l, f]) => tm(l, f)));
    box.innerHTML = results
      .map(([l, ok, ms, err]) => `<div class="ad-check ${ok ? (ms > 1500 ? "slow" : "ok") : "down"}" title="${esc(err || "")}"><i></i><span>${esc(l)}</span><b>${ok ? `${ms} ms` : esc(err || "no answer")}</b></div>`)
      .join("");
  }
  async function storage(box) {
    if (!box) return;
    let local = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        local += (k.length + (localStorage.getItem(k) || "").length) * 2;
      }
    } catch (e) {}
    let est = null;
    try {
      est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    } catch (e) {}
    const mb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
    const used = est ? est.usage || 0 : 0;
    const quota = est ? est.quota || 0 : 0;
    const pct = quota ? Math.round((used / quota) * 1000) / 10 : 0;
    box.innerHTML = `<div class="ad-store-row"><span>Everything this site keeps here</span><b>${est ? mb(used) : "–"}</b></div>
      ${quota ? `<div class="sv-meter-bar"><i style="width:${Math.max(1, Math.min(100, pct))}%"></i></div><small class="muted">${pct < 1 ? "Under 1%" : `${pct}%`} of the ${mb(quota)} this browser allows</small>` : ""}
      <div class="ad-store-row"><span>Settings, library copy, small things</span><b>${mb(local)}</b></div>`;
  }

  /* ---------------- the dashboard's charts (SVG, drawn here) ---------------- */

  // a half-round gauge: how many requests got an answer
  function gauge(pct) {
    const r = 70;
    const len = Math.PI * r;
    const on = (len * Math.max(0, Math.min(100, pct))) / 100;
    const tone = pct >= 95 ? "green" : pct >= 80 ? "gold" : "red";
    return `<div class="ad-gauge ${tone}"><svg viewBox="0 0 180 104" aria-hidden="true">
        <path d="M20 94 A70 70 0 0 1 160 94" class="ad-gauge-bg" pathLength="${len}" />
        <path d="M20 94 A70 70 0 0 1 160 94" class="ad-gauge-on" stroke-dasharray="${on} ${len}" pathLength="${len}" />
      </svg><span><b>${pct}%</b><small>answered</small></span></div>`;
  }
  // bars with their labels under them; the highest one lit
  function bars(values, labels, opts = {}) {
    const max = Math.max(1, ...values);
    const top = values.indexOf(Math.max(...values));
    return `<div class="ad-bars${opts.small ? " small" : ""}">${values
      .map(
        (v, i) => `<div class="ad-bar-col${i === top && v ? " top" : ""}" title="${esc(labels[i])}: ${v}"><span class="ad-bar-v">${v || ""}</span><i style="height:${Math.max(3, Math.round((v / max) * 100))}%"></i><small>${esc(labels[i])}</small></div>`
      )
      .join("")}</div>`;
  }
  // a ring split in parts: [[label, value, tone]]
  function donut(parts) {
    const total = parts.reduce((n, p) => n + p[1], 0) || 1;
    const r = 52;
    const c = 2 * Math.PI * r;
    let at = 0;
    const arcs = parts
      .map(([, v, tone]) => {
        const len = (v / total) * c;
        const out = `<circle r="${r}" cx="70" cy="70" class="ad-donut-part ${tone}" stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-at}" />`;
        at += len;
        return out;
      })
      .join("");
    return `<div class="ad-donut-wrap"><div class="ad-donut"><svg viewBox="0 0 140 140" aria-hidden="true"><circle r="${r}" cx="70" cy="70" class="ad-donut-bg" />${arcs}</svg>
        <span><b>${total === 1 && !parts.some((p) => p[1]) ? 0 : parts.reduce((n, p) => n + p[1], 0)}</b><small>titles</small></span></div>
      <ul class="ad-legend">${parts.map(([l, v, tone]) => `<li class="${tone}"><i></i><span>${esc(l)}</span><b>${v}</b><small>${Math.round((v / total) * 100)}%</small></li>`).join("")}</ul></div>`;
  }

  // the parts that need everyone's libraries (Cloud.members)
  async function dashboard() {
    const box = (k) => root.querySelector(`[data-chart="${k}"]`);
    let list = [];
    try {
      list = await Cloud.members();
    } catch (e) {
      ["months", "types", "scores", "members"].forEach((k) => box(k) && (box(k).innerHTML = `<p class="sv-note">Couldn't load the members: ${esc(e.message)}</p>`));
      return;
    }
    if (section !== "overview" || !box("months")) return;
    const sum = (f) => list.reduce((n, m) => n + f(m), 0);
    const titles = sum((m) => m.titles);
    const scores = list.flatMap((m) => m.scores || []);
    const week = list.filter((m) => Date.now() - m.updatedAt < 7 * 86400000).length;
    const hero = root.querySelector("[data-hero-stats]");
    if (hero) hero.innerHTML = `<span><b>${list.length}</b><small>members</small></span><span><b>${titles}</b><small>titles in libraries</small></span><span><b>${scores.length}</b><small>scores given</small></span>`;
    const mt = root.querySelector('[data-tile="members"] b');
    if (mt) mt.textContent = list.length;
    const ms = root.querySelector('[data-tile-sub="members"]');
    if (ms) ms.textContent = `${week} active this week`;

    // the last 12 months
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const keys = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const perMonth = keys.map((k) => sum((m) => (m.months && m.months[k]) || 0));
    box("months").innerHTML = bars(perMonth, keys.map((k) => MONTHS[Number(k.slice(5)) - 1]));
    const thisM = perMonth[11];
    const lastM = perMonth[10];
    const change = lastM ? Math.round(((thisM - lastM) / lastM) * 100) : null;
    root.querySelector("[data-months-total]").innerHTML = `<b>${thisM}</b> this month${change != null ? ` <em class="${change >= 0 ? "up" : "down"}">${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}%</em>` : ""}`;

    // movies / TV / anime
    const types = { movie: 0, tv: 0, anime: 0 };
    list.forEach((m) => Object.entries(m.types || {}).forEach(([t, n]) => (types[t] = (types[t] || 0) + n)));
    box("types").innerHTML = donut([["Movies", types.movie || 0, "red"], ["TV shows", types.tv || 0, "gold"], ["Anime", types.anime || 0, "blue"]]);

    // scores 1-10
    const hist = Array.from({ length: 10 }, (_, i) => scores.filter((s) => Math.round(s) === i + 1).length);
    box("scores").innerHTML = bars(hist, hist.map((_, i) => String(i + 1)), { small: true });
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "–";
    root.querySelector("[data-score-avg]").innerHTML = `<b>${avg}</b> average`;

    // the members, most titles first
    const most = Math.max(1, ...list.map((m) => m.titles));
    box("members").innerHTML = `<ul class="ad-people">${list
      .slice()
      .sort((a, b) => b.titles - a.titles)
      .slice(0, 6)
      .map(
        (m) => `<li><img src="${esc(/^https:\/\//.test(m.photo || "") ? m.photo : "images/placeholders/user.svg")}" alt="" referrerpolicy="no-referrer" />
          <span class="ad-people-name"><strong>${esc(m.name)}${m.me ? " (you)" : ""}</strong><small>${m.rated} rated · synced ${ago(m.updatedAt)}</small></span>
          <span class="ad-people-bar"><i style="width:${Math.round((m.titles / most) * 100)}%"></i></span><b>${m.titles}</b></li>`
      )
      .join("") || '<li class="muted">Nobody yet.</li>'}</ul>`;
  }

  // the sidebar's badges: services down, maintenance on, features off
  function paintBadges() {
    const set = (k, text, tone) => {
      const b = root.querySelector(`[data-badge="${k}"]`);
      if (!b) return;
      b.hidden = !text;
      b.textContent = text || "";
      b.className = `ad-badge ${tone || ""}`;
    };
    const down = Object.values(Api.status()).filter((x) => x.health === "down").length;
    set("apis", down ? String(down) : "", "red");
    set("website", draft.maintenance.on ? "On" : "", "gold");
    const off = FEATURES.filter(([k]) => draft.features[k] === false).length;
    set("pages", off ? `${off} off` : "", "");
    const season = draft.themes.season || "auto";
    set("themes", SEASON_LOOK[season] ? "Locked" : season === "off" ? "Off" : "", "gold");
  }

  /* ---------------- find a setting ---------------- */

  let findIndex = null;
  function buildIndex() {
    const out = [];
    const tmp = document.createElement("div");
    SECTIONS.forEach(([k, icon, label]) => {
      if (k === "overview") return;
      try {
        tmp.innerHTML = render[k]();
      } catch (e) {
        return;
      }
      tmp.querySelectorAll(".sv-name strong, .ad-field > span:first-child, .xr-label").forEach((el) => {
        const t = el.textContent.replace(/\s+/g, " ").trim();
        if (t && !out.some((o) => o.t === t && o.k === k)) out.push({ t, k, icon, label });
      });
    });
    return out;
  }
  function find(q) {
    const list = root.querySelector(".ad-find-list");
    q = q.trim().toLowerCase();
    if (!q) return (list.hidden = true);
    findIndex = findIndex || buildIndex();
    const hits = findIndex.filter((o) => o.t.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)).slice(0, 8);
    list.hidden = false;
    list.innerHTML = hits.length
      ? hits.map((o, i) => `<button type="button" data-find="${i}"><i class="fa-solid ${o.icon}"></i><span><strong>${esc(o.t)}</strong><small>${esc(o.label)}</small></span></button>`).join("")
      : '<p class="muted">Nothing called that.</p>';
    list._hits = hits;
  }
  function goTo(hit) {
    history.replaceState(null, "", `#${hit.k}`);
    show(hit.k);
    const el = [...body.querySelectorAll(".sv-name strong, .ad-field > span:first-child, .xr-label")].find((x) => x.textContent.replace(/\s+/g, " ").trim() === hit.t);
    const target = el && (el.closest(".sv-row, .ad-field, .ad-card") || el);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.classList.remove("ad-flash");
      void target.offsetWidth;
      target.classList.add("ad-flash");
    }
  }

  /* ---------------- Title page: the order of its rows ---------------- */

  const rowsBox = () => body.querySelector(".tp-rows");
  // the list as it is on the page now -> the draft (Save changes sends it)
  function rowsToDraft() {
    const box = rowsBox();
    if (!box) return;
    const items = [...box.querySelectorAll(".tp-row")];
    setPath(box.dataset.path || "titlePage", { order: items.map((r) => r.dataset.row), hidden: items.filter((r) => r.classList.contains("off")).map((r) => r.dataset.row) });
  }
  function slide(box, change) {
    const items = [...box.children];
    const before = new Map(items.map((r) => [r, r.getBoundingClientRect().top]));
    change();
    items.forEach((r) => {
      if (r.classList.contains("dragging")) return;
      const dy = before.get(r) - r.getBoundingClientRect().top;
      if (!dy) return;
      r.style.transition = "none";
      r.style.transform = `translateY(${dy}px)`;
      void r.offsetWidth;
      r.style.transition = "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)";
      r.style.transform = "";
    });
  }
  let rowDrag = null;
  root.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".tp-grip");
    if (!grip || e.button > 0) return;
    e.preventDefault();
    const row = grip.closest(".tp-row");
    rowDrag = { row, id: e.pointerId, moved: false };
    row.classList.add("dragging");
    try {
      grip.setPointerCapture(e.pointerId);
    } catch (err) {}
  });
  root.addEventListener("pointermove", (e) => {
    if (!rowDrag || e.pointerId !== rowDrag.id) return;
    if (e.clientY < 90) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
    const box = rowDrag.row.parentElement;
    const over = [...box.children].find((r) => {
      if (r === rowDrag.row) return false;
      const b = r.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    if (!over) return;
    const b = over.getBoundingClientRect();
    const before = e.clientY < b.top + b.height / 2;
    const target = before ? over : over.nextElementSibling;
    if (target === rowDrag.row || target === rowDrag.row.nextElementSibling) return;
    rowDrag.moved = true;
    slide(box, () => box.insertBefore(rowDrag.row, target));
  });
  const endRowDrag = (e) => {
    if (!rowDrag || e.pointerId !== rowDrag.id) return;
    rowDrag.row.classList.remove("dragging");
    if (rowDrag.moved) rowsToDraft();
    rowDrag = null;
  };
  root.addEventListener("pointerup", endRowDrag);
  root.addEventListener("pointercancel", endRowDrag);

  /* ---------------- Customize: move, size and hide the boxes of every section ---------------- */

  // the boxes: the dashboard's (data-box) or each section's cards (named after their title)
  const WIDE = { hero: 3, tiles: 3, months: 3, season: 2, "lt-offer": 3 };
  const slug = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const gridOf = () => body.querySelector(".ad-dash, .ad-grid");
  function boxesOf(grid) {
    return [...(grid ? grid.children : [])].filter((el) => {
      if (!el.dataset.box) {
        const label = el.querySelector(":scope > .xr-label");
        if (!label) return false;
        el.dataset.box = slug(label.textContent);
      }
      return true;
    });
  }
  const layouts = () => Object.assign({}, (Store.getProfile() || {}).adminLayout || {});
  const layoutOf = (k) => Object.assign({ order: [], size: {}, hidden: [] }, layouts()[k] || {});
  function saveLayout(k, l) {
    const all = layouts();
    if (l) all[k] = l;
    else delete all[k];
    Store.setProfile({ adminLayout: all });
  }
  // masonry: each box sits right under the one above it in its column (no gap under a short box
  // beside a tall one). The grid's rows are 1px; each box spans its own height (+ the gap), and
  // is measured again whenever its size changes (a textarea grows, members load…)
  const GAP = 16;
  const oneColumn = () => window.matchMedia("(max-width: 900px)").matches;
  function pack(grid) {
    if (!grid || !grid.classList.contains("ad-grid")) return;
    const on = !oneColumn();
    grid.classList.toggle("ad-packed", on);
    const gap = grid.classList.contains("ad-editing") ? GAP + 18 : GAP;
    boxesOf(grid).forEach((b) => (b.style.gridRowEnd = on ? `span ${Math.max(1, Math.ceil(b.offsetHeight + gap))}` : ""));
  }
  const packWatch = window.ResizeObserver ? new ResizeObserver((entries) => new Set(entries.map((e) => e.target.parentElement)).forEach(pack)) : null;
  window.addEventListener("resize", () => pack(gridOf()));

  // the saved layout onto the drawn section
  function applyLayout(k) {
    const grid = gridOf();
    if (!grid) return;
    const l = layoutOf(k);
    const boxes = boxesOf(grid);
    const ids = boxes.map((b) => b.dataset.box);
    const at = (id) => {
      const i = l.order.indexOf(id);
      if (i >= 0) return i;
      // (right after the nearest box before it that the saved layout has)
      const j = ids.indexOf(id);
      for (let k = j - 1; k >= 0; k--) if (l.order.includes(ids[k])) return l.order.indexOf(ids[k]) + 0.5 + j / 1000;
      return -1 + j / 1000;
    };
    boxes
      .slice()
      .sort((a, b) => at(a.dataset.box) - at(b.dataset.box))
      .forEach((b) => grid.append(b));
    boxes.forEach((b) => {
      b.dataset.size = l.size[b.dataset.box] || WIDE[b.dataset.box] || 1;
      b.classList.toggle("ad-box-hidden", l.hidden.includes(b.dataset.box));
      if (packWatch) packWatch.observe(b);
    });
    if (editing) dress(grid);
    pack(grid);
  }
  // the layout as it is on the page now
  function readLayout(grid) {
    const boxes = boxesOf(grid);
    return {
      order: boxes.map((b) => b.dataset.box),
      size: Object.fromEntries(boxes.map((b) => [b.dataset.box, Number(b.dataset.size) || 1])),
      hidden: boxes.filter((b) => b.classList.contains("ad-box-hidden")).map((b) => b.dataset.box),
    };
  }

  let editing = false;
  // edit mode: a veil over each box (it's what you drag; the box's own buttons and fields rest),
  // with its size and eye on top
  function dress(grid) {
    grid.classList.add("ad-editing");
    boxesOf(grid).forEach((b) => {
      if (b.querySelector(":scope > .ad-veil")) return;
      const veil = document.createElement("div");
      veil.className = "ad-veil";
      veil.innerHTML = `<span class="ad-grip"><i class="fa-solid fa-grip-vertical"></i></span>
        <span class="ad-veil-tools">
          <span class="ad-sizes" role="group" aria-label="Size">${[1, 2, 3].map((n) => `<button type="button" data-size-to="${n}" title="${["One column", "Two columns", "The whole row"][n - 1]}">${n === 3 ? "Full" : n}</button>`).join("")}</span>
          <button type="button" class="ad-eye" title="Hide / show"><i class="fa-solid fa-eye"></i></button>
        </span>`;
      b.append(veil);
    });
    paintVeils(grid);
  }
  function paintVeils(grid) {
    boxesOf(grid).forEach((b) => {
      b.querySelectorAll("[data-size-to]").forEach((x) => x.classList.toggle("on", x.dataset.sizeTo === String(b.dataset.size)));
      const eye = b.querySelector(".ad-eye i");
      if (eye) eye.className = `fa-solid ${b.classList.contains("ad-box-hidden") ? "fa-eye-slash" : "fa-eye"}`;
    });
  }
  function setEditing(on) {
    editing = on;
    root.querySelector(".ad-edit-bar").hidden = !on;
    const btn = root.querySelector(".ad-customize");
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
    if (on) {
      const grid = gridOf();
      if (grid) dress(grid), pack(grid);
    } else show(section);
  }

  // the boxes slide to their new places (each one from where it was)
  function flip(grid, change) {
    const boxes = boxesOf(grid);
    const before = new Map(boxes.map((b) => [b, b.getBoundingClientRect()]));
    change();
    boxes.forEach((b) => {
      if (b.classList.contains("ad-dragging")) return;
      const a = before.get(b);
      const n = b.getBoundingClientRect();
      const dx = a.left - n.left;
      const dy = a.top - n.top;
      if (!dx && !dy) return;
      b.style.transition = "none";
      b.style.transform = `translate(${dx}px, ${dy}px)`;
      void b.offsetWidth;
      b.style.transition = "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)";
      b.style.transform = "";
    });
  }

  // dragging: the box goes where the pointer is (before or after the box under it). A mouse
  // drags straight away; a finger holds the box a moment first (a swipe still scrolls the page)
  let drag = null;
  root.addEventListener("pointerdown", (e) => {
    const veil = e.target.closest(".ad-veil");
    if (!veil || e.target.closest("button") || e.button > 0) return;
    const box = veil.parentElement;
    const touch = e.pointerType === "touch";
    if (!touch) e.preventDefault();
    drag = { box, grid: box.parentElement, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, armed: !touch };
    if (touch)
      drag.timer = setTimeout(() => {
        if (!drag || drag.box !== box) return;
        drag.armed = true;
        drag.moved = true;
        box.classList.add("ad-dragging");
        if (navigator.vibrate) navigator.vibrate(12);
        try {
          veil.setPointerCapture(e.pointerId);
        } catch (err) {}
      }, 300);
    else
      try {
        veil.setPointerCapture(e.pointerId);
      } catch (err) {}
  });
  // (while a finger drags a box, the page doesn't scroll under it)
  document.addEventListener("touchmove", (e) => drag && drag.armed && e.cancelable && e.preventDefault(), { passive: false });
  root.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.armed) {
      // a finger that moves before the hold: it's scrolling, not dragging
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
        clearTimeout(drag.timer);
        drag = null;
      }
      return;
    }
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.box.classList.add("ad-dragging");
    }
    // near the top or the bottom of the window: the page scrolls along
    if (e.clientY < 90) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    const over = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((el) => el.closest && el.closest("[data-box]"))
      .find((b) => b && b !== drag.box && b.parentElement === drag.grid);
    if (!over) return;
    const r = over.getBoundingClientRect();
    // (a box the width of the row: its top half is before it, its bottom half after; a smaller
    // one: its top-left half before, its bottom-right half after)
    const full = r.width > drag.grid.getBoundingClientRect().width * 0.7;
    const before = full ? e.clientY < r.top + r.height / 2 : (e.clientX - r.left) / r.width + (e.clientY - r.top) / r.height < 1;
    const next = before ? over : over.nextElementSibling;
    if (next === drag.box || (before && over.previousElementSibling === drag.box) || (!before && over.nextElementSibling === drag.box)) return;
    flip(drag.grid, () => (drag.grid.insertBefore(drag.box, before ? over : over.nextElementSibling), pack(drag.grid)));
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    clearTimeout(drag.timer);
    drag.box.classList.remove("ad-dragging");
    if (drag.moved) saveLayout(section, readLayout(drag.grid));
    drag = null;
  };
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  function show(k) {
    section = k;
    root.querySelectorAll("[data-sec]").forEach((a) => a.classList.toggle("on", a.dataset.sec === k));
    body.innerHTML = render[k]();
    body.classList.remove("ad-in");
    void body.offsetWidth;
    body.classList.add("ad-in");
    if (k === "users") members(root.querySelector(".ad-members"), true);
    if (k === "apis") omdbMeter();
    applyLayout(k);
    if (k === "overview") dashboard(), paintOverview();
    if (k === "tools") storage(root.querySelector(".ad-storage"));
    root.querySelector(".ad-crumb").textContent = sec(k)[2];
    paintBadges();
    paintState();
    paintBar();
  }

  // today's OMDb lookups: used / the day's budget, what's left, when it starts again
  function omdbMeter() {
    const box = root.querySelector(".ad-omdb");
    if (!box || !window.Ratings) return;
    const s = Ratings.status();
    if (!s.enabled) {
      box.innerHTML = `<p class="sv-note">${s.keyRejected ? "OMDb rejected the key in js/config.js." : "No OMDb key in js/config.js: cards show the TMDB score instead of IMDb."}</p>`;
      return;
    }
    const pct = Math.min(100, Math.round((s.used / s.limit) * 100));
    const full = s.blocked || s.used >= s.limit;
    const now = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    box.innerHTML = `<div class="sv-meter-top"><span class="sv-meter-num"><b>${s.used}</b> / ${s.limit}</span><span class="sv-meter-label">lookups today on this device</span>
        <span class="sv-meter-pct ${full ? "full" : pct >= 75 ? "high" : ""}">${full ? "Limit reached" : `${pct}%`}</span></div>
      <div class="sv-meter-bar ${full ? "full" : pct >= 75 ? "high" : ""}"><i style="width:${pct}%"></i></div>
      <div class="sv-meter-facts"><span><i class="fa-solid fa-gauge-high"></i> <b>${Math.max(0, s.limit - s.used)}</b> left today</span><span><i class="fa-solid fa-clock-rotate-left"></i> resets at <b>${reset}</b></span><span><i class="fa-solid fa-database"></i> <b>${s.cached}</b> ratings saved</span></div>`;
  }

  // TMDB: a key for this browser only (the site's own is in js/config.js)
  function tmdbKey(action) {
    const input = root.querySelector(".ad-tmdb-key");
    const value = input ? input.value.trim() : "";
    try {
      if (action === "clear") {
        localStorage.removeItem(Store.KEYS.tmdbKey);
        TMDB.clearCache();
      } else localStorage.setItem(Store.KEYS.tmdbKey, value);
    } catch (e) {
      return toast("Couldn't save the key in this browser");
    }
    if (action === "test")
      return TMDB.test().then(
        () => toast("✔ TMDB key works"),
        (e) => toast(`✖ ${e.message}`)
      );
    toast(action === "clear" ? "This browser's key removed" : value ? "TMDB key saved for this browser" : "TMDB key removed");
    show("apis");
  }

  async function members(box, full) {
    if (!box) return;
    try {
      const list = await Cloud.members();
      box.innerHTML = full
        ? list
            .map(
              (m) => `<div class="sv-row"><img class="ad-face" src="${esc(/^https:\/\//.test(m.photo || "") ? m.photo : "images/placeholders/user.svg")}" alt="" referrerpolicy="no-referrer" />
              <span class="sv-name"><strong>${esc(m.name)}${m.me ? " (you)" : ""}</strong><small>${m.titles} titles · ${m.rated} rated · ${m.watchlist} on Watchlist · synced ${ago(m.updatedAt)}</small></span></div>`
            )
            .join("") || '<p class="sv-note">Nobody yet.</p>'
        : `<div class="ad-stats"><span><b>${list.length}</b><small>members</small></span><span><b>${list.filter((m) => Date.now() - m.updatedAt < 7 * 86400000).length}</b><small>active this week</small></span></div>`;
    } catch (e) {
      box.innerHTML = `<p class="sv-note">Couldn't load the members: ${esc(e.message)}</p>`;
    }
  }

  /* ---------------- reading the fields ---------------- */

  root.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.dataset.k || el.type === "checkbox") return;
    let v = el.value;
    if (el.dataset.num !== undefined) v = Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 1e9, Number(v) || 0));
    if (el.type === "color") v = v.toLowerCase() === "#b92222" ? "" : v;
    setPath(el.dataset.k, el.tagName === "TEXTAREA" || el.type === "text" || !el.type ? String(v).slice(0, 1000) : v);
  });
  root.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.k && el.type === "checkbox") return setPath(el.dataset.k, el.checked);
    if (el.dataset.k && el.tagName === "SELECT") return setPath(el.dataset.k, el.value);
    if (el.dataset.navPage) {
      const hidden = new Set(draft.nav.hidden || []);
      el.checked ? hidden.delete(el.dataset.navPage) : hidden.add(el.dataset.navPage);
      return setPath("nav.hidden", [...hidden]);
    }
    if (el.dataset.newsSrc) {
      const hidden = new Set(draft.news.hiddenSources || []);
      el.checked ? hidden.delete(el.dataset.newsSrc) : hidden.add(el.dataset.newsSrc);
      return setPath("news.hiddenSources", [...hidden]);
    }
    if (el.dataset.seasonOff) {
      const off = new Set(draft.themes.seasonsOff || []);
      el.checked ? off.delete(el.dataset.seasonOff) : off.add(el.dataset.seasonOff);
      return setPath("themes.seasonsOff", SEASON_IDS.filter((id) => off.has(id)));
    }
    if (el.dataset.themeAvail) {
      const off = new Set(ListThemes.offOf(draft.themes));
      el.checked ? off.delete(el.dataset.themeAvail) : off.add(el.dataset.themeAvail);
      return setPath("themes.off", ListThemes.THEMES.map((t) => t.id).filter((id) => off.has(id)));
    }
    if (el.classList.contains("ad-import")) {
      const f = el.files[0];
      if (!f) return;
      f.text().then((t) => {
        try {
          const data = JSON.parse(t);
          if (!data || typeof data !== "object" || !data.settings) throw new Error("not a settings file");
          draft = Site.merge(clone(Site.DEFAULTS), data.settings);
          if (Array.isArray(data.blocked)) blocked = data.blocked.map(String).slice(0, 200);
          show(section);
          toast("Restored: check the sections, then Save changes");
        } catch (err) {
          toast("That file isn't a Movie Nights settings backup");
        }
      });
    }
  });

  /* ---------------- the searches in Content ---------------- */

  let searchTimer;
  root.addEventListener("input", (e) => {
    const box = e.target.closest(".ad-search");
    if (!box) return;
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    const out = box.querySelector(".ad-results");
    if (q.length < 2) return (out.innerHTML = "");
    searchTimer = setTimeout(async () => {
      out.innerHTML = '<p class="muted"><i class="fa-solid fa-spinner fa-spin"></i></p>';
      try {
        const kind = box.dataset.search;
        let rows = [];
        if (kind === "tmdb" || kind === "hide") {
          const r = await TMDB.searchSmart(q, "all", 1);
          rows = r.results.slice(0, 8).map((h) => ({
            label: `${h.title}${h.year ? ` (${h.year})` : ""}`,
            img: Store.poster(h.poster, "w92"),
            value: kind === "hide" ? { ref: `${h.mediaType}-${h.tmdbId}`, title: h.title } : { mediaType: h.mediaType, tmdbId: h.tmdbId, title: h.title, year: h.year, type: h.type, poster: h.poster, backdrop: h.backdrop || "", score: h.score, released: h.released || "" },
          }));
        } else if (kind === "anime") {
          const r = await Anime.list("search", { q });
          rows = r.list.slice(0, 8).map((c) => ({ label: `${c.title}${c.year ? ` (${c.year})` : ""}`, img: c.image, value: c }));
        } else {
          const r = await Books.search(q, 8);
          // (kept small: no description in the site's settings)
          rows = r.map((b) => ({ label: `${b.title}${b.authors[0] ? ` · ${b.authors[0]}` : ""}`, img: b.cover, value: { key: b.key, title: b.title, authors: b.authors.slice(0, 2), year: b.year, cover: b.cover, url: b.url } }));
        }
        out.innerHTML = rows.length
          ? rows.map((r, i) => `<button type="button" class="ad-result" data-pick="${i}"><img src="${esc(/^https?:/.test(r.img || "") || /^images\//.test(r.img || "") ? r.img : "images/placeholders/poster-placeholder.svg")}" alt="" loading="lazy" /><span>${esc(r.label)}</span><i class="fa-solid fa-plus"></i></button>`).join("")
          : '<p class="muted">Nothing found.</p>';
        out._rows = rows;
      } catch (err) {
        out.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
      }
    }, 350);
  });

  const findInput = root.querySelector(".ad-find input");
  findInput.addEventListener("input", () => find(findInput.value));
  findInput.addEventListener("focus", () => find(findInput.value));
  findInput.addEventListener("keydown", (e) => {
    const hits = root.querySelector(".ad-find-list")._hits || [];
    if (e.key === "Enter" && hits.length) {
      goTo(hits[0]);
      findInput.value = "";
      find("");
    }
    if (e.key === "Escape") {
      findInput.value = "";
      find("");
    }
  });
  document.addEventListener("click", (e) => !e.target.closest(".ad-find") && find(""));

  root.addEventListener("click", (e) => {
    const mv = e.target.closest(".tp-move");
    if (mv) {
      const row = mv.closest(".tp-row");
      const box = row.parentElement;
      const to = mv.dataset.move === "-1" ? row.previousElementSibling : row.nextElementSibling && row.nextElementSibling.nextElementSibling;
      if (mv.dataset.move === "-1" && !to) return;
      if (mv.dataset.move === "1" && !row.nextElementSibling) return;
      slide(box, () => box.insertBefore(row, to));
      return rowsToDraft();
    }
    const tpEye = e.target.closest(".tp-eye");
    if (tpEye) {
      const row = tpEye.closest(".tp-row");
      row.classList.toggle("off");
      tpEye.querySelector("i").className = `fa-solid ${row.classList.contains("off") ? "fa-eye-slash" : "fa-eye"}`;
      return rowsToDraft();
    }
    const tpReset = e.target.closest(".tp-reset");
    if (tpReset) {
      setPath(tpReset.dataset.path || "titlePage", { order: [], hidden: [] });
      return show(section);
    }
    if (e.target.closest(".ad-customize")) return setEditing(!editing);
    if (e.target.closest(".ad-customize-done")) return setEditing(false);
    if (e.target.closest(".ad-layout-reset")) {
      saveLayout(section, null);
      show(section);
      return toast("This page is back to how it comes");
    }
    const sz = e.target.closest("[data-size-to]");
    if (sz) {
      const box = sz.closest("[data-box]");
      flip(box.parentElement, () => ((box.dataset.size = sz.dataset.sizeTo), pack(box.parentElement)));
      saveLayout(section, readLayout(box.parentElement));
      return paintVeils(box.parentElement);
    }
    const eye = e.target.closest(".ad-eye");
    if (eye) {
      const box = eye.closest("[data-box]");
      box.classList.toggle("ad-box-hidden");
      pack(box.parentElement);
      saveLayout(section, readLayout(box.parentElement));
      return paintVeils(box.parentElement);
    }
    if (editing && e.target.closest(".ad-veil")) return; // (in Customize, a box's own buttons rest)
    const ss = e.target.closest("[data-season-set]");
    if (ss) return setPath("themes.season", ss.dataset.seasonSet);
    if (e.target.closest(".ad-save-now")) return save(root.querySelector(".ad-save"));
    const go = e.target.closest("[data-go]");
    if (go) {
      history.replaceState(null, "", `#${go.dataset.go}`);
      show(go.dataset.go);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (go.dataset.then === "checks") runChecks(root.querySelector(".ad-checks"));
      return;
    }
    if (e.target.closest(".ad-run-checks")) return runChecks(root.querySelector(".ad-checks"));
    if (e.target.closest(".ad-clear-api")) return Api.clear().then(() => (toast("Saved answers forgotten on this device"), storage(root.querySelector(".ad-storage"))));
    if (e.target.closest(".ad-clear-tmdb")) {
      TMDB.clearCache();
      toast("TMDB details forgotten on this device");
      return storage(root.querySelector(".ad-storage"));
    }
    if (e.target.closest(".ad-reset-counts")) {
      Api.resetStats();
      toast("Service counts reset");
      return paintBadges();
    }
    const rs = e.target.closest("[data-restore]");
    if (rs) {
      const h = changeLog()[Number(rs.dataset.restore)];
      if (!h) return;
      draft = Site.merge(clone(Site.DEFAULTS), clone(h.before || {}));
      if (Array.isArray(h.blocked)) blocked = h.blocked.slice();
      show(section);
      return toast("Put back as it was before that save: check, then Save changes");
    }
    if (e.target.closest(".ad-announce-send")) {
      const f = root.querySelector(".ad-announce");
      const v = (n) => f.querySelector(`[name="${n}"]`).value.trim();
      if (!v("title")) return toast("Give it a title first");
      const link = v("link");
      if (link && !/^(https:\/\/|[\w-]+\.html)/.test(link)) return toast("The link should start with https:// or be a page like news.html");
      UI.confirm({ icon: "fa-paper-plane", title: "Send it to everyone?", text: "It goes into every member's bell the next time they open the site.", ok: "Send" }).then((ok) => {
        if (!ok) return;
        setPath("announce", { id: Date.now().toString(36), title: v("title").slice(0, 120), text: v("text").slice(0, 400), link, at: Date.now() });
        save(root.querySelector(".ad-save"));
      });
      return;
    }
    if (e.target.closest(".ad-unannounce")) {
      setPath("announce", null);
      save(root.querySelector(".ad-save"));
      return;
    }
    const hit = e.target.closest("[data-find]");
    if (hit) {
      goTo(root.querySelector(".ad-find-list")._hits[Number(hit.dataset.find)]);
      findInput.value = "";
      find("");
      return;
    }
    const nav = e.target.closest("[data-sec]");
    if (nav) {
      e.preventDefault();
      history.replaceState(null, "", `#${nav.dataset.sec}`);
      show(nav.dataset.sec);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      const box = pick.closest(".ad-search");
      const row = box.querySelector(".ad-results")._rows[Number(pick.dataset.pick)];
      const path = { tmdb: "home.featured", anime: "anime.featured", books: "home.featuredBooks", hide: "content.hidden" }[box.dataset.search];
      const list = (getPath(path) || []).slice();
      const key = (v) => v.ref || v.key || (v.tmdbId ? `${v.mediaType}-${v.tmdbId}` : v.title);
      if (!list.some((x) => key(x) === key(row.value))) list.push(row.value);
      setPath(path, list.slice(0, 30));
      show(section);
      return;
    }
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      const list = (getPath(rm.dataset.rm) || []).slice();
      list.splice(Number(rm.dataset.i), 1);
      setPath(rm.dataset.rm, list);
      show(section);
      return;
    }
    if (e.target.closest(".ad-reset-accent")) {
      setPath("branding.accent", "");
      show(section);
      return;
    }
    if (e.target.closest(".ad-pin-add")) {
      const f = e.target.closest(".ad-pin");
      const v = (n) => f.querySelector(`[name="${n}"]`).value.trim();
      if (!v("title") || !/^https?:\/\//.test(v("link"))) return toast("A headline and the story's address (https://…) are needed");
      const list = (draft.news.featured || []).slice();
      list.unshift({ title: v("title"), link: v("link"), source: v("source") || "Movie Nights", image: /^https:\/\//.test(v("image")) ? v("image") : "", excerpt: v("excerpt"), at: Date.now() });
      setPath("news.featured", list.slice(0, 10));
      show(section);
      return;
    }
    if (e.target.closest(".ad-key-save")) return tmdbKey("save");
    if (e.target.closest(".ad-key-test")) return tmdbKey("test");
    if (e.target.closest(".ad-key-clear")) return tmdbKey("clear");
    const test = e.target.closest("[data-api-test]");
    if (test) return testApi(test.dataset.apiTest, test);
    const clear = e.target.closest("[data-api-clear]");
    if (clear) {
      Api.clear(clear.dataset.apiClear).then(() => toast("Its saved answers are cleared"));
      return;
    }
    if (e.target.closest(".ad-reset-stats")) {
      Api.resetStats();
      show(section);
      return;
    }
    if (e.target.closest(".ad-block")) {
      const input = root.querySelector(".ad-block-email");
      const email = input.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("That doesn't look like an email address");
      const me = (Cloud.account() || {}).email;
      if (me && email === me.toLowerCase()) return toast("That's you");
      if (!blocked.includes(email)) blocked.push(email);
      paintBar();
      show(section);
      return;
    }
    const ub = e.target.closest("[data-unblock]");
    if (ub) {
      blocked.splice(Number(ub.dataset.unblock), 1);
      paintBar();
      show(section);
      return;
    }
    if (e.target.closest(".ad-copy-rules")) {
      navigator.clipboard.writeText(root.querySelector(".ad-pre").textContent).then(() => toast("Copied"), () => toast("Couldn't copy: select the text instead"));
      return;
    }
    if (e.target.closest(".ad-export")) {
      UI.download(`movie-nights-settings-${Store.today()}.json`, JSON.stringify({ app: "movie-nights-settings", v: 1, at: Date.now(), settings: draft, blocked }, null, 2), "application/json");
      return;
    }
    if (e.target.closest(".ad-defaults")) {
      UI.confirm({ icon: "fa-rotate-left", title: "Back to the defaults?", text: "Every setting here goes back to how the site comes. Nothing is saved until you press Save changes.", ok: "Use the defaults", danger: true }).then((ok) => {
        if (!ok) return;
        draft = clone(Site.DEFAULTS);
        show(section);
      });
      return;
    }
    if (e.target.closest(".ad-discard")) {
      draft = clone(Site.get());
      blocked = Site.blocked().slice();
      show(section);
      toast("Changes dropped");
      return;
    }
    if (e.target.closest(".ad-save")) save(e.target.closest(".ad-save"));
  });

  async function save(btn) {
    btn.disabled = true;
    const [before, blockedBefore] = JSON.parse(saved);
    try {
      const where = await Site.save(draft, blocked);
      remember(before, blockedBefore);
      saved = JSON.stringify([draft, blocked]);
      if (section === "notifications" || section === "tools") show(section);
      paintBar();
      paintOverview();
      paintState();
      toast(where === "live" ? "Saved: everyone gets the new settings" : "Saved on this device only: publish the rules (Users) to reach everyone");
    } catch (e) {
      toast(`Couldn't save: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  // Test: one small question to the service, the answer's time
  async function testApi(k, btn) {
    btn.disabled = true;
    const t0 = performance.now();
    try {
      if (k === "tvmaze") await Api.get("tvmaze", "https://api.tvmaze.com/shows/1", { fresh: true });
      else if (k === "anilist")
        await Api.get("anilist", "https://graphql.anilist.co", { fresh: true, key: "test", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ Media(id: 1) { id } }" }) } });
      else if (k === "openlibrary") await Api.get("openlibrary", "https://openlibrary.org/search.json?q=dune&limit=1&fields=key", { fresh: true, key: "test" });
      else if (k === "news") await Api.get("news", `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(News.FEEDS[0].url)}`, { fresh: true });
      toast(`${API_NAMES[k][0]} answered in ${Math.round(performance.now() - t0)} ms`);
    } catch (e) {
      toast(`${API_NAMES[k][0]}: ${e.message}`);
    } finally {
      btn.disabled = false;
      if (section === "apis") show("apis");
    }
  }

  // leaving with unsaved changes: the browser asks first
  window.addEventListener("beforeunload", (e) => {
    if (!dirty()) return;
    e.preventDefault();
    e.returnValue = "";
  });
  window.addEventListener("hashchange", () => {
    const k = location.hash.slice(1);
    if (SECTIONS.some((s) => s[0] === k) && k !== section) show(k);
  });

  show(section);
  // the latest from the account (another device may have saved)
  Site.refresh(true).then(() => {
    if (dirty()) return;
    draft = clone(Site.get());
    blocked = Site.blocked().slice();
    saved = JSON.stringify([draft, blocked]);
    show(section);
  });
})();
