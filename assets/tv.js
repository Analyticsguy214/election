(function(){
  "use strict";
  const H=window.HED;const $=id=>document.getElementById(id);const {pct,esc,last}=H;
  const PC={D:"var(--dem)",R:"var(--rep)",I:"var(--ind)"},LIGHT={D:"var(--dem-2)",R:"var(--rep-2)",I:"var(--ind-2)"},PALE={D:"var(--dem-3)",R:"var(--rep-3)",I:"var(--ind-2)"};
  let D=null,panel=0,rpage=0;
  const PANELS=["Senate map","Governor map","House battlegrounds","Texas statewide"];
  // clock + fullscreen
  const tick=()=>{$("tvClock").textContent=new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})+" CT"};tick();setInterval(tick,10000);
  $("tvFull").addEventListener("click",()=>{const el=document.documentElement;if(!document.fullscreenElement){(el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el)}else{(document.exitFullscreen||function(){}).call(document)}});
  try{navigator.wakeLock&&navigator.wakeLock.request("screen").catch(()=>{})}catch(e){}
  function needle(p){const seg=12;let g="";const P=(r,t)=>[100+r*Math.cos(t),100-r*Math.sin(t)];for(let i=0;i<seg;i++){const a0=Math.PI*(1-i/seg),a1=Math.PI*(1-(i+1)/seg);const L=i<seg/2;const op=L?.2+.75*(1-i/(seg/2)):.2+.75*((i-seg/2+1)/(seg/2));const [x0,y0]=P(94,a0),[x1,y1]=P(94,a1),[x2,y2]=P(58,a1),[x3,y3]=P(58,a0);g+=`<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A94,94 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A58,58 0 0 0 ${x3.toFixed(1)},${y3.toFixed(1)}Z" fill="${L?"var(--dem)":"var(--rep)"}" fill-opacity="${op.toFixed(2)}" stroke="#141b38" stroke-width="1.5"/>`}const t=Math.PI*p;g+=`<line x1="100" y1="100" x2="${(100+86*Math.cos(t)).toFixed(1)}" y2="${(100-86*Math.sin(t)).toFixed(1)}" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="#fff"/>`;return`<svg class="needle" viewBox="0 0 200 108" role="img" aria-label="Chance of control">${g}</svg>`}
  const ctlP=k=>{const c=D.MK&&D.MK.control&&D.MK.control[k];const xs=[c&&c.kalshi,c&&c.polymarket].filter(o=>o&&o.D!=null).map(o=>o.D/((o.D||0)+(o.R!=null?o.R:1-o.D)));return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5};
  function cls(r){const L=H.liveP(r,D.MK,D.tx,D.exp);if(L.mode==="called"){const c=r.cands[r.called];return{party:c.p,level:"won",L}}if(L.p==null)return{party:null,level:"toss",L};const lead=L.p>=.5?r.cands[0]:r.cands[1];const q=Math.max(L.p,1-L.p);return{party:lead.p,level:q>=.85?"likely":q>=.6?"lean":"toss",p:q,lead,L}}
  const fillOf=c=>c.level==="won"?PC[c.party]:c.level==="likely"?LIGHT[c.party]:c.level==="lean"?PALE[c.party]:"var(--neutral-2)";
  function renderLeft(){
    const nuD=(D.meta.senate&&D.meta.senate.notUpD)||34,nuR=(D.meta.senate&&D.meta.senate.notUpR)||31;let wD=0,wR=0;
    D.races.filter(r=>r.groups.includes("senate")&&r.called!=null).forEach(r=>{const p=r.cands[r.called].p;if(p==="D")wD++;else if(p==="R")wR++});
    Object.entries(D.meta.senateCalledStates||{}).forEach(([st,p])=>{if((D.meta.senateSafe||[]).some(s=>s.st===st)){if(p==="D")wD++;else wR++}});
    const sp=ctlP("senate"),hp=ctlP("house");const hh=D.meta.house||{};
    const card=(k,t,p,dN,rN,tot,mk,f)=>`<div class="k">${k}</div><h3>${t}</h3>${needle(p)}<div class="nums"><div><div class="n" style="color:var(--dem)">${pct(p)}</div><div class="l">Democrats</div></div><div style="text-align:right"><div class="n" style="color:var(--rep)">${pct(1-p)}</div><div class="l">Republicans</div></div></div><div class="seatbar"><i style="width:${dN/tot*100}%;background:var(--dem)"></i><i style="flex:1"></i><i style="width:${rN/tot*100}%;background:var(--rep)"></i><span class="mk" style="left:${mk/tot*100}%"></span></div><div class="f">${f}</div>`;
    $("tvSen").innerHTML=card("Senate","Chance of control",sp,nuD+wD,nuR+wR,100,50.5,`Seats won: D ${nuD+wD} · R ${nuR+wR} (incl. seats not up) · 51 for Dem. control · odds: prediction markets, live`);
    $("tvHou").innerHTML=card("House","Chance of control",hp,hh.cD||0,hh.cR||0,435,217.5,`AP-called seats: D ${hh.cD||0} · R ${hh.cR||0} · 218 for a majority`);
  }
  function diamonds(S){const cell=60,hd=27.5,W=12*cell+20,Ht=8*cell+20;let s=`<svg viewBox="0 0 ${W} ${Ht}" preserveAspectRatio="xMidYMid meet">`;H.TILES.forEach(([st,c,r])=>{const x=40+c*cell,y=40+r*cell;const d=S[st];const fill=d?fillOf(d):"var(--neutral)";s+=`<path d="M${x},${y-hd} L${x+hd},${y} L${x},${y+hd} L${x-hd},${y}Z" fill="${fill}" ${d?"":'opacity=".45"'} stroke="#0b1024" stroke-width="2"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="${d&&d.level==="won"?"#fff":d?"#eef0f6":"#6b7286"}">${st}</text>`});return s+"</svg>"}
  function renderPanel(){
    const el=$("tvPanel");$("tvPanelTitle").textContent=PANELS[panel];$("tvDots").innerHTML=PANELS.map((_,i)=>`<i class="${i===panel?"on":""}"></i>`).join("");
    let h="";
    if(panel===0){const S={};D.races.filter(r=>r.groups.includes("senate")).forEach(r=>S[H.SEN_ST[r.id]]=cls(r));(D.meta.senateSafe||[]).forEach(s=>{if(S[s.st])return;const c=(D.meta.senateCalledStates||{})[s.st];S[s.st]={party:c||s.fav,level:c?"won":"likely"}});h=diamonds(S)}
    else if(panel===1){const S={};D.races.filter(r=>r.groups.includes("governor")).forEach(r=>S[H.GOV_ST[r.id]]=cls(r));Object.entries(D.meta.govOther||{}).forEach(([st,rt])=>{if(S[st])return;const m=rt.match(/^(Safe|Likely|Lean)\s+([DR])/);S[st]=m?{party:m[2],level:m[1]==="Lean"?"lean":"likely"}:{party:null,level:"toss"}});h=diamonds(S)}
    else if(panel===2){const bg=D.races.filter(r=>r.groups.includes("house"));const cols=["Lean D","Toss-up","Lean R"];const W=760,colW=W/3;let s=`<svg viewBox="0 0 ${W} 520">`;cols.forEach((k,ci)=>{const L=bg.filter(r=>k==="Toss-up"?/Toss/.test(r.rating):r.rating===k);s+=`<text x="${ci*colW+colW/2}" y="24" text-anchor="middle" fill="#eef0f6" style="font-size:16px">${k.toUpperCase()} · ${L.length}</text>`;L.forEach((r,i)=>{const cx=ci*colW+40+(i%4)*((colW-60)/3.4),cy=70+Math.floor(i/4)*84;const c=cls(r);s+=`<path d="M${cx},${cy-26} L${cx+26},${cy} L${cx},${cy+26} L${cx-26},${cy}Z" fill="${fillOf(c)}" stroke="#0b1024" stroke-width="2"/><text x="${cx}" y="${cy+46}" text-anchor="middle" fill="#c4c9d8">${r.title.replace("AK-At Large","AK-AL")}</text>`})});h=s+"</svg>"}
    else{const ids=["sen-tx","tx-gov","tx-ltgov","tx-ag","tx-comp","tx-land","tx-agri","tx-rrc"];const nm={"sen-tx":"U.S. Senate","tx-gov":"Governor","tx-ltgov":"Lt. Governor","tx-ag":"Attorney General","tx-comp":"Comptroller","tx-land":"Land Commissioner","tx-agri":"Agriculture","tx-rrc":"Railroad"};
      h=`<div class="tv-races" style="grid-template-rows:repeat(8,minmax(0,1fr));width:100%;height:100%">`+ids.map(id=>{const r=D.races.find(x=>x.id===id);return r?raceRow(r,"Texas "+nm[id]):""}).join("")+`</div>`}
    el.innerHTML=h;
    $("tvLegend").innerHTML=panel<3?[["D","won","Dem. won"],["D","likely","Dem. likely"],["D","lean","Dem. lean"],[null,"toss","Toss-up"],["R","lean","GOP lean"],["R","likely","GOP likely"],["R","won","GOP won"]].map(([p,l,t])=>`<span><i style="background:${p?fillOf({party:p,level:l}):"var(--neutral-2)"}"></i>${t}</span>`).join(""):"Texas results from the Secretary of State; AP calls marked ✓";
  }
  function raceRow(r,label){const c=cls(r);const L=c.L||{};const v=L.share;const tot=v?v.reduce((a,b)=>a+(b||0),0):0;const c0=r.cands[0],c1=r.cands[1];
    const s0=tot?(v[0]||0)/tot:null,s1=tot?(v[1]||0)/tot:null;const p=L.p;
    const status=c.level==="won"?`<span style="color:${PC[c.party]}">✓ ${esc(last(r.cands[r.called].n))} · AP</span>`:tot?`${Math.round((L.r||0)*100)}% in`:"Forecast";
    const a=tot?(s0*100).toFixed(1)+"%":p!=null?pct(p):"—",b=tot?(s1*100).toFixed(1)+"%":p!=null?pct(1-p):"—";const w=tot?s0/((s0+s1)||1):(p||.5);
    return`<div class="tr" style="border-left-color:${c.level==="won"?PC[c.party]:c.lead?LIGHT[c.lead.p]:"#3a4256"}"><span class="tn">${esc(label)}</span><span class="ts">${status}</span><span class="c"><span style="color:${PC[c0.p]}">${esc(last(c0.n))} ${a}</span><span style="color:${PC[c1.p]}">${esc(last(c1.n))} ${b}</span></span><span class="bar"><i style="width:${w*100}%;background:${PC[c0.p]}"></i><i style="flex:1;background:${PC[c1.p]}"></i></span></div>`}
  function keyList(){const order=["sen-tx","sen-nc","sen-ga","sen-mi","sen-me","sen-oh","sen-ia","sen-ak","sen-ks","sen-nh","sen-sc","sen-ne","tx-gov","gov-ga","gov-az","gov-wi","gov-mi","gov-nv","gov-oh","gov-ia","gov-ks","gov-fl","tx-24","tx-32","h-tx-15","h-tx-35","h-pa-07","h-ny-17","h-pa-01","h-ca-22"];
    const list=order.map(id=>D.races.find(r=>r.id===id)).filter(Boolean);
    // live races first: most votes counted but not called, then called, then forecast
    return list;}
  function renderRight(){const list=keyList();const pages=Math.ceil(list.length/6);rpage%=pages;$("tvRDots").innerHTML=Array.from({length:pages},(_,i)=>`<i class="${i===rpage?"on":""}"></i>`).join("");
    const lbl=r=>r.id==="sen-tx"?"Texas Senate":r.id==="tx-gov"?"Texas Governor":r.groups.includes("senate")?r.title+" Senate":r.groups.includes("governor")?r.title+" Governor":r.title;
    $("tvRaces").innerHTML=list.slice(rpage*6,rpage*6+6).map(r=>raceRow(r,lbl(r))).join("")}
  function renderTicker(){const items=[];const called=D.races.filter(r=>r.called!=null);called.forEach(r=>{const w=r.cands[r.called];items.push(`<span style="color:${PC[w.p]}">✓ AP: ${esc(w.n)} wins ${esc(r.id==="sen-tx"?"Texas Senate":r.title+(r.groups.includes("senate")?" Senate":r.groups.includes("governor")?" governor":""))}</span>`)});
    keyList().forEach(r=>{if(r.called!=null)return;const L=H.liveP(r,D.MK,D.tx,D.exp);if(L.mode==="live"){const lead=L.p>=.5?r.cands[0]:r.cands[1];items.push(`<span>${esc(r.id==="sen-tx"?"Texas Senate":r.title)}: <b style="color:${PC[lead.p]}">${esc(last(lead.n))} ${pct(Math.max(L.p,1-L.p))}</b> to win · ${Math.round((L.r||0)*100)}% in</span>`)}else if(L.p!=null){const lead=L.p>=.5?r.cands[0]:r.cands[1];items.push(`<span>${esc(r.id==="sen-tx"?"Texas Senate":r.title)}: ${esc(last(lead.n))} favored, ${pct(Math.max(L.p,1-L.p))}</span>`)}});
    items.unshift(`<span>Senate control: Dem. ${pct(ctlP("senate"))} · House control: Dem. ${pct(ctlP("house"))} (prediction markets)</span>`);
    const t=$("tvTrack");const html=items.join("");t.innerHTML=html+html}
  function renderAll(){if(!D)return;const st=(D.meta&&D.meta.status)||"pre";$("tvLive").className="live"+(st==="live"?"":" off");$("tvLiveTxt").textContent=st==="live"?"Live":st==="final"?"Results":"Pre-election";
    renderLeft();renderPanel();renderRight();renderTicker()}
  function rot(el,fn){el.classList.add("fade");setTimeout(()=>{fn();el.classList.remove("fade")},450)}
  setInterval(()=>D&&rot($("tvPanel"),()=>{panel=(panel+1)%PANELS.length;renderPanel()}),20000);
  setInterval(()=>D&&rot($("tvRaces"),()=>{rpage++;renderRight()}),12000);
  async function load(){try{D=await H.loadAll();D.exp=H.expTexas(D.meta,D.MK);renderAll()}catch(e){}}
  load();setInterval(load,30000);
})();
