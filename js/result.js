// result.js - 結果表示・レーン切替

function showResult(normalized){
  showAdOverlay(()=>{_showResultInner(normalized);});
}
function _showResultInner(normalized){
  showScreen('result-screen');
  document.getElementById('lane-tabs').style.display='flex';
  document.querySelectorAll('.lane-tab').forEach(t=>{t.style.animation='none';t.offsetHeight;t.style.animation='';});
  const displayLane=selectedLane==='ANY'?getBestLane():(selectedLane||'TOP');
  renderLaneTabs(displayLane);
  const cache=laneResultsCache[displayLane];
  renderChampionCard(cache.champ,cache.matchPct,displayLane);
  const addBtn=document.getElementById('btn-add-diagnosis');
  addBtn.style.display=currentPhaseEnd<32?'block':'none';
  const is16=currentPhaseEnd>=16;
  const is32=currentPhaseEnd>=32;
  ['sec-type','sec-catchphrase'].forEach(id=>document.getElementById(id).classList.toggle('hidden',!is16));
  ['sec-perception','sec-sw','sec-synergy','sec-opposite','sec-allies','sec-enemies','sec-axis'].forEach(id=>document.getElementById(id).classList.toggle('hidden',!is32));
  document.getElementById('ranking-section').classList.toggle('hidden',!is32);
  let detectedTypeName='';
  let detectedTypeNameJP='';
  if(is16){
    const type=getSummonerType(normalized);
    detectedTypeNameJP=type.name;
    const enType=currentLang==='en'&&SUMMONER_TYPES_EN[type.id]?SUMMONER_TYPES_EN[type.id]:null;
    detectedTypeName=enType?enType.name:type.name;
    renderTypeSection(type);
    if(is32)renderFullSection(type,normalized);
  }
  drawRadar(normalized);buildLegend(normalized);
  applyResultLang();
  updateSharePreview(cache.champ,cache.matchPct,detectedTypeName);
  saveLastResult(cache.champ,cache.matchPct,detectedTypeNameJP,displayLane);
  if(is32){
    sendDiagnosisResult(cache.champ,detectedTypeNameJP,selectedLane)
      .then(()=>loadRankings());
  }
}

function switchLaneTab(lane){
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if(lane==='ANY')lane=getBestLane();
  if(!laneResultsCache[lane])return;
  renderLaneTabs(lane);
  const cache=laneResultsCache[lane];
  renderChampionCard(cache.champ,cache.matchPct,lane);
  updateSharePreview(cache.champ,cache.matchPct,'',lane);
}

function updateSharePreview(champ,matchPct,typeName,lane){
  window._shareData={champ,matchPct,typeName,lane:lane!==undefined?lane:selectedLane};
}

function renderFullSection(type,normalized){
  const isEN=currentLang==='en';
  const enType=isEN&&SUMMONER_TYPES_EN[type.id]?SUMMONER_TYPES_EN[type.id]:null;
  // シナジー召喚士タイプ
  if(type.synergy){
    const syn=SUMMONER_TYPES.find(t=>t.id===type.synergy.id);
    if(syn){
      const synEN=isEN&&SUMMONER_TYPES_EN[syn.id]?SUMMONER_TYPES_EN[syn.id]:null;
      document.getElementById('synergy-type-name').textContent=synEN?synEN.name:syn.name;
      document.getElementById('synergy-type-sub').textContent=synEN?synEN.subtitle:syn.subtitle;
      document.getElementById('synergy-reason').textContent=enType?enType.synergy.reason:type.synergy.reason;
    }
  }
  // 逆診断
  if(type.opposite){
    const opp=SUMMONER_TYPES.find(t=>t.id===type.opposite.id);
    if(opp){
      const oppEN=isEN&&SUMMONER_TYPES_EN[opp.id]?SUMMONER_TYPES_EN[opp.id]:null;
      document.getElementById('opposite-type-name').textContent=oppEN?oppEN.name:opp.name;
      document.getElementById('opposite-type-sub').textContent=oppEN?oppEN.subtitle:opp.subtitle;
      document.getElementById('opposite-reason').textContent=enType?enType.opposite.reason:type.opposite.reason;
    }
  }
  // 相性・天敵
  const alliesGrid=document.getElementById('allies-grid');
  alliesGrid.innerHTML='';
  type.allies.slice(0,4).forEach(id=>alliesGrid.appendChild(buildAffinityCard(id,'ally')));
  const enemiesGrid=document.getElementById('enemies-grid');
  enemiesGrid.innerHTML='';
  type.enemies.slice(0,4).forEach(id=>enemiesGrid.appendChild(buildAffinityCard(id,'enemy')));
  // 8軸詳細
  const axisList=document.getElementById('axis-list');
  axisList.innerHTML='';
  DIMENSIONS.forEach(d=>{
    const val=normalized[d.key]||0;
    const axisDesc=isEN?getAxisDetailEN(d.key,val):getAxisDetail(d.key,val);
    const axisName=isEN?d.en:d.name;
    const row=document.createElement('div');
    row.className='axis-row';
    row.innerHTML=`
      <div class="axis-row-left">
        <div class="axis-key" style="color:${d.color}">${d.key}</div>
        <div class="axis-name">${axisName}</div>
      </div>
      <div class="axis-row-right">
        <div class="axis-en" style="color:${d.color}">${d.en}</div>
        <div class="axis-bar-wrap">
          <div class="axis-bar-bg"><div class="axis-bar-fill" style="width:${val}%;background:${d.color}"></div></div>
          <div class="axis-val" style="color:${d.color}">${val}</div>
        </div>
        <div class="axis-desc">${axisDesc}</div>
      </div>`;
    axisList.appendChild(row);
  });
}

function getAxisDetail(key,val){
  const low=val<35,high=val>65;
  const details={
    V:{low:'内向的なサモナー。一人で集中してプレイするのが得意で、チームチャットより行動で語るタイプ。静かな環境で真価を発揮する。',mid:'状況に応じて内向きと外向きを切り替えられる柔軟なサモナー。一人でもチームでも適応できる安定感がある。',high:'外向的で積極的にコミュニケーションを取るサモナー。チームを盛り上げ、自ら声を上げてゲームを動かす存在だ。'},
    I:{low:'現実的・具体的な思考のサモナー。実績と事実に基づいた判断を好み、定石を大切にする安定型だ。',mid:'直感と現実のバランスが取れたサモナー。状況に応じてセオリーと閃きを使い分けることができる。',high:'直感力が高いサモナー。データより感覚を信じ、誰も気づかない可能性を嗅ぎ取る先見の明を持つ。'},
    H:{low:'論理優先の冷静なサモナー。感情に流されず、最適解を合理的に選べる。感情的な仲間に振り回されない強さがある。',mid:'感情と論理のバランスが取れたサモナー。場面に応じて共感と冷静さを切り替えられる。',high:'共感性の高いサモナー。仲間の状態を敏感に感じ取り、チームの感情的な支柱となる。'},
    T:{low:'柔軟で即興性の高いサモナー。計画より流れを重視し、変化する状況にアドリブで対応できる。',mid:'計画性と柔軟性のバランスが良いサモナー。状況次第でどちらにも対応できる万能さがある。',high:'計画性の高いサモナー。準備を怠らず、ゲームの流れを設計して動く。想定外に弱いが、想定内なら無敵だ。'},
    A:{low:'慎重で控えめなサモナー。リスクを避け、安全な選択を好む。サポート的な役割を自然と担うことが多い。',mid:'積極性と慎重さのバランスが良いサモナー。場面ごとに出るべきか引くべきかを判断できる。',high:'積極性が高いサモナー。チャンスを逃さず前に出る勇気があり、戦場を自ら動かすタイプだ。'},
    W:{low:'リスク回避型のサモナー。安全な選択を好み、確実性を重視する。堅実な動きでじっくりと試合を組み立てる。',mid:'リスクとリターンのバランス感覚が優れたサモナー。無謀な賭けはしないが、チャンスには飛び込める。',high:'リスク志向のサモナー。高いリターンのためなら失敗を恐れない。予測不能な動きで相手を翻弄する。'},
    S:{low:'個人主義のサモナー。自分のプレイに集中し、一人でゲームを決める力を持つ。チームより個人の実力で勝負する。',mid:'個人とチームのバランスが良いサモナー。状況に応じてソロプレイとチームプレイを切り替えられる。',high:'協調性の高いサモナー。チームを最優先にし、仲間の動きを引き立てることに喜びを見出す。'},
    D:{low:'瞬発型のサモナー。即座の判断と爆発的なプレイを得意とし、長期戦より短期決戦を好む。',mid:'瞬発力と持続力のバランスが良いサモナー。短期・長期どちらのゲームにも対応できる安定感がある。',high:'忍耐力の高いサモナー。長期的な視点でゲームを組み立て、じっくりと力を蓄えて最終的に全てを制圧する。'},
  };
  const d=details[key];
  return low?d.low:high?d.high:d.mid;
}

function getAxisDetailEN(key,val){
  const low=val<35,high=val>65;
  const d={
    V:{low:'An introverted summoner. You perform best when focused alone, speaking through actions. Your true strength shines in quiet, focused conditions.',mid:'A flexible summoner who shifts between introversion and extroversion. You perform well solo or as part of a team.',high:'An extroverted summoner who thrives on communication. You energize the team, call plays, and actively shape how the game unfolds.'},
    I:{low:'A grounded, concrete thinker. You rely on facts, track records, and proven methods — a stable player who respects the fundamentals.',mid:'A balanced summoner who blends intuition with realism. You can switch between theory and gut feeling when needed.',high:'A highly intuitive summoner. You trust sensation over data and have an uncanny nose for possibilities others miss.'},
    H:{low:'A cool-headed, logic-first summoner. You make optimal calls without being swayed by emotion — and you don\'t get pulled into teammates\' drama.',mid:'A summoner with a healthy balance of empathy and logic. You can switch between compassion and clear-headedness as the moment demands.',high:'A highly empathetic summoner. You sense your teammates\' state acutely and serve as the emotional anchor of the team.'},
    T:{low:'A flexible, improvisational summoner. You prioritize flow over rigid plans and adapt on the fly.',mid:'A summoner with a solid balance of structure and spontaneity. You operate effectively whether the game is scripted or chaotic.',high:'A highly structured summoner. You prepare thoroughly and execute a designed gameplan. In predictable situations, you\'re unstoppable.'},
    A:{low:'A cautious, reserved summoner. You avoid unnecessary risk and naturally drift toward supportive roles.',mid:'A summoner with a good balance of initiative and caution. You know when to push and when to pull back.',high:'A highly assertive summoner. You have the courage to make moves others hesitate on and the drive to shape the battlefield.'},
    W:{low:'A risk-averse summoner. You favor safe, reliable choices and build the game methodically.',mid:'A summoner with a sharp sense of risk-reward. You don\'t gamble recklessly, but you can seize real opportunities.',high:'A risk-hungry summoner. You\'re not afraid to fail for the high-value play. Unpredictable moves are your trademark.'},
    S:{low:'An individualist summoner. Self-reliant, capable of deciding games through personal performance alone.',mid:'A summoner with a solid balance of solo play and teamwork. You adapt between carrying and enabling situationally.',high:'A highly cooperative summoner. The team comes first, and your greatest joy is enabling your teammates to shine.'},
    D:{low:'A burst-style summoner. You excel at snap decisions and explosive plays, preferring short decisive engagements.',mid:'A summoner with a strong balance of burst and endurance. You handle both fast and slow-paced games.',high:'A highly durable summoner. You build the game with a long-term view, accumulate power patiently, and eventually dominate everything.'},
  };
  return low?d[key].low:high?d[key].high:d[key].mid;
}
