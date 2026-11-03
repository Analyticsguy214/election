(function(){
  "use strict";
  const H=window.HED;const $=id=>document.getElementById(id);const {pct,esc,last}=H;
  const PC={D:"var(--dem)",R:"var(--rep)",I:"var(--ind)"};
  let D=null,S=null,F=null,tab="all";
  const mf=m=>m==null?"—":Math.abs(m)<0.05?"Even":(m>0?"+":"−")+Math.abs(m).toFixed(1);
  const grp=r=>r.groups.includes("house")||r.groups.includes("dfw")?"house":r.groups.includes("texas")&&!r.groups.includes("senate")&&!r.groups.includes("governor")?"texas":r.groups.includes("senate")?"senate":r.groups.includes("governor")?"governor":"other";
  const label=r=>r.id==="sen-tx"?"Texas Senate":r.id==="tx-gov"?"Texas Governor":r.groups.includes("texas")?"Texas "+r.title:r.groups.includes("senate")?r.title+" Senate":r.groups.includes("governor")?r.title+" Governor":r.title;
  function actual(r){ // {winner idx, margin (cands0 - cands1, pts of all votes), r, final}
    let v=r.votes;const tx=D.tx&&D.tx.races&&D.tx.races[r.id];
    if(tx&&tx.statewide&&tx.statewide.v){const lt=tx.statewide.v.reduce((a,b)=>a+(b||0),0),rt=(v||[]).reduce((a,b)=>a+(b||0),0);if(lt>=rt&&lt>0)v=tx.statewide.v}
    const tot=v?v.reduce((a,b)=>a+(b||0),0):0;if(!tot)return null;
    const m=((v[0]||0)-(v[1]||0))/tot*100;const fin=r.called!=null||(tx&&tx.final);const w=r.called!=null?r.called:(m>=0?0:1);
    return{w,m,final:fin,r:r.r||0,tot};
  }
  function rows(){
    return D.races.filter(r=>S.races[r.id]).map(r=>{const f=S.races[r.id];const a=actual(r);return{r,f,a,g:grp(r),hit:a&&a.final?f.pick===a.w:null,err:a&&a.final&&f.margin!=null?a.m-f.margin:null}});
  }
  function renderCards(R){
    const graded=R.filter(x=>x.hit!=null);const hits=graded.filter(x=>x.hit).length;
    const errs=graded.filter(x=>x.err!=null).map(x=>Math.abs(x.err));const mae=errs.length?errs.reduce((a,b)=>a+b,0)/errs.length:null;
    const bias=graded.filter(x=>x.err!=null);const avgBias=bias.length?bias.map(x=>x.r.cands[0].p==="D"?x.err:-x.err).reduce((a,b)=>a+b,0)/bias.length:null;
    // seats
    const nuD=(D.meta.senate&&D.meta.senate.notUpD)||34;let sd=nuD,sDone=0;D.races.filter(r=>r.groups.includes("senate")&&r.called!=null).forEach(r=>{sDone++;if(r.cands[r.called].p==="D")sd++});
    const safe=D.meta.senateSafe||[];const csd=D.meta.senateCalledStates||{};safe.forEach(s=>{if(csd[s.st]){sDone++;if(csd[s.st]==="D")sd++}});
    const hh=D.meta.house||{};const hDone=(hh.cD||0)+(hh.cR||0);
    const card=(k,big,sub,col,foot)=>`<div class="callcard" style="border-top-color:${col||"var(--fg)"}"><div class="k">${k}</div><div class="c" style="color:${col||"var(--fg)"}">${big}</div><div class="s">${sub}</div><div class="r">${foot||""}</div></div>`;
    $("scCards").innerHTML=card("Calls right",graded.length?`${hits} of ${graded.length}`:"—",graded.length?pct(hits/graded.length)+" correct":"Graded as the AP calls races","var(--smu-blue)",`${R.length} races forecast`)+
      card("Average miss",mae!=null?mae.toFixed(1)+" pts":"—",avgBias!=null?(Math.abs(avgBias)<0.3?"No clear lean":"Results ran "+Math.abs(avgBias).toFixed(1)+" pts more "+(avgBias>0?"Democratic":"Republican")+" than forecast"):"Margin error in decided races","var(--fg)","Lower is better")+
      card("Senate",`D ${sd} (forecast ${S.senateSeatsD})`,sDone<35?`${sDone} of 35 races called`:"All races called",sd>=51?"var(--dem)":"var(--rep)",`Control forecast: Dem. ${pct(S.senateControlP)}`)+
      card("House",`D ${hh.cD||0} (forecast ${S.houseSeatsD})`,hDone<435?`${hDone} of 435 seats called`:"All seats called",(hh.cD||0)>=218?"var(--dem)":hDone?"var(--rep)":"var(--fg)",`Control forecast: Dem. ${pct(S.houseControlP)}`);
    $("scSub").textContent=`Forecast locked ${S.asOf}`;
  }
  function renderScatter(R){
    const el=$("scatter");const pts=R.filter(x=>x.a&&x.a.final&&x.f.margin!=null);
    const W=Math.max(360,el.clientWidth||640),Ht=360,L=46,Rr=14,T=14,B=40,lim=40;
    const X=m=>L+(Math.max(-lim,Math.min(lim,m))+lim)/(2*lim)*(W-L-Rr),Y=m=>T+(1-(Math.max(-lim,Math.min(lim,m))+lim)/(2*lim))*(Ht-T-B);
    const font='font-family="Libre Franklin,Arial,sans-serif" font-size="11"';
    let s=`<svg width="${W}" height="${Ht}" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Forecast margin versus actual margin">`;
    [-40,-20,0,20,40].forEach(g=>{s+=`<line x1="${X(g)}" x2="${X(g)}" y1="${T}" y2="${Ht-B}" stroke="var(--rule)"/><line x1="${L}" x2="${W-Rr}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--rule)"/><text x="${X(g)}" y="${Ht-B+16}" text-anchor="middle" ${font} fill="var(--muted)">${g===0?"Even":(g>0?"D+":"R+")+Math.abs(g)}</text><text x="${L-6}" y="${Y(g)+4}" text-anchor="end" ${font} fill="var(--muted)">${g===0?"Even":(g>0?"D+":"R+")+Math.abs(g)}</text>`});
    s+=`<line x1="${X(-lim)}" y1="${Y(-lim)}" x2="${X(lim)}" y2="${Y(lim)}" stroke="var(--fg-2)" stroke-dasharray="4 4"/>`;
    s+=`<text x="${(L+W-Rr)/2}" y="${Ht-6}" text-anchor="middle" ${font} fill="var(--fg-2)">Forecast margin</text><text x="12" y="${(T+Ht-B)/2}" text-anchor="middle" ${font} fill="var(--fg-2)" transform="rotate(-90 12 ${(T+Ht-B)/2})">Actual margin</text>`;
    pts.forEach(x=>{const sign=x.r.cands[0].p==="D"?1:-1;const fm=x.f.margin*sign,am=x.a.m*sign;s+=`<circle cx="${X(fm)}" cy="${Y(am)}" r="6" fill="${x.hit?(am>=0?"var(--dem)":"var(--rep)"):"var(--bg)"}" stroke="${am>=0?"var(--dem)":"var(--rep)"}" stroke-width="2.5"><title>${esc(label(x.r))}: forecast ${mf(fm)}, actual ${mf(am)}${x.hit?"":" · missed"}</title></circle>`});
    if(!pts.length)s+=`<text x="${(L+W-Rr)/2}" y="${(T+Ht-B)/2}" text-anchor="middle" font-family="Libre Franklin,Arial,sans-serif" font-size="14" fill="var(--muted)">Dots appear as races are called on election night</text>`;
    el.innerHTML=s+"</svg>"+(pts.length?`<p class="note">Filled dots: we called the winner correctly. Hollow dots: we missed. Margins are shown as Democratic (right/up) or Republican (left/down).</p>`:"");
  }
  function renderTable(R){
    document.querySelectorAll("#rcTabs button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.g===tab)));
    const list=R.filter(x=>tab==="all"||x.g===tab);
    $("rcTable").innerHTML=`<thead><tr><th class="l">Race</th><th class="l">Our call</th><th>Forecast margin</th><th class="l">Result</th><th>Actual margin</th><th>Miss</th><th>Grade</th></tr></thead><tbody>`+list.map(x=>{const r=x.r,c0=r.cands[0],c1=r.cands[1];const pk=r.cands[x.f.pick];const fmv=x.f.margin;const pkp=x.f.pick===0?x.f.p:1-x.f.p;
      const res=x.a?(x.a.final?`<b style="color:${PC[r.cands[x.a.w].p]}">${esc(last(r.cands[x.a.w].n))}</b>${r.called!=null?" ✓ AP":" (SOS final)"}`:`<span class="muted">${esc(last(r.cands[x.a.m>=0?0:1].n))} leads · ${Math.round((x.a.r||0)*100)}% in</span>`):`<span class="muted">Pending</span>`;
      const g=x.hit==null?`<span class="pill">—</span>`:x.hit?`<span class="pill D" style="background:var(--good,#1d7a4c);border-color:var(--good,#1d7a4c)">✓ Right</span>`:`<span class="pill R">✗ Missed</span>`;
      const marg=m=>m==null?"—":`<span style="color:${m>=0?PC[c0.p]:PC[c1.p]}">${esc(last(m>=0?c0.n:c1.n))} ${mf(Math.abs(m))}</span>`;
      return`<tr><td class="l"><b>${esc(label(r))}</b></td><td class="l"><span style="color:${PC[pk.p]}">${esc(last(pk.n))}</span> <small class="muted">${pct(pkp)}</small></td><td class="num">${marg(fmv)}</td><td class="l">${res}</td><td class="num">${x.a?marg(x.a.m):"—"}</td><td class="num">${x.err!=null?Math.abs(x.err).toFixed(1):"—"}</td><td>${g}</td></tr>`}).join("")+"</tbody>";
  }
  function renderAll(){const R=rows();const any=R.some(x=>x.a);const graded=R.filter(x=>x.hit!=null).length;
    $("rcLive").className="live"+(any&&graded<R.length?"":" off");$("rcLiveTxt").textContent=!any?"Waiting for results":graded<R.length?"Grading live":"Final";
    $("fresh").innerHTML=any?`<b>Updated</b> ${H.ago(Math.max(D.meta.updatedAt||0,(D.nl&&D.nl.fetchedAt)||0,(D.tx&&D.tx.fetchedAt)||0))} · ${graded} of ${R.length} races graded`:"Results begin when polls close on Nov. 3. Until then, this page shows our locked forecast.";
    renderCards(R);renderScatter(R);renderTable(R);
    const src=$("sources");if(src&&D.meta.sources){src.innerHTML="";D.meta.sources.forEach(s=>{const li=document.createElement("li");const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener";a.textContent=s.title;li.appendChild(a);src.appendChild(li)})}}
  document.addEventListener("click",e=>{const b=e.target.closest("#rcTabs button");if(b&&D){tab=b.dataset.g;renderTable(rows())}});
  async function load(){try{const [d,s]=await Promise.all([H.loadAll(),fetch("data/forecast-snapshot.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())]);D=d;S=s;$("notice").hidden=true;renderAll()}catch(e){const n=$("notice");n.hidden=false;n.textContent="Having trouble loading results. Retrying automatically."}}
  load();setInterval(load,30000);let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>D&&renderScatter(rows()),200)});
})();
