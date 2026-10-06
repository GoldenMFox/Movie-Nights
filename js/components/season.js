/*
 * The site's seasonal look, on every page: Halloween, Christmas, Easter, Winter, Autumn.
 *
 * Its own look for a whole page (not the lists' atmospheres): the navbar tinted in the season's
 * colours with a line of them along its edge and one thing hanging from it (a spider on its
 * thread, a string of lights, a vine of blossom, icicles, a garland of leaves); behind the page, a
 * faint light in its corners and a few things drifting (embers, snow, petals, leaves), and now and
 * then something of the season's own (a bat crossing, mist drifting across, frost in the corners).
 * On a computer / tablet, the capsule holding the page links gets it too, drawn to its shape: blood
 * hanging from its underside and dripping at Halloween, snow resting on top at Christmas and in winter.
 * Everything sits behind the page's content (or over the capsule) and lets the clicks through.
 *
 *  - When: Halloween 1 Oct - 1 Nov, Christmas 1-26 Dec, Easter the week before Easter Sunday to
 *    Easter Monday (worked out each year), Winter 27 Dec - end of Feb, Autumn 22 Sep - 30 Nov
 *    (around Halloween). Spring and summer: the site's own look.
 *  - The owner decides for everyone (Admin → Overview's lock, or Atmosphere & themes): by the
 *    date, off, or one season locked on; how much of it (full, light: half as much drifting, calm:
 *    the colours and decoration only); the blood / snow on the navbar's capsule; which seasons "by
 *    the date" uses (themes.seasonsOff). Visitors don't have a switch.
 *  - Light on the device: only transform / opacity move, a few dozen small things at most (half on a
 *    phone), nothing in a hidden tab, nothing with "reduce motion" or the owner's "Animated
 *    atmosphere" off (the colours and the decoration stay).
 */
(function () {
  const SEASONS = {
    halloween: { label: "Halloween", parts: "ember", count: 28, extras: ["fog", "bat"], nav: "spider", pill: "blood" },
    christmas: { label: "Christmas", parts: "snow", count: 56, extras: [], nav: "lights", pill: "snow" },
    easter: { label: "Easter", parts: "petal", count: 26, extras: [], nav: "vine" },
    winter: { label: "Winter", parts: "snow", count: 44, extras: ["frost"], nav: "icicles", pill: "snow" },
    autumn: { label: "Autumn", parts: "leaf", count: 24, extras: [], nav: "leaves" },
  };

  // Easter Sunday (Gregorian calendar)
  function easterOf(y) {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
    const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
  }
  // the seasons a day falls in, the first one first (Halloween before Autumn)
  function seasonsOn(now) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const e = easterOf(day.getFullYear());
    const from = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 7);
    const to = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    const md = (day.getMonth() + 1) * 100 + day.getDate();
    return [
      ["easter", day >= from && day <= to],
      ["halloween", md >= 1001 && md <= 1101],
      ["christmas", md >= 1201 && md <= 1226],
      ["winter", md >= 1227 || md <= 229],
      ["autumn", md >= 922 && md <= 1130],
    ]
      .filter((x) => x[1])
      .map((x) => x[0]);
  }
  const themes = () => (window.Site && Site.get().themes) || {};
  // the season a day falls in, or "" (leaving out the ones the owner switched off: skip)
  function byDate(now, skip) {
    const off = skip || themes().seasonsOff || [];
    return seasonsOn(now).find((id) => !off.includes(id)) || "";
  }
  // the next day a season starts (by the date, from tomorrow): { id, at }
  function next(now) {
    let prev = byDate(now);
    for (let i = 1; i <= 366; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const id = byDate(d);
      if (id && id !== prev) return { id, at: d };
      prev = id;
    }
    return null;
  }
  // what the owner set: "auto" (by the date), "off", or one season
  function current() {
    const set = themes().season || "auto";
    if (set === "off") return "";
    if (SEASONS[set]) return set;
    return byDate(new Date());
  }
  const motionOk = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !(window.Site && Site.get().themes.animations === false);
  const phone = () => window.matchMedia("(max-width: 700px)").matches;

  // the drifting things: a fixed pattern (the same on every visit)
  function drifting(kind, n) {
    let x = 17;
    const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: n }, () => {
      const v = [`--x:${(rnd() * 100).toFixed(1)}%`, `--d:${(-rnd() * 30).toFixed(1)}s`, `--t:${(16 + rnd() * 18).toFixed(1)}s`, `--s:${(0.6 + rnd() * 0.9).toFixed(2)}`, `--dx:${((rnd() - 0.5) * 120).toFixed(0)}px`, `--sw:${(10 + rnd() * 30).toFixed(0)}px`, `--st:${(3 + rnd() * 4).toFixed(1)}s`];
      return `<i style="${v.join(";")}"></i>`;
    }).join("");
  }

  const EXTRA = {
    fog: '<b class="ss-fog"></b><b class="ss-fog two"></b><b class="ss-fog three"></b>',
    bat: '<b class="ss-bat"><i></i></b><b class="ss-bat two"><i></i></b>',
    frost: '<b class="ss-frost"></b>',
  };
  const NAV = {
    spider: '<b class="ss-spider"><i></i></b>',
    lights: '<b class="ss-lights"></b>',
    vine: '<b class="ss-vine"></b>',
    icicles: '<b class="ss-icicles"></b>',
    leaves: '<b class="ss-leafline"></b>',
  };

  /* ---- the capsule of page links (computer / tablet): blood or snow drawn to its exact shape ---- */

  const n1 = (v) => Math.round(v * 10) / 10;
  const smax = (a, b, k) => (a + b + Math.sqrt((a - b) ** 2 + k * k)) / 2;
  const smin = (a, b, k) => (a + b - Math.sqrt((a - b) ** 2 + k * k)) / 2;

  // the capsule's top edge (y at x), its bottom edge, and how flat it is there (1 flat .. 0 upright)
  function capsule(W, H) {
    const r = H / 2;
    const off = (x) => (x < r ? r - x : x > W - r ? x - (W - r) : 0);
    const top = (x) => r - Math.sqrt(Math.max(0, r * r - off(x) ** 2));
    const flat = (x) => Math.sqrt(Math.max(0, 1 - (off(x) / r) ** 2));
    return { r, top, flat, bottom: (x) => H - top(x) };
  }
  // the spaces between the links' words (where blood can run down without covering them)
  function gaps(ul) {
    const box = ul.getBoundingClientRect();
    const words = [...ul.querySelectorAll("li > a")]
      .filter((a) => a.offsetWidth)
      .map((a) => {
        const rg = document.createRange();
        rg.selectNodeContents(a);
        const r = rg.getBoundingClientRect();
        return [r.left - box.left, r.right - box.left];
      });
    const out = [];
    for (let i = 1; i < words.length; i++) out.push({ x: (words[i - 1][1] + words[i][0]) / 2, w: words[i][0] - words[i - 1][1] });
    return out;
  }
  const seeded = (seed) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

  function bloodSvg(W, H) {
    const { r, top, bottom } = capsule(W, H);
    const rnd = seeded(31);
    const ph = [rnd() * 6.28, rnd() * 6.28];
    const sags = Array.from({ length: Math.max(3, Math.round(W / 140)) }, () => [rnd() * W, 14 + rnd() * 24, 0.6 + rnd() * 1.2]);
    // how far up the blood reaches from the bottom edge: a thin coat, heavier where it pools, climbing
    // the rounded ends a little
    const coat = (x) => {
      let t = 2.6 + 0.5 * Math.sin(x / 37 + ph[0]) + 0.3 * Math.sin(x / 11 + ph[1]);
      for (const [cx, hw, d] of sags) t += d * Math.exp(-(((x - cx) / hw) ** 2) * 2.2);
      t += Math.max(0, r - x, x - (W - r)) * 0.35;
      return smax(bottom(x) - t, top(x) + 3, 1.5);
    };
    // hanging under it: three long drips where the drops gather and fall, and shorter ones between
    const drips = [0.17, 0.52, 0.84].map((f, i) => ({ x: W * f + (rnd() - 0.5) * 30, hw: 3.4 + rnd() * 0.8, len: [15, 11, 18][i], drop: true }));
    for (let x = r * 0.5 + rnd() * 20; x < W - r * 0.4; x += 34 + rnd() * 46) {
      if (drips.some((d) => Math.abs(d.x - x) < 16)) continue;
      drips.push({ x, hw: 2.2 + rnd() * 1.6, len: 2.5 + rnd() * (rnd() < 0.35 ? 9 : 4) });
    }
    const edge = (x) => {
      let y = bottom(x) + 0.8;
      for (const d of drips) {
        const t = Math.abs(x - d.x) / d.hw;
        if (t >= 1.6) continue;
        const body = t < 1 ? d.len * (1 - t ** 2.4) ** (1 / 2.4) : -3 * (t - 1);
        y = smax(y, bottom(d.x) + body, 2.2);
      }
      return y;
    };
    const pts = [];
    for (let x = 0; x <= W; x += 0.5) pts.push(`${n1(x)} ${n1(coat(x))}`);
    for (let x = W; x >= 0; x -= 0.5) pts.push(`${n1(x)} ${n1(edge(x))}`);
    let shine = "";
    for (let x = r * 0.8; x <= W - r * 0.8; x += 4) shine += `${shine ? "L" : "M"}${n1(x)} ${n1(coat(x) + 1.1)}`;
    let streaks = "";
    drips
      .filter((d) => d.len > 8)
      .forEach((d) => {
        const b = bottom(d.x);
        const x0 = d.x - d.hw * 0.32;
        streaks += `M${n1(x0)} ${n1(b)} C${n1(x0 + 0.2)} ${n1(b + d.len * 0.4)} ${n1(x0 + 0.6)} ${n1(b + d.len * 0.7)} ${n1(d.x - d.hw * 0.12)} ${n1(b + d.len - 2.4)}`;
      });
    const svg =
      `<svg width="${W + 4}" height="${H + 40}" viewBox="-2 -4 ${W + 4} ${H + 40}" style="left:-2px;top:-4px">` +
      `<defs><linearGradient id="ss-pb" gradientUnits="userSpaceOnUse" x1="0" y1="${H - 8}" x2="0" y2="${H + 20}">` +
      '<stop offset="0" stop-color="#b8121d"/><stop offset="0.3" stop-color="#9a0a15"/><stop offset="0.75" stop-color="#830812"/><stop offset="1" stop-color="#70060e"/></linearGradient></defs>' +
      `<path d="M${pts.join(" L")} Z" fill="url(#ss-pb)"/>` +
      `<path d="${shine}" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="0.9" stroke-linecap="round"/>` +
      `<path d="${streaks}" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="0.9" stroke-linecap="round"/></svg>`;
    const drops = drips
      .filter((d) => d.drop)
      .map((d, i) => `<b class="ss-pill-drop" style="left:${n1(d.x)}px;top:${n1(bottom(d.x) + d.len - 6)}px;animation-delay:${-i * 3.1}s;animation-duration:${8 + i * 1.5}s"></b>`)
      .join("");
    return svg + drops;
  }

  function snowSvg(W, H, gs) {
    const { r, top, flat } = capsule(W, H);
    const rnd = seeded(53);
    const ph = [rnd() * 6.28, rnd() * 6.28];
    const heaps = [];
    for (let x = rnd() * 30; x < W; x += 24 + rnd() * 34) heaps.push([x, 12 + rnd() * 22, 1 + rnd() * 2.6]);
    const hangs = [];
    for (let x = 10 + rnd() * 30; x < W; x += 30 + rnd() * 50) hangs.push([x, 7 + rnd() * 12, 1.5 + rnd() * 3]);
    // how deep it lies on top (thinning where the ends curve away) and how far it droops over the edge
    const deep = (x) => {
      let h = 4.6 + 0.6 * Math.sin(x / 29 + ph[0]) + 0.3 * Math.sin(x / 9 + ph[1]);
      for (const [cx, hw, d] of heaps) h += d * Math.exp(-(((x - cx) / hw) ** 2) * 2.4);
      return h * flat(x) ** 1.6;
    };
    const droop = (x) => {
      let o = 1.6;
      for (const [cx, hw, d] of hangs) o = smax(o, 1.6 + d * Math.exp(-(((x - cx) / hw) ** 2) * 2.6), 1);
      return o * flat(x) ** 1.2;
    };
    const up = [];
    const down = [];
    for (let x = 0; x <= W; x += 0.5) {
      up.push(`${n1(x)} ${n1(top(x) - deep(x))}`);
      down.push(`${n1(x)} ${n1(top(x) + droop(x))}`);
    }
    const svg =
      `<svg width="${W + 4}" height="${H + 24}" viewBox="-2 -14 ${W + 4} ${H + 24}" style="left:-2px;top:-14px">` +
      '<defs><linearGradient id="ss-ps" gradientUnits="userSpaceOnUse" x1="0" y1="-9" x2="0" y2="7">' +
      '<stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f2f6fc"/><stop offset="1" stop-color="#c4d3e8"/></linearGradient></defs>' +
      `<path d="M${up.join(" L")} L${down.reverse().join(" L")} Z" fill="url(#ss-ps)"/></svg>`;
    // clumps sliding off the two ends, and one dropping from a gap in the middle
    const from = [r * 0.55, W - r * 0.5];
    if (gs.length) from.push(gs[Math.floor(gs.length / 2)].x);
    const puffs = from
      .map((x, i) => `<b class="ss-pill-puff" style="left:${n1(x)}px;top:${n1(top(x) - 2)}px;animation-delay:${-i * 4.3}s;animation-duration:${12 + i * 2.5}s"></b>`)
      .join("");
    return svg + puffs;
  }

  let drawn = "";
  function drawPill() {
    const li = document.querySelector(".season-pill");
    if (!li) return;
    if (getComputedStyle(li).display === "none") {
      drawn = "";
      li.innerHTML = "";
      return;
    }
    const ul = li.parentElement;
    const W = ul.offsetWidth;
    const H = ul.offsetHeight;
    const gs = gaps(ul);
    const sig = [li.dataset.k, W, H, gs.map((g) => Math.round(g.x)).join(",")].join("|");
    if (sig === drawn || !W || !H) return;
    drawn = sig;
    Object.assign(li.style, { left: "-1px", top: "-1px", width: `${W}px`, height: `${H}px` });
    li.innerHTML = li.dataset.k === "blood" ? bloodSvg(W, H) : snowSvg(W, H, gs);
  }
  let pillWatch = null;
  function pill(kind) {
    document.querySelectorAll(".season-pill").forEach((el) => el.remove());
    drawn = "";
    const ul = document.querySelector(".site-nav .nav-links");
    if (!kind || !ul) return;
    const li = document.createElement("li");
    li.className = "season-pill";
    li.dataset.k = kind;
    li.setAttribute("aria-hidden", "true");
    ul.append(li);
    // drawn again when the capsule changes size (window resized, the font arrives)
    if (!pillWatch && window.ResizeObserver) {
      pillWatch = new ResizeObserver(drawPill);
      pillWatch.observe(ul);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ((drawn = ""), drawPill()));
    }
    drawPill();
  }

  let shown = "";
  function apply() {
    const id = current();
    const t = themes();
    const level = ["light", "calm"].includes(t.seasonLevel) ? t.seasonLevel : "full";
    const sig = id && [id, level, t.seasonPill !== false].join("|");
    const html = document.documentElement;
    if (sig === shown && (!id || document.querySelector(".season-bg"))) return play();
    shown = sig;
    document.querySelectorAll(".season-bg, .season-nav").forEach((el) => el.remove());
    pill(id && t.seasonPill !== false && SEASONS[id].pill);
    if (!id) {
      delete html.dataset.season;
      html.classList.remove("season-play");
      return;
    }
    const s = SEASONS[id];
    html.dataset.season = id;
    const bg = document.createElement("div");
    bg.className = "season-bg";
    bg.setAttribute("aria-hidden", "true");
    // (light: half as many things drifting · calm: none, nor the season's extras)
    const n = level === "calm" ? 0 : Math.round(s.count * (phone() ? 0.5 : 1) * (level === "light" ? 0.5 : 1));
    bg.innerHTML = `${level === "calm" ? "" : s.extras.map((x) => EXTRA[x]).join("")}<span class="ss-parts" data-k="${s.parts}">${drifting(s.parts, n)}</span>`;
    document.body.append(bg);
    const nav = document.querySelector(".site-nav");
    if (nav) {
      const deco = document.createElement("div");
      deco.className = "season-nav";
      deco.setAttribute("aria-hidden", "true");
      deco.innerHTML = NAV[s.nav] || "";
      nav.prepend(deco);
    }
    play();
  }
  // moving only while it can be seen, and when nothing asks for stillness
  function play() {
    document.documentElement.classList.toggle("season-play", !!shown && motionOk() && document.visibilityState !== "hidden");
  }

  const start = () => {
    apply();
    if (window.Site && Site.onChange) Site.onChange(apply);
    document.addEventListener("visibilitychange", play);
    // (a different season starts at midnight while the page is open)
    setInterval(apply, 30 * 60 * 1000);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.Season = { SEASONS, current, byDate, seasonsOn, next, easterOf, refresh: apply };
})();
