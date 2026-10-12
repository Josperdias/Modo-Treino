/** Modo Treino — efeitos locais, originais e por consentimento explícito.
 * Nunca inicia som sem o usuário ativar os efeitos nas configurações.
 */
import {createAudioPlayer} from 'expo-audio';
export type SoundStyle='suave'|'arcade'|'minimal';
export type SoundEvent='button'|'series'|'rest'|'finish'|'count';
export type SoundSettings={enabled:boolean;pack:SoundStyle;volume:number;buttons:boolean;series:boolean;rest:boolean;finish:boolean;countdown:boolean;voice:boolean};
export const DEFAULT_SOUNDS:SoundSettings={enabled:false,pack:'suave',volume:35,buttons:false,series:true,rest:true,finish:true,countdown:false,voice:true};
export const SOUND_STYLES:[SoundStyle,string,string][]=[['suave','SUAVE','Notas delicadas'],['arcade','ARCADE','Estilo 8-bit'],['minimal','MINIMAL','Bipes discretos']];
// Require estático é obrigatório para ativos locais empacotados no Android/iOS.
const FILES={
 suave:{button:require('./assets/sounds/suave/button.wav'),series:require('./assets/sounds/suave/series.wav'),rest:require('./assets/sounds/suave/rest.wav'),finish:require('./assets/sounds/suave/finish.wav'),count:require('./assets/sounds/suave/count.wav')},
 arcade:{button:require('./assets/sounds/arcade/button.wav'),series:require('./assets/sounds/arcade/series.wav'),rest:require('./assets/sounds/arcade/rest.wav'),finish:require('./assets/sounds/arcade/finish.wav'),count:require('./assets/sounds/arcade/count.wav')},
 minimal:{button:require('./assets/sounds/minimal/button.wav'),series:require('./assets/sounds/minimal/series.wav'),rest:require('./assets/sounds/minimal/rest.wav'),finish:require('./assets/sounds/minimal/finish.wav'),count:require('./assets/sounds/minimal/count.wav')},
} as const;
const VOICES={3:require('./assets/sounds/voice/3.wav'),2:require('./assets/sounds/voice/2.wav'),1:require('./assets/sounds/voice/1.wav')} as const;
let current:SoundSettings={...DEFAULT_SOUNDS};
export function normalizeSoundSettings(v:any):SoundSettings{
 const val={...DEFAULT_SOUNDS,...(v&&typeof v==='object'?v:{})};
 const pack=(['suave','arcade','minimal'] as string[]).includes(val.pack)?val.pack:'suave';
 const volume=Math.max(0,Math.min(100,Number(val.volume)||0));
 return {...val,pack,volume,enabled:!!val.enabled,buttons:!!val.buttons,series:!!val.series,rest:!!val.rest,finish:!!val.finish,countdown:!!val.countdown,voice:!!val.voice};
}
export function setSoundSettings(v:SoundSettings){current=normalizeSoundSettings(v)}
export function playSound(event:SoundEvent,preview=false,style?:SoundStyle){
 const flags:Record<SoundEvent,keyof SoundSettings>={button:'buttons',series:'series',rest:'rest',finish:'finish',count:'countdown'};
 if(!preview&&(!current.enabled||!current[flags[event]]))return;
 const pack=style||current.pack;
 try{
  const player=createAudioPlayer(FILES[pack][event]);
  player.volume=Math.max(0,Math.min(1,current.volume/100))*.8;
  player.play();
  setTimeout(()=>{try{player.remove()}catch{}},2100);
 }catch{/* silent failure: jamais impede registrar uma série */}
}
export function playCount(number:number){
 if(number<1||number>3||!current.enabled||!current.countdown)return;
 if(!current.voice){playSound('count');return}
 try{const player=createAudioPlayer(VOICES[number as 1|2|3]);player.volume=Math.max(0,Math.min(1,current.volume/100));player.play();setTimeout(()=>{try{player.remove()}catch{}},1500)}catch{}
}
