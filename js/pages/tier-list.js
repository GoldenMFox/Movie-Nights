/*
 * Tier list: rank what you've watched from S to D, in the site's own style.
 *
 *  - Drag a poster into a tier (computers), or tap it and then a tier (phones).
 *  - The unranked titles sit in a tray fixed to the bottom of the screen, so every tier
 *    is in reach without scrolling up and down.
 *  - Quick rank: one poster at a time, tap S / A / B / C / D (or press the key), with
 *    Skip and Undo.
 *  - Fill from my ratings: 10 → S, 9 → A, 8 → B, 7 → C, below → D, with Undo.
 *  - Franchises: two or more films of one series (TMDB's collection, from Facts) in the
 *    same place show as one stacked tile, which moves and quick-ranks as one. Each film is
 *    still kept on its own, so a franchise can be split (Split), and grouping turned off.
 *
 * Only watched titles can be ranked: in your library, and not only on your Watchlist.
 * Saved with your account (Store.setTiers). Save keeps the board as a named tier list
 * (as many as you like, Store.tierLists); open one to look at it, or to edit it. Save keeps the board as a named tier list
 * (as many as you like, Store.tierLists); open one to look at it, or to edit it.
 */
(function () {
  const { esc, toast } = UI;
  // hot red for S down to a muted grey for D
  const TIERS = [
    { id: "S", name: "Masterpiece", color: "#ff3b47" },
    { id: "A", name: "Great", color: "#e0393e" },
    { id: "B", name: "Good", color: "#b8323a" },
    { id: "C", name: "Okay", color: "#8a3a42" },
    { id: "D", name: "Meh", color: "#62626b" },
  ];
  const IDS = TIERS.map((t) => t.id);
  const POOL_LIMIT = 200;
  const touch = window.matchMedia("(hover: none)").matches;

  const root = document.getElementById("tier-app");
  if (Store.guest) {
    root.innerHTML = UI.signInPrompt("Sign in to make your own tier list");
    return;
  }

  // watched = in your library, unless it's only on your Watchlist (a score or a watch date always counts)
  const seen = Store.isWatched;

  function load() {
    const t = Store.getTiers();
    const out = {};
    IDS.forEach((id) => (out[id] = (t[id] || []).filter((x) => Store.get(x))));
    return out;
  }
  let tiers = load();
  const save = () => Store.setTiers(tiers);
  const copy = (t) => JSON.parse(JSON.stringify(t));
  let selected = null; // the tile picked by a tap (phones): a title id or a franchise key
  let landed = null; // the titles that just moved: they land with a little pop

  /* ---------- franchises: two or more films of one series rank as one ---------- */

  const fr = new Map(); // library id -> [collection id, name]
  let grouping = Store.read("mn:tierGroup", true) !== false;
  const split = new Set(Store.read("mn:tierSplit", [])); // franchises you rank film by film
  const frName = (n) => n.replace(/\s*[-–:]?\s*collection$/i, "");
  const cidOf = (id) => (grouping && fr.has(id) && !split.has(fr.get(id)[0]) ? fr.get(id)[0] : null);

  // titles in one place (a tier, or the tray) as tiles: a franchise with 2+ films there is one
  function unitsOf(ids, loc) {
    const count = new Map();
    ids.forEach((id) => {
      const c = cidOf(id);
      if (c) count.set(c, (count.get(c) || 0) + 1);
    });
    const groups = new Map();
    const out = [];
    ids.forEach((id) => {
      const c = cidOf(id);
      if (!c || count.get(c) < 2) return out.push({ key: id, ids: [id] });
      let u = groups.get(c);
      if (!u) {
        u = { key: `f:${c}@${loc}`, cid: c, name: frName(fr.get(id)[1]), ids: [] };
        groups.set(c, u);
        out.push(u);
      }
      u.ids.push(id);
    });
    // a franchise shows its first film's poster, and lists them oldest first
    groups.forEach((u) => u.ids.sort((a, b) => (Store.get(a).year || 0) - (Store.get(b).year || 0)));
    return out;
  }

  // the titles behind a tile: a franchise key -> its films in that place
  function idsOf(key) {
    const m = /^f:(\d+)@(\w+)$/.exec(key || "");
    if (!m) return key ? [key] : [];
    const list = m[2] === "pool" ? unranked(false).map((i) => i.id) : tiers[m[2]] || [];
    return list.filter((id) => String(cidOf(id)) === m[1]).sort((a, b) => (Store.get(a).year || 0) - (Store.get(b).year || 0));
  }

  // your average score for some titles (null when none is rated)
  function avgOf(ids) {
    const r = ids.map((id) => Store.get(id)).filter((i) => i && i.rating != null).map((i) => i.rating);
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
  }

  // which franchise each film belongs to: from the film facts (kept in this browser after the first time)
  let frLoading = false;
  const frChecked = new Set();
  async function loadFranchises() {
    if (frLoading || !window.Facts || !window.TMDB || !TMDB.enabled()) return;
    const films = Store.all().filter((i) => seen(i) && i.type !== "tv" && !frChecked.has(i.id));
    if (!films.length) return;
    frLoading = true;
    films.forEach((i) => frChecked.add(i.id));
    const map = await Facts.forItems(films);
    map.forEach((f, id) => f && f.f && fr.set(id, f.f));
    frLoading = false;
    render();
  }

  document.querySelector(".tier-help").textContent = touch
    ? "Tap a poster, then tap a tier. Or use Quick rank to go through them one by one."
    : "Drag posters from the tray into a tier. Double-click a poster to open it. Or use Quick rank to go through them one by one.";

  root.innerHTML = `
    <section class="tl-saved" aria-label="Your tier lists"></section>
    <div class="tl-actions">
      <button class="btn btn-primary tl-quick" type="button"><i class="fa-solid fa-bolt"></i> Quick rank</button>
      <button class="btn tl-fill" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> Fill from my ratings</button>
      <button class="btn tl-clear" type="button"><i class="fa-solid fa-rotate-left"></i> Clear</button>
      <button class="btn tl-photo" type="button" title="Save the board as a picture (PNG)"><i class="fa-regular fa-image"></i> <span class="tl-word">Save picture</span></button>
      <span class="tl-status" aria-live="polite"></span>
      <button class="btn tl-saveas" type="button" hidden><i class="fa-regular fa-copy"></i> <span class="tl-word">Save as new</span></button>
      <button class="btn tl-save" type="button"><i class="fa-solid fa-floppy-disk"></i> Save</button>
    </div>
    <div class="tl-board">
      ${TIERS.map(
        (t) => `<section class="tl-row" data-tier="${t.id}" style="--tc:${t.color}">
          <div class="tl-label" data-tier="${t.id}" role="button" tabindex="0" aria-label="Tier ${t.id}: move the picked poster here">
            <b>${t.id}</b><span class="tl-name">${t.name}</span><small class="tl-count"></small>
          </div>
          <div class="tl-drop" data-tier="${t.id}"></div>
        </section>`
      ).join("")}
    </div>
    <section class="tl-tray" aria-label="Unranked titles">
      <div class="tl-pick" aria-live="polite">
        <span class="tl-pick-name"></span>
        <div class="tl-pick-buttons">
          ${TIERS.map((t) => `<button class="tl-pick-tier" type="button" data-move="${t.id}" style="--tc:${t.color}">${t.id}</button>`).join("")}
          <button class="btn tl-split" type="button" data-move="split" hidden></button>
          <button class="btn" type="button" data-move="pool" aria-label="Unrank" title="Back to Unranked"><i class="fa-solid fa-inbox"></i><span class="tl-word"> Unrank</span></button>
          <button class="btn" type="button" data-move="open" aria-label="Open" title="Open its page"><i class="fa-solid fa-circle-info"></i></button>
          <button class="btn" type="button" data-move="cancel" aria-label="Cancel"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div class="tl-tray-head">
        <strong class="tl-tray-title"><i class="fa-solid fa-layer-group"></i> Unranked <span class="tl-left"></span></strong>
        <form class="glass-search tl-search" role="search">
          <i class="fa-solid fa-magnifying-glass gs-icon" aria-hidden="true"></i>
          <input type="search" name="q" placeholder="Find a title…" aria-label="Find a title" autocomplete="off" />
        </form>
        <span class="glass-select small"><select name="type" aria-label="Show">
          <option value="">Everything</option><option value="movie">Movies</option><option value="tv">TV Shows</option><option value="anime">Anime</option>
        </select></span>
        <span class="glass-select small"><select name="order" aria-label="Order">
          <option value="rating">My rating</option><option value="title">Title A-Z</option><option value="year">Newest</option>
        </select></span>
        <button class="tl-frs" type="button" aria-pressed="${grouping}" title="Rank the films of a franchise as one"><i class="fa-solid fa-layer-group"></i> <span>Franchises</span></button>
        <button class="tl-fold" type="button" aria-label="Hide the tray" title="Hide the tray"><i class="fa-solid fa-chevron-down"></i></button>
      </div>
      <div class="tl-pool" data-tier="pool"></div>
      <p class="tl-more"></p>
    </section>`;

  const $ = (s) => root.querySelector(s);
  const pool = $(".tl-pool");
  const tray = $(".tl-tray");
  const q = $('[name="q"]');
  const typeSel = $('[name="type"]');
  const orderSel = $('[name="order"]');

  function tile(u) {
    if (u.ids.length > 1) return groupTile(u);
    const item = Store.get(u.key);
    const cls = `tl-item${selected === item.id ? " selected" : ""}${landed && landed.includes(item.id) ? " landed" : ""}`;
    const tip = `${Lang.title(item)}${item.year ? ` (${item.year})` : ""}${item.rating != null ? ` · ★ ${Cards.formatRating(item.rating)}` : ""}`;
    return `<button class="${cls}" type="button" draggable="true" data-id="${esc(item.id)}" title="${esc(tip)}">
      <img src="${Store.poster(Cards.posterOf(item), "w185")}" alt="${esc(Lang.title(item))}" loading="lazy" draggable="false" />
      <span class="tl-cap"><b>${esc(Lang.title(item))}</b>${item.rating != null ? `<small><i class="fa-solid fa-star"></i> ${Cards.formatRating(item.rating)}</small>` : ""}</span>
    </button>`;
  }

  // a franchise: its first film's poster, the edges of the others behind it, how many
  function groupTile(u) {
    const first = Store.get(u.ids[0]);
    const avg = avgOf(u.ids);
    const cls = `tl-item tl-group${selected === u.key ? " selected" : ""}${landed && u.ids.some((id) => landed.includes(id)) ? " landed" : ""}`;
    const tip = `${u.name} · ${u.ids.length} films${avg != null ? ` · ★ ${Cards.formatRating(avg)}` : ""}`;
    return `<button class="${cls}" type="button" draggable="true" data-id="${esc(u.key)}" title="${esc(tip)}">
      <img src="${Store.poster(Cards.posterOf(first), "w185")}" alt="${esc(u.name)}" loading="lazy" draggable="false" />
      <span class="tl-fr" aria-hidden="true"><i class="fa-solid fa-layer-group"></i>${u.ids.length}</span>
      <span class="tl-cap"><b>${esc(u.name)}</b><small>${u.ids.length} films${avg != null ? ` · <i class="fa-solid fa-star"></i> ${Cards.formatRating(avg)}` : ""}</small></span>
    </button>`;
  }

  const sorters = {
    rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.order - b.order,
    title: (a, b) => Lang.title(a).localeCompare(Lang.title(b)),
    year: (a, b) => (b.year || 0) - (a.year || 0) || a.order - b.order,
  };

  // the watched titles not in a tier yet, in the tray's order (search and type too, when `all` is off)
  function unranked(all) {
    const inTier = new Set(IDS.flatMap((t) => tiers[t]));
    const term = q.value.trim().toLowerCase();
    return Store.all()
      .filter((i) => seen(i) && !inTier.has(i.id))
      .filter((i) => all || !typeSel.value || i.type === typeSel.value)
      .filter((i) => all || !term || Lang.matches(i, term))
      .sort(sorters[orderSel.value]);
  }

  function render() {
    TIERS.forEach((t) => {
      const list = tiers[t.id].filter((id) => Store.get(id));
      root.querySelector(`.tl-drop[data-tier="${t.id}"]`).innerHTML = list.length
        ? unitsOf(list, t.id).map(tile).join("")
        : `<p class="tl-empty"><i class="fa-regular fa-hand-pointer"></i> ${touch ? "Pick a poster, then tap the letter" : "Drop titles here"}</p>`;
      root.querySelector(`.tl-row[data-tier="${t.id}"] .tl-count`).textContent = `${list.length} title${list.length === 1 ? "" : "s"}`;
    });

    const list = unitsOf(
      unranked(false).map((i) => i.id),
      "pool"
    );
    const total = unranked(true).length;
    pool.innerHTML = list.length
      ? list.slice(0, POOL_LIMIT).map(tile).join("")
      : `<p class="tl-empty">${total ? "Nothing matches your search." : "Everything you've watched is ranked. 🎉"}</p>`;
    $(".tl-left").textContent = total;
    $(".tl-more").textContent = list.length > POOL_LIMIT ? `Showing ${POOL_LIMIT} of ${list.length}: search to find the rest.` : "";
    $(".tl-quick").disabled = !total;
    const frs = $(".tl-frs");
    frs.setAttribute("aria-pressed", grouping);
    frs.classList.toggle("busy", frLoading);
    renderSaved();

    // a poster picked (phones): the bar with the tiers, and the tiers light up
    if (selected && !idsOf(selected).length) selected = null;
    root.classList.toggle("picking", !!selected);
    tray.classList.toggle("picking", !!selected);
    if (selected) {
      const ids = idsOf(selected);
      const item = Store.get(ids[0]);
      const name = ids.length > 1 ? `${frName(fr.get(ids[0])[1])} (${ids.length} films)` : Lang.title(item);
      $(".tl-pick-name").textContent = item ? `Move "${name}" to` : "";
      // a franchise: Split it; a film of a split franchise: put it back together
      const sp = $(".tl-split");
      const f = fr.get(ids[0]);
      sp.hidden = !grouping || !f || (ids.length < 2 && !split.has(f[0]));
      sp.dataset.move = ids.length > 1 ? "split" : "join";
      sp.innerHTML = ids.length > 1 ? '<i class="fa-solid fa-scissors"></i><span class="tl-word"> Split</span>' : '<i class="fa-solid fa-layer-group"></i><span class="tl-word"> Group</span>';
      sp.title = ids.length > 1 ? "Rank these films one by one" : `Rank ${frName(f ? f[1] : "")} as one again`;
      sp.setAttribute("aria-label", sp.title);
    }
    landed = null;
  }

  // move a tile (a title, or a franchise's films) to a tier, before another tile, or back to the tray
  function move(key, target, beforeKey) {
    const ids = idsOf(key);
    if (!ids.length) return;
    const before = beforeKey ? idsOf(beforeKey)[0] : null;
    IDS.forEach((t) => (tiers[t] = tiers[t].filter((x) => !ids.includes(x))));
    if (target !== "pool") {
      const list = tiers[target];
      const at = before ? list.indexOf(before) : -1;
      if (at >= 0) list.splice(at, 0, ...ids);
      else list.push(...ids);
    }
    selected = null;
    landed = ids;
    save();
    render();
  }

  // Split a franchise (its films rank one by one), or Group it again
  function setSplit(cid, on) {
    if (on) split.add(cid);
    else split.delete(cid);
    Store.write("mn:tierSplit", [...split]);
  }

  /* ---------- drag and drop (computers) ---------- */

  let dragId = null;
  const zoneOf = (el) => el.closest(".tl-drop, .tl-pool, .tl-label, .tl-row");
  const tierOf = (zone) => zone.dataset.tier;
  root.addEventListener("dragstart", (e) => {
    const el = e.target.closest(".tl-item");
    if (!el) return;
    dragId = el.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
    // (a moment later, so the picture the browser drags is still the normal poster)
    requestAnimationFrame(() => el.classList.add("dragging"));
    root.classList.add("dragging-on");
  });
  root.addEventListener("dragend", (e) => {
    const el = e.target.closest(".tl-item");
    if (el) el.classList.remove("dragging");
    root.classList.remove("dragging-on");
    root.querySelectorAll(".drag-over").forEach((z) => z.classList.remove("drag-over"));
    dragId = null;
  });
  root.addEventListener("dragover", (e) => {
    const zone = dragId && zoneOf(e.target);
    if (!zone) return;
    e.preventDefault();
    const row = zone.closest(".tl-row") || zone;
    root.querySelectorAll(".drag-over").forEach((z) => z !== row && z.classList.remove("drag-over"));
    row.classList.add("drag-over");
  });
  root.addEventListener("drop", (e) => {
    const zone = dragId && zoneOf(e.target);
    if (!zone) return;
    e.preventDefault();
    const before = e.target.closest(".tl-drop .tl-item");
    // (the dragged poster is drawn again right away, so its own "drag ended" never reaches here)
    root.classList.remove("dragging-on");
    root.querySelectorAll(".drag-over").forEach((z) => z.classList.remove("drag-over"));
    move(dragId, tierOf(zone), before && before.dataset.id !== dragId ? before.dataset.id : null);
    dragId = null;
  });

  /* ---------- tap to pick (phones), buttons ---------- */

  root.addEventListener("click", (e) => {
    const itemEl = e.target.closest(".tl-item");
    if (itemEl) {
      selected = selected === itemEl.dataset.id ? null : itemEl.dataset.id;
      return render();
    }
    const label = e.target.closest(".tl-label, .tl-row");
    if (label && selected) return move(selected, label.dataset.tier);

    const btn = e.target.closest("[data-move]");
    if (btn && selected) {
      const target = btn.dataset.move;
      if (target === "cancel") {
        selected = null;
        render();
      } else if (target === "open") location.href = `title.html?id=${encodeURIComponent(idsOf(selected)[0])}`;
      else if (target === "split" || target === "join") {
        const f = fr.get(idsOf(selected)[0]);
        if (!f) return;
        setSplit(f[0], target === "split");
        selected = null;
        render();
        toast(target === "split" ? `${frName(f[1])}: rank the films one by one` : `${frName(f[1])}: ranked as one again`);
      } else move(selected, target);
      return;
    }
    if (e.target.closest(".tl-frs")) {
      grouping = !grouping;
      Store.write("mn:tierGroup", grouping);
      selected = null;
      render();
      return toast(grouping ? "Franchises rank as one" : "Every film on its own");
    }
    if (e.target.closest(".tl-fold")) {
      const folded = tray.classList.toggle("folded");
      const b = $(".tl-fold");
      b.setAttribute("aria-label", folded ? "Show the tray" : "Hide the tray");
      b.title = b.getAttribute("aria-label");
      return;
    }
    const card = e.target.closest(".tl-card");
    if (card) return view(card.dataset.list);
    if (e.target.closest(".tl-new")) return newBoard();
    if (e.target.closest(".tl-save")) return saveBoard(false);
    if (e.target.closest(".tl-saveas")) return saveBoard(true);
    if (e.target.closest(".tl-photo")) {
      if (!countOf(tiers)) return toast("Rank a few titles first");
      const a = active();
      return savePicture(a ? a.name : "My tier list", tiers);
    }
    if (e.target.closest(".tl-quick")) return quickRank();
    if (e.target.closest(".tl-fill")) return fillFromRatings();
    if (e.target.closest(".tl-clear")) return clearAll();
  });

  // keyboard: Enter / Space on a tier moves the picked poster there
  root.addEventListener("keydown", (e) => {
    const label = e.target.closest(".tl-label");
    if (label && selected && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      move(selected, label.dataset.tier);
    }
  });

  root.addEventListener("dblclick", (e) => {
    const itemEl = e.target.closest(".tl-item");
    if (itemEl) location.href = `title.html?id=${encodeURIComponent(idsOf(itemEl.dataset.id)[0])}`;
  });

  // the tray scrolls sideways: a normal mouse wheel moves it too
  pool.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || pool.scrollWidth <= pool.clientWidth) return;
      e.preventDefault();
      pool.scrollLeft += e.deltaY;
    },
    { passive: false }
  );

  $(".tl-search").addEventListener("submit", (e) => {
    e.preventDefault();
    render();
  });
  let typing;
  q.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(render, 150);
  });
  typeSel.addEventListener("change", render);
  orderSel.addEventListener("change", render);

  /* ---------- Fill from my ratings, Clear (both with Undo) ---------- */

  const tierFor = (r) => (r >= 10 ? "S" : r >= 9 ? "A" : r >= 8 ? "B" : r >= 7 ? "C" : "D");

  function undoToast(message, before) {
    toast(message, {
      label: "Undo",
      run: () => {
        tiers = before;
        save();
        render();
        toast("Undone");
      },
    });
  }

  async function fillFromRatings() {
    const todo = unranked(true).filter((i) => i.rating != null);
    if (!todo.length) return toast("Every title you rated is in a tier already");
    const ok = await UI.confirm({
      icon: "fa-wand-magic-sparkles",
      title: `Place ${todo.length} rated title${todo.length === 1 ? "" : "s"}?`,
      text: "By your score: <b>10</b> → S, <b>9</b> → A, <b>8</b> → B, <b>7</b> → C, below → D. Titles already in a tier stay where they are.",
      ok: "Fill the tiers",
    });
    if (!ok) return;
    const before = copy(tiers);
    todo
      .sort((a, b) => b.rating - a.rating || a.order - b.order)
      .forEach((i) => tiers[tierFor(i.rating)].push(i.id));
    save();
    render();
    undoToast(`Placed ${todo.length} title${todo.length === 1 ? "" : "s"}`, before);
  }

  async function clearAll() {
    if (!IDS.some((t) => tiers[t].length)) return toast("The tiers are empty already");
    const ok = await UI.confirm({ icon: "fa-rotate-left", title: "Clear every tier?", text: "Every poster goes back to Unranked.", ok: "Clear", danger: true });
    if (!ok) return;
    const before = copy(tiers);
    IDS.forEach((t) => (tiers[t] = []));
    save();
    render();
    undoToast("Tiers cleared", before);
  }

  /* ---------- saved tier lists: keep as many as you like, look at them any time ---------- */

  // The board is what you're ranking now (mn:tiers). Save keeps a copy under a name
  // (Store.tierLists, with your profile); the board stays linked to it (Store.tierActive),
  // so the next Save updates that one. Open a saved one to look at it, or to edit it.

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayLabel(t) {
    const d = new Date(t);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
  }
  // a saved list's tiers, without titles that have left your library since
  const tiersOf = (list) => {
    const out = {};
    IDS.forEach((id) => (out[id] = ((list.tiers || {})[id] || []).filter((x) => Store.get(x))));
    return out;
  };
  const sameTiers = (a, b) => JSON.stringify(IDS.map((t) => a[t])) === JSON.stringify(IDS.map((t) => b[t]));
  const countOf = (t) => IDS.reduce((n, id) => n + t[id].length, 0);
  const active = () => Store.tierLists().find((l) => l.id === Store.tierActive()) || null;
  // the board has changes that aren't in a saved list
  function unsaved() {
    const a = active();
    return a ? !sameTiers(tiers, tiersOf(a)) : countOf(tiers) > 0;
  }

  function miniHtml(t) {
    return `<span class="tl-mini">${TIERS.map(
      (x) => `<span class="tl-mini-row" style="--tc:${x.color}"><b>${x.id}</b>${t[x.id]
        .slice(0, 6)
        .map((id) => `<img src="${Store.poster(Cards.posterOf(Store.get(id)), "w92")}" alt="" loading="lazy" />`)
        .join("")}${t[x.id].length > 6 ? `<em>+${t[x.id].length - 6}</em>` : ""}</span>`
    ).join("")}</span>`;
  }

  function renderSaved() {
    const lists = Store.tierLists();
    const a = active();
    const dirty = unsaved();
    root.querySelector(".tl-saved").innerHTML = `
      <div class="tl-saved-head">
        <h2><i class="fa-solid fa-layer-group"></i> Your tier lists${lists.length ? ` <small>${lists.length}</small>` : ""}</h2>
        <button class="btn tl-new" type="button"><i class="fa-solid fa-plus"></i> New tier list</button>
      </div>
      <div class="tl-shelf">${
        lists.length
          ? lists
              .slice()
              // the one on the board first, then the last saved
              .sort((x, y) => (a && y.id === a.id) - (a && x.id === a.id) || (y.at || 0) - (x.at || 0))
              .map((l) => {
                const t = tiersOf(l);
                const on = a && a.id === l.id;
                return `<button class="tl-card${on ? " on" : ""}" type="button" data-list="${esc(l.id)}" aria-label="${esc(l.name)}: look at it">
                  ${miniHtml(t)}
                  <span class="tl-card-text"><strong>${esc(l.name)}</strong>
                  <small>${countOf(t)} title${countOf(t) === 1 ? "" : "s"} · ${dayLabel(l.at || l.made)}</small></span>
                  ${on ? `<em class="tl-card-on">${dirty ? "Editing · unsaved" : "On the board"}</em>` : ""}
                </button>`;
              })
              .join("")
          : `<p class="tl-shelf-empty"><i class="fa-regular fa-floppy-disk"></i> Rank some titles, then <b>Save</b> to keep this tier list. Make as many as you like: all-time, this year, horror only… and look at them any time.</p>`
      }</div>`;

    const status = $(".tl-status");
    status.innerHTML = a
      ? `<b>${esc(a.name)}</b> · ${dirty ? '<span class="tl-dirty">Unsaved changes</span>' : '<i class="fa-solid fa-check"></i> Saved'}`
      : countOf(tiers)
      ? '<span class="tl-dirty">Not saved yet</span>'
      : "";
    $(".tl-save").disabled = (a && !dirty) || !countOf(tiers);
    $(".tl-saveas").hidden = !a;
  }

  const newId = () => `t${Date.now().toString(36)}`;

  async function saveBoard(asNew) {
    if (!countOf(tiers)) return toast("Rank a few titles first");
    const lists = Store.tierLists();
    const a = active();
    const now = Date.now();
    if (a && !asNew) {
      Store.saveTierLists(lists.map((l) => (l.id === a.id ? Object.assign({}, l, { tiers: copy(tiers), at: now }) : l)));
      toast(`Saved "${a.name}"`);
      return render();
    }
    const name = await UI.ask({
      icon: "fa-floppy-disk",
      title: asNew ? "Save as a new tier list" : "Name this tier list",
      text: "Keep as many as you like and look at them any time.",
      value: a ? `${a.name} (copy)` : lists.length ? `My tier list ${lists.length + 1}` : "All-time favorites",
      placeholder: "e.g. Best of 2026",
      ok: "Save",
    });
    if (!name) return;
    const id = newId();
    Store.saveTierLists(lists.concat({ id, name: name.slice(0, 40), tiers: copy(tiers), made: now, at: now }), id);
    toast(`Saved "${name.slice(0, 40)}"`);
    render();
  }

  // leaving the board (open another list, start a new one): ask first when it has unsaved changes
  async function mayLeave() {
    if (!unsaved()) return true;
    const a = active();
    return UI.confirm({
      icon: "fa-floppy-disk",
      title: "Leave without saving?",
      text: a ? `Your changes to <b>${esc(a.name)}</b> aren't saved.` : "The tiers on the board aren't saved in a tier list.",
      ok: "Leave anyway",
      cancel: "Keep editing",
      danger: true,
    });
  }

  async function openForEdit(listId) {
    const l = Store.tierLists().find((x) => x.id === listId);
    if (!l) return;
    if (!(await mayLeave())) return false;
    tiers = tiersOf(l);
    save();
    Store.saveTierLists(Store.tierLists(), l.id);
    selected = null;
    render();
    toast(`"${l.name}" is on the board`);
    return true;
  }

  async function newBoard() {
    if (!(await mayLeave())) return;
    IDS.forEach((t) => (tiers[t] = []));
    save();
    Store.saveTierLists(Store.tierLists(), null);
    selected = null;
    render();
    toast("A fresh board: rank away");
  }

  // a saved list, to look at (and open, rename or delete)
  let viewer = null;
  let viewing = null;
  function view(listId) {
    const l = Store.tierLists().find((x) => x.id === listId);
    if (!l) return;
    viewing = l.id;
    if (!viewer) {
      viewer = Cards.makeOverlay("tlv-modal", `<div class="tlv-in"></div>`);
      viewer.addEventListener("click", async (e) => {
        if (e.target.closest(".tlv-open")) {
          if (Store.tierActive() === viewing) return Cards.closeModal(viewer);
          Cards.closeModal(viewer);
          if (!(await openForEdit(viewing))) view(viewing);
          else window.scrollTo({ top: 0, behavior: "smooth" });
        }
        if (e.target.closest(".tlv-photo")) {
          const l = Store.tierLists().find((x) => x.id === viewing);
          if (l) savePicture(l.name, tiersOf(l));
        }
        if (e.target.closest(".tlv-rename")) renameList(viewing);
        if (e.target.closest(".tlv-delete")) deleteList(viewing);
        const poster = e.target.closest("[data-open]");
        if (poster) location.href = `title.html?id=${encodeURIComponent(poster.dataset.open)}`;
      });
    }
    const t = tiersOf(l);
    const on = Store.tierActive() === l.id;
    viewer.querySelector(".tlv-in").innerHTML = `
      <div class="tlv-head">
        <span class="xr-label"><i class="fa-solid fa-layer-group"></i> Tier list</span>
        <h3>${esc(l.name)}</h3>
        <small>${countOf(t)} title${countOf(t) === 1 ? "" : "s"} · saved ${dayLabel(l.at || l.made)}${l.made && dayLabel(l.made) !== dayLabel(l.at) ? ` · made ${dayLabel(l.made)}` : ""}</small>
      </div>
      <div class="tlv-board">${TIERS.map(
        (x) => `<div class="tlv-row" style="--tc:${x.color}" data-tier="${x.id}">
          <span class="tlv-label"><b>${x.id}</b><small>${x.name}</small></span>
          <div class="tlv-posters">${
            t[x.id].length
              ? t[x.id]
                  .map((id) => {
                    const item = Store.get(id);
                    return `<button type="button" data-open="${esc(id)}" title="${esc(Lang.title(item))}${item.year ? ` (${item.year})` : ""}"><img src="${Store.poster(
                      Cards.posterOf(item),
                      "w154"
                    )}" alt="${esc(Lang.title(item))}" loading="lazy" /></button>`;
                  })
                  .join("")
              : `<span class="tlv-none">Nothing here</span>`
          }</div>
        </div>`
      ).join("")}</div>
      <div class="tlv-buttons">
        <button class="btn btn-primary tlv-open" type="button"><i class="fa-solid fa-pen"></i> ${on ? "Back to editing" : "Open to edit"}</button>
        <button class="btn tlv-photo" type="button"><i class="fa-regular fa-image"></i> Save picture</button>
        <button class="btn tlv-rename" type="button"><i class="fa-solid fa-i-cursor"></i> Rename</button>
        <button class="btn tlv-delete" type="button" aria-label="Delete" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
      </div>`;
    Cards.openModal(viewer);
  }

  /* ---------- a tier list as a picture (PNG): its name on top, then its rows, posters and all ---------- */

  // a poster, ready to draw (null when it can't be had: a box with the title instead)
  const loadPoster = (src) =>
    new Promise((resolve) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      // (its own copy: the one the page already shows was fetched without permission to draw it)
      im.src = /^https:/.test(src) ? `${src}${src.includes("?") ? "&" : "?"}mn=png` : src;
    });
  function roundRect(x, X, Y, w, h, r) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r);
    x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r);
    x.arcTo(X, Y, X + w, Y, r);
    x.closePath();
  }
  async function savePicture(name, t) {
    toast("Making the picture…");
    const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const W = 1400;
    const PAD = 40;
    const LABEL = 150;
    const PW = 104; // a poster: 104 × 156
    const PH = 156;
    const GAP = 8;
    const per = Math.floor((W - PAD * 2 - LABEL - 24 + GAP) / (PW + GAP));
    const rows = TIERS.map((x) => {
      const ids = (t[x.id] || []).filter((id) => Store.get(id));
      const lines = Math.max(1, Math.ceil(ids.length / per));
      return { x, ids, h: lines * PH + (lines - 1) * GAP + 24 };
    });
    const HEAD = 150;
    const FOOT = 60;
    const H = HEAD + rows.reduce((s, r) => s + r.h + 12, 0) + FOOT;
    // every poster first (TMDB lets a page draw them)
    const all = [...new Set(rows.flatMap((r) => r.ids))];
    const pics = new Map(await Promise.all(all.map(async (id) => [id, await loadPoster(Store.poster(Cards.posterOf(Store.get(id)), "w185"))])));

    const c = document.createElement("canvas");
    const scale = 2; // (sharp on any screen)
    c.width = W * scale;
    c.height = H * scale;
    const x = c.getContext("2d");
    x.scale(scale, scale);
    // the page: dark, a red glow at the top
    x.fillStyle = "#0c0c0f";
    x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, W * 0.7);
    glow.addColorStop(0, "rgba(229, 9, 20, 0.28)");
    glow.addColorStop(1, "rgba(229, 9, 20, 0)");
    x.fillStyle = glow;
    x.fillRect(0, 0, W, H);
    // its name
    const count = rows.reduce((s, r) => s + r.ids.length, 0);
    x.textBaseline = "alphabetic";
    x.fillStyle = "#ff4d57";
    x.font = `800 15px ${font}`;
    x.fillText("TIER LIST", PAD, 58);
    x.fillStyle = "#ffffff";
    x.font = `800 46px ${font}`;
    let title = name;
    while (x.measureText(title).width > W - PAD * 2 && title.length > 4) title = `${title.slice(0, -2)}…`;
    x.fillText(title, PAD, 108);
    x.fillStyle = "rgba(255, 255, 255, 0.55)";
    x.font = `600 16px ${font}`;
    x.fillText(`${count} title${count === 1 ? "" : "s"}`, PAD, 134);
    // the rows
    let y = HEAD;
    rows.forEach(({ x: tier, ids, h }) => {
      x.fillStyle = "rgba(255, 255, 255, 0.045)";
      roundRect(x, PAD, y, W - PAD * 2, h, 16);
      x.fill();
      // its letter, on the tier's colour
      x.save();
      roundRect(x, PAD, y, LABEL, h, 16);
      x.clip();
      x.fillStyle = tier.color;
      x.fillRect(PAD, y, LABEL, h);
      x.fillStyle = "rgba(0, 0, 0, 0.18)";
      x.fillRect(PAD, y + h / 2, LABEL, h / 2);
      x.restore();
      x.fillStyle = "#fff";
      x.textAlign = "center";
      x.font = `900 54px ${font}`;
      x.fillText(tier.id, PAD + LABEL / 2, y + h / 2 + 10);
      x.font = `700 14px ${font}`;
      x.fillStyle = "rgba(255, 255, 255, 0.85)";
      x.fillText(tier.name.toUpperCase(), PAD + LABEL / 2, y + h / 2 + 34);
      x.textAlign = "left";
      // its posters
      if (!ids.length) {
        x.fillStyle = "rgba(255, 255, 255, 0.3)";
        x.font = `600 15px ${font}`;
        x.fillText("Nothing here", PAD + LABEL + 24, y + h / 2 + 5);
      }
      ids.forEach((id, i) => {
        const px = PAD + LABEL + 12 + (i % per) * (PW + GAP);
        const py = y + 12 + Math.floor(i / per) * (PH + GAP);
        x.save();
        roundRect(x, px, py, PW, PH, 8);
        x.clip();
        const im = pics.get(id);
        if (im) x.drawImage(im, px, py, PW, PH);
        else {
          x.fillStyle = "#26262c";
          x.fillRect(px, py, PW, PH);
          x.fillStyle = "rgba(255, 255, 255, 0.75)";
          x.font = `700 12px ${font}`;
          const words = Lang.title(Store.get(id)).split(/\s+/);
          let line = "";
          let ly = py + 24;
          words.forEach((w) => {
            if (x.measureText(`${line} ${w}`).width > PW - 14 && line) {
              x.fillText(line, px + 7, ly);
              line = w;
              ly += 16;
            } else line = line ? `${line} ${w}` : w;
          });
          if (line && ly < py + PH - 6) x.fillText(line, px + 7, ly);
        }
        x.restore();
      });
      y += h + 12;
    });
    // the site's name, at the foot
    x.fillStyle = "rgba(255, 255, 255, 0.4)";
    x.font = `700 14px ${font}`;
    x.textAlign = "right";
    x.fillText("MOVIE NIGHTS", W - PAD, H - 24);
    x.textAlign = "left";

    let blob;
    try {
      blob = await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("no picture"))), "image/png"));
    } catch (e) {
      return toast("Couldn't make the picture on this device");
    }
    const file = `${name.replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "tier-list"}.png`;
    // (a phone: its share sheet, so it can go straight to Photos; elsewhere: downloaded)
    const f = typeof File === "function" ? new File([blob], file, { type: "image/png" }) : null;
    if (touch && f && navigator.canShare && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: name });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file;
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    toast(`Saved "${file}"`);
  }

  async function renameList(listId) {
    const l = Store.tierLists().find((x) => x.id === listId);
    if (!l) return;
    const name = await UI.ask({ icon: "fa-i-cursor", title: "Rename tier list", value: l.name, ok: "Rename" });
    if (!name) return;
    Store.saveTierLists(Store.tierLists().map((x) => (x.id === listId ? Object.assign({}, x, { name: name.slice(0, 40) }) : x)));
    render();
    if (viewer && viewer.classList.contains("active")) view(listId);
  }

  async function deleteList(listId) {
    const l = Store.tierLists().find((x) => x.id === listId);
    if (!l) return;
    const ok = await UI.confirm({ icon: "fa-trash-can", title: `Delete "${l.name}"?`, text: "The saved tier list goes. Your titles and ratings stay.", ok: "Delete", danger: true });
    if (!ok) return;
    const wasActive = Store.tierActive() === listId;
    const before = Store.tierLists();
    Store.saveTierLists(before.filter((x) => x.id !== listId), wasActive ? null : undefined);
    if (viewer) Cards.closeModal(viewer);
    render();
    toast(`Deleted "${l.name}"`, {
      label: "Undo",
      run: () => {
        Store.saveTierLists(before, wasActive ? listId : undefined);
        render();
        toast("Undone");
      },
    });
  }

  /* ---------- Quick rank: one poster at a time ---------- */

  let qr = null; // { overlay, type, queue: [ids], done: [{ id }], current }
  const QR_TYPES = [
    ["", "fa-layer-group", "All"],
    ["movie", "fa-film", "Movies"],
    ["tv", "fa-tv", "TV"],
    ["anime", "fa-dragon", "Anime"],
  ];
  const QR_WORD = { movie: ["movie", "movies"], tv: ["TV show", "TV shows"], anime: ["anime", "anime"] };

  // the Movies / TV / Anime switch: what's left of each (a kind with nothing left hides,
  // unless it's the one you're on)
  // what's left to rank of a kind, as cards (a franchise is one card)
  const qrUnits = (v) =>
    unitsOf(
      unranked(true)
        .filter((i) => !v || i.type === v)
        .map((i) => i.id),
      "pool"
    );

  function qrTypes() {
    const count = (v) => qrUnits(v).length;
    const shown = QR_TYPES.filter(([v]) => v && count(v)).length;
    const sw = qr.overlay.querySelector(".qr-types");
    sw.hidden = shown < 2 && !qr.type;
    sw.querySelectorAll("[data-qrtype]").forEach((b) => {
      const v = b.dataset.qrtype;
      const n = count(v);
      b.classList.toggle("active", v === qr.type);
      b.setAttribute("aria-selected", v === qr.type);
      b.hidden = !!v && !n && v !== qr.type;
      b.querySelector("small").textContent = n;
    });
  }

  // a new kind: the queue starts over with what's left of it (the tray follows along)
  function qrType(v) {
    if (v === qr.type) return;
    qr.type = v;
    typeSel.value = v;
    qr.queue = qrUnits(v);
    qrShow("right");
  }

  function quickRank() {
    if (!unranked(true).length) return toast("Nothing left to rank");
    // the tray's filter leaves nothing? Then start with everything
    if (!unranked(false).length) {
      typeSel.value = "";
      q.value = "";
    }
    const queue = unitsOf(
      unranked(false).map((i) => i.id),
      "pool"
    );
    if (!qr) {
      const overlay = Cards.makeOverlay(
        "qr-modal",
        `<div class="qr-top">
           <span class="xr-label"><i class="fa-solid fa-bolt"></i> Quick rank</span>
           <small class="qr-left"></small>
         </div>
         <div class="top10-switch qr-types" role="tablist" aria-label="Rank">${QR_TYPES.map(
           ([v, icon, label]) => `<button class="top10-tab" type="button" data-qrtype="${v}"><i class="fa-solid ${icon}"></i> ${label} <small></small></button>`
         ).join("")}</div>
         <div class="qr-stage"></div>
         <div class="qr-tiers">${TIERS.map(
           (t) => `<button class="qr-tier" type="button" data-qr="${t.id}" style="--tc:${t.color}"><b>${t.id}</b><small>${t.name}</small></button>`
         ).join("")}</div>
         <div class="qr-foot">
           <button class="btn qr-undo" type="button"><i class="fa-solid fa-rotate-left"></i> Undo</button>
           <button class="btn qr-skip" type="button">Skip <i class="fa-solid fa-forward"></i></button>
         </div>
         <p class="qr-keys">${touch ? "Tap a tier. Skip the ones you can't decide on yet." : "Keys: <kbd>S</kbd> <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> · <kbd>Space</kbd> skip · <kbd>Backspace</kbd> undo"}</p>`
      );
      qr = { overlay };
      overlay.addEventListener("click", (e) => {
        const b = e.target.closest("[data-qr]");
        if (b) return qrPlace(b.dataset.qr);
        const t = e.target.closest("[data-qrtype]");
        if (t) return qrType(t.dataset.qrtype);
        if (e.target.closest(".qr-skip")) return qrSkip();
        if (e.target.closest(".qr-undo")) return qrUndo();
        if (e.target.closest(".qr-apart")) return qrApart();
        if (e.target.closest(".qr-close")) return Cards.closeModal(overlay);
      });
      document.addEventListener("keydown", (e) => {
        if (!qr.overlay.classList.contains("active") || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toUpperCase();
        const byNum = { 1: "S", 2: "A", 3: "B", 4: "C", 5: "D" }[e.key];
        if (IDS.includes(k) || byNum) {
          e.preventDefault();
          qrPlace(byNum || k);
        } else if (e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          qrSkip();
        } else if (e.key === "Backspace" || e.key === "ArrowLeft") {
          e.preventDefault();
          qrUndo();
        }
      });
      overlay.onclose = () => {
        if (!unranked(false).length) typeSel.value = ""; // that kind is all ranked: the tray shows everything again
        render();
      };
    }
    qr.type = typeSel.value;
    qr.queue = queue;
    qr.done = [];
    qr.total = queue.length;
    qrShow();
    Cards.openModal(qr.overlay);
  }

  function qrShow(dir) {
    const stage = qr.overlay.querySelector(".qr-stage");
    const u = qr.queue[0];
    const item = u && Store.get(u.ids[0]);
    qr.overlay.querySelector(".qr-undo").disabled = !qr.done.length;
    qr.overlay.querySelector(".qr-skip").disabled = qr.queue.length < 2;
    qr.overlay.querySelector(".qr-tiers").hidden = !item;
    qr.overlay.querySelector(".qr-left").textContent = item ? `${qr.queue.length} left · ${qr.done.length} ranked` : "";
    qrTypes();
    if (!item) {
      const word = QR_WORD[qr.type];
      const others = qr.type ? unranked(true).length : 0;
      const placed = qr.done.reduce((n, d) => n + d.u.ids.length, 0);
      stage.innerHTML = `<div class="qr-done"><i class="fa-solid fa-trophy"></i><h3>${word ? `Every ${word[0]} ranked!` : "All ranked!"}</h3>
        <p>${placed} title${placed === 1 ? "" : "s"} placed.${others ? ` ${others} other title${others === 1 ? "" : "s"} still wait: pick them above.` : ""}</p>
        <button class="btn btn-primary qr-close" type="button">See the tiers</button></div>`;
      return;
    }
    if (u.ids.length > 1) return qrFranchise(u, stage, dir);
    const meta = [item.year, Store.TYPE_LABEL[item.type]].filter(Boolean).join(" · ");
    // your own score, so you know where it belongs: on the poster, and the tier it points to lights up
    const rated = item.rating != null;
    const hint = qrHint(item.rating);
    stage.innerHTML = `<div class="qr-card${dir ? ` from-${dir}` : ""}">
        <div class="qr-pwrap">
          <img class="qr-poster" src="${Store.poster(Cards.posterOf(item), "w342")}" alt="" />
          <span class="qr-score${rated ? "" : " unrated"}" title="My rating"><i class="fa-solid fa-star"></i>${rated ? Cards.formatRating(item.rating) : "–"}</span>
        </div>
        <h3>${esc(Lang.title(item))}</h3>
        <p>${esc(meta)}</p>
        <p class="qr-mine">${
          rated
            ? `You rated it <b>${Cards.formatRating(item.rating)}</b>/10 · by your score that's ${hint}`
            : `<i class="fa-regular fa-star"></i> You haven't rated this one yet`
        }</p>
      </div>`;
  }

  // the tier a score points to: it lights up, and comes back as the letter in its colour
  function qrHint(score) {
    const id = score != null ? tierFor(score) : null;
    qr.overlay.querySelectorAll(".qr-tier").forEach((b) => b.classList.toggle("suggest", b.dataset.qr === id));
    const t = id && TIERS.find((x) => x.id === id);
    return t ? `<b class="qr-hint" style="--tc:${t.color}">${id}</b>` : "";
  }

  // a franchise: its posters fanned out, every film with your score, the average's tier
  function qrFranchise(u, stage, dir) {
    const films = u.ids.map((id) => Store.get(id));
    const avg = avgOf(u.ids);
    const rated = films.filter((i) => i.rating != null).length;
    const years = films.map((i) => i.year).filter(Boolean);
    const span = years.length ? (Math.min(...years) === Math.max(...years) ? Math.min(...years) : `${Math.min(...years)}–${Math.max(...years)}`) : "";
    const hint = qrHint(avg != null ? Math.round(avg) : null); // (9.7 on average is a 10: S)
    const back = films.slice(1, 3);
    stage.innerHTML = `<div class="qr-card qr-fr${dir ? ` from-${dir}` : ""}">
        <div class="qr-pwrap qr-fan">
          ${back
            .map((i, n) => `<img class="qr-poster qr-back b${n + 1}" src="${Store.poster(Cards.posterOf(i), "w342")}" alt="" />`)
            .reverse()
            .join("")}
          <img class="qr-poster" src="${Store.poster(Cards.posterOf(films[0]), "w342")}" alt="" />
          <span class="qr-score${avg != null ? "" : " unrated"}" title="My average"><i class="fa-solid fa-star"></i>${avg != null ? Cards.formatRating(avg) : "–"}</span>
        </div>
        <span class="qr-frtag"><i class="fa-solid fa-layer-group"></i> Franchise · ${films.length} films</span>
        <h3>${esc(u.name)}</h3>
        <p>${esc(span)}</p>
        <ul class="qr-films">${films
          .map(
            (i) => `<li><span>${esc(Lang.title(i))}</span>${
              i.rating != null ? `<b><i class="fa-solid fa-star"></i> ${Cards.formatRating(i.rating)}</b>` : `<b class="none">–</b>`
            }</li>`
          )
          .join("")}</ul>
        <p class="qr-mine">${
          avg != null
            ? `Your average <b>${Cards.formatRating(avg)}</b>${rated < films.length ? ` (${rated} of ${films.length} rated)` : ""} · that's ${hint}`
            : `<i class="fa-regular fa-star"></i> You haven't rated these yet`
        }</p>
        <button class="qr-apart" type="button"><i class="fa-solid fa-scissors"></i> Rank them one by one</button>
      </div>`;
  }

  // this franchise, film by film (just this once: on the board they still stack when together)
  function qrApart() {
    const u = qr.queue[0];
    if (!u || u.ids.length < 2) return;
    qr.queue.splice(0, 1, ...u.ids.map((id) => ({ key: id, ids: [id] })));
    qrShow("right");
  }

  function qrPlace(tier) {
    const u = qr.queue.shift();
    if (!u) return;
    IDS.forEach((t) => (tiers[t] = tiers[t].filter((x) => !u.ids.includes(x))));
    tiers[tier].push(...u.ids);
    save();
    qr.done.push({ u, tier });
    // the tier you picked flashes
    const b = qr.overlay.querySelector(`[data-qr="${tier}"]`);
    b.classList.remove("hit");
    void b.offsetWidth;
    b.classList.add("hit");
    qrShow("right");
  }

  function qrSkip() {
    if (qr.queue.length < 2) return;
    qr.queue.push(qr.queue.shift());
    qrShow("right");
  }

  function qrUndo() {
    const last = qr.done.pop();
    if (!last) return;
    tiers[last.tier] = tiers[last.tier].filter((x) => !last.u.ids.includes(x));
    save();
    qr.queue.unshift(last.u);
    qrShow("left");
  }

  // your library changed (a title rated or removed, another tab / device): read the tiers again
  Store.onChange(() => {
    tiers = load();
    if (selected && !idsOf(selected).length) selected = null;
    render();
    loadFranchises(); // (a film just added: which franchise it's from)
  });

  render();
  loadFranchises();
})();
