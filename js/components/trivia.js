/*
 * Movie trivia: 10 questions about a title you've watched (its title page, and right after
 * you mark it Watched). Four answers each, 20 seconds a question, then your score and a
 * rank: 📼 Casual Viewer, 🎬 Film Fan, 🍿 Movie Buff (7+), 🎓 Cinephile (9), 🏆 Film Genius (10).
 * Your best score per title is saved with your profile (trivia: { libraryId: best }); 7 or
 * more counts for the Movie Buff achievement (js/components/achievements.js).
 *
 * The questions come from TMDB: who directed it and who played whom, the year, the running
 * time, the box office, the franchise, where it was made, the studio, the composer, the
 * tagline, the director's and the star's other films. Wrong answers are the film's own cast
 * and characters, nearby years and amounts, and well-known names that aren't in it.
 *
 *   Trivia.open(item)      item: a library title
 *   Trivia.best(item)      your best score (or null)
 */
(function () {
  const { esc, toast } = UI;
  const COUNT = 10;
  const SECONDS = 20;
  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const RANKS = [
    [10, "🏆", "Film Genius", "Perfect! Nothing gets past you."],
    [9, "🎓", "Cinephile", "Nearly flawless. Impressive."],
    [7, "🍿", "Movie Buff", "You really were paying attention."],
    [4, "🎬", "Film Fan", "Not bad at all. A rewatch would help."],
    [0, "📼", "Casual Viewer", "Time for a rewatch?"],
  ];
  const rankOf = (n) => RANKS.find((r) => n >= r[0]);

  // well-known names for wrong answers (only ones not in this title are used)
  const DIRECTORS = ["Steven Spielberg", "Christopher Nolan", "Martin Scorsese", "Quentin Tarantino", "Ridley Scott", "James Cameron", "Denis Villeneuve", "David Fincher", "Peter Jackson", "Guillermo del Toro", "Wes Anderson", "Greta Gerwig", "Stanley Kubrick", "Alfred Hitchcock", "Francis Ford Coppola", "Tim Burton", "Sam Raimi", "Zack Snyder", "Michael Bay", "Robert Zemeckis", "Ron Howard", "Clint Eastwood", "Bong Joon-ho", "Hayao Miyazaki", "Jordan Peele", "Taika Waititi", "Guy Ritchie", "Rian Johnson", "J.J. Abrams", "Sofia Coppola", "Damien Chazelle", "Ang Lee", "Danny Boyle", "Darren Aronofsky", "Paul Thomas Anderson", "Kathryn Bigelow", "George Lucas", "Joel Coen", "Spike Lee", "Luc Besson"];
  const ACTORS = ["Tom Hanks", "Meryl Streep", "Leonardo DiCaprio", "Scarlett Johansson", "Brad Pitt", "Natalie Portman", "Denzel Washington", "Keanu Reeves", "Emma Stone", "Tom Cruise", "Cate Blanchett", "Morgan Freeman", "Anne Hathaway", "Johnny Depp", "Margot Robbie", "Matt Damon", "Jennifer Lawrence", "Samuel L. Jackson", "Nicole Kidman", "Will Smith", "Ryan Gosling", "Zendaya", "Christian Bale", "Julia Roberts", "Hugh Jackman", "Charlize Theron", "Robert De Niro", "Viola Davis", "Joaquin Phoenix", "Keira Knightley", "Harrison Ford", "Sandra Bullock", "Ryan Reynolds", "Florence Pugh", "Pedro Pascal", "Timothée Chalamet", "Anthony Hopkins", "Emma Watson", "Idris Elba", "Jake Gyllenhaal"];
  const COMPOSERS = ["Hans Zimmer", "John Williams", "Ennio Morricone", "Howard Shore", "Alexandre Desplat", "Danny Elfman", "James Horner", "Ludwig Göransson", "Michael Giacchino", "Thomas Newman", "Alan Silvestri", "Trent Reznor", "Jóhann Jóhannsson", "Ramin Djawadi", "Junkie XL", "Harry Gregson-Williams", "John Powell", "Joe Hisaishi", "Clint Mansell", "Hildur Guðnadóttir"];
  const STUDIOS = ["Warner Bros. Pictures", "Universal Pictures", "Paramount Pictures", "20th Century Studios", "Columbia Pictures", "Walt Disney Pictures", "Marvel Studios", "Lionsgate", "A24", "Legendary Pictures", "New Line Cinema", "DreamWorks Pictures", "Metro-Goldwyn-Mayer", "Pixar", "Blumhouse Productions", "Lucasfilm Ltd.", "Studio Ghibli", "Netflix", "Amblin Entertainment", "Focus Features"];
  const NETWORKS = ["HBO", "Netflix", "AMC", "FX", "BBC One", "Prime Video", "Apple TV+", "Disney+", "Hulu", "NBC", "CBS", "ABC", "Showtime", "The CW", "Fox", "Starz", "Paramount+", "Crunchyroll", "Fuji TV", "TV Tokyo"];
  const FRANCHISES = ["The Avengers Collection", "Harry Potter Collection", "Star Wars Collection", "The Lord of the Rings Collection", "Jurassic Park Collection", "Mission: Impossible Collection", "Fast & Furious Collection", "James Bond Collection", "The Dark Knight Collection", "Toy Story Collection", "Pirates of the Caribbean Collection", "The Matrix Collection", "Alien Collection", "The Hunger Games Collection", "Transformers Collection", "Indiana Jones Collection", "Shrek Collection", "Back to the Future Collection", "The Terminator Collection", "John Wick Collection"];
  const COUNTRIES = ["United States of America", "United Kingdom", "France", "Germany", "Japan", "South Korea", "Canada", "Australia", "Italy", "Spain", "India", "Mexico", "China", "New Zealand", "Sweden", "Denmark", "Brazil", "Ireland", "Hong Kong", "Russia"];
  const GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War", "Western"];

  const shuffle = (a) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // three wrong answers from a pool, none of them right (or near-right)
  const wrong = (pool, not, n = 3) => {
    const bad = new Set(not.map(norm));
    return shuffle([...new Set(pool)].filter((x) => x && !bad.has(norm(x)))).slice(0, n);
  };
  const minutes = (runtime) => {
    const text = String(runtime || "").split("·").pop();
    const h = /(\d+)\s*h/.exec(text);
    const m = /(\d+)\s*min/.exec(text);
    return h || m ? (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) : 0;
  };
  const hm = (m) => `${m >= 60 ? `${Math.floor(m / 60)}h ` : ""}${m % 60 ? `${m % 60}min` : ""}`.trim();
  const money = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 2).replace(/\.?0+$/, "")} billion` : `$${Math.round(v / 1e6)} million`);
  // a real character name ("Himself", "(voice)" and uncredited extras out)
  const character = (c) => String(c || "").replace(/\s*\((voice|uncredited)\)/gi, "").split(" / ")[0].trim();
  const realChar = (c) => c && c.length > 1 && !/^(himself|herself|themselves|self|narrator|additional voices?)$/i.test(c);

  // q: the question; right: the answer; wrong: three others; sort: keep the options in order
  const Q = (q, right, others, extra) => (right && others.length === 3 ? Object.assign({ q, right, options: shuffle([right, ...others]) }, extra || {}) : null);
  const ordered = (q) => q && Object.assign(q, { options: q.options.slice().sort((a, b) => q.order(a) - q.order(b)) });

  async function makeQuestions(item, d) {
    const title = Lang.title(item);
    const t = `<b>${esc(title)}</b>`;
    const media = d.media || (item.tmdbMedia === "movie" || item.type === "movie" ? "movie" : "tv");
    const tmdbId = d.tmdbId;
    const film = media === "movie";
    const cast = (d.cast || []).filter((c) => c.name);
    const chars = cast.map((c) => ({ name: c.name, id: c.id, char: character(c.character) })).filter((c) => realChar(c.char));
    const x = d.xray || {};
    const recs = (d.recommendations || []).filter((r) => r.title && norm(r.title) !== norm(d.title));

    // a few more things from TMDB (all at once; any that fail are just left out)
    const directorId = (d.directorPeople || [])[0] && d.directorPeople[0].id;
    const [full, dirP, starP, tags] = await Promise.all([
      TMDB.credits(media, tmdbId).catch(() => null),
      directorId ? TMDB.person(directorId).catch(() => null) : null,
      cast[0] && cast[0].id ? TMDB.person(cast[0].id).catch(() => null) : null,
      d.xray && x.tagline ? Promise.all(recs.slice(0, 5).map((r) => TMDB.tagline(r.mediaType || media, r.tmdbId).catch(() => ""))) : [],
    ]);
    const inIt = new Set(((full && full.cast) || cast.map((c) => c.name)).map(norm));
    const crewNames = (job) => ((full && full.crew) || []).filter((c) => c.job === job).map((c) => c.name);
    const makers = (d.director || "").split(",").map((s) => s.trim()).filter(Boolean);

    const out = [];
    const add = (kind, q) => q && out.push(Object.assign(q, { kind }));

    // who made it
    if (makers.length)
      add(
        "director",
        Q(film ? `Who directed ${t}?` : `Who created ${t}?`, makers[0], wrong(DIRECTORS, [...makers, ...inIt]), {
          note: makers.length > 1 ? `With ${makers.slice(1).join(", ")}` : "",
        })
      );

    // who played whom (up to two), and whom someone played
    shuffle(chars.slice(0, 6))
      .slice(0, 2)
      .forEach((c) => {
        add("played", Q(`Who played <b>${esc(c.char)}</b> in ${t}?`, c.name, wrong(chars.map((o) => o.name), [c.name])));
      });
    const lead = chars[0];
    if (lead) add("character", Q(`Who did <b>${esc(lead.name)}</b> play in ${t}?`, lead.char, wrong(chars.map((o) => o.char), [lead.char])));

    // which of these is in it
    const star = shuffle(cast.slice(0, 5))[0];
    if (star && full) add("inCast", Q(`Which of these actors is in ${t}?`, star.name, wrong(ACTORS.filter((a) => !inIt.has(norm(a))), [star.name])));

    // the year
    const y = item.year || d.year;
    if (y) {
      const ys = shuffle([-4, -3, -2, -1, 1, 2, 3].map((k) => y + k).filter((v) => v <= new Date().getFullYear())).slice(0, 3).map(String);
      add("year", ordered(Q(film ? `When did ${t} come out?` : `When did ${t} first air?`, String(y), ys, { order: Number })));
    }

    // how long
    const mins = film ? minutes(d.runtime) : 0;
    if (mins > 40) {
      const opts = shuffle([-35, -20, -12, 12, 20, 35]).slice(0, 3).map((k) => hm(mins + k));
      add("runtime", ordered(Q(`How long is ${t}?`, hm(mins), opts, { order: minutes })));
    }
    // a series: how many seasons
    const seasons = (d.seasons || []).length;
    if (!film && seasons) {
      const opts = shuffle([-2, -1, 1, 2, 3].map((k) => seasons + k).filter((v) => v > 0)).slice(0, 3).map(String);
      add("seasons", ordered(Q(`How many seasons does ${t} have?`, String(seasons), opts, { order: Number })));
    }

    // the money
    if (x.revenue > 5e6) {
      const opts = shuffle([0.35, 0.55, 1.7, 2.6]).slice(0, 3).map((k) => money(x.revenue * k));
      add("revenue", ordered(Q(`How much did ${t} make at the box office, worldwide?`, money(x.revenue), opts, { order: (s) => parseFloat(s.slice(1)) * (/billion/.test(s) ? 1000 : 1) })));
    }
    if (x.budget > 1e6) {
      const opts = shuffle([0.3, 0.5, 1.8, 2.8]).slice(0, 3).map((k) => money(x.budget * k));
      add("budget", ordered(Q(`What did ${t} cost to make?`, money(x.budget), opts, { order: (s) => parseFloat(s.slice(1)) * (/billion/.test(s) ? 1000 : 1) })));
    }

    // the franchise, the country, the studio / network, the genre
    if (d.collection && d.collection.name) add("franchise", Q(`Which franchise is ${t} part of?`, d.collection.name, wrong(FRANCHISES, [d.collection.name])));
    const where = (x.countries || []).map((c) => c.name);
    if (where.length) add("country", Q(`Where was ${t} made?`, where[0], wrong(COUNTRIES, where)));
    const studios = (x.companies || []).map((c) => c.name);
    if (film && studios.length) add("studio", Q(`Which studio made ${t}?`, studios[0], wrong(STUDIOS, studios)));
    const nets = (x.networks || []).map((n) => n.name);
    if (!film && nets.length) add("network", Q(`Where did ${t} first air?`, nets[0], wrong(NETWORKS, nets)));
    const genres = d.genres || item.genres || [];
    if (genres.length) add("genre", Q(`Which of these genres is ${t}?`, shuffle(genres)[0], wrong(GENRES, genres)));

    // the music
    const composer = crewNames("Original Music Composer")[0] || crewNames("Music")[0];
    if (composer) add("composer", Q(`Who composed the music for ${t}?`, composer, wrong(COMPOSERS, crewNames("Original Music Composer").concat(crewNames("Music")))));

    // the tagline (the others are similar films')
    const otherTags = (tags || []).filter((s) => s && norm(s) !== norm(x.tagline));
    if (x.tagline && otherTags.length >= 3) add("tagline", Q(`Which one is the tagline of ${t}?`, `“${x.tagline}”`, otherTags.slice(0, 3).map((s) => `“${s}”`)));

    // the director's other films, the star's other films (the wrong ones: similar films they're not in)
    const notTheirs = (p) => recs.filter((r) => !p.titles.some((t2) => t2.tmdbId === r.tmdbId)).map((r) => r.title);
    if (dirP) {
      const other = dirP.titles.filter((t2) => t2.jobs.includes("Director") && t2.tmdbId !== tmdbId && (t2.votes || 0) > 300).sort((a, b) => b.votes - a.votes)[0];
      if (other) add("dirOther", Q(`Which of these did <b>${esc(dirP.name)}</b> also ${film ? "direct" : "make"}?`, other.title, wrong(notTheirs(dirP), [other.title])));
    }
    if (starP) {
      const other = starP.titles.filter((t2) => t2.kind === "cast" && !t2.self && t2.tmdbId !== tmdbId && (t2.votes || 0) > 800).sort((a, b) => b.votes - a.votes)[0];
      if (other) add("starOther", Q(`<b>${esc(starP.name)}</b> is in ${t}. Which of these is also one of theirs?`, other.title, wrong(notTheirs(starP), [other.title])));
    }

    // ten, as varied as possible (the easy ones first, the hard ones later)
    const EASY = ["director", "year", "played", "genre", "character", "inCast"];
    const picked = shuffle(out).slice(0, COUNT);
    return picked.sort((a, b) => EASY.includes(b.kind) - EASY.includes(a.kind));
  }

  /* ---------------- the game ---------------- */

  let overlay = null;
  let game = null; // { item, questions, n, score, answers, timer }

  const best = (item) => {
    const b = (Store.getProfile().trivia || {})[item.id];
    return typeof b === "number" ? b : null;
  };

  function build() {
    overlay = Cards.makeOverlay("trivia-modal", `<div class="tq"></div>`);
    overlay.addEventListener("click", (e) => {
      const a = e.target.closest(".tq-opt");
      if (a && !a.disabled) return answer(Number(a.dataset.n));
      if (e.target.closest(".tq-start")) return start();
      if (e.target.closest(".tq-next")) return next();
      if (e.target.closest(".tq-again")) return open(game.item, true);
      if (e.target.closest(".tq-share")) return share();
      if (e.target.closest(".tq-done")) return Cards.closeModal(overlay);
    });
    document.addEventListener("keydown", (e) => {
      if (!overlay.classList.contains("active") || !game || game.phase !== "ask") return;
      const k = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()];
      if (k != null && !game.locked) answer(k);
      else if ((e.key === "Enter" || e.key === " ") && game.locked) {
        e.preventDefault();
        next();
      }
    });
    overlay.onclose = () => clearInterval(game && game.timer);
  }

  const box = () => overlay.querySelector(".tq");

  async function open(item, again) {
    if (!item) return;
    if (!window.TMDB || !TMDB.enabled()) return toast("Trivia needs TMDB (Settings → API keys)");
    if (!overlay) build();
    clearInterval(game && game.timer);
    game = { item, questions: null, n: 0, score: 0, answers: [], phase: "intro" };
    const b = best(item);
    box().innerHTML = `<div class="tq-intro">
        <img class="tq-poster" src="${Store.poster(Cards.posterOf(item), "w342")}" alt="" />
        <span class="xr-label"><i class="fa-solid fa-brain"></i> Movie trivia</span>
        <h3>How well do you know <span>${esc(Lang.title(item))}</span>?</h3>
        <p>${COUNT} questions, ${SECONDS} seconds each. 7 or more makes you a Movie Buff.</p>
        ${b != null ? `<p class="tq-best">Your best: <b>${b}/${COUNT}</b> ${rankOf(b)[1]} ${rankOf(b)[2]}</p>` : ""}
        <button class="btn btn-primary tq-start" type="button" disabled><i class="fa-solid fa-spinner fa-spin"></i> Getting the questions…</button>
      </div>`;
    Cards.openModal(overlay);
    try {
      const d = await TMDB.details(item);
      if (!d) throw new Error("not found");
      game.questions = await makeQuestions(item, d);
    } catch (e) {
      game.questions = [];
    }
    const btn = box().querySelector(".tq-start");
    if (!btn) return;
    if (game.questions.length < 5) {
      btn.outerHTML = `<p class="tq-sorry"><i class="fa-regular fa-face-meh"></i> TMDB doesn't know enough about this one for a quiz.</p>`;
      return;
    }
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-play"></i> ${again ? "Go again" : "Start"}`;
    if (again) start();
  }

  function start() {
    game.phase = "ask";
    game.n = 0;
    game.score = 0;
    game.answers = [];
    ask();
  }

  function ask() {
    const q = game.questions[game.n];
    game.locked = false;
    game.left = SECONDS;
    box().innerHTML = `<div class="tq-game">
        <div class="tq-top">
          <div class="tq-dots">${game.questions
            .map((_, k) => `<span class="${k < game.n ? (game.answers[k] ? "ok" : "no") : k === game.n ? "now" : ""}"></span>`)
            .join("")}</div>
          <span class="tq-score"><i class="fa-solid fa-star"></i> ${game.score}</span>
        </div>
        <div class="tq-time"><i style="--t:${SECONDS}s"></i></div>
        <small class="tq-count">Question ${game.n + 1} of ${game.questions.length}</small>
        <h3 class="tq-q">${q.q}</h3>
        <div class="tq-opts">${q.options
          .map((o, k) => `<button class="tq-opt" type="button" data-n="${k}" style="--d:${k * 60}ms"><b>${"ABCD"[k]}</b><span>${esc(o)}</span></button>`)
          .join("")}</div>
        <div class="tq-after"></div>
      </div>`;
    clearInterval(game.timer);
    game.timer = setInterval(() => {
      if (--game.left <= 0) answer(-1);
    }, 1000);
  }

  function answer(k) {
    if (game.locked) return;
    game.locked = true;
    clearInterval(game.timer);
    const q = game.questions[game.n];
    const right = q.options.indexOf(q.right);
    const ok = k === right;
    game.answers.push(ok);
    if (ok) game.score++;
    box().querySelector(".tq-time").classList.add("stop");
    box()
      .querySelectorAll(".tq-opt")
      .forEach((b, i) => {
        b.disabled = true;
        if (i === right) b.classList.add("right");
        else if (i === k) b.classList.add("wrong");
      });
    box().querySelector(".tq-score").innerHTML = `<i class="fa-solid fa-star"></i> ${game.score}`;
    const dot = box().querySelectorAll(".tq-dots span")[game.n];
    dot.className = ok ? "ok" : "no";
    const last = game.n === game.questions.length - 1;
    box().querySelector(".tq-after").innerHTML = `<p class="tq-verdict ${ok ? "ok" : "no"}">${
      ok ? '<i class="fa-solid fa-circle-check"></i> Right!' : k < 0 ? '<i class="fa-regular fa-clock"></i> Time\'s up' : '<i class="fa-solid fa-circle-xmark"></i> Not quite'
    }${q.note ? ` <small>${esc(q.note)}</small>` : ""}</p>
      <button class="btn btn-primary tq-next" type="button">${last ? '<i class="fa-solid fa-flag-checkered"></i> See your score' : 'Next <i class="fa-solid fa-arrow-right"></i>'}</button>`;
    box().querySelector(".tq-next").focus({ preventScroll: true });
  }

  function next() {
    if (!game.locked) return;
    if (game.n < game.questions.length - 1) {
      game.n++;
      return ask();
    }
    finish();
  }

  function finish() {
    game.phase = "done";
    const total = game.questions.length;
    // (fewer than 10 questions: scored out of 10 all the same, rounded)
    const score = Math.round((game.score / total) * COUNT);
    const [, icon, rank, line] = rankOf(score);
    const before = best(game.item);
    const record = !Store.guest && Store.get(game.item.id) && (before == null || score > before);
    if (record) {
      const all = Object.assign({}, Store.getProfile().trivia || {});
      all[game.item.id] = score;
      Store.setProfile({ trivia: all });
    }
    // (the title page shows your new best)
    document.dispatchEvent(new CustomEvent("mn:trivia", { detail: { id: game.item.id, score } }));
    const buff = score >= 7 && (before == null || before < 7);
    box().innerHTML = `<div class="tq-end${score >= 7 ? " great" : ""}">
        <span class="xr-label"><i class="fa-solid fa-brain"></i> ${esc(Lang.title(game.item))}</span>
        <div class="tq-ring" style="--p:${(score / COUNT) * 100}%"><span><b class="tq-num" data-to="${score}">0</b><small>/ ${COUNT}</small></span></div>
        <h3><span class="tq-rank-icon">${icon}</span> ${rank}</h3>
        <p>${line}</p>
        ${record && before != null ? `<p class="tq-best new"><i class="fa-solid fa-arrow-trend-up"></i> New best (was ${before}/${COUNT})</p>` : before != null && !record ? `<p class="tq-best">Your best: ${before}/${COUNT}</p>` : ""}
        ${buff && !Store.guest ? '<p class="tq-ach"><i class="fa-solid fa-trophy" aria-hidden="true"></i><span>Counts for your <b>Movie Buff</b> achievement</span></p>' : ""}
        <div class="tq-end-buttons">
          <button class="btn tq-again" type="button"><i class="fa-solid fa-rotate-left"></i> Play again</button>
          <button class="btn tq-share" type="button" aria-label="Share" title="Share"><i class="fa-solid fa-share-nodes"></i><span class="tq-bt"> Share</span></button>
          <button class="btn btn-primary tq-done" type="button">Done</button>
        </div>
      </div>`;
    game.final = { score, rank, icon };
    // the score counts up; confetti for 7 and up
    const num = box().querySelector(".tq-num");
    if (calm()) num.textContent = score;
    else {
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / 900);
        num.textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      if (score >= 7) confetti(box().querySelector(".tq-end"));
    }
  }

  function confetti(el) {
    const colors = ["#e0393e", "#f5c518", "#46d369", "#2a5bd7", "#ffffff"];
    const c = document.createElement("div");
    c.className = "tq-confetti";
    c.innerHTML = Array.from({ length: 36 }, () => `<i style="left:${Math.random() * 100}%;background:${colors[Math.floor(Math.random() * colors.length)]};--x:${(Math.random() - 0.5) * 120}px;--t:${1.8 + Math.random() * 1.4}s;--d:${Math.random() * 0.4}s"></i>`).join("");
    el.append(c);
  }

  async function share() {
    const f = game.final;
    const text = `I scored ${f.score}/${COUNT} on the ${Lang.title(game.item)} trivia on Movie Nights: ${f.icon} ${f.rank}!`;
    try {
      if (navigator.share) await navigator.share({ title: "Movie Nights trivia", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Copied, ready to paste");
      }
    } catch (e) {}
  }

  window.Trivia = { open, best, rankOf, COUNT };
})();
