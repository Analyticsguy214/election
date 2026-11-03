(function(){
  "use strict";
  const H=window.HED;const $=id=>document.getElementById(id);const {pct,esc,last,probit,Phi}=H;
  const PC={D:"var(--dem)",R:"var(--rep)",I:"var(--ind)"};
  let D=null,tab="senate",lastRun=null;
  const N=20000,NS=8000;
  // ---- inputs ----
  function settings(){return{env:+$("env").value,turn:$("turn").value,err:+$("err").value,use:{dd:$("srcDD").checked,rt:$("srcRT").checked,ka:$("srcKA").checked,pm:$("srcPM").checked,vh:$("srcVH").checked}}}
  const TURN={base:{shift:0,err:0},high:{shift:1.5,err:0.15},low:{shift:-1.5,err:0.1}};
  // each race -> {race, m (cands[0] minus cands[1], pts), dir (+1 if a better D environment helps cands[0])}
  function buildRaces(use){
    const list=[];
    D.races.forEach(r=>{const src=H.sources(r,D.MK);let p=H.blend(src,use);const dir=r.cands[1].p==="R"?1:r.cands[0].p==="R"?-1:1;
      const locked=r.called!=null?(r.called===0?1:0):null;
      list.push({race:r,src,p,m:p==null?0:probit(p)*7,dir,locked,nodata:p==null})});
    return list;
  }
  function buildSafe(){return((D.meta&&D.meta.senateSafe)||[]).map(s=>({st:s.st,m:probit(s.p)*7*(s.fav==="D"?1:-1),called:(D.meta.senateCalledStates||{})[s.st]||null}))}
  function houseBase(use){
    const xs=[];const hh=D.meta.house||{};if(use.dd&&hh.projD)xs.push(hh.projD);
    const c=D.MK&&D.MK.control&&D.MK.control.house;[[use.ka,c&&c.kalshi],[use.pm,c&&c.polymarket]].forEach(([on,o])=>{if(on&&o&&o.D!=null){const p=o.D/((o.D||0)+(o.R!=null?o.R:1-o.D));xs.push(217.5+24.4*probit(p))}});
    if(!xs.length&&use.rt&&hh.projD)xs.push(hh.projD);
    return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:218;
  }
  // ---- simulation ----
  function simulate(cfg,n,seed){
    const R=H.rng(seed||20261103),G=()=>H.gauss(R);
    const T=TURN[cfg.turn]||TURN.base;const err=cfg.err+T.err;const shift=-cfg.env+T.shift; // + = better for Democrats
    const rs=buildRaces(cfg.use);const sen=rs.filter(x=>x.race.groups.includes("senate"));const safe=buildSafe();
    const nuD=(D.meta.senate&&D.meta.senate.notUpD)||34,need=(D.meta.senate&&D.meta.senate.need)||51;
    const hb=houseBase(cfg.use);const hcD=(D.meta.house&&D.meta.house.cD)||0,hcR=(D.meta.house&&D.meta.house.cR)||0;
    const wins=new Float64Array(rs.length),msum=new Float64Array(rs.length);
    const senD=new Int32Array(101),houD=new Int32Array(436);let senCtl=0,houCtl=0;const tip={};
    const idx=new Map(rs.map((x,i)=>[x,i]));
    const sd=6.32*err,nsd=3*err;
    const dness=new Array(sen.length+safe.length);
    for(let k=0;k<n;k++){
      const nat=G()*nsd;let d=nuD;
      for(let i=0;i<rs.length;i++){const x=rs[i];let m;if(x.locked!=null)m=x.locked?50:-50;else m=x.m+x.dir*(shift+nat)+G()*(x.nodata?sd*1.4:sd);msum[i]+=m;if(m>0)wins[i]++;x._m=m}
      let j=0;
      for(const x of sen){const isD=(x._m>0?x.race.cands[0]:x.race.cands[1]).p==="D";if(isD)d++;
        const dc=x.race.cands[0].p==="D"?x._m:x.race.cands[1].p==="D"?-x._m:-999;dness[j++]=[dc,x.race.title]}
      for(const s of safe){let m;if(s.called)m=s.called==="D"?50:-50;else m=s.m+shift+nat+G()*sd;if(m>0)d++;dness[j++]=[m,s.st]}
      senD[Math.min(100,d)]++;if(d>=need)senCtl++;
      dness.sort((a,b)=>b[0]-a[0]);const tp=dness[need-nuD-1];if(tp)tip[tp[1]]=(tip[tp[1]]||0)+1;
      let hs=Math.round(hb+4.5*(shift+nat)+G()*20.3*err);hs=Math.max(hcD,Math.min(435-hcR,hs));houD[hs]++;if(hs>=218)houCtl++;
    }
    const med=arr=>{let t=0;for(let i=0;i<arr.length;i++){t+=arr[i];if(t>=n/2)return i}return 0};
    const q=(arr,f)=>{let t=0;for(let i=0;i<arr.length;i++){t+=arr[i];if(t>=n*f)return i}return arr.length-1};
    const races={};rs.forEach((x,i)=>races[x.race.id]={...x,pw:wins[i]/n,mm:msum[i]/n});
    return{n,senCtl:senCtl/n,houCtl:houCtl/n,senD,houD,senMed:med(senD),houMed:med(houD),senLo:q(senD,.1),senHi:q(senD,.9),houLo:q(houD,.1),houHi:q(houD,.9),tip,races,hb};
  }
  // ---- rendering ----
  function needle(p){const seg=12;let g="";const P=(r,t)=>[100+r*Math.cos(t),100-r*Math.sin(t)];for(let i=0;i<seg;i++){const a0=Math.PI*(1-i/seg),a1=Math.PI*(1-(i+1)/seg);const L=i<seg/2;const op=L?.18+.7*(1-i/(seg/2)):.18+.7*((i-seg/2+1)/(seg/2));const [x0,y0]=P(94,a0),[x1,y1]=P(94,a1),[x2,y2]=P(58,a1),[x3,y3]=P(58,a0);g+=`<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A94,94 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A58,58 0 0 0 ${x3.toFixed(1)},${y3.toFixed(1)}Z" fill="${L?"var(--dem)":"var(--rep)"}" fill-opacity="${op.toFixed(2)}" stroke="var(--bg)" stroke-width="1.5"/>`}const t=Math.PI*p;g+=`<line x1="100" y1="100" x2="${(100+86*Math.cos(t)).toFixed(1)}" y2="${(100-86*Math.sin(t)).toFixed(1)}" stroke="var(--fg)" stroke-width="3.2" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="var(--fg)"/>`;return`<svg class="needle" viewBox="0 0 200 110" role="img" aria-label="Chance of control">${g}</svg>`}
  function card(k,title,p,a,b,foot){return`<div class="rcard withneedle"><div class="rk">${k}<span>Hilltop model</span></div><h3>${title}</h3>${needle(p)}<div class="rs"><div><div class="p" style="color:var(--dem)">${pct(p)}</div><div class="l">${a}</div></div><div><div class="p" style="color:var(--rep)">${pct(1-p)}</div><div class="l">${b}</div></div></div><div class="rb"><i style="width:${p*100}%;background:var(--dem)"></i><i style="flex:1;background:var(--rep)"></i></div><div class="rf">${foot}</div></div>`}
  function hist(el,arr,n,lo,hi,mark,bin,labelFn){
    const W=Math.max(360,el.clientWidth||520),Ht=200,L=8,R=8,T=10,B=30;const bins=[];for(let a=lo;a<=hi;a+=bin){let p=0;for(let i=a;i<a+bin&&i<arr.length;i++)p+=arr[i];bins.push({a,p:p/n})}
    const mx=Math.max(...bins.map(b=>b.p),.001);const bw=(W-L-R)/bins.length;
    let s=`<svg width="${W}" height="${Ht}" viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Distribution of outcomes">`;
    bins.forEach((b,i)=>{const h=(Ht-T-B)*b.p/mx;const x=L+i*bw;s+=`<rect x="${(x+1).toFixed(1)}" y="${(Ht-B-h).toFixed(1)}" width="${Math.max(1,bw-2).toFixed(1)}" height="${h.toFixed(1)}" fill="${b.a+bin/2>mark?"var(--dem)":"var(--rep)"}"><title>${labelFn(b)}: ${(b.p*100).toFixed(1)}%</title></rect>`});
    s+=`<line x1="${L}" x2="${W-R}" y1="${Ht-B}" y2="${Ht-B}" stroke="var(--rule-strong)"/>`;const mi=bins.findIndex(b=>b.a<=mark&&mark<b.a+bin);if(mi>=0){const x=L+(mi+(mark-bins[mi].a)/bin)*bw;s+=`<line x1="${x}" x2="${x}" y1="${T}" y2="${Ht-B+4}" stroke="var(--rule-strong)" stroke-dasharray="3 3"/>`}
    const step=Math.max(1,Math.ceil(bins.length/8));bins.forEach((b,i)=>{if(i%step)return;s+=`<text x="${L+i*bw+bw/2}" y="${Ht-B+15}" text-anchor="middle" font-family="Libre Franklin,Arial,sans-serif" font-size="11" fill="var(--fg-2)">${labelFn(b)}</text>`});
    el.innerHTML=s+"</svg>";
  }
  function render(res,cfg){
    const tx=res.races["sen-tx"],tg=res.races["tx-gov"];
    $("fcCards").innerHTML=card("Senate","Chance Democrats win the Senate",res.senCtl,"Democrats","Republicans",`Typical result: D ${res.senMed} seats · 80% range ${res.senLo}–${res.senHi}`)+card("House","Chance Democrats win the House",res.houCtl,"Democrats","Republicans",`Typical result: D ${res.houMed} seats · 80% range ${res.houLo}–${res.houHi}`)+(tx?card("Texas","Texas U.S. Senate",tx.pw,last(tx.race.cands[0].n),last(tx.race.cands[1].n),`Average margin: ${tx.mm>=0?last(tx.race.cands[0].n)+" +":last(tx.race.cands[1].n)+" +"}${Math.abs(tx.mm).toFixed(1)}`):"");
    $("simInfo").textContent=`${res.n.toLocaleString("en-US")} simulations · ${cfg.env===0?"even environment":(cfg.env<0?"D+":"R+")+Math.abs(cfg.env)+" environment"} · ${$("turn").selectedOptions[0].text.toLowerCase()}`;
    hist($("senHist"),res.senD,res.n,40,64,50.5,1,b=>"D "+b.a);$("senNote").textContent=`Democrats need 51 seats; at 50–50 the vice president keeps the Senate Republican. Bars right of the dashed line are Democratic control.`;
    hist($("houHist"),res.houD,res.n,180,290,217.5,5,b=>"D "+b.a);$("houNote").textContent=`Center of the House distribution: ${Math.round(res.hb)} Democratic seats, from ${["Decision Desk HQ's seat projection",$("srcKA").checked||$("srcPM").checked?"market odds":null].filter(Boolean).join(" and ")}. Each point of national swing moves about 4.5 seats.`;
    // tipping point
    const tp=Object.entries(res.tip).sort((a,b)=>b[1]-a[1]).slice(0,8);const mx=tp.length?tp[0][1]:1;
    $("tipping").innerHTML=tp.map(([k,v])=>`<div class="tb"><span><b>${esc(k)}</b></span><div style="width:${v/mx*100}%"></div><span class="num">${pct(v/res.n)}</span></div>`).join("")+`<p class="note">How often each state is the one that would give a party its majority, ordering the Senate races from most to least Democratic in each simulation.</p>`;
    renderTable(res);
  }
  function renderTable(res){
    document.querySelectorAll("#rtTabs button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.g===tab)));
    const list=Object.values(res.races).filter(x=>x.race.groups.includes(tab));
    const f=p=>p==null?`<span class="muted">—</span>`:pct(p);
    $("fcTable").innerHTML=`<thead><tr><th class="l">Race</th><th class="l">Candidates</th><th>DDHQ</th><th>Rating</th><th>Kalshi</th><th>Polymarket</th><th>VoteHub</th><th>Blend</th><th>Simulated</th><th>Avg. margin</th></tr></thead><tbody>`+list.map(x=>{const r=x.race,c0=r.cands[0],c1=r.cands[1];const lead=x.pw>=.5?c0:c1;
      return`<tr><td class="l"><b>${esc(r.id==="tx-gov"?"Texas Gov.":r.id==="sen-tx"?"Texas Senate":r.title)}</b>${x.locked!=null?` <span class="pill ${r.cands[r.called].p}">✓ AP</span>`:""}</td><td class="l"><span style="color:${PC[c0.p]}">${esc(last(c0.n))}</span> v. <span style="color:${PC[c1.p]}">${esc(last(c1.n))}</span></td><td>${f(x.src.dd)}</td><td>${esc(r.rating||"—")}</td><td>${f(x.src.ka)}</td><td>${f(x.src.pm)}</td><td>${f(x.src.vh)}</td><td>${f(x.p)}</td><td class="mg" style="color:${PC[lead.p]}">${esc(last(lead.n))} ${pct(Math.max(x.pw,1-x.pw))}</td><td class="num" style="color:${x.mm>=0?PC[c0.p]:PC[c1.p]}">${x.mm>=0?"+":"−"}${Math.abs(x.mm).toFixed(1)}</td></tr>`}).join("")+`</tbody>`;
  }
  function scenarios(){
    const base=settings();const rows=[
      ["All sources (your settings)",base],
      ["Forecasters only (DDHQ + ratings)",{...base,use:{dd:true,rt:true,ka:false,pm:false,vh:false}}],
      ["Prediction markets only",{...base,use:{dd:false,rt:false,ka:true,pm:true,vh:false}}],
      ["Everything except markets",{...base,use:{...base.use,ka:false,pm:false}}],
      ["Race ratings only",{...base,use:{dd:false,rt:true,ka:false,pm:false,vh:false}}],
      ["Democrats outperform by 3 points",{...base,env:base.env-3}],
      ["Republicans outperform by 3 points",{...base,env:base.env+3}],
      ["High turnout",{...base,turn:"high"}],
      ["Low turnout",{...base,turn:"low"}],
      ["Large polling miss",{...base,err:1.5}]];
    const out=rows.map(([nm,c],i)=>{const r=simulate(c,NS,777+i);const t=r.races["sen-tx"],g=r.races["tx-gov"];return`<tr${i===0?' class="scenhl"':""}><td class="l"><b>${esc(nm)}</b></td><td class="mg" style="color:${r.senCtl>=.5?"var(--dem)":"var(--rep)"}">D ${pct(r.senCtl)}</td><td class="num">${r.senMed}</td><td class="mg" style="color:${r.houCtl>=.5?"var(--dem)":"var(--rep)"}">D ${pct(r.houCtl)}</td><td class="num">${r.houMed}</td><td class="num">${t?pct(t.pw):"—"}</td><td class="num">${g?pct(g.pw):"—"}</td></tr>`});
    $("scen").innerHTML=`<thead><tr><th class="l">Scenario</th><th>Senate control</th><th>Median D seats</th><th>House control</th><th>Median D seats</th><th>Talarico (TX Sen.)</th><th>Hinojosa (TX Gov.)</th></tr></thead><tbody>${out.join("")}</tbody>`;
  }
  function run(){if(!D)return;const cfg=settings();const t0=performance.now();lastRun=simulate(cfg,N);render(lastRun,cfg);scenarios();
    $("fresh").innerHTML=`<b>Model run</b> ${new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})} CT in ${Math.round(performance.now()-t0)} ms · inputs updated ${H.ago(Math.max(D.meta.updatedAt||0,(D.MK&&D.MK.updatedAt)||0))}${(D.races.some(r=>r.called!=null))?" · AP-called races are locked in":""}`}
  const envLbl=()=>{const v=+$("env").value;$("envOut").textContent=v===0?"Even":(v<0?"D+":"R+")+Math.abs(v)};
  $("env").addEventListener("input",envLbl);
  let deb;["env","turn","err","srcDD","srcRT","srcKA","srcPM","srcVH"].forEach(id=>$(id).addEventListener("change",()=>{clearTimeout(deb);deb=setTimeout(run,60)}));
  $("rerun").addEventListener("click",run);
  document.addEventListener("click",e=>{const b=e.target.closest("#rtTabs button");if(b&&lastRun){tab=b.dataset.g;renderTable(lastRun)}});

  // ---- final call ----
  async function renderFinal(){
    let F;try{F=await (await fetch("data/final.json?t="+Date.now(),{cache:"no-store"})).json()}catch(e){$("final").hidden=true;return}
    $("finalAsOf").textContent="As of "+F.asOf;$("finalHed").textContent=F.headline;
    $("finalCards").innerHTML=F.calls.map(c=>`<div class="callcard" style="border-top-color:${PC[c.party]}"><div class="k">${esc(c.k)}</div><div class="c" style="color:${PC[c.party]}">${esc(c.call)}</div><div class="s">${esc(c.seats)}</div><div class="r">${esc(c.range)} · ${pct(c.p)} chance</div><div class="pb"><i style="display:block;width:${(c.party==="D"?c.p:1-c.p)*100}%;background:var(--dem)"></i><i style="display:block;flex:1;background:var(--rep)"></i></div></div>`).join("");
    const R=id=>D&&D.races.find(r=>r.id===id);
    $("finalTx").innerHTML=`<thead><tr><th class="l">Office</th><th class="l">Projected result</th><th>Margin</th><th class="l">Why</th></tr></thead><tbody>`+F.texas.map(t=>{const r=R(t.id);if(!r)return"";const c0=r.cands[0],c1=r.cands[1];const m=t.d-t.r;const w=m>=0?c0:c1;
      return`<tr><td class="l"><b>${esc(t.office)}</b><br><span class="pill ${w.p}">${esc(last(w.n))}</span></td><td class="l"><span style="color:${PC[c0.p]}">${esc(last(c0.n))} ${t.d.toFixed(1)}%</span> · <span style="color:${PC[c1.p]}">${esc(last(c1.n))} ${t.r.toFixed(1)}%</span><div class="txbar"><i style="display:block;width:${t.d/(t.d+t.r)*100}%;background:${PC[c0.p]}"></i><i style="display:block;flex:1;background:${PC[c1.p]}"></i></div></td><td class="mg" style="color:${PC[w.p]}">${w.p}+${Math.abs(m).toFixed(1)}</td><td class="l" style="font-size:12.5px;color:var(--fg-2)">${esc(t.note)}</td></tr>`}).join("")+"</tbody>";
    $("finalTurn").innerHTML=`<b>Turnout:</b> ${esc(F.turnout.txNote)} ${esc(F.turnout.dallas)}`;
    const cg=(st,nm,p,sub)=>`<span class="cg"><span class="dd" style="background:${PC[p]}"></span><span><b>${esc(st)}</b> ${esc(nm)}${sub?`<br><small>${esc(sub)}</small>`:""}</span></span>`;
    $("finalSen").innerHTML=F.senate.map(x=>cg(x[0],x[1],x[2],x[3])).join("");
    $("finalGov").innerHTML=F.governors.map(x=>cg(x[0],x[1],x[2])).join("");
    $("finalFactors").innerHTML=F.factors.map(f=>`<li><b>${esc(f.t)}</b>${esc(f.b)}</li>`).join("");
    $("finalFlip").innerHTML=F.flip.map(f=>`<li><b>${esc(f.t)}</b>${esc(f.b)}</li>`).join("");
  }
  async function load(first){try{D=await H.loadAll();$("notice").hidden=true;if(first){run();renderFinal()}const src=$("sources");if(src&&D.meta.sources){src.innerHTML="";D.meta.sources.forEach(s=>{const li=document.createElement("li");const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener";a.textContent=s.title;li.appendChild(a);src.appendChild(li)})}}catch(e){const n=$("notice");n.hidden=false;n.textContent="Having trouble loading the model inputs. Retrying automatically."}}
  envLbl();load(true);setInterval(()=>load(false),120000);
  let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>lastRun&&render(lastRun,settings()),200)});
})();
