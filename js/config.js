/*
 * Site settings.
 *
 * TMDB_KEY  Free TMDB key (themoviedb.org -> Settings -> API). Powers Discover,
 *           posters, trailers, cast and the TMDB score. Either the "API Key"
 *           (32 letters/numbers) or the long "API Read Access Token" works.
 *
 * OMDB_KEY  Free OMDb key (omdbapi.com). Adds IMDb ratings and the Rotten
 *           Tomatoes Tomatometer. Free keys allow 1,000 lookups a day: the site
 *           uses at most 900, remembers every answer, and shows the TMDB score
 *           until the rest are looked up on a later day.
 *
 * Note: anything in this file is visible to people who visit the site. These
 * keys can only read public movie data, so that's low risk. To keep the TMDB
 * key private instead, leave it empty and paste it in Profile -> Settings
 * (stored only in your own browser).
 */
window.MN_CONFIG = {
  TMDB_KEY: "55967e6ca51817fb5b8ef691f00fb5ab",
  OMDB_KEY: "f643335e",
};
