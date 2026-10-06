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
      parts: "embers", count: 34, front: 10, layers: ["fog", "mist", "flicker", "ghost"],
      words: [["halloween", 1.5], ["hallowe'en", 1.5], ["all hallows", 1.2], ["trick or treat", 1.3], ["spooky", 0.9], ["spooky season", 1.4], ["pumpkin", 1], ["pumpkins", 1], ["october", 0.6], ["witch", 0.5], ["witches", 0.5], ["haunted", 0.5], ["ghost", 0.4], ["ghosts", 0.4], ["hocus pocus", 0.8]],
      months: [10], from: "horror",
    },
    {
      id: "christmas", label: "Christmas", emoji: "🎄", group: "holiday", hint: "Snowfall, warm lights, pine and red",
      colors: { a: "rgba(206, 26, 38, 0.4)", b: "rgba(16, 122, 66, 0.4)", c: "rgba(255, 184, 90, 0.16)", base: "rgba(6, 18, 12, 0.55)", edge: "rgba(235, 80, 64, 0.5)", dot: "#ffffff", dot2: "#ffc96b" },
      parts: "snow", count: 80, front: 26, caps: "snow", layers: ["garland", "snowbank", "pines", "bokeh"],
      words: [["christmas", 1.5], ["xmas", 1.5], ["x-mas", 1.5], ["santa", 1], ["noel", 0.8], ["festive", 0.8], ["holiday season", 0.9], ["mistletoe", 1], ["reindeer", 0.9], ["snowman", 0.6], ["grinch", 0.9], ["elf", 0.5], ["december", 0.5], ["yuletide", 1.2], ["home alone", 0.6]],
      months: [12],
    },
    {
      id: "easter", label: "Easter", emoji: "🌷", group: "holiday", hint: "Pastel light over a spring meadow, falling petals",
      colors: { a: "rgba(255, 160, 206, 0.38)", b: "rgba(140, 220, 130, 0.3)", c: "rgba(255, 236, 140, 0.24)", base: "rgba(26, 18, 26, 0.45)", edge: "rgba(255, 190, 222, 0.5)", dot: "#ffc3dc", dot2: "#fff2a8", dot3: "#ffffff" },
      parts: "petals", count: 40, front: 12, caps: "blossom", layers: ["meadow", "sun", "bokeh"],
      words: [["easter", 1.5], ["easter bunny", 1.5], ["bunny", 0.6], ["easter eggs", 1.2], ["resurrection", 0.4]],
      months: [3, 4],
    },
    {
      id: "valentine", label: "Valentine's Day", emoji: "💘", group: "holiday", hint: "Burgundy and pink, soft bokeh, rising hearts",
      colors: { a: "rgba(206, 22, 72, 0.42)", b: "rgba(255, 120, 172, 0.3)", c: "rgba(255, 60, 120, 0.26)", base: "rgba(30, 4, 12, 0.58)", edge: "rgba(255, 92, 142, 0.52)", dot: "#ff8fb5", dot2: "#ffd0e0", dot3: "#ff4d7d" },
      parts: "hearts", count: 22, front: 6, layers: ["bokeh", "glow", "haze"],
      words: [["valentine", 1.5], ["valentines", 1.5], ["valentine's", 1.5], ["valentine's day", 1.6], ["sweetheart", 0.6], ["be mine", 0.8]],
      months: [2], from: "romance",
    },
    {
      id: "newyear", label: "New Year's Eve", emoji: "🥂", group: "holiday", hint: "Navy and gold over a city skyline, fireworks",
      colors: { a: "rgba(255, 200, 90, 0.32)", b: "rgba(40, 62, 170, 0.42)", c: "rgba(255, 120, 220, 0.18)", base: "rgba(2, 6, 22, 0.62)", edge: "rgba(255, 212, 120, 0.5)", dot: "#ffd77a", dot2: "#ffffff", dot3: "#ff8ad8" },
      parts: "sparks", count: 44, front: 10, layers: ["city", "burst", "bokeh"],
      words: [["new year", 1.4], ["new year's", 1.4], ["new years", 1.4], ["new year's eve", 1.6], ["new years eve", 1.6], ["nye", 1.3], ["countdown", 0.7], ["auld lang syne", 1.2]],
      months: [12, 1],
    },
    {
      id: "thanksgiving", label: "Thanksgiving", emoji: "🍂", group: "holiday", hint: "Falling leaves over golden hills, a warm glow",
      colors: { a: "rgba(232, 122, 30, 0.38)", b: "rgba(150, 40, 20, 0.4)", c: "rgba(255, 190, 90, 0.22)", base: "rgba(30, 14, 4, 0.58)", edge: "rgba(240, 150, 60, 0.5)", dot: "#ffb35c", dot2: "#d0542e", dot3: "#f2c14e" },
      parts: "leaves", count: 36, front: 10, layers: ["hills", "sun", "glow"],
      words: [["thanksgiving", 1.5], ["friendsgiving", 1.4], ["turkey day", 1.3], ["turkey", 0.6], ["grateful", 0.6], ["gratitude", 0.6], ["harvest", 0.6]],
      months: [11],
    },

    /* ---- seasons and weather ---- */
    {
      id: "winter", label: "Winter", emoji: "❄️", group: "season", hint: "An aurora over snowy peaks, frost and snow",
      colors: { a: "rgba(110, 170, 255, 0.36)", b: "rgba(200, 230, 255, 0.18)", c: "rgba(120, 255, 200, 0.14)", base: "rgba(6, 14, 30, 0.58)", edge: "rgba(160, 210, 255, 0.5)", dot: "#eaf4ff", dot2: "#9cc8ff" },
      parts: "snow", count: 56, front: 16, caps: "snow", layers: ["aurora", "mountains", "frost"],
      words: [["winter", 1.3], ["wintry", 1.2], ["snow", 0.8], ["snowy", 0.9], ["blizzard", 1], ["frost", 0.8], ["frozen", 0.5], ["ice", 0.4], ["cold", 0.4]],
      months: [12, 1, 2],
    },
    {
      id: "autumn", label: "Autumn", emoji: "🍁", group: "season", hint: "Falling leaves, amber light over the hills",
      colors: { a: "rgba(226, 112, 28, 0.36)", b: "rgba(150, 52, 18, 0.38)", c: "rgba(240, 190, 80, 0.2)", base: "rgba(28, 12, 4, 0.56)", edge: "rgba(232, 140, 56, 0.48)", dot: "#e8903a", dot2: "#c0441e", dot3: "#f2c14e" },
      parts: "leaves", count: 34, front: 8, layers: ["hills", "sun", "haze"],
      words: [["autumn", 1.5], ["autumnal", 1.4], ["fall vibes", 1.3], ["fall season", 1.3], ["falling leaves", 1.3], ["leaves", 0.5], ["harvest", 0.5], ["september", 0.5], ["november", 0.4]],
      months: [9, 10, 11],
    },
    {
      id: "spring", label: "Spring", emoji: "🌸", group: "season", hint: "Blossom pink over a meadow, drifting petals",
      colors: { a: "rgba(255, 150, 200, 0.36)", b: "rgba(120, 200, 120, 0.3)", c: "rgba(255, 236, 140, 0.2)", base: "rgba(24, 18, 22, 0.45)", edge: "rgba(255, 170, 210, 0.5)", dot: "#ffb7d5", dot2: "#c8f0b0", dot3: "#ffffff" },
      parts: "petals", count: 40, front: 12, caps: "blossom", layers: ["meadow", "sun", "bokeh"],
      words: [["spring", 1.2], ["springtime", 1.3], ["blossom", 1], ["bloom", 0.8], ["flowers", 0.6]],
      months: [3, 4, 5],
    },
    {
      id: "summer", label: "Summer", emoji: "☀️", group: "season", hint: "Sunset over the sea, warm light, glints",
      colors: { a: "rgba(255, 180, 50, 0.4)", b: "rgba(255, 90, 60, 0.3)", c: "rgba(255, 80, 140, 0.22)", base: "rgba(30, 14, 4, 0.5)", edge: "rgba(255, 200, 90, 0.52)", dot: "#ffd77a", dot2: "#ff9a5c" },
      parts: "motes", count: 30, front: 8, layers: ["sea", "sun", "haze"],
      words: [["summer", 1.3], ["summertime", 1.4], ["beach", 0.9], ["summer vacation", 1.5], ["sunshine", 0.8], ["sunny", 0.7], ["vacation", 0.6], ["heatwave", 1]],
      months: [6, 7, 8],
    },
    {
      id: "rainy", label: "Rainy day", emoji: "🌧️", group: "season", hint: "Rain on the street, puddle ripples, reflections",
      colors: { a: "rgba(80, 112, 168, 0.38)", b: "rgba(60, 70, 104, 0.36)", c: "rgba(150, 190, 255, 0.16)", base: "rgba(6, 10, 20, 0.6)", edge: "rgba(140, 172, 222, 0.46)", dot: "#b9d3ff", dot2: "#e6efff" },
      parts: "rain", count: 70, front: 20, caps: "drops", layers: ["ripples", "reflect", "haze"],
      words: [["rainy day", 1.6], ["rainy days", 1.6], ["rainy", 1.2], ["rain", 0.9], ["stormy", 0.8], ["storm", 0.6], ["drizzle", 0.9]],
    },

    /* ---- moods ---- */
    {
      id: "cozy", label: "Cozy", emoji: "☕", group: "mood", hint: "A warm window, amber light, slow motes",
      colors: { a: "rgba(255, 168, 80, 0.36)", b: "rgba(140, 80, 40, 0.36)", c: "rgba(255, 140, 60, 0.22)", base: "rgba(28, 16, 6, 0.58)", edge: "rgba(255, 180, 100, 0.48)", dot: "#ffcf8a", dot2: "#ff9f5a" },
      parts: "motes", count: 24, front: 6, layers: ["window", "glow", "bokeh"],
      words: [["cozy", 1.4], ["cosy", 1.4], ["comfort", 1], ["comfort movies", 1.5], ["comfort films", 1.5], ["feel good", 1], ["feel-good", 1], ["wholesome", 1], ["blanket", 0.8], ["hot chocolate", 1], ["lazy sunday", 1], ["sunday", 0.3]],
      genres: { Family: 0.4 },
    },
    {
      id: "emotional", label: "Emotional", emoji: "💧", group: "mood", hint: "Deep blue and violet, soft rain, blurred lights",
      colors: { a: "rgba(72, 92, 204, 0.38)", b: "rgba(124, 62, 176, 0.36)", c: "rgba(160, 120, 255, 0.2)", base: "rgba(6, 6, 24, 0.62)", edge: "rgba(132, 142, 240, 0.48)", dot: "#a9b8ff", dot2: "#d2b8ff" },
      parts: "rain", count: 40, front: 10, layers: ["haze", "bokeh", "reflect"],
      words: [["cry", 1.3], ["crying", 1.3], ["make you cry", 1.6], ["tears", 1.1], ["tearjerker", 1.5], ["tearjerkers", 1.5], ["tear-jerker", 1.5], ["sad", 1.2], ["emotional", 1.2], ["heartbreak", 1], ["heartbreaking", 1.1], ["grief", 0.9], ["melancholy", 1.3], ["bittersweet", 1]],
      genres: { Drama: 0.3 },
    },
    {
      id: "romance", label: "Romantic", emoji: "🌹", group: "mood", hint: "Burgundy and candlelight, soft bokeh, hearts",
      colors: { a: "rgba(192, 30, 82, 0.4)", b: "rgba(255, 112, 162, 0.28)", c: "rgba(255, 170, 90, 0.2)", base: "rgba(28, 4, 14, 0.58)", edge: "rgba(255, 102, 152, 0.5)", dot: "#ff9cc0", dot2: "#ffd6a8" },
      parts: "hearts", count: 14, front: 4, layers: ["bokeh", "glow", "haze"],
      words: [["romance", 1.4], ["romantic", 1.4], ["date night", 1.6], ["love stories", 1.2], ["love story", 1.1], ["love", 0.7], ["rom-com", 1.1], ["romcom", 1.1], ["rom-coms", 1.1], ["couples", 0.7], ["swoon", 1]],
      genres: { Romance: 1 },
    },
    {
      id: "comedy", label: "Funny", emoji: "😄", group: "mood", hint: "Stage spotlights, bright and playful",
      colors: { a: "rgba(255, 192, 60, 0.34)", b: "rgba(80, 180, 255, 0.3)", c: "rgba(255, 110, 180, 0.2)", base: "rgba(20, 16, 30, 0.45)", edge: "rgba(255, 210, 90, 0.48)", dot: "#ffd36b", dot2: "#7cc8ff", dot3: "#ff7ac0" },
      parts: "shapes", count: 30, front: 8, layers: ["spot", "bokeh"],
      words: [["comedy", 1.4], ["comedies", 1.4], ["funny", 1.3], ["laugh", 1.1], ["laughs", 1.1], ["laughing", 1], ["hilarious", 1.3], ["sitcom", 0.9], ["sitcoms", 0.9], ["jokes", 0.8], ["lol", 0.9]],
      genres: { Comedy: 1 },
    },
    {
      id: "dark", label: "Late night", emoji: "🌙", group: "mood", hint: "A crescent moon over a sleeping city",
      colors: { a: "rgba(110, 18, 36, 0.34)", b: "rgba(22, 32, 80, 0.44)", c: "rgba(70, 40, 120, 0.22)", base: "rgba(0, 0, 0, 0.62)", edge: "rgba(170, 60, 84, 0.44)", dot: "#c9d2ff", dot2: "#ff7a7a" },
      parts: "stars", count: 40, layers: ["moon", "city", "vignette", "flicker"],
      words: [["late night", 1.3], ["midnight", 1.1], ["after dark", 1.3], ["dark", 0.8], ["darkness", 0.9], ["nocturnal", 1], ["3am", 1], ["night", 0.4], ["sinister", 0.8], ["disturbing", 0.9], ["twisted", 0.8]],
      genres: { Thriller: 0.3 },
    },
    {
      id: "nostalgic", label: "Nostalgic", emoji: "📼", group: "mood", hint: "A projector beam, film scratches and grain",
      colors: { a: "rgba(232, 172, 92, 0.32)", b: "rgba(150, 110, 200, 0.28)", c: "rgba(255, 200, 140, 0.16)", base: "rgba(24, 18, 10, 0.58)", edge: "rgba(232, 192, 132, 0.46)", dot: "#f5d59a", dot2: "#d9b8ff" },
      parts: "dust", count: 30, front: 6, layers: ["projector", "scratches", "grain", "vignette"],
      words: [["nostalgia", 1.4], ["nostalgic", 1.4], ["childhood", 1.2], ["80s", 1.1], ["90s", 1.1], ["eighties", 1.1], ["nineties", 1.1], ["retro", 1.1], ["old school", 0.9], ["throwback", 1.1], ["vintage", 1]],
    },
    {
      id: "roadtrip", label: "Road trip", emoji: "🚗", group: "mood", hint: "A sunset highway through the hills",
      colors: { a: "rgba(255, 140, 60, 0.36)", b: "rgba(120, 60, 164, 0.34)", c: "rgba(255, 90, 120, 0.22)", base: "rgba(24, 10, 16, 0.55)", edge: "rgba(255, 162, 92, 0.48)", dot: "#ffcf7a", dot2: "#ff8a5c" },
      parts: "motes", count: 14, layers: ["hills", "road", "sun"],
      words: [["road trip", 1.6], ["roadtrip", 1.6], ["road trips", 1.6], ["on the road", 1.2], ["open road", 1.3], ["highway", 0.9], ["journey", 0.7], ["travel", 0.6]],
      genres: { Adventure: 0.25 },
    },

    /* ---- genres ---- */
    {
      id: "horror", label: "Horror", emoji: "🩸", group: "genre", hint: "Blood red, dead trees, fog, a failing light",
      colors: { a: "rgba(176, 10, 22, 0.44)", b: "rgba(40, 0, 4, 0.58)", c: "rgba(110, 0, 10, 0.4)", base: "rgba(6, 0, 0, 0.68)", edge: "rgba(205, 30, 40, 0.54)", dot: "#ff5a4f", dot2: "#7a0a12" },
      parts: "ash", count: 30, front: 8, caps: "blood", layers: ["trees", "fog", "mist", "flicker", "vignette"],
      words: [["horror", 1.5], ["horrors", 1.5], ["scary", 1.2], ["terror", 1], ["terrifying", 1.1], ["creepy", 1], ["slasher", 1.3], ["slashers", 1.3], ["frightening", 1], ["fright", 1], ["nightmare", 0.8], ["nightmares", 0.8], ["gore", 1], ["monsters", 0.6], ["zombie", 0.7], ["demon", 0.7], ["haunted", 0.6], ["spooky", 0.5], ["scream", 0.6]],
      genres: { Horror: 1 },
    },
    {
      id: "space", label: "Sci-Fi & Space", emoji: "🚀", group: "genre", hint: "A planet, a nebula, shooting stars",
      colors: { a: "rgba(92, 72, 232, 0.4)", b: "rgba(30, 140, 232, 0.32)", c: "rgba(200, 80, 255, 0.18)", base: "rgba(2, 4, 18, 0.68)", edge: "rgba(132, 122, 255, 0.5)", dot: "#ffffff", dot2: "#9ee7ff" },
      parts: "stars", count: 60, layers: ["planet", "nebula", "shoot"],
      words: [["space", 1.3], ["sci-fi", 1.4], ["scifi", 1.4], ["science fiction", 1.4], ["galaxy", 1.1], ["cosmic", 1], ["cosmos", 1], ["alien", 0.9], ["aliens", 0.9], ["interstellar", 0.8], ["star wars", 1], ["star trek", 1], ["astronaut", 1], ["mars", 0.7], ["robots", 0.6], ["future", 0.5]],
      genres: { "Science Fiction": 1, "Sci-Fi & Fantasy": 0.6 },
    },
    {
      id: "fantasy", label: "Fantasy", emoji: "✨", group: "genre", hint: "A castle under drifting magic light",
      colors: { a: "rgba(112, 62, 222, 0.38)", b: "rgba(40, 122, 222, 0.32)", c: "rgba(120, 255, 220, 0.16)", base: "rgba(10, 6, 28, 0.62)", edge: "rgba(172, 132, 255, 0.5)", dot: "#d6c2ff", dot2: "#9ee7ff", dot3: "#ffe08a" },
      parts: "sparks", count: 40, front: 12, layers: ["castle", "glow", "bokeh"],
      words: [["fantasy", 1.4], ["magic", 1.1], ["magical", 1.1], ["wizard", 1], ["wizards", 1], ["wizarding", 1.1], ["dragon", 0.8], ["dragons", 1], ["middle-earth", 1.1], ["harry potter", 1], ["lord of the rings", 1], ["fairy tale", 1], ["fairy tales", 1], ["enchanted", 1], ["mythical", 1], ["quest", 0.5]],
      genres: { Fantasy: 1, "Sci-Fi & Fantasy": 0.4 },
    },
    {
      id: "apocalypse", label: "Apocalypse", emoji: "☢️", group: "genre", hint: "Ruins on fire, smoke, falling ash",
      colors: { a: "rgba(224, 82, 20, 0.38)", b: "rgba(124, 10, 10, 0.46)", c: "rgba(255, 120, 30, 0.24)", base: "rgba(16, 4, 2, 0.68)", edge: "rgba(232, 102, 40, 0.5)", dot: "#c9b9ad", dot2: "#ff7a2a" },
      parts: "ash", count: 50, front: 14, layers: ["ruins", "smoke", "flicker", "vignette"],
      words: [["apocalypse", 1.6], ["apocalyptic", 1.6], ["post-apocalyptic", 1.6], ["end of the world", 1.7], ["end of days", 1.5], ["doomsday", 1.5], ["armageddon", 1.2], ["last stand", 1.2], ["survival", 1], ["survive", 0.8], ["nuclear", 1], ["disaster", 1], ["disasters", 1], ["extinction", 1.2], ["wasteland", 1.2], ["collapse", 0.8], ["humanity", 0.4], ["zombies", 0.7], ["mad max", 0.9], ["fury road", 0.6], ["the road", 0.4], ["2012", 0.5], ["war of the worlds", 0.8], ["day after tomorrow", 0.9], ["deep impact", 0.9], ["i am legend", 0.9], ["28 days later", 0.9], ["world war z", 0.9]],
      genres: { War: 0.2 },
    },
    {
      id: "action", label: "Action", emoji: "💥", group: "genre", hint: "Light streaks, a lens flare, flying sparks",
      colors: { a: "rgba(232, 62, 30, 0.36)", b: "rgba(255, 142, 30, 0.26)", c: "rgba(255, 200, 80, 0.16)", base: "rgba(12, 6, 4, 0.58)", edge: "rgba(242, 92, 52, 0.5)", dot: "#ffb070", dot2: "#ff5a3a", dot3: "#fff0c0" },
      parts: "sparks", count: 26, front: 8, layers: ["streaks", "flare", "vignette"],
      words: [["action", 1.4], ["explosive", 1], ["explosions", 1], ["adrenaline", 1.2], ["high octane", 1.3], ["car chase", 1.1], ["car chases", 1.1], ["badass", 1.1], ["blockbuster", 0.6], ["blockbusters", 0.6], ["heist", 0.7], ["fight", 0.5]],
      genres: { Action: 1, "Action & Adventure": 0.8 },
    },
    {
      id: "noir", label: "Mystery & Noir", emoji: "🕵️", group: "genre", hint: "Light through the blinds, rain, wet streets",
      colors: { a: "rgba(72, 112, 184, 0.34)", b: "rgba(255, 255, 255, 0.1)", c: "rgba(200, 210, 230, 0.1)", base: "rgba(2, 4, 10, 0.68)", edge: "rgba(172, 192, 232, 0.42)", dot: "#cfe0ff", dot2: "#ffffff" },
      parts: "rain", count: 50, front: 14, layers: ["blinds", "reflect", "grain", "vignette"],
      words: [["noir", 1.6], ["film noir", 1.7], ["mystery", 1.3], ["mysteries", 1.3], ["detective", 1.1], ["detectives", 1.1], ["whodunit", 1.5], ["whodunnit", 1.5], ["murder mystery", 1.6], ["crime", 0.8], ["true crime", 0.8], ["investigation", 0.9], ["black and white", 1], ["suspense", 0.9], ["sherlock", 1]],
      genres: { Mystery: 1, Crime: 0.6 },
    },
    {
      id: "western", label: "Western", emoji: "🤠", group: "genre", hint: "Desert mesas, a low sun, drifting dust",
      colors: { a: "rgba(222, 142, 50, 0.36)", b: "rgba(122, 62, 20, 0.4)", c: "rgba(255, 120, 60, 0.2)", base: "rgba(26, 14, 4, 0.62)", edge: "rgba(222, 162, 80, 0.5)", dot: "#e8c08a", dot2: "#ffb347" },
      parts: "dust", count: 30, front: 6, layers: ["desert", "sun", "grain"],
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
      // (a sway of its own, side to side: how far and how fast)
      const sway = (8 + rnd() * 22).toFixed(0);
      const swayT = (2.6 + rnd() * 3.4).toFixed(2);
      return `<i style="--x:${left}%;--y:${top}%;--d:${delay}s;--t:${dur}s;--s:${size};--dx:${drift}px;--sw:${sway}px;--st:${swayT}s"></i>`;
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
  const layerHtml = (name) => {
    const l = LAYER[name] || SCENE[name];
    return typeof l === "function" ? l() : l || `<b class="lt-l lt-l-${name}"></b>`;
  };

  /* ---- scenes: silhouettes along the bottom (or in the far corner), drawn once per kind ----
     Landscapes are 1200 wide and keep their shape (the left is cut on a narrow screen: the right,
     past the posters, is what shows); the
     same pattern on every visit. Their colours come from the CSS (.lt-sil) and the list's --lt-* */
  const rand = (seed) => {
    let x = seed;
    return () => (x = (x * 9301 + 49297) % 233280) / 233280;
  };
  const r1 = (n) => Math.round(n * 10) / 10;
  const svg = (cls, vb, body, fit = "xMaxYMax slice") => `<svg class="lt-l lt-sil lt-l-${cls}" viewBox="${vb}" preserveAspectRatio="${fit}" aria-hidden="true" focusable="false">${body}</svg>`;
  const memo = {};
  const once = (key, make) => () => memo[key] || (memo[key] = make());

  // a city: buildings with a few lit windows; ruined: broken tops, windows on fire
  function city(ruined) {
    const rnd = rand(ruined ? 77 : 41);
    let x = 0;
    let d = "M0 120";
    let w = "";
    while (x < 1200) {
      const bw = 26 + Math.round(rnd() * 46);
      const top = 120 - (28 + Math.round(rnd() * (ruined ? 56 : 82)));
      if (ruined) d += ` L${x} ${top + 8} L${r1(x + bw * 0.3)} ${top} L${r1(x + bw * 0.45)} ${top + 12} L${r1(x + bw * 0.72)} ${top - 4} L${x + bw} ${top + 14}`;
      else {
        // (now and then an antenna in the middle of the roof)
        const mid = r1(x + bw / 2);
        d += rnd() < 0.18 ? ` L${x} ${top} L${mid} ${top} L${mid} ${top - 16} L${mid + 2} ${top - 16} L${mid + 2} ${top} L${x + bw} ${top}` : ` L${x} ${top} L${x + bw} ${top}`;
      }
      for (let wy = top + 10; wy < 112; wy += 9) for (let wx = x + 5; wx < x + bw - 6; wx += 8) if (rnd() < (ruined ? 0.07 : 0.2)) w += `M${wx} ${wy}h3v4h-3Z`;
      x += bw;
    }
    return svg(ruined ? "ruins" : "city", "0 0 1200 120", `<path class="s" d="${d} L1200 120 Z"/><path class="w" d="${w}"/>`);
  }
  // rolling hills, a far range and a near one
  function hillPath(seed, n, base, amp) {
    const rnd = rand(seed);
    const step = 1200 / n;
    let d = `M0 120 L0 ${base}`;
    let px = 0;
    let py = base;
    for (let i = 1; i <= n; i++) {
      const x = r1(i * step);
      const y = r1(base - rnd() * amp);
      d += ` C${r1(px + step / 2)} ${py} ${r1(x - step / 2)} ${y} ${x} ${y}`;
      px = x;
      py = y;
    }
    return `${d} L1200 120 Z`;
  }
  // peaks, the high ones capped with snow
  function mountains() {
    const rnd = rand(19);
    const pts = [[0, 92]];
    let x = 0;
    let up = true;
    while (x < 1200) {
      x = Math.min(1200, x + 60 + Math.round(rnd() * 80));
      pts.push([x, up ? 18 + Math.round(rnd() * 50) : 70 + Math.round(rnd() * 26)]);
      up = !up;
    }
    let caps = "";
    pts.forEach(([px, py], i) => {
      if (py > 52 || !pts[i - 1] || !pts[i + 1]) return;
      const l = [r1(px + (pts[i - 1][0] - px) * 0.3), r1(py + (pts[i - 1][1] - py) * 0.3)];
      const r = [r1(px + (pts[i + 1][0] - px) * 0.3), r1(py + (pts[i + 1][1] - py) * 0.3)];
      caps += `M${l[0]} ${l[1]} L${px} ${py} L${r[0]} ${r[1]} L${r1((px + r[0]) / 2)} ${r1(r[1] - 4)} L${px} ${r1(l[1] + 2)} L${r1((px + l[0]) / 2)} ${r1(l[1] - 3)} Z`;
    });
    return svg("mountains", "0 0 1200 120", `<path class="far" d="${hillPath(23, 6, 80, 22)}"/><path class="s" d="M0 120 L${pts.map((p) => p.join(" ")).join(" L")} L1200 120 Z"/><path class="cap" d="${caps}"/>`);
  }
  // a meadow: grass blades, a few small flowers
  function meadow() {
    const rnd = rand(7);
    let g = "";
    let f = ["", "", ""];
    for (let x = 0; x < 1200; x += 4) {
      const h = 10 + rnd() * 26;
      const lean = (rnd() - 0.5) * 6;
      g += `M${x} 60 Q${r1(x + 1 + lean / 2)} ${r1(60 - h * 0.6)} ${r1(x + 2 + lean)} ${r1(60 - h)} Q${r1(x + 3)} ${r1(60 - h * 0.5)} ${x + 4} 60Z`;
      if (rnd() < 0.09) {
        const k = Math.floor(rnd() * 3);
        const cx = r1(x + 2 + lean);
        const cy = r1(60 - h - 2);
        f[k] += `M${cx - 3} ${cy}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z`;
      }
    }
    return svg("meadow", "0 0 1200 60", `<path class="s" d="${g}"/><path class="f1" d="${f[0]}"/><path class="f2" d="${f[1]}"/><path class="f3" d="${f[2]}"/>`);
  }
  // the sea at sunset: a low horizon, glints on the water
  function sea() {
    const rnd = rand(3);
    let gl = "";
    for (let i = 0; i < 40; i++) {
      const x = r1(600 + (rnd() - 0.3) * 700);
      const y = r1(78 + rnd() * 38);
      gl += `M${x} ${y}h${r1(6 + rnd() * 22)}v1.6h-${r1(6 + rnd() * 22)}Z`;
    }
    return svg("sea", "0 0 1200 120", `<path class="s" d="M0 120 L0 74 C200 70 400 76 600 72 S1000 70 1200 74 L1200 120 Z"/><path class="g" d="${gl}"/>`);
  }
  // the desert: mesas, saguaros
  function desert() {
    const cactus = (x, h) =>
      `M${x} 120V${120 - h}a5 5 0 0 1 10 0V120Z M${x - 12} ${r1(120 - h * 0.42)}V${r1(120 - h * 0.74)}a4 4 0 0 1 8 0V${r1(120 - h * 0.5)}H${x}V${r1(120 - h * 0.42)}Z M${x + 22} ${r1(120 - h * 0.5)}V${r1(120 - h * 0.84)}a4 4 0 0 0 -8 0V${r1(120 - h * 0.58)}H${x + 10}V${r1(120 - h * 0.5)}Z`;
    return svg(
      "desert",
      "0 0 1200 120",
      `<path class="far" d="M0 120 L0 88 L70 88 L92 56 L250 56 L270 86 L520 90 L540 64 L640 64 L656 88 L860 90 L884 48 L1020 48 L1046 86 L1200 88 L1200 120 Z"/><path class="s" d="M0 120 L0 104 C200 100 400 108 600 104 S1000 100 1200 106 L1200 120 Z ${cactus(1080, 58)} ${cactus(980, 34)} ${cactus(760, 44)}"/>`
    );
  }
  const SCENE = {
    city: once("city", () => city(false)),
    ruins: once("ruins", () => city(true)),
    hills: once("hills", () => svg("hills", "0 0 1200 120", `<path class="far" d="${hillPath(11, 5, 70, 30)}"/><path class="s" d="${hillPath(5, 4, 96, 26)}"/>`)),
    mountains: once("mountains", mountains),
    meadow: once("meadow", meadow),
    sea: once("sea", sea),
    desert: once("desert", desert),
    // the far corner: bare trees (Horror), a castle (Fantasy)
    trees: svg(
      "trees",
      "0 0 240 180",
      `<circle class="halo" cx="150" cy="58" r="50"/><circle class="moon" cx="150" cy="58" r="30"/><path class="trunk" d="M176 180 C174 150 178 120 172 96 M86 180 C85 160 88 142 84 126"/><path class="br" d="M173 120 C158 108 148 100 140 84 M172 96 C166 80 168 64 160 50 M172 96 C184 84 192 74 200 58 M160 50 L150 40 M160 50 L164 34 M200 58 L212 50 M200 58 L198 44 M144 90 L132 86 M178 140 C192 132 204 130 214 122 M85 142 C76 134 70 128 66 118 M84 126 C86 114 92 106 98 98 M66 118 L58 114 M98 98 L104 90 M98 98 L106 100"/>`,
      "xMaxYMax meet"
    ),
    castle: svg(
      "castle",
      "0 0 220 160",
      `<path class="s" d="M10 160V110H200V160Z M24 110V70L38 44L52 70V110Z M76 110V54H82V46H90V54H98V46H106V54H112V110Z M84 54V34L94 8L104 34V54Z M140 110V62L156 30L172 62V110Z M184 110V80L194 60L204 80V110Z M10 110V104H16V110Z M26 110V104H32V110Z M120 110V104H126V110Z"/><path class="w" d="M34 80h5v8h-5Z M91 64h6v10h-6Z M153 74h6v9h-6Z M92 40h4v7h-4Z M192 88h4v6h-4Z M60 124h5v7h-5Z M128 122h5v7h-5Z"/>`,
      "xMaxYMax meet"
    ),
    ripples: [12, 30, 52, 70, 88].map((x, i) => `<b class="lt-l lt-l-ripple" style="--x:${x}%;--d:${-i * 0.55}s"></b>`).join(""),
    shoot: '<b class="lt-l lt-l-shoot"></b><b class="lt-l lt-l-shoot two"></b>',
    spot: '<b class="lt-l lt-l-spot"></b><b class="lt-l lt-l-spot two"></b>',
  };

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
    // front: how many of its particles fall in front of the posters (nearer, bigger); caps: what
    // settles on top of each poster ("snow")
    const front = a.parts ? a.front || 0 : (b && b.front) || 0;
    const caps = a.caps || (b && b.caps) || "";
    return { vars, parts, count, layers, front, caps };
  }

  // the photo behind it: a still (TMDB backdrop) from one of the titles in the list, the newest added
  // that has one; none: the colours alone
  // (or the one picked in Appearance: list.bg, a TMDB image path, or "none")
  const photoOf = (list) => {
    if (list && list.bg === "none") return "";
    const path = list && list.bg ? list.bg : (itemsOf(list).find((i) => i.backdrop) || {}).backdrop;
    return path ? Store.img(path, phone() ? "w780" : "w1280") : "";
  };
  function fxLayer(ids, photo) {
    const l = look(ids);
    const n = Math.round(l.count * (phone() ? 0.5 : 1));
    // (the photo's address waits in data-src until the list comes near the screen)
    return `<span class="lt-fx" aria-hidden="true">${photo ? `<b class="lt-photo" data-src="${UI.esc(photo)}"></b>` : ""}${l.layers
      .filter((x) => !OVER.includes(x))
      .map(layerHtml)
      .join("")}${l.parts && n ? `<span class="lt-parts" data-k="${l.parts}">${particles(n, seedOf(ids.join("+")))}</span>` : ""}</span>`;
  }
  // the ones in front (layers, the nearer particles), or ""
  function overLayer(ids) {
    const l = look(ids);
    const over = l.layers.filter((x) => OVER.includes(x));
    const n = Math.round(l.front * (phone() ? 0.5 : 1));
    const near = l.parts && n ? `<span class="lt-parts near" data-k="${l.parts}">${particles(n, seedOf(ids.join("+")) + 101)}</span>` : "";
    return over.length || near ? `<span class="lt-over" aria-hidden="true">${over.map(layerHtml).join("")}${near}</span>` : "";
  }
  const dropFx = (sec) => sec.querySelectorAll(":scope > .lt-fx, :scope > .lt-over").forEach((x) => x.remove());

  /* ---------------- playing only what's on screen ---------------- */

  const shown = new Set(); // dressed and on screen
  const seen = new WeakMap(); // how much of each is on screen (px)
  const watched = new Set();
  function replay() {
    const max = phone() ? 1 : 2;
    const on = document.visibilityState !== "hidden" && motionOk();
    // (the ones most on screen: a list just peeking in doesn't take a fully visible one's place)
    const play = [...shown]
      .filter((el) => el.isConnected && el.dataset.fx === "1")
      .sort((x, y) => (seen.get(y) || 0) - (seen.get(x) || 0) || (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .slice(0, on ? max : 0);
    watched.forEach((el) => el.classList.toggle("lt-play", play.includes(el)));
  }
  // the photo, once: faded in when it has arrived
  function loadPhoto(sec) {
    const ph = sec.querySelector(":scope > .lt-fx > .lt-photo[data-src]");
    if (!ph) return;
    const src = ph.dataset.src;
    delete ph.dataset.src;
    const im = new Image();
    im.onload = () => {
      ph.style.backgroundImage = `url("${src}")`;
      ph.classList.add("in");
    };
    im.src = src;
  }
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              seen.set(en.target, en.intersectionRect.height);
              en.isIntersecting ? shown.add(en.target) : shown.delete(en.target);
            });
            replay();
          },
          { rootMargin: "40px", threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
        )
      : null;
  // (the photo a little sooner: it's there by the time the list is)
  const photoIo =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              photoIo.unobserve(en.target);
              loadPhoto(en.target);
            }),
          { rootMargin: "400px 0px" }
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
      const photo = ids.length ? photoOf(list) : "";
      const sign = `${ids.join("+")}|${fx ? 1 : 0}|${phone() ? "p" : "d"}|${photo}`;
      if (sec.dataset.lt === sign) return r;
      sec.dataset.lt = sign;
      sec.dataset.theme = ids[0] || "";
      sec.dataset.fx = fx ? "1" : "0";
      sec.dataset.caps = ids.length ? look(ids).caps : "";
      sec.classList.toggle("lt", !!ids.length);
      dropFx(sec);
      const emblem = sec.querySelector(".lt-emblem");
      if (emblem) emblem.remove();
      ["--lt-a", "--lt-b", "--lt-c", "--lt-base", "--lt-edge", "--lt-dot", "--lt-dot2", "--lt-dot3"].forEach((v) => sec.style.removeProperty(v));
      sec.classList.remove("lt-play");
      if (io && !(opts && opts.preview)) {
        io.unobserve(sec);
        photoIo.unobserve(sec);
        shown.delete(sec);
        watched.delete(sec);
      }
      if (!ids.length) return replay(), r;
      Object.entries(look(ids).vars).forEach(([k, v]) => sec.style.setProperty(k, v));
      sec.insertAdjacentHTML("afterbegin", fxLayer(ids, photo));
      if (photo) photoIo && !(opts && opts.preview) ? photoIo.observe(sec) : loadPhoto(sec);
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
    // (tab: "look" the atmosphere, "bg" the background photo)
    const pick = { mode: startMode, theme: list.theme || "", fx: list.fx !== false, bg: list.bg || "", tab: "look" };
    const draftList = () => Object.assign({}, list, { themeMode: pick.mode, theme: pick.theme || undefined, fx: pick.fx, bg: pick.bg || undefined });

    // the stills to pick from: each title's own backdrop first, then more from TMDB (asked once,
    // when the Background tab opens: up to 6 titles, 8 stills each)
    const stills = [...new Set(items.map((i) => i.backdrop).filter(Boolean))];
    if (pick.bg && pick.bg !== "none" && !stills.includes(pick.bg)) stills.unshift(pick.bg);
    let asked = false;
    let asking = false;
    async function moreStills() {
      if (asked || !window.TMDB || !TMDB.enabled()) return;
      asked = true;
      asking = true;
      const withId = items.filter((i) => i.tmdbId && i.tmdbMedia).slice(0, 6);
      const found = await Promise.all(withId.map((i) => TMDB.detailsById(i.tmdbMedia, i.tmdbId).catch(() => null)));
      found.forEach((d) => d && (d.images || []).slice(0, 8).forEach((p) => !stills.includes(p) && stills.push(p)));
      asking = false;
      if (pick.tab === "bg" && overlay.classList.contains("active")) drawPanel();
    }
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

    // Background: Auto, No photo, then every still found
    const bgPanel = () => {
      const auto = (items.find((i) => i.backdrop) || {}).backdrop;
      const tile = (val, inner, label) =>
        `<button type="button" class="lt-bg${pick.bg === val ? " on" : ""}" role="radio" aria-checked="${pick.bg === val}" data-bg="${UI.esc(val)}" aria-label="${UI.esc(label)}">${inner}${
          val === "" || val === "none" ? `<span class="lt-bg-tag">${UI.esc(label)}</span>` : ""
        }</button>`;
      return `<p class="lt-note lt-bg-note">The photo behind the list, faded and tinted by its atmosphere. Stills from the titles in it.</p>
        <div class="lt-bgs" role="radiogroup" aria-label="Background photo">
          ${tile("", auto ? `<img src="${Store.img(auto, "w300")}" alt="" loading="lazy" />` : '<span class="lt-bg-blank"><i class="fa-solid fa-wand-magic-sparkles"></i></span>', "Auto")}
          ${tile("none", '<span class="lt-bg-blank"><i class="fa-solid fa-ban"></i></span>', "No photo")}
          ${stills.map((p, n) => tile(p, `<img src="${Store.img(p, "w300")}" alt="" loading="lazy" />`, `Still ${n + 1}`)).join("")}
        </div>
        ${asking ? '<p class="lt-note"><i class="fa-solid fa-spinner fa-spin"></i> Looking for more stills…</p>' : ""}
        ${!items.length ? '<p class="lt-note">Add titles to the list to pick a still from them.</p>' : ""}`;
    };
    const lookPanel = () => (pick.mode === "auto" ? autoPanel() : pick.mode === "manual" ? manualPanel() : `<p class="lt-note lt-none-note"><i class="fa-solid fa-ban"></i> The site's own look. No atmosphere is put on this list until you switch back to Auto or pick one.</p>`);
    // only the panel (the rest stays put: the grid's scroll too, when stills arrive)
    function drawPanel() {
      const p = overlay.querySelector(".lt-panel");
      const top = p.scrollTop;
      p.innerHTML = pick.tab === "bg" ? bgPanel() : lookPanel();
      p.scrollTop = top;
      apply(overlay.querySelector(".lt-preview"), draftList(), { preview: true });
    }
    const draw = () => {
      const hasLook = pick.mode !== "none" && (pick.mode === "auto" || pick.theme);
      const tabBtn = (t, icon, text) => `<button type="button" class="lt-tab${pick.tab === t ? " on" : ""}" role="tab" aria-selected="${pick.tab === t}" data-lt-tab="${t}"><i class="fa-solid ${icon}"></i> ${text}</button>`;
      overlay.querySelector(".lt-in").innerHTML = `
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i> Appearance</h3>
        <section class="lt-preview">
          <div class="row-head"><h2><i class="fa-solid fa-list-ul"></i> ${UI.esc(list.name)}</h2></div>
          <div class="lt-pv-row">${posters || '<span class="lt-pv-empty">Add titles to see them here</span>'}</div>
        </section>
        <div class="lt-tabs" role="tablist">${tabBtn("look", "fa-palette", "Atmosphere")}${tabBtn("bg", "fa-image", "Background")}</div>
        ${
          pick.tab === "look"
            ? `<div class="top10-switch lt-modes" role="radiogroup" aria-label="Atmosphere">
          ${modeBtn("auto", "fa-wand-magic-sparkles", "Auto")}${modeBtn("manual", "fa-palette", "Choose")}${modeBtn("none", "fa-ban", "None")}
        </div>`
            : ""
        }
        <div class="lt-panel${pick.tab === "bg" ? " lt-panel-bg" : ""}">${pick.tab === "bg" ? bgPanel() : lookPanel()}</div>
        ${
          pick.tab === "look"
            ? `<label class="menu-switch lt-anim${hasLook ? "" : " off"}">
          <i class="fa-solid fa-snowflake"></i><span>Animated atmosphere<small>${motionOk() ? "Plays only while the list is on screen" : "Off: reduce motion is on, or animations are off for the site"}</small></span>
          <input type="checkbox" class="lt-fx-switch"${pick.fx ? " checked" : ""}${!hasLook || !motionOk() ? " disabled" : ""} />
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>`
            : ""
        }
        <div class="lt-actions"><button type="button" class="btn lt-cancel">Cancel</button><button type="button" class="btn btn-primary lt-save">Save</button></div>`;
      // the preview, live (the panel scrolls; the preview stays put)
      apply(overlay.querySelector(".lt-preview"), draftList(), { preview: true });
    };
    draw();
    overlay.onclick = (e) => {
      const tab = e.target.closest("[data-lt-tab]");
      if (tab) {
        pick.tab = tab.dataset.ltTab;
        draw();
        if (pick.tab === "bg") {
          moreStills(); // (draws the panel again when they've come)
          if (asking) drawPanel(); // ("Looking for more stills…" meanwhile)
        }
        return;
      }
      const bg = e.target.closest("[data-bg]");
      if (bg) {
        pick.bg = bg.dataset.bg;
        return drawPanel();
      }
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
        if ((list.bg || "") !== pick.bg) Store.setListBg(listId, pick.bg);
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
