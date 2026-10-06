/*
 * The site's seasonal look, on every page: Halloween, Christmas, Easter, Winter, Autumn.
 *
 * Its own look for a whole page (not the lists' atmospheres): the navbar tinted in the season's
 * colours with a line of them along its edge and one thing hanging from it (a spider on its
 * thread, a string of lights, a vine of blossom, icicles, a garland of leaves); behind the page, a
 * faint light in its corners and a few things drifting (embers, snow, petals, leaves), and now and
 * then something of the season's own (a bat crossing, mist drifting across, frost in the corners).
 * Everything sits behind the page's content and lets the clicks through.
 *
 *  - When: Halloween 1 Oct - 1 Nov, Christmas 1-26 Dec, Easter the week before Easter Sunday to
 *    Easter Monday (worked out each year), Winter 27 Dec - end of Feb, Autumn 22 Sep - 30 Nov
 *    (around Halloween). Spring and summer: the site's own look.
 *  - The owner decides for everyone (Admin → Themes → Seasonal look): by the date, off, or one
 *    season all the time (to see it). Visitors don't have a switch.
 *  - Light on the device: only transform / opacity move, a few dozen small things at most (half on a
 *    phone), nothing in a hidden tab, nothing with "reduce motion" or the owner's "Animated
 *    atmosphere" off (the colours and the decoration stay).
 */
(function () {
  const SEASONS = {
    halloween: { label: "Halloween", parts: "ember", count: 28, extras: ["fog", "bat"], nav: "spider" },
    christmas: { label: "Christmas", parts: "snow", count: 56, extras: [], nav: "lights" },
    easter: { label: "Easter", parts: "petal", count: 26, extras: [], nav: "vine" },
    winter: { label: "Winter", parts: "snow", count: 44, extras: ["frost"], nav: "icicles" },
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
  // the season a day falls in, or ""
  function byDate(now) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const e = easterOf(day.getFullYear());
    const from = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 7);
    const to = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    if (day >= from && day <= to) return "easter";
    const md = (day.getMonth() + 1) * 100 + day.getDate();
    if (md >= 1001 && md <= 1101) return "halloween";
    if (md >= 1201 && md <= 1226) return "christmas";
    if (md >= 1227 || md <= 229) return "winter";
    if (md >= 922 && md <= 1130) return "autumn";
    return "";
  }
  // what the owner set: "auto" (by the date), "off", or one season
  function current() {
    const set = (window.Site && Site.get().themes && Site.get().themes.season) || "auto";
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
    spider: '<b class="ss-blood"></b><b class="ss-blood-drop"></b><b class="ss-blood-drop"></b><b class="ss-blood-drop"></b><b class="ss-spider"><i></i></b>',
    lights: '<b class="ss-snowedge"></b><b class="ss-snow-puff"></b><b class="ss-snow-puff"></b><b class="ss-snow-puff"></b><b class="ss-lights"></b>',
    vine: '<b class="ss-vine"></b>',
    icicles: '<b class="ss-snowedge"></b><b class="ss-snow-puff"></b><b class="ss-snow-puff"></b><b class="ss-snow-puff"></b><b class="ss-icicles"></b>',
    leaves: '<b class="ss-leafline"></b>',
  };

  let shown = "";
  function apply() {
    const id = current();
    const html = document.documentElement;
    if (id === shown && (!id || document.querySelector(".season-bg"))) return play();
    shown = id;
    document.querySelectorAll(".season-bg, .season-nav").forEach((el) => el.remove());
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
    bg.innerHTML = `${s.extras.map((x) => EXTRA[x]).join("")}<span class="ss-parts" data-k="${s.parts}">${drifting(s.parts, Math.round(s.count * (phone() ? 0.5 : 1)))}</span>`;
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

  window.Season = { SEASONS, current, byDate, easterOf, refresh: apply };
})();
