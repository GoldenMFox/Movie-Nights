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
 * key private instead, leave it empty and paste it in the Admin Control Center
 * (API integrations: stored only in that browser).
 */
window.MN_CONFIG = {
  TMDB_KEY: "55967e6ca51817fb5b8ef691f00fb5ab",
  // Google Books (books on title / person pages): a key restricted to this site's address. It can
  // also be pasted in the Admin Control Center (API integrations), which wins over this one.
  GOOGLE_BOOKS_KEY: "",
  OMDB_KEY: "f643335e",
  FIREBASE: {
    apiKey: "AIzaSyDRPO10EK-mDP1Epbv9WAvZhcamUBdvFbk",
    authDomain: "movie-nights-71380.firebaseapp.com",
    projectId: "movie-nights-71380",
    storageBucket: "movie-nights-71380.firebasestorage.app",
    messagingSenderId: "206066875468",
    appId: "1:206066875468:web:5252d0414c71d9f2b188e9",
  },
  // The default country (TMDB country code) until someone picks theirs in Settings →
  // Streaming: where to watch, age ratings, and the cinema dates on labels (Discover's
  // "Coming soon", the NEW label; movies only, TV shows air worldwide). The lists
  // themselves (In cinemas, Coming soon…) stay worldwide.
  RELEASE_COUNTRY: "RO",
  // iPhone / iPad sign-in without a pop-up (js/core/cloud.js). The "Web client" ID from
  // Google Cloud console -> APIs & Services -> Credentials (Firebase created it). That
  // client needs this site's index.html as an "Authorized redirect URI". Empty = use the pop-up.
  GOOGLE_CLIENT_ID: "206066875468-4h7ejupakg0jocqtg47pmdipodbet1s7.apps.googleusercontent.com",
};
