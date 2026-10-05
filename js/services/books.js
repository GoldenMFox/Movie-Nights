/*
 * Books: the book behind a movie or show (title pages), a person's books (the person page) and the
 * owner's picks on Home. Everything from Open Library (openlibrary.org: free, no key).
 *
 * A book here is Open Library's "work" (the book itself, not one edition): the year it was first
 * published, its cover, the median page count, its rating, an ISBN of one of its editions, and its
 * description (asked for separately, only for the one shown big: "Based on").
 *
 * For a title: the book it's adapted from ("Based on"), only when TMDB says it is one (it names
 * the writer, "Novel: Andy Weir", or tags it "based on novel or book"); found by its title and the
 * writer. Answers are kept a month (Admin → API integrations).
 */
(function () {
  const API = "https://openlibrary.org";
  const COVERS = "https://covers.openlibrary.org/b/id";
  const FIELDS = "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,ratings_average,ratings_count,edition_count,isbn,subject,publish_year";
  const days = () => (window.Site ? Site.api("openlibrary").days : 30) || 30;
  // books can be shown: the service is on (no key needed)
  const ready = () => !!window.Api && Api.enabled("openlibrary");

  const norm = (s) => String(s || "").toLowerCase().replace(/\(.*?\)|[^a-z0-9]+/g, " ").replace(/\b(the|a|an)\b/g, "").replace(/\s+/g, " ").trim();

  // the year it first came out: the earliest edition's, unless that one stands alone decades before
  // the rest (a mistake in the data: The Mist has a "1925" edition, then 1986…)
  function firstYear(d) {
    const years = [...new Set((d.publish_year || []).filter((y) => y > 1400 && y <= new Date().getFullYear() + 1))].sort((a, b) => a - b);
    // (a book with many editions has them close together: 12 years apart is already suspicious)
    while (years.length > 1 && years[1] - years[0] > (years.length >= 5 ? 12 : 25)) years.shift();
    return years[0] || d.first_publish_year || null;
  }

  function book(d) {
    // (an ISBN-13 of one of its editions, an English one when there is: 978 / 979 0-1)
    const isbns = (d.isbn || []).filter((x) => /^97[89]\d{10}$/.test(x));
    const isbn = isbns.find((x) => /^97(8[01]|91)/.test(x)) || isbns[0] || "";
    return {
      key: String(d.key || "").replace(/^\/works\//, ""),
      title: String(d.title || "").replace(/\s*\[[^\]]*\]\s*$/, ""), // (no "[12 works]" notes)
      authors: d.author_name || [],
      year: firstYear(d),
      cover: d.cover_i ? `${COVERS}/${d.cover_i}-M.jpg` : "",
      coverBig: d.cover_i ? `${COVERS}/${d.cover_i}-L.jpg` : "",
      pages: d.number_of_pages_median || null,
      isbn,
      rating: d.ratings_average ? Math.round(d.ratings_average * 10) / 10 : null,
      ratings: d.ratings_count || 0,
      editions: d.edition_count || 0,
      url: d.key ? `${API}${d.key}` : "",
      subjects: (d.subject || []).slice(0, 12),
      description: "",
    };
  }

  // a few books for a search: [book] (books with a cover, the same one once). q: words, or
  // { title, author } for a search by title and writer
  async function search(q, max) {
    if (!ready()) throw new Error("Books are switched off for now");
    const params = new URLSearchParams(typeof q === "string" ? { q } : Object.fromEntries(Object.entries(q).filter(([, v]) => v)));
    params.set("limit", String(Math.min(30, (max || 10) * 2))); // (some have no cover: a few more asked for)
    params.set("fields", FIELDS);
    const r = await Api.get("openlibrary", `${API}/search.json?${params}`, { days: days() });
    const seen = new Set();
    return ((r && r.docs) || [])
      .map(book)
      // (with a cover; not a translation's title in another script, nor a bundle "A / B / C")
      .filter((b) => b.title && b.cover && /[a-z]/i.test(b.title) && !/ \/ /.test(b.title))
      .filter((b) => {
        const k = `${norm(b.title)}|${norm(b.authors[0])}`;
        return !seen.has(k) && seen.add(k);
      })
      .slice(0, max || 10);
  }

  // a work's description (Open Library keeps it on the work, not in search results)
  async function describe(b) {
    if (!b || !b.key) return b;
    const w = await Api.get("openlibrary", `${API}/works/${encodeURIComponent(b.key)}.json`, { days: days() }).catch(() => null);
    const text = w && (typeof w.description === "string" ? w.description : w.description && w.description.value);
    // (just the words: no "([source][1])" notes or markdown links)
    if (text)
      b.description = String(text)
        .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/-{3,}[\s\S]*$/, "")
        .replace(/\(\[source\]\s*\)/gi, "")
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 1200);
    return b;
  }

  /* ---------------- for a title ---------------- */

  const BASED = /based on (novel|book|young adult novel|short story|comic|graphic novel|memoir|manga|play|children's book|novella|light novel)/i;

  // the writers TMDB names for it, and whether it's adapted from a book at all (no search needed)
  const sourceAuthors = (d) => (d.sourceAuthors || []).filter((a) => /novel|book|author|short story|comic|graphic|memoir|play|story/i.test(a.job));
  const fromBook = (d) => !!d && (sourceAuthors(d).length > 0 || (d.keywords || []).some((k) => BASED.test(k.name)));

  // what it's adapted from: { book, author, kind }, or null (not from a book, or not found)
  async function basedOn(d) {
    if (!fromBook(d)) return null;
    const authors = sourceAuthors(d);
    const titles = [...new Set([d.title, d.originalTitle].filter(Boolean))].map((t) => t.replace(/\s*\((19|20)\d\d\)\s*$/, ""));
    for (const t of titles) {
      for (const author of authors.length ? authors.map((a) => a.name) : [""]) {
        const exact = (b) => norm(b.title) === norm(t) && (!author || b.authors.some((a) => norm(a) === norm(author)));
        const close = (b) => author && (norm(b.title).startsWith(norm(t)) || norm(t).startsWith(norm(b.title))) && b.authors.some((a) => norm(a) === norm(author));
        const list = await search({ title: t, author }, 10).catch(() => []);
        // the book itself: the one with the most editions (not a study guide or a box set)
        const fits = list.filter(exact).sort((x, y) => y.editions - x.editions);
        const hit = fits[0] || list.filter(close).sort((x, y) => y.editions - x.editions)[0];
        if (hit) return { book: await describe(hit), author: author || hit.authors[0] || "", kind: (authors[0] && authors[0].job) || "Novel" };
      }
    }
    return null;
  }

  // a person's books: written by them, and about them (biographies)
  async function forPerson(name) {
    const [by, about] = await Promise.all([search({ author: name }, 12).catch(() => []), search(`person:"${String(name).replace(/"/g, "")}"`, 12).catch(() => [])]);
    const mine = by.filter((b) => b.authors.some((a) => norm(a) === norm(name))).sort((x, y) => y.editions - x.editions);
    const aboutThem = about.filter((b) => !b.authors.some((a) => norm(a) === norm(name)));
    return { by: mine.slice(0, 10), about: aboutThem.filter((b) => !mine.some((m) => m.key === b.key)).slice(0, 10) };
  }

  window.Books = { ready, search, fromBook, basedOn, forPerson };
})();
