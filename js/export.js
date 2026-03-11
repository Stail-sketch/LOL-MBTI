// export.js - カードダウンロード・Xシェア

function drawRadarOnCard(norm){
  drawRadarChart(document.getElementById('ce-radar'),norm);
}

async function downloadCard(){
  if(!window.html2canvas){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('html2canvas読み込み失敗'));
      document.head.appendChild(s);
    });
  }
  const isEN=currentLang==='en';
  const btn=document.getElementById('btn-download');
  btn.disabled=true;
  try{
    const norm=lastNormalized||{};
    const d=window._shareData||{};
    const champ=d.champ;
    if(!champ){btn.disabled=false;return;}
    const is25=currentPhaseEnd>=16;
    const is40=currentPhaseEnd>=32;
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
      if(is40){
        const strs=typeEN?typeEN.strengths:type.strengths;
        const weaks=typeEN?typeEN.weaknesses:type.weaknesses;
        document.getElementById('ce-sw-str').innerHTML=strs.map(s=>`<div class="ce-sw-item">${s}</div>`).join('');
        document.getElementById('ce-sw-weak').innerHTML=weaks.map(w=>`<div class="ce-sw-item">${w}</div>`).join('');
        show('ce-sw-row');
      }else{hide('ce-sw-row');}
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
      if(img.complete&&img.naturalWidth>0){r();return;}
      const cleanup=()=>{img.onload=null;img.onerror=null;};
      img.onload=()=>{cleanup();r();};
      img.onerror=()=>{cleanup();console.warn('画像読み込み失敗:',img.src);r();};
    })));

    const canvas=await html2canvas(document.querySelector('#card-export .ce-wrap'),{
      backgroundColor:'#010A13',scale:2,useCORS:true,allowTaint:false,logging:false,
      width:375,
    });
    const dlName=champEN?champEN.nameEn:champ.name;
    const fileName=`lol-diagnosis-${dlName}.png`;
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
    // スマホではWeb Share APIでネイティブ共有シートを表示
    if(navigator.canShare&&navigator.canShare({files:[new File([blob],fileName,{type:'image/png'})]})){
      const file=new File([blob],fileName,{type:'image/png'});
      try{
        await navigator.share({files:[file]});
      }catch(e){
        if(e.name!=='AbortError')console.error(e);
      }
    }else{
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.download=fileName;
      link.href=url;
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }
  }catch(e){console.error(e);}
  btn.disabled=false;
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
    text='LoL Summoner Personality Diagnosis\n\n';
    text+=`${lane==='ANY'?'ALL ROLES':lane} | ${displayName}\n`;
    text+=`${displayTitle}\n`;
    text+=`Match Rate: ${pct}%\n`;
    if(typeName) text+=`Summoner Type: ${typeName}\n`;
    text+='\n#LoLAnalyze #LeagueOfLegends';
  }else{
    text='サモナーの素質診断\n\n';
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
