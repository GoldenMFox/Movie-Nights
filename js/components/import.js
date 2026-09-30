/*
 * Import (Settings page): your ratings, watched films and watchlist from IMDb or
 * Letterboxd exports (.csv files).
 *
 *  - IMDb: "Your ratings" export (rated titles) and "Your watchlist" export. Titles are
 *    found on TMDB by their IMDb id, so every match is exact.
 *  - Letterboxd: ratings.csv, watched.csv, diary.csv and watchlist.csv from the unzipped
 *    export. Films are found on TMDB by name and year. Stars become the site's score
 *    (★★★★½ = 9).
 *
 * Nothing changes until you press "Add". Titles you already have keep your score
 * (an import only fills in what's missing).
 */
(function () {
  const { esc, toast } = UI;

  /* ---------------- reading the files ---------------- */

  function parseCsv(text) {
    text = text.replace(/^﻿/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else quoted = false;
        } else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some((f) => f !== "")) rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.map((r) => Object.fromEntries(head.map((h, n) => [h, (r[n] || "").trim()])));
  }

  const date = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || "") ? s.slice(0, 10) : "");
  const SKIP_IMDB = /episode|video ?game|podcast/i;

  // one file -> [{ key, imdb?, title, year, rating?, watchlist?, watchedAt? }]
  function entriesOf(rows, fileName) {
    if (!rows.length) return { kind: "empty", list: [] };
    const cols = Object.keys(rows[0]);
    if (cols.includes("Const")) {
      const rated = cols.includes("Your Rating");
      const list = rows
        .filter((r) => /^tt\d+$/.test(r.Const) && !SKIP_IMDB.test(r["Title Type"] || ""))
        .map((r) => {
          const e = { key: r.Const, imdb: r.Const, title: r.Title, year: Number(r.Year) || null };
          const score = parseFloat(r["Your Rating"]);
          if (rated && !isNaN(score)) {
            e.rating = score;
            e.watchedAt = date(r["Date Rated"]);
          } else if (!rated) e.watchlist = true;
          return e;
        });
      return { kind: rated ? "IMDb ratings" : "IMDb watchlist", list };
    }
    if (cols.includes("Name") && cols.includes("Letterboxd URI")) {
      const isWatchlist = /watchlist/i.test(fileName);
      const list = rows
        .filter((r) => r.Name)
        .map((r) => {
          const e = { key: `${r.Name.toLowerCase()}|${r.Year}`, title: r.Name, year: Number(r.Year) || null };
          const stars = parseFloat(r.Rating);
          if (isWatchlist) e.watchlist = true;
          else {
            if (!isNaN(stars)) e.rating = Math.round(stars * 2 * 10) / 10;
            e.watchedAt = date(r["Watched Date"]) || date(r.Date);
          }
          return e;
        });
      return { kind: isWatchlist ? "Letterboxd watchlist" : "Letterboxd films", list };
    }
    return { kind: "unknown", list: [] };
  }

  // the same title from several files (ratings.csv + watched.csv): one entry, the rating
  // and the earliest watch date kept; watched beats watchlist
  function merge(all) {
    const byKey = new Map();
    all.forEach((e) => {
      const old = byKey.get(e.key);
      if (!old) return byKey.set(e.key, Object.assign({}, e));
      if (e.rating != null && old.rating == null) old.rating = e.rating;
      if (e.watchedAt && (!old.watchedAt || e.watchedAt < old.watchedAt)) old.watchedAt = e.watchedAt;
      if (e.watchlist && old.rating == null && !old.watchedAt) old.watchlist = true;
    });
    return [...byKey.values()].map((e) => {
      if (e.rating != null || e.watchedAt) delete e.watchlist;
      return e;
    });
  }

  /* ---------------- the panel ---------------- */

  function mount(box) {
    box.innerHTML = `
      <h2><i class="fa-solid fa-file-import"></i> Import</h2>
      <p class="help">Bring your ratings, watched films and watchlist from IMDb or Letterboxd.</p>
      <details class="imp-how">
        <summary>How to get the files</summary>
        <p><b>IMDb:</b> on imdb.com open your profile → <b>Your ratings</b> → the ⋮ menu → <b>Export</b>. Do the same on
          <b>Your watchlist</b>. Each gives you a <code>.csv</code> file (sometimes by email / in "Exports").</p>
        <p><b>Letterboxd:</b> letterboxd.com → <b>Settings</b> → <b>Import &amp; Export</b> → <b>Export your data</b>.
          Unzip it and pick <code>ratings.csv</code>, <code>watched.csv</code> and <code>watchlist.csv</code> (several at once is fine).</p>
      </details>
      <label class="btn btn-primary imp-pick"><i class="fa-solid fa-file-csv"></i> Choose .csv files
        <input type="file" accept=".csv,text/csv" multiple hidden />
      </label>
      <div class="imp-status" aria-live="polite"></div>`;

    const status = box.querySelector(".imp-status");
    const input = box.querySelector("input");
    let busy = false;

    input.addEventListener("change", async () => {
      const files = [...input.files];
      input.value = "";
      if (!files.length || busy) return;
      if (!TMDB.enabled()) return (status.innerHTML = '<p class="imp-error">Importing needs TMDB (the key in Settings).</p>');

      const found = [];
      const kinds = [];
      for (const f of files) {
        const { kind, list } = entriesOf(parseCsv(await f.text()), f.name);
        if (kind === "unknown" || kind === "empty") kinds.push(`<span class="imp-bad">${esc(f.name)}: not an IMDb / Letterboxd export</span>`);
        else kinds.push(`${esc(f.name)}: ${list.length} from ${kind}`);
        found.push(...list);
      }
      const entries = merge(found);
      if (!entries.length) return (status.innerHTML = `<p>${kinds.join("<br>")}</p>`);

      busy = true;
      box.querySelector(".imp-pick").classList.add("disabled");
      const results = await match(entries, (n) => {
        status.innerHTML = `<p>${kinds.join("<br>")}</p>
          <div class="imp-bar"><span style="width:${Math.round((n / entries.length) * 100)}%"></span></div>
          <p class="help">Finding them on TMDB: ${n} of ${entries.length}…</p>`;
      });
      busy = false;
      box.querySelector(".imp-pick").classList.remove("disabled");
      review(results, kinds);
    });

    // find every entry on TMDB, 4 at a time
    async function match(entries, progress) {
      const todo = entries.map((e, n) => ({ e, n }));
      const out = new Array(entries.length);
      let done = 0;
      progress(0);
      const worker = async () => {
        while (todo.length) {
          const { e, n } = todo.shift();
          let hit = null;
          for (let attempt = 0; attempt < 2 && !hit; attempt++) {
            try {
              hit = e.imdb ? await TMDB.findByImdb(e.imdb) : await TMDB.findFilm(e.title, e.year);
              break;
            } catch (err) {
              await new Promise((r) => setTimeout(r, 1200)); // TMDB busy: wait and try once more
            }
          }
          out[n] = { e, hit };
          progress(++done);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      return out;
    }

    function review(results, kinds) {
      // one per TMDB title (the same film can appear twice under different names)
      const seen = new Set();
      const ok = results.filter((r) => r.hit && !seen.has(`${r.hit.mediaType}-${r.hit.tmdbId}`) && seen.add(`${r.hit.mediaType}-${r.hit.tmdbId}`));
      const missing = results.filter((r) => !r.hit);
      const have = ok.filter((r) => Cards.inLibrary(r.hit));
      const fresh = ok.length - have.length;
      status.innerHTML = `
        <p>${kinds.join("<br>")}</p>
        <div class="imp-summary">
          <div><strong>${fresh}</strong><span>new titles</span></div>
          <div><strong>${have.length}</strong><span>already yours</span></div>
          <div><strong>${ok.filter((r) => r.e.rating != null).length}</strong><span>with your score</span></div>
          <div><strong>${ok.filter((r) => r.e.watchlist).length}</strong><span>to watch</span></div>
        </div>
        ${
          missing.length
            ? `<details class="imp-missing"><summary>${missing.length} not found on TMDB</summary><p>${missing
                .map((r) => `${esc(r.e.title)}${r.e.year ? ` (${r.e.year})` : ""}`)
                .join(", ")}</p></details>`
            : ""
        }
        <div class="imp-actions">
          <button class="btn btn-primary imp-go" type="button"${ok.length ? "" : " disabled"}><i class="fa-solid fa-plus"></i> Add to my library</button>
          <button class="btn imp-cancel" type="button">Cancel</button>
        </div>
        <p class="help">Titles you already have keep your own score; the import only fills in what's missing.</p>`;
      status.querySelector(".imp-cancel").addEventListener("click", () => (status.innerHTML = ""));
      status.querySelector(".imp-go").addEventListener("click", () => {
        const n = apply(ok);
        status.innerHTML = `<p class="imp-done"><i class="fa-solid fa-circle-check"></i> Done: ${n.added} added, ${n.updated} updated.</p>`;
        toast(`Imported ${n.added + n.updated} titles`);
      });
    }

    function apply(list) {
      const newItems = [];
      const patches = {};
      list.forEach(({ e, hit }) => {
        const ref = `${hit.mediaType}-${hit.tmdbId}`;
        if (window.Ratings) Ratings.seed(ref, hit.score);
        const have = Cards.inLibrary(hit);
        if (have) {
          const p = {};
          if (have.rating == null && e.rating != null) Object.assign(p, { rating: e.rating, watchlist: false });
          if (!have.watchedAt && e.watchedAt) p.watchedAt = e.watchedAt;
          if (e.watchlist && have.rating == null && !have.watchlist) p.watchlist = true;
          if (Object.keys(p).length) patches[have.id] = p;
          return;
        }
        const item = { title: hit.title, year: hit.year || e.year || new Date().getFullYear(), type: hit.type, rating: e.rating ?? null, poster: hit.poster, tmdbId: hit.tmdbId, tmdbMedia: hit.mediaType };
        if (hit.backdrop) item.backdrop = hit.backdrop;
        if (hit.overview) item.overview = hit.overview;
        if (hit.genres && hit.genres.length) item.genres = hit.genres;
        if (e.watchlist) item.watchlist = true;
        if (e.watchedAt) item.watchedAt = e.watchedAt;
        item.isNew = false;
        newItems.push(item);
      });
      if (Object.keys(patches).length) Store.updateMany(patches);
      if (newItems.length) Store.addMany(newItems);
      return { added: newItems.length, updated: Object.keys(patches).length };
    }
  }

  window.Importer = { mount, parseCsv, entriesOf, merge };
})();
