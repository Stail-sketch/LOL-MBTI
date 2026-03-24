// main.js - グローバルstate・イベント初期化

// ===== STATE（全状態を1箇所に集約）=====
const State={
  currentLang:'jp',
  selectedLane:null,
  currentPhase:1,       // 1=1-16問, 2=17-32問
  currentQ:0,           // フェーズ内の問番号(0-indexed)
  currentPhaseEnd:16,   // フェーズ終了点(16/32)
  scores:{V:0,I:0,H:0,T:0,A:0,W:0,S:0,D:0},
  allActiveQuestions:[], // 32問まで利用
  laneResultsCache:{},  // 全レーン結果キャッシュ
  lastNormalized:null,
  answerHistory:[],     // [{dim, isHigh}] フェーズ内の回答履歴（戻る機能用）
  _adCallback:null,
  _rankTotalValue:0,
};

// ===== 状態操作関数 =====
function resetState(){
  State.selectedLane=null;State.currentPhase=1;State.currentQ=0;State.currentPhaseEnd=16;
  State.scores={V:0,I:0,H:0,T:0,A:0,W:0,S:0,D:0};
  State.laneResultsCache={};State.lastNormalized=null;State.answerHistory=[];
}
function recordAnswer(dim,isHigh){
  if(isHigh)State.scores[dim]++;
  State.answerHistory.push({dim,isHigh});
}
function undoAnswer(){
  if(State.currentQ===0)return null;
  const last=State.answerHistory.pop();
  if(last&&last.isHigh)State.scores[last.dim]--;
  State.currentQ--;
  return last;
}
function advancePhase(){
  State.currentPhase++;
  State.currentQ=0;
  State.currentPhaseEnd=32;
  State.answerHistory=[];
}

// ===== LANG TOGGLE =====
function setLang(lang){
  State.currentLang=lang;
  document.getElementById('lang-jp').classList.toggle('active',lang==='jp');
  document.getElementById('lang-en').classList.toggle('active',lang==='en');
  const L=LANG_DATA[lang];
  document.getElementById('main-subtitle').textContent=L.subtitle;
  document.getElementById('main-title').textContent=L.title;
  document.getElementById('main-desc').innerHTML=L.desc;
  document.getElementById('btn-start').textContent=L.startBtn;
  L.statLabels.forEach((t,i)=>{const el=document.getElementById('stat-label-'+i);if(el)el.textContent=t;});
  document.getElementById('lane-title').textContent=L.laneTitle;
  document.getElementById('lane-desc').textContent=L.laneDesc;
  const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t;};
  if(L.roleDescs){['TOP','JUNGLE','MID','ADC','SUPPORT'].forEach(r=>set('role-desc-'+r,L.roleDescs[r]||''));}
  set('role-name-ANY',L.roleNameAny||'どこでも');
  set('role-desc-ANY',L.roleDescAny||'全167体から診断');
  set('lane-next-btn',L.laneNextBtn||'結果を見る');
  set('back-btn',L.backBtn||'← 戻る');
}

// ===== OGP 絶対URL設定 =====
(function(){const base=window.location.origin+window.location.pathname.replace(/\/[^\/]*$/,'/');const img=base+'image.png';document.querySelector('meta[property="og:image"]').content=img;document.querySelector('meta[name="twitter:image"]').content=img;})();

// ===== PARTICLES =====
(function(){const c=document.getElementById('particles');for(let i=0;i<25;i++){const p=document.createElement('div');p.className='particle';const s=Math.random()*3+1;p.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;animation-duration:${Math.random()*15+10}s;animation-delay:${Math.random()*15}s;`;c.appendChild(p);}})();

// ===== 離脱防止 =====
history.pushState(null,'',location.href);
function isGuardedScreen(){
  return ['question-screen','loading-screen','result-screen'].some(
    id=>document.getElementById(id).classList.contains('active')
  );
}
window.addEventListener('beforeunload',function(e){
  if(isGuardedScreen()){e.preventDefault();e.returnValue='';}
});
window.addEventListener('popstate',function(){
  if(isGuardedScreen()){
    if(!confirm('診断を中断しますか？\n回答データが失われます。')){
      history.pushState(null,'',location.href);
    }else{
      retryDiagnosis();
    }
  }else{
    history.pushState(null,'',location.href);
  }
});

// ===== フェーズ定数 =====
const PHASE_OFFSET={1:0,2:16};
const PHASE_LENGTH={1:16,2:16};

// ===== 広告オーバーレイ =====
function showAdOverlay(callback){
  State._adCallback=callback;
  document.getElementById('ad-overlay').classList.add('active');
}
function closeAdOverlay(){
  document.getElementById('ad-overlay').classList.remove('active');
  if(State._adCallback){const cb=State._adCallback;State._adCallback=null;cb();}
}

function openAboutModal(){
  document.getElementById('about-modal').style.display='flex';
  document.body.style.overflow='hidden';
}
function closeAboutModal(e){
  if(e&&e.target!==document.getElementById('about-modal')&&!e.target.classList.contains('modal-close'))return;
  document.getElementById('about-modal').style.display='none';
  document.body.style.overflow='';
}

// ===== キーボード操作 =====
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(document.getElementById('about-modal').style.display!=='none')closeAboutModal();
    if(document.getElementById('ad-overlay').classList.contains('active'))closeAdOverlay();
  }
});

// ===== テストモード（?test=1 で有効、?test=100 で100回自動診断、本番では無効）=====
const _testParam=new URLSearchParams(location.search).get('test');
const _isProduction=location.hostname==='stail-sketch.github.io';
const TEST_MODE=!_isProduction&&(_testParam==='1'||parseInt(_testParam)>1);
const TEST_BATCH=!_isProduction&&parseInt(_testParam)>1?parseInt(_testParam):0;

function _testAutoAnswer(from,to){
  for(let i=from;i<to;i++){
    const q=State.allActiveQuestions[i];if(!q)break;
    const isHigh=Math.random()>.5;
    recordAnswer(q.dim,isHigh);
  }
}
function _testShowResult(){
  const answeredQs=State.allActiveQuestions.slice(0,State.currentPhaseEnd);
  const dimCount={};
  ['V','I','H','T','A','W','S','D'].forEach(d=>{dimCount[d]=answeredQs.filter(q=>q.dim===d).length||1;});
  const normalized={};
  Object.keys(State.scores).forEach(k=>{normalized[k]=Math.min(100,Math.round((State.scores[k]/dimCount[k])*100));});
  State.lastNormalized=normalized;
  buildLaneResultsCache(normalized);
  _showResultInner(normalized);
}

async function _testRunBatch(count){
  console.log(`[テスト] ${count}回の自動診断を開始`);
  const lanes=['TOP','JUNGLE','MID','ADC','SUPPORT','ANY'];
  for(let i=0;i<count;i++){
    resetState();
    State.allActiveQuestions=initQuestions();
    _testAutoAnswer(0,16);
    State.selectedLane=lanes[Math.floor(Math.random()*lanes.length)];
    State.currentPhaseEnd=16;
    _testAutoAnswer(16,32);
    State.currentPhaseEnd=32;
    const answeredQs=State.allActiveQuestions.slice(0,32);
    const dimCount={};
    ['V','I','H','T','A','W','S','D'].forEach(d=>{dimCount[d]=answeredQs.filter(q=>q.dim===d).length||1;});
    const normalized={};
    Object.keys(State.scores).forEach(k=>{normalized[k]=Math.min(100,Math.round((State.scores[k]/dimCount[k])*100));});
    State.lastNormalized=normalized;
    buildLaneResultsCache(normalized);
    const displayLane=State.selectedLane==='ANY'?getBestLane():(State.selectedLane||'TOP');
    const cache=State.laneResultsCache[displayLane];
    const type=getSummonerType(normalized);
    const typeName=type?type.name:'不明';
    console.log(`[テスト ${i+1}/${count}] ロール:${State.selectedLane} チャンプ:${cache.champ.name} タイプ:${typeName}`);
    await sendDiagnosisResult(cache.champ,typeName,State.selectedLane);
  }
  console.log(`[テスト] ${count}回の自動診断が完了しました`);
  alert(`${count}回の自動診断が完了しました！`);
  loadRankings();
}

function startDiagnosis(){
  if(TEST_BATCH>0){_testRunBatch(TEST_BATCH);return;}
  resetState();
  State.allActiveQuestions=initQuestions();
  document.getElementById('lang-toggle').style.display='none';
  if(TEST_MODE){
    _testAutoAnswer(0,16);
    const lanes=['TOP','JUNGLE','MID','ADC','SUPPORT','ANY'];
    State.selectedLane=lanes[Math.floor(Math.random()*lanes.length)];
    State.currentPhaseEnd=16;
    _testShowResult();
  } else {
    showAdOverlay(()=>{showScreen('question-screen');renderQuestion();});
  }
}

function selectLane(lane,el){
  State.selectedLane=lane;
  document.querySelectorAll('#lane-screen .role-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('lane-next-btn').disabled=false;
}

function proceedFromLane(){
  if(!State.selectedLane)return;
  calculateAndShowResult();
}

function continueToNextPhase(){
  advancePhase();
  if(TEST_MODE){
    _testAutoAnswer(16,32);
    _testShowResult();
  } else {
    showScreen('question-screen');
    renderQuestion();
  }
}

function retryDiagnosis(){
  startDiagnosis();
}

function goToTop(){
  resetState();
  State.allActiveQuestions=[];
  document.getElementById('lang-toggle').style.display='flex';
  showScreen('start-screen');
  loadLastResult();
}

// URL routing for champion detail pages
(function(){
  const p=new URLSearchParams(location.search);
  const champId=p.get('champ');
  const kind=p.get('kind')||'ally';
  if(champId)showChampDetail(decodeURIComponent(champId),kind);
})();

// ===== WORKER FUNCTIONS =====
function sendDiagnosisResult(champ,typeName,role){
  console.log('[診断送信]',{champId:champ.id,champName:champ.name,typeName,role});
  return fetch(WORKER_URL+'/record',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({champId:champ.id,champName:champ.name,typeName:typeName||'',role:role||'TOP'})
  }).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(data=>{
    console.log('[診断送信結果]',data);
    if(data.rankings)renderRankings(data.rankings);
  }).catch(e=>{console.error('ランキング送信失敗:',e);});
}

function loadRankings(){
  fetch(WORKER_URL+'/rankings')
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(data=>renderRankings(data))
    .catch(e=>{
      console.error('ランキング取得失敗:',e);
      renderRankings({total:0,champions:[],types:[],roles:[]});
    });
}

function _esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function renderRankings({total,champions,types,roles}){
  State._rankTotalValue=total;
  document.getElementById('rank-total').textContent=total.toLocaleString()+' 回';
  const cEl=document.getElementById('rank-champions');
  cEl.innerHTML='';
  champions.forEach(([id,cnt],i)=>{
    const c=CHAMPIONS.find(x=>x.id===id)||{id,name:id};
    const div=document.createElement('div');div.className='rank-item';
    div.innerHTML=`<span class="rank-num">${i+1}</span><img class="rank-champ-icon" src="champion_icons/${_esc(id)}.png" alt="${_esc(c.name)}" onerror="this.style.display='none'">`;
    const nameSpan=document.createElement('span');nameSpan.className='rank-name';nameSpan.textContent=c.name;
    const cntSpan=document.createElement('span');cntSpan.className='rank-count';cntSpan.textContent=cnt+'回';
    div.appendChild(nameSpan);div.appendChild(cntSpan);cEl.appendChild(div);
  });
  const tEl=document.getElementById('rank-types');
  tEl.innerHTML='';
  types.forEach(([name,cnt],i)=>{
    const div=document.createElement('div');div.className='rank-item';
    const numSpan=document.createElement('span');numSpan.className='rank-num';numSpan.textContent=i+1;
    const nameSpan=document.createElement('span');nameSpan.className='rank-name';nameSpan.textContent=name;
    const cntSpan=document.createElement('span');cntSpan.className='rank-count';cntSpan.textContent=cnt+'回';
    div.appendChild(numSpan);div.appendChild(nameSpan);div.appendChild(cntSpan);tEl.appendChild(div);
  });
  const rEl=document.getElementById('rank-roles');
  const roleIconSrc={TOP:'role_icons/top.png',JUNGLE:'role_icons/jungle.png',MID:'role_icons/mid.png',ADC:'role_icons/adc.png',SUPPORT:'role_icons/support.png',ANY:'role_icons/fill.png'};
  const roleLabel={TOP:'TOP',JUNGLE:'JUNGLE',MID:'MID',ADC:'ADC',SUPPORT:'SUPPORT',ANY:'どこでも'};
  rEl.innerHTML='';
  roles.forEach(([role,cnt],i)=>{
    const div=document.createElement('div');div.className='rank-item';
    const numSpan=document.createElement('span');numSpan.className='rank-num';numSpan.textContent=i+1;
    const nameSpan=document.createElement('span');nameSpan.className='rank-name';
    if(roleIconSrc[role]){const img=document.createElement('img');img.className='rank-role-icon';img.src=roleIconSrc[role];img.alt=role;nameSpan.appendChild(img);}
    nameSpan.appendChild(document.createTextNode(roleLabel[role]||role));
    const cntSpan=document.createElement('span');cntSpan.className='rank-count';cntSpan.textContent=cnt+'回';
    div.appendChild(numSpan);div.appendChild(nameSpan);div.appendChild(cntSpan);rEl.appendChild(div);
  });
}

// ===== NEW ANIMATIONS =====

// Typewriter effect for main title
(function(){
  function typewrite(el,text,speed){
    if(!el)return;
    el.textContent='';
    let i=0;
    const t=setInterval(()=>{
      if(i<text.length){el.textContent+=text[i];i++;}
      else clearInterval(t);
    },speed);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    loadLastResult();
    const el=document.getElementById('main-title');
    if(el){const orig=el.textContent;typewrite(el,orig,60);}
  });
})();

// Parallax on scroll
(function(){
  function onScroll(){
    const y=window.pageYOffset;
    document.querySelectorAll('.parallax-slow').forEach(el=>{el.style.transform='translateY('+y*.2+'px)';});
    document.querySelectorAll('.parallax-fast').forEach(el=>{el.style.transform='translateY('+y*.4+'px)';});
  }
  window.addEventListener('scroll',onScroll,{passive:true});
})();

// Intersection Observer for ranking count-up
(function(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting&&State._rankTotalValue>0){
        const el=document.getElementById('rank-total');
        if(el)animateCount(el,0,State._rankTotalValue,1200);
        obs.unobserve(e.target);
      }
    });
  },{threshold:.4});
  const sec=document.getElementById('ranking-section');
  if(sec)obs.observe(sec);
})();
