/*
 * Tier list: drag posters into S / A / B / C / D (or tap a poster, then tap a
 * tier on phones). Saved automatically in the browser.
 */
(function () {
  const { esc, toast } = UI;
  const TIERS = [
    { id: "S", color: "#ff7f7f" },
    { id: "A", color: "#ffbf7f" },
    { id: "B", color: "#ffdf7f" },
    { id: "C", color: "#ffff7f" },
    { id: "D", color: "#bfff7f" },
  ];
  const POOL_LIMIT = 200;

  const root = document.getElementById("tier-app");
  const tiers = Store.getTiers();
  TIERS.forEach((t) => (tiers[t.id] = (tiers[t.id] || []).filter((id) => Store.get(id))));
  let selected = null;

  root.innerHTML = `
    <div class="tier-board">
      ${TIERS.map(
        (t) => `<div class="tier-row">
          <div class="tier-label" style="background:${t.color}" data-tier="${t.id}" title="Move selected poster here">${t.id}</div>
          <div class="tier-drop" data-tier="${t.id}"></div>
        </div>`
      ).join("")}
    </div>
    <div class="tier-pool-wrap">
      <div class="toolbar">
        <label class="field grow">Find a title <input class="input" type="search" name="q" placeholder="Title..." /></label>
        <label class="field">Show
          <select class="select" name="type">
            <option value="">Everything</option><option value="movie">Movies</option><option value="tv">TV Shows</option><option value="anime">Anime</option>
          </select>
        </label>
        <label class="field">Order
          <select class="select" name="order">
            <option value="rating">My rating</option><option value="title">Title A-Z</option><option value="year">Newest</option>
          </select>
        </label>
        <button class="btn clear-all" type="button"><i class="fa-solid fa-rotate-left"></i> Clear tiers</button>
      </div>
      <p class="result-count pool-count"></p>
      <div class="tier-pool" data-tier="pool"></div>
    </div>
    <div class="tier-selected-bar" aria-live="polite">
      <span class="sel-name"></span>
      ${TIERS.map((t) => `<button class="btn" data-move="${t.id}">${t.id}</button>`).join("")}
      <button class="btn" data-move="pool">Unrank</button>
      <button class="btn" data-move="open">Open</button>
      <button class="btn" data-move="cancel">Cancel</button>
    </div>`;

  const pool = root.querySelector(".tier-pool");
  const bar = root.querySelector(".tier-selected-bar");
  const q = root.querySelector('[name="q"]');
  const typeSel = root.querySelector('[name="type"]');
  const orderSel = root.querySelector('[name="order"]');

  function tile(item) {
    return `<button class="tier-item${selected === item.id ? " selected" : ""}" draggable="true" data-id="${esc(item.id)}"
      title="${esc(Lang.title(item))} (${item.year})${item.rating != null ? " · ★ " + item.rating : ""}">
      <img src="${Store.poster(item.poster, "w154")}" alt="${esc(Lang.title(item))}" loading="lazy" /></button>`;
  }

  function render() {
    TIERS.forEach((t) => {
      root.querySelector(`.tier-drop[data-tier="${t.id}"]`).innerHTML = tiers[t.id].map((id) => tile(Store.get(id))).join("");
    });

    const inTier = new Set(TIERS.flatMap((t) => tiers[t.id]));
    const term = q.value.trim().toLowerCase();
    const sorters = {
      rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.order - b.order,
      title: (a, b) => Lang.title(a).localeCompare(Lang.title(b)),
      year: (a, b) => b.year - a.year,
    };
    const list = Store.all()
      .filter((i) => !inTier.has(i.id))
      .filter((i) => !typeSel.value || i.type === typeSel.value)
      .filter((i) => !term || Lang.matches(i, term))
      .sort(sorters[orderSel.value]);
    pool.innerHTML = list.slice(0, POOL_LIMIT).map(tile).join("");
    root.querySelector(".pool-count").textContent =
      list.length > POOL_LIMIT ? `Unranked: showing ${POOL_LIMIT} of ${list.length}. Use the search to find the rest.` : `Unranked: ${list.length}`;

    bar.classList.toggle("show", !!selected);
    if (selected) root.querySelector(".sel-name").textContent = `Move "${Store.get(selected).title}" to:`;
  }

  function move(id, target, beforeId) {
    TIERS.forEach((t) => (tiers[t.id] = tiers[t.id].filter((x) => x !== id)));
    if (target !== "pool") {
      const list = tiers[target];
      const at = beforeId ? list.indexOf(beforeId) : -1;
      if (at >= 0) list.splice(at, 0, id);
      else list.push(id);
    }
    selected = null;
    Store.setTiers(tiers);
    render();
  }

  /* ---------- drag & drop ---------- */

  let dragId = null;
  root.addEventListener("dragstart", (e) => {
    const el = e.target.closest(".tier-item");
    if (!el) return;
    dragId = el.dataset.id;
    el.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  root.addEventListener("dragend", (e) => {
    const el = e.target.closest(".tier-item");
    if (el) el.classList.remove("dragging");
    root.querySelectorAll(".drag-over").forEach((z) => z.classList.remove("drag-over"));
  });
  root.addEventListener("dragover", (e) => {
    const zone = e.target.closest(".tier-drop, .tier-pool, .tier-label");
    if (!zone || !dragId) return;
    e.preventDefault();
    root.querySelectorAll(".drag-over").forEach((z) => z !== zone && z.classList.remove("drag-over"));
    zone.classList.add("drag-over");
  });
  root.addEventListener("drop", (e) => {
    const zone = e.target.closest(".tier-drop, .tier-pool, .tier-label");
    if (!zone || !dragId) return;
    e.preventDefault();
    const before = e.target.closest(".tier-drop .tier-item");
    move(dragId, zone.dataset.tier, before && before.dataset.id !== dragId ? before.dataset.id : null);
    dragId = null;
  });

  /* ---------- tap to select (phones) ---------- */

  root.addEventListener("click", (e) => {
    const itemEl = e.target.closest(".tier-item");
    if (itemEl) {
      selected = selected === itemEl.dataset.id ? null : itemEl.dataset.id;
      render();
      return;
    }
    const label = e.target.closest(".tier-label");
    if (label && selected) return move(selected, label.dataset.tier);

    const btn = e.target.closest("[data-move]");
    if (btn) {
      const target = btn.dataset.move;
      if (target === "cancel") {
        selected = null;
        render();
      } else if (target === "open") {
        location.href = `title.html?id=${encodeURIComponent(selected)}`;
      } else {
        move(selected, target);
      }
    }

    if (e.target.closest(".clear-all")) {
      if (!confirm("Move every poster back to unranked?")) return;
      TIERS.forEach((t) => (tiers[t.id] = []));
      Store.setTiers(tiers);
      render();
      toast("Tier list cleared");
    }
  });

  root.addEventListener("dblclick", (e) => {
    const itemEl = e.target.closest(".tier-item");
    if (itemEl) location.href = `title.html?id=${encodeURIComponent(itemEl.dataset.id)}`;
  });

  let typing;
  q.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(render, 150);
  });
  typeSel.addEventListener("change", render);
  orderSel.addEventListener("change", render);

  render();
})();
