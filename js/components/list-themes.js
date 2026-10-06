/*
 * List atmospheres: a cinematic look for each of your own lists (Watchlist page): Halloween,
 * Christmas, Rainy day, Sci-Fi, Date night… 24 of them, and two at once when a list is both
 * ("Christmas Horror Marathon": Christmas + Horror).
 *
 *  - Every atmosphere is data (ATMOS below): its colours, one kind of particle (snow, embers, rain,
 *    stars…), a few layers (fog, flicker, bokeh, light streaks…), its words and genres. The CSS
 *    ("List atmospheres" in css/style.css) draws each particle kind and layer once, coloured by the
 *    list's own --lt-* values, so a new atmosphere is one entry here and nothing else.
 *  - Two at once: the first one's colours, particles and layers, the second one's colour and layers
 *    on top (a different kind: a holiday or season with a genre or mood).
 *  - A list is Auto (the atmosphere is worked out from its name and the titles in it, and only
 *    used when the signs are strong), Manual (one you picked) or None (the site's own look, never
 *    an automatic one). Saved on the list (themeMode, theme, fx), so it follows your account.
 *  - Only transform and opacity move, which the graphics chip does on its own; the atmosphere
 *    plays only while a list is on screen (two at most, one on a phone), stops in a hidden tab,
 *    never with "reduce motion" on, for a list whose animation is off, or when the owner turned
 *    list animations off for everyone (Admin → Themes). The colours stay either way.
 */
(function () {
  // words: [phrase, weight] found in the list's name (whole words); in its titles they count for less.
  // genres: TMDB genre → weight, by the share of the list's titles that have it. months + from: the
  // time of year, a second signal only (it never makes an atmosphere on its own)
  const ATMOS = [
    /* ---- holidays ---- */
    {
      id: "halloween", label: "Halloween", emoji: "🎃", group: "holiday", hint: "Embers, drifting fog, a flickering light",
      colors: { a: "rgba(255, 112, 20, 0.36)", b: "rgba(124, 44, 196, 0.38)", c: "rgba(178, 6, 22, 0.5)", base: "rgba(22, 4, 4, 0.58)", edge: "rgba(255, 110, 40, 0.5)", dot: "#ffa04a", dot2: "#b98cff", dot3: "#e0101e" },
      parts: "embers", count: 16, layers: ["fog", "mist", "flicker", "ghost"],
      words: [["halloween", 1.5], ["hallowe'en", 1.5], ["all hallows", 1.2], ["trick or treat", 1.3], ["spooky", 0.9], ["spooky season", 1.4], ["pumpkin", 1], ["pumpkins", 1], ["october", 0.6], ["witch", 0.5], ["witches", 0.5], ["haunted", 0.5], ["ghost", 0.4], ["ghosts", 0.4], ["hocus pocus", 0.8]],
      months: [10], from: "horror",
    },
    {
      id: "christmas", label: "Christmas", emoji: "🎄", group: "holiday", hint: "Snowfall, warm lights, pine and red",
      colors: { a: "rgba(206, 26, 38, 0.4)", b: "rgba(16, 122, 66, 0.4)", c: "rgba(255, 184, 90, 0.16)", base: "rgba(6, 18, 12, 0.55)", edge: "rgba(235, 80, 64, 0.5)", dot: "#ffffff", dot2: "#ffc96b" },
      parts: "snow", count: 30, layers: ["garland", "snowbank", "pines", "bokeh"],
      words: [["christmas", 1.5], ["xmas", 1.5], ["x-mas", 1.5], ["santa", 1], ["noel", 0.8], ["festive", 0.8], ["holiday season", 0.9], ["mistletoe", 1], ["reindeer", 0.9], ["snowman", 0.6], ["grinch", 0.9], ["elf", 0.5], ["december", 0.5], ["yuletide", 1.2], ["home alone", 0.6]],
      months: [12],
    },
    {
      id: "easter", label: "Easter", emoji: "🌷", group: "holiday", hint: "Soft pastels and falling petals",
      colors: { a: "rgba(255, 168, 210, 0.32)", b: "rgba(150, 222, 140, 0.28)", base: "rgba(30, 20, 28, 0.4)", edge: "rgba(255, 190, 222, 0.45)", dot: "#ffc3dc", dot2: "#fff2a8" },
      parts: "petals", count: 16, layers: ["sun"],
      words: [["easter", 1.5], ["easter bunny", 1.5], ["bunny", 0.6], ["easter eggs", 1.2], ["resurrection", 0.4]],
      months: [3, 4],
    },
    {
      id: "valentine", label: "Valentine's Day", emoji: "💘", group: "holiday", hint: "Burgundy, soft pink bokeh, rising hearts",
      colors: { a: "rgba(206, 22, 72, 0.38)", b: "rgba(255, 120, 172, 0.26)", base: "rgba(30, 4, 12, 0.55)", edge: "rgba(255, 92, 142, 0.48)", dot: "#ff8fb5", dot2: "#ffd0e0" },
      parts: "hearts", count: 10, layers: ["bokeh"],
      words: [["valentine", 1.5], ["valentines", 1.5], ["valentine's", 1.5], ["valentine's day", 1.6], ["sweetheart", 0.6], ["be mine", 0.8]],
      months: [2], from: "romance",
    },
    {
      id: "newyear", label: "New Year's Eve", emoji: "🥂", group: "holiday", hint: "Navy and gold, tiny light bursts",
      colors: { a: "rgba(255, 200, 90, 0.28)", b: "rgba(40, 62, 170, 0.38)", base: "rgba(2, 6, 22, 0.6)", edge: "rgba(255, 212, 120, 0.45)", dot: "#ffd77a", dot2: "#ffffff" },
      parts: "sparks", count: 18, layers: ["burst"],
      words: [["new year", 1.4], ["new year's", 1.4], ["new years", 1.4], ["new year's eve", 1.6], ["new years eve", 1.6], ["nye", 1.3], ["countdown", 0.7], ["auld lang syne", 1.2]],
      months: [12, 1],
    },
    {
      id: "thanksgiving", label: "Thanksgiving", emoji: "🍂", group: "holiday", hint: "Falling leaves, a warm golden glow",
      colors: { a: "rgba(232, 122, 30, 0.34)", b: "rgba(150, 40, 20, 0.36)", base: "rgba(30, 14, 4, 0.55)", edge: "rgba(240, 150, 60, 0.46)", dot: "#ffb35c", dot2: "#d0542e" },
      parts: "leaves", count: 14, layers: ["glow"],
      words: [["thanksgiving", 1.5], ["friendsgiving", 1.4], ["turkey day", 1.3], ["turkey", 0.6], ["grateful", 0.6], ["gratitude", 0.6], ["harvest", 0.6]],
      months: [11],
    },

    /* ---- seasons and weather ---- */
    {
      id: "winter", label: "Winter", emoji: "❄️", group: "season", hint: "Icy blue, frost and gentle snow",
      colors: { a: "rgba(110, 170, 255, 0.32)", b: "rgba(200, 230, 255, 0.16)", base: "rgba(6, 14, 30, 0.55)", edge: "rgba(160, 210, 255, 0.46)", dot: "#eaf4ff", dot2: "#9cc8ff" },
      parts: "snow", count: 18, layers: ["frost"],
      words: [["winter", 1.3], ["wintry", 1.2], ["snow", 0.8], ["snowy", 0.9], ["blizzard", 1], ["frost", 0.8], ["frozen", 0.5], ["ice", 0.4], ["cold", 0.4]],
      months: [12, 1, 2],
    },
    {
      id: "spring", label: "Spring", emoji: "🌸", group: "season", hint: "Blossom pink, fresh green, drifting petals",
      colors: { a: "rgba(255, 150, 200, 0.3)", b: "rgba(120, 200, 120, 0.24)", base: "rgba(24, 18, 22, 0.4)", edge: "rgba(255, 170, 210, 0.44)", dot: "#ffb7d5", dot2: "#c8f0b0" },
      parts: "petals", count: 14, layers: ["sun"],
      words: [["spring", 1.2], ["springtime", 1.3], ["blossom", 1], ["bloom", 0.8], ["flowers", 0.6]],
      months: [3, 4, 5],
    },
    {
      id: "summer", label: "Summer", emoji: "☀️", group: "season", hint: "Sunset gold, warm light, sunlit motes",
      colors: { a: "rgba(255, 180, 50, 0.36)", b: "rgba(255, 90, 60, 0.24)", base: "rgba(30, 14, 4, 0.45)", edge: "rgba(255, 200, 90, 0.48)", dot: "#ffd77a", dot2: "#ff9a5c" },
      parts: "motes", count: 14, layers: ["sun"],
      words: [["summer", 1.3], ["summertime", 1.4], ["beach", 0.9], ["summer vacation", 1.5], ["sunshine", 0.8], ["sunny", 0.7], ["vacation", 0.6], ["heatwave", 1]],
      months: [6, 7, 8],
    },
    {
      id: "rainy", label: "Rainy day", emoji: "🌧️", group: "season", hint: "Blue-grey, falling rain, wet reflections",
      colors: { a: "rgba(80, 112, 168, 0.34)", b: "rgba(60, 70, 104, 0.32)", base: "rgba(6, 10, 20, 0.55)", edge: "rgba(140, 172, 222, 0.42)", dot: "#b9d3ff", dot2: "#e6efff" },
      parts: "rain", count: 26, layers: ["reflect"],
      words: [["rainy day", 1.6], ["rainy days", 1.6], ["rainy", 1.2], ["rain", 0.9], ["stormy", 0.8], ["storm", 0.6], ["drizzle", 0.9]],
    },

    /* ---- moods ---- */
    {
      id: "cozy", label: "Cozy", emoji: "☕", group: "mood", hint: "Warm amber light, soft and slow",
      colors: { a: "rgba(255, 168, 80, 0.32)", b: "rgba(140, 80, 40, 0.32)", base: "rgba(28, 16, 6, 0.55)", edge: "rgba(255, 180, 100, 0.44)", dot: "#ffcf8a", dot2: "#ff9f5a" },
      parts: "motes", count: 10, layers: ["glow"],
      words: [["cozy", 1.4], ["cosy", 1.4], ["comfort", 1], ["comfort movies", 1.5], ["comfort films", 1.5], ["feel good", 1], ["feel-good", 1], ["wholesome", 1], ["blanket", 0.8], ["hot chocolate", 1], ["lazy sunday", 1], ["sunday", 0.3]],
      genres: { Family: 0.4 },
    },
    {
      id: "emotional", label: "Emotional", emoji: "💧", group: "mood", hint: "Deep blue and violet, soft rain",
      colors: { a: "rgba(72, 92, 204, 0.34)", b: "rgba(124, 62, 176, 0.32)", base: "rgba(6, 6, 24, 0.6)", edge: "rgba(132, 142, 240, 0.44)", dot: "#a9b8ff", dot2: "#d2b8ff" },
      parts: "rain", count: 14, layers: ["haze"],
      words: [["cry", 1.3], ["crying", 1.3], ["make you cry", 1.6], ["tears", 1.1], ["tearjerker", 1.5], ["tearjerkers", 1.5], ["tear-jerker", 1.5], ["sad", 1.2], ["emotional", 1.2], ["heartbreak", 1], ["heartbreaking", 1.1], ["grief", 0.9], ["melancholy", 1.3], ["bittersweet", 1]],
      genres: { Drama: 0.3 },
    },
    {
      id: "romance", label: "Romantic", emoji: "🌹", group: "mood", hint: "Burgundy, warm light, soft bokeh",
      colors: { a: "rgba(192, 30, 82, 0.36)", b: "rgba(255, 112, 162, 0.24)", base: "rgba(28, 4, 14, 0.55)", edge: "rgba(255, 102, 152, 0.46)", dot: "#ff9cc0", dot2: "#ffd6a8" },
      parts: "hearts", count: 7, layers: ["bokeh"],
      words: [["romance", 1.4], ["romantic", 1.4], ["date night", 1.6], ["love stories", 1.2], ["love story", 1.1], ["love", 0.7], ["rom-com", 1.1], ["romcom", 1.1], ["rom-coms", 1.1], ["couples", 0.7], ["swoon", 1]],
      genres: { Romance: 1 },
    },
    {
      id: "comedy", label: "Funny", emoji: "😄", group: "mood", hint: "Brighter, playful floating shapes",
      colors: { a: "rgba(255, 192, 60, 0.3)", b: "rgba(80, 180, 255, 0.26)", base: "rgba(20, 16, 30, 0.4)", edge: "rgba(255, 210, 90, 0.44)", dot: "#ffd36b", dot2: "#7cc8ff" },
      parts: "shapes", count: 12, layers: [],
      words: [["comedy", 1.4], ["comedies", 1.4], ["funny", 1.3], ["laugh", 1.1], ["laughs", 1.1], ["laughing", 1], ["hilarious", 1.3], ["sitcom", 0.9], ["sitcoms", 0.9], ["jokes", 0.8], ["lol", 0.9]],
      genres: { Comedy: 1 },
    },
    {
      id: "dark", label: "Late night", emoji: "🌙", group: "mood", hint: "Near-black, deep shadows, a dim flicker",
      colors: { a: "rgba(110, 18, 36, 0.32)", b: "rgba(22, 32, 80, 0.4)", base: "rgba(0, 0, 0, 0.6)", edge: "rgba(170, 60, 84, 0.4)", dot: "#c9d2ff", dot2: "#ff7a7a" },
      parts: "stars", count: 12, layers: ["vignette", "flicker"],
      words: [["late night", 1.3], ["midnight", 1.1], ["after dark", 1.3], ["dark", 0.8], ["darkness", 0.9], ["nocturnal", 1], ["3am", 1], ["night", 0.4], ["sinister", 0.8], ["disturbing", 0.9], ["twisted", 0.8]],
      genres: { Thriller: 0.3 },
    },
    {
      id: "nostalgic", label: "Nostalgic", emoji: "📼", group: "mood", hint: "Faded warm tones, film grain, dust",
      colors: { a: "rgba(232, 172, 92, 0.28)", b: "rgba(150, 110, 200, 0.24)", base: "rgba(24, 18, 10, 0.55)", edge: "rgba(232, 192, 132, 0.42)", dot: "#f5d59a", dot2: "#d9b8ff" },
      parts: "dust", count: 12, layers: ["grain", "vignette"],
      words: [["nostalgia", 1.4], ["nostalgic", 1.4], ["childhood", 1.2], ["80s", 1.1], ["90s", 1.1], ["eighties", 1.1], ["nineties", 1.1], ["retro", 1.1], ["old school", 0.9], ["throwback", 1.1], ["vintage", 1]],
    },
    {
      id: "roadtrip", label: "Road trip", emoji: "🚗", group: "mood", hint: "Warm sunset, passing road lights",
      colors: { a: "rgba(255, 140, 60, 0.32)", b: "rgba(120, 60, 164, 0.3)", base: "rgba(24, 10, 16, 0.5)", edge: "rgba(255, 162, 92, 0.44)", dot: "#ffcf7a", dot2: "#ff8a5c" },
      parts: "motes", count: 8, layers: ["road", "sun"],
      words: [["road trip", 1.6], ["roadtrip", 1.6], ["road trips", 1.6], ["on the road", 1.2], ["open road", 1.3], ["highway", 0.9], ["journey", 0.7], ["travel", 0.6]],
      genres: { Adventure: 0.25 },
    },

    /* ---- genres ---- */
    {
      id: "horror", label: "Horror", emoji: "🩸", group: "genre", hint: "Black and blood red, fog, a failing light",
      colors: { a: "rgba(176, 10, 22, 0.4)", b: "rgba(40, 0, 4, 0.55)", base: "rgba(6, 0, 0, 0.65)", edge: "rgba(205, 30, 40, 0.5)", dot: "#ff5a4f", dot2: "#7a0a12" },
      parts: "ash", count: 12, layers: ["fog", "flicker", "vignette"],
      words: [["horror", 1.5], ["horrors", 1.5], ["scary", 1.2], ["terror", 1], ["terrifying", 1.1], ["creepy", 1], ["slasher", 1.3], ["slashers", 1.3], ["frightening", 1], ["fright", 1], ["nightmare", 0.8], ["nightmares", 0.8], ["gore", 1], ["monsters", 0.6], ["zombie", 0.7], ["demon", 0.7], ["haunted", 0.6], ["spooky", 0.5], ["scream", 0.6]],
      genres: { Horror: 1 },
    },
    {
      id: "space", label: "Sci-Fi & Space", emoji: "🚀", group: "genre", hint: "Deep navy, violet nebula, a field of stars",
      colors: { a: "rgba(92, 72, 232, 0.36)", b: "rgba(30, 140, 232, 0.28)", base: "rgba(2, 4, 18, 0.65)", edge: "rgba(132, 122, 255, 0.46)", dot: "#ffffff", dot2: "#9ee7ff" },
      parts: "stars", count: 28, layers: ["nebula"],
      words: [["space", 1.3], ["sci-fi", 1.4], ["scifi", 1.4], ["science fiction", 1.4], ["galaxy", 1.1], ["cosmic", 1], ["cosmos", 1], ["alien", 0.9], ["aliens", 0.9], ["interstellar", 0.8], ["star wars", 1], ["star trek", 1], ["astronaut", 1], ["mars", 0.7], ["robots", 0.6], ["future", 0.5]],
      genres: { "Science Fiction": 1, "Sci-Fi & Fantasy": 0.6 },
    },
    {
      id: "fantasy", label: "Fantasy", emoji: "✨", group: "genre", hint: "Deep blue and violet, drifting magic",
      colors: { a: "rgba(112, 62, 222, 0.34)", b: "rgba(40, 122, 222, 0.28)", base: "rgba(10, 6, 28, 0.6)", edge: "rgba(172, 132, 255, 0.46)", dot: "#d6c2ff", dot2: "#9ee7ff" },
      parts: "sparks", count: 16, layers: ["glow"],
      words: [["fantasy", 1.4], ["magic", 1.1], ["magical", 1.1], ["wizard", 1], ["wizards", 1], ["wizarding", 1.1], ["dragon", 0.8], ["dragons", 1], ["middle-earth", 1.1], ["harry potter", 1], ["lord of the rings", 1], ["fairy tale", 1], ["fairy tales", 1], ["enchanted", 1], ["mythical", 1], ["quest", 0.5]],
      genres: { Fantasy: 1, "Sci-Fi & Fantasy": 0.4 },
    },
    {
      id: "apocalypse", label: "Apocalypse", emoji: "☢️", group: "genre", hint: "Scorched red and orange, smoke, falling ash",
      colors: { a: "rgba(224, 82, 20, 0.34)", b: "rgba(124, 10, 10, 0.42)", base: "rgba(16, 4, 2, 0.65)", edge: "rgba(232, 102, 40, 0.46)", dot: "#c9b9ad", dot2: "#ff7a2a" },
      parts: "ash", count: 20, layers: ["smoke", "vignette"],
      words: [["apocalypse", 1.6], ["apocalyptic", 1.6], ["post-apocalyptic", 1.6], ["end of the world", 1.7], ["end of days", 1.5], ["doomsday", 1.5], ["armageddon", 1.2], ["last stand", 1.2], ["survival", 1], ["survive", 0.8], ["nuclear", 1], ["disaster", 1], ["disasters", 1], ["extinction", 1.2], ["wasteland", 1.2], ["collapse", 0.8], ["humanity", 0.4], ["zombies", 0.7], ["mad max", 0.9], ["fury road", 0.6], ["the road", 0.4], ["2012", 0.5], ["war of the worlds", 0.8], ["day after tomorrow", 0.9], ["deep impact", 0.9], ["i am legend", 0.9], ["28 days later", 0.9], ["world war z", 0.9]],
      genres: { War: 0.2 },
    },
    {
      id: "action", label: "Action", emoji: "💥", group: "genre", hint: "Dark steel, red-orange light streaks",
      colors: { a: "rgba(232, 62, 30, 0.32)", b: "rgba(255, 142, 30, 0.22)", base: "rgba(12, 6, 4, 0.55)", edge: "rgba(242, 92, 52, 0.46)", dot: "#ffb070", dot2: "#ff5a3a" },
      parts: "sparks", count: 8, layers: ["streaks", "vignette"],
      words: [["action", 1.4], ["explosive", 1], ["explosions", 1], ["adrenaline", 1.2], ["high octane", 1.3], ["car chase", 1.1], ["car chases", 1.1], ["badass", 1.1], ["blockbuster", 0.6], ["blockbusters", 0.6], ["heist", 0.7], ["fight", 0.5]],
      genres: { Action: 1, "Action & Adventure": 0.8 },
    },
    {
      id: "noir", label: "Mystery & Noir", emoji: "🕵️", group: "genre", hint: "Black and steel blue, rain, reflections",
      colors: { a: "rgba(72, 112, 184, 0.3)", b: "rgba(255, 255, 255, 0.08)", base: "rgba(2, 4, 10, 0.65)", edge: "rgba(172, 192, 232, 0.38)", dot: "#cfe0ff", dot2: "#ffffff" },
      parts: "rain", count: 16, layers: ["reflect", "grain", "vignette"],
      words: [["noir", 1.6], ["film noir", 1.7], ["mystery", 1.3], ["mysteries", 1.3], ["detective", 1.1], ["detectives", 1.1], ["whodunit", 1.5], ["whodunnit", 1.5], ["murder mystery", 1.6], ["crime", 0.8], ["true crime", 0.8], ["investigation", 0.9], ["black and white", 1], ["suspense", 0.9], ["sherlock", 1]],
      genres: { Mystery: 1, Crime: 0.6 },
    },
    {
      id: "western", label: "Western", emoji: "🤠", group: "genre", hint: "Dusty brown and gold, a low sun",
      colors: { a: "rgba(222, 142, 50, 0.32)", b: "rgba(122, 62, 20, 0.36)", base: "rgba(26, 14, 4, 0.6)", edge: "rgba(222, 162, 80, 0.46)", dot: "#e8c08a", dot2: "#ffb347" },
      parts: "dust", count: 14, layers: ["sun", "grain"],
      words: [["western", 1.6], ["westerns", 1.6], ["cowboy", 1.3], ["cowboys", 1.3], ["wild west", 1.6], ["frontier", 0.9], ["outlaw", 1], ["outlaws", 1], ["gunslinger", 1.1], ["sheriff", 0.9], ["saloon", 1], ["ranch", 0.8]],
      genres: { Western: 1 },
    },
  ];
  const THEMES = ATMOS; // (the name the rest of the site knows them by)
  const GROUPS = [
    ["holiday", "Holidays"],
    ["season", "Seasons & weather"],
    ["mood", "Moods"],
    ["genre", "Genres"],
  ];
  // the ones that existed before the owner's switches were kept as "off": a saved "available" list
  // only knew these
  const OLD = ["halloween", "christmas", "winter", "spring", "summer", "noir", "space"];
  const THRESHOLD = 0.55; // (an atmosphere is put on a list automatically only above this)
  const SECOND = 0.5; // (…and a second one beside it above this)

  const byId = (id) => ATMOS.find((t) => t.id === id) || null;
  // the atmospheres the owner offers (Admin → Themes); cfg: the themes settings (the saved ones)
  function offOf(cfg) {
    const t = cfg || (window.Site ? Site.get().themes : {}) || {};
    if (Array.isArray(t.off)) return t.off;
    return Array.isArray(t.available) ? OLD.filter((id) => !t.available.includes(id)) : [];
  }
  const offered = (cfg) => {
    const off = offOf(cfg);
    return ATMOS.filter((t) => !off.includes(t.id));
  };
  const enabled = () => !window.Site || (Site.feature("listThemes") && Site.get().themes.listThemes !== false);
  const motionOk = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !(window.Site && Site.get().themes.animations === false);
  const phone = () => window.matchMedia("(max-width: 700px)").matches;

  /* ---------------- detection: how strongly a list says each atmosphere ---------------- */

  const clean = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[^\p{L}\p{N}' -]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const RE = new Map();
  const has = (text, phrase) => {
    if (!RE.has(phrase)) RE.set(phrase, new RegExp(`(^|[^\\p{L}\\p{N}])${escRe(phrase)}(?=$|[^\\p{L}\\p{N}])`, "u"));
    return RE.get(phrase).test(text);
  };
  // the words of one text for one atmosphere: the weights of the phrases found (a longer phrase
  // counts, the shorter ones inside it don't count again)
  function wordScore(text, words) {
    let found = words.filter(([w]) => has(text, w));
    found = found.filter(([w]) => !found.some(([o]) => o !== w && o.length > w.length && o.includes(w)));
    return found.reduce((s, [, n]) => s + n, 0);
  }

  // list: { name, description? }, items: its library titles → [{ id, score, conf }], strongest first
  function detect(list, items, when) {
    const name = clean(list && list.name);
    const about = clean(list && list.description);
    const titles = (items || []).map((i) => clean(i.title));
    const n = titles.length;
    const month = (when || new Date()).getMonth() + 1;
    const raw = {};
    const named = {}; // (its name or description says it: needed to be the second of two)
    ATMOS.forEach((t) => {
      // its name (the strongest sign), a description, then the titles in it (a little each)
      let s = Math.min(2, wordScore(name, t.words)) + Math.min(1, wordScore(about, t.words) * 0.6);
      named[t.id] = s > 0;
      let inTitles = 0;
      titles.forEach((x) => (inTitles += wordScore(x, t.words) * 0.35));
      s += Math.min(0.8, inTitles);
      // the share of its titles in the genres that go with it (more titles, more sure)
      if (t.genres && n) {
        let g = 0;
        Object.entries(t.genres).forEach(([genre, w]) => {
          const share = items.filter((i) => (i.genres || []).includes(genre)).length / n;
          g = Math.max(g, share * w);
        });
        s += Math.min(0.9, g * 0.95 * Math.min(1, n / 3));
      }
      raw[t.id] = s;
    });
    // the time of year: only adds to what's there (a sci-fi list in December stays sci-fi)
    ATMOS.forEach((t) => {
      if (!t.months || !t.months.includes(month)) return;
      if (raw[t.id] > 0) raw[t.id] += 0.25;
      if (t.from && raw[t.from] > 0) raw[t.id] += raw[t.from] * 0.6;
    });
    const ORDER = GROUPS.map((g) => g[0]);
    return ATMOS.map((t) => ({ id: t.id, score: raw[t.id], named: named[t.id], conf: Math.round((1 - Math.exp(-1.1 * raw[t.id])) * 100) / 100 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || ORDER.indexOf(byId(a.id).group) - ORDER.indexOf(byId(b.id).group));
  }

  // two that make sense together: a holiday or season with a mood or genre, or a mood with a genre
  const pairs = (a, b) => a.group !== b.group && !(["holiday", "season"].includes(a.group) && ["holiday", "season"].includes(b.group));

  // what a list wears: { mode, ids: [first, second?], detected: [...], offered }
  function resolve(list, items) {
    const mode = !list ? "none" : list.themeMode || (list.theme ? "manual" : "auto");
    const out = { mode, ids: [], detected: [] };
    if (!list || !enabled()) return out;
    const ok = offered().map((t) => t.id);
    out.detected = detect(list, items).filter((d) => ok.includes(d.id));
    if (mode === "manual" && ok.includes(list.theme)) out.ids = [list.theme];
    if (mode === "auto") {
      const [first, ...rest] = out.detected;
      if (first && first.conf >= THRESHOLD) {
        out.ids = [first.id];
        // (a second one only when the name asks for it too: "Christmas Horror Marathon"; a
        // Christmas list of comedies stays Christmas, not Christmas + Funny)
        const second = rest.find((d) => d.conf >= SECOND && d.named && pairs(byId(first.id), byId(d.id)));
        if (second) out.ids.push(second.id);
      }
    }
    return out;
  }
  const nameOf = (ids) => ids.map((id) => byId(id).label).join(" + ");
  const itemsOf = (list) => (list && list.items ? list.items.map((id) => Store.get(id)).filter(Boolean) : []);

  /* ---------------- the look: colours, one particle kind, a few layers ---------------- */

  // (a fixed pattern per atmosphere, not random: the row looks the same on every visit)
  function particles(n, seed) {
    let x = seed;
    const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: n }, () => {
      const left = (rnd() * 100).toFixed(1);
      const top = (rnd() * 100).toFixed(1);
      const delay = (-rnd() * 14).toFixed(2);
      const dur = (9 + rnd() * 9).toFixed(2);
      const size = (0.6 + rnd() * 0.9).toFixed(2);
      const drift = ((rnd() - 0.5) * 60).toFixed(0);
      return `<i style="--x:${left}%;--y:${top}%;--d:${delay}s;--t:${dur}s;--s:${size};--dx:${drift}px"></i>`;
    }).join("");
  }
  const seedOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);

  // a layer: one or two plain elements, drawn by the CSS (.lt-l-<name>)
  const LAYER = {
    fog: '<b class="lt-l lt-l-fog"></b><b class="lt-l lt-l-fog two"></b>',
    smoke: '<b class="lt-l lt-l-fog smoke"></b><b class="lt-l lt-l-fog smoke two"></b>',
    burst: '<b class="lt-l lt-l-burst"></b><b class="lt-l lt-l-burst two"></b><b class="lt-l lt-l-burst three"></b>',
    streaks: '<b class="lt-l lt-l-streak"></b><b class="lt-l lt-l-streak two"></b>',
    ghost: '<b class="lt-l lt-l-ghost"><i class="fa-solid fa-ghost"></i></b>',
    // wisps of fog drifting right across, over the posters too (in front: OVER)
    mist: '<b class="lt-l lt-l-mist"></b><b class="lt-l lt-l-mist two"></b><b class="lt-l lt-l-mist three"></b>',
  };
  // the layers that pass in front of the posters (the rest stay behind them)
  const OVER = ["mist"];
  const layerHtml = (name) => LAYER[name] || `<b class="lt-l lt-l-${name}"></b>`;

  // the look of one or two atmospheres: { vars, parts, layers }
  function look(ids) {
    const [a, b] = ids.map(byId);
    const c = a.colors;
    const vars = {
      "--lt-a": c.a,
      "--lt-b": b ? b.colors.a : c.b,
      "--lt-base": c.base,
      "--lt-edge": c.edge,
      "--lt-dot": c.dot,
      "--lt-dot2": b ? b.colors.dot : c.dot2 || c.dot,
      // (a third light from below and a third particle colour, for the ones that have them:
      // Halloween's blood red)
      "--lt-c": c.c || (b && b.colors.c) || "transparent",
      "--lt-dot3": c.dot3 || c.dot,
    };
    const parts = a.parts || (b && b.parts) || "";
    const count = a.parts ? a.count : b ? b.count : 0;
    // (the first one's layers, then the second's; five at most)
    const layers = [...new Set([...(a.layers || []), ...((b && b.layers) || [])])].slice(0, 5);
    return { vars, parts, count, layers };
  }

  function fxLayer(ids) {
    const l = look(ids);
    const n = Math.round(l.count * (phone() ? 0.5 : 1));
    return `<span class="lt-fx" aria-hidden="true">${l.layers
      .filter((x) => !OVER.includes(x))
      .map(layerHtml)
      .join("")}${l.parts && n ? `<span class="lt-parts" data-k="${l.parts}">${particles(n, seedOf(ids.join("+")))}</span>` : ""}</span>`;
  }
  // the ones in front, or ""
  function overLayer(ids) {
    const over = look(ids).layers.filter((x) => OVER.includes(x));
    return over.length ? `<span class="lt-over" aria-hidden="true">${over.map(layerHtml).join("")}</span>` : "";
  }
  const dropFx = (sec) => sec.querySelectorAll(":scope > .lt-fx, :scope > .lt-over").forEach((x) => x.remove());

  /* ---------------- playing only what's on screen ---------------- */

  const shown = new Set(); // dressed and on screen
  const watched = new Set();
  function replay() {
    const max = phone() ? 1 : 2;
    const on = document.visibilityState !== "hidden" && motionOk();
    const play = [...shown]
      .filter((el) => el.isConnected && el.dataset.fx === "1")
      .sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .slice(0, on ? max : 0);
    watched.forEach((el) => el.classList.toggle("lt-play", play.includes(el)));
  }
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => (en.isIntersecting ? shown.add(en.target) : shown.delete(en.target)));
            replay();
          },
          { rootMargin: "40px" }
        )
      : null;
  document.addEventListener("visibilitychange", replay);

  // sec: the section to dress; list: { name, items, themeMode, theme, fx } (or null: none);
  // opts.preview: the pop-up's preview (always plays, isn't counted)
  function apply(sec, list, opts) {
    try {
      const r = resolve(list, itemsOf(list));
      const ids = r.ids.filter(byId);
      const fx = !!ids.length && list.fx !== false;
      const sign = `${ids.join("+")}|${fx ? 1 : 0}|${phone() ? "p" : "d"}`;
      if (sec.dataset.lt === sign) return r;
      sec.dataset.lt = sign;
      sec.dataset.theme = ids[0] || "";
      sec.dataset.fx = fx ? "1" : "0";
      sec.classList.toggle("lt", !!ids.length);
      dropFx(sec);
      const emblem = sec.querySelector(".lt-emblem");
      if (emblem) emblem.remove();
      ["--lt-a", "--lt-b", "--lt-c", "--lt-base", "--lt-edge", "--lt-dot", "--lt-dot2", "--lt-dot3"].forEach((v) => sec.style.removeProperty(v));
      sec.classList.remove("lt-play");
      if (io && !(opts && opts.preview)) {
        io.unobserve(sec);
        shown.delete(sec);
        watched.delete(sec);
      }
      if (!ids.length) return replay(), r;
      Object.entries(look(ids).vars).forEach(([k, v]) => sec.style.setProperty(k, v));
      sec.insertAdjacentHTML("afterbegin", fxLayer(ids));
      sec.insertAdjacentHTML("beforeend", overLayer(ids));
      const h2 = sec.querySelector("h2, .wl-title");
      if (h2) h2.insertAdjacentHTML("afterbegin", `<span class="lt-emblem" aria-hidden="true" title="${UI.esc(nameOf(ids))}">${byId(ids[0]).emoji}</span>`);
      if (opts && opts.preview) sec.classList.toggle("lt-play", fx && motionOk());
      else if (fx && io) {
        watched.add(sec);
        io.observe(sec);
      }
      return r;
    } catch (e) {
      // (whatever goes wrong, the list keeps the site's own look)
      sec.classList.remove("lt", "lt-play");
      dropFx(sec);
      if (window.Store && Store.logError) Store.logError(`List atmosphere: ${e.message}`, "list-themes.js");
      return null;
    }
  }
  // a re-draw on a phone ↔ computer change (fewer particles on a phone)
  let wasPhone = phone();
  window.addEventListener("resize", () => {
    if (phone() === wasPhone) return;
    wasPhone = phone();
    replay();
  });

  /* ---------------- the Appearance pop-up (Theme, on your list) ---------------- */

  const swatch = (t) => `background: radial-gradient(120% 120% at 0% 0%, ${t.colors.a.replace(/[\d.]+\)$/, "0.95)")}, transparent 70%), radial-gradient(120% 120% at 100% 100%, ${t.colors.b.replace(/[\d.]+\)$/, "0.9)")}, transparent 70%), #111`;
  const pct = (c) => `${Math.round(c * 100)}%`;

  let overlay = null;
  function picker(listId) {
    const list = Store.lists().find((l) => l.id === listId);
    if (!list) return;
    if (!overlay) overlay = Cards.makeOverlay("lt-modal", '<div class="lt-in"></div>');
    const items = itemsOf(list);
    const startMode = list.themeMode || (list.theme ? "manual" : "auto");
    // what's being chosen (saved only with Save)
    const pick = { mode: startMode, theme: list.theme || "", fx: list.fx !== false };
    const draftList = () => Object.assign({}, list, { themeMode: pick.mode, theme: pick.theme || undefined, fx: pick.fx });
    const posters = items
      .filter((i) => Cards.posterOf(i))
      .slice(0, 6)
      .map((i) => `<img src="${Store.poster(Cards.posterOf(i), "w154")}" alt="" />`)
      .join("");

    const modeBtn = (m, icon, text) =>
      `<button type="button" class="top10-tab${pick.mode === m ? " active" : ""}" role="radio" aria-checked="${pick.mode === m}" data-lt-mode="${m}"><i class="fa-solid ${icon}"></i> ${text}</button>`;
    const autoPanel = () => {
      const r = resolve(Object.assign(draftList(), { themeMode: "auto" }), items);
      const top = r.detected.slice(0, 4);
      const found = r.ids.length
        ? `<div class="lt-found"><span class="lt-found-em">${byId(r.ids[0]).emoji}</span><span><small>Detected</small><b>${UI.esc(nameOf(r.ids))}</b></span>
            <span class="lt-conf" title="How sure: ${pct(r.detected[0].conf)}"><i style="width:${pct(r.detected[0].conf)}"></i></span><em>${pct(r.detected[0].conf)}</em></div>`
        : `<div class="lt-found none"><span class="lt-found-em"><i class="fa-solid fa-circle-half-stroke"></i></span><span><small>Detected</small><b>No strong atmosphere</b></span></div>
           <p class="lt-note">Nothing in its name or its titles points clearly at one, so it keeps the site's own look. Name it for a mood ("Rainy day movies", "Date night") or pick one yourself.</p>`;
      const also = top.length
        ? `<p class="lt-also"><span>Signs found:</span> ${top.map((d) => `<button type="button" class="lt-chip" data-theme-pick="${d.id}" title="Use ${UI.esc(byId(d.id).label)}">${byId(d.id).emoji} ${UI.esc(byId(d.id).label)} <em>${pct(d.conf)}</em></button>`).join("")}</p>`
        : "";
      return `${found}${also}
        <p class="lt-note">Worked out from the list's name and the titles in it (their genres too), and kept up to date as you add titles.</p>
        <div class="lt-auto-btns">
          ${r.ids.length ? `<button type="button" class="btn" data-theme-pick="${r.ids[0]}"><i class="fa-solid fa-thumbtack"></i> Keep ${UI.esc(byId(r.ids[0]).label)}</button>` : ""}
          <button type="button" class="btn" data-lt-mode="manual"><i class="fa-solid fa-palette"></i> Change</button>
          <button type="button" class="btn" data-lt-mode="none"><i class="fa-solid fa-ban"></i> Disable</button>
        </div>`;
    };
    const manualPanel = () =>
      GROUPS.map(([g, title]) => {
        const opts = offered().filter((t) => t.group === g);
        if (!opts.length) return "";
        return `<h4 class="lt-group">${title}</h4><div class="lt-grid" role="radiogroup" aria-label="${title}">${opts
          .map(
            (t) => `<button type="button" class="lt-opt${pick.theme === t.id ? " on" : ""}" role="radio" aria-checked="${pick.theme === t.id}" data-theme-pick="${t.id}">
              <span class="lt-swatch" style="${swatch(t)}"><span>${t.emoji}</span></span><b>${UI.esc(t.label)}</b><small>${UI.esc(t.hint)}</small></button>`
          )
          .join("")}</div>`;
      }).join("");

    const draw = () => {
      const panel = pick.mode === "auto" ? autoPanel() : pick.mode === "manual" ? manualPanel() : `<p class="lt-note lt-none-note"><i class="fa-solid fa-ban"></i> The site's own look. No atmosphere is put on this list until you switch back to Auto or pick one.</p>`;
      const hasLook = pick.mode !== "none" && (pick.mode === "auto" || pick.theme);
      overlay.querySelector(".lt-in").innerHTML = `
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i> Appearance</h3>
        <section class="lt-preview">
          <div class="row-head"><h2><i class="fa-solid fa-list-ul"></i> ${UI.esc(list.name)}</h2></div>
          <div class="lt-pv-row">${posters || '<span class="lt-pv-empty">Add titles to see them here</span>'}</div>
        </section>
        <div class="top10-switch lt-modes" role="radiogroup" aria-label="Atmosphere">
          ${modeBtn("auto", "fa-wand-magic-sparkles", "Auto")}${modeBtn("manual", "fa-palette", "Choose")}${modeBtn("none", "fa-ban", "None")}
        </div>
        <div class="lt-panel">${panel}</div>
        <label class="menu-switch lt-anim${hasLook ? "" : " off"}">
          <i class="fa-solid fa-snowflake"></i><span>Animated atmosphere<small>${motionOk() ? "Plays only while the list is on screen" : "Off: reduce motion is on, or animations are off for the site"}</small></span>
          <input type="checkbox" class="lt-fx-switch"${pick.fx ? " checked" : ""}${!hasLook || !motionOk() ? " disabled" : ""} />
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>
        <div class="lt-actions"><button type="button" class="btn lt-cancel">Cancel</button><button type="button" class="btn btn-primary lt-save">Save</button></div>`;
      // the preview, live (the panel scrolls; the preview stays put)
      apply(overlay.querySelector(".lt-preview"), draftList(), { preview: true });
    };
    draw();
    overlay.onclick = (e) => {
      const m = e.target.closest("[data-lt-mode]");
      if (m) {
        pick.mode = m.dataset.ltMode;
        // (Choose: starts on what Auto found, or what was picked before)
        if (pick.mode === "manual" && !pick.theme) {
          const r = resolve(Object.assign(draftList(), { themeMode: "auto" }), items);
          pick.theme = r.ids[0] || "";
        }
        return draw();
      }
      const opt = e.target.closest("[data-theme-pick]");
      if (opt) {
        pick.mode = "manual";
        pick.theme = opt.dataset.themePick;
        return draw();
      }
      if (e.target.closest(".lt-cancel")) Cards.closeModal(overlay);
      if (e.target.closest(".lt-save")) {
        const mode = pick.mode === "manual" && !pick.theme ? "auto" : pick.mode;
        Store.setListTheme(listId, mode === "manual" ? pick.theme : "", pick.fx, mode);
        Cards.closeModal(overlay);
        const now = resolve(Store.lists().find((l) => l.id === listId), items);
        UI.toast(
          mode === "none" ? "No atmosphere on this list" : now && now.ids.length ? `${nameOf(now.ids)} on “${list.name}”${mode === "auto" ? " (Auto)" : ""}` : "Auto: no strong atmosphere yet"
        );
      }
    };
    overlay.onchange = (e) => {
      if (e.target.classList.contains("lt-fx-switch")) {
        pick.fx = e.target.checked;
        apply(overlay.querySelector(".lt-preview"), draftList(), { preview: true });
      }
    };
    Cards.openModal(overlay);
  }

  // what a new list would get from its name (for the "made" message)
  const suggest = (name) => {
    const r = resolve({ name, items: [], themeMode: "auto" }, []);
    return r.ids.length ? nameOf(r.ids) : null;
  };

  window.ListThemes = { ATMOS, THEMES, GROUPS, THRESHOLD, offered, offOf, enabled, detect, resolve, suggest, apply, picker };
})();
