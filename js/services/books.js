/*
 * Books: the book behind a movie or show (title pages), a person's books (the person page) and the
 * owner's picks on Home. Everything from Google Books (googleapis.com/books).
 *
 * Google Books needs a key: without one Google shares a small daily allowance among every site
 * in the world, which is always used up. The owner pastes one in the Admin Control Center
 * (API integrations → Google Books), or puts it in js/config.js as GOOGLE_BOOKS_KEY; it's
 * restricted to this site's address in Google Cloud. With no key, the book sections stay hidden.
 *
 * For a title: the book it's adapted from ("Based on"), only when TMDB says it is one (it names
 * the writer, "Novel: Andy Weir", or tags it "based on novel or book"); found by its title and the
 * writer. Answers are kept a month (Admin → API integrations).
 */
(function () {
  const API = "https://www.googleapis.com/books/v1/volumes";
  const days = () => (window.Site ? Site.api("googlebooks").days : 30) || 30;
  const key = () => ((window.Site && Site.api("googlebooks").key) || (window.MN_CONFIG || {}).GOOGLE_BOOKS_KEY || "").trim();
  // books can be shown: the service is on and there's a key
  const ready = () => !!key() && Api.enabled("googlebooks");

  const https = (u) => String(u || "").replace(/^http:\/\//, "https://");
  // (Google's descriptions carry a little HTML: just the words, read without running anything)
  const parser = new DOMParser();
  const clean = (t) => (parser.parseFromString(String(t || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n"), "text/html").body.textContent || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1200);

  function book(v) {
    const i = v.volumeInfo || {};
    const img = i.imageLinks || {};
    // (only a real ISBN: a library scan has "UOM:39015…" and often a blank cover)
    const isbn = (i.industryIdentifiers || []).find((x) => x.type === "ISBN_13") || (i.industryIdentifiers || []).find((x) => x.type === "ISBN_10");
    const thumb = https(img.thumbnail || img.smallThumbnail || "").replace("&edge=curl", "");
    return {
      key: v.id,
      title: i.title || "",
      authors: i.authors || [],
      year: Number(String(i.publishedDate || "").slice(0, 4)) || null,
      cover: thumb,
      coverBig: thumb ? thumb.replace(/zoom=\d/, "zoom=2") : "",
      pages: i.pageCount || null,
      publisher: i.publisher || "",
      isbn: isbn ? isbn.identifier : "",
      rating: i.averageRating || null,
      ratings: i.ratingsCount || 0,
      url: https(i.canonicalVolumeLink || i.infoLink || ""),
      subjects: i.categories || [],
      description: clean(i.description),
    };
  }
  const norm = (s) => String(s || "").toLowerCase().replace(/\(.*?\)|[^a-z0-9]+/g, " ").replace(/\b(the|a|an)\b/g, "").replace(/\s+/g, " ").trim();

  // a few books for a search: [book] (books with a cover, the same one once)
  async function search(q, max, order) {
    if (!ready()) throw new Error("Books need a Google Books key (Admin Control Center)");
    const url = `${API}?q=${encodeURIComponent(q)}&maxResults=${max || 10}&printType=books&langRestrict=en${order ? `&orderBy=${order}` : ""}&key=${encodeURIComponent(key())}`;
    // (the key isn't part of what's remembered)
    const r = await Api.get("googlebooks", url, { days: days(), key: `v|${q}|${max || 10}|${order || ""}` });
    const seen = new Set();
    return ((r && r.items) || [])
      .map(book)
      .filter((b) => b.title && b.cover)
      .filter((b) => {
        const k = `${norm(b.title)}|${norm(b.authors[0])}`;
        return !seen.has(k) && seen.add(k);
      });
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
    // (no quotes: Google Books finds nothing at all for intitle:"…" or inauthor:"…")
    const tidy = (x) => String(x).replace(/["“”]/g, "").trim();
    for (const t of titles) {
      for (const author of authors.length ? authors.map((a) => a.name) : [""]) {
        const exact = (b) => norm(b.title) === norm(t) && (!author || b.authors.some((a) => norm(a) === norm(author)));
        const close = (b) => author && (norm(b.title).startsWith(norm(t)) || norm(t).startsWith(norm(b.title))) && b.authors.some((a) => norm(a) === norm(author));
        let list = await search(author ? `intitle:${tidy(t)} inauthor:${tidy(author)}` : `intitle:${tidy(t)}`, 10).catch(() => []);
        // nothing that fits: the plain words (title and writer)
        if (!list.some(exact) && author) list = list.concat(await search(`${tidy(t)} ${tidy(author)}`, 10).catch(() => []));
        // the best edition of it: a published one (ISBN), with a description, then ratings
        const worth = (b) => (b.isbn ? 4 : 0) + (b.description ? 2 : 0) + (b.ratings ? 1 : 0);
        const fits = list.filter(exact).sort((x, y) => worth(y) - worth(x));
        const hit = fits[0] || list.filter(close).sort((x, y) => worth(y) - worth(x))[0];
        if (hit) return { book: hit, author: author || hit.authors[0] || "", kind: (authors[0] && authors[0].job) || "Novel" };
      }
    }
    return null;
  }

  // a person's books: written by them, and about them (biographies)
  async function forPerson(name) {
    const [by, about] = await Promise.all([
      search(`inauthor:${String(name).replace(/["“”]/g, "")}`, 12).catch(() => []),
      search(`"${name}" subject:"Biography & Autobiography"`, 12).catch(() => []),
    ]);
    const mine = by.filter((b) => b.authors.some((a) => norm(a) === norm(name)));
    const aboutThem = about.filter((b) => !b.authors.some((a) => norm(a) === norm(name)) && norm(`${b.title} ${b.description}`).includes(norm(name)));
    return { by: mine.slice(0, 10), about: aboutThem.filter((b) => !mine.some((m) => m.key === b.key)).slice(0, 10) };
  }

  // Google sends an "image not available" picture (300 x 391) when it has no large cover of an
  // edition, though the small one is real: then the small one is shown instead
  document.addEventListener("load", (e) => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.small && img.naturalWidth === 300 && img.naturalHeight === 391) {
      img.src = img.dataset.small;
      delete img.dataset.small;
    }
  }, true);

  window.Books = { ready, search, fromBook, basedOn, forPerson };
})();
