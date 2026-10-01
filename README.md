# Movie Nights

Your own private diary of movies, TV shows and anime: rated, ranked, and saved for later. Everyone who signs in gets their own library.

Plain HTML, CSS and JavaScript. No build step, no frameworks, nothing to install.

## Open it

Double-click **`Start Movie Nights.bat`**. It opens the site in your browser at
`http://localhost:8080`. Keep the small black window open while you use the site, and close
it when you're done.

Why not just double-click `index.html`? That works too, but YouTube refuses to play
trailers inside a page opened straight from a file. Through the launcher, trailers play in
the pop-up.

It also works on GitHub Pages (trailers included): push the folder, then in the repo go to
**Settings → Pages → Deploy from branch**.

## Publishing

The site lives at **https://goldenmfox.github.io/Movie-Nights/** (GitHub Pages, from
`github.com/GoldenMFox/Movie-Nights`, branch `main`).

To publish changes, double-click **`Publish to GitHub.bat`**. It saves every change in this
folder and uploads it, and the live site updates a minute or two later. Libraries aren't
part of the site's files (they live in each person's account), so publishing never touches them.

## Install it as an app

Open **https://goldenmfox.github.io/Movie-Nights/** on your phone, then:

- **Android** (Chrome, Brave, Edge): profile menu (your picture, top right) → **Install the app**,
  or the browser menu → **Install app** / **Add to Home screen**.
- **iPhone / iPad** (Safari): the **Share** button → **Add to Home Screen**.

It opens full screen with its own icon, has a back button in the top left, and your own
list still opens without internet (Discover, trending and trailers need a connection).
It updates by itself whenever the site is published.

## Pages

| Page | What it does |
| --- | --- |
| `discover.html` | Browse and search **all** movies, TV shows and anime on TMDB (trending, popular, in cinemas, coming soon, top rated, anime), or browse by genre. Search forgives typos ("forest gump" finds Forrest Gump) and hides shorts / posterless uploads. Unreleased titles get a "Coming soon · date" label (the cinema date in Romania). Add anything to your library or watchlist |
| `search.html` | **Advanced search** (under the navbar search, in the profile menu, on Discover): every filter at once on all of TMDB, the results changing as you pick. Movies: genres (all of them), years or a decade, length, score, language, country, director (only the films they directed), actor, franchise (its films checked with their film facts), streaming in your country (or on your services), age rating (US), black & white; TV shows: genres, years, episode length, score, language, country, streaming. Sort: most popular, top rated, most voted, newest, oldest, box office. The filters in use show as chips (tap to remove); every filter is in the address, so a search can be bookmarked or shared. On a phone the filters fold into a panel ("Filters 3") |
| `index.html` | Home, live from TMDB: this week's trending titles in the slideshow, **Top 10 today** (movies / TV shows switch), then rows for in cinemas, coming soon, popular and top rated movies / TV / anime. At the bottom, "your own rows at the bottom (Continue watching, recently added, your top rated…); your numbers are on the Profile page, "What should I watch?" is the shuffle button in the navbar. (Without a TMDB key it shows your own list instead.) |
| `movies.html`, `tv-shows.html`, `anime.html` | Full lists with search, genre, sort, rating and year filters, opening on **Watched** (All when nothing is watched yet), and chips in two groups: **All = Watched + Watchlist** (every title is in one of the two: watched = rated, a watch date, or not only on the Watchlist), then filters inside them: **Rated + Not rated = Watched** (Not rated counts only what you've seen), Favorites, New releases (out in the last 6 months). The line under the chips says what the number is made of ("1110 movies · 1087 watched · 23 on your Watchlist"); each chip explains itself on hover |
| `watchlist.html` | **Coming up** (release dates of movies you're waiting for, new seasons / episodes of your shows), then two rows, **Plan to watch** and **Favorites**; "See all" opens the full list below them, with a switch between the two, search, filters and **On my services**. (`favorites.html` just forwards here.) |
| `title.html?id=...` | Details for one title (in your library = watched: no Watchlist button; still on the Watchlist: **On Watchlist** + **Watched**): your score, **Watched on** (change the date), trailer, where to watch, overview, **Your progress** (shows: the episode you're at), **Your notes**, **Seasons** (TV: each season's trailer), cast, media, reviews, "more like this" (your titles sharing the most genres) |
| `person.html?id=...` | An actor / crew member (tap a cast card or the director's name): photo, bio, facts, best known for, full filmography with a role filter |
| Sharing | **Share** on a title page (computers and tablets: the ⋯ menu at the top right of the picture, with Add to a list; phones: the round button at the top) opens the share sheet: a live preview of a **picture card** (1080 × 1350: the blurred backdrop, the poster, title, your score and name, your note, the logo; `js/components/share.js`), switches for your rating and your name, a note, the link with Copy, **Share** (phones: the picture and the link together) and **Save image**. The message reads "🎬 Title (year) / ⭐ 9/10 from your name / your note" and a short link, `s/?m157336.9.Your_Name.Your_note` (`s/index.html`: m / t + TMDB id, then score with "," for a decimal, name, note; each only if you chose it). It opens the title page for anyone, account or not (`title.html?tmdb=movie-157336`, by TMDB's id, so it works outside your library too; someone with the title in their own library is taken to theirs), with what you chose to add (`from`, `r`, `note`) in a small "shared with you" card at the foot of the screen until it's closed. The first share links (`share.html?t=…`) forward there. The link preview in chats is the same for every title (the site is static) |
| `tier-list.html` | Rank what you've watched from S to D: drag posters from the **unranked tray** at the bottom of the screen (phones: tap a poster, then a tier), **Quick rank** (one poster at a time with your own rating on it and the tier that score points to lit up; an All / Movies / TV / Anime switch to rank one kind at a time; keys S A B C D, Skip, Undo) and **Fill from my ratings** (10 → S, 9 → A, 8 → B, 7 → C, below → D, with Undo). **Franchises**: two or more watched films of one series (TMDB collection, e.g. The Lord of the Rings) in the same place show as one stacked poster with a count, and move, drag and quick-rank as one (Quick rank shows every film with your score and your average; "Rank them one by one" splits it there). Tap a franchise for **Split** (rank its films one by one from now on) or **Group** again; the Franchises switch in the tray turns it all off. Each film is still stored on its own. Only watched titles: not the ones only on your Watchlist. **Your tier lists**: Save keeps the board as a named tier list (as many as you like: all-time, this year, horror only…), shown as cards with a tiny version of their tiers; the one on the board has a red edge, and the next Save updates it (Save as new makes a copy, New tier list starts a clean board; leaving unsaved changes asks first). Tap a card to look at it (every tier, tap a poster to open it), then Open to edit, Rename or Delete (with Undo). Saved with your profile, so they follow you to every device |
| `box-office.html` | **Box Office** (in the navbar after Tier List; on phones and on tablets under 1100px in the profile menu; and the Budget & box office card on a movie page): the highest-grossing films worldwide (TMDB's revenue and budget, US dollars, not adjusted for inflation): All time / this year / last year or any year, any genre (in the address: `?year=2025&genre=Horror`). A podium of the top 3 (the backdrop turns between them; point at or tap one), four numbers that count up (the top 20 together, typical return, best return, most expensive), **What they cost vs what they made**: a poster skyline of the top 20 by gross (a column's height is what the film made, the striped band at its foot what it cost, its multiple on top; the columns rise as they come into view), with a readout of the film you point at or tap (cost → made, profit, the multiple in the verdict's colour). **Compare**: This chart / Franchises (19 big ones + search, in release order) / Directors (14 + search, their directing credits in release order, no concert films or documentaries) / Studios (17, their biggest) / Year by year (each of the last 20 years' #1) / Your films (the 20 biggest you've watched), then the chart: sort by gross, budget, return or profit (the rows glide to their places); **List** (a bar per film in its verdict's colour with the budget striped inside it, cost and profit under it, the backdrop sliding in behind the row you point at, gold / silver / bronze edges for the top 3; tap a row for profit, what every $1 made and the trailer) or **Posters** (a wall with rank medals, gross and multiple); quick buttons on each (Trailer, Watchlist, Watched); All / Watched / Not seen yet (signed in); "Watched ★ 8" on yours, 20 at a time. The view is remembered (`mn:boView`). **Your box office**: what the films you've watched made together, the biggest one, the biggest flop, your 8+ money maker and hidden gem, the best return and the most expensive. Tap a card for your **top 10** in it (a pop-up: rank, poster, the amount, a bar against #1, the card's own film marked; each row opens its film); tap its poster to open that film. **Adjusted for inflation** (a switch at the top, beside the years; `?real=1`): the whole page (chart, podium, cards, the skyline's comparisons, Your box office) with every amount in this year's dollars (US CPI-U yearly averages in the page, the current year estimated until published; a film at its release year's prices); for all time the classics are fetched too (the biggest from before 1990 and 1990-2004), all ranked in today's money (Gone with the Wind first); the details show "At the time". Budgets / grosses cached in one record (`bo:films`) |
| `profile.html` | Your name, **your picture** (tap it: a character. Tabs: Movie & TV cast (TMDB photos, famous titles or any title's cast), Superheroes (the Marvel and DC movie wikis), Harry Potter, Star Wars, Game of Thrones, Disney (the best-known characters of each, from free fan-made character databases); saved with your profile), stats, **Challenges & achievements** (17 challenges, each with bronze / silver / gold: 10 → 25 → 50 classics, titles from 10 → 25 → 40 countries, 5 → 8 → 12 films by one director, 5 → 10 → 20 horror titles in one October, movies from every decade 1930s–2020s, 5 → 10 → 20 titles with one actor, a franchise, not in English, over 2h30, a marathon day, genres, anime, series, titles, ratings, perfect 10s, trivia; medals whose ring fills to the next level, "Next up" = the closest three, tap one for its levels with the day you reached each and the titles that count; a level you just reached gets a "New" ribbon and a toast; `js/components/achievements.js`), **Watch diary** (watched this year / month, a chart of the last 12 months, "a year ago you watched…", **Wrapped**) and charts |
| `settings.html` | Theme, **your country** and **your streaming services**, **Import** from IMDb / Letterboxd, backup. The owner also sees **Members** and the TMDB / OMDb settings (marked Admin only) |

The navbar search (or `/` on any page) searches your library and all of TMDB.

**What should I watch?** (the shuffle button in the navbar, on every page, next to your picture on phones): pick where from (your Watchlist, your
Favorites for a rewatch, or Discover: well-liked titles from TMDB you haven't added), what
(movie / series / anime), the mood (fun, intense, thought-provoking, emotional),
the era (any, new, the 2010s, 2000s, '90s or '80s, or classics before 1980), who's watching (alone, date, family: no horror,
war, crime or thrillers, friends), the time you have and, optionally, only your streaming
services. It makes a shortlist of five, best fits first, each with why it fits, and spins to
one: tap another poster to look at it, ✕ drops one ("Not tonight"), Spin picks again, New
shortlist draws five more. Trailer and Watchlist buttons on the pick. Your answers are
remembered (`mn:picker`).

**Borrowed from Netflix, HBO Max, Plex and Prime Video:**

- **Because you liked …** (Home): two rows right before the anime rows for two of your
  best-rated movies / shows (8+ or favorites), and one for an anime under the anime rows. TMDB recommendations,
  different each visit, without what you already have; anime only in the anime row. Only
  well-known titles (2,000+ votes on TMDB for movies, 500+ for shows / anime), best-known first;
  a title of yours with fewer than 6 of those makes way for another.
  The page of a title you loved (8+ or a favorite) has its own row too, above "Recommended on
  TMDB" (it takes that row's place).
- **Match %** ("92% match", `js/services/taste.js`): how much you'll probably like a title
  (every title, the ones you've seen too, so it's consistent), from how you rate its genres
  against your own average, nudged by its TMDB score. Shows after 5 rated titles: "86%" in the poster's bottom-right corner (Poster
  details on; with posters only it's in the hover preview instead), and "86% match" in the
  hover preview and on title pages.
- **Remind me** (titles not out yet: bell on the card, title page, quick menu): puts it in
  **Coming up** on the Watchlist page without adding it to anything. Saved with your profile;
  drops off a month after release.
- **Franchises** (title pages): "Harry Potter Collection · You've seen 2 of 8", every film in it.
  "Seen" = in your library (in your library means watched), unless it's only on your
  Watchlist; those are counted apart ("· 1 on your Watchlist"). Updates as you add or rate.
  X-Ray's "where you've seen the cast" counts the same way: each person's posters as a fanned deck that spreads on hover (a tap on phones). "Made in" shows the flags only.
- **Your own lists** ("Halloween marathon", "Date night"): **New list** on the Watchlist page,
  then **+ Add titles** (on the list's row, or in the full list): search your library and all
  of TMDB and tap Add. Also from the quick menu or a title page's list button (top right, beside Share; a badge shows how many of your lists it's in).
  A title that isn't in your library yet goes in on your Watchlist (not watched yet). Each list gets a
  row and a place in the full-list switch (with Rename / Delete). Saved with your profile.
- **X-Ray** (title pages): the tagline as a banner; budget vs box office as two bars with a
  verdict (Blockbuster 5×+, Hit 2×+, Broke even, Flop); the release date with "2 months ago" /
  "in 5 days" (series: episodes, last aired); awards in gold (OMDb); studio / network logos;
  flags of the countries and the original language; and **where you've seen the cast**: a card
  per person (who they play here, and small posters of your titles they're in).
- **Movie Nights Wrapped** (Profile → Watch diary): your year as a story: how many you watched
  (and the hours: "3.6 days worth of movies"), where it started, top genres, busiest month, your
  best-rated, your favorite decade (a column per decade, the oldest title), the countries your
  titles came from (flags, how much wasn't in English), your favorite director (their films,
  the runners-up), the face of your year ("You watched 4 movies starring Mark", the others),
  how long your movies ran (average, a bar per length, the longest and shortest), your average
  score, fun facts, and a summary you can share: watched, hours, average rating, countries,
  top genre, favorite director. Runtimes, directors, cast and countries come from each title's
  film facts (`js/services/facts.js`: asked from TMDB once, then kept for half a year). Plays by itself like Instagram stories
  (tap right / left, hold to pause, ← → and Space on a computer); lines slide in, numbers count
  up, bars grow, colours drift behind, a wall of your year's posters scrolls on the intro and
  summary, and the summary ends with confetti and Replay.

**New library?** Home and Watchlist show a welcome card with the three ways to start
(Discover, search, import).

**Import** (Settings): the `.csv` exports of IMDb (Your ratings, Your watchlist; matched on TMDB
by IMDb id) and Letterboxd (ratings / watched / diary / watchlist.csv; matched by name + year,
stars × 2 = score). You see what was found before anything is added, and titles you already
have keep your own score.

**Watch diary**: the day you rate a title or press Watched is saved as the day you watched it
(`watchedAt`); change it on the title page. Imports bring their dates.

**Your country and streaming services**: pick them in Settings (saved with your profile, so they
follow you). The country decides "Where to watch" on title pages, "On my services", age ratings and
the cinema dates on labels (until you pick one: `RELEASE_COUNTRY` in `js/config.js`, Romania).
Availability comes from TMDB / JustWatch and is kept for a week in `mn:providers`; release dates /
next episodes are kept for a day in `mn:nextUp` (`js/services/watch.js`). When something in
Coming up is out today, the Watchlist link and tab get a red number.

**Continue watching** (shows): on a show's page, **I'm watching it** starts tracking; then
**Watched S2 E6** moves you on (also in the quick menu), or pick the season / episode. Shows in
progress get an "S2 · E5" badge and a **Continue watching** row at the top of your own rows on Home.
The last episode finishes the show (off the Watchlist, into the diary, "rate it?"); a new season
on TMDB picks it up again.

**Your notes**: a note on any title in your library (title page), saved as you type. Folded until you open it.

**More like this** (a library title's page): a switch between titles from **Your library** and from **Discover** (TMDB's recommendations you don't have yet). On phones and tablets the four buttons (Watchlist, Watched, Favorite, Rate) sit in one row, and the soundtrack's tracks are folded behind "Show all N tracks".

**Soundtrack** (title page, under Media): the title's soundtrack album from Apple Music (the free
iTunes Search API): the cover, the album, the artist, the tracks and a 30-second preview of each
(Apple's own; one ends, the next starts; a record slides out from behind the cover and spins
while it plays; a trailer stops it). Soundtrack and score albums both found: a switch. It's looked
up only when the section comes near the screen, and kept for the visit; a title without one on
Apple Music has no section (`js/components/soundtrack.js`).

**Movie trivia** (title page, for what you've watched; and offered right after you mark a title
Watched): 10 questions from TMDB (who directed it, who played whom, the year, the running time or
seasons, the box office and budget, the franchise, where it was made, the studio or network, the
composer, the tagline, the director's and the star's other films), four answers each, 20 seconds a
question (keys 1–4 / A–D). Then your score and a rank: 📼 Casual Viewer, 🎬 Film Fan, 🍿 Movie Buff
(7+), 🎓 Cinephile (9), 🏆 Film Genius (10), with Play again and Share. Your best per title is saved
with your profile; 7 or more counts for the **Movie Buff** achievement (`js/components/trivia.js`).

**Sync**: several tabs stay in step, and when two devices both changed things before syncing
(e.g. the phone offline), both sets of changes are kept (`js/core/cloud.js`). TMDB details are
cached in the browser's database (IndexedDB), a week each. Your whole library is one document
in your account, which holds at most 900,000 characters (`docs/firestore.rules`), so titles are
kept lean: no description (the title page gets it from TMDB; older titles lost it once, on
the first visit after the change). When the account refuses a save (too big, or the device's
clock far off) the profile menu says so in red ("Couldn't save to your account") and a message
explains why; the changes stay on the device and are tried again. No internet shows as
"Offline: will sync later".

**Two devices open at once**: before every save, the site checks the account's save time (a few
bytes). If another device saved since, its version is read and merged in first (each side's
changes kept), and the save only goes through if the account hasn't changed again meanwhile
(Firestore's `currentDocument.updateTime`; if it has, it looks again, three tries). The spare
copy of the library made before a merge (`mn:localBackup`) is dropped after a week.

**TMDB requests** (`js/services/tmdb.js`): the same request asked for several times at once goes
out once (they share it), and none waits forever: after 15 seconds a bad connection gets a
message instead of an endless spinner. Box Office's "Your box office" takes each film's budget
and gross from the film facts when they're there (Profile, Wrapped and the tier list load them
anyway) instead of asking TMDB again. Fonts load from each page's `<head>`, alongside the page.

**Watched**: one rule for every page, `Store.isWatched` (`js/core/store.js`): in your library unless it's only on your Watchlist; a score or a watch date always counts.

**Pop-ups** (`js/components/cards.js`): each is named by its own heading for screen readers, Tab and Shift+Tab stay inside the one on top, and closing one puts the focus back on what opened it (one over another too).

**Tests**: open `tools/tests.html` (e.g. `http://localhost:8080/tools/tests.html`): what counts as watched, merging two
devices' changes, the check before saving (with a pretend Firestore), sync errors, the spare copy,
and short share links. No installs; this browser's data is put back afterwards.

**Problems on this device** (Settings): the site's own recent errors (the last 20, kept only in
this browser by `js/core/store.js`; browser extensions' errors left out), plus a refused save or
an ended session from syncing. Copy the list to send it along, or Clear it.

**Search engines**: the private pages (your library, Watchlist, tier list, profile, settings,
short share links) carry `<meta name="robots" content="noindex">`; the home page has a
canonical address and a link preview (Open Graph). (A `robots.txt` here would be ignored: search
engines only read one at the root of `goldenmfox.github.io`.)

**Never published**: `.gitignore` keeps library backups (`*.json`), IMDb / Letterboxd exports
(`*.csv`) and `*.zip` files out of GitHub, so a backup left in this folder stays private.

In the **profile menu**:

- **Russian titles**: names, posters and trailers in Russian (dubbed trailers when TMDB has them in HD).
- **My rating** (menu, under Russian titles): the posters of your library show your own rating
  (on, at first) or their IMDb rating (off). While it's on, no IMDb lookups are made for posters.
  On narrow computer windows it's the EN | RU switch in the side menu.
- **Poster details** (computers): off = posters only, like on phones and tablets.
- **Match %** (computers): off = no match on the posters or in the hover preview (title
  pages keep it). Only with Poster details on: with posters only it's greyed out and the
  match always shows in the hover preview.

Trailers play in the best quality available; if YouTube blocks one on other sites, the next one plays.

## Phones and tablets

- **Phones** (browser and installed app): a floating tab bar at the bottom (it slides away while you scroll down and comes back when you scroll up, near the top or at the end of a page), and poster-only cards, 2 per row.
- **Tablets / iPad**: the pill navbar on top, a full-width slideshow and poster-only cards (4 per row
  upright). Add `?tablet=1` to any address to preview it on a computer (`?tablet=0` to stop).

## Adding and editing titles

Everyone has their own **private** library, saved in their account (see **Sign in and sync**
below). Nobody else sees it: not other people, not visitors, and not the owner either
(the owner's Members panel shows only how many titles people have).

Visitors who aren't signed in see everything from TMDB (Discover, Home rows, title pages,
trailers) but no library: the list pages show **Sign in to start your own list**.

`data/library.js` is only used when sign-in isn't set up (`FIREBASE` empty in `js/config.js`),
as a local list. Each line is one title:

```js
{"id":"interstellar-2014","title":"Interstellar","year":2014,"type":"movie","rating":10,"poster":"/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg","favorite":true},
```

- `type`: `"movie"`, `"tv"` or `"anime"`
- `rating`: your score from 0 to 10, or `null` if not rated yet
- `poster`: the TMDB image path (the end of a TMDB poster URL)
- optional: `isNew`, `favorite`, `watchlist`, `trailer` (YouTube video id), `genres`, `runtime`, `director`, `cast`, `backdrop`

The **NEW** label on cards (and the "New releases" filter) is automatic: it shows on titles
released in the last 6 months (exact dates looked up on TMDB; for movies the cinema date in
Romania, set by `RELEASE_COUNTRY` in `js/config.js`), so it disappears by itself as titles age.

On the site:

- **Watchlist, Watched, Rate** on any title (from Discover, search or a title page) adds it
  to your library. **Favorite** with the heart.
- **Add a title** by hand (profile menu): owner only.
- **Quick actions on any poster in your library**: right-click it (computers: the menu opens
  on the poster itself, the same size) or long-press it (phones / iPad: a sheet from the
  bottom) for Watchlist, Favorite, Rate, Trailer, Details and **Remove from library**.
  On computers the hover preview also has a trash button, and title pages have Remove too.
- Removing never asks "are you sure?": the message that follows has an **Undo** button (a few
  seconds) that puts the title back exactly as it was, with its score, lists and tier.

Changes are saved in the browser straight away and synced to your account.
**Settings → Backup**: download / restore a file copy, or delete your library.

## TMDB and IMDb ratings

Two free services, both keys in **`js/config.js`**:

```js
window.MN_CONFIG = {
  TMDB_KEY: "...", // themoviedb.org: Discover, posters, trailers, cast, TMDB score
  OMDB_KEY: "...", // omdbapi.com: IMDb rating + Rotten Tomatoes Tomatometer
};
```

**The rating next to yours** is the IMDb rating. Title pages also show the Rotten
Tomatoes Tomatometer (🍅, green splat under 60%) when the title has one.

The free OMDb key allows 1,000 lookups a day, so the site:

- uses at most **900 a day** and only for titles you actually see (one lookup per title),
- remembers every rating in your browser (refreshed about once a month),
- shows the **TMDB score** for anything not looked up yet, and switches it to IMDb
  on a later day, the next time that title appears,
- keeps TMDB scores on Discover cards (TMDB has no daily limit). Opening a title
  from Discover shows its IMDb rating.

Settings shows how many OMDb lookups were used today.

A TMDB key pasted in **Settings** is stored only in that browser and overrides
the one in `config.js`. Without keys the site still works, just without Discover and the
outside ratings.

> Anything in `config.js` is visible to people who open the site (for example on GitHub
> Pages). These keys can only read public movie data, so that's low risk.

## Sign in and sync (Firebase)

Profile menu → **Sign in** (Google). Your ratings, favorites, watchlist, added titles,
tiers and profile are saved to your account and follow you to every device.

- Every allowed person starts with an **empty** library and sees only their own.
- The **owner** is whoever the security rules allow to list all users (the site checks
  that on sign-in, so it can't be faked). The owner also gets **Add a title**, the TMDB /
  OMDb settings and **Settings → Members**: everyone who signed in, with their photo,
  last sync and how many titles / rated / watchlist they have (never their ratings).
- The owner's old library (it used to be public, from `data/library.js`) moved into the
  owner's account the first time they signed in after the change.
- Several people can stay signed in on one device: **Who's watching?** in the profile menu.
- Who may sign in is set by the Firestore security rules. A copy is in
  [`docs/firestore.rules`](docs/firestore.rules). To add someone, add their Gmail there
  in the Firebase console and click **Publish**.

Firebase project: `movie-nights-71380` (free Spark plan). The config is in `js/config.js`
and is meant to be public; the security rules protect the data.

## Project structure

```
Movie-Nights-NEW/
├── index.html, discover.html, movies.html, tv-shows.html, anime.html,
│   favorites.html, watchlist.html, title.html, person.html, tier-list.html, profile.html
│                              the pages (kept at the top so the links and the app work)
├── manifest.webmanifest       installed-app name, icons and colours
├── sw.js                      service worker: offline support + app updates
├── css/
│   └── style.css              all styles (dark + light theme)
├── data/
│   └── library.js             a local list (only used without sign-in)
├── js/
│   ├── config.js              TMDB, OMDb and Firebase keys / settings
│   ├── core/                  loaded on every page
│   │   ├── store.js           your library (kept in the browser, synced by cloud.js)
│   │   ├── cloud.js           Google sign-in, sync, profiles, owner + Members
│   │   ├── lang.js            EN / RU movie names, typo-tolerant name matching
│   │   └── layout.js          navbar, footer, search, profile menu, dark mode
│   ├── services/              talking to outside services
│   │   ├── tmdb.js            TMDB (details, trailers, cast, Discover)
│   │   ├── ratings.js         IMDb via OMDb (daily budget) with TMDB fallback
│   │   ├── watch.js           your streaming services, what's coming, reminders
│   │   ├── taste.js           match % from your own scores
│   │   └── facts.js           film facts (runtime, directors, cast, countries) for stats
│   ├── components/            pieces used by several pages
│   │   ├── cards.js           poster cards, rating pop-up, trailer pop-up
│   │   ├── add-title.js       "Add a title" form
│   │   ├── preview.js         hover a poster: Netflix-style trailer preview (computers)
│   │   ├── scrollbars.js      slim scrollbars with a hand cursor under the rows (computers)
│   │   ├── picker.js          "What should I watch?" pop-up
│   │   ├── import.js          import from IMDb / Letterboxd (Settings)
│   │   ├── wrapped.js         Movie Nights Wrapped (Profile)
│   │   ├── achievements.js    challenges & achievements (Profile)
│   │   ├── trivia.js          movie trivia (title page)
│   │   ├── soundtrack.js      soundtrack with previews (title page)
│   │   └── share.js           share a title: the link and the picture card
│   └── pages/                 one script per page
│       ├── home.js, discover.js, search.js (advanced search), browse.js (movies / TV / anime / favorites / watchlist)
│       └── title.js, person.js, tier-list.js, profile.js, settings.js
├── images/
│   ├── brand/                 logo, favicon
│   ├── icons/                 installed-app icons
│   └── placeholders/          user icon (signed out), missing poster / photo
├── docs/
│   └── firestore.rules        copy of the database security rules
├── tools/
│   ├── serve.ps1              tiny local web server (used by Start Movie Nights.bat)
│   └── publish.ps1            commit + push to GitHub (used by Publish to GitHub.bat)
├── Start Movie Nights.bat     double-click to open the site locally
└── Publish to GitHub.bat      double-click to publish your changes
```

Every page loads the scripts in this order: `data/library.js`, `js/config.js`, `js/core/*`
(store, cloud, lang, layout), `js/services/*`, `js/components/*`, then its own `js/pages/*.js`.

---

© 2023 to today, Movie Nights by Mirzac Nicolae
