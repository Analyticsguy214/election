// Reads VoteHub's public Bluesky posts ("Texas Early Vote Tracking ...") and returns
// the newest modeled vote per race. VoteHub's own site is behind a bot check, so we
// only use what they publish openly.
const FEED = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=votehub.com&limit=100&filter=posts_no_replies";
const RACES = [
  { id: "sen-tx", match: /Talarico|Paxton/i },
  { id: "tx-gov", match: /Hinojosa|Abbott/i },
];
const num = (s) => Number(String(s).replace(/,/g, ""));
export async function fetchVoteHub() {
  const r = await fetch(FEED, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("bsky " + r.status);
  const j = await r.json();
  const out = {};
  for (const item of j.feed || []) {
    const p = item.post; const t = p?.record?.text || "";
    if (!/Texas Early Vote/i.test(t)) continue;
    const created = Date.parse(p.record.createdAt || p.indexedAt || 0) || 0;
    const ranges = [...t.matchAll(/(?:🔵|🔴|🟣|⚪)?\s*([A-Z][A-Za-z.'\- ]+?):\s*([\d.]+)%\s*[-–]\s*([\d.]+)%/g)]
      .map((m) => ({ name: m[1].trim(), lo: num(m[2]), hi: num(m[3]) }));
    if (ranges.length < 2) continue;
    const asOf = (t.match(/As of ([A-Z][a-z]{2,8}\.? \d{1,2})/) || [])[1] || null;
    const day = (t.match(/Day (\d+)/i) || [])[1] || null;
    const total = (t.match(/Total votes:\s*([\d,]+)/i) || [])[1];
    const pctProj = (t.match(/([\d.]+)% of projected final turnout/i) || [])[1];
    const rating = (t.match(/rates the race as ((?:Safe|Likely|Lean|Tilt) [DR]|Toss-?up)/i) || [])[1] || null;
    const rkey = (p.uri || "").split("/").pop();
    for (const race of RACES) {
      if (!race.match.test(t)) continue;
      if (out[race.id] && out[race.id].t >= created) continue;
      out[race.id] = {
        src: "VoteHub", by: "Zachary Donnini / VoteHub", t: created,
        asOf: asOf ? asOf.replace(/^(\w{3})\w*\.?/, "$1.") : null,
        basis: "Modeled early vote" + (day ? ", day " + day : ""),
        ranges, rating,
        total: total ? num(total) : null,
        turnout: total && pctProj ? Math.round(num(total) / (num(pctProj) / 100)) : null,
        url: "https://bsky.app/profile/votehub.com/post/" + rkey,
      };
    }
  }
  return out;
}
