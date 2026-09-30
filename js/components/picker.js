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

  const choice = Object.assign({ from: "discover", what: "any", mood: "", age: "any", who: "", time: "any", mine: false }, Store.read(SAVED, {}));

  // each mood: the genres that fit it, and the ones Discover asks TMDB for
  const MOODS = {
    fun: { icon: "fa-face-laugh-beam", label: "Fun", word: "fun", genres: ["Comedy", "Adventure", "Animation", "Family", "Fantasy", "Music"], ask: ["Comedy"] },
    intense: { icon: "fa-bolt", label: "Intense", word: "intense", genres: ["Thriller", "Action", "Horror", "Crime", "War", "Mystery"], ask: ["Thriller", "Action", "Horror", "Crime"] },
    think: { icon: "fa-brain", label: "Thought-provoking", short: "Deep", word: "thought-provoking", genres: ["Science Fiction", "Mystery", "Documentary", "History", "Drama"], ask: ["Science Fiction", "Mystery", "History"] },
    emotional: { icon: "fa-heart", label: "Emotional", word: "moving", genres: ["Drama", "Romance", "Family", "Music", "War"], ask: ["Romance", "Drama"] },
  };
  // the era: any year, the last few, one decade, or the classics (before 1980)
  const AGES = {
    any: { label: "Any", hint: "Any year" },
    new: { label: "New", word: "new", hint: `${THIS_YEAR - 2} or later`, from: THIS_YEAR - 2 },
    d2010: { label: "2010s", short: "'10s", word: "2010s", from: 2010, to: 2019 },
    d2000: { label: "2000s", short: "'00s", word: "2000s", from: 2000, to: 2009 },
    d1990: { label: "'90s", word: "'90s", from: 1990, to: 1999 },
    d1980: { label: "'80s", word: "'80s", an: true, from: 1980, to: 1989 },
    classic: { label: "Classics", word: "classic", hint: "Before 1980", to: 1979 },
  };
  if (!AGES[choice.age]) choice.age = "any";
  // who's watching: genres that suit the company (a plus), and ones that don't (a minus;
  // with the family they're left out altogether)
  const WHO = {
    alone: { icon: "fa-user", label: "Alone", phrase: "to watch <b>alone</b>", like: ["Drama", "Science Fiction", "Mystery", "Thriller"], avoid: [] },
    date: { icon: "fa-champagne-glasses", label: "Date", phrase: "for a <b>date night</b>", like: ["Romance", "Comedy", "Drama"], avoid: ["War", "Documentary", "Kids"] },
    family: { icon: "fa-children", label: "Family", phrase: "for the whole <b>family</b>", like: ["Family", "Animation", "Adventure", "Comedy", "Fantasy"], avoid: ["Horror", "War", "Crime", "Thriller"], strict: true },
    friends: { icon: "fa-user-group", label: "Friends", phrase: "to watch with <b>friends</b>", like: ["Comedy", "Horror", "Action", "Thriller"], avoid: ["Documentary", "Romance"] },
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
      if (m.length) why.push(`<i class="fa-solid ${MOODS[choice.mood].icon}"></i> ${esc(m[0])}`);
    }
    if (choice.who) {
      const w = WHO[choice.who];
      const like = hasAny(i, w.like);
      s += (like.length ? Math.min(like.length, 2) * 1.5 : -1) - hasAny(i, w.avoid).length * 3;
      if (like.length && choice.who !== "alone") why.push(`<i class="fa-solid ${w.icon}"></i> ${esc(w.label)} night`);
    }
    if (i.score) s += (i.score - 6.5) * 0.8; // TMDB's score (Discover)
    if (i.rating) s += (i.rating - 7) * 0.4; // yours (a rewatch)
    if (choice.age !== "any" && i.year) why.push(`<i class="fa-solid fa-calendar"></i> ${i.year}`);
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

  // a row of pill buttons (the site's switches: the red pill glides to the pick). open: the
  // picked one can be tapped again to leave it open (mood, company)
  function seg(name, options, open) {
    return `<div class="pk-seg${open ? " open" : ""}" role="group" data-seg="${name}">${options
      .map(([v, label]) => `<button type="button" data-v="${v}" class="${choice[name] === v ? "on" : ""}">${label}</button>`)
      .join("")}</div>`;
  }
  const opt = (icon, label, short) =>
    `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${short ? `<span class="pk-l">${label}</span><span class="pk-s">${short}</span>` : label}</span>`;
  const row = (icon, label, body, n) => `<div class="pk-row" style="--d:${n * 55}ms"><span class="pk-lab"><i class="fa-solid ${icon}"></i> ${label}</span>${body}</div>`;

  function build() {
    overlay = Cards.makeOverlay(
      "picker-modal",
      `<div class="pk-ask">
         <div class="pk-stage">
           <div class="pk-bg"></div><div class="pk-bg"></div><div class="pk-shade"></div>
           <div class="pk-stage-text">
             <span class="pk-kicker"><i class="fa-solid fa-shuffle"></i> What should I watch?</span>
             <p class="pk-sentence" aria-live="polite"></p>
           </div>
           <div class="pk-tally"><b class="pk-num">0</b><small>fit</small></div>
           <span class="pk-cap"></span>
         </div>
         <div class="pk-form">
           ${row("fa-layer-group", "From", seg("from", [["watch", opt("fa-bookmark", "Watchlist")], ["fav", opt("fa-heart", "Favorites")], ["discover", opt("fa-compass", "Discover")]]), 1)}
           ${row("fa-clapperboard", "What", seg("what", [["any", opt("fa-shuffle", "Anything", "Any")], ["movie", opt("fa-film", "Movie")], ["tv", opt("fa-tv", "Series")], ["anime", opt("fa-dragon", "Anime")]]), 2)}
           ${row("fa-masks-theater", "Mood", seg("mood", Object.entries(MOODS).map(([k, m]) => [k, opt(m.icon, m.label, m.short)]), true), 3)}
           ${row("fa-calendar", "Era", seg("age", Object.entries(AGES).map(([k, a]) => [k, a.short ? `<span class="pk-l">${a.label}</span><span class="pk-s">${a.short}</span>` : a.label])), 4)}
           ${row("fa-couch", "With", seg("who", Object.entries(WHO).map(([k, w]) => [k, opt(w.icon, w.label)]), true), 5)}
           ${row("fa-clock", "Time", seg("time", [["any", opt("fa-infinity", "Any")], ["short", opt("fa-hourglass-start", "Under 1h45", "≤ 1h45")], ["long", opt("fa-hourglass-half", "Under 2h30", "≤ 2h30")], ["episode", opt("fa-tv", "An episode", "Episode")]]), 6)}
           <label class="menu-switch pk-mine" hidden>
             <i class="fa-solid fa-tv"></i><span>Only on my streaming services</span>
             <input type="checkbox" class="pk-mine-input" />
             <span class="switch-track"><span class="switch-thumb"></span></span>
           </label>
         </div>
         <div class="pk-actions">
           <button class="btn btn-primary pk-go" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>Make my shortlist</span></button>
         </div>
       </div>
       <div class="pk-short" hidden></div>`
    );

    overlay.addEventListener("click", (e) => {
      const b = e.target.closest(".pk-seg button:not(:disabled)");
      if (b) {
        const box = b.parentElement;
        const name = box.dataset.seg;
        // (mood and company: tap the picked one again to leave it open)
        choice[name] = box.classList.contains("open") && choice[name] === b.dataset.v ? "" : b.dataset.v;
        box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.v === choice[name]));
        if (name === "from") seen = new Set();
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
    overlay.onclose = () => {
      stopSpin();
      clearInterval(stageTimer);
    };
  }

  /* ---------------- the stage: what you're after, in words, over titles that fit ---------------- */

  // "A thought-provoking classic movie to watch alone, from Discover."
  function sentence() {
    const noun = { any: "pick", movie: "movie", tv: "series", anime: "anime" }[choice.what];
    const words = [choice.mood && MOODS[choice.mood].word, AGES[choice.age].word, noun].filter(Boolean);
    // ("an '80s movie": you say "eighties")
    const a = /^[aeiou]/i.test(words[0]) || (words[0] === AGES[choice.age].word && AGES[choice.age].an) ? "An" : "A";
    const who = choice.who ? ` ${WHO[choice.who].phrase}` : "";
    const time = { any: "", short: ", under <b>1h45</b>", long: ", under <b>2h30</b>", episode: ", <b>one episode</b> long" }[choice.time];
    const from = { watch: "from your <b>Watchlist</b>", fav: "from your <b>Favorites</b>", discover: "fresh from <b>Discover</b>" }[choice.from];
    return `${a} ${words.map((w) => `<b>${w}</b>`).join(" ")}${who}${time}, ${from}.`;
  }

  // the backdrops behind it: titles that fit what you've picked (Discover: this week's
  // trending), a new one every few seconds, slowly zooming out (like the Box Office stage)
  let trending = null;
  let stageList = [];
  let stageAt = 0;
  let stageTimer = null;
  let stageLayer = 0;
  const artOf = (i) => (i.backdrop ? Store.img(i.backdrop, "w1280") : i.poster ? Store.poster(Cards.posterOf(i), "w780") : "");
  function stagePool() {
    if (choice.from !== "discover") return quickFit().filter(fitsMood).filter(artOf);
    if (!trending) {
      trending = [];
      TMDB.list("trending")
        .then((r) => {
          trending = (r.results || []).filter((h) => h.backdrop);
          if (choice.from === "discover" && !overlay.querySelector(".pk-ask").hidden) paintStage(true);
        })
        .catch(() => {});
    }
    return trending.filter((h) => TYPES[choice.what](h));
  }
  function showBackdrop() {
    if (!overlay || !stageList.length) return;
    const item = stageList[stageAt++ % stageList.length];
    const layers = overlay.querySelectorAll(".pk-bg");
    const next = layers[(stageLayer = 1 - stageLayer)];
    next.style.backgroundImage = `url("${artOf(item)}")`;
    next.style.backgroundPosition = item.backdrop ? "center 25%" : "center 20%";
    layers.forEach((l) => l.classList.toggle("on", l === next));
    // (restart the slow zoom on the one coming in)
    next.style.animation = "none";
    void next.offsetWidth;
    next.style.animation = "";
    overlay.querySelector(".pk-cap").innerHTML = `<i class="fa-solid fa-film"></i> ${esc(Lang.title(item))}${item.year ? ` · ${item.year}` : ""}`;
  }
  function paintStage(fresh) {
    stageList = shuffle(stagePool());
    stageAt = 0;
    clearInterval(stageTimer);
    if (!stageList.length) {
      overlay.querySelectorAll(".pk-bg").forEach((l) => l.classList.remove("on"));
      overlay.querySelector(".pk-cap").textContent = "";
    } else {
      showBackdrop();
      if (!calm()) stageTimer = setInterval(showBackdrop, 5000);
    }
    const s = overlay.querySelector(".pk-sentence");
    s.innerHTML = sentence();
    if (!fresh && !calm()) {
      s.classList.remove("again");
      void s.offsetWidth;
      s.classList.add("again");
    }
  }
  const shuffle = (a) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };

  // the number on the stage counts to the new one
  let shownCount = 0;
  function tally(n) {
    const box = overlay.querySelector(".pk-tally");
    const num = box.querySelector(".pk-num");
    box.hidden = n == null;
    if (n == null) return;
    const from = shownCount;
    shownCount = n;
    if (calm() || from === n) return (num.textContent = n);
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 500);
      num.textContent = Math.round(from + (n - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    box.classList.remove("pop");
    void box.offsetWidth;
    box.classList.add("pop");
  }

  // a choice changed: remember it, count what fits, redraw the stage
  function changed(fresh) {
    Store.write(SAVED, choice);
    if (choice.from === "discover") tally(null);
    else {
      const fit = quickFit();
      const n = fit.filter(fitsMood).length;
      tally(n || fit.length);
      overlay.querySelector(".pk-tally small").textContent = !n && fit.length ? "close" : "fit";
    }
    paintStage(fresh);
  }

  function ask() {
    stopSpin();
    overlay.querySelector(".pk-short").hidden = true;
    overlay.querySelector(".pk-ask").hidden = false;
    overlay.querySelector(".picker-modal").classList.remove("pk-wide");
    paintStage(true);
  }

  async function make(again) {
    const go = overlay.querySelector(again ? ".pk-again" : ".pk-go");
    const label = go.innerHTML;
    go.disabled = true;
    go.innerHTML = '<i class="fa-solid fa-compact-disc fa-spin"></i> <span>Picking…</span>';
    let found;
    let rated = [];
    try {
      found = choice.from === "discover" ? await fromDiscover() : await fromLibrary();
      rated = found.list.map((x) => Object.assign(x, rate(x.item))).sort((a, b) => b.s - a.s);
      if (choice.from === "discover") rated = await checkRuntimes(rated);
    } catch (e) {
      found = { list: [], error: true };
    } finally {
      go.disabled = false;
      go.innerHTML = label;
    }
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

  // Discover: the movies' real runtimes, from their TMDB pages (TMDB's own "under 1h45" filter
  // goes by another number: The Thing, 1h49, got through it). Only the first few are looked
  // up, enough for a shortlist; the ones too long for the evening drop out.
  async function checkRuntimes(rated) {
    const limit = typeof TIMES[choice.time] === "number" ? TIMES[choice.time] : null;
    const films = rated.filter((x) => x.item.mediaType === "movie");
    const drop = new Set();
    let ok = 0;
    for (let n = 0; n < films.length && ok < SIZE; n += SIZE) {
      const batch = films.slice(n, n + SIZE);
      const mins = await Promise.all(batch.map((x) => TMDB.detailsById("movie", x.item.tmdbId).then((d) => (d ? minutes(d.runtime) : null), () => null)));
      batch.forEach((x, k) => {
        x.mins = mins[k];
        if (limit && (mins[k] == null || mins[k] > limit)) drop.add(x);
        else ok++;
      });
    }
    return rated.filter((x) => !drop.has(x));
  }

  function tagsHtml() {
    const tags = [
      choice.mood && [MOODS[choice.mood].icon, MOODS[choice.mood].label],
      choice.age !== "any" && ["fa-calendar", AGES[choice.age].label],
      choice.who && [WHO[choice.who].icon, WHO[choice.who].label],
      choice.what !== "any" && [{ movie: "fa-film", tv: "fa-tv", anime: "fa-dragon" }[choice.what], { movie: "Movies", tv: "Series", anime: "Anime" }[choice.what]],
      choice.time !== "any" && ["fa-clock", { short: "Under 1h45", long: "Under 2h30", episode: "An episode" }[choice.time]],
    ].filter(Boolean);
    return tags.map(([i, t]) => `<span><i class="fa-solid ${i}"></i> ${esc(t)}</span>`).join("") || `<span>Anything goes</span>`;
  }

  function show(found, total) {
    clearInterval(stageTimer);
    const box = overlay.querySelector(".pk-short");
    overlay.querySelector(".pk-ask").hidden = true;
    box.hidden = false;
    const head = `<div class="pk-short-head">
        <div><small>Your shortlist</small><div class="pk-tags">${tagsHtml()}</div></div>
        <button class="icon-btn pk-edit" type="button" aria-label="Change the mood" title="Change the mood"><i class="fa-solid fa-sliders"></i></button>
      </div>`;
    if (!shortlist.length) {
      overlay.querySelector(".picker-modal").classList.remove("pk-wide");
      box.innerHTML = `${head}<div class="pk-none"><span class="pk-none-icon" aria-hidden="true"><i class="fa-solid fa-film"></i></span><p>${
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
          ${x.why.length ? `<div class="pk-why">${x.why.map((w) => `<span>${w}</span>`).join("")}</div>` : ""}
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
      box.querySelector(".pk-feature").innerHTML = `<div class="pk-none"><span class="pk-none-icon" aria-hidden="true"><i class="fa-solid fa-flag-checkered"></i></span><p>That was the whole shortlist.</p></div>`;
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
    // it opens on Discover (new titles); your other choices are as you left them
    choice.from = "discover";
    // nothing where you picked last time: the next place that has something
    if (!can[choice.from]) choice.from = ["watch", "fav", "discover"].find((f) => can[f]);
    overlay.querySelectorAll('[data-seg="from"] button').forEach((x) => {
      x.disabled = !can[x.dataset.v];
      x.title = can[x.dataset.v] ? "" : Store.guest && x.dataset.v !== "discover" ? "Sign in for your own lists" : "Nothing here yet";
      x.classList.toggle("on", x.dataset.v === choice.from);
    });
    overlay.querySelector(".pk-mine").hidden = !myServices().length;
    overlay.querySelector(".pk-mine-input").checked = !!choice.mine && myServices().length > 0;
    shownCount = 0;
    changed(true);
    ask();
    // the rows rise in, one after another
    const form = overlay.querySelector(".pk-ask");
    form.classList.remove("enter");
    void form.offsetWidth;
    form.classList.add("enter");
    Cards.openModal(overlay);
    // (no focus ring on the first button when it opens with a tap)
    setTimeout(() => document.activeElement && document.activeElement.closest(".pk-seg") && document.activeElement.blur(), 80);
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".random-pick")) return;
    e.preventDefault();
    openPicker();
  });

  window.Picker = { open: openPicker };
})();
