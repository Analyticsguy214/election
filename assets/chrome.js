// Shared site chrome: theme toggle, share button, results ticker. Used by every page.
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const PC={D:"var(--dem)",R:"var(--rep)",I:"var(--ind)"};
  const last=n=>n.split(" ").filter(w=>!/^(III|II|Jr\.?)$/.test(w)).slice(-1)[0];
  const pct=p=>p>=0.995?">99%":p<=0.005?"<1%":Math.round(p*100)+"%";


  // splash / loading screen (once per visit)
  (function(){
    let seen=false;try{seen=sessionStorage.getItem("hed-splash")==="1";sessionStorage.setItem("hed-splash","1")}catch(e){}
    if(seen||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const d=document.createElement("div");d.className="splash";d.setAttribute("aria-hidden","true");
    d.innerHTML=`<svg class="lg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#354CA1"/><path d="M0 38 C10 25 18 22 26 27 C32 31 38 30 48 22 V48 H0Z" fill="#fff" opacity=".95"/><path d="M0 44 C12 35 22 33 30 36 C37 38 42 37 48 33 V48 H0Z" fill="#CC0035"/><path d="M14 15.5 l5 5 l11-11" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="square"/></svg><div class="sw">Hilltop Election Desk</div><div class="sd">Tuesday, November 3, 2026 · Live from 5 p.m. Central</div><div class="sl"><i></i>Live results · Midterms 2026</div><div class="sbar"><i></i></div><div class="sm">Opening the newsroom…</div>`;
    document.body.appendChild(d);const t0=Date.now();
    const done=()=>{const w=Math.max(0,1100-(Date.now()-t0));setTimeout(()=>{d.classList.add("out");setTimeout(()=>d.remove(),500)},w)};
    if(document.readyState==="complete")done();else window.addEventListener("load",done,{once:true});
    setTimeout(done,3200);
  })();
  // theme
  const root=document.documentElement;
  try{const t=localStorage.getItem("hed-theme");if(t)root.setAttribute("data-theme",t)}catch(e){}
  function themeLabel(){const b=$("themeBtn");if(!b)return;const dark=root.getAttribute("data-theme")==="dark"||(!root.getAttribute("data-theme")&&matchMedia("(prefers-color-scheme: dark)").matches);b.textContent=dark?"☀ Light mode":"☾ Dark mode"}
  document.addEventListener("click",e=>{
    if(e.target.closest("#themeBtn")){const dark=root.getAttribute("data-theme")==="dark"||(!root.getAttribute("data-theme")&&matchMedia("(prefers-color-scheme: dark)").matches);const n=dark?"light":"dark";root.setAttribute("data-theme",n);try{localStorage.setItem("hed-theme",n)}catch(x){}themeLabel();window.dispatchEvent(new Event("resize"))}
    const sb=e.target.closest("[data-share]");if(sb){share(sb.getAttribute("data-share"))}
  });
  themeLabel();

  // share
  function toast(msg){let t=document.querySelector(".toast");if(!t){t=document.createElement("div");t.className="toast";t.setAttribute("role","status");document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>{t.hidden=true},2200)}
  async function share(kind){
    const url=location.href.split("#")[0]+(location.hash||"");const title=document.title;
    if(kind==="x"){window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(title)+"&url="+encodeURIComponent(url),"_blank","noopener");return}
    if(navigator.share&&kind!=="copy"){try{await navigator.share({title,url});return}catch(e){if(e&&e.name==="AbortError")return}}
    try{await navigator.clipboard.writeText(url);toast("Link copied")}catch(e){toast(url)}
  }

  // ticker
  const KEY=["sen-tx","tx-gov","sen-nc","sen-ga","sen-mi","sen-me","sen-oh","sen-ia","sen-ak","sen-ks","sen-sc","sen-ne","gov-ga","gov-oh","gov-az","gov-wi","gov-nv","gov-mi","tx-24","tx-32","tx-33"];
  const LBL={"sen-tx":"TX Senate","tx-gov":"TX Governor","tx-24":"TX-24","tx-32":"TX-32","tx-33":"TX-33"};
  const ST={"sen-nc":"NC","sen-ga":"GA","sen-mi":"MI","sen-me":"ME","sen-oh":"OH","sen-ia":"IA","sen-ak":"AK","sen-ks":"KS","sen-sc":"SC","sen-ne":"NE","gov-ga":"GA","gov-oh":"OH","gov-az":"AZ","gov-wi":"WI","gov-nv":"NV","gov-mi":"MI"};
  const RATING_P={"Safe":0.97,"Likely":0.86,"Lean":0.68,"Tilt":0.58};
  function chance(race,MK){
    const xs=[];if(typeof race.pre==="number")xs.push(race.pre);
    else if(race.rating){const m=race.rating.match(/^(Safe|Likely|Lean|Tilt)\s+([DRI])/);if(m)xs.push(race.cands[0].p===m[2]?RATING_P[m[1]]:1-RATING_P[m[1]]);else if(/Toss/.test(race.rating))xs.push(.5)}
    const r=MK&&MK.races&&MK.races[race.id];if(r)[r.kalshi,r.polymarket].forEach(o=>{if(!o)return;const a=o[race.cands[0].p],b=race.cands[1]?o[race.cands[1].p]:null;if(a!=null&&b!=null)xs.push(a/((a+b)||1));else if(a!=null)xs.push(a)});
    return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
  }
  function tickerItem(race,MK,texasPage){
    const id=race.id;const name=LBL[id]||(ST[id]+(id.startsWith("sen")?" Senate":" Gov."));
    const href=(id.startsWith("tx-")||id==="sen-tx")?(texasPage?"#"+id:"texas.html#"+id):(texasPage?"./#race-"+id:"#race-"+id);
    const c0=race.cands[0],c1=race.cands[1];const tot=race.votes?race.votes.reduce((a,b)=>a+(b||0),0):0;
    let tag,l,r,w0;
    if(race.called!=null){const c=race.cands[race.called];tag=`<em style="color:${PC[c.p]}">✓ ${esc(last(c.n))}</em>`}
    if(tot){const s0=(race.votes[0]||0)/tot*100,s1=(race.votes[1]||0)/tot*100;l=s0.toFixed(1)+"%";r=s1.toFixed(1)+"%";w0=s0/(s0+s1)*100;tag=tag||`<em>${Math.round((race.r||0)*100)}% in</em>`}
    else{const p=chance(race,MK);if(p==null)return"";l=pct(p);r=pct(1-p);w0=p*100;tag=tag||"<em>Forecast</em>"}
    return`<a class="tk" href="${href}"><span class="tn">${esc(name)}${tag}</span><span class="tc"><span style="color:${PC[c0.p]}">${esc(last(c0.n))} <b>${l}</b></span><span style="color:${PC[c1.p]}">${esc(last(c1.n))} <b>${r}</b></span></span><span class="tbar"><i style="width:${w0}%;background:${PC[c0.p]}"></i><i style="flex:1;background:${PC[c1.p]}"></i></span></a>`;
  }
  async function ticker(){
    const el=$("tickerTrack");if(!el)return;
    try{
      const q="?t="+Date.now();const [rs,mk,nl]=await Promise.all([fetch("data/races.json"+q,{cache:"no-store"}).then(r=>r.json()),fetch("data/markets.json"+q,{cache:"no-store"}).then(r=>r.json()).catch(()=>null),fetch("data/national-live.json"+q,{cache:"no-store"}).then(r=>r.json()).catch(()=>null)]);if(nl&&nl.races)rs.forEach(x=>{const n=nl.races[x.id];if(!n)return;const tn=(n.v||[]).reduce((a,b)=>a+b,0);if(tn>0){x.votes=n.v;x.r=n.r}if(x.called==null&&n.called!=null)x.called=n.called});
      const tp=/texas\.html/.test(location.pathname);
      let h="";const c=mk&&mk.control;
      const ctl=(nm,o)=>{if(!o)return"";const xs=[o.kalshi,o.polymarket].filter(Boolean).map(x=>x.D/((x.D||0)+(x.R!=null?x.R:1-x.D)));if(!xs.length)return"";const p=xs.reduce((a,b)=>a+b,0)/xs.length;
        return`<a class="tk" href="${tp?"./":""}#bop-h"><span class="tn">${nm}<em>Markets</em></span><span class="tc"><span style="color:var(--dem)">Dem <b>${pct(p)}</b></span><span style="color:var(--rep)">GOP <b>${pct(1-p)}</b></span></span><span class="tbar"><i style="width:${p*100}%;background:var(--dem)"></i><i style="flex:1;background:var(--rep)"></i></span></a>`};
      if(c){h+=ctl("Senate control",c.senate)+ctl("House control",c.house)}
      KEY.forEach(id=>{const r=rs.find(x=>x.id===id);if(r)h+=tickerItem(r,mk,tp)});
      el.innerHTML=h;
    }catch(e){}
  }
  ticker();setInterval(ticker,30000);
})();
