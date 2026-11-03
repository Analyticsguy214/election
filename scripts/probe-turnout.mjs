const UA={"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"};
for (const u of ["https://www.harrisvotes.com/","https://www.harrisvotes.com/Voter/Election-Day-Turnout","https://www.dallascountyvotes.org/","https://www.dallascountyvotes.org/election-results-and-maps/election-results/","https://www.tarrantcountytx.gov/en/elections.html","https://votetravis.gov/","https://www.collincountytx.gov/Elections"]) {
  try { const r=await fetch(u,{headers:UA}); const t=(await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
    const hits=[...t.matchAll(/[^.]{0,120}(turnout|Election Day)[^.]{0,160}/gi)].map(m=>m[0]).filter(s=>/\d{3}/.test(s)).slice(0,6);
    console.log("U",r.status,u,"|",hits.join(" || ").slice(0,900)); } catch(e){console.log("U ERR",u,e.message)} }
