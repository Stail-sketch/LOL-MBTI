// ui.js - UI描画・画面遷移

function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');window.scrollTo(0,0);}

function renderQuestion(){
  const offset=PHASE_OFFSET[currentPhase];
  const q=allActiveQuestions[offset+currentQ];
  const phaseTotal=PHASE_LENGTH[currentPhase];
  const pct=Math.round((currentQ/phaseTotal)*100);
  document.getElementById('progress-bar').style.width=Math.max(2,pct)+'%';
  document.getElementById('q-current').textContent=offset+currentQ+1;
  document.getElementById('q-total').textContent=currentPhaseEnd;
  let displayQ=q;
  if(currentLang==='en'){
    const idx=QUESTION_DATA.indexOf(q);
    if(idx>=0&&QUESTION_DATA_EN[idx])displayQ=QUESTION_DATA_EN[idx];
  }
  document.getElementById('question-text').textContent=displayQ.q;
  document.getElementById('choice-a').textContent=displayQ.a;
  document.getElementById('choice-b').textContent=displayQ.b;
  document.getElementById('choice-a').classList.remove('selected');
  document.getElementById('choice-b').classList.remove('selected');
  document.getElementById('choice-a').disabled=false;
  document.getElementById('choice-b').disabled=false;
  const di=DIM_LABELS[q.dim];
  document.getElementById('dim-label').textContent=currentLang==='en'?di.en:di.name;
  document.getElementById('dimension-tag').textContent=di.en;
  const card=document.getElementById('question-card');
  card.style.animation='none';card.offsetHeight;card.style.animation='questionSlideIn .35s cubic-bezier(.22,1,.36,1)';
  document.getElementById('back-btn').disabled=(currentQ===0);
}

function renderChampionCard(champ,matchPct,lane,roleIcons){
  const en=currentLang==='en'&&CHAMPIONS_EN[champ.id]?CHAMPIONS_EN[champ.id]:null;
  const displayName=en?en.nameEn:champ.name;
  const displayTitle=en?en.title:champ.title;
  const displayReason=en?en.reason:champ.reason;
  const banner=document.getElementById('champion-banner');
  banner.innerHTML=`<img class="champion-banner-img" src="https://cdn.communitydragon.org/latest/champion/${champ.id}/splash-art/centered" alt="${displayName}" onerror="this.src='champion_icons/${champ.id}.png'">`;
  document.getElementById('result-role-badge').textContent=`${lane==='ANY'?'ALL ROLES':lane}`;
  document.getElementById('result-name').textContent=displayName;
  document.getElementById('result-title').textContent=en?displayTitle:`「${displayTitle}」`;
  document.getElementById('champ-official-link').href=champOfficialUrl(champ.id);
  document.getElementById('result-reason').textContent=displayReason;
  const bar=document.getElementById('match-bar');bar.style.transition='none';bar.style.width='0%';
  setTimeout(()=>{bar.style.transition='width 1.2s cubic-bezier(0.25,0.46,0.45,0.94)';bar.style.width=matchPct+'%';},50);
  const pctEl=document.getElementById('match-pct');
  pctEl.textContent='0%';
  const dur=1200;const startTime=performance.now();
  (function tick(now){const p=Math.min((now-startTime)/dur,1);const ease=1-Math.pow(1-p,3);pctEl.textContent=Math.round(ease*matchPct)+'%';if(p<1)requestAnimationFrame(tick);})(performance.now());
}

function champOfficialUrl(id){
  const slug=CHAMP_ID_TO_URL[id]||id.toLowerCase();
  const locale=currentLang==='en'?'en-us':'ja-jp';
  return`https://www.leagueoflegends.com/${locale}/champions/${slug}/`;
}

function getBestLane(){
  const lanes=['TOP','JUNGLE','MID','ADC','SUPPORT'];
  return lanes.reduce((best,l)=>{
    if(!laneResultsCache[l])return best;
    return(!best||laneResultsCache[l].matchPct>laneResultsCache[best].matchPct)?l:best;
  },lanes[0]);
}

function renderLaneTabs(activeLane){
  document.querySelectorAll('.lane-tab').forEach(t=>t.classList.remove('active'));
  const activeTabEl=document.querySelector(`.lane-tab[onclick="switchLaneTab('${activeLane}')"]`);
  if(activeTabEl)activeTabEl.classList.add('active');
}

function renderTypeSection(type){
  const en=currentLang==='en'&&SUMMONER_TYPES_EN[type.id]?SUMMONER_TYPES_EN[type.id]:null;
  const d=en||type;
  document.getElementById('type-name').textContent=d.name;
  document.getElementById('type-subtitle').textContent=d.subtitle;
  document.getElementById('type-playstyle').textContent=d.playstyle;
  document.getElementById('sw-str').innerHTML=d.strengths.map(s=>`<div class="sw-item">${s}</div>`).join('');
  document.getElementById('sw-weak').innerHTML=d.weaknesses.map(w=>`<div class="sw-item">${w}</div>`).join('');
  const phrases=d.catchphrases||[];
  document.getElementById('catchphrase-quote').textContent=phrases[Math.floor(Math.random()*phrases.length)]||'';
  const percs=d.perceptions||[];
  const perc=percs[Math.floor(Math.random()*percs.length)]||{};
  document.getElementById('perception-ally').textContent=perc.ally||'';
  document.getElementById('perception-enemy').textContent=perc.enemy||'';
}

function buildAffinityCard(champId,kind){
  const champ=CHAMPIONS.find(c=>c.id===champId)||{id:champId,name:champId,title:''};
  const en=currentLang==='en'&&CHAMPIONS_EN[champId]?CHAMPIONS_EN[champId]:null;
  const displayName=en?en.nameEn:(champ.name||champId);
  const displayTitle=en?en.title:(champ.title||'');
  const card=document.createElement('div');
  card.className=`affinity-card ${kind}`;
  card.innerHTML=`<img class="affinity-icon-img" src="champion_icons/${champId}.png" alt="${displayName}" onerror="this.style.display='none'"><div class="affinity-name">${displayName}</div><div class="affinity-title">${displayTitle}</div>`;
  card.onclick=()=>window.open(`?champ=${encodeURIComponent(champId)}&kind=${kind}`,'_blank');
  return card;
}

function showChampDetail(champId,kind){
  const champ=CHAMPIONS.find(c=>c.id===champId);
  if(!champ)return;
  const type=findNearestSummonerType(champ.scores);
  showScreen('champ-detail-screen');
  const isAlly=kind==='ally';
  document.getElementById('cd-label').textContent=isAlly?'Soul Resonance':'Natural Enemy';
  document.getElementById('cd-title').textContent=isAlly?'あなたと相性の良いチャンピオン':'あなたの天敵チャンピオン';
  document.getElementById('cd-banner').innerHTML=`<div class="champion-banner-glow"></div><img class="champion-banner-img" src="https://cdn.communitydragon.org/latest/champion/${champ.id}/splash-art/centered" alt="${champ.name}" onerror="this.src='champion_icons/${champ.id}.png'">`;
  document.getElementById('cd-role-badge').textContent=champ.roles.join(' / ');
  document.getElementById('cd-name').textContent=champ.name;
  document.getElementById('cd-title-text').textContent=`「${champ.title}」`;
  document.getElementById('cd-reason').textContent=champ.reason||'';
  if(type){
    document.getElementById('cd-type-name').textContent=type.name;
    document.getElementById('cd-type-subtitle').textContent=type.subtitle;
    document.getElementById('cd-type-playstyle').textContent=type.playstyle;
    document.getElementById('cd-sw-str').innerHTML=type.strengths.map(s=>`<div class="sw-item">${s}</div>`).join('');
    document.getElementById('cd-sw-weak').innerHTML=type.weaknesses.map(w=>`<div class="sw-item">${w}</div>`).join('');
  }
}

function drawRadarChart(canvas,norm){
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,r=Math.min(W,H)/2-20;
  ctx.clearRect(0,0,W,H);
  const keys=['V','I','H','T','A','W','S','D'];
  const n=keys.length;
  const angles=keys.map((_,i)=>(i/n)*2*Math.PI-Math.PI/2);
  for(let lv=1;lv<=5;lv++){ctx.beginPath();angles.forEach((a,i)=>{const lr=r*lv/5,x=cx+Math.cos(a)*lr,y=cy+Math.sin(a)*lr;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.closePath();ctx.strokeStyle='rgba(200,155,60,.15)';ctx.lineWidth=1;ctx.stroke();}
  angles.forEach(a=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.strokeStyle='rgba(200,155,60,.2)';ctx.lineWidth=1;ctx.stroke();});
  ctx.beginPath();keys.forEach((k,i)=>{const val=0.25+(norm[k]/100)*0.75,x=cx+Math.cos(angles[i])*r*val,y=cy+Math.sin(angles[i])*r*val;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.closePath();ctx.fillStyle='rgba(200,155,60,.2)';ctx.fill();ctx.strokeStyle='rgba(200,155,60,.8)';ctx.lineWidth=2;ctx.stroke();
  keys.forEach((k,i)=>{const val=0.25+(norm[k]/100)*0.75,x=cx+Math.cos(angles[i])*r*val,y=cy+Math.sin(angles[i])*r*val;ctx.beginPath();ctx.arc(x,y,3,0,2*Math.PI);ctx.fillStyle=DIMENSIONS.find(d=>d.key===k).color;ctx.fill();});
  ctx.font='9px Rajdhani,sans-serif';ctx.fillStyle='rgba(200,155,60,.7)';ctx.textAlign='center';
  keys.forEach((k,i)=>{const lr=r+14,x=cx+Math.cos(angles[i])*lr,y=cy+Math.sin(angles[i])*lr+3;ctx.fillText(k,x,y);});
}

function drawRadar(norm){
  drawRadarChart(document.getElementById('radarCanvas'),norm);
}

function buildLegend(norm){
  const legend=document.getElementById('radar-legend');legend.innerHTML='';
  DIMENSIONS.forEach(d=>{
    const val=norm[d.key];
    const label=currentLang==='en'?d.en:d.name;
    const item=document.createElement('div');item.className='legend-item';
    item.innerHTML=`<div class="legend-dot" style="background:${d.color}"></div><span class="legend-text">${label}</span><span class="legend-val">${val}</span>`;
    legend.appendChild(item);
  });
}

function applyResultLang(){
  const L=LANG_DATA[currentLang];
  const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t;};
  set('result-screen-title',L.resultTitle||'あなたのチャンピオンが決まりました');
  set('champ-link-text',L.champLink||'チャンピオンの詳しい解説はこちら');
  set('match-label-el',L.matchLabel||'マッチ率');
  set('reason-title-el',L.reasonTitle||'このチャンピオンがあなたに響く理由');
  set('creed-title',L.creedTitle||'あなたの戦い方を、一言で表すなら…');
  set('perception-main-title',L.perceptionTitle||'対戦後、あなたはこう見られているかもしれない');
  set('perception-ally-label',L.fromAlly||'味方から');
  set('perception-enemy-label',L.fromEnemy||'敵から');
  set('sw-str-label',L.strengthLabel||'強み');
  set('sw-weak-label',L.weaknessLabel||'弱み');
  set('synergy-main-title',L.synergyTitle||'あなたの最強デュオタイプ');
  set('opposite-main-title',L.oppositeTitle||'あなたの逆タイプ召喚士');
  set('allies-main-title',L.alliesTitle||'相性の良いチャンピオン');
  set('enemies-main-title',L.enemiesTitle||'あなたの天敵チャンピオン');
  set('axis-main-title',L.axisTitle||'あなたの8軸詳細');
  set('radar-title-el',L.radarTitle||'あなたのパーソナリティプロフィール');
  set('btn-add-diagnosis',L.addDiagBtn||'さらに答えて精度を上げる');
  set('download-btn-text',L.downloadBtn||'結果カードをダウンロード');
  set('share-btn-text',L.shareBtn||'ポストする');
  set('btn-retry',L.retryBtn||'もう一度診断する');
  set('rank-main-title',L.rankTitle||'みんなの診断結果');
  set('rank-total-label',L.rankTotalLabel||'総診断回数');
  set('rank-champ-title',L.rankChampTitle||'チャンピオンランキング');
  set('rank-types-title',L.rankTypesTitle||'タイプランキング');
  set('rank-roles-title',L.rankRolesTitle||'ロールランキング');
  set('lane-next-btn',L.laneNextBtn||'結果を見る');
  set('back-btn',L.backBtn||'← 戻る');
  if(L.roleDescs){
    ['TOP','JUNGLE','MID','ADC','SUPPORT'].forEach(r=>set('role-desc-'+r,L.roleDescs[r]||''));
  }
  set('role-name-ANY',L.roleNameAny||'どこでも');
  set('role-desc-ANY',L.roleDescAny||'全167体から診断');
}

function animateCount(el,from,to,dur){
  const s=performance.now();
  (function upd(now){
    const p=Math.min((now-s)/dur,1);
    const v=Math.round(from+(to-from)*(1-Math.pow(1-p,3)));
    el.textContent=v.toLocaleString()+' 回';
    if(p<1)requestAnimationFrame(upd);
  })(performance.now());
}
