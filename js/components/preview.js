/*
 * Hover preview (Netflix style), computers only:
 * rest the mouse on a poster for a moment and a bigger card floats over it and plays
 * the trailer with sound (🔊 to mute; remembered), with the title, ratings, genres and
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
  const DELAY = 800; // ms of resting on a poster before the preview appears
  const PRELOAD = 300; // the preview is built (invisible) and the trailer starts loading this early
  const REVEAL = 250; // after it starts playing, a moment for YouTube's own title to fade

  // connect to YouTube ahead of time, so the first video starts faster
  ["https://www.youtube.com", "https://i.ytimg.com", "https://www.google.com"].forEach((href) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "";
    document.head.append(link);
  });
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
    // how much you'll probably like it (js/services/taste.js), for every title, seen or not
    if (window.Taste) {
      const m = Taste.badge({ genres: (d && d.genres && d.genres.length ? d.genres : b.genres), score: b.score ?? (d && d.tmdbScore) });
      if (m) parts.push(m);
    }
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
          round("rate", b.item.rating != null ? "Change rating" : "Rate it", "fa-solid fa-star", b.item.rating != null) +
          round("remove", "Remove from library", "fa-solid fa-trash-can", false).replace("hp-btn", "hp-btn hp-remove")
        : round("t-trailer", "Play trailer with sound", "fa-solid fa-play", false).replace("hp-btn", "hp-btn hp-play") +
          round("t-watch", "Add to Watchlist", "fa-regular fa-bookmark", false) +
          round("t-add", "Add to library", "fa-solid fa-plus", false) +
          // not out yet: Remind me (like its card), instead of Rate it
          (b.hit && b.hit.released && b.hit.released > Store.today()
            ? (() => {
                const on = !!(window.Watch && Watch.isReminded(ref.value));
                return round("t-remind", on ? "Reminder on" : "Remind me", `fa-${on ? "solid" : "regular"} fa-bell`, on);
              })()
            : round("t-rate", "Rate it", "fa-solid fa-star", false));
    return `
      <h3 class="hp-title">${esc(b.title)}</h3>
      <div class="hp-meta">${scoreHtml(b, d)}</div>
      ${genres.length ? `<div class="hp-genres">${esc(genres.join(" • "))}</div>` : ""}
      <div class="hp-actions">${buttons}<a class="hp-btn hp-more" href="${url}" aria-label="More info" title="More info"><i class="fa-solid fa-chevron-down"></i></a></div>`;
  }

  // hidden: build it (and start loading the trailer) without showing it yet
  function open(card, hidden) {
    const ref = refOf(card);
    const b = ref && basics(ref);
    if (!b) return;
    close();
    previewRef = ref;

    // the card's normal size (it grows a little while hovered), centred where it is
    const box = card.getBoundingClientRect();
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const r = { left: box.left + box.width / 2 - cw / 2, top: box.top + box.height / 2 - ch / 2, width: cw, height: ch };
    const backdrop = b.backdrop ? Store.img(b.backdrop, "w780") : Store.poster(b.poster, "w500");

    preview = document.createElement("div");
    preview.className = "hover-preview";
    preview.dataset[ref.kind === "id" ? "id" : "tmdb"] = ref.value;
    // exactly as tall as the poster card; the video fills what the text leaves
    preview.style.height = `${Math.round(r.height)}px`;
    preview.style.width = `${Math.round(r.width)}px`; // temporary, to measure the text
    preview.innerHTML = `
      <div class="hp-video">
        <img class="hp-backdrop" src="${backdrop}" alt="" />
        <button class="hp-sound" type="button" aria-label="Turn sound on" title="Sound" hidden><i class="fa-solid fa-volume-xmark"></i></button>
      </div>
      <div class="hp-info">${infoHtml(ref, null)}</div>`;
    document.body.append(preview);

    // Normally exactly as tall as the card, the video 16:9 in what the text leaves. But the
    // video is never smaller than 248px high (poster-only cards are short): then the preview
    // is a bit taller than the card, centred on it. Never wider / taller than the window.
    preview.style.width = "440px"; // to measure the text at a typical width
    const infoH = preview.querySelector(".hp-info").offsetHeight + 24; // + room for genres / details arriving later
    const videoH = Math.max(r.height - infoH, 248); // at least ~440 × 248
    // (+48px: a touch wider than 16:9, same height; the video covers it, cropped a little)
    const width = Math.round(Math.min(Math.max((videoH * 16) / 9 + 48, r.width), window.innerWidth - 24));
    const height = Math.round(Math.max(r.height, videoH + infoH));
    preview.style.width = `${width}px`;
    preview.style.height = `${height}px`;
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, 12), window.innerWidth - width - 12);
    const top = Math.min(Math.max(r.top + r.height / 2 - height / 2, 76), window.innerHeight - height - 12);
    preview.style.left = `${left}px`;
    preview.style.top = `${Math.round(top)}px`;
    preview.style.transformOrigin = `${r.left + r.width / 2 - left}px ${r.top + r.height / 2 - top}px`;
    if (!hidden) requestAnimationFrame(() => preview && (preview.classList.add("show"), trySound()));

    preview.addEventListener("mouseleave", (e) => {
      // back onto the same poster: keep it open
      const posterEl = card.isConnected && card.querySelector(".poster-link");
      if (e.relatedTarget && posterEl && posterEl.contains(e.relatedTarget)) return;
      close();
    });

    details(ref).then(async (d) => {
      if (!preview || previewRef !== ref) return;
      preview.querySelector(".hp-info").innerHTML = infoHtml(ref, d);
      if (d && d.backdrop && !b.backdrop) preview.querySelector(".hp-backdrop").src = Store.img(d.backdrop, "w780");
      // RU on: the Russian (dubbed) trailers first
      let ru = [];
      if (Lang.isRu() && d && d.tmdbId && (d.mediaType || d.media)) {
        try {
          ru = await TMDB.ruVideos(d.mediaType || d.media, d.tmdbId);
        } catch (e) {}
        if (!preview || previewRef !== ref) return;
      }
      // the trailer, then TMDB's other videos in case YouTube refuses one here
      // (videos known to be blocked are skipped)
      const keys = [...ru, d && d.key, ...((d && d.videos) || []).map((v) => v.key)].filter(
        (k, i, all) => k && all.indexOf(k) === i && !Cards.isBadTrailer(k)
      );
      preview.videoQueue = keys.slice(1);
      if (keys.length) playVideo(keys[0]);
    });
  }

  /* ---------------- the trailer (YouTube) ---------------- */

  let muted = true;

  // Sound is on by default (remembered if you mute it). Browsers only allow sound once
  // you've clicked / tapped somewhere on the page, so the video always starts muted
  // (that always works) and the sound is switched on once it's playing and on screen.
  const SOUND_KEY = "mn:previewSound";
  let wantSound = (() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch (e) {
      return true;
    }
  })();

  function paintSound() {
    const btn = preview && preview.querySelector(".hp-sound");
    if (!btn) return;
    btn.innerHTML = `<i class="fa-solid fa-volume-${muted ? "xmark" : "high"}"></i>`;
    btn.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
  }

  // always try: browsers that allow sound (site allowed to autoplay, or you've clicked on
  // the page) play it; the others pause or keep it muted, and then it carries on muted
  function trySound() {
    if (!preview || !preview.classList.contains("show") || !preview.dataset.started || !muted || !wantSound) return;
    muted = false;
    preview.dataset.soundAt = Date.now();
    send("command", "unMute");
    paintSound();
  }

  function playVideo(key) {
    const box = preview.querySelector(".hp-video");
    const origin = location.protocol === "file:" ? "" : `&origin=${encodeURIComponent(location.origin)}`;
    const iframe = document.createElement("iframe");
    iframe.className = "hp-frame";
    iframe.dataset.key = key;
    iframe.title = "Trailer";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.src =
      `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0` +
      `&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${encodeURIComponent(key)}&enablejsapi=1${origin}`;
    // ask the player to tell us when it's playing (or can't play), and nudge it to start:
    // some trailers ignore autoplay until they're told to play
    iframe.addEventListener("load", () => {
      send("listening");
      let tries = 0;
      const nudge = () => {
        if (!preview || !iframe.isConnected || preview.dataset.started || tries++ > 8) return;
        send("command", "mute");
        send("command", "playVideo");
        setTimeout(nudge, 400);
      };
      // only if it hasn't started by itself (a nudge makes YouTube flash its buttons)
      setTimeout(nudge, 1000);
    });
    // Cover the video area like a picture would (the player itself is always 16:9).
    // YouTube picks the quality from the player's size, and a ~490px player gets 360p: so
    // the player is really 1920 × 1080 (HD) and shrunk to fit with a CSS scale.
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    const fw = Math.max(bw, (bh * 16) / 9);
    iframe.style.width = "1920px";
    iframe.style.height = "1080px";
    iframe.style.setProperty("--hp-fit", String(fw / 1920));
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
        trySound();
      }, REVEAL);
    }
    // the player reports it's still muted (sound refused): show that on the button
    const info = data.event === "infoDelivery" && data.info;
    if (info && info.muted === true && !muted && preview.dataset.soundAt && Date.now() - Number(preview.dataset.soundAt) < 3000) {
      muted = true;
      paintSound();
    }
    // the browser refused the sound and paused it: carry on muted
    if (state === 2 && preview.dataset.soundAt && Date.now() - Number(preview.dataset.soundAt) < 2500) {
      delete preview.dataset.soundAt;
      muted = true;
      send("command", "mute");
      send("command", "playVideo");
      paintSound();
    }
    // YouTube won't play it here (embedding off, removed…): remember that (a real block only,
    // by YouTube's error number), and try the next video; none left: keep the picture
    if (data.event === "onError") {
      if (frame.dataset.key) Cards.markBadTrailer(frame.dataset.key, data.info);
      frame.remove();
      preview.classList.remove("playing");
      delete preview.dataset.started;
      const next = (preview.videoQueue || []).shift();
      if (next) playVideo(next);
    }
  });

  document.addEventListener("click", (e) => {
    const sound = e.target.closest(".hover-preview .hp-sound");
    if (sound) {
      muted = !muted;
      send("command", muted ? "mute" : "unMute");
      paintSound();
      // remember the choice for the next previews
      wantSound = !muted;
      try {
        localStorage.setItem(SOUND_KEY, wantSound ? "on" : "off");
      } catch (err) {}
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
    if (btn && /trailer|rate|remove/.test(btn.dataset.action)) setTimeout(close, 0);
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

  // only the poster picture starts a preview (not the title, ratings and buttons under it)
  const POSTER = ".movie-item .poster-link";

  document.addEventListener("mouseover", (e) => {
    const poster = e.target.closest && e.target.closest(POSTER);
    const card = poster && poster.closest(".movie-item");
    if (!card || card === hoverCard) return;
    cancel();
    if (preview && preview.contains(e.target)) return;
    hoverCard = card;
    const ref = refOf(card);
    if (!ref) return;
    // back on the poster whose preview is already open: nothing to do
    if (preview && previewRef && cacheKey(previewRef) === cacheKey(ref)) return;
    // not while a pop-up or a poster's right-click menu is open
    const allowed = () => hoverCard === card && card.isConnected && !document.querySelector(".overlay.active, .qa-card");
    preloadTimer = setTimeout(() => allowed() && open(card, true), PRELOAD);
    timer = setTimeout(() => {
      if (!allowed()) return;
      if (preview && previewRef && cacheKey(previewRef) === cacheKey(ref)) {
        preview.classList.add("show");
        trySound(); // already playing in the background: sound on now that you can see it
      } else open(card);
    }, DELAY);
  });

  document.addEventListener("mouseout", (e) => {
    const poster = e.target.closest && e.target.closest(POSTER);
    const card = poster && poster.closest(".movie-item");
    if (!card || card !== hoverCard) return;
    if (e.relatedTarget && poster.contains(e.relatedTarget)) return; // still on the poster
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
  window.Preview = { close: stop };

  // favorite / watchlist / rating changed: redraw the buttons (a TMDB title you just added
  // becomes a library title). Remind me on / off too.
  const redrawInfo = () => {
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
  };
  Store.onChange(redrawInfo);
  document.addEventListener("DOMContentLoaded", () => window.Watch && Watch.onChange(redrawInfo));
})();
