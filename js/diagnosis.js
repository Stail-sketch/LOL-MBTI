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
  const offset=PHASE_OFFSET[currentPhase];
  const q=allActiveQuestions[offset+currentQ];
  const btn=chosen===1?btnA:btnB;
  btn.classList.add('selected');
  const isHigh=(q.hi==='a'&&chosen===1)||(q.hi==='b'&&chosen===0);
  if(isHigh)scores[q.dim]++;
  answerHistory.push({dim:q.dim,isHigh});
  const phaseTotal=PHASE_LENGTH[currentPhase];
  setTimeout(()=>{
    currentQ++;
    if(currentQ>=phaseTotal){
      if(currentPhase===1){
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
  if(currentQ===0)return;
  const last=answerHistory.pop();
  if(last.isHigh)scores[last.dim]--;
  currentQ--;
  renderQuestion();
}

function calculateAndShowResult(){
  showScreen('loading-screen');
  const answeredQs=allActiveQuestions.slice(0,currentPhaseEnd);
  const dimCount={};
  ['V','I','H','T','A','W','S','D'].forEach(d=>{
    dimCount[d]=answeredQs.filter(q=>q.dim===d).length||1;
  });
  const normalized={};
  Object.keys(scores).forEach(k=>{
    normalized[k]=Math.min(100,Math.round((scores[k]/dimCount[k])*100));
  });
  lastNormalized=normalized;
  buildLaneResultsCache(normalized);
  ['TOP','JUNGLE','MID','ADC','SUPPORT','ANY'].forEach(lane=>{
    if(laneResultsCache[lane]){const img=new Image();img.src=`https://cdn.communitydragon.org/latest/champion/${laneResultsCache[lane].champ.id}/splash-art/centered`;}
  });
  setTimeout(()=>{showResult(normalized);},2200);
}

function buildLaneResultsCache(normalized){
  const maxDist=Math.sqrt(8*100*100);
  ['TOP','JUNGLE','MID','ADC','SUPPORT'].forEach(lane=>{
    const pool=CHAMPIONS.filter(c=>c.roles.includes(lane));
    const ranked=pool.map(c=>{
      let dist=0;
      Object.keys(normalized).forEach(dim=>{const d=normalized[dim]-c.scores[dim];dist+=d*d;});
      return{...c,dist};
    }).sort((a,b)=>a.dist-b.dist);
    const matchPct=Math.round(98-(Math.sqrt(ranked[0].dist)/maxDist)*33);
    laneResultsCache[lane]={champ:ranked[0],matchPct,alts:ranked.slice(1,5)};
  });
  const allRanked=CHAMPIONS.map(c=>{
    let dist=0;
    Object.keys(normalized).forEach(dim=>{const d=normalized[dim]-c.scores[dim];dist+=d*d;});
    return{...c,dist};
  }).sort((a,b)=>a.dist-b.dist);
  const anyPct=Math.round(98-(Math.sqrt(allRanked[0].dist)/maxDist)*33);
  laneResultsCache['ANY']={champ:allRanked[0],matchPct:anyPct,alts:allRanked.slice(1,5)};
}

// ===== SUMMONER TYPES =====
function getSummonerType(normalized){
  let best=null,bestDist=Infinity;
  SUMMONER_TYPES.forEach(t=>{
    let d=0;
    Object.keys(t.profile).forEach(k=>{const diff=(normalized[k]||50)-t.profile[k];d+=diff*diff;});
    if(t.id==='balanced') d+=1800;
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
