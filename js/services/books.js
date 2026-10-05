/*
 * Books: the books behind a movie or show, and books to read next (title pages, the person page,
 * and the owner's picks on Home).
 *
 * Two free services:
 *   Open Library  (openlibrary.org, no key): first choice for everything. Books, authors, covers,
 *                 first published, editions, pages, publishers, ISBNs, readers' ratings, subjects.
 *   Google Books  (googleapis.com/books): only for a book's description when Open Library has
 *                 none, and only with a key from the owner (Admin → API integrations; restrict
 *                 it to this site's address). Without a key Google shares one small daily
 *                 allowance among everyone, which is usually used up.
 *
 * Three kinds of books for a title:
 *   Based on        the book it's adapted from: TMDB names the writer ("Novel: Andy Weir") or tags it
 *                   ("based on novel or book"); found on Open Library by the title and the writer
 *   Related         novels on the same subjects (TMDB's keywords: "space", "heist", "dystopia"…)
 *   Further reading non-fiction on what it's about (space → astronomy, a war → its history…),
 *                   offered as reading around the subject, never as a verdict on the film's accuracy
 * Everything is kept a month (Admin → API integrations), asked for only when the section is near.
 */
(function () {
  const OL = "https://openlibrary.org";
  const FIELDS = "key,title,author_name,first_publish_year,cover_i,edition_count,number_of_pages_median,publisher,isbn,ratings_average,ratings_count,subject";
  const days = (p) => (window.Site ? Site.api(p).days : 30) || 30;
  const ol = (path) => Api.get("openlibrary", OL + path, { days: days("openlibrary") });

  const cover = (id, size) => (id ? `https://covers.openlibrary.org/b/id/${id}-${size || "M"}.jpg` : "");
  function book(d) {
    return {
      key: d.key || "",
      title: d.title || "",
      authors: d.author_name || [],
      year: d.first_publish_year || null,
      cover: cover(d.cover_i, "M"),
      coverBig: cover(d.cover_i, "L"),
      editions: d.edition_count || 0,
      pages: d.number_of_pages_median || null,
      publisher: (d.publisher || [])[0] || "",
      // (an English-language edition's ISBN when there is one: 978-0 / 978-1)
      isbn: (d.isbn || []).find((x) => /^97[89][01]/.test(String(x))) || (d.isbn || []).find((x) => String(x).length === 13) || (d.isbn || [])[0] || "",
      rating: d.ratings_average ? Math.round(d.ratings_average * 10) / 10 : null,
      ratings: d.ratings_count || 0,
      url: d.key ? `${OL}${d.key}` : "",
      subjects: (d.subject || []).slice(0, 60),
    };
  }
  const norm = (s) => String(s || "").toLowerCase().replace(/\(.*?\)|[^a-z0-9]+/g, " ").replace(/\b(the|a|an)\b/g, "").replace(/\s+/g, " ").trim();

  // a few books for a search: [book]
  async function search(params, limit) {
    const q = new URLSearchParams(Object.assign({ fields: FIELDS, limit: String(limit || 10) }, params));
    const r = await ol(`/search.json?${q}`);
    return ((r && r.docs) || []).filter((d) => d.title && d.cover_i).map(book);
  }

  // a book's description (Open Library's work; Google Books when it has none and there's a key)
  async function describe(b) {
    if (!b || !b.key) return "";
    try {
      const w = await ol(`${b.key}.json`);
      const d = w && w.description;
      const text = typeof d === "string" ? d : d && d.value ? d.value : "";
      if (text) return clean(text);
    } catch (e) {}
    const key = window.Site ? Site.api("googlebooks").key : "";
    if (!key || !Api.enabled("googlebooks")) return "";
    try {
      const q = b.isbn ? `isbn:${b.isbn}` : `intitle:${b.title}${b.authors[0] ? `+inauthor:${b.authors[0]}` : ""}`;
      const r = await Api.get("googlebooks", `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&key=${encodeURIComponent(key)}`, { days: days("googlebooks"), key: `v|${q}` });
      const v = r && r.items && r.items[0] && r.items[0].volumeInfo;
      return v && v.description ? clean(v.description) : "";
    } catch (e) {
      return "";
    }
  }
  // (Open Library descriptions carry Markdown links and "----" source notes)
  const clean = (t) =>
    String(t)
      .replace(/<[^>]+>/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\r/g, "")
      .split(/\n-{3,}/)[0]
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 1200);

  /* ---------------- for a title ---------------- */

  const BASED = /based on (novel|book|young adult novel|short story|comic|graphic novel|memoir|manga|play|children's book|novella|light novel)/i;
  const TRUE = /based on (true story|real events|true events)|biography|biographical/i;

  // what it's adapted from: { book, author, kind } or null
  async function basedOn(d) {
    const keywords = (d.keywords || []).map((k) => k.name);
    const authors = (d.sourceAuthors || []).filter((a) => /novel|book|author|short story|comic|graphic|memoir|play|story/i.test(a.job));
    if (!authors.length && !keywords.some((k) => BASED.test(k))) return null;
    const titles = [...new Set([d.title, d.originalTitle].filter(Boolean))].map((t) => t.replace(/\s*\((19|20)\d\d\)\s*$/, ""));
    for (const t of titles) {
      for (const author of authors.length ? authors.map((a) => a.name) : [""]) {
        const params = author ? { title: t, author } : { title: t };
        const list = await search(params, 5).catch(() => []);
        // the title matches (or starts the book's title: "Dune" -> "Dune: Part One" isn't a book,
        // but a film called "It" is the book "It"); the oldest edition wins a tie
        const hit =
          list.find((b) => norm(b.title) === norm(t)) ||
          (author ? list.find((b) => norm(b.title).startsWith(norm(t)) || norm(t).startsWith(norm(b.title))) : null);
        if (hit) {
          hit.description = await describe(hit);
          return { book: hit, author: author || hit.authors[0] || "", kind: (authors[0] && authors[0].job) || "Novel" };
        }
      }
    }
    // the film has another name: the writer's best-known books, the closest first
    if (authors.length) {
      const list = await search({ author: authors[0].name, sort: "editions" }, 6).catch(() => []);
      if (list.length) return { book: null, author: authors[0].name, kind: authors[0].job, others: list };
    }
    return null;
  }

  // TMDB keywords -> subjects Open Library knows (novels on the same theme)
  const THEMES = [
    [/space|astronaut|outer space|spaceship|mars|alien|extraterrestrial/i, "space"],
    [/artificial intelligence|robot|android|cyborg|computer/i, "artificial intelligence"],
    [/dystopia|post-apocalyptic|apocalypse|totalitarian/i, "dystopias"],
    [/time travel/i, "time travel"],
    [/heist|bank robbery|con artist|thief/i, "heists"],
    [/serial killer|murder|detective|investigation|police/i, "detective and mystery stories"],
    [/vampire/i, "vampires"],
    [/zombie/i, "zombies"],
    [/ghost|haunted|supernatural|demon|possession/i, "ghost stories"],
    [/dragon|magic|wizard|sword and sorcery|fantasy world/i, "fantasy"],
    [/world war ii|nazi|holocaust/i, "world war, 1939-1945"],
    [/world war i\b/i, "world war, 1914-1918"],
    [/spy|espionage|cia|secret agent/i, "spy stories"],
    [/high school|coming of age|teenager/i, "coming of age"],
    [/romance|love/i, "love stories"],
    [/survival|wilderness|stranded/i, "survival"],
    [/superhero/i, "superheroes"],
    [/samurai|feudal japan/i, "samurai"],
    [/pirate/i, "pirates"],
    [/western|cowboy/i, "western stories"],
  ];
  // TMDB keywords -> non-fiction subjects (reading around the subject)
  const REFERENCE = [
    [/space|astronaut|nasa|mars|moon landing|black hole|planet|space travel|astronomy|outer space/i, "astronomy", "The universe and space flight"],
    [/artificial intelligence|robot|computer|hacker|internet|virtual reality/i, "artificial intelligence", "AI and computing"],
    [/virus|pandemic|epidemic|disease|outbreak|doctor|hospital|medical|surgeon/i, "medicine", "Medicine and disease"],
    [/dinosaur|jurassic/i, "dinosaurs", "Dinosaurs"],
    [/ocean|shark|underwater|deep sea|whale/i, "marine biology", "The ocean"],
    [/climate|natural disaster|tornado|hurricane|earthquake|volcano|tsunami/i, "natural disasters", "Natural disasters"],
    [/genetic|clone|cloning|dna/i, "genetics", "Genetics"],
    [/nuclear|atomic bomb|manhattan project/i, "nuclear physics", "Nuclear physics"],
    [/quantum|physics|time travel|wormhole|relativity/i, "physics", "Physics and time"],
    [/world war ii|nazi|holocaust|d-day/i, "world war, 1939-1945", "World War II"],
    [/world war i\b|trench warfare/i, "world war, 1914-1918", "World War I"],
    [/vietnam war/i, "vietnam war, 1961-1975", "The Vietnam War"],
    [/ancient rome|roman empire|gladiator/i, "rome, history", "Ancient Rome"],
    [/ancient egypt|pharaoh/i, "egypt, history", "Ancient Egypt"],
    [/serial killer|forensic|criminal investigation/i, "criminology", "Crime and forensics"],
    [/stock market|wall street|financial crisis|banking/i, "finance", "Money and markets"],
    [/psychology|mental illness|schizophrenia|psychiatrist|amnesia/i, "psychology", "The mind"],
    [/evolution|prehistoric|caveman/i, "evolution", "Evolution"],
    [/mountain climbing|everest|mountaineering/i, "mountaineering", "Mountaineering"],
    [/chess/i, "chess", "Chess"],
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
      const list = await search({ q: `subject:"${subject}"`, sort: "rating" }, 12).catch(() => []);
      list.forEach((b) => !seen.has(b.key) && (seen.add(b.key), books.push(b)));
    }
    return books.length ? { subject: themes.map((t) => t[1]).join(" · "), books: books.slice(0, 14) } : null;
  }

  // non-fiction about what it's about: { topics: [{ label, books }] } or null
  async function reference(d) {
    const topics = fromKeywords(d, REFERENCE).slice(0, 2);
    if (!topics.length) return null;
    const out = [];
    for (const [, subject, label] of topics) {
      const list = await search({ q: `subject:"${subject}" -subject:fiction`, sort: "rating" }, 8).catch(() => []);
      if (list.length) out.push({ label, subject, books: list.slice(0, 8) });
    }
    return out.length ? { topics: out } : null;
  }

  // a person's books: written by them, or about them (person page)
  async function forPerson(name) {
    const [by, about] = await Promise.all([search({ author: name, sort: "editions" }, 8).catch(() => []), search({ q: `subject:"${name}"`, sort: "editions" }, 8).catch(() => [])]);
    const mine = by.filter((b) => b.authors.some((a) => norm(a) === norm(name)));
    // (about them: the name must be one of the book's subjects exactly. "Stephen King" also finds
    // books on King Stephen of England otherwise)
    const aboutThem = about.filter((b) => b.subjects.some((x) => norm(x) === norm(name)) && !b.authors.some((a) => norm(a) === norm(name)));
    return { by: mine, about: aboutThem.filter((b) => !mine.some((m) => m.key === b.key)) };
  }

  window.Books = { search, describe, basedOn, related, reference, forPerson, cover };
})();
