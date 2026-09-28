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

  /* ---------- typo-tolerant search ---------- */

  // "Spider-Man: No Way Home" -> ["spider", "man", "no", "way", "home"]
  const words = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9а-яё]+/i)
      .filter(Boolean);

  // edit distance (a letter missing, extra, wrong, or two swapped), stops early past max
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
        cur.push(d);
        if (d < best) best = d;
      }
      if (best > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[b.length];
  }

  // how many typos a word of this length may have
  // (short words must be exact, so "star" doesn't also find "stay" and "scar")
  const allowed = (len) => (len >= 8 ? 2 : len >= 5 ? 1 : 0);

  // does a typed word match a word of the title? (the last word you type may be unfinished)
  function wordMatches(typed, titleWords, last) {
    return titleWords.some((w) => {
      if (w === typed || (last && w.startsWith(typed))) return true;
      const max = allowed(typed.length);
      if (!max) return false;
      if (distance(typed, w, max) <= max) return true;
      // unfinished last word with a typo: compare with the start of the title word
      return last && w.length > typed.length && distance(typed, w.slice(0, typed.length), max) <= max;
    });
  }

  // every typed word matches some word of the name, allowing typos
  function fuzzyName(name, q) {
    const typed = words(q);
    if (!typed.length) return false;
    const titleWords = words(name);
    return typed.every((t, i) => wordMatches(t, titleWords, i === typed.length - 1));
  }

  // 0..1: how close a name is to what was typed (to sort typo-tolerant results)
  function similarity(name, q) {
    const a = words(name).join(" ");
    const b = words(q).join(" ");
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.startsWith(b)) return 0.95;
    if (a.includes(b)) return 0.85;
    const max = Math.max(a.length, b.length);
    const d = distance(a, b, max);
    return Math.max(0, 1 - d / max) * (fuzzyName(name, q) ? 1 : 0.6);
  }

  // search matches both names: exact text first, then allowing small typos
  function matches(x, q) {
    q = q.toLowerCase();
    if ((x.title || "").toLowerCase().includes(q) || (x.titleRu || "").toLowerCase().includes(q)) return true;
    return fuzzyName(x.title, q) || (!!x.titleRu && fuzzyName(x.titleRu, q));
  }

  window.Lang = { get, set, isRu, title, altTitle, matches, fuzzyName, similarity, words };
})();
