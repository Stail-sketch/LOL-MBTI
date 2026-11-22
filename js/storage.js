// 前回の診断を、そのブラウザの中にだけ1件残す。
// 結果画面をそのまま開き直せるよう、8軸の点数と各レーンのチャンピオン・タイプも残す。
// チャンピオンとタイプは判定し直さずに残した物を使う（判定を調整した後でも、前回見た結果と同じ物を出すため）
function saveLastResult(champ,matchPct,typeName,lane,type){
  const lanes={};
  Object.keys(State.laneResultsCache).forEach(l=>{
    const c=State.laneResultsCache[l];
    lanes[l]={champId:c.champ.id,matchPct:c.matchPct};
  });
  const data={champId:champ.id,champName:champ.name,matchPct:matchPct,typeName:typeName||'',lane:lane||'',date:new Date().toLocaleDateString('ja-JP'),
    normalized:State.lastNormalized,phaseEnd:State.currentPhaseEnd,selectedLane:State.selectedLane,lanes:lanes,typeId:type?type.id:''};
  try{localStorage.setItem('lol_last_result',JSON.stringify(data));}catch(e){console.error('前回結果を保存できませんでした',e);}
}

function _readLastResult(){
  let raw=null;
  try{raw=localStorage.getItem('lol_last_result');}catch(e){return null;}
  if(!raw)return null;
  try{return JSON.parse(raw);}
  catch(e){
    console.error('前回結果の読み込みに失敗しました。データを削除します。',e);
    try{localStorage.removeItem('lol_last_result');}catch(_){}
    return null;
  }
}

// 2026-11-22 より前の保存はチャンピオン名しか無く、結果画面を組み直せない
function _canReopen(d){
  return !!(d&&d.normalized&&d.lanes&&d.phaseEnd&&Object.values(d.lanes).every(l=>CHAMPIONS.some(c=>c.id===l.champId)));
}

function loadLastResult(){
  const d=_readLastResult();
  if(!d)return;
  const banner=document.getElementById('last-result-banner');
  const champEl=document.getElementById('last-result-champ');
  const metaEl=document.getElementById('last-result-meta');
  champEl.textContent=d.champName;
  let meta=d.matchPct+'%';
  if(d.lane)meta+='  '+d.lane;
  if(d.date)meta+='  '+d.date;
  metaEl.textContent=meta;
  document.getElementById('last-result-open').disabled=!_canReopen(d);
  banner.style.display='flex';
}

function openLastResult(){
  const d=_readLastResult();
  if(!_canReopen(d))return;
  resetState();
  State._replay=true;
  State.lastNormalized=d.normalized;
  State.currentPhaseEnd=d.phaseEnd;
  State.selectedLane=d.selectedLane;
  Object.keys(d.lanes).forEach(l=>{
    State.laneResultsCache[l]={champ:CHAMPIONS.find(c=>c.id===d.lanes[l].champId),matchPct:d.lanes[l].matchPct};
  });
  document.getElementById('lang-toggle').style.display='none';
  showResult(d.normalized,{replay:true,typeId:d.typeId});
}

function clearLastResult(){
  try{localStorage.removeItem('lol_last_result');}catch(e){}
  document.getElementById('last-result-banner').style.display='none';
}
