// Reads AP results as published in the New York Times election data files (Senate, governor, House)
// and writes data/national-live.json. Run every 60 s by .github/workflows/tx-results.yml.
//   DATE=2024-11-05 OUT=data/national-test.json node scripts/fetch-national.mjs   (test on a past election)
import fs from "node:fs";
const DATE = process.env.DATE || "2026-11-03";
const OUT = process.env.OUT || "data/national-live.json";
const B = `https://static01.nyt.com/elections-assets/pages/data/${DATE}/`;
const UA = { "user-agent": "Mozilla/5.0 (HilltopElectionDesk results reader)", accept: "application/json" };
const races = JSON.parse(fs.readFileSync("data/races.json", "utf8"));
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { races: {} };

async function J(f) { const r = await fetch(B + f + "?t=" + Date.now(), { headers: UA }); if (!r.ok) throw new Error(r.status + " " + f); return r.json(); }
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
const lastName = n => n.split(" ").filter(w => !/^(III|II|Jr\.?|Sr\.?)$/.test(w)).pop();
const partyOf = m => { const p = (m && m.party && (m.party.nyt_id || m.party.abbreviation)) || ""; return /DEM/i.test(p) ? "D" : /GOP|REP/i.test(p) ? "R" : "O"; };

// our race id -> NYT race (by office + state + district)
function keyFor(r) {
  if (r.id.startsWith("sen-")) return { o: "S", st: r.id === "sen-tx" ? "TX" : r.id.slice(4).toUpperCase() };
  if (r.id.startsWith("gov-")) return { o: "G", st: r.id.slice(4).toUpperCase() };
  if (r.id === "tx-gov") return { o: "G", st: "TX" };
  const h = r.id.match(/^h-([a-z]{2})-(\w+)$/); if (h) return { o: "H", st: h[1].toUpperCase(), d: h[2] === "al" ? 1 : +h[2] };
  const t = r.id.match(/^tx-(\d\d)$/); if (t) return { o: "H", st: "TX", d: +t[1] };
  return null;
}
function nytKey(x) { // from nyt_id like "NC-G-H-1-2026-11-03", "OH-S_W-S-2026-11-03"
  const p = x.nyt_id.split("-"); const st = p[0]; const o = x.office_id || p[2];
  const d = o === "H" ? +(p[3] || 0) : null; return { st, o, d };
}

const files = { S: "results-senate.json", G: "results-governor.json", H: "results-house.json" };
const data = {}; for (const [o, f] of Object.entries(files)) { try { data[o] = await J(f); } catch (e) { console.log("miss", f, e.message); } }
// Texas state page (has the down-ballot statewide offices); appears on election day
let txState = null; try { txState = await J("results-texas.json"); } catch (e) { console.log("no Texas state file yet"); }
const TXOFF = [["tx-ltgov", /^lieutenant governor/i], ["tx-ag", /^attorney general/i], ["tx-comp", /^comptroller/i], ["tx-land", /land/i], ["tx-agri", /agricultur/i], ["tx-rrc", /^railroad/i]];

const out = { source: "Associated Press via The New York Times", fetchedAt: Date.now(), date: DATE, races: {}, house: null, senateCalledStates: {}, control: {} };
const index = {};
for (const [o, d] of Object.entries(data)) for (const x of (d && d.races) || []) { const k = nytKey(x); if (k.st === "US") continue; index[`${o}|${k.st}|${k.d ?? ""}`] = x; }

function stateRU(x) { const ru = x.reporting_units || []; return ru.find(u => u.level === "state" || u.level === "district") || ru[0]; }
function summarize(race, x) {
  const ru = stateRU(x); if (!ru) return null; const meta = x.candidate_metadata || {};
  const v = race.cands.map(() => 0); let other = 0;
  for (const c of ru.candidates || []) {
    const m = meta[c.nyt_id] || {}; const ln = norm(m.last_name || c.nyt_id.split("-")[0]); const pt = partyOf(m);
    let i = race.cands.findIndex(rc => norm(lastName(rc.n)) === ln);
    if (i < 0) i = race.cands.findIndex(rc => rc.p === pt && pt !== "O");
    const n = (c.votes && c.votes.total) || 0; if (i >= 0) v[i] += n; else other += n;
  }
  let called = null; const won = (x.outcome && x.outcome.won) || [];
  if (won.length) { const m = meta[won[0]] || {}; const ln = norm(m.last_name || won[0].split("-")[0]); let i = race.cands.findIndex(rc => norm(lastName(rc.n)) === ln); if (i < 0) i = race.cands.findIndex(rc => rc.p === partyOf(m)); called = i >= 0 ? i : null; }
  const eevp = typeof ru.eevp === "number" ? ru.eevp : null;
  return { v, other, r: eevp == null ? null : Math.min(1, eevp / 100), called, calledBy: (x.outcome && x.outcome.called_by) || [], expected: ru.total_expected_vote || null, total: ru.total_votes || 0, updated: ru.provider_updated_at || x.updated_at || null };
}
for (const race of races) {
  const k = keyFor(race); if (!k) continue; const x = index[`${k.o}|${k.st}|${k.d ?? ""}`]; if (!x) continue;
  const s = summarize(race, x); if (!s) continue;
  const p = prev.races && prev.races[race.id]; const hist = (p && p.snaps) || [];
  const tot = s.v.reduce((a, b) => a + b, 0);
  const lastSnap = hist[hist.length - 1];
  if (tot > 0 && (!lastSnap || lastSnap.v.join() !== s.v.join() || lastSnap.called !== s.called)) hist.push({ t: Date.now(), v: s.v, r: s.r, called: s.called });
  out.races[race.id] = { ...s, snaps: hist.slice(-400) };
}
if (txState) for (const x of txState.races || []) {
  const hit = TXOFF.find(([, re]) => re.test(x.office || "")); if (!hit || /unexpired/i.test(JSON.stringify(x.seat_description || ""))) continue;
  const race = races.find(r => r.id === hit[0]); if (!race) continue; const s = summarize(race, x); if (!s) continue;
  const p = prev.races && prev.races[race.id]; out.races[race.id] = { ...s, snaps: (p && p.snaps) || [] };
}
// House seats called nationwide + safe Senate states called
if (data.H) { let D = 0, R = 0; for (const x of data.H.races) { const w = x.outcome && x.outcome.won && x.outcome.won[0]; if (!w) continue; const p = partyOf((x.candidate_metadata || {})[w]); if (p === "D") D++; else if (p === "R") R++; } out.house = { cD: D, cR: R }; }
if (data.S) for (const x of data.S.races) { const w = x.outcome && x.outcome.won && x.outcome.won[0]; if (!w) continue; const p = partyOf((x.candidate_metadata || {})[w]); if (p !== "O") out.senateCalledStates[nytKey(x).st] = p; }
for (const [o, d] of Object.entries(data)) if (d && d.partyControlData) out.control[o] = d.partyControlData;

const sig = o => JSON.stringify([o.races && Object.fromEntries(Object.entries(o.races).map(([k, v]) => [k, [v.v, v.r, v.called]])), o.house, o.senateCalledStates]);
if (sig(out) !== sig(prev)) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log("wrote", OUT, Object.keys(out.races).length, "races", JSON.stringify(out.house)); }
else console.log("no change");
