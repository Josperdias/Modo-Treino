'use strict';
/** Diretor de música: música de fase é o cenário sonoro, não uma recompensa.
 * Toca durante ~2 minutos antes de alternar, e só faz crossfade ao mudar de mundo
 * ou quando o jogador pede outra música. Coletáveis e molas NUNCA trocam a faixa.
 */
let bgm=null,currentSong='',normalSong=null,songIndex={josperd:0,camila:0};
let activeSpecial=false,specialTimeout=0;
const musicState={elapsed:0,world:'neon',previous:null,fadeId:0,history:[]};
function getWorldPlaylist(){
 const all=AUDIO_TRACKS[selectedCharacter]||[];
 const w=state.world;
 const subset=w==='paper'?PAPER_TRACKS:
   w==='crystal'?all.filter(t=>/Velocity|Boardwalk|Comet|Sunrise|Cosmic|Sunbeam|Elise|Circuit|Waves|Clouds/i.test(t.name)):
   w==='clock'?all.filter(t=>/Overclock|Rush|Turbo|Frenzy|Breakers|Bitcrush|Supernova|Power|Midnight/i.test(t.name)):
   all.filter(t=>/NEON STEP|MIDNIGHT DASH|CITRUS|Blossom|Magnet|City|Neon Pursuit|Dash|Skyline|Rooftop|Solar|Circuit/i.test(t.name));
 return subset.length>=3?subset:all;
}
function stopBgm(){
 musicState.fadeId++;for(const a of [bgm,musicState.previous])if(a){a.pause();a.removeAttribute('src');}
 musicState.previous=null;bgm=null;currentSong='';musicState.elapsed=0;
}
function beginSong(song,loop=true,special=false){
 if(!soundOn||!song)return;
 if(bgm&&currentSong===song.name){if(bgm.paused&&state.mode!=='paused')bgm.play().catch(()=>{});return;}
 const old=bgm;const fadeTime=old?PACING.crossfadeDuration:0.55;
 musicState.fadeId++;const id=musicState.fadeId;
 currentSong=song.name;activeSpecial=special;if(!special)normalSong=song;
 musicState.elapsed=0;
 const next=new Audio(song.url);next.preload='auto';next.loop=loop;next.volume=0;
 bgm=next;document.getElementById('nowPlaying').textContent=song.name;
 next.play().catch(()=>{});
 if(old){old.loop=false;musicState.previous=old;}
 const begin=performance.now(), target=.27;
 function ramp(now){
   if(musicState.fadeId!==id)return;
   const t=Math.max(0,Math.min(1,(now-begin)/(fadeTime*1000)));
   if(soundOn)next.volume=target*t;
   if(old){old.volume=Math.max(0,target*(1-t));}
   if(t<1)requestAnimationFrame(ramp);else if(old){old.pause();old.removeAttribute('src');if(musicState.previous===old)musicState.previous=null;}
 }
 requestAnimationFrame(ramp);
}
function playNextTrack(){
 const pool=getWorldPlaylist();if(!pool.length)return;
 const ix=(songIndex[selectedCharacter]++)%pool.length;
 let track=pool[ix];if(pool.length>1&&track.name===currentSong)track=pool[(ix+1)%pool.length];
 beginSong(track,true);
}
function soundtrackForWorld(){
 musicState.world=state.world;
 const pool=getWorldPlaylist();
 // Mudança de universo é evento maior: seleciona outra identidade musical.
 if(pool.length){const i=(songIndex[selectedCharacter]++)%pool.length;beginSong(pool[i],true);}
}
function playSpecial(kind){
 // Mantido para compatibilidade e seleção musical futura; eventos corriqueiros não acionam.
 return;
}
function updateAudio(dt){
 musicState.elapsed+=dt;
 if(musicState.elapsed>=(state.world==='paper'?85:PACING.musicMinimumTime) && state.mode==='playing')playNextTrack();
}
function resumeMusic(){if(bgm&&soundOn)bgm.play().catch(()=>{});}
function pauseMusic(){if(bgm)bgm.pause();if(musicState.previous)musicState.previous.pause();}
