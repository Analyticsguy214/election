(function(){
  "use strict";
  // ---------- constants ----------
  const STATEWIDE=["sen-tx","tx-gov","tx-ltgov","tx-ag","tx-comp","tx-land","tx-agri","tx-rrc"];
  const HOUSE=["tx-05","tx-06","tx-24","tx-30","tx-32","tx-33"];
  const STRIP=["sen-tx","tx-gov","tx-ltgov","tx-ag","tx-rrc"];
  const NAMES={"sen-tx":"U.S. Senate","tx-gov":"Governor","tx-ltgov":"Lieutenant Governor","tx-ag":"Attorney General","tx-comp":"Comptroller","tx-land":"Land Commissioner","tx-agri":"Agriculture Commissioner","tx-rrc":"Railroad Commissioner"};
  const SHORT={"sen-tx":"Senate","tx-gov":"Governor","tx-ltgov":"Lt. Governor","tx-ag":"Atty. General","tx-rrc":"Railroad"};
  const PC={D:"var(--dem)",R:"var(--rep)",I:"var(--ind)"};
  const EARLY_BIAS=0.04; // early ballots assumed ~4 pts (D share) bluer than Election Day ballots
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt=n=>n==null?"—":Math.round(n).toLocaleString("en-US");
  const fmtM=n=>n==null?"—":n>=1e6?(n/1e6).toFixed(2)+"M":n>=1e3?Math.round(n/1e3)+"K":Math.round(n)+"";
  const pct=p=>p==null?"—":(p>=0.995?">99%":p<=0.005?"<1%":Math.round(p*100)+"%");
  const last=n=>n.split(" ").filter(w=>!/^(III|II|Jr\.?)$/.test(w)).slice(-1)[0];
  const ct=t=>new Date(t).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"}).replace("AM","a.m.").replace("PM","p.m.");
  const mfmt=m=>Math.abs(m)<0.05?"Even":(m>0?"D+":"R+")+Math.abs(m).toFixed(1); // m = D minus R
  const mcol=m=>m>=0?"var(--dem)":"var(--rep)";

  // ---------- math ----------
  function erf(x){const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y}
  const Phi=x=>0.5*(1+erf(x/Math.SQRT2));
  function probit(p){p=Math.min(0.999,Math.max(0.001,p));const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];const pl=0.02425;let q,r;if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}
  const lgt=p=>{p=Math.min(.995,Math.max(.005,p));return Math.log(p/(1-p))},sig=x=>1/(1+Math.exp(-x));

  // ---------- state ----------
  let races=[],meta=null,MK=null,GEO=null,LIVE=null,sel="sen-tx",mapMode="lead",showAll=false,lastCheck=0;
  const callHist={};
  const h=(location.hash||"").slice(1);if(STATEWIDE.concat(HOUSE).includes(h))sel=h;
  const R=id=>races.find(r=>r.id===id);

  // ---------- priors (same inputs as the main page) ----------
  const RATING_P={"Safe":0.97,"Likely":0.86,"Lean":0.68,"Tilt":0.58};
  function mkP(race){
    const r=MK&&MK.races&&MK.races[race.id];if(!r)return[null,null];
    const f=o=>{if(!o)return null;const a=o[race.cands[0].p],b=race.cands[1]?o[race.cands[1].p]:null;let p=null;if(a!=null&&b!=null)p=a/((a+b)||1);else if(a!=null)p=a;else if(b!=null)p=1-b;return p==null?null:Math.min(.99,Math.max(.01,p))};
    return[f(r.kalshi),f(r.polymarket)];
  }
  function baseFc(race){
    if(typeof race.pre==="number")return race.pre;
    if(race.rating){const m=race.rating.match(/^(Safe|Likely|Lean|Tilt)\s+([DRI])/);if(m){const p=RATING_P[m[1]];return race.cands[0].p===m[2]?p:1-p}if(/Toss/.test(race.rating))return 0.5}
    return null;
  }
  function outsideFor(race){
    const auto=MK&&MK.outside&&MK.outside[race.id];if(!auto||!auto.ranges)return null;
    const f=c=>{const x=auto.ranges.find(z=>z.name.toLowerCase().includes(last(c.n).toLowerCase()));return x?(x.lo+x.hi)/2:null};
    const a=f(race.cands[0]),b=f(race.cands[1]);return a!=null&&b!=null?{...auto,m:(a-b)/(a+b)*100}:null;
  }
  function priorP(race){const xs=[baseFc(race),...mkP(race)].filter(x=>x!=null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
  function priorMargin(race){ // D minus R, points; null if nothing known
    const p=priorP(race);let m=p==null?null:probit(p)*7;const o=outsideFor(race);
    if(o)m=m==null?o.m:(m+o.m)/2;return m;
  }
  function fallbackPrior(id){ // for races with no forecast or market: average of the other statewide down-ballot races
    const xs=["tx-ltgov","tx-ag","tx-rrc"].map(R).filter(Boolean).map(priorMargin).filter(x=>x!=null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
  }

  // ---------- expected turnout ----------
  function expectedTotal(){
    const t=meta&&meta.turnout&&meta.turnout.tx;const xs=[];
    if(t&&t.ev&&t.ev2022&&t.total2022){const pace=t.ev/t.evDay,left=Math.max(0,t.evDays-t.evDay);xs.push((t.ev+pace*left*1.05)/(t.ev2022/t.total2022))}
    const o=MK&&MK.outside&&MK.outside["sen-tx"];if(o&&o.turnout)xs.push(o.turnout);
    return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:10.3e6;
  }

  // ---------- county model ----------
  function countyPriors(m0){ // returns {fips: D two-party share}
    const cs=Object.entries(GEO.counties);const V=cs.reduce((a,[,c])=>a+c.v,0);
    const target=(50+m0/2)/100;const base=cs.map(([id,c])=>[id,c.v,lgt((50-c.m/2)/100)]);
    const at=dl=>base.reduce((a,[,v,l])=>a+v*sig(l+dl),0)/V;
    let lo=-4,hi=4;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(at(mid)<target)lo=mid;else hi=mid}
    const dl=(lo+hi)/2;const out={};base.forEach(([id,,l])=>out[id]=sig(l+dl));return out;
  }
  function analyze(race){
    const id=race.id;const isSW=STATEWIDE.includes(id);
    let m0=priorMargin(race);const noPrior=m0==null;if(noPrior)m0=fallbackPrior(id);
    const res={race,id,isSW,noPrior,m0,pPrior:priorP(race)};
    if(res.pPrior==null&&m0!=null)res.pPrior=Phi(m0/7);
    const live=LIVE&&LIVE.races&&LIVE.races[id];
    const T26=isSW?expectedTotal()*(id==="sen-tx"?1:0.97):expectedTotal()/38;res.T26=T26; // House: an average district is 1/38 of the state
    // statewide counted from races.json (AP/DDHQ) or summed counties (SOS)
    let cv=null;if(race.votes&&race.votes.some(x=>x))cv=race.votes.slice();
    const lsw=live&&live.statewide&&live.statewide.v;if(lsw){const lt=lsw.reduce((a,b)=>a+(b||0),0),rt=cv?cv.reduce((a,b)=>a+(b||0),0):0;if(lt>=rt&&lt>0)cv=lsw.slice()}
    const cty=live&&live.counties?live.counties:null;
    let sumC=null,evS=[0,0,0],edS=[0,0,0],nRep=0;
    if(cty){sumC=race.cands.map(()=>0);for(const k in cty){const x=cty[k];if(!x.v)continue;const t=x.v.reduce((a,b)=>a+(b||0),0);if(t>0)nRep++;x.v.forEach((v,i)=>{if(i<sumC.length)sumC[i]+=v||0});(x.ev||[]).forEach((v,i)=>evS[Math.min(i,2)]+=v||0);(x.ed||[]).forEach((v,i)=>edS[Math.min(i,2)]+=v||0)}}
    if(!cv&&sumC&&sumC.some(x=>x))cv=sumC;
    if(live&&live.statewide&&live.statewide.ev&&live.statewide.ev.some(x=>x)){evS=live.statewide.ev.slice(0,3);edS=live.statewide.ed.slice(0,3)}
    res.counted=cv;res.nRep=nRep;res.evS=evS;res.edS=edS;
    const tot=cv?cv.reduce((a,b)=>a+(b||0),0):0;res.tot=tot;
    if(race.called!=null){res.mode="called"}
    if(!tot){res.mode=res.mode||(m0==null?"none":"pre");res.margin=m0;res.pD=res.pPrior;res.expTot=T26;return finish(res)}
    // live
    const two=(cv[0]||0)+(cv[1]||0);const otherShare=tot?1-two/tot:0.02;
    if(isSW&&cty&&GEO&&m0!=null){
      const pri=countyPriors(m0);const V=Object.values(GEO.counties).reduce((a,c)=>a+c.v,0);const scale=T26/V;
      const EFT=0.73;let sw=0,sd=0;const rows={};
      for(const [fips,c] of Object.entries(GEO.counties)){
        const x=cty[fips];const E=c.v*scale;const v=x&&x.v?x.v:null;const D=v?(v[0]||0):0,Rr=v?(v[1]||0):0,t=v?v.reduce((a,b)=>a+(b||0),0):0;
        const evT=x&&x.ev?x.ev.reduce((a,b)=>a+(b||0),0):null,edT=x&&x.ed?x.ed.reduce((a,b)=>a+(b||0),0):null;
        const efc=evT!=null&&edT!=null&&(evT+edT)>0?evT/(evT+edT):0.85;
        const Ee=Math.max(E,t);const f=Math.min(1,(x&&x.pct!=null&&x.pct>=0.98)?1:t/Ee);
        const q=pri[fips];let o=null;if(D+Rr>0){o=D/(D+Rr)-EARLY_BIAS*(efc-EFT);if(f>0.02){const w=D+Rr;sw+=w;sd+=w*(lgt(o)-lgt(q))}}
        rows[fips]={E:Ee,t,D,R:Rr,f,q,o,efc,edT,evT,v,pct:x?x.pct:null};
      }
      const twoE=T26*(1-otherShare);
      const devG=sw?(sd/sw)*(sw/(sw+0.08*twoE)):0;
      let PD=0,PR=0,left=0;
      for(const [fips,r] of Object.entries(rows)){
        const a=sig(lgt(r.q)+devG);let F=a;
        if(r.o!=null){const lam=Math.min(0.6,r.f*2);F=r.f*r.o+(1-r.f)*(lam*r.o+(1-lam)*a)}
        const L=Math.max(0,r.E-r.t)*(1-otherShare);left+=Math.max(0,r.E-r.t);
        let rem=L>0?(F*(r.D+r.R+L)-r.D)/L:F;rem=Math.min(0.97,Math.max(0.03,rem));
        r.F=F;r.rem=rem;r.left=Math.max(0,r.E-r.t);
        PD+=r.D+rem*L;PR+=r.R+(1-rem)*L;
      }
      const fr=Math.min(1,tot/T26);
      res.rows=rows;res.devG=devG;res.left=left;res.frac=fr;res.expTot=tot+left;
      res.margin=(PD-PR)/(PD+PR)*100;res.projD=PD;res.projR=PR;
      const sdm=Math.sqrt(Math.pow(8*(1-fr),2)+0.4*0.4)*(nRep<20?1.3:1);res.sd=sdm;
      res.pD=Phi(res.margin/sdm);res.mode=res.mode||"live";
    }else{
      // statewide-only model (House races, or no county feed)
      const r=Math.max(0.01,Math.min(1,race.r||(live&&live.statewide&&live.statewide.pct)||tot/T26));
      const idx=[0,1];const a=(cv[0]||0)>=(cv[1]||0)?0:1;const m=((cv[0]||0)-(cv[1]||0))/(((cv[0]||0)+(cv[1]||0))||1)*100;
      const mp=m0==null?0:m0;const w=Math.min(1,0.4+r);const mRem=w*m+(1-w)*mp;const fin=r*m+(1-r)*mRem;
      const sdm=Math.sqrt(Math.pow((1-r)*(7+6*r),2)+0.25);res.margin=fin;res.sd=sdm;res.pD=Phi(fin/sdm);res.frac=r;
      res.expTot=tot/r;res.left=res.expTot-tot;res.projD=res.expTot*(1-otherShare)*(50+fin/2)/100;res.projR=res.expTot*(1-otherShare)-res.projD;res.mode=res.mode||"live";
    }
    return finish(res);
  }
  function finish(res){
    const race=res.race;
    if(race.called!=null){res.pD=race.cands[race.called].p==="D"?1:0}
    // Hilltop projection: 99%+, 80%+ counted, held across two data updates, markets agree
    res.hc=null;
    if(res.mode==="live"&&res.pD!=null){
      const L=res.pD>=0.5?0:1;const pL=L===0?res.pD:1-res.pD;const ok=pL>=0.99&&(res.frac||0)>=0.8;
      const [k,pm]=mkP(race);const mOK=[k,pm].every(x=>x==null||(L===0?x:1-x)>=0.9);
      const hk=callHist[race.id]||(callHist[race.id]={sig:null,streak:0,L:null});
      const s=LIVE&&LIVE.updatedAt||meta&&meta.updatedAt||0;
      if(hk.sig!==s){hk.sig=s;hk.streak=ok&&mOK&&(hk.L===L||hk.L==null)?hk.streak+1:0;hk.L=ok&&mOK?L:null}
      if(hk.streak>=2&&hk.L===L)res.hc=L;
    }
    return res;
  }

  // ---------- rendering ----------
  function statusOf(a){
    const race=a.race;
    if(race.called!=null){const c=race.cands[race.called];return{cls:"won-"+c.p,txt:last(c.n)+" wins ✓ AP"}}
    const lr=LIVE&&LIVE.races&&LIVE.races[race.id];if(lr&&lr.final&&a.counted){const w=(a.counted[0]||0)>=(a.counted[1]||0)?0:1;const c=race.cands[w];return{cls:"won-"+c.p,txt:last(c.n)+" · unofficial final (SOS)"}}
    if(a.hc!=null){const c=race.cands[a.hc];return{cls:"hc",txt:"◆ Hilltop projects "+last(c.n),col:PC[c.p]}}
    if(a.mode==="live"){const L=a.pD>=0.5?0:1,p=L===0?a.pD:1-a.pD,c=race.cands[L];if(p>=0.9)return{cls:"lean",txt:"Likely "+last(c.n),col:PC[c.p]};if(p>=0.7)return{cls:"lean",txt:"Leaning "+last(c.n),col:PC[c.p]};return{cls:"",txt:"Too close to call"}}
    const st=(meta&&meta.status)||"pre";return{cls:"",txt:st==="pre"?"Polls close 7 p.m.":"Too early to call"};
  }
  function renderStrip(A){
    $("callStrip").innerHTML=STRIP.map(id=>{const a=A[id];if(!a)return"";const s=statusOf(a);
      return`<button class="chip" type="button" data-id="${id}" aria-pressed="${id===sel}"><span class="cn">${SHORT[id]}</span><span class="cs ${s.cls}" ${s.col?`style="color:${s.col}"`:""}>${esc(s.txt)}</span></button>`}).join("");
  }
  function raceRow(a){
    const race=a.race;const c0=race.cands[0],c1=race.cands[1];const tot=a.tot||0;const E=a.expTot||a.T26;
    const d=tot?(a.counted[0]||0)/E*100:0,r=tot?(a.counted[1]||0)/E*100:0;
    const s0=tot?(a.counted[0]||0)/tot*100:null,s1=tot?(a.counted[1]||0)/tot*100:null;
    const name=NAMES[race.id]||race.title+" · U.S. House";
    const inTxt=tot?Math.round(Math.min(1,a.frac||0)*100)+"% in":(a.pD!=null?pct(Math.max(a.pD,1-a.pD))+" "+last((a.pD>=.5?c0:c1).n):"");
    return`<button class="rl" type="button" data-id="${race.id}" aria-pressed="${race.id===sel}"><span class="rn">${esc(name)}<span>${inTxt}</span></span>
      <span class="rb"><span class="h"></span><span class="d" style="width:${d}%;background:${PC[c0.p]}"></span><span class="gap"></span><span class="r" style="width:${r}%;background:${PC[c1.p]}"></span><span class="mid"></span></span>
      <span class="rv"><span>${esc(last(c0.n))} <b>${s0!=null?s0.toFixed(1)+"%":"0.0%"}</b></span><span>${esc(last(c1.n))} <b>${s1!=null?s1.toFixed(1)+"%":"0.0%"}</b></span></span></button>`;
  }
  function renderList(A){
    let h=`<div class="grp">Statewide</div>`+STATEWIDE.map(id=>A[id]?raceRow(A[id]):"").join("");
    h+=`<div class="grp">U.S. House · Dallas County</div>`+HOUSE.map(id=>A[id]?raceRow(A[id]):"").join("");
    $("raceList").innerHTML=h;
  }
  function renderPanel(a){
    {const fb=$("rpFollow");if(fb){fb.dataset.follow=a.race.id;window.HEDfollowSync&&window.HEDfollowSync()}}
    const race=a.race;const c0=race.cands[0],c1=race.cands[1];const tot=a.tot||0;
    $("rpName").textContent=NAMES[race.id]||race.title+" · U.S. House";
    $("rpIn").textContent=tot?Math.round(Math.min(1,a.frac||0)*100)+"%":"0%";
    $("rpCounties").textContent=a.isSW?`${a.nRep||0} of 254 counties reporting`:"District results";
    $("rpLive").className="live"+(tot?"":" off");
    const s=statusOf(a);$("rpStatus").innerHTML=`<span class="badge ${s.cls}" ${s.col?`style="color:${s.col}"`:""}>${esc(s.txt)}</span>`;
    const cand=(c,i)=>{const v=tot?(a.counted[i]||0):null;const sh=tot?v/tot*100:0;const win=race.called===i;
      return`<div class="party">${c.p==="D"?"Democrat":c.p==="R"?"Republican":"Independent"}${c.inc?" · inc.":""}</div><div class="nm" style="color:${PC[c.p]}">${esc(c.n)}${win?" ✓":""}</div><div class="pc num">${sh.toFixed(2)}%</div><div class="vt">${tot?fmt(v)+" votes":"No votes yet"}</div>`};
    $("rpC0").innerHTML=cand(c0,0);$("rpC1").innerHTML=cand(c1,1);
    // gauge
    const pD=a.pD;const ang=pD==null?90:180*pD; // 180 = far left (D), 0 = far right (R)
    let g="";const seg=10;for(let i=0;i<seg;i++){const a0=Math.PI*(1-i/seg),a1=Math.PI*(1-(i+1)/seg);const col=i<seg/2?"var(--dem)":"var(--rep)";const op=i<seg/2?(1-i/(seg/2))*0.85+0.15:((i-seg/2+1)/(seg/2))*0.85+0.15;
      const p=(r,t)=>[100+r*Math.cos(t),100-r*Math.sin(t)];const [x0,y0]=p(92,a0),[x1,y1]=p(92,a1),[x2,y2]=p(60,a1),[x3,y3]=p(60,a0);
      g+=`<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A92,92 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A60,60 0 0 0 ${x3.toFixed(1)},${y3.toFixed(1)}Z" fill="${col}" fill-opacity="${op.toFixed(2)}" stroke="var(--bg)" stroke-width="1.5"/>`}
    const t=ang*Math.PI/180;g+=`<line x1="100" y1="100" x2="${(100+84*Math.cos(t)).toFixed(1)}" y2="${(100-84*Math.sin(t)).toFixed(1)}" stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="5" fill="var(--fg)"/>`;
    $("gauge").innerHTML=g;
    if(pD==null)$("gaugeTxt").innerHTML="No forecast yet";
    else{const L=pD>=.5?c0:c1,p=pD>=.5?pD:1-pD;$("gaugeTxt").innerHTML=`<b style="color:${PC[L.p]}">${esc(last(L.n))} ${pct(p)}</b><br>chance to win · ${a.mode==="live"?"live model":a.mode==="called"?"AP call":"forecast"}`}
    // expected bar
    const E=a.expTot||a.T26;const d=tot?(a.counted[0]||0)/E*100:0,r=tot?(a.counted[1]||0)/E*100:0;const oth=tot?Math.max(0,tot-(a.counted[0]||0)-(a.counted[1]||0)):0;
    $("xbar").innerHTML=`<div class="d" style="width:${d}%;background:${PC[c0.p]}"></div><div class="gap"><span>${tot?fmt(Math.max(0,E-tot))+" left":fmt(E)+" expected"}</span></div><div class="r" style="width:${r}%;background:${PC[c1.p]}"></div><div class="maj" title="Majority"></div>`;
    $("xbarLbl").innerHTML=`<span>${fmt(a.counted?a.counted[0]:0)} ${esc(last(c0.n))}</span><span>majority</span><span>Other ${tot?(oth/tot*100).toFixed(2):"0.00"}% · ${fmt(a.counted?a.counted[1]:0)} ${esc(last(c1.n))}</span>`;
    // projection
    if(a.margin==null){$("rpProj").innerHTML=`<div style="grid-column:1/-1" class="s">No forecast or market for this race yet. A projection appears as votes are counted.</div>`}
    else{const m=a.margin;const lo=m-1.645*(a.sd||7),hi=m+1.645*(a.sd||7);const E2=a.expTot||a.T26;
      const pd=a.projD!=null?a.projD:E2*0.985*(50+m/2)/100,pr=a.projR!=null?a.projR:E2*0.985-pd;
      $("rpProj").innerHTML=`<div><div class="k">${a.mode==="live"?"Projected margin":"Forecast margin"}</div><div class="v" style="color:${mcol(m)}">${mfmt(m)}</div><div class="s">90% range ${mfmt(lo)} to ${mfmt(hi)}</div></div>
      <div><div class="k">Expected votes</div><div class="v">${fmtM(E2)}</div><div class="s">${tot?fmtM(tot)+" counted":"Based on early-vote pace"+(a.race.id==="sen-tx"?" and VoteHub":"")}</div></div>
      <div><div class="k">Projected · ${esc(last(c0.n))}</div><div class="v" style="color:${PC[c0.p]}">${fmtM(pd)}</div></div>
      <div><div class="k">Projected · ${esc(last(c1.n))}</div><div class="v" style="color:${PC[c1.p]}">${fmtM(pr)}</div></div>
      ${a.noPrior?`<div style="grid-column:1/-1" class="s">No forecast or market exists for this race, so the pre-election estimate averages the other statewide down-ballot races.</div>`:""}
      ${a.mode==="live"&&a.devG?`<div style="grid-column:1/-1" class="s">Counties reporting so far are running ${Math.abs(a.devG*50).toFixed(1)} points ${a.devG>0?"more Democratic":"more Republican"} than the forecast; the model applies that to counties still out.</div>`:""}`}
    // vote type
    const row=(lbl,arr)=>{const t=arr.reduce((a,b)=>a+b,0);if(!t)return`<div class="vtrow"><span>${lbl}</span><div class="vbar"></div><span class="mg muted">—</span></div>`;
      const m=(arr[0]-arr[1])/((arr[0]+arr[1])||1)*100;return`<div class="vtrow"><span>${lbl}<br><small class="muted">${fmtM(t)} votes</small></span><div class="vbar"><div style="width:${arr[0]/t*100}%;background:${PC[c0.p]}"></div><div style="width:${arr[2]/t*100}%;background:var(--neutral-2)"></div><div style="flex:1;background:${PC[c1.p]}"></div></div><span class="mg" style="color:${mcol(m)}">${mfmt(m)}</span></div>`};
    const T=meta&&meta.turnout&&meta.turnout.tx;
    let vt=row("Early incl. mail",a.evS||[0,0,0])+row("Election Day",a.edS||[0,0,0]);
    if(!(a.evS&&a.evS.some(x=>x))&&T)vt+=`<p class="note">Before results: ${fmt(T.ev)} early ballots were cast (${(T.ev/T.reg*100).toFixed(1)}% of registered voters). Of early voters, ${Math.round(T.hist.D*100)}% last voted in a Democratic primary and ${Math.round(T.hist.R*100)}% in a Republican one. Counties post early votes first, around 7 p.m.</p>`;
    $("rpType").innerHTML=vt;
    // odds
    const [k,pm]=mkP(race);const o=MK&&MK.outside&&MK.outside[race.id];let od="";
    const pf=priorP(race);if(pf!=null)od+=`<span>Pre-election Hilltop forecast: <b>${esc(last(c0.n))} ${pct(pf)}</b></span>`;
    if(k!=null)od+=`<span>Kalshi: <b>${esc(last(c0.n))} ${pct(k)}</b></span>`;
    if(pm!=null)od+=`<span>Polymarket: <b>${esc(last(c0.n))} ${pct(pm)}</b></span>`;
    if(o&&o.ranges)od+=`<span>VoteHub modeled vote (${esc(o.asOf||"")}): <b>${o.ranges.map(x=>esc(last(x.name))+" "+x.lo+"–"+x.hi+"%").join(" · ")}</b>${o.rating?" · "+esc(o.rating):""}</span>`;
    $("rpOdds").innerHTML=od||`<span class="muted">No markets for this race.</span>`;
  }
  function fillFor(fips,c,a){
    const r=a.rows&&a.rows[fips];const x=LIVE&&LIVE.races&&LIVE.races[a.id]&&LIVE.races[a.id].counties&&LIVE.races[a.id].counties[fips];
    const t=x&&x.v?x.v.reduce((s,v)=>s+(v||0),0):0;
    const dshare=t?(x.v[0]||0)/(((x.v[0]||0)+(x.v[1]||0))||1):null;
    const op=m=>.15+.85*Math.min(Math.abs(m),40)/40;
    if(mapMode==="in"){if(!r||!t)return["var(--neutral)",1];return["var(--smu-blue)",.12+.88*Math.min(1,r.f)]}
    if(mapMode==="swing"){if(dshare==null)return["var(--neutral)",1];const m=(2*dshare-1)*100-(-c.m);return[mcol(m),op(m*2)]}
    if(mapMode==="fc"){if(dshare==null||!r)return["var(--neutral)",1];const m=(2*dshare-1)*100-(2*r.q-1)*100;return[mcol(m),op(m*2)]}
    if(dshare!=null){const m=(2*dshare-1)*100;return[mcol(m),op(m)]}
    // nothing counted: show projection faintly
    if(a.m0==null)return["var(--neutral)",1];
    const q=a.rows?a.rows[fips].q:null;const m=q!=null?(2*q-1)*100:(2*sig(lgt((50-c.m/2)/100)+(a.prDl||0))-1)*100;return[mcol(m),op(m)*.45];
  }
  let prCache={};
  function renderMap(a){
    const svg=$("txMap");if(!GEO){return}
    $("mapTitle").textContent=NAMES[a.id]||a.race.title;
    if(!a.isSW){svg.innerHTML="";$("buckets").innerHTML="";$("mapSub").textContent="";$("mapNote").textContent="This is a district race, so there is no statewide county map. Results appear in the panel as votes are counted.";return}
    if(!a.rows&&a.m0!=null){const key=a.id+":"+a.m0.toFixed(3);if(!prCache[key]){const p=countyPriors(a.m0);prCache[key]=p}const p=prCache[key];a.rows={};for(const f in p)a.rows[f]={q:p[f],f:0}}
    svg.setAttribute("viewBox",`0 0 ${GEO.w} ${GEO.h}`);
    let s="";const bk=new Array(10).fill(0);const any=a.tot>0;
    for(const [id,c] of Object.entries(GEO.counties)){const [col,op]=fillFor(id,c,a);s+=`<path d="${c.d}" data-id="${id}" fill="${col}" fill-opacity="${op.toFixed(2)}"/>`;
      const x=LIVE&&LIVE.races&&LIVE.races[a.id]&&LIVE.races[a.id].counties&&LIVE.races[a.id].counties[id];const t=x&&x.v?x.v.reduce((q,v)=>q+(v||0),0):0;
      let m=null;if(t)m=((x.v[0]||0)-(x.v[1]||0))/(((x.v[0]||0)+(x.v[1]||0))||1)*100;else if(!any&&a.rows&&a.rows[id])m=(2*a.rows[id].q-1)*100;
      if(m!=null){const am=Math.abs(m);const b=am>=32?4:am>=16?3:am>=8?2:am>=4?1:0;bk[m<0?4-b:5+b]++}}
    const LB=[["48201","Houston",0,0],["48113","Dallas",28,-14],["48439","Fort Worth",-40,-12],["48029","San Antonio",0,0],["48453","Austin",0,0],["48141","El Paso",14,-14],["48215","McAllen",0,0],["48303","Lubbock",0,0]];
    for(const [id,nm,dx,dy] of LB){const c=GEO.counties[id];if(!c)continue;const x=c.c[0]+dx,y=c.c[1]+dy;if(dx||dy)s+=`<line x1="${c.c[0]}" y1="${c.c[1]}" x2="${x}" y2="${y+3}" stroke="var(--fg)" stroke-width=".8"/>`;s+=`<text class="lbl" x="${x}" y="${y}" text-anchor="middle">${nm}</text>`}
    svg.innerHTML=s;
    const labs=["32+","16","8","4","0","0","4","8","16","32+"];
    $("buckets").innerHTML=`<span class="bl">${any?"Counties by lead":"Projected lead"}</span>`+bk.map((n,i)=>`<span class="bk"><small>${labs[i]}</small><b style="background:${i<5?"var(--rep)":"var(--dem)"};opacity:${i<5?(.35+.13*(4-i)):(.35+.13*(i-5))}">${n}</b></span>`).join("");
    $("mapSub").textContent=any?`${a.nRep} of 254 counties reporting`:"Before results: projected margin by county";
    $("mapNote").textContent=({lead:any?"Shaded by each county's margin among votes counted so far. Counties with no votes yet show the projection faintly.":"Projected margin: each county's 2024 result swung proportionally to the statewide forecast. Results replace it as counties report.",in:"Share of each county's expected vote that has been counted.",swing:"Change from the 2024 presidential margin, among votes counted so far.",fc:"How each county's count compares with its pre-election projection. Blue means better for the Democrat than forecast."})[mapMode];
    document.querySelectorAll("#mapModes button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.mode===mapMode)));
    // tooltip
    const tip=$("mapTip");
    svg.onmousemove=e=>{const id=e.target.dataset&&e.target.dataset.id;if(!id){tip.hidden=true;return}showTip(e,id,a)};
    svg.onmouseleave=()=>{tip.hidden=true};svg.onclick=e=>{const id=e.target.dataset&&e.target.dataset.id;if(id)showTip(e,id,a)};
  }
  function showTip(e,id,a){
    const c=GEO.counties[id];const tip=$("mapTip");const r=a.rows&&a.rows[id];const x=LIVE&&LIVE.races&&LIVE.races[a.id]&&LIVE.races[a.id].counties&&LIVE.races[a.id].counties[id];
    const c0=a.race.cands[0],c1=a.race.cands[1];let h=`<b>${esc(c.n)} County</b><br>2024: <span class="mg" style="color:${mcol(-c.m)}">${mfmt(-c.m)}</span>`;
    if(r&&r.q!=null)h+=`<br>Projected: <span class="mg" style="color:${mcol((2*r.q-1)*100)}">${mfmt((2*r.q-1)*100)}</span>`;
    if(x&&x.v){const t=x.v.reduce((q,v)=>q+(v||0),0);if(t){const m=((x.v[0]||0)-(x.v[1]||0))/(((x.v[0]||0)+(x.v[1]||0))||1)*100;h+=`<br>Counted: <span class="mg" style="color:${mcol(m)}">${mfmt(m)}</span>${r?` · ${Math.round(r.f*100)}% in`:""}<br>${esc(last(c0.n))} ${fmt(x.v[0])} · ${esc(last(c1.n))} ${fmt(x.v[1])}`}}
    if(r&&r.left!=null)h+=`<br>Est. votes left: ${fmtM(r.left)}`;
    tip.innerHTML=h;tip.hidden=false;const box=$("txMap").parentElement.getBoundingClientRect();let X=e.clientX-box.left+12,Y=e.clientY-box.top+12;if(X+190>box.width)X=Math.max(0,X-200);tip.style.left=X+"px";tip.style.top=Y+"px";
  }
  function renderVotesLeft(a){
    const tb=$("vlTable");if(!GEO||!a.isSW){tb.innerHTML="";$("vlTotal").textContent="";$("vlMore").hidden=true;return}
    const V=Object.values(GEO.counties).reduce((s,c)=>s+c.v,0);const scale=(a.T26)/V;
    const rows=Object.entries(GEO.counties).map(([id,c])=>{const r=a.rows&&a.rows[id];const x=LIVE&&LIVE.races&&LIVE.races[a.id]&&LIVE.races[a.id].counties&&LIVE.races[a.id].counties[id];
      const t=x&&x.v?x.v.reduce((q,v)=>q+(v||0),0):0;const E=r&&r.E?r.E:c.v*scale;const left=r&&r.left!=null?r.left:Math.max(0,E-t);
      const m=t?((x.v[0]||0)-(x.v[1]||0))/(((x.v[0]||0)+(x.v[1]||0))||1)*100:null;return{id,n:c.n,t,left,m,m24:-c.m}}).sort((p,q)=>q.left-p.left);
    const total=rows.reduce((s,r)=>s+r.left,0);$("vlTotal").textContent=fmt(total);
    const list=showAll?rows:rows.slice(0,12);
    tb.innerHTML=`<thead><tr><th>County</th><th>In</th><th>Left</th><th>Margin</th><th>2024</th><th>Swing</th></tr></thead><tbody>`+list.map(r=>`<tr data-id="${r.id}"><td><b>${esc(r.n)}</b></td><td class="num">${fmtM(r.t)}</td><td class="num">${fmtM(r.left)}</td><td class="mg" style="color:${r.m==null?"var(--muted)":mcol(r.m)}">${r.m==null?"—":mfmt(r.m)}</td><td class="mg" style="color:${mcol(r.m24)}">${mfmt(r.m24)}</td><td class="mg" style="color:${r.m==null?"var(--muted)":mcol(r.m-r.m24)}">${r.m==null?"—":(r.m-r.m24>=0?"D+":"R+")+Math.abs(r.m-r.m24).toFixed(1)}</td></tr>`).join("")+"</tbody>";
    $("vlMore").hidden=false;$("vlMore").textContent=showAll?"Show top 12":"Show all 254 counties";
  }
  function ago(t){const s=Math.max(0,Math.round((Date.now()-t)/1000));return s<60?s+" sec ago":s<3600?Math.round(s/60)+" min ago":ct(t)}
  function renderFresh(){
    const st=(meta&&meta.status)||"pre";$("livePill").className="live"+(st==="live"?"":" off");$("liveText").textContent=st==="live"?"Live":st==="final"?"Results":"Pre-election";
    let h="";const rt=LIVE&&LIVE.updatedAt;
    if(rt)h+=`<b>County results</b> ${ago(LIVE.fetchedAt||rt)}${LIVE.source?" · "+esc(LIVE.source):""}${LIVE.sosUpdated?" (SOS time "+esc(LIVE.sosUpdated.replace(/^\w+ \d+, \d+ /,""))+")":""}`;else h+=st==="pre"?"<b>Results</b> begin when polls close at 7 p.m.":"";
    if(meta&&meta.updatedAt&&st!=="pre")h+=` · <b>Statewide totals</b> ${ago(meta.updatedAt)}`;
    const ot=Math.max((MK&&MK.updatedAt)||0);if(ot)h+=` · <b>Odds</b> ${ago(ot)}`;
    if(lastCheck)h+=` · <span class="muted">checked ${ago(lastCheck)}</span>`;$("fresh").innerHTML=h;
  }
  let A={};
  function renderAll(){
    if(!races.length)return;A={};STATEWIDE.concat(HOUSE).forEach(id=>{const r=R(id);if(r)A[id]=analyze(r)});
    if(!A[sel])sel="sen-tx";const a=A[sel];
    renderStrip(A);renderList(A);renderPanel(a);renderMap(a);renderVotesLeft(a);renderFresh();
    const src=$("sources");if(meta&&meta.sources){src.innerHTML="";[{title:"Texas Secretary of State election night results",url:"https://goelect.txelections.civixapps.com/ivis-enr-ui/races"}].concat(meta.sources).forEach(s=>{const li=document.createElement("li");const x=document.createElement("a");x.href=s.url;x.target="_blank";x.rel="noopener";x.textContent=s.title;li.appendChild(x);src.appendChild(li)})}
  }
  document.addEventListener("click",e=>{if(!e.target.closest("#rpShare")||!window.HEDcard)return;const a=A[sel];if(!a)return;const race={...a.race,votes:a.counted||null,r:a.frac||0};
    window.HEDcard.openRace(race,{kicker:a.isSW?"Texas · 2026":"Dallas County · U.S. House",title:a.isSW?"Texas "+(NAMES[a.id]||a.race.title):a.race.title+" U.S. House",sub:a.isSW?(a.nRep||0)+" of 254 counties reporting":a.race.sub,chance:a.pD,note:a.margin!=null?(a.mode==="live"?"Hilltop live projection: ":"Hilltop forecast: ")+mfmt(a.margin)+(a.mode==="live"?" · win chance "+last((a.pD>=.5?a.race.cands[0]:a.race.cands[1]).n)+" "+pct(Math.max(a.pD,1-a.pD)):""):null})});
  function select(id){sel=id;try{history.replaceState(null,"","#"+id)}catch(e){location.hash=id}renderAll()}
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-id].rl,[data-id].chip");if(b){select(b.dataset.id);if(window.innerWidth<760)$("rpName").scrollIntoView({behavior:"smooth"});return}
    const m=e.target.closest("#mapModes button");if(m){mapMode=m.dataset.mode;renderMap(A[sel]);return}
    if(e.target.id==="vlMore"){showAll=!showAll;renderVotesLeft(A[sel]);return}
  });
  window.addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(h&&h!==sel&&(STATEWIDE.includes(h)||HOUSE.includes(h)))select(h)});
  setInterval(renderFresh,5000);

  // ---------- data ----------
  const BUILD=(document.querySelector('meta[name="build"]')||{}).content||"";
  async function checkBuild(){try{const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const v=(await r.json()).v;if(BUILD&&BUILD!=="0"&&v&&v!==BUILD)location.reload()}catch(e){}}
  setInterval(checkBuild,60000);
  async function getJ(u){const r=await fetch(u+(u.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(u);return r.json()}
  function overlayNational(races,meta,NL){
    if(!NL||!NL.races)return false;let any=false;
    races.forEach(x=>{const n=NL.races[x.id];if(!n)return;const tn=(n.v||[]).reduce((a,b)=>a+(b||0),0),tr=(x.votes||[]).reduce((a,b)=>a+(b||0),0);
      if(tn>0&&tn>=tr){x.votes=x.cands.map((c,i)=>n.v[i]||0);if(n.r!=null)x.r=n.r;if(n.snaps&&n.snaps.length>((x.snaps||[]).length))x.snaps=n.snaps;any=true}
      if(x.called==null&&n.called!=null){x.called=n.called;any=true}});
    if(meta){meta.house=meta.house||{};if(NL.house){meta.house.cD=Math.max(meta.house.cD||0,NL.house.cD||0);meta.house.cR=Math.max(meta.house.cR||0,NL.house.cR||0)}
      meta.senateCalledStates=Object.assign({},NL.senateCalledStates||{},meta.senateCalledStates||{});
      meta.senateCalled=((meta.senateSafe)||[]).map(s=>meta.senateCalledStates[s.st]).filter(Boolean);
      if(any){if(!meta.status||meta.status==="pre")meta.status="live";meta.updatedAt=Math.max(meta.updatedAt||0,NL.fetchedAt||0)}}
    return any;
  }
  let sigPrev=null;
  async function load(){
    try{
      if(!GEO)GEO=await getJ("data/tx-counties.json");
      const [r,m,k,l,nl]=await Promise.all([getJ("data/races.json"),getJ("data/meta.json"),getJ("data/markets.json").catch(()=>MK),getJ("data/tx-live.json").catch(()=>LIVE),getJ("data/national-live.json").catch(()=>null)]);overlayNational(r,m,nl);
      const sg=JSON.stringify([nl&&nl.fetchedAt,m.updatedAt,k&&k.updatedAt,l&&l.updatedAt,l&&l.fetchedAt,r.map(x=>(x.votes||[]).join(",")+x.called)]);
      lastCheck=Date.now();$("notice").hidden=true;
      if(sg!==sigPrev){sigPrev=sg;races=r;meta=m;MK=k;LIVE=l;renderAll()}else renderFresh();
    }catch(e){const n=$("notice");n.hidden=false;n.textContent="Having trouble reaching the results server. Retrying automatically."}
  }
  load();setInterval(load,20000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
  let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>A[sel]&&renderMap(A[sel]),200)});
})();
