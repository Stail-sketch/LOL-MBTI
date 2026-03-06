// export.js - カードダウンロード・Xシェア

function drawRadarOnCard(norm){
  const canvas=document.getElementById('ce-radar');
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

async function downloadCard(){
  const isEN=currentLang==='en';
  const btn=document.getElementById('btn-download');
  const genLabel=isEN?'Generating…':'生成中…';
  const doneLabel=isEN?'⬇ Save Result Card':'⬇ 結果カードをダウンロードする';
  btn.disabled=true;
  const spanEl=document.getElementById('download-btn-text');
  if(spanEl)spanEl.textContent=genLabel;else btn.textContent=genLabel;
  try{
    const norm=lastNormalized||{};
    const d=window._shareData||{};
    const champ=d.champ;
    if(!champ){btn.disabled=false;if(spanEl)spanEl.textContent=doneLabel;else btn.textContent=doneLabel;return;}
    const is25=currentPhaseEnd>=25;
    const is40=currentPhaseEnd>=40;
    const displayLane=selectedLane==='ANY'?getBestLane():(selectedLane||'TOP');
    const champEN=isEN&&CHAMPIONS_EN[champ.id]?CHAMPIONS_EN[champ.id]:null;

    // champion block
    const iconEl=document.getElementById('ce-icon');
    iconEl.src=`champion_icons/${champ.id}.png`;
    document.getElementById('ce-champ-name').textContent=champEN?champEN.nameEn:champ.name;
    document.getElementById('ce-champ-title').textContent=champEN?champEN.title:`「${champ.title}」`;
    document.getElementById('ce-match-num').textContent=d.matchPct+'%';
    document.getElementById('ce-prog-fill').style.width=d.matchPct+'%';
    document.getElementById('ce-lane-tag').textContent=displayLane;
    document.getElementById('ce-foot-logo').textContent=isEN?'#LoLAnalyze':'#LOL鑑定';

    const show=id=>{const el=document.getElementById(id);if(el)el.style.display='';};
    const hide=id=>{const el=document.getElementById(id);if(el)el.style.display='none';};

    // summoner type block
    if(is25){
      show('ce-div-type');show('ce-type-sec');
      const type=getSummonerType(norm);
      const typeEN=isEN&&SUMMONER_TYPES_EN[type.id]?SUMMONER_TYPES_EN[type.id]:null;
      document.getElementById('ce-type-name').textContent=typeEN?typeEN.name:type.name;
      document.getElementById('ce-type-sub').textContent=typeEN?typeEN.subtitle:type.subtitle;
      const strs=typeEN?typeEN.strengths:type.strengths;
      const weaks=typeEN?typeEN.weaknesses:type.weaknesses;
      document.getElementById('ce-sw-str').innerHTML=strs.map(s=>`<div class="ce-sw-item">${s}</div>`).join('');
      document.getElementById('ce-sw-weak').innerHTML=weaks.map(w=>`<div class="ce-sw-item">${w}</div>`).join('');
    }else{hide('ce-div-type');hide('ce-type-sec');}

    // radar + affinity block
    if(is40){
      show('ce-div-radar');show('ce-radar-sec');show('ce-div-aff');show('ce-aff-sec');
      drawRadarOnCard(norm);
      document.getElementById('ce-creed').textContent=document.getElementById('catchphrase-quote').textContent||'';
    }else{hide('ce-div-radar');hide('ce-radar-sec');hide('ce-div-aff');hide('ce-aff-sec');}

    // wait for images
    await document.fonts.ready;
    const imgs=[...document.querySelectorAll('#card-export img')];
    await Promise.all(imgs.map(img=>new Promise(r=>{
      if(img.complete&&img.naturalWidth>0)r();
      else{img.onload=r;img.onerror=r;}
    })));

    const canvas=await html2canvas(document.querySelector('#card-export .ce-wrap'),{
      backgroundColor:'#010A13',scale:2,useCORS:true,allowTaint:false,logging:false,
      width:375,
    });
    const link=document.createElement('a');
    const dlName=champEN?champEN.nameEn:champ.name;
    link.download=`lol-diagnosis-${dlName}.png`;
    link.href=canvas.toDataURL('image/png');
    link.click();
  }catch(e){console.error(e);}
  btn.disabled=false;
  if(spanEl)spanEl.textContent=doneLabel;else btn.textContent=doneLabel;
}

function shareToX(){
  const isEN=currentLang==='en';
  const d=window._shareData||{};
  const champ=d.champ;
  const pct=d.matchPct||'??';
  const typeName=d.typeName||'';
  const lane=d.lane||selectedLane||'';
  const champEN=isEN&&champ&&CHAMPIONS_EN[champ.id]?CHAMPIONS_EN[champ.id]:null;
  const displayName=champEN?champEN.nameEn:(champ?champ.name:'???');
  const displayTitle=champEN?champEN.title:(champ?champ.title:'');
  let text;
  if(isEN){
    text='🎮 LoL Summoner Personality Diagnosis\n\n';
    text+=`${lane==='ANY'?'ALL ROLES':lane} | ${displayName}\n`;
    text+=`${displayTitle}\n`;
    text+=`Match Rate: ${pct}%\n`;
    if(typeName) text+=`Summoner Type: ${typeName}\n`;
    text+='\n#LoLAnalyze #LeagueOfLegends';
  }else{
    text='🎮 サモナーの素質診断\n\n';
    text+=`${lane==='ANY'?'ALL ROLES':lane} | ${displayName}\n`;
    text+=`「${displayTitle}」\n`;
    text+=`適合度：${pct}%\n`;
    if(typeName) text+=`サモナータイプ：${typeName}\n`;
    text+='\n#LOL鑑定 #LeagueOfLegends';
  }
  text+='\n'+window.location.href;
  const twitterUrl='https://twitter.com/intent/tweet?text='+encodeURIComponent(text);
  window.open(twitterUrl,'_blank','noopener,noreferrer');
}
