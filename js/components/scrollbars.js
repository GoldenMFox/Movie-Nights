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
      const start = row.scrollLeft;
      const max = row.scrollWidth - row.clientWidth;
      const room = bar.clientWidth - thumb.offsetWidth || 1;
      bar.classList.add("dragging");
      const move = (ev) => (row.scrollLeft = start + ((ev.clientX - startX) * max) / room);
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
      row.scrollTo({ left: ratio * (row.scrollWidth - row.clientWidth), behavior: "smooth" });
    });

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
