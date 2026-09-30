/*
 * Profile page, in the site's own style: a header like a title page (a blurred backdrop
 * from your favourite, your photo, name and pill buttons), glass stat cards with small red
 * labels (like X-Ray), the Wrapped banner, the watch diary with real poster rows, your
 * Top 10 (like Home's) and a few charts in the red accent.
 * Settings (theme, streaming services, import, backup, owner tools) are on their own
 * page: js/pages/settings.js
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("profile-app");
  const photo = Store.myPhoto() || "images/placeholders/user.svg"; // (the character you picked, or your Google photo)
  const label = (icon, text) => `<span class="xr-label"><i class="fa-solid ${icon}"></i> ${text}</span>`;

  root.innerHTML = `
    <div class="pv">
      <header class="pv-hero">
        <div class="pv-backdrop" aria-hidden="true"></div>
        <div class="pv-hero-inner">
          ${
            Store.guest
              ? `<div class="pv-avatar"><img src="${esc(photo)}" data-my-pic alt="" referrerpolicy="no-referrer" /></div>`
              : `<button class="pv-avatar pv-avatar-btn av-choose" type="button" title="Change your picture" aria-label="Change your picture">
                  <img src="${esc(photo)}" data-my-pic alt="" referrerpolicy="no-referrer" />
                  <span class="pv-cam" aria-hidden="true"><i class="fa-solid fa-camera"></i></span>
                </button>`
          }
          <div class="pv-who">
            <span class="hero-kicker"><i class="fa-solid fa-user"></i> Your profile</span>
            <h1 class="p-name"></h1>
            <p class="pv-as" hidden></p>
            <p class="p-joined"></p>
            <form class="name-form" hidden>
              <input class="input" name="displayName" aria-label="Display name" maxlength="40" />
              <button class="btn btn-primary" type="submit">Save</button>
              <button class="btn pv-cancel" type="button">Cancel</button>
            </form>
            <div class="pv-actions">
              <button class="btn pv-edit" type="button"${Store.guest ? " hidden" : ""}><i class="fa-solid fa-pen"></i> Edit name</button>
              <button class="btn av-choose" type="button"${Store.guest ? " hidden" : ""}><i class="fa-solid fa-masks-theater"></i> Change picture</button>
              <a class="btn" href="settings.html"><i class="fa-solid fa-gear"></i> Settings</a>
              <button class="btn btn-primary p-signin" type="button" hidden><i class="fa-brands fa-google"></i> Sign in</button>
            </div>
          </div>
        </div>
      </header>

      <div class="p-guest"${Store.guest ? "" : " hidden"}>${Store.guest ? UI.signInPrompt() : ""}</div>

      <div class="pv-body"${Store.guest ? " hidden" : ""}>
        <div class="xr-grid pv-stats"></div>
        <div class="pv-wrapped-slot"></div>

        <section class="pv-section diary" id="diary">
          <div class="row-head"><h2><i class="fa-solid fa-book-open"></i> Watch diary</h2></div>
          <div class="diary-body"></div>
        </section>

        <section class="row-section top10 pv-top"></section>

        <section class="pv-section">
          <div class="row-head"><h2><i class="fa-solid fa-chart-simple"></i> Your taste</h2></div>
          <div class="xr-grid pv-charts">
            <div class="xr-card xr-money pv-histo-card">${label("fa-star", "My ratings")}<div class="pv-histo rating-chart"></div></div>
            <div class="xr-card">${label("fa-hourglass-half", "By decade")}<div class="pv-bars decade-chart"></div></div>
            <div class="xr-card">${label("fa-layer-group", "Average by type")}<div class="pv-bars type-chart"></div></div>
          </div>
        </section>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);

  /* ---------------- you ---------------- */

  function renderProfile() {
    const p = Store.getProfile();
    const all = Store.all();
    $(".p-name").textContent = p.name;
    // signed out: no name to edit, just a way to sign in
    $(".p-joined").innerHTML = p.guest
      ? "Not signed in"
      : [p.joined ? `Member since ${esc(p.joined)}` : "", `${all.length} title${all.length === 1 ? "" : "s"}`, `${all.filter((i) => i.rating != null).length} rated`]
          .filter(Boolean)
          .join('<span class="dot">·</span>');
    $(".p-signin").hidden = !(p.guest && window.Cloud && Cloud.enabled);
    $(".name-form").elements.displayName.value = p.name;
    document.querySelectorAll(".profile-menu .user-info h2").forEach((h) => (h.textContent = p.name));

    // the backdrop: your favourite (or best-rated) title, like a title page's header
    const fav = all
      .filter((i) => i.backdrop || Cards.posterOf(i))
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.rating ?? -1) - (a.rating ?? -1))[0];
    $(".pv-backdrop").innerHTML = fav
      ? fav.backdrop
        ? `<img src="${Store.img(fav.backdrop, "w1280")}" alt="" />`
        : `<img class="pv-backdrop-blur" src="${Store.poster(Cards.posterOf(fav), "w500")}" alt="" />`
      : "";
  }

  $(".p-signin").addEventListener("click", () => Cloud.signIn());
  // signed out: get Google sign-in ready so the button opens its window instantly (Safari needs that)
  if (Store.getProfile().guest && window.Cloud && Cloud.enabled) Cloud.prepare();

  const editing = (on) => {
    $(".name-form").hidden = !on;
    $(".p-name").hidden = on;
    $(".pv-actions").hidden = on;
    if (on) $(".name-form").elements.displayName.focus();
  };
  $(".pv-edit").addEventListener("click", () => editing(true));
  $(".pv-cancel").addEventListener("click", () => editing(false));
  $(".name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = e.target.elements.displayName.value.trim();
    if (!name) return;
    Store.setProfile({ name });
    renderProfile();
    editing(false);
    toast("Name saved");
  });

  /* ---------------- your picture: a character from a movie or show ---------------- */

  // Like picking a Netflix avatar: characters grouped by title (the actor's TMDB photo, named
  // after the character), or search any movie / show and pick from its cast. Saved with your
  // profile (so it follows your account): { path, character, title, actor }.
  const AVATAR_TITLES = [
    ["tv", 1396], ["movie", 155], ["tv", 66732], ["movie", 671], ["tv", 1399], ["movie", 299534],
    ["tv", 1668], ["movie", 603], ["tv", 2316], ["movie", 11], ["tv", 100088], ["movie", 22],
    ["tv", 60574], ["movie", 680], ["tv", 119051], ["movie", 238], ["tv", 76479], ["movie", 245891],
    ["tv", 93405], ["movie", 346698], ["tv", 19885], ["movie", 693134],
  ];
  // "Walter White / Heisenberg" -> "Walter White"; "Hermione Granger (voice)" -> "Hermione Granger"
  const charName = (c) => String(c.character || "").split(/\s+\/\s+/)[0].replace(/\s*\((voice|uncredited)\)/gi, "").trim() || c.name;
  const googlePhoto = () => !!(window.Cloud && Cloud.account() && Cloud.account().photo);

  // "as Cooper · Interstellar" under your name
  function paintAs() {
    const av = Store.getProfile().avatar;
    const as = $(".pv-as");
    as.hidden = !av;
    if (av) as.innerHTML = `<i class="fa-solid fa-masks-theater"></i> as <b>${esc(av.character)}</b> · ${esc(av.title)}`;
  }

  function setAvatar(av) {
    Store.setProfile({ avatar: av || undefined });
    UI.paintMyPic();
    // (then the version framed for a circle, a moment later)
    UI.frameMyPic().then((made) => made && UI.paintMyPic());
    paintAs();
    if (avOverlay) {
      avOverlay.querySelectorAll(".av-pick").forEach((b) => b.classList.toggle("on", !!av && b.dataset.avPath === av.path));
      avOverlay.querySelector(".av-google").hidden = !av;
    }
  }

  // one title's characters (up to max)
  function avGroup(d, max) {
    const cur = (Store.getProfile().avatar || {}).path;
    const cast = (d.cast || []).filter((c) => c.photo).slice(0, max);
    if (!cast.length) return "";
    const title = Lang.title(d);
    return `<section class="av-group">
        <h4>${esc(title)}${d.year ? ` <small>${d.year}</small>` : ""}</h4>
        <div class="av-grid">${cast
          .map(
            (c) => `<button type="button" class="av-pick${c.photo === cur ? " on" : ""}" data-av-path="${esc(c.photo)}"
                data-av-character="${esc(charName(c))}" data-av-actor="${esc(c.name)}" data-av-title="${esc(title)}" title="${esc(charName(c))} · ${esc(c.name)}">
              <span class="av-face" style="--av:url('${Store.img(c.photo, "w185")}')"><img src="${Store.img(c.photo, "w185")}" alt="" loading="lazy" /></span>
              <span>${esc(charName(c))}</span>
            </button>`
          )
          .join("")}</div>
      </section>`;
  }

  let avOverlay = null;
  let avTyping;
  function openAvatars() {
    if (!TMDB.enabled()) return toast("Choosing a character needs TMDB");
    if (!avOverlay) {
      avOverlay = Cards.makeOverlay(
        "avatar-modal",
        `<div class="pk-icon"><i class="fa-solid fa-user-astronaut"></i></div>
         <h3>Choose your profile picture</h3>
         <p class="pk-sub">A character from a movie or show you love.</p>
         <button class="btn av-google" type="button" hidden><i class="fa-brands fa-google"></i> Use my Google photo instead</button>
         <form class="glass-search av-search" role="search">
           <i class="fa-solid fa-magnifying-glass gs-icon" aria-hidden="true"></i>
           <input type="search" name="q" placeholder="Search a movie or show for its cast…" aria-label="Search a movie or show" autocomplete="off" />
         </form>
         <div class="av-found" hidden></div>
         <div class="av-picked"></div>
         <div class="av-groups"></div>`
      );
      // the popular titles, each filled in as it arrives (TMDB answers are kept a week)
      const box = avOverlay.querySelector(".av-groups");
      box.innerHTML = AVATAR_TITLES.map((_, n) => `<div class="av-slot" data-n="${n}"><div class="av-skel"></div></div>`).join("");
      AVATAR_TITLES.forEach(([media, id], n) =>
        TMDB.detailsById(media, id)
          .then((d) => (box.querySelector(`[data-n="${n}"]`).outerHTML = avGroup(d, 6) || ""))
          .catch(() => box.querySelector(`[data-n="${n}"]`).remove())
      );

      // search: titles first, then that title's whole cast on top
      const input = avOverlay.querySelector('[name="q"]');
      const found = avOverlay.querySelector(".av-found");
      const search = async () => {
        const q = input.value.trim();
        if (!q) return (found.hidden = true);
        found.hidden = false;
        found.innerHTML = '<p class="pv-empty"><i class="fa-solid fa-spinner fa-spin"></i> Searching…</p>';
        try {
          const { results } = await TMDB.searchSmart(q, "all", 1);
          if (input.value.trim() !== q) return;
          const hits = results.filter((h) => h.poster).slice(0, 8);
          found.innerHTML = hits.length
            ? hits
                .map(
                  (h) => `<button type="button" class="av-title" data-av-ref="${h.mediaType}-${h.tmdbId}">
                    <img src="${Store.poster(h.poster, "w92")}" alt="" loading="lazy" /><span>${esc(Lang.title(h))}${h.year ? ` <small>${h.year}</small>` : ""}</span></button>`
                )
                .join("")
            : '<p class="pv-empty">Nothing found. Try another spelling.</p>';
        } catch (e) {
          found.innerHTML = `<p class="pv-empty">Couldn't search: ${esc(e.message)}</p>`;
        }
      };
      avOverlay.querySelector(".av-search").addEventListener("submit", (e) => {
        e.preventDefault();
        clearTimeout(avTyping);
        search();
      });
      input.addEventListener("input", () => {
        clearTimeout(avTyping);
        avTyping = setTimeout(search, 350);
      });

      avOverlay.addEventListener("click", async (e) => {
        if (e.target.closest(".av-google")) {
          setAvatar(null);
          toast(googlePhoto() ? "Back to your Google photo" : "Picture removed");
          return setTimeout(() => Cards.closeModal(avOverlay), 300);
        }
        const t = e.target.closest("[data-av-ref]");
        if (t) {
          const [media, id] = t.dataset.avRef.split("-");
          const picked = avOverlay.querySelector(".av-picked");
          picked.innerHTML = '<div class="av-skel"></div>';
          try {
            const d = await TMDB.detailsById(media, Number(id));
            picked.innerHTML = avGroup(d, 12) || '<p class="pv-empty">TMDB has no cast photos for this one.</p>';
          } catch (err) {
            picked.innerHTML = `<p class="pv-empty">Couldn't load the cast: ${esc(err.message)}</p>`;
          }
          found.hidden = true;
          picked.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return;
        }
        const b = e.target.closest("[data-av-path]");
        if (!b) return;
        setAvatar({ path: b.dataset.avPath, character: b.dataset.avCharacter, title: b.dataset.avTitle, actor: b.dataset.avActor });
        toast(`You're ${b.dataset.avCharacter} now`);
        setTimeout(() => Cards.closeModal(avOverlay), 350);
      });
    }
    avOverlay.querySelector(".av-google").hidden = !Store.getProfile().avatar;
    Cards.openModal(avOverlay);
  }

  if (!Store.guest) {
    paintAs();
    root.querySelectorAll(".av-choose").forEach((b) => b.addEventListener("click", openAvatars));
  }

  /* ---------------- helpers ---------------- */

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------------- stat cards (X-Ray style) ---------------- */

  // a number that counts up when it comes into view (see reveal() below)
  const num = (v, dec = 0) => `<span data-count="${v}" data-dec="${dec}">${Number(v).toFixed(dec)}</span>`;
  // a small fan of posters in a card's corner (spreads out on hover)
  const fan = (list) =>
    list.length
      ? `<span class="pv-fan" aria-hidden="true">${list
          .slice(0, 3)
          .map((i, n) => `<img src="${Store.poster(Cards.posterOf(i), "w154")}" alt="" loading="lazy" style="--n:${n}" />`)
          .join("")}</span>`
      : "";

  function renderStatCards(all, rated, avg) {
    const pct = all.length ? Math.round((rated.length / all.length) * 100) : 0;
    const byRating = (a, b) => b.rating - a.rating || b.order - a.order;
    const newest = all.slice().sort((a, b) => b.order - a.order);
    const tens = rated.filter((i) => i.rating === 10);
    const card = (icon, name, big, sub, href, extra = "") =>
      `<${href ? `a href="${href}"` : "div"} class="xr-card pv-stat pv-anim">
        ${label(icon, name)}
        <div class="pv-big">${big}</div>
        ${sub ? `<small>${sub}</small>` : ""}${extra}
      </${href ? "a" : "div"}>`;
    // five stars, filled to your average
    const stars = `<span class="pv-stars" style="--s:${(avg / 10) * 100}%" aria-hidden="true"><span>★★★★★</span><span class="pv-stars-on">★★★★★</span></span>`;
    $(".pv-stats").innerHTML = [
      card("fa-film", "Titles", num(all.length), "in your library", "movies.html", fan(newest)),
      card("fa-star", "Rated", num(rated.length), `${pct}% of your library`, "", `<div class="col-bar pv-progress"><span style="--w:${pct}%"></span></div>${fan(rated.slice().sort(byRating))}`),
      card("fa-chart-line", "Average", rated.length ? num(avg.toFixed(1), 1) : "–", "out of 10", "", rated.length ? stars : ""),
      card("fa-crown", "Perfect 10s", num(tens.length), "the very best", "movies.html?sort=rating-desc", fan(tens.slice().sort(() => Math.random() - 0.5))),
      card("fa-heart", "Favorites", num(all.filter((i) => i.favorite).length), "hearted", "watchlist.html?list=fav", fan(newest.filter((i) => i.favorite))),
      card("fa-bookmark", "Watchlist", num(all.filter((i) => i.watchlist).length), "waiting to be watched", "watchlist.html", fan(newest.filter((i) => i.watchlist))),
    ].join("");
  }

  /* ---------------- Wrapped banner ---------------- */

  function renderWrapped() {
    const slot = $(".pv-wrapped-slot");
    if (!window.Wrapped) return (slot.innerHTML = "");
    const year = Wrapped.yearToShow();
    const seen = Store.all().filter((i) => String(i.watchedAt || "").startsWith(String(year)));
    const pics = seen.filter((i) => Cards.posterOf(i)).slice(-6).reverse();
    slot.innerHTML = `<button class="pv-wrapped wr-open" type="button">
        <span class="pv-wrapped-art" aria-hidden="true">${pics.map((i) => `<img src="${Store.poster(Cards.posterOf(i), "w185")}" alt="" loading="lazy" />`).join("")}</span>
        <span class="pv-wrapped-text">
          ${label("fa-wand-magic-sparkles", "Movie Nights Wrapped")}
          <strong>Your ${year} in movies</strong>
          <span>${seen.length >= 3 ? `${seen.length} titles so far. Tap to relive them.` : "Rate or mark a few titles as watched to unlock it."}</span>
        </span>
        <span class="hero-play pv-wrapped-play"><i class="fa-solid fa-play"></i> Play</span>
      </button>`;
  }

  /* ---------------- watch diary ---------------- */

  function renderDiary() {
    const dated = Store.all()
      .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.watchedAt || ""))
      .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
    const box = $(".diary-body");
    if (!dated.length) {
      box.innerHTML = `<div class="xr-card"><p class="pv-empty">Every title you rate or mark <b>Watched</b> gets the day you watched it, and shows up here
        (an import from IMDb or Letterboxd brings its dates too).</p></div>`;
      return;
    }
    const now = new Date();
    const year = String(now.getFullYear());
    const thisYear = dated.filter((i) => i.watchedAt.startsWith(year)).length;

    // the last 12 months, oldest first
    const months = [];
    for (let n = 11; n >= 0; n--) {
      const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: MONTHS[d.getMonth()], long: d.toLocaleString("en", { month: "long", year: "numeric" }), items: dated.filter((i) => i.watchedAt.startsWith(key)) });
    }
    months.forEach((m) => (m.value = m.items.length));
    const max = Math.max(1, ...months.map((m) => m.value));
    const month = months[11].value;
    const last = months[10];

    // this month vs last month: ▲ 3 / ▼ 2 / same
    const diff = month - last.value;
    const trend =
      diff > 0
        ? `<span class="pv-trend up"><i class="fa-solid fa-arrow-trend-up"></i> ${diff} more than ${last.label}</span>`
        : diff < 0
          ? `<span class="pv-trend down"><i class="fa-solid fa-arrow-trend-down"></i> ${-diff} fewer than ${last.label}</span>`
          : `<span class="pv-trend">same as ${last.label}</span>`;
    const monthsIn = now.getMonth() + 1;
    const first = dated[dated.length - 1].watchedAt;
    const firstNice = (() => {
      const x = new Date(`${first}T00:00:00`);
      return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
    })();
    // the month shown under the chart: the one you clicked, else the latest with something in it
    if (!months.some((m) => m.key === diaryMonth && m.value)) diaryMonth = (months.slice().reverse().find((m) => m.value) || months[11]).key;
    const picked = months.find((m) => m.key === diaryMonth);

    // "a year ago": watched within a week of this day, last year
    const ago = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const from = new Date(ago - 7 * 86400000).toISOString().slice(0, 10);
    const to = new Date(+ago + 7 * 86400000).toISOString().slice(0, 10);
    const memory = dated.filter((i) => i.watchedAt >= from && i.watchedAt <= to);

    const row = (title, icon, list) => `<section class="row-section pv-row">
        <div class="row-head"><h2><i class="fa-solid ${icon}"></i> ${title}</h2></div>
        <div class="movie-row">${list.slice(0, 20).map(Cards.card).join("")}</div>
      </section>`;

    box.innerHTML = `
      <div class="xr-grid pv-diary">
        <div class="xr-card pv-stat pv-anim">${label("fa-calendar", `In ${year}`)}<div class="pv-big">${num(thisYear)}</div>
          <small>watched · about <b>${(thisYear / monthsIn).toFixed(thisYear / monthsIn < 10 ? 1 : 0)}</b> a month</small></div>
        <div class="xr-card pv-stat pv-anim">${label("fa-calendar-day", "This month")}<div class="pv-big">${num(month)}</div>${trend}</div>
        <div class="xr-card pv-stat pv-anim">${label("fa-book-open", "All time")}<div class="pv-big">${num(dated.length)}</div><small>in your diary since <b>${firstNice}</b></small></div>
        <div class="xr-card xr-money pv-months-card pv-anim"${months.some((m) => m.value) ? "" : " hidden"}>
          <div class="pv-card-head">${label("fa-chart-column", "Last 12 months")}<small>Tap a month to see what you watched</small></div>
          <div class="pv-months" role="group" aria-label="Titles watched per month, last 12 months">
            ${months
              .map(
                (m, n) => `<button type="button" class="pv-month${m.key === diaryMonth ? " picked" : ""}${n === 11 ? " now" : ""}" data-month="${m.key}" title="${m.value} in ${m.long}"${m.value ? "" : " disabled"}>
                  <span class="pv-month-num">${m.value || ""}</span>
                  <span class="pv-month-bar"><i style="--h:${m.value ? Math.max(6, (m.value / max) * 100) : 0}%;--d:${n * 45}ms"></i></span>
                  <small>${m.label}</small></button>`
              )
              .join("")}
          </div>
          <div class="pv-month-strip">
            <div class="pv-strip-head"><strong>${picked.long}</strong><small>${picked.value} title${picked.value === 1 ? "" : "s"}</small></div>
            <div class="pv-strip">${picked.items
              .map(
                (i, n) => `<a class="pv-strip-item" href="title.html?id=${encodeURIComponent(i.id)}" title="${esc(Lang.title(i))}" style="--d:${n * 50}ms">
                  <img src="${Store.poster(Cards.posterOf(i), "w154")}" alt="" loading="lazy" />
                  ${i.rating != null ? `<b>★ ${Cards.formatRating(i.rating)}</b>` : ""}
                  <span>${esc(Lang.title(i))}</span></a>`
              )
              .join("")}</div>
          </div>
        </div>
      </div>
      ${memory.length ? row("A year ago you watched", "fa-clock-rotate-left", memory) : ""}
      ${row("Recently watched", "fa-play", dated)}`;
  }

  // the diary's chart: a tap on a month shows its posters under it
  let diaryMonth = null;
  root.addEventListener("click", (e) => {
    const m = e.target.closest("[data-month]");
    if (!m || m.disabled) return;
    diaryMonth = m.dataset.month;
    renderDiary();
    reveal(true); // (already on screen: straight to the end state, no replay)
  });

  // the Wrapped banner opens the story
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".wr-open");
    if (b && !b.disabled && window.Wrapped) {
      b.disabled = true;
      Wrapped.open(b).finally(() => (b.disabled = false));
    }
  });

  /* ---------------- your Top 10 (like Home's) ---------------- */

  function renderTop(rated) {
    const top = rated
      .slice()
      .sort((a, b) => b.rating - a.rating || a.order - b.order)
      .slice(0, 10);
    $(".pv-top").hidden = top.length < 3;
    $(".pv-top").innerHTML = `
      <div class="row-head top10-head"><h2><span class="top10-word">TOP 10</span><span class="top10-sub">yours</span></h2></div>
      <div class="movie-row top10-row">${top
        .map(
          (i, n) => `<a class="top10-item" href="title.html?id=${encodeURIComponent(i.id)}" title="#${n + 1} · ${esc(Lang.title(i))} · ★ ${Cards.formatRating(i.rating)}">
            <span class="top10-num" aria-hidden="true">${n + 1}</span>
            <img src="${Store.poster(Cards.posterOf(i), "w342")}" alt="${esc(Lang.title(i))}" loading="lazy" decoding="async" />
          </a>`
        )
        .join("")}</div>`;
  }

  /* ---------------- charts ---------------- */

  function renderStats() {
    const all = Store.all();
    const rated = all.filter((i) => i.rating != null);
    const avg = (list) => (list.length ? list.reduce((s, i) => s + i.rating, 0) / list.length : 0);

    renderProfile();
    renderStatCards(all, rated, avg(rated));
    renderWrapped();
    renderDiary();
    renderTop(rated);

    // how you rate: a column for each score, 0 → 10 (they rise one after another)
    const buckets = [];
    for (let n = 0; n <= 10; n++) buckets.push({ label: String(n), value: rated.filter((i) => (n === 10 ? i.rating === 10 : i.rating >= n && i.rating < n + 1)).length });
    const hMax = Math.max(1, ...buckets.map((b) => b.value));
    const peak = buckets.reduce((a, b) => (b.value > a.value ? b : a), buckets[0]);
    $(".rating-chart").closest(".xr-card").classList.add("pv-anim");
    $(".rating-chart").innerHTML = `
      <div class="pv-months pv-histo-cols">${buckets
        .map(
          (b, n) => `<div class="pv-month${b === peak && b.value ? " peak" : ""}" title="${b.value} rated ${b.label}">
            <span class="pv-month-num">${b.value || ""}</span>
            <span class="pv-month-bar"><i style="--h:${b.value ? Math.max(6, (b.value / hMax) * 100) : 0}%;--d:${n * 55}ms"></i></span>
            <small>${b.label}</small></div>`
        )
        .join("")}</div>
      ${
        rated.length
          ? `<div class="pv-caption"><span class="pv-chip"><i class="fa-solid fa-star"></i> Your favourite score: <b>${peak.label}</b></span>
             <span class="pv-chip">Average <b>${avg(rated).toFixed(1)}</b></span>
             <span class="pv-chip">${Math.round((rated.filter((i) => i.rating >= 8).length / rated.length) * 100)}% rated <b>8+</b></span></div>`
          : ""
      }`;

    // decades: a bar each, and the best-rated title of that decade
    const decades = {};
    all.forEach((i) => {
      if (!i.year) return;
      const d = Math.floor(i.year / 10) * 10;
      (decades[d] = decades[d] || []).push(i);
    });
    const dMax = Math.max(1, ...Object.values(decades).map((l) => l.length));
    $(".decade-chart").closest(".xr-card").classList.add("pv-anim");
    $(".decade-chart").innerHTML =
      Object.keys(decades)
        .sort()
        .map((d, n) => {
          const list = decades[d];
          const best = list.filter((i) => i.rating != null).sort((a, b) => b.rating - a.rating)[0];
          return `<div class="pv-decade">
            <div class="pv-bar"><span>${d}s</span><div><i style="--w:${Math.max(2, (list.length / dMax) * 100)}%;--d:${n * 70}ms"></i></div><b>${num(list.length)}</b></div>
            ${best ? `<a class="pv-best" href="title.html?id=${encodeURIComponent(best.id)}"><i class="fa-solid fa-trophy"></i> ${esc(Lang.title(best))} <span>★ ${Cards.formatRating(best.rating)}</span></a>` : ""}
          </div>`;
        })
        .join("") || '<p class="pv-empty">Nothing yet.</p>';

    // average by type: three rings that fill up
    $(".type-chart").closest(".xr-card").classList.add("pv-anim");
    $(".type-chart").innerHTML = `<div class="pv-rings">${["movie", "tv", "anime"]
      .map((t, n) => {
        const list = rated.filter((i) => i.type === t);
        const v = avg(list);
        return `<div class="pv-ring-item">
          <div class="pv-ring" style="--p:${v * 10};--d:${n * 150}ms"><b>${v ? num(v.toFixed(1), 1) : "–"}</b></div>
          <strong>${Store.TYPE_LABEL[t]}</strong><small>${list.length} rated</small>
        </div>`;
      })
      .join("")}</div>`;
  }

  /* ---------------- animations: things play when they come into view ---------------- */

  function countUp(el) {
    const to = Number(el.dataset.count);
    const dec = Number(el.dataset.dec) || 0;
    if (!to) return;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1200);
      el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let io = null;
  // instant: show the end state straight away (a redraw of something already seen)
  function reveal(instant) {
    const items = [...root.querySelectorAll(".pv-anim:not(.in)")];
    if (instant || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.classList.add("in", "no-anim"));
      return;
    }
    if (!io)
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            io.unobserve(en.target);
            en.target.classList.add("in");
            en.target.querySelectorAll("[data-count]").forEach(countUp);
          }),
        { threshold: 0.2 }
      );
    items.forEach((el) => io.observe(el));
  }

  let drawn = false;
  Store.onChange(() => {
    renderStats();
    reveal(drawn); // later redraws (you rated something): no replay
  });
  renderStats();
  reveal(false);
  drawn = true;

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
