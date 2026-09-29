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
**Settings → Pages → Deploy from branch**.

## Publishing

The site lives at **https://goldenmfox.github.io/Movie-Nights/** (GitHub Pages, from
`github.com/GoldenMFox/Movie-Nights`, branch `main`).

To publish changes, double-click **`Publish to GitHub.bat`**. It saves every change in this
folder and uploads it, and the live site updates a minute or two later. For example, after
replacing `data/library.js` with an export from Profile → Backup.

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
| `discover.html` | Browse and search **all** movies, TV shows and anime on TMDB (search everything, or only movies / TV shows / anime) (trending, popular, in cinemas, coming soon, top rated, anime), or browse by genre (e.g. Horror movies, top rated). Add anything to your library or watchlist |
| `index.html` | Home, live from TMDB: this week's trending titles in the slideshow, then rows for in cinemas, coming soon, popular and top rated movies / TV / anime. At the bottom, "Your Movie Nights": your stats, watchlist, favorites and a "What should I watch?" button. (Without a TMDB key it shows your own list instead.) |
| `movies.html`, `tv-shows.html`, `anime.html` | Full lists with search, genre, sort, rating and year filters |
| `favorites.html`, `watchlist.html` | Everything you've hearted or bookmarked |
| `title.html?id=...` | Details for one title: your score, trailer, overview, cast, "more like this" |
| `person.html?id=...` | An actor / crew member (tap a cast card): photo, bio, facts, best known for, full filmography |
| `tier-list.html` | Drag posters into S / A / B / C / D tiers |
| `profile.html` | Your stats, settings (theme, TMDB key) and backup / export |

Press `/` on any page to search the whole library.

**EN | RU** (in the profile menu, or in the side menu on phones) switches movie, show and anime names between English and Russian. Search finds titles by either name.

## Adding and editing titles

All titles live in **`data/library.js`**, one line per title:

```js
{"id":"interstellar-2014","title":"Interstellar","year":2014,"type":"movie","rating":10,"poster":"/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg","favorite":true},
```

- `type`: `"movie"`, `"tv"` or `"anime"`
- `rating`: your score from 0 to 10, or `null` if not rated yet
- `poster`: the TMDB image path (the end of a TMDB poster URL)
- optional: `isNew`, `favorite`, `watchlist`, `trailer` (YouTube video id), `overview`, `genres`, `runtime`, `director`, `cast`, `backdrop`

The red **NEW** label on cards (and the "New releases" filter) is automatic: it shows on titles
from this year (and last year's until the end of March), so it disappears by itself as titles age.

You can also do it from the site:

- **Rate, favorite, watchlist** with the buttons on each card.
- **Add a title** from the profile menu (top right).
- **Remove a title** from its title page.

Those changes are saved in your browser straight away and, when you're signed in, synced
to your account (see **Sign in and sync** below). To bake them into the site's own list,
go to **Profile → Backup → Export library.js** and replace `data/library.js` with the
downloaded file. **Download backup / Restore backup** makes a file copy of everything.

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

Profile → Settings shows how many OMDb lookups were used today.

A TMDB key pasted in **Profile → Settings** is stored only in that browser and overrides
the one in `config.js`. Without keys the site still works, just without Discover and the
outside ratings.

> Anything in `config.js` is visible to people who open the site (for example on GitHub
> Pages). These keys can only read public movie data, so that's low risk.

## Sign in and sync (Firebase)

Profile menu → **Sign in to sync** (Google). Your ratings, favorites, watchlist, added
titles, tiers and profile are then saved to your account and follow you to every device.

- The first account that ever signed in is the **owner**: it keeps `data/library.js` as
  its library, and a copy of it (`public/owner`) is what visitors who aren't signed in see.
- Every other allowed person (wife, friends) gets their own **empty** library.
- The owner sees everyone's ratings on title pages and gets "Watch with …" filters on the
  Watchlist. Everyone else sees only the owner's.
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
│   └── library.js             the list of titles
├── js/
│   ├── config.js              TMDB, OMDb and Firebase keys / settings
│   ├── core/                  loaded on every page
│   │   ├── store.js           the library + your changes (saved in the browser)
│   │   ├── cloud.js           Google sign-in, sync, profiles, friends' ratings
│   │   ├── lang.js            EN / RU movie names
│   │   └── layout.js          navbar, footer, search, profile menu, dark mode
│   ├── services/              talking to outside services
│   │   ├── tmdb.js            TMDB (details, trailers, cast, Discover)
│   │   └── ratings.js         IMDb via OMDb (daily budget) with TMDB fallback
│   ├── components/            pieces used by several pages
│   │   ├── cards.js           poster cards, rating pop-up, trailer pop-up
│   │   ├── add-title.js       "Add a title" form
│   │   ├── preview.js         hover a poster: Netflix-style trailer preview (computers)
│   │   └── scrollbars.js      slim scrollbars with a hand cursor under the rows (computers)
│   └── pages/                 one script per page
│       ├── home.js, discover.js, browse.js (movies / TV / anime / favorites / watchlist)
│       └── title.js, person.js, tier-list.js, profile.js
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

© 2023 to today, Movie Nights by Mirzac Nicolae & Alexandru Donoaga
