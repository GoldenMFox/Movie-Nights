/*
 * Tier list: rank what you've watched from S to D, in the site's own style.
 *
 *  - Drag a poster into a tier (computers), or tap it and then a tier (phones).
 *  - The unranked titles sit in a tray fixed to the bottom of the screen, so every tier
 *    is in reach without scrolling up and down.
 *  - Quick rank: one poster at a time, tap S / A / B / C / D (or press the key), with
 *    Skip and Undo.
 *  - Fill from my ratings: 10 → S, 9 → A, 8 → B, 7 → C, below → D, with Undo.
 *
 * Only watched titles can be ranked: in your library, and not only on your Watchlist.
 * Saved with your account (Store.setTiers).
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
  const seen = (i) => i.rating != null || !!i.watchedAt || !i.watchlist;

  function load() {
    const t = Store.getTiers();
    const out = {};
    IDS.forEach((id) => (out[id] = (t[id] || []).filter((x) => Store.get(x))));
    return out;
  }
  let tiers = load();
  const save = () => Store.setTiers(tiers);
  const copy = (t) => JSON.parse(JSON.stringify(t));
  let selected = null; // the poster picked by a tap (phones)
  let landed = null; // the poster that just moved: it lands with a little pop

  document.querySelector(".tier-help").textContent = touch
    ? "Tap a poster, then tap a tier. Or use Quick rank to go through them one by one."
    : "Drag posters from the tray into a tier. Double-click a poster to open it. Or use Quick rank to go through them one by one.";

  root.innerHTML = `
    <div class="tl-actions">
      <button class="btn btn-primary tl-quick" type="button"><i class="fa-solid fa-bolt"></i> Quick rank</button>
      <button class="btn tl-fill" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i> Fill from my ratings</button>
      <button class="btn tl-clear" type="button"><i class="fa-solid fa-rotate-left"></i> Clear</button>
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

  function tile(item) {
    const cls = `tl-item${selected === item.id ? " selected" : ""}${landed === item.id ? " landed" : ""}`;
    const tip = `${Lang.title(item)}${item.year ? ` (${item.year})` : ""}${item.rating != null ? ` · ★ ${Cards.formatRating(item.rating)}` : ""}`;
    return `<button class="${cls}" type="button" draggable="true" data-id="${esc(item.id)}" title="${esc(tip)}">
      <img src="${Store.poster(Cards.posterOf(item), "w185")}" alt="${esc(Lang.title(item))}" loading="lazy" draggable="false" />
      <span class="tl-cap"><b>${esc(Lang.title(item))}</b>${item.rating != null ? `<small><i class="fa-solid fa-star"></i> ${Cards.formatRating(item.rating)}</small>` : ""}</span>
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
      const list = tiers[t.id].map((id) => Store.get(id)).filter(Boolean);
      root.querySelector(`.tl-drop[data-tier="${t.id}"]`).innerHTML = list.length
        ? list.map(tile).join("")
        : `<p class="tl-empty"><i class="fa-regular fa-hand-pointer"></i> ${touch ? "Pick a poster, then tap the letter" : "Drop titles here"}</p>`;
      root.querySelector(`.tl-row[data-tier="${t.id}"] .tl-count`).textContent = `${list.length} title${list.length === 1 ? "" : "s"}`;
    });

    const list = unranked(false);
    const total = unranked(true).length;
    pool.innerHTML = list.length
      ? list.slice(0, POOL_LIMIT).map(tile).join("")
      : `<p class="tl-empty">${total ? "Nothing matches your search." : "Everything you've watched is ranked. 🎉"}</p>`;
    $(".tl-left").textContent = total;
    $(".tl-more").textContent = list.length > POOL_LIMIT ? `Showing ${POOL_LIMIT} of ${list.length}: search to find the rest.` : "";
    $(".tl-quick").disabled = !total;

    // a poster picked (phones): the bar with the tiers, and the tiers light up
    root.classList.toggle("picking", !!selected);
    tray.classList.toggle("picking", !!selected);
    if (selected) {
      const item = Store.get(selected);
      $(".tl-pick-name").textContent = item ? `Move "${Lang.title(item)}" to` : "";
    }
    landed = null;
  }

  function move(id, target, beforeId) {
    IDS.forEach((t) => (tiers[t] = tiers[t].filter((x) => x !== id)));
    if (target !== "pool") {
      const list = tiers[target];
      const at = beforeId ? list.indexOf(beforeId) : -1;
      if (at >= 0) list.splice(at, 0, id);
      else list.push(id);
    }
    selected = null;
    landed = id;
    save();
    render();
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
      } else if (target === "open") location.href = `title.html?id=${encodeURIComponent(selected)}`;
      else move(selected, target);
      return;
    }
    if (e.target.closest(".tl-fold")) {
      const folded = tray.classList.toggle("folded");
      const b = $(".tl-fold");
      b.setAttribute("aria-label", folded ? "Show the tray" : "Hide the tray");
      b.title = b.getAttribute("aria-label");
      return;
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
    if (itemEl) location.href = `title.html?id=${encodeURIComponent(itemEl.dataset.id)}`;
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

  /* ---------- Quick rank: one poster at a time ---------- */

  let qr = null; // { overlay, queue: [ids], done: [{ id }], current }

  function quickRank() {
    const queue = unranked(false).map((i) => i.id);
    if (!queue.length) return toast("Nothing left to rank");
    if (!qr) {
      const overlay = Cards.makeOverlay(
        "qr-modal",
        `<div class="qr-top">
           <span class="xr-label"><i class="fa-solid fa-bolt"></i> Quick rank</span>
           <small class="qr-left"></small>
         </div>
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
        if (e.target.closest(".qr-skip")) return qrSkip();
        if (e.target.closest(".qr-undo")) return qrUndo();
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
      overlay.onclose = () => render();
    }
    qr.queue = queue;
    qr.done = [];
    qr.total = queue.length;
    qrShow();
    Cards.openModal(qr.overlay);
  }

  function qrShow(dir) {
    const stage = qr.overlay.querySelector(".qr-stage");
    const id = qr.queue[0];
    const item = id && Store.get(id);
    qr.overlay.querySelector(".qr-undo").disabled = !qr.done.length;
    qr.overlay.querySelector(".qr-skip").disabled = qr.queue.length < 2;
    qr.overlay.querySelector(".qr-tiers").hidden = !item;
    qr.overlay.querySelector(".qr-left").textContent = item ? `${qr.queue.length} left · ${qr.done.length} ranked` : "";
    if (!item) {
      stage.innerHTML = `<div class="qr-done"><i class="fa-solid fa-trophy"></i><h3>All ranked!</h3>
        <p>${qr.done.length} title${qr.done.length === 1 ? "" : "s"} placed.</p>
        <button class="btn btn-primary qr-close" type="button">See the tiers</button></div>`;
      return;
    }
    const meta = [item.year, Store.TYPE_LABEL[item.type], item.rating != null ? `★ ${Cards.formatRating(item.rating)}` : ""].filter(Boolean).join(" · ");
    stage.innerHTML = `<div class="qr-card${dir ? ` from-${dir}` : ""}">
        <img class="qr-poster" src="${Store.poster(Cards.posterOf(item), "w342")}" alt="" />
        <h3>${esc(Lang.title(item))}</h3>
        <p>${esc(meta)}</p>
      </div>`;
  }

  function qrPlace(tier) {
    const id = qr.queue.shift();
    if (!id) return;
    IDS.forEach((t) => (tiers[t] = tiers[t].filter((x) => x !== id)));
    tiers[tier].push(id);
    save();
    qr.done.push({ id, tier });
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
    tiers[last.tier] = tiers[last.tier].filter((x) => x !== last.id);
    save();
    qr.queue.unshift(last.id);
    qrShow("left");
  }

  // your library changed (a title rated or removed, another tab / device): read the tiers again
  Store.onChange(() => {
    tiers = load();
    if (selected && !Store.get(selected)) selected = null;
    render();
  });

  render();
})();
