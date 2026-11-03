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
      if(window.HEDcheckCalls)window.HEDcheckCalls(rs);
    }catch(e){}
  }
  ticker();setInterval(ticker,30000);
})();

// ===== Share cards + call alerts (all pages) =====
(function(){
  "use strict";
  const COL={D:"#1f62c4",R:"#cf2a36",I:"#9a7614",O:"#6b7286"};
  const last=n=>String(n).split(" ").filter(w=>!/^(III|II|Jr\.?)$/.test(w)).slice(-1)[0];
  const css=document.createElement("style");css.textContent=`
  .cardbtn,.followbtn{background:none;border:1px solid var(--rule);color:var(--fg-2);font:600 11.5px var(--f-sans);padding:3px 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
  .cardbtn:hover,.followbtn:hover{border-color:var(--fg);color:var(--fg)}
  .followbtn[aria-pressed="true"]{background:var(--fg);color:var(--bg);border-color:var(--fg)}
  .hed-modal{position:fixed;inset:0;z-index:90;background:rgba(10,14,28,.72);display:flex;align-items:center;justify-content:center;padding:20px}
  .hed-modal .box{background:var(--bg);color:var(--fg);max-width:min(460px,100%);width:100%;max-height:100%;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
  .hed-modal img{width:100%;height:auto;border:1px solid var(--rule)}
  .hed-modal .row{display:flex;gap:8px;flex-wrap:wrap}
  .hed-modal .row button,.hed-modal .row a{flex:1;min-width:120px;text-align:center;font:700 13px var(--f-sans);padding:10px;border:1.5px solid var(--fg);background:var(--bg);color:var(--fg);cursor:pointer;text-decoration:none}
  .hed-modal .row .pri{background:var(--smu-red);border-color:var(--smu-red);color:#fff}
  .alertmenu{position:absolute;right:max(16px,env(safe-area-inset-right,0px));top:32px;z-index:40;background:var(--bg);color:var(--fg);border:1px solid var(--rule-strong);padding:12px;width:260px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
  .alertmenu label{display:flex;gap:8px;align-items:center;padding:4px 0;cursor:pointer}
  .alertmenu p{margin:6px 0 0;font-size:11.5px;color:var(--muted)}
  .util{position:relative}`;document.head.appendChild(css);

  // ---- share card (1080x1350, works for X and Instagram) ----
  function wrapText(ctx,text,x,y,maxW,lh){const w=text.split(" ");let line="",lines=[];for(const t of w){const test=line?line+" "+t:t;if(ctx.measureText(test).width>maxW&&line){lines.push(line);line=t}else line=test}lines.push(line);lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lh));return lines.length}
  async function draw(spec){
    try{await document.fonts.ready}catch(e){}
    const W=1080,H=1350,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
    const SERIF='"Source Serif 4", Georgia, serif',SANS='"Libre Franklin", "Helvetica Neue", Arial, sans-serif';
    x.fillStyle="#ffffff";x.fillRect(0,0,W,H);
    x.fillStyle="#1b2a63";x.fillRect(0,0,W,150);x.fillStyle="#CC0035";x.fillRect(0,150,W,10);
    // logo
    x.save();x.translate(60,35);x.scale(80/48,80/48);x.fillStyle="#354CA1";x.fillRect(0,0,48,48);x.fillStyle="#fff";x.beginPath();x.moveTo(0,38);x.bezierCurveTo(10,25,18,22,26,27);x.bezierCurveTo(32,31,38,30,48,22);x.lineTo(48,48);x.lineTo(0,48);x.fill();x.fillStyle="#CC0035";x.beginPath();x.moveTo(0,44);x.bezierCurveTo(12,35,22,33,30,36);x.bezierCurveTo(37,38,42,37,48,33);x.lineTo(48,48);x.lineTo(0,48);x.fill();x.strokeStyle="#fff";x.lineWidth=4;x.beginPath();x.moveTo(14,15.5);x.lineTo(19,20.5);x.lineTo(30,9.5);x.stroke();x.restore();
    x.fillStyle="#fff";x.font=`700 46px ${SERIF}`;x.fillText("Hilltop Election Desk",165,92);x.font=`700 20px ${SANS}`;x.fillStyle="#ff8fa3";x.fillText("2026 MIDTERMS · NOV. 3",167,125);
    // kicker + title
    x.fillStyle="#CC0035";x.font=`800 28px ${SANS}`;x.fillText((spec.kicker||"").toUpperCase(),60,240);
    x.fillStyle="#111522";x.font=`700 78px ${SERIF}`;const tl=wrapText(x,spec.title||"",60,330,W-120,86);
    let y=330+tl*86+10;x.fillStyle="#3b4255";x.font=`500 30px ${SANS}`;if(spec.sub){x.fillText(spec.sub,60,y);y+=60}else y+=20;
    // candidates
    const cs=(spec.cands||[]).slice(0,3);
    for(const cd of cs){
      const col=COL[cd.p]||COL.O;x.fillStyle=col;x.fillRect(60,y,12,150);
      x.fillStyle="#111522";x.font=`700 40px ${SANS}`;x.fillText(cd.n+(cd.won?"  ✓":""),96,y+48);
      x.fillStyle="#6b7286";x.font=`500 26px ${SANS}`;x.fillText(cd.sub||"",96,y+88);
      x.fillStyle=col;x.font=`800 96px ${SANS}`;x.textAlign="right";x.fillText(cd.big||"",W-60,y+100);x.textAlign="left";
      x.fillStyle="#e3e5ec";x.fillRect(96,y+118,W-156,22);x.fillStyle=col;x.fillRect(96,y+118,(W-156)*Math.max(0,Math.min(1,cd.frac||0)),22);
      y+=190;
    }
    // status pill
    if(spec.status){x.font=`800 32px ${SANS}`;const tw=x.measureText(spec.status).width;const sc=spec.statusColor||"#111522";x.fillStyle=spec.statusSolid?sc:"#fff";x.strokeStyle=sc;x.lineWidth=4;x.fillRect(60,y,tw+48,70);x.strokeRect(60,y,tw+48,70);x.fillStyle=spec.statusSolid?"#fff":sc;x.fillText(spec.status,84,y+47);y+=110}
    if(spec.note){x.fillStyle="#3b4255";x.font=`500 28px ${SANS}`;wrapText(x,spec.note,60,y,W-120,38)}
    // footer
    x.fillStyle="#f6f7fb";x.fillRect(0,H-120,W,120);x.fillStyle="#111522";x.font=`700 30px ${SANS}`;x.fillText("analyticsguy214.github.io/election",60,H-52);
    x.fillStyle="#6b7286";x.font=`500 24px ${SANS}`;x.textAlign="right";x.fillText(new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})+" CT",W-60,H-52);x.textAlign="left";
    return c;
  }
  async function openCard(spec){
    const c=await draw(spec);const url=c.toDataURL("image/png");const blob=await new Promise(r=>c.toBlob(r,"image/png"));
    const fname=("hilltop-"+(spec.slug||"race")+".png").replace(/[^a-z0-9.-]/gi,"-").toLowerCase();
    const m=document.createElement("div");m.className="hed-modal";m.setAttribute("role","dialog");m.setAttribute("aria-label","Share this race");
    const text=spec.shareText||((spec.title||"")+" · Hilltop Election Desk");
    m.innerHTML=`<div class="box"><img alt="Result card for ${String(spec.title).replace(/"/g,"")}" src="${url}"><div class="row"><button class="pri" type="button" data-a="share">Share image</button><a href="${url}" download="${fname}">Download</a></div><div class="row"><button type="button" data-a="x">Post on X</button><button type="button" data-a="close">Close</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click",async e=>{const a=e.target.dataset&&e.target.dataset.a;if(e.target===m||a==="close"){m.remove();return}
      if(a==="x"){window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(text)+"&url="+encodeURIComponent(location.href.split("#")[0]),"_blank","noopener");return}
      if(a==="share"){const f=new File([blob],fname,{type:"image/png"});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:spec.title,text})}catch(x){}}else{const l=document.createElement("a");l.href=url;l.download=fname;document.body.appendChild(l);l.click();l.remove()}}});
    document.addEventListener("keydown",function esc(e){if(e.key==="Escape"){m.remove();document.removeEventListener("keydown",esc)}});
  }
  // Build a card from a race object (+ optional win chance for cands[0])
  function raceSpec(race,opt){opt=opt||{};const tot=race.votes?race.votes.reduce((a,b)=>a+(b||0),0):0;const ch=opt.chance;
    const cands=race.cands.slice(0,2).map((cd,i)=>{const v=tot?(race.votes[i]||0):null;const sh=tot?v/tot:null;const p=ch==null?null:(i===0?ch:1-ch);
      return{n:cd.n,p:cd.p,won:race.called===i,sub:(cd.p==="D"?"Democrat":cd.p==="R"?"Republican":"Independent")+(cd.inc?" · incumbent":"")+(tot?" · "+v.toLocaleString("en-US")+" votes":""),big:tot?(sh*100).toFixed(1)+"%":p!=null?Math.round(p*100)+"%":"",frac:tot?sh:(p||0)}});
    let status,sc,solid=false;
    if(race.called!=null){const w=race.cands[race.called];status=last(w.n)+" wins · AP call";sc=COL[w.p];solid=true}
    else if(tot){status=Math.round((race.r||0)*100)+"% of votes counted";sc="#111522"}
    else{status="Forecast · chance to win";sc="#111522"}
    return{kicker:opt.kicker||"2026 results",title:opt.title||race.title,sub:opt.sub||race.sub,cands,status,statusColor:sc,statusSolid:solid,note:opt.note,slug:race.id,shareText:opt.shareText};
  }
  window.HEDcard={open:openCard,raceSpec,openRace:(race,opt)=>openCard(raceSpec(race,opt))};

  // ---- call alerts ----
  const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  let follow=new Set(LS.get("hed-follow",[]));let mode=LS.get("hed-alert","followed");
  function syncFollowButtons(){document.querySelectorAll("[data-follow]").forEach(b=>{const on=follow.has(b.dataset.follow);b.setAttribute("aria-pressed",String(on));b.textContent=on?"🔔 Following":"🔔 Follow";b.title=on?"You'll get an alert when this race is called":"Get an alert when this race is called"})}
  window.HEDfollowSync=syncFollowButtons;
  async function askPerm(){if(!("Notification" in window))return"unsupported";if(Notification.permission==="default"){try{return await Notification.requestPermission()}catch(e){return"denied"}}return Notification.permission}
  function toastMsg(t){let el=document.querySelector(".toast");if(!el){el=document.createElement("div");el.className="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=t;el.hidden=false;clearTimeout(toastMsg.h);toastMsg.h=setTimeout(()=>{el.hidden=true},6000)}
  function notify(title,body,tag){if("Notification" in window&&Notification.permission==="granted"){try{new Notification(title,{body,tag,icon:"og.png"})}catch(e){}}toastMsg(title+" · "+body)}
  document.addEventListener("click",async e=>{
    const b=e.target.closest("[data-follow]");if(b){e.preventDefault();const id=b.dataset.follow;if(follow.has(id))follow.delete(id);else{follow.add(id);if(mode==="off"){mode="followed";LS.set("hed-alert",mode)}const p=await askPerm();if(p==="denied")toastMsg("Following. Browser notifications are blocked, so alerts will show on this page only.")}LS.set("hed-follow",[...follow]);syncFollowButtons();return}
    const ab=e.target.closest("#alertBtn");if(ab){const ex=document.querySelector(".alertmenu");if(ex){ex.remove();return}const m=document.createElement("div");m.className="alertmenu";m.innerHTML=`<b>Race-call alerts</b>${[["off","Off"],["followed","Races I follow (🔔)"],["all","Every Senate, governor and Texas call"]].map(([v,l])=>`<label><input type="radio" name="hedalert" value="${v}" ${mode===v?"checked":""}> ${l}</label>`).join("")}<p>Alerts appear while this site is open in a tab. Allow notifications to get them even when the tab is in the background.</p>`;ab.closest(".util").appendChild(m);
      m.addEventListener("change",async ev=>{mode=ev.target.value;LS.set("hed-alert",mode);if(mode!=="off"){const p=await askPerm();if(p==="denied")toastMsg("Notifications are blocked in this browser; alerts will show on the page instead.")}});return}
    if(!e.target.closest(".alertmenu")){const ex=document.querySelector(".alertmenu");if(ex)ex.remove()}
  });
  function injectAlertBtn(){const u=document.querySelector(".util .utilr");if(!u||document.getElementById("alertBtn"))return;const b=document.createElement("button");b.id="alertBtn";b.type="button";b.textContent="🔔 Alerts";u.insertBefore(b,u.firstChild)}
  injectAlertBtn();
  const NAMES={"sen":"Senate","gov":"governor","tx":"Texas","h":"House"};
  window.HEDcheckCalls=function(races){
    if(!races||!races.length)return;const seen=LS.get("hed-seen-calls",null);const now={};races.forEach(r=>{if(r.called!=null)now[r.id]=r.called});
    if(seen===null){LS.set("hed-seen-calls",now);return}
    for(const [id,idx] of Object.entries(now)){if(seen[id]===idx)continue;const r=races.find(x=>x.id===id);const want=mode==="all"?!/^h-/.test(id)||follow.has(id):mode==="followed"?follow.has(id):false;
      if(want){const w=r.cands[idx];const flip=(r.held&&r.held!=="O"&&r.held!==w.p)?" (flip)":"";notify(`AP call: ${w.n} wins`,`${r.title}${/^sen-/.test(id)?" Senate":/^gov-/.test(id)?" governor":""}${flip}`,id)}}
    LS.set("hed-seen-calls",now);
  };
  setTimeout(syncFollowButtons,1500);
})();
