/*
 * Custom scrollbars for the sideways rows (posters, cast, videos / images), computers only.
 *
 * Browsers always show the plain arrow cursor over their own scrollbars, so these rows
 * hide the built-in bar and get a slim one of our own under them instead: same look,
 * but with the hand cursor. Drag it, or click anywhere along it to jump there.
 * Phones keep swiping as usual.
 */
(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const ROWS = ".movie-row, .t-cast, .t-media-row, .t-seasons";
  document.documentElement.classList.add("custom-scrollbars");

  // glide a row towards a position (eases in over a few frames instead of jumping)
  function glideTo(row, x) {
    const max = row.scrollWidth - row.clientWidth;
    row._target = Math.min(Math.max(x, 0), max);
    if (row._gliding) return;
    row._gliding = true;
    const step = () => {
      const diff = row._target - row.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        row.scrollLeft = row._target;
        row._gliding = false;
        return;
      }
      row.scrollLeft += diff * 0.2;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const targetOf = (row) => (row._gliding ? row._target : row.scrollLeft);

  function attach(row) {
    if (row._bar && row._bar.isConnected) return row._update();

    const bar = document.createElement("div");
    bar.className = "x-scrollbar";
    bar.innerHTML = '<div class="x-thumb"></div>';
    row.after(bar);
    const thumb = bar.firstChild;

    // size and place the thumb from the row's scroll position
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      bar.hidden = max <= 1;
      if (bar.hidden) return;
      const w = bar.clientWidth;
      const tw = Math.max(40, (w * row.clientWidth) / row.scrollWidth);
      thumb.style.width = `${tw}px`;
      thumb.style.transform = `translateX(${((w - tw) * row.scrollLeft) / max}px)`;
    };
    row._bar = bar;
    row._update = update;
    row.addEventListener("scroll", update, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(row);

    // drag the thumb
    thumb.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const start = targetOf(row);
      const max = row.scrollWidth - row.clientWidth;
      const room = bar.clientWidth - thumb.offsetWidth || 1;
      bar.classList.add("dragging");
      const move = (ev) => glideTo(row, start + ((ev.clientX - startX) * max) / room);
      const up = () => {
        thumb.removeEventListener("pointermove", move);
        bar.classList.remove("dragging");
      };
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", up, { once: true });
      thumb.addEventListener("lostpointercapture", up, { once: true });
    });

    // click on the bar: jump there
    bar.addEventListener("pointerdown", (e) => {
      if (e.target === thumb) return;
      const r = bar.getBoundingClientRect();
      const tw = thumb.offsetWidth;
      const ratio = Math.min(Math.max((e.clientX - r.left - tw / 2) / (r.width - tw), 0), 1);
      glideTo(row, ratio * (row.scrollWidth - row.clientWidth));
    });

    // grab the row with the mouse and drag it sideways (like swiping on a phone); it keeps
    // gliding a little after you let go. A drag never counts as a click on a poster.
    row.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const startX = e.clientX;
      const start = targetOf(row);
      let moved = false;
      let lastX = startX;
      let lastT = performance.now();
      let speed = 0; // px per ms

      const move = (ev) => {
        const dx = ev.clientX - startX;
        if (!moved) {
          if (Math.abs(dx) < 6) return;
          moved = true;
          row.classList.add("grabbing");
          row._gliding = false;
        }
        const now = performance.now();
        speed = (ev.clientX - lastX) / Math.max(now - lastT, 1);
        lastX = ev.clientX;
        lastT = now;
        row._target = start - dx;
        row.scrollLeft = start - dx;
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (!moved) return;
        row.classList.remove("grabbing");
        // the click that ends a drag shouldn't open the poster
        const block = (ce) => {
          ce.preventDefault();
          ce.stopPropagation();
        };
        row.addEventListener("click", block, { capture: true, once: true });
        setTimeout(() => row.removeEventListener("click", block, { capture: true }), 50);
        // a flick keeps it moving for a moment
        if (performance.now() - lastT < 80 && Math.abs(speed) > 0.1) {
          const extra = Math.max(Math.min(speed * 250, 500), -500); // at most ~2 posters
          glideTo(row, row.scrollLeft - extra);
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    // stop the browser dragging the poster picture / link instead
    row.addEventListener("dragstart", (e) => e.preventDefault());

    // sideways scrolling (touchpad swipe, or Shift + mouse wheel): glide instead of stepping.
    // Plain up / down wheel still scrolls the page.
    row.addEventListener(
      "wheel",
      (e) => {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        if (!dx || Math.abs(dx) < Math.abs(e.shiftKey ? 0 : e.deltaY)) return;
        e.preventDefault();
        const px = e.deltaMode === 1 ? dx * 40 : e.deltaMode === 2 ? dx * row.clientWidth : dx;
        glideTo(row, targetOf(row) + px * (Math.abs(px) < 40 ? 1 : 1.6));
      },
      { passive: false }
    );

    update();
  }

  // rows appear later (home rows, title page sections…), so keep looking
  let queued = false;
  function scan() {
    queued = false;
    document.querySelectorAll(ROWS).forEach(attach);
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(scan);
  }
  document.addEventListener("DOMContentLoaded", () => {
    scan();
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  });
  window.addEventListener("load", queue);
})();

/*
 * Smooth scrolling with a mouse wheel (computers only).
 *
 * A mouse wheel moves the page in steps (about 100px a click). Here each click sets where the
 * page is heading, and the page glides there, easing out, a little more with every frame:
 * the soft, weighty feel of a touchpad. Only for the page itself and only for a mouse wheel:
 * a touchpad (already smooth), a pop-up, a menu or anything that scrolls on its own is left to
 * the browser. Off with "reduce motion" on, or the switch in Settings (mn:smoothScroll).
 */
(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (Store.read("mn:smoothScroll", true) === false) return;

  const EASE = 0.14; // how much of the way it goes each frame (higher: snappier)
  const root = document.scrollingElement || document.documentElement;
  let target = window.scrollY;
  let gliding = false;

  const maxY = () => root.scrollHeight - window.innerHeight;
  // something under the pointer that scrolls up / down by itself (a menu, a pop-up's list…)
  function scrollsItself(el, dy) {
    for (; el && el !== document.body && el !== root; el = el.parentElement) {
      if (el.scrollHeight - el.clientHeight < 2) continue;
      if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
      if ((dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) || (dy < 0 && el.scrollTop > 0)) return true;
    }
    return false;
  }

  // (each frame moves at least 1px: a smaller step is rounded away by the browser, and the page
  // would stop a few pixels short with the glide running on; it also ends if the page can't move)
  function step() {
    const before = window.scrollY;
    const diff = target - before;
    if (Math.abs(diff) <= 1) {
      window.scrollTo(0, target);
      gliding = false;
      return;
    }
    window.scrollTo(0, before + Math.sign(diff) * Math.max(1, Math.abs(diff) * EASE));
    if (window.scrollY === before) {
      gliding = false;
      target = before;
      return;
    }
    requestAnimationFrame(step);
  }

  window.addEventListener(
    "wheel",
    (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey) return; // (a row took it; ctrl + wheel = zoom)
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!dy || Math.abs(e.deltaX) > Math.abs(dy) || e.shiftKey) return;
      // a touchpad sends many small movements and is smooth already; a wheel click is a big step
      if (e.deltaMode === 0 && Math.abs(dy) < 50) return;
      if (document.querySelector(".overlay.active, .app-sheet.open") || scrollsItself(e.target, dy)) return;
      e.preventDefault();
      if (!gliding) target = window.scrollY;
      target = Math.max(0, Math.min(maxY(), target + dy));
      if (!gliding) {
        gliding = true;
        requestAnimationFrame(step);
      }
    },
    { passive: false }
  );

  // the page moved some other way (keys, the scrollbar, a link to a section): follow it
  const stop = () => {
    gliding = false;
    target = window.scrollY;
  };
  window.addEventListener("keydown", stop);
  window.addEventListener("mousedown", stop);
  window.addEventListener("scroll", () => !gliding && (target = window.scrollY), { passive: true });
})();
