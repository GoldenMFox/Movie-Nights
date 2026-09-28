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

## Pages

| Page | What it does |
| --- | --- |
| `discover.html` | Browse and search **all** movies, TV shows and anime on TMDB (search everything, or only movies / TV shows / anime) (trending, popular, in cinemas, coming soon, top rated, anime), or browse by genre (e.g. Horror movies, top rated). Add anything to your library or watchlist |
| `index.html` | Home, live from TMDB: this week's trending titles in the slideshow, then rows for in cinemas, coming soon, popular and top rated movies / TV / anime. At the bottom, "Your Movie Nights": your stats, watchlist, favorites and a "What should I watch?" button. (Without a TMDB key it shows your own list instead.) |
| `movies.html`, `tv-shows.html`, `anime.html` | Full lists with search, genre, sort, rating and year filters |
| `favorites.html`, `watchlist.html` | Everything you've hearted or bookmarked |
| `title.html?id=...` | Details for one title: your score, trailer, overview, cast, "more like this" |
| `tier-list.html` | Drag posters into S / A / B / C / D tiers |
| `profile.html` | Your stats, settings (theme, TMDB key) and backup / export |

Press `/` on any page to search the whole library.

## Adding and editing titles

All titles live in **`data/library.js`**, one line per title:

```js
{"id":"interstellar-2014","title":"Interstellar","year":2014,"type":"movie","rating":10,"poster":"/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg","favorite":true},
```

- `type`: `"movie"`, `"tv"` or `"anime"`
- `rating`: your score from 0 to 10, or `null` if not rated yet
- `poster`: the TMDB image path (the end of a TMDB poster URL)
- optional: `isNew`, `favorite`, `watchlist`, `trailer` (YouTube video id), `overview`, `genres`, `runtime`, `director`, `cast`, `backdrop`

You can also do it from the site:

- **Rate, favorite, watchlist** with the buttons on each card.
- **Add a title** from the profile menu (top right).
- **Remove a title** from its title page.

Those changes are saved **in your browser** (localStorage). To make them permanent,
go to **Profile → Backup → Export library.js** and replace `data/library.js` with the
downloaded file. Use **Download backup / Restore backup** to move your changes to
another browser.

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
## Project structure

```
index.html  discover.html  movies.html  tv-shows.html  anime.html
favorites.html  watchlist.html  title.html  tier-list.html  profile.html
css/style.css        all styles (dark + light theme)
data/library.js      the list of titles
js/config.js         TMDB + OMDb keys
js/store.js          loads the library + saves your changes
js/layout.js         navbar, footer, search, dark mode
js/cards.js          movie cards, rating pop-up, trailer pop-up
js/add-title.js      "Add a title" form
js/tmdb.js           TMDB integration
js/ratings.js        IMDb / TMDB ratings, OMDb daily budget
js/discover.js       Discover page
js/browse.js         list pages (filters, sorting)
js/home.js  js/title.js  js/tier-list.js  js/profile.js
images/              logo, favicon, avatar, placeholders
tools/serve.ps1      tiny local web server used by Start Movie Nights.bat
Start Movie Nights.bat   double-click to open the site
```

---

© 2023 to today, Movie Nights by Mirzac Nicolae & Alexandru Donoaga
