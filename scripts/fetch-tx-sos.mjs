// Pulls Texas Secretary of State election-night results (statewide + every county) and writes data/tx-live.json.
// Reads the new Civix ENR API behind goelect.txelections.civixapps.com (falls back to results.texas-election.com). No keys. Run by .github/workflows/tx-results.yml.
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

const CV = "https://goelect.txelections.civixapps.com/api-ivis-system/api/s3/enr";
const counties = JSON.parse(fs.readFileSync("data/tx-counties.json", "utf8")).counties;
const nameKey = s => (s || "").toUpperCase().replace(/[^A-Z]/g, "");
const fipsByName = Object.fromEntries(Object.entries(counties).map(([f, c]) => [nameKey(c.n), f]));
const b64json = x => JSON.parse(Buffer.from(x, "base64").toString("utf8"));

// New SOS system (Civix ENR, Nov 2026 onward): base64-wrapped JSON
async function loadCivix() {
  let id = process.env.ELECTION_ID, name = "override";
  if (!id) {
    const ec = b64json((await J(CV + "/electionConstants")).upload);
    const y = (ec.electionInfo || ec.ElectionInfo || ec)["2026"] || ec.Y2026 || {};
    const find = o => { for (const [k, v] of Object.entries(o || {})) { if (v && v.ID && /NOVEMBER/i.test(v.N || "") && /^G/.test(v.ET || "")) return v; if (v && typeof v === "object" && !v.ID) { const f = find(v); if (f) return f; } } return null; };
    const e = find(y) || find(ec); if (!e) return null; id = e.ID; name = e.N;
  }
  const raw = await J(`${CV}/election/${id}`);
  const d = {}; for (const [k, v] of Object.entries(raw)) d[k] = k === "Version" ? v : (() => { try { return b64json(v); } catch { return null; } })();
  const cr = await J(`${CV}/election/countyInfo/${id}`);
  const ci = cr.upload ? b64json(cr.upload) : cr;
  const county = {};
  for (const [n, c] of Object.entries(ci)) {
    const f = fipsByName[nameKey(c.N)] || "48" + String(2 * +n - 1).padStart(3, "0");
    county[f] = { Races: Object.fromEntries(Object.entries(c.Races || {}).map(([k, r]) => [k, { ON: r.N, C: r.C }])) };
  }
  return { el: { ID: id, N: name }, ver: raw.Version, home: d.Home || {}, county, sw: d.StateWide, fed: d.Federal, src: "civix" };
}
// Old SOS system (results.texas-election.com) — fallback
async function loadOld() {
  let el = process.env.ELECTION_ID ? { ID: process.env.ELECTION_ID, N: "override" } : null;
  if (!el) {
    const v = await J(B + "/Version.json"); const ec = await J(B + "/ElectionConstants_" + v.___versionNo + ".json");
    const cur = ec.currentelectionInfo; if (cur && cur.Y === "2026" && cur.ET === "G") el = cur;
    const y = ec.electionInfo && ec.electionInfo["2026"];
    if (!el && y) for (const type of Object.keys(y)) for (const [id, e] of Object.entries(y[type] || {})) if (!el && (e.ET === "G" || type === "G") && /NOVEMBER/i.test(e.N || "")) el = { ...e, ID: e.ID || id };
  }
  if (!el) return null;
  const base = `${B}/election/${el.ID}`; const ver = (await J(base + "/Version.json")).___versionNo; const vu = `${base}/${ver}`;
  const [home, county, sw, fed] = await Promise.all([J(vu + "/Home.json"), J(vu + "/County.json"), J(vu + "/StateWide.json").catch(() => null), J(vu + "/Federal.json").catch(() => null)]);
  return { el, ver, home, county, sw, fed, src: "legacy" };
}
let L = null;
if (process.env.SOS !== "legacy") try { L = await loadCivix(); } catch (e) { console.log("civix failed:", e.message); }
if (!L && process.env.SOS !== "civix") try { L = await loadOld(); } catch (e) { console.log("legacy failed:", e.message); }
if (!L) { console.log("2026 general election not available from the SOS yet"); process.exit(0); }
const { el, home, county, sw, fed } = L; const ver = { ___versionNo: L.ver };

const out = { source: "Texas Secretary of State (unofficial)", electionId: el.ID, electionName: el.N, version: ver.___versionNo, system: L.src,
  sosUpdated: home.LastUpdatedTime || null, fetchedAt: Date.now(),
  countiesReporting: home.CountiesReporting || null, precincts: home.PrecinctsReporting || null, polling: home.PollingReporting || null, races: {} };
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

// "Unofficial final": every precinct in, and a margin of at least 1 point
const pr = home.PollingReporting && home.PollingReporting.PLT ? { PR: home.PollingReporting.PLR, PT: home.PollingReporting.PLT } : (home.PrecinctsReporting || {});
const cr = home.CountiesReporting || {};
const allIn = (pr.PT && pr.PR >= pr.PT) || (cr.CT && cr.CR >= cr.CT);
for (const o of Object.values(out.races)) { const s = o.statewide; const two = s.v[0] + s.v[1]; o.final = !!(allIn && two > 0 && Math.abs(s.v[0] - s.v[1]) / two >= 0.01); }
// Use the SOS clock as updatedAt (Central time); fall back to fetch time.
let t = Date.parse((home.LastUpdatedTime || "") + " GMT-0600"); if (isNaN(t)) t = Date.now();
out.updatedAt = t;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;
const changed = !prev || JSON.stringify(prev.races) !== JSON.stringify(out.races) || prev.sosUpdated !== out.sosUpdated;
if (changed) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log("wrote", OUT, el.ID, "v" + ver.___versionNo, Object.keys(out.races).join(","), home.LastUpdatedTime); }
else console.log("no change", home.LastUpdatedTime);
