/*
 * Books: the books behind a movie or show, and books to read next (title pages, the person page,
 * and the owner's picks on Home). Everything from Google Books (googleapis.com/books).
 *
 * Google Books needs a key: without one Google shares a small daily allowance among every site
 * in the world, which is always used up. The owner pastes one in the Admin Control Center
 * (API integrations → Google Books), or puts it in js/config.js as GOOGLE_BOOKS_KEY; it's
 * restricted to this site's address in Google Cloud. With no key, the book sections stay hidden.
 *
 * Three kinds of books for a title:
 *   Based on        the book it's adapted from: TMDB names the writer ("Novel: Andy Weir") or tags it
 *                   ("based on novel or book"); found by its title and the writer
 *   Related         novels on the same themes (TMDB's keywords: "space", "heist", "dystopia"…)
 *   Further reading non-fiction on what it's about (space → astronomy, a war → its history…),
 *                   offered as reading around the subject, never as a verdict on the film's accuracy
 * Answers are kept a month (Admin → API integrations), asked for only when the section is near.
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
    const isbn = (i.industryIdentifiers || []).find((x) => x.type === "ISBN_13") || (i.industryIdentifiers || [])[0];
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

  // what it's adapted from: { book, author, kind } (or { author, others } when the book itself
  // isn't found by the film's name), or null
  async function basedOn(d) {
    const keywords = (d.keywords || []).map((k) => k.name);
    const authors = (d.sourceAuthors || []).filter((a) => /novel|book|author|short story|comic|graphic|memoir|play|story/i.test(a.job));
    if (!authors.length && !keywords.some((k) => BASED.test(k))) return null;
    const titles = [...new Set([d.title, d.originalTitle].filter(Boolean))].map((t) => t.replace(/\s*\((19|20)\d\d\)\s*$/, ""));
    for (const t of titles) {
      for (const author of authors.length ? authors.map((a) => a.name) : [""]) {
        const list = await search(author ? `intitle:"${t}" inauthor:"${author}"` : `intitle:"${t}"`, 8).catch(() => []);
        const hit =
          list.find((b) => norm(b.title) === norm(t) && (!author || b.authors.some((a) => norm(a) === norm(author)))) ||
          (author ? list.find((b) => (norm(b.title).startsWith(norm(t)) || norm(t).startsWith(norm(b.title))) && b.authors.some((a) => norm(a) === norm(author))) : null);
        if (hit) return { book: hit, author: author || hit.authors[0] || "", kind: (authors[0] && authors[0].job) || "Novel" };
      }
    }
    // the film has another name: the writer's best-known books
    if (authors.length) {
      const list = (await search(`inauthor:"${authors[0].name}"`, 10).catch(() => [])).filter((b) => b.authors.some((a) => norm(a) === norm(authors[0].name)));
      if (list.length) return { book: null, author: authors[0].name, kind: authors[0].job, others: list.slice(0, 8) };
    }
    return null;
  }

  // TMDB keywords -> what to look for (novels on the same theme)
  const THEMES = [
    [/space|astronaut|outer space|spaceship|mars|alien|extraterrestrial/i, "space"],
    [/artificial intelligence|robot|android|cyborg|computer/i, "artificial intelligence"],
    [/dystopia|post-apocalyptic|apocalypse|totalitarian/i, "dystopian"],
    [/time travel/i, "time travel"],
    [/heist|bank robbery|con artist|thief/i, "heist"],
    [/serial killer|murder|detective|investigation|police/i, "detective mystery"],
    [/vampire/i, "vampires"],
    [/zombie/i, "zombies"],
    [/ghost|haunted|supernatural|demon|possession/i, "ghost story"],
    [/dragon|magic|wizard|sword and sorcery|fantasy world/i, "epic fantasy"],
    [/world war ii|nazi|holocaust/i, "world war II"],
    [/world war i\b/i, "world war I"],
    [/spy|espionage|cia|secret agent/i, "spy thriller"],
    [/high school|coming of age|teenager/i, "coming of age"],
    [/survival|wilderness|stranded/i, "survival"],
    [/superhero/i, "superheroes"],
    [/samurai|feudal japan/i, "samurai"],
    [/pirate/i, "pirates"],
    [/western|cowboy/i, "western"],
  ];
  // TMDB keywords -> non-fiction: what to look for, Google's category, and the heading
  const REFERENCE = [
    [/space|astronaut|nasa|mars|moon landing|black hole|planet|space travel|astronomy|outer space/i, "astronomy space exploration", "Science", "The universe and space flight"],
    [/artificial intelligence|robot|computer|hacker|internet|virtual reality/i, "artificial intelligence", "Computers", "AI and computing"],
    [/virus|pandemic|epidemic|disease|outbreak|doctor|hospital|medical|surgeon/i, "epidemics medicine history", "Medical", "Medicine and disease"],
    [/dinosaur|jurassic/i, "dinosaurs", "Science", "Dinosaurs"],
    [/ocean|shark|underwater|deep sea|whale/i, "ocean marine life", "Science", "The ocean"],
    [/climate|natural disaster|tornado|hurricane|earthquake|volcano|tsunami/i, "natural disasters", "Science", "Natural disasters"],
    [/genetic|clone|cloning|dna/i, "genetics", "Science", "Genetics"],
    [/nuclear|atomic bomb|manhattan project/i, "atomic bomb history", "History", "The atomic age"],
    [/quantum|physics|time travel|wormhole|relativity/i, "physics time relativity", "Science", "Physics and time"],
    [/world war ii|nazi|holocaust|d-day/i, "world war II", "History", "World War II"],
    [/world war i\b|trench warfare/i, "world war I", "History", "World War I"],
    [/vietnam war/i, "vietnam war", "History", "The Vietnam War"],
    [/ancient rome|roman empire|gladiator/i, "ancient rome", "History", "Ancient Rome"],
    [/ancient egypt|pharaoh/i, "ancient egypt", "History", "Ancient Egypt"],
    [/serial killer|forensic|criminal investigation/i, "forensic science criminology", "True Crime", "Crime and forensics"],
    [/stock market|wall street|financial crisis|banking/i, "financial crisis wall street", "Business & Economics", "Money and markets"],
    [/psychology|mental illness|schizophrenia|psychiatrist|amnesia/i, "the mind psychology", "Psychology", "The mind"],
    [/evolution|prehistoric|caveman/i, "human evolution", "Science", "Evolution"],
    [/mountain climbing|everest|mountaineering/i, "everest mountaineering", "Sports & Recreation", "Mountaineering"],
    [/chess/i, "chess", "Games & Activities", "Chess"],
  ];
  const fromKeywords = (d, table) => {
    const words = (d.keywords || []).map((k) => k.name).concat(d.genres || []);
    const out = [];
    table.forEach((row) => words.some((w) => row[0].test(w)) && !out.some((o) => o[1] === row[1]) && out.push(row));
    return out;
  };

  // novels on its themes: { subject, books: [book] } or null
  async function related(d, skip) {
    const themes = fromKeywords(d, THEMES).slice(0, 2);
    if (!themes.length) return null;
    const seen = new Set(skip || []);
    const books = [];
    for (const [, subject] of themes) {
      const list = await search(`${subject} novel subject:fiction`, 14).catch(() => []);
      list.forEach((b) => !seen.has(b.key) && (seen.add(b.key), books.push(b)));
    }
    return books.length ? { subject: themes.map((t) => t[1]).join(" · "), books: books.slice(0, 14) } : null;
  }

  // non-fiction about what it's about: { topics: [{ label, books }] } or null
  async function reference(d) {
    const topics = fromKeywords(d, REFERENCE).slice(0, 2);
    if (!topics.length) return null;
    const out = [];
    for (const [, words, category, label] of topics) {
      const list = (await search(`${words} subject:"${category}"`, 10).catch(() => [])).filter((b) => !b.subjects.some((s) => /fiction/i.test(s)));
      if (list.length) out.push({ label, books: list.slice(0, 8) });
    }
    return out.length ? { topics: out } : null;
  }

  // a person's books: written by them, and about them (biographies)
  async function forPerson(name) {
    const [by, about] = await Promise.all([
      search(`inauthor:"${name}"`, 12).catch(() => []),
      search(`"${name}" subject:"Biography & Autobiography"`, 12).catch(() => []),
    ]);
    const mine = by.filter((b) => b.authors.some((a) => norm(a) === norm(name)));
    const aboutThem = about.filter((b) => !b.authors.some((a) => norm(a) === norm(name)) && norm(`${b.title} ${b.description}`).includes(norm(name)));
    return { by: mine.slice(0, 10), about: aboutThem.filter((b) => !mine.some((m) => m.key === b.key)).slice(0, 10) };
  }

  window.Books = { ready, search, basedOn, related, reference, forPerson };
})();
