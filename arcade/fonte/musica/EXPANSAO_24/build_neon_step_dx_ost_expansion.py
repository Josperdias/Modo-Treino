#!/usr/bin/env python3
"""NEON STEP DX - 24 original compositions + procedural game SFX.
Run: python build_neon_step_dx_ost_expansion.py
Dependencies: numpy, scipy, soundfile, mido, ffmpeg plus motor_original_v2.py supplied in previous OST.
No borrowed recordings, samples or commercial soundfonts.
"""
from __future__ import annotations
import json, math, os, sys, shutil, subprocess, time, wave, zipfile, re, base64, html
from pathlib import Path
import numpy as np
import soundfile as sf
BASE=Path('/mnt/data');ENGINE=BASE/'Josperd_Jump_OST_V3';sys.path.insert(0,str(ENGINE))
import motor_original_v2 as eng
ROOT=BASE/'NEON_STEP_DX_OST_EXPANSAO_24';ROOT.mkdir(exist_ok=True)
MUSIC=ROOT/'Musicas';MUSIC.mkdir(exist_ok=True)
FXDIR=ROOT/'Efeitos';FXDIR.mkdir(exist_ok=True)

# id, character, name, genre, BPM, key_pc, scale, lead, beat_profile, progression id, energy
SPECS=[
 ('turbo_alley','Josperd','TURBO ALLEY','Breakbeat funk',144,2,'dorian','synth','breaks',0,.96),
 ('midnight_overdrive','Josperd','MIDNIGHT OVERDRIVE','Drum & bass jazz',162,7,'minor','vibes','jungle',2,1.05),
 ('pixel_boulevard','Josperd','PIXEL BOULEVARD','Acid jazz',122,9,'dorian','brass','boom',4,.90),
 ('rooftop_freestyle','Josperd','ROOFTOP FREESTYLE','Boom bap',106,5,'minor','rhodes','boom',1,.73),
 ('circuit_funk','Josperd','CIRCUIT FUNK','Funk house',128,0,'mixolydian','clav','dance',3,.96),
 ('shadow_skater','Josperd','SHADOW SKATER','UK garage',136,8,'minor','pluck','garage',5,.95),
 ('afterburn_arcade','Josperd','AFTERBURN ARCADE','Electro breakbeat',148,4,'dorian','synth','electro',6,1.05),
 ('velvet_voltage','Josperd','VELVET VOLTAGE','Jazz house',124,10,'major','vibes','dance',2,.84),
 ('neon_pursuit','Josperd','NEON PURSUIT','Big beat',152,1,'minor','brass','breaks',0,1.05),
 ('power_chords','Josperd','POWER CHORDS','Synthwave',118,6,'minor','synth','retro',1,.88),
 ('tangerine_twist','Camila','TANGERINE TWIST','Future funk',126,7,'major','bell','dance',4,.94),
 ('sugar_clouds','Camila','SUGAR CLOUDS','Lo-fi hip-hop',98,2,'major','rhodes','lounge',1,.72),
 ('solar_samba','Camila','SOLAR SAMBA','Bossa eletrônica',122,0,'major','guitar','bossa',5,.84),
 ('citrus_pop','Camila','CITRUS POP','Bubblegum house',132,5,'major','bell','dance',3,1.0),
 ('amber_waves','Camila','AMBER WAVES','Liquid drum & bass',158,9,'major','vibes','jungle',6,.87),
 ('blossom_groove','Camila','BLOSSOM GROOVE','Disco funk',120,3,'mixolydian','clav','disco',4,.93),
 ('camomila_nights','Camila','CAMOMILA NIGHTS','Jazz / R&B',102,10,'major','rhodes','lounge',2,.75),
 ('honey_bounce','Camila','HONEY BOUNCE','2-step garage',136,4,'major','pluck','garage',0,.98),
 ('sunset_sprint','Camila','SUNSET SPRINT','Jungle pop',166,1,'dorian','bell','jungle',3,1.08),
 ('rainbow_skyline','Camila','RAINBOW SKYLINE','City pop',116,8,'major','guitar','retro',6,.86),
 ('hyper_bounce','Josperd','HYPER BOUNCE','POWER-UP · mola / super salto · breakbeat',166,2,'dorian','synth','jungle',5,1.14),
 ('invincible_groove','Josperd','INVINCIBLE GROOVE','POWER-UP · escudo · electro funk',138,9,'minor','brass','electro',4,1.02),
 ('starlight_spring','Camila','STARLIGHT SPRING','POWER-UP · mola / super salto · hyperpop',172,7,'major','bell','jungle',3,1.10),
 ('golden_aura','Camila','GOLDEN AURA','POWER-UP · escudo · disco house',140,0,'mixolydian','vibes','disco',2,1.04),
]
SCALES={'major':[0,2,4,5,7,9,11], 'minor':[0,2,3,5,7,8,10], 'dorian':[0,2,3,5,7,9,10], 'mixolydian':[0,2,4,5,7,9,10]}
PROGS=[ [0,3,5,4,1,6,4,0], [0,5,3,6,1,4,2,4], [0,2,3,4,5,3,1,4], [0,4,1,5,3,4,6,0], [0,6,3,4,5,1,3,4], [0,1,5,3,2,6,4,0], [0,3,6,1,4,5,3,4] ]
# Rhythm templates in beats in each bar; A motif uses two phrases and a return with end variation.
RHYTHMS=[
 [0,.5,1,1.75,2.5,3.0], [0,.75,1.5,2,2.75,3.5], [0,.5,.75,1.5,2.5,3.25],
 [0,.25,.75,1.5,2.25,3], [0,.75,1.25,2.25,2.75,3.5], [.25,.75,1.25,2,2.5,3],
 [0,.5,1.25,1.75,2.5,3.25], [0,.5,1.5,2.25,3,3.5], [0,.75,1.75,2.25,2.75,3.5],
 [0,.25,1.0,2,2.5,3.25], [0,.5,1,1.5,2.75,3.25], [.25,1,1.5,2.25,3,3.5]
]
CONTOURS=[ [0,1,2,4,2,1], [0,2,1,3,4,2], [0,-1,1,3,2,0], [0,1,3,2,4,1],
 [0,3,2,1,2,-1], [0,-2,-1,2,4,2], [0,2,4,3,1,0], [0,1,0,3,2,4],
 [0,2,1,-1,1,0], [0,3,1,4,2,0], [0,-1,2,1,4,3], [0,1,3,4,2,0] ]

def nearest_pitch(target,pcs,lo=66,hi=89):
 cands=[n for n in range(lo,hi+1) if n%12 in pcs]
 return min(cands,key=lambda n:abs(n-target))

def harmony(key,scale_name,prog):
 ss=SCALES[scale_name]; rows=[]
 for degree in PROGS[prog]:
  # extend to upper degrees of the scale, chord: root, third, fifth, seventh, ninth
  notes=[key + ss[(degree+2*j)%7]+12*((degree+2*j)//7) for j in range(5)]
  root=36 + (notes[0]%12)
  # 3rd, seventh, ninth and fifth presented in tight middle-register voicing
  voicing=[nearest_pitch(60+x,[notes[i]%12],52,71) for x,i in [(0,1),(4,3),(8,4),(5,2)]]
  # voice notes chosen around a set register, sort into chord with no unintentional duplications
  voicing=sorted(set(voicing)); pcs={n%12 for n in notes}
  rows.append((root,voicing,pcs,degree))
 return rows

def fit_melody(key,scale,root,pcs,base,contour,section,bar,rng):
 # For beat-weighted chord-fit, target exact chord tone on beat 1 and 3.
 # Off-beat passing tones must stay in global mode; no random chromatic conflicts.
 globalpcs={(key+n)%12 for n in SCALES[scale]}
 if section==1: contour=list(reversed(contour))
 if section==2: contour=[a+(1 if i%3==0 else 0) for i,a in enumerate(contour)]
 new=[]; prev=None
 for ix,direction in enumerate(contour):
  target=base+direction*2 + (bar%2)*2 - (2 if section==1 else 0)
  allowed=pcs if ix in (0,3,5) else globalpcs
  n=nearest_pitch(target,allowed,65,88)
  # preserve coherent stepwise movement unless clear melodic apex
  if prev is not None and abs(n-prev)>7:
   n=nearest_pitch(prev + (4 if n>prev else -4),allowed,65,88)
  prev=n;new.append(n)
 return new

def make_track(item,idx):
 ident,who,name,genre,bpm,key,scale,lead,beat,prog,energy=item
 special=idx>=20
 bars=16 if not special else 12
 data=dict(id=ident,who=who,name=name,bpm=bpm,bars=bars,mode=beat,patch=lead)
 t=eng.Tune(data); rng=np.random.default_rng(111+idx*41)
 hs=harmony(key,scale,prog)
 rhythm=RHYTHMS[(idx*5+3)%len(RHYTHMS)]
 rhythm2=RHYTHMS[(idx*3+1)%len(RHYTHMS)]
 contour=CONTOURS[(idx*7+2)%len(CONTOURS)]
 response=CONTOURS[(idx*7+5)%len(CONTOURS)]
 # Unique melodic octave, rhythm, accent and timbral signature for each work.
 base=72+(idx%4)*2+(2 if special else 0)
 for bar in range(bars):
  b=bar*4;root,voicing,pcs,degree=hs[bar%8];nr=hs[(bar+1)%8][0];section=(bar//4)%3
  # bass lands with drum kick or converses with it depending on genre
  if beat in ('dance','disco'):
   bass=[(0,0,.37),(1,12,.24),(2,7,.42),(3,12,.29)]
  elif beat in ('jungle','breaks','garage'):
   bass=[(0,0,.40),(.75,12,.23),(1.5,7,.32),(2.25,0,.36),(3.25,7,.25)]
  elif beat=='bossa':bass=[(0,0,.46),(1.5,7,.29),(2.5,12,.30),(3.25,7,.28)]
  else:bass=[(0,0,.51),(.75,7,.26),(1.65,12,.30),(2.5,0,.48),(3.25,7,.28)]
  for j,(pos,offset,dur) in enumerate(bass):
   n=root+offset
   if j==len(bass)-1 and bar%4==3:
    # diatonic approach note to next root at upbeat, 1–2 semitones max
    n=nr-2 if abs(nr-2-n)<abs(nr-1-n) else nr-1
   t.add('bass',n,b+pos,dur,(.48 if j==0 else .35)*energy,pan=0)
  # rhythm comp on weak beats; voice-leading chord quality from diatonic sevenths/ninths
  positions={'bossa':[.5,1.5,2.5,3.5],'disco':[.52,1.52,2.52,3.52],
             'dance':[.5,1.5,2.5,3.5], 'garage':[.75,1.75,2.75],
             'jungle':[.74,2.34,3.5], 'breaks':[.48,1.53,2.73],
             'electro':[.45,1.6,2.82], 'boom':[.35,1.62,2.75], 'retro':[.5,2.5],
             'lounge':[.1,1.85,3.0]}.get(beat,[.48,1.6,2.7])
  comp='guitar' if beat in ('bossa','retro') else 'rhodes'
  for k,pos in enumerate(positions):
   t.chord(comp,voicing,b+pos,.29 if beat!='lounge' else .42,(.19 if k%2 else .17)*energy,pan=-.29)
  if bar%4==0 and beat in ('retro','lounge','garage'):
   t.chord('pad',voicing[:3],b+.05,1.8,.10*energy,pan=.28)
  if bar%2==1 and beat in ('disco','breaks','electro'):
   t.add('clav',voicing[1]+12,b+3.48,.14,.105,pan=.33)
  # Melody uses alternating 4-bar call and response. Each phrase is modally and harmonically constrained.
  contour_here=contour if (bar//4)%2==0 else response
  pulse=rhythm if (bar//4)%2==0 else rhythm2
  notes=fit_melody(key,scale,root,pcs,base,contour_here,section,bar,rng)
  if bar%4==3:
   notes[-1]=nearest_pitch(base+((idx%3)-1)*2,pcs,65,88)
  for k,(pos,n) in enumerate(zip(pulse,notes)):
   nextpos=pulse[k+1] if k+1<len(pulse) else 4
   length=max(.13,min(.56,nextpos-pos-.12))
   if beat=='lounge':length=min(.70,nextpos-pos-.06)
   # A few open gaps for breath, without removing the motif's accented notes.
   if bar%4==2 and k in (2,): continue
   t.add(lead,n,b+pos,length,(.30+(.04 if k in (0,3) else 0))*energy,pan=.12)
  # Short answering phrase only after the lead phrase ends and never continuously overlaying it.
  if bar%4==3 and pulse[-1]<3.38:
   t.add('vibes' if lead not in ('vibes','bell') else 'pluck',nearest_pitch(base-5,pcs,64,85),b+3.68,.20,.12,pan=.35)
  if special and bar%4==0:
   t.add('bell',nearest_pitch(base+12,pcs,72,92),b+0.02,.17,.12,pan=.3)
  # Drum patterns have distinct identities and short turn-around fills.
  kicks={
    'breaks':[0,.76,1.58,2.46,3.38], 'jungle':[0,.75,1.5,2.48,3.25],
    'boom':[0,1.72,2.5], 'dance':[0,1,2,3], 'disco':[0,1,2,3],
    'garage':[0,.76,2.0,2.72], 'electro':[0,.75,2,2.75,3.5],
    'retro':[0,1.5,2.5], 'lounge':[0,1.75,2.5], 'bossa':[0,1.5,2.5,3.5]
  }[beat]
  for k,o in enumerate(kicks):t.hit('kick',b+o,(.64 if k else .92)*energy)
  snares=([1,3] if beat not in ('garage','bossa') else [1.45,3.0] if beat=='garage' else [1.5,3.5])
  for o in snares:t.hit('snare' if beat!='bossa' else 'rim',b+o,(.73 if beat in ('bossa','lounge') else .88)*energy)
  if beat in ('jungle','breaks','garage','electro'):
   for o in ([.72,2.73,3.72] if bar%2 else [1.76,3.72]):t.hit('ghost',b+o,.18*energy,pan=.2)
  hrate=16 if beat in ('jungle','breaks','garage','electro') else 8
  for k in range(hrate):
   o=4*k/hrate;sw=.035 if k%2 and beat in ('garage','boom','lounge','bossa') else 0
   t.hit('open' if (k==hrate-1 and bar%4==3) else 'hat',b+o+sw,(.21 if k%2 else .27)*energy,pan=(-.24 if k%2 else .2))
  if beat in ('bossa','disco','dance','lounge'):
   for o in [.5,1.5,2.5,3.5]:t.hit('shake',b+o,.11*energy,pan=.24)
  if bar%4==0:t.hit('crash',b,.16*energy)
  if bar%4==3:
   for o,v in [(3.5,.25),(3.75,.34)]:t.hit('snare',b+o,v*energy)
 # Verify the downbeat and pivotal phrase note fits harmony, to avoid dissonant clashes.
 for bar in range(bars):
  root,voicing,pcs,degree=hs[bar%8]
  here=[v for patch,n,b,d,v,pan in t.notes if patch==lead and int(b/4)==bar and abs(b%4)<.001]
  # The melody start can be delayed by the rhythmic template; chord checks occur in the score builder itself.
 outfile=MUSIC/who;outfile.mkdir(exist_ok=True,parents=True)
 nameid=f'{who.lower()}_{ident}';stem=outfile/nameid
 eng.midi_write(t,stem.with_suffix('.mid'))
 wav=eng.render(t)
 sf.write(stem.with_suffix('.wav'),wav,eng.SR,subtype='PCM_16')
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(stem.with_suffix('.wav')),'-b:a','160k',str(stem.with_suffix('.mp3'))],check=True)
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(stem.with_suffix('.wav')),'-c:a','libvorbis','-qscale:a','4',str(stem.with_suffix('.ogg'))],check=True)
 return dict(id=ident,character=who,name=name,genre=genre,bpm=bpm,key=eng.NAMES[key],scale=scale,
             role=('spring' if idx in (20,22) else 'shield' if idx in (21,23) else 'normal'),duration=round(t.seconds,2),
             notes=len(t.notes),drums=len(t.drums),files={ext:str(stem.with_suffix('.'+ext).relative_to(ROOT)) for ext in ('mp3','ogg','wav','mid')})

# --- synthesized SFX (all original, no recordings) ---
SR=32000
FX_SPECS=[
 ('pulo_01','Pulo clássico',.21,'rise'),('pulo_02','Pulo alternativo',.18,'rise_bright'),
 ('aterrissagem','Aterrissagem',.18,'thud'),('aterrissagem_forte','Aterrissagem forte',.27,'thud_deep'),
 ('dano','Receber dano',.38,'damage'),('dano_eletrico','Choque elétrico',.41,'electric'),
 ('escudo_ativar','Escudo ativado',.48,'shield'),('escudo_bloquear','Escudo bloqueia dano',.34,'block'),
 ('escudo_quebrar','Escudo quebrado',.43,'shatter'),('vida_extra','Vida extra',.56,'heal'),
 ('fita_coletar','Fita coletada',.20,'coin'),('combo','Combo',.44,'combo'),
 ('mola','Mola / salto especial',.47,'spring'),('turbo','Turbo ativado',.61,'turbo'),
 ('powerup_inicio','Início de poder especial',.62,'poweron'),('powerup_final','Fim do poder especial',.43,'poweroff'),
 ('drone_alerta','Drone se aproxima',.34,'warning'),('drone_destruir','Drone destruído',.46,'explosion'),
 ('plataforma_quebra','Plataforma frágil quebra',.32,'shatter'),('plataforma_movel','Plataforma móvel',.29,'mechanical'),
 ('menu_mover','Mover seleção',.13,'menu'),('menu_confirmar','Confirmar personagem',.40,'select'),
 ('menu_voltar','Voltar',.20,'back'),('pausa','Pausar',.19,'pause'),('retomar','Retomar',.25,'resume'),
 ('game_over','Fim de jogo',.83,'lose'),('novo_recorde','Novo recorde',.96,'record'),
 ('subir_nivel','Subida de nível',.78,'level'),('teleporte','Teleporte',.52,'warp'),('aviso_perigo','Aviso de perigo',.55,'warning')
]

def make_sfx(sid,name,length,kind,i):
 n=int(SR*length);t=np.arange(n,dtype=np.float64)/SR
 r=np.random.default_rng(10000+i*21)
 fadein=np.minimum(1,t/.004)
 fadeout=np.minimum(1,(length-t)/.026)
 A=np.clip(fadein*fadeout,0,1)
 def tone(f0,f1,amp=.6,how='sine',vib=0):
  freq=f0+(f1-f0)*(t/length)**1.18 + (vib*np.sin(2*np.pi*12*t) if vib else 0)
  phase=2*np.pi*np.cumsum(freq)/SR
  osc=np.sin(phase) if how=='sine' else np.tanh(1.5*(np.sin(phase)+.28*np.sin(2*phase)))
  return amp*osc
 def chirp(notes):
  result=np.zeros(n)
  for start,freq,dur,vol in notes:
   at=int(start*SR);ln=min(n-at,int(dur*SR));
   if ln<=0:continue
   tt=np.arange(ln)/SR;env=np.minimum(1,tt/.006)*np.maximum(0,1-tt/max(.001,dur))**1.9
   result[at:at+ln]+=.7*np.sin(2*np.pi*freq*tt)*env*vol
  return result
 z=r.standard_normal(n);noise=z*np.exp(-t*13)
 if kind=='rise':x=tone(410,930,.75)*np.exp(-t*2)
 elif kind=='rise_bright':x=tone(520,1130,.65,'square')*np.exp(-t*4)
 elif kind=='spring':x=tone(310,1150,.68,'square',vib=17)*np.exp(-t*1.4)+chirp([(.19,990,.15,.45)])
 elif kind=='thud':x=tone(145,60,.58)*np.exp(-t*19)+.23*noise
 elif kind=='thud_deep':x=tone(125,41,.67)*np.exp(-t*10)+.26*noise
 elif kind=='damage':x=tone(750,95,.64,'square')*np.exp(-t*4)+.18*noise
 elif kind=='electric':x=tone(360,130,.52,'square',vib=100)+.32*noise
 elif kind=='shield':x=chirp([(0,523,.20,.5),(.11,659,.20,.7),(.21,784,.27,.8)])
 elif kind=='block':x=tone(480,800,.52,'square')*np.exp(-t*8)+.15*noise
 elif kind=='shatter':x=.42*noise+.35*tone(600,100,.32,'square')*np.exp(-t*8)
 elif kind=='heal':x=chirp([(0,440,.18,.55),(.13,554,.18,.6),(.25,660,.21,.7),(.38,880,.2,.7)])
 elif kind=='coin':x=chirp([(0,740,.12,.7),(.095,1110,.13,.6)])
 elif kind=='combo':x=chirp([(0,523,.13,.55),(.085,659,.14,.55),(.18,784,.17,.7),(.28,1047,.16,.9)])
 elif kind=='turbo':x=tone(120,1200,.55,'square')*np.exp(-t*1.0)+.15*noise
 elif kind=='poweron':x=chirp([(0,440,.16,.5),(.11,554,.17,.65),(.22,659,.17,.7),(.34,988,.25,.8)])
 elif kind=='poweroff':x=chirp([(0,784,.12,.48),(.12,523,.18,.48),(.24,392,.19,.5)])
 elif kind=='warning':x=chirp([(0,480,.15,.6),(.22,480,.15,.6)])+.07*noise
 elif kind=='explosion':x=noise*.60+tone(125,42,.35)*np.exp(-t*12)
 elif kind=='mechanical':x=tone(190,175,.29,'square')*(.5+.5*np.sign(np.sin(2*np.pi*16*t)))+.1*noise
 elif kind=='menu':x=tone(660,770,.42)*np.exp(-t*16)
 elif kind=='select':x=chirp([(0,660,.16,.55),(.12,988,.23,.7)])
 elif kind=='back':x=tone(660,330,.44)*np.exp(-t*8)
 elif kind=='pause':x=tone(700,420,.35)*np.exp(-t*8)
 elif kind=='resume':x=tone(380,730,.36)*np.exp(-t*8)
 elif kind=='lose':x=chirp([(0,523,.21,.55),(.18,392,.25,.58),(.42,261,.38,.74)])
 elif kind=='record':x=chirp([(0,523,.17,.55),(.14,659,.17,.7),(.27,784,.18,.7),(.42,1047,.21,.7),(.63,1318,.33,.8)])
 elif kind=='level':x=chirp([(0,392,.18,.45),(.11,523,.18,.55),(.25,659,.19,.6),(.39,784,.32,.8)])
 elif kind=='warp':x=tone(480,1340,.43,'square',vib=70)+.17*noise
 else:x=tone(550,220,.4)
 x=np.asarray(x*A,dtype=np.float64)
 x-=x.mean();x/=max(.001,np.max(np.abs(x)));x*=.74
 # simple stereo: mono in each channel with micro-delayed reflection
 stereo=np.column_stack([x,x*.92]);delay=int(.006*SR)
 stereo[delay:,1]+=.07*x[:-delay]
 sf.write(FXDIR/(sid+'.wav'),stereo,SR,subtype='PCM_16')
 subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(FXDIR/(sid+'.wav')),'-c:a','libvorbis','-qscale:a','3',str(FXDIR/(sid+'.ogg'))],check=True)
 return dict(id=sid,label=name,duration=length,files={'ogg':f'Efeitos/{sid}.ogg','wav':f'Efeitos/{sid}.wav'})

if __name__=='__main__':
 manifest={'project':'NEON STEP DX — Josperd Jump','version':'OST Expansão 24','source':'Original synthesis, no samples/soundfonts',
           'normal_tracks':20,'special_tracks':4,'tracks':[],'sfx':[]}
 start=time.time()
 for idx,item in enumerate(SPECS):
  st=time.time();row=make_track(item,idx);manifest['tracks'].append(row)
  print(f"[{idx+1:02d}/24] {item[2]} | {row['duration']:.1f}s | {time.time()-st:.1f}s",flush=True)
 for i,(sid,label,dur,kind) in enumerate(FX_SPECS):manifest['sfx'].append(make_sfx(sid,label,dur,kind,i))
 (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
 print('TRACKS_AND_SFX_DONE',round(time.time()-start,1),'s',flush=True)
