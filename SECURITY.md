# Security policy

Movie Nights is a small personal website (static HTML, CSS and JavaScript on GitHub Pages).

## Reporting a problem

If you find a security problem, please **don't open a public issue**. Use GitHub's
**Security → Report a vulnerability** button on this repository (private reporting), and
include what you found and how to reproduce it. You'll get an answer as soon as possible.

## What's public on purpose

The keys in `js/config.js` are browser keys and are visible to anyone who opens the site:

- **Firebase** (`apiKey`, project id…): only identifies the project. Access to the data is
  controlled by the Firestore security rules (`docs/firestore.rules`): only the listed Google
  accounts can sign in and read or save anything. The key is also restricted in Google Cloud
  to this site's address and to the Firebase APIs it needs.
- **Google OAuth client id**: public by design (used for signing in on iPhone / iPad).
- **TMDB / OMDb keys**: read-only access to public movie data.

No passwords, private keys or personal data are stored in this repository.
