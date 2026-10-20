'use strict';
// Mecânicas de mundos: preservam o motor de saltos da V0.9.
const WORLDS={
 neon:{name:'CIDADE NEON',short:'NEON',color:'#ff4dac',background:['#251438','#160c29'],desc:'A cidade original: plataformas móveis, drones e fitas cassete.'},
 paper:{name:'UNIVERSO DE PAPEL',short:'PAPEL',color:'#df975c',background:['#efdec1','#ceb78f'],desc:'Josperd e Camila aparecem juntos, em espelho, separados pela dobra central.'},
 crystal:{name:'DIMENSÃO CRISTAL',short:'CRISTAL',color:'#5ceef4',background:['#12264b','#141d42'],desc:'Correntes de vento leves e plataformas translúcidas.'},
 clock:{name:'MUNDO MECÂNICO',short:'MECÂNICO',color:'#ffbf65',background:['#2d2738','#19172b'],desc:'Esteiras aceleradas e drones mais insistentes.'}
};
const WORLD_ORDER=['neon','paper','crystal','clock'];
function nextWorld(){return WORLD_ORDER[(WORLD_ORDER.indexOf(state.world)+1)%WORLD_ORDER.length]}
function isPaper(){return state.world==='paper'}
function worldBoundX(x){return isPaper()?clamp(x,38,151):x}
/** Os portais só aparecem quando a fase já teve tempo real para se desenvolver.
 * Tocar o portal atravessa automaticamente; desviar significa continuar no mundo.
 */
function worldPortalMaybe(platform){
 if(!portalReady()||state.time<(state.portalMissedUntil||0))return;
 const dy=platform.y-state.maxY;
 if(dy<285||dy>770)return;
 const x=isPaper()?clamp(platform.x,48,158):platform.x;
 state.portal={x,y:platform.y+48,target:nextWorld(),bornAt:state.time};
 setToast('UM PORTAL SE APROXIMA…',2.0);
}
function worldPortalUpdate(){
 const p=state.player,o=state.portal;
 if(!o||state.mode!=='playing'||state.portalCooldown>0)return;
 // Em mundo vertical positivo a câmera deixa o portal para trás quando ele cai abaixo da tela.
 if(o.y<state.camera-140){state.portal=null;state.portalMissedUntil=state.time+48;return;}
 const py=p.y+45;
 if(Math.abs(p.x-o.x)<34&&Math.abs(py-o.y)<47)worldPortalEnter();
}
function worldPortalEnter(){
 const target=state.portal?.target;
 if(!target)return;
 const from=state.world;
 state.world=target;state.portal=null;state.portalCooldown=2.0;
 state.worldStartTime=state.time;state.worldStartHeight=state.maxY;
 state.visitedWorlds=(state.visitedWorlds||0)+1;
 state.portalMissedUntil=0;state.portalFx=1.6;
 // Troca de personagem nos mundos individuais. Papel mantém os dois heróis simultâneos.
 if(target!=='paper'&&from!=='neon'){
   selectedCharacter=selectedCharacter==='josperd'?'camila':'josperd';updateChoice(selectedCharacter);
 }
 const p=state.player;p.x=target==='paper'?103:210;p.vx=0;p.vy=700;p.drift=0;
 // Um chão seguro e uma rota inicial livre evitam cair durante a travessia.
 state.platforms=[{id:Date.now(),x:p.x,y:p.y-45,w:target==='paper'?97:126,type:'start',phase:0,shift:0,broken:false}];
 state.hazards=[];state.bullets=[];state.items=[];state.particles=[];
 state.pendingPower=false;state.nextPowerAt=Math.max(state.nextPowerAt||0,state.time+PACING.pickupGraceAfterWorld+45);
 state.lastY=p.y-45;state.lastX=p.x;
 state.checkpoint={x:p.x,y:p.y,world:target,used:false};state.lastEnemyAt=state.time;
 for(let i=0;i<10;i++)addPlatform();
 state.invincible=3;
 setToast('◈ '+WORLDS[target].name+' · CHECKPOINT ATIVO ⚑',3.4);
 soundFx('teleporte');soundtrackForWorld();
 updateHud();
}
function worldApplyPhysics(p,dt){
 if(state.world==='crystal')p.drift+=Math.sin(state.time*1.9)*42*dt;
 if(state.world==='clock')p.drift=clamp(p.drift*1.015,-210,210);
 if(isPaper()){
  p.x=clamp(p.x,38,151);
  if(p.x>=151&&p.vx>0)p.vx=0;
  if(p.x<=38&&p.vx<0)p.vx=0;
 }
}
function worldColors(){return WORLDS[state.world]}
function drawWorldExtras(){
 const world=state.world;
 ctx.save();
 if(world==='paper'){
  ctx.fillStyle='rgba(255,255,255,.15)';for(let i=0;i<11;i++)ctx.fillRect((i*97)%W, (i*169+state.camera*.13)%H,19,23);
  ctx.strokeStyle='#b7957b';ctx.lineWidth=1;
  for(let y=(state.camera*.18)%32-32;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  ctx.fillStyle='#b99b79';ctx.fillRect(207,0,6,H);ctx.fillStyle='#fff5e7';ctx.fillRect(210,0,1,H);
  for(let i=0;i<12;i++){ctx.fillStyle=i%2?'#d4c3a2':'#c7b291';ctx.fillRect((i*43+24)%W,(i*93+state.camera*.1)%H,7,3)}
  // Gentle layered paper-cut scenery, fixed behind platforms and heroes.
  for(let i=0;i<8;i++){
   const offset=((i*151+state.camera*.11)%850+850)%850;
   const y=H-offset+80;
   const x=i%2===0?0:W-63;
   ctx.fillStyle=i%2?'#e6c8a4':'#ead8be';ctx.fillRect(x,y,63,52);
   ctx.fillStyle='#b5cfbc55';ctx.beginPath();
   if(i%2===0){ctx.moveTo(x,y);ctx.lineTo(x+63,y+30);ctx.lineTo(x,y+64);}else{ctx.moveTo(x+63,y);ctx.lineTo(x,y+30);ctx.lineTo(x+63,y+64);}
   ctx.closePath();ctx.fill();
   ctx.strokeStyle='#b7937c66';ctx.strokeRect(x+.5,y+.5,62,51);
  }
  // Fine fold lines reinforce the origami identity without covering the characters.
  ctx.strokeStyle='#ad957857';ctx.lineWidth=1;
  for(let i=0;i<6;i++){const y=((i*179+state.camera*.07)%H);ctx.beginPath();ctx.moveTo(10,y+14);ctx.lineTo(52,y);ctx.lineTo(82,y+14);ctx.stroke();}
 }else if(world==='crystal'){
  for(let i=0;i<13;i++){
   const x=(i*79+21)%W,y=(i*113+state.camera*.23)%H;
   ctx.fillStyle=i%2?'#397bd74d':'#53fff44c';ctx.beginPath();ctx.moveTo(x,y-36);ctx.lineTo(x+15,y);ctx.lineTo(x,y+20);ctx.lineTo(x-14,y);ctx.closePath();ctx.fill();
  }
 }else if(world==='clock'){
  for(let i=0;i<9;i++){
   const x=(i*79+25)%W,y=(i*138+state.camera*.15)%H;
   ctx.save();ctx.translate(x,y);ctx.rotate(state.time*(i%2?-.28:.33));
   ctx.strokeStyle='#c29c6675';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();
   for(let n=0;n<8;n++){ctx.rotate(Math.PI/4);ctx.fillStyle='#ba905766';ctx.fillRect(-3,-33,6,10)}ctx.restore();
  }
 }
 ctx.restore();
}
function drawPortal(){
 const o=state.portal;if(!o)return;const y=sy(o.y);
 if(y < -100||y>H+100)return;
 ctx.save();ctx.translate(o.x,y);const pulse=1+.065*Math.sin(state.time*7);
 ctx.scale(pulse,pulse);ctx.strokeStyle='#88fffd';ctx.lineWidth=6;ctx.shadowColor='#4cefff';ctx.shadowBlur=18;
 ctx.beginPath();ctx.ellipse(0,0,24,40,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
 ctx.fillStyle='#8846cdb0';ctx.beginPath();ctx.ellipse(0,0,18,33,0,0,Math.PI*2);ctx.fill();
 // Portal desenhado proceduralmente; sprite experimental removido.
 ctx.textAlign='center';ctx.font='bold 10px ui-monospace,monospace';ctx.fillStyle=state.world==='paper'?'#4e3153':'#e8ffff';ctx.fillText('ATRAVESSE',0,59);ctx.restore();
}
function worldCombatUpdate(dt){
 if(state.fireCooldown>0)state.fireCooldown-=dt;
 const p=state.player;
 const battleReady=worldAge()>PACING.shootQuietSeconds && !breathPhase();
 for(const h of state.hazards){
  if(h.destroyed)continue;
  if(h.cooldown===undefined)h.cooldown=3.8+Math.random()*2;
  if(!battleReady){h.cooldown=Math.max(h.cooldown,1.4);h.warn=0;continue;}
  h.cooldown-=dt;
  if(h.cooldown<.72)h.warn=1;else h.warn=0;
  if(h.cooldown<=0&&h.y>state.camera+60&&h.y<state.camera+H-85&&state.bullets.filter(b=>!b.own).length<4){
   h.cooldown=Math.max(PACING.droneMinCooldown,6.7-state.level*.4)+Math.random()*2;
   h.warn=0;
   const sx=dangerX(h),dx=p.x-sx,dy=(p.y+38)-h.y,d=Math.hypot(dx,dy)||1;
   const v=Math.min(176,(97+state.level*12)*(state.world==='clock'?1.08:1));
   state.bullets.push({x:sx,y:h.y,vx:dx/d*v,vy:dy/d*v,own:false});
   // Stronger guardians are a late-game skill test, not an early projectile wall.
   if(h.kind==='guardian'&&state.level>=4&&state.bullets.filter(b=>!b.own).length<4){
     const a=Math.atan2(dy,dx)+.23;
     state.bullets.push({x:sx,y:h.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,own:false});
   }
  }
 }
 for(const b of state.bullets){
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.own){
   for(const h of state.hazards){if(h.destroyed)continue;
    if((Math.abs(b.x-dangerX(h))<25||(isPaper()&&Math.abs(b.x-(W-dangerX(h)))<25))&&Math.abs(b.y-h.y)<25){
      h.hp=(h.hp??1)-1;b.y=1e8;
      if(h.hp<=0){h.destroyed=true;state.tapes+=1;particleBurst(h.x,h.y,'#ffe2a3',12);soundFx('drone_destruir');}
      else {particleBurst(h.x,h.y,'#86eaff',5);soundFx('dano_eletrico');}
      break;
    }
   }
  } else if(Math.abs(b.y-(p.y+40))<26&&(Math.abs(b.x-p.x)<20||(isPaper()&&Math.abs(b.x-(W-p.x))<20))){
    // Guarda a coordenada antes de remover o projétil, para calcular o impacto corretamente.
    const impact={x:b.x,y:b.y,speed:0,range:0,phase:0};b.y=1e8;playerHit(impact);
  }
 }
 state.bullets=state.bullets.filter(b=>b.y>state.camera-80&&b.y<state.camera+H+80);
 state.hazards=state.hazards.filter(h=>!h.destroyed);
}
function worldShoot(){
 if(state.mode!=='playing'||state.fireCooldown>0)return;
 state.fireCooldown=.43;const p=state.player;
 state.bullets.push({x:p.x,y:p.y+72,vx:0,vy:580,own:true});
 if(isPaper())state.bullets.push({x:W-p.x,y:p.y+72,vx:0,vy:580,own:true});
 soundFx('drone_alerta');
}
function drawWorldBullets(){
 ctx.save();for(const b of state.bullets){const y=sy(b.y);ctx.fillStyle=b.own?'#62fff1':'#ffcd6e';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(b.x,y,b.own?4:5,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
