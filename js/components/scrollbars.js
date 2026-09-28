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

  const ROWS = ".movie-row, .t-cast, .t-media-row";
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
