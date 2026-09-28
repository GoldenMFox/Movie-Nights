/*
 * "Add a title" pop-up (Profile menu -> Add a title).
 * With a TMDB key you can search and pick the poster; without one you fill
 * the fields by hand.
 */
(function () {
  const { esc, toast } = UI;
  let overlay, form, picked;

  function build() {
    overlay = Cards.makeOverlay(
      "add-modal",
      `<h3>Add a title</h3>
       <form class="form-grid" novalidate>
         <label class="field full">Title
           <span style="display:flex;gap:8px">
             <input class="input" name="title" required autocomplete="off" />
             <button type="button" class="btn tmdb-search-btn" hidden><i class="fa-solid fa-magnifying-glass"></i> TMDB</button>
           </span>
         </label>
         <div class="tmdb-area full"></div>
         <label class="field">Year <input class="input" name="year" type="number" min="1880" max="2100" /></label>
         <label class="field">Type
           <select class="select" name="type">
             <option value="movie">Movie</option><option value="tv">TV Show</option><option value="anime">Anime</option>
           </select>
         </label>
         <label class="field">My rating (0-10, empty = not rated)
           <input class="input" name="rating" type="number" min="0" max="10" step="0.1" />
         </label>
         <label class="field">Poster (TMDB path or image URL)
           <input class="input" name="poster" placeholder="/abc123.jpg" />
         </label>
         <label class="full" style="display:flex;gap:18px;flex-wrap:wrap;font-size:14px">
           <span><input type="checkbox" name="favorite" /> Favorite</span>
           <span><input type="checkbox" name="watchlist" /> On my watchlist</span>
         </label>
         <p class="help full form-error" style="color:#ff8080" hidden></p>
         <div class="full" style="display:flex;justify-content:flex-end;gap:10px">
           <button type="button" class="btn cancel">Cancel</button>
           <button type="submit" class="btn btn-primary">Add to library</button>
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
        const hits = await TMDB.search(q, f.type.value);
        results.innerHTML = hits.length
          ? `<div class="tmdb-results">${hits
              .map(
                (h, i) => `<button type="button" data-i="${i}">
                  <img src="${h.poster ? Store.img(h.poster, "w154") : ""}" alt="" loading="lazy" />
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
      if (picked && picked.overview) item.overview = picked.overview;
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
