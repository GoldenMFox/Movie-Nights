/*
 * Title page: details for one movie / show / anime.
 *   title.html?id=interstellar-2014   a title in your library
 *   title.html?tmdb=movie-157336      any title on TMDB (from Discover / recommendations)
 */
(function () {
  const { esc, toast } = UI;
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const tmdbRef = params.get("tmdb");
  const heroEl = document.getElementById("title-hero");
  const mainEl = document.getElementById("title-main");
  let extra = null; // details fetched from TMDB

  function message(icon, html) {
    heroEl.hidden = true;
    mainEl.innerHTML = `<div class="empty-state"><i class="${icon}"></i>${html}<br><br><a class="btn btn-primary" href="index.html">Back home</a></div>`;
  }

  // fields stored in the library take priority over TMDB
  function pick(item) {
    const out = {};
    ["backdrop", "genres", "runtime", "certification", "director", "overview", "cast"].forEach((k) => {
      if (item[k] != null && !(Array.isArray(item[k]) && !item[k].length)) out[k] = item[k];
    });
    return out;
  }

  function factsHtml(type, d) {
    return [
      d.certification ? `<span class="cert">${esc(d.certification)}</span>` : "",
      `<span>${Store.TYPE_LABEL[type] || ""}</span>`,
      d.genres && d.genres.length ? `<span>${esc(d.genres.join(", "))}</span>` : "",
      d.runtime ? `<span>${esc(d.runtime)}</span>` : "",
    ].join("");
  }

  function heroHtml(t, d, actions) {
    const backdrop = d.backdrop ? Store.img(d.backdrop, "w1280") : Store.img(t.poster, "w780");
    heroEl.style.backgroundImage = backdrop ? `url("${backdrop}")` : "";
    heroEl.hidden = false;
    return `<div class="container">
      <img class="title-poster" src="${Store.poster(t.poster, "w500")}" alt="${esc(t.title)} poster" />
      <div>
        <h1>${esc(t.title)} ${t.year ? `<span class="year">(${t.year})</span>` : ""}</h1>
        <div class="title-facts">${factsHtml(t.type, d)}</div>
        <div class="title-actions">${actions}</div>
        <div class="overview">
          ${d.overview ? `<h2>Overview</h2><p>${esc(d.overview)}</p>` : ""}
          ${d.director ? `<div class="credit"><strong>${esc(d.director)}</strong><span>${esc(d.directorLabel || "Director")}</span></div>` : ""}
        </div>
      </div>
    </div>`;
  }

  function castHtml(cast) {
    if (!cast || !cast.length) return "";
    return `<h2 class="section-title">Cast</h2>
      <div class="cast-list">${cast
        .map(
          (c) => `<div class="cast-card"><img src="${c.photo ? Store.img(c.photo, "w185") : "images/avatar-placeholder.svg"}" alt="" loading="lazy" />
            <div><strong>${esc(c.name)}</strong><span>${esc(c.character || "")}</span></div></div>`
        )
        .join("")}</div>`;
  }

  function recommendationsHtml(d) {
    const recs = (d && d.recommendations) || [];
    return recs.length ? `<h2 class="section-title">Recommended on TMDB</h2><div class="movie-row">${recs.map(Cards.tmdbCard).join("")}</div>` : "";
  }

  // round score badge; score is 0-10, null (none) or undefined (loading)
  function scoreRing(score, label, cls, tip) {
    const has = typeof score === "number";
    const text = has ? Cards.formatRating(score) : score === undefined ? "…" : "–";
    return `<div class="score-ring ${cls}" style="--value:${has ? score * 10 : 0}" title="${tip || label.replace("<br />", " ")}"><span>${text}</span></div>
      <div class="score-label">${label}</div>`;
  }

  // IMDb ring (TMDB when IMDb has no rating / isn't loaded yet) + Rotten Tomatoes when there is one
  function outsideScores(e, tmdbFallback) {
    let html;
    if (e && typeof e.imdb === "number") {
      html = scoreRing(e.imdb, "IMDb<br />score", "imdb", e.votes ? `IMDb rating from ${e.votes} votes` : "IMDb rating");
    } else {
      const tmdb = e && typeof e.tmdb === "number" ? e.tmdb : tmdbFallback;
      if (typeof tmdb === "number") html = scoreRing(tmdb, "TMDB<br />score", "tmdb", "TMDB rating (IMDb rating not available yet)");
      else html = scoreRing(e && e.tmdbAt ? null : undefined, Ratings.omdbEnabled() ? "IMDb<br />score" : "TMDB<br />score", Ratings.omdbEnabled() ? "imdb" : "tmdb");
    }
    if (e && e.rt) {
      const pct = parseInt(e.rt, 10);
      html += `<div class="rt-score${pct < 60 ? " rotten" : ""}" title="Rotten Tomatoes Tomatometer (critics)">
          <span class="rt-icon" aria-hidden="true">🍅</span><strong>${esc(e.rt)}</strong></div>
        <div class="score-label">Tomato-<br />meter</div>`;
    }
    return html;
  }

  const TMDB_NOTE = "Extra details from TMDB, ratings from IMDb and Rotten Tomatoes via OMDb. This product uses the TMDB API but is not endorsed or certified by TMDB.";

  /* ---------------- a title in your library ---------------- */

  function renderLibrary() {
    const item = Store.get(id);
    if (!item) return message("fa-regular fa-face-frown", "This title isn't in your library (maybe it was removed).");
    const d = Object.assign({}, extra || {}, pick(item));
    document.title = `${item.title} (${item.year}) · Movie Nights`;
    heroEl.dataset.id = item.id;

    const outside = TMDB.enabled() ? outsideScores(Ratings.entry(Ratings.refOf(item)), extra ? extra.tmdbScore : undefined) : "";
    heroEl.innerHTML = heroHtml(
      item,
      d,
      `${scoreRing(item.rating, "My<br />score", "")}
       ${outside}
       <button class="btn${item.favorite ? " is-on" : ""}" data-action="fav" aria-pressed="${!!item.favorite}">
         <i class="fa-solid fa-heart"></i> ${item.favorite ? "Favorite" : "Add to Favorites"}</button>
       <button class="btn${item.watchlist ? " is-on" : ""}" data-action="watch" aria-pressed="${!!item.watchlist}">
         <i class="fa-${item.watchlist ? "solid" : "regular"} fa-bookmark"></i> ${item.watchlist ? "On Watchlist" : "Add to Watchlist"}</button>
       <button class="btn" data-action="rate"><i class="fa-solid fa-star"></i> ${item.rating == null ? "Rate it" : "Change rating"}</button>
       <button class="btn btn-primary" data-action="trailer"><i class="fa-solid fa-play"></i> Play Trailer</button>`
    );

    const near = (a) => Math.abs((a.rating ?? 5) - (item.rating ?? 5));
    const similar = Store.all()
      .filter((i) => i.type === item.type && i.id !== item.id)
      .sort((a, b) => near(a) - near(b) || Math.abs(a.year - item.year) - Math.abs(b.year - item.year))
      .slice(0, 16);

    mainEl.innerHTML = `
      ${castHtml(d.cast)}
      ${recommendationsHtml(extra)}
      ${similar.length ? `<h2 class="section-title">More like this in your library</h2><div class="movie-row">${similar.map(Cards.card).join("")}</div>` : ""}
      <p class="tmdb-note">${
        TMDB.enabled() ? TMDB_NOTE : 'Tip: add a free TMDB API key in <a href="profile.html#settings">Settings</a> to see the overview, cast, trailer and recommendations for every title.'
      }</p>
      <p><button class="btn btn-danger remove-title" type="button"><i class="fa-solid fa-trash"></i> Remove from library</button></p>`;
  }

  function initLibrary() {
    mainEl.addEventListener("click", (e) => {
      if (!e.target.closest(".remove-title")) return;
      const item = Store.get(id);
      if (!confirm(`Remove "${item.title}" from your library?\n\nYou can bring it back with Profile -> Reset all my changes, or by restoring a backup.`)) return;
      Store.remove(id);
      toast(`${item.title} removed`);
      setTimeout(() => (location.href = "index.html"), 700);
    });

    Store.onChange((changedId) => {
      if (!changedId || changedId === id) renderLibrary();
    });

    renderLibrary();

    const item = Store.get(id);
    if (item && TMDB.enabled()) {
      // IMDb rating (uses one OMDb lookup if it isn't saved yet)
      Ratings.onChange((changedId) => changedId === id && renderLibrary());
      Ratings.request(item);

      TMDB.details(item)
        .then((details) => {
          if (!details) return;
          extra = details;
          Ratings.request(Store.get(id)); // now that the IMDb id is known
          // remember the trailer so it also works on cards and in the exported library
          if (!item.trailer && details.trailer) Store.update(id, { trailer: details.trailer });
          else renderLibrary();
        })
        .catch((e) => console.warn("TMDB:", e.message));
    }
  }

  /* ---------------- any title from TMDB ---------------- */

  async function initTmdb() {
    const [media, tmdbId] = tmdbRef.split("-");
    if (!TMDB.enabled()) return message("fa-solid fa-key", 'This page needs a TMDB API key. Add one in <a href="profile.html#settings">Profile → Settings</a>.');
    if (!/^(movie|tv)$/.test(media) || !/^\d+$/.test(tmdbId)) return message("fa-regular fa-face-frown", "That link doesn't look right.");

    heroEl.hidden = true;
    mainEl.innerHTML = '<p class="result-count">Loading…</p>';
    let d;
    try {
      d = await TMDB.detailsById(media, Number(tmdbId));
    } catch (e) {
      return message("fa-solid fa-triangle-exclamation", esc(e.message));
    }

    const goToLibrary = () => {
      const lib = Cards.inLibrary(d);
      if (lib) location.replace(`title.html?id=${encodeURIComponent(lib.id)}`);
      return !!lib;
    };
    if (goToLibrary()) return;

    Cards.tmdbCard(d); // registers it so the buttons below work
    document.title = `${d.title}${d.year ? ` (${d.year})` : ""} · Movie Nights`;
    heroEl.dataset.tmdb = tmdbRef;
    Ratings.seed(tmdbRef, d.tmdbScore, d.imdbId);
    renderExternal(d);
    mainEl.innerHTML = `${castHtml(d.cast)}${recommendationsHtml(d)}<p class="tmdb-note">${TMDB_NOTE}</p>`;
    // IMDb rating (one OMDb lookup the first time you open this title)
    Ratings.forRef(tmdbRef).then(() => heroEl.dataset.tmdb === tmdbRef && renderExternal(d));

    // once it's added, show the normal library page (but not while a pop-up is open,
    // e.g. the rating you're about to give it)
    document.addEventListener("click", () => setTimeout(() => !document.querySelector(".overlay.active") && goToLibrary(), 400));
    document.addEventListener("keydown", (e) => e.key === "Escape" && setTimeout(goToLibrary, 400));
  }

  function renderExternal(d) {
    heroEl.innerHTML = heroHtml(
      d,
      d,
      `${outsideScores(Ratings.entry(tmdbRef), d.tmdbScore)}
       <button class="btn btn-primary" data-action="t-add"><i class="fa-solid fa-plus"></i> Add to library</button>
       <button class="btn" data-action="t-watch"><i class="fa-regular fa-bookmark"></i> Add to Watchlist</button>
       <button class="btn" data-action="t-rate"><i class="fa-solid fa-star"></i> Rate it</button>
       <button class="btn" data-action="t-trailer"><i class="fa-solid fa-play"></i> Play Trailer</button>`
    );
  }

  if (tmdbRef) initTmdb();
  else initLibrary();
})();
