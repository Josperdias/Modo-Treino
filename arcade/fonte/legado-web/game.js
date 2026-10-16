
'use strict';
const SPRITE_URLS = {"josperd":["assets/sprites/josperd_00.png","assets/sprites/josperd_01.png","assets/sprites/josperd_02.png","assets/sprites/josperd_03.png","assets/sprites/josperd_04.png","assets/sprites/josperd_05.png","assets/sprites/josperd_06.png","assets/sprites/josperd_07.png"],"camila":["assets/sprites/camila_00.png","assets/sprites/camila_01.png","assets/sprites/camila_02.png","assets/sprites/camila_03.png","assets/sprites/camila_04.png","assets/sprites/camila_05.png","assets/sprites/camila_06.png","assets/sprites/camila_07.png"]};
;
// Sprites experimentais de inimigos/portais/checkpoint removidos para a migração nativa.
// Apenas SPRITE_URLS dos personagens e assets de UI são carregados.
const SPRITES={};
for(const [who,urls] of Object.entries(SPRITE_URLS)) SPRITES[who]=urls.map(src=>{const img=new Image();img.src=src;return img;});
let selectedCharacter='josperd', facing=1;
const CHARACTERS={josperd:{name:'JOSPERD',color:'#ff4caa'},camila:{name:'CAMILA',color:'#49e6ff'}};

const selectEl=document.getElementById('characterSelect');
const chooseButtons=[...document.querySelectorAll('.choose-card')];
function updateChoice(who){
 selectedCharacter=who;
 for(const card of chooseButtons){const active=card.dataset.character===who;card.classList.toggle('active',active);card.setAttribute('aria-pressed',String(active));card.querySelector('.selected-flag').textContent=active?'✓ SELECIONADO':'ESCOLHER';}
 document.getElementById('activeCharacter').textContent=CHARACTERS[who].name;
 document.getElementById('activeCharacter').style.color=CHARACTERS[who].color;
}
function showSelection(){
 state.portal=null;movement.left=movement.right=false;state.mode='select';prepare();hideOverlay();selectEl.hidden=false;el.pause.textContent='Ⅱ';
 updateChoice(selectedCharacter);if(soundOn)beginSong(AUDIO_TRACKS.select,true);
}
function switchMusic(){soundOn=!soundOn;const txt=soundOn?'♪ ON':'♪ OFF';el.sound.textContent=txt;el.sound.setAttribute('aria-pressed',String(soundOn));document.getElementById('selectMusicBtn').textContent=txt;
 if(soundOn){audioUnlock();if(state.mode==='select')beginSong(AUDIO_TRACKS.select,true);else if(state.mode==='playing')soundtrackForWorld();}else stopBgm();
}
for(const card of chooseButtons)card.addEventListener('click',()=>{updateChoice(card.dataset.character);soundFx('menu_mover')});
document.getElementById('selectMusicBtn').addEventListener('click',switchMusic);
document.getElementById('launchBtn').addEventListener('click',start);
document.getElementById('characterBtn').addEventListener('click',showSelection);

const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false});
const W=420,H=690,GROUND=H-78;
const el={score:document.getElementById('scoreVal'),best:document.getElementById('bestVal'),tapes:document.getElementById('tapesVal'),overlay:document.getElementById('overlay'),tag:document.getElementById('overlayTag'),title:document.getElementById('overlayTitle'),desc:document.getElementById('overlayDesc'),start:document.getElementById('startBtn'),foot:document.getElementById('overlayFoot'),pause:document.getElementById('pauseBtn'),sound:document.getElementById('soundBtn')};
ctx.imageSmoothingEnabled=false;
const state={world:'neon',portal:null,nextPortalY:0,worldStartTime:0,worldStartHeight:90,visitedWorlds:0,nextPowerAt:115,pendingPower:false,lastSpringAt:-100,lastEnemyAt:-100,checkpoint:null,revives:0,portalCooldown:0,portalFx:0,bullets:[],fireCooldown:0,mode:'select',camera:0,time:0,score:0,best:0,tapes:0,maxY:90,platforms:[],items:[],particles:[],player:null,lastX:210,lastY:90,shake:0,flash:0,hazards:[],level:1,lastLevel:1,lives:3,shields:0,boost:0,invincible:0,combo:0,comboTime:0,toast:'',toastTime:0,hitCount:0};
const movement={left:false,right:false};
let soundOn=true,audio=null;
try{state.best=Number(localStorage.getItem('josperd_jump_best_v1'))||0;}catch(e){}
function rand(a,b){return a+Math.random()*(b-a)}
function clamp(x,a,b){return Math.min(b,Math.max(a,x))}
function pad(n,w=4){return String(Math.max(0,Math.floor(n))).padStart(w,'0')}
function sy(y){return GROUND-(y-state.camera)}
const LEVEL_NAMES=['AQUECIMENTO','TURBO','ELETRIZANTE','NEON HARD','CAOS DX'];
function levelAt(y){const m=Math.max(0,(y-90)/10);const distanceLevel=m>=360?5:m>=245?4:m>=145?3:m>=70?2:1;return Math.min(distanceLevel,1+Math.floor(Math.max(0,state.time)/65));}
function platformX(p){const x=p.x+(p.type==='moving'?Math.sin(state.time*(p.speed||1.7)+p.phase)*p.shift:0);return isPaper()?clamp(x,48,160):x}
function dangerX(h){return clamp(h.x+Math.sin(state.time*h.speed+h.phase)*h.range,27,isPaper()?162:W-27)}
function setToast(text,duration=1.35){state.toast=text;state.toastTime=duration;const el=document.getElementById('gameToast');el.textContent=text;el.classList.add('show')}
function progressDifficulty(){const lvl=levelAt(state.maxY);state.level=lvl;if(lvl>state.lastLevel){state.lastLevel=lvl;setToast('LEVEL '+String(lvl).padStart(2,'0')+' · '+LEVEL_NAMES[lvl-1],2.2);soundFx('subir_nivel');particleBurst(state.player.x,state.player.y+44,'#5ef5e3',23);beep(800,.21,'triangle',.045)}}

function addPlatform(){
 const fromY=state.lastY,lvl=levelAt(fromY);
 // Keep every new platform inside the character's jump envelope: at maximum
 // normal jumps rise ~198 world units. Gaps stay <=142, including in level 5.
 const gap=rand(88+lvl*2,111+lvl*6);
 const y=fromY+gap;
 const lateral=rand(-105-lvl*5,105+lvl*5);
 const x=clamp(state.lastX+lateral,isPaper()?53:55,isPaper()?153:W-55);
 const r=Math.random(), calm=breathPhase();
 let type='normal';
 if(!calm && worldAge()>35 && state.time-state.lastSpringAt>PACING.springCooldown && y>400 && r<.018){type='spring';state.lastSpringAt=state.time;}
 else if(!calm && lvl>=2 && r < .15)type='moving';
 else if(!calm && lvl>=2 && r < .23)type='fragile';
 else if(!calm && lvl>=3 && r < .32)type='conveyor';
 else if(!calm && lvl>=4 && r < .39)type='narrow';
 // Um patamar seguro a cada seis: impede combinações impossíveis por aleatoriedade.
 if(state.platforms.length%6===5 || (state.recoveryGracePlatforms||0)>0)type='normal';
 const w=type==='moving'?Math.max(62,80-lvl*3):type==='narrow'?Math.max(57,78-lvl*4):type==='fragile'?Math.max(67,88-lvl*3):Math.max(70,96-lvl*4);
 const p={id:Math.random(),x,y,w:isPaper()?Math.min(w,94):w,type,phase:rand(0,6.28),speed:rand(1.15,1.75)+lvl*.18,
    shift:type==='moving'?rand(15,27+lvl*4):0,conveyorDir:Math.random()<.5?-1:1,broken:false};
 state.platforms.push(p);
 // Danger spawns on a subset of higher ledges, but never beside the starting area.
 // They patrol open air rather than covering the entire landing platform.
 if(!(state.recoveryGracePlatforms>0) && worldAge()>21 && state.time-state.lastEnemyAt>11 && !breathPhase() && y>520 && Math.random()<( .18+lvl*.035 )){
   const side=Math.random()<.5?-1:1;
   const hx=clamp(x+side*rand(82,150),isPaper()?45:37,isPaper()?160:W-37);
   const kinds=isPaper()?['paperclip','drone','zigzag']:state.world==='clock'?['turret','drone','orb']:state.world==='crystal'?['zigzag','orb','drone']:['drone','zigzag','turret'];
   const kind=kinds[Math.floor(Math.random()*Math.min(kinds.length,lvl>=2?3:2))];
   const boss=lvl>=4&&Math.random()<.07;
   state.hazards.push({x:hx,y:y+55,phase:rand(0,Math.PI*2),speed:kind==='turret'?0:rand(.6,1.15)+lvl*.12,
       range:kind==='turret'?0:rand(12,29+lvl*4),kind:boss?'guardian':kind,size:boss?27:kind==='turret'?24:18,hp:boss?3:kind==='turret'?2:1});
   state.lastEnemyAt=state.time;
 }
 if(Math.random()<.23&&y>220)state.items.push({kind:'tape',x,y:y+39,hit:false,phase:rand(0,6.28)});
 if(eventPacingAllowsPower() && Math.random()<.17){
   const kind=Math.random()<.64?'shield':'boost';
   state.items.push({kind,x:clamp(x+rand(-16,16),30,isPaper()?170:W-30),y:y+54,hit:false,phase:rand(0,6.28)});
   reservePower();
 }
 state.lastX=x;state.lastY=y;if(state.recoveryGracePlatforms>0)state.recoveryGracePlatforms--;worldPortalMaybe(p);
}
function prepare(){
 state.camera=0;state.time=0;state.world='neon';state.portal=null;state.nextPortalY=0;state.worldStartTime=0;state.worldStartHeight=90;state.visitedWorlds=0;state.nextPowerAt=PACING.initialPowerAt;state.pendingPower=false;state.lastSpringAt=-100;state.lastEnemyAt=-100;state.checkpoint=null;state.revives=0;state.portalCooldown=0;state.portalFx=0;state.bullets=[];state.fireCooldown=0;state.score=0;state.tapes=0;state.maxY=90;state.flash=0;state.shake=0;state.level=1;state.lastLevel=1;state.lives=3;state.shields=0;state.boost=0;state.invincible=0;state.combo=0;state.comboTime=0;state.hazards=[];state.toast='';state.toastTime=0;state.hitCount=0;document.getElementById('gameToast').classList.remove('show');
 state.player={x:210,y:90,vy:0,vx:0,landings:0,drift:0,landingTimer:0,frameShown:0};
 state.platforms=[{id:0,x:210,y:90,w:118,type:'start',phase:0,shift:0,broken:false}];
 state.items=[];state.particles=[];state.lastX=210;state.lastY=90;
 for(let j=0;j<12;j++)addPlatform();
 updateHud();
}
function showOverlay(tag,title,desc,btn,foot){el.tag.textContent=tag;el.title.innerHTML=title;el.desc.textContent=desc;el.start.textContent=btn;el.foot.textContent=foot;el.overlay.hidden=false}
function hideOverlay(){el.overlay.hidden=true}
function start(){normalSong=null;specialTimeout=0;prepare();state.mode='playing';document.getElementById('worldVal').textContent='NEON';selectEl.hidden=true;state.player.vy=690;state.player.landingTimer=.12;hideOverlay();audioUnlock();facing=1;songIndex[selectedCharacter]=0;if(soundOn)soundtrackForWorld();soundFx('menu_confirmar');}
function pause(){if(state.mode==='playing'){state.mode='paused';showOverlay('PAUSA TÁTICA','RESPIRA<br><em>E VOLTA!</em>','Seu recorde está esperando. Continue de onde parou.','CONTINUAR ▶','P OU ESPAÇO PARA CONTINUAR');el.pause.textContent='▶';movement.left=movement.right=false;pauseMusic();soundFx('pausa');}
 else if(state.mode==='paused'){state.mode='playing';hideOverlay();el.pause.textContent='Ⅱ';resumeMusic();soundFx('retomar');}}
function lose(){pauseMusic();state.mode='over';soundFx('game_over');el.pause.textContent='Ⅱ';movement.left=movement.right=false;beep(180,.20,'sawtooth',.028);setTimeout(()=>{if(state.mode==='over')beep(120,.24,'sine',.02)},130);
 showOverlay('FIM DE JOGO',`VOCÊ FEZ<br><em>${pad(state.score)} PTS!</em>`,`Altura alcançada: ${Math.max(0,Math.floor((state.maxY-90)/10))} m · Fitas coletadas: ${state.tapes}.`,`TENTAR DE NOVO ↗`,'TOQUE EM ♧ NO TOPO PARA TROCAR PERSONAGEM');}
function updateHud(){
 el.score.textContent=pad(state.score);el.best.textContent=pad(state.best);el.tapes.textContent=pad(state.tapes,2);
 document.getElementById('worldVal').textContent=WORLDS[state.world].short;
 const clock=document.getElementById('worldClock');if(clock)clock.textContent=elapsedText(worldAge())+' NO UNIVERSO';
 document.getElementById('levelVal').textContent='LV '+String(state.level).padStart(2,'0')+' · '+LEVEL_NAMES[state.level-1];
 document.getElementById('livesVal').textContent='♥ '.repeat(state.lives).trim()+'♡ '.repeat(3-state.lives).trim();
 const buffs=[];if(state.shields)buffs.push('◆'+state.shields);if(state.checkpoint&&!state.checkpoint.used)buffs.push('⚑');if(state.combo>1)buffs.push('x'+state.combo);if(state.boost>0)buffs.push('↑BOOST');
 document.getElementById('buffVal').textContent=buffs.join('  ');
}
function particleBurst(x,y,color,count=12){for(let i=0;i<count;i++){state.particles.push({x,y,vx:rand(-115,115),vy:rand(-30,155),life:rand(.28,.65),max:.65,color,size:Math.random()<.5?3:5});}}
function beep(freq,dur,type='square',vol=.04){if(!soundOn)return;try{audioUnlock();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(90,freq*.58),audio.currentTime+dur);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur)}catch(e){}}
function audioUnlock(){if(!soundOn)return;try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume()}catch(e){}}
function playerHit(h){
 if(state.invincible>0||state.mode!=='playing')return;
 if(state.shields>0){soundFx('escudo_bloquear');state.shields--;state.invincible=1.55;setToast('ESCUDO DEFENDEU!',1.1);beep(730,.13,'triangle',.045);}
 else{soundFx('dano');state.lives--;state.hitCount++;state.invincible=2.15;state.shake=.22;state.flash=.22;state.combo=0;state.comboTime=0;particleBurst(state.player.x,state.player.y+44,'#ff567e',18);
   setToast(state.lives>0?'CUIDADO! '+state.lives+' VIDA(S)':'CHOQUE FINAL!',1.25);beep(165,.16,'sawtooth',.045);
   if(state.lives<=0){if(!useCheckpoint('damage')){lose();}return;}}
 state.player.vy=Math.max(state.player.vy,450);
 state.player.vx+=(state.player.x<dangerX(h)?-100:100);
}
function useCheckpoint(reason='damage'){
 // Resolve BOTH fatal damage and falling below the camera. Single rescue per universe.
 const c=state.checkpoint;
 if(!c || c.used || state.mode!=='playing')return false;
 c.used=true;state.revives++;
 state.world=c.world;state.portal=null;state.portalCooldown=6;state.portalFx=.9;
 state.lives=2;state.shields=0;state.boost=0;state.invincible=5;
 state.combo=0;state.comboTime=0;state.pendingPower=false;state.recoveryGracePlatforms=5;state.lastEnemyAt=state.time;
 const p=state.player;
 // Spawn above a permanent safe ledge; never spawn below the camera or in a hazard.
 p.x=c.x;p.y=c.y+42;p.vx=0;p.vy=500;p.drift=0;p.landingTimer=.12;
 state.camera=Math.max(0,c.y-300);
 state.hazards=[];state.bullets=[];state.items=[];state.particles=[];
 const safeY=c.y-45;
 state.platforms=[{id:'respawn-safe',x:c.x,y:safeY,w:isPaper()?96:128,type:'start',phase:0,shift:0,broken:false}];
 state.lastX=c.x;state.lastY=safeY;
 // Rebuild several reachable platforms; previously the old map remained pruned.
 for(let i=0;i<11;i++)addPlatform();
 state.portalMissedUntil=state.time+20;
 movement.left=false;movement.right=false;
 setToast('⚑ CHECKPOINT ATIVADO · 2 VIDAS',3.2);soundFx('retomar');
 updateHud();return true;
}
function update(dt){
 if(state.mode!=='playing')return;
 state.time+=dt;state.portalFx=Math.max(0,state.portalFx-dt);state.portalCooldown=Math.max(0,state.portalCooldown-dt);updateAudio(dt);
 const p=state.player;
 p.landingTimer=Math.max(0,p.landingTimer-dt);
 state.invincible=Math.max(0,state.invincible-dt);
 state.boost=Math.max(0,state.boost-dt);
 state.comboTime=Math.max(0,state.comboTime-dt);if(!state.comboTime)state.combo=0;
 state.toastTime=Math.max(0,state.toastTime-dt);if(!state.toastTime)document.getElementById('gameToast').classList.remove('show');
 const dir=(movement.right?1:0)-(movement.left?1:0);
 if(dir!==0)facing=dir;
 p.vx+=(dir*(282+Math.min(38,state.level*8))-p.vx)*Math.min(1,dt*14);
 p.x+=(p.vx+p.drift)*dt;p.drift*=Math.max(0,1-dt*8);worldApplyPhysics(p,dt);
 if(!isPaper()){if(p.x < -40)p.x=W+40;if(p.x>W+40)p.x=-40;}
 const previousY=p.y;
 p.vy-=1200*dt;p.y+=p.vy*dt;
 if(p.vy<=0){
   for(const plat of state.platforms){
     if(plat.broken)continue;
     if(previousY>=plat.y && p.y<=plat.y && Math.abs(p.x-platformX(plat))<(plat.w/2+19)){
       p.y=plat.y;p.vy=plat.type==='spring'?930:state.boost>0?835:690;p.landings++;p.landingTimer=.12;
       if(plat.type==='conveyor')p.drift=plat.conveyorDir*180;
       if(plat.type==='fragile')plat.broken=true;
       particleBurst(p.x,plat.y,plat.type==='spring'?'#ffdc7b':plat.type==='fragile'?'#ff5b9e':'#aa8fff',plat.type==='spring'?15:5);
       if(plat.type==='spring')beep(650,.1,'triangle',.016);
       if(plat.type==='spring'){state.flash=.22;soundFx('mola');}else soundFx(p.landings%2?'pulo_01':'pulo_02');
       if(plat.type==='fragile')soundFx('plataforma_quebra');
       break;
     }
   }
 }
 for(const it of state.items){
    if(it.hit)continue;
    if(Math.abs(p.x-it.x)<39&&Math.abs((p.y+64)-it.y)<64){
      it.hit=true;
      if(it.kind==='shield'){soundFx('escudo_ativar');state.pendingPower=false;state.shields=Math.min(2,state.shields+1);setToast('ESCUDO +1',1.1);particleBurst(it.x,it.y,'#65f7fd',15);beep(810,.08,'sine',.025);}
      else if(it.kind==='boost'){soundFx('turbo');state.pendingPower=false;state.boost=10.0;setToast('SUPER SALTO!',1.25);particleBurst(it.x,it.y,'#ffed89',18);beep(910,.11,'triangle',.026);}
      else{soundFx('fita_coletar');state.tapes++;state.combo=Math.min(5,state.combo+1);state.comboTime=7.0;particleBurst(it.x,it.y,'#ffe48a',10);if(state.combo>=4)setToast('COMBO x'+state.combo,0.8);}
    }
 }
 // Collision box sits at the visible center of the character, not at the feet.
 for(const h of state.hazards){
    if(h.destroyed)continue;
    if(Math.abs(p.x-dangerX(h)) < (h.size+7) && Math.abs((p.y+42)-h.y)<(h.size+21)){
       playerHit(h);if(state.mode!=='playing')return;
    }
 }
 worldCombatUpdate(dt);worldPortalUpdate();if(state.mode!=='playing')return;
 state.maxY=Math.max(state.maxY,p.y);
 progressDifficulty();
 state.score=Math.max(0,Math.floor((state.maxY-90)/8))+state.tapes*75+Math.max(0,state.combo-1)*18;
 if(state.score>state.best){state.best=state.score;try{localStorage.setItem('josperd_jump_best_v1',String(state.best))}catch(e){}}
 // Camera only rises, as in a classic endless vertical platformer.
 state.camera=Math.max(state.camera,p.y-365,0);
 while(state.lastY<state.camera+H+200)addPlatform();
 state.platforms=state.platforms.filter(q=>!q.broken && q.y>state.camera-175);
 state.items=state.items.filter(q=>!q.hit&&q.y>state.camera-150);
 if(state.pendingPower&&!state.items.some(i=>!i.hit&&(i.kind==='shield'||i.kind==='boost')))state.pendingPower=false;
 state.hazards=state.hazards.filter(q=>q.y>state.camera-170);
 for(const part of state.particles){part.life-=dt;part.x+=part.vx*dt;part.y+=part.vy*dt;part.vy-=250*dt;}
 state.particles=state.particles.filter(q=>q.life>0);
 state.flash=Math.max(0,state.flash-dt);state.shake=Math.max(0,state.shake-dt);
 if(sy(p.y)>H+70){if(!useCheckpoint('fall'))lose();else return;}
 updateHud();
}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function drawBg(){
 const gr=ctx.createLinearGradient(0,0,0,H);gr.addColorStop(0,worldColors().background[0]);gr.addColorStop(1,worldColors().background[1]);ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
 // Slight pixel-grid & drifting nebula-inspired bands.
 ctx.strokeStyle='rgba(216,154,249,.065)';ctx.lineWidth=1;
 for(let x=0;x<=W;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
 for(let y=(state.camera*.22)%42-42;y<H;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 rect(0,250,8,90,'rgba(247,65,146,.085)');rect(W-8,400,8,120,'rgba(247,65,146,.085)');
 for(let i=0;i<46;i++){
  const x=(i*79+23)%W,y=(((i*177+Math.floor(i/4)*73)+(state.camera*(.08+(i%4)*.04)))%H+H)%H;
  rect(x,y,(i%9===0?4:2),(i%9===0?4:2),i%5===0?'#5a425e':'#433452');
 }
 const deco=(state.camera*.13)%H;
 ctx.globalAlpha=.09;
 ctx.strokeStyle='#cf82ef';ctx.lineWidth=5;
 for(let j=-1;j<3;j++){
   const dx=36+(j%2)*290,dy=100+j*315+deco;
   ctx.strokeRect(dx,dy,68,68);
 }
 ctx.globalAlpha=1;
 rect(0,H-14,W,14,state.world==='paper'?'#ad967b':'#271334');drawWorldExtras();
}
function drawPlatform(pl){
 const y=sy(pl.y);if(y<-40||y>H+45)return;
 const x=platformX(pl),w=pl.w;
 const color=pl.type==='moving'?'#59dcd6':pl.type==='fragile'?'#ff5896':pl.type==='spring'?'#f5b967':pl.type==='conveyor'?'#b6f56a':pl.type==='narrow'?'#ed9bff':pl.type==='start'?'#bba0fe':'#b594fc';
 rect(x-w/2-3,y-3,w+6,21,'#10091f');
 rect(x-w/2,y,w,14,state.world==='paper'?'#9d8064':state.world==='clock'?'#6b4c40':'#3d265e');
 rect(x-w/2,y-3,w,7,state.world==='paper'&&pl.type==='normal'?'#f7f0dd':color);
 rect(x-w/2+8,y+9,w-16,2,'#654080');
 rect(x-w/2+10,y-1,9,2,'#f0ceff');rect(x+w/2-21,y-1,9,2,'#f0ceff');
 if(pl.type==='moving'){rect(x-5,y+5,10,4,'#66f5e7');rect(x-12,y+6,5,2,'#66f5e7');rect(x+8,y+6,5,2,'#66f5e7')}
 if(pl.type==='fragile'){for(let i=0;i<3;i++){rect(x-23+i*20,y+4,2,6,'#ff8ac0');rect(x-21+i*20,y+7,4,2,'#ff8ac0')}}
 if(pl.type==='conveyor'){for(let dx=-w/2+14;dx<w/2-10;dx+=14){const sign=pl.conveyorDir;rect(x+dx,y+3,7,2,'#233e30');rect(x+dx+(sign>0?4:-4),y+1,3,6,'#d6ff92')}}
 if(pl.type==='narrow'){rect(x-6,y-7,12,3,'#ffe6ff')}
 if(pl.type==='spring'){
   rect(x-18,y-11,36,9,'#873d83');rect(x-17,y-17,34,7,'#fbd76e');
   rect(x-12,y-15,24,3,'#fff3bf');rect(x-13,y-10,3,8,'#ffdd88');rect(x+10,y-10,3,8,'#ffdd88');
 }
}
function drawCassette(it){
 const x=it.x,y=sy(it.y)+Math.sin(state.time*4+it.phase)*3;if(y<-50||y>H+50)return;
 if(it.kind==='shield'){rect(x-13,y-14,26,28,'#162338');rect(x-10,y-11,20,23,'#51ecff');rect(x-6,y-7,12,15,'#133851');rect(x-2,y-8,4,18,'#d4ffff');rect(x-8,y-2,16,4,'#d4ffff');return;}
 if(it.kind==='boost'){rect(x-10,y-15,20,30,'#632b59');rect(x-6,y-11,12,21,'#ffe36c');rect(x-12,y-2,24,6,'#fe76ad');rect(x-2,y-18,4,8,'#fff9c5');return;}
 rect(x-14,y-10,28,20,'#160e22');rect(x-12,y-10,24,17,'#ff5caa');rect(x-9,y-8,18,8,'#ffd57c');
 rect(x-7,y-6,4,4,'#5b225c');rect(x+4,y-6,4,4,'#5b225c');rect(x-7,y+3,14,3,'#7c316d');
 rect(x-14,y+7,28,3,'#842769');rect(x+15,y-12,2,3,'#ffefb7');
}
function drawHazards(){
 for(const h of state.hazards){
  if(h.destroyed)continue;for(const mirror of (isPaper()?[false,true]:[false])){const x=mirror?W-dangerX(h):dangerX(h),y=sy(h.y);if(y<-60||y>H+55)continue;
  const pulse=Math.sin(state.time*8+h.phase);
  ctx.save();ctx.translate(Math.round(x),Math.round(y));
  if(h.kind==='turret'){
   rect(-20,-22,40,43,'#453050');rect(-16,-18,32,10,'#9175b0');rect(-10,-8,20,22,'#23192f');rect(-5,-13,10,19,'#f5b15e');
   rect(-24,13,48,6,'#deb47c');rect(-6,-27,12,9,h.warn?'#ff4167':'#73fff0');
  }else if(h.kind==='zigzag'){
   rect(-17,-12,34,23,'#223355');rect(-24,-5,12,7,'#55ebf6');rect(12,-5,12,7,'#55ebf6');
   rect(-9,-6,18,10,'#eec0ff');rect(-4,-6,8,10,h.warn?'#fff59c':'#6d4cce');
  }else if(h.kind==='paperclip'){
   ctx.strokeStyle='#8d596d';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-12,13);ctx.lineTo(-12,-12);ctx.quadraticCurveTo(15,-26,16,-9);ctx.lineTo(16,13);ctx.quadraticCurveTo(0,22,-2,8);ctx.lineTo(-2,-8);ctx.stroke();
   rect(-5,-9,9,8,h.warn?'#ef6d55':'#f5e1bb');
  }else if(h.kind==='guardian'){
   rect(-25,-23,50,44,'#4b2859');rect(-20,-19,40,11,'#d94ea6');rect(-17,-3,34,15,'#211634');
   rect(-14,0,11,7,'#72e7ff');rect(4,0,11,7,'#72e7ff');rect(-31,11,11,11,'#ffc267');rect(20,11,11,11,'#ffc267');
  }else if(h.kind==='drone'){
   rect(-21,-9,42,18,'#170c2a');rect(-17,-11,34,18,'#a63ce7');rect(-9,-7,18,11,'#281641');rect(-6,-4,12,5,pulse>0?'#ff647f':'#ffe38f');
   rect(-27,-5,9,7,'#58eaf0');rect(18,-5,9,7,'#58eaf0');rect(-17,-15,34,3,'#ff82de');rect(-11,9,22,3,'#ff4fb2');
  }else{
   const r=18+(pulse>0?2:0);rect(-r,-r,r*2,r*2,'#1d1341');rect(-r+4,-r+4,2*(r-4),2*(r-4),'#28d8fd');rect(-9,-10,18,20,'#dafff7');rect(-3,-17,6,34,'#602aa8');rect(-17,-3,34,6,'#602aa8');
  }
  if(h.hp>1){rect(-16,-34,32,4,'#43223d');rect(-16,-34,32*Math.min(1,h.hp/(h.kind==='guardian'?3:2)),4,'#8cf9ee');}
  if(h.warn){rect(-9,-29,18,4,'#fff1a5');rect(-2,-23,4,6,'#ffffff');}else{rect(-2,-23,4,5,'#ffed9e');}rect(-2,20,4,4,'#ffed9e');ctx.restore();
 } }
}
function spriteFrame(p){
 // Separate chronological animation phases. Original sprites 0..7 are ALL used,
 // rather than mapping the entire airborne animation into 5 frames only.
 if(state.mode==='select')return 0;
 if(state.mode==='over')return 7;
 if(p.landingTimer>.105)return 1;    // impact / crouch
 if(p.landingTimer>.08)return 0;    // squat compression
 if(p.landingTimer>.045)return 2;    // take-off extension
 if(p.vy>520)return 3;               // fast ascent
 if(p.vy>250)return 4;               // rising
 if(p.vy>40)return 4;                // approach apex
 if(p.vy>-140)return 5;              // float at top
 if(p.vy>-425)return 6;              // falling
 return 7;                            // approach next platform
}
function drawOneCharacter(who,x,foot,face,fi){
 const img=SPRITES[who][fi];if(!img||!img.complete||!img.naturalWidth)return;
 ctx.save();ctx.translate(Math.round(x),Math.round(foot+6));
 ctx.scale(face*(who==='camila'?-1:1),1);
 if(state.invincible>0&&Math.floor(state.time*12)%2===0)ctx.globalAlpha=.72;
 if(state.shields>0){ctx.strokeStyle='#76f5ff';ctx.lineWidth=3;ctx.globalAlpha=.8;ctx.strokeRect(-img.width/2-6,-img.height-7,img.width+12,img.height+14);ctx.globalAlpha=1;}
 const scale=who==='camila'?1:1;
 // All frames use the same anchor at their feet; the source assets are fully masked.
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(img,Math.round(-img.width*scale/2),-img.height*scale,img.width*scale,img.height*scale);ctx.restore();
}
function drawPlayer(){
 const p=state.player;if(!p)return;const fi=spriteFrame(p);p.frameShown=fi;const foot=sy(p.y);
 drawOneCharacter(selectedCharacter,p.x,foot,facing,fi);
 if(isPaper())drawOneCharacter(selectedCharacter==='josperd'?'camila':'josperd',W-p.x,foot,-facing,fi);
}
function drawParticles(){for(const p of state.particles){if(p.life<=0)continue;ctx.globalAlpha=clamp(p.life/p.max,0,1);rect(p.x,sy(p.y),p.size,p.size,p.color)}ctx.globalAlpha=1}
function drawProgress(){
 const meters=Math.max(0,Math.floor((state.maxY-90)/10));
 ctx.save();ctx.font='bold 10px ui-monospace, monospace';ctx.fillStyle='#ad90c1';ctx.textAlign='left';
 ctx.fillText('ALTITUDE',14,H-28);ctx.fillStyle='#e8d2ff';ctx.fillText(String(meters)+' m',84,H-28);
 ctx.textAlign='right';ctx.fillStyle='#ad90c1';ctx.fillText('∞ UP',W-14,H-28);ctx.restore();
 if(state.flash>0){ctx.fillStyle='rgba(255,229,158,'+(state.flash*.13)+')';ctx.fillRect(0,0,W,H)}
 if(state.portalFx>0){ctx.fillStyle='rgba(174,232,255,'+(Math.min(.26,state.portalFx*.22))+')';ctx.fillRect(0,0,W,H)}
}
function render(){drawBg();
 // On the idle screen, the stage still shows the real game world.
 state.platforms.forEach(pl=>{drawPlatform(pl);if(isPaper()){ctx.save();ctx.translate(W,0);ctx.scale(-1,1);drawPlatform(pl);ctx.restore();}});state.items.forEach(drawCassette);drawPortal();drawHazards();drawWorldBullets();
 if(state.checkpoint&&!state.checkpoint.used&&state.checkpoint.world===state.world){
   const cp=state.checkpoint,cy=sy(cp.y-52);
   if(cy>-80&&cy<H+80){
      // Marco minimalista por Canvas, sem sprites experimentais.
      ctx.save();ctx.translate(Math.round(cp.x),Math.round(cy));
      ctx.fillStyle=isPaper()?'#624562':'#243349';ctx.fillRect(-3,-24,6,47);
      ctx.fillStyle=isPaper()?'#ff9ba5':'#66f5f4';ctx.fillRect(-19,-24,28,17);
      ctx.fillStyle='#fff1b8';ctx.fillRect(-13,-18,11,6);
      ctx.strokeStyle=isPaper()?'#8b5762':'#a3efff';ctx.lineWidth=2;
      ctx.strokeRect(-21,-26,32,21);ctx.restore();
      ctx.font='bold 9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle=isPaper()?'#4a2b45':'#d4faff';ctx.fillText('CHECKPOINT',cp.x,cy+41);
    }
 }
 drawParticles();drawPlayer();drawProgress();}
let last=performance.now();function tick(now){const dt=Math.min((now-last)/1000,.032);last=now;update(dt);render();requestAnimationFrame(tick)}
function steer(dir,on){movement[dir]=on;document.getElementById(dir==='left'?'btnLeft':'btnRight').classList.toggle('active',on)}
function setupTouch(btn,dir){let pointer=null;btn.addEventListener('pointerdown',e=>{e.preventDefault();pointer=e.pointerId;btn.setPointerCapture(pointer);steer(dir,true)});const stop=e=>{if(pointer===null||e.pointerId===pointer){steer(dir,false);pointer=null}};btn.addEventListener('pointerup',stop);btn.addEventListener('pointercancel',stop);btn.addEventListener('lostpointercapture',stop)}
setupTouch(document.getElementById('btnLeft'),'left');setupTouch(document.getElementById('btnRight'),'right');
let canvasPointer=null;canvas.addEventListener('pointerdown',e=>{if(state.mode!=='playing')return;e.preventDefault();canvasPointer=e.pointerId;canvas.setPointerCapture(canvasPointer);const left=(e.clientX-canvas.getBoundingClientRect().left)<canvas.getBoundingClientRect().width/2;steer('left',left);steer('right',!left)});
const releaseCanvas=e=>{if(canvasPointer===e.pointerId){steer('left',false);steer('right',false);canvasPointer=null}};
canvas.addEventListener('pointerup',releaseCanvas);canvas.addEventListener('pointercancel',releaseCanvas);canvas.addEventListener('lostpointercapture',releaseCanvas);
window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(state.mode==='select'){if(['arrowleft','arrowright','a','d'].includes(key)){e.preventDefault();updateChoice(key==='arrowleft'||key==='a'?'josperd':'camila');}if(!e.repeat&&(key==='enter'||key===' ')){e.preventDefault();start();}return;}if(key==='escape'){showSelection();return;}if(['arrowleft','arrowright',' ','arrowup'].includes(key))e.preventDefault();if(key==='arrowleft'||key==='a')steer('left',true);if(key==='arrowright'||key==='d')steer('right',true);if(state.mode==='playing'&&(key==='z'||key==='x'||key==='f')){if(!e.repeat)worldShoot();return;}if(!e.repeat&&(key===' '||key==='enter')){if(state.mode==='ready'||state.mode==='over')start();else pause()}if(!e.repeat&&key==='p')pause();});
window.addEventListener('keyup',e=>{const key=e.key.toLowerCase();if(key==='arrowleft'||key==='a')steer('left',false);if(key==='arrowright'||key==='d')steer('right',false)});
window.addEventListener('blur',()=>{steer('left',false);steer('right',false);if(state.mode==='playing')pause()});
el.start.addEventListener('click',()=>{if(state.mode==='paused')pause();else start()});
el.pause.addEventListener('click',()=>{if(state.mode==='select')return;if(state.mode==='ready'||state.mode==='over')start();else pause()});
document.getElementById('resetBtn').addEventListener('click',()=>{el.pause.textContent='Ⅱ';start()});
el.sound.addEventListener('click',switchMusic);
document.getElementById('nextSongBtn').addEventListener('click',()=>{if(state.mode==='playing'){playNextTrack();soundFx('menu_mover');}});
document.getElementById('fireBtn').addEventListener('pointerdown',e=>{e.preventDefault();worldShoot()});
prepare();showSelection();requestAnimationFrame(tick);
