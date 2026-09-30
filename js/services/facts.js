/*
 * Facts: the film facts of your library titles (runtime, directors, cast, countries,
 * language, year, franchise), for Wrapped, achievements and trivia.
 * Each title is found on TMDB once (Watch.refOf), then its facts come from TMDB.facts,
 * which keeps them in this browser for half a year.
 *
 *   Facts.of(item) -> facts | null
 *   Facts.forItems(items, progress) -> Map(library id -> facts | null), a few at a time
 */
(function () {
  const on = () => !!(window.TMDB && TMDB.enabled() && window.Watch);

  async function of(item) {
    if (!on() || !item) return null;
    try {
      const ref = await Watch.refOf(item);
      if (!ref) return null;
      const [media, id] = ref.split("-");
      return await TMDB.facts(media, Number(id));
    } catch (e) {
      return null;
    }
  }

  async function forItems(items, progress) {
    const out = new Map();
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < items.length) {
        const item = items[next++];
        out.set(item.id, await of(item));
        if (progress) progress(++done, items.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return out;
  }

  window.Facts = { of, forItems };
})();
