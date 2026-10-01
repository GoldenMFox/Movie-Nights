/*
 * "Add a title" pop-up (Profile menu -> Add a title).
 * With a TMDB key you can search and pick the poster; without one you fill
 * the fields by hand.
 */
(function () {
  const { esc, toast } = UI;
  let overlay, form, picked;

  function build() {
    // (the site's pieces: the glass search pill, glass fields and dropdowns, the red switches)
    const toggle = (name, icon, label) => `<label class="menu-switch at-switch">
        <i class="fa-solid ${icon}"></i><span>${label}</span>
        <input type="checkbox" name="${name}" />
        <span class="switch-track"><span class="switch-thumb"></span></span>
      </label>`;
    overlay = Cards.makeOverlay(
      "add-modal",
      `<div class="pk-icon"><i class="fa-solid fa-plus"></i></div>
       <h3>Add a title</h3>
       <p class="pk-sub at-sub">Search TMDB and pick it, or fill it in by hand.</p>
       <form class="at-form" novalidate>
         <div class="glass-search at-search">
           <i class="fa-solid fa-film gs-icon" aria-hidden="true"></i>
           <input name="title" required autocomplete="off" placeholder="Title" aria-label="Title" />
           <button type="button" class="gs-btn tmdb-search-btn" aria-label="Search TMDB" title="Search TMDB" hidden><i class="fa-solid fa-magnifying-glass"></i></button>
         </div>
         <div class="tmdb-area"></div>
         <div class="at-grid">
           <label class="at-field"><span>Year</span><input class="input" name="year" type="number" min="1880" max="2100" placeholder="2024" /></label>
           <label class="at-field"><span>Type</span>
             <span class="glass-select"><select name="type" aria-label="Type">
               <option value="movie">Movie</option><option value="tv">TV Show</option><option value="anime">Anime</option>
             </select></span>
           </label>
           <label class="at-field"><span>My rating</span><input class="input" name="rating" type="number" min="0" max="10" step="0.1" placeholder="0–10, empty = not rated" /></label>
           <label class="at-field"><span>Poster</span><input class="input" name="poster" placeholder="TMDB path or image URL" /></label>
         </div>
         <div class="at-switches">
           ${toggle("favorite", "fa-heart", "Favorite")}
           ${toggle("watchlist", "fa-bookmark", "On my Watchlist")}
         </div>
         <p class="at-error form-error" hidden></p>
         <div class="at-actions">
           <button type="button" class="btn cancel">Cancel</button>
           <button type="submit" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Add to library</button>
         </div>
       </form>`
    );
    form = overlay.querySelector("form");
    const f = form.elements; // named fields (form.title would be the form's own title attribute)
    const results = overlay.querySelector(".tmdb-area");
    const searchBtn = overlay.querySelector(".tmdb-search-btn");

    overlay.querySelector(".cancel").addEventListener("click", () => Cards.closeModal(overlay));

    async function runSearch() {
      const q = f.title.value.trim();
      if (!q) return;
      results.innerHTML = '<p class="help">Searching…</p>';
      try {
        // the 10 best matches, the ones with a poster first (the form stays in view)
        const found = await TMDB.search(q, f.type.value);
        const hits = found.filter((h) => h.poster).concat(found.filter((h) => !h.poster)).slice(0, 10);
        results.innerHTML = hits.length
          ? `<div class="tmdb-results">${hits
              .map(
                (h, i) => `<button type="button" data-i="${i}">
                  <img src="${Store.poster(h.poster, "w154")}" alt="" loading="lazy" />
                  <span>${esc(h.title)} (${h.year || "?"})</span></button>`
              )
              .join("")}</div>`
          : '<p class="help">Nothing found on TMDB.</p>';
        results.querySelectorAll("button").forEach((b) =>
          b.addEventListener("click", () => {
            const h = hits[+b.dataset.i];
            picked = h;
            results.querySelectorAll("button").forEach((x) => x.classList.toggle("picked", x === b));
            f.title.value = h.title;
            f.year.value = h.year || "";
            f.poster.value = h.poster;
            if (h.mediaType === "movie" && f.type.value !== "anime") f.type.value = "movie";
            if (h.mediaType === "tv" && f.type.value === "movie") f.type.value = "tv";
          })
        );
      } catch (e) {
        results.innerHTML = `<p class="help">${esc(e.message)}</p>`;
      }
    }

    searchBtn.addEventListener("click", runSearch);
    f.title.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && TMDB.enabled()) {
        e.preventDefault();
        runSearch();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const error = overlay.querySelector(".form-error");
      const showError = (msg) => {
        error.textContent = msg;
        error.hidden = false;
      };
      const title = f.title.value.trim();
      const year = parseInt(f.year.value, 10);
      const ratingText = f.rating.value.trim();
      const rating = ratingText === "" ? null : Math.min(10, Math.max(0, Math.round(parseFloat(ratingText) * 10) / 10));
      if (!title) return showError("Please enter a title.");
      if (!year) return showError("Please enter the year.");
      if (ratingText !== "" && isNaN(rating)) return showError("Rating must be a number from 0 to 10.");

      let poster = f.poster.value.trim();
      const m = poster.match(/\/t\/p\/[^/]+(\/[^/?#]+)$/); // full TMDB URL -> path
      if (m) poster = m[1];

      const item = { title, year, type: f.type.value, rating, poster };
      if (f.favorite.checked) item.favorite = true;
      if (f.watchlist.checked) item.watchlist = true;
      if (picked && picked.backdrop) item.backdrop = picked.backdrop;
      if (picked && picked.genres && picked.genres.length) item.genres = picked.genres;
      if (picked) {
        item.tmdbId = picked.tmdbId;
        item.tmdbMedia = picked.mediaType;
      }

      const added = Store.add(item);
      Cards.closeModal(overlay);
      toast(`${title} added to your library`);
      setTimeout(() => (location.href = `title.html?id=${encodeURIComponent(added.id)}`), 600);
    });
  }

  function open() {
    if (!overlay) build();
    form.reset();
    picked = null;
    overlay.querySelector(".tmdb-area").innerHTML = "";
    overlay.querySelector(".form-error").hidden = true;
    overlay.querySelector(".tmdb-search-btn").hidden = !TMDB.enabled();
    const type = { movie: "movie", tv: "tv", anime: "anime" }[document.body.dataset.page];
    if (type) form.elements.type.value = type;
    if (document.body.dataset.page === "watchlist") form.elements.watchlist.checked = true;
    Cards.openModal(overlay);
  }

  window.AddTitle = { open };
})();
