/*
 * List themes: a look for each of your own lists (Watchlist page): Halloween, Christmas,
 * Winter, Spring, Summer, Film noir, Space.
 *
 *  - Each theme is a tint, a small emblem before the list's name, and a quiet atmosphere behind
 *    its posters (falling snow, drifting petals, embers and fog, twinkling stars…), drawn by CSS
 *    (css/style.css: "List themes"): only transform and opacity move, which the graphics chip
 *    does on its own.
 *  - The atmosphere only plays while that list is on screen, and at most two at once; never with
 *    "reduce motion" on, for a list whose animation is off (the theme pop-up), or when the owner
 *    turned list animations off for everyone (Admin → Themes). The tint stays either way.
 *  - A new list whose name says it ("Halloween marathon", "Xmas movies") starts with that theme.
 *  - A new theme: add it to THEMES here and give it a block in the CSS.
 * Saved on the list (theme, fx), so it follows your account.
 */
(function () {
  const THEMES = [
    { id: "halloween", label: "Halloween", emoji: "🎃", hint: "Embers, fog and autumn tones", words: /hallowe+n|spooky|scary|horror|fright|pumpkin|october/i },
    { id: "christmas", label: "Christmas", emoji: "🎄", hint: "Snowfall and festive accents", words: /christmas|xmas|x-mas|holiday|festive|noel|santa/i },
    { id: "winter", label: "Winter", emoji: "❄️", hint: "Frost and gentle snow", words: /winter|snow|cozy|cosy|frost|ice/i },
    { id: "spring", label: "Spring", emoji: "🌸", hint: "Drifting petals, fresh greens", words: /spring|blossom|bloom|easter|flower/i },
    { id: "summer", label: "Summer", emoji: "☀️", hint: "Warm light and sunlit motes", words: /summer|beach|sun|vacation|holiday road|road trip/i },
    { id: "noir", label: "Film noir", emoji: "🎬", hint: "Black and white, film grain", words: /noir|classic|black and white|detective/i },
    { id: "space", label: "Space", emoji: "🚀", hint: "A slow field of stars", words: /space|sci-?fi|galaxy|star wars|cosmic|alien/i },
  ];
  const byId = (id) => THEMES.find((t) => t.id === id) || null;
  // the themes the owner offers (Admin → Themes)
  const offered = () => {
    const allowed = window.Site ? Site.get().themes.available : null;
    return THEMES.filter((t) => !Array.isArray(allowed) || allowed.includes(t.id));
  };
  const enabled = () => !window.Site || (Site.feature("listThemes") && Site.get().themes.listThemes !== false);
  const motionOk = () =>
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !(window.Site && Site.get().themes.animations === false);

  // a theme from a new list's name, or null
  const suggest = (name) => {
    if (!enabled()) return null;
    const t = offered().find((x) => x.words.test(String(name || "")));
    return t ? t.id : null;
  };

  /* ---------------- the atmosphere: particles, placed the same way every time ---------------- */

  // (a fixed pattern per theme, not random: the row looks the same on every visit)
  function particles(n, seed) {
    let x = seed;
    const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: n }, () => {
      const left = (rnd() * 100).toFixed(1);
      const delay = (-rnd() * 14).toFixed(2);
      const dur = (9 + rnd() * 9).toFixed(2);
      const size = (0.6 + rnd() * 0.9).toFixed(2);
      const drift = ((rnd() - 0.5) * 60).toFixed(0);
      return `<i style="--x:${left}%;--d:${delay}s;--t:${dur}s;--s:${size};--dx:${drift}px"></i>`;
    }).join("");
  }
  const COUNT = { halloween: 12, christmas: 22, winter: 18, spring: 14, summer: 12, noir: 0, space: 26 };

  function fxLayer(theme) {
    const phone = window.matchMedia("(max-width: 700px)").matches;
    const n = Math.round((COUNT[theme] || 0) * (phone ? 0.55 : 1));
    return `<span class="lt-fx" aria-hidden="true">${theme === "halloween" ? '<b class="lt-fog"></b><b class="lt-fog two"></b>' : ""}${
      theme === "summer" ? '<b class="lt-sun"></b>' : ""
    }${theme === "noir" ? '<b class="lt-grain"></b>' : ""}${theme === "winter" ? '<b class="lt-frost"></b>' : ""}<span class="lt-parts">${particles(n, theme.length * 97)}</span></span>`;
  }

  /* ---------------- dressing a list's section ---------------- */

  // only the lists on screen play (two at most); the others keep their tint, standing still
  const playing = new Set();
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              const el = en.target;
              if (en.isIntersecting && playing.size < 2 && el.dataset.fx === "1" && motionOk()) {
                playing.add(el);
                el.classList.add("lt-play");
              } else if (!en.isIntersecting) {
                playing.delete(el);
                el.classList.remove("lt-play");
              }
            }),
          { rootMargin: "60px" }
        )
      : null;

  // sec: the list's section; list: { theme, fx }
  function apply(sec, list) {
    const theme = enabled() && list && byId(list.theme) ? list.theme : "";
    const fx = theme && list.fx !== false && COUNT[theme] !== undefined;
    if (sec.dataset.theme === theme && sec.dataset.fx === (fx ? "1" : "0")) return;
    sec.dataset.theme = theme;
    sec.dataset.fx = fx ? "1" : "0";
    sec.classList.toggle("lt", !!theme);
    const old = sec.querySelector(":scope > .lt-fx");
    if (old) old.remove();
    const emblem = sec.querySelector(".lt-emblem");
    if (emblem) emblem.remove();
    playing.delete(sec);
    sec.classList.remove("lt-play");
    if (io) io.unobserve(sec);
    if (!theme) return;
    sec.insertAdjacentHTML("afterbegin", fxLayer(theme));
    const h2 = sec.querySelector("h2, .wl-title");
    if (h2) h2.insertAdjacentHTML("afterbegin", `<span class="lt-emblem" aria-hidden="true">${byId(theme).emoji}</span>`);
    if (fx && io) io.observe(sec);
  }

  /* ---------------- the theme pop-up ---------------- */

  let overlay = null;
  function picker(listId) {
    const list = Store.lists().find((l) => l.id === listId);
    if (!list) return;
    if (!overlay) overlay = Cards.makeOverlay("lt-modal", '<div class="lt-in"></div>');
    let theme = list.theme || "";
    let fx = list.fx !== false;
    const draw = () => {
      overlay.querySelector(".lt-in").innerHTML = `
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i> A theme for “${UI.esc(list.name)}”</h3>
        <div class="lt-grid" role="radiogroup" aria-label="Theme">
          <button type="button" class="lt-opt${!theme ? " on" : ""}" role="radio" aria-checked="${!theme}" data-theme-pick="">
            <span class="lt-swatch none"><i class="fa-solid fa-ban"></i></span><b>No theme</b><small>The site's own look</small></button>
          ${offered()
            .map(
              (t) => `<button type="button" class="lt-opt${theme === t.id ? " on" : ""}" role="radio" aria-checked="${theme === t.id}" data-theme-pick="${t.id}">
                <span class="lt-swatch" data-theme="${t.id}"><span>${t.emoji}</span></span><b>${UI.esc(t.label)}</b><small>${UI.esc(t.hint)}</small></button>`
            )
            .join("")}
        </div>
        <label class="menu-switch lt-anim${!theme ? " off" : ""}">
          <i class="fa-solid fa-snowflake"></i><span>Animated atmosphere<small>${motionOk() ? "Plays only while the list is on screen" : "Off: reduce motion is on, or animations are off for the site"}</small></span>
          <input type="checkbox" class="lt-fx-switch"${fx ? " checked" : ""}${!theme || !motionOk() ? " disabled" : ""} />
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>
        <div class="lt-actions"><button type="button" class="btn lt-cancel">Cancel</button><button type="button" class="btn btn-primary lt-save">Save</button></div>`;
    };
    draw();
    overlay.onclick = (e) => {
      const opt = e.target.closest("[data-theme-pick]");
      if (opt) {
        theme = opt.dataset.themePick;
        draw();
      }
      if (e.target.closest(".lt-cancel")) Cards.closeModal(overlay);
      if (e.target.closest(".lt-save")) {
        Store.setListTheme(listId, theme, fx);
        Cards.closeModal(overlay);
        UI.toast(theme ? `${byId(theme).label} theme on “${list.name}”` : "Theme removed");
      }
    };
    overlay.onchange = (e) => {
      if (e.target.classList.contains("lt-fx-switch")) fx = e.target.checked;
    };
    Cards.openModal(overlay);
  }

  window.ListThemes = { THEMES, offered, enabled, suggest, apply, picker };
})();
