// Pulls Texas Secretary of State election-night results (statewide + every county) and writes data/tx-live.json.
// Public JSON behind results.texas-election.com. No keys. Run by .github/workflows/tx-results.yml.
//   ELECTION_ID=49664 OUT=data/tx-live-test.json node scripts/fetch-tx-sos.mjs   (test against a past election)
import fs from "node:fs";
const B = "https://results.texas-election.com/static/data";
const UA = { "user-agent": "Mozilla/5.0 (HilltopElectionDesk results reader)", accept: "application/json" };
const OUT = process.env.OUT || "data/tx-live.json";
const races = JSON.parse(fs.readFileSync("data/races.json", "utf8"));

async function J(u) { const r = await fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Date.now(), { headers: UA }); if (!r.ok) throw new Error(r.status + " " + u); return r.json(); }

// SOS office name -> our race id
function raceIdFor(name) {
  const n = name.toUpperCase().replace(/\s+/g, " ").trim();
  if (/^U\.? ?S\.? SENATOR/.test(n)) return "sen-tx";
  if (/^GOVERNOR$/.test(n)) return "tx-gov";
  if (/^LIEUTENANT GOVERNOR/.test(n)) return "tx-ltgov";
  if (/^ATTORNEY GENERAL/.test(n)) return "tx-ag";
  if (/^COMPTROLLER/.test(n)) return "tx-comp";
  if (/LAND OFFICE|LAND COMMISSIONER/.test(n)) return "tx-land";
  if (/AGRICULTURE/.test(n)) return "tx-agri";
  if (/^RAILROAD COMMISSIONER/.test(n) && !/UNEXPIRED/.test(n)) return "tx-rrc";
  const m = n.match(/^U\.? ?S\.? REPRESENTATIVE DISTRICT (\d+)/);
  if (m) { const id = "tx-" + String(m[1]).padStart(2, "0"); return races.some(r => r.id === id) ? id : null; }
  return null;
}
const partyOf = p => { p = (p || "").toUpperCase(); return p.startsWith("DEM") || p === "D" ? "D" : p.startsWith("REP") || p === "R" ? "R" : "O"; };
const lastName = s => s.toUpperCase().replace(/\(I\)/g, "").replace(/[^A-Z' -]/g, " ").trim().split(/\s+/).filter(w => !/^(JR|SR|II|III)$/.test(w)).pop() || "";
// returns index into our cands (0 = D, 1 = R), or 2 for anyone else
function slot(race, cand) {
  const pt = partyOf(cand.P), ln = lastName(cand.N);
  const byName = race.cands.findIndex(c => lastName(c.n) === ln);
  if (byName === 0 || byName === 1) return byName;
  const byParty = race.cands.findIndex(c => c.p === pt);
  return byParty === 0 || byParty === 1 ? byParty : 2;
}

async function findElection() {
  if (process.env.ELECTION_ID) return { ID: process.env.ELECTION_ID, N: "override" };
  const v = await J(B + "/Version.json");
  const ec = await J(B + "/ElectionConstants_" + v.___versionNo + ".json");
  const cur = ec.currentelectionInfo;
  if (cur && cur.Y === "2026" && cur.ET === "G") return cur;
  const y = ec.electionInfo && ec.electionInfo["2026"];
  if (y) for (const type of Object.keys(y)) for (const [id, e] of Object.entries(y[type] || {})) {
    if ((e.ET === "G" || type === "G") && /NOVEMBER/i.test(e.N || "")) return { ...e, ID: e.ID || id };
  }
  return null;
}

const el = await findElection();
if (!el) { console.log("2026 general election not published on the SOS site yet"); process.exit(0); }
const base = `${B}/election/${el.ID}`;
const ver = await J(base + "/Version.json");
const vu = `${base}/${ver.___versionNo}`;
const [home, county, sw, fed] = await Promise.all([J(vu + "/Home.json"), J(vu + "/County.json"), J(vu + "/StateWide.json").catch(() => null), J(vu + "/Federal.json").catch(() => null)]);

const out = { source: "Texas Secretary of State (unofficial)", electionId: el.ID, electionName: el.N, version: ver.___versionNo,
  sosUpdated: home.LastUpdatedTime || null, fetchedAt: Date.now(),
  countiesReporting: home.CountiesReporting || null, precincts: home.PrecinctsReporting || null, races: {} };
const blank = () => ({ v: [0, 0, 0], ev: [0, 0, 0], ed: [0, 0, 0] });

// statewide
for (const file of [fed, sw]) for (const r of (file && file.Races) || []) {
  const id = raceIdFor(r.N); if (!id) continue; const race = races.find(x => x.id === id); if (!race) continue;
  const s = blank();
  for (const c of r.Candidates || []) { const i = slot(race, c); s.v[i] += c.V || 0; s.ev[i] += c.EV || 0; s.ed[i] += Math.max(0, (c.V || 0) - (c.EV || 0)); }
  out.races[id] = { sosName: r.N.trim(), statewide: s, counties: {} };
}
// counties
for (const [fips, c] of Object.entries(county)) {
  if (!/^48\d{3}$/.test(fips)) continue;
  for (const r of Object.values(c.Races || {})) {
    const id = raceIdFor(r.ON || ""); if (!id) continue; const race = races.find(x => x.id === id); if (!race) continue;
    const o = out.races[id] || (out.races[id] = { sosName: (r.ON || "").trim(), statewide: null, counties: {} });
    const s = blank();
    for (const cand of Object.values(r.C || {})) { const i = slot(race, cand); s.v[i] += cand.V || 0; s.ev[i] += cand.EV || 0; s.ed[i] += Math.max(0, (cand.V || 0) - (cand.EV || 0)); }
    if (s.v.some(x => x)) o.counties[fips] = s;
  }
}
// fill statewide from counties if the statewide file lacked the race
for (const o of Object.values(out.races)) if (!o.statewide) { const s = blank(); for (const c of Object.values(o.counties)) for (const k of ["v", "ev", "ed"]) c[k].forEach((x, i) => s[k][i] += x); o.statewide = s; }

// Use the SOS clock as updatedAt (Central time); fall back to fetch time.
let t = Date.parse((home.LastUpdatedTime || "") + " GMT-0600"); if (isNaN(t)) t = Date.now();
out.updatedAt = t;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;
const changed = !prev || JSON.stringify(prev.races) !== JSON.stringify(out.races) || prev.sosUpdated !== out.sosUpdated;
if (changed) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log("wrote", OUT, el.ID, "v" + ver.___versionNo, Object.keys(out.races).join(","), home.LastUpdatedTime); }
else console.log("no change", home.LastUpdatedTime);
