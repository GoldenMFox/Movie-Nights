/*
 * Movie Nights: a local list of titles, only used when sign-in isn't set up
 * (MN_CONFIG.FIREBASE empty in js/config.js).
 *
 * With sign-in, everyone's library is private and lives in their own account,
 * so this stays empty on the published site.
 *
 * One title per line, for example:
 *   {"id":"interstellar-2014","title":"Interstellar","year":2014,"type":"movie","rating":10,"poster":"/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"},
 *
 *   id        unique, lowercase-title-year
 *   type      "movie" | "tv" | "anime"
 *   rating    your score 0-10, or null if not rated yet
 *   poster    TMDB image path (the part after /t/p/original)
 *   optional: titleRu, genres, tmdbId, tmdbMedia, isNew, favorite, watchlist, backdrop,
 *             trailer, runtime, certification, director, overview, cast
 */
window.LIBRARY = [];
