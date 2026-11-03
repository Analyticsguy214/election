(function(){
  "use strict";
  const H=window.HED;const $=id=>document.getElementById(id);const {pct,esc,last}=H;
  let D=null,ch="senate";const h0=(location.hash||"").slice(1);if(["senate","gov","house"].includes(h0))ch=h0;
  const PC={D:"var(--dem)",R:"var(--rep)",I:"var(--ind)"};
  const LIGHT={D:"var(--dem-2)",R:"var(--rep-2)",I:"var(--ind-2)"};
  const PALE={D:"var(--dem-3)",R:"var(--rep-3)",I:"var(--ind-2)"};
  // classify a race: {party, level: won|likely|lean|toss, p}
  function cls(race){
    const L=H.liveP(race,D.MK,D.tx,D.exp);const p=L.p;
    if(L.mode==="called"){const c=race.cands[race.called];return{party:c.p,level:"won",p:1,L}}
    if(p==null)return{party:null,level:"toss",p:null,L};
    const lead=p>=.5?race.cands[0]:race.cands[1];const q=Math.max(p,1-p);
    return{party:lead.p,level:q>=.85?"likely":q>=.6?"lean":"toss",p:q,L,lead};
  }
  const fillOf=c=>c.level==="won"?PC[c.party]:c.level==="likely"?LIGHT[c.party]:c.level==="lean"?PALE[c.party]:"var(--neutral-2)";
  function stateData(){
    const out={};
    if(ch==="senate"){
      D.races.filter(r=>r.groups.includes("senate")).forEach(r=>{out[H.SEN_ST[r.id]]={race:r,c:cls(r)}});
      ((D.meta&&D.meta.senateSafe)||[]).forEach(s=>{const called=(D.meta.senateCalledMap||{})[s.st];out[s.st]=out[s.st]||{safe:true,c:{party:called||s.fav,level:called?"won":"likely",p:s.p},label:"Safe "+s.fav}});
    }else if(ch==="gov"){
      D.races.filter(r=>r.groups.includes("governor")).forEach(r=>{out[H.GOV_ST[r.id]]={race:r,c:cls(r)}});
      Object.entries((D.meta&&D.meta.govOther)||{}).forEach(([st,rt])=>{if(out[st])return;const m=rt.match(/^(Safe|Likely|Lean)\s+([DR])/);out[st]={safe:true,label:rt,c:m?{party:m[2],level:m[1]==="Lean"?"lean":"likely",p:null}:{party:null,level:"toss",p:.5}}});
    }
    return out;
  }
  function renderTally(){
    const el=$("tally");
    if(ch==="senate"){
      const s=stateData();let wD=0,wR=0,wI=0,lD=0,lR=0,tu=0;Object.values(s).forEach(x=>{const c=x.c;if(c.level==="won"){if(c.party==="D")wD++;else if(c.party==="R")wR++;else wI++}else if(c.party==="D"&&c.level!=="toss")lD++;else if(c.party==="R"&&c.level!=="toss")lR++;else tu++});
      const nuD=(D.meta.senate&&D.meta.senate.notUpD)||34,nuR=(D.meta.senate&&D.meta.senate.notUpR)||31;
      el.innerHTML=`<div class="side"><div class="n" style="color:var(--dem)">${nuD+wD}</div><div class="l">Democrats* · ${lD} more leaning</div></div><div class="mid"><b>Senate</b>51 for Democratic control</div><div class="side r"><div class="n" style="color:var(--rep)">${nuR+wR}</div><div class="l">Republicans · ${lR} more leaning</div></div>`+bar([[PALE.D,nuD],[PC.D,wD],[LIGHT.D,lD],[PC.I,wI],["var(--neutral-2)",tu],[LIGHT.R,lR],[PC.R,wR],[PALE.R,nuR]],100,50);
    }else if(ch==="gov"){
      const s=stateData();let wD=0,wR=0,lD=0,lR=0,tu=0;Object.values(s).forEach(x=>{const c=x.c;if(c.level==="won"){c.party==="D"?wD++:wR++}else if(c.party==="D"&&c.level!=="toss")lD++;else if(c.party==="R"&&c.level!=="toss")lR++;else tu++});
      el.innerHTML=`<div class="side"><div class="n" style="color:var(--dem)">${wD}</div><div class="l">Democrats won · ${lD} leaning</div></div><div class="mid"><b>Governors</b>36 races</div><div class="side r"><div class="n" style="color:var(--rep)">${wR}</div><div class="l">Republicans won · ${lR} leaning</div></div>`+bar([[PC.D,wD],[LIGHT.D,lD],["var(--neutral-2)",tu],[LIGHT.R,lR],[PC.R,wR]],36,null);
    }else{
      const hh=D.meta.house||{};const cD=hh.cD||0,cR=hh.cR||0;
      const bg=D.races.filter(r=>r.groups.includes("house"));const won=p=>bg.filter(r=>r.called!=null&&r.cands[r.called].p===p).length;
      const fl=bg.filter(r=>r.called!=null&&((r.held==="R"&&r.cands[r.called].p==="D")||(r.held==="D"&&r.cands[r.called].p==="R"))).length;
      el.innerHTML=`<div class="side"><div class="n" style="color:var(--dem)">${cD}</div><div class="l">Democrats won (all 435)</div></div><div class="mid"><b>House</b>218 for a majority · battlegrounds called: D ${won("D")} · R ${won("R")}${fl?` · ${fl} flipped`:""}</div><div class="side r"><div class="n" style="color:var(--rep)">${cR}</div><div class="l">Republicans won (all 435)</div></div>`+bar([[PC.D,cD],["var(--neutral)",435-cD-cR],[PC.R,cR]],435,217.5);
    }
  }
  function bar(segs,total,mark){return`<div class="bar">${segs.filter(s=>s[1]>0).map(([c,n])=>`<div class="seg" style="flex-basis:${n/total*100}%;background:${c}" title="${n}"></div>`).join("")}${mark!=null?`<span class="mk" style="left:${mark/total*100}%"></span>`:""}</div>`}
  function renderMap(){
    const svg=$("dmap");const board=$("board");
    if(ch==="house"){svg.parentElement.hidden=true;$("dlegend").innerHTML=legend();board.innerHTML=houseBoard();return}
    svg.parentElement.hidden=false;board.innerHTML="";
    const S=stateData();const cell=60,hd=27.5,W=12*cell+20,Ht=8*cell+20;svg.setAttribute("viewBox",`0 0 ${W} ${Ht}`);
    let s="";H.TILES.forEach(([st,c,r])=>{const x=40+c*cell,y=40+r*cell;const d=S[st];const fill=d?fillOf(d.c):"var(--neutral)";const solid=d&&d.c.level==="won";
      s+=`<path class="dm" data-st="${st}" d="M${x},${y-hd} L${x+hd},${y} L${x},${y+hd} L${x-hd},${y}Z" fill="${fill}" ${d?"":'opacity=".55"'}/><text x="${x}" y="${y+4}" text-anchor="middle" fill="${solid?"#fff":d?"var(--fg)":"var(--muted)"}">${st}</text>`});
    svg.innerHTML=s;$("dlegend").innerHTML=legend();
    const tip=$("tip");
    const show=(e,st)=>{const d=S[st];if(!d){tip.innerHTML=`<b>${st}</b><br>No ${ch==="senate"?"Senate":"governor"} race in 2026`;}else if(d.race){const r=d.race,c=d.c,L=c.L||{};const v=L.share;const tot=v?v.reduce((a,b)=>a+(b||0),0):0;
        tip.innerHTML=`<b>${esc(r.title)} ${ch==="senate"?"Senate":"Governor"}</b><br>${r.cands.slice(0,2).map((x,i)=>`<span style="color:${PC[x.p]}">${esc(x.n)}${tot?" "+((v[i]||0)/tot*100).toFixed(1)+"%":""}</span>`).join("<br>")}<br>${c.level==="won"?"✓ AP call: "+esc(last(r.cands[r.called].n)):c.p!=null?(L.mode==="live"?"Live: ":"Forecast: ")+esc(last((c.lead||r.cands[0]).n))+" "+pct(c.p):"No forecast"}${L.mode==="live"?` · ${Math.round((L.r||0)*100)}% in`:""}`}
      else tip.innerHTML=`<b>${st}</b><br>${esc(d.label||"")}${d.c.level==="won"?" · called":""}`;
      tip.hidden=false;const box=svg.parentElement.getBoundingClientRect();let X=e.clientX-box.left+12,Y=e.clientY-box.top+12;if(X+200>box.width)X=Math.max(0,X-210);tip.style.left=X+"px";tip.style.top=Y+"px"};
    svg.onmousemove=e=>{const st=e.target.dataset&&e.target.dataset.st;if(st)show(e,st);else tip.hidden=true};svg.onmouseleave=()=>tip.hidden=true;svg.onclick=e=>{const st=e.target.dataset&&e.target.dataset.st;if(st)show(e,st)};
  }
  const legend=()=>[["D","won","Dem. won"],["D","likely","Dem. likely"],["D","lean","Dem. lean"],[null,"toss","Toss-up / too close"],["R","lean","GOP lean"],["R","likely","GOP likely"],["R","won","GOP won"]].map(([p,l,t])=>`<span><i style="background:${p?fillOf({party:p,level:l}):"var(--neutral-2)"}"></i>${t}</span>`).join("")+(ch!=="house"?`<span><i style="background:var(--neutral);opacity:.55"></i>No race</span>`:"");
  function houseBoard(){
    const bg=D.races.filter(r=>r.groups.includes("house"));const col=k=>bg.filter(r=>k==="Toss-up"?/Toss/.test(r.rating):r.rating===k);
    const dz=r=>{const c=cls(r);const t=r.title.replace("AK-At Large","AK-AL");return`<a class="dz" href="./#race-${r.id}" title="${esc(r.title)}: ${esc(r.cands[0].n)} (D) vs. ${esc(r.cands[1].n)} (R)${c.level==="won"?" · AP: "+esc(last(r.cands[r.called].n)):c.p!=null?" · "+esc(last(c.lead.n))+" "+pct(c.p):""}"><span class="dd" style="background:${fillOf(c)}"></span><small>${t}</small></a>`};
    return`<div class="board">${["Lean D","Toss-up","Lean R"].map(k=>{const L=col(k);return`<div><h3>${k}<span>${L.length} seats</span></h3><div class="dgrid">${L.map(dz).join("")}</div></div>`}).join("")}</div>`;
  }
  function renderTable(){
    let list;if(ch==="senate")list=D.races.filter(r=>r.groups.includes("senate"));else if(ch==="gov")list=D.races.filter(r=>r.groups.includes("governor"));else list=D.races.filter(r=>r.groups.includes("house"));
    $("listSub").textContent=ch==="house"?"50 battleground seats":ch==="gov"?"Tracked governor races":"14 competitive seats";
    $("rtable").innerHTML=`<thead><tr><th class="l">Race</th><th class="l">Democrat</th><th class="l">Republican / other</th><th>Rating</th><th>Status</th><th>Chance</th><th></th></tr></thead><tbody>`+list.map(r=>{const c=cls(r);const L=c.L||{};const v=L.share;const tot=v?v.reduce((a,b)=>a+(b||0),0):0;
      const nm=(x,i)=>`${esc(x.n)}${x.inc?" (inc.)":""}${tot?` <b>${((v[i]||0)/tot*100).toFixed(1)}%</b>`:""}`;
      const st=c.level==="won"?`<span class="pill ${c.party}">✓ ${esc(last(r.cands[r.called].n))} · AP</span>`:L.mode==="live"?`<span class="pill">${Math.round((L.r||0)*100)}% in</span>`:`<span class="pill">Not called</span>`;
      return`<tr><td class="l"><b>${esc(ch==="gov"&&r.id==="tx-gov"?"Texas":r.title)}</b></td><td class="l" style="color:var(--dem)">${nm(r.cands[0],0)}</td><td class="l" style="color:${PC[r.cands[1].p]}">${nm(r.cands[1],1)}</td><td>${esc(r.rating||"")}</td><td>${st}</td><td class="mg" style="color:${c.lead?PC[c.lead.p]:"var(--fg)"}">${c.level==="won"?"—":c.p!=null?esc(last(c.lead.n))+" "+pct(c.p):"—"}</td><td><button class="cardbtn" type="button" data-mcard="${r.id}">↗</button> <button class="followbtn" type="button" data-follow="${r.id}">🔔</button></td></tr>`}).join("")+"</tbody>";
  }
  function renderAll(){
    document.querySelectorAll("#mapTabs button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.ch===ch)));
    const st=(D.meta&&D.meta.status)||"pre";$("livePill").className="live"+(st==="live"?"":" off");$("liveText").textContent=st==="live"?"Live":st==="final"?"Results":"Pre-election";
    $("fresh").innerHTML=st==="pre"?"<b>Before the count.</b> Until votes are counted, shading shows the pre-election forecast.":`<b>Updated</b> ${H.ago(Math.max(D.meta.updatedAt||0,(D.tx&&D.tx.fetchedAt)||0))}`;
    renderTally();renderMap();renderTable();window.HEDfollowSync&&window.HEDfollowSync();
    const src=$("sources");if(src&&D.meta.sources){src.innerHTML="";D.meta.sources.forEach(s=>{const li=document.createElement("li");const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener";a.textContent=s.title;li.appendChild(a);src.appendChild(li)})}
  }
  document.addEventListener("click",e=>{const b=e.target.closest("[data-mcard]");if(!b||!window.HEDcard||!D)return;const r=D.races.find(x=>x.id===b.dataset.mcard);if(!r)return;const L=H.liveP(r,D.MK,D.tx,D.exp);const rr={...r};if(L.share){rr.votes=L.share;rr.r=L.r}
    window.HEDcard.openRace(rr,{kicker:(ch==="senate"?"Senate":ch==="gov"?"Governor":"U.S. House")+" · 2026",title:ch==="house"?r.title:r.title+(ch==="senate"?" Senate":" Governor"),chance:L.p})});
  document.addEventListener("click",e=>{const b=e.target.closest("#mapTabs button");if(b){ch=b.dataset.ch;try{history.replaceState(null,"","#"+ch)}catch(x){}renderAll()}});
  async function load(){try{D=await H.loadAll();D.meta.senateCalledMap=D.meta.senateCalledStates||{};D.exp=H.expTexas(D.meta,D.MK);$("notice").hidden=true;renderAll()}catch(e){const n=$("notice");n.hidden=false;n.textContent="Having trouble reaching the results server. Retrying automatically."}}
  load();setInterval(load,30000);
})();
