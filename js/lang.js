/*
 * Title language: show movie / show / anime names in English or Russian.
 * Only the names change; everything else stays in English.
 *
 * Library titles keep their Russian name in data/library.js ("titleRu");
 * TMDB lists (Discover, home page) ask TMDB for the Russian names while RU is on.
 */
(function () {
  const KEY = "mn:titleLang";

  function get() {
    try {
      return localStorage.getItem(KEY) === "ru" ? "ru" : "en";
    } catch (e) {
      return "en";
    }
  }

  function set(lang) {
    try {
      localStorage.setItem(KEY, lang === "ru" ? "ru" : "en");
    } catch (e) {}
  }

  const isRu = () => get() === "ru";

  // the name to show for a library item or TMDB result
  function title(x) {
    if (!x) return "";
    return isRu() && x.titleRu ? x.titleRu : x.title;
  }

  // the other-language name, when it's different (shown small on title pages)
  function altTitle(x) {
    if (!x || !x.titleRu || x.titleRu === x.title) return "";
    return isRu() ? x.title : "";
  }

  // search matches both names
  function matches(x, q) {
    q = q.toLowerCase();
    return (x.title || "").toLowerCase().includes(q) || (x.titleRu || "").toLowerCase().includes(q);
  }

  window.Lang = { get, set, isRu, title, altTitle, matches };
})();
