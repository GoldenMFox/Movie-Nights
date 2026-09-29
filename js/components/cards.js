/*
 * Cards: renders a movie card and handles its buttons (favorite, rate,
 * watchlist, trailer). Also owns the rating and trailer pop-ups.
 */
(function () {
  const { esc, toast } = UI;

  const FEEDBACK = {
    0: "Unwatchable. I want those hours back.",
    1: "Terrible. I'd rather watch paint dry.",
    2: "Disappointing. I expected more plot twists, less eye-rolls.",
    3: "Below average. About as thrilling as a slow elevator ride.",
    4: "Average. Popcorn was the highlight.",
    5: "Good. I'd give it a high-five.",
    6: "Great. My cat even stayed awake.",
    7: "Impressive. My jaw dropped more than once.",
    8: "Exceptional. It's my new favorite excuse to procrastinate.",
    9: "Fantastic. My expectations are now in therapy.",
    10: "Masterpiece. I've started a fan club!",
  };

  function formatRating(r) {
    return r == null ? "–" : Number(r).toFixed(1).replace(/\.0$/, "");
  }

  function actionButton(action, on, label, icon) {
    return `<button class="icon ${action}${on ? " on" : ""}" data-action="${action}" aria-pressed="${on}" aria-label="${label}">
      <span class="tooltip">${label}</span><span class="bubble"><i class="${icon}"></i></span></button>`;
  }

  // "My rating" and the IMDb rating (or TMDB as a fallback), side by side
  function scoreText(score) {
    return score === undefined ? "…" : score === null ? "–" : Number(score).toFixed(1);
  }

  function tmdbBadge(score) {
    return `<span class="score ext-score" title="TMDB rating"><span class="tmdb-tag">TMDB</span><span class="v">${scoreText(score)}</span></span>`;
  }

  function imdbBadge(score, votes) {
    const title = votes ? `IMDb rating (${votes} votes)` : "IMDb rating";
    return `<span class="score ext-score" title="${title}"><span class="imdb-tag">IMDb</span><span class="v">${scoreText(score)}</span></span>`;
  }

  function extBadge(item) {
    const d = Ratings.display(item);
    if (d.kind === "imdb") return imdbBadge(d.value, d.votes);
    if (d.kind === "tmdb") return tmdbBadge(d.value);
    const pending = d.kind === "loading" ? undefined : null;
    return Ratings.omdbEnabled() ? imdbBadge(pending) : tmdbBadge(pending);
  }

  function ratingsHtml(item) {
    const mine = `<span class="score mine${item.rating == null ? " unrated" : ""}" title="My rating"><i class="fa-solid fa-star"></i>${formatRating(item.rating)}</span>`;
    const on = window.TMDB && TMDB.enabled();
    return `<span class="ratings">${mine}${on ? extBadge(item) : ""}</span>`;
  }

  function card(item) {
    const url = `title.html?id=${encodeURIComponent(item.id)}`;
    const badges = [
      item.favorite ? '<span title="Favorite"><i class="fa-solid fa-heart"></i></span>' : "",
      item.watchlist ? '<span title="On watchlist"><i class="fa-solid fa-bookmark"></i></span>' : "",
    ].join("");
    const needScore = (window.Ratings && Ratings.needsWork(item)) || needsRuName(item);
    return `<article class="movie-item" data-id="${esc(item.id)}"${needScore ? " data-need-score" : ""}>
      <a class="poster-link" href="${url}" tabindex="-1" aria-hidden="true">
        <img class="movie-poster" src="${Store.poster(posterOf(item))}" alt="" loading="lazy" decoding="async" />
        ${Store.isRecent(item) ? '<span class="new-label">NEW</span>' : ""}
        ${badges ? `<span class="badges">${badges}</span>` : ""}
      </a>
      <div class="movie-info">
        <h3 class="movie-title"><a href="${url}" title="${esc(Lang.title(item))}">${esc(Lang.title(item))}</a></h3>
        <div class="movie-meta">
          ${ratingsHtml(item)}
          <span class="year">${item.year || ""}</span>
        </div>
        <div class="action-circle">
          ${actionButton("fav", !!item.favorite, item.favorite ? "Remove favorite" : "Add to Favorites", "fa-solid fa-heart")}
          ${actionButton("rate", item.rating != null, item.rating != null ? "Change rating" : "Rate it", "fa-solid fa-star")}
          ${actionButton("watch", !!item.watchlist, item.watchlist ? "Remove from Watchlist" : "Add to Watchlist", item.watchlist ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark")}
          ${actionButton("trailer", false, "Play Trailer", "fa-brands fa-youtube")}
        </div>
      </div>
    </article>`;
  }

  /* ---------------- TMDB cards (Discover page, recommendations) ---------------- */

  const hits = new Map(); // "movie-123" -> TMDB result shown on the page
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, "");

  // Is this TMDB result already in the library?
  function inLibrary(hit) {
    const t = norm(hit.title);
    return (
      Store.all().find(
        (i) =>
          (i.tmdbId && i.tmdbId === hit.tmdbId && i.tmdbMedia === hit.mediaType) ||
          (norm(i.title) === t && i.year === hit.year && (i.type === "movie") === (hit.mediaType === "movie"))
      ) || null
    );
  }

  function tmdbCard(hit) {
    const lib = inLibrary(hit);
    if (lib) {
      // already yours: show your card, and remember which TMDB entry it is
      const ref = `${hit.mediaType}-${hit.tmdbId}`;
      if (!Ratings.refOf(lib)) Ratings.setLink(lib.id, ref);
      if (Ratings.refOf(lib) === ref) Ratings.seed(ref, hit.score);
      return card(Store.get(lib.id));
    }
    const key = `${hit.mediaType}-${hit.tmdbId}`;
    hits.set(key, hit);
    const url = `title.html?tmdb=${key}`;
    return `<article class="movie-item" data-tmdb="${key}">
      <a class="poster-link" href="${url}" tabindex="-1" aria-hidden="true">
        <img class="movie-poster" src="${Store.poster(posterOf(hit))}" alt="" loading="lazy" decoding="async" />
        <span class="badges"><span title="${Store.TYPE_LABEL[hit.type]}" class="type-badge">${hit.type === "movie" ? "Film" : hit.type === "anime" ? "Anime" : "TV"}</span></span>
      </a>
      <div class="movie-info">
        <h3 class="movie-title"><a href="${url}" title="${esc(Lang.title(hit))}">${esc(Lang.title(hit))}</a></h3>
        <div class="movie-meta">
          <span class="ratings">${tmdbBadge(hit.score)}</span>
          <span class="year">${hit.year || ""}</span>
        </div>
        <div class="action-circle">
          ${actionButton("t-add", false, "Add to library", "fa-solid fa-plus")}
          ${actionButton("t-rate", false, "Rate it", "fa-solid fa-star")}
          ${actionButton("t-watch", false, "Add to Watchlist", "fa-regular fa-bookmark")}
          ${actionButton("t-trailer", false, "Play Trailer", "fa-brands fa-youtube")}
        </div>
      </div>
    </article>`;
  }

  // Add a TMDB result to the library (or return it if it's already there)
  function addHit(hit, extra) {
    const existing = inLibrary(hit);
    if (existing) {
      if (extra && Object.keys(extra).length) Store.update(existing.id, extra);
      return Store.get(existing.id);
    }
    const item = {
      title: hit.title,
      year: hit.year || new Date().getFullYear(),
      type: hit.type,
      rating: null,
      poster: hit.poster,
      tmdbId: hit.tmdbId,
      tmdbMedia: hit.mediaType,
    };
    if (hit.backdrop) item.backdrop = hit.backdrop;
    if (hit.overview) item.overview = hit.overview;
    if (hit.genres && hit.genres.length) item.genres = hit.genres;
    if (hit.titleRu) item.titleRu = hit.titleRu;
    Object.assign(item, extra || {});
    // remember its TMDB score, so the new card shows a second rating straight away
    Ratings.seed(`${hit.mediaType}-${hit.tmdbId}`, hit.score);
    return Store.add(item);
  }

  function runTmdbAction(action, key) {
    const hit = hits.get(key);
    if (!hit) return;
    if (action === "t-add") {
      addHit(hit);
      toast(`${Lang.title(hit)} added to your library`);
    } else if (action === "t-watch") {
      addHit(hit, { watchlist: true });
      toast(`${Lang.title(hit)} added to Watchlist`);
    } else if (action === "t-watched") {
      // "Watched": into the library, then a gentle "rate it?" (Skip leaves it unrated)
      openRating(addHit(hit).id, { watched: true });
    } else if (action === "t-rate") {
      openRating(addHit(hit).id);
    } else if (action === "t-trailer") {
      showTrailer(
        hit,
        () => TMDB.detailsById(hit.mediaType, hit.tmdbId).then((d) => d && d.trailer),
        () => TMDB.detailsById(hit.mediaType, hit.tmdbId).then((d) => ((d && d.videos) || []).map((v) => v.key))
      );
    }
  }

  /* ---------------- Russian names and posters (RU on) ---------------- */

  // Russian posters of library titles, looked up once and kept in this browser
  // (mn:ruPosters: { libraryId: "/path.jpg" | "" }, "" = TMDB has no other poster)
  const RU_POSTERS = "mn:ruPosters";
  let ruPosters = Store.read(RU_POSTERS, {});
  const ruOn = () => !!(window.Lang && Lang.isRu());

  // the poster to show: the Russian one while RU is on (when there is one)
  function posterOf(x) {
    if (!x) return "";
    if (ruOn()) {
      if (x.posterRu) return x.posterRu; // TMDB results
      if (x.id && ruPosters[x.id]) return ruPosters[x.id]; // library titles
    }
    return x.poster;
  }

  // library titles from data/library.js already have "titleRu"; newer ones get it, and
  // every title gets its Russian poster, from TMDB the first time it's on screen while RU is on
  function needsRuName(item) {
    return !!(ruOn() && window.TMDB && TMDB.enabled() && (!item.titleRu || ruPosters[item.id] === undefined));
  }

  const ruPending = new Set();
  async function fillRuName(item) {
    if (!needsRuName(item) || ruPending.has(item.id)) return;
    const ref = item.tmdbId && item.tmdbMedia ? `${item.tmdbMedia}-${item.tmdbId}` : Ratings.refOf(item);
    if (!ref || ref === "none") return;
    ruPending.add(item.id);
    try {
      const [media, tmdbId] = ref.split("-");
      const ru = await TMDB.ruInfo(media, Number(tmdbId));
      ruPosters = Store.read(RU_POSTERS, {});
      ruPosters[item.id] = ru.poster && ru.poster !== item.poster ? ru.poster : "";
      Store.write(RU_POSTERS, ruPosters);
      if (ruPosters[item.id]) {
        document.querySelectorAll(`.movie-item[data-id="${CSS.escape(item.id)}"] .movie-poster`).forEach((img) => (img.src = Store.poster(ruPosters[item.id])));
      }
      if (ru.title && !item.titleRu) Store.update(item.id, { titleRu: ru.title });
    } catch (e) {
      console.warn("Russian name:", item.title, e.message);
    }
  }

  /* ---------------- IMDb / TMDB ratings on library cards ---------------- */

  // Cards whose rating isn't known yet ask for it once they scroll into view,
  // a few at a time (see js/services/ratings.js). Answers are cached, so it's once per title.
  const scoreWatcher =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              scoreWatcher.unobserve(en.target);
              const item = Store.get(en.target.dataset.id);
              if (item) {
                Ratings.request(item);
                fillRuName(item);
              }
            }),
          { rootMargin: "400px" }
        )
      : null;

  let scanQueued = false;
  function scanForScores() {
    scanQueued = false;
    document.querySelectorAll(".movie-item[data-need-score]:not([data-score-watch])").forEach((el) => {
      el.dataset.scoreWatch = "1";
      if (scoreWatcher) scoreWatcher.observe(el);
      else {
        const item = Store.get(el.dataset.id);
        if (item) Ratings.request(item);
      }
    });
  }

  if (window.TMDB && TMDB.enabled()) {
    new MutationObserver(() => {
      if (!scanQueued) {
        scanQueued = true;
        setTimeout(scanForScores, 50);
      }
    }).observe(document.body, { childList: true, subtree: true });

    Ratings.onChange((id) => {
      const item = Store.get(id);
      if (!item) return;
      document.querySelectorAll(`.movie-item[data-id="${CSS.escape(id)}"]`).forEach((el) => {
        el.removeAttribute("data-need-score");
        const badge = el.querySelector(".ext-score");
        if (badge) badge.outerHTML = extBadge(item);
      });
    });
  }
  /* ---------------- button actions (one listener for the whole page) ---------------- */

  function runAction(action, id) {
    const item = Store.get(id);
    if (!item) return;
    if (action === "fav") {
      const on = Store.toggle(id, "favorite");
      toast(on ? `❤ ${Lang.title(item)} added to Favorites` : `${Lang.title(item)} removed from Favorites`);
    } else if (action === "watch") {
      const on = Store.toggle(id, "watchlist");
      toast(on ? `${Lang.title(item)} added to Watchlist` : `${Lang.title(item)} removed from Watchlist`);
    } else if (action === "rate") {
      openRating(id);
    } else if (action === "trailer") {
      openTrailer(id);
    }
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "add-title") {
      e.preventDefault();
      if (window.AddTitle) AddTitle.open();
      return;
    }
    const tmdbHolder = btn.closest("[data-tmdb]");
    if (tmdbHolder && action.startsWith("t-")) {
      e.preventDefault();
      runTmdbAction(action, tmdbHolder.dataset.tmdb);
      return;
    }
    const holder = btn.closest("[data-id]");
    if (!holder) return;
    e.preventDefault();
    runAction(action, holder.dataset.id);
  });

  // redraw cards in place when something changes
  Store.onChange((id) => {
    const selector = id ? `.movie-item[data-id="${CSS.escape(id)}"]` : ".movie-item[data-id]";
    document.querySelectorAll(selector).forEach((el) => {
      const item = Store.get(el.dataset.id);
      if (item) el.outerHTML = card(item);
    });
    // TMDB cards that were just added become normal library cards
    document.querySelectorAll(".movie-item[data-tmdb]").forEach((el) => {
      const hit = hits.get(el.dataset.tmdb);
      const lib = hit && inLibrary(hit);
      if (lib) el.outerHTML = card(lib);
    });
  });

  // mouse spotlight on cards
  document.addEventListener("mousemove", (e) => {
    const el = e.target.closest && e.target.closest(".movie-item");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  });

  // show the title when a poster fails to load
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains("movie-poster")) return;
      const holder = img.closest("[data-id]");
      const item = holder && Store.get(holder.dataset.id);
      img.style.visibility = "hidden";
      const fb = document.createElement("span");
      fb.className = "poster-fallback";
      fb.textContent = item ? Lang.title(item) : "No poster";
      img.after(fb);
    },
    true
  );

  /* ---------------- modal helper ---------------- */

  function makeOverlay(className, inner) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="modal ${className}" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="Close"><i class="fa-regular fa-circle-xmark"></i></button>${inner}</div>`;
    document.body.append(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest(".modal-close")) close(overlay);
    });
    return overlay;
  }

  let lastFocus = null;
  function open(overlay) {
    lastFocus = document.activeElement;
    overlay.classList.add("active");
    const first = overlay.querySelector(".star, input, button:not(.modal-close)");
    if (first) setTimeout(() => first.focus(), 60);
  }

  function close(overlay) {
    overlay.classList.remove("active");
    if (overlay.onclose) overlay.onclose();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".overlay.active").forEach(close);
  });

  /* ---------------- rating pop-up ---------------- */

  let ratingOverlay, ratingId, picked;
  let ratingWatched = false; // opened by "Watched": "Skip for now" instead of "Clear rating"

  function buildRating() {
    ratingOverlay = makeOverlay(
      "rating-modal",
      `<div class="big-star"><i class="fa-solid fa-star"></i><p class="selected-rating"></p></div>
       <h3>Rate it</h3>
       <p class="rating-for"></p>
       <div class="stars">${Array.from(
         { length: 10 },
         (_, i) => `<button class="star" data-value="${i + 1}" aria-label="${i + 1} out of 10 (left half: ${i + 0.5})">
           <i class="fa-solid fa-star star-base"></i><i class="fa-solid fa-star star-fill" aria-hidden="true"></i></button>`
       ).join("")}</div>
       <p class="half-hint">Tip: the left half of a star gives a half point (e.g. 7.5)</p>
       <p class="feedback-message" aria-live="polite"></p>
       <div class="rating-actions">
         <button class="btn save" disabled>Save rating</button>
         <button class="btn clear">Clear rating</button>
       </div>`
    );
    const stars = ratingOverlay.querySelectorAll(".star");
    // paint up to a value in half steps: whole stars full, a .5 as a half star
    // (kind: "selected" for your rating, "hover" while pointing)
    const paint = (value, kind) =>
      stars.forEach((s, i) => {
        s.classList.toggle(`${kind}-full`, value >= i + 1);
        s.classList.toggle(`${kind}-half`, value >= i + 0.5 && value < i + 1);
      });
    // left half of a star = x.5, right half = the whole number
    const valueAt = (star, e) => {
      const r = star.getBoundingClientRect();
      const n = +star.dataset.value;
      return e.clientX - r.left < r.width / 2 ? n - 0.5 : n;
    };

    stars.forEach((star) => {
      star.addEventListener("pointermove", (e) => paint(valueAt(star, e), "hover"));
      star.addEventListener("pointerleave", () => paint(0, "hover"));
      star.addEventListener("click", (e) => {
        // keyboard (Enter / Space) has no position: whole star
        picked = e.detail === 0 ? +star.dataset.value : valueAt(star, e);
        showPicked();
      });
    });
    ratingOverlay.querySelector(".stars").addEventListener("pointerleave", () => paint(0, "hover"));

    ratingOverlay.querySelector(".save").addEventListener("click", () => {
      if (picked == null) return;
      const item = Store.get(ratingId);
      Store.update(ratingId, { rating: picked });
      toast(`Rated ${Lang.title(item)}: ${formatRating(picked)}/10`);
      close(ratingOverlay);
    });

    ratingOverlay.querySelector(".clear").addEventListener("click", () => {
      if (ratingWatched) {
        // just watched, no rating yet: it stays in the library, unrated
        toast(`${Lang.title(Store.get(ratingId))} added to your library`);
      } else {
        Store.update(ratingId, { rating: null });
        toast("Rating cleared");
      }
      close(ratingOverlay);
    });

    function showPicked() {
      paint(picked == null ? 0 : picked, "selected");
      ratingOverlay.querySelector(".selected-rating").textContent = picked == null ? "" : formatRating(picked);
      ratingOverlay.querySelector(".big-star i").style.transform = `scale(${picked == null ? 1 : 0.8 + picked * 0.04})`;
      ratingOverlay.querySelector(".feedback-message").textContent = picked == null ? "" : FEEDBACK[Math.floor(picked)] || "";
      ratingOverlay.querySelector(".save").disabled = picked == null;
    }
    ratingOverlay.showPicked = showPicked;
  }

  // opts.watched: opened right after "Watched" (a gentle "rate it?", with Skip)
  function openRating(id, opts) {
    if (!ratingOverlay) buildRating();
    const item = Store.get(id);
    ratingId = id;
    picked = item.rating;
    ratingWatched = !!(opts && opts.watched);
    ratingOverlay.querySelector("h3").textContent = ratingWatched ? "Watched it? Rate it" : "Rate it";
    ratingOverlay.querySelector(".clear").textContent = ratingWatched ? "Skip for now" : "Clear rating";
    ratingOverlay.querySelector(".rating-for").textContent = `${Lang.title(item)} (${item.year})`;
    ratingOverlay.showPicked();
    open(ratingOverlay);
  }

  /* ---------------- trailer pop-up ---------------- */

  let trailerOverlay;

  // YouTube refuses to play embedded videos on a page opened straight from disk
  // (file://), because the page has no web address. See "Start Movie Nights.bat".
  const OPENED_AS_FILE = location.protocol === "file:";

  function embed(key) {
    const origin = OPENED_AS_FILE ? "" : `&origin=${encodeURIComponent(location.origin)}`;
    return `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0&playsinline=1&enablejsapi=1${origin}" title="Trailer"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      ${
        OPENED_AS_FILE
          ? `<p class="trailer-note"><i class="fa-solid fa-circle-info"></i> If the video says "Watch on YouTube": you opened the site by
             double-clicking the HTML file, and YouTube blocks trailers there. Open it with <strong>Start Movie Nights.bat</strong>
             (in the site folder) and trailers will play right here.</p>`
          : ""
      }`;
  }

  function trailerMessage(icon, text) {
    return `<div class="trailer-message"><i class="${icon}"></i><p>${text}</p></div>`;
  }

  function openTrailer(id) {
    const item = Store.get(id);
    showTrailer(
      item,
      () =>
        TMDB.details(item).then((d) => {
          const key = d && d.trailer;
          if (key) Store.update(item.id, { trailer: key }); // remember it: instant next time
          return key;
        }),
      () => TMDB.details(item).then((d) => ((d && d.videos) || []).map((v) => v.key))
    );
  }

  /* Some YouTube videos can't be played on other websites (their owner turned embedding
     off: "Video unavailable"). The player reports it (onError 101 / 150), and then the next
     trailer / teaser TMDB lists for the title plays instead. Blocked videos are remembered
     (mn:badTrailers) and skipped from then on; a library title keeps the one that worked. */
  const BAD_TRAILERS = "mn:badTrailers";
  const isBadTrailer = (key) => Store.read(BAD_TRAILERS, []).includes(key);
  function markBadTrailer(key) {
    const list = Store.read(BAD_TRAILERS, []);
    if (!list.includes(key)) Store.write(BAD_TRAILERS, list.concat(key).slice(-300));
  }

  let trailerRun = null; // { item, key, tried: Set, nextAlt(), frame }

  // "movie-157336" for a TMDB result or a library title (null when it isn't matched on TMDB)
  function titleRefOf(x) {
    if (!x) return null;
    if (x.mediaType && x.tmdbId) return `${x.mediaType}-${x.tmdbId}`;
    if (x.tmdbMedia && x.tmdbId) return `${x.tmdbMedia}-${x.tmdbId}`;
    const r = x.id && window.Ratings ? Ratings.refOf(x) : null;
    return r && r !== "none" ? r : null;
  }

  // Always plays inside the pop-up, never sends you away from the site.
  // item: {title, year, trailer?}; loadKey: async fallback that asks TMDB;
  // loadVideos (optional): async list of other video keys to try if YouTube refuses one
  async function showTrailer(item, loadKey, loadVideos) {
    // with TMDB on, ask it for the best-quality trailer (details are cached, so it's quick);
    // the saved one is the fallback
    const tmdbOn = !!(window.TMDB && TMDB.enabled() && loadVideos);
    let key = !tmdbOn && item.trailer && !isBadTrailer(item.trailer) ? item.trailer : null;

    if (!trailerOverlay) {
      trailerOverlay = makeOverlay("trailer-modal", `<div class="trailer-head"></div><div class="trailer-body"></div>`);
      trailerOverlay.onclose = () => {
        trailerOverlay.querySelector(".trailer-body").innerHTML = "";
        trailerRun = null;
      };
    }
    trailerOverlay.querySelector(".trailer-head").innerHTML = `<span class="th-kicker"><i class="fa-solid fa-play"></i> Trailer</span>
      <h2 class="th-title">${esc(Lang.title(item))}</h2>${item.year ? `<span class="th-year">${item.year}</span>` : ""}`;    const body = trailerOverlay.querySelector(".trailer-body");
    body.innerHTML = trailerMessage("fa-solid fa-spinner fa-spin", "Looking for the trailer…");
    open(trailerOverlay);

    const run = { item, key: null, first: item.trailer || null, tried: new Set(), alts: null, ruAlts: [] };
    trailerRun = run;

    // RU on: the Russian (dubbed) trailers first, then the usual ones
    const ref = ruOn() && window.TMDB && TMDB.enabled() ? titleRefOf(item) : null;
    if (ref) {
      try {
        const [media, tmdbId] = ref.split("-");
        const ru = (await TMDB.ruVideos(media, Number(tmdbId))).filter((k) => !isBadTrailer(k));
        if (ru.length) {
          key = ru[0];
          run.ruAlts = ru.slice(1);
          run.ru = true;
        }
      } catch (e) {}
    }

    run.nextAlt = async () => {
      while (run.ruAlts.length) {
        const k = run.ruAlts.shift();
        if (k && !run.tried.has(k) && !isBadTrailer(k)) return k;
      }
      if (!run.alts) {
        try {
          run.alts = loadVideos && window.TMDB && TMDB.enabled() ? await loadVideos() : [];
        } catch (e) {
          run.alts = [];
        }
      }
      while (run.alts.length) {
        const k = run.alts.shift();
        if (k && !run.tried.has(k) && !isBadTrailer(k)) return k;
      }
      return null;
    };

    if (!key && window.TMDB && TMDB.enabled()) {
      try {
        key = await loadKey();
      } catch (e) {
        console.warn(e);
      }
      if (key && isBadTrailer(key)) key = null;
    }
    if (!key && item.trailer && !isBadTrailer(item.trailer)) key = item.trailer;
    if (!key) key = await run.nextAlt();
    if (trailerRun !== run || !trailerOverlay.classList.contains("active")) return;
    if (key) return playTrailer(run, key);
    body.innerHTML = trailerMessage(
      "fa-solid fa-film",
      run.first
        ? `This trailer can only be played on YouTube. <a href="https://www.youtube.com/watch?v=${encodeURIComponent(run.first)}" target="_blank" rel="noopener">Watch it on YouTube</a>`
        : window.TMDB && TMDB.enabled()
        ? "TMDB doesn't have a trailer for this title yet."
        : 'No trailer saved for this title. Add a TMDB key in <a href="profile.html#settings">Settings</a> to load trailers automatically.'
    );
  }

  function playTrailer(run, key) {
    run.key = key;
    run.tried.add(key);
    run.ok = false;
    const body = trailerOverlay.querySelector(".trailer-body");
    body.innerHTML = embed(key);
    run.frame = body.querySelector("iframe");
    // ask the player to report back (errors, playing)
    run.frame.addEventListener("load", () => {
      try {
        run.frame.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
      } catch (e) {}
    });
  }

  window.addEventListener("message", async (e) => {
    const run = trailerRun;
    if (!run || !run.frame || e.source !== run.frame.contentWindow) return;
    let data;
    try {
      data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    } catch (err) {
      return;
    }
    if (!data) return;
    const state = data.event === "onStateChange" ? data.info : data.info && data.info.playerState;
    // it plays: a library title remembers this video
    if ((state === 1 || state === 3) && !run.ok) {
      run.ok = true;
      // (a Russian trailer isn't saved: the library keeps the original one)
      if (!run.ru && run.item && run.item.id && Store.get(run.item.id) && run.item.trailer !== run.key) Store.update(run.item.id, { trailer: run.key });
    }
    // refused (embedding off, removed, private…): the next video, or a link to YouTube
    if (data.event === "onError") {
      const bad = run.key;
      markBadTrailer(bad);
      const next = await run.nextAlt();
      if (trailerRun !== run) return;
      if (next) playTrailer(run, next);
      else
        trailerOverlay.querySelector(".trailer-body").innerHTML = trailerMessage(
          "fa-brands fa-youtube",
          `This trailer can only be played on YouTube. <a href="https://www.youtube.com/watch?v=${encodeURIComponent(bad)}" target="_blank" rel="noopener">Watch it on YouTube</a>`
        );
    }
  });

  /* ---------------- NEW label: exact release dates ---------------- */

  // Store.isRecent needs the release date; titles only keep their year. Look it up on
  // TMDB for this and last year's titles (a few dozen at most), once, and remember it.
  // Unreleased titles and ones TMDB had no date for are checked again after a week.
  const RELEASES = "mn:releases3"; // 3: movies use the cinema date in your country
  try {
    ["mn:releases", "mn:releases2"].forEach((k) => localStorage.removeItem(k)); // earlier versions
  } catch (e) {}
  async function lookUpReleases() {
    if (!window.TMDB || !TMDB.enabled() || !window.Ratings) return;
    const saved = Store.read(RELEASES, {});
    const today = new Date().toISOString().slice(0, 10);
    const stale = (r) => !r || (Date.now() - r.at > 7 * 86400000 && (!r.d || r.d > today));
    const minYear = new Date().getFullYear() - 1;
    const todo = Store.all().filter((i) => Number(i.year) >= minYear && stale(saved[i.id]));
    if (!todo.length) return;
    for (const item of todo) {
      try {
        let ref = Ratings.refOf(item);
        if (!ref) {
          const m = await TMDB.findMatch(item);
          ref = m ? `${m.media}-${m.id}` : "none";
          Ratings.setLink(item.id, ref);
        }
        const [media, id] = ref.split("-");
        saved[item.id] = { d: ref === "none" ? "" : await TMDB.releaseDate(media, id), at: Date.now() };
      } catch (e) {
        break; // offline / TMDB trouble: try again next time
      }
    }
    Store.write(RELEASES, saved);
    // put the label on (or take it off) the cards already on the page
    document.querySelectorAll(".movie-item[data-id]").forEach((el) => {
      const item = Store.get(el.dataset.id);
      const img = el.querySelector(".poster-link .movie-poster");
      if (!item || !img) return;
      const label = el.querySelector(".poster-link .new-label");
      if (Store.isRecent(item) && !label) img.insertAdjacentHTML("afterend", '<span class="new-label">NEW</span>');
      if (!Store.isRecent(item) && label) label.remove();
    });
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(lookUpReleases, 1200));

  window.Cards = {
    card,
    tmdbCard,
    inLibrary,
    hitOf: (key) => hits.get(key), // the TMDB result behind a card (hover preview)
    posterOf,
    isBadTrailer,
    markBadTrailer,
    formatRating,
    showTrailer,
    makeOverlay,
    openModal: open,
    closeModal: close,
  };
})();
