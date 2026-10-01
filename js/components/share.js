/*
 * Share a title with anyone, account or not.
 *
 *   Share.open({ details, item })   details: TMDB.detailsById(...), item: your library title (if any)
 *
 * Two things to send, both made here:
 *  - a link to the title page by TMDB's id (title.html?tmdb=movie-157336: it works for everyone,
 *    not just for you), with what you choose to add: from=your name, r=your score, note=a few
 *    words. The title page shows those in a small "shared with you" card.
 *  - a picture card (1080 × 1350, the shape chats and stories like): the backdrop, the
 *    poster, the title, your score and your note, and the Movie Nights logo. Drawn here
 *    on a canvas, to send with the link (phones) or save.
 */
(function () {
  const { esc, toast } = UI;
  const W = 1080;
  const H = 1350;
  let overlay = null;
  let cur = null; // { details, item, name, rating, useName, useRating, note, blob, url }
  let drawing = 0;

  /* ---------------- the link ---------------- */

  // the title page by TMDB's id (title.html?tmdb=movie-157336), which anyone can open; someone
  // with the title in their own library is taken to theirs
  // A short link: s/?m14.10.Mirzac_Nicolae.Watch_it_loud  (s/index.html opens the title page)
  //   m / t + TMDB's id (a movie / a show), then your score, your name, your note: each only if
  //   you chose to add it (left empty when a later one follows), spaces as "_"
  const part = (s) => encodeURIComponent(String(s).replace(/[._]/g, " ").trim().replace(/\s+/g, "_")).replace(/%2C/g, ",");
  function linkOf(c) {
    const bits = [`${c.details.mediaType === "tv" ? "t" : "m"}${c.details.tmdbId}`];
    bits.push(c.useRating && c.rating != null ? Cards.formatRating(c.rating).replace(".", ",") : ""); // 9.5 → 9,5
    bits.push(c.useName && c.name ? part(c.name) : "");
    const note = c.note.trim().slice(0, 140);
    bits.push(note ? encodeURIComponent(note.replace(/_/g, " ").replace(/\s+/g, "_")).replace(/%2C/g, ",") : "");
    while (bits.length > 1 && !bits[bits.length - 1]) bits.pop();
    return `${new URL("s/", location.href).href}?${bits.join(".")}`;
  }

  // the message that goes with it:
  //   🎬 Interstellar (2014)
  //   ⭐ 9/10 from Nicolae
  //   “Watch it loud”
  //
  //   Trailer, cast and where to stream it:
  //   https://…/s/?m157336.9.Nicolae
  function textOf(c) {
    const d = c.details;
    const lines = [`🎬 ${Lang.title(d)}${d.year ? ` (${d.year})` : ""}`];
    const score = c.useRating && c.rating != null ? `⭐ ${Cards.formatRating(c.rating)}/10` : "";
    const who = c.useName && c.name ? c.name : "";
    if (score || who) lines.push(score && who ? `${score} from ${who}` : score || `Recommended by ${who}`);
    if (c.note.trim()) lines.push(`“${c.note.trim().slice(0, 140)}”`);
    lines.push("", "Trailer, cast and where to stream it:", c.url);
    return lines.join("\n");
  }

  /* ---------------- the picture card ---------------- */

  // (pictures from TMDB come with "?card": a copy of their own, as the page's copy of the same
  // poster can't go into a picture that's saved or sent)
  const loadImg = (src) =>
    new Promise((res) => {
      if (!src) return res(null);
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = /^https:\/\/image\.tmdb\.org\//.test(src) ? `${src}?card` : src;
    });

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // cover a box with an image (like object-fit: cover)
  function cover(ctx, img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s;
    const ih = img.height * s;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }

  // text split into lines that fit (at most `max`, the last one with "…")
  function lines(ctx, text, width, max) {
    const words = String(text).split(/\s+/);
    const out = [];
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const next = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(next).width <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      line = words[i];
      if (out.length === max) break;
    }
    if (out.length < max && line) out.push(line);
    if (out.length === max && out.join(" ").length < String(text).length) {
      let last = out[max - 1];
      while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
      out[max - 1] = `${last.trim()}…`;
    }
    return out;
  }

  async function drawCard(c) {
    const d = c.details;
    try {
      await Promise.all([document.fonts.load('800 60px "Inter"'), document.fonts.load('500 30px "Inter"'), document.fonts.load('italic 500 30px "Inter"')]);
    } catch (e) {}
    const [bd, po, logo] = await Promise.all([
      loadImg(d.backdrop ? `https://image.tmdb.org/t/p/w780${d.backdrop}` : ""),
      loadImg(d.poster ? `https://image.tmdb.org/t/p/w500${d.poster}` : ""),
      loadImg("images/brand/logo.png"),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0e0e11";
    ctx.fillRect(0, 0, W, H);

    // the backdrop, blurred and dimmed: a real blur where the browser has one, else drawn
    // smaller and smaller and stretched back (soft enough, on every browser)
    const art = bd || po;
    if (art) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      if ("filter" in ctx) ctx.filter = "blur(36px) saturate(1.3)";
      if (ctx.filter && ctx.filter !== "none") {
        cover(ctx, art, -80, -80, W + 160, H + 160);
      } else {
        let src = art;
        [270, 68].forEach((w) => {
          const c2 = document.createElement("canvas");
          c2.width = w;
          c2.height = Math.round((w * H) / W);
          const x2 = c2.getContext("2d");
          x2.imageSmoothingQuality = "high";
          cover(x2, src, 0, 0, c2.width, c2.height);
          src = c2;
        });
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(src, -40, -40, W + 80, H + 80);
      }
      ctx.restore();
    }
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(10,10,13,0.55)");
    g.addColorStop(0.5, "rgba(10,10,13,0.7)");
    g.addColorStop(1, "rgba(10,10,13,0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // the site's red, glowing up from the foot
    g = ctx.createRadialGradient(W / 2, H + 120, 40, W / 2, H + 120, 760);
    g.addColorStop(0, "rgba(229,9,20,0.38)");
    g.addColorStop(1, "rgba(229,9,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // what goes under the poster, measured first: the whole block sits in the middle
    const showScore = c.useRating && c.rating != null;
    const who = c.useName && c.name ? c.name : "";
    const note = c.note.trim();
    ctx.font = '800 64px "Inter", sans-serif';
    const tl = lines(ctx, Lang.title(d), W - 140, 2);
    ctx.font = 'italic 500 34px "Inter", sans-serif';
    const nl = note ? lines(ctx, `“${note}”`, W - 200, 2) : [];
    const pw = 440;
    const ph = 660;
    const px = (W - pw) / 2;
    const total = ph + 78 + (tl.length - 1) * 74 + 52 + (showScore || who ? 100 : 0) + (nl.length ? 62 + (nl.length - 1) * 46 : 0);
    let y = Math.max(60, Math.round((H - 120 - total) / 2));

    // the poster, with a deep shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    roundRect(ctx, px, y, pw, ph, 30);
    ctx.fillStyle = "#1c1c22";
    ctx.fill();
    ctx.restore();
    if (po) {
      ctx.save();
      roundRect(ctx, px, y, pw, ph, 30);
      ctx.clip();
      cover(ctx, po, px, y, pw, ph);
      ctx.restore();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    roundRect(ctx, px, y, pw, ph, 30);
    ctx.stroke();
    y += ph + 78;

    // the title, the year and kind
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = '800 64px "Inter", sans-serif';
    tl.forEach((l, i) => ctx.fillText(l, W / 2, y + i * 74));
    y += (tl.length - 1) * 74 + 52;
    ctx.font = '500 30px "Inter", sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    const meta = [d.year, Store.TYPE_LABEL[d.type], (d.genres || []).slice(0, 2).join(" · ")].filter(Boolean).join("  ·  ");
    ctx.fillText(meta, W / 2, y);
    y += 40;

    // your score (and name) in a pill
    if (showScore || who) {
      y += 30;
      const label = showScore ? `${Cards.formatRating(c.rating)}/10` : "";
      const tail = who ? (showScore ? `  ${who}'s rating` : `Recommended by ${who}`) : showScore ? "  my rating" : "";
      ctx.font = '800 34px "Inter", sans-serif';
      const lw = label ? ctx.measureText(label).width : 0;
      ctx.font = '500 30px "Inter", sans-serif';
      const tw = ctx.measureText(tail).width;
      const star = showScore ? 44 : 0;
      const w = star + lw + tw + 64;
      const x = (W - w) / 2;
      roundRect(ctx, x, y, w, 70, 35);
      ctx.fillStyle = "rgba(20,16,8,0.75)";
      ctx.fill();
      ctx.strokeStyle = showScore ? "rgba(245,184,46,0.6)" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = "left";
      let cx = x + 32;
      if (showScore) {
        ctx.fillStyle = "#f5b82e";
        ctx.font = '800 34px "Inter", sans-serif';
        ctx.fillText("★", cx, y + 47);
        cx += star;
        ctx.fillStyle = "#fff";
        ctx.fillText(label, cx, y + 47);
        cx += lw;
      }
      ctx.font = '500 30px "Inter", sans-serif';
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(tail, cx, y + 46);
      ctx.textAlign = "center";
      y += 70;
    }

    // your note, as a quote
    if (nl.length) {
      y += 62;
      ctx.font = 'italic 500 34px "Inter", sans-serif';
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      nl.forEach((l, i) => ctx.fillText(l, W / 2, y + i * 46));
    }

    // the logo at the foot
    if (logo) {
      const lh = 38;
      const lw = (logo.width / logo.height) * lh;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(logo, (W - lw) / 2, H - 76, lw, lh);
      ctx.globalAlpha = 1;
    }
    return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  }

  /* ---------------- the sheet ---------------- */

  function build() {
    overlay = Cards.makeOverlay(
      "share-modal",
      `<div class="sh-top">
         <span class="xr-label"><i class="fa-solid fa-arrow-up-from-bracket"></i> Share</span>
         <h3 class="sh-title"></h3>
       </div>
       <div class="sh-preview"><img class="sh-img" alt="" /><span class="sh-wait"><i class="fa-solid fa-circle-notch fa-spin"></i></span></div>
       <div class="sh-opts">
         <button type="button" class="sh-opt" data-opt="rating"></button>
         <button type="button" class="sh-opt" data-opt="name"></button>
       </div>
       <label class="sh-note"><i class="fa-regular fa-comment"></i><input type="text" maxlength="140" placeholder="Add a note (optional)" aria-label="A note" /></label>
       <div class="sh-link"><i class="fa-solid fa-link"></i><span class="sh-url"></span><button type="button" class="sh-copy">Copy</button></div>
       <div class="sh-buttons">
         <button type="button" class="btn btn-primary sh-send"><i class="fa-solid fa-paper-plane"></i> Share</button>
         <button type="button" class="btn sh-save"><i class="fa-solid fa-download"></i> <span>Save image</span></button>
       </div>
       <p class="sh-hint"><i class="fa-solid fa-earth-europe"></i> Anyone can open the link, no account needed.</p>`
    );
    overlay.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-opt]");
      if (opt) {
        if (opt.dataset.opt === "rating") cur.useRating = !cur.useRating;
        else cur.useName = !cur.useName;
        return refresh(true);
      }
      if (e.target.closest(".sh-copy")) return copy();
      if (e.target.closest(".sh-send")) return send();
      if (e.target.closest(".sh-save")) return save();
    });
    let typing;
    overlay.querySelector(".sh-note input").addEventListener("input", (e) => {
      cur.note = e.target.value;
      refresh(false);
      clearTimeout(typing);
      typing = setTimeout(() => refresh(true), 450);
    });
  }

  // the options, the link, and (again) the picture
  function refresh(redraw) {
    const c = cur;
    c.url = linkOf(c);
    const r = overlay.querySelector('[data-opt="rating"]');
    r.hidden = c.rating == null;
    r.classList.toggle("on", c.useRating);
    r.setAttribute("aria-pressed", c.useRating);
    r.innerHTML = `<i class="fa-solid fa-star"></i> My rating <b>${c.rating != null ? Cards.formatRating(c.rating) : ""}</b>`;
    const n = overlay.querySelector('[data-opt="name"]');
    n.hidden = !c.name;
    n.classList.toggle("on", c.useName);
    n.setAttribute("aria-pressed", c.useName);
    n.innerHTML = `<i class="fa-solid fa-user"></i> From <b>${esc(c.name || "")}</b>`;
    overlay.querySelector(".sh-url").textContent = c.url.replace(/^https?:\/\//, "");
    if (!redraw) return;
    const mine = ++drawing;
    overlay.querySelector(".sh-preview").classList.add("busy");
    c.blob = null;
    drawCard(c).then((blob) => {
      if (mine !== drawing || cur !== c) return;
      c.blob = blob;
      const img = overlay.querySelector(".sh-img");
      if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
      img.src = URL.createObjectURL(blob);
      overlay.querySelector(".sh-preview").classList.remove("busy");
    });
  }

  const fileName = () =>
    `${Lang.title(cur.details)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "movie"}-movie-nights.jpg`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(cur.url);
      toast("Link copied: anyone can open it");
    } catch (e) {
      toast("Couldn't copy the link");
    }
  }

  async function send() {
    const c = cur;
    const text = textOf(c);
    const file = c.blob ? new File([c.blob], fileName(), { type: "image/jpeg" }) : null;
    try {
      // phones: the picture card with the message (the link is in it, at the end: apps put
      // a separate url field in different places, or drop it when there's a picture)
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: Lang.title(c.details), text });
      } else {
        await navigator.share({ title: Lang.title(c.details), text });
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // closed the share sheet
      // a browser without a share sheet (or one that said no): copy instead
      copy();
    }
  }

  function save() {
    if (!cur.blob) return toast("One moment, the picture is still being made");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(cur.blob);
    a.download = fileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Picture saved");
  }

  function open({ details, item }) {
    if (!details || !details.tmdbId) return toast("This title can't be shared yet");
    if (!overlay) build();
    const profile = Store.guest ? {} : Store.getProfile() || {};
    const name = String(profile.name || "").trim().replace(/\s+/g, " ").slice(0, 30);
    cur = {
      details,
      item,
      name,
      rating: item && item.rating != null ? item.rating : null,
      useName: !!name,
      useRating: !!(item && item.rating != null),
      note: "",
    };
    overlay.querySelector(".sh-title").textContent = `${Lang.title(details)}${details.year ? ` (${details.year})` : ""}`;
    overlay.querySelector(".sh-note input").value = "";
    overlay.querySelector(".sh-img").removeAttribute("src");
    // no share sheet here (most computers): the link is the way, the button copies it
    const canShare = !!navigator.share;
    const sendBtn = overlay.querySelector(".sh-send");
    sendBtn.hidden = !canShare;
    overlay.querySelector(".sh-copy").classList.toggle("btn-primary", !canShare);
    refresh(true);
    Cards.openModal(overlay);
  }

  window.Share = { open, linkOf, drawCard };
})();
