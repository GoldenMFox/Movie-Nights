/*
 * Movie News (news.html): what matters in film and TV right now (js/services/news.js does the
 * sources, the grouping of the same story, the scores and Breaking).
 *
 * The page, by kind of news rather than by source:
 *  - a header with a "Live" light, the search and Refresh; a ticker of the newest headlines
 *  - chips: Latest (the front page), Breaking, Movies, TV, Trailers, Casting, Production, Release
 *    dates, Box Office, Awards, Industry
 *  - the front page: Breaking (when there is: red, up top), the top story big beside a Latest
 *    column, then a few stories of each kind with "See all"
 *  - a kind: its stories, top first or newest first, by day, 18 at a time
 *  - a story told by several outlets shows once, by its best source, "also reported by" the rest;
 *    one about a title in your library says so and links to it
 *  - News preferences (per device): Recommended (the best sources first, the supplementary ones
 *    kept to about a quarter), All sources, or My sources (the ones you tick)
 * The chip, the search and the order are in the address (?cat=trailers&q=dune&sort=new).
 *
 * Fast: the last news this browser saw shows the moment the page opens, then the fresh stories
 * come in feed by feed as each one answers (all of them asked at once).
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("news");
  const params = new URLSearchParams(location.search);
  const PAGE = 18;
  const PREFS = "mn:newsPrefs"; // this device: { mode: "recommended" | "all" | "mine", mine: [source keys] }
  let state = { cat: params.get("cat") || "latest", q: params.get("q") || "", sort: params.get("sort") === "new" ? "new" : "top" };
  let all = []; // the stories in hand (grouped, scored)
  let shown = PAGE;
  let loadedAt = 0;
  const prefs = () => Object.assign({ mode: "recommended", mine: null }, Store.read(PREFS, {}) || {});
  const setPrefs = (p) => Store.write(PREFS, Object.assign(prefs(), p));

  if (window.Site && !Site.feature("news")) {
    root.innerHTML = '<div class="empty-state"><i class="fa-solid fa-ban"></i><p>Movie News is switched off for now.</p></div>';
    return;
  }

  const ago = (t) => {
    if (!t) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
    return new Date(t).toLocaleDateString([], { day: "numeric", month: "short" });
  };
  const newsCfg = () => (window.Site && Site.get().news) || {};
  const catsOff = () => newsCfg().catsOff || [];
  const CATS = () => News.CATEGORIES.filter((c) => !catsOff().includes(c[0]));
  const catOf = (k) => News.CATEGORIES.find((c) => c[0] === k);
  const mainCat = (s) => (s.cats || []).find((k) => !catsOff().includes(k)) || "";
  const catIcon = (s) => {
    const c = catOf(mainCat(s));
    return c ? c[2] : s.kind === "tv" ? "fa-tv" : s.kind === "industry" ? "fa-building" : "fa-film";
  };
  const catName = (s) => {
    const c = catOf(mainCat(s));
    return c ? c[1] : News.KIND_LABEL[s.kind] || "News";
  };

  // each source's mark and colour (a story without a picture is drawn in its source's colour)
  const SOURCE_LOOK = {
    variety: ["V", "#d9a93a"],
    thr: ["THR", "#d4243b"],
    slashfilm: ["/F", "#ff7a3d"],
    screenrant: ["SR", "#2fb8d6"],
    collider: ["C", "#4f7dff"],
  };
  const lookOf = (s) => {
    const key = typeof s === "string" ? s : s.sourceKey;
    if (SOURCE_LOOK[key]) return SOURCE_LOOK[key];
    const name = typeof s === "string" ? s : s.source || "?";
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return [String(name).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?", `hsl(${h} 70% 58%)`];
  };
  const mono = (s) => `<em class="nw-mono" style="--src:${lookOf(s)[1]}">${esc(lookOf(s)[0])}</em>`;
  const placeholder = (s) => `<span class="nw-ph" style="--src:${lookOf(s)[1]}"><b>${esc(lookOf(s)[0])}</b><i class="fa-solid ${catIcon(s)}"></i></span>`;
  // a picture, or the source's card when there's none (or it doesn't load)
  const picture = (s, eager) =>
    s.image ? `<img src="${esc(s.image)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer" />` : placeholder(s);

  const sites = () => [...new Set(News.feeds().map((f) => f.source))];
  const kindOn = (k) => !(k === "movies" && newsCfg().movies === false) && !(k === "tv" && newsCfg().tv === false);
  const CHIPS = () =>
    [
      ["latest", "Latest", "fa-newspaper"],
      ["breaking", "Breaking", "fa-bolt"],
      ["movies", "Movies", "fa-film"],
      ["tv", "TV", "fa-tv"],
    ]
      .filter(([k]) => kindOn(k))
      .concat(CATS().map(([k, l, i]) => [k, l, i]));

  root.innerHTML = `
    <header class="nw-hero">
      <div class="nw-hero-text">
        <span class="nw-live"><i></i> Live <span class="nw-updated">· getting the latest…</span></span>
        <h1 class="page-title">Movie News</h1>
        <p class="page-sub">What matters in film and TV right now, from Hollywood's trade press.</p>
      </div>
      <div class="nw-hero-tools">
        <form class="ax-search nw-search" role="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input class="input" name="q" type="search" placeholder="Search the news…" aria-label="Search the news" value="${esc(state.q)}" autocomplete="off" /></form>
        <button class="btn nw-refresh" type="button" title="Check for new stories"><i class="fa-solid fa-rotate"></i><span> Refresh</span></button>
      </div>
    </header>
    <div class="nw-ticker" hidden><span class="nw-ticker-label"><i class="fa-solid fa-bolt"></i> Just in</span><div class="nw-ticker-track"><div class="nw-ticker-run"></div></div></div>
    <div class="nw-bar">
      <div class="chips nw-chips" role="group" aria-label="Show">${CHIPS()
        .map(([k, l, i]) => `<button type="button" class="chip${k === "breaking" ? " nw-chip-breaking" : ""}${state.cat === k ? " active" : ""}" data-cat="${k}" aria-pressed="${state.cat === k}"><i class="fa-solid ${i}"></i> ${esc(l)}</button>`)
        .join("")}</div>
      <button type="button" class="btn nw-prefs-btn" aria-haspopup="dialog" title="News preferences"><i class="fa-solid fa-sliders"></i><span> Preferences</span></button>
    </div>
    <div class="nw-body">${skeleton()}</div>
    <p class="tmdb-note nw-note"></p>`;
  const body = root.querySelector(".nw-body");
  const note = root.querySelector(".nw-note");

  function skeleton() {
    return `<div class="nw-lead nw-wait"><div class="nw-skel nw-skel-big"></div><div class="nw-skel-col">${'<div class="nw-skel nw-skel-row"></div>'.repeat(5)}</div></div>
      <div class="nw-grid nw-wait">${'<div class="nw-skel"></div>'.repeat(6)}</div>`;
  }

  /* ---------------- which stories ---------------- */

  // the stories for your preferences (and the search)
  function visible() {
    const p = prefs();
    const q = state.q.trim().toLowerCase();
    return News.view(all, p.mode, p.mine).filter(
      (s) => kindOn(s.kind) && (!q || `${s.title} ${s.excerpt} ${s.source} ${(s.also || []).map((a) => a.source).join(" ")}`.toLowerCase().includes(q))
    );
  }
  const ofCat = (list, k) =>
    k === "breaking" ? list.filter((s) => s.breaking) : k === "movies" || k === "tv" ? list.filter((s) => s.kind === k) : list.filter((s) => (s.cats || []).includes(k));
  const byTime = (list) => list.slice().sort((a, b) => b.date - a.date);

  /* ---------------- the pieces ---------------- */

  // "also reported by": the other outlets' marks, and their stories a tap away
  const also = (s) =>
    (s.also || []).length
      ? `<details class="nw-also"><summary><span class="nw-also-marks">${[...new Map(s.also.map((a) => [a.sourceKey || a.source, a])).values()].map((a) => mono(a.sourceKey || a.source)).join("")}</span> Also reported by ${s.also.length} more</summary>
          <ul>${s.also.map((a) => `<li><a href="${esc(a.link)}" target="_blank" rel="noopener">${mono(a.sourceKey || a.source)}<span><b>${esc(a.source)}</b> ${esc(a.title)}</span></a></li>`).join("")}</ul></details>`
      : "";
  // a story about a title in your library: a way to it
  const mine = (s) =>
    s.about && s.about.id ? `<a class="nw-about" href="title.html?id=${encodeURIComponent(s.about.id)}"><i class="fa-solid fa-bookmark"></i> In your library: ${esc(s.about.title)}</a>` : "";
  const badge = (s) =>
    s.promoted
      ? '<span class="nw-badge nw-badge-pick"><i class="fa-solid fa-star"></i> Editor\'s pick</span>'
      : s.breaking
        ? '<span class="nw-badge nw-badge-breaking"><i class="fa-solid fa-bolt"></i> Breaking</span>'
        : s.pinned
          ? '<span class="nw-badge"><i class="fa-solid fa-thumbtack"></i> Pinned</span>'
          : `<span class="nw-badge"><i class="fa-solid ${catIcon(s)}"></i> ${esc(catName(s))}</span>`;

  const card = (s) => `<article class="nw-card${s.breaking ? " is-breaking" : ""}" style="--src:${lookOf(s)[1]}">
      <a class="nw-img" href="${esc(s.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${picture(s)}${badge(s)}</a>
      <div class="nw-text">
        <div class="nw-meta"><span class="nw-src">${mono(s)}<b>${esc(s.source)}</b></span><span class="nw-when">${esc(ago(s.date))}</span></div>
        <h3><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
        ${s.excerpt ? `<p>${esc(s.excerpt)}</p>` : ""}
        ${mine(s)}${also(s)}
        <div class="nw-actions"><a class="nw-more" href="${esc(s.link)}" target="_blank" rel="noopener">Read on ${esc(s.source)} <i class="fa-solid fa-arrow-right"></i></a>
        <button class="nw-share" type="button" data-share="${esc(s.link)}" data-feature="share" aria-label="Share this story" title="Share"><i class="fa-solid fa-arrow-up-from-bracket"></i></button></div>
      </div>
    </article>`;

  // a headline in a list: a small picture, the source and how long ago
  const row = (s) => `<a class="nw-row" href="${esc(s.link)}" target="_blank" rel="noopener" style="--src:${lookOf(s)[1]}">
      <span class="nw-row-img">${picture(s)}</span>
      <span class="nw-row-text"><small>${mono(s)}${esc(s.source)} · ${esc(ago(s.date))}${(s.also || []).length ? ` · +${s.also.length}` : ""}</small><strong>${esc(s.title)}</strong></span></a>`;

  // the big story: its picture filling the card, the words over it
  function feature(top) {
    const label = top.pinned
      ? '<i class="fa-solid fa-thumbtack"></i> Pinned'
      : top.breaking
        ? '<i class="fa-solid fa-bolt"></i> Breaking'
        : top.promoted
          ? '<i class="fa-solid fa-star"></i> Editor\'s pick'
          : '<i class="fa-solid fa-fire"></i> Top story';
    return `<article class="nw-feature${top.breaking ? " is-breaking" : ""}" style="--src:${lookOf(top)[1]}">
        <a class="nw-feature-img" href="${esc(top.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${picture(top, true)}</a>
        <div class="nw-feature-text">
          <div class="nw-meta"><span class="nw-latest">${label}</span><span class="nw-src">${mono(top)}<b>${esc(top.source)}</b></span><span class="nw-when">${esc(ago(top.date))}</span><span class="nw-tag"><i class="fa-solid ${catIcon(top)}"></i> ${esc(catName(top))}</span></div>
          <h2><a href="${esc(top.link)}" target="_blank" rel="noopener">${esc(top.title)}</a></h2>
          ${top.excerpt ? `<p>${esc(top.excerpt)}</p>` : ""}
          ${mine(top)}${also(top)}
          <div class="nw-actions"><a class="btn btn-primary nw-read" href="${esc(top.link)}" target="_blank" rel="noopener">Read the story <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          <button class="btn nw-share big" type="button" data-share="${esc(top.link)}" data-feature="share" aria-label="Share this story"><i class="fa-solid fa-arrow-up-from-bracket"></i> Share</button></div>
        </div>
      </article>`;
  }

  // the stories by day
  function byDay(list) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const t0 = start.getTime();
    const DAY = 86400000;
    const groups = [
      ["Today", (d) => d >= t0],
      ["Yesterday", (d) => d >= t0 - DAY],
      ["Earlier this week", (d) => d >= t0 - 6 * DAY],
      ["Older", () => true],
    ];
    const out = groups.map(([name]) => ({ name, items: [] }));
    list.forEach((s) => out[groups.findIndex(([, test]) => test(s.date || 0))].items.push(s));
    return out.filter((g) => g.items.length);
  }

  /* ---------------- drawing ---------------- */

  function render() {
    const list = visible();
    if (!list.length) {
      body.innerHTML = `<div class="empty-state"><i class="fa-regular fa-face-meh"></i><p>No stories match${state.q ? ` “${esc(state.q)}”` : ""} right now.</p><button class="btn nw-reset" type="button">Show all news</button></div>`;
      return;
    }
    body.innerHTML = state.cat === "latest" && !state.q ? front(list) : section(state.q ? list : ofCat(list, state.cat));
  }

  // the front page: Breaking, the top story and Latest, then a few of each kind
  function front(list) {
    const used = new Set();
    const pick = (arr, n) => {
      const out = [];
      for (const s of arr) {
        if (out.length >= n) break;
        if (used.has(s.link)) continue;
        used.add(s.link);
        out.push(s);
      }
      return out;
    };
    const pins = list.filter((s) => s.pinned);
    const breaking = pick(list.filter((s) => s.breaking), 3);
    const top = pick(pins.filter((s) => s.image).concat(list.filter((s) => s.image)), 1)[0] || pick(list, 1)[0];
    const latest = pick(byTime(list), 5);
    const SECTIONS = [
      ["movies", "Latest movie news", "fa-film", 6],
      ["tv", "TV", "fa-tv", 4],
    ]
      .filter(([k]) => kindOn(k))
      .concat(CATS().map(([k, l, i]) => [k, l, i, 4]));
    return `
      ${
        breaking.length
          ? `<section class="nw-breaking"><h3 class="nw-sec-title"><span><i class="fa-solid fa-bolt"></i> Breaking</span><button type="button" class="t-link" data-cat="breaking">See all <i class="fa-solid fa-chevron-right"></i></button></h3>
        <div class="nw-grid nw-breaking-list">${breaking.map(card).join("")}</div></section>`
          : ""
      }
      <section class="nw-lead">
        ${top ? feature(top) : ""}
        ${latest.length ? `<aside class="nw-side"><h3><i class="fa-solid fa-clock"></i> Latest</h3>${latest.map(row).join("")}</aside>` : ""}
      </section>
      ${SECTIONS.map(([k, name, icon, n]) => {
        const items = pick(ofCat(list, k), n);
        return items.length
          ? `<section class="nw-section"><h3 class="nw-sec-title"><span><i class="fa-solid ${icon}"></i> ${esc(name)}</span><button type="button" class="t-link" data-cat="${k}">See all <i class="fa-solid fa-chevron-right"></i></button></h3><div class="nw-grid">${items.map(card).join("")}</div></section>`
          : "";
      }).join("")}`;
  }

  // one kind (or a search): top first or newest first (by day), 18 at a time
  function section(items) {
    if (!items.length) return `<div class="empty-state"><i class="fa-regular fa-newspaper"></i><p>Nothing here right now.</p><button class="btn nw-reset" type="button">Back to the latest</button></div>`;
    const sorted = state.sort === "new" ? byTime(items) : items;
    const c = catOf(state.cat);
    const title = state.q ? `“${state.q}”` : state.cat === "breaking" ? "Breaking" : c ? c[1] : News.KIND_LABEL[state.cat] || "Latest";
    const head = `<div class="nw-sec-head"><h2>${esc(title)} <small>${items.length} ${items.length === 1 ? "story" : "stories"}</small></h2>
      <div class="top10-switch nw-sort" role="group" aria-label="Order"><button type="button" class="top10-tab${state.sort === "top" ? " active" : ""}" data-sort="top" aria-pressed="${state.sort === "top"}"><i class="fa-solid fa-fire"></i> Top</button><button type="button" class="top10-tab${state.sort === "new" ? " active" : ""}" data-sort="new" aria-pressed="${state.sort === "new"}"><i class="fa-solid fa-clock"></i> Newest</button></div></div>`;
    const page = sorted.slice(0, shown);
    const grid =
      state.sort === "new"
        ? byDay(page)
            .map((g) => `<h3 class="nw-day"><span>${esc(g.name)}</span><small>${g.items.length} ${g.items.length === 1 ? "story" : "stories"}</small></h3><div class="nw-grid">${g.items.map(card).join("")}</div>`)
            .join("")
        : `<div class="nw-grid">${page.map(card).join("")}</div>`;
    return `${head}${grid}${sorted.length > shown ? `<div class="load-more"><button class="btn nw-load" type="button">Show more (${sorted.length - shown} left)</button></div>` : ""}`;
  }

  // the ticker: the newest headlines, running (twice over, so it loops without a jump)
  function ticker() {
    const el = root.querySelector(".nw-ticker");
    const items = byTime(visible().filter((s) => !s.pinned)).slice(0, 12);
    el.hidden = items.length < 3;
    if (el.hidden) return;
    const run = items.map((s) => `<a href="${esc(s.link)}" target="_blank" rel="noopener"${s.breaking ? ' class="hot"' : ""}><b>${esc(s.source)}</b>${esc(s.title)}</a>`).join("");
    el.querySelector(".nw-ticker-run").innerHTML = run + run.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ');
    el.style.setProperty("--ticker-time", `${Math.max(40, items.length * 6)}s`);
  }

  function paintUpdated(partial) {
    root.querySelector(".nw-updated").textContent = partial ? "· getting the latest…" : `· updated ${ago(loadedAt)}`;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.cat !== "latest") p.set("cat", state.cat);
    if (state.q) p.set("q", state.q);
    if (state.sort === "new") p.set("sort", "new");
    history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
  }
  function set(patch) {
    Object.assign(state, patch);
    shown = PAGE;
    root.querySelectorAll(".nw-chips [data-cat]").forEach((b) => {
      b.classList.toggle("active", b.dataset.cat === state.cat);
      b.setAttribute("aria-pressed", b.dataset.cat === state.cat);
    });
    syncUrl();
    if (all.length) render();
  }

  /* ---------------- News preferences: the way you read it, your sources ---------------- */

  let prefsEl = null;
  function openPrefs() {
    if (!prefsEl) {
      prefsEl = document.createElement("div");
      prefsEl.className = "nw-prefs";
      root.append(prefsEl);
    }
    const p = prefs();
    const src = News.sources();
    const used = sites();
    const myList = p.mine || used;
    const opt = (v, icon, name, sub) =>
      `<button type="button" class="ad-opt${p.mode === v ? " on" : ""}" data-mode="${v}" aria-pressed="${p.mode === v}"><span class="ad-opt-icon"><i class="fa-solid ${icon}"></i></span><span class="ad-opt-text"><strong>${name}</strong><small>${sub}</small></span><i class="fa-solid fa-circle-check ad-opt-check"></i></button>`;
    const group = (tier) => {
      const keys = used.filter((k) => (src[k] || {}).tier === tier);
      return keys.length
        ? `<h4>${esc(News.TIERS[tier])}</h4>${keys
            .map((k) => {
              const kinds = [...new Set(News.feeds().filter((f) => f.source === k).map((f) => News.KIND_LABEL[f.kind]))].join(" · ");
              return `<label class="nw-src-row"><em class="nw-mono" style="--src:${lookOf(k)[1]}">${esc(lookOf(k)[0])}</em><span><b>${esc(src[k].name)}</b><small>${esc(kinds)}</small></span>
                <span class="sv-switch"><input type="checkbox" data-mysrc="${k}"${myList.includes(k) ? " checked" : ""} aria-label="${esc(src[k].name)}" /><span class="switch-track"><span class="switch-thumb"></span></span></span></label>`;
            })
            .join("")}`
        : "";
    };
    prefsEl.innerHTML = `<div class="nw-prefs-back"></div>
      <div class="nw-prefs-panel" role="dialog" aria-modal="true" aria-label="News preferences">
        <div class="nw-prefs-head"><h3><i class="fa-solid fa-sliders"></i> News preferences</h3><button type="button" class="nw-prefs-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="ad-opts nw-modes">${opt("recommended", "fa-star", "Recommended", "The best sources first")}${opt("all", "fa-layer-group", "All sources", "Everything, as it ranks")}${opt("mine", "fa-user-check", "My sources", "Only the ones you pick")}</div>
        <div class="nw-mysrc${p.mode === "mine" ? "" : " off"}"><p class="nw-prefs-note">${p.mode === "mine" ? "Your sources:" : "Switch one off to read only “My sources”:"}</p>${[1, 2, 3].map(group).join("")}</div>
      </div>`;
    prefsEl.classList.add("open");
  }
  const closePrefs = () => prefsEl && prefsEl.classList.remove("open");

  /* ---------------- getting the news ---------------- */

  // pinned stories (Admin → News): { title, link, source, image, excerpt }
  function pinned() {
    const list = newsCfg().featured || [];
    return list
      .filter((p) => p && /^https?:\/\//.test(p.link || "") && p.title)
      .map((p) => ({ id: p.link, title: p.title, link: p.link, date: p.at || Date.now(), image: /^https:\/\//.test(p.image || "") ? p.image : "", excerpt: p.excerpt || "", source: p.source || "Movie Nights", sourceKey: "", kind: "movies", cats: [], cat: "", also: [], score: 2000, pinned: true }));
  }

  // two lists of stories as one: the same story once, best score first
  const blend = (a, b) => {
    const seen = new Set();
    a.forEach((s) => (s.also || []).forEach((x) => seen.add(x.link)));
    return a
      .concat(b)
      .filter((s) => !seen.has(s.link) && seen.add(s.link))
      .sort((x, y) => y.score - x.score);
  };

  // the stories in hand -> the page (chips with nothing in them wait, the ticker, the note)
  let drawTimer;
  function take(r, partial) {
    const pins = pinned();
    const pinLinks = new Set(pins.map((p) => p.link));
    all = pins.concat(r.stories.filter((s) => !pinLinks.has(s.link)));
    loadedAt = r.at;
    root.querySelectorAll(".nw-chips [data-cat]").forEach((chip) => {
      const k = chip.dataset.cat;
      if (k === "latest") return;
      chip.hidden = !ofCat(all, k).length && state.cat !== k;
    });
    // (feeds answering one after another: drawn at most every 150 ms)
    clearTimeout(drawTimer);
    drawTimer = setTimeout(
      () => {
        render();
        ticker();
      },
      partial ? 150 : 0
    );
    paintUpdated(partial);
  }

  async function load(fresh) {
    const btn = root.querySelector(".nw-refresh");
    btn.disabled = true;
    btn.querySelector("i").classList.add("fa-spin");
    try {
      if (fresh) await Api.clear("news");
      // (while the feeds come in, and for a feed that didn't answer: the stories already in hand stay)
      const r = await News.latest((part) => take({ stories: blend(part.stories, kept ? kept.stories : []), at: part.at }, true));
      take({ stories: blend(r.stories, kept ? kept.stories.filter((s) => r.failed.includes(s.source)) : []), at: r.at }, false);
      kept = { stories: r.stories, at: r.at };
      News.alertsFrom(r.stories);
      const names = [...new Set(News.feeds().map((f) => f.name))];
      note.innerHTML = `Headlines and short excerpts from ${names.map(esc).join(", ")}, via their public news feeds (rss2json.com). Every story opens on its own site.${
        r.failed.length ? ` <span class="nw-failed">Couldn't reach ${esc([...new Set(r.failed)].join(", "))} this time.</span>` : ""
      }`;
      if (fresh) toast("News updated");
    } catch (e) {
      if (!all.length)
        body.innerHTML = `<div class="ax-error"><i class="fa-solid fa-plug-circle-xmark"></i><span>${esc(e.message || "The news couldn't be loaded")}. Check your connection.</span><button class="btn nw-retry" type="button">Try again</button></div>`;
      else {
        paintUpdated(false);
        toast("Couldn't get the latest news: showing what you had");
      }
    } finally {
      btn.disabled = false;
      btn.querySelector("i").classList.remove("fa-spin");
    }
  }

  /* ---------------- taps ---------------- */

  root.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (chip) {
      set({ cat: chip.dataset.cat });
      if (!chip.closest(".nw-chips")) root.querySelector(".nw-bar").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const so = e.target.closest("[data-sort]");
    if (so) return set({ sort: so.dataset.sort });
    const sh = e.target.closest("[data-share]");
    if (sh) {
      const s = all.find((x) => x.link === sh.dataset.share);
      if (s) UI.shareLink({ title: s.title, text: `📰 ${s.title} (${s.source})`, url: s.link });
      return;
    }
    if (e.target.closest(".nw-load")) {
      shown += PAGE;
      render();
      return;
    }
    if (e.target.closest(".nw-reset")) {
      root.querySelector(".nw-search input").value = "";
      return set({ cat: "latest", q: "" });
    }
    if (e.target.closest(".nw-refresh")) return load(true);
    if (e.target.closest(".nw-retry")) return load();
    if (e.target.closest(".nw-prefs-btn")) return openPrefs();
    if (e.target.closest(".nw-prefs-x, .nw-prefs-back")) return closePrefs();
    const mode = e.target.closest("[data-mode]");
    if (mode) {
      setPrefs({ mode: mode.dataset.mode });
      openPrefs();
      render();
      ticker();
    }
  });
  root.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.dataset.mysrc) return;
    const p = prefs();
    const picked = new Set(p.mine || sites());
    el.checked ? picked.add(el.dataset.mysrc) : picked.delete(el.dataset.mysrc);
    if (!picked.size) {
      el.checked = true;
      return toast("Keep at least one source");
    }
    setPrefs({ mine: [...picked], mode: "mine" });
    openPrefs();
    render();
    ticker();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && closePrefs());
  // a picture that doesn't load: the source's card instead
  root.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img.tagName !== "IMG" || !img.closest(".nw-img, .nw-feature-img, .nw-row-img")) return;
      const src = img.getAttribute("src");
      const s = all.find((x) => x.image === src || (x.images || []).includes(src));
      // (another outlet's picture of the same story first, then the source's card)
      const next = s && (s.images || []).find((u) => u !== src && !(s.tried || []).includes(u));
      if (next) {
        s.tried = (s.tried || []).concat(src);
        s.image = next;
        img.src = next;
        return;
      }
      if (s) s.image = "";
      img.outerHTML = s ? placeholder(s) : "";
    },
    true
  );
  let typing;
  root.querySelector(".nw-search").addEventListener("input", (e) => {
    clearTimeout(typing);
    typing = setTimeout(() => set({ q: e.target.value.trim() }), 250);
  });
  // phones: the search is an icon until tapped, then opens across the line (closes again when
  // left empty, or with Escape)
  const hero = root.querySelector(".nw-hero");
  const searchBox = root.querySelector(".nw-search input");
  const phone = () => window.matchMedia("(max-width: 700px)").matches;
  const openSearch = (on) => hero.classList.toggle("searching", on);
  if (state.q) openSearch(true);
  searchBox.addEventListener("focus", () => phone() && openSearch(true));
  searchBox.addEventListener("blur", () => setTimeout(() => !searchBox.value.trim() && openSearch(false), 120));
  searchBox.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    searchBox.value = "";
    set({ q: "" });
    searchBox.blur();
    openSearch(false);
  });
  root.querySelector(".nw-search").addEventListener("submit", (e) => {
    e.preventDefault();
    set({ q: e.target.elements.q.value.trim() });
  });

  // the last news straight away, then the fresh news as it comes
  let kept = News.saved && News.saved();
  if (kept) {
    take(kept, false);
    root.querySelector(".nw-updated").textContent = "· getting the latest…";
  }
  load();
})();
