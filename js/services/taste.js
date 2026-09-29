/*
 * Taste: how much you'll probably like a title you haven't rated yet ("92% match", like
 * Netflix). Learned from your own scores: for each genre, how much higher or lower than
 * your average you rate it (a genre you've only rated once counts for little), then
 * nudged by the title's TMDB score. Needs at least 5 rated titles; it updates as you rate.
 */
(function () {
  const MIN_RATED = 5;
  let model; // undefined = not built yet, null = not enough ratings

  function build() {
    const rated = Store.all().filter((i) => typeof i.rating === "number");
    if (rated.length < MIN_RATED) return null;
    const mean = rated.reduce((s, i) => s + i.rating, 0) / rated.length;
    const sums = {};
    rated.forEach((i) =>
      (i.genres || []).forEach((g) => {
        const k = g.toLowerCase();
        sums[k] = sums[k] || { s: 0, c: 0 };
        sums[k].s += i.rating - mean;
        sums[k].c++;
      })
    );
    const aff = {};
    Object.keys(sums).forEach((k) => (aff[k] = sums[k].s / (sums[k].c + 3)));
    return { mean, aff };
  }

  Store.onChange(() => (model = undefined));

  // 40–99, or null (not enough ratings yet / not worth showing)
  function match(t) {
    if (model === undefined) model = build();
    if (!model || !t) return null;
    const genres = (t.genres || []).map((g) => g.toLowerCase());
    const a = genres.length ? genres.reduce((s, g) => s + (model.aff[g] || 0), 0) / genres.length : 0;
    let score = typeof t.score === "number" && t.score > 0 ? t.score : typeof t.tmdbScore === "number" && t.tmdbScore > 0 ? t.tmdbScore : null;
    // a title in your library: the TMDB / IMDb score saved for it (js/services/ratings.js)
    if (score == null && t.id && window.Ratings) {
      const e = Ratings.entry(Ratings.refOf(t));
      score = e && typeof e.tmdb === "number" ? e.tmdb : e && typeof e.imdb === "number" ? e.imdb : null;
    }
    if (score == null) score = 6.8;
    const predicted = model.mean + a * 1.3 + (score - 6.8) * 0.6;
    return Math.round(Math.max(40, Math.min(99, 72 + (predicted - model.mean) * 12)));
  }

  // "92% match" (green), only for good matches, like Netflix
  function badge(t, cls) {
    const m = match(t);
    if (m == null || m < 65) return "";
    return `<span class="match${m >= 85 ? " high" : ""}${cls ? ` ${cls}` : ""}" title="How much you'll probably like it, from your own scores">${m}% match</span>`;
  }

  window.Taste = { match, badge };
})();
