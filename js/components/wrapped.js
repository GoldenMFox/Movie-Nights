/*
 * Movie Nights Wrapped: your year as a story (like Spotify Wrapped), from the watch diary
 * (the day you rated / marked each title as watched). Profile → Watch diary → Wrapped.
 * Tap the right side (or →) for the next card, the left side (or ←) to go back.
 */
(function () {
  const { esc, toast } = UI;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

  function cards(w) {
    const name = String(Store.getProfile().name || "").split(" ")[0];
    const poster = (i) => `<img class="wr-poster" src="${Store.poster(Cards.posterOf(i), "w500")}" alt="" />`;
    const out = [];
    out.push({
      cls: "wr-intro",
      html: `<small>Movie Nights</small><h2>${name ? `${esc(name)}, here's` : "Here's"} your ${w.year}</h2><p>Tap to start</p>`,
    });
    out.push({
      cls: "wr-count",
      html: `<small>This year you watched</small><div class="wr-big">${w.count}</div><h3>title${w.count === 1 ? "" : "s"}</h3>
        <p>${[
          w.byType.movie && `${w.byType.movie} movie${w.byType.movie === 1 ? "" : "s"}`,
          w.byType.tv && `${w.byType.tv} series`,
          w.byType.anime && `${w.byType.anime} anime`,
        ]
          .filter(Boolean)
          .join(" · ")}</p>
        ${w.hours >= 5 ? `<p class="wr-note">That's about <b>${w.hours} hours</b> of movies alone.</p>` : ""}`,
    });
    if (w.first)
      out.push({
        cls: "wr-first",
        html: `<small>Your year started with</small>${poster(w.first)}<h3>${esc(Lang.title(w.first))}</h3><p>${new Date(`${w.first.watchedAt}T00:00:00`).getDate()} ${MONTHS[Number(w.first.watchedAt.slice(5, 7)) - 1]}</p>`,
      });
    if (w.genres.length) {
      const max = w.genres[0][1];
      out.push({
        cls: "wr-genres",
        html: `<small>Your top genre was</small><h2>${esc(w.genres[0][0])}</h2>
          <div class="wr-bars">${w.genres
            .map(([g, c]) => `<div class="wr-bar"><span>${esc(g)}</span><div><i style="width:${(c / max) * 100}%"></i></div><b>${c}</b></div>`)
            .join("")}</div>`,
      });
    }
    if (w.count >= 3)
      out.push({
        cls: "wr-months",
        html: `<small>Your busiest month</small><h2>${MONTHS[w.busiest]}</h2><p>${w.months[w.busiest]} titles</p>
          <div class="wr-cols">${w.months
            .map((m, i) => `<div class="${i === w.busiest ? "on" : ""}"><i style="height:${(m / Math.max(1, ...w.months)) * 100}%"></i><span>${MONTHS[i][0]}</span></div>`)
            .join("")}</div>`,
      });
    if (w.top)
      out.push({
        cls: "wr-top",
        html: `<small>Your highest-rated of the year</small>${poster(w.top)}<h3>${esc(Lang.title(w.top))}</h3><div class="wr-score">★ ${Cards.formatRating(w.top.rating)}</div>`,
      });
    if (w.actor)
      out.push({
        cls: "wr-actor",
        html: `<small>The face of your year</small>${w.actor.photo ? `<img class="wr-face" src="${Store.img(w.actor.photo, "w300")}" alt="" />` : ""}<h2>${esc(w.actor.name)}</h2>
          <p>In ${w.actor.titles.length} of your titles: ${w.actor.titles.slice(0, 3).map(esc).join(", ")}${w.actor.titles.length > 3 ? "…" : ""}</p>
          ${w.director ? `<p class="wr-note">And your director: <b>${esc(w.director.name)}</b> (${w.director.titles.length} titles)</p>` : ""}`,
      });
    if (w.avg != null)
      out.push({
        cls: "wr-avg",
        html: `<small>On average you gave</small><div class="wr-big">${w.avg.toFixed(1)}</div><h3>out of 10</h3>
          <p>${w.avg >= 8 ? "Generous! You love what you watch." : w.avg >= 6.5 ? "Fair and balanced." : "A tough critic."}${w.tens ? ` And ${w.tens} perfect 10${w.tens === 1 ? "" : "s"}.` : ""}</p>`,
      });
    out.push({
      cls: "wr-sum",
      html: `<small>Movie Nights Wrapped</small><h2>${w.year}</h2>
        <div class="wr-grid">
          <div><b>${w.count}</b><span>watched</span></div>
          <div><b>${w.genres.length ? esc(w.genres[0][0]) : "–"}</b><span>top genre</span></div>
          <div><b>${w.avg != null ? w.avg.toFixed(1) : "–"}</b><span>average score</span></div>
          <div><b>${MONTHS[w.busiest].slice(0, 3)}</b><span>busiest month</span></div>
        </div>
        ${w.top ? `<p>Best of the year: <b>${esc(Lang.title(w.top))}</b></p>` : ""}
        <button class="btn btn-primary wr-share" type="button"><i class="fa-solid fa-share-nodes"></i> Share</button>`,
    });
    return out;
  }

  let overlay;
  let index = 0;
  let deck = [];
  let data = null;

  function show(n) {
    index = Math.max(0, Math.min(deck.length - 1, n));
    overlay.querySelector(".wr-bars-top").innerHTML = deck.map((_, i) => `<span class="${i < index ? "done" : i === index ? "now" : ""}"></span>`).join("");
    const c = deck[index];
    overlay.querySelector(".wr-card").className = `wr-card ${c.cls}`;
    overlay.querySelector(".wr-card").innerHTML = c.html;
  }

  function close() {
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
    overlay.addEventListener("click", (e) => {
      if (e.target.closest(".wr-close")) return close();
      if (e.target.closest(".wr-share")) return share();
      if (e.target.closest(".wr-prev")) return show(index - 1);
      if (e.target.closest(".wr-next")) return index === deck.length - 1 ? close() : show(index + 1);
    });
    document.addEventListener("keydown", (e) => {
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    });
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
    overlay.classList.add("open");
    document.documentElement.classList.add("wr-lock");
    show(0);
  }

  window.Wrapped = { open, yearToShow };
})();
