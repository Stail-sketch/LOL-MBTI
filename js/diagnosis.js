// diagnosis.js - 診断ロジック

function initQuestions(){
  const dims=['V','I','H','T','A','W','S','D'];
  const byDim={};
  dims.forEach(d=>{byDim[d]=[...QUESTION_DATA.filter(q=>q.dim===d)].sort(()=>Math.random()-.5);});
  const ordered=[];
  const maxLen=Math.max(...dims.map(d=>byDim[d].length));
  for(let i=0;i<maxLen;i++){dims.forEach(d=>{if(byDim[d][i])ordered.push(byDim[d][i]);});}
  return ordered;
}

function answer(chosen){
  const btnA=document.getElementById('choice-a');
  const btnB=document.getElementById('choice-b');
  if(btnA.disabled)return;
  btnA.disabled=true;
  btnB.disabled=true;
  document.getElementById('back-btn').disabled=true;
  const offset=PHASE_OFFSET[State.currentPhase];
  const q=State.allActiveQuestions[offset+State.currentQ];
  const btn=chosen===1?btnA:btnB;
  btn.classList.add('selected');
  const isHigh=(q.hi==='a'&&chosen===1)||(q.hi==='b'&&chosen===0);
  recordAnswer(q.dim,isHigh);
  const phaseTotal=PHASE_LENGTH[State.currentPhase];
  const run=State._run;
  setTimeout(()=>{
    if(run!==State._run)return;
    State.currentQ++;
    if(State.currentQ>=phaseTotal){
      if(State.currentPhase===1){
        document.querySelectorAll('#lane-screen .role-card').forEach(c=>c.classList.remove('selected'));
        document.getElementById('lane-next-btn').disabled=true;
        showScreen('lane-screen');
      } else {
        calculateAndShowResult();
      }
    } else {
      renderQuestion();
    }
  },300);
}

function goBack(){
  const last=undoAnswer();
  if(!last)return;
  renderQuestion();
}

function calculateAndShowResult(){
  showScreen('loading-screen');
  const answeredQs=State.allActiveQuestions.slice(0,State.currentPhaseEnd);
  const dimCount={};
  ['V','I','H','T','A','W','S','D'].forEach(d=>{
    dimCount[d]=answeredQs.filter(q=>q.dim===d).length||1;
  });
  const normalized={};
  Object.keys(State.scores).forEach(k=>{
    normalized[k]=Math.min(100,Math.round((State.scores[k]/dimCount[k])*100));
  });
  State.lastNormalized=normalized;
  buildLaneResultsCache(normalized);
  ['TOP','JUNGLE','MID','ADC','SUPPORT','ANY'].forEach(lane=>{
    if(State.laneResultsCache[lane]){const img=new Image();img.src=`https://cdn.communitydragon.org/latest/champion/${State.laneResultsCache[lane].champ.id}/splash-art/centered`;}
  });
  const run=State._run;
  setTimeout(()=>{if(run===State._run)showResult(normalized);},2200);
}

// 回答の点数をチャンピオン・タイプの値と同じ物差しに直すための足し算（照合にだけ使い、画面の数字と記録は生の点数のまま）。
// チャンピオンとタイプの値は「普通の人＝50前後」で作ってあるが、実際の回答者は外向性・計画性・積極性をずっと低く答える
// （2026-11-22、32問10,505件の平均 V26 I55 H55 T35 A42 W45 S56 D43 に対し、チャンピオン平均 V56 I57 H42 T64 A70 W61 S43 D63）。
// そのままだと誰でも内向的・協調的なチャンピオン（アムム6%など）や守護者・万能に寄るので、平均の差だけ足す。
// 平均と散らばりの両方を合わせる方式も試したが、タイプが万能・天才直感師に寄り直して偏りが残った
const MATCH_SHIFT={V:30,I:2,H:-13,T:29,A:28,W:16,S:-13,D:20};
function toMatchSpace(normalized){
  const out={};
  Object.keys(MATCH_SHIFT).forEach(k=>{out[k]=(normalized[k]??50)+MATCH_SHIFT[k];});
  return out;
}

function buildLaneResultsCache(normalized){
  normalized=toMatchSpace(normalized);
  const maxDist=Math.sqrt(8*100*100);
  ['TOP','JUNGLE','MID','ADC','SUPPORT'].forEach(lane=>{
    const pool=CHAMPIONS.filter(c=>c.roles.includes(lane));
    const ranked=pool.map(c=>{
      let dist=0;
      Object.keys(normalized).forEach(dim=>{const d=normalized[dim]-c.scores[dim];dist+=d*d;});
      return{...c,dist};
    }).sort((a,b)=>a.dist-b.dist);
    const matchPct=Math.round(98-(Math.sqrt(ranked[0].dist)/maxDist)*33);
    State.laneResultsCache[lane]={champ:ranked[0],matchPct,alts:ranked.slice(1,5)};
  });
  const allRanked=CHAMPIONS.map(c=>{
    let dist=0;
    Object.keys(normalized).forEach(dim=>{const d=normalized[dim]-c.scores[dim];dist+=d*d;});
    return{...c,dist};
  }).sort((a,b)=>a.dist-b.dist);
  const anyPct=Math.round(98-(Math.sqrt(allRanked[0].dist)/maxDist)*33);
  State.laneResultsCache['ANY']={champ:allRanked[0],matchPct:anyPct,alts:allRanked.slice(1,5)};
}

// ===== SUMMONER TYPES =====
function getSummonerType(normalized){
  normalized=toMatchSpace(normalized);
  let best=null,bestDist=Infinity;
  SUMMONER_TYPES.forEach(t=>{
    let d=0;
    Object.keys(t.profile).forEach(k=>{const diff=(normalized[k]??50)-t.profile[k];d+=diff*diff;});
    if(t.id==='balanced') d+=1000;
    if(d<bestDist){bestDist=d;best=t;}
  });
  return best;
}

function findNearestSummonerType(scores){
  const dims=['V','I','H','T','A','W','S','D'];
  let best=null,bestDist=Infinity;
  SUMMONER_TYPES.forEach(t=>{
    let dist=0;
    dims.forEach(k=>{const d=(scores[k]||0)-(t.profile[k]||0);dist+=d*d;});
    if(t.id==='balanced') dist+=1800;
    if(dist<bestDist){bestDist=dist;best=t;}
  });
  return best;
}
