/*
 * Challenges & achievements (Profile): badges you earn from what you've watched.
 * Each challenge has three levels (bronze, silver, gold): 10 classics → 25 → 50, films from
 * 10 countries → 25 → 40, a movie from every decade… A badge shows your progress to the
 * next level; "Next up" shows the ones you're closest to; tap one for the titles that count.
 * A level you've just reached gets a "New" ribbon and a toast (the levels you've seen are
 * remembered in this browser: mn:achSeen).
 *
 * Watched = in your library, unless it's only on your Watchlist. Directors, cast, countries,
 * languages and franchises come from the film facts (js/services/facts.js), looked up once.
 * Trivia scores (js/components/trivia.js) are saved with your profile (trivia: { ref: best }).
 *
 *   Achievements.mount(el)  draw the section into el (and keep it up to date)
 *   Achievements.compute(facts) -> [{ def, n, level, items, … }]
 */
(function () {
  const { esc, toast } = UI;
  const SEEN = "mn:achSeen";
  const TIERS = ["Bronze", "Silver", "Gold"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const seen = (i) => i.rating != null || !!i.watchedAt || !i.watchlist;
  const isFilm = (i) => i.type === "movie" || (i.type === "anime" && i.tmdbMedia === "movie");
  const byDate = (a, b) => String(a.watchedAt || "9999").localeCompare(String(b.watchedAt || "9999")) || (a.order || 0) - (b.order || 0);
  const minutes = (runtime) => {
    const text = String(runtime || "").split("·").pop();
    const h = /(\d+)\s*h/.exec(text);
    const m = /(\d+)\s*min/.exec(text);
    return h || m ? (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) : 0;
  };

  // the biggest group: { key, items } (items in the order you watched them)
  function biggest(list, keysOf) {
    const groups = new Map();
    list.forEach((i) => keysOf(i).forEach((k) => (groups.get(k) || groups.set(k, []).get(k)).push(i)));
    let best = { key: null, items: [] };
    groups.forEach((items, key) => items.length > best.items.length && (best = { key, items }));
    return best;
  }
  // one title per new value (the first country, decade, genre you reached)
  function distinct(list, keysOf) {
    const got = new Set();
    const items = [];
    const keys = [];
    list.forEach((i) =>
      keysOf(i).forEach((k) => {
        if (got.has(k)) return;
        got.add(k);
        items.push(i);
        keys.push(k);
      })
    );
    return { items, keys };
  }

  /* ---------------- the challenges ---------------- */
  // count(list, fx) -> { items (they count, in watch order), keys?, who? }; list = watched, oldest first
  const DEFS = [
    {
      id: "classics",
      icon: "🎞️",
      name: "Old Soul",
      what: (g) => `Watch ${g} classics (made before 1980)`,
      goals: [10, 25, 50],
      count: (list) => ({ items: list.filter((i) => i.year && i.year < 1980) }),
    },
    {
      id: "countries",
      icon: "🌍",
      name: "Globetrotter",
      what: (g) => `Watch titles from ${g} countries`,
      goals: [10, 25, 40],
      facts: true,
      count: (list, fx) => distinct(list, (i) => (fx(i) && fx(i).k) || []),
      keyLabel: (k) => (window.TMDB ? TMDB.countryName(k) : k),
    },
    {
      id: "director",
      icon: "🎬",
      name: "Auteur",
      what: (g) => `Watch ${g} films by the same director`,
      goals: [5, 8, 12],
      facts: true,
      count: (list, fx) => {
        const b = biggest(list.filter(isFilm), (i) => ((fx(i) && fx(i).d) || []).map((p) => p[1]));
        return { items: b.items, who: b.key };
      },
    },
    {
      id: "october",
      icon: "🎃",
      name: "Spooky Season",
      what: (g) => `Watch ${g} horror titles in one October`,
      goals: [5, 10, 20],
      count: (list) => {
        const b = biggest(
          list.filter((i) => /-10-/.test(i.watchedAt || "") && (i.genres || []).includes("Horror")),
          (i) => [i.watchedAt.slice(0, 4)]
        );
        return { items: b.items, who: b.key ? `October ${b.key}` : null };
      },
    },
    {
      id: "decades",
      icon: "⏳",
      name: "Time Traveller",
      what: (g) => (g >= 10 ? "Watch a movie from every decade, the 1930s to the 2020s" : `Watch movies from ${g} different decades`),
      goals: [4, 7, 10],
      count: (list) => distinct(list.filter(isFilm), (i) => (i.year >= 1930 ? [Math.floor(i.year / 10) * 10] : [])),
      keyLabel: (k) => `${k}s`,
    },
    {
      id: "actor",
      icon: "🌟",
      name: "Superfan",
      what: (g) => `Watch ${g} titles with the same actor`,
      goals: [5, 10, 20],
      facts: true,
      count: (list, fx) => {
        const b = biggest(list, (i) => ((fx(i) && fx(i).c) || []).slice(0, 8).map((p) => p[1]));
        return { items: b.items, who: b.key };
      },
    },
    {
      id: "franchise",
      icon: "🧩",
      name: "Franchise Fan",
      what: (g) => `Watch ${g} films from the same franchise`,
      goals: [3, 5, 8],
      facts: true,
      count: (list, fx) => {
        const b = biggest(list.filter(isFilm), (i) => (fx(i) && fx(i).f ? [fx(i).f[1]] : []));
        return { items: b.items, who: b.key };
      },
    },
    {
      id: "world",
      icon: "🗺️",
      name: "Subtitles On",
      what: (g) => `Watch ${g} titles not in English`,
      goals: [5, 15, 40],
      facts: true,
      count: (list, fx) => ({ items: list.filter((i) => fx(i) && fx(i).l && fx(i).l !== "en") }),
    },
    {
      id: "epic",
      icon: "⌛",
      name: "Epic Endurance",
      what: (g) => `Watch ${g} movie${g === 1 ? "" : "s"} over 2h30`,
      goals: [1, 5, 15],
      count: (list, fx) => ({ items: list.filter((i) => isFilm(i) && (minutes(i.runtime) || (fx(i) && fx(i).r) || 0) > 150) }),
    },
    {
      id: "marathon",
      icon: "🍿",
      name: "Marathon",
      what: (g) => `Watch ${g} titles in one day`,
      goals: [2, 3, 5],
      count: (list) => {
        const b = biggest(list.filter((i) => i.watchedAt), (i) => [i.watchedAt]);
        const d = b.key && new Date(`${b.key}T00:00:00`);
        return { items: b.items, who: d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : null };
      },
    },
    {
      id: "genres",
      icon: "🎨",
      name: "Omnivore",
      what: (g) => `Watch titles in ${g} different genres`,
      goals: [6, 10, 14],
      count: (list) => distinct(list, (i) => i.genres || []),
      keyLabel: (k) => k,
    },
    {
      id: "anime",
      icon: "🐉",
      name: "Otaku",
      what: (g) => `Watch ${g} anime`,
      goals: [5, 15, 40],
      count: (list) => ({ items: list.filter((i) => i.type === "anime") }),
    },
    {
      id: "series",
      icon: "📺",
      name: "Binge Mode",
      what: (g) => `Watch ${g} series`,
      goals: [5, 15, 40],
      count: (list) => ({ items: list.filter((i) => i.type === "tv") }),
    },
    {
      id: "century",
      icon: "💯",
      name: "Cinephile",
      what: (g) => `Watch ${g} titles`,
      goals: [25, 100, 500],
      count: (list) => ({ items: list }),
    },
    {
      id: "critic",
      icon: "✍️",
      name: "Critic",
      what: (g) => `Rate ${g} titles`,
      goals: [10, 50, 200],
      count: (list) => ({ items: list.filter((i) => typeof i.rating === "number") }),
    },
    {
      id: "tens",
      icon: "⭐",
      name: "Perfect 10",
      what: (g) => `Give ${g} perfect 10${g === 1 ? "" : "s"}`,
      goals: [1, 5, 15],
      count: (list) => ({ items: list.filter((i) => i.rating === 10) }),
    },
    {
      id: "trivia",
      icon: "🧠",
      name: "Movie Buff",
      what: (g) => (g === 1 ? "Score 7/10 or more in a movie's trivia" : `Score 7/10 or more in ${g} trivia games`),
      goals: [1, 5, 15],
      count: (list) => {
        const best = Store.getProfile().trivia || {};
        return { items: list.filter((i) => (best[i.id] || 0) >= 7) };
      },
    },
  ];

  function compute(facts) {
    const fx = (i) => (facts && facts.get(i.id)) || null;
    const list = Store.all().filter(seen).sort(byDate);
    return DEFS.map((def) => {
      const r = def.count(list, fx);
      const n = r.items.length;
      const level = def.goals.filter((g) => n >= g).length; // 0 = not yet, 3 = gold
      const next = def.goals[level] || null;
      // the day each level was reached: when you watched the title that got you there
      const dates = def.goals.map((g) => (n >= g ? r.items[g - 1].watchedAt || null : null));
      return Object.assign({ def, n, level, next, dates }, r);
    });
  }

  /* ---------------- drawing ---------------- */

  let host = null;
  let facts = null;
  let results = [];
  let loading = null; // { done, total } while the film facts come in
  let fresh = new Set(); // ids with a level you haven't seen yet

  const day = (d) => {
    if (!d) return "";
    const x = new Date(`${d}T00:00:00`);
    return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
  };
  const pct = (r) => (r.next ? Math.min(100, (r.n / r.next) * 100) : 100);

  function badgeHtml(r, big) {
    const tier = r.level ? TIERS[r.level - 1].toLowerCase() : "locked";
    const waiting = r.def.facts && loading && !facts;
    return `<button class="ach${big ? " ach-big" : ""} t-${tier}${fresh.has(r.def.id) ? " fresh" : ""}" type="button" data-ach="${r.def.id}" style="--p:${pct(r)}%">
      ${fresh.has(r.def.id) ? '<em class="ach-new">New</em>' : ""}
      <span class="ach-medal" aria-hidden="true"><span>${r.def.icon}</span></span>
      <span class="ach-text">
        <strong>${esc(r.def.name)}</strong>
        <small>${esc(r.def.what(r.next || r.def.goals[2]))}</small>
        <span class="ach-bar"><i></i></span>
        <span class="ach-meta">${
          waiting
            ? '<i class="fa-solid fa-spinner fa-spin"></i> Checking your titles…'
            : `${r.level ? `<b>${TIERS[r.level - 1]}</b> · ` : ""}${r.next ? `${Math.min(r.n, r.next)} / ${r.next}${r.who ? ` · ${esc(r.who)}` : ""}` : "All three levels done"}`
        }</span>
      </span>
    </button>`;
  }

  function render() {
    if (!host) return;
    const count = [0, 0, 0];
    results.forEach((r) => r.level && count[r.level - 1]++);
    const total = DEFS.length * 3;
    const got = results.reduce((s, r) => s + r.level, 0);
    // closest to their next level (not started ones last)
    const upNext = results
      .filter((r) => r.next && r.n > 0 && !(r.def.facts && !facts))
      .sort((a, b) => pct(b) - pct(a))
      .slice(0, 3);
    host.innerHTML = `
      <div class="row-head ach-head">
        <h2><i class="fa-solid fa-trophy"></i> Challenges &amp; achievements</h2>
        <span class="ach-tally" title="${got} of ${total} levels">
          <span class="t-gold">${count[2]}</span><span class="t-silver">${count[1]}</span><span class="t-bronze">${count[0]}</span>
        </span>
      </div>
      <div class="ach-progress"><span style="--p:${(got / total) * 100}%"></span><small>${got} of ${total} levels${
        loading && !facts ? ` · checking your titles ${loading.done}/${loading.total}` : ""
      }</small></div>
      ${upNext.length ? `<h3 class="ach-sub">Next up</h3><div class="ach-next">${upNext.map((r) => badgeHtml(r, true)).join("")}</div>` : ""}
      <h3 class="ach-sub">All challenges</h3>
      <div class="ach-grid">${results
        .slice()
        .sort((a, b) => b.level - a.level || pct(b) - pct(a))
        .map((r) => badgeHtml(r))
        .join("")}</div>`;
  }

  // a level you haven't seen: the "New" ribbon and a toast (not on your very first visit)
  function notice() {
    const had = Store.read(SEEN, null);
    const now = {};
    results.forEach((r) => (now[r.def.id] = r.level));
    if (had) {
      const up = results.filter((r) => r.level > (had[r.def.id] || 0) && !(r.def.facts && !facts));
      up.forEach((r) => fresh.add(r.def.id));
      if (up.length === 1) toast(`🏆 Unlocked: ${up[0].def.name} (${TIERS[up[0].level - 1]})`);
      else if (up.length > 1) toast(`🏆 ${up.length} new achievements unlocked`);
    }
    // (while the facts load, those challenges keep their old level)
    if (!facts && had) DEFS.filter((d) => d.facts).forEach((d) => (now[d.id] = had[d.id] || 0));
    Store.write(SEEN, now);
  }

  async function refresh() {
    results = compute(facts);
    render();
  }

  let viewer = null;
  function open(id) {
    const r = results.find((x) => x.def.id === id);
    if (!r) return;
    if (!viewer) {
      viewer = Cards.makeOverlay("ach-modal", `<div class="ach-m"></div>`);
      viewer.addEventListener("click", (e) => {
        const p = e.target.closest("[data-open]");
        if (p) location.href = `title.html?id=${encodeURIComponent(p.dataset.open)}`;
      });
    }
    const tier = r.level ? TIERS[r.level - 1].toLowerCase() : "locked";
    const shown = r.items.slice(0, 40);
    viewer.querySelector(".ach-m").innerHTML = `
      <div class="ach-m-top t-${tier}">
        <span class="ach-medal" aria-hidden="true"><span>${r.def.icon}</span></span>
        <div><span class="xr-label"><i class="fa-solid fa-trophy"></i> ${r.level ? `${TIERS[r.level - 1]} reached` : "Not reached yet"}</span>
        <h3>${esc(r.def.name)}</h3>${r.who ? `<p class="ach-who">${esc(r.who)}</p>` : ""}</div>
      </div>
      <ol class="ach-levels">${r.def.goals
        .map(
          (g, k) => `<li class="${r.n >= g ? "done" : ""} t-${TIERS[k].toLowerCase()}"><span class="ach-dot">${r.n >= g ? '<i class="fa-solid fa-check"></i>' : k + 1}</span>
            <div><b>${TIERS[k]}</b><small>${esc(r.def.what(g))}</small></div>
            <em>${r.n >= g ? (r.dates[k] ? day(r.dates[k]) : "Done") : `${r.n} / ${g}`}</em></li>`
        )
        .join("")}</ol>
      ${
        shown.length
          ? `<h4>${r.keys ? "The first of each" : "The titles that count"} <small>${r.items.length}</small></h4>
            <div class="ach-posters">${shown
              .map(
                (i, k) => `<button type="button" data-open="${esc(i.id)}" title="${esc(Lang.title(i))}${r.keys && r.def.keyLabel ? ` · ${esc(r.def.keyLabel(r.keys[k]))}` : ""}">
                  <img src="${Store.poster(Cards.posterOf(i), "w154")}" alt="${esc(Lang.title(i))}" loading="lazy" />${
                  r.keys && r.def.keyLabel ? `<span>${esc(r.def.keyLabel(r.keys[k]))}</span>` : ""
                }</button>`
              )
              .join("")}</div>${r.items.length > shown.length ? `<p class="ach-more">and ${r.items.length - shown.length} more</p>` : ""}`
          : `<p class="ach-empty">Nothing yet: ${esc(r.def.what(r.def.goals[0]).replace(/^./, (c) => c.toLowerCase()))} to get Bronze.</p>`
      }`;
    // seen now: the ribbon goes
    if (fresh.delete(id)) render();
    Cards.openModal(viewer);
  }

  async function mount(el) {
    host = el;
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ach]");
      if (b) open(b.dataset.ach);
    });
    results = compute(null);
    // without TMDB there are no facts: those challenges count what they can
    if (!window.Facts || !window.TMDB || !TMDB.enabled()) {
      facts = new Map();
      results = compute(facts);
      notice();
      return render();
    }
    const list = Store.all().filter(seen);
    loading = { done: 0, total: list.length };
    render();
    let last = 0;
    facts = null;
    const got = await Facts.forItems(list, (done, total) => {
      loading = { done, total };
      // the counter moves now and then (not on every title)
      if (Date.now() - last > 400) {
        last = Date.now();
        const s = host.querySelector(".ach-progress small");
        if (s) s.textContent = `${results.reduce((a, r) => a + r.level, 0)} of ${DEFS.length * 3} levels · checking your titles ${done}/${total}`;
      }
    });
    facts = got;
    loading = null;
    results = compute(facts);
    notice();
    render();
  }

  // your library changed (a title rated, watched, removed): count again
  Store.onChange(() => host && refresh());

  window.Achievements = { mount, compute, DEFS };
})();
