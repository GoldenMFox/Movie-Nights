/*
 * Movie News (news.html): the latest from the film trade (js/services/news.js).
 *
 * The top story big (with its picture), then the rest as cards: the source, how long ago, the
 * headline and a short excerpt; "Read more" opens the story on the source's own site. Chips for
 * Movies / TV and for each kind of story (trailers, casting, box office, awards, streaming,
 * upcoming, production), a search box, and stories the owner pinned (Admin → News) first.
 * The chip and the search are in the address (?cat=trailers&q=dune), so a view can be shared.
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
  const tag = (s) => {
    const c = catOf(s.cat);
    return `<span class="nw-tag"><i class="fa-solid ${c ? c[2] : s.kind === "tv" ? "fa-tv" : "fa-film"}"></i> ${esc(c ? c[1] : News.KIND_LABEL[s.kind])}</span>`;
  };
  const CHIPS = [["all", "All", "fa-newspaper"], ["movies", "Movies", "fa-film"], ["tv", "TV", "fa-tv"]].concat(News.CATEGORIES.map(([k, l, i]) => [k, l, i]));

  root.innerHTML = `
    <div class="nw-top">
      <div><h1 class="page-title">Movie News</h1><p class="page-sub">The latest from Variety, The Hollywood Reporter, /Film, Collider and Screen Rant.</p></div>
      <button class="btn nw-refresh" type="button" title="Check for new stories"><i class="fa-solid fa-rotate"></i><span> Refresh</span></button>
    </div>
    <form class="ax-search nw-search" role="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input class="input" name="q" type="search" placeholder="Search the news…" aria-label="Search the news" value="${esc(state.q)}" autocomplete="off" /></form>
    <div class="chips nw-chips" role="group" aria-label="Show">${CHIPS.map(([k, l, i]) => `<button type="button" class="chip${state.cat === k ? " active" : ""}" data-cat="${k}" aria-pressed="${state.cat === k}"><i class="fa-solid ${i}"></i> ${esc(l)}</button>`).join("")}</div>
    <div class="nw-body"><div class="nw-wait">${'<div class="nw-skel"></div>'.repeat(6)}</div></div>
    <p class="tmdb-note nw-note"></p>`;
  const body = root.querySelector(".nw-body");
  const note = root.querySelector(".nw-note");

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

  const card = (s) => `<article class="nw-card">
      <a class="nw-img" href="${esc(s.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${
        s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : '<span class="nw-noimg"><i class="fa-solid fa-newspaper"></i></span>'
      }${s.pinned ? '<span class="nw-pin"><i class="fa-solid fa-thumbtack"></i> Pinned</span>' : ""}</a>
      <div class="nw-text">
        <div class="nw-meta"><b>${esc(s.source)}</b><span>${esc(ago(s.date))}</span>${tag(s)}</div>
        <h3><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
        ${s.excerpt ? `<p>${esc(s.excerpt)}</p>` : ""}
        <div class="nw-actions"><a class="nw-more" href="${esc(s.link)}" target="_blank" rel="noopener">Read more on ${esc(s.source)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        <button class="nw-share" type="button" data-share="${esc(s.link)}" data-feature="share" aria-label="Share this story" title="Share"><i class="fa-solid fa-arrow-up-from-bracket"></i></button></div>
      </div>
    </article>`;

  function render() {
    const list = filtered();
    if (!list.length) {
      body.innerHTML = `<div class="empty-state"><i class="fa-regular fa-face-meh"></i><p>No stories match${state.q ? ` “${esc(state.q)}”` : ""} right now.</p><button class="btn nw-reset" type="button">Show all news</button></div>`;
      return;
    }
    // the top story big: the newest with a picture (a pinned one first)
    const top = list.find((s) => s.pinned && s.image) || list.find((s) => s.image) || list[0];
    const rest = list.filter((s) => s !== top);
    body.innerHTML = `
      <article class="nw-feature">
        <a class="nw-feature-img" href="${esc(top.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${top.image ? `<img src="${esc(top.image)}" alt="" referrerpolicy="no-referrer" />` : ""}</a>
        <div class="nw-feature-text">
          <div class="nw-meta"><span class="nw-latest">${top.pinned ? '<i class="fa-solid fa-thumbtack"></i> Pinned' : '<i class="fa-solid fa-bolt"></i> Top story'}</span><b>${esc(top.source)}</b><span>${esc(ago(top.date))}</span>${tag(top)}</div>
          <h2><a href="${esc(top.link)}" target="_blank" rel="noopener">${esc(top.title)}</a></h2>
          ${top.excerpt ? `<p>${esc(top.excerpt)}</p>` : ""}
          <div class="nw-actions"><a class="btn btn-primary nw-read" href="${esc(top.link)}" target="_blank" rel="noopener">Read more on ${esc(top.source)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          <button class="btn nw-share big" type="button" data-share="${esc(top.link)}" data-feature="share" aria-label="Share this story"><i class="fa-solid fa-arrow-up-from-bracket"></i> Share</button></div>
        </div>
      </article>
      <div class="nw-grid">${rest.slice(0, shown).map(card).join("")}</div>
      ${rest.length > shown ? `<div class="load-more"><button class="btn nw-load" type="button">Show more (${rest.length - shown} left)</button></div>` : ""}`;
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

  async function load(fresh) {
    const btn = root.querySelector(".nw-refresh");
    btn.disabled = true;
    btn.querySelector("i").classList.add("fa-spin");
    try {
      if (fresh) await Api.clear("news");
      const r = await News.latest();
      const pins = pinned();
      const pinLinks = new Set(pins.map((p) => p.link));
      all = pins.concat(r.stories.filter((s) => !pinLinks.has(s.link)));
      loadedAt = r.at;
      // a kind of story with nothing in it right now: its chip waits until there is
      root.querySelectorAll("[data-cat]").forEach((chip) => {
        const k = chip.dataset.cat;
        if (["all", "movies", "tv"].includes(k)) return;
        chip.hidden = !all.some((s) => s.cat === k) && state.cat !== k;
      });
      render();
      const sources = [...new Set(News.feeds().map((f) => f.name))];
      note.innerHTML = `Headlines and short excerpts from ${sources.map(esc).join(", ")}, via their public news feeds (rss2json.com). Every story opens on its own site. Updated ${esc(ago(loadedAt))}.${
        r.failed.length ? ` <span class="nw-failed">Couldn't reach ${esc([...new Set(r.failed)].join(", "))} this time.</span>` : ""
      }`;
      if (fresh) toast("News updated");
    } catch (e) {
      body.innerHTML = `<div class="ax-error"><i class="fa-solid fa-plug-circle-xmark"></i><span>${esc(e.message || "The news couldn't be loaded")}. Check your connection.</span><button class="btn nw-retry" type="button">Try again</button></div>`;
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
  let typing;
  root.querySelector(".nw-search").addEventListener("input", (e) => {
    clearTimeout(typing);
    typing = setTimeout(() => set({ q: e.target.value.trim() }), 250);
  });
  root.querySelector(".nw-search").addEventListener("submit", (e) => {
    e.preventDefault();
    set({ q: e.target.elements.q.value.trim() });
  });

  load();
})();
