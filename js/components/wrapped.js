/*
 * Movie Nights Wrapped: your year as a story (like Spotify Wrapped / Instagram stories),
 * from the watch diary (the day you rated / marked each title as watched).
 * Profile → Watch diary → Wrapped.
 *
 * Plays by itself (each card ~6 s, the bars on top fill up). Tap the right side (or →) for
 * the next card, the left side (or ←) to go back, hold anywhere to pause.
 * Every card animates in: lines slide up one after the other, numbers count up, bars grow,
 * soft colour blobs drift behind; the last card ends with confetti.
 */
(function () {
  const { esc, toast } = UI;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DURATION = 6500; // ms per card

  // which year to show: this one, or last year early in January / February if this one is still empty
  function yearToShow() {
    const now = new Date();
    const count = (y) => Store.all().filter((i) => String(i.watchedAt || "").startsWith(String(y))).length;
    return now.getMonth() < 2 && count(now.getFullYear()) < 3 ? now.getFullYear() - 1 : now.getFullYear();
  }

  const minutes = (runtime) => {
    const text = String(runtime || "").split("·").pop();
    const h = /(\d+)\s*h/.exec(text);
    const m = /(\d+)\s*min/.exec(text);
    return h || m ? (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) : 0;
  };

  // everything the cards need; cast / directors come from TMDB (cached) for up to 60 titles
  async function collect(year, progress) {
    const list = Store.all()
      .filter((i) => String(i.watchedAt || "").startsWith(String(year)))
      .sort((a, b) => a.watchedAt.localeCompare(b.watchedAt));
    const actors = {};
    const directors = {};
    let mins = 0;
    let n = 0;
    for (const item of list.slice(0, 60)) {
      let d = null;
      try {
        d = window.TMDB && TMDB.enabled() ? await TMDB.details(item) : null;
      } catch (e) {}
      progress(++n, Math.min(list.length, 60));
      if (item.type === "movie") mins += minutes(item.runtime || (d && d.runtime));
      ((d && d.cast) || []).slice(0, 6).forEach((c) => {
        const a = (actors[c.name] = actors[c.name] || { name: c.name, photo: c.photo, titles: [] });
        a.titles.push(Lang.title(item));
      });
      String((d && d.director) || item.director || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((name) => ((directors[name] = directors[name] || []).push(Lang.title(item))));
    }
    const genres = {};
    list.forEach((i) => (i.genres || []).forEach((g) => (genres[g] = (genres[g] || 0) + 1)));
    const months = new Array(12).fill(0);
    list.forEach((i) => months[Number(i.watchedAt.slice(5, 7)) - 1]++);
    const rated = list.filter((i) => typeof i.rating === "number");
    const top = rated.slice().sort((a, b) => b.rating - a.rating || b.watchedAt.localeCompare(a.watchedAt))[0];
    const actor = Object.values(actors).sort((a, b) => b.titles.length - a.titles.length)[0];
    const director = Object.entries(directors).sort((a, b) => b[1].length - a[1].length)[0];
    return {
      year,
      list,
      count: list.length,
      byType: { movie: list.filter((i) => i.type === "movie").length, tv: list.filter((i) => i.type === "tv").length, anime: list.filter((i) => i.type === "anime").length },
      hours: Math.round(mins / 60),
      genres: Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5),
      months,
      busiest: months.indexOf(Math.max(...months)),
      top,
      avg: rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : null,
      tens: rated.filter((i) => i.rating === 10).length,
      first: list[0],
      actor: actor && actor.titles.length > 1 ? actor : null,
      director: director && director[1].length > 1 ? { name: director[0], titles: director[1] } : null,
    };
  }

  /* ---------------- the cards ---------------- */

  // a line that slides up in turn (n = its place in the order)
  const a = (n, html, tag = "div", cls = "") => `<${tag} class="wr-a ${cls}" style="--d:${n * 140}ms">${html}</${tag}>`;
  // a number that counts up from 0
  const count = (v, dec = 0) => `<span class="wr-num" data-count="${v}" data-dec="${dec}">0</span>`;
  const posterUrl = (i) => Store.poster(Cards.posterOf(i), "w500");

  function cards(w) {
    const name = String(Store.getProfile().name || "").split(" ")[0];
    const posters = w.list.filter((i) => Cards.posterOf(i)).map(posterUrl);
    // a slowly scrolling wall of this year's posters (intro, count)
    const wall = () =>
      posters.length >= 4
        ? `<div class="wr-wall" aria-hidden="true">${[0, 1, 2]
            .map((c) => `<div class="wr-wall-col" style="--s:${28 + c * 6}s">${posters.concat(posters).slice(c, c + 12).map((p) => `<img src="${p}" alt="" />`).join("")}</div>`)
            .join("")}</div>`
        : "";
    const blurred = (i) => `<div class="wr-blur" style="background-image:url('${posterUrl(i)}')" aria-hidden="true"></div>`;
    const out = [];

    out.push({
      cls: "wr-intro",
      bg: wall(),
      html: `${a(0, "Movie Nights · Wrapped", "small")}
        ${a(1, `<span class="wr-year">${w.year}</span>`, "div")}
        ${a(2, `${name ? `${esc(name)}, this` : "This"} was your year in movies`, "h2")}
        ${a(4, '<span class="wr-hint"><i class="fa-solid fa-hand-pointer"></i> Tap to go on · hold to pause</span>', "p")}`,
    });

    out.push({
      cls: "wr-count",
      bg: wall(),
      html: `${a(0, "This year you watched", "small")}
        ${a(1, count(w.count), "div", "wr-big")}
        ${a(2, `title${w.count === 1 ? "" : "s"}`, "h3")}
        ${a(3, `<div class="wr-pills">${[
          w.byType.movie && `<span><i class="fa-solid fa-film"></i> ${w.byType.movie} movie${w.byType.movie === 1 ? "" : "s"}</span>`,
          w.byType.tv && `<span><i class="fa-solid fa-tv"></i> ${w.byType.tv} series</span>`,
          w.byType.anime && `<span><i class="fa-solid fa-dragon"></i> ${w.byType.anime} anime</span>`,
        ]
          .filter(Boolean)
          .join("")}</div>`)}
        ${w.hours >= 5 ? a(4, `That's about <b>${count(w.hours)} hours</b> of movies`, "p", "wr-note") : ""}`,
    });

    if (w.first)
      out.push({
        cls: "wr-first",
        bg: blurred(w.first),
        html: `${a(0, "Your year started with", "small")}
          ${a(1, `<img class="wr-poster" src="${posterUrl(w.first)}" alt="" />`, "div", "wr-pop")}
          ${a(2, esc(Lang.title(w.first)), "h3")}
          ${a(3, `<i class="fa-regular fa-calendar"></i> ${new Date(`${w.first.watchedAt}T00:00:00`).getDate()} ${MONTHS[Number(w.first.watchedAt.slice(5, 7)) - 1]}`, "p")}`,
      });

    if (w.genres.length) {
      const max = w.genres[0][1];
      out.push({
        cls: "wr-genres",
        html: `${a(0, "Your top genre was", "small")}
          ${a(1, esc(w.genres[0][0]), "h2", "wr-glow")}
          <div class="wr-bars">${w.genres
            .map(
              ([g, c], n) => `<div class="wr-bar wr-a" style="--d:${(n + 2) * 140}ms">
                <span>${esc(g)}</span><div><i style="--w:${(c / max) * 100}%;--d:${(n + 3) * 140}ms"></i></div><b>${c}</b></div>`
            )
            .join("")}</div>`,
      });
    }

    if (w.count >= 3) {
      const max = Math.max(1, ...w.months);
      out.push({
        cls: "wr-months",
        html: `${a(0, "Your busiest month", "small")}
          ${a(1, MONTHS[w.busiest], "h2", "wr-glow")}
          ${a(2, `${count(w.months[w.busiest])} titles`, "p")}
          <div class="wr-cols">${w.months
            .map(
              (m, i) => `<div class="${i === w.busiest ? "on" : ""}"><i style="--h:${(m / max) * 100}%;--d:${400 + i * 60}ms"></i><span>${MONTHS[i][0]}</span></div>`
            )
            .join("")}</div>`,
      });
    }

    if (w.top)
      out.push({
        cls: "wr-top",
        bg: blurred(w.top),
        html: `${a(0, "Your highest-rated of the year", "small")}
          ${a(1, `<img class="wr-poster wr-tilt" src="${posterUrl(w.top)}" alt="" />`, "div", "wr-pop")}
          ${a(2, esc(Lang.title(w.top)), "h3")}
          ${a(3, `<i class="fa-solid fa-star"></i> ${count(w.top.rating, w.top.rating % 1 ? 1 : 0)}`, "div", "wr-score")}`,
      });

    if (w.actor)
      out.push({
        cls: "wr-actor",
        html: `${a(0, "The face of your year", "small")}
          ${w.actor.photo ? a(1, `<img class="wr-face" src="${Store.img(w.actor.photo, "w300")}" alt="" />`, "div", "wr-pop wr-ring") : ""}
          ${a(2, esc(w.actor.name), "h2")}
          ${a(3, `In <b>${w.actor.titles.length}</b> of your titles`, "p")}
          ${a(4, `<div class="wr-pills">${w.actor.titles.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</div>`)}
          ${w.director ? a(5, `And your director: <b>${esc(w.director.name)}</b> (${w.director.titles.length} titles)`, "p", "wr-note") : ""}`,
      });

    if (w.avg != null)
      out.push({
        cls: "wr-avg",
        html: `${a(0, "On average you gave", "small")}
          ${a(1, count(w.avg, 1), "div", "wr-big")}
          ${a(2, "out of 10", "h3")}
          ${a(3, w.avg >= 8 ? "Generous! You love what you watch." : w.avg >= 6.5 ? "Fair and balanced." : "A tough critic.", "p")}
          ${w.tens ? a(4, `<span class="wr-tens">${"★".repeat(Math.min(w.tens, 5))}</span> ${w.tens} perfect 10${w.tens === 1 ? "" : "s"}`, "p", "wr-note") : ""}`,
      });

    out.push({
      cls: "wr-sum",
      bg: wall(),
      confetti: true,
      html: `${a(0, "Movie Nights Wrapped", "small")}
        ${a(1, `<span class="wr-year">${w.year}</span>`)}
        <div class="wr-grid">
          ${a(2, `<b>${count(w.count)}</b><span>watched</span>`)}
          ${a(3, `<b>${w.genres.length ? esc(w.genres[0][0]) : "–"}</b><span>top genre</span>`)}
          ${a(4, `<b>${w.avg != null ? count(w.avg, 1) : "–"}</b><span>average score</span>`)}
          ${a(5, `<b>${MONTHS[w.busiest].slice(0, 3)}</b><span>busiest month</span>`)}
        </div>
        ${w.top ? a(6, `Best of the year: <b>${esc(Lang.title(w.top))}</b>`, "p") : ""}
        ${a(7, `<div class="wr-actions">
            <button class="btn wr-replay" type="button"><i class="fa-solid fa-rotate-left"></i> Replay</button>
            <button class="btn btn-primary wr-share" type="button"><i class="fa-solid fa-share-nodes"></i> Share</button>
          </div>`)}`,
    });
    return out;
  }

  /* ---------------- the player ---------------- */

  let overlay;
  let index = 0;
  let deck = [];
  let data = null;
  let timer = null;
  let startedAt = 0;
  let left = DURATION; // ms left on the current card
  let paused = false;

  function countUp(root) {
    root.querySelectorAll("[data-count]").forEach((el) => {
      const to = Number(el.dataset.count);
      const dec = Number(el.dataset.dec) || 0;
      const t0 = performance.now() + 250;
      const step = (t) => {
        const p = Math.min(1, Math.max(0, (t - t0) / 1100));
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (to * eased).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function confetti(root) {
    const colors = ["#e0393e", "#f5c518", "#46d369", "#2a5bd7", "#9b2fae", "#ffffff"];
    const box = document.createElement("div");
    box.className = "wr-confetti";
    box.innerHTML = Array.from({ length: 44 }, () => {
      const x = Math.random() * 100;
      const r = Math.random() * 360;
      return `<i style="left:${x}%;background:${colors[Math.floor(Math.random() * colors.length)]};--r:${r}deg;--x:${(Math.random() - 0.5) * 160}px;--t:${
        2.4 + Math.random() * 1.8
      }s;--d:${Math.random() * 0.6}s"></i>`;
    }).join("");
    root.append(box);
  }

  // run the clock for the current card (it goes on by itself; paused while you hold)
  function runClock() {
    clearTimeout(timer);
    if (paused || index === deck.length - 1) return; // the last card stays
    startedAt = Date.now();
    timer = setTimeout(() => show(index + 1, 1), left);
  }

  function setPaused(on) {
    if (on === paused) return;
    paused = on;
    overlay.classList.toggle("paused", on);
    if (on) {
      clearTimeout(timer);
      left = Math.max(0, left - (Date.now() - startedAt));
    } else runClock();
  }

  function show(n, dir) {
    if (n < 0 || n >= deck.length) return;
    index = n;
    left = DURATION;
    overlay.querySelector(".wr-bars-top").innerHTML = deck
      .map((_, i) => `<span class="${i < index ? "done" : i === index ? "now" : ""}"><i style="--t:${DURATION}ms"></i></span>`)
      .join("");
    const c = deck[index];
    const card = overlay.querySelector(".wr-card");
    card.className = `wr-card ${c.cls} ${dir < 0 ? "from-left" : "from-right"}`;
    card.innerHTML = `<div class="wr-bg" aria-hidden="true"><span class="wr-blob b1"></span><span class="wr-blob b2"></span><span class="wr-blob b3"></span></div>${
      c.bg || ""
    }<div class="wr-grain" aria-hidden="true"></div><div class="wr-content">${c.html}</div>`;
    countUp(card);
    if (c.confetti) confetti(card);
    runClock();
  }

  function close() {
    clearTimeout(timer);
    overlay.classList.remove("open");
    document.documentElement.classList.remove("wr-lock");
  }

  function build() {
    overlay = document.createElement("div");
    overlay.className = "wrapped";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Movie Nights Wrapped");
    overlay.innerHTML = `<div class="wr-stage">
      <div class="wr-bars-top"></div>
      <button class="wr-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      <div class="wr-card"></div>
      <button class="wr-nav wr-prev" type="button" aria-label="Previous"></button>
      <button class="wr-nav wr-next" type="button" aria-label="Next"></button>
    </div>`;
    document.body.append(overlay);

    // hold to pause; a quick tap goes back / on
    let downAt = 0;
    const stage = overlay.querySelector(".wr-stage");
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button:not(.wr-nav)")) return;
      downAt = Date.now();
      setPaused(true);
    });
    const release = () => downAt && setPaused(false);
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointerleave", release);
    stage.addEventListener("pointercancel", release);

    overlay.addEventListener("click", (e) => {
      if (e.target.closest(".wr-close")) return close();
      if (e.target.closest(".wr-share")) return share();
      if (e.target.closest(".wr-replay")) return show(0, -1);
      const held = downAt && Date.now() - downAt > 300; // that was a hold, not a tap
      downAt = 0;
      if (held) return;
      if (e.target.closest(".wr-prev")) return show(index - 1, -1);
      // (the last card stays open: ✕ or Esc closes it)
      if (e.target.closest(".wr-next")) return show(index + 1, 1);
    });
    document.addEventListener("keydown", (e) => {
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(index + 1, 1);
      if (e.key === "ArrowLeft") show(index - 1, -1);
      if (e.key === " ") {
        e.preventDefault();
        setPaused(!paused);
      }
    });
    document.addEventListener("visibilitychange", () => overlay.classList.contains("open") && setPaused(document.hidden));
  }

  async function share() {
    const w = data;
    const text = `My ${w.year} on Movie Nights: ${w.count} titles watched${w.genres.length ? `, mostly ${w.genres[0][0]}` : ""}${
      w.top ? `. Best of the year: ${Lang.title(w.top)} (${Cards.formatRating(w.top.rating)}/10)` : ""
    }. 🎬`;
    try {
      if (navigator.share) await navigator.share({ title: `Movie Nights Wrapped ${w.year}`, text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Copied, ready to paste");
      }
    } catch (e) {}
  }

  async function open(btn) {
    const year = yearToShow();
    if (Store.all().filter((i) => String(i.watchedAt || "").startsWith(String(year))).length < 3) {
      toast(`Wrapped needs at least 3 titles watched in ${year}. Rate or mark what you watch, and it fills up.`);
      return;
    }
    const label = btn ? btn.innerHTML : "";
    try {
      data = await collect(year, (n, total) => btn && (btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Getting your year ready… ${n}/${total}`));
    } finally {
      if (btn) btn.innerHTML = label;
    }
    deck = cards(data);
    if (!overlay) build();
    paused = false;
    overlay.classList.remove("paused");
    overlay.classList.add("open");
    document.documentElement.classList.add("wr-lock");
    show(0, 1);
  }

  window.Wrapped = { open, yearToShow };
})();
