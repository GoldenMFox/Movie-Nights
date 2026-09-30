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
| `index.html` | Home, live from TMDB: this week's trending titles in the slideshow, **Top 10 today** (movies / TV shows switch), then rows for in cinemas, coming soon, popular and top rated movies / TV / anime. At the bottom, "Your Movie Nights": your stats, watchlist, favorites and a "What should I watch?" button. (Without a TMDB key it shows your own list instead.) |
| `movies.html`, `tv-shows.html`, `anime.html` | Full lists with search, genre, sort, rating and year filters, and chips (All, **Watched**, Rated, Not rated, Favorites, Watchlist, New releases) |
| `watchlist.html` | **Coming up** (release dates of movies you're waiting for, new seasons / episodes of your shows), then two rows, **Plan to watch** and **Favorites**; "See all" opens the full list below them, with a switch between the two, search, filters and **On my services**. (`favorites.html` just forwards here.) |
| `title.html?id=...` | Details for one title (in your library = watched: no Watchlist button; still on the Watchlist: **On Watchlist** + **Watched**): your score, **Watched on** (change the date), trailer, where to watch, overview, **Your progress** (shows: the episode you're at), **Your notes**, **Seasons** (TV: each season's trailer), cast, media, reviews, "more like this" (your titles sharing the most genres) |
| `person.html?id=...` | An actor / crew member (tap a cast card or the director's name): photo, bio, facts, best known for, full filmography with a role filter |
| `tier-list.html` | Rank what you've watched from S to D: drag posters from the **unranked tray** at the bottom of the screen (phones: tap a poster, then a tier), **Quick rank** (one poster at a time, keys S A B C D, Skip, Undo) and **Fill from my ratings** (10 → S, 9 → A, 8 → B, 7 → C, below → D, with Undo). Only watched titles: not the ones only on your Watchlist |
| `box-office.html` | **Box Office** (profile menu, and the Budget & box office card on a movie page): the highest-grossing films worldwide (TMDB's revenue and budget, US dollars, not adjusted for inflation): All time / this year / last year or any year, any genre (in the address: `?year=2025&genre=Horror`). A podium of the top 3 (the backdrop turns between them; point at or tap one), four numbers that count up (the top 20 together, typical return, best return, most expensive), **What they cost vs what they made**: a poster skyline of the top 20 by gross (a column's height is what the film made, the striped band at its foot what it cost, its multiple on top; the columns rise as they come into view), with a readout of the film you point at or tap (cost → made, profit, the multiple in the verdict's colour). **Compare**: This chart / Franchises (19 big ones + search, in release order) / Directors (14 + search, their directing credits in release order, no concert films or documentaries) / Studios (17, their biggest) / Year by year (each of the last 20 years' #1) / Your films (the 20 biggest you've watched), then the chart: sort by gross, budget, return or profit (the rows glide to their places); **List** (a bar per film in its verdict's colour with the budget striped inside it, cost and profit under it, the backdrop sliding in behind the row you point at, gold / silver / bronze edges for the top 3; tap a row for profit, what every $1 made and the trailer) or **Posters** (a wall with rank medals, gross and multiple); quick buttons on each (Trailer, Watchlist, Watched); All / Watched / Not seen yet (signed in); "Watched ★ 8" on yours, 20 at a time. The view is remembered (`mn:boView`). **Your box office**: what the films you've watched made together, the biggest one, the biggest flop, your 8+ money maker and hidden gem. **Adjusted for inflation** (a switch at the top, beside the years; `?real=1`): the whole page (chart, podium, cards, the skyline's comparisons, Your box office) with every amount in this year's dollars (US CPI-U yearly averages in the page, the current year estimated until published; a film at its release year's prices); for all time the classics are fetched too (the biggest from before 1990 and 1990-2004), all ranked in today's money (Gone with the Wind first); the details show "At the time". Budgets / grosses cached in one record (`bo:films`) |
| `profile.html` | Your name, **your picture** (tap it: a character. Tabs: Movie & TV cast (TMDB photos, famous titles or any title's cast), Superheroes (the Marvel and DC movie wikis), Harry Potter, Star Wars, Game of Thrones, Disney (the best-known characters of each, from free fan-made character databases); saved with your profile), stats, **Watch diary** (watched this year / month, a chart of the last 12 months, "a year ago you watched…", **Wrapped**) and charts |
| `settings.html` | Theme, **your country** and **your streaming services**, **Import** from IMDb / Letterboxd, backup. The owner also sees **Members** and the TMDB / OMDb settings (marked Admin only) |

The navbar search (or `/` on any page) searches your library and all of TMDB.

**What should I watch?** (Home and Watchlist): pick the mood (movie / series / anime, under
1h45 / 2h30 / one episode, a genre, only your streaming services) and it picks one title from
your Watchlist, or from your Favorites for a rewatch.

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
  X-Ray's "where you've seen the cast" counts the same way.
- **Your own lists** ("Halloween marathon", "Date night"): **New list** on the Watchlist page,
  then **+ Add titles** (on the list's row, or in the full list): search your library and all
  of TMDB and tap Add. Also from the quick menu or a title page's ⋯ menu (Add to a list).
  A title that isn't in your library yet goes in on your Watchlist (not watched yet). Each list gets a
  row and a place in the full-list switch (with Rename / Delete). Saved with your profile.
- **X-Ray** (title pages): the tagline as a banner; budget vs box office as two bars with a
  verdict (Blockbuster 5×+, Hit 2×+, Broke even, Flop); the release date with "2 months ago" /
  "in 5 days" (series: episodes, last aired); awards in gold (OMDb); studio / network logos;
  flags of the countries and the original language; and **where you've seen the cast**: a card
  per person (who they play here, and small posters of your titles they're in).
- **Movie Nights Wrapped** (Profile → Watch diary): your year as a story: how many you watched,
  where it started, top genres, busiest month, your best-rated, the actor and director you saw
  most, your average score, and a summary you can share. Plays by itself like Instagram stories
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
progress get an "S2 · E5" badge and a **Continue watching** row at the top of "Your Movie Nights".
The last episode finishes the show (off the Watchlist, into the diary, "rate it?"); a new season
on TMDB picks it up again.

**Your notes**: a note on any title in your library (title page), saved as you type.

**Sync**: several tabs stay in step, and when two devices both changed things before syncing
(e.g. the phone offline), both sets of changes are kept (`js/core/cloud.js`). TMDB details are
cached in the browser's database (IndexedDB), a week each.

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

- **Phones** (browser and installed app): a floating tab bar at the bottom, and poster-only cards, 2 per row.
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
- optional: `isNew`, `favorite`, `watchlist`, `trailer` (YouTube video id), `overview`, `genres`, `runtime`, `director`, `cast`, `backdrop`

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
│   │   └── taste.js           match % from your own scores
│   ├── components/            pieces used by several pages
│   │   ├── cards.js           poster cards, rating pop-up, trailer pop-up
│   │   ├── add-title.js       "Add a title" form
│   │   ├── preview.js         hover a poster: Netflix-style trailer preview (computers)
│   │   ├── scrollbars.js      slim scrollbars with a hand cursor under the rows (computers)
│   │   ├── picker.js          "What should I watch?" pop-up
│   │   ├── import.js          import from IMDb / Letterboxd (Settings)
│   │   └── wrapped.js         Movie Nights Wrapped (Profile)
│   └── pages/                 one script per page
│       ├── home.js, discover.js, browse.js (movies / TV / anime / favorites / watchlist)
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
