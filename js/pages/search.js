/*
 * Advanced search (search.html): every filter at once, on all of TMDB.
 * Movies: genres (all of them), years or a decade, length, score, language, country,
 * director, actor, franchise, streaming, age rating (US), black & white. TV shows: the ones TMDB can do for series.
 * The results change as you pick; every filter is in the address, so a search can be
 * shared or bookmarked. On a phone the filters fold into a panel ("Filters · 3").
 *
 * Director: TMDB's "crew" filter, then only the films they directed. Franchise: the
 * collection's films, checked against the other filters with their film facts.
 */
(function () {
  const { esc } = UI;
  const root = document.getElementById("adv");
  if (!TMDB.enabled()) {
    root.innerHTML = `<div class="empty-state"><i class="fa-solid fa-key"></i><p>Advanced search needs TMDB. Add a free key in <a href="settings.html#keys">Settings</a>.</p></div>`;
    return;
  }

  const LANGS = [["en", "English"], ["fr", "French"], ["es", "Spanish"], ["de", "German"], ["it", "Italian"], ["ja", "Japanese"], ["ko", "Korean"], ["zh", "Mandarin"], ["cn", "Cantonese"], ["hi", "Hindi"], ["ru", "Russian"], ["pt", "Portuguese"], ["sv", "Swedish"], ["da", "Danish"], ["no", "Norwegian"], ["fi", "Finnish"], ["pl", "Polish"], ["tr", "Turkish"], ["ro", "Romanian"], ["nl", "Dutch"], ["th", "Thai"], ["fa", "Persian"], ["ar", "Arabic"], ["he", "Hebrew"], ["el", "Greek"], ["cs", "Czech"], ["hu", "Hungarian"], ["id", "Indonesian"], ["uk", "Ukrainian"], ["te", "Telugu"], ["ta", "Tamil"]];
  const COUNTRIES = ["US", "GB", "FR", "DE", "IT", "ES", "JP", "KR", "CN", "HK", "TW", "IN", "CA", "AU", "NZ", "IE", "SE", "DK", "NO", "FI", "PL", "RO", "RU", "UA", "MX", "BR", "AR", "TR", "IR", "TH", "BE", "NL", "AT", "CH", "CZ", "HU", "GR", "IL", "ZA", "NG", "EG"];
  const RUNTIMES = { short: ["Under 1h30", 0, 89], mid: ["1h30 – 2h", 90, 120], long: ["2h – 2h30", 120, 150], epic: ["Over 2h30", 150, null] };
  const TV_RUNTIMES = { short: ["Under 30 min", 0, 30], mid: ["30 – 60 min", 30, 60], long: ["Over 1h", 60, null] };
  const SCORES = ["6", "7", "7.5", "8"];
  const CERTS = ["G", "PG", "PG-13", "R", "NC-17"];
  const SORTS = { popular: "Most popular", top: "Top rated", votes: "Most voted", new: "Newest", old: "Oldest", money: "Box office" };
  const DECADES = [];
  for (let d = Math.floor(new Date().getFullYear() / 10) * 10; d >= 1920; d -= 10) DECADES.push(d);

  /* ---------------- the filters (and the address) ---------------- */

  const P = new URLSearchParams(location.search);
  const who = (v) => {
    const m = /^(\d+):(.+)$/.exec(v || "");
    return m ? { id: Number(m[1]), name: m[2] } : null;
  };
  const f = {
    type: P.get("type") === "tv" ? "tv" : "movie",
    genres: (P.get("g") || "").split(",").filter(Boolean),
    from: P.get("from") || "",
    to: P.get("to") || "",
    runtime: P.get("rt") || "",
    score: P.get("score") || "",
    lang: P.get("lang") || "",
    country: P.get("country") || "",
    director: who(P.get("dir")),
    actor: who(P.get("cast")),
    franchise: who(P.get("fr")),
    on: P.get("on") || "",
    cert: CERTS.includes(P.get("cert")) ? P.get("cert") : "",
    bw: P.get("bw") === "1",
    sort: SORTS[P.get("sort")] ? P.get("sort") : "popular",
  };
  const movie = () => f.type === "movie";

  function toAddress() {
    const q = new URLSearchParams();
    const set = (k, v) => v && q.set(k, v);
    if (!movie()) q.set("type", "tv");
    set("g", f.genres.join(","));
    set("from", f.from);
    set("to", f.to);
    set("rt", f.runtime);
    set("score", f.score);
    set("lang", f.lang);
    set("country", f.country);
    if (movie()) {
      set("dir", f.director && `${f.director.id}:${f.director.name}`);
      set("cast", f.actor && `${f.actor.id}:${f.actor.name}`);
      set("fr", f.franchise && `${f.franchise.id}:${f.franchise.name}`);
      set("cert", f.cert);
      if (f.bw) q.set("bw", "1");
    }
    set("on", f.on);
    if (f.sort !== "popular") q.set("sort", f.sort);
    const s = q.toString();
    history.replaceState(null, "", s ? `?${s}` : location.pathname);
  }

  // the filters in use, as removable chips: [key, label]
  function active() {
    const list = [];
    const rts = movie() ? RUNTIMES : TV_RUNTIMES;
    f.genres.forEach((g) => list.push([`g:${g}`, g]));
    if (f.from || f.to) list.push(["years", f.from && f.to && Number(f.to) - Number(f.from) === 9 && Number(f.from) % 10 === 0 ? `${f.from}s` : `${f.from || "…"} – ${f.to || "…"}`]);
    if (f.runtime && rts[f.runtime]) list.push(["rt", rts[f.runtime][0]]);
    if (f.score) list.push(["score", `★ ${f.score}+`]);
    if (f.lang) list.push(["lang", (LANGS.find((l) => l[0] === f.lang) || [0, f.lang])[1]]);
    if (f.country) list.push(["country", TMDB.countryName(f.country)]);
    if (f.on) list.push(["on", f.on === "mine" ? "On my services" : `On ${providerName(f.on)}`]);
    if (movie()) {
      if (f.director) list.push(["dir", `Directed by ${f.director.name}`]);
      if (f.actor) list.push(["cast", `With ${f.actor.name}`]);
      if (f.franchise) list.push(["fr", f.franchise.name]);
      if (f.cert) list.push(["cert", `Up to ${f.cert}`]);
      if (f.bw) list.push(["bw", "Black & white"]);
    }
    return list;
  }
  function clearOne(key) {
    if (key.startsWith("g:")) f.genres = f.genres.filter((g) => g !== key.slice(2));
    else if (key === "years") f.from = f.to = "";
    else if (key === "dir") f.director = null;
    else if (key === "cast") f.actor = null;
    else if (key === "fr") f.franchise = null;
    else if (key === "bw") f[key] = false;
    else if (key === "rt") f.runtime = "";
    else f[key] = "";
  }

  let providers = [];
  const providerName = (id) => (providers.find((p) => String(p.id) === String(id)) || { name: "a service" }).name;

  /* ---------------- the page ---------------- */

  const chip = (group, value, label, on) => `<button type="button" class="as-chip${on ? " on" : ""}" data-f="${group}" data-v="${esc(value)}" aria-pressed="${!!on}">${label}</button>`;
  const personHtml = (role, p, placeholder, icon) =>
    p
      ? `<div class="as-picked" data-role="${role}"><i class="fa-solid ${icon}"></i><span>${esc(p.name)}</span><button type="button" class="as-unpick" data-clear="${role}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></div>`
      : `<div class="as-person" data-role="${role}"><i class="fa-solid ${icon}"></i><input type="search" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off" /><div class="as-suggest" hidden></div></div>`;

  function filtersHtml() {
    const rts = movie() ? RUNTIMES : TV_RUNTIMES;
    const mine = window.Watch ? Watch.mine() : [];
    const group = (title, icon, body, cls = "") => `<section class="as-group ${cls}"><h3><i class="fa-solid ${icon}"></i> ${title}</h3>${body}</section>`;
    return `
      ${group("Genres", "fa-masks-theater", `<div class="as-chips">${TMDB.genresFor(f.type).map((g) => chip("genre", g, esc(g), f.genres.includes(g))).join("")}</div>`)}
      ${group(
        "When",
        "fa-calendar",
        `<div class="as-chips as-decades">${DECADES.map((d) => chip("decade", d, `${d}s`, String(d) === f.from && String(d + 9) === f.to)).join("")}</div>
         <div class="as-years"><input type="number" name="from" min="1900" max="2100" placeholder="From" value="${esc(f.from)}" aria-label="From year" /><span>–</span><input type="number" name="to" min="1900" max="2100" placeholder="To" value="${esc(f.to)}" aria-label="To year" /></div>`
      )}
      ${group(movie() ? "Length" : "Episode length", "fa-clock", `<div class="as-chips">${Object.entries(rts).map(([k, r]) => chip("runtime", k, r[0], f.runtime === k)).join("")}</div>`)}
      ${group("Score", "fa-star", `<div class="as-chips">${SCORES.map((s) => chip("score", s, `★ ${s}+`, f.score === s)).join("")}</div>`)}
      ${group(
        "Language & country",
        "fa-earth-europe",
        `<span class="glass-select"><select name="lang" aria-label="Original language"><option value="">Any language</option>${LANGS.map(
          ([k, l]) => `<option value="${k}"${f.lang === k ? " selected" : ""}>${l}</option>`
        ).join("")}</select></span>
         <span class="glass-select"><select name="country" aria-label="Country"><option value="">Any country</option>${COUNTRIES.map((c) => [c, TMDB.countryName(c)])
           .sort((a, b) => a[1].localeCompare(b[1]))
           .map(([c, n]) => `<option value="${c}"${f.country === c ? " selected" : ""}>${esc(n)}</option>`)
           .join("")}</select></span>`
      )}
      ${
        movie()
          ? group(
              "People & franchise",
              "fa-user",
              `${personHtml("dir", f.director, "Director…", "fa-video")}${personHtml("cast", f.actor, "Actor…", "fa-user")}${personHtml("fr", f.franchise, "Franchise…", "fa-layer-group")}`
            )
          : ""
      }
      ${group(
        "Streaming",
        "fa-tv",
        `<span class="glass-select"><select name="on" aria-label="Streaming in ${esc(TMDB.countryName(TMDB.COUNTRY))}"><option value="">Anywhere</option>${
          mine.length ? `<option value="mine"${f.on === "mine" ? " selected" : ""}>On my services</option>` : ""
        }${providers.map((p) => `<option value="${p.id}"${String(f.on) === String(p.id) ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></span>
         <small class="as-hint">In ${esc(TMDB.countryName(TMDB.COUNTRY))}</small>`
      )}
      ${
        movie()
          ? `${group("Age rating (US)", "fa-child", `<div class="as-chips">${CERTS.map((c) => chip("cert", c, `Up to ${c}`, f.cert === c)).join("")}</div>`)}
             ${group(
               "Special",
               "fa-film",
               `<div class="as-chips">${chip("bw", "1", '<i class="fa-solid fa-circle-half-stroke"></i> Black &amp; white', f.bw)}</div>`
             )}`
          : ""
      }
      <button type="button" class="btn as-reset"><i class="fa-solid fa-rotate-left"></i> Clear all filters</button>`;
  }

  root.innerHTML = `
    <div class="as-top">
      <div class="top10-switch as-type" role="tablist" aria-label="Type">
        <button class="top10-tab${movie() ? " active" : ""}" type="button" data-type="movie"><i class="fa-solid fa-film"></i> Movies</button>
        <button class="top10-tab${movie() ? "" : " active"}" type="button" data-type="tv"><i class="fa-solid fa-tv"></i> TV shows</button>
      </div>
      <button type="button" class="btn as-toggle"><i class="fa-solid fa-sliders"></i> Filters <b class="as-n"></b></button>
      <span class="glass-select as-sort"><i class="fa-solid fa-arrow-down-wide-short" aria-hidden="true"></i><select name="sort" aria-label="Sort by"></select></span>
    </div>
    <div class="as-layout">
      <aside class="as-filters" aria-label="Filters"></aside>
      <section class="as-results">
        <div class="as-active"></div>
        <p class="result-count" aria-live="polite"></p>
        <p class="as-note" hidden></p>
        <div class="movie-grid"></div>
        <div class="empty-state" hidden></div>
        <div class="load-more"><button class="btn" type="button" hidden>Load more</button></div>
      </section>
    </div>
    <p class="tmdb-note">Data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>`;

  const $ = (s) => root.querySelector(s);
  const panel = $(".as-filters");
  const grid = $(".movie-grid");
  const countEl = $(".result-count");
  const noteEl = $(".as-note");
  const emptyEl = $(".empty-state");
  const moreBtn = $(".load-more button");

  function paintSorts() {
    const sel = $('[name="sort"]');
    if (!movie() && f.sort === "money") f.sort = "popular";
    sel.innerHTML = Object.entries(SORTS)
      .filter(([k]) => movie() || k !== "money")
      .map(([k, l]) => `<option value="${k}"${f.sort === k ? " selected" : ""}>${l}</option>`)
      .join("");
  }

  function paint() {
    panel.innerHTML = filtersHtml();
    paintActive();
    paintSorts();
  }
  function paintActive() {
    const list = active();
    $(".as-active").innerHTML = list.length
      ? `${list.map(([k, l]) => `<button type="button" class="as-on" data-clear="${esc(k)}">${esc(l)} <i class="fa-solid fa-xmark"></i></button>`).join("")}<button type="button" class="as-on as-clear-all">Clear all</button>`
      : "";
    $(".as-n").textContent = list.length || "";
  }

  /* ---------------- searching ---------------- */

  let run = 0;
  let page = 0;
  let totalPages = 1;
  let total = 0;
  let shown = new Set();
  let typing = null;

  const later = () => {
    clearTimeout(typing);
    typing = setTimeout(() => search(true), 250);
  };
  function changed(repaint) {
    toAddress();
    if (repaint) paint();
    else paintActive();
    later();
  }

  async function params() {
    const m = movie();
    const today = new Date().toISOString().slice(0, 10);
    const dateKey = m ? "primary_release_date" : "first_air_date";
    const p = { sort_by: "popularity.desc", "vote_count.gte": 20 };
    const ids = f.genres.map((g) => TMDB.genreId(g, f.type)).filter(Boolean);
    if (ids.length) p.with_genres = [...new Set(ids)].join(",");
    if (f.from) p[`${dateKey}.gte`] = `${f.from}-01-01`;
    if (f.to) p[`${dateKey}.lte`] = `${f.to}-12-31`;
    const rt = (m ? RUNTIMES : TV_RUNTIMES)[f.runtime];
    if (rt) {
      if (rt[1]) p["with_runtime.gte"] = rt[1];
      if (rt[2]) p["with_runtime.lte"] = rt[2];
    }
    if (f.score) Object.assign(p, { "vote_average.gte": f.score, "vote_count.gte": 200 });
    if (f.lang) p.with_original_language = f.lang;
    if (f.country) p.with_origin_country = f.country;
    if (f.on) {
      const ids2 = f.on === "mine" ? (window.Watch ? Watch.mine().map((s) => s.id) : []) : [f.on];
      if (ids2.length) Object.assign(p, { with_watch_providers: ids2.join("|"), watch_region: TMDB.COUNTRY, with_watch_monetization_types: "flatrate|free|ads" });
    }
    if (!m) p.without_genres = "10763|10764|10766|10767"; // news, reality, soaps, talk shows
    if (m) {
      if (f.director) p.with_crew = f.director.id;
      if (f.actor) p.with_cast = f.actor.id;
      if (f.cert) Object.assign(p, { certification_country: "US", "certification.lte": f.cert });
      const kw = [];
      if (f.bw) kw.push(await TMDB.keywordId("black and white"));
      if (kw.filter(Boolean).length) p.with_keywords = kw.filter(Boolean).join(",");
    }
    if (f.sort === "top") Object.assign(p, { sort_by: "vote_average.desc", "vote_count.gte": Math.max(p["vote_count.gte"], m ? 1000 : 300) });
    if (f.sort === "votes") p.sort_by = "vote_count.desc";
    if (f.sort === "new") Object.assign(p, { sort_by: `${dateKey}.desc`, [`${dateKey}.lte`]: f.to && f.to < today.slice(0, 4) ? `${f.to}-12-31` : today });
    if (f.sort === "old") p.sort_by = `${dateKey}.asc`;
    if (f.sort === "money" && m) p.sort_by = "revenue.desc";
    return p;
  }

  // the films someone directed (TMDB's crew filter includes producers and writers)
  async function directed(id) {
    const p = await TMDB.person(id);
    return new Set(p.titles.filter((t) => t.mediaType === "movie" && t.jobs.includes("Director")).map((t) => t.tmdbId));
  }

  function setLoading(on) {
    root.classList.toggle("as-loading", on);
    moreBtn.disabled = on;
    if (on && !grid.children.length) grid.innerHTML = Array.from({ length: 12 }, () => '<div class="as-skel"></div>').join("");
  }

  async function search(reset) {
    const my = ++run;
    if (reset) {
      page = 0;
      totalPages = 1;
      total = 0;
      shown = new Set();
      grid.innerHTML = "";
      emptyEl.hidden = true;
      noteEl.hidden = true;
    }
    setLoading(true);
    try {
      if (movie() && f.franchise) await franchise(my);
      else await discoverPages(my);
    } catch (e) {
      if (my !== run) return;
      grid.querySelectorAll(".as-skel").forEach((s) => s.remove());
      countEl.textContent = "";
      emptyEl.hidden = false;
      emptyEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><p>${esc(e.message || "Something went wrong")}. Try again in a moment.</p>`;
    }
    if (my === run) setLoading(false);
  }

  async function discoverPages(my) {
    const p = await params();
    const dirSet = movie() && f.director ? await directed(f.director.id) : null;
    if (my !== run) return;
    const narrowed = !!dirSet;
    let added = 0;
    let tries = 0;
    while (added < 20 && page < totalPages && tries < (narrowed ? 10 : 1)) {
      page++;
      tries++;
      const r = await TMDB.discover(f.type, Object.assign({ page }, p));
      if (my !== run) return;
      totalPages = r.totalPages;
      total = r.total;
      const keep = r.results.filter((h) => {
        const k = `${h.mediaType}-${h.tmdbId}`;
        if (shown.has(k)) return false;
        if (dirSet && !dirSet.has(h.tmdbId)) return false;
        shown.add(k);
        return true;
      });
      grid.querySelectorAll(".as-skel").forEach((s) => s.remove());
      grid.insertAdjacentHTML("beforeend", keep.map(Cards.tmdbCard).join(""));
      added += keep.length;
    }
    countEl.textContent = narrowed
      ? `${shown.size} found${page < totalPages ? " so far" : ""}`
      : total >= 20000 ? "20,000+ titles" : `${total.toLocaleString("en")} title${total === 1 ? "" : "s"}`;
    moreBtn.hidden = page >= totalPages;
    if (!shown.size) empty();
  }

  // a franchise: its films, checked against the other filters (with their film facts)
  async function franchise(my) {
    const col = await TMDB.collection(f.franchise.id);
    const facts = await Promise.all(col.parts.map((h) => TMDB.facts("movie", h.tmdbId).catch(() => null)));
    if (my !== run) return;
    const rt = RUNTIMES[f.runtime];
    let list = col.parts
      .map((h, n) => ({ h, x: facts[n] }))
      .filter(({ h, x }) => {
        if (f.genres.some((g) => !(h.genres || []).includes(g))) return false;
        if (f.from && (!h.year || h.year < Number(f.from))) return false;
        if (f.to && (!h.year || h.year > Number(f.to))) return false;
        if (f.score && !(h.score >= Number(f.score))) return false;
        if (!x) return !(rt || f.lang || f.country || f.director || f.actor);
        if (rt && !(x.r >= rt[1] && (rt[2] == null || x.r <= rt[2]))) return false;
        if (f.lang && x.l !== f.lang) return false;
        if (f.country && !(x.k || []).includes(f.country)) return false;
        if (f.director && !(x.d || []).some((d) => d[0] === f.director.id)) return false;
        if (f.actor && !(x.c || []).some((c) => c[0] === f.actor.id)) return false;
        return true;
      })
      .map(({ h }) => h);
    if (f.sort === "top") list.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (f.sort === "new") list.reverse();
    grid.querySelectorAll(".as-skel").forEach((s) => s.remove());
    grid.innerHTML = list.map(Cards.tmdbCard).join("");
    list.forEach((h) => shown.add(`${h.mediaType}-${h.tmdbId}`));
    countEl.textContent = `${list.length} of ${col.parts.length} films in ${f.franchise.name}`;
    const ignored = [f.on && "streaming", f.cert && "age rating", f.bw && "black & white"].filter(Boolean);
    noteEl.hidden = !ignored.length;
    noteEl.innerHTML = ignored.length ? `<i class="fa-solid fa-circle-info"></i> Within a franchise, ${ignored.join(", ")} can't be checked, so ${ignored.length > 1 ? "they're" : "it's"} left out.` : "";
    moreBtn.hidden = true;
    if (!list.length) empty();
  }

  function empty() {
    emptyEl.hidden = false;
    emptyEl.innerHTML = `<i class="fa-regular fa-face-meh"></i><p>Nothing matches all of that. Remove a filter or two.</p>${
      active().length ? '<button type="button" class="btn as-clear-all"><i class="fa-solid fa-rotate-left"></i> Clear all filters</button>' : ""
    }`;
  }

  /* ---------------- people and franchises: type, pick ---------------- */

  let suggestRun = 0;
  async function suggest(box, q) {
    const role = box.dataset.role;
    const list = box.querySelector(".as-suggest");
    const my = ++suggestRun;
    if (q.trim().length < 2) return (list.hidden = true);
    try {
      let items;
      if (role === "fr") {
        items = (await TMDB.searchCollections(q)).map((c) => ({ id: c.id, name: c.name, photo: c.poster, sub: "Franchise" }));
      } else {
        const people = await TMDB.searchPeople(q);
        // directors first for "Director", actors first for "Actor"
        const want = role === "dir" ? "Directing" : "Acting";
        items = people.sort((a, b) => (b.dept === want) - (a.dept === want)).map((p) => ({ id: p.id, name: p.name, photo: p.photo, sub: [p.dept, p.known.join(", ")].filter(Boolean).join(" · ") }));
      }
      if (my !== suggestRun) return;
      list.hidden = !items.length;
      list.innerHTML = items
        .slice(0, 6)
        .map(
          (i) => `<button type="button" class="as-sug" data-id="${i.id}" data-name="${esc(i.name)}">
            ${i.photo ? `<img src="${Store.img(i.photo, "w92")}" alt="" loading="lazy" />` : '<span class="as-noimg"><i class="fa-solid fa-user"></i></span>'}
            <span><b>${esc(i.name)}</b><small>${esc(i.sub || "")}</small></span></button>`
        )
        .join("");
    } catch (e) {
      list.hidden = true;
    }
  }

  /* ---------------- events ---------------- */

  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-type]");
    if (t && t.dataset.type !== f.type) {
      f.type = t.dataset.type;
      root.querySelectorAll("[data-type]").forEach((b) => b.classList.toggle("active", b === t));
      // (genres that the other type doesn't have go)
      f.genres = f.genres.filter((g) => TMDB.genresFor(f.type).includes(g));
      if (!movie() && !TV_RUNTIMES[f.runtime]) f.runtime = "";
      return changed(true);
    }
    const c = e.target.closest(".as-chip");
    if (c) {
      const g = c.dataset.f;
      const v = c.dataset.v;
      if (g === "genre") f.genres = f.genres.includes(v) ? f.genres.filter((x) => x !== v) : f.genres.concat(v);
      else if (g === "decade") {
        const on = f.from === v && f.to === String(Number(v) + 9);
        f.from = on ? "" : v;
        f.to = on ? "" : String(Number(v) + 9);
      } else if (g === "bw") f[g] = !f[g];
      else f[g] = f[g] === v ? "" : v;
      return changed(true);
    }
    const sug = e.target.closest(".as-sug");
    if (sug) {
      const role = sug.closest("[data-role]").dataset.role;
      const picked = { id: Number(sug.dataset.id), name: sug.dataset.name };
      if (role === "dir") f.director = picked;
      if (role === "cast") f.actor = picked;
      if (role === "fr") f.franchise = picked;
      return changed(true);
    }
    const clear = e.target.closest("[data-clear]");
    if (clear) {
      clearOne(clear.dataset.clear);
      return changed(true);
    }
    if (e.target.closest(".as-clear-all, .as-reset")) {
      Object.assign(f, { genres: [], from: "", to: "", runtime: "", score: "", lang: "", country: "", director: null, actor: null, franchise: null, on: "", cert: "", bw: false });
      return changed(true);
    }
    if (e.target.closest(".as-toggle")) {
      root.classList.toggle("as-open");
      return;
    }
    if (e.target === moreBtn) search(false);
    // a click outside a suggestion list closes it
    root.querySelectorAll(".as-suggest").forEach((l) => !l.parentElement.contains(e.target) && (l.hidden = true));
  });

  root.addEventListener("input", (e) => {
    const box = e.target.closest(".as-person");
    if (box) return suggest(box, e.target.value);
    if (e.target.name === "from" || e.target.name === "to") {
      const v = e.target.value.trim();
      if (v && !/^\d{4}$/.test(v)) return;
      f[e.target.name] = v;
      toAddress();
      paintActive();
      root.querySelectorAll('.as-decades .as-chip').forEach((b) => b.classList.toggle("on", b.dataset.v === f.from && String(Number(b.dataset.v) + 9) === f.to));
      later();
    }
  });
  root.addEventListener("change", (e) => {
    const n = e.target.name;
    if (n === "lang" || n === "country" || n === "on" || n === "sort") {
      f[n] = e.target.value;
      changed(false);
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const box = e.target.closest(".as-person");
    const first = box && box.querySelector(".as-sug");
    if (first) {
      e.preventDefault();
      first.click();
    }
  });

  // the streaming services in your country (for the list)
  TMDB.providerCatalog()
    .then((list) => {
      providers = list.slice(0, 40);
      const sel = panel.querySelector('[name="on"]');
      if (sel) paint();
    })
    .catch(() => {});

  paint();
  search(true);
})();
