/*
 * Cloud sync: sign in with Google and your library (ratings, favorites,
 * watchlist, tiers, profile) follows you to every device.
 *
 *  - Sign-in: Firebase Auth (its script is only loaded for signed-in people).
 *  - Storage: Firestore, one document per person in "users/{uid}", read and
 *    written through Firestore's REST API. Who may use it is decided by the
 *    security rules in the Firebase console (only the listed Google accounts).
 *  - The first account ever to sign in keeps data/library.js as its library
 *    and is mirrored to "public/owner", which is what visitors who aren't
 *    signed in see. Every later account starts with an empty library.
 *  - Several accounts can stay signed in on one device ("Who's watching?").
 *  - Friends' ratings / watchlists are shown on title pages, and the
 *    Watchlist gets "Watch with …" filters. The owner sees everyone; everyone
 *    else sees only the owner (read from public/owner), never each other
 *    (enforced by the Firestore rules).
 *
 * This browser's localStorage stays the working copy: pages read it straight
 * away, and changes are uploaded a moment later. Nothing here runs unless
 * MN_CONFIG.FIREBASE is filled in (js/config.js).
 */
(function () {
  const cfg = (window.MN_CONFIG || {}).FIREBASE;
  const enabled = !!(cfg && cfg.apiKey && cfg.projectId);
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  const DB = enabled ? `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents` : "";
  const K = {
    accounts: "mn:accounts", // everyone signed in on this device
    account: "mn:account", // who's watching right now
    syncAt: "mn:syncAt", // time of the account version this browser has
    dirty: "mn:dirty", // changes not uploaded yet
    pub: "mn:public", // the owner's library, for visitors
    friends: "mn:friends", // the other people's ratings / watchlists you can see
    backup: "mn:localBackup", // what this browser had before signing in
  };
  const FRIENDS_MAX_AGE = 60 * 1000;
  try {
    localStorage.removeItem("mn:partner"); // older single-partner version
  } catch (e) {}

  const read = Store.read;
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const drop = (...keys) =>
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    });
  const first = (name) => String(name || "").trim().split(/\s+/)[0] || "Someone";
  const toast = (msg) => window.UI && UI.toast(msg);

  const account = Store.account; // fixed for this page; switching reloads
  const accounts = () => read(K.accounts, []);

  /* ---------------- status (shown in the profile menu) ---------------- */

  let status = account ? "syncing" : "off";
  const statusListeners = [];
  function setStatus(s) {
    status = s;
    statusListeners.forEach((fn) => fn(s));
  }

  /* ---------------- Firebase sign-in ---------------- */

  let sdkPromise;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load Google sign-in. Check your connection."));
      document.head.append(s);
    });
  }
  function sdk() {
    if (!sdkPromise) {
      sdkPromise = loadScript(SDK + "firebase-app-compat.js")
        .then(() => loadScript(SDK + "firebase-auth-compat.js"))
        .then(() => window.firebase)
        .catch((e) => {
          sdkPromise = null;
          throw e;
        });
    }
    return sdkPromise;
  }

  // one Firebase "app" per account, so several can stay signed in at once
  async function appFor(name) {
    const fb = await sdk();
    return fb.apps.find((a) => a.name === name) || fb.initializeApp(cfg, name);
  }

  async function userOf(acct) {
    const auth = (await appFor(acct.app)).auth();
    return new Promise((resolve) => {
      const off = auth.onAuthStateChanged((u) => {
        off();
        resolve(u);
      });
    });
  }

  async function token(acct) {
    const user = await userOf(acct);
    if (!user) throw Object.assign(new Error("Signed out"), { signedOut: true });
    return user.getIdToken();
  }

  /* ---------------- Firestore (REST) ---------------- */

  async function api(path, { method = "GET", tok, body } = {}) {
    const headers = {};
    if (tok) headers.Authorization = `Bearer ${tok}`;
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(`${DB}/${path}${tok ? "" : `?key=${encodeURIComponent(cfg.apiKey)}`}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = (await res.json()).error.message;
      } catch (e) {}
      throw Object.assign(new Error(msg), { status: res.status });
    }
    return res.json();
  }

  // {a: "text", n: 5} <-> Firestore's typed fields
  const toDoc = (o) => ({
    fields: Object.fromEntries(
      Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? { integerValue: String(v) } : { stringValue: String(v == null ? "" : v) }])
    ),
  });
  function fromDoc(d) {
    if (!d) return null;
    const o = { id: d.name.split("/").pop() };
    Object.entries(d.fields || {}).forEach(([k, v]) => (o[k] = "integerValue" in v ? Number(v.integerValue) : v.stringValue));
    return o;
  }
  const dataOf = (doc) => {
    try {
      return JSON.parse((doc && doc.data) || "{}");
    } catch (e) {
      return {};
    }
  };

  /* ---------------- upload ---------------- */

  let pushTimer;
  let pushing = Promise.resolve();
  let caughtUp = false; // never upload before this browser has your latest version

  function schedulePush() {
    if (!account) return;
    write(K.dirty, true);
    setStatus("syncing");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1200);
  }

  async function upload(acct, tok, data) {
    const at = Date.now();
    const text = JSON.stringify(data);
    await api(`users/${acct.uid}`, {
      method: "PATCH",
      tok,
      body: toDoc({ data: text, name: acct.name, photo: acct.photo || "", base: acct.base, updatedAt: at }),
    });
    if (acct.base === "library") {
      await api("public/owner", { method: "PATCH", tok, body: toDoc({ data: text, name: acct.name, updatedAt: at }) });
    }
    return at;
  }

  function push() {
    clearTimeout(pushTimer);
    if (!account || !caughtUp) return pushing;
    pushing = pushing
      .then(async () => {
        if (!read(K.dirty, false)) return setStatus("synced");
        const at = await upload(account, await token(account), Store.snapshot());
        write(K.syncAt, at);
        drop(K.dirty);
        setStatus("synced");
      })
      .catch((err) => {
        console.warn("Sync:", err.message);
        setStatus(err.signedOut ? "signed-out" : "offline");
      });
    return pushing;
  }

  // leaving the page: try to send what's left (anything missed goes up on the next page)
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && read(K.dirty, false) && push());

  /* ---------------- download ---------------- */

  function reloadOnce() {
    try {
      const last = Number(sessionStorage.getItem("mn:syncReload") || 0);
      if (Date.now() - last < 10000) return;
      sessionStorage.setItem("mn:syncReload", Date.now());
    } catch (e) {}
    location.reload();
  }

  // put your account's version in this browser; reload if anything changed
  function apply(data, at) {
    const before = JSON.stringify(Store.snapshot());
    Store.replaceData(data);
    write(K.syncAt, at);
    drop(K.dirty);
    if (JSON.stringify(Store.snapshot()) !== before) reloadOnce();
  }

  // signed in, on every page: catch up with your account, then upload anything left over
  async function start() {
    try {
      const tok = await token(account);
      const remote = fromDoc(await api(`users/${account.uid}`, { tok }));
      caughtUp = true;
      if (!remote) {
        write(K.dirty, true);
        await push();
      } else if (remote.updatedAt > read(K.syncAt, 0)) {
        // a newer version from another device wins; keep a copy of this browser's in case
        if (read(K.dirty, false)) write(K.backup, Store.snapshot());
        apply(dataOf(remote), remote.updatedAt);
        setStatus("synced");
      } else if (read(K.dirty, false)) {
        await push();
      } else {
        setStatus("synced");
      }
      loadFriends(tok);
    } catch (err) {
      console.warn("Sync:", err.message);
      if (err.signedOut) {
        setStatus("signed-out");
        toast(`${first(account.name)}, please sign in again to keep syncing`);
      } else setStatus("offline");
    }
  }

  // signed out: show the owner's latest library
  async function refreshPublic() {
    try {
      const doc = fromDoc(await api("public/owner"));
      const cached = read(K.pub, null);
      if (!doc) {
        if (cached) {
          drop(K.pub);
          reloadOnce();
        }
        return;
      }
      if (cached && cached.updatedAt === doc.updatedAt) return;
      write(K.pub, { updatedAt: doc.updatedAt, name: doc.name, data: dataOf(doc) });
      reloadOnce();
    } catch (err) {
      console.warn("Public library:", err.message);
    }
  }

  /* ---------------- friends (the other profiles you can see) ---------------- */

  const friendListeners = [];
  const nameKey = (title, year) => `n:${String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "")}|${year || ""}`;

  // their ratings / watchlist / favorites, looked up by TMDB id or by title + year
  function indexOf(data, base) {
    const ov = data.overrides || {};
    const items = (base === "library" ? window.LIBRARY || [] : []).concat(data.custom || []);
    const index = {};
    items.forEach((it) => {
      const m = Object.assign({}, it, ov[it.id] || {});
      if (m.watchlist && typeof m.rating === "number" && !m.rewatch) m.watchlist = false; // rated = watched
      if (m.removed || (m.rating == null && !m.watchlist && !m.favorite)) return;
      const v = { r: m.rating == null ? null : m.rating, w: !!m.watchlist, f: !!m.favorite };
      if (m.tmdbId && m.tmdbMedia) index[`${m.tmdbMedia}-${m.tmdbId}`] = v;
      index[nameKey(m.title, m.year)] = v;
    });
    return index;
  }

  // the owner sees every profile; everyone else sees only the owner's (public) library
  async function loadFriends(tok) {
    const cached = read(K.friends, null);
    if (cached && Date.now() - cached.at < FRIENDS_MAX_AGE) return;
    try {
      let list;
      if (account.base === "library") {
        const res = await api("users", { tok });
        list = ((res && res.documents) || [])
          .map(fromDoc)
          .filter((d) => d.id !== account.uid)
          .map((d) => ({ uid: d.id, name: first(d.name), photo: d.photo, index: indexOf(dataOf(d), d.base) }));
      } else {
        const owner = fromDoc(await api("public/owner"));
        list = owner ? [{ uid: "owner", name: first(owner.name), photo: "images/placeholders/user.svg", index: indexOf(dataOf(owner), "library") }] : [];
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      write(K.friends, { at: Date.now(), list });
      friendListeners.forEach((fn) => fn());
    } catch (err) {
      console.warn("Friends:", err.message);
    }
  }

  function friends() {
    return account ? (read(K.friends, null) || {}).list || [] : [];
  }

  // what each friend did with this title: [{uid, name, photo, r, w, f}]
  // (works for library items and for TMDB results, which have mediaType instead of tmdbMedia)
  function friendsFor(item) {
    if (!item) return [];
    const media = item.tmdbMedia || item.mediaType;
    return friends()
      .map((p) => {
        const v = (item.tmdbId && media && p.index[`${media}-${item.tmdbId}`]) || p.index[nameKey(item.title, item.year)];
        return v ? Object.assign({ uid: p.uid, name: p.name, photo: p.photo }, v) : null;
      })
      .filter(Boolean);
  }

  // on your watchlist and theirs (everyone's, for "all"), and nobody has rated it yet
  function together(item, uid) {
    if (!item.watchlist || item.rating != null) return false;
    const mine = friendsFor(item);
    const want = uid === "all" ? friends().map((f) => f.uid) : [uid];
    return want.length > 0 && want.every((id) => mine.some((f) => f.uid === id && f.w && f.r == null));
  }

  /* ---------------- sign in / switch / sign out ---------------- */

  // this browser's changes from before signing in, added on top of the account's
  function mergeLocal(remote) {
    const local = Store.snapshot();
    const overrides = Object.assign({}, remote.overrides);
    Object.entries(local.overrides || {}).forEach(([id, o]) => (overrides[id] = Object.assign({}, overrides[id], o)));
    const ids = new Set((remote.custom || []).map((c) => c.id));
    const custom = (remote.custom || []).concat((local.custom || []).filter((c) => !ids.has(c.id)));
    return { overrides, custom, tiers: remote.tiers || local.tiers, profile: Object.assign({}, local.profile, remote.profile) };
  }

  function remember(acct) {
    write(K.accounts, accounts().filter((a) => a.uid !== acct.uid).concat(acct));
    write(K.account, acct);
    drop(K.friends, K.dirty);
  }

  // a message that stays until it's closed (a toast is easy to miss after the Google pop-up)
  function notice(icon, title, html) {
    if (!window.Cards || !Cards.makeOverlay) return alert(`${title}\n\n${html.replace(/<[^>]+>/g, "")}`);
    const overlay = Cards.makeOverlay(
      "notice-modal",
      `<div class="notice-icon"><i class="${icon}"></i></div>
       <h2>${UI.esc(title)}</h2>
       <p>${html}</p>
       <button class="btn btn-primary notice-ok" type="button">OK</button>`
    );
    overlay.querySelector(".notice-ok").addEventListener("click", () => Cards.closeModal(overlay));
    overlay.onclose = () => setTimeout(() => overlay.remove(), 300);
    Cards.openModal(overlay);
  }

  function ownerName() {
    const pub = read(K.pub, null);
    return pub && pub.name ? first(pub.name) : "the owner";
  }

  // Safari (iPhone / iPad) only allows a pop-up that opens straight from the tap, with no
  // waiting in between. So the sign-in code is loaded ahead of time (when the profile menu
  // opens), and the tap then opens Google's window immediately.
  let readyApp = null;
  let preparing = null;
  function prepare() {
    if (!enabled || readyApp || preparing) return preparing;
    preparing = appFor(`acct-${Date.now().toString(36)}`)
      .then((app) => (readyApp = app))
      .catch((e) => console.warn("Sign in:", e.message))
      .finally(() => (preparing = null));
    return preparing;
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  async function signIn() {
    if (!enabled) return;
    let app;
    let email = "";
    try {
      let popup;
      if (readyApp) {
        // no "await" before this line: keeps Safari's pop-up permission from the tap
        app = readyApp;
        readyApp = null;
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        popup = app.auth().signInWithPopup(provider);
      } else {
        app = await appFor(`acct-${Date.now().toString(36)}`);
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        popup = app.auth().signInWithPopup(provider);
      }
      const { user } = await popup;
      email = user.email || "";
      await flush(); // finish uploading the current profile's changes before switching

      const known = accounts().find((a) => a.uid === user.uid);
      if (known) {
        await app.delete();
        return known.uid === (account && account.uid) ? null : switchTo(known.uid);
      }

      const acct = { uid: user.uid, name: user.displayName || user.email, email: user.email, photo: user.photoURL || "", app: app.name };
      const tok = await user.getIdToken();
      const remote = fromDoc(await api(`users/${acct.uid}`, { tok })); // refused if this account isn't allowed
      write(K.backup, Store.snapshot());

      if (remote) {
        // signed in before on another device
        acct.base = remote.base || "empty";
        let data = dataOf(remote);
        let at = remote.updatedAt;
        if (acct.base === "library" && !account) {
          const merged = mergeLocal(data);
          if (JSON.stringify(merged) !== JSON.stringify(data)) {
            data = merged;
            at = await upload(acct, tok, data);
          }
        }
        remember(acct);
        Store.replaceData(data);
        write(K.syncAt, at);
      } else {
        // first time ever: the first account keeps the site's library, everyone after starts empty
        const owner = await api("public/owner");
        acct.base = owner ? "empty" : "library";
        const joined = new Date().toLocaleString("en", { month: "long", year: "numeric" });
        const data =
          acct.base === "library" && !account
            ? Store.snapshot()
            : { overrides: {}, custom: [], tiers: null, profile: acct.base === "empty" ? { joined } : {} };
        const at = await upload(acct, tok, data);
        remember(acct);
        Store.replaceData(data);
        write(K.syncAt, at);
      }
      location.reload();
    } catch (err) {
      if (app) {
        try {
          await app.auth().signOut();
          await app.delete();
        } catch (e) {}
      }
      console.warn("Sign in:", err);
      if (err.code === "auth/cancelled-popup-request") return;
      if (err.code === "auth/popup-closed-by-user") {
        // on a computer that just means "closed the window"; on iPhone / iPad it's often
        // iOS losing the Google window, so explain what to try
        if (isIos || standalone) {
          notice(
            "fa-solid fa-mobile-screen",
            "Sign-in didn't finish",
            standalone
              ? `The Google window closed before signing in finished. Apps added to the Home Screen on iPhone / iPad
                 sometimes lose that window.<br><br>Try again, and if it still doesn't work, open the site in <strong>Safari</strong>,
                 sign in there, then use it from Safari.`
              : `The Google window closed before signing in finished.<br><br>Try again. If it keeps happening, check
                 <strong>Settings → Safari → Block Pop-ups</strong> is off for a moment, or that Private Browsing is off.`
          );
        }
        return;
      }
      const esc = UI.esc;
      if (err.status === 403 && /has not been used|disabled/i.test(err.message)) {
        notice("fa-solid fa-database", "Sign-in isn't ready yet", "The database hasn't been set up yet (Firebase console → Firestore → Create database).");
      } else if (err.status === 403) {
        notice(
          "fa-solid fa-user-lock",
          "This account can't sign in",
          `${email ? `<strong>${esc(email)}</strong> isn't` : "This Google account isn't"} on the Movie Nights guest list.
           Only people added by ${esc(ownerName())} can sign in.<br><br>
           Ask ${esc(ownerName())} to add your Gmail address, then try again. You can still browse the site without signing in.`
        );
      } else if (err.code === "auth/popup-blocked") {
        notice("fa-solid fa-window-restore", "Sign-in window blocked", "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.");
      } else if (err.code === "auth/unauthorized-domain") {
        notice("fa-solid fa-globe", "Sign-in isn't allowed here", "This web address isn't allowed to use sign-in yet (Firebase → Authentication → Settings → Authorized domains).");
      } else if (err.code === "auth/network-request-failed" || err instanceof TypeError) {
        notice("fa-solid fa-wifi", "No connection", "Couldn't reach Google. Check your internet connection and try again.");
      } else {
        notice("fa-solid fa-triangle-exclamation", "Couldn't sign in", esc(err.message || "Something went wrong. Please try again."));
      }
    }
  }

  // finish uploading before switching away
  async function flush() {
    if (account && read(K.dirty, false)) await push();
    else await pushing;
  }

  async function switchTo(uid) {
    const acct = accounts().find((a) => a.uid === uid);
    if (!acct || (account && account.uid === uid)) return;
    toast(`Switching to ${first(acct.name)}…`);
    try {
      await flush();
      const remote = fromDoc(await api(`users/${acct.uid}`, { tok: await token(acct) }));
      remember(acct);
      Store.replaceData(remote ? dataOf(remote) : {});
      write(K.syncAt, remote ? remote.updatedAt : 0);
      location.reload();
    } catch (err) {
      if (err.signedOut) {
        write(K.accounts, accounts().filter((a) => a.uid !== uid));
        toast(`${first(acct.name)} was signed out. Choose "Add a profile" to sign in again.`);
      } else toast(`Couldn't switch profiles: ${err.message}`);
    }
  }

  async function signOut() {
    if (!account) return;
    await flush();
    try {
      const app = await appFor(account.app);
      await app.auth().signOut();
      await app.delete();
    } catch (e) {}
    write(K.accounts, accounts().filter((a) => a.uid !== account.uid));
    // this device goes back to the public library; your data stays in your account
    drop(K.account, K.syncAt, K.dirty, K.friends, ...Store.SYNCED);
    location.reload();
  }

  /* ---------------- start ---------------- */

  if (enabled) {
    if (account) Store.onSave(schedulePush);
    document.addEventListener("DOMContentLoaded", () => (account ? start() : refreshPublic()));
  }

  window.Cloud = {
    enabled,
    account: () => account,
    accounts,
    first,
    signIn,
    prepare,
    signOut,
    notice,
    switchTo,
    status: () => status,
    onStatus: (fn) => statusListeners.push(fn),
    friends,
    friendsFor,
    together,
    onFriends: (fn) => friendListeners.push(fn),
  };
})();
