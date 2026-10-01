/*
 * A shared title: what someone opens from a link made with Share (js/components/share.js).
 *
 *   share.html?t=movie-157336&from=Nicu&r=9&note=Watch%20it%20loud
 *
 * Works for everyone, with or without an account: the title comes from TMDB. Shown as a
 * card over its own backdrop: who sent it, their score and note, what it is, where to
 * stream it, the trailer, and a way to keep it (your Watchlist, or sign in for one).
 */
(function () {
  const { esc, toast } = UI;
  const root = document.getElementById("share-page");
  const params = new URLSearchParams(location.search);
  const ref = params.get("t") || "";
  const from = (params.get("from") || "").trim().slice(0, 30);
  const rRaw = parseFloat(params.get("r"));
  const score = Number.isFinite(rRaw) && rRaw >= 0 && rRaw <= 10 ? rRaw : null;
  const note = (params.get("note") || "").trim().slice(0, 140);
  const [media, tmdbId] = ref.split("-");
  let d = null;

  const img = (path, size) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : "");
  const KIND = { movie: "movie", tv: "show", anime: "anime" };

  function oops(text) {
    root.innerHTML = `<div class="sp-card sp-oops">
        <i class="fa-regular fa-face-frown"></i>
        <h1>${esc(text)}</h1>
        <p>The link may be cut off. Ask for it again, or find something to watch here.</p>
        <a class="btn btn-primary" href="discover.html"><i class="fa-solid fa-compass"></i> Discover</a>
      </div>`;
  }

  // while it loads: the card's outline, gently pulsing
  function skeleton() {
    root.innerHTML = `<div class="sp-card sp-skel" aria-busy="true">
        <div class="sp-main"><span class="sp-poster sk"></span>
          <div class="sp-info"><span class="sk sk-l"></span><span class="sk sk-t"></span><span class="sk sk-m"></span><span class="sk sk-m"></span></div>
        </div></div>`;
  }

  // the button that keeps it: in your library already / add to your Watchlist / sign in
  function keepHtml() {
    if (Store.guest) return `<button class="btn sp-keep" type="button" data-cloud="add"><i class="fa-regular fa-bookmark"></i> Sign in to save it</button>`;
    const lib = Cards.inLibrary(d);
    if (lib) return `<a class="btn sp-keep on" href="title.html?id=${encodeURIComponent(lib.id)}"><i class="fa-solid fa-check"></i> In your library</a>`;
    return `<button class="btn sp-keep" type="button" data-sp="watch"><i class="fa-regular fa-bookmark"></i> Add to my Watchlist</button>`;
  }

  function render() {
    const lib = !Store.guest && Cards.inLibrary(d);
    const kind = KIND[d.type] || "title";
    const title = Lang.title(d);
    document.title = `${from ? `${from} shared` : "A pick for you:"} ${title} · Movie Nights`;
    const meta = [d.year, d.runtime, (d.genres || []).slice(0, 3).join(" • ")].filter(Boolean);
    const prov = d.providers && d.providers.list && d.providers.list.length ? d.providers : null;
    const initial = from ? from.charAt(0).toUpperCase() : "";

    const scores = [];
    if (score != null)
      scores.push(`<span class="sp-score mine"><i class="fa-solid fa-star"></i><b>${Cards.formatRating(score)}</b><small>/10 · ${from ? `${esc(from)}'s rating` : "their rating"}</small></span>`);
    if (lib && lib.rating != null)
      scores.push(`<span class="sp-score you"><i class="fa-solid fa-star"></i><b>${Cards.formatRating(lib.rating)}</b><small>/10 · yours</small></span>`);
    if (d.tmdbScore) scores.push(`<span class="sp-score"><span class="tmdb-tag">TMDB</span><b>${d.tmdbScore.toFixed(1)}</b></span>`);

    // (drawn again after a change: no entrance this time)
    root.classList.toggle("sp-again", !!root.querySelector("article.sp-card"));
    root.innerHTML = `
      <div class="sp-bg" style="--bg:url('${img(d.backdrop || d.poster, "w1280")}')" aria-hidden="true"></div>
      <article class="sp-card">
        <header class="sp-from sp-in" style="--d:0ms">
          ${initial ? `<span class="sp-avatar">${esc(initial)}</span>` : `<span class="sp-avatar gift"><i class="fa-solid fa-gift"></i></span>`}
          <span>${from ? `<b>${esc(from)}</b> thinks you'll love this ${kind}` : `Someone thinks you'll love this ${kind}`}</span>
        </header>
        <div class="sp-main">
          <div class="sp-poster sp-in" style="--d:80ms">${d.poster ? `<img src="${img(d.poster, "w500")}" alt="${esc(title)}" />` : `<i class="fa-solid fa-film"></i>`}</div>
          <div class="sp-info">
            <span class="sp-kind sp-in" style="--d:140ms">${esc(Store.TYPE_LABEL[d.type] || "")}${d.certification ? ` <span class="t-cert">${esc(d.certification)}</span>` : ""}</span>
            <h1 class="sp-in" style="--d:180ms">${esc(title)}</h1>
            ${d.xray && d.xray.tagline ? `<p class="sp-tagline sp-in" style="--d:220ms">${esc(d.xray.tagline)}</p>` : ""}
            <p class="sp-meta sp-in" style="--d:260ms">${meta.map(esc).join('<span class="dot">·</span>')}</p>
            ${scores.length ? `<div class="sp-scores sp-in" style="--d:300ms">${scores.join("")}</div>` : ""}
          </div>
        </div>
        ${note ? `<blockquote class="sp-note sp-in" style="--d:340ms"><i class="fa-solid fa-quote-left"></i>${esc(note)}${from ? `<cite>${esc(from)}</cite>` : ""}</blockquote>` : ""}
        ${d.overview ? `<p class="sp-overview sp-in" style="--d:380ms">${esc(d.overview)}</p>` : ""}
        ${
          prov
            ? `<div class="sp-where sp-in" style="--d:420ms"><span>${prov.kind === "stream" ? "Stream it on" : "Rent or buy on"}</span>
                <div class="sp-logos">${prov.list
                  .slice(0, 5)
                  .map(
                    (p) =>
                      `<a href="${esc(prov.link || d.tmdbUrl)}" target="_blank" rel="noopener" title="${esc(p.name)}"><img src="${img(p.logo, "w92")}" alt="${esc(p.name)}" /></a>`
                  )
                  .join("")}</div></div>`
            : ""
        }
        <div class="sp-actions sp-in" style="--d:460ms">
          ${d.trailer || (d.videos && d.videos.length) ? `<button class="btn btn-primary" type="button" data-sp="trailer"><i class="fa-solid fa-play"></i> Trailer</button>` : ""}
          ${keepHtml()}
          <a class="btn" href="title.html?tmdb=${encodeURIComponent(ref)}"><i class="fa-solid fa-circle-info"></i> Details</a>
          <button class="btn sp-round" type="button" data-sp="share" aria-label="Share it on" title="Share it on"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>
        </div>
      </article>
      ${
        Store.guest
          ? `<aside class="sp-pitch sp-in" style="--d:560ms">
              <img src="images/brand/logo.png" alt="Movie Nights" />
              <p>Your own movie diary: rate what you watch, keep a watchlist, rank your favorites and share them. Free, and private.</p>
              <div><button class="btn btn-primary" type="button" data-cloud="add"><i class="fa-brands fa-google"></i> Start yours</button>
              <a class="btn" href="index.html">Look around</a></div>
            </aside>`
          : ""
      }`;
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sp]");
    if (!b || !d) return;
    const act = b.dataset.sp;
    if (act === "trailer") {
      const keys = (d.videos || []).map((v) => v.key);
      Cards.showTrailer(
        { title: d.title, year: d.year, type: d.type, trailer: d.trailer },
        () => Promise.resolve(d.trailer || keys[0] || null),
        () => Promise.resolve(keys)
      );
    } else if (act === "watch") {
      Cards.addHit(d, { watchlist: true });
      toast(`${Lang.title(d)} is on your Watchlist`);
      render();
    } else if (act === "share") {
      Share.open({ details: d, item: !Store.guest && Cards.inLibrary(d) });
    }
  });

  async function init() {
    if (!/^(movie|tv)$/.test(media) || !/^\d+$/.test(tmdbId)) return oops("That link doesn't look right");
    if (!TMDB.enabled()) return oops("Titles can't be loaded right now");
    skeleton();
    try {
      d = await TMDB.detailsById(media, Number(tmdbId));
    } catch (err) {
      return oops("Couldn't load this title");
    }
    if (!d || !d.title) return oops("Couldn't find this title");
    render();
  }

  // signed in / out, or your library changed (e.g. added from here): the buttons follow
  Store.onChange(() => d && render());
  init();
})();
