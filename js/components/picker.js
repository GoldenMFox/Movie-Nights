/*
 * "What should I watch?": any button with the class "random-pick" (the shuffle button in
 * the navbar) opens this pop-up.
 * You say where from (your Watchlist, your Favorites for a rewatch, or Discover: new
 * titles from TMDB), what (movie / series / anime), the mood, how old, who's watching
 * and how much time you have. It makes a shortlist of up to five, best fits first, and
 * spins to one of them. Tap another poster to look at it, "Not tonight" drops one,
 * "Spin" picks again, "New shortlist" draws five more.
 * Your answers are remembered in this browser (mn:picker).
 */
(function () {
  const { esc, toast } = UI;
  const SAVED = "mn:picker";
  const SIZE = 5; // titles on a shortlist
  const THIS_YEAR = new Date().getFullYear();
  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const choice = Object.assign({ from: "watch", what: "any", mood: "", age: "any", who: "", time: "any", mine: false }, Store.read(SAVED, {}));

  // each mood: the genres that fit it, and the ones Discover asks TMDB for
  const MOODS = {
    fun: { emoji: "😄", label: "Fun", genres: ["Comedy", "Adventure", "Animation", "Family", "Fantasy", "Music"], ask: ["Comedy"] },
    intense: { emoji: "😨", label: "Intense", genres: ["Thriller", "Action", "Horror", "Crime", "War", "Mystery"], ask: ["Thriller", "Action", "Horror", "Crime"] },
    think: { emoji: "🧠", label: "Thought-provoking", genres: ["Science Fiction", "Mystery", "Documentary", "History", "Drama"], ask: ["Science Fiction", "Mystery", "History"] },
    emotional: { emoji: "❤️", label: "Emotional", genres: ["Drama", "Romance", "Family", "Music", "War"], ask: ["Romance", "Drama"] },
  };
  const AGES = {
    new: { emoji: "🆕", label: "New", hint: `${THIS_YEAR - 2} or later`, from: THIS_YEAR - 2 },
    any: { emoji: "📼", label: "Any", hint: "Any year" },
    classic: { emoji: "🏆", label: "Classics", hint: "Before 2000", to: 1999 },
  };
  // who's watching: genres that suit the company (a plus), and ones that don't (a minus;
  // with the family they're left out altogether)
  const WHO = {
    alone: { emoji: "👤", label: "Alone", like: ["Drama", "Science Fiction", "Mystery", "Thriller"], avoid: [] },
    date: { emoji: "❤️", label: "Date", like: ["Romance", "Comedy", "Drama"], avoid: ["War", "Documentary", "Kids"] },
    family: { emoji: "👨‍👩‍👧", label: "Family", like: ["Family", "Animation", "Adventure", "Comedy", "Fantasy"], avoid: ["Horror", "War", "Crime", "Thriller"], strict: true },
    friends: { emoji: "👥", label: "Friends", like: ["Comedy", "Horror", "Action", "Thriller"], avoid: ["Documentary", "Romance"] },
  };
  const TYPES = { any: () => true, movie: (i) => i.type === "movie", tv: (i) => i.type === "tv", anime: (i) => i.type === "anime" };
  const TIMES = { any: null, short: 105, long: 150, episode: "episode" };
  const FROM_LABEL = { watch: "on your Watchlist", fav: "in your Favorites", discover: "on TMDB" };

  let overlay;
  let shortlist = []; // [{ item, hit, why, mins }]; hit = a TMDB result (Discover)
  let current = 0;
  let spinning = null;
  let seen = new Set(); // Discover: titles already shown this time, so "New shortlist" brings others

  const discoverOn = () => !!(window.TMDB && TMDB.enabled());
  const myServices = () => (window.Watch ? Watch.mine() : []);

  /* ---------------- runtimes ---------------- */

  // minutes from "2h 49min" (movies) or "3 seasons · 45min" (one episode of a show)
  function minutes(runtime) {
    const text = String(runtime || "").split("·").pop();
    const h = /(\d+)\s*h/.exec(text);
    const m = /(\d+)\s*min/.exec(text);
    return h || m ? (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) : null;
  }
  const hm = (m) => (m ? `${m >= 60 ? `${Math.floor(m / 60)}h ` : ""}${m % 60 ? `${m % 60}min` : ""}`.trim() : "");

  const isSeries = (i) => i.type === "tv" || (i.type === "anime" && !(i.tmdbMedia === "movie" || i.mediaType === "movie"));

  // runtime of a title: from the library, or looked up on TMDB once and remembered
  // (mn:runtimes: { "movie-157336": 169 }, a movie's length doesn't change)
  const RUNTIMES = "mn:runtimes";
  async function runtimeOf(item) {
    if (item.runtime) return minutes(item.runtime);
    try {
      const ref = await Watch.refOf(item);
      if (!ref) return null;
      const known = Store.read(RUNTIMES, {})[ref];
      if (known !== undefined) return known;
      const [media, id] = ref.split("-");
      const d = await TMDB.detailsById(media, Number(id));
      const mins = d ? minutes(d.runtime) : null;
      const all = Store.read(RUNTIMES, {});
      all[ref] = mins;
      Store.write(RUNTIMES, all);
      return mins;
    } catch (e) {
      return null;
    }
  }

  // the movies' runtimes, a few at a time (a big Watchlist doesn't ask TMDB for everything at once)
  async function runtimes(list) {
    const out = new Array(list.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const n = next++;
        if (!isSeries(list[n])) out[n] = await runtimeOf(list[n]);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return out;
  }

  /* ---------------- what fits ---------------- */

  // the genres of this list the title has (in the list's order: the most telling first)
  const hasAny = (i, list) => list.filter((g) => (i.genres || []).includes(g));

  function fitsAge(i) {
    const a = AGES[choice.age];
    if (!a || (!a.from && !a.to)) return true;
    if (!i.year) return false;
    return (!a.from || i.year >= a.from) && (!a.to || i.year <= a.to);
  }

  // the family doesn't get horror, war, crime or thrillers
  const fitsCompany = (i) => !(choice.who && WHO[choice.who].strict && hasAny(i, WHO[choice.who].avoid).length);
  const fitsMood = (i) => !choice.mood || hasAny(i, MOODS[choice.mood].genres).length > 0;
  const fitsTime = (i) => choice.time !== "episode" || isSeries(i);

  // how well a title fits (plus a little luck, so every shortlist is a bit different),
  // and why, in a few words
  function rate(i) {
    let s = Math.random() * 2;
    const why = [];
    if (choice.mood) {
      const m = hasAny(i, MOODS[choice.mood].genres);
      s += Math.min(m.length, 2) * 3;
      if (m.length) why.push(`${MOODS[choice.mood].emoji} ${m[0]}`);
    }
    if (choice.who) {
      const w = WHO[choice.who];
      const like = hasAny(i, w.like);
      s += (like.length ? Math.min(like.length, 2) * 1.5 : -1) - hasAny(i, w.avoid).length * 3;
      if (like.length && choice.who !== "alone") why.push(`${w.emoji} ${w.label} night`);
    }
    if (i.score) s += (i.score - 6.5) * 0.8; // TMDB's score (Discover)
    if (i.rating) s += (i.rating - 7) * 0.4; // yours (a rewatch)
    if (choice.age !== "any" && i.year) why.push(`${AGES[choice.age].emoji} ${i.year}`);
    return { s, why };
  }

  const libraryPool = () => Store.all().filter((i) => (choice.from === "fav" ? i.favorite : i.watchlist));

  // the titles that pass the quick checks (the button's "12 fit"; runtimes and streaming come later)
  const quickFit = () => libraryPool().filter((i) => TYPES[choice.what](i) && fitsAge(i) && fitsCompany(i) && fitsTime(i));

  async function fromLibrary() {
    let list = quickFit();
    const limit = TIMES[choice.time];
    let mins = [];
    if (limit && limit !== "episode" && list.length) {
      mins = await runtimes(list);
      const keep = list.map((i, n) => isSeries(i) || (mins[n] != null && mins[n] <= limit));
      list = list.filter((_, n) => keep[n]);
      mins = mins.filter((_, n) => keep[n]);
    }
    const minsOf = new Map(list.map((i, n) => [i.id, mins[n]]));
    if (choice.mine && myServices().length && list.length) {
      await Watch.loadProviders(list);
      list = list.filter((i) => (Watch.onMine(i) || []).length);
    }
    // the mood counts: titles that fit it, when there are any
    const moody = list.filter(fitsMood);
    const loose = choice.mood && !moody.length && list.length > 0;
    return { list: (loose ? list : moody).map((item) => ({ item, mins: minsOf.get(item.id) || minutes(item.runtime) })), loose };
  }

  async function fromDiscover() {
    const types = choice.what === "any" ? (choice.time === "episode" ? ["tv"] : ["movie", "tv"]) : [choice.what];
    if (choice.time === "episode" && choice.what === "movie") return { list: [] };
    const w = choice.who && WHO[choice.who];
    const limit = TIMES[choice.time];
    const ask = (type, page) =>
      TMDB.moodPicks({
        type,
        page,
        genres: choice.mood ? MOODS[choice.mood].ask : w && w.strict ? w.like : [],
        need: w && w.strict ? ["Family"] : null,
        without: w && w.strict ? w.avoid : [],
        from: AGES[choice.age].from,
        to: AGES[choice.age].to,
        maxRuntime: type === "movie" && typeof limit === "number" ? limit : null,
        providers: choice.mine ? myServices().map((s) => s.id) : null,
        family: !!(w && w.strict),
      });
    const lists = await Promise.all(
      types.map(async (type) => {
        // a random page of the first few, so it isn't always the same five
        const first = await ask(type, 1 + Math.floor(Math.random() * 3));
        if (first.results.length >= 8 || first.totalPages <= 1) return first.results;
        return (await ask(type, 1)).results;
      })
    );
    const all = lists.flat().filter((h) => (choice.what === "any" || h.type === choice.what) && fitsCompany(h) && !Cards.inLibrary(h));
    const fresh = all.filter((h) => !seen.has(`${h.mediaType}-${h.tmdbId}`));
    return { list: (fresh.length >= SIZE ? fresh : all).map((hit) => ({ item: hit, hit })) };
  }

  /* ---------------- the pop-up ---------------- */

  function seg(name, options) {
    return `<div class="pk-seg" role="group" data-seg="${name}">${options
      .map(([v, label]) => `<button type="button" data-v="${v}" class="${choice[name] === v ? "on" : ""}">${label}</button>`)
      .join("")}</div>`;
  }

  // big emoji tiles; mood and company can be left open (tap the picked one again)
  function tiles(name, map, open) {
    return `<div class="pk-tiles${open ? " open" : ""}" role="group" data-tiles="${name}" style="--n:${Object.keys(map).length}">${Object.entries(map)
      .map(
        ([v, t]) => `<button type="button" data-v="${v}" class="pk-tile${choice[name] === v ? " on" : ""}" aria-pressed="${choice[name] === v}"${
          t.hint ? ` title="${esc(t.hint)}"` : ""
        }><span class="pk-emoji" aria-hidden="true">${t.emoji}</span><span>${esc(t.label)}</span></button>`
      )
      .join("")}</div>`;
  }

  function build() {
    overlay = Cards.makeOverlay(
      "picker-modal",
      `<div class="pk-ask">
         <div class="pk-top">
           <div class="pk-icon"><i class="fa-solid fa-shuffle"></i></div>
           <div><h3>What should I watch?</h3><p class="pk-sub">Tell me the mood, I'll make a shortlist.</p></div>
         </div>
         <div class="pk-form">
           <div class="pk-row"><span>From</span>${seg("from", [["watch", "Watchlist"], ["fav", "Favorites"], ["discover", "Discover"]])}</div>
           <div class="pk-row"><span>What</span>${seg("what", [["any", "Anything"], ["movie", "Movie"], ["tv", "Series"], ["anime", "Anime"]])}</div>
           <div class="pk-q"><span>Mood?</span>${tiles("mood", MOODS, true)}</div>
           <div class="pk-q"><span>How old?</span>${tiles("age", AGES)}</div>
           <div class="pk-q"><span>Who's watching?</span>${tiles("who", WHO, true)}</div>
           <div class="pk-row"><span>Time</span>${seg("time", [["any", "Any"], ["short", '<span class="pk-l">Under </span><span class="pk-s">≤ </span>1h45'], ["long", '<span class="pk-l">Under </span><span class="pk-s">≤ </span>2h30'], ["episode", '<span class="pk-l">An episode</span><span class="pk-s">Episode</span>']])}</div>
           <label class="menu-switch pk-mine" hidden>
             <i class="fa-solid fa-tv"></i><span>Only on my streaming services</span>
             <input type="checkbox" class="pk-mine-input" />
             <span class="switch-track"><span class="switch-thumb"></span></span>
           </label>
         </div>
         <div class="pk-actions">
           <button class="btn btn-primary pk-go" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>Make my shortlist</span><em class="pk-count"></em></button>
         </div>
       </div>
       <div class="pk-short" hidden></div>`
    );

    overlay.addEventListener("click", (e) => {
      const b = e.target.closest(".pk-seg button:not(:disabled)");
      if (b) {
        const name = b.parentElement.dataset.seg;
        choice[name] = b.dataset.v;
        b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        if (name === "from") seen = new Set();
        changed();
      }
      const t = e.target.closest(".pk-tile");
      if (t) {
        const box = t.parentElement;
        const name = box.dataset.tiles;
        choice[name] = box.classList.contains("open") && choice[name] === t.dataset.v ? "" : t.dataset.v;
        if (name === "age" && !choice.age) choice.age = "any";
        box.querySelectorAll(".pk-tile").forEach((x) => {
          x.classList.toggle("on", x.dataset.v === choice[name]);
          x.setAttribute("aria-pressed", x.dataset.v === choice[name]);
        });
        if (choice[name] === t.dataset.v && !calm()) {
          t.classList.remove("pop");
          void t.offsetWidth;
          t.classList.add("pop");
        }
        changed();
      }
      if (e.target.closest(".pk-go")) make();
      if (e.target.closest(".pk-again")) make(true);
      if (e.target.closest(".pk-spin")) spin();
      if (e.target.closest(".pk-edit")) ask();
      const slot = e.target.closest(".pk-slot");
      if (slot && !spinning) feature(Number(slot.dataset.n));
      if (e.target.closest(".pk-drop")) drop();
      if (e.target.closest(".pk-add")) addToWatchlist();
      if (e.target.closest(".pk-trailer")) trailer();
    });
    overlay.querySelector(".pk-mine-input").addEventListener("change", (e) => {
      choice.mine = e.target.checked;
      changed();
    });
    overlay.onclose = stopSpin;
  }

  // a choice changed: remember it, and count what fits
  function changed() {
    Store.write(SAVED, choice);
    const count = overlay.querySelector(".pk-count");
    if (choice.from === "discover") {
      count.textContent = "";
      count.hidden = true;
      return;
    }
    const fit = quickFit();
    const n = fit.filter(fitsMood).length;
    count.hidden = false;
    count.textContent = !n && fit.length ? `${fit.length} close` : `${n} fit`;
  }

  function ask() {
    stopSpin();
    overlay.querySelector(".pk-short").hidden = true;
    overlay.querySelector(".pk-ask").hidden = false;
    overlay.querySelector(".picker-modal").classList.remove("pk-wide");
  }

  async function make(again) {
    const go = overlay.querySelector(again ? ".pk-again" : ".pk-go");
    const label = go.innerHTML;
    go.disabled = true;
    go.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Thinking…</span>';
    let found;
    try {
      found = choice.from === "discover" ? await fromDiscover() : await fromLibrary();
    } catch (e) {
      found = { list: [], error: true };
    } finally {
      go.disabled = false;
      go.innerHTML = label;
    }
    const rated = found.list.map((x) => Object.assign(x, rate(x.item))).sort((a, b) => b.s - a.s);
    // "New shortlist": others first, when there are enough
    const last = new Set(shortlist.map((x) => x.item.id || `${x.item.mediaType}-${x.item.tmdbId}`));
    const others = again ? rated.filter((x) => !last.has(x.item.id || `${x.item.mediaType}-${x.item.tmdbId}`)) : rated;
    let ranked = others.length ? others : rated;
    // Discover, "Anything": movies and series take turns, so it isn't all one kind
    if (choice.from === "discover" && choice.what === "any") {
      const films = ranked.filter((x) => x.item.mediaType === "movie");
      const shows = ranked.filter((x) => x.item.mediaType !== "movie");
      const mix = [];
      while (mix.length < SIZE && (films.length || shows.length)) {
        if (films.length) mix.push(films.shift());
        if (mix.length < SIZE && shows.length) mix.push(shows.shift());
      }
      ranked = mix.sort((a, b) => b.s - a.s);
    }
    shortlist = ranked.slice(0, SIZE);
    shortlist.forEach((x) => x.hit && seen.add(`${x.hit.mediaType}-${x.hit.tmdbId}`));
    show(found, rated.length);
  }

  function tagsHtml() {
    const tags = [
      choice.mood && `${MOODS[choice.mood].emoji} ${MOODS[choice.mood].label}`,
      choice.age !== "any" && `${AGES[choice.age].emoji} ${AGES[choice.age].label}`,
      choice.who && `${WHO[choice.who].emoji} ${WHO[choice.who].label}`,
      choice.what !== "any" && { movie: "Movies", tv: "Series", anime: "Anime" }[choice.what],
      choice.time !== "any" && { short: "Under 1h45", long: "Under 2h30", episode: "An episode" }[choice.time],
    ].filter(Boolean);
    return tags.map((t) => `<span>${esc(t)}</span>`).join("") || `<span>Anything goes</span>`;
  }

  function show(found, total) {
    const box = overlay.querySelector(".pk-short");
    overlay.querySelector(".pk-ask").hidden = true;
    box.hidden = false;
    const head = `<div class="pk-short-head">
        <div><small>Your shortlist</small><div class="pk-tags">${tagsHtml()}</div></div>
        <button class="icon-btn pk-edit" type="button" aria-label="Change the mood" title="Change the mood"><i class="fa-solid fa-sliders"></i></button>
      </div>`;
    if (!shortlist.length) {
      overlay.querySelector(".picker-modal").classList.remove("pk-wide");
      box.innerHTML = `${head}<div class="pk-none"><span class="pk-emoji" aria-hidden="true">🤷</span><p>${
        found.error ? "TMDB didn't answer. Try again in a moment." : `Nothing ${FROM_LABEL[choice.from]} matches all that. Try fewer choices.`
      }</p><button class="btn btn-primary pk-edit" type="button"><i class="fa-solid fa-sliders"></i> Change the mood</button></div>`;
      return;
    }
    overlay.querySelector(".picker-modal").classList.add("pk-wide");
    box.innerHTML = `${head}
      ${found.loose ? `<p class="pk-loose"><i class="fa-regular fa-lightbulb"></i> Nothing ${FROM_LABEL[choice.from]} is quite that mood, so here are the closest.</p>` : ""}
      <div class="pk-feature" aria-live="polite"></div>
      <div class="pk-strip" style="--n:${shortlist.length}">${shortlist
        .map(
          (x, n) => `<button class="pk-slot" type="button" data-n="${n}" aria-label="${esc(Lang.title(x.item))}" style="--d:${n * 60}ms">
            <img src="${Store.poster(Cards.posterOf(x.item), "w185")}" alt="" loading="lazy" /><b>${n + 1}</b></button>`
        )
        .join("")}</div>
      <div class="pk-more">
        <button class="btn pk-spin" type="button"${shortlist.length < 2 ? " disabled" : ""}><i class="fa-solid fa-dice"></i> Spin</button>
        <button class="btn pk-again" type="button"${total <= shortlist.length && choice.from !== "discover" ? " disabled" : ""}><i class="fa-solid fa-rotate"></i> New shortlist</button>
      </div>`;
    current = 0;
    // a quick spin to the first pick (straight to it with reduced motion)
    if (shortlist.length > 1 && !calm()) spin(0);
    else feature(0);
  }

  function feature(n) {
    current = n;
    const x = shortlist[n];
    if (!x) return;
    const { item, hit } = x;
    overlay.querySelectorAll(".pk-slot").forEach((s) => s.classList.toggle("on", Number(s.dataset.n) === n));
    const url = hit ? `title.html?tmdb=${hit.mediaType}-${hit.tmdbId}` : `title.html?id=${encodeURIComponent(item.id)}`;
    const services = (!hit && window.Watch && Watch.onMine(item)) || [];
    const meta = [item.year, Store.TYPE_LABEL[item.type], hm(x.mins), (item.genres || []).slice(0, 2).join(", ")].filter(Boolean).map(esc).join(" · ");
    const art = item.backdrop ? Store.poster(item.backdrop, "w780") : Store.poster(Cards.posterOf(item), "w342");
    const onList = hit && Cards.inLibrary(hit) && Cards.inLibrary(hit).watchlist;
    const box = overlay.querySelector(".pk-feature");
    box.style.setProperty("--art", `url("${art}")`);
    box.innerHTML = `<div class="pk-f-in">
        <a class="pk-poster" href="${url}"><img src="${Store.poster(Cards.posterOf(item), "w342")}" alt="" /></a>
        <div class="pk-info">
          <small>${n === 0 ? "Best fit" : `Pick ${n + 1} of ${shortlist.length}`}${item.score ? ` · <i class="fa-solid fa-star"></i> ${item.score}` : ""}${
      item.rating ? ` · you gave it ${Cards.formatRating(item.rating)}` : ""
    }</small>
          <h4><a href="${url}">${esc(Lang.title(item))}</a></h4>
          <p>${meta}</p>
          ${x.why.length ? `<div class="pk-why">${x.why.map((w) => `<span>${esc(w)}</span>`).join("")}</div>` : ""}
          ${services.length ? `<p class="pk-on"><i class="fa-solid fa-tv"></i> On ${services.map((s) => esc(s.name)).join(", ")}</p>` : ""}
          ${hit && item.overview ? `<p class="pk-plot">${esc(item.overview)}</p>` : ""}
        </div>
        <div class="pk-buttons">
            <a class="btn btn-primary" href="${url}"><i class="fa-solid fa-play"></i> Let's watch</a>
            ${
              hit
                ? `<button class="btn pk-add${onList ? " done" : ""}" type="button"${onList ? " disabled" : ""} title="${onList ? "On your Watchlist" : "Add to Watchlist"}"><i class="fa-${onList ? "solid fa-check" : "regular fa-bookmark"}"></i> <span>${
                    onList ? "On your Watchlist" : "Watchlist"
                  }</span></button>`
                : ""
            }
            <button class="btn pk-trailer" type="button" aria-label="Trailer" title="Trailer"><i class="fa-brands fa-youtube"></i></button>
            <button class="btn pk-drop" type="button" aria-label="Not tonight" title="Not tonight"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>`;
    if (!calm()) {
      box.classList.remove("in");
      void box.offsetWidth;
      box.classList.add("in");
    }
  }

  // the highlight runs along the posters, slowing down, and stops on one
  function spin(to) {
    if (spinning || shortlist.length < 2) return;
    const slots = [...overlay.querySelectorAll(".pk-slot")];
    let target = to;
    if (target == null) {
      const others = shortlist.map((_, n) => n).filter((n) => n !== current);
      target = others[Math.floor(Math.random() * others.length)];
    }
    if (calm()) return feature(target);
    const steps = slots.length * 2 + ((target - current + slots.length) % slots.length);
    let step = 0;
    let at = current;
    overlay.querySelector(".pk-short").classList.add("spinning");
    const tick = () => {
      at = (at + 1) % slots.length;
      slots.forEach((s, n) => s.classList.toggle("hot", n === at));
      step++;
      if (step >= steps) {
        spinning = null;
        overlay.querySelector(".pk-short").classList.remove("spinning");
        slots.forEach((s) => s.classList.remove("hot"));
        feature(target);
        return;
      }
      spinning = setTimeout(tick, 55 + Math.pow(step / steps, 3) * 320);
    };
    spinning = setTimeout(tick, 40);
  }

  function stopSpin() {
    clearTimeout(spinning);
    spinning = null;
    if (overlay) overlay.querySelectorAll(".pk-slot.hot").forEach((s) => s.classList.remove("hot"));
    if (overlay) overlay.querySelector(".pk-short").classList.remove("spinning");
  }

  // "Not tonight": off the shortlist, the next one moves up
  function drop() {
    if (spinning) return;
    shortlist.splice(current, 1);
    if (!shortlist.length) {
      const box = overlay.querySelector(".pk-short");
      box.querySelector(".pk-feature").innerHTML = `<div class="pk-none"><span class="pk-emoji" aria-hidden="true">🍿</span><p>That was the whole shortlist.</p></div>`;
      box.querySelector(".pk-strip").innerHTML = "";
      box.querySelector(".pk-spin").disabled = true;
      box.querySelector(".pk-again").disabled = false;
      return;
    }
    const strip = overlay.querySelector(".pk-strip");
    strip.style.setProperty("--n", shortlist.length);
    strip.querySelector(`.pk-slot[data-n="${current}"]`).remove();
    strip.querySelectorAll(".pk-slot").forEach((s, n) => {
      s.dataset.n = n;
      s.querySelector("b").textContent = n + 1;
      s.style.removeProperty("--d");
    });
    overlay.querySelector(".pk-spin").disabled = shortlist.length < 2;
    feature(Math.min(current, shortlist.length - 1));
  }

  function addToWatchlist() {
    const x = shortlist[current];
    if (!x || !x.hit) return;
    if (Store.guest) {
      // (the menu with the Sign in button is behind this pop-up)
      Cards.closeModal(overlay);
      return UI.needSignIn();
    }
    Cards.addHit(x.hit, { watchlist: true });
    toast(`${Lang.title(x.hit)} added to Watchlist`);
    feature(current);
  }

  async function trailer() {
    const x = shortlist[current];
    if (!x) return;
    const ref = x.hit ? `${x.hit.mediaType}-${x.hit.tmdbId}` : await Watch.refOf(x.item);
    const details = () => {
      if (!ref) return Promise.resolve(null);
      const [media, id] = ref.split("-");
      return TMDB.detailsById(media, Number(id));
    };
    Cards.showTrailer(
      x.item,
      () => details().then((d) => d && d.trailer),
      () => details().then((d) => ((d && d.videos) || []).map((v) => v.key))
    );
  }

  function openPicker() {
    const hasList = !Store.guest && Store.all().some((i) => i.watchlist || i.favorite);
    if (!hasList && !discoverOn()) {
      if (Store.guest) return UI.needSignIn();
      toast("Add something to your Watchlist first");
      return;
    }
    if (!overlay) build();
    const count = { watch: 0, fav: 0 };
    if (!Store.guest) Store.all().forEach((i) => (i.watchlist && count.watch++, i.favorite && count.fav++));
    const can = { watch: count.watch > 0, fav: count.fav > 0, discover: discoverOn() };
    // nothing where you picked last time: the next place that has something
    if (!can[choice.from]) choice.from = ["watch", "fav", "discover"].find((f) => can[f]);
    overlay.querySelectorAll('[data-seg="from"] button').forEach((x) => {
      x.disabled = !can[x.dataset.v];
      x.title = can[x.dataset.v] ? "" : Store.guest && x.dataset.v !== "discover" ? "Sign in for your own lists" : "Nothing here yet";
      x.classList.toggle("on", x.dataset.v === choice.from);
    });
    overlay.querySelector(".pk-mine").hidden = !myServices().length;
    overlay.querySelector(".pk-mine-input").checked = !!choice.mine && myServices().length > 0;
    changed();
    ask();
    Cards.openModal(overlay);
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".random-pick")) return;
    e.preventDefault();
    openPicker();
  });

  window.Picker = { open: openPicker };
})();
