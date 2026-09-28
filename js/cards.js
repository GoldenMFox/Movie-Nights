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
    const needScore = window.Ratings && Ratings.needsWork(item);
    return `<article class="movie-item" data-id="${esc(item.id)}"${needScore ? " data-need-score" : ""}>
      <a class="poster-link" href="${url}" tabindex="-1" aria-hidden="true">
        <img class="movie-poster" src="${Store.poster(item.poster)}" alt="" loading="lazy" decoding="async" />
        ${item.isNew ? '<span class="new-label">NEW</span>' : ""}
        ${badges ? `<span class="badges">${badges}</span>` : ""}
      </a>
      <div class="movie-info">
        <h3 class="movie-title"><a href="${url}" title="${esc(item.title)}">${esc(item.title)}</a></h3>
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
        <img class="movie-poster" src="${Store.poster(hit.poster)}" alt="" loading="lazy" decoding="async" />
        <span class="badges"><span title="${Store.TYPE_LABEL[hit.type]}" class="type-badge">${hit.type === "movie" ? "Film" : hit.type === "anime" ? "Anime" : "TV"}</span></span>
      </a>
      <div class="movie-info">
        <h3 class="movie-title"><a href="${url}" title="${esc(hit.title)}">${esc(hit.title)}</a></h3>
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
      toast(`${hit.title} added to your library`);
    } else if (action === "t-watch") {
      addHit(hit, { watchlist: true });
      toast(`${hit.title} added to Watchlist`);
    } else if (action === "t-rate") {
      openRating(addHit(hit).id);
    } else if (action === "t-trailer") {
      showTrailer(hit, () => TMDB.detailsById(hit.mediaType, hit.tmdbId).then((d) => d && d.trailer));
    }
  }

  /* ---------------- IMDb / TMDB ratings on library cards ---------------- */

  // Cards whose rating isn't known yet ask for it once they scroll into view,
  // a few at a time (see js/ratings.js). Answers are cached, so it's once per title.
  const scoreWatcher =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              scoreWatcher.unobserve(en.target);
              const item = Store.get(en.target.dataset.id);
              if (item) Ratings.request(item);
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
      toast(on ? `❤ ${item.title} added to Favorites` : `${item.title} removed from Favorites`);
    } else if (action === "watch") {
      const on = Store.toggle(id, "watchlist");
      toast(on ? `${item.title} added to Watchlist` : `${item.title} removed from Watchlist`);
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
      fb.textContent = item ? item.title : "No poster";
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

  function buildRating() {
    ratingOverlay = makeOverlay(
      "rating-modal",
      `<div class="big-star"><i class="fa-solid fa-star"></i><p class="selected-rating"></p></div>
       <h3>Rate it</h3>
       <p class="rating-for"></p>
       <div class="stars">${Array.from({ length: 10 }, (_, i) => `<button class="star" data-value="${i + 1}" aria-label="${i + 1} out of 10"><i class="fa-solid fa-star"></i></button>`).join("")}</div>
       <p class="feedback-message" aria-live="polite"></p>
       <div class="rating-actions">
         <button class="btn save" disabled>Save rating</button>
         <button class="btn clear">Clear rating</button>
       </div>`
    );
    const stars = ratingOverlay.querySelectorAll(".star");
    const paint = (value, cls) => stars.forEach((s, i) => s.classList.toggle(cls, i < value));

    stars.forEach((star) => {
      star.addEventListener("mouseenter", () => paint(+star.dataset.value, "hover"));
      star.addEventListener("mouseleave", () => paint(0, "hover"));
      star.addEventListener("click", () => {
        picked = +star.dataset.value;
        showPicked();
      });
    });

    ratingOverlay.querySelector(".save").addEventListener("click", () => {
      if (picked == null) return;
      const item = Store.get(ratingId);
      Store.update(ratingId, { rating: picked });
      toast(`Rated ${item.title}: ${picked}/10`);
      close(ratingOverlay);
    });

    ratingOverlay.querySelector(".clear").addEventListener("click", () => {
      Store.update(ratingId, { rating: null });
      toast("Rating cleared");
      close(ratingOverlay);
    });

    function showPicked() {
      paint(picked == null ? 0 : Math.round(picked), "selected");
      ratingOverlay.querySelector(".selected-rating").textContent = picked == null ? "" : formatRating(picked);
      ratingOverlay.querySelector(".big-star i").style.transform = `scale(${picked == null ? 1 : 0.8 + picked * 0.04})`;
      ratingOverlay.querySelector(".feedback-message").textContent = picked == null ? "" : FEEDBACK[Math.round(picked)] || "";
      ratingOverlay.querySelector(".save").disabled = picked == null;
    }
    ratingOverlay.showPicked = showPicked;
  }

  function openRating(id) {
    if (!ratingOverlay) buildRating();
    const item = Store.get(id);
    ratingId = id;
    picked = item.rating;
    ratingOverlay.querySelector(".rating-for").textContent = `${item.title} (${item.year})`;
    ratingOverlay.showPicked();
    open(ratingOverlay);
  }

  /* ---------------- trailer pop-up ---------------- */

  let trailerOverlay;

  function youtubeSearchUrl(item) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.title} ${item.year} trailer`)}`;
  }

  // YouTube refuses to play embedded videos on a page opened straight from disk
  // (file://), because the page has no web address. See "Start Movie Nights.bat".
  const OPENED_AS_FILE = location.protocol === "file:";

  function embed(key) {
    const origin = OPENED_AS_FILE ? "" : `&origin=${encodeURIComponent(location.origin)}`;
    return `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0&playsinline=1${origin}" title="Trailer"
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
    showTrailer(item, () =>
      TMDB.details(item).then((d) => {
        const key = d && d.trailer;
        if (key) Store.update(item.id, { trailer: key }); // remember it: instant next time
        return key;
      })
    );
  }

  // Always plays inside the pop-up, never sends you away from the site.
  // item: {title, year, trailer?}; loadKey: async fallback that asks TMDB
  async function showTrailer(item, loadKey) {
    let key = item.trailer;

    if (!trailerOverlay) {
      trailerOverlay = makeOverlay("trailer-modal", `<div class="trailer-head"></div><div class="trailer-body"></div>`);
      trailerOverlay.onclose = () => (trailerOverlay.querySelector(".trailer-body").innerHTML = "");
    }
    trailerOverlay.querySelector(".trailer-head").textContent = `${item.title}${item.year ? ` (${item.year})` : ""} · Trailer`;
    const body = trailerOverlay.querySelector(".trailer-body");
    body.innerHTML = trailerMessage("fa-solid fa-spinner fa-spin", "Looking for the trailer…");
    open(trailerOverlay);

    if (!key && window.TMDB && TMDB.enabled()) {
      try {
        key = await loadKey();
      } catch (e) {
        console.warn(e);
      }
    }
    if (!trailerOverlay.classList.contains("active")) return;
    body.innerHTML = key
      ? embed(key)
      : trailerMessage(
          "fa-solid fa-film",
          window.TMDB && TMDB.enabled()
            ? "TMDB doesn't have a trailer for this title yet."
            : 'No trailer saved for this title. Add a TMDB key in <a href="profile.html#settings">Settings</a> to load trailers automatically.'
        );
  }

  window.Cards = {
    card,
    tmdbCard,
    inLibrary,
    addHit,
    formatRating,
    openRating,
    openTrailer,
    showTrailer,
    makeOverlay,
    openModal: open,
    closeModal: close,
    youtubeSearchUrl,
  };
})();
