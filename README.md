# Movie Nights

A personal list of the movies, TV shows and anime we've watched: rated, ranked, and saved for later.

Plain HTML, CSS and JavaScript. No build step, no frameworks, nothing to install.

## Open it

Double-click **`Start Movie Nights.bat`**. It opens the site in your browser at
`http://localhost:8080`. Keep the small black window open while you use the site, and close
it when you're done.

Why not just double-click `index.html`? That works too, but YouTube refuses to play
trailers inside a page opened straight from a file. Through the launcher, trailers play in
the pop-up.

It also works on GitHub Pages (trailers included): push the folder, then in the repo go to
**Settings â†’ Pages â†’ Deploy from branch**.

## Publishing

The site lives at **https://goldenmfox.github.io/Movie-Nights/** (GitHub Pages, from
`github.com/GoldenMFox/Movie-Nights`, branch `main`).

To publish changes, double-click **`Publish to GitHub.bat`**. It saves every change in this
folder and uploads it, and the live site updates a minute or two later. Libraries aren't
part of the site's files (they live in each person's account), so publishing never touches them.

## Install it as an app

Open **https://goldenmfox.github.io/Movie-Nights/** on your phone, then:

- **Android** (Chrome, Brave, Edge): profile menu (your picture, top right) â†’ **Install the app**,
  or the browser menu â†’ **Install app** / **Add to Home screen**.
- **iPhone / iPad** (Safari): the **Share** button â†’ **Add to Home Screen**.

It opens full screen with its own icon, has a back button in the top left, and your own
list still opens without internet (Discover, trending and trailers need a connection).
It updates by itself whenever the site is published.

## Pages

| Page | What it does |
| --- | --- |
| `discover.html` | Browse and search **all** movies, TV shows and anime on TMDB (trending, popular, in cinemas, coming soon, top rated, anime), or browse by genre. Search forgives typos ("forest gump" finds Forrest Gump) and hides shorts / posterless uploads. Unreleased titles get a "Coming soon Â· date" label (the cinema date in Romania). Add anything to your library or watchlist |
| `index.html` | Home, live from TMDB: this week's trending titles in the slideshow, **Top 10 today** (movies / TV shows switch), then rows for in cinemas, coming soon, popular and top rated movies / TV / anime. At the bottom, "Your Movie Nights": your stats, watchlist, favorites and a "What should I watch?" button. (Without a TMDB key it shows your own list instead.) |
| `movies.html`, `tv-shows.html`, `anime.html` | Full lists with search, genre, sort, rating and year filters |
| `watchlist.html` | **Coming up** (release dates of movies you're waiting for, new seasons / episodes of your shows), then two rows, **Plan to watch** and **Favorites**; "See all" opens the full list below them, with a switch between the two, search, filters and **On my services**. (`favorites.html` just forwards here.) |
| `title.html?id=...` | Details for one title: your score, **Watched on** (change the date), trailer, where to watch, overview, **Seasons** (TV: each season's trailer), cast, media, reviews, "more like this" |
| `person.html?id=...` | An actor / crew member (tap a cast card or the director's name): photo, bio, facts, best known for, full filmography with a role filter |
| `tier-list.html` | Drag posters into S / A / B / C / D tiers |
| `profile.html` | Your stats, **Watch diary** (watched this year / month, a chart of the last 12 months, "a year ago you watchedâ€¦"), settings (theme, **your streaming services**), **Import** from IMDb / Letterboxd, backup. The owner also sees the TMDB / OMDb settings and **Members** |

The navbar search (or `/` on any page) searches your library and all of TMDB.

**What should I watch?** (Home and Watchlist): pick the mood (movie / series / anime, under
1h45 / 2h30 / one episode, a genre, only your streaming services) and it picks one title from
your Watchlist, or from your Favorites for a rewatch.

**Borrowed from Netflix, HBO Max, Plex and Prime Video:**

- **Because you liked â€¦** (Home): two rows of TMDB recommendations for two of your best-rated
  titles (8+ or favorites), different ones each visit, without what you already have.
- **Match %** ("92% match", `js/services/taste.js`): how much you'll probably like a title
  you haven't rated, from how you rate its genres against your own average, nudged by its
  TMDB score. Shows after 5 rated titles, in the hover preview, on title pages, in the quick
  menu and under posters (Poster details on).
- **Remind me** (titles not out yet: bell on the card, title page, quick menu): puts it in
  **Coming up** on the Watchlist page without adding it to anything. Saved with your profile;
  drops off a month after release.
- **Franchises** (title pages): "Harry Potter Collection Â· You've seen 2 of 8", every film in it.
- **Your own lists** ("Halloween marathon", "Date night"): **New list** on the Watchlist page,
  add titles from the quick menu or a title page's â‹¯ menu (Add to a list). Each list gets a
  row and a place in the full-list switch (with Rename / Delete). Saved with your profile.
- **X-Ray** (title pages): tagline, release, budget and box office, awards (OMDb), studios,
  countries, language, keywords, and **where you've seen the cast** in your own library.
- **Movie Nights Wrapped** (Profile â†’ Watch diary): your year as a story: how many you watched,
  where it started, top genres, busiest month, your best-rated, the actor and director you saw
  most, your average score, and a summary you can share.

**New library?** Home and Watchlist show a welcome card with the three ways to start
(Discover, search, import).

**Import** (Profile): the `.csv` exports of IMDb (Your ratings, Your watchlist; matched on TMDB
by IMDb id) and Letterboxd (ratings / watched / diary / watchlist.csv; matched by name + year,
stars Ã— 2 = score). You see what was found before anything is added, and titles you already
have keep your own score.

**Watch diary**: the day you rate a title or press Watched is saved as the day you watched it
(`watchedAt`); change it on the title page. Imports bring their dates.

**Streaming services**: pick yours in Profile â†’ Settings (saved with your profile, so they
follow you). Availability comes from TMDB / JustWatch for `RELEASE_COUNTRY` (Romania) and is
kept for a week in `mn:providers`; release dates / next episodes are kept for a day in `mn:nextUp`
(`js/services/watch.js`).

In the **profile menu**:

- **Russian titles**: names, posters and trailers in Russian (dubbed trailers when TMDB has them in HD).
  On narrow computer windows it's the EN | RU switch in the side menu.
- **Poster details** (computers): off = posters only, like on phones and tablets.

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
**Profile â†’ Backup**: download / restore a file copy, or delete your library.

## TMDB and IMDb ratings

Two free services, both keys in **`js/config.js`**:

```js
window.MN_CONFIG = {
  TMDB_KEY: "...", // themoviedb.org: Discover, posters, trailers, cast, TMDB score
  OMDB_KEY: "...", // omdbapi.com: IMDb rating + Rotten Tomatoes Tomatometer
};
```

**The rating next to yours** is the IMDb rating. Title pages also show the Rotten
Tomatoes Tomatometer (ðŸ…, green splat under 60%) when the title has one.

The free OMDb key allows 1,000 lookups a day, so the site:

- uses at most **900 a day** and only for titles you actually see (one lookup per title),
- remembers every rating in your browser (refreshed about once a month),
- shows the **TMDB score** for anything not looked up yet, and switches it to IMDb
  on a later day, the next time that title appears,
- keeps TMDB scores on Discover cards (TMDB has no daily limit). Opening a title
  from Discover shows its IMDb rating.

Profile â†’ Settings shows how many OMDb lookups were used today.

A TMDB key pasted in **Profile â†’ Settings** is stored only in that browser and overrides
the one in `config.js`. Without keys the site still works, just without Discover and the
outside ratings.

> Anything in `config.js` is visible to people who open the site (for example on GitHub
> Pages). These keys can only read public movie data, so that's low risk.

## Sign in and sync (Firebase)

Profile menu â†’ **Sign in** (Google). Your ratings, favorites, watchlist, added titles,
tiers and profile are saved to your account and follow you to every device.

- Every allowed person starts with an **empty** library and sees only their own.
- The **owner** is whoever the security rules allow to list all users (the site checks
  that on sign-in, so it can't be faked). The owner also gets **Add a title**, the TMDB /
  OMDb settings and **Profile â†’ Members**: everyone who signed in, with their photo,
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
â”œâ”€â”€ index.html, discover.html, movies.html, tv-shows.html, anime.html,
â”‚   favorites.html, watchlist.html, title.html, person.html, tier-list.html, profile.html
â”‚                              the pages (kept at the top so the links and the app work)
â”œâ”€â”€ manifest.webmanifest       installed-app name, icons and colours
â”œâ”€â”€ sw.js                      service worker: offline support + app updates
â”œâ”€â”€ css/
â”‚   â””â”€â”€ style.css              all styles (dark + light theme)
â”œâ”€â”€ data/
â”‚   â””â”€â”€ library.js             a local list (only used without sign-in)
â”œâ”€â”€ js/
â”‚   â”œâ”€â”€ config.js              TMDB, OMDb and Firebase keys / settings
â”‚   â”œâ”€â”€ core/                  loaded on every page
â”‚   â”‚   â”œâ”€â”€ store.js           your library (kept in the browser, synced by cloud.js)
â”‚   â”‚   â”œâ”€â”€ cloud.js           Google sign-in, sync, profiles, owner + Members
â”‚   â”‚   â”œâ”€â”€ lang.js            EN / RU movie names, typo-tolerant name matching
â”‚   â”‚   â””â”€â”€ layout.js          navbar, footer, search, profile menu, dark mode
â”‚   â”œâ”€â”€ services/              talking to outside services
â”‚   â”‚   â”œâ”€â”€ tmdb.js            TMDB (details, trailers, cast, Discover)
â”‚   â”‚   â”œâ”€â”€ ratings.js         IMDb via OMDb (daily budget) with TMDB fallback
â”‚   â”‚   â”œâ”€â”€ watch.js           your streaming services, what's coming, reminders
â”‚   â”‚   â””â”€â”€ taste.js           match % from your own scores
â”‚   â”œâ”€â”€ components/            pieces used by several pages
â”‚   â”‚   â”œâ”€â”€ cards.js           poster cards, rating pop-up, trailer pop-up
â”‚   â”‚   â”œâ”€â”€ add-title.js       "Add a title" form
â”‚   â”‚   â”œâ”€â”€ preview.js         hover a poster: Netflix-style trailer preview (computers)
â”‚   â”‚   â”œâ”€â”€ scrollbars.js      slim scrollbars with a hand cursor under the rows (computers)
â”‚   â”‚   â”œâ”€â”€ picker.js          "What should I watch?" pop-up
â”‚   â”‚   â”œâ”€â”€ import.js          import from IMDb / Letterboxd (Profile)
â”‚   â”‚   â””â”€â”€ wrapped.js         Movie Nights Wrapped (Profile)
â”‚   â””â”€â”€ pages/                 one script per page
â”‚       â”œâ”€â”€ home.js, discover.js, browse.js (movies / TV / anime / favorites / watchlist)
â”‚       â””â”€â”€ title.js, person.js, tier-list.js, profile.js
â”œâ”€â”€ images/
â”‚   â”œâ”€â”€ brand/                 logo, favicon
â”‚   â”œâ”€â”€ icons/                 installed-app icons
â”‚   â””â”€â”€ placeholders/          user icon (signed out), missing poster / photo
â”œâ”€â”€ docs/
â”‚   â””â”€â”€ firestore.rules        copy of the database security rules
â”œâ”€â”€ tools/
â”‚   â”œâ”€â”€ serve.ps1              tiny local web server (used by Start Movie Nights.bat)
â”‚   â””â”€â”€ publish.ps1            commit + push to GitHub (used by Publish to GitHub.bat)
â”œâ”€â”€ Start Movie Nights.bat     double-click to open the site locally
â””â”€â”€ Publish to GitHub.bat      double-click to publish your changes
```

Every page loads the scripts in this order: `data/library.js`, `js/config.js`, `js/core/*`
(store, cloud, lang, layout), `js/services/*`, `js/components/*`, then its own `js/pages/*.js`.

---

Â© 2023 to today, Movie Nights by Mirzac Nicolae
