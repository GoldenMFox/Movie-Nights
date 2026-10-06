/*
 * Movie News (news.html): the latest from the film trade (js/services/news.js).
 *
 * The look: a header with a "Live" light (when it was last updated), the search and Refresh, a ticker of
 * the newest headlines running under it, then the top story big (its picture filling the card,
 * the words over it) beside a "Latest" column, then every other story as a card, by day (Today,
 * Yesterday, Earlier this week, Older). A story without a picture gets a card in its source's
 * colour. Chips for Movies / TV and each kind of story, a search box, stories the owner pinned
 * (Admin → News) first. The chip and the search are in the address (?cat=trailers&q=dune).
 *
 * Fast: the last news this browser saw shows the moment the page opens, then the fresh stories
 * come in feed by feed as each one answers (all of them asked at once).
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("news");
  const params = new URLSearchParams(location.search);
  const PAGE = 18;
  let state = { cat: params.get("cat") || "all", q: params.get("q") || "" };
  let all = [];
  let shown = PAGE;
  let loadedAt = 0;

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
  const catOf = (k) => News.CATEGORIES.find((c) => c[0] === k);
  const catIcon = (s) => {
    const c = catOf(s.cat);
    return c ? c[2] : s.kind === "tv" ? "fa-tv" : "fa-film";
  };
  const catName = (s) => {
    const c = catOf(s.cat);
    return c ? c[1] : News.KIND_LABEL[s.kind];
  };
  const tag = (s) => `<span class="nw-tag"><i class="fa-solid ${catIcon(s)}"></i> ${esc(catName(s))}</span>`;

  // each source's mark and colour (a story without a picture is drawn in its source's colour)
  const SOURCE_LOOK = {
    Variety: ["V", "#d9a93a"],
    "The Hollywood Reporter": ["THR", "#d4243b"],
    "/Film": ["/F", "#ff7a3d"],
    "Screen Rant": ["SR", "#2fb8d6"],
    Collider: ["C", "#4f7dff"],
    "Movie Nights": ["MN", "#e50914"],
  };
  const lookOf = (name) => {
    if (SOURCE_LOOK[name]) return SOURCE_LOOK[name];
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return [String(name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?", `hsl(${h} 70% 58%)`];
  };
  const mono = (name) => `<em class="nw-mono" style="--src:${lookOf(name)[1]}">${esc(lookOf(name)[0])}</em>`;
  // a picture, or the source's card when there's none (or it doesn't load)
  const picture = (s, eager) =>
    s.image
      ? `<img src="${esc(s.image)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer" />`
      : placeholder(s);
  const placeholder = (s) => `<span class="nw-ph" style="--src:${lookOf(s.source)[1]}"><b>${esc(lookOf(s.source)[0])}</b><i class="fa-solid ${catIcon(s)}"></i></span>`;

  const CHIPS = [["all", "All", "fa-newspaper"], ["movies", "Movies", "fa-film"], ["tv", "TV", "fa-tv"]].concat(News.CATEGORIES.map(([k, l, i]) => [k, l, i]));
  const sources = () => [...new Set(News.feeds().map((f) => f.name))];

  root.innerHTML = `
    <header class="nw-hero">
      <div class="nw-hero-text">
        <span class="nw-live"><i></i> Live <span class="nw-updated">· getting the latest…</span></span>
        <h1 class="page-title">Movie News</h1>
        <p class="page-sub">The day's stories from Hollywood's trade press, in one place.</p>
      </div>
      <div class="nw-hero-tools">
        <form class="ax-search nw-search" role="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input class="input" name="q" type="search" placeholder="Search the news…" aria-label="Search the news" value="${esc(state.q)}" autocomplete="off" /></form>
        <button class="btn nw-refresh" type="button" title="Check for new stories"><i class="fa-solid fa-rotate"></i><span> Refresh</span></button>
      </div>
    </header>
    <div class="nw-ticker" hidden><span class="nw-ticker-label"><i class="fa-solid fa-bolt"></i> Just in</span><div class="nw-ticker-track"><div class="nw-ticker-run"></div></div></div>
    <div class="chips nw-chips" role="group" aria-label="Show">${CHIPS.map(([k, l, i]) => `<button type="button" class="chip${state.cat === k ? " active" : ""}" data-cat="${k}" aria-pressed="${state.cat === k}"><i class="fa-solid ${i}"></i> ${esc(l)}</button>`).join("")}</div>
    <div class="nw-body">${skeleton()}</div>
    <p class="tmdb-note nw-note"></p>`;
  const body = root.querySelector(".nw-body");
  const note = root.querySelector(".nw-note");

  function skeleton() {
    return `<div class="nw-lead nw-wait"><div class="nw-skel nw-skel-big"></div><div class="nw-skel-col">${'<div class="nw-skel nw-skel-row"></div>'.repeat(5)}</div></div>
      <div class="nw-grid nw-wait">${'<div class="nw-skel"></div>'.repeat(6)}</div>`;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return all.filter((s) => {
      if (state.cat === "movies" && s.kind !== "movies") return false;
      if (state.cat === "tv" && s.kind !== "tv") return false;
      if (!["all", "movies", "tv"].includes(state.cat) && s.cat !== state.cat) return false;
      if (q && !`${s.title} ${s.excerpt} ${s.source}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  const card = (s) => `<article class="nw-card" style="--src:${lookOf(s.source)[1]}">
      <a class="nw-img" href="${esc(s.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${picture(s)}
        <span class="nw-badge"><i class="fa-solid ${s.pinned ? "fa-thumbtack" : catIcon(s)}"></i> ${esc(s.pinned ? "Pinned" : catName(s))}</span></a>
      <div class="nw-text">
        <div class="nw-meta"><span class="nw-src">${mono(s.source)}<b>${esc(s.source)}</b></span><span class="nw-when">${esc(ago(s.date))}</span></div>
        <h3><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
        ${s.excerpt ? `<p>${esc(s.excerpt)}</p>` : ""}
        <div class="nw-actions"><a class="nw-more" href="${esc(s.link)}" target="_blank" rel="noopener">Read on ${esc(s.source)} <i class="fa-solid fa-arrow-right"></i></a>
        <button class="nw-share" type="button" data-share="${esc(s.link)}" data-feature="share" aria-label="Share this story" title="Share"><i class="fa-solid fa-arrow-up-from-bracket"></i></button></div>
      </div>
    </article>`;

  // a headline in the Latest column: a small picture, the source and how long ago
  const row = (s) => `<a class="nw-row" href="${esc(s.link)}" target="_blank" rel="noopener" style="--src:${lookOf(s.source)[1]}">
      <span class="nw-row-img">${picture(s)}</span>
      <span class="nw-row-text"><small>${mono(s.source)}${esc(s.source)} · ${esc(ago(s.date))}</small><strong>${esc(s.title)}</strong></span></a>`;

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

  function render() {
    const list = filtered();
    if (!list.length) {
      body.innerHTML = `<div class="empty-state"><i class="fa-regular fa-face-meh"></i><p>No stories match${state.q ? ` “${esc(state.q)}”` : ""} right now.</p><button class="btn nw-reset" type="button">Show all news</button></div>`;
      return;
    }
    // the top story big: the newest with a picture (a pinned one first); the Latest column: the next five
    const top = list.find((s) => s.pinned && s.image) || list.find((s) => s.image) || list[0];
    const rest = list.filter((s) => s !== top);
    const side = rest.slice(0, 5);
    const more = rest.slice(5);
    const look = lookOf(top.source);
    body.innerHTML = `
      <section class="nw-lead">
        <article class="nw-feature" style="--src:${look[1]}">
          <a class="nw-feature-img" href="${esc(top.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${picture(top, true)}</a>
          <div class="nw-feature-text">
            <div class="nw-meta"><span class="nw-latest">${top.pinned ? '<i class="fa-solid fa-thumbtack"></i> Pinned' : '<i class="fa-solid fa-bolt"></i> Top story'}</span><span class="nw-src">${mono(top.source)}<b>${esc(top.source)}</b></span><span class="nw-when">${esc(ago(top.date))}</span>${tag(top)}</div>
            <h2><a href="${esc(top.link)}" target="_blank" rel="noopener">${esc(top.title)}</a></h2>
            ${top.excerpt ? `<p>${esc(top.excerpt)}</p>` : ""}
            <div class="nw-actions"><a class="btn btn-primary nw-read" href="${esc(top.link)}" target="_blank" rel="noopener">Read the story <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            <button class="btn nw-share big" type="button" data-share="${esc(top.link)}" data-feature="share" aria-label="Share this story"><i class="fa-solid fa-arrow-up-from-bracket"></i> Share</button></div>
          </div>
        </article>
        ${side.length ? `<aside class="nw-side"><h3><i class="fa-solid fa-clock"></i> Latest</h3>${side.map(row).join("")}</aside>` : ""}
      </section>
      ${byDay(more.slice(0, shown))
        .map((g) => `<h3 class="nw-day"><span>${esc(g.name)}</span><small>${g.items.length} ${g.items.length === 1 ? "story" : "stories"}</small></h3><div class="nw-grid">${g.items.map(card).join("")}</div>`)
        .join("")}
      ${more.length > shown ? `<div class="load-more"><button class="btn nw-load" type="button">Show more (${more.length - shown} left)</button></div>` : ""}`;
  }

  // the ticker: the newest headlines, running (twice over, so it loops without a jump)
  function ticker() {
    const el = root.querySelector(".nw-ticker");
    const items = all.filter((s) => !s.pinned).slice(0, 12);
    el.hidden = items.length < 3;
    if (el.hidden) return;
    const run = items.map((s) => `<a href="${esc(s.link)}" target="_blank" rel="noopener"><b>${esc(s.source)}</b>${esc(s.title)}</a>`).join("");
    el.querySelector(".nw-ticker-run").innerHTML = run + run.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ');
    el.style.setProperty("--ticker-time", `${Math.max(40, items.length * 6)}s`);
  }

  function paintUpdated(partial) {
    root.querySelector(".nw-updated").textContent = partial ? "· getting the latest…" : `· updated ${ago(loadedAt)}`;
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.cat !== "all") p.set("cat", state.cat);
    if (state.q) p.set("q", state.q);
    history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
  }
  function set(patch) {
    Object.assign(state, patch);
    shown = PAGE;
    root.querySelectorAll("[data-cat]").forEach((b) => {
      b.classList.toggle("active", b.dataset.cat === state.cat);
      b.setAttribute("aria-pressed", b.dataset.cat === state.cat);
    });
    syncUrl();
    if (all.length) render();
  }

  // pinned stories (Admin → News): { title, link, source, image, excerpt }
  function pinned() {
    const list = (window.Site && Site.get().news.featured) || [];
    return list
      .filter((p) => p && /^https?:\/\//.test(p.link || "") && p.title)
      .map((p) => ({ id: p.link, title: p.title, link: p.link, date: p.at || Date.now(), image: /^https:\/\//.test(p.image || "") ? p.image : "", excerpt: p.excerpt || "", source: p.source || "Movie Nights", kind: "movies", cat: "", pinned: true }));
  }

  // two lists of stories as one: the same story once, newest first
  const blend = (a, b) => {
    const seen = new Set();
    return a
      .concat(b)
      .filter((s) => !seen.has(s.link) && seen.add(s.link))
      .sort((x, y) => y.date - x.date);
  };

  // the stories in hand -> the page (chips with nothing in them wait, the ticker, the note)
  let drawTimer;
  function take(r, partial) {
    const pins = pinned();
    const pinLinks = new Set(pins.map((p) => p.link));
    all = pins.concat(r.stories.filter((s) => !pinLinks.has(s.link)));
    loadedAt = r.at;
    root.querySelectorAll("[data-cat]").forEach((chip) => {
      const k = chip.dataset.cat;
      if (["all", "movies", "tv"].includes(k)) return;
      chip.hidden = !all.some((s) => s.cat === k) && state.cat !== k;
    });
    // (feeds answering one after another: drawn at most every 150 ms)
    clearTimeout(drawTimer);
    drawTimer = setTimeout(() => {
      render();
      ticker();
    }, partial ? 150 : 0);
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
      note.innerHTML = `Headlines and short excerpts from ${sources().map(esc).join(", ")}, via their public news feeds (rss2json.com). Every story opens on its own site.${
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

  root.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (chip) {
      set({ cat: chip.dataset.cat });
      return;
    }
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
      return set({ cat: "all", q: "" });
    }
    if (e.target.closest(".nw-refresh")) return load(true);
    if (e.target.closest(".nw-retry")) return load();
  });
  // a picture that doesn't load: the source's card instead
  root.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img.tagName !== "IMG" || !img.closest(".nw-img, .nw-feature-img, .nw-row-img")) return;
      const s = all.find((x) => x.image === img.getAttribute("src"));
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
