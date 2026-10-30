
(function(){
  const SECTIONS=[
    {g:"senate",t:"Senate",p:"The 14 most competitive of the 35 Senate seats on the ballot. The remaining 21 are rated safe and are included in the balance of power."},
    {g:"governor",t:"Governor",p:"The most closely watched governor races nationally, including Texas."},
    {g:"texas",t:"Texas",p:"Every statewide office on the Texas ballot. Polls close at 7 p.m. Central in most of the state and 8 p.m. in El Paso."},
    {g:"dfw",t:"Dallas County",p:"U.S. House races on Dallas County ballots under the 2026 congressional map."}
  ];
  const STATE={"sen-nc":"NC","sen-ga":"GA","sen-mi":"MI","sen-me":"ME","sen-oh":"OH","sen-tx":"TX","sen-ia":"IA","sen-ak":"AK","sen-ks":"KS","sen-sc":"SC","sen-ne":"NE","sen-mn":"MN","sen-nh":"NH","sen-fl":"FL"};
  const CLOSES={NC:"6:30 p.m.",GA:"6 p.m.",MI:"7 p.m.",ME:"7 p.m.",OH:"6:30 p.m.",TX:"7 p.m.",IA:"8 p.m.",AK:"Midnight",KS:"7 p.m.",SC:"6 p.m.",NE:"8 p.m.",MN:"8 p.m.",NH:"7 p.m.",FL:"6 p.m.",NV:"9 p.m.",WI:"8 p.m.",AZ:"8 p.m."};
  const GOVST={"gov-ga":"GA","gov-oh":"OH","gov-nv":"NV","gov-wi":"WI","gov-ks":"KS","gov-fl":"FL","gov-az":"AZ","gov-mi":"MI","gov-ia":"IA","gov-nh":"NH","tx-gov":"TX"};
  const TILES=[["AK",0,0],["ME",11,0],["VT",10,1],["NH",11,1],["WA",1,2],["ID",2,2],["MT",3,2],["ND",4,2],["MN",5,2],["IL",6,2],["WI",7,2],["MI",8,2],["NY",9,2],["RI",10,2],["MA",11,2],["OR",1,3],["NV",2,3],["WY",3,3],["SD",4,3],["IA",5,3],["IN",6,3],["OH",7,3],["PA",8,3],["NJ",9,3],["CT",10,3],["CA",1,4],["UT",2,4],["CO",3,4],["NE",4,4],["MO",5,4],["KY",6,4],["WV",7,4],["VA",8,4],["MD",9,4],["DE",10,4],["AZ",2,5],["NM",3,5],["KS",4,5],["AR",5,5],["TN",6,5],["NC",7,5],["SC",8,5],["DC",9,5],["OK",4,6],["LA",5,6],["MS",6,6],["AL",7,6],["GA",8,6],["HI",1,7],["TX",4,7],["FL",9,7]];
  const PC={D:"var(--dem)",R:"var(--rep)",I:"var(--ind)"};
  const CLOSE=new Date("2026-11-04T01:00:00Z");
  let races=[],meta=null,MK=null,group="all";
  try{const s=localStorage.getItem("hed-tab");if(s)group=s}catch(e){}

  // ---------- model ----------
  function erf(x){const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y}
  const Phi=x=>0.5*(1+erf(x/Math.SQRT2));
  function probit(p){p=Math.min(0.999,Math.max(0.001,p));const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];const pl=0.02425;let q,r;if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
  const RATING_P={"Safe":0.97,"Likely":0.86,"Lean":0.68,"Tilt":0.58};
  function mkP(race){ // market probs for cand0 [kalshi, poly]
    const r=MK&&MK.races&&MK.races[race.id];if(!r)return[null,null];
    const f=o=>{if(!o)return null;const a=o[race.cands[0].p],b=race.cands[1]?o[race.cands[1].p]:null;let p=null;if(a!=null&&b!=null&&race.cands[0].p!==race.cands[1].p)p=a/((a+b)||1);else if(a!=null)p=a;else if(b!=null)p=1-b;return p==null?null:Math.min(.99,Math.max(.01,p))};
    return[f(r.kalshi),f(r.polymarket)];
  }
  function baseFc(race){
    if(typeof race.pre==="number")return race.pre;
    if(race.rating){const m=race.rating.match(/^(Safe|Likely|Lean|Tilt)\s+([DRI])/);if(m){const p=RATING_P[m[1]];return race.cands[0].p===m[2]?p:1-p}if(/Toss/.test(race.rating))return 0.5}
    return null;
  }
  function prior(race){const xs=[baseFc(race),...mkP(race)].filter(x=>x!=null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
  function model(race,snap){
    const n=race.cands.length;const called=snap?snap.called:race.called;
    if(called!=null&&called!==""){return{probs:race.cands.map((c,i)=>i===called?1:0),mode:"called",est:null}}
    const pr=prior(race);const v=snap?snap.v:race.votes;const r=Math.max(0,Math.min(1,snap?snap.r||0:race.r||0));
    const tot=v?v.reduce((a,b)=>a+(b||0),0):0;
    if(!v||!tot||r<=0){if(pr==null)return{probs:null,mode:"none",est:null};return{probs:race.cands.map((c,i)=>i===0?pr:(i===1?1-pr:0)),mode:"pre",est:null}}
    const idx=[...v.keys()].sort((a,b)=>v[b]-v[a]);const a=idx[0],b=idx[1];
    const m=(v[a]-v[b])/(v[a]+v[b])*100;
    let mp=0;if(pr!=null){const base=probit(pr)*7;if(a===0&&b===1)mp=base;else if(a===1&&b===0)mp=-base}
    const w=Math.min(1,0.4+r);const mRem=w*m+(1-w)*mp;
    const fin=r*m+(1-r)*mRem;const sd=Math.sqrt(Math.pow((1-r)*(7+6*r),2)+0.25);
    const pa=Phi(fin/sd);const probs=new Array(n).fill(0);probs[a]=pa;probs[b]=1-pa;
    return{probs,mode:"live",est:{leader:a,margin:fin,r,tot}};
  }
  function senateItems(get){
    const items=[];
    races.filter(x=>x.groups.includes("senate")).forEach(x=>{const m=get(x);const p0=m.probs?m.probs[0]:0.5,p1=m.probs?(m.probs[1]||0):0.5;
      items.push({st:STATE[x.id],race:x,m,pD:x.cands[0].p==="D"?p0:(x.cands[1].p==="D"?p1:0),pR:x.cands[1].p==="R"?p1:(x.cands[0].p==="R"?p0:0),locked:m.mode==="called",shift:m.mode==="live"?1-m.est.r:1})});
    ((meta&&meta.senateSafe)||[]).forEach(s=>items.push({st:s.st,pD:s.fav==="D"?s.p:1-s.p,pR:s.fav==="R"?s.p:1-s.p,locked:false,shift:1,safe:true,fav:s.fav}));
    return items;
  }
  function senateControl(get){
    const notUpD=(meta&&meta.senate&&meta.senate.notUpD)||34,need=(meta&&meta.senate&&meta.senate.need)||51;
    const items=senateItems(get).map(it=>({...it,z:probit(it.pD),pI:Math.max(0,1-it.pD-it.pR)}));
    const R=rng(20261103),N=4000;let win=0,sum=0,sumR=0;const dist={};
    for(let k=0;k<N;k++){const nat=gauss(R)*0.45;let d=notUpD,i=0;for(const it of items){const p=(it.locked||it.pD<=0||it.pD>=1)?it.pD:Phi(it.z+nat*it.shift);const u=R();if(u<p)d++;else if(it.pI>0&&R()<it.pI/Math.max(1e-6,1-it.pD))i++}
      const key=d+"|"+i;dist[key]=(dist[key]||0)+1;sum+=d;sumR+=100-d-i;if(d>=need)win++}
    return{p:win/N,seats:sum/N,seatsR:sumR/N,dist,N,need};
  }
  function houseControl(h){
    if(!h)return null;const cD=h.cD||0,cR=h.cR||0,rem=435-cD-cR,proj=h.projD||218;
    if(cD>=218)return{p:1,exp:Math.max(cD,proj)};if(cR>=218)return{p:0,exp:cD};
    const exp=cD+Math.max(0,Math.min(rem,proj-cD));const sd=(h.sd0||24.4)*Math.sqrt(rem/435)+0.5;
    return{p:Phi((exp-217.5)/sd),exp};
  }

  // ---------- helpers ----------
  const $=id=>document.getElementById(id);
  const pct=p=>p==null?"—":(p>=0.995?">99%":p<=0.005?"<1%":Math.round(p*100)+"%");
  const fmt=n=>n==null?"—":Math.round(n).toLocaleString("en-US");
  const last=n=>n.split(" ").filter(w=>!/^(III|Jr\.?|II)$/.test(w)).slice(-1)[0];
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const ct=t=>new Date(t).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"}).replace("AM","a.m.").replace("PM","p.m.");
  function tint(pD,pR,locked){ // map/seat color
    if(locked)return pD>=1?"var(--dem)":pR>=1?"var(--rep)":"var(--ind)";
    if(pD>=0.6)return"var(--dem-2)";if(pR>=0.6)return"var(--rep-2)";return"var(--neutral-2)";
  }

  // ---------- render ----------
  let lastCheck=0;
  function ago(t){const s=Math.max(0,Math.round((Date.now()-t)/1000));return s<60?s+" sec ago":s<3600?Math.round(s/60)+" min ago":new Date(t).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})+" CT"}
  function renderFresh(){
    const el=$("updated");if(!el)return;const st=(meta&&meta.status)||"pre";
    const oddsT=Math.max((MK&&MK.livePM)||0,(MK&&MK.updatedAt)||0);
    let h="";
    if(oddsT)h+=`<b>Odds updated</b> ${ago(oddsT)}`;
    h+=st==="pre"?` · <b>Results</b> begin when polls close`:(meta&&meta.updatedAt?` · <b>Results updated</b> ${ago(meta.updatedAt)}`:"");
    if(lastCheck)h+=` · <span class="muted">checked ${ago(lastCheck)}</span>`;
    el.innerHTML=h||"Loading…";
  }
  setInterval(renderFresh,5000);
  function renderStatus(){
    const st=(meta&&meta.status)||"pre";
    $("livePill").className="live"+(st==="live"?"":" off");
    $("liveText").textContent=st==="live"?"Live":st==="final"?"Results":"Pre-election";
    renderFresh();
    const diff=CLOSE-Date.now();
    if(st==="pre"&&diff>0){const d=Math.floor(diff/864e5),h=Math.floor(diff%864e5/36e5),m=Math.floor(diff%36e5/6e4);$("countdown").textContent="Texas polls close in "+(d?d+" days, ":"")+h+" hr "+m+" min";}
    else $("countdown").textContent=(meta&&meta.note)||"";
    $("bopNote").textContent=st==="pre"?"Pre-election forecast · results begin Nov. 3":"Live estimate · seats shown as won are AP calls";
    $("utilRight").textContent=st==="live"?"Results updating every 5–10 minutes · Times are Central":"Times are Central";
    if(meta&&meta.sources){const u=$("sources");u.innerHTML="";meta.sources.forEach(s=>{const li=document.createElement("li");const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener";a.textContent=s.title;li.appendChild(a);u.appendChild(li)})}
  }
  function bar(el,segs,total,markAt,markLabel){
    el.innerHTML="";segs.forEach(([c,n,t])=>{if(n<=0)return;const d=document.createElement("div");d.className="seg";d.style.flexBasis=(n/total*100)+"%";d.style.background=c;d.title=t+": "+n;el.appendChild(d)});
    const m=document.createElement("div");m.className="mark";m.style.left=(markAt/total*100)+"%";m.innerHTML="<span>"+markLabel+"</span>";el.appendChild(m);
  }
  function renderBop(){
    const notUpD=(meta&&meta.senate&&meta.senate.notUpD)||34,notUpR=(meta&&meta.senate&&meta.senate.notUpR)||31;
    const items=senateItems(r=>model(r));
    let wD=0,wR=0,wI=0,lD=0,lR=0,tu=0;
    items.forEach(it=>{if(it.locked){if(it.pD>=1)wD++;else if(it.pR>=1)wR++;else wI++;}else if(it.pD>=0.6)lD++;else if(it.pR>=0.6)lR++;else tu++});
    ((meta&&meta.senateCalled)||[]).forEach(p=>{/* safe seats already called */ if(p==="D"){wD++;lD--}else if(p==="R"){wR++;lR--}});
    const s=senateControl(r=>model(r));
    $("senDn").textContent=notUpD+wD;$("senRn").textContent=notUpR+wR;
    bar($("senSeats"),[["var(--dem-3)",notUpD,"Dem not up"],["var(--dem)",wD,"Dem won"],["var(--dem-2)",lD,"Dem favored"],["var(--ind)",wI,"Independent won"],["var(--neutral-2)",tu,"Toss-up"],["var(--rep-2)",lR,"GOP favored"],["var(--rep)",wR,"GOP won"],["var(--rep-3)",notUpR,"GOP not up"]],100,50,"50");
    $("senLegend").innerHTML=`<span><i style="background:var(--dem)"></i>Won ${wD}</span><span><i style="background:var(--dem-2)"></i>Favored ${Math.max(0,lD)}</span><span><i style="background:var(--dem-3)"></i>Not up ${notUpD}</span><span><i style="background:var(--neutral-2)"></i>Toss-up ${tu}</span><span><i style="background:var(--rep-3)"></i>Not up ${notUpR}</span><span><i style="background:var(--rep-2)"></i>Favored ${Math.max(0,lR)}</span><span><i style="background:var(--rep)"></i>Won ${wR}</span><span>Average outcome: <b class="num" style="color:var(--dem)">D ${s.seats.toFixed(1)}</b> · <b class="num" style="color:var(--rep)">R ${s.seatsR.toFixed(1)}</b></span>`;
    $("senPD").textContent=pct(s.p);$("senPR").textContent=pct(1-s.p);$("senBD").style.width=s.p*100+"%";$("senBR").style.width=(1-s.p)*100+"%";
    const h=(meta&&meta.house)||{cD:0,cR:0,projD:218};const hc=houseControl(h)||{p:0.5,exp:218};
    if(!(h.cD||h.cR)){const xs=[hc.p];const c=MK&&MK.control&&MK.control.house;[c&&c.kalshi,c&&c.polymarket].forEach(o=>{if(o&&o.D!=null)xs.push(o.D/((o.D||0)+(o.R!=null?o.R:1-o.D)))});hc.p=xs.reduce((a,b)=>a+b,0)/xs.length}
    const cD=h.cD||0,cR=h.cR||0;
    $("houDn").textContent=cD;$("houRn").textContent=cR;
    bar($("houSeats"),[["var(--dem)",cD,"Dem won"],["var(--neutral)",435-cD-cR,"Not yet called"],["var(--rep)",cR,"GOP won"]],435,217.5,"218");
    $("houLegend").innerHTML=`<span><i style="background:var(--dem)"></i>Dem won ${cD}</span><span><i style="background:var(--neutral)"></i>Not yet called ${435-cD-cR}</span><span><i style="background:var(--rep)"></i>GOP won ${cR}</span><span>Average outcome: <b class="num" style="color:var(--dem)">D ${Math.round(hc.exp)}</b> · <b class="num" style="color:var(--rep)">R ${435-Math.round(hc.exp)}</b></span>`;
    mkRow("senMk","senate");mkRow("houMk","house");
    $("houPD").textContent=pct(hc.p);$("houPR").textContent=pct(1-hc.p);$("houBD").style.width=hc.p*100+"%";$("houBR").style.width=(1-hc.p)*100+"%";
  }
  function mkRow(id,k){
    const c=MK&&MK.control&&MK.control[k];const el=$(id);if(!el)return;
    const part=(nm,o)=>o&&o.D!=null?`<span>${nm} <b>${pct(o.D/((o.D||0)+(o.R!=null?o.R:1-o.D)))}</b> Dem</span>`:`<span>${nm} <b>—</b></span>`;
    el.innerHTML=`<span class="mlbl">Markets</span>`+part("Kalshi",c&&c.kalshi)+part("Polymarket",c&&c.polymarket)+(MK&&(MK.livePM||MK.updatedAt)?`<span class="muted">as of ${ct(Math.max(MK.livePM||0,MK.updatedAt||0))}</span>`:"");
  }
  function renderMap(){
    const items=senateItems(r=>model(r));const by={};items.forEach(it=>by[it.st]=it);
    (meta&&meta.senateCalled||[]);
    const host=$("tilemap");host.innerHTML="";
    TILES.forEach(([st,c,r])=>{
      const it=by[st];const b=document.createElement(it&&!it.safe?"button":"div");b.className="tile"+(it&&!it.safe?" up":"");b.style.gridColumn=(c+1);b.style.gridRow=(r+1);
      if(it){const bg=tint(it.pD,it.pR,it.locked);b.style.background=bg;b.style.color=(bg==="var(--dem)"||bg==="var(--rep)"||bg==="var(--ind)")?"#fff":"var(--fg)";
        const hcT=it.race?hilltopCall(it.race):null;const fp=it.locked?"✓":hcT!=null?"◆":pct(Math.max(it.pD,it.pR));b.innerHTML=`${st}<small>${it.safe?"":fp}</small>`;
        if(!it.safe){b.setAttribute("aria-label",st+" Senate race");b.addEventListener("click",()=>{group=group==="all"||group==="senate"?group:"senate";renderSections();const t=document.getElementById("race-"+it.race.id);if(t)t.scrollIntoView({behavior:"smooth",block:"start"})})}
        b.title=st+(it.safe?" · Safe "+it.fav:"");
      }else{b.textContent=st;}
      host.appendChild(b);
    });
  }
  // Hilltop's own projection: separate from AP calls, conservative, and must hold across the last two counts.
  const HC={p:0.99,r:0.8,mk:0.9};
  function hcCheck(race,snap){
    const m=model(race,snap);if(m.mode!=="live")return null;const L=m.est.leader;if(m.probs[L]<HC.p||(snap?snap.r:race.r)<HC.r)return null;return L}
  function hilltopCall(race){
    if(race.called!=null)return null;
    const now=hcCheck(race);if(now==null)return null;
    const sn=(race.snaps||[]).slice().sort((a,b)=>a.t-b.t);
    if(sn.length>=2){const prev=hcCheck(race,sn[sn.length-2]);if(prev!==now)return null}
    const [k,pm]=mkP(race);const lp=x=>x==null?null:(now===0?x:1-x);
    for(const x of [lp(k),lp(pm)])if(x!=null&&x<HC.mk)return null;
    return now;
  }
  function raceTable(race,sec){
    const m=model(race);const tot=race.votes?race.votes.reduce((a,b)=>a+(b||0),0):0;const r=race.r||0;
    const wp=race.called!=null?race.cands[race.called].p:null;
    const art=document.createElement("article");art.className="rt";art.id="race-"+race.id;
    const stKey=STATE[race.id]||GOVST[race.id]||(race.groups.includes("texas")||race.groups.includes("dfw")?"TX":null);
    let status;
    const hc=hilltopCall(race);
    if(race.called!=null)status=`<span class="status won-${wp}">${esc(last(race.cands[race.called].n))} wins ✓ <small>AP</small></span>`;
    else if(hc!=null)status=`<span class="status hcall" style="color:${PC[race.cands[hc].p]}">◆ Hilltop projects ${esc(last(race.cands[hc].n))}</span>`;
    else if(false){}
    else if(m.mode==="live"){const L=m.est.leader,lp=m.probs[L];status=lp>=0.7?`<span class="status lean" style="color:${PC[race.cands[L].p]}">${lp>=0.9?"Likely":"Leaning"} ${esc(last(race.cands[L].n))}</span>`:`<span class="status">Too close to call</span>`}
    else status=`<span class="status">${stKey&&CLOSES[stKey]?"Polls close "+CLOSES[stKey]:"Awaiting results"}</span>`;
    const ttl=(sec==="texas"&&race.id==="sen-tx")?"U.S. Senate":(sec==="texas"&&race.id==="tx-gov")?"Governor":race.title;const sb=(sec==="texas"&&(race.id==="sen-tx"||race.id==="tx-gov"))?"Texas statewide":(race.sub||"");
    const head=`<header><div><h3>${esc(ttl)}</h3><div class="office">${esc(sb)}${race.rating?" · "+esc(race.rating):""}</div></div>${status}</header>`;
    const order=race.cands.map((c,i)=>i);if(tot)order.sort((a,b)=>(race.votes[b]||0)-(race.votes[a]||0));
    const live=tot>0;
    let rows="";
    order.forEach(i=>{const c=race.cands[i];const v=race.votes?race.votes[i]:null;const share=live?(v||0)/tot*100:null;const win=race.called===i;
      const third=live?`<td class="vt num">${fmt(v)}</td>`:"";
      const val=live?share.toFixed(1)+"%":(m.probs?pct(m.probs[i]):"—");
      const w=live?share:(m.probs?m.probs[i]*100:0);
      rows+=`<tr class="${win?"win":""}"><td class="c"><span class="sw" style="background:${PC[c.p]}"></span><span class="nm">${esc(c.n)} <em>${c.p==="D"?"Dem.":c.p==="R"?"Rep.":"Ind."}${c.inc?" · Incumbent":""}</em>${win?`<span class="check" style="color:${PC[c.p]}">✓</span>`:""}</span></td>${third}<td class="pc num">${val}<div class="pbar"><i style="width:${w}%;background:${PC[c.p]};opacity:${live?1:.55}"></i></div></td></tr>`});
    const thead=live?`<tr><th>Candidate</th><th>Votes</th><th>Pct.</th></tr>`:`<tr><th>Candidate</th><th>${m.probs?"Chance to win":""}</th></tr>`;
    let foot="";
    if(live){foot=`<div class="rfoot"><span class="rep"><span class="meter"><i style="width:${r*100}%"></i></span>Est. ${Math.round(r*100)}% of votes counted</span>`;
      if(m.mode==="live"){const L=m.est.leader;foot+=`<span class="wp">Win chance: <b style="color:${PC[race.cands[L].p]}">${esc(last(race.cands[L].n))} ${pct(m.probs[L])}</b></span>`}
      foot+=`</div>`;
      if(m.mode==="live"&&r<0.995){const L=m.est.leader;foot+=`<div class="note">Desk estimate of final margin: ${esc(last(race.cands[L].n))} +${Math.abs(m.est.margin).toFixed(1)} points, with roughly ${fmt(Math.round((tot/r-tot)/1000)*1000)} votes left to count.</div>`}
    }else{foot=`<div class="rfoot"><span>${m.probs?"Hilltop forecast: "+(typeof race.pre==="number"?"Decision Desk HQ":race.rating?"race rating":"")+(mkP(race).some(x=>x!=null)?(race.pre!=null||race.rating?" + ":"")+"prediction markets":""):"No published forecast for this race"}</span></div>`}
    {const [k,p]=mkP(race);const c0=race.cands[0];if(k!=null||p!=null)foot+=`<div class="mline"><span class="mlbl">Markets</span>${k!=null?`<span>Kalshi: ${esc(last(c0.n))} <b>${pct(k)}</b></span>`:""}${p!=null?`<span>Polymarket: ${esc(last(c0.n))} <b>${pct(p)}</b></span>`:""}</div>`}
    if(race.groups.includes("texas")&&race.called==null){const P=project(race);if(P.total&&P.mode!=="none"){foot+=`<div class="mline"><span class="mlbl">Projected</span><span>${esc(last(race.cands[0].n))} ≈ <b>${fmtM(P.total*P.s0/100)}</b> (${P.s0.toFixed(1)}%)</span><span>${esc(last(race.cands[1].n))} ≈ <b>${fmtM(P.total*P.s1/100)}</b> (${P.s1.toFixed(1)}%)</span></div>`}}
    if(race.note)foot+=`<div class="note">${esc(race.note)}</div>`;
    art.innerHTML=head+`<table><thead>${thead}</thead><tbody>${rows}</tbody></table>`+foot;
    return art;
  }
  function renderSections(){
    document.querySelectorAll("nav.sections button").forEach(t=>t.setAttribute("aria-selected",String(t.dataset.g===group)));
    const host=$("sections");host.innerHTML="";
    if(!races.length){host.innerHTML=`<div class="empty">Race results will appear here as soon as the results desk loads.</div>`;return}
    SECTIONS.filter(s=>group==="all"||s.g===group).forEach(s=>{
      let list=races.filter(x=>x.groups.includes(s.g)).sort((a,b)=>(a.order||0)-(b.order||0));
      if(s.g==="governor")list=list.sort((a,b)=>(a.id==="tx-gov"?-1:b.id==="tx-gov"?1:(a.order||0)-(b.order||0)));
      if(!list.length)return;
      const sec=document.createElement("section");
      const called=list.filter(x=>x.called!=null).length;
      const proj=list.filter(x=>hilltopCall(x)!=null).length;
      sec.innerHTML=`<div class="sechead"><h2>${s.t}</h2><span>${called} of ${list.length} called by AP${proj?` · ${proj} projected by Hilltop`:""}</span></div><p class="secdek">${s.p}</p>`;
      const g=document.createElement("div");g.className="results";list.forEach(x=>g.appendChild(raceTable(x,s.g)));sec.appendChild(g);host.appendChild(sec);
    });
  }
  function renderChart(){
    const box=$("oddsChart");
    const hist=((MK&&MK.history)||[]).filter(h=>h.t);
    const series=[]; // {name,color,dash,pts:[[t,p]]}
    const norm=(d)=>d;
    const S=(k,name,color,dash)=>{const pts=hist.filter(h=>h[k]!=null).map(h=>[h.t,h[k]]);if(pts.length)series.push({name,color,dash,pts})};
    S("sk","Senate · Kalshi","var(--dem)",false);S("sp","Senate · Poly","var(--dem)",true);
    S("hk","House · Kalshi","var(--smu-red)",false);S("hp","House · Poly","var(--smu-red)",true);
    // desk line once results exist
    const times=new Set();races.forEach(r=>(r.snaps||[]).forEach(s=>times.add(s.t)));
    const ts=[...times].sort((a,b)=>a-b);
    if(ts.length){const pre={v:null,r:0,called:null};const pts=ts.map(t=>{const at=r=>{const ss=(r.snaps||[]).filter(s=>s.t<=t);return model(r,ss.length?ss.reduce((a,b)=>a.t>b.t?a:b):pre)};return[t,senateControl(at).p]});series.push({name:"Senate · Hilltop",color:"var(--fg)",dash:false,pts,thick:true})}
    if(!series.length){box.innerHTML=`<p class="note">Market history will appear after the first automatic update.</p>`;return}
    let t0=Infinity,t1=-Infinity;series.forEach(s=>s.pts.forEach(([t])=>{t0=Math.min(t0,t);t1=Math.max(t1,t)}));if(t1-t0<36e5){t0=t1-36e5}
    const W=Math.max(480,box.clientWidth||480),H=240,L=50,Rp=130,T=12,B=30;
    const x=t=>L+(t-t0)/(t1-t0)*(W-L-Rp),y=p=>T+(1-p)*(H-T-B);
    const font='font-family="Libre Franklin,Arial,sans-serif" font-size="11"';
    let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chance Democrats control each chamber over time">`;
    [0,0.25,0.5,0.75,1].forEach(g=>{const lab=g===0.5?"Even":g>0.5?"D "+g*100+"%":"R "+(100-g*100)+"%";const col=g===0.5?"var(--muted)":g>0.5?"var(--dem)":"var(--rep)";svg+=`<line x1="${L}" x2="${W-Rp}" y1="${y(g)}" y2="${y(g)}" stroke="${g===0.5?"var(--neutral-2)":"var(--rule)"}" ${g===0.5?'stroke-width="1.5"':""}/><text x="${L-6}" y="${y(g)+4}" text-anchor="end" ${font} fill="${col}">${lab}</text>`});
    const labels=[];
    series.forEach(s=>{const d=s.pts.map(([t,p],i)=>(i?"L":"M")+x(t).toFixed(1)+" "+y(p).toFixed(1)).join("");
      svg+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.thick?3:2}" ${s.dash?'stroke-dasharray="5 4"':""} stroke-linejoin="round"/>`;
      const [lt,lp]=s.pts[s.pts.length-1];svg+=`<circle cx="${x(lt)}" cy="${y(lp)}" r="3.5" fill="${s.color}"/>`;labels.push({y:y(lp),s,lp})});
    labels.sort((a,b)=>a.y-b.y);for(let i=1;i<labels.length;i++)if(labels[i].y-labels[i-1].y<13)labels[i].y=labels[i-1].y+13;
    labels.forEach(l=>svg+=`<text x="${W-Rp+8}" y="${l.y+4}" ${font} font-weight="700" fill="${l.s.color}">${l.s.name} ${pct(l.lp)}</text>`);
    const dfmt=t=>new Date(t).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",timeZone:"America/Chicago"});
    svg+=`<text x="${L}" y="${H-9}" ${font} fill="var(--muted)">${dfmt(t0)}</text><text x="${W-Rp}" y="${H-9}" text-anchor="end" ${font} fill="var(--muted)">${dfmt(t1)}</text>`;
    box.innerHTML=svg+"</svg>";
  }

  // ---------- projections ----------
  const fmtM=n=>n==null?"—":n>=1e6?(n/1e6).toFixed(2)+"M":n>=1e3?Math.round(n/1e3)+"K":Math.round(n)+"";
  function txTurnout(){
    const t=meta&&meta.turnout&&meta.turnout.tx;if(!t)return null;
    const left=Math.max(0,t.evDays-t.evDay),pace=t.ev/t.evDay;
    const evFinal=t.ev+pace*left*1.05,evLo=t.ev+pace*left*0.85,evHi=t.ev+pace*left*1.25;
    const share=t.ev2022/t.total2022; // 2022: share of all votes cast early
    return{t,evFinal,total:evFinal/share,lo:evLo/Math.min(.8,share+.06),hi:evHi/Math.max(.55,share-.06),share};
  }
  function outsideFor(race){
    const auto=(MK&&MK.outside&&MK.outside[race.id])||null,man=(meta&&meta.outside&&meta.outside[race.id])||[];
    const norm=o=>{if(!o)return null;if(o.c0)return o;const R=o.ranges||[];const f=c=>{const r=R.find(x=>x.name.toLowerCase().includes(last(c.n).toLowerCase()));return r?[r.lo,r.hi]:null};const c0=race.cands[0]?f(race.cands[0]):null,c1=race.cands[1]?f(race.cands[1]):null;return c0&&c1?{...o,c0,c1}:null};
    if(auto){const a=norm(auto);if(a)return[a,...man.filter(m=>m.src!==a.src)]}
    return man;
  }
  function project(race){
    const m=model(race);const n=race.cands.length;const tot=race.votes?race.votes.reduce((a,b)=>a+(b||0),0):0;const r=race.r||0;
    const statewide=race.groups.includes("texas");
    if(m.mode==="called"||(tot&&r>=0.995)){const sh=race.votes.map(v=>(v||0)/tot*100);return{mode:"final",s0:sh[0],s1:sh[1],lo:sh[0],hi:sh[0],total:tot,tlo:tot,thi:tot,m}}
    if(m.mode==="live"){
      const L=m.est.leader;const m0=(L===0?1:L===1?-1:0)*m.est.margin;const sd=Math.sqrt(Math.pow((1-r)*(7+6*r),2)+0.25);
      const total=tot/r;return{mode:"live",s0:50+m0/2,s1:50-m0/2,lo:50+(m0-1.645*sd)/2,hi:50+(m0+1.645*sd)/2,total,tlo:total*(1-(1-r)*0.12),thi:total*(1+(1-r)*0.12),m}
    }
    const p=prior(race);if(p==null)return{mode:"none",m};
    let m0=probit(p)*7;const tt=statewide?txTurnout():null;
    const outs=outsideFor(race);
    const sh=outs.filter(o=>o.c0&&o.c1).map(o=>{const a=(o.c0[0]+o.c0[1])/2,b=(o.c1[0]+o.c1[1])/2;return (a-b)/(a+b)*100});
    if(sh.length)m0=(m0+sh.reduce((x,y)=>x+y,0))/(1+sh.length);
    let total=tt?tt.total:null,tlo=tt?tt.lo:null,thi=tt?tt.hi:null;
    const ot=outs.map(o=>o.turnout).filter(Boolean);
    if(ot.length){const all=(total?[total]:[]).concat(ot);total=all.reduce((x,y)=>x+y,0)/all.length;tlo=Math.min(tlo||Infinity,...ot);thi=Math.max(thi||0,...ot)}
    return{mode:"pre",s0:50+m0/2,s1:50-m0/2,lo:50+(m0-1.645*7)/2,hi:50+(m0+1.645*7)/2,total,tlo,thi,m,outs};
  }
  let projId="sen-tx";try{const s=localStorage.getItem("hed-proj");if(s)projId=s}catch(e){}
  function renderProj(){
    const sel=$("projSel");if(!races.length)return;
    if(!sel.options.length||sel.options.length!==races.length){
      const order=[...races].sort((a,b)=>{const g=x=>x.groups.includes("texas")?0:x.groups.includes("senate")?1:x.groups.includes("governor")?2:3;return g(a)-g(b)||(a.order||0)-(b.order||0)});
      sel.innerHTML=order.map(r=>{const lab=r.groups.includes("texas")&&(r.id==="sen-tx"||r.id==="tx-gov")?("Texas "+(r.id==="sen-tx"?"U.S. Senate":"Governor")):r.groups.includes("texas")?"Texas "+r.title:r.groups.includes("dfw")?r.title+" (U.S. House)":r.title+" "+(r.groups.includes("senate")?"Senate":"Governor");return`<option value="${r.id}">${esc(lab)}</option>`}).join("");
      sel.onchange=()=>{projId=sel.value;try{localStorage.setItem("hed-proj",projId)}catch(e){}renderProj()};
    }
    const race=races.find(r=>r.id===projId)||races.find(r=>r.id==="sen-tx")||races[0];sel.value=race.id;
    const P=project(race);const c0=race.cands[0],c1=race.cands[1];
    $("projTitle").textContent=sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].text:race.title;
    {const h=hilltopCall(race);if(h!=null&&P.mode==="live")$("projBasis").textContent="◆ Hilltop projects "+race.cands[h].n+" · AP has not called this race";else $("projBasis").textContent=P.mode==="live"?"Live projection from votes counted so far":P.mode==="final"?"Final count":"Before votes are counted: Hilltop forecast and early-vote turnout";}
    if(P.mode==="none"){$("projNames").innerHTML="";$("projBar").innerHTML="";$("projStats").innerHTML="";$("projNote").textContent="No published forecast or market for this race yet. A projection appears once votes are counted.";return}
    const v0=P.total!=null?P.total*P.s0/100:null,v1=P.total!=null?P.total*P.s1/100:null;
    $("projNames").innerHTML=`<div class="pn"><div class="pv" style="color:${PC[c0.p]}">${P.s0.toFixed(1)}%</div><div class="pl">${esc(c0.n)} (${c0.p})</div><div class="pc">${v0!=null?"≈ "+fmtM(v0)+" votes":""}</div></div><div class="pn"><div class="pv" style="color:${PC[c1.p]}">${P.s1.toFixed(1)}%</div><div class="pl">${esc(c1.n)} (${c1.p})</div><div class="pc">${v1!=null?"≈ "+fmtM(v1)+" votes":""}</div></div>`;
    const X=s=>Math.max(0,Math.min(100,(s-40)/20*100)); // 40–60% scale
    const split=X(P.s0),bl=X(Math.min(P.lo,P.hi)),bh=X(Math.max(P.lo,P.hi));
    $("projBar").innerHTML=`<div class="a" style="left:0;width:${split}%;background:${PC[c0.p]}"></div><div class="b" style="left:${split}%;right:0;background:${PC[c1.p]}"></div>${P.mode!=="final"?`<div class="band" style="left:${bl}%;width:${Math.max(.5,bh-bl)}%" title="90% range"></div>`:""}<div class="mid"></div>`;
    const [k,pm]=mkP(race);const wp=P.m.probs?P.m.probs[0]:null;
    const lead=P.s0>=P.s1?c0:c1,mg=Math.abs(P.s0-P.s1);
    let st=`<div><div class="k">Projected margin</div><div class="v" style="color:${PC[lead.p]}">${esc(last(lead.n))} +${mg.toFixed(1)}</div><div class="s">90% range: ${esc(last(c0.n))} ${(Math.min(P.lo,P.hi)*2-100>=0?"+":"")}${(Math.min(P.lo,P.hi)*2-100).toFixed(1)} to ${(Math.max(P.lo,P.hi)*2-100>=0?"+":"")}${(Math.max(P.lo,P.hi)*2-100).toFixed(1)}</div></div>`;
    st+=`<div><div class="k">Projected turnout</div><div class="v">${P.total!=null?fmtM(P.total):"—"}</div><div class="s">${P.total!=null?(P.mode==="final"?"Final count":fmtM(P.tlo)+" – "+fmtM(P.thi)):"Turnout projection is available for Texas statewide races"}</div></div>`;
    st+=`<div><div class="k">Win chance · ${esc(last(c0.n))}</div><div class="v">${wp!=null?pct(wp):"—"}</div><div class="s">${k!=null?"Kalshi "+pct(k):""}${k!=null&&pm!=null?" · ":""}${pm!=null?"Polymarket "+pct(pm):""}</div></div>`;
    if(P.mode==="live")st+=`<div><div class="k">Counted so far</div><div class="v">${Math.round((race.r||0)*100)}%</div><div class="s">${fmtM(P.m.est.tot)} votes of ≈ ${fmtM(P.total)}</div></div>`;
    const outs=outsideFor(race);
    outs.forEach(o=>{st+=`<div style="grid-column:1/-1"><div class="k">${esc(o.src)} · ${esc(o.basis||"forecast")} (${esc(o.asOf)})</div><div class="v" style="font-size:15px">${o.c0?`<span style="color:${PC[c0.p]}">${esc(last(c0.n))} ${o.c0[0]}–${o.c0[1]}%</span> · <span style="color:${PC[c1.p]}">${esc(last(c1.n))} ${o.c1[0]}–${o.c1[1]}%</span>`:""}${o.rating?` · ${esc(o.rating)}`:""}</div><div class="s">${o.turnout?"Projected turnout ≈ "+fmtM(o.turnout)+" · ":""}<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.by||o.src)}</a></div></div>`});
    $("projStats").innerHTML=st;
    $("projNote").textContent=P.mode==="pre"?"Two-way vote share. Before polls close, the share averages the Hilltop forecast (Decision Desk HQ plus Kalshi and Polymarket)"+(outs.length?" with "+outs.map(o=>o.src).join(", ")+"\u2019s modeled early vote":"")+", and turnout comes from Texas early-vote pace"+(outs.some(o=>o.turnout)?" averaged with outside turnout projections":"")+". The hatched band is the 90% range.":P.mode==="live"?"Two-way vote share, updated with every results report. The hatched band is the 90% range; it narrows as more of the vote is counted.":"Final two-way vote share.";
  }
  function renderEV(){
    const box=$("evCard");const T=meta&&meta.turnout;if(!T||!T.tx){box.innerHTML="";return}
    const t=T.tx,tt=txTurnout(),d=T.dallas;
    const pctReg=t.ev/t.reg;const projPct=tt.total/t.reg;
    let h=`<h3>Texas early vote</h3><div class="evbig">${t.ev.toLocaleString("en-US")}</div><div class="evsub">ballots cast through ${esc(t.asOf)}, day ${t.evDay} of ${t.evDays} · ${(pctReg*100).toFixed(1)}% of ${(t.reg/1e6).toFixed(1)}M registered voters</div>`;
    h+=`<div class="evbar" role="img" aria-label="Early vote versus projected turnout"><b style="left:0;width:${Math.min(100,projPct*100)}%"></b><i style="width:${pctReg*100}%"></i><span class="tick" style="left:${t.total2022/t.reg*100}%" title="2022 total turnout"></span></div>`;
    h+=`<div class="evrow"><span><b style="color:var(--smu-blue)">■</b> Voted early ${(pctReg*100).toFixed(1)}%</span><span><b style="color:var(--dem-3)">■</b> Projected final ${(projPct*100).toFixed(0)}% (≈ ${fmtM(tt.total)})</span><span>| 2022 total: ${fmtM(t.total2022)}</span></div>`;
    h+=`<div class="evblock"><div class="evrow"><span>Early vote already tops all of 2022 early voting (${fmtM(t.ev2022)}).</span></div><div class="evrow" style="margin-top:4px"><span>Projected early total: <b>${fmtM(tt.evFinal)}</b></span><span>Projected Election Day: <b>${fmtM(tt.total-tt.evFinal)}</b></span></div></div>`;
    if(t.hist){const o=Math.max(0,1-t.hist.D-t.hist.R);h+=`<div class="evblock"><div class="mlbl">Early voters by past primary (${esc(t.hist.asOf)})</div><div class="evsplit"><div style="width:${t.hist.D*100}%;background:var(--dem)"></div><div style="width:${o*100}%;background:var(--neutral-2)"></div><div style="width:${t.hist.R*100}%;background:var(--rep)"></div></div><div class="evrow"><span>Dem. primary ${Math.round(t.hist.D*100)}%</span><span>Neither ${Math.round(o*100)}%</span><span>GOP primary ${Math.round(t.hist.R*100)}%</span></div><p class="note">Texas has no party registration. This shows which primary early voters last took part in, not how they voted.</p></div>`}
    if(d)h+=`<div class="evblock"><div class="evrow"><span><b>${esc(d.label)}</b></span><span>${d.ev.toLocaleString("en-US")} early ballots</span></div><div class="evbar"><i style="width:${d.regPct*100}%"></i><span class="tick" style="left:${d.regPct2022*100}%"></span></div><div class="evrow"><span>${(d.regPct*100).toFixed(1)}% of registered voters</span><span>| Same point in 2022: ${(d.regPct2022*100).toFixed(1)}%</span></div></div>`;
    box.innerHTML=h;
  }

  // ---------- range of outcomes (both parties treated the same) ----------
  function outcomeBlock(title,rows,svg,foot){return`<h2>${title}</h2>${rows}<div class="svgwrap">${svg}</div><p class="note">${foot}</p>`}
  function partyRow(party,p,most,lo,hi,word){const c=party==="D"?"var(--dem)":"var(--rep)";return`<div class="orow"><span class="oname" style="color:${c}">${party==="D"?"Democrats":"Republicans"}</span><span class="opct num" style="color:${c}">${pct(p)}</span><span class="odesc">${word} · typical result <b class="num">${most}</b> seats · 80% range <b class="num">${lo}–${hi}</b></span></div>`}
  function quant(arr,q){ // arr: [[value,weight]] sorted by value
    const tot=arr.reduce((a,b)=>a+b[1],0);let acc=0;for(const [v,w] of arr){acc+=w;if(acc>=q*tot)return v}return arr.length?arr[arr.length-1][0]:0}
  function histSVG(bins,labelFn,markIdx){
    const W=Math.max(420,($("outSen").clientWidth||520)),H=150,L=8,Rr=8,T=10,B=34;const n=bins.length;const bw=(W-L-Rr)/n;const mx=Math.max(...bins.map(b=>b.p),0.001);
    let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Probability of each seat outcome">`;
    bins.forEach((b,i)=>{const h=(H-T-B)*b.p/mx;const x=L+i*bw;s+=`<rect x="${(x+1).toFixed(1)}" y="${(H-B-h).toFixed(1)}" width="${Math.max(1,bw-2).toFixed(1)}" height="${h.toFixed(1)}" fill="${b.ctrl==="D"?"var(--dem)":"var(--rep)"}" opacity="${b.p<0.002?0.35:1}"><title>${labelFn(b)}: ${(b.p*100).toFixed(1)}%</title></rect>`});
    s+=`<line x1="${L}" x2="${W-Rr}" y1="${H-B}" y2="${H-B}" stroke="var(--rule-strong)"/>`;
    if(markIdx!=null){const x=L+markIdx*bw;s+=`<line x1="${x}" x2="${x}" y1="${T}" y2="${H-B+4}" stroke="var(--rule-strong)" stroke-dasharray="3 3"/>`}
    const step=Math.max(1,Math.ceil(n/8));bins.forEach((b,i)=>{if(i%step)return;const x=L+i*bw+bw/2;s+=`<text x="${x}" y="${H-B+14}" text-anchor="middle" font-family="Libre Franklin,Arial,sans-serif" font-size="10.5" fill="var(--dem)">${b.dl}</text><text x="${x}" y="${H-B+27}" text-anchor="middle" font-family="Libre Franklin,Arial,sans-serif" font-size="10.5" fill="var(--rep)">${b.rl}</text>`});
    return s+"</svg>";
  }
  function renderOutcomes(){
    if(!$("outSen"))return;
    // Senate
    const s=senateControl(r=>model(r));const need=s.need;
    const outs=Object.entries(s.dist).map(([k,c])=>{const [d,i]=k.split("|").map(Number);return{d,i,r:100-d-i,p:c/s.N}});
    const dWin=outs.filter(o=>o.d>=need),rWin=outs.filter(o=>o.d<need);
    const agg=(arr,key)=>{const m={};arr.forEach(o=>m[o[key]]=(m[o[key]]||0)+o.p);return Object.entries(m).map(([v,p])=>[+v,p]).sort((a,b)=>a[0]-b[0])};
    const dA=agg(dWin,"d"),rA=agg(rWin,"r");
    const mode=a=>a.length?quant(a,.5):"—";
    let rows=partyRow("D",s.p,mode(dA),dA.length?quant(dA,.1):"—",dA.length?quant(dA,.9):"—","win control")+partyRow("R",1-s.p,mode(rA),rA.length?quant(rA,.1):"—",rA.length?quant(rA,.9):"—",need===51?"keep control (incl. 50–50 with the VP)":"win control");
    const byD={};outs.forEach(o=>{byD[o.d]=(byD[o.d]||0)+o.p});const ds=Object.keys(byD).map(Number);const lo=Math.min(...ds,need-5),hi=Math.max(...ds,need+5);
    const bins=[];for(let d=lo;d<=hi;d++)bins.push({d,p:byD[d]||0,ctrl:d>=need?"D":"R",dl:"D "+d,rl:"R "+(100-d)});
    $("outSen").innerHTML=outcomeBlock("Senate",rows,histSVG(bins,b=>"Democrats "+b.d+", Republicans and others "+(100-b.d),bins.findIndex(b=>b.d===need)),"Each bar is the chance of that exact seat split, from 4,000 simulations. Democratic counts include independents who caucus with them; Republicans hold the chamber at 50–50 through the vice president's tiebreak. Seats won by other independents are counted with neither party.");
    // House
    const h=(meta&&meta.house)||{cD:0,cR:0,projD:218};const hc=houseControl(h)||{p:.5,exp:218};
    let pH=hc.p;if(!(h.cD||h.cR)){const xs=[hc.p];const c=MK&&MK.control&&MK.control.house;[c&&c.kalshi,c&&c.polymarket].forEach(o=>{if(o&&o.D!=null)xs.push(o.D/((o.D||0)+(o.R!=null?o.R:1-o.D)))});pH=xs.reduce((a,b)=>a+b,0)/xs.length}
    const cD=h.cD||0,cR=h.cR||0,rem=435-cD-cR;const sd=Math.max(1,(h.sd0||24.4)*Math.sqrt(rem/435)+0.5);
    const mean=(pH>0.001&&pH<0.999)?217.5+sd*probit(pH):hc.exp;
    const pD=d=>Phi((d+0.5-mean)/sd)-Phi((d-0.5-mean)/sd);
    const dRange=[];for(let d=Math.max(cD,Math.floor(mean-3*sd));d<=Math.min(435-cR,Math.ceil(mean+3*sd));d++)dRange.push(d);
    const dW=dRange.filter(d=>d>=218).map(d=>[d,pD(d)]),rW=dRange.filter(d=>d<218).map(d=>[435-d,pD(d)]).sort((a,b)=>a[0]-b[0]);
    rows=partyRow("D",pH,mode(dW),dW.length?quant(dW,.1):"—",dW.length?quant(dW,.9):"—","win control")+partyRow("R",1-pH,mode(rW),rW.length?quant(rW,.1):"—",rW.length?quant(rW,.9):"—","keep control");
    const bw=5,b0=Math.floor(Math.min(...dRange,198)/bw)*bw,b1=Math.ceil(Math.max(...dRange,238)/bw)*bw;const hb=[];
    for(let a=b0;a<b1;a+=bw){let p=0;for(let d=a;d<a+bw;d++)p+=pD(d);hb.push({a,p,ctrl:a+bw/2>=218?"D":"R",dl:"D "+(a+2),rl:"R "+(435-a-2)})}
    $("outHou").innerHTML=outcomeBlock("House",rows,histSVG(hb,b=>"Democrats "+b.a+"–"+(b.a+bw-1),hb.findIndex(b=>b.a<=218&&218<b.a+bw)),"Bars group outcomes in five-seat ranges. Before results, the spread comes from the Decision Desk HQ seat forecast and the Kalshi and Polymarket odds; on election night it narrows as the AP calls seats.");
  }

  // ---------- Texas counties ----------
  let GEO=null,CR=null,ctyMode="proj",ctySel=null,ctyAuto=true;
  
  async function loadGeo(){if(GEO)return GEO;try{const r=await fetch("data/tx-counties.json?v="+((document.querySelector('meta[name="build"]')||{}).content||""));GEO=await r.json()}catch(e){GEO=null}return GEO}
  const lgt=p=>Math.log(p/(1-p)),sig=x=>1/(1+Math.exp(-x));
  function ctyModel(){
    if(!GEO)return null;const cs=Object.values(GEO.counties);let v=0,g=0;
    cs.forEach(c=>{const pr=(50+c.m/2)/100;g+=c.v*pr;v+=c.v});
    const m24=(2*g/v-1)*100;
    const race=races.find(r=>r.id==="sen-tx");const P=race?project(race):null;
    const m26=P&&P.mode!=="none"?(P.s1-P.s0)*(race.cands[1].p==="R"?1:-1):m24; // R minus D
    const target=(50+m26/2)/100;
    // proportional (logit) swing: one shift on the log-odds scale so counties' weighted total hits the statewide target
    const at=dl=>cs.reduce((a,c)=>a+c.v*sig(lgt(Math.min(.995,Math.max(.005,(50+c.m/2)/100)))+dl),0)/v;
    let lo=-4,hi=4;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(at(mid)<target)lo=mid;else hi=mid}
    const dl=(lo+hi)/2;
    const tt=txTurnout();const T26=P&&P.total?P.total:(tt?tt.total:v);
    return{m24,m26,shift:m26-m24,dl,scale:T26/v,T26,live:P&&P.mode==="live"};
  }
  function actual(id){const x=CR&&CR.counties&&CR.counties[id];if(!x||!(x.d+x.r))return null;return{m:Math.round((x.r-x.d)/(x.d+x.r)*1000)/10,d:x.d,r:x.r,pct:x.pct==null?null:x.pct}}
  function hasResults(){return!!(CR&&CR.counties&&Object.keys(CR.counties).length)}
  function proj26(c,M){const p=Math.min(.995,Math.max(.005,(50+c.m/2)/100));return Math.round((2*sig(lgt(p)+M.dl)-1)*1000)/10}
  const mfmt=m=>m===0?"Even":(m>0?"R+":"D+")+Math.abs(m).toFixed(1);
  const mcol=m=>m>0?"var(--rep)":"var(--dem)";
  function fillFor(c,M,evMap){
    if(ctyMode==="res"){const a=actual(c.id);if(!a)return["var(--neutral)",1];return[mcol(a.m),.12+.88*Math.min(Math.abs(a.m),60)/60]}
    if(ctyMode==="ev"){const e=evMap[c.id];if(!e)return["var(--neutral)",1];const g=(e.regPct-e.regPct2022)*100;return["var(--smu-blue)",Math.max(.15,Math.min(1,g/14))]}
    const m=ctyMode==="y24"?c.m:proj26(c,M);
    return[mcol(m),.12+.88*Math.min(Math.abs(m),60)/60];
  }
  async function renderCounties(){
    const svg=$("txMap");if(!svg)return;await loadGeo();if(!GEO){svg.outerHTML='<p class="note">County map could not load.</p>';return}
    const M=ctyModel();const T=meta&&meta.turnout&&meta.turnout.counties;const evMap={};(T&&T.list||[]).forEach(x=>evMap[x.fips]=x);
    const RES=hasResults();$("mode-res").hidden=!RES;if(RES&&ctyAuto)ctyMode="res";if(!RES&&ctyMode==="res")ctyMode="proj";
    document.querySelectorAll(".seg-ctl button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.mode===ctyMode)));
    svg.setAttribute("viewBox",`0 0 ${GEO.w} ${GEO.h}`);
    let s="";
    for(const [id,c] of Object.entries(GEO.counties)){const [col,op]=fillFor({...c,id},M,evMap);s+=`<path d="${c.d}" data-id="${id}" fill="${col}" fill-opacity="${op.toFixed(2)}" class="${id===ctySel?"sel":""}"/>`}
    const LB=[["48201","Harris",0,0],["48029","Bexar",0,0],["48453","Travis",0,0],["48141","El Paso",14,-14],["48215","Hidalgo",0,0],["48303","Lubbock",0,0],["48113","Dallas",30,-18],["48439","Tarrant",-34,-18]];
    for(const [id,nm,dx,dy] of LB){const c=GEO.counties[id];if(!c)continue;const x=c.c[0]+dx,y=c.c[1]+dy;if(dx||dy)s+=`<line x1="${c.c[0]}" y1="${c.c[1]}" x2="${x}" y2="${y+3}" stroke="var(--fg)" stroke-width=".8"/>`;s+=`<text class="lbl" x="${x}" y="${y}" text-anchor="middle">${nm}</text>`}
    svg.innerHTML=s;
    const tip=$("mapTip");
    const show=(e,id)=>{const c=GEO.counties[id];if(!c)return;const ev=evMap[id];const m26=proj26(c,M);const T26=c.v*M.scale;const rv=T26*(50+m26/2)/100,dv=T26-rv;
      tip.innerHTML=(()=>{const a=actual(id);return a?`<b>${esc(c.n)} County</b><br>Result: <span class="mg" style="color:${mcol(a.m)}">${mfmt(a.m)}</span>${a.pct!=null?` · ${Math.round(a.pct*100)}% counted`:""}<br>${a.d.toLocaleString("en-US")} D · ${a.r.toLocaleString("en-US")} R<br>`:`<b>${esc(c.n)} County</b><br>`})()+`2024: <span class="mg" style="color:${mcol(c.m)}">${mfmt(c.m)}</span><br>Projected 2026: <span class="mg" style="color:${mcol(m26)}">${mfmt(m26)}</span><br>≈ ${fmtM(dv)} D · ${fmtM(rv)} R votes`+(ev?`<br>Early ballots: <b>${ev.ev.toLocaleString("en-US")}</b><br>${(ev.regPct*100).toFixed(1)}% of registered (2022: ${(ev.regPct2022*100).toFixed(1)}%)`:"");
      tip.hidden=false;const box=svg.parentElement.getBoundingClientRect();let x=e.clientX-box.left+12,y=e.clientY-box.top+12;if(x+190>box.width)x=Math.max(0,x-200);tip.style.left=x+"px";tip.style.top=y+"px"};
    svg.onmousemove=e=>{const id=e.target.dataset&&e.target.dataset.id;if(id)show(e,id);else tip.hidden=true};
    svg.onmouseleave=()=>{tip.hidden=true};
    svg.onclick=e=>{const id=e.target.dataset&&e.target.dataset.id;if(!id)return;ctySel=ctySel===id?null:id;show(e,id);svg.querySelectorAll("path.sel").forEach(p=>p.classList.remove("sel"));if(ctySel)e.target.classList.add("sel")};
    // legend + notes
    const L=$("ctyLegend");
    if(ctyMode==="ev")L.innerHTML=`<span>Turnout gain vs. 2022</span><span class="ramp">${[.15,.35,.55,.75,1].map(o=>`<i style="background:var(--smu-blue);opacity:${o}"></i>`).join("")}</span><span>+14 pts or more</span><span><i style="display:inline-block;width:10px;height:10px;background:var(--neutral);vertical-align:-1px"></i> Not in sample</span>`;
    else L.innerHTML=`<span style="color:var(--dem);font-weight:700">D+60</span><span class="ramp">${[60,40,20,5].map(m=>`<i style="background:var(--dem);opacity:${(.12+.88*m/60).toFixed(2)}"></i>`).join("")}${[5,20,40,60].map(m=>`<i style="background:var(--rep);opacity:${(.12+.88*m/60).toFixed(2)}"></i>`).join("")}</span><span style="color:var(--rep);font-weight:700">R+60</span>`;
    $("ctyNote").textContent=ctyMode==="res"?`Actual U.S. Senate results by county${CR&&CR.updatedAt?", updated "+ct(CR.updatedAt).replace(/\.$/,""):""}. Gray counties have no votes reported yet. Shading shows the margin among votes counted so far.`:ctyMode==="proj"?`Projected U.S. Senate margin. Each county's 2024 presidential result (statewide R+${M.m24.toFixed(1)}) is swung proportionally toward the ${M.live?"live":"Hilltop"} statewide projection (${mfmt(M.m26)}), a ${Math.abs(M.shift).toFixed(1)}-point statewide swing toward ${M.shift<0?"Democrats":"Republicans"}. Swing counties move the most; real swings will vary. Tap a county for details.`:ctyMode==="y24"?"2024 presidential margin by county (Trump vs. Harris). Tap a county for details.":`How much higher early-vote turnout is than at the same point in 2022, for the ${(T&&T.list||[]).length} largest counties.`;
    $("ctyAsOf").textContent=T?`Early vote through ${T.asOf} (day ${T.evDay} of 12) · projected U.S. Senate margin`:"";
    // table
    if(T){
      let rows=`<thead><tr><th>County</th><th>Early ballots</th><th>% registered</th><th>vs. 2022</th><th>2024</th><th>Proj. 2026</th>${hasResults()?"<th>Result</th>":""}<th>Est. early vote D / R</th></tr></thead><tbody>`;
      T.list.forEach(x=>{const c=GEO.counties[x.fips];if(!c)return;const m26=proj26(c,M);const r=x.ev*(50+m26/2)/100,d=x.ev-r;
        rows+=`<tr data-id="${x.fips}"><td><b>${esc(x.n)}</b></td><td class="num">${x.ev.toLocaleString("en-US")}</td><td class="num">${(x.regPct*100).toFixed(1)}%</td><td class="num" style="color:var(--fg-2)">+${((x.regPct-x.regPct2022)*100).toFixed(1)}</td><td class="mg" style="color:${mcol(c.m)}">${mfmt(c.m)}</td><td class="mg" style="color:${mcol(m26)}">${mfmt(m26)}</td>${hasResults()?(()=>{const a=actual(x.fips);return a?`<td class="mg" style="color:${mcol(a.m)}">${mfmt(a.m)}<div class="s" style="font-weight:400;font-size:11px;color:var(--muted)">${a.pct!=null?Math.round(a.pct*100)+"% in":""}</div></td>`:`<td class="num" style="color:var(--muted)">—</td>`})():""}<td class="num">${fmtM(d)} / ${fmtM(r)}<div class="splitbar"><div style="width:${d/x.ev*100}%;background:var(--dem)"></div><div style="flex:1;background:var(--rep)"></div></div></td></tr>`});
      $("ctyTable").innerHTML=rows+"</tbody>";
      $("ctyTable").onclick=e=>{const tr=e.target.closest("tr[data-id]");if(!tr)return;ctySel=tr.dataset.id;renderCounties();$("txMap").scrollIntoView({behavior:"smooth",block:"center"})};
      $("ctyTblNote").textContent=`Early ballots are in-person votes plus mail ballots received, through ${T.asOf}. Texas has no party registration, so the D/R split is an estimate: it applies each county's projected 2026 margin to its early ballots. Early voters this year lean more Democratic than Election Day voters, so treat it as a rough guide.`;
    }
    renderDallasDaily();
  }
  function renderDallasDaily(){
    const D=meta&&meta.turnout&&meta.turnout.dallasDaily;const box=$("dalChart");if(!D||!box)return;
    const days=D.days;const c26=days.reduce((a,x)=>a+x.y26,0),c24=days.reduce((a,x)=>a+x.y24,0),c22=days.reduce((a,x)=>a+x.y22,0);
    $("dalSum").innerHTML=`<b>${c26.toLocaleString("en-US")}</b> in person through ${esc(D.asOf)} (day ${days.length}), plus ${D.mail.toLocaleString("en-US")} mail ballots. That's ${Math.round(c26/c24*100)}% of 2024's pace and ${Math.round(c26/c22*100)}% of 2022's.`;
    const W=Math.max(320,box.clientWidth||420),H=210,L=38,R=6,T=10,B=30;const mx=Math.max(...days.map(x=>Math.max(x.y26,x.y24,x.y22)))*1.08;
    const gw=(W-L-R)/days.length,bw=Math.min(14,(gw-4)/3);const y=v=>T+(1-v/mx)*(H-T-B);
    let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dallas County early votes by day, 2026 vs 2024 and 2022">`;
    const step=mx>60000?20000:10000;for(let v=0;v<=mx;v+=step)s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/><text x="${L-5}" y="${y(v)+4}" text-anchor="end" font-family="Libre Franklin,Arial,sans-serif" font-size="10.5" fill="var(--muted)">${v/1000}K</text>`;
    days.forEach((x,i)=>{const gx=L+i*gw+(gw-bw*3-2)/2;[["y22","var(--rule)"],["y24","var(--neutral-2)"],["y26","var(--smu-blue)"]].forEach(([k,col],j)=>{const v=x[k];s+=`<rect x="${(gx+j*(bw+1)).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H-B-y(v)).toFixed(1)}" fill="${col}"><title>${x.d} ${k==="y26"?"2026":k==="y24"?"2024":"2022"}: ${v.toLocaleString("en-US")}</title></rect>`});
      const lab=x.d.split(" ");s+=`<text x="${L+i*gw+gw/2}" y="${H-B+13}" text-anchor="middle" font-family="Libre Franklin,Arial,sans-serif" font-size="10" fill="var(--fg-2)">${lab[0]}</text><text x="${L+i*gw+gw/2}" y="${H-B+25}" text-anchor="middle" font-family="Libre Franklin,Arial,sans-serif" font-size="10" fill="var(--muted)">${lab[2]||""}</text>`});
    box.innerHTML=s+"</svg>";
  }
  document.addEventListener("click",e=>{const b=e.target.closest(".seg-ctl button");if(!b)return;ctyMode=b.dataset.mode;ctyAuto=false;renderCounties()});
  function renderAll(){renderStatus();renderBop();renderOutcomes();renderProj();renderEV();renderCounties();renderMap();renderSections();renderChart()}
  document.querySelectorAll("nav.sections button").forEach(t=>t.addEventListener("click",()=>{group=t.dataset.g;try{localStorage.setItem("hed-tab",group)}catch(e){}renderSections();document.getElementById("sections").scrollIntoView({behavior:"smooth",block:"start"})}));
  setInterval(renderStatus,30000);
  let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{renderChart();renderDallasDaily()},200)});
  renderAll();
  const BUILD=(document.querySelector('meta[name="build"]')||{}).content||"";
  async function checkBuild(){try{const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const v=(await r.json()).v;if(BUILD&&v&&v!==BUILD)location.reload()}catch(e){}}
  setInterval(checkBuild,60000);
  const BASE="data/";
  async function load(){
    try{
      const q="?t="+Date.now();
      const [r,m,k,cr]=await Promise.all([fetch(BASE+"races.json"+q,{cache:"no-store"}),fetch(BASE+"meta.json"+q,{cache:"no-store"}),fetch(BASE+"markets.json"+q,{cache:"no-store"}),fetch(BASE+"county-results.json"+q,{cache:"no-store"}).catch(()=>null)]);
      if(!r.ok||!m.ok)throw new Error("HTTP");
      const nr=await r.json(),nm=await m.json(),nk=k.ok?await k.json():MK;const ncr=cr&&cr.ok?await cr.json():CR;
      const sig=JSON.stringify([ncr&&ncr.updatedAt,nm.updatedAt,nk&&nk.updatedAt,nr.length,nr.map(x=>(x.snaps||[]).length+":"+x.called)]);
      if(sig!==load.sig){load.sig=sig;races=nr;meta=nm;MK=nk;CR=ncr;renderAll()}
      lastCheck=Date.now();renderFresh();$("notice").hidden=true;
    }catch(e){const n=$("notice");if(races.length){n.hidden=false;n.textContent="Having trouble reaching the results server. Retrying automatically."}}
  }

  // ---- direct Polymarket polling (every 30s) on top of the 5-minute GitHub feed ----
  const PM="https://gamma-api.polymarket.com/events?slug=";
  const pParty=s=>{s=(s||"").toLowerCase();if(/\bdem|democrat/.test(s))return"D";if(/\brep|republican|gop/.test(s))return"R";if(/independent|\bind\b/.test(s))return"I";return null};
  const pLast=n=>n.split(" ").filter(w=>!/^(III|II|Jr\.?)$/.test(w)).slice(-1)[0].toLowerCase();
  async function pmEvent(slug,cands){
    const r=await fetch(PM+encodeURIComponent(slug),{cache:"no-store"});if(!r.ok)throw 0;
    const arr=await r.json();const e=Array.isArray(arr)?arr[0]:arr;if(!e)return null;const out={src:slug};
    (e.markets||[]).forEach(m=>{if(m.closed)return;let pr;try{pr=JSON.parse(m.outcomePrices||"[]").map(Number)}catch(x){return}const y=pr[0];if(y==null||isNaN(y))return;
      const lab=m.groupItemTitle||m.question||"";const pt=pParty(lab);if(pt)out[pt]=y;(cands||[]).forEach(c=>{if(lab.toLowerCase().includes(pLast(c.n)))out[c.p]=y})});
    return Object.keys(out).length>1?out:null;
  }
  let pmOK=true,pmTick=0;
  async function pmLive(){
    if(!MK||!pmOK||document.hidden)return;
    try{
      const ctl=MK.control||{};let changed=false;
      for(const k of ["senate","house"]){const s=ctl[k]&&ctl[k].polymarket&&ctl[k].polymarket.src;if(!s)continue;const o=await pmEvent(s,[]);if(o){ctl[k].polymarket=o;changed=true}}
      if(pmTick++%2===0&&MK.races){const ids=Object.keys(MK.races);await Promise.all(ids.map(async id=>{const pm=MK.races[id].polymarket;if(!pm||!pm.src)return;const race=races.find(r=>r.id===id);try{const o=await pmEvent(pm.src,race?race.cands:[]);if(o){MK.races[id].polymarket=o;changed=true}}catch(x){}}))}
      if(changed){const now=Date.now();MK.livePM=now;lastCheck=now;(MK.history=MK.history||[]).push({t:now,sk:null,sp:ctl.senate&&ctl.senate.polymarket?ctl.senate.polymarket.D:null,hk:null,hp:ctl.house&&ctl.house.polymarket?ctl.house.polymarket.D:null});renderAll()}
    }catch(x){pmOK=false}
  }
  setInterval(pmLive,30000);setTimeout(pmLive,4000);
  load();setInterval(load,30000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
})();
