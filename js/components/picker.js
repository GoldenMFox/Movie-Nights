/*
 * "What should I watch?": any button with the class "random-pick" opens a small pop-up.
 * You say what you're in the mood for (movie or series, how much time, a genre, only
 * your streaming services) and it picks one title from your Watchlist (or Favorites,
 * for a rewatch). "Another one" picks again.
 */
(function () {
  const { esc, toast } = UI;
  let overlay;
  let lastId = null;
  const choice = { from: "watch", what: "any", time: "any", genre: "", mine: false };

  const TYPES = { any: () => true, movie: (i) => i.type === "movie", tv: (i) => i.type === "tv", anime: (i) => i.type === "anime" };
  const TIMES = { any: null, short: 105, long: 150, episode: "episode" };

  // minutes from "2h 49min" (movies) or "3 seasons · 45min" (one episode of a show)
  function minutes(runtime) {
    const text = String(runtime || "").split("·").pop();
    const h = /(\d+)\s*h/.exec(text);
    const m = /(\d+)\s*min/.exec(text);
    return h || m ? (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) : null;
  }

  const isSeries = (i) => i.type === "tv" || (i.type === "anime" && !(i.tmdbMedia === "movie"));
  const pool = () => Store.all().filter((i) => (choice.from === "fav" ? i.favorite : i.watchlist));

  function seg(name, options) {
    return `<div class="pk-seg" role="group" data-seg="${name}">${options
      .map(([v, label]) => `<button type="button" data-v="${v}" class="${choice[name] === v ? "on" : ""}">${label}</button>`)
      .join("")}</div>`;
  }

  function build() {
    overlay = Cards.makeOverlay(
      "picker-modal",
      `<div class="pk-icon"><i class="fa-solid fa-shuffle"></i></div>
       <h3>What should I watch?</h3>
       <p class="pk-sub">Tell me the mood, I'll pick one.</p>
       <div class="pk-form">
         <div class="pk-row"><span>From</span>${seg("from", [["watch", "Watchlist"], ["fav", "Favorites (rewatch)"]])}</div>
         <div class="pk-row"><span>What</span>${seg("what", [["any", "Anything"], ["movie", "Movie"], ["tv", "Series"], ["anime", "Anime"]])}</div>
         <div class="pk-row"><span>Time</span>${seg("time", [["any", "Any"], ["short", "Under 1h45"], ["long", "Under 2h30"], ["episode", "An episode"]])}</div>
         <div class="pk-row"><span>Genre</span><span class="glass-select"><i class="fa-solid fa-masks-theater" aria-hidden="true"></i><select class="pk-genre" aria-label="Genre"></select></span></div>
         <label class="menu-switch pk-mine" hidden>
           <i class="fa-solid fa-tv"></i><span>Only on my streaming services</span>
           <input type="checkbox" class="pk-mine-input" />
           <span class="switch-track"><span class="switch-thumb"></span></span>
         </label>
       </div>
       <div class="pk-result" hidden></div>
       <div class="pk-actions">
         <button class="btn btn-primary pk-go" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> Pick for me</button>
       </div>`
    );

    overlay.addEventListener("click", (e) => {
      const b = e.target.closest(".pk-seg button");
      if (b) {
        choice[b.parentElement.dataset.seg] = b.dataset.v;
        b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        if (b.parentElement.dataset.seg === "from") fillGenres();
      }
      if (e.target.closest(".pk-go, .pk-again")) pick();
    });
    overlay.querySelector(".pk-genre").addEventListener("change", (e) => (choice.genre = e.target.value));
    overlay.querySelector(".pk-mine-input").addEventListener("change", (e) => (choice.mine = e.target.checked));
  }

  function fillGenres() {
    const names = [...new Set(pool().flatMap((i) => i.genres || []))].sort();
    if (choice.genre && !names.includes(choice.genre)) choice.genre = "";
    overlay.querySelector(".pk-genre").innerHTML =
      `<option value="">Any genre</option>` + names.map((g) => `<option${g === choice.genre ? " selected" : ""}>${esc(g)}</option>`).join("");
  }

  // runtime of a title: from the library, or looked up on TMDB (kept a week)
  async function runtimeOf(item) {
    if (item.runtime) return minutes(item.runtime);
    try {
      const ref = await Watch.refOf(item);
      if (!ref) return null;
      const [media, id] = ref.split("-");
      const d = await TMDB.detailsById(media, Number(id));
      return d ? minutes(d.runtime) : null;
    } catch (e) {
      return null;
    }
  }

  async function pick() {
    const go = overlay.querySelector(".pk-go");
    const result = overlay.querySelector(".pk-result");
    let list = pool().filter(TYPES[choice.what]).filter((i) => !choice.genre || (i.genres || []).includes(choice.genre));
    if (!list.length) return show(null);

    go.disabled = true;
    go.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Picking…';
    try {
      const limit = TIMES[choice.time];
      if (limit === "episode") list = list.filter(isSeries);
      else if (limit) {
        const mins = await Promise.all(list.map((i) => (isSeries(i) ? Promise.resolve(null) : runtimeOf(i))));
        // series fit any evening (one episode); movies need a known, short enough runtime
        list = list.filter((i, n) => isSeries(i) || (mins[n] != null && mins[n] <= limit));
      }
      if (choice.mine && window.Watch && Watch.mine().length) {
        await Watch.loadProviders(list);
        list = list.filter((i) => (Watch.onMine(i) || []).length);
      }
    } finally {
      go.disabled = false;
      go.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Pick for me';
    }
    if (!list.length) return show(null);
    const others = list.length > 1 ? list.filter((i) => i.id !== lastId) : list;
    const item = others[Math.floor(Math.random() * others.length)];
    lastId = item.id;
    show(item, list.length);
    result.hidden = false;
  }

  function show(item, count) {
    const result = overlay.querySelector(".pk-result");
    result.hidden = false;
    overlay.querySelector(".pk-form").hidden = !!item;
    overlay.querySelector(".pk-go").hidden = !!item;
    if (!item) {
      result.removeAttribute("data-id");
      result.innerHTML = `<p class="pk-none"><i class="fa-regular fa-face-meh"></i> Nothing ${
        choice.from === "fav" ? "in your Favorites" : "on your Watchlist"
      } matches that. Try fewer filters.</p>`;
      return;
    }
    const services = (window.Watch && Watch.onMine(item)) || [];
    const url = `title.html?id=${encodeURIComponent(item.id)}`;
    result.dataset.id = item.id;
    result.innerHTML = `
      <a class="pk-poster" href="${url}"><img src="${Store.poster(Cards.posterOf(item), "w342")}" alt="" /></a>
      <div class="pk-info">
        <small>${count > 1 ? `1 of ${count} that fit` : "The only one that fits"}</small>
        <h4><a href="${url}">${esc(Lang.title(item))}</a></h4>
        <p>${[item.year, Store.TYPE_LABEL[item.type], (item.genres || []).slice(0, 2).join(", ")].filter(Boolean).map(esc).join(" · ")}</p>
        ${services.length ? `<p class="pk-on"><i class="fa-solid fa-tv"></i> On ${services.map((s) => esc(s.name)).join(", ")}</p>` : ""}
        <div class="pk-buttons">
          <a class="btn btn-primary" href="${url}"><i class="fa-solid fa-play"></i> Let's watch</a>
          <button class="btn pk-again" type="button"><i class="fa-solid fa-shuffle"></i> Another one</button>
          <button class="btn pk-back" type="button" aria-label="Change the mood" title="Change the mood"><i class="fa-solid fa-sliders"></i></button>
        </div>
      </div>`;
    result.querySelector(".pk-back").addEventListener("click", () => {
      result.hidden = true;
      overlay.querySelector(".pk-form").hidden = false;
      overlay.querySelector(".pk-go").hidden = false;
    });
  }

  function openPicker() {
    if (Store.guest) return UI.needSignIn();
    if (!Store.all().some((i) => i.watchlist || i.favorite)) {
      toast("Add something to your Watchlist first");
      return;
    }
    if (!overlay) build();
    // nothing on the list you used last time: use the other one
    if (!pool().length) choice.from = choice.from === "watch" ? "fav" : "watch";
    overlay.querySelectorAll('[data-seg="from"] button').forEach((x) => x.classList.toggle("on", x.dataset.v === choice.from));
    fillGenres();
    overlay.querySelector(".pk-mine").hidden = !(window.Watch && Watch.mine().length);
    overlay.querySelector(".pk-result").hidden = true;
    overlay.querySelector(".pk-form").hidden = false;
    overlay.querySelector(".pk-go").hidden = false;
    Cards.openModal(overlay);
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".random-pick")) return;
    e.preventDefault();
    openPicker();
  });

  window.Picker = { open: openPicker };
})();
