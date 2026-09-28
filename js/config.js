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
 * FIREBASE  Sign in with Google + sync your library across devices (js/core/cloud.js).
 *           Copied from Firebase console -> Project settings -> Your apps. This
 *           config is meant to be public: the Firestore security rules decide
 *           which Google accounts may read or save anything.
 *
 * Note: anything in this file is visible to people who visit the site. These
 * keys can only read public movie data, so that's low risk. To keep the TMDB
 * key private instead, leave it empty and paste it in Profile -> Settings
 * (stored only in your own browser).
 */
window.MN_CONFIG = {
  TMDB_KEY: "55967e6ca51817fb5b8ef691f00fb5ab",
  OMDB_KEY: "f643335e",
  FIREBASE: {
    apiKey: "AIzaSyDRPO10EK-mDP1Epbv9WAvZhcamUBdvFbk",
    authDomain: "movie-nights-71380.firebaseapp.com",
    projectId: "movie-nights-71380",
    storageBucket: "movie-nights-71380.firebasestorage.app",
    messagingSenderId: "206066875468",
    appId: "1:206066875468:web:5252d0414c71d9f2b188e9",
  },
};
