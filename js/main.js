// main.js - グローバルstate・イベント初期化

// ===== LANG TOGGLE =====
let currentLang='jp';
function setLang(lang){
  currentLang=lang;
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

// ===== STATE =====
let selectedLane=null;
let currentPhase=1;       // 1=1-16問, 2=17-32問
let currentQ=0;           // フェーズ内の問番号(0-indexed)
let currentPhaseEnd=16;   // フェーズ終了点(16/32)
let scores={V:0,I:0,H:0,T:0,A:0,W:0,S:0,D:0};
let allActiveQuestions=[]; // 32問まで利用
let laneResultsCache={};  // 全レーン結果キャッシュ
let lastNormalized=null;
let answerHistory=[];     // [{dim, isHigh}] フェーズ内の回答履歴（戻る機能用）

// ===== 広告オーバーレイ =====
let _adCallback=null;
function showAdOverlay(callback){
  _adCallback=callback;
  document.getElementById('ad-overlay').classList.add('active');
}
function closeAdOverlay(){
  document.getElementById('ad-overlay').classList.remove('active');
  if(_adCallback){const cb=_adCallback;_adCallback=null;cb();}
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

function resetState(){
  selectedLane=null;currentPhase=1;currentQ=0;currentPhaseEnd=16;
  scores={V:0,I:0,H:0,T:0,A:0,W:0,S:0,D:0};
  laneResultsCache={};lastNormalized=null;answerHistory=[];
}

// ===== テストモード（?test=1 で有効）=====
const TEST_MODE=new URLSearchParams(location.search).get('test')==='1';

function _testAutoAnswer(from,to){
  for(let i=from;i<to;i++){
    const q=allActiveQuestions[i];if(!q)break;
    const isHigh=Math.random()>.5;
    if(isHigh)scores[q.dim]++;
    answerHistory.push({dim:q.dim,isHigh});
  }
}
function _testShowResult(){
  const answeredQs=allActiveQuestions.slice(0,currentPhaseEnd);
  const dimCount={};
  ['V','I','H','T','A','W','S','D'].forEach(d=>{dimCount[d]=answeredQs.filter(q=>q.dim===d).length||1;});
  const normalized={};
  Object.keys(scores).forEach(k=>{normalized[k]=Math.min(100,Math.round((scores[k]/dimCount[k])*100));});
  lastNormalized=normalized;
  buildLaneResultsCache(normalized);
  _showResultInner(normalized);
}

function startDiagnosis(){
  resetState();
  allActiveQuestions=initQuestions();
  document.getElementById('lang-toggle').style.display='none';
  if(TEST_MODE){
    _testAutoAnswer(0,16);
    selectedLane='ANY';
    currentPhaseEnd=16;
    _testShowResult();
  } else {
    showAdOverlay(()=>{showScreen('question-screen');renderQuestion();});
  }
}

function selectLane(lane,el){
  selectedLane=lane;
  document.querySelectorAll('#lane-screen .role-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('lane-next-btn').disabled=false;
}

function proceedFromLane(){
  if(!selectedLane)return;
  calculateAndShowResult();
}

function continueToNextPhase(){
  currentPhase++;
  currentQ=0;
  currentPhaseEnd=32;
  answerHistory=[];
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
  allActiveQuestions=[];
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
  }).then(r=>r.json()).then(data=>{
    console.log('[診断送信結果]',data);
    if(data.rankings)renderRankings(data.rankings);
  }).catch(e=>console.warn('ランキング送信失敗:',e));
}

function loadRankings(){
  fetch(WORKER_URL+'/rankings')
    .then(r=>r.json())
    .then(data=>renderRankings(data))
    .catch(e=>{
      console.warn('ランキング取得失敗:',e);
      renderRankings({total:0,champions:[],types:[],roles:[]});
    });
}

let _rankTotalValue=0;
function renderRankings({total,champions,types,roles}){
  _rankTotalValue=total;
  document.getElementById('rank-total').textContent=total.toLocaleString()+' 回';
  const cEl=document.getElementById('rank-champions');
  cEl.innerHTML=champions.map(([id,cnt],i)=>{
    const c=CHAMPIONS.find(x=>x.id===id)||{id,name:id};
    return `<div class="rank-item"><span class="rank-num">${i+1}</span><img class="rank-champ-icon" src="champion_icons/${id}.png" alt="${c.name}" onerror="this.style.display='none'"><span class="rank-name">${c.name}</span><span class="rank-count">${cnt}回</span></div>`;
  }).join('');
  const tEl=document.getElementById('rank-types');
  tEl.innerHTML=types.map(([name,cnt],i)=>
    `<div class="rank-item"><span class="rank-num">${i+1}</span><span class="rank-name">${name}</span><span class="rank-count">${cnt}回</span></div>`
  ).join('');
  const rEl=document.getElementById('rank-roles');
  const roleIconSrc={TOP:'role_icons/top.png',JUNGLE:'role_icons/jungle.png',MID:'role_icons/mid.png',ADC:'role_icons/adc.png',SUPPORT:'role_icons/support.png',ANY:'role_icons/fill.png'};
  const roleLabel={TOP:'TOP',JUNGLE:'JUNGLE',MID:'MID',ADC:'ADC',SUPPORT:'SUPPORT',ANY:'どこでも'};
  rEl.innerHTML=roles.map(([role,cnt],i)=>{
    const iconHtml=roleIconSrc[role]?`<img class="rank-role-icon" src="${roleIconSrc[role]}" alt="${role}">` :'';
    return `<div class="rank-item"><span class="rank-num">${i+1}</span><span class="rank-name">${iconHtml}${roleLabel[role]||role}</span><span class="rank-count">${cnt}回</span></div>`;
  }).join('');
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
      if(e.isIntersecting&&_rankTotalValue>0){
        const el=document.getElementById('rank-total');
        if(el)animateCount(el,0,_rankTotalValue,1200);
        obs.unobserve(e.target);
      }
    });
  },{threshold:.4});
  const sec=document.getElementById('ranking-section');
  if(sec)obs.observe(sec);
})();
