/*
 * Api: one way to ask every outside service (TMDB has its own, js/services/tmdb.js).
 *
 *   Api.get("tvmaze", url, { hours: 12 })  -> Promise of the answer (JSON)
 *   (opts.first: ahead of what's waiting, for the next step of something already under way)
 *
 * For every service:
 *  - answers kept in the browser's database (IndexedDB "mn-api"), for as long as the service's
 *    setting says (Admin → API integrations), so the same thing is never asked for twice;
 *  - the same question asked twice at once goes out once;
 *  - a queue per service that keeps to its limits (TVmaze: 20 per 10 s, AniList: 90 a minute…),
 *    and waits and tries again when told "too many" (429);
 *  - no endless waiting: after 12 s it gives up with a clear message;
 *  - when a service is down, the last answer it gave (even an old one) is used instead;
 *  - a service switched off in the Admin Control Center isn't asked at all;
 *  - how each one is doing (answers, failures, the last error) for Admin → API status.
 * Pages never call fetch() for these services themselves: tvmaze.js, anime.js, books.js,
 * news.js and the soundtrack (js/components/soundtrack.js) do it through here.
 */
(function () {
  // gap: the least time between two requests (ms); burst: requests let out at once
  const PROVIDERS = {
    tvmaze: { label: "TVmaze", gap: 520, burst: 2, site: "https://www.tvmaze.com/api" },
    anilist: { label: "AniList", gap: 750, burst: 1, site: "https://anilist.co" },
    googlebooks: { label: "Google Books", gap: 300, burst: 2, site: "https://developers.google.com/books" },
    news: { label: "News feeds (rss2json)", gap: 600, burst: 2, site: "https://rss2json.com" },
    itunes: { label: "Apple Music (iTunes)", gap: 150, burst: 3, site: "https://performance-partners.apple.com/search-api" },
  };
  const TIMEOUT = 12000;
  const LIMIT = 1500; // answers kept
  const STATS = "mn:apiStats";

  /* ---------------- the browser's database ---------------- */

  const mem = new Map();
  let dbp = null;
  function db() {
    if (!dbp)
      dbp = new Promise((resolve) => {
        try {
          const req = indexedDB.open("mn-api", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("c", { keyPath: "k" }).createIndex("at", "at");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    return dbp;
  }
  async function cacheGet(k) {
    if (mem.has(k)) return mem.get(k);
    const d = await db();
    if (!d) return null;
    return new Promise((resolve) => {
      try {
        const r = d.transaction("c").objectStore("c").get(k);
        r.onsuccess = () => {
          const v = r.result ? { at: r.result.at, v: r.result.v } : null;
          if (v) mem.set(k, v);
          resolve(v);
        };
        r.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  let writes = 0;
  async function cacheSet(k, v) {
    const rec = { at: Date.now(), v };
    mem.set(k, rec);
    const d = await db();
    if (!d) return;
    try {
      d.transaction("c", "readwrite").objectStore("c").put({ k, at: rec.at, v });
    } catch (e) {}
    if (++writes % 30 === 1) trim(d);
  }
  function trim(d) {
    try {
      const store = d.transaction("c", "readwrite").objectStore("c");
      const count = store.count();
      count.onsuccess = () => {
        let extra = count.result - LIMIT;
        if (extra <= 0) return;
        store.index("at").openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (!cur || extra-- <= 0) return;
          cur.delete();
          cur.continue();
        };
      };
    } catch (e) {}
  }
  // Admin → API integrations → Clear: forget one service's answers (or all of them)
  async function clear(provider) {
    [...mem.keys()].forEach((k) => (!provider || k.startsWith(`${provider}|`)) && mem.delete(k));
    const d = await db();
    if (!d) return;
    return new Promise((resolve) => {
      try {
        const store = d.transaction("c", "readwrite").objectStore("c");
        if (!provider) {
          store.clear().onsuccess = () => resolve();
          return;
        }
        store.openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (!cur) return resolve();
          if (String(cur.key).startsWith(`${provider}|`)) cur.delete();
          cur.continue();
        };
      } catch (e) {
        resolve();
      }
    });
  }

  /* ---------------- how each service is doing ---------------- */

  const stats = Store.read(STATS, {});
  const statListeners = [];
  let statTimer;
  function note(provider, ok, err) {
    const s = stats[provider] || (stats[provider] = { ok: 0, fail: 0, cached: 0 });
    if (ok === "cached") s.cached++;
    else if (ok) {
      s.ok++;
      s.lastOk = Date.now();
    } else {
      s.fail++;
      s.lastFail = Date.now();
      s.lastError = String((err && err.message) || err || "Failed").slice(0, 160);
    }
    clearTimeout(statTimer);
    statTimer = setTimeout(() => Store.write(STATS, stats), 800);
    statListeners.forEach((fn) => fn(provider, s));
  }
  // { provider: { ok, fail, cached, lastOk, lastFail, lastError, health: "ok" | "down" | "off" | "unknown" } }
  function status() {
    const out = {};
    Object.keys(PROVIDERS).forEach((p) => {
      const s = Object.assign({ ok: 0, fail: 0, cached: 0 }, stats[p] || {});
      s.health = !enabled(p) ? "off" : s.lastFail && (!s.lastOk || s.lastFail > s.lastOk) ? "down" : s.lastOk ? "ok" : "unknown";
      s.label = PROVIDERS[p].label;
      s.site = PROVIDERS[p].site;
      out[p] = s;
    });
    return out;
  }
  function resetStats() {
    Object.keys(stats).forEach((k) => delete stats[k]);
    Store.write(STATS, stats);
  }

  /* ---------------- on / off (Admin → API integrations) ---------------- */

  function enabled(provider) {
    if (!window.Site) return true;
    return Site.api(provider).on !== false;
  }

  /* ---------------- a queue per service ---------------- */

  const queues = {};
  // (first: to the front of the queue, e.g. the rest of something already started)
  function slot(provider, first) {
    const p = PROVIDERS[provider] || { gap: 300, burst: 2 };
    const q = queues[provider] || (queues[provider] = { next: 0, active: 0, waiting: [], pausedUntil: 0 });
    return new Promise((resolve) => {
      if (first) q.waiting.unshift(resolve);
      else q.waiting.push(resolve);
      pump(provider, q, p);
    });
  }
  function pump(provider, q, p) {
    if (!q.waiting.length || q.active >= p.burst || q.timer) return;
    const wait = Math.max(q.next, q.pausedUntil) - Date.now();
    if (wait > 0) {
      q.timer = setTimeout(() => {
        q.timer = null;
        pump(provider, q, p);
      }, wait);
      return;
    }
    q.active++;
    q.next = Date.now() + p.gap;
    const go = q.waiting.shift();
    go(() => {
      q.active--;
      pump(provider, q, p);
    });
    pump(provider, q, p);
  }
  // told "too many requests": the whole service waits a while
  function pause(provider, ms) {
    const q = queues[provider];
    if (q) q.pausedUntil = Math.max(q.pausedUntil, Date.now() + ms);
  }

  /* ---------------- asking ---------------- */

  const pending = new Map();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // opts: { hours | minutes | days (how long the answer stays good), key (cache key, default the
  //         url), init (fetch options: POST body…), parse ("json" | "text"), fresh (skip the copy) }
  async function get(provider, url, opts = {}) {
    if (!enabled(provider)) throw Object.assign(new Error(`${(PROVIDERS[provider] || {}).label || provider} is switched off`), { off: true });
    const ttl = (opts.days || 0) * 86400000 + (opts.hours || 0) * 3600000 + (opts.minutes || 0) * 60000 || 3600000;
    const k = `${provider}|${opts.key || url}`;
    const saved = opts.fresh ? null : await cacheGet(k);
    if (saved && Date.now() - saved.at < ttl) {
      note(provider, "cached");
      return saved.v;
    }
    if (pending.has(k)) return pending.get(k);
    const job = (async () => {
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        const done = await slot(provider, opts.first);
        const stop = new AbortController();
        const timer = setTimeout(() => stop.abort(), (PROVIDERS[provider] || {}).timeout || TIMEOUT);
        try {
          const res = await fetch(url, Object.assign({ signal: stop.signal }, opts.init || {}));
          if (res.status === 429 || res.status === 503) {
            const after = Number(res.headers.get("retry-after")) || 0;
            const ms = Math.min(after ? after * 1000 : 1500 * (attempt + 1), 10000);
            pause(provider, ms);
            lastErr = new Error(`${PROVIDERS[provider] ? PROVIDERS[provider].label : provider} is busy (too many requests)`);
            await sleep(ms);
            continue;
          }
          if (res.status === 404) {
            note(provider, true);
            cacheSet(k, null);
            return null; // nothing there: a real answer, kept like any other
          }
          if (!res.ok) throw new Error(`${PROVIDERS[provider] ? PROVIDERS[provider].label : provider} answered ${res.status}`);
          const v = opts.parse === "text" ? await res.text() : await res.json();
          note(provider, true);
          cacheSet(k, v);
          return v;
        } catch (err) {
          lastErr = err.name === "AbortError" ? new Error(`${PROVIDERS[provider] ? PROVIDERS[provider].label : provider} is taking too long to answer`) : err;
          if (err.name === "AbortError" || navigator.onLine === false) break; // (offline: no point trying again now)
          // online but no answer at all: a service that's had too much (AniList then answers
          // without the headers browsers need, so it looks like a network error): once more, later
          if (err instanceof TypeError) {
            if (attempt >= 1) break;
            pause(provider, 8000);
            await sleep(8000);
            continue;
          }
        } finally {
          clearTimeout(timer);
          done();
        }
      }
      note(provider, false, lastErr);
      // the service is down: an older answer is better than nothing
      if (saved) return saved.v;
      throw lastErr || new Error("Failed");
    })();
    pending.set(k, job);
    job.finally(() => pending.delete(k)).catch(() => {});
    return job;
  }

  window.Api = { PROVIDERS, get, clear, status, resetStats, enabled, onStatus: (fn) => statListeners.push(fn), cacheGet, cacheSet };
})();
