// Shared model helpers for the map and forecast pages. Exposes window.HED.
(function(){
  "use strict";
  function erf(x){const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y}
  const Phi=x=>0.5*(1+erf(x/Math.SQRT2));
  function probit(p){p=Math.min(0.999,Math.max(0.001,p));const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];const pl=0.02425;let q,r;if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)}
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
  const RATING_P={"Safe":0.97,"Likely":0.86,"Lean":0.68,"Tilt":0.58};
  function ratingP(rating,partyOfC0){if(!rating)return null;const m=rating.match(/^(Safe|Likely|Lean|Tilt)\s+([DRI])/);if(m){const p=RATING_P[m[1]];return partyOfC0===m[2]?p:1-p}return /Toss/.test(rating)?0.5:null}
  function mkFrom(o,race){if(!o)return null;const a=o[race.cands[0].p],b=race.cands[1]?o[race.cands[1].p]:null;let p=null;if(a!=null&&b!=null)p=a/((a+b)||1);else if(a!=null)p=a;else if(b!=null)p=1-b;return p==null?null:Math.min(.99,Math.max(.01,p))}
  // sources for a race: probabilities that cands[0] wins
  function sources(race,MK){
    const r=MK&&MK.races&&MK.races[race.id];
    const o=MK&&MK.outside&&MK.outside[race.id];let vh=null;
    if(o&&o.ranges){const f=c=>{const x=o.ranges.find(z=>z.name.toLowerCase().includes(last(c.n).toLowerCase()));return x?(x.lo+x.hi)/2:null};const a=f(race.cands[0]),b=f(race.cands[1]);if(a!=null&&b!=null)vh=Phi(((a-b)/(a+b)*100)/7)}
    return{dd:typeof race.pre==="number"?race.pre:null,rt:ratingP(race.rating,race.cands[0].p),ka:r?mkFrom(r.kalshi,race):null,pm:r?mkFrom(r.polymarket,race):null,vh};
  }
  function blend(src,use){const ks=["dd","rt","ka","pm","vh"].filter(k=>use[k]!==false&&src[k]!=null);
    // ratings only count when there is no DDHQ number, so the two forecasters aren't double-counted
    const xs=ks.filter(k=>!(k==="rt"&&src.dd!=null&&use.dd!==false)).map(k=>src[k]);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
  const last=n=>n.split(" ").filter(w=>!/^(III|II|Jr\.?)$/.test(w)).slice(-1)[0];
  // live probability that cands[0] wins (called / counted / forecast)
  function liveP(race,MK,txLive,expTx){
    let v=race.votes;const s=txLive&&txLive.races&&txLive.races[race.id]&&txLive.races[race.id].statewide;
    if(s&&s.v){const lt=s.v.reduce((a,b)=>a+(b||0),0),rt=(v||[]).reduce((a,b)=>a+(b||0),0);if(lt>0&&lt>=rt)v=[s.v[0],s.v[1]]}
    if(race.called!=null){const t=v?v.reduce((a,b)=>a+(b||0),0):0;return{p:race.called===0?1:0,mode:"called",share:t?v:null,r:race.r||1}}
    const pr=blend(sources(race,MK),{});const tot=v?v.reduce((a,b)=>a+(b||0),0):0;
    if(!tot)return{p:pr,mode:pr==null?"none":"pre"};
    let r=race.r||0;if(!r&&expTx&&race.groups.includes("texas"))r=Math.min(.99,tot/expTx);r=Math.max(.01,Math.min(1,r));
    const m=((v[0]||0)-(v[1]||0))/(((v[0]||0)+(v[1]||0))||1)*100;const mp=pr==null?0:probit(pr)*7;const w=Math.min(1,0.4+r);
    const fin=r*m+(1-r)*(w*m+(1-w)*mp);const sd=Math.sqrt(Math.pow((1-r)*(7+6*r),2)+0.25);
    return{p:Phi(fin/sd),mode:"live",share:v,r,m};
  }
  // tile grid (col,row)
  const TILES=[["AK",0,0],["ME",11,0],["VT",10,1],["NH",11,1],["WA",1,2],["ID",2,2],["MT",3,2],["ND",4,2],["MN",5,2],["IL",6,2],["WI",7,2],["MI",8,2],["NY",9,2],["RI",10,2],["MA",11,2],["OR",1,3],["NV",2,3],["WY",3,3],["SD",4,3],["IA",5,3],["IN",6,3],["OH",7,3],["PA",8,3],["NJ",9,3],["CT",10,3],["CA",1,4],["UT",2,4],["CO",3,4],["NE",4,4],["MO",5,4],["KY",6,4],["WV",7,4],["VA",8,4],["MD",9,4],["DE",10,4],["AZ",2,5],["NM",3,5],["KS",4,5],["AR",5,5],["TN",6,5],["NC",7,5],["SC",8,5],["DC",9,5],["OK",4,6],["LA",5,6],["MS",6,6],["AL",7,6],["GA",8,6],["HI",1,7],["TX",4,7],["FL",9,7]];
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
  async function loadAll(){const [races,meta,MK,tx,nl]=await Promise.all([getJ("data/races.json"),getJ("data/meta.json"),getJ("data/markets.json").catch(()=>null),getJ("data/tx-live.json").catch(()=>null),getJ("data/national-live.json").catch(()=>null)]);let NLx=nl;if(window.HEDap){try{const d=await window.HEDap(races,nl);if(d)NLx=d}catch(e){}}overlayNational(races,meta,NLx);return{races,meta,MK,tx,nl}}
  function expTexas(meta,MK){const t=meta&&meta.turnout&&meta.turnout.tx;const xs=[];if(t&&t.ev&&t.ev2022&&t.total2022)xs.push(t.ev/(t.ev2022/t.total2022));const o=MK&&MK.outside&&MK.outside["sen-tx"];if(o&&o.turnout)xs.push(o.turnout);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
  const pct=p=>p==null?"—":(p>=0.995?">99%":p<=0.005?"<1%":Math.round(p*100)+"%");
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const ago=t=>{const s=Math.max(0,Math.round((Date.now()-t)/1000));return s<60?s+" sec ago":s<3600?Math.round(s/60)+" min ago":new Date(t).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})+" CT"};
  const SEN_ST={"sen-nc":"NC","sen-ga":"GA","sen-mi":"MI","sen-me":"ME","sen-oh":"OH","sen-tx":"TX","sen-ia":"IA","sen-ak":"AK","sen-ks":"KS","sen-sc":"SC","sen-ne":"NE","sen-mn":"MN","sen-nh":"NH","sen-fl":"FL"};
  const GOV_ST={"gov-ga":"GA","gov-oh":"OH","gov-nv":"NV","gov-wi":"WI","gov-ks":"KS","gov-fl":"FL","gov-az":"AZ","gov-mi":"MI","gov-ia":"IA","gov-nh":"NH","tx-gov":"TX"};
  window.HED={Phi,probit,rng,gauss,ratingP,sources,blend,liveP,TILES,loadAll,expTexas,pct,esc,ago,last,SEN_ST,GOV_ST};
  // auto-reload when a new version is published
  const BUILD=(document.querySelector('meta[name="build"]')||{}).content||"";
  setInterval(async()=>{try{const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const v=(await r.json()).v;if(BUILD&&BUILD!=="0"&&v&&v!==BUILD)location.reload()}catch(e){}},60000);
})();
