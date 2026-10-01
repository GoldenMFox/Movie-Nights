/*
 * Movie Nights tests: open tools/tests.html (e.g. http://localhost:8080/tools/tests.html).
 * No setup, no installs: the site's own scripts, checked in the browser.
 *
 * What's covered (the parts where a mistake loses data or breaks syncing):
 *  - merging two devices' changes (js/core/cloud.js mergeData)
 *  - looking at the account before saving (catchUp: with a pretend Firestore)
 *  - what a sync error is called (statusOf), the spare copy dropped after a week
 *  - short share links (s/index.html) opening the right title page
 *
 * This browser's saved data is put back exactly as it was when the tests end.
 */
(async function () {
  const out = document.getElementById("out");
  const results = [];
  let section = "";
  const group = (name) => {
    section = name;
    out.insertAdjacentHTML("beforeend", `<h2>${name}</h2>`);
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function check(name, ok, detail) {
    results.push({ section, name, ok });
    out.insertAdjacentHTML(
      "beforeend",
      `<div class="t ${ok ? "ok" : "bad"}"><i>${ok ? "✓" : "✗"}</i><span>${esc(name)}${ok || !detail ? "" : `<small>${esc(detail)}</small>`}</span></div>`
    );
  }
  const eq = (name, got, want) => check(name, same(got, want), `got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);

  // this browser's own saved data, put back at the end
  const KEYS = ["mn:overrides", "mn:custom", "mn:tiers", "mn:profile", "mn:syncAt", "mn:syncBase", "mn:localBackup", "mn:localBackupAt", "mn:dirty"];
  const saved = {};
  KEYS.forEach((k) => (saved[k] = localStorage.getItem(k)));
  const realFetch = window.fetch;

  const T = Cloud._test;
  const title = (id, extra) => Object.assign({ id, title: id, year: 2020, type: "movie" }, extra);

  try {
    /* ---------------- merging ---------------- */
    group("Merging two devices' changes");
    const base = { overrides: { a: { rating: 7 } }, custom: [title("a"), title("b")], tiers: { S: ["a"] }, profile: { name: "Me", lists: [] } };

    let m = T.mergeData(base, { ...base, overrides: { a: { rating: 9 } } }, base);
    eq("a score changed here is kept", m.overrides.a.rating, 9);

    m = T.mergeData(base, base, { ...base, overrides: { a: { rating: 7 }, b: { rating: 5 } } });
    eq("a score given on the other device is kept", m.overrides.b && m.overrides.b.rating, 5);

    m = T.mergeData(base, { ...base, overrides: { a: { rating: 7, favorite: true } } }, { ...base, overrides: { a: { rating: 8 } } });
    eq("both devices changed one title (different things): both kept", m.overrides.a, { rating: 8, favorite: true });

    m = T.mergeData(base, { ...base, overrides: { a: { rating: 9 } } }, { ...base, overrides: { a: { rating: 8 } } });
    eq("both changed the same score: this device's wins", m.overrides.a.rating, 9);

    m = T.mergeData(base, base, { ...base, custom: base.custom.concat(title("c")) });
    eq("a title added on the other device comes over", m.custom.map((i) => i.id), ["a", "b", "c"]);

    m = T.mergeData(base, { ...base, custom: base.custom.concat(title("d")) }, base);
    eq("a title added here stays", m.custom.map((i) => i.id), ["a", "b", "d"]);

    m = T.mergeData(base, { ...base, custom: base.custom.concat(title("d")) }, { ...base, custom: base.custom.concat(title("c")) });
    eq("added on both devices: both stay", m.custom.map((i) => i.id).sort(), ["a", "b", "c", "d"]);

    m = T.mergeData(base, base, { ...base, custom: [title("a")] });
    eq("removed on the other device (unchanged here): gone", m.custom.map((i) => i.id), ["a"]);

    m = T.mergeData(base, { ...base, custom: [title("a"), title("b", { year: 2021 })] }, { ...base, custom: [title("a")] });
    eq("removed there but changed here: kept", m.custom.map((i) => i.id), ["a", "b"]);

    m = T.mergeData(base, base, { ...base, tiers: { S: ["a", "b"] } });
    eq("tier list changed on the other device comes over", m.tiers, { S: ["a", "b"] });

    m = T.mergeData(base, { ...base, profile: { name: "New name", lists: [] } }, { ...base, profile: { name: "Me", lists: [{ id: "l1" }] } });
    eq("profile: name changed here, a list made there: both kept", m.profile, { name: "New name", lists: [{ id: "l1" }] });

    m = T.mergeData({}, { custom: [title("a")], overrides: { a: { rating: 9 } } }, { custom: [title("b")], overrides: {} });
    eq("no common version known (first sync): nothing is lost", m.custom.map((i) => i.id).sort(), ["a", "b"]);

    /* ---------------- sync errors ---------------- */
    group("What a sync error is called");
    eq("no internet → offline (tried again later)", T.statusOf(new TypeError("Failed to fetch")), "offline");
    eq("Firestore busy (503) → offline", T.statusOf({ status: 503 }), "offline");
    eq("session ended (401) → sign in again", T.statusOf({ status: 401 }), "signed-out");
    eq("the account refused it (403) → refused (shown in red)", T.statusOf({ status: 403 }), "refused");
    eq("the other device kept saving (precondition) → tried again", T.statusOf({ status: 400, reason: "FAILED_PRECONDITION" }), "offline");

    /* ---------------- the account, before saving (pretend Firestore) ---------------- */
    group("Looking at the account before saving");
    const acct = { uid: "test-user", name: "Test" };
    let doc = null; // the pretend account document
    let fullReads = 0;
    window.fetch = async (url) => {
      const u = String(url);
      if (!u.includes("firestore.googleapis.com")) return realFetch(url);
      if (!doc) return new Response("{}", { status: 404 });
      if (u.includes("mask.fieldPaths=updatedAt")) return Response.json({ updateTime: doc.updateTime, fields: { updatedAt: { integerValue: String(doc.updatedAt) } } });
      fullReads++;
      return Response.json({
        name: `projects/x/databases/(default)/documents/users/${acct.uid}`,
        updateTime: doc.updateTime,
        fields: { data: { stringValue: JSON.stringify(doc.data) }, updatedAt: { integerValue: String(doc.updatedAt) } },
      });
    };
    const shared = { overrides: { a: { rating: 7 } }, custom: [title("a"), title("b")], tiers: null, profile: {} };

    // 1. nobody saved since this device's last sync: just the save time is read
    Store.replaceData(JSON.parse(JSON.stringify(shared)));
    localStorage.setItem("mn:syncBase", JSON.stringify(shared));
    localStorage.setItem("mn:syncAt", "1000");
    doc = { updatedAt: 1000, updateTime: "2026-10-01T10:00:00.000001Z", data: shared };
    fullReads = 0;
    let cond = await T.catchUp("token", acct);
    eq("nothing new: saves only if still unchanged", cond, `currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`);
    eq("nothing new: the library isn't downloaded", fullReads, 0);

    // 2. the other device saved meanwhile: its changes are merged in, this device's kept
    Store.replaceData({ ...JSON.parse(JSON.stringify(shared)), overrides: { a: { rating: 9 } } }); // changed here: a → 9
    const theirs = { ...JSON.parse(JSON.stringify(shared)), overrides: { a: { rating: 7 }, b: { rating: 6 } }, custom: shared.custom.concat(title("c")) }; // there: b → 6, c added
    doc = { updatedAt: 2000, updateTime: "2026-10-01T10:05:00.000002Z", data: theirs };
    localStorage.removeItem("mn:localBackup");
    cond = await T.catchUp("token", acct);
    const after = Store.snapshot();
    eq("other device saved: my score kept (a = 9)", after.overrides.a && after.overrides.a.rating, 9);
    eq("other device saved: its score kept (b = 6)", after.overrides.b && after.overrides.b.rating, 6);
    eq("other device saved: its new title kept (c)", after.custom.map((i) => i.id), ["a", "b", "c"]);
    eq("other device saved: saves only if not changed again", cond, `currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`);
    eq("other device saved: remembered as synced up to it", Number(localStorage.getItem("mn:syncAt")), 2000);
    check("other device saved: a spare copy of this device's version is kept", !!localStorage.getItem("mn:localBackup") && !!localStorage.getItem("mn:localBackupAt"));

    // 3. no account document yet (first save): only saved if it still doesn't exist
    doc = null;
    eq("first save ever: only if the document still doesn't exist", await T.catchUp("token", acct), "currentDocument.exists=false");
    window.fetch = realFetch;

    /* ---------------- the spare copy ---------------- */
    group("The spare copy of the library");
    localStorage.setItem("mn:localBackup", "{}");
    localStorage.setItem("mn:localBackupAt", String(Date.now() - 2 * 86400000));
    T.dropOldBackup();
    check("2 days old: kept (safety net)", !!localStorage.getItem("mn:localBackup"));
    localStorage.setItem("mn:localBackupAt", String(Date.now() - 8 * 86400000));
    T.dropOldBackup();
    check("8 days old: dropped (frees the browser's storage)", !localStorage.getItem("mn:localBackup") && !localStorage.getItem("mn:localBackupAt"));
    localStorage.setItem("mn:localBackup", "{}");
    localStorage.removeItem("mn:localBackupAt");
    T.dropOldBackup();
    check("an old copy without a date (made before this change): dropped", !localStorage.getItem("mn:localBackup"));

    /* ---------------- short share links ---------------- */
    group("Short share links (s/index.html)");
    // opens a short link in a hidden frame and gives back where it led (the page after s/)
    const open = (link) =>
      new Promise((resolve) => {
        const f = document.createElement("iframe");
        f.style.display = "none";
        const done = (p) => {
          clearTimeout(timer);
          f.remove();
          resolve(p);
        };
        const timer = setTimeout(() => done("(timed out)"), 8000);
        f.addEventListener("load", () => {
          const l = f.contentWindow.location;
          if (l.href !== "about:blank" && !/\/s\/$/.test(l.pathname)) done(l.pathname + l.search);
        });
        f.src = `../s/${link}`;
        document.body.append(f);
      });
    const params = (p) => Object.fromEntries(new URLSearchParams(p.split("?")[1] || ""));
    eq("a film with a score and a name", params(await open("?m14.9,5.Mirzac_Nicolae")), { tmdb: "movie-14", r: "9.5", from: "Mirzac Nicolae" });
    eq("a show with only a score", params(await open("?t1396.10")), { tmdb: "tv-1396", r: "10" });
    eq("a note with dots, commas, Romanian letters and an emoji", params(await open("?m14...Nu_rata%C8%9Bi_finalul._E_genial,_100%25!_%F0%9F%8C%B9")), {
      tmdb: "movie-14",
      note: "Nu ratați finalul. E genial, 100%! 🌹",
    });
    check("a broken link goes to Discover", /discover\.html$/.test(await open("?garbage")));
  } catch (err) {
    check(`The tests stopped: ${err.message}`, false, err.stack);
  } finally {
    window.fetch = realFetch;
    KEYS.forEach((k) => (saved[k] == null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[k])));
  }

  const failed = results.filter((r) => !r.ok).length;
  document.querySelector(".sum").innerHTML = failed
    ? `<b class="bad">${failed} of ${results.length} failed</b>`
    : `<b class="ok">All ${results.length} passed</b>`;
  document.title = `${failed ? "✗" : "✓"} Tests · Movie Nights`;
})();
