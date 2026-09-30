/*
 * Soundtrack (title page): the title's soundtrack album from Apple Music (the free iTunes
 * Search API, no key): the cover, the album, the artist, the tracks, and a 30-second
 * preview of each (Apple's own). A record slides out from behind the cover and spins while
 * a preview plays; when one ends, the next one starts. Soundtrack and score albums both
 * found: a switch between them. Nothing on Apple Music: no section.
 *
 * Asked only when the section comes near the screen, then kept for this visit
 * (sessionStorage mn:st:<movie-603>).
 *
 *   Soundtrack.html(d)          the section (d: the title's TMDB details)
 *   Soundtrack.mount(root, d)   after the page is drawn: fills it in when it's near
 */
(function () {
  const { esc } = UI;
  const API = "https://itunes.apple.com";
  const cache = new Map(); // key -> { albums: [...], pick: index } | "none"

  const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  const keyOf = (d) => (d && d.tmdbId ? `${d.media || d.mediaType}-${d.tmdbId}` : null);
  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;
  // "James Newton Howard & Hans Zimmer" = "Hans Zimmer & James Newton Howard"
  const people = (s) => String(s || "").toLowerCase().split(/\s*(?:&|,| and )\s*/).map(norm).filter(Boolean).sort().join("|");
  const sameArtists = (a, b) => people(a) === people(b);
  const art = (url, size) => String(url || "").replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);

  // the album's name without "(Original Motion Picture Soundtrack)" and the like
  const baseName = (name) =>
    String(name || "")
      .replace(/\s*[([].*?[)\]]/g, "")
      .replace(/\s*[-–:]\s*(original|music|the score|soundtrack|ost|score|songs).*$/i, "")
      .trim();
  // what kind of album: shown on the switch
  function kindOf(name) {
    if (/score/i.test(name) && !/soundtrack/i.test(name)) return "Score";
    if (/deluxe|collector|expanded|complete|anniversary/i.test(name)) return "Deluxe";
    if (/vol\.?\s*(\d+)/i.test(name)) return `Vol. ${/vol\.?\s*(\d+)/i.exec(name)[1]}`;
    if (/inspired by/i.test(name)) return "Inspired by";
    return "Soundtrack";
  }

  // how well an album fits the title (null: not it)
  function fit(a, title, year) {
    const name = a.collectionName || "";
    if (/karaoke|tribute|lullab|piano (version|covers?)|8-bit|cover version|string quartet|made famous|as made/i.test(name)) return null;
    const b = norm(baseName(name));
    const t = norm(title);
    const after = name.slice(0, title.length + 3).slice(title.length);
    if (!(b === t || (norm(name).startsWith(t) && /^\s*[:\-–(]/.test(after)))) return null;
    let s = 0;
    if (/soundtrack|motion picture|original score|music from|original series|television series|the score|ost\b/i.test(name)) s += 5;
    else s -= 2;
    if ((a.trackCount || 0) < 3) s -= 4;
    const y = Number(String(a.releaseDate || "").slice(0, 4));
    if (year && y) {
      const off = y - year;
      if (off >= -1 && off <= 1) s += 3;
      else if (off > 1 && off <= 3) s += 1;
      // (an older film's music often came out on an album years later)
      else if (off > 3 && year < 1990) s += 0;
      else s -= 5; // a remake's, a sequel's
    }
    return s;
  }

  async function search(term) {
    const r = await fetch(`${API}/search?term=${encodeURIComponent(term)}&media=music&entity=album&limit=25&country=US`);
    if (!r.ok) throw new Error(`iTunes ${r.status}`);
    return (await r.json()).results || [];
  }

  async function find(d) {
    const key = keyOf(d);
    const saved = sessionStorage.getItem(`mn:st:${key}`);
    if (saved) return JSON.parse(saved);
    const title = d.title;
    const year = d.year;
    let found = [];
    for (const term of [`${title} soundtrack`, title]) {
      const list = await search(term);
      found = list
        .map((a) => ({ a, s: fit(a, title, year) }))
        .filter((x) => x.s != null && x.s >= 3)
        .sort((x, y) => y.s - x.s || (y.a.trackCount || 0) - (x.a.trackCount || 0));
      if (found.length) break;
    }
    // one album per kind, at most three: the soundtrack first, then the score, then the rest
    const ORDER = ["Soundtrack", "Score", "Deluxe", "Inspired by"];
    const rank = (a) => (ORDER.indexOf(kindOf(a.collectionName)) + 1 || ORDER.length + 1);
    found.sort((x, y) => rank(x.a) - rank(y.a));
    const kinds = new Set();
    const albums = [];
    found.forEach(({ a }) => {
      const kind = kindOf(a.collectionName);
      if (kinds.has(kind) || albums.length >= 3) return;
      kinds.add(kind);
      albums.push({
        id: a.collectionId,
        name: a.collectionName,
        kind,
        artist: a.artistName,
        year: String(a.releaseDate || "").slice(0, 4),
        art: a.artworkUrl100,
        url: a.collectionViewUrl,
        count: a.trackCount,
        tracks: null,
      });
    });
    const out = albums.length ? { albums, pick: 0 } : "none";
    try {
      sessionStorage.setItem(`mn:st:${key}`, JSON.stringify(out));
    } catch (e) {}
    return out;
  }

  async function tracks(key, album) {
    if (album.tracks) return album.tracks;
    const r = await fetch(`${API}/lookup?id=${album.id}&entity=song&limit=200&country=US`);
    const j = await r.json();
    album.tracks = (j.results || [])
      .filter((t) => t.wrapperType === "track" && t.kind === "song")
      .sort((a, b) => (a.discNumber || 1) - (b.discNumber || 1) || (a.trackNumber || 0) - (b.trackNumber || 0))
      .map((t) => ({ name: t.trackName, artist: t.artistName, ms: t.trackTimeMillis || 0, preview: t.previewUrl || "", url: t.trackViewUrl || "" }));
    try {
      sessionStorage.setItem(`mn:st:${key}`, JSON.stringify(cache.get(key)));
    } catch (e) {}
    return album.tracks;
  }

  /* ---------------- the player (one for the page) ---------------- */

  const audio = new Audio();
  audio.preload = "none";
  audio.volume = 0.85;
  let playing = null; // { key, album (id), n }

  function rowEls() {
    return playing ? document.querySelectorAll(`.t-sound[data-st="${playing.key}"] .st-track`) : [];
  }
  function paintPlayer() {
    document.querySelectorAll(".t-sound").forEach((sec) => {
      const on = playing && sec.dataset.st === playing.key && Number(sec.dataset.album) === playing.album;
      sec.classList.toggle("is-playing", !!(on && !audio.paused));
      sec.querySelectorAll(".st-track").forEach((row, n) => {
        const me = on && n === playing.n;
        row.classList.toggle("on", !!me);
        row.classList.toggle("paused", !!(me && audio.paused));
        const b = row.querySelector(".st-play i");
        if (b) b.className = me && !audio.paused ? "fa-solid fa-pause" : "fa-solid fa-play";
        if (!me) row.style.removeProperty("--p");
      });
      const all = sec.querySelector(".st-all");
      if (all) all.innerHTML = on && !audio.paused ? '<i class="fa-solid fa-pause"></i> Pause' : '<i class="fa-solid fa-play"></i> Play previews';
      // now playing: the track, under the album
      const now = sec.querySelector(".st-now");
      if (now) {
        const row = on && sec.querySelectorAll(".st-name")[playing.n];
        now.hidden = !row;
        now.classList.toggle("paused", !!(on && audio.paused));
        if (row) now.querySelector(".st-now-name").textContent = row.querySelector("b").textContent;
      }
      // (the track playing stays in view in the list)
      const cur = on && sec.querySelectorAll(".st-track")[playing.n];
      const box = sec.querySelector("ol.st-tracks");
      if (cur && box && (cur.offsetTop < box.scrollTop || cur.offsetTop + cur.offsetHeight > box.scrollTop + box.clientHeight)) box.scrollTop = cur.offsetTop - box.clientHeight / 3;
    });
  }

  function play(key, album, n) {
    const t = album.tracks && album.tracks[n];
    if (!t) return;
    if (!t.preview) return play(key, album, n + 1); // (no preview: the next one)
    if (playing && playing.key === key && playing.album === album.id && playing.n === n) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return paintPlayer();
    }
    playing = { key, album: album.id, n };
    audio.src = t.preview;
    audio.play().catch(() => {});
    paintPlayer();
  }
  audio.addEventListener("timeupdate", () => {
    const row = rowEls()[playing ? playing.n : -1];
    if (row && audio.duration) row.style.setProperty("--p", `${(audio.currentTime / audio.duration) * 100}%`);
    const bar = playing && document.querySelector(`.t-sound[data-st="${playing.key}"] .st-now-bar i`);
    if (bar && audio.duration) bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });
  audio.addEventListener("play", paintPlayer);
  audio.addEventListener("pause", paintPlayer);
  // one ends: the next one
  audio.addEventListener("ended", () => {
    if (!playing) return;
    const data = cache.get(playing.key);
    const album = data && data !== "none" && data.albums.find((a) => a.id === playing.album);
    if (album && playing.n + 1 < album.tracks.length) play(playing.key, album, playing.n + 1);
    else {
      playing = null;
      paintPlayer();
    }
  });
  // a trailer or video starts: the music stops
  document.addEventListener(
    "click",
    () =>
      setTimeout(() => {
        if (!audio.paused && document.querySelector(".overlay.active .trailer-modal, .overlay.active iframe")) audio.pause();
      }, 150),
    true
  );

  /* ---------------- the section ---------------- */

  // a track's name without the tags every row repeats: "(Instrumental)", "(From …)"
  const cleanName = (s) =>
    String(s || "")
      .replace(/\s*[([](instrumental|score|original[^)\]]*|from [^)\]]*|soundtrack version|film version)[)\]]\s*$/i, "")
      .trim() || s;
  // the track's artist only when it isn't the album's ("James Horner & Orchestra" for James Horner: no)
  const otherArtist = (t, album) => t.artist && !sameArtists(t.artist, album.artist) && !norm(t.artist).startsWith(norm(album.artist.split(/[&,]/)[0]));

  function bodyHtml(key, data) {
    if (!data) return '<p class="muted t-empty st-loading"><i class="fa-solid fa-compact-disc fa-spin"></i> Looking for the soundtrack…</p>';
    const album = data.albums[data.pick];
    const list = album.tracks;
    const total = list ? list.reduce((s, t) => s + t.ms, 0) : 0;
    const switcher =
      data.albums.length > 1
        ? `<div class="top10-switch st-switch" role="tablist" aria-label="Albums">${data.albums
            .map((a, n) => `<button class="top10-tab${n === data.pick ? " active" : ""}" type="button" role="tab" aria-selected="${n === data.pick}" data-st-album="${n}">${esc(a.kind)}</button>`)
            .join("")}</div>`
        : "";
    return `<div class="st-card" style="--art:url('${esc(art(album.art, 300))}')">
      <div class="st-side">
        <div class="st-cover">
          <span class="st-vinyl" aria-hidden="true" style="--art:url('${esc(art(album.art, 200))}')"></span>
          <img src="${esc(art(album.art, 600))}" alt="" loading="lazy" />
        </div>
        <div class="st-info">
          <small>${esc(album.kind === "Score" ? "Score" : "Soundtrack")}${album.year ? ` · ${esc(album.year)}` : ""}</small>
          <h3 title="${esc(album.name)}">${esc(baseName(album.name) || album.name)}</h3>
          <p>${esc(album.artist)}</p>
          <p class="st-meta">${list ? `${list.length} tracks${total ? ` · ${Math.round(total / 60000)} min` : ""}` : ""}</p>
          ${switcher}
          <div class="st-buttons">
            <button class="btn btn-primary st-all" type="button"${list && list.some((t) => t.preview) ? "" : " disabled"}><i class="fa-solid fa-play"></i> Play previews</button>
            <a class="btn st-apple" href="${esc(album.url)}" target="_blank" rel="noopener" aria-label="Open on Apple Music" title="Open on Apple Music"><i class="fa-brands fa-apple"></i> Music</a>
          </div>
          <div class="st-now" hidden><span class="st-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="st-now-name"></span><span class="st-now-bar"><i></i></span></div>
        </div>
      </div>
      ${
        list
          ? `<ol class="st-tracks">${list
              .map(
                (t, n) => `<li class="st-track${t.preview ? "" : " no-preview"}">
                  <button class="st-play" type="button" data-st-track="${n}" aria-label="Play ${esc(t.name)}"${t.preview ? "" : " disabled"}><span class="st-n">${n + 1}</span><i class="fa-solid fa-play"></i></button>
                  <span class="st-name" title="${esc(t.name)}"><b>${esc(cleanName(t.name))}</b>${otherArtist(t, album) ? `<small>${esc(t.artist)}</small>` : ""}</span>
                  <time>${t.ms ? mmss(t.ms) : ""}</time>
                </li>`
              )
              .join("")}</ol>`
          : '<p class="muted t-empty st-tracks"><i class="fa-solid fa-spinner fa-spin"></i> Loading the tracks…</p>'
      }
    </div>
    <p class="st-note"><i class="fa-solid fa-circle-info"></i> 30-second previews from Apple Music</p>`;
  }

  function html(d) {
    const key = keyOf(d);
    if (!key || !d.title) return "";
    const data = cache.get(key);
    if (data === "none") return "";
    const album = data && data.albums[data.pick];
    return `<section class="t-section t-sound" data-st="${esc(key)}"${album ? ` data-album="${album.id}"` : ""}>
        <h2 class="t-section-title"><i class="fa-solid fa-music"></i> Soundtrack</h2>
        <div class="st-body">${bodyHtml(key, data)}</div>
      </section>`;
  }

  // draw it again wherever it is on the page (the page may have been redrawn meanwhile)
  function repaint(key) {
    const data = cache.get(key);
    document.querySelectorAll(`.t-sound[data-st="${key}"]`).forEach((sec) => {
      if (data === "none") return sec.remove();
      const album = data.albums[data.pick];
      sec.dataset.album = album.id;
      sec.querySelector(".st-body").innerHTML = bodyHtml(key, data);
    });
    paintPlayer();
  }

  async function load(key, d) {
    if (cache.has(key)) return;
    cache.set(key, null);
    let data;
    try {
      data = await find(d);
    } catch (e) {
      data = "none";
    }
    cache.set(key, data);
    repaint(key);
    if (data !== "none") {
      await tracks(key, data.albums[data.pick]).catch(() => (data.albums[data.pick].tracks = []));
      repaint(key);
    }
  }

  let io = null;
  const pending = new Map(); // key -> d
  function mount(root, d) {
    const sec = root.querySelector(".t-sound");
    if (!sec) return;
    const key = sec.dataset.st;
    if (cache.has(key)) return paintPlayer();
    pending.set(key, d);
    if (!io)
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            io.unobserve(en.target);
            const k = en.target.dataset.st;
            if (pending.has(k)) load(k, pending.get(k));
          }),
        { rootMargin: "400px 0px" }
      );
    io.observe(sec);
  }

  document.addEventListener("click", async (e) => {
    const sec = e.target.closest(".t-sound");
    if (!sec) return;
    const key = sec.dataset.st;
    const data = cache.get(key);
    if (!data || data === "none") return;
    const album = data.albums[data.pick];
    const tab = e.target.closest("[data-st-album]");
    if (tab) {
      data.pick = Number(tab.dataset.stAlbum);
      repaint(key);
      await tracks(key, data.albums[data.pick]).catch(() => (data.albums[data.pick].tracks = []));
      return repaint(key);
    }
    const tr = e.target.closest("[data-st-track]");
    if (tr) return play(key, album, Number(tr.dataset.stTrack));
    if (e.target.closest(".st-all")) {
      if (playing && playing.key === key && playing.album === album.id) {
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
        return;
      }
      return play(key, album, 0);
    }
  });

  window.Soundtrack = { html, mount, player: audio };
})();
