/*
 * Hover preview (Netflix style), computers only:
 * rest the mouse on a poster for 1.5 s and a bigger card floats over it and plays
 * the trailer, muted (🔊 to turn the sound on), with the title, ratings, genres and
 * the usual buttons. Moving the mouse away closes it and stops the video.
 *
 * The buttons reuse the card actions in js/components/cards.js (data-action on an
 * element with data-id / data-tmdb). Trailers come from the library (item.trailer)
 * or from TMDB (cached by js/services/tmdb.js). If a title has no trailer, or
 * YouTube won't play it here, the preview simply shows the backdrop picture.
 */
(function () {
  // only with a real mouse (phones and tablets have no hover)
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const { esc } = UI;
  const DELAY = 1500; // ms of resting on a poster before the preview opens
  const PRELOAD = 500; // start looking up the trailer a bit earlier, so it's ready
  const trailerCache = new Map(); // "id:…" / "tmdb:…" -> { key, backdrop, genres, runtime, certification, score }

  let hoverCard = null; // the poster the mouse is resting on
  let timer = null;
  let preloadTimer = null;
  let preview = null; // the open preview element
  let previewRef = null; // { kind: "id" | "tmdb", value }

  /* ---------------- which title is this card? ---------------- */

  function refOf(card) {
    if (card.dataset.id) return { kind: "id", value: card.dataset.id };
    if (card.dataset.tmdb) return { kind: "tmdb", value: card.dataset.tmdb };
    return null;
  }
  const cacheKey = (ref) => `${ref.kind}:${ref.value}`;

  // basic info we already have without asking TMDB
  function basics(ref) {
    if (ref.kind === "id") {
      const item = Store.get(ref.value);
      if (!item) return null;
      return { item, title: Lang.title(item), year: item.year, type: item.type, poster: item.poster, backdrop: item.backdrop, genres: item.genres || [] };
    }
    const hit = Cards.hitOf && Cards.hitOf(ref.value);
    if (!hit) return null;
    return { hit, title: Lang.title(hit), year: hit.year, type: hit.type, poster: hit.poster, backdrop: hit.backdrop, genres: hit.genres || [], score: hit.score };
  }

  // trailer + extra details (cached; TMDB answers are cached too)
  function details(ref) {
    const k = cacheKey(ref);
    if (trailerCache.has(k)) return trailerCache.get(k);
    const b = basics(ref);
    let p;
    if (!b || !window.TMDB || !TMDB.enabled()) p = Promise.resolve({ key: b && b.item ? b.item.trailer : null });
    else if (b.item) p = TMDB.details(b.item).then((d) => Object.assign({ key: b.item.trailer || (d && d.trailer) }, d || {}));
    else {
      const [media, id] = ref.value.split("-");
      p = TMDB.detailsById(media, Number(id)).then((d) => Object.assign({ key: d && d.trailer }, d || {}));
    }
    p = p.catch(() => ({ key: null }));
    trailerCache.set(k, p);
    return p;
  }

  /* ---------------- the preview ---------------- */

  function scoreHtml(b, d) {
    const parts = [];
    if (b.item && b.item.rating != null) parts.push(`<span class="hp-mine"><i class="fa-solid fa-star"></i> ${Cards.formatRating(b.item.rating)}</span>`);
    const ext = b.item && window.Ratings ? Ratings.display(b.item) : null;
    if (ext && ext.kind === "imdb" && typeof ext.value === "number") parts.push(`<span><span class="imdb-tag">IMDb</span>${ext.value.toFixed(1)}</span>`);
    else {
      const s = ext && typeof ext.value === "number" ? ext.value : typeof b.score === "number" ? b.score : d && d.tmdbScore;
      if (typeof s === "number") parts.push(`<span><span class="tmdb-tag">TMDB</span>${s.toFixed(1)}</span>`);
    }
    if (b.year) parts.push(`<span>${b.year}</span>`);
    if (d && d.runtime) parts.push(`<span>${esc(d.runtime)}</span>`);
    if (d && d.certification) parts.push(`<span class="hp-cert">${esc(d.certification)}</span>`);
    return parts.join('<span class="dot">·</span>');
  }

  // the text + buttons part (redrawn when you favorite / rate / add something)
  function infoHtml(ref, d) {
    const b = basics(ref);
    if (!b) return "";
    const genres = (d && d.genres && d.genres.length ? d.genres : b.genres).slice(0, 3);
    const round = (action, label, icon, on) =>
      `<button class="hp-btn${on ? " on" : ""}" data-action="${action}" aria-label="${label}" title="${label}"><i class="${icon}"></i></button>`;
    const url = ref.kind === "id" ? `title.html?id=${encodeURIComponent(ref.value)}` : `title.html?tmdb=${ref.value}`;
    const buttons =
      ref.kind === "id"
        ? round("trailer", "Play trailer with sound", "fa-solid fa-play", false).replace("hp-btn", "hp-btn hp-play") +
          round("watch", b.item.watchlist ? "Remove from Watchlist" : "Add to Watchlist", `fa-${b.item.watchlist ? "solid" : "regular"} fa-bookmark`, b.item.watchlist) +
          round("fav", b.item.favorite ? "Remove favorite" : "Add to Favorites", `fa-${b.item.favorite ? "solid" : "regular"} fa-heart`, b.item.favorite) +
          round("rate", b.item.rating != null ? "Change rating" : "Rate it", "fa-solid fa-star", b.item.rating != null)
        : round("t-trailer", "Play trailer with sound", "fa-solid fa-play", false).replace("hp-btn", "hp-btn hp-play") +
          round("t-watch", "Add to Watchlist", "fa-regular fa-bookmark", false) +
          round("t-add", "Add to library", "fa-solid fa-plus", false) +
          round("t-rate", "Rate it", "fa-solid fa-star", false);
    return `
      <h3 class="hp-title">${esc(b.title)}</h3>
      <div class="hp-meta">${scoreHtml(b, d)}</div>
      ${genres.length ? `<div class="hp-genres">${esc(genres.join(" • "))}</div>` : ""}
      <div class="hp-actions">${buttons}<a class="hp-btn hp-more" href="${url}" aria-label="More info" title="More info"><i class="fa-solid fa-chevron-down"></i></a></div>`;
  }

  function open(card) {
    const ref = refOf(card);
    const b = ref && basics(ref);
    if (!b) return;
    close();
    previewRef = ref;

    const r = card.getBoundingClientRect();
    const width = Math.round(Math.min(Math.max(r.width * 1.75, 340), 480));
    const backdrop = b.backdrop ? Store.img(b.backdrop, "w780") : Store.poster(b.poster, "w500");

    preview = document.createElement("div");
    preview.className = "hover-preview";
    preview.dataset[ref.kind === "id" ? "id" : "tmdb"] = ref.value;
    preview.style.width = `${width}px`;
    preview.innerHTML = `
      <div class="hp-video">
        <img class="hp-backdrop" src="${backdrop}" alt="" />
        <button class="hp-sound" type="button" aria-label="Turn sound on" title="Sound" hidden><i class="fa-solid fa-volume-xmark"></i></button>
      </div>
      <div class="hp-info">${infoHtml(ref, null)}</div>`;
    document.body.append(preview);

    // place it over the poster, inside the window and below the navbar
    const navBottom = (document.querySelector(".site-nav") || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom;
    const h = preview.offsetHeight;
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, 12), window.innerWidth - width - 12);
    const top = Math.min(Math.max(r.top + r.height / 2 - h / 2, navBottom + 8), window.innerHeight - h - 12);
    preview.style.left = `${left}px`;
    preview.style.top = `${Math.max(top, 8)}px`;
    preview.style.transformOrigin = `${r.left + r.width / 2 - left}px ${r.top + r.height / 2 - top}px`;
    requestAnimationFrame(() => preview && preview.classList.add("show"));

    preview.addEventListener("mouseleave", (e) => {
      // back onto the same poster: keep it open
      if (e.relatedTarget && card.isConnected && card.contains(e.relatedTarget)) return;
      close();
    });

    details(ref).then((d) => {
      if (!preview || previewRef !== ref) return;
      preview.querySelector(".hp-info").innerHTML = infoHtml(ref, d);
      if (d && d.backdrop && !b.backdrop) preview.querySelector(".hp-backdrop").src = Store.img(d.backdrop, "w780");
      if (d && d.key) playVideo(d.key);
    });
  }

  /* ---------------- the trailer (YouTube, muted) ---------------- */

  let muted = true;

  function playVideo(key) {
    const box = preview.querySelector(".hp-video");
    const origin = location.protocol === "file:" ? "" : `&origin=${encodeURIComponent(location.origin)}`;
    const iframe = document.createElement("iframe");
    iframe.className = "hp-frame";
    iframe.title = "Trailer";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.src =
      `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0` +
      `&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${encodeURIComponent(key)}&enablejsapi=1${origin}`;
    // ask the player to tell us when it's playing (or can't play)
    iframe.addEventListener("load", () => send("listening"));
    box.insertBefore(iframe, box.querySelector(".hp-sound"));
    muted = true;
  }

  function send(what, func) {
    const frame = preview && preview.querySelector(".hp-frame");
    if (!frame || !frame.contentWindow) return;
    const msg = what === "listening" ? { event: "listening", id: 1, channel: "widget" } : { event: "command", func, args: [] };
    frame.contentWindow.postMessage(JSON.stringify(msg), "*");
  }

  window.addEventListener("message", (e) => {
    if (!preview || !/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
    let data;
    try {
      data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    } catch (err) {
      return;
    }
    if (!data || !data.event) return;
    const frame = preview.querySelector(".hp-frame");
    if (!frame || e.source !== frame.contentWindow) return;
    // playing: fade the video in over the picture, show the sound button
    const state = data.event === "onStateChange" ? data.info : data.event === "infoDelivery" && data.info ? data.info.playerState : undefined;
    // (a moment after it starts, once YouTube's own title / buttons have faded away)
    if (state === 1 && !preview.dataset.started) {
      preview.dataset.started = "1";
      const el = preview;
      setTimeout(() => {
        if (el !== preview || !el.querySelector(".hp-frame")) return;
        el.classList.add("playing");
        el.querySelector(".hp-sound").hidden = false;
      }, 1800);
    }
    // YouTube won't play it here (embedding off, removed…): keep the picture
    if (data.event === "onError") {
      frame.remove();
      preview.classList.remove("playing");
    }
  });

  document.addEventListener("click", (e) => {
    const sound = e.target.closest(".hover-preview .hp-sound");
    if (sound) {
      muted = !muted;
      send("command", muted ? "mute" : "unMute");
      sound.innerHTML = `<i class="fa-solid fa-volume-${muted ? "xmark" : "high"}"></i>`;
      sound.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
      return;
    }
    // clicking the video opens the title page
    const video = e.target.closest(".hover-preview .hp-video");
    if (video) {
      const more = video.closest(".hover-preview").querySelector(".hp-more");
      if (more) location.href = more.href;
      return;
    }
    // the full trailer pop-up takes over: close the preview
    const btn = e.target.closest(".hover-preview [data-action]");
    if (btn && /trailer|rate/.test(btn.dataset.action)) setTimeout(close, 0);
  });

  function close() {
    if (!preview) return;
    const el = preview;
    preview = null;
    previewRef = null;
    const frame = el.querySelector(".hp-frame");
    if (frame) frame.remove(); // stops the video straight away
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }

  /* ---------------- hovering ---------------- */

  function cancel() {
    clearTimeout(timer);
    clearTimeout(preloadTimer);
    hoverCard = null;
  }

  document.addEventListener("mouseover", (e) => {
    const card = e.target.closest && e.target.closest(".movie-item");
    if (!card || card === hoverCard) return;
    cancel();
    if (preview && preview.contains(e.target)) return;
    hoverCard = card;
    const ref = refOf(card);
    if (!ref) return;
    // back on the poster whose preview is already open: nothing to do
    if (preview && previewRef && cacheKey(previewRef) === cacheKey(ref)) return;
    preloadTimer = setTimeout(() => details(ref), PRELOAD);
    timer = setTimeout(() => {
      // not while a pop-up (rating, trailer…) is open
      if (hoverCard === card && card.isConnected && !document.querySelector(".overlay.active")) open(card);
    }, DELAY);
  });

  document.addEventListener("mouseout", (e) => {
    const card = e.target.closest && e.target.closest(".movie-item");
    if (!card || card !== hoverCard) return;
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    cancel();
    // left the poster, but not onto the preview: close it
    if (preview && !(e.relatedTarget && preview.contains(e.relatedTarget))) close();
  });

  // scrolling, switching tabs or resizing closes it
  window.addEventListener("scroll", () => (cancel(), close()), { passive: true, capture: true });
  const stop = () => (cancel(), close());
  window.addEventListener("resize", stop);
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", () => document.hidden && stop());
  document.addEventListener("keydown", (e) => e.key === "Escape" && stop());

  // favorite / watchlist / rating changed: redraw the buttons (a TMDB title you just added
  // becomes a library title)
  Store.onChange(() => {
    if (!preview || !previewRef) return;
    let ref = previewRef;
    if (ref.kind === "tmdb") {
      const hit = Cards.hitOf && Cards.hitOf(ref.value);
      const lib = hit && Cards.inLibrary(hit);
      if (lib) {
        ref = previewRef = { kind: "id", value: lib.id };
        delete preview.dataset.tmdb;
        preview.dataset.id = lib.id;
      }
    }
    Promise.resolve(trailerCache.get(cacheKey(previewRef)) || null).then((d) => {
      if (preview && previewRef === ref) preview.querySelector(".hp-info").innerHTML = infoHtml(ref, d);
    });
  });
})();
