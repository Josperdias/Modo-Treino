'use strict';
/** Canal discreto de efeitos: proteção contra sons sobrepostos e fadiga auditiva. */
const fxVoices=[];
const fxLast=new Map();
const FX_LIMIT={pulo_01:450,pulo_02:450,fita_coletar:210,drone_alerta:1750,escudo_ativar:950,teleporte:800,mola:800};
function soundFx(name){
 if(typeof soundOn==='undefined'||!soundOn||!SFX_TRACKS[name])return;
 const now=performance.now(),delay=FX_LIMIT[name]||80;
 if(now-(fxLast.get(name)||-1e7)<delay)return;
 fxLast.set(name,now);
 try{
  const a=new Audio(SFX_TRACKS[name]);
  a.volume=/pulo_/.test(name)?0.09:name==='fita_coletar'?0.12:name==='drone_alerta'?0.10:0.20;
  fxVoices.push(a);
  if(fxVoices.length>7){const first=fxVoices.shift();if(first)first.pause();}
  a.onended=()=>{const ix=fxVoices.indexOf(a);if(ix>=0)fxVoices.splice(ix,1)};
  a.play().catch(()=>{});
 }catch(e){}
}
