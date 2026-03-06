function saveLastResult(champ,matchPct,typeName,lane){
  const data={champId:champ.id,champName:champ.name,matchPct:matchPct,typeName:typeName||'',lane:lane||'',date:new Date().toLocaleDateString('ja-JP')};
  localStorage.setItem('lol_last_result',JSON.stringify(data));
}

function loadLastResult(){
  const raw=localStorage.getItem('lol_last_result');
  if(!raw)return;
  try{
    const d=JSON.parse(raw);
    const banner=document.getElementById('last-result-banner');
    const champEl=document.getElementById('last-result-champ');
    const metaEl=document.getElementById('last-result-meta');
    champEl.textContent=d.champName;
    let meta=d.matchPct+'%';
    if(d.lane)meta+='  '+d.lane;
    if(d.date)meta+='  '+d.date;
    metaEl.textContent=meta;
    banner.style.display='flex';
  }catch(e){}
}

function clearLastResult(){
  localStorage.removeItem('lol_last_result');
  document.getElementById('last-result-banner').style.display='none';
}
