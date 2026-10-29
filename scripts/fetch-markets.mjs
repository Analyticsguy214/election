// Pulls Kalshi + Polymarket odds for every tracked race and writes data/markets.json.
// Runs in GitHub Actions every 5 minutes. Read-only public endpoints; no API keys.
import fs from "node:fs";
const MAP = JSON.parse(fs.readFileSync("scripts/market-map.json", "utf8"));
const OUT = "data/markets.json";
const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const POLY = "https://gamma-api.polymarket.com";
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const ERR = [];
const log = (...a) => { console.log(...a); if (/miss/.test(a[0]) && ERR.length < 40) ERR.push(a.join(" ")); };

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "hilltop-election-desk" } });
  if (!r.ok) throw new Error(r.status + " " + url);
  return r.json();
}
const num = (v) => (v == null || v === "" ? null : Number(v));
// Kalshi price in 0..1 from a market object (handles cents and *_dollars fields).
function kPrice(m) {
  const d = (k) => num(m[k + "_dollars"]);
  const c = (k) => (num(m[k]) == null ? null : num(m[k]) / 100);
  const bid = d("yes_bid") ?? c("yes_bid"), ask = d("yes_ask") ?? c("yes_ask"), last = d("last_price") ?? c("last_price");
  if (bid != null && ask != null && ask > 0 && ask - bid <= 0.1) return (bid + ask) / 2;
  return last ?? bid ?? ask;
}
const partyOf = (s) => {
  s = (s || "").toLowerCase();
  if (/\bdem|democrat/.test(s) || /-d$/.test(s)) return "D";
  if (/\brep|republican|gop/.test(s) || /-r$/.test(s)) return "R";
  if (/independent|\bind\b/.test(s) || /-i$/.test(s)) return "I";
  return null;
};
const lastName = (n) => n.split(" ").filter((w) => !/^(III|II|Jr\.?)$/.test(w)).slice(-1)[0].toLowerCase();

// Returns {D,R,I,...cand last names} probabilities or null.
async function kalshi(tickers, cands) {
  for (const t of tickers || []) {
    try {
      let markets = [];
      try {
        const j = await getJSON(`${KALSHI}/events/${encodeURIComponent(t)}?with_nested_markets=true`);
        markets = j.markets || (j.event && j.event.markets) || [];
      } catch (e) { log("kalshi miss events", t, e.message); }
      if (!markets.length) {
        const j2 = await getJSON(`${KALSHI}/markets?event_ticker=${encodeURIComponent(t)}&limit=50`);
        markets = j2.markets || [];
      }
      const out = {};
      for (const m of markets) {
        const p = kPrice(m); if (p == null) continue;
        const label = [m.ticker, m.yes_sub_title, m.subtitle, m.title].join(" ");
        const party = partyOf(m.yes_sub_title || "") || partyOf(m.ticker);
        if (party) out[party] = p;
        for (const c of cands || []) if (label.toLowerCase().includes(lastName(c.n))) out[c.p] = p;
      }
      if (Object.keys(out).length) { out.src = t; return out; }
    } catch (e) { log("kalshi miss", t, e.message); }
  }
  return null;
}
async function poly(queries, cands, isControl) {
  for (const q of queries || []) {
    try {
      const j = await getJSON(`${POLY}/public-search?q=${encodeURIComponent(q)}&limit_per_type=8&events_status=active`);
      const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      const evs = (j.events || []).filter((e) => !e.closed)
        .map((e) => ({ e, score: words.filter((w) => (e.title || "").toLowerCase().includes(w)).length }))
        .sort((a, b) => b.score - a.score);
      for (const { e, score } of evs) {
        if (score < Math.min(2, words.length)) continue;
        if (!/2026/.test(e.title + e.slug) && !isControl) { /* keep but prefer 2026 */ }
        const out = {};
        for (const m of e.markets || []) {
          if (m.closed) continue;
          let prices; try { prices = JSON.parse(m.outcomePrices || "[]").map(Number); } catch { continue; }
          const yes = prices[0]; if (yes == null || isNaN(yes)) continue;
          const label = (m.groupItemTitle || m.question || "");
          const party = partyOf(label);
          if (party) out[party] = yes;
          for (const c of cands || []) if (label.toLowerCase().includes(lastName(c.n))) out[c.p] = yes;
        }
        if (Object.keys(out).length) { out.src = e.slug; return out; }
      }
    } catch (e) { log("poly miss", q, e.message); }
  }
  return null;
}

const now = Date.now();
const control = {};
for (const k of ["senate", "house"]) {
  const c = MAP.control[k];
  control[k] = {
    kalshi: (await kalshi(c.kalshi, [])) || prev.control?.[k]?.kalshi || null,
    polymarket: (await poly(c.poly, [], true)) || prev.control?.[k]?.polymarket || null,
  };
}
const races = {};
for (const [id, r] of Object.entries(MAP.races)) {
  const k = await kalshi(r.kalshi, r.cands);
  const p = await poly(r.poly, r.cands, false);
  races[id] = { kalshi: k || prev.races?.[id]?.kalshi || null, polymarket: p || prev.races?.[id]?.polymarket || null };
  log(id, "kalshi", k ? k.src : "-", "poly", p ? p.src : "-");
}
const history = (prev.history || []).concat([{ t: now,
  sk: control.senate.kalshi?.D ?? null, sp: control.senate.polymarket?.D ?? null,
  hk: control.house.kalshi?.D ?? null, hp: control.house.polymarket?.D ?? null }]).slice(-2000);
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: now, control, races, history, errors: ERR }, null, 1));
log("wrote", OUT);
