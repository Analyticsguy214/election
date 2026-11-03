// Checks which YouTube news channels are live right now (or have a scheduled stream) and writes data/tv-live.json.
//   PROBE=1 node scripts/fetch-tv.mjs   (also resolve @handles and print details)
import fs from "node:fs";
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+1; SOCS=CAI" };
const CH = JSON.parse(fs.readFileSync("data/tv-channels.json", "utf8"));
async function check(c) {
  const r = await fetch(`https://www.youtube.com/channel/${c.id}/live`, { headers: UA, redirect: "follow" });
  const h = await r.text();
  const upcomingFlag = /"isUpcoming":true/.test(h) || /"upcomingEventData"/.test(h);
  const live = /"isLiveNow":true/.test(h) && !upcomingFlag;
  const vid = (h.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1] || null;
  const sched = (h.match(/"scheduledStartTime":"(\d+)"/) || [])[1];
  const title = (h.match(/<meta name="title" content="([^"]*)"/) || [])[1] || null;
  return { id: c.id, live: live && !!vid, video: vid, upcoming: !live && sched && +sched * 1000 > Date.now() - 3600e3 ? +sched * 1000 : null, title: vid ? title : null, status: r.status };
}
const out = { checkedAt: Date.now(), channels: {} };
for (const c of CH) { try { out.channels[c.id] = await check(c); } catch (e) { out.channels[c.id] = { id: c.id, live: false, error: e.message }; } }
if (process.env.PROBE) for (const c of CH) console.log("TV", c.name.padEnd(22), JSON.stringify(out.channels[c.id]));
const OUT = process.env.OUT || "data/tv-live.json";
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;
const sig = o => JSON.stringify(o && Object.values(o.channels).map(x => [x.live, x.video, x.upcoming]));
if (!prev || sig(prev) !== sig(out) || Date.now() - prev.checkedAt > 9 * 60e3) { fs.writeFileSync(OUT, JSON.stringify(out)); console.log("wrote", OUT); } else console.log("tv no change");
