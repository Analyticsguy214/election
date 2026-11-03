/* Reads AP results straight from the New York Times election files (they allow browser access),
   so national results refresh every 30 seconds without waiting for the GitHub copy.
   Returns an object in the same shape as data/national-live.json, or null if it can't. */
(function(){
  "use strict";
  const B="https://static01.nyt.com/elections-assets/pages/data/2026-11-03/";
  const FILES={S:"results-senate.json",G:"results-governor.json",H:"results-house.json"};
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z]/g,"");
  const lastName=n=>n.split(" ").filter(w=>!/^(III|II|Jr\.?|Sr\.?)$/.test(w)).pop();
  const partyOf=m=>{const p=(m&&m.party&&(m.party.nyt_id||m.party.abbreviation))||"";return /DEM/i.test(p)?"D":/GOP|REP/i.test(p)?"R":"O"};
  function keyFor(r){
    if(r.id.startsWith("sen-"))return{o:"S",st:r.id.slice(4).toUpperCase()};
    if(r.id.startsWith("gov-"))return{o:"G",st:r.id.slice(4).toUpperCase()};
    if(r.id==="tx-gov")return{o:"G",st:"TX"};
    let h=r.id.match(/^h-([a-z]{2})-(\w+)$/);if(h)return{o:"H",st:h[1].toUpperCase(),d:h[2]==="al"?1:+h[2]};
    h=r.id.match(/^tx-(\d\d)$/);if(h)return{o:"H",st:"TX",d:+h[1]};return null;
  }
  const nytKey=x=>{const p=x.nyt_id.split("-");const o=x.office_id||p[2];return{st:p[0],o,d:o==="H"?+(p[3]||0):null}};
  const ruOf=x=>{const ru=x.reporting_units||[];return ru.find(u=>u.level==="state"||u.level==="district")||ru[0]};
  function summarize(race,x){
    const ru=ruOf(x);if(!ru)return null;const meta=x.candidate_metadata||{};const v=race.cands.map(()=>0);let other=0;
    for(const c of ru.candidates||[]){const m=meta[c.nyt_id]||{};const ln=norm(m.last_name||c.nyt_id.split("-")[0]);const pt=partyOf(m);
      let i=race.cands.findIndex(rc=>norm(lastName(rc.n))===ln);if(i<0)i=race.cands.findIndex(rc=>rc.p===pt&&pt!=="O");
      const n=(c.votes&&c.votes.total)||0;if(i>=0)v[i]+=n;else other+=n}
    let called=null;const won=(x.outcome&&x.outcome.won)||[];
    if(won.length){const m=meta[won[0]]||{};const ln=norm(m.last_name||won[0].split("-")[0]);let i=race.cands.findIndex(rc=>norm(lastName(rc.n))===ln);if(i<0)i=race.cands.findIndex(rc=>rc.p===partyOf(m));called=i>=0?i:null}
    const e=typeof ru.eevp==="number"?ru.eevp:null;
    return{v,other,r:e==null?null:Math.min(1,e/100),called,calledBy:(x.outcome&&x.outcome.called_by)||[],expected:ru.total_expected_vote||null,total:ru.total_votes||0,updated:ru.provider_updated_at||x.updated_at||null};
  }
  let cache=null,cacheAt=0,inflight=null;const snapsMem={};
  async function get(){
    if(cache&&Date.now()-cacheAt<25000)return cache;
    if(inflight)return inflight;
    inflight=(async()=>{const out={};await Promise.all(Object.entries(FILES).map(async([o,f])=>{const c=new AbortController();const t=setTimeout(()=>c.abort(),15000);
      try{const r=await fetch(B+f+"?t="+Math.floor(Date.now()/15000),{signal:c.signal});if(r.ok)out[o]=await r.json()}catch(e){}finally{clearTimeout(t)}}));
      if(Object.keys(out).length){cache=out;cacheAt=Date.now()}return cache})();
    try{return await inflight}finally{inflight=null}
  }
  window.HEDap=async function(races,prev){
    const data=await get();if(!data)return null;
    const idx={};for(const [o,d] of Object.entries(data))for(const x of (d&&d.races)||[]){const k=nytKey(x);if(k.st!=="US")idx[`${o}|${k.st}|${k.d??""}`]=x}
    const out={source:"Associated Press via The New York Times (direct)",fetchedAt:Date.now(),direct:true,races:{},house:null,senateCalledStates:{},control:{}};
    for(const race of races){const k=keyFor(race);if(!k)continue;const x=idx[`${k.o}|${k.st}|${k.d??""}`];if(!x)continue;const s=summarize(race,x);if(!s)continue;
      const base=(prev&&prev.races&&prev.races[race.id]&&prev.races[race.id].snaps)||[];let mem=snapsMem[race.id]||[];
      const all=base.concat(mem.filter(m=>!base.length||m.t>base[base.length-1].t));const last=all[all.length-1];const tot=s.v.reduce((a,b)=>a+b,0);
      if(tot>0&&(!last||last.v.join()!==s.v.join()||last.called!==s.called)){const p={t:Date.now(),v:s.v,r:s.r,called:s.called};mem=mem.concat([p]).slice(-200);snapsMem[race.id]=mem;all.push(p)}
      out.races[race.id]={...s,snaps:all.slice(-400)}}
    // keep Texas down-ballot entries that only the GitHub copy has
    if(prev&&prev.races)for(const [id,v] of Object.entries(prev.races))if(!out.races[id])out.races[id]=v;
    if(data.H){let D=0,R=0;for(const x of data.H.races){const w=x.outcome&&x.outcome.won&&x.outcome.won[0];if(!w)continue;const p=partyOf((x.candidate_metadata||{})[w]);if(p==="D")D++;else if(p==="R")R++}out.house={cD:D,cR:R}}
    else if(prev)out.house=prev.house;
    if(data.S)for(const x of data.S.races){const w=x.outcome&&x.outcome.won&&x.outcome.won[0];if(!w)continue;const p=partyOf((x.candidate_metadata||{})[w]);if(p!=="O")out.senateCalledStates[nytKey(x).st]=p}
    for(const [o,d] of Object.entries(data))if(d&&d.partyControlData)out.control[o]=d.partyControlData;
    // every race the AP is counting, tracked or not
    const all=[];
    for(const [o,d] of Object.entries(data))for(const x of (d&&d.races)||[]){const k=nytKey(x);if(k.st==="US")continue;const ru=ruOf(x);if(!ru)continue;const meta=x.candidate_metadata||{};
      const cs=(ru.candidates||[]).map(c=>{const m=meta[c.nyt_id]||{};return{n:m.full_name||[m.first_name,m.last_name].filter(Boolean).join(" ")||c.nyt_id.split("-")[0],ln:m.last_name||m.full_name||c.nyt_id.split("-")[0],p:partyOf(m),v:(c.votes&&c.votes.total)||0,id:c.nyt_id}}).sort((a,b)=>b.v-a.v);
      const tot=cs.reduce((a,c)=>a+c.v,0);const won=(x.outcome&&x.outcome.won)||[];const w=won.length?cs.find(c=>c.id===won[0]):null;
      if(!tot&&!w)continue;
      all.push({o,st:k.st,d:k.d,label:o==="S"?k.st+" Senate":o==="G"?k.st+" Governor":k.st+"-"+(k.d||"AL"),cs:cs.slice(0,2),tot,r:typeof ru.eevp==="number"?Math.min(1,ru.eevp/100):null,won:w?{n:w.ln,p:w.p}:null,unc:cs.length===1})}
    out.all=all;
    return out;
  };
})();
