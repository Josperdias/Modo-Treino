'use strict';
/** NEON STEP DX · Ritmo de jogo V1.1
 * Valores em segundos ATIVOS de gameplay, não em distância gerada no mapa.
 * Ajuste aqui o ritmo da campanha sem modificar o motor de física.
 */
const PACING = Object.freeze({
  firstPortalAt: 92,             // 2m35s no primeiro mundo
  subsequentPortalsAt: 112,       // 3m05s em mundos posteriores
  minimumPortalTravel: 565,     // garantir exploração vertical suficiente
  portalApproach: 250,           // reservar espaço para visualização do portal
  initialPowerAt: 66,           // 1m55s até o primeiro poder raro
  powerCooldown: 88,            // poder adicional somente após outro intervalo
  pickupGraceAfterWorld: 34,     // nada raro imediatamente após atravessar
  springCooldown: 34,            // molas não aparecem em cascata
  calmDuration: 16,              // início tranquilo de cada mundo
  rhythmCycle: 62,               // blocos de dificuldade e respiro
  breatheStart: 40,
  breatheEnd: 51,
  musicMinimumTime: 99,         // deixar músicas se desenvolverem ~2 minutos
  crossfadeDuration: 2.4,
  shootQuietSeconds: 32,
  droneMinCooldown: 3.2,
});
function worldAge(){return Math.max(0, state.time - (state.worldStartTime || 0));}
function elapsedText(seconds){const n=Math.floor(Math.max(0,seconds));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function breathPhase(){const t=worldAge();return t<PACING.calmDuration || (t%PACING.rhythmCycle>=PACING.breatheStart && t%PACING.rhythmCycle<PACING.breatheEnd);}
function eventPacingAllowsPower(){
  return state.time>=PACING.initialPowerAt &&
    worldAge()>=PACING.pickupGraceAfterWorld &&
    state.time >= (state.nextPowerAt||PACING.initialPowerAt) &&
    !state.pendingPower;
}
function reservePower(){state.nextPowerAt=state.time+PACING.powerCooldown+Math.random()*18;state.pendingPower=true;}
function portalReady(){return !state.portal && worldAge()>= (state.world==='neon'&&state.visitedWorlds===0?PACING.firstPortalAt:PACING.subsequentPortalsAt) &&
   state.maxY-(state.worldStartHeight||90)>PACING.minimumPortalTravel &&
   !state.portalCooldown;}
