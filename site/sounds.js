/* MODO TREINO — efeito sonoro original, opcional e offline. Sem análise/telemetria. */
(()=>{'use strict';
  const defaults=Object.freeze({enabled:false,pack:'suave',volume:35,buttons:false,series:true,finish:true,rest:true,countdown:false,voice:true});
  const packs=['suave','arcade','minimal'];
  function normalize(val){const v={...defaults,...(val&&typeof val==='object'?val:{})};v.pack=packs.includes(v.pack)?v.pack:'suave';v.volume=Math.max(0,Math.min(100,Number(v.volume)||0));for(const k of ['enabled','buttons','series','finish','rest','countdown','voice'])v[k]=Boolean(v[k]);return v;}
  const pool=new Map();
  function play(event,options,preview=false){
    const s=normalize(options);
    const flag=({button:'buttons',series:'series',finish:'finish',rest:'rest',count:'countdown'})[event];
    if(!preview&&(!s.enabled||(flag&&!s[flag])))return;
    if(!['button','series','finish','rest','count'].includes(event))return;
    const url=`assets/sounds/${s.pack}/${event}.wav`;
    const player=new Audio(url);player.volume=(s.volume/100)*.75;
    player.play().catch(()=>{});
    // Keep a short-lived reference while playing; no blocking of playlist music.
    pool.set(player,event);player.onended=()=>pool.delete(player);player.onerror=()=>pool.delete(player);
  }
  function count(number,options){
    const s=normalize(options);if(!s.enabled||!s.countdown||number<1||number>3)return;
    if(s.voice){const player=new Audio(`assets/sounds/voice/${number}.wav`);player.volume=(s.volume/100)*.9;player.play().catch(()=>{});pool.set(player,'voice');player.onended=()=>pool.delete(player);player.onerror=()=>pool.delete(player)}
    else play('count',s);
  }
  window.ModoSound={defaults,normalize,play,count,packs};
})();
