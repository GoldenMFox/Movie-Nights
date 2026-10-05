/*
 * Admin Control Center (admin.html): everything the owner can set for the whole site, without
 * touching the code. Only the owner gets in (the account's rules decide who that is: Cloud.isOwner).
 *
 * The settings live in js/core/site.js (Site): one document for everyone, read by every page.
 * Here a working copy is changed; "Save changes" sends it (or "Discard" drops it). If the account
 * doesn't take site settings yet (its rules need the site/config part, shown under Users), the
 * copy is kept on this device and used here until the rules are published.
 *
 * Sections: Overview · Website · Pages & features · Content · News · API integrations · Themes ·
 * Notifications · Users · Backup
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("admin");
  const SECTIONS = [
    ["overview", "fa-gauge", "Overview"],
    ["website", "fa-globe", "Website"],
    ["pages", "fa-toggle-on", "Pages & features"],
    ["content", "fa-star", "Content"],
    ["news", "fa-newspaper", "News"],
    ["apis", "fa-plug", "API integrations"],
    ["themes", "fa-palette", "Themes"],
    ["notifications", "fa-bell", "Notifications"],
    ["users", "fa-users", "Users"],
    ["backup", "fa-floppy-disk", "Backup"],
  ];
  const PAGE_NAMES = [
    ["home", "Home"], ["discover", "Discover"], ["movie", "Movies"], ["tv", "TV Shows"], ["anime", "Anime"], ["watchlist", "Watchlist"],
    ["tiers", "Tier List"], ["boxoffice", "Box Office"], ["news", "News"], ["animeExplore", "Explore anime (phones' Library tab, footer)"],
  ];
  const FEATURES = [
    ["picker", "What should I watch?", "The shuffle button in the navbar"],
    ["trivia", "Movie trivia", "10 questions on title pages"],
    ["soundtrack", "Soundtracks", "Apple Music previews on title pages"],
    ["xray", "X-Ray", "Behind-the-scenes facts on title pages"],
    ["tvmaze", "Episodes & air times", "TVmaze's episode guide on show pages"],
    ["animeDetails", "Anime details", "The MyAnimeList card on anime title pages"],
    ["animeExplore", "Anime explorer", "anime-explore.html"],
    ["books", "Books", "Based on, related novels, further reading"],
    ["news", "Movie News", "news.html"],
    ["boxOffice", "Box Office", "box-office.html"],
    ["listThemes", "List themes", "Halloween, Christmas… on your own lists"],
    ["notifications", "Notifications", "Release alerts and the red number"],
    ["share", "Sharing", "The share sheet on title pages"],
  ];
  const API_NAMES = {
    tvmaze: ["TVmaze", "Show schedules, episodes, networks", "hours"],
    jikan: ["Jikan (MyAnimeList)", "Anime: first choice", "hours"],
    anilist: ["AniList", "Anime: stands in when Jikan can't be reached", "hours"],
    openlibrary: ["Open Library", "Books", "days"],
    googlebooks: ["Google Books", "Book descriptions (needs a key)", "days"],
    news: ["News feeds (rss2json)", "Movie News", "minutes"],
  };

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
  }

  let section = (location.hash || "").slice(1);
  if (!SECTIONS.some((s) => s[0] === section)) section = "overview";

  root.innerHTML = `
    <div class="ad-head">
      <div><h1 class="page-title"><i class="fa-solid fa-sliders"></i> Admin Control Center</h1><p class="page-sub">The whole site's settings. Changes reach everyone when you save.</p></div>
      <span class="ad-state"></span>
    </div>
    <div class="ad-layout">
      <nav class="ad-nav" aria-label="Sections">${SECTIONS.map(([k, icon, l]) => `<a href="#${k}" data-sec="${k}"><i class="fa-solid ${icon}"></i><span>${l}</span></a>`).join("")}</nav>
      <div class="ad-body"></div>
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

  /* ---------------- the sections ---------------- */

  const render = {
    overview() {
      const st = Api.status();
      const health = Object.entries(st)
        .map(([k, s]) => `<span class="ad-health ${s.health}" title="${esc(s.lastError || "")}"><i></i>${esc(s.label)}</span>`)
        .join("");
      const items = Store.all();
      return `<div class="ad-grid">
        ${card("fa-heart-pulse", "Site status", `<div class="ad-big">${{ live: "Live", default: "Defaults", unpublished: "This device only" }[Site.state()] || "–"}</div>
          ${sw("maintenance.on", "Maintenance mode", "Visitors see a “back soon” screen; you still see the site", draft.maintenance.on)}
          ${sw("notice.on", "Notice across the top", draft.notice.text ? esc(draft.notice.text) : "Write it under Website", draft.notice.on)}`)}
        ${card("fa-plug", "Outside services", `<div class="ad-healths">${health}</div><a class="t-link" href="#apis" data-sec="apis">Details <i class="fa-solid fa-chevron-right"></i></a>`)}
        ${card("fa-film", "Your library", `<div class="ad-stats"><span><b>${items.length}</b><small>titles</small></span><span><b>${Store.lists().length}</b><small>lists</small></span><span><b>${window.Alerts ? Alerts.unread().length : 0}</b><small>new alerts</small></span></div>`)}
        ${card("fa-users", "Members", '<div class="ad-members-mini">Loading…</div><a class="t-link" href="#users" data-sec="users">Manage <i class="fa-solid fa-chevron-right"></i></a>')}
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
          ${select("notice.tone", "Look", draft.notice.tone, [["info", "News (red bullhorn)"], ["warn", "Warning (amber)"]])}`)}
        ${card("fa-circle-half-stroke", "Appearance", `${select("themes.siteDefault", "Theme for new visitors", draft.themes.siteDefault, [["dark", "Dark"], ["light", "Light"]])}`, "People who pick a theme themselves keep theirs.")}
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
        ${card("fa-compass", "Discover", `${num("discover.phoneFirst", "Titles at first, phones", draft.discover.phoneFirst, 10, 40)}${num("discover.desktopFirst", "Titles at first, computers", draft.discover.desktopFirst, 20, 60)}`, "Before “Load more”. Posters load as they come near the screen.")}
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
      return `<div class="ad-grid">${Object.entries(API_NAMES)
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
            ${k === "googlebooks" ? text("apis.googlebooks.key", "API key (optional)", a.key, 'placeholder="AIza…" autocomplete="off"') + '<p class="sv-note">Visible to visitors like any key on a website: restrict it to this site\'s address in Google Cloud (HTTP referrers) and to the Books API.</p>' : ""}
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
      const avail = draft.themes.available || [];
      return `<div class="ad-grid">
        ${card("fa-wand-magic-sparkles", "List themes", `${sw("themes.listThemes", "Themes on people's lists", "Off: every list in the site's own look", draft.themes.listThemes !== false)}
          ${sw("themes.animations", "Animated atmosphere", "Snow, petals, embers… Off: the tints stay, nothing moves", draft.themes.animations !== false)}`)}
        ${card("fa-swatchbook", "Themes on offer", ListThemes.THEMES.map((t) => `<div class="sv-row"><span class="sv-name"><strong>${t.emoji} ${esc(t.label)}</strong><small>${esc(t.hint)}</small></span>
          <label class="sv-switch"><input type="checkbox" data-theme-avail="${t.id}"${avail.includes(t.id) ? " checked" : ""} aria-label="${esc(t.label)}" /><span class="switch-track"><span class="switch-thumb"></span></span></label></div>`).join(""))}
        ${card("fa-circle-half-stroke", "Site theme", select("themes.siteDefault", "Theme for new visitors", draft.themes.siteDefault, [["dark", "Dark"], ["light", "Light"]]))}
      </div>`;
    },
    notifications() {
      return `<div class="ad-grid">
        ${card("fa-bell", "Release alerts", `${sw("notifications.on", "Alerts and notifications", "The red number on Watchlist, New for you, and notifications for those who turn them on", draft.notifications.on !== false)}
          ${sw("notifications.release", "Movie releases", "", draft.notifications.release !== false)}
          ${sw("notifications.season", "New seasons", "", draft.notifications.season !== false)}
          ${sw("notifications.episode", "New episodes", "", draft.notifications.episode !== false)}`,
          "Each person turns notifications on for their own devices in Settings → Notifications, and picks the kinds they want.")}
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

  function show(k) {
    section = k;
    root.querySelectorAll("[data-sec]").forEach((a) => a.classList.toggle("on", a.dataset.sec === k));
    body.innerHTML = render[k]();
    body.classList.remove("ad-in");
    void body.offsetWidth;
    body.classList.add("ad-in");
    if (k === "users") members(root.querySelector(".ad-members"), true);
    if (k === "overview") members(root.querySelector(".ad-members-mini"), false);
    paintState();
    paintBar();
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
    if (el.dataset.themeAvail) {
      const on = new Set(draft.themes.available || []);
      el.checked ? on.add(el.dataset.themeAvail) : on.delete(el.dataset.themeAvail);
      return setPath("themes.available", ListThemes.THEMES.map((t) => t.id).filter((id) => on.has(id)));
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
          const r = await Books.search({ q }, 8);
          rows = r.map((b) => ({ label: `${b.title}${b.authors[0] ? ` · ${b.authors[0]}` : ""}`, img: b.cover, value: b }));
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

  root.addEventListener("click", (e) => {
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
    try {
      const where = await Site.save(draft, blocked);
      saved = JSON.stringify([draft, blocked]);
      paintBar();
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
      else if (k === "jikan") await Api.get("jikan", "https://api.jikan.moe/v4/anime/1", { fresh: true });
      else if (k === "anilist")
        await Api.get("anilist", "https://graphql.anilist.co", { fresh: true, key: "test", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ Media(id: 1) { id } }" }) } });
      else if (k === "openlibrary") await Api.get("openlibrary", "https://openlibrary.org/search.json?q=dune&limit=1&fields=key", { fresh: true });
      else if (k === "googlebooks") {
        const key = (draft.apis.googlebooks || {}).key;
        await Api.get("googlebooks", `https://www.googleapis.com/books/v1/volumes?q=dune&maxResults=1${key ? `&key=${encodeURIComponent(key)}` : ""}`, { fresh: true, key: "test" });
      } else if (k === "news") await Api.get("news", `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(News.FEEDS[0].url)}`, { fresh: true });
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
