/*
 * Anime explorer (anime-explore.html): all of anime, from AniList
 * (js/services/anime.js). Next to "My anime" (anime.html, your own list) behind one switch.
 *
 *   anime-explore.html                    rows: trending, this season, upcoming, top rated, most
 *                                         popular, just finished, most-loved characters; browse by
 *                                         genre, studio or season; search
 *   anime-explore.html?genre=Action       a grid (also ?al=569 (a studio), ?season=2026-fall, ?q=frieren,
 *                                         ?list=top …), 24 at a time with Load more
 *   anime-explore.html?id=mal-5114        one anime: scores and ranks, story, facts, characters
 *                                         and their voices, staff, related anime, recommendations
 * Rows are asked for only when they come near the screen (the services have tight limits).
 * Every anime links to its Movie Nights page (TMDB) to add it to your library, rate it, etc.
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("ax");
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const safe = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
  const SEASON_LABEL = { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" };
  const fmt = (n) => (n == null ? "–" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (s) => {
    const d = new Date(`${s}T00:00:00`);
    return s && !isNaN(d) ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
  };

  if (window.Site && !Site.feature("animeExplore")) {
    root.innerHTML = `<div class="empty-state"><i class="fa-solid fa-ban"></i><p>The anime explorer is switched off for now.</p><a class="btn" href="anime.html">My anime</a></div>`;
    return;
  }

  // My anime | Explore (the same switch is at the top of anime.html)
  const switchHtml = `<div class="ax-top"><h1 class="page-title">Anime</h1>
      <nav class="top10-switch ax-switch" aria-label="Anime">
        <a class="top10-tab" href="anime.html"><i class="fa-solid fa-list"></i> My anime</a>
        <a class="top10-tab active" href="anime-explore.html" aria-current="page"><i class="fa-solid fa-compass"></i> Explore</a>
      </nav></div>`;

  // a poster card (the site's own: poster, type, score; title under it on computers)
  function card(c) {
    const href = `anime-explore.html?id=${encodeURIComponent(c.key)}`;
    const meta = [c.season && c.year ? `${SEASON_LABEL[c.season] || ""} ${c.year}` : c.year, c.episodes ? `${c.episodes} ep` : ""].filter(Boolean).join(" · ");
    // (the names and year: to find its TMDB poster, see tmdbPosters below)
    return `<article class="movie-item ax-card" data-anime="${esc(c.key)}" data-en="${esc(c.titleEn || "")}" data-ro="${esc(c.titleRomaji || c.title || "")}" data-year="${esc(c.year || "")}" data-type="${esc(c.type || "")}">
        <a class="poster-link" href="${href}" tabindex="-1" aria-hidden="true">
          <img class="movie-poster" src="${esc(safe(c.image) || "images/placeholders/poster-placeholder.svg")}" alt="" loading="lazy" decoding="async" />
          <span class="badges"><span class="type-badge">${esc(c.type || "Anime")}</span></span>
          ${c.score ? `<span class="ax-score"><i class="fa-solid fa-star"></i>${c.score.toFixed(1)}</span>` : ""}
        </a>
        <div class="movie-info">
          <h3 class="movie-title"><a href="${href}" title="${esc(c.title)}">${esc(c.title)}</a></h3>
          <div class="movie-meta"><span class="year">${esc(meta)}</span></div>
        </div>
      </article>`;
  }
  // TMDB's posters (with the name on them, like the library's) in place of AniList's covers,
  // looked up as cards come near the screen; the new poster shows once it has loaded
  const posterIo =
    window.IntersectionObserver && window.TMDB && TMDB.animePoster
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (!e.isIntersecting) return;
              posterIo.unobserve(e.target);
              const el = e.target;
              const img = el.querySelector(".movie-poster");
              TMDB.animePoster({ key: el.dataset.anime, titleEn: el.dataset.en, titleRomaji: el.dataset.ro, year: Number(el.dataset.year) || null, type: el.dataset.type }).then((url) => {
                if (!url || !img) return;
                const pre = new Image();
                pre.onload = () => (img.src = url);
                pre.src = url;
              });
            }),
          { rootMargin: "300px" }
        )
      : null;
  if (posterIo)
    new MutationObserver(() => root.querySelectorAll(".ax-card:not([data-tp])").forEach((el) => (el.setAttribute("data-tp", ""), posterIo.observe(el)))).observe(root, { childList: true, subtree: true });

  const skeleton = (n) => Array.from({ length: n }, () => '<div class="ax-skel"></div>').join("");
  const credit = () => '<p class="tmdb-note ax-credit">Anime data from <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>.</p>';
  const failed = (e, retry) =>
    `<div class="ax-error"><i class="fa-solid fa-plug-circle-xmark"></i><span>${esc((e && e.message) || "Couldn't load this")}.</span>${retry ? `<button class="btn ax-retry" type="button" data-retry="${esc(retry)}">Try again</button>` : ""}</div>`;

  /* ================= one anime ================= */

  if (id) return detailsPage(id);

  /* ================= the explorer ================= */

  const now = Anime.seasonNow();
  const ROWS = [
    ["trending", "fa-fire", "Trending now"],
    ["airing", "fa-tower-broadcast", `Airing this season · ${SEASON_LABEL[now.season]} ${now.year}`],
    ["upcoming", "fa-hourglass-half", "Coming next season"],
    ["top", "fa-trophy", "Top rated of all time"],
    ["popular", "fa-users", "Most popular"],
    ["completed", "fa-flag-checkered", "Just finished"],
  ];
  const grid = params.get("genre") || params.get("al") || params.get("season") || params.get("q") || params.get("list");
  if (grid) return gridPage();

  const featured = (window.Site && Site.get().anime.featured) || [];
  root.innerHTML = `${switchHtml}
    <form class="ax-search" role="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input class="input" name="q" type="search" placeholder="Search all anime…" aria-label="Search all anime" autocomplete="off" /></form>
    ${featured.length ? `<section class="ax-row" data-row="featured"><div class="row-head"><h2><i class="fa-solid fa-star"></i> Our picks</h2></div><div class="movie-row">${featured.map(card).join("")}</div></section>` : ""}
    ${ROWS.map(
      ([k, icon, label]) => `<section class="ax-row" data-row="${k}">
        <div class="row-head"><h2><i class="fa-solid ${icon}"></i> ${esc(label)}</h2><a class="see-all" href="anime-explore.html?list=${k}">See all <i class="fa-solid fa-chevron-right"></i></a></div>
        <div class="movie-row">${skeleton(8)}</div>
      </section>`
    ).join("")}
    <section class="ax-browse">
      <div class="row-head"><h2><i class="fa-solid fa-masks-theater"></i> Browse by genre</h2></div>
      <div class="ax-chips">${Anime.GENRES.map((g) => `<a class="as-chip" href="anime-explore.html?genre=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`).join("")}</div>
      <div class="row-head"><h2><i class="fa-solid fa-building"></i> Browse by studio</h2></div>
      <div class="ax-chips">${Anime.STUDIOS.map((s) => `<a class="as-chip" href="anime-explore.html?al=${s.al}&name=${encodeURIComponent(s.name)}">${esc(s.name)}</a>`).join("")}</div>
      <div class="row-head"><h2><i class="fa-solid fa-calendar-days"></i> Browse by season</h2></div>
      <div class="ax-chips">${seasonLinks()}</div>
    </section>
    <section class="ax-row" data-row="characters">
      <div class="row-head"><h2><i class="fa-solid fa-heart"></i> Most-loved characters</h2></div>
      <div class="movie-row ax-chars">${skeleton(8)}</div>
    </section>
    <div class="ax-foot"></div>`;

  // the last two years' seasons, newest first, and the next one
  function seasonLinks() {
    const out = [];
    let { year, season } = now;
    let i = Anime.SEASONS.indexOf(season) + 1;
    if (i > 3) {
      i = 0;
      year++;
    }
    for (let n = 0; n < 9; n++) {
      const s = Anime.SEASONS[i];
      out.push(`<a class="as-chip${s === now.season && year === now.year ? " on" : ""}" href="anime-explore.html?season=${year}-${s}">${SEASON_LABEL[s]} ${year}</a>`);
      i--;
      if (i < 0) {
        i = 3;
        year--;
      }
    }
    return out.join("");
  }

  function loadRow(sec) {
    const k = sec.dataset.row;
    const row = sec.querySelector(".movie-row");
    if (k === "featured" || sec.dataset.loaded) return;
    sec.dataset.loaded = "1";
    const job = k === "characters" ? Anime.topCharacters().then((list) => ({ list, chars: true })) : Anime.list(k);
    job
      .then((r) => {
        if (!r.list.length) {
          sec.hidden = true;
          return;
        }
        row.innerHTML = r.chars
          ? r.list
              .map(
                (c, n) => `<a class="ax-char" href="${esc(safe(c.url) || "#")}" target="_blank" rel="noopener">
                  <span class="ax-char-img"><img src="${esc(safe(c.image))}" alt="" loading="lazy" /><b>${n + 1}</b></span>
                  <strong>${esc(c.name)}</strong><small>${c.nick ? esc(c.nick) : ""}${c.favorites ? ` <span><i class="fa-solid fa-heart"></i> ${fmt(c.favorites)}</span>` : ""}</small>
                </a>`
              )
              .join("")
          : r.list.slice(0, 20).map(card).join("");
        root.querySelector(".ax-foot").innerHTML = credit();
      })
      .catch((e) => {
        delete sec.dataset.loaded;
        row.innerHTML = failed(e, k);
      });
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => entries.forEach((en) => en.isIntersecting && (io.unobserve(en.target), loadRow(en.target))), { rootMargin: "400px" }) : null;
  root.querySelectorAll(".ax-row").forEach((sec) => (io ? io.observe(sec) : loadRow(sec)));
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-retry]");
    if (!b) return;
    const sec = b.closest(".ax-row");
    if (sec) {
      sec.querySelector(".movie-row").innerHTML = skeleton(8);
      loadRow(sec);
    }
  });
  root.querySelector(".ax-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.elements.q.value.trim();
    if (q) location.href = `anime-explore.html?q=${encodeURIComponent(q)}`;
  });

  /* ================= a grid: a genre, a studio, a season, a search, "See all" ================= */

  function gridPage() {
    const name = params.get("name") || "";
    let kind, opts, title;
    if (params.get("genre")) {
      kind = "genre";
      opts = { genreName: params.get("genre") };
      title = `${opts.genreName || "Genre"} anime`;
    } else if (params.get("al")) {
      kind = "studio";
      opts = { studioAl: Number(params.get("al")) || null };
      title = name || "Studio";
    } else if (params.get("season")) {
      const [y, s] = params.get("season").split("-");
      kind = "season";
      opts = { year: Number(y), season: Anime.SEASONS.includes(s) ? s : now.season };
      title = `${SEASON_LABEL[opts.season]} ${opts.year}`;
    } else if (params.get("q")) {
      kind = "search";
      opts = { q: params.get("q") };
      title = `“${params.get("q")}”`;
    } else {
      kind = ROWS.some((r) => r[0] === params.get("list")) ? params.get("list") : "top";
      opts = {};
      title = ROWS.find((r) => r[0] === kind)[2];
    }
    document.title = `${title} · Anime · Movie Nights`;
    root.innerHTML = `${switchHtml}
      <form class="ax-search" role="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input class="input" name="q" type="search" placeholder="Search all anime…" aria-label="Search all anime" value="${esc(params.get("q") || "")}" autocomplete="off" /></form>
      <div class="ax-grid-head"><a class="t-link" href="anime-explore.html"><i class="fa-solid fa-arrow-left"></i> Explore</a><h2>${esc(title)}</h2></div>
      ${kind === "season" ? `<div class="ax-chips ax-season-chips">${seasonLinks()}</div>` : ""}
      <div class="movie-grid ax-grid">${skeleton(12)}</div>
      <div class="load-more"><button class="btn ax-more" type="button" hidden>Load more</button></div>
      <div class="ax-foot"></div>`;
    root.querySelectorAll(".ax-season-chips .as-chip").forEach((a) => a.classList.toggle("on", a.getAttribute("href").endsWith(`${opts.year}-${opts.season}`)));
    const gridEl = root.querySelector(".ax-grid");
    const more = root.querySelector(".ax-more");
    const seen = new Set();
    let page = 0;
    const load = () => {
      page++;
      more.disabled = true;
      Anime.list(kind, Object.assign({ page }, opts))
        .then((r) => {
          if (page === 1) gridEl.innerHTML = "";
          const fresh = r.list.filter((c) => !seen.has(c.key) && seen.add(c.key));
          gridEl.insertAdjacentHTML("beforeend", fresh.map(card).join(""));
          if (page === 1 && !fresh.length) gridEl.innerHTML = '<div class="empty-state"><i class="fa-regular fa-face-meh"></i><p>Nothing found.</p></div>';
          more.hidden = !r.more;
          more.disabled = false;
          root.querySelector(".ax-foot").innerHTML = credit();
        })
        .catch((e) => {
          page--;
          more.disabled = false;
          if (page === 0) gridEl.innerHTML = failed(e, "grid");
          else toast((e && e.message) || "Couldn't load more");
        });
    };
    more.addEventListener("click", load);
    root.addEventListener("click", (e) => e.target.closest('[data-retry="grid"]') && ((gridEl.innerHTML = skeleton(12)), load()));
    root.querySelector(".ax-search").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = e.target.elements.q.value.trim();
      if (q) location.href = `anime-explore.html?q=${encodeURIComponent(q)}`;
    });
    load();
  }

  /* ================= one anime ================= */

  async function detailsPage(key) {
    root.innerHTML = `<div class="ax-detail-wait"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</div>`;
    let a;
    try {
      a = await Anime.details(key);
    } catch (e) {
      root.innerHTML = `${switchHtml}${failed(e)}<p><a class="btn" href="anime-explore.html">Back to Explore</a></p>`;
      return;
    }
    document.title = `${a.title} · Anime · Movie Nights`;
    const statusCls = a.airing ? "airing" : /not yet/i.test(a.status) ? "soon" : "done";
    const pills = [
      a.type,
      a.episodes ? `${a.episodes} episode${a.episodes === 1 ? "" : "s"}` : a.airing ? "Ongoing" : "",
      a.duration,
      a.season && a.year ? `${SEASON_LABEL[a.season]} ${a.year}` : a.year,
    ].filter(Boolean);
    const stat = (icon, big, label, cls) => `<div class="ax-stat ${cls || ""}"><i class="fa-solid ${icon}"></i><b>${big}</b><small>${label}</small></div>`;
    const nextEp = a.next && a.next.at > Date.now() ? a.next : null;
    const dl = (label, value) => (value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : "");
    const chipLinks = (list, f) => list.map(f).join("");
    const genreId = (n) => (Anime.GENRES.find((g) => g.name.toLowerCase() === String(n).toLowerCase()) || {}).id;
    root.innerHTML = `
      <section class="ax-hero">
        <div class="ax-hero-bg"></div>
        <div class="ax-hero-in">
          <img class="ax-poster" src="${esc(safe(a.image) || "images/placeholders/poster-placeholder.svg")}" alt="${esc(a.title)} poster" />
          <div class="ax-head">
            <a class="t-link ax-back" href="anime-explore.html"><i class="fa-solid fa-arrow-left"></i> Explore anime</a>
            <h1>${esc(a.title)}</h1>
            ${[a.titleRomaji !== a.title ? a.titleRomaji : "", a.titleJp].filter(Boolean).length ? `<p class="ax-alt">${[a.titleRomaji !== a.title ? a.titleRomaji : "", a.titleJp].filter(Boolean).map(esc).join(" · ")}</p>` : ""}
            <div class="ax-pills"><span class="ax-status ${statusCls}">${esc(a.status || "")}</span>${pills.map((p) => `<span>${esc(p)}</span>`).join("")}</div>
            <div class="ax-stats">
              ${a.score ? stat("fa-star", a.score.toFixed(2).replace(/0$/, ""), "Score", "gold") : ""}
              ${a.rank ? stat("fa-ranking-star", `#${a.rank}`, "Ranked") : ""}
              ${a.popularity ? stat("fa-fire", `#${a.popularity}`, "Popularity") : ""}
              ${a.members ? stat("fa-users", fmt(a.members), "On lists") : ""}
              ${a.favorites ? stat("fa-heart", fmt(a.favorites), "Favorites") : ""}
            </div>
            ${nextEp ? `<div class="t-release soon"><i class="fa-solid fa-tower-broadcast"></i><span><b>Episode ${nextEp.episode}</b> ${new Date(nextEp.at).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · in ${Math.max(1, Math.round((nextEp.at - Date.now()) / 86400000))} day${Math.round((nextEp.at - Date.now()) / 86400000) === 1 ? "" : "s"}</span></div>` : ""}
            <div class="ax-cta">
              ${a.trailer ? '<button class="btn btn-primary ax-trailer" type="button"><i class="fa-solid fa-play"></i> Trailer</button>' : ""}
              <span class="ax-mn"><button class="btn" type="button" disabled><i class="fa-solid fa-spinner fa-spin"></i> Finding it on Movie Nights…</button></span>
              ${safe(a.url) ? `<a class="btn" href="${esc(safe(a.url))}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> AniList</a>` : ""}
              <button class="btn ax-share" type="button" data-feature="share" aria-label="Share"><i class="fa-solid fa-arrow-up-from-bracket"></i><span class="ax-share-l"> Share</span></button>
            </div>
          </div>
        </div>
      </section>
      ${a.synopsis ? `<section class="t-section"><h2 class="t-section-title">Story</h2><p class="ax-synopsis clamp">${esc(a.synopsis)}</p>${a.synopsis.length > 320 ? '<button class="t-link ax-more-text" type="button">Read more</button>' : ""}</section>` : ""}
      <section class="t-section"><h2 class="t-section-title">Details</h2>
        <div class="xr-grid ax-facts">
          <div class="xr-card"><span class="xr-label"><i class="fa-solid fa-calendar-days"></i> Aired</span><dl class="xr-air-rows">
            ${dl("From", esc(day(a.from)))}${dl("To", a.to ? esc(day(a.to)) : a.airing ? "Still airing" : "")}${dl("Season", a.season ? `<a href="anime-explore.html?season=${a.year}-${a.season}">${SEASON_LABEL[a.season]} ${a.year}</a>` : "")}${dl("Source", esc(a.source))}
          </dl></div>
          <div class="xr-card"><span class="xr-label"><i class="fa-solid fa-building"></i> Made by</span><dl class="xr-air-rows">
            ${dl(a.studios.length > 1 ? "Studios" : "Studio", a.studios.map((s) => (s.al ? `<a href="anime-explore.html?al=${s.al}&name=${encodeURIComponent(s.name)}">${esc(s.name)}</a>` : esc(s.name))).join(", "))}
            ${dl("Producers", esc(a.producers.slice(0, 5).join(", ")))}
          </dl></div>
          <div class="xr-card ax-tags"><span class="xr-label"><i class="fa-solid fa-tags"></i> Genres &amp; themes</span>
            <div class="ax-chips">${chipLinks(a.genres, (g) => (genreId(g) ? `<a class="as-chip" href="anime-explore.html?genre=${encodeURIComponent(g)}">${esc(g)}</a>` : `<span class="as-chip">${esc(g)}</span>`))}${chipLinks(
              a.themes.concat(a.demographics),
              (t) => `<span class="as-chip ax-theme">${esc(t)}</span>`
            )}</div>
          </div>
          ${a.streaming && a.streaming.length ? `<div class="xr-card"><span class="xr-label"><i class="fa-solid fa-play"></i> Stream it on</span><div class="ax-chips">${a.streaming
            .filter((s) => safe(s.url))
            .slice(0, 8)
            .map((s) => `<a class="as-chip" href="${esc(safe(s.url))}" target="_blank" rel="noopener">${esc(s.name)}</a>`)
            .join("")}</div></div>` : ""}
        </div>
        ${a.synonyms.length ? `<p class="ax-syn"><b>Also known as:</b> ${esc(a.synonyms.slice(0, 6).join(" · "))}</p>` : ""}
      </section>
      <section class="t-section ax-lazy" data-part="characters"><h2 class="t-section-title">Characters &amp; voice actors</h2><div class="ax-part">${skeleton(6)}</div></section>
      <section class="t-section ax-lazy" data-part="staff"><h2 class="t-section-title">Staff</h2><div class="ax-part">${skeleton(6)}</div></section>
      ${relationsHtml(a)}
      <section class="t-section ax-lazy" data-part="recommendations"><h2 class="t-section-title">Fans also like</h2><div class="ax-part"><div class="movie-row">${skeleton(8)}</div></div></section>
      ${credit()}`;

    // the blurred picture behind the header: set through the DOM (the address is someone
    // else's data, so it never goes into the HTML or a style attribute as text)
    const bg = safe(a.banner) || safe(a.image);
    if (bg) root.querySelector(".ax-hero-bg").style.backgroundImage = `url(${JSON.stringify(encodeURI(bg))})`;

    // its page on Movie Nights (TMDB): to add it to your library, rate it, Watchlist…
    linkToMovieNights(a);
    root.addEventListener("click", (e) => {
      if (e.target.closest(".ax-trailer")) Cards.showTrailer({ title: a.title, trailer: a.trailer }, () => null);
      // (the anime's own page on Movie Nights: anyone can open it, account or not)
      if (e.target.closest(".ax-share"))
        UI.shareLink({ title: a.title, text: `🎌 ${a.title}${a.year ? ` (${a.year})` : ""}${a.score ? ` · ★ ${a.score.toFixed(1)}` : ""}`, url: `anime-explore.html?id=${encodeURIComponent(key)}` });
      const more = e.target.closest(".ax-more-text");
      if (more) {
        const p = more.previousElementSibling;
        p.classList.toggle("clamp");
        more.textContent = p.classList.contains("clamp") ? "Read more" : "Show less";
      }
      if (e.target.closest(".ax-chars-all")) {
        charsAll = !charsAll;
        drawCharacters();
        if (!charsAll) root.querySelector('[data-part="characters"]').scrollIntoView({ block: "start", behavior: "smooth" });
      }
      const lang = e.target.closest("[data-va]");
      if (lang) {
        vaLang = lang.dataset.va;
        drawCharacters();
      }
      const retry = e.target.closest("[data-retry]");
      if (retry) {
        const sec = retry.closest(".ax-lazy");
        delete sec.dataset.loaded;
        loadPart(sec);
      }
    });

    let chars = null;
    let vaLang = "Japanese";
    let charsAll = false; // the first 8, then "Show all"
    function drawCharacters() {
      const sec = root.querySelector('[data-part="characters"]');
      if (!chars || !chars.length) return (sec.hidden = !chars || !chars.length);
      const langs = [...new Set(chars.flatMap((c) => c.va.map((v) => v.lang)))].filter(Boolean);
      const top = ["Japanese", "English"].filter((l) => langs.includes(l));
      if (!langs.includes(vaLang)) vaLang = top[0] || langs[0] || "";
      sec.querySelector(".ax-part").innerHTML = `${top.length > 1 ? `<div class="top10-switch ax-va-switch" role="group" aria-label="Voices">${top.map((l) => `<button class="top10-tab${l === vaLang ? " active" : ""}" type="button" data-va="${l}">${l} voices</button>`).join("")}</div>` : ""}
        <div class="ax-cast">${chars
          .slice(0, charsAll ? chars.length : 8)
          .map((c) => {
            const v = c.va.find((x) => x.lang === vaLang);
            return `<div class="ax-pair">
              <span class="ax-who"><img src="${esc(safe(c.image) || "images/placeholders/avatar-placeholder.svg")}" alt="" loading="lazy" /><span><strong>${esc(c.name)}</strong><small>${esc(c.role)}</small></span></span>
              ${v ? `<span class="ax-who ax-va"><span><strong>${esc(v.name)}</strong><small>${esc(v.lang)}</small></span><img src="${esc(safe(v.image) || "images/placeholders/avatar-placeholder.svg")}" alt="" loading="lazy" /></span>` : ""}
            </div>`;
          })
          .join("")}</div>${chars.length > 8 ? `<button class="btn ax-chars-all" type="button">${charsAll ? "Show fewer" : `Show all ${chars.length} characters`}</button>` : ""}`;
    }
    function loadPart(sec) {
      if (sec.dataset.loaded) return;
      sec.dataset.loaded = "1";
      const part = sec.dataset.part;
      const box = sec.querySelector(".ax-part");
      const job = part === "characters" ? Anime.characters(key) : part === "staff" ? Anime.staff(key) : Anime.recommendations(key);
      job
        .then((list) => {
          if (part === "characters") {
            chars = list;
            return drawCharacters();
          }
          if (!list.length) return (sec.hidden = true);
          if (part === "staff")
            box.innerHTML = `<div class="ax-staff">${list
              .map((p) => `<span class="ax-who"><img src="${esc(safe(p.image) || "images/placeholders/avatar-placeholder.svg")}" alt="" loading="lazy" /><span><strong>${esc(p.name)}</strong><small>${esc(p.jobs.slice(0, 2).join(", "))}</small></span></span>`)
              .join("")}</div>`;
          else box.innerHTML = `<div class="movie-row">${list.map(card).join("")}</div>`;
        })
        .catch((e) => {
          box.innerHTML = failed(e, part);
        });
    }
    const io2 = "IntersectionObserver" in window ? new IntersectionObserver((entries) => entries.forEach((en) => en.isIntersecting && (io2.unobserve(en.target), loadPart(en.target))), { rootMargin: "300px" }) : null;
    root.querySelectorAll(".ax-lazy").forEach((s) => (io2 ? io2.observe(s) : loadPart(s)));
  }

  // related anime by kind (Sequel, Prequel, Side story…); manga etc. listed without a link
  function relationsHtml(a) {
    const groups = (a.relations || []).filter((g) => g.entries.length);
    if (!groups.length) return "";
    const order = ["Prequel", "Sequel", "Parent story", "Side Story", "Spin-Off", "Alternative version", "Summary", "Adaptation", "Character", "Other"];
    groups.sort((x, y) => (order.indexOf(x.relation) + 1 || 99) - (order.indexOf(y.relation) + 1 || 99));
    return `<section class="t-section"><h2 class="t-section-title">Related</h2><div class="ax-rel">${groups
      .map(
        (g) => `<div class="ax-rel-group"><span>${esc(g.relation)}</span><div>${g.entries
          .slice(0, 8)
          .map((e) =>
            e.key
              ? `<a class="t-crew-chip" href="anime-explore.html?id=${encodeURIComponent(e.key)}"><i class="fa-solid fa-tv"></i>${esc(e.title)}</a>`
              : `<span class="t-crew-chip ax-manga"><i class="fa-solid fa-book"></i>${esc(e.title)}</span>`
          )
          .join("")}</div></div>`
      )
      .join("")}</div></section>`;
  }

  // its Movie Nights page: TMDB's anime search, the same name and year
  async function linkToMovieNights(a) {
    const box = root.querySelector(".ax-mn");
    if (!box) return;
    const none = () => (box.innerHTML = "");
    if (!window.TMDB || !TMDB.enabled()) return none();
    try {
      const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const names = [a.titleEn, a.titleRomaji, a.title].filter(Boolean);
      let hit = null;
      for (const n of names) {
        const r = await TMDB.searchIn(n, "anime");
        const list = r.results || [];
        const wantMovie = a.type === "Movie";
        hit =
          list.find((h) => (wantMovie ? h.mediaType === "movie" : h.mediaType === "tv") && (norm(h.title) === norm(n) || (a.titleJp && h.originalTitle && h.originalTitle === a.titleJp)) && (!a.year || !h.year || Math.abs(h.year - a.year) <= 1)) ||
          list.find((h) => (wantMovie ? h.mediaType === "movie" : h.mediaType === "tv") && (!a.year || !h.year || Math.abs(h.year - a.year) <= 2)) ||
          null;
        if (hit) break;
      }
      if (!hit) return none();
      const lib = Cards.inLibrary(hit);
      box.innerHTML = lib
        ? `<a class="btn is-on" href="title.html?id=${encodeURIComponent(lib.id)}"><i class="fa-solid fa-check"></i> In your library</a>`
        : `<a class="btn" href="title.html?tmdb=${hit.mediaType}-${hit.tmdbId}"><i class="fa-solid fa-plus"></i> Add to my library</a>`;
    } catch (e) {
      none();
    }
  }
})();
