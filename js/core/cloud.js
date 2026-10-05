/*
 * Cloud sync: sign in with Google and your library (ratings, favorites,
 * watchlist, tiers, profile) follows you to every device.
 *
 *  - Sign-in: Firebase Auth (its script is only loaded for signed-in people).
 *  - Storage: Firestore, one private document per person in "users/{uid}", read and
 *    written through Firestore's REST API. Who may use it is decided by the
 *    security rules in the Firebase console (only the listed Google accounts).
 *  - Everyone has their own library and sees only their own ratings. Visitors who
 *    aren't signed in see no library at all.
 *  - The owner (admin) is the account the rules allow to list everyone ("users"):
 *    it gets Add a title, the advanced settings and the Members panel.
 *  - Several accounts can stay signed in on one device ("Who's watching?").
 *
 * This browser's localStorage stays the working copy: pages read it straight
 * away, and changes are uploaded a moment later. Nothing here runs unless
 * MN_CONFIG.FIREBASE is filled in (js/config.js).
 *
 * Two devices changed things before syncing (e.g. the phone offline): both sets of changes
 * are kept. The last version both agreed on is remembered (mn:syncBase), so for every
 * title and every setting it's clear which side changed it; the other side's changes stay.
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
    backup: "mn:localBackup", // what this browser had before its version was replaced or merged
    backupAt: "mn:localBackupAt", // when that copy was made (it's dropped a week later)
    base: "mn:syncBase", // the last version this browser and the account agreed on (for merging)
  };
  try {
    // older versions: a partner's / friends' ratings, the owner's public library
    ["mn:partner", "mn:friends", "mn:public"].forEach((k) => localStorage.removeItem(k));
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
  // A spare copy of this browser's library, made before it's replaced by (or merged with) the
  // account's version: kept a week as a safety net, then dropped (it's the size of the whole
  // library, and the browser's storage is small, especially on iPhone)
  const WEEK = 7 * 24 * 3600 * 1000;
  function keepBackup() {
    write(K.backup, Store.snapshot());
    write(K.backupAt, Date.now());
  }
  function dropOldBackup() {
    if (read(K.backup, null) && Date.now() - read(K.backupAt, 0) > WEEK) drop(K.backup, K.backupAt);
  }
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
    const res = await fetch(`${DB}/${path}${tok ? "" : `${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(cfg.apiKey)}`}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      let msg = res.statusText;
      let reason = "";
      try {
        const e = (await res.json()).error;
        msg = e.message;
        reason = e.status || ""; // e.g. "FAILED_PRECONDITION": the document changed meanwhile
      } catch (e) {}
      throw Object.assign(new Error(msg), { status: res.status, reason });
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
  let edits = 0; // changes made on this page (one made during an upload goes up next time)

  function schedulePush() {
    if (!account) return;
    edits++;
    write(K.dirty, true);
    setStatus("syncing");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1200);
  }

  // what went wrong, as a status: no internet ("offline"), signed out, or the account
  // refused the save ("refused": the rules said no, e.g. the library is over the size limit
  // or this device's clock is far off). Only "offline" is something that fixes itself.
  const LIMIT = 900000; // the most the account takes (docs/firestore.rules)
  let lastSize = 0; // the last upload's size, to explain a refusal
  function statusOf(err) {
    if (err.signedOut || err.status === 401) return "signed-out";
    if (err.reason === "FAILED_PRECONDITION") return "offline"; // the other device kept saving: tried again later
    if (err.status === 400 || err.status === 403 || err.status === 413) return "refused";
    return "offline";
  }
  let refusedTold = false;
  function refused() {
    if (refusedTold) return;
    refusedTold = true;
    const why =
      lastSize >= LIMIT
        ? "Your library is bigger than your account can hold."
        : "Check that this device's date and time are set automatically, then reload.";
    if (window.UI) UI.toast(`Couldn't save to your account. ${why} Your changes are kept on this device.`);
  }

  // cond: only save if the document is still the one we read ("currentDocument.updateTime=…",
  // or "currentDocument.exists=false" for a first save). Firestore refuses it otherwise
  // (FAILED_PRECONDITION) and push() reads it again.
  async function upload(acct, tok, data, cond) {
    const at = Date.now();
    const text = JSON.stringify(data);
    lastSize = text.length;
    await api(`users/${acct.uid}${cond ? `?${cond}` : ""}`, {
      method: "PATCH",
      tok,
      // (your picture: the character you picked, else your Google photo; shown in Members)
      body: toDoc({ data: text, name: acct.name, photo: (acct === account ? Store.myPhoto(true) : acct.photo) || "", base: acct.base, updatedAt: at }),
    });
    return at;
  }

  // Before saving, a quick look at the account (just its save time, a few bytes): another device
  // saved since this one last synced (both open at once)? Then its version is read and merged
  // with this one (mergeData: each side's changes kept), so nothing it saved is overwritten.
  // The save only goes through if the account didn't change again meanwhile; if it did, look again.
  async function catchUp(tok, acct = account) {
    const head = await api(`users/${acct.uid}?mask.fieldPaths=updatedAt`, { tok });
    if (!head) return "currentDocument.exists=false";
    const remoteAt = Number(((head.fields || {}).updatedAt || {}).integerValue || 0);
    if (remoteAt <= read(K.syncAt, 0)) return `currentDocument.updateTime=${encodeURIComponent(head.updateTime)}`;
    const full = await api(`users/${acct.uid}`, { tok });
    if (!full) return "currentDocument.exists=false";
    const theirs = dataOf(fromDoc(full));
    const before = JSON.stringify(Store.snapshot());
    keepBackup();
    Store.replaceData(mergeData(read(K.base, null) || {}, Store.snapshot(), theirs));
    write(K.syncAt, remoteAt);
    write(K.base, theirs);
    if (JSON.stringify(Store.snapshot()) !== before) toast("Synced with your other device: both sets of changes are kept");
    return `currentDocument.updateTime=${encodeURIComponent(full.updateTime)}`;
  }

  function push() {
    clearTimeout(pushTimer);
    if (!account || !caughtUp) return pushing;
    pushing = pushing
      .then(async () => {
        if (!read(K.dirty, false)) return setStatus("synced");
        const seen = edits;
        const tok = await token(account);
        for (let attempt = 1; ; attempt++) {
          const cond = await catchUp(tok);
          const data = Store.snapshot();
          try {
            const at = await upload(account, tok, data, cond);
            write(K.syncAt, at);
            write(K.base, data);
            break;
          } catch (err) {
            // saved on the other device at that very moment: read it again (three tries)
            if (err.reason === "FAILED_PRECONDITION" && attempt < 3) continue;
            throw err;
          }
        }
        dropOldBackup();
        // changed again while it was uploading: stays "to upload" (its own timer sends it)
        if (edits !== seen) return;
        drop(K.dirty);
        setStatus("synced");
      })
      .catch((err) => {
        console.warn("Sync:", err.message);
        const s = statusOf(err);
        // (offline / signed out aren't the site's errors: they'd fill the log on every page)
        if (s !== "offline" && s !== "signed-out") Store.logError(`Sync: ${err.message}`, "saving to your account");
        setStatus(s);
        if (s === "refused") refused();
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
    write(K.base, data);
    drop(K.dirty);
    if (JSON.stringify(Store.snapshot()) !== before) reloadOnce();
  }

  /* ---------------- merging two devices' changes ---------------- */

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // field by field: what this browser changed since the last sync wins, the rest comes
  // from the account (so a change on the other device is kept too)
  function mergeFields(base, local, remote) {
    base = base || {};
    local = local || {};
    remote = remote || {};
    const out = {};
    new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]).forEach((f) => {
      const v = same(local[f], base[f]) ? remote[f] : local[f];
      if (v !== undefined) out[f] = v;
    });
    return out;
  }

  function mergeData(base, local, remote) {
    const B = base.overrides || {};
    const L = local.overrides || {};
    const R = remote.overrides || {};
    const overrides = {};
    new Set([...Object.keys(L), ...Object.keys(R)]).forEach((id) => {
      const m = mergeFields(B[id], L[id], R[id]);
      if (Object.keys(m).length) overrides[id] = m;
    });

    // titles: added on either side stay; removed on one side go, unless the other side
    // changed them meanwhile
    const byId = (list) => new Map((list || []).map((i) => [i.id, i]));
    const b = byId(base.custom);
    const l = byId(local.custom);
    const r = byId(remote.custom);
    const pick = (id) => {
      if (l.has(id) && r.has(id)) return mergeFields(b.get(id), l.get(id), r.get(id));
      if (l.has(id)) return b.has(id) && same(l.get(id), b.get(id)) ? null : l.get(id);
      if (r.has(id)) return b.has(id) && same(r.get(id), b.get(id)) ? null : r.get(id);
      return null;
    };
    const custom = [];
    // the account's order, then what's new here
    (remote.custom || []).forEach((i) => {
      const m = pick(i.id);
      if (m) custom.push(m);
    });
    (local.custom || []).forEach((i) => {
      if (r.has(i.id)) return;
      const m = pick(i.id);
      if (m) custom.push(m);
    });

    return {
      overrides,
      custom,
      tiers: same(local.tiers, base.tiers) ? remote.tiers : local.tiers,
      profile: mergeFields(base.profile, local.profile, remote.profile),
    };
  }

  // signed in, on every page: catch up with your account, then upload anything left over
  async function start() {
    try {
      const tok = await token(account);
      const remote = fromDoc(await api(`users/${account.uid}`, { tok }));
      caughtUp = true;
      // the account's library changed shape on another device: take the account's version
      if (remote && remote.base && remote.base !== account.base) {
        remember(Object.assign({}, account, { base: remote.base }));
        Store.replaceData(dataOf(remote));
        write(K.syncAt, remote.updatedAt);
        write(K.base, dataOf(remote));
        return reloadOnce();
      }
      if (!remote) {
        write(K.dirty, true);
        await push();
      } else if (remote.updatedAt > read(K.syncAt, 0)) {
        const theirs = dataOf(remote);
        const base = read(K.base, null);
        if (read(K.dirty, false) && base) {
          // both this browser and another device changed things: keep both
          keepBackup();
          const before = JSON.stringify(Store.snapshot());
          const merged = mergeData(base, Store.snapshot(), theirs);
          Store.replaceData(merged);
          write(K.syncAt, remote.updatedAt);
          write(K.base, theirs);
          write(K.dirty, true);
          edits++;
          await push();
          if (JSON.stringify(Store.snapshot()) !== before) {
            toast("Synced: your changes here and on your other device are both kept");
            setTimeout(reloadOnce, 1200);
          }
        } else {
          // (changes here with nothing to compare against: the account's version wins,
          // and a copy of this browser's is kept in mn:localBackup)
          if (read(K.dirty, false)) keepBackup();
          apply(theirs, remote.updatedAt);
          setStatus("synced");
        }
      } else if (read(K.dirty, false)) {
        await push();
      } else {
        setStatus("synced");
        dropOldBackup();
      }
      await checkOwner(tok);
    } catch (err) {
      console.warn("Sync:", err.message);
      const s = statusOf(err);
      if (s !== "offline" && s !== "signed-out") Store.logError(`Sync: ${err.message}`, "opening your account");
      setStatus(s);
      if (s === "signed-out") toast(`${first(account.name)}, please sign in again to keep syncing`);
      // (refused while loading it: the account itself said no, e.g. not on the guest list any more)
      else if (s === "refused" && !lastSize) toast("Couldn't open your account. Ask the site's owner if you're still on the guest list.");
      else if (s === "refused") refused();
    }
  }

  /* ---------------- the owner (admin) ---------------- */

  // Only the owner may list everyone's documents (Firestore rules), so asking is a
  // check nobody can fake. Remembered on the account; the page gets html.is-owner.
  const ownerListeners = [];
  const isOwner = () => !!(account && account.owner === true);
  if (isOwner()) document.documentElement.classList.add("is-owner");

  async function checkOwner(tok) {
    if (typeof account.owner === "boolean") return;
    try {
      await api("users?pageSize=1", { tok });
      account.owner = true;
    } catch (e) {
      if (e.status !== 403) return; // offline: ask again next time
      account.owner = false;
    }
    write(K.account, account);
    write(K.accounts, accounts().map((a) => (a.uid === account.uid ? Object.assign({}, a, { owner: account.owner }) : a)));
    document.documentElement.classList.toggle("is-owner", account.owner);
    ownerListeners.forEach((fn) => fn(account.owner));
  }

  // Members panel (owner only): everyone who has signed in, with how big their library is
  // (counts only, not their ratings)
  async function members() {
    const res = await api("users", { tok: await token(account) });
    return ((res && res.documents) || []).map(fromDoc).map((d) => {
      const data = dataOf(d);
      const ov = data.overrides || {};
      const items = (d.base === "library" ? window.LIBRARY || [] : [])
        .concat(data.custom || [])
        .map((it) => Object.assign({}, it, ov[it.id] || {}))
        .filter((it) => !it.removed);
      return {
        uid: d.id,
        name: d.name,
        photo: d.photo,
        updatedAt: d.updatedAt,
        titles: items.length,
        rated: items.filter((it) => typeof it.rating === "number").length,
        watchlist: items.filter((it) => it.watchlist).length,
        me: d.id === account.uid,
        // (for the Admin Control Center's charts: what kinds, the scores, when they watched)
        types: items.reduce((t, it) => ((t[it.type] = (t[it.type] || 0) + 1), t), {}),
        scores: items.filter((it) => typeof it.rating === "number").map((it) => it.rating),
        months: items.reduce((m, it) => (it.watchedAt && (m[String(it.watchedAt).slice(0, 7)] = (m[String(it.watchedAt).slice(0, 7)] || 0) + 1), m), {}),
      };
    });
  }

  /* ---------------- the site's settings (Admin Control Center: js/pages/admin.js) ----------------
     One document, site/config: { data: the settings as JSON text, blocked: [emails], updatedAt }.
     Anyone may read it (it's how every visitor gets the owner's settings); only the owner may
     save it (docs/firestore.rules). "blocked" is a list of its own so the rules can turn those
     people away themselves. */
  async function siteLoad() {
    if (!enabled) return null;
    const d = await api("site/config");
    if (!d) return { data: null, updatedAt: 0 };
    const f = d.fields || {};
    let data = null;
    try {
      data = JSON.parse((f.data && f.data.stringValue) || "null");
    } catch (e) {}
    const blocked = ((f.blocked && f.blocked.arrayValue && f.blocked.arrayValue.values) || []).map((v) => v.stringValue).filter(Boolean);
    return { data, blocked, updatedAt: f.updatedAt ? Number(f.updatedAt.integerValue) : 0 };
  }
  async function siteSave(data, blocked) {
    if (!enabled || !account) throw new Error("Sign in first");
    const at = Date.now();
    await api("site/config", {
      method: "PATCH",
      tok: await token(account),
      body: {
        fields: {
          data: { stringValue: JSON.stringify(data) },
          blocked: { arrayValue: { values: (blocked || []).map((e) => ({ stringValue: String(e).toLowerCase().trim() })) } },
          updatedAt: { integerValue: String(at) },
        },
      },
    });
    return at;
  }

  /* ---------------- sign in / switch / sign out ---------------- */

  function remember(acct) {
    write(K.accounts, accounts().filter((a) => a.uid !== acct.uid).concat(acct));
    write(K.account, acct);
    drop(K.dirty);
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

  const ownerName = () => "the site's owner";

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

  /* iPhone / iPad: sign in by going to Google's page and coming back (no pop-up).
     iOS keeps Firebase's pop-up from reporting back (it can't reach its helper page on
     firebaseapp.com, especially in the Home Screen app), so there we ask Google for the
     sign-in ourselves and hand the answer to Firebase. Needs MN_CONFIG.GOOGLE_CLIENT_ID
     and this site's index.html listed as a redirect URI on that Google client. */
  const CLIENT_ID = (window.MN_CONFIG || {}).GOOGLE_CLIENT_ID || "";
  const OAUTH = "mn:oauth";
  const useRedirect = () => !!CLIENT_ID && isIos;
  const redirectUri = () => new URL("index.html", location.href).href.split(/[?#]/)[0];
  const random = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

  const sha256 = async (s) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

  // Google gets the hashed nonce; Firebase gets the raw one and checks they match
  async function startRedirect() {
    const raw = random();
    const nonce = await sha256(raw);
    const state = random();
    write(OAUTH, { raw, nonce, state, back: location.href.split("#")[0], at: Date.now() });
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: "id_token",
      scope: "openid email profile",
      prompt: "select_account",
      nonce,
      state,
    });
    location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
  }

  // back from Google: "#id_token=…&state=…" (or "#error=…").
  // true when signing in went through and the page is reloading
  async function finishRedirect() {
    const pending = read(OAUTH, null);
    const hash = new URLSearchParams(location.hash.slice(1));
    if (!pending || !(hash.has("id_token") || hash.has("error"))) return false;
    drop(OAUTH);
    history.replaceState(null, "", location.pathname + location.search);
    if (hash.get("state") !== pending.state || Date.now() - pending.at > 15 * 60 * 1000) return false;
    if (hash.has("error")) {
      if (hash.get("error") !== "access_denied") notice("fa-solid fa-triangle-exclamation", "Couldn't sign in", UI.esc(hash.get("error_description") || hash.get("error")));
      return false;
    }
    const idToken = hash.get("id_token");
    let app;
    try {
      const claims = JSON.parse(decodeURIComponent(escape(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))));
      if (claims.nonce !== pending.nonce) throw new Error("The sign-in answer didn't match. Please try again.");
      toast("Signing in…");
      app = await appFor(`acct-${Date.now().toString(36)}`);
      const cred = new firebase.auth.OAuthProvider("google.com").credential({ idToken, rawNonce: pending.raw });
      const { user } = await app.auth().signInWithCredential(cred);
      await welcome(app, user, pending.back);
      return true;
    } catch (err) {
      await failed(app, err);
      return false;
    }
  }

  async function signIn() {
    if (!enabled) return;
    if (useRedirect()) return startRedirect();
    let app;
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
      await welcome(app, user);
    } catch (err) {
      await failed(app, err);
    }
  }

  // signed in with Google: load (or create) this person's library, then reload the page
  async function welcome(app, user, back) {
    try {
      await flush(); // finish uploading the current profile's changes before switching

      const known = accounts().find((a) => a.uid === user.uid);
      if (known) {
        await app.delete();
        if (known.uid === (account && account.uid)) return back && location.replace(back);
        return switchTo(known.uid, back);
      }

      const acct = { uid: user.uid, name: user.displayName || user.email, email: user.email, photo: user.photoURL || "", app: app.name };
      const tok = await user.getIdToken();
      const remote = fromDoc(await api(`users/${acct.uid}`, { tok })); // refused if this account isn't allowed
      keepBackup();

      if (remote) {
        // signed in before on another device: your library comes from your account
        acct.base = remote.base || "empty";
        remember(acct);
        Store.replaceData(dataOf(remote));
        write(K.syncAt, remote.updatedAt);
        write(K.base, dataOf(remote));
      } else {
        // first time ever: a new, empty library of your own
        acct.base = "empty";
        const joined = new Date().toLocaleString("en", { month: "long", year: "numeric" });
        const data = { overrides: {}, custom: [], tiers: null, profile: { joined } };
        const at = await upload(acct, tok, data);
        remember(acct);
        Store.replaceData(data);
        write(K.syncAt, at);
        write(K.base, data);
      }
      if (back) location.replace(back);
      else location.reload();
    } catch (err) {
      err.email = user.email || "";
      throw err;
    }
  }

  async function failed(app, err) {
    const email = err.email || "";
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

  // finish uploading before switching away
  async function flush() {
    if (account && read(K.dirty, false)) await push();
    else await pushing;
  }

  async function switchTo(uid, back) {
    const acct = accounts().find((a) => a.uid === uid);
    if (!acct || (account && account.uid === uid)) return;
    toast(`Switching to ${first(acct.name)}…`);
    try {
      await flush();
      const remote = fromDoc(await api(`users/${acct.uid}`, { tok: await token(acct) }));
      if (remote && remote.base) acct.base = remote.base;
      remember(acct);
      Store.replaceData(remote ? dataOf(remote) : {});
      write(K.syncAt, remote ? remote.updatedAt : 0);
      write(K.base, remote ? dataOf(remote) : {});
      if (typeof back === "string") location.replace(back);
      else location.reload();
    } catch (err) {
      if (err.signedOut) {
        write(K.accounts, accounts().filter((a) => a.uid !== uid));
        toast(`${first(acct.name)} was signed out. Use "Sign in with Google" in the profile menu to sign in again.`);
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
    // this device shows no library until someone signs in (not even the spare copies);
    // your data stays in your account
    drop(K.account, K.syncAt, K.dirty, K.backup, K.backupAt, K.base, "mn:myPicFramed", ...Store.SYNCED);
    location.reload();
  }

  /* ---------------- start ---------------- */

  if (enabled) {
    if (account) Store.onSave(schedulePush);
    // another tab signed in, out or switched profiles: follow it
    window.addEventListener("storage", (e) => e.key === K.account && location.reload());
    document.addEventListener("DOMContentLoaded", async () => {
      if (await finishRedirect()) return;
      if (account) start();
    });
  }

  window.Cloud = {
    enabled,
    account: () => account,
    accounts,
    signIn,
    prepare,
    signOut,
    switchTo,
    status: () => status,
    onStatus: (fn) => statusListeners.push(fn),
    isOwner,
    onOwner: (fn) => ownerListeners.push(fn),
    members,
    siteLoad,
    siteSave,
    // for tools/tests.html only
    _test: { mergeData, statusOf, catchUp, keepBackup, dropOldBackup, K },
  };
})();
