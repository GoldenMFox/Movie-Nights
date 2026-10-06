/*
 * Settings page, in the site's own style (glass cards with small red labels, like X-Ray;
 * red icon circles; pill buttons; the red pill switch): theme, your streaming services,
 * import from IMDb / Letterboxd, backup, notifications, problems on this device. Only what's yours:
 * everything about running the site (TMDB / OMDb keys, members…) is in the Admin Control Center.
 * (Your name, stats and watch diary are on the Profile page: js/pages/profile.js)
 */
(function () {
  const { esc, toast, download } = UI;
  const root = document.getElementById("settings-app");
  const guest = Store.guest;
  const acct = window.Cloud && Cloud.account();
  const profile = Store.getProfile();

  const label = (icon, text) => `<span class="xr-label"><i class="fa-solid ${icon}"></i> ${text}</span>`;
  const card = (id, icon, title, body, extra = "") => `<section class="xr-card sv-card" id="${id}"${extra}>${label(icon, title)}${body}</section>`;
  // a row: red icon circle, name (+ a line under it), what you can do on the right
  const row = (icon, name, sub, right = "") => `<div class="sv-row">
      <span class="sv-ic"><i class="fa-solid ${icon}"></i></span>
      <span class="sv-name"><strong>${name}</strong>${sub ? `<small>${sub}</small>` : ""}</span>
      ${right}
    </div>`;

  root.innerHTML = `
    <div class="sv">
      <a class="sv-account" href="profile.html">
        <img src="${esc(Store.myPhoto() || "images/placeholders/user.svg")}" data-my-pic alt="" referrerpolicy="no-referrer" />
        <span class="sv-name"><strong>${esc(profile.name)}</strong><small>${guest ? "Not signed in" : acct ? "Signed in with Google" : "Your profile"}</small></span>
        <span class="btn sv-account-btn">Profile &amp; stats <i class="fa-solid fa-arrow-right"></i></span>
      </a>

      ${guest ? `<div class="p-guest">${UI.signInPrompt("Sign in for the rest of your settings")}</div>` : ""}

      <div class="sv-grid">
        <div class="sv-col">
          ${card(
            "appearance",
            "fa-palette",
            "Appearance",
            `${row(
              "fa-circle-half-stroke",
              "Theme",
              "The whole site, dark or light",
              `<div class="top10-switch sv-theme" role="group" aria-label="Theme">
                <button type="button" class="top10-tab" data-theme-pick="dark"><i class="fa-solid fa-moon"></i> Dark</button>
                <button type="button" class="top10-tab" data-theme-pick="light"><i class="fa-solid fa-sun"></i> Light</button>
              </div>`
            )}
            ${
              guest
                ? ""
                : row(
                    "fa-star",
                    "My rating",
                    "On the posters in your library: your own score (off: their IMDb rating)",
                    `<label class="sv-switch"><input type="checkbox" class="sv-my-rating" aria-label="My rating on the posters" /><span class="switch-track"><span class="switch-thumb"></span></span></label>`
                  )
            }
            ${row(
              "fa-percent",
              "Match %",
              document.documentElement.classList.contains("posters-only")
                ? "With posters only, the match shows in the hover preview. Turn on Poster details (profile menu) to switch it off."
                : "How much you'll probably like each title (86%), on the posters and in the hover preview",
              `<label class="sv-switch"><input type="checkbox" class="sv-match" aria-label="Match %" /><span class="switch-track"><span class="switch-thumb"></span></span></label>`
            )}
            <p class="sv-note"><i class="fa-solid fa-circle-info"></i> Russian titles, Dim watched and Poster details are switches in the profile menu (your picture, top right). Your notifications are in the bell beside it.</p>`
          )}

          ${card(
            "services",
            "fa-tv",
            "Streaming",
            `${row(
              "fa-earth-europe",
              "Your country",
              "Where to watch, age ratings and cinema dates",
              `<span class="glass-select small sv-country-box"><select class="sv-country" aria-label="Your country"><option value="${esc(TMDB.COUNTRY)}">${esc(TMDB.countryName())}</option></select></span>`
            )}
            <div class="services">
              <div class="svc-mine"></div>
              <div class="svc-all" hidden></div>
            </div>
            <p class="sv-note sv-svc-note"></p>`,
            guest ? " hidden" : ""
          )}

          ${card(
            "notifications",
            "fa-bell",
            "Notifications",
            `${row(
              "fa-bell",
              "On this device",
              '<span class="nt-state"></span>',
              `<label class="sv-switch" title="Notifications on this device">
                <input type="checkbox" class="nt-switch" aria-label="Notifications on this device" />
                <span class="switch-track"><span class="switch-thumb"></span></span>
              </label>`
            )}
            <div class="nt-kinds">
              ${[
                ["release", "fa-film", "Movie releases", "A movie on your Watchlist (or one you asked to be reminded of) comes out"],
                ["season", "fa-layer-group", "New seasons", "A show you follow starts a new season"],
                ["episode", "fa-tv", "New episodes", "A new episode of a show on your Watchlist or Favorites"],
                ["recommendation", "fa-wand-magic-sparkles", "Recommendations", "Once a week, a well-known title like one you loved"],
                ["announcement", "fa-bullhorn", "Announcements", "News about the site from its owner"],
                ["breaking", "fa-bolt", "Breaking news", "Only the big stories, as they break (Movie News)"],
                ["trailer", "fa-play", "New trailers", "A trailer for a title on your Watchlist"],
              ]
                .map(([k, icon, name, sub]) =>
                  row(
                    icon,
                    name,
                    sub,
                    `<label class="sv-switch"><input type="checkbox" class="nt-kind" data-kind="${k}" aria-label="${name}" /><span class="switch-track"><span class="switch-thumb"></span></span></label>`
                  )
                )
                .join("")}
            </div>
            <p class="sv-note nt-note"></p>`,
            guest ? " hidden" : ""
          )}

        </div>

        <div class="sv-col">
          ${card("import", "fa-file-import", "Import", '<div class="import-panel"></div>', guest ? " hidden" : "")}

          ${card(
            "backup",
            "fa-floppy-disk",
            "Backup",
            `<p class="sv-note sv-lead">Your library is saved in your account and synced to every device you sign in on. A backup is an extra copy you keep yourself.</p>
            <div class="sv-buttons">
              <button class="btn export-backup" type="button"><i class="fa-solid fa-file-export"></i> Download backup</button>
              <label class="btn"><i class="fa-solid fa-file-import"></i> Restore backup
                <input type="file" accept=".json,application/json" class="import-file" hidden />
              </label>
            </div>
            <div class="sv-danger">
              ${row("fa-trash-can", "Delete my library", "Every title, score, list and tier. There's no undo.", '<button class="btn btn-danger reset-all" type="button">Delete</button>')}
            </div>`,
            guest ? " hidden" : ""
          )}

          ${card(
            "problems",
            "fa-stethoscope",
            "Problems on this device",
            `<p class="sv-note sv-lead">When something doesn't work, the site notes it here (only in this browser), so it can be looked into. Copy the list and send it along.</p>
            <ol class="sv-errors"></ol>
            <div class="sv-buttons sv-errors-buttons">
              <button class="btn copy-errors" type="button"><i class="fa-regular fa-copy"></i> Copy</button>
              <button class="btn clear-errors" type="button"><i class="fa-solid fa-broom"></i> Clear</button>
            </div>`
          )}
        </div>
      </div>
    </div>`;


  const $ = (s) => root.querySelector(s);

  /* ---------------- notifications (js/services/alerts.js) ---------------- */

  function paintNotify() {
    const sw = $(".nt-switch");
    if (!sw || !window.Alerts) return;
    const p = Alerts.prefs();
    const perm = Alerts.permission();
    const offSite = window.Site && (!Site.feature("notifications") || Site.get().notifications.on === false);
    sw.checked = p.on && perm === "granted" && !offSite;
    sw.disabled = perm === "unsupported" || offSite;
    root.querySelectorAll(".nt-kind").forEach((b) => {
      b.checked = p[b.dataset.kind] !== false;
      b.disabled = !sw.checked;
      const siteOff = window.Site && Site.get().notifications[b.dataset.kind] === false;
      b.closest(".sv-row").hidden = !!siteOff;
    });
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const state = $(".nt-state");
    const note = $(".nt-note");
    if (offSite) {
      state.textContent = "Switched off for the site";
      note.textContent = "New releases still show in the bell at the top of the page.";
    } else if (perm === "unsupported") {
      state.textContent = "Not available in this browser";
      note.innerHTML = ios
        ? '<i class="fa-solid fa-circle-info"></i> On iPhone and iPad: add Movie Nights to your Home Screen first (Share → Add to Home Screen), then turn this on in the app. Until then, new releases show in the <b>bell</b> at the top of the page.'
        : '<i class="fa-solid fa-circle-info"></i> This browser can\'t show notifications. New releases still show in the <b>bell</b> at the top of the page.';
    } else if (perm === "denied") {
      state.textContent = "Blocked in this browser";
      note.innerHTML = '<i class="fa-solid fa-circle-info"></i> Notifications are blocked for this site. Allow them in the browser\'s site settings (the icon left of the address), then come back.';
    } else {
      state.textContent = sw.checked ? "On" : "Off";
      note.innerHTML = `<i class="fa-solid fa-circle-info"></i> One notification per release, never twice (also across your devices). ${
        "periodicSync" in ServiceWorkerRegistration.prototype
          ? "In the installed app the phone also checks in the background now and then, so they can arrive while the app is closed."
          : "They arrive when you open the site; in the installed app on Android the phone can also check in the background."
      }`;
    }
  }
  if (!guest && window.Alerts) {
    paintNotify();
    $(".nt-switch").addEventListener("change", async (e) => {
      if (e.target.checked) {
        const r = Alerts.permission() === "granted" ? "granted" : await Alerts.ask();
        if (r === "granted") {
          Alerts.setPrefs({ on: true });
          Alerts.backgroundCheck();
          toast("Notifications on: you'll hear when something comes out");
        } else if (r === "denied") toast("Notifications are blocked: allow them in the browser's site settings");
      } else {
        Alerts.setPrefs({ on: false });
        toast("Notifications off on this device");
      }
      paintNotify();
    });
    root.addEventListener("change", (e) => {
      if (!e.target.classList.contains("nt-kind")) return;
      Alerts.setPrefs({ [e.target.dataset.kind]: e.target.checked });
    });
  }

  /* ---------------- problems on this device (js/core/store.js keeps them) ---------------- */

  const when = (t) => new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  function paintErrors() {
    const list = Store.errors();
    $(".sv-errors").innerHTML = list.length
      ? list
          .map((e) => `<li><b>${esc(e.msg)}</b><small>${esc(when(e.at))} · ${esc(e.page)}${e.where ? ` · ${esc(e.where)}` : ""}</small></li>`)
          .join("")
      : '<li class="sv-errors-none"><i class="fa-solid fa-circle-check"></i> Nothing has gone wrong on this device.</li>';
    $(".sv-errors-buttons").hidden = !list.length;
  }
  paintErrors();
  $(".copy-errors").addEventListener("click", async () => {
    const text = Store.errors()
      .map((e) => `${new Date(e.at).toISOString()} ${e.page}${e.where ? ` (${e.where})` : ""}: ${e.msg}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(`Movie Nights problems (${navigator.userAgent})\n${text}`);
      toast("Copied: paste it in a message");
    } catch (err) {
      toast("Couldn't copy the list");
    }
  });
  $(".clear-errors").addEventListener("click", () => {
    Store.clearErrors();
    paintErrors();
    toast("Cleared");
  });

  /* ---------------- appearance ---------------- */

  function paintTheme() {
    const light = document.documentElement.dataset.theme === "light";
    root.querySelectorAll("[data-theme-pick]").forEach((b) => {
      const on = (b.dataset.themePick === "light") === light;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  }
  paintTheme();
  $(".sv-theme").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-pick]");
    if (!b) return;
    if (b.dataset.themePick === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("mn:theme", b.dataset.themePick);
    } catch (err) {}
    paintTheme();
  });

  // My rating / Match %: a class on <html> (read on every page by js/core/layout.js) and a word
  // in this browser's storage
  const html = document.documentElement;
  const myRating = $(".sv-my-rating");
  if (myRating) {
    myRating.checked = !html.classList.contains("ext-ratings");
    myRating.addEventListener("change", () => {
      html.classList.toggle("ext-ratings", !myRating.checked);
      try {
        if (myRating.checked) localStorage.removeItem("mn:myRatings");
        else localStorage.setItem("mn:myRatings", "off");
      } catch (err) {}
    });
  }
  const match = $(".sv-match");
  // (posters only: the match is just in the hover preview, and stays there: shown on, greyed)
  const postersOnly = html.classList.contains("posters-only");
  match.checked = postersOnly || !html.classList.contains("no-match");
  match.disabled = postersOnly;
  if (postersOnly) match.closest(".sv-row").classList.add("disabled");
  match.addEventListener("change", () => {
    html.classList.toggle("no-match", !match.checked);
    try {
      if (match.checked) localStorage.removeItem("mn:showMatch");
      else localStorage.setItem("mn:showMatch", "off");
    } catch (err) {}
  });

  /* ---------------- backup ---------------- */

  $(".export-backup").addEventListener("click", () => {
    const date = new Date().toISOString().slice(0, 10);
    download(`movie-nights-backup-${date}.json`, Store.exportBackup(), "application/json");
  });

  $(".import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let text;
    let data;
    try {
      text = await file.text();
      data = JSON.parse(text);
      if (data.app !== "movie-nights") throw new Error("This is not a Movie Nights backup file.");
    } catch (err) {
      return toast(`Could not restore: ${err.message.startsWith("This") ? err.message : "the file can't be read"}`);
    }
    // it replaces everything: say what's in it and ask first
    const n = (data.custom || []).length;
    const when = data.exported ? new Date(data.exported).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" }) : "";
    const ok = await UI.confirm({
      icon: "fa-clock-rotate-left",
      title: "Restore this backup?",
      text: `${n} title${n === 1 ? "" : "s"}${when ? `, saved on ${esc(when)}` : ""}. It <strong>replaces</strong> your whole library as it is now (titles, scores, lists and tiers).`,
      ok: "Restore",
      danger: true,
    });
    if (!ok) return;
    try {
      Store.importBackup(text);
      toast("Backup restored");
    } catch (err) {
      toast(`Could not restore: ${err.message}`);
    }
  });

  $(".reset-all").addEventListener("click", async () => {
    const ok = await UI.confirm({
      icon: "fa-trash-can",
      title: "Delete your whole library?",
      text: "Every title, rating, favorite, watchlist entry, list and tier. There's no undo: download a backup first if you might want it back.",
      ok: "Delete everything",
      danger: true,
    });
    if (!ok) return;
    Store.resetAll();
    toast("Your library is empty now");
  });

  /* ---------------- streaming services ---------------- */

  const logo = (p) => (p.logo ? `https://image.tmdb.org/t/p/w92${p.logo}` : "");

  // your country: every country TMDB has streaming data for
  const countrySel = $(".sv-country");
  function paintCountryNote() {
    $(".sv-svc-note").textContent = `Used by "On my services" on the Watchlist, by "What should I watch?" and by "Where to watch" on title pages. Availability in ${TMDB.countryName()}, from JustWatch.`;
  }
  paintCountryNote();
  if (!guest && TMDB.enabled())
    TMDB.regions()
      .then((list) => {
        const now = TMDB.COUNTRY;
        if (!list.some((c) => c.code === now)) list.unshift({ code: now, name: TMDB.countryName(now) });
        countrySel.innerHTML = list.map((c) => `<option value="${esc(c.code)}"${c.code === now ? " selected" : ""}>${esc(c.name)}</option>`).join("");
      })
      .catch(() => {});
  countrySel.addEventListener("change", () => {
    Store.setProfile({ country: countrySel.value });
    catalog = null; // the services list is per country
    const all = $(".svc-all");
    if (!all.hidden) {
      all.hidden = true;
      openServices();
    }
    paintCountryNote();
    toast(`Country: ${TMDB.countryName()}`);
  });

  function renderServices() {
    const mine = Watch.mine();
    $(".svc-mine").innerHTML =
      mine
        .map((s) => `<span class="svc-chip"><img src="${esc(logo(s))}" alt="" />${esc(s.name)}</span>`)
        .join("") +
      `<button class="btn svc-edit" type="button"><i class="fa-solid fa-${mine.length ? "pen" : "plus"}"></i> ${mine.length ? "Change" : "Choose your services"}</button>`;
  }

  let catalog = null;
  async function openServices() {
    const all = $(".svc-all");
    all.hidden = !all.hidden;
    if (all.hidden) return;
    if (!catalog) {
      all.innerHTML = '<p class="help">Loading…</p>';
      try {
        catalog = (await TMDB.providerCatalog()).slice(0, 24);
      } catch (e) {
        all.innerHTML = `<p class="help">Couldn't load the list: ${esc(e.message)}</p>`;
        return;
      }
    }
    const ids = Watch.mine().map((s) => s.id);
    all.innerHTML = `<div class="svc-grid">${catalog
      .map(
        (p) => `<button type="button" class="svc-opt${ids.includes(p.id) ? " on" : ""}" data-svc="${p.id}" aria-pressed="${ids.includes(p.id)}" title="${esc(p.name)}">
          <img src="${esc(logo(p))}" alt="" loading="lazy" /><span>${esc(p.name)}</span></button>`
      )
      .join("")}</div>`;
  }

  if (!guest && window.Watch) {
    renderServices();
    $(".services").addEventListener("click", (e) => {
      if (e.target.closest(".svc-edit")) return openServices();
      const opt = e.target.closest("[data-svc]");
      if (!opt) return;
      const p = catalog.find((c) => c.id === Number(opt.dataset.svc));
      const mine = Watch.mine();
      const on = !mine.some((s) => s.id === p.id);
      Watch.setMine(on ? mine.concat({ id: p.id, name: p.name, logo: p.logo }) : mine.filter((s) => s.id !== p.id));
      opt.classList.toggle("on", on);
      opt.setAttribute("aria-pressed", on);
      renderServices();
    });
  }

  /* ---------------- import (js/components/import.js) ---------------- */

  if (!guest && window.Importer) Importer.mount($("#import .import-panel"));

  // settings.html#import, #services…: straight to that part
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 100);
  }
})();
