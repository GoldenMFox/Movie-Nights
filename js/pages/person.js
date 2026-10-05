/*
 * Person page: an actor / director / crew member, opened from a title's Cast & Crew.
 *   person.html?id=1245        a TMDB person
 *   person.html?name=Zendaya   found by name (library titles keep their cast without ids)
 *
 * Layout: backdrop from their best-known title; on the left a card with their photo,
 * name, age and how many of their titles are in your library, and their top genres;
 * on the right their best-known title + photos, a few numbers, the biography and facts.
 * Below, in the order set in Admin → Person page: "Best known for", the full filmography (newest
 * first), their books.
 */
(function () {
  const { esc, toast } = UI;
  const params = new URLSearchParams(location.search);
  const heroEl = document.getElementById("person-hero");
  const mainEl = document.getElementById("person-main");

  let p = null; // the person (TMDB.person)
  let filter = "all"; // filmography: all | movie | tv
  let role = "all"; // filmography: all | a department ("Acting", "Directing", "Production", "Writing"…)
  let libOnly = false; // filmography: only titles in your library
  let showOther = false; // talk shows / appearances as themselves
  let bioOpen = false;

  function message(icon, html) {
    heroEl.hidden = true;
    mainEl.innerHTML = `<div class="empty-state"><i class="${icon}"></i>${html}<br><br><a class="btn btn-primary" href="index.html">Back home</a></div>`;
  }

  /* ---------------- helpers ---------------- */

  const date = (s) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

  function yearsBetween(from, to) {
    const a = new Date(`${from}T00:00:00Z`);
    const b = to ? new Date(`${to}T00:00:00Z`) : new Date();
    let y = b.getUTCFullYear() - a.getUTCFullYear();
    if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) y--;
    return y;
  }

  // "Los Angeles, California, USA" -> "Los Angeles, USA"
  const shortPlace = (s) => {
    const parts = String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
    return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts.join(", ");
  };

  const linkOf = (t) => {
    const lib = Cards.inLibrary(t);
    return lib ? `title.html?id=${encodeURIComponent(lib.id)}` : `title.html?tmdb=${t.mediaType}-${t.tmdbId}`;
  };

  // real roles (not talk shows or appearing as themselves)
  const isWork = (t) => !t.talk && !(t.self && !t.jobs.length);

  // the titles they're best known for: well-known work, most votes first
  function knownFor() {
    const acting = p.department === "Acting";
    return p.titles
      .filter((t) => isWork(t) && t.poster && (acting ? t.kind === "cast" : true))
      .sort((a, b) => b.votes - a.votes || b.popularity - a.popularity)
      .slice(0, 20);
  }

  function libraryStats() {
    const byId = new Map();
    p.titles.forEach((t) => {
      const lib = Cards.inLibrary(t);
      if (lib) byId.set(lib.id, Store.get(lib.id) || lib);
    });
    const items = [...byId.values()];
    const rated = items.filter((i) => i.rating != null);
    const avg = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : null;
    return { count: items.length, rated: rated.length, avg };
  }

  function topGenres(list) {
    const n = {};
    list.forEach((t) => (t.genres || []).forEach((g) => (n[g] = (n[g] || 0) + 1)));
    return Object.entries(n)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([g]) => g);
  }

  /* ---------------- top: photo card + overview ---------------- */

  function render() {
    const known = knownFor();
    const top = known.find((t) => t.backdrop) || null;
    const work = p.titles.filter(isWork);
    const movies = work.filter((t) => t.mediaType === "movie").length;
    const shows = work.filter((t) => t.mediaType === "tv").length;
    const lib = libraryStats();
    const years = work.map((t) => t.year).filter((y) => y && y <= new Date().getFullYear());
    const firstYear = years.length ? Math.min(...years) : null;
    const age = p.birthday ? yearsBetween(p.birthday, p.deathday) : null;
    const genres = topGenres(known);
    const dept = p.department === "Acting" ? "Actor" : p.department === "Directing" ? "Director" : p.department === "Writing" ? "Writer" : p.department;

    document.title = `${p.name} · Movie Nights`;

    const stats = [
      age != null ? [age, p.deathday ? "Age at death" : "Years old"] : null,
      firstYear ? [`${new Date().getFullYear() - firstYear} yr`, `Career (since ${firstYear})`] : null,
      [movies, movies === 1 ? "Movie" : "Movies"],
      [shows, shows === 1 ? "TV show" : "TV shows"],
      [lib.count, "In your library"],
    ].filter(Boolean);

    const facts = [
      p.birthday ? [date(p.birthday), "Born"] : null,
      p.deathday ? [date(p.deathday), "Died"] : null,
      p.place ? [shortPlace(p.place), "Birthplace"] : null,
      dept ? [dept, "Known for"] : null,
    ].filter(Boolean);

    const bio = p.bio
      .split(/\n\s*\n/)
      .map((para) => `<p>${esc(para.trim())}</p>`)
      .join("");
    const longBio = p.bio.length > 420;

    const media = [
      top
        ? `<a class="p-feature" href="${linkOf(top)}">
            <img src="${Store.img(top.backdrop, "w780")}" alt="" />
            <span class="p-feature-text"><small>Best known for</small><strong>${esc(Lang.title(top))}</strong>${top.year ? `<em>${top.year}</em>` : ""}</span>
            <span class="p-feature-play"><i class="fa-solid fa-arrow-right"></i></span>
          </a>`
        : "",
      ...p.photos
        .slice(p.photo ? 1 : 0, 9)
        .map((ph) => `<a class="p-shot" href="${Store.img(ph, "original")}" target="_blank" rel="noopener"><img src="${Store.img(ph, "w342")}" alt="" loading="lazy" /></a>`),
    ].join("");

    heroEl.hidden = false;
    heroEl.innerHTML = `
      <div class="p-backdrop">${top ? `<img src="${Store.img(top.backdrop, "w1280")}" alt="" />` : ""}</div>
      <div class="container p-grid">
        <aside class="p-side">
          <div class="p-card p-id">
            ${dept ? `<div class="p-badge"><i class="fa-solid fa-star"></i> ${esc(dept)}</div>` : ""}
            <img class="p-photo" src="${p.photo ? Store.img(p.photo, "h632") : "images/placeholders/avatar-placeholder.svg"}" alt="${esc(p.name)}" />
            <div class="p-id-body">
              <h1>${esc(p.name)}</h1>
              <p class="p-sub">${[p.place ? esc(shortPlace(p.place)) : "", age != null ? (p.deathday ? `${age} y.o. (${new Date(p.deathday).getUTCFullYear()})` : `${age} y.o.`) : ""]
                .filter(Boolean)
                .join('<span class="dot">•</span>')}</p>
              <div class="p-buttons">
                <a class="btn p-main-btn" href="#filmography"><i class="fa-solid fa-film"></i> Filmography</a>
                ${p.imdbId ? `<a class="p-round" href="https://www.imdb.com/name/${esc(p.imdbId)}/" target="_blank" rel="noopener" title="Open on IMDb" aria-label="Open on IMDb"><span class="p-imdb">IMDb</span></a>` : ""}
                <button class="p-round" type="button" data-p="share" title="Share" aria-label="Share"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
              </div>
              <div class="p-lib">
                ${
                  lib.count
                    ? `<button class="p-lib-line" type="button" data-p="library" title="Show them in the filmography"><i class="fa-solid fa-bolt"></i> ${lib.count} title${lib.count === 1 ? "" : "s"} in your library <i class="fa-solid fa-chevron-right p-lib-arrow"></i></button>`
                    : '<span class="p-lib-line"><i class="fa-solid fa-bolt"></i> Nothing in your library yet</span>'
                }
                ${lib.avg != null ? `<small>Your average: <i class="fa-solid fa-star"></i> ${Cards.formatRating(Math.round(lib.avg * 10) / 10)} from ${lib.rated} rated</small>` : ""}
              </div>
            </div>
          </div>
          ${
            genres.length
              ? `<div class="p-card p-genres"><h3>Top genres</h3><div class="p-chips">${genres
                  .map((g) => `<a href="movies-explore.html?genre=${encodeURIComponent(g)}">${esc(g)}</a>`)
                  .join("")}</div></div>`
              : ""
          }
        </aside>

        <div class="p-body">
          <div class="p-card p-overview">
            <p class="p-counts">${[
              movies ? `${movies} movie${movies === 1 ? "" : "s"}` : "",
              shows ? `${shows} TV show${shows === 1 ? "" : "s"}` : "",
              p.photos.length ? `${p.photos.length} photo${p.photos.length === 1 ? "" : "s"}` : "",
            ]
              .filter(Boolean)
              .join('<span class="dot">•</span>')}</p>
            ${media ? `<div class="p-media">${media}</div>` : ""}
            <div class="p-stats">${stats.map(([v, l]) => `<div><strong>${esc(String(v))}</strong><span>${esc(l)}</span></div>`).join("")}</div>
            <div class="p-about">
              <div class="p-bio${longBio && !bioOpen ? " folded" : ""}">${bio || `<p class="muted">No biography on TMDB yet.</p>`}</div>
              ${longBio ? `<button class="t-link p-bio-more" type="button">${bioOpen ? "Show less" : "Read more"}</button>` : ""}
              <dl class="p-facts">${facts.map(([v, l]) => `<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`).join("")}
                ${p.aka.length ? `<div class="wide"><dt>Also known as</dt><dd>${p.aka.map(esc).join(", ")}</dd></div>` : ""}
              </dl>
            </div>
          </div>

        </div>
      </div>`;

    // under the top part: Best known for, Filmography, Books, in the order the owner set (Admin →
    // Person page); each a row of its own
    if (!knownEl) {
      knownEl = document.createElement("section");
      knownEl.className = "container t-section p-known-row";
      knownEl.dataset.prow = "known";
    }
    knownEl.hidden = !known.length;
    knownEl.innerHTML = known.length
      ? `<div class="row-head"><h2 class="t-section-title">Best known for</h2><a class="t-link" href="#filmography">See all ${work.length} <i class="fa-solid fa-arrow-right"></i></a></div>
        <div class="movie-row">${known.map(Cards.tmdbCard).join("")}</div>`
      : "";
    rowsEl().append(knownEl);
    renderFilmography();
    arrangeRows();
  }

  // the rows' box (once), right under the top part; the filmography (mainEl) goes in it too
  let rowsBox = null;
  let knownEl = null;
  function rowsEl() {
    if (!rowsBox) {
      rowsBox = document.createElement("div");
      rowsBox.className = "p-rows";
      mainEl.before(rowsBox);
      mainEl.dataset.prow = "filmography";
      rowsBox.append(mainEl);
    }
    return rowsBox;
  }
  function arrangeRows() {
    if (!rowsBox) return;
    const { order, hidden } = window.Site && Site.personRows ? Site.personRows() : { order: ["known", "filmography", "books"], hidden: [] };
    [...rowsBox.children].forEach((el) => {
      const k = el.dataset.prow;
      el.style.order = String(Math.max(0, order.indexOf(k)));
      el.classList.toggle("p-row-off", hidden.includes(k));
    });
  }

  /* ---------------- filmography ---------------- */

  // TMDB departments, as the roles you can pick
  const ROLE_LABEL = {
    Acting: "Actor",
    Directing: "Director",
    Production: "Producer",
    Writing: "Writer",
    Creator: "Creator",
    Camera: "Camera",
    Editing: "Editor",
    Sound: "Sound / music",
    Art: "Art department",
    "Costume & Make-Up": "Costume & make-up",
    "Visual Effects": "Visual effects",
    Lighting: "Lighting",
    Crew: "Other crew",
  };
  const ROLE_ORDER = Object.keys(ROLE_LABEL);
  const roleLabel = (d) => ROLE_LABEL[d] || d;

  // the main jobs first: "Director, Screenplay, Producer, Songs"
  const JOB_ORDER = [/^director$/i, /creator/i, /screenplay|writer|story|novel/i, /^producer$/i, /producer/i];
  const jobRank = (job) => {
    const i = JOB_ORDER.findIndex((re) => re.test(job));
    return i < 0 ? JOB_ORDER.length : i;
  };

  // what they did on a title: "as Cooper · Director, Producer" (only the picked role's part)
  function roleText(t) {
    const parts = [];
    if ((role === "all" || role === "Acting") && t.characters.length) parts.push(`as ${t.characters.join(", ")}`);
    if (role !== "Acting" && t.jobs.length) parts.push([...t.jobs].sort((a, b) => jobRank(a) - jobRank(b)).join(", "));
    return parts.join(" · ");
  }

  function renderFilmography() {
    const hidden = p.titles.filter((t) => !isWork(t)).length;
    const pool = p.titles.filter((t) => showOther || isWork(t));

    // the roles this person has, most used first (their main one on top), with counts
    const counts = {};
    pool.forEach((t) => t.depts.forEach((d) => (counts[d] = (counts[d] || 0) + 1)));
    const roles = Object.keys(counts).sort((a, b) => (b === p.department) - (a === p.department) || counts[b] - counts[a] || ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
    if (role !== "all" && !counts[role]) role = "all";

    const list = pool
      .filter((t) => filter === "all" || t.mediaType === filter)
      .filter((t) => role === "all" || t.depts.includes(role))
      .filter((t) => !libOnly || Cards.inLibrary(t))
      .sort((a, b) => (b.year || 9999) - (a.year || 9999) || b.popularity - a.popularity);

    const FILTERS = { all: "All", movie: "Movies", tv: "TV shows" };

    let lastYear; // the year is shown once per group
    const rows = list
      .map((t) => {
        const lib = Cards.inLibrary(t);
        const item = lib && Store.get(lib.id);
        const yearCell = t.year !== lastYear ? t.year || "Soon" : "";
        lastYear = t.year;
        const roles = roleText(t);
        const score =
          item && item.rating != null
            ? `<span class="p-score mine" title="Your rating"><i class="fa-solid fa-star"></i> ${Cards.formatRating(item.rating)}</span>`
            : t.score
            ? `<span class="p-score" title="TMDB rating"><span class="tmdb-tag">TMDB</span> ${t.score.toFixed(1)}</span>`
            : "";
        return `<a class="p-credit${lib ? " in-lib" : ""}" href="${linkOf(t)}">
          <span class="p-year">${yearCell}</span>
          <img src="${t.poster ? Store.img(t.poster, "w92") : "images/placeholders/poster-placeholder.svg"}" alt="" loading="lazy" />
          <span class="p-credit-text">
            <strong>${esc(Lang.title(t))}${lib ? ' <i class="fa-solid fa-circle-check" title="In your library"></i>' : ""}</strong>
            <small>${[t.mediaType === "tv" ? "TV" : "Movie", esc(roles), t.episodes && (role === "all" || role === "Acting") ? `${t.episodes} episode${t.episodes === 1 ? "" : "s"}` : ""]
              .filter(Boolean)
              .join(" · ")}</small>
          </span>
          ${score}
        </a>`;
      })
      .join("");

    mainEl.innerHTML = `
      <section class="t-section p-filmography" id="filmography">
        <div class="p-film-head">
          <h2 class="t-section-title">Filmography <small>${list.length}</small></h2>
          <div class="p-filters">
            ${
              roles.length > 1
                ? `<span class="glass-select small p-role">
                    <i class="fa-solid fa-user-tag" aria-hidden="true"></i>
                    <select aria-label="Role">
                      <option value="all">All roles (${pool.length})</option>
                      ${roles.map((d) => `<option value="${esc(d)}"${d === role ? " selected" : ""}>${esc(roleLabel(d))} (${counts[d]})</option>`).join("")}
                    </select>
                  </span>`
                : ""
            }
            <div class="p-chips-row" role="group" aria-label="Show">
              ${Object.entries(FILTERS)
                .map(([k, l]) => `<button type="button" class="chip${k === filter ? " active" : ""}" data-filter="${k}" aria-pressed="${k === filter}">${l}</button>`)
                .join("")}
              <button type="button" class="chip p-lib-chip${libOnly ? " active" : ""}" data-p="lib-only" aria-pressed="${libOnly}">
                <i class="fa-solid fa-${libOnly ? "circle-check" : "clapperboard"}"></i> In my library</button>
            </div>
          </div>
        </div>
        <div class="p-credits">${
          rows ||
          `<p class="muted t-empty">${libOnly ? "None of these are in your library." : "Nothing here."}${
            libOnly || role !== "all" || filter !== "all" ? ' <button class="t-link" type="button" data-p="reset">Show everything</button>' : ""
          }</p>`
        }</div>
        ${hidden ? `<button class="t-link p-other" type="button">${showOther ? "Hide" : "Show"} ${hidden} talk show / guest appearance${hidden === 1 ? "" : "s"}</button>` : ""}
      </section>
      <p class="tmdb-note">Details and photos from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
        <a href="${esc(p.tmdbUrl)}" target="_blank" rel="noopener">Open ${esc(p.name)} on TMDB</a></p>`;
  }

  /* ---------------- clicks ---------------- */

  document.addEventListener("click", async (e) => {
    if (e.target.closest('[data-p="share"]')) {
      // (the share sheet, else copied, else a box with the link: js/core/layout.js)
      UI.shareLink({ title: document.title, text: p ? `🎬 ${p.name} on Movie Nights` : document.title, url: location.href });
      return;
    }
    if (e.target.closest(".p-bio-more")) {
      bioOpen = !bioOpen;
      heroEl.querySelector(".p-bio").classList.toggle("folded", !bioOpen);
      e.target.closest(".p-bio-more").textContent = bioOpen ? "Show less" : "Read more";
      return;
    }
    // "9 titles in your library": the filmography, only those
    if (e.target.closest('[data-p="library"]')) {
      libOnly = true;
      filter = "all";
      role = "all";
      renderFilmography();
      document.getElementById("filmography").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (e.target.closest('[data-p="lib-only"]')) {
      libOnly = !libOnly;
      renderFilmography();
      return;
    }
    if (e.target.closest('[data-p="reset"]')) {
      libOnly = false;
      filter = "all";
      role = "all";
      renderFilmography();
      return;
    }
    const f = e.target.closest("[data-filter]");
    if (f) {
      filter = f.dataset.filter;
      renderFilmography();
      return;
    }
    if (e.target.closest(".p-other")) {
      showOther = !showOther;
      renderFilmography();
      return;
    }
    const jump = e.target.closest('a[href="#filmography"]');
    if (jump) {
      e.preventDefault();
      document.getElementById("filmography").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.addEventListener("change", (e) => {
    if (!e.target.closest(".p-role select")) return;
    role = e.target.value;
    renderFilmography();
  });

  // your ratings / library changed (e.g. rated a card in "Best known for")
  Store.onChange(() => p && render());

  /* ---------------- start ---------------- */

  async function init() {
    if (!TMDB.enabled()) return message("fa-solid fa-key", 'This page needs a TMDB API key. The owner of the site adds one in the Admin Control Center.');
    heroEl.hidden = true;
    mainEl.innerHTML = '<p class="result-count">Loading…</p>';
    try {
      let id = params.get("id");
      if (!id && params.get("name")) {
        id = await TMDB.findPerson(params.get("name"));
        if (!id) return message("fa-regular fa-face-frown", `Couldn't find ${esc(params.get("name"))} on TMDB.`);
        history.replaceState(null, "", `?id=${id}`);
      }
      if (!/^\d+$/.test(String(id || ""))) return message("fa-regular fa-face-frown", "That link doesn't look right.");
      p = await TMDB.person(id);
    } catch (err) {
      return message("fa-solid fa-triangle-exclamation", esc(err.message));
    }
    render();
    mountBooks();
  }

  /* ---------------- books by them, and about them (js/services/books.js, Open Library) ----------------
     Under the filmography, looked for once when it comes near the screen; nothing found: no section */
  function mountBooks() {
    if (!window.Books || !window.Site || !Site.feature("books") || !Books.ready() || !p) return;
    const box = document.createElement("section");
    box.className = "container t-section p-books";
    box.dataset.prow = "books";
    box.hidden = true;
    rowsEl().append(box);
    arrangeRows();
    const safe = (u) => (/^https:\/\//.test(u || "") ? u : "");
    // a bookshelf: each book stands with its spine out (a slice of its cover, the title down it);
    // pointed at (or tapped) it rises off the shelf and turns its cover to you
    const heightOf = (t) => {
      let h = 0;
      for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0;
      return 206 + (Math.abs(h) % 6) * 8; // (books aren't all the same height)
    };
    const book = (b) => {
      const meta = [b.authors[0], b.year].filter(Boolean).join(" · ");
      return `<a class="bk-book" href="${esc(safe(b.url) || "#")}" target="_blank" rel="noopener" style="--bh:${heightOf(b.title)}px" data-title="${esc(b.title)}" data-meta="${esc(meta)}" aria-label="${esc(`${b.title}${meta ? `, ${meta}` : ""}`)}">
          ${safe(b.cover) ? `<img src="${esc(b.cover)}" alt="" loading="lazy" />` : ""}
          <span class="bk-spine"><span>${esc(b.title)}</span></span>
        </a>`;
    };
    const shelf = (list) => `<div class="bk-shelf"><div class="bk-shelf-books">${list.map(book).join("")}<span class="bk-end" aria-hidden="true"></span></div><div class="bk-plank"></div><p class="bk-caption" aria-live="polite"></p></div>`;
    const start = async () => {
      const r = await Books.forPerson(p.name).catch(() => null);
      if (!r || (!r.by.length && !r.about.length)) return;
      box.innerHTML = `<h2 class="t-section-title"><i class="fa-solid fa-book-open"></i> Books</h2>
        <div class="bk-shelves" data-by="${r.by.length}" data-about="${r.about.length}">
          ${r.by.length ? `<div class="bk-shelf-wrap"><h3 class="xr-sub">By ${esc(p.name)}</h3>${shelf(r.by)}</div>` : ""}
          ${r.about.length ? `<div class="bk-shelf-wrap"><h3 class="xr-sub">About ${esc(p.name)}</h3>${shelf(r.about)}</div>` : ""}
        </div>
        <p class="ep-credit">Books from <a href="https://openlibrary.org" target="_blank" rel="noopener">Open Library</a></p>`;
      box.hidden = false;
      // the lifted book: its name under the shelf; on a touch screen the first tap lifts it, the
      // second opens it
      const lift = (bk) => {
        const sh = bk.closest(".bk-shelf");
        sh.querySelectorAll(".bk-book.up").forEach((x) => x !== bk && x.classList.remove("up"));
        bk.classList.add("up");
        sh.querySelector(".bk-caption").innerHTML = `<strong>${esc(bk.dataset.title)}</strong>${bk.dataset.meta ? ` <span>${esc(bk.dataset.meta)}</span>` : ""}`;
      };
      box.querySelectorAll(".bk-book").forEach((bk) => {
        bk.addEventListener("mouseenter", () => lift(bk));
        bk.addEventListener("focus", () => lift(bk));
        bk.addEventListener("click", (e) => {
          if (!bk.classList.contains("up")) {
            e.preventDefault();
            lift(bk);
          }
        });
      });
      // a shelf with few books: their spines a little wider, so the shelf isn't left half empty
      // one shelf with few books (8 or fewer): the two side by side on one row, each as wide as its
      // books need (the short one at least wide enough for its title), so neither stands half empty
      const fill = () => {
        const wrap = box.querySelector(".bk-shelves");
        const by = Number(wrap.dataset.by);
        const about = Number(wrap.dataset.about);
        const side = window.innerWidth > 900 && wrap.children.length === 2 && Math.min(by, about) <= 8;
        wrap.classList.toggle("side", side);
        // (the short shelf: just as wide as its books at their widest, its title fitting; the other: the rest)
        const snug = (n) => `${Math.max(190, n * 74 + 70)}px`;
        wrap.style.gridTemplateColumns = !side ? "" : by <= about ? `${snug(by)} minmax(0, 1fr)` : `minmax(0, 1fr) ${snug(about)}`;
        box.querySelectorAll(".bk-shelf-books").forEach((row) => {
          const n = row.querySelectorAll(".bk-book").length;
          const room = row.clientWidth - 40; // (the bookend)
          const phone = window.innerWidth <= 700;
          const per = Math.floor(room / Math.max(1, n)) - 4;
          row.style.setProperty("--bw", `${Math.max(phone ? 44 : 52, Math.min(phone ? 58 : 96, per))}px`);
        });
      };
      fill();
      window.addEventListener("resize", fill);
      box.querySelectorAll(".bk-shelf").forEach((sh) => {
        sh.addEventListener("mouseleave", () => {
          sh.querySelectorAll(".bk-book.up").forEach((x) => x.classList.remove("up"));
          sh.querySelector(".bk-caption").innerHTML = "";
        });
      });
    };
    if (!("IntersectionObserver" in window)) return start();
    // (watch the filmography's end: the books come after it)
    const io = new IntersectionObserver((en) => {
      if (en.some((x) => x.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: "600px" });
    io.observe(mainEl);
  }

  init();
})();
