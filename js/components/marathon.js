/*
 * Generate a marathon (your own lists, Watchlist page): the films a marathon of its kind can't do
 * without, picked for you, then yours to edit before they go in the list.
 *
 *  - Each kind (Christmas, Halloween, Horror, Sci-Fi…) is a hand-picked list of the films people and
 *    critics agree on for it, the essential ones first (a Christmas marathon starts with Home Alone,
 *    Elf, It's a Wonderful Life…). No weak filler: only well-known, well-loved films.
 *  - The kind is guessed from the list's name ("Christmas marathon" → Christmas); any other can be
 *    picked. How many: 10, 15 or 20; "More picks" brings the next ones.
 *  - Before adding: take any out (✕), or search for one of your own to add. Added in the marathon's
 *    order; a film not in your library yet goes in on your Watchlist.
 *  - Each film is found on TMDB by its name and year (kept for this visit); one TMDB can't find, or
 *    one without a poster, is left out.
 */
(function () {
  const { esc, toast } = UI;

  // [id, label, emoji, words in a list's name that mean it, [ [title, year], … ] (the essential first)]
  const KINDS = [
    ["christmas", "Christmas", "🎄", /christmas|xmas|x-mas|santa|festive|holiday season|yule|noel|grinch|december/i, [
      ["Home Alone", 1990], ["Elf", 2003], ["It's a Wonderful Life", 1946], ["The Polar Express", 2004], ["How the Grinch Stole Christmas", 2000], ["Love Actually", 2003],
      ["Die Hard", 1988], ["National Lampoon's Christmas Vacation", 1989], ["A Christmas Story", 1983], ["The Holiday", 2006], ["Home Alone 2: Lost in New York", 1992],
      ["The Muppet Christmas Carol", 1992], ["Klaus", 2019], ["The Nightmare Before Christmas", 1993], ["Miracle on 34th Street", 1947], ["Arthur Christmas", 2011],
      ["The Santa Clause", 1994], ["Scrooged", 1988], ["Gremlins", 1984], ["White Christmas", 1954], ["Edward Scissorhands", 1990], ["Jingle All the Way", 1996],
    ]],
    ["halloween", "Halloween", "🎃", /hallowe?'?en|spooky|trick or treat|pumpkin|october|witch/i, [
      ["Hocus Pocus", 1993], ["Halloween", 1978], ["Beetlejuice", 1988], ["The Nightmare Before Christmas", 1993], ["Coraline", 2009], ["Scream", 1996],
      ["The Addams Family", 1991], ["Ghostbusters", 1984], ["Corpse Bride", 2005], ["Practical Magic", 1998], ["Sleepy Hollow", 1999],
      ["ParaNorman", 2012], ["Casper", 1995], ["The Craft", 1996], ["Monster House", 2006], ["Hotel Transylvania", 2012], ["The Exorcist", 1973],
      ["A Nightmare on Elm Street", 1984], ["The Rocky Horror Picture Show", 1975], ["Young Frankenstein", 1974], ["It", 2017],
    ]],
    ["horror", "Horror", "🩸", /horror|scary|scream|slasher|terror|creepy|fright|nightmare|zombie|haunted/i, [
      ["The Shining", 1980], ["The Exorcist", 1973], ["Halloween", 1978], ["Alien", 1979], ["The Thing", 1982], ["Psycho", 1960], ["Get Out", 2017],
      ["Hereditary", 2018], ["The Conjuring", 2013], ["A Nightmare on Elm Street", 1984], ["Scream", 1996], ["The Texas Chain Saw Massacre", 1974],
      ["Rosemary's Baby", 1968], ["It", 2017], ["Jaws", 1975], ["A Quiet Place", 2018], ["The Babadook", 2014], ["28 Days Later", 2002], ["The Ring", 2002],
      ["Train to Busan", 2016], ["Insidious", 2010], ["Midsommar", 2019], ["The Witch", 2015], ["Sinister", 2012], ["Talk to Me", 2023], ["Night of the Living Dead", 1968],
    ]],
    ["thanksgiving", "Thanksgiving", "🦃", /thanksgiving|friendsgiving|turkey/i, [
      ["Planes, Trains and Automobiles", 1987], ["Addams Family Values", 1993], ["Hannah and Her Sisters", 1986], ["Home for the Holidays", 1995], ["The Ice Storm", 1997],
      ["Pieces of April", 2003], ["The Family Stone", 2005], ["Prisoners", 2013], ["Scent of a Woman", 1992], ["Rocky", 1976], ["Little Women", 1994],
    ]],
    ["romance", "Date night", "🌹", /romanc|romantic|date night|valentine|love stor|rom-?com|couples|sweetheart/i, [
      ["The Notebook", 2004], ["Pride & Prejudice", 2005], ["When Harry Met Sally...", 1989], ["Titanic", 1997], ["La La Land", 2016], ["Notting Hill", 1999],
      ["Before Sunrise", 1995], ["Pretty Woman", 1990], ["About Time", 2013], ["Crazy Rich Asians", 2018], ["10 Things I Hate About You", 1999], ["Casablanca", 1942],
      ["Eternal Sunshine of the Spotless Mind", 2004], ["The Princess Bride", 1987], ["Sleepless in Seattle", 1993], ["Silver Linings Playbook", 2012], ["Dirty Dancing", 1987],
      ["Roman Holiday", 1953], ["Amélie", 2001], ["Her", 2013], ["Past Lives", 2023], ["(500) Days of Summer", 2009], ["Ghost", 1990],
    ]],
    ["newyear", "New Year's Eve", "🥂", /new year|nye|countdown/i, [
      ["When Harry Met Sally...", 1989], ["The Apartment", 1960], ["Trading Places", 1983], ["The Hudsucker Proxy", 1994], ["Bridget Jones's Diary", 2001],
      ["About Time", 2013], ["Carol", 2015], ["The Poseidon Adventure", 1972], ["Boogie Nights", 1997], ["Ghostbusters II", 1989], ["Strange Days", 1995],
    ]],
    ["easter", "Easter", "🌷", /easter|bunny/i, [
      ["The Prince of Egypt", 1998], ["The Ten Commandments", 1956], ["Ben-Hur", 1959], ["Willy Wonka & the Chocolate Factory", 1971], ["Wonka", 2023], ["Rise of the Guardians", 2012],
      ["Peter Rabbit", 2018], ["Chicken Run", 2000], ["Charlie and the Chocolate Factory", 2005], ["Easter Parade", 1948], ["Alice in Wonderland", 1951], ["Zootopia", 2016],
    ]],
    ["summer", "Summer", "☀️", /summer|beach|vacation|sunshine|heatwave/i, [
      ["Jaws", 1975], ["The Sandlot", 1993], ["Dazed and Confused", 1993], ["Stand by Me", 1986], ["Call Me by Your Name", 2017], ["Mamma Mia!", 2008], ["Grease", 1978],
      ["Dirty Dancing", 1987], ["Moonrise Kingdom", 2012], ["The Parent Trap", 1998], ["Do the Right Thing", 1989], ["Luca", 2021], ["The Way Way Back", 2013],
      ["Point Break", 1991], ["Aftersun", 2022], ["Wet Hot American Summer", 2001],
    ]],
    ["winter", "Winter", "❄️", /winter|snow|blizzard|frost|frozen|cold/i, [
      ["Frozen", 2013], ["Fargo", 1996], ["The Revenant", 2015], ["Groundhog Day", 1993], ["The Thing", 1982], ["Eternal Sunshine of the Spotless Mind", 2004], ["Snowpiercer", 2013],
      ["Little Women", 2019], ["Doctor Zhivago", 1965], ["Wind River", 2017], ["Let the Right One In", 2008], ["Misery", 1990], ["Cool Runnings", 1993], ["Ice Age", 2002],
      ["Happy Feet", 2006], ["Carol", 2015], ["The Hateful Eight", 2015],
    ]],
    ["scifi", "Sci-Fi", "🚀", /sci-?fi|science fiction|space|galaxy|alien|cosmic|future|robot|star wars|star trek/i, [
      ["2001: A Space Odyssey", 1968], ["Blade Runner", 1982], ["Alien", 1979], ["The Matrix", 1999], ["Interstellar", 2014], ["Inception", 2010], ["Star Wars", 1977],
      ["The Empire Strikes Back", 1980], ["Terminator 2: Judgment Day", 1991], ["Back to the Future", 1985], ["Dune", 2021], ["Dune: Part Two", 2024], ["Arrival", 2016],
      ["Blade Runner 2049", 2017], ["E.T. the Extra-Terrestrial", 1982], ["Jurassic Park", 1993], ["Aliens", 1986], ["The Martian", 2015], ["Ex Machina", 2015],
      ["Edge of Tomorrow", 2014], ["District 9", 2009], ["Children of Men", 2006], ["Gravity", 2013], ["WALL·E", 2008], ["Close Encounters of the Third Kind", 1977],
    ]],
    ["fantasy", "Fantasy", "✨", /fantasy|magic|wizard|dragon|fairy ?tale|middle-earth|harry potter|lord of the rings|enchanted/i, [
      ["The Lord of the Rings: The Fellowship of the Ring", 2001], ["The Lord of the Rings: The Two Towers", 2002], ["The Lord of the Rings: The Return of the King", 2003],
      ["Harry Potter and the Philosopher's Stone", 2001], ["Spirited Away", 2001], ["Pan's Labyrinth", 2006], ["The Princess Bride", 1987], ["The Wizard of Oz", 1939],
      ["Harry Potter and the Prisoner of Azkaban", 2004], ["Howl's Moving Castle", 2004], ["Pirates of the Caribbean: The Curse of the Black Pearl", 2003], ["Stardust", 2007],
      ["How to Train Your Dragon", 2010], ["The NeverEnding Story", 1984], ["Labyrinth", 1986], ["Big Fish", 2003], ["Shrek", 2001], ["The Hobbit: An Unexpected Journey", 2012],
      ["Harry Potter and the Deathly Hallows: Part 2", 2011], ["Willow", 1988],
    ]],
    ["superhero", "Superheroes", "🦸", /super ?hero|marvel|mcu|\bdc\b|avengers|batman|spider-?man|comic/i, [
      ["The Dark Knight", 2008], ["Avengers: Endgame", 2019], ["Avengers: Infinity War", 2018], ["Spider-Man: Into the Spider-Verse", 2018], ["Iron Man", 2008], ["The Avengers", 2012],
      ["Logan", 2017], ["Spider-Man 2", 2004], ["Batman Begins", 2005], ["Guardians of the Galaxy", 2014], ["Black Panther", 2018], ["Captain America: The Winter Soldier", 2014],
      ["Spider-Man: No Way Home", 2021], ["The Incredibles", 2004], ["Thor: Ragnarok", 2017], ["Deadpool", 2016], ["Spider-Man: Across the Spider-Verse", 2023], ["The Batman", 2022],
      ["X-Men: Days of Future Past", 2014], ["Superman", 1978], ["Wonder Woman", 2017], ["Deadpool & Wolverine", 2024],
    ]],
    ["action", "Action", "💥", /action|adrenaline|explosi|car chase|badass|blockbuster/i, [
      ["Mad Max: Fury Road", 2015], ["Die Hard", 1988], ["John Wick", 2014], ["The Dark Knight", 2008], ["Terminator 2: Judgment Day", 1991], ["Raiders of the Lost Ark", 1981],
      ["Mission: Impossible - Fallout", 2018], ["Gladiator", 2000], ["The Matrix", 1999], ["Top Gun: Maverick", 2022], ["Heat", 1995], ["Aliens", 1986], ["Kill Bill: Vol. 1", 2003],
      ["Speed", 1994], ["Casino Royale", 2006], ["The Raid", 2012], ["The Bourne Ultimatum", 2007], ["Lethal Weapon", 1987], ["Predator", 1987], ["John Wick: Chapter 4", 2023], ["Face/Off", 1997],
    ]],
    ["comedy", "Comedy", "😂", /comed|funny|laugh|hilarious|lol/i, [
      ["Superbad", 2007], ["The Hangover", 2009], ["Groundhog Day", 1993], ["Monty Python and the Holy Grail", 1975], ["Airplane!", 1980], ["Ferris Bueller's Day Off", 1986],
      ["Anchorman: The Legend of Ron Burgundy", 2004], ["Step Brothers", 2008], ["The Big Lebowski", 1998], ["Shaun of the Dead", 2004], ["Hot Fuzz", 2007], ["Bridesmaids", 2011],
      ["Dumb and Dumber", 1994], ["Mean Girls", 2004], ["21 Jump Street", 2012], ["The Grand Budapest Hotel", 2014], ["Ghostbusters", 1984], ["Some Like It Hot", 1959],
      ["Tropic Thunder", 2008], ["What We Do in the Shadows", 2014], ["Booksmart", 2019],
    ]],
    ["family", "Family & animated", "🧸", /family|kids|disney|pixar|animated|animation|cartoon/i, [
      ["Toy Story", 1995], ["The Lion King", 1994], ["Finding Nemo", 2003], ["Up", 2009], ["Inside Out", 2015], ["Coco", 2017], ["Toy Story 3", 2010], ["Ratatouille", 2007],
      ["WALL·E", 2008], ["Monsters, Inc.", 2001], ["Shrek", 2001], ["Aladdin", 1992], ["Beauty and the Beast", 1991], ["Frozen", 2013], ["Zootopia", 2016], ["The Incredibles", 2004],
      ["How to Train Your Dragon", 2010], ["Moana", 2016], ["My Neighbor Totoro", 1988], ["Paddington 2", 2017], ["The Iron Giant", 1999], ["Encanto", 2021],
    ]],
    ["mystery", "Mystery & thrillers", "🕵️", /myster|whodun+it|detective|murder|thriller|crime|noir|sherlock|suspense|late night/i, [
      ["Knives Out", 2019], ["Se7en", 1995], ["Gone Girl", 2014], ["Zodiac", 2007], ["The Usual Suspects", 1995], ["Prisoners", 2013], ["Memento", 2000], ["Shutter Island", 2010],
      ["The Silence of the Lambs", 1991], ["Chinatown", 1974], ["Rear Window", 1954], ["Vertigo", 1958], ["Murder on the Orient Express", 1974], ["L.A. Confidential", 1997],
      ["Glass Onion: A Knives Out Mystery", 2022], ["Gosford Park", 2001], ["Clue", 1985], ["Mystic River", 2003], ["The Prestige", 2006], ["Death on the Nile", 1978],
    ]],
    ["heist", "Heist", "💰", /heist|robbery|con artist|caper/i, [
      ["Ocean's Eleven", 2001], ["Heat", 1995], ["Inception", 2010], ["Baby Driver", 2017], ["Inside Man", 2006], ["Reservoir Dogs", 1992], ["The Town", 2010], ["Snatch", 2000],
      ["The Italian Job", 2003], ["Lock, Stock and Two Smoking Barrels", 1998], ["Logan Lucky", 2017], ["Hell or High Water", 2016], ["Dog Day Afternoon", 1975], ["The Sting", 1973],
      ["The Thomas Crown Affair", 1999], ["Now You See Me", 2013], ["Widows", 2018], ["Fast Five", 2011],
    ]],
    ["war", "War", "🎖️", /\bwar\b|wwii|ww2|world war|military|soldier|battle/i, [
      ["Saving Private Ryan", 1998], ["Apocalypse Now", 1979], ["Schindler's List", 1993], ["Full Metal Jacket", 1987], ["1917", 2019], ["Platoon", 1986], ["Dunkirk", 2017],
      ["Inglourious Basterds", 2009], ["Hacksaw Ridge", 2016], ["The Bridge on the River Kwai", 1957], ["Black Hawk Down", 2001], ["Come and See", 1985], ["Das Boot", 1981],
      ["All Quiet on the Western Front", 2022], ["The Deer Hunter", 1978], ["Letters from Iwo Jima", 2006], ["Paths of Glory", 1957], ["Lawrence of Arabia", 1962], ["Fury", 2014],
    ]],
    ["western", "Western", "🤠", /western|cowboy|wild west|outlaw|gunslinger/i, [
      ["The Good, the Bad and the Ugly", 1966], ["Once Upon a Time in the West", 1968], ["Unforgiven", 1992], ["Django Unchained", 2012], ["True Grit", 2010], ["The Searchers", 1956],
      ["Butch Cassidy and the Sundance Kid", 1969], ["3:10 to Yuma", 2007], ["The Magnificent Seven", 1960], ["Tombstone", 1993], ["High Noon", 1952], ["Rio Bravo", 1959],
      ["For a Few Dollars More", 1965], ["Dances with Wolves", 1990], ["The Hateful Eight", 2015], ["The Assassination of Jesse James by the Coward Robert Ford", 2007], ["The Power of the Dog", 2021],
    ]],
    ["apocalypse", "End of the world", "☢️", /apocalyp|end of the world|doomsday|disaster|armageddon|survival|zombies|pandemic/i, [
      ["Mad Max: Fury Road", 2015], ["Children of Men", 2006], ["28 Days Later", 2002], ["I Am Legend", 2007], ["World War Z", 2013], ["Contagion", 2011], ["Snowpiercer", 2013],
      ["The Day After Tomorrow", 2004], ["Armageddon", 1998], ["Deep Impact", 1998], ["War of the Worlds", 2005], ["Train to Busan", 2016], ["A Quiet Place", 2018], ["Twelve Monkeys", 1995],
      ["The Terminator", 1984], ["Independence Day", 1996], ["Dawn of the Dead", 2004], ["The Road", 2009], ["Melancholia", 2011],
    ]],
    ["mindbending", "Mind-bending", "🌀", /mind|twist|trippy|puzzle|brain/i, [
      ["Inception", 2010], ["Memento", 2000], ["Shutter Island", 2010], ["Fight Club", 1999], ["The Prestige", 2006], ["The Matrix", 1999], ["Donnie Darko", 2001],
      ["Eternal Sunshine of the Spotless Mind", 2004], ["Arrival", 2016], ["Everything Everywhere All at Once", 2022], ["The Sixth Sense", 1999], ["Mulholland Drive", 2001],
      ["Predestination", 2014], ["Tenet", 2020], ["Oldboy", 2003], ["Black Swan", 2010], ["Coherence", 2013], ["Primer", 2004], ["Being John Malkovich", 1999], ["Paprika", 2006],
    ]],
    ["eighties", "'80s classics", "📼", /80s|eighties|retro|nostalg|throwback|childhood/i, [
      ["Back to the Future", 1985], ["The Breakfast Club", 1985], ["E.T. the Extra-Terrestrial", 1982], ["Ferris Bueller's Day Off", 1986], ["The Goonies", 1985], ["Ghostbusters", 1984],
      ["Raiders of the Lost Ark", 1981], ["The Empire Strikes Back", 1980], ["Die Hard", 1988], ["Top Gun", 1986], ["Stand by Me", 1986], ["Gremlins", 1984], ["The Princess Bride", 1987],
      ["Who Framed Roger Rabbit", 1988], ["Beetlejuice", 1988], ["The Karate Kid", 1984], ["Big", 1988], ["Dead Poets Society", 1989], ["Indiana Jones and the Last Crusade", 1989], ["Aliens", 1986],
    ]],
    ["cozy", "Feel-good", "☕", /cozy|cosy|comfort|feel.?good|wholesome|happy|sunday/i, [
      ["Paddington 2", 2017], ["Amélie", 2001], ["Little Miss Sunshine", 2006], ["The Grand Budapest Hotel", 2014], ["Chef", 2014], ["The Intouchables", 2011], ["Forrest Gump", 1994],
      ["About Time", 2013], ["School of Rock", 2003], ["The Secret Life of Walter Mitty", 2013], ["Hunt for the Wilderpeople", 2016], ["CODA", 2021], ["Sing Street", 2016],
      ["Kiki's Delivery Service", 1989], ["Julie & Julia", 2009], ["Ratatouille", 2007], ["Up", 2009], ["Groundhog Day", 1993], ["Notting Hill", 1999],
    ]],
    ["tearjerker", "Tearjerkers", "💧", /cry|tear|sad|emotional|heartbreak|grief|melanchol/i, [
      ["The Green Mile", 1999], ["Schindler's List", 1993], ["Grave of the Fireflies", 1988], ["Life Is Beautiful", 1997], ["Forrest Gump", 1994], ["Coco", 2017], ["Hachi: A Dog's Tale", 2009],
      ["The Pursuit of Happyness", 2006], ["Manchester by the Sea", 2016], ["A Star Is Born", 2018], ["Good Will Hunting", 1997], ["Million Dollar Baby", 2004], ["Room", 2015],
      ["The Notebook", 2004], ["Titanic", 1997], ["Marley & Me", 2008], ["Aftersun", 2022], ["Brokeback Mountain", 2005], ["Moonlight", 2016], ["Dead Poets Society", 1989],
    ]],
    ["oscars", "Best Picture winners", "🏆", /oscar|academy award|best picture|award/i, [
      ["The Godfather", 1972], ["The Godfather Part II", 1974], ["Casablanca", 1942], ["Schindler's List", 1993], ["The Lord of the Rings: The Return of the King", 2003], ["Parasite", 2019],
      ["One Flew Over the Cuckoo's Nest", 1975], ["The Silence of the Lambs", 1991], ["Forrest Gump", 1994], ["Gladiator", 2000], ["No Country for Old Men", 2007], ["The Departed", 2006],
      ["Oppenheimer", 2023], ["Everything Everywhere All at Once", 2022], ["Amadeus", 1984], ["Lawrence of Arabia", 1962], ["Titanic", 1997], ["Unforgiven", 1992], ["Spotlight", 2015],
      ["12 Years a Slave", 2013], ["Rocky", 1976], ["Slumdog Millionaire", 2008],
    ]],
    ["sports", "Sports", "🏆", /sport|football|soccer|boxing|basketball|baseball|racing|olympic/i, [
      ["Rocky", 1976], ["Raging Bull", 1980], ["Moneyball", 2011], ["Remember the Titans", 2000], ["Creed", 2015], ["Rush", 2013], ["Ford v Ferrari", 2019], ["Million Dollar Baby", 2004],
      ["Warrior", 2011], ["The Fighter", 2010], ["Field of Dreams", 1989], ["Hoosiers", 1986], ["Friday Night Lights", 2004], ["Miracle", 2004], ["Coach Carter", 2005],
      ["Cool Runnings", 1993], ["A League of Their Own", 1992], ["The Blind Side", 2009], ["I, Tonya", 2017], ["Challengers", 2024],
    ]],
    ["musical", "Musicals", "🎶", /musical|sing|music|broadway|dance/i, [
      ["The Sound of Music", 1965], ["Singin' in the Rain", 1952], ["La La Land", 2016], ["West Side Story", 1961], ["Grease", 1978], ["The Greatest Showman", 2017], ["Mamma Mia!", 2008],
      ["Chicago", 2002], ["Moulin Rouge!", 2001], ["Les Misérables", 2012], ["Mary Poppins", 1964], ["The Wizard of Oz", 1939], ["Dreamgirls", 2006], ["Wicked", 2024], ["Cabaret", 1972],
      ["Little Shop of Horrors", 1986], ["Whiplash", 2014], ["Bohemian Rhapsody", 2018], ["Rocketman", 2019], ["Elvis", 2022],
    ]],
    ["roadtrip", "Road trip", "🚗", /road ?trip|on the road|highway|journey/i, [
      ["Thelma & Louise", 1991], ["Little Miss Sunshine", 2006], ["Planes, Trains and Automobiles", 1987], ["Rain Man", 1988], ["Into the Wild", 2007], ["Green Book", 2018],
      ["The Motorcycle Diaries", 2004], ["Y Tu Mamá También", 2001], ["Easy Rider", 1969], ["Nebraska", 2013], ["Paris, Texas", 1984], ["Midnight Run", 1988], ["Sideways", 2004],
      ["Zombieland", 2009], ["National Lampoon's Vacation", 1983], ["Mad Max: Fury Road", 2015], ["The Straight Story", 1999],
    ]],
    ["anime", "Anime films", "🐉", /anime|ghibli|japanese animation/i, [
      ["Spirited Away", 2001], ["Your Name.", 2016], ["Princess Mononoke", 1997], ["My Neighbor Totoro", 1988], ["Akira", 1988], ["Grave of the Fireflies", 1988], ["Howl's Moving Castle", 2004],
      ["A Silent Voice", 2016], ["Perfect Blue", 1998], ["Ghost in the Shell", 1995], ["Weathering with You", 2019], ["Kiki's Delivery Service", 1989], ["Wolf Children", 2012],
      ["The Boy and the Heron", 2023], ["Porco Rosso", 1992], ["Castle in the Sky", 1986], ["Suzume", 2022], ["The Girl Who Leapt Through Time", 2006],
      ["Demon Slayer -Kimetsu no Yaiba- The Movie: Mugen Train", 2020], ["Paprika", 2006],
    ]],
  ].map(([id, label, emoji, match, films]) => ({ id, label, emoji, match, films }));

  // the kind a list's name says ("Christmas Horror Marathon": the first one it names)
  function kindFor(name) {
    const n = String(name || "");
    let best = null;
    let at = Infinity;
    KINDS.forEach((k) => {
      const m = n.match(k.match);
      if (m && m.index < at) {
        best = k;
        at = m.index;
      }
    });
    return best;
  }

  // a film on TMDB, by name and year (kept for this visit; null: not found)
  const found = new Map();
  function film([title, year]) {
    const k = `${title}|${year}`;
    if (!found.has(k))
      found.set(
        k,
        TMDB.findFilm(title, year)
          .then((h) => (h && h.poster && (!h.score || h.score >= 6) ? h : null))
          .catch(() => {
            found.delete(k);
            return null;
          })
      );
    return found.get(k);
  }
  const refOf = (h) => `${h.mediaType}-${h.tmdbId}`;

  let overlay = null;
  let st = null; // { listId, kind, n, removed: Set(ref), extra: [hit], pool: [hit] | null, run }
  const COUNTS = [10, 15, 20];

  function open(listId) {
    const list = Store.lists().find((l) => l.id === listId);
    if (!list) return;
    if (!window.TMDB || !TMDB.enabled()) return toast("Generating a marathon needs TMDB");
    st = { listId, kind: kindFor(list.name), n: 10, removed: new Set(), extra: [], pool: null, run: 0 };
    if (!overlay) {
      overlay = Cards.makeOverlay(
        "adder-modal mr-modal",
        `<div class="mr-head"><span class="mr-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
           <div><h3>Generate a marathon</h3><p class="mr-sub"></p></div></div>
         <div class="mr-kinds" role="group" aria-label="Kind of marathon"></div>
         <div class="mr-bar">
           <div class="top10-switch mr-count" role="group" aria-label="How many films">${COUNTS.map((c) => `<button type="button" class="top10-tab" data-mr-n="${c}">${c} films</button>`).join("")}</div>
           <button type="button" class="btn mr-more"><i class="fa-solid fa-plus"></i> More picks</button>
         </div>
         <div class="ad-results mr-list"></div>
         <form class="glass-search mr-search" role="search">
           <i class="fa-solid fa-magnifying-glass gs-icon" aria-hidden="true"></i>
           <input type="search" name="q" placeholder="Add another film to it…" aria-label="Add another film" autocomplete="off" />
         </form>
         <div class="mr-found" hidden></div>
         <div class="mr-foot"><button type="button" class="btn btn-primary mr-add" disabled></button></div>`
      );
      wire();
    }
    overlay.querySelector('[name="q"]').value = "";
    overlay.querySelector(".mr-found").hidden = true;
    paint();
    Cards.openModal(overlay);
    if (st.kind) load();
  }

  // the films picked now, in order: the kind's first n (less the ones taken out), then yours
  function picked() {
    const seen = new Set();
    const out = [];
    (st.pool || [])
      .slice(0, st.n)
      .filter(Boolean)
      .concat(st.extra)
      .forEach((h) => {
        const r = refOf(h);
        if (st.removed.has(r) || seen.has(r)) return;
        seen.add(r);
        out.push(h);
      });
    return out;
  }

  async function load() {
    const run = ++st.run;
    st.pool = null;
    paint();
    const list = await Promise.all(st.kind.films.map(film));
    if (run !== st.run) return;
    // (not found: left out; the same film twice: once)
    const seen = new Set();
    st.pool = list.filter((h) => h && !seen.has(refOf(h)) && seen.add(refOf(h)));
    paint();
  }

  function paint() {
    const list = Store.lists().find((l) => l.id === st.listId);
    if (!list) return;
    overlay.querySelector(".mr-sub").innerHTML = `For <b>${esc(list.name)}</b>: the best-known, best-loved films for it. Take out any you don't want, or add your own.`;
    overlay.querySelector(".mr-kinds").innerHTML = KINDS.map(
      (k) => `<button type="button" class="mr-kind${st.kind && st.kind.id === k.id ? " on" : ""}" data-mr-kind="${k.id}"><span>${k.emoji}</span>${esc(k.label)}</button>`
    ).join("");
    overlay.querySelectorAll("[data-mr-n]").forEach((b) => b.classList.toggle("active", Number(b.dataset.mrN) === st.n));
    const box = overlay.querySelector(".mr-list");
    const more = overlay.querySelector(".mr-more");
    const add = overlay.querySelector(".mr-add");
    overlay.querySelector(".mr-bar").hidden = !st.kind;
    if (!st.kind) {
      box.innerHTML = '<p class="ad-empty"><i class="fa-solid fa-arrow-up"></i> Pick the kind of marathon above.</p>';
      more.hidden = true;
      add.disabled = true;
      add.textContent = "Add to the list";
      return;
    }
    if (!st.pool) {
      box.innerHTML = '<p class="ad-loading"><i class="fa-solid fa-spinner fa-spin"></i> Picking the films…</p>';
      add.disabled = true;
      return;
    }
    const films = picked();
    more.hidden = st.n >= st.pool.length;
    box.innerHTML = films.length
      ? films
          .map((h, i) => {
            const lib = Cards.inLibrary(h);
            const inList = lib && list.items.includes(lib.id);
            const note = inList ? "already in this list" : lib ? (Store.isWatched(lib) ? "you've seen it" : "in your library") : "";
            return `<div class="ad-row mr-row${inList ? " in" : ""}">
                <span class="mr-num">${i + 1}</span>
                <img src="${Store.poster(h.poster, "w92")}" alt="" loading="lazy" />
                <div><strong>${esc(Lang.title(h))}</strong><small>${[h.year, h.score ? `★ ${h.score.toFixed(1)}` : "", note].filter(Boolean).map(esc).join(" · ")}</small></div>
                <button type="button" class="mr-x" data-mr-x="${refOf(h)}" aria-label="Take ${esc(Lang.title(h))} out" title="Take it out"><i class="fa-solid fa-xmark"></i></button>
              </div>`;
          })
          .join("")
      : '<p class="ad-empty">Every film is taken out: add one below, or pick More picks.</p>';
    const toAdd = films.filter((h) => {
      const lib = Cards.inLibrary(h);
      return !(lib && list.items.includes(lib.id));
    }).length;
    add.disabled = !toAdd;
    add.innerHTML = toAdd ? `<i class="fa-solid fa-plus"></i> Add ${toAdd} film${toAdd === 1 ? "" : "s"} to “${esc(list.name)}”` : "Everything is in the list already";
  }

  let typing;
  let hits = [];
  async function search(q) {
    const box = overlay.querySelector(".mr-found");
    if (!q) return (box.hidden = true);
    box.hidden = false;
    box.innerHTML = '<p class="ad-loading"><i class="fa-solid fa-spinner fa-spin"></i> Searching…</p>';
    try {
      const { results } = await TMDB.searchSmart(q, "all", 1);
      if (overlay.querySelector('[name="q"]').value.trim() !== q) return;
      hits = results.filter((h) => h.poster).slice(0, 6);
      box.innerHTML = hits.length
        ? hits
            .map(
              (h, n) => `<button type="button" class="mr-hit" data-mr-hit="${n}"><img src="${Store.poster(h.poster, "w92")}" alt="" loading="lazy" /><span>${esc(Lang.title(h))}${
                h.year ? ` <small>${h.year}</small>` : ""
              }</span><i class="fa-solid fa-plus"></i></button>`
            )
            .join("")
        : '<p class="ad-empty">Nothing found. Try another spelling.</p>';
    } catch (e) {
      box.innerHTML = `<p class="ad-empty">Couldn't search: ${esc(e.message)}</p>`;
    }
  }

  function wire() {
    const input = overlay.querySelector('[name="q"]');
    overlay.querySelector(".mr-search").addEventListener("submit", (e) => {
      e.preventDefault();
      clearTimeout(typing);
      search(input.value.trim());
    });
    input.addEventListener("input", () => {
      clearTimeout(typing);
      typing = setTimeout(() => search(input.value.trim()), 350);
    });
    overlay.addEventListener("click", (e) => {
      const k = e.target.closest("[data-mr-kind]");
      if (k) {
        const kind = KINDS.find((x) => x.id === k.dataset.mrKind);
        if (st.kind === kind) return;
        Object.assign(st, { kind, removed: new Set(), extra: [] });
        return load();
      }
      const n = e.target.closest("[data-mr-n]");
      if (n) {
        st.n = Number(n.dataset.mrN);
        return paint();
      }
      if (e.target.closest(".mr-more")) {
        st.n = Math.min((st.pool || []).length, st.n + 5);
        paint();
        const box = overlay.querySelector(".mr-list");
        return box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
      }
      const x = e.target.closest("[data-mr-x]");
      if (x) {
        st.removed.add(x.dataset.mrX);
        st.extra = st.extra.filter((h) => refOf(h) !== x.dataset.mrX);
        return paint();
      }
      const hit = e.target.closest("[data-mr-hit]");
      if (hit) {
        const h = hits[Number(hit.dataset.mrHit)];
        if (!h) return;
        st.removed.delete(refOf(h));
        if (!picked().some((p) => refOf(p) === refOf(h))) st.extra.push(h);
        input.value = "";
        overlay.querySelector(".mr-found").hidden = true;
        paint();
        const box = overlay.querySelector(".mr-list");
        return box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
      }
      if (e.target.closest(".mr-add")) addAll();
    });
  }

  // into the list, in the marathon's order (a list puts the newest first: so the last goes in first)
  function addAll() {
    const list = Store.lists().find((l) => l.id === st.listId);
    if (!list) return;
    let added = 0;
    picked()
      .slice()
      .reverse()
      .forEach((h) => {
        // (not in your library yet: it goes in on your Watchlist)
        const item = Cards.addHit(h, Cards.inLibrary(h) ? {} : { watchlist: true });
        const now = Store.lists().find((l) => l.id === st.listId);
        if (item && now && !now.items.includes(item.id)) {
          Store.toggleInList(st.listId, item.id);
          added++;
        }
      });
    Cards.closeModal(overlay);
    toast(`${added} film${added === 1 ? "" : "s"} added to “${list.name}”. Enjoy the marathon 🍿`);
  }

  window.Marathon = { open, kindFor, KINDS };
})();
