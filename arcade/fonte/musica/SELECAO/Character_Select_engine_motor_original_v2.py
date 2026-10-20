"""Josperd Jump Original Soundtrack v2. Synthesized from original oscillator patches and
original arrangements; no external audio recordings, samples, or soundfonts.
Needs numpy, scipy, soundfile, mido, ffmpeg.
"""
import os, sys, json, math, time, subprocess, zipfile
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import sosfilt, butter
import mido

BASE=Path(__file__).resolve().parent
SR=32000
rng=np.random.default_rng(240951)
C=512

NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
def mid(name):
 if isinstance(name,(int,float)):return int(name)
 name=name.replace('Bb','A#').replace('Eb','D#').replace('Ab','G#').replace('Db','C#').replace('Gb','F#')
 return (int(name[-1])+1)*12+NAMES.index(name[:-1])
def freq(n):return 440*2**((n-69)/12)

SONGS=[
 dict(id='josperd_neon_step_dx',who='Josperd',name='NEON STEP DX',bpm=116,bars=32,mode='funk',patch='vibes',subtitle='Jazz-funk • Breakbeat • Noite de arcade',theme='Aprimoramento da NEON STEP original; Rhodes mais encorpado, bateria em camadas e novas respostas de synth.',color='#ee379d'),
 dict(id='josperd_midnight_dash',who='Josperd',name='MIDNIGHT DASH',bpm=132,bars=24,mode='breaks',patch='synth',subtitle='Breakbeat • Baixo elástico • Correria noturna',theme='Batida rápida e nervosa, linhas de baixo saltitantes, stabs e synth digital.',color='#9f68fa'),
 dict(id='josperd_combo_city',who='Josperd',name='COMBO CITY',bpm=124,bars=24,mode='boom',patch='brass',subtitle='Acid jazz • Hip-hop • Metais arcade',theme='Groove malandro e animado, metais de ataque e órgão nostálgico.',color='#f9735a'),
 dict(id='camila_citrus_circuit',who='Camila',name='CITRUS CIRCUIT',bpm=126,bars=24,mode='dance',patch='bell',subtitle='Future funk • Sinos • Synth ensolarado',theme='Melodias agudas brilhantes, baixo dançante e refrão com sabor de verão.',color='#ffc247'),
 dict(id='camila_camomila_club',who='Camila',name='CAMOMILA CLUB',bpm=108,bars=24,mode='lounge',patch='rhodes',subtitle='Lo-fi jazz • R&B arcade • Fim de tarde',theme='Balanço suave, acordes macios de teclado e frases melódicas aconchegantes.',color='#f3a84e'),
 dict(id='camila_sunset_spring',who='Camila',name='SUNSET SPRING',bpm=140,bars=24,mode='jungle',patch='pluck',subtitle='Breaks vibrantes • Melodia colorida • Pulos',theme='A mais energética da Camila, com bateria picotada e melodia ágil.',color='#fd668a'),
]

# Each chord structure: bass root MIDI, ascending MIDI voicing (jazzy colour tones).
HARM={
 'josperd_midnight_dash':[
 (38,[53,57,60,64]),(39,[55,58,62,65]),(41,[55,58,63,67]),(36,[53,58,62,65]),
 (38,[53,57,60,64]),(43,[53,57,59,64]),(41,[55,60,64,67]),(45,[55,61,64,67])],
 'josperd_combo_city':[
 (45,[55,59,60,64]),(38,[54,57,60,64]),(43,[54,57,59,62]),(48,[55,59,62,64]),
 (42,[51,57,60,63]),(47,[53,57,60,63]),(40,[55,59,62,66]),(40,[53,56,59,62])],
 'camila_citrus_circuit':[
 (45,[56,59,61,64]),(49,[56,59,64,68]),(42,[52,56,59,64]),(40,[56,59,62,66]),
 (47,[54,58,61,66]),(49,[56,59,64,68]),(42,[52,56,59,64]),(40,[56,59,62,66])],
 'camila_camomila_club':[
 (39,[55,58,62,65]),(36,[55,58,62,67]),(41,[56,60,63,67]),(46,[56,60,63,67]),
 (44,[55,60,63,67]),(36,[55,58,62,67]),(41,[56,60,63,67]),(46,[56,60,63,67])],
 'camila_sunset_spring':[
 (46,[57,60,62,65]),(43,[57,60,62,67]),(36,[53,58,62,65]),(41,[57,60,63,67]),
 (46,[57,60,62,65]),(43,[57,60,62,67]),(36,[53,58,62,65]),(41,[57,60,63,67])]
}
# Every line is composed explicitly as eight groups of hook notes per song;
# harmony-specific target tones and coherent call/response, not just random pentatonic notes.
HOOK={
 'josperd_midnight_dash':[
 [(0,74,.35),(.5,77,.22),(.9,81,.55),(2,79,.36),(2.6,77,.34),(3.15,74,.46)],
 [(0,75,.36),(.5,79,.32),(1.05,82,.53),(2.0,79,.35),(2.62,75,.28),(3.25,74,.38)],
 [(.25,77,.38),(.75,79,.25),(1.3,82,.55),(2.12,84,.3),(2.64,82,.27),(3.16,79,.45)],
 [(0,72,.42),(.6,75,.22),(1.05,77,.53),(2.1,79,.28),(2.55,77,.34),(3.18,72,.41)],
 [(0,74,.32),(.5,77,.32),(1.06,81,.48),(1.88,86,.35),(2.55,84,.25),(3.0,81,.58)],
 [(0,79,.35),(.55,81,.33),(1.1,83,.48),(2,81,.37),(2.55,79,.34),(3.13,77,.34)],
 [(0,77,.29),(.55,79,.28),(1.3,84,.48),(2.0,81,.37),(2.55,79,.35),(3.1,77,.55)],
 [(0,76,.31),(.75,77,.28),(1.23,79,.38),(1.84,81,.36),(2.6,84,.3),(3.25,77,.58)]],
 'josperd_combo_city':[
 [(0,76,.26),(.42,79,.31),(1,81,.6),(2,79,.3),(2.55,76,.31),(3.04,72,.5)],
 [(0,74,.28),(.5,77,.3),(1.1,81,.44),(2,84,.42),(2.67,81,.32),(3.22,77,.45)],
 [(.12,74,.3),(.68,79,.22),(1.22,83,.53),(2,81,.38),(2.58,79,.33),(3.17,74,.38)],
 [(0,76,.32),(.5,79,.35),(1.2,83,.47),(2,86,.32),(2.6,83,.32),(3.1,79,.43)],
 [(0,75,.33),(.75,78,.28),(1.25,81,.48),(2.1,78,.28),(2.7,75,.29),(3.15,72,.35)],
 [(0,74,.33),(.5,77,.31),(1.25,80,.4),(2,83,.4),(2.68,80,.35),(3.22,77,.42)],
 [(0,79,.31),(.58,83,.27),(1.3,86,.52),(2.08,83,.42),(2.68,79,.33),(3.21,74,.29)],
 [(0,76,.28),(.5,80,.23),(1,83,.4),(1.75,86,.28),(2.6,80,.38),(3.21,76,.36)]],
 'camila_citrus_circuit':[
 [(0,73,.37),(.5,76,.31),(1.1,80,.48),(2,83,.42),(2.65,80,.35),(3.25,76,.37)],
 [(0,73,.25),(.55,76,.32),(1.18,80,.48),(2.08,85,.4),(2.67,80,.32),(3.2,76,.39)],
 [(.1,73,.27),(.58,76,.28),(1.05,78,.47),(2,80,.35),(2.65,78,.28),(3.15,73,.47)],
 [(0,75,.36),(.6,78,.27),(1.05,82,.48),(2.05,85,.43),(2.6,82,.28),(3.18,78,.41)],
 [(0,78,.31),(.5,80,.26),(1.05,85,.49),(2,83,.37),(2.67,80,.28),(3.14,78,.43)],
 [(0,76,.35),(.5,80,.28),(1.1,85,.51),(2,88,.30),(2.64,85,.32),(3.17,80,.4)],
 [(0,73,.32),(.59,76,.3),(1.17,80,.38),(2.1,83,.33),(2.65,80,.3),(3.16,76,.45)],
 [(0,75,.32),(.65,78,.32),(1.25,82,.49),(2.15,85,.32),(2.7,82,.26),(3.16,78,.37)]],
 'camila_camomila_club':[
 [(0,70,.6),(.75,74,.35),(1.25,77,.7),(2.5,74,.45),(3.15,70,.49)],
 [(.0,72,.35),(.68,75,.32),(1.35,79,.7),(2.55,75,.3),(3.18,72,.4)],
 [(.2,72,.42),(.8,75,.32),(1.32,80,.58),(2.35,77,.37),(3.15,75,.5)],
 [(0,72,.53),(.78,75,.38),(1.5,79,.48),(2.48,82,.45),(3.17,79,.34)],
 [(0,70,.35),(.8,75,.37),(1.55,79,.53),(2.5,75,.32),(3.18,72,.54)],
 [(0,67,.35),(.68,72,.34),(1.2,75,.58),(2.5,79,.38),(3.2,75,.41)],
 [(0,68,.51),(.75,72,.38),(1.42,75,.56),(2.55,80,.37),(3.19,75,.36)],
 [(0,70,.45),(.78,74,.35),(1.45,77,.42),(2.5,82,.38),(3.13,77,.48)]],
 'camila_sunset_spring':[
 [(0,77,.22),(.38,81,.25),(.84,84,.3),(1.40,86,.35),(2,84,.38),(2.65,81,.25),(3.15,77,.4)],
 [(0,74,.25),(.43,77,.27),(.86,81,.44),(1.65,84,.29),(2.33,81,.23),(2.8,79,.25),(3.29,77,.33)],
 [(0,72,.3),(.45,77,.26),(.96,79,.33),(1.5,84,.36),(2.1,82,.25),(2.74,79,.24),(3.15,77,.45)],
 [(0,75,.27),(.44,79,.24),(1,82,.37),(1.62,86,.25),(2.28,82,.3),(2.8,79,.3),(3.32,75,.35)],
 [(0,77,.25),(.4,81,.26),(.9,86,.32),(1.45,89,.3),(2.06,86,.37),(2.65,81,.24),(3.18,77,.43)],
 [(0,74,.3),(.45,77,.26),(1,81,.3),(1.6,86,.3),(2.3,84,.25),(2.8,81,.32),(3.3,77,.36)],
 [(0,77,.26),(.5,79,.25),(1.07,84,.41),(1.7,89,.3),(2.34,86,.32),(2.86,84,.25),(3.25,79,.3)],
 [(0,75,.32),(.5,79,.25),(1.1,82,.32),(1.8,86,.3),(2.5,82,.3),(3.25,79,.42)]],
}

# Custom oscillator synth; all signal created mathematically, no sampled instruments.
def signal_for_note(pitch, dur, patch, amp, sr=SR):
 f=freq(pitch); tail=.14 if patch in ['bass','clav','pluck','brass','synth'] else .32
 if patch=='pad':tail=.42
 full=dur+tail
 n=max(8,int(sr*full)); t=np.arange(n,dtype=np.float32)/sr
 # smooth attack and exponential release; per patch timbral decay
 atk={'rhodes':.006,'bell':.003,'vibes':.002,'clav':.001,'organ':.009,'bass':.003,'synth':.006,'brass':.021,'pad':.080,'pluck':.002,'guitar':.004}.get(patch,.01)
 a=np.minimum(1,t/max(.002,atk))
 off=np.maximum(0,t-dur)
 rel={'pad':8,'organ':15,'rhodes':16,'vibes':13,'bell':11,'bass':35,'brass':28,'guitar':25,'pluck':40,'synth':25,'clav':55}.get(patch,19)
 env=a*np.exp(-off*rel)
 # lower signal when struck, provides a distinct instrumental pluck envelope
 phase=2*np.pi*f*t
 if patch=='bass':
  # punchy slightly detuned rounded saw and sub, with transient low-pass opening
  saw=2*((f*t)%1)-1
  low=.80*np.sin(phase)+.25*np.sin(2*phase)+.10*saw
  wave=np.tanh(1.3*low)*(.82+.18*np.exp(-t*7))
  env*=np.exp(-t*1.65)
 elif patch=='rhodes':
  # FM tine plus mellow sine fundamental
  fm=np.sin(phase+1.2*np.exp(-t*5)*np.sin(2*phase))
  wave=.68*fm+.27*np.sin(2*phase)*np.exp(-t*9)+.08*np.sin(5.02*phase)*np.exp(-t*13)
  env*=.82*np.exp(-t*1.45)+.18*np.exp(-t*7)
 elif patch=='vibes':
  wave=np.sin(phase+.18*np.sin(2.15*phase))+.35*np.sin(3.97*phase)*np.exp(-t*6)
  wave*=.77+.23*np.sin(2*np.pi*4.7*t)
  env*=np.exp(-t*2)
 elif patch=='bell':
  wave=.68*np.sin(phase)+.18*np.sin(2.01*phase)+.15*np.sin(3.73*phase)+.13*np.sin(5.12*phase)
  env*=np.exp(-t*2.7)
 elif patch=='clav':
  wave=(.65*np.sin(phase)+.32*np.sin(2*phase)+.20*np.sin(3.03*phase)+.11*np.sin(7.04*phase))*np.exp(-t*8)
 elif patch=='organ':
  trem=.79+.21*np.sin(2*np.pi*5.3*t)
  wave=trem*(.57*np.sin(phase)+.26*np.sin(2*phase)+.13*np.sin(3*phase)+.1*np.sin(4*phase))
  env*=.85
 elif patch=='pad':
  wave=.50*np.sin(phase)+.21*np.sin(phase*1.005)+.21*np.sin(2*phase)+.09*np.sin(3*phase)
 elif patch=='guitar':
  wave=np.sin(phase+.47*np.exp(-t*8)*np.sin(2*phase))+.18*np.sin(3*phase)*np.exp(-t*5)
  env*=np.exp(-t*3)
 elif patch=='brass':
  x=.70*np.sin(phase)+.25*np.sin(2*phase)+.16*np.sin(3*phase)+.1*np.sin(4*phase)
  wave=np.tanh(1.4*x)*(1-.24*np.exp(-t*10))
  env*=np.exp(-t*1.5)
 elif patch=='synth':
  pm=phase + .9*np.exp(-t*3)*np.sin(2*phase)
  wave=.53*np.sin(pm)+.25*(2*((f*t)%1)-1)+.18*np.sin(2.005*phase)
  env*=np.exp(-t*.8)
 elif patch=='pluck':
  wave=.54*np.sin(phase)+.30*np.sin(2*phase)+.16*np.sin(3*phase)+.12*np.sin(4*phase)
  env*=np.exp(-t*6)
 else:wave=np.sin(phase)
 return np.asarray(wave*env*amp,dtype=np.float32)

class Tune:
 def __init__(self, data):
  self.data=data;self.bpm=data['bpm'];self.barcount=data['bars'];self.notes=[];self.drums=[];self.seconds=data['bars']*4*60/self.bpm
 def add(self,patch,n,b,l,vel=.7,pan=0):
  if b<0 or b>=self.barcount*4 or l<=0:return
  self.notes.append((patch,mid(n),float(b),min(float(l),self.barcount*4-b-.001),float(vel),float(pan)))
 def chord(self,patch,pitches,b,l,vel=.6,pan=0):
  for k,p in enumerate(pitches):self.add(patch,p,b,l,vel*(.92 if k%2 else 1),pan+(.025 if k%2 else -.025))
 def hit(self,sound,b,vel=.7,pan=0):
  if 0<=b<self.barcount*4:self.drums.append((sound,float(b),vel,pan))

def add_original_neon(tune):
 # Re-render source score, preserve original melodic/harmonic identity rather than rewriting it.
 source=BASE/'NEON_STEP_V1_FONTE.mid'
 mf=mido.MidiFile(source)
 map_patch={'RHODES':'rhodes','BASS':'bass','VIBES':'vibes','ORGAN':'organ','BRASS':'brass','CLAV':'clav','LEAD':'synth','GUITAR':'guitar','ELECTRO':'synth'}
 for tr in mf.tracks:
  name=None
  for x in tr:
   if x.type=='track_name':name=x.name;break
  if name not in map_patch:continue
  tick=0;active={}
  for ev in tr:
   tick+=ev.time
   if ev.type=='note_on' and ev.velocity>0:
    active.setdefault(ev.note,[]).append((tick,ev.velocity))
   if ev.type in ('note_off','note_on') and (ev.type=='note_off' or ev.velocity==0):
    if active.get(ev.note):
     beg,vel=active[ev.note].pop(0)
     b=beg/mf.ticks_per_beat; length=(tick-beg)/mf.ticks_per_beat
     patch=map_patch[name]
     gain={'BASS':.72,'RHODES':.54,'VIBES':.60,'ORGAN':.40,'BRASS':.44,'CLAV':.38,'LEAD':.38,'GUITAR':.49,'ELECTRO':.34}[name]
     tune.add(patch,ev.note,b,length,min(.92,vel/127)*gain,pan={'BASS':0,'RHODES':-.15,'VIBES':.14,'CLAV':-.2,'ORGAN':.2,'BRASS':.1}.get(name,0))
 # New brass response and synth counterhook in the back-half, bass octave accents
 for bar in range(32):
  b=bar*4
  if bar%8 in [3,7]:
   for j,n in enumerate([69,73,76]):tune.add('brass',n,b+2.48,.27,.25,pan=.1)
  if bar>=16 and bar%2==0:
   for j,n in enumerate([74,77,81,79]):tune.add('synth',n,b+(.37,.81,1.58,2.72)[j],.24,.18,pan=.24)
  if bar%4==2:
   tune.add('vibes',81,b+3.5,.32,.23,pan=-.3)
  if bar%8 in [0,4]:tune.add('bass',38,b,.28,.31)

def compose_other(t):
 data=t.data; ident=data['id'];hs=HARM[ident];hook=HOOK[ident];mode=data['mode'];melpatch=data['patch']
 for bar in range(t.barcount):
  bb=bar*4; root,ch=hs[bar%8]; phase=bar//8;variation=phase%3
  t.chord('rhodes',ch,bb+(.08 if mode=='lounge' else .23),.61 if mode=='lounge' else .34,.35,pan=-.22)
  t.chord('rhodes',ch,bb+1.60,.29 if mode!='lounge' else .56,.27,pan=-.15)
  t.chord('rhodes',ch,bb+2.74,.47,.39,pan=-.18)
  if bar%8 in [0,4]:t.chord('pad',ch[1:],bb+.01,2.26,.14,pan=.18)
  if bar>=8 and bar%2==0:t.chord('organ',ch[1:],bb+3.24,.35,.27,pan=.2)
  if mode in ('boom','breaks','jungle'):
   for off,n in [(.28,ch[2]),(1.46,ch[1]),(2.27,ch[3]),(3.56,ch[2])]:t.add('clav',n,bb+off,.19,.24,pan=.25)
  elif mode in ('lounge','dance'):
   for off,n in [(1.08,ch[2]),(3.12,ch[3])]:t.add('vibes',n+12,bb+off,.24,.20,pan=.2)
  # syncopated bass with octave fifth pickups and chromatic approach
  groove={'lounge':[(0,0,.52),(.94,12,.29),(1.77,7,.43),(2.48,0,.55),(3.34,7,.42)],
   'dance':[(0,0,.40),(.75,12,.29),(1.5,7,.33),(2.05,0,.38),(2.75,12,.26),(3.25,7,.34)],
   'jungle':[(0,0,.32),(.70,12,.2),(1.22,7,.3),(1.77,0,.35),(2.5,7,.35),(3.05,12,.22),(3.50,7,.31)],
   'breaks':[(0,0,.42),(.74,12,.26),(1.22,7,.41),(1.86,0,.44),(2.5,12,.33),(3.14,7,.29),(3.6,0,.19)],
   'boom':[(0,0,.50),(.75,7,.29),(1.34,12,.38),(2.03,0,.49),(2.76,7,.31),(3.34,12,.24)]}[mode]
  for k,(o,interval,d) in enumerate(groove):
   note=root+interval
   if k==len(groove)-1 and bar%8 in [3,7]:note=root+1
   t.add('bass',note,bb+o,d,.49 if k==0 else .33,0)
  # melody sections: A -> B with lead variation and sparse breaks -> A+ climactic embellishments
  for k,(pos,n,l) in enumerate(hook[bar%8]):
   if variation==1 and k%3==1:continue
   if variation==2 and k==4:n+=12 if n<=81 else -12
   if mode=='lounge' and k%2: pos+=.06
   patch=melpatch
   if variation==1 and k%2==0:patch='synth' if melpatch not in ['synth','rhodes'] else 'vibes'
   vol=(.35 if mode=='jungle' else .38) * (1.08 if variation==2 else 1)
   t.add(patch,n,bb+pos,l,vol,pan=(.18 if k%2 else -.06))
  if bar%4==3:
   for k,(pos,nn) in enumerate([(2.92,ch[-1]+12),(3.20,ch[-2]+12),(3.51,ch[-1]+12)]):
    t.add('pluck',nn,bb+pos,.17,.19,pan=.31)
  if bar%8==7:
   t.add('brass',ch[2]+12,bb+3.6,.18,.24,pan=.05)
  if variation==2 and bar%2==1:
   for j,pitch in enumerate((ch[2]+12,ch[3]+12)):t.add('vibes',pitch,bb+1.05+j*.48,.25,.18,pan=.30)

# breakbeats are hand-sequenced per archetype, with humanized velocity and section fills.
def compose_drums(t):
 mode=t.data['mode'];rr=np.random.default_rng(50+len(mode)+t.bpm)
 for bar in range(t.barcount):
  b=bar*4;pos=bar%8; sec=bar//8
  kicks={
   'funk':[0,1.69,2.47,3.45], 'breaks':[0,.76,1.52,2.47,3.29],
   'boom':[0,1.75,2.5,3.5], 'dance':[0,1,2,3],
   'lounge':[0,1.79,2.48], 'jungle':[0,.75,1.5,2.49,3.2]
  }[mode]
  for x in kicks:
   t.hit('kick',b+x,.73 if x not in [0,2] else .93)
  for x in [1,3]:t.hit('snare',b+x,.8 if mode=='lounge' else .98)
  if mode in ['jungle','breaks','funk','boom']:
   for x in ([.73,2.71,3.68] if pos%2 else [.76,2.79]):t.hit('ghost',b+x,.21 if mode!='jungle' else .29,pan=.1)
  if mode=='jungle' and bar%2:t.hit('snare',b+3.74,.27)
  hats=16 if mode in ['jungle','breaks'] else 8
  for k in range(hats):
   step=4*k/hats
   hh=.014 if (k%2 and mode in ['funk','boom','lounge']) else 0
   vel=(.25 if k%2 else .33)*(.85+rr.random()*.3)
   if mode=='jungle':vel*=.83
   t.hit('hat' if k%4!=3 or mode=='jungle' else 'open',b+step+hh,vel,pan=(-.3 if k%2 else .26))
  if mode in ('dance','lounge'):
   for x in [.5,1.5,2.5,3.5]:t.hit('shake',b+x,.18,pan=.28)
  else:
   for k in range(8):
    if k%3 !=0:t.hit('shake',b+k*.5+(.04 if k%2 else 0),.12,pan=(-.3 if k%2 else .2))
  if pos==0:t.hit('crash',b,.17 if mode=='lounge' else .24)
  if bar%8==7:
   for x,g in [(3.45,.30),(3.65,.43),(3.82,.56)]:t.hit('snare',b+x,g)
  if mode=='lounge' and pos%4==2:t.hit('rim',b+2.5,.33)

def midi_write(t,outfile):
 midif=mido.MidiFile(ticks_per_beat=480)
 meta=mido.MidiTrack();midif.tracks.append(meta)
 meta.append(mido.MetaMessage('track_name',name=t.data['name']+' - original Josperd Jump OST',time=0))
 meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(t.bpm),time=0))
 meta.append(mido.MetaMessage('time_signature',numerator=4,denominator=4,time=0))
 programs={'bass':38,'rhodes':4,'vibes':11,'clav':7,'synth':80,'brass':61,'organ':16,'pad':89,'bell':10,'pluck':12,'guitar':26}
 for channel,(patch,program) in enumerate(programs.items()):
  if not any(n[0]==patch for n in t.notes):continue
  tr=mido.MidiTrack();midif.tracks.append(tr)
  tr.append(mido.MetaMessage('track_name',name=patch,time=0));tr.append(mido.Message('program_change',channel=channel,program=program,time=0))
  events=[]
  for x,p,b,d,v,pan in t.notes:
   if x==patch:
    events.extend([(round(b*480),1,p,max(10,min(126,round(v*125)))),(round((b+d)*480),0,p,0)])
  last=0
  for tick,on,p,vel in sorted(events,key=lambda x:(x[0],x[1])):
   tr.append(mido.Message('note_on' if on else 'note_off',channel=channel,note=p,velocity=vel,time=tick-last));last=tick
 mt=mido.MidiTrack();midif.tracks.append(mt)
 mt.append(mido.MetaMessage('track_name',name='Custom drum sequencer (GM proxy)',time=0))
 drmap={'kick':36,'snare':38,'ghost':37,'hat':42,'open':46,'shake':70,'crash':49,'rim':37};events=[]
 for name,b,vel,pan in t.drums:
  tick=round(b*480);p=drmap[name]
  events.extend([(tick,1,p,max(5,min(126,round(vel*116)))),(tick+30,0,p,0)])
 last=0
 for tick,on,p,vel in sorted(events,key=lambda x:(x[0],x[1])):
  mt.append(mido.Message('note_on' if on else 'note_off',channel=9,note=p,velocity=vel,time=tick-last));last=tick
 midif.save(outfile)

# Synthesised drum samples (fresh procedural noise / envelopes generated locally)
def drum_patches():
 r=np.random.default_rng(1982)
 def timeaxis(s):return np.arange(round(s*SR),dtype=np.float32)/SR
 t=timeaxis(.39)
 fq=55+195*np.exp(-t*43)
 kick=np.sin(2*np.pi*np.cumsum(fq)/SR)*np.exp(-t*16)+.13*r.standard_normal(len(t))*np.exp(-t*170)
 t=timeaxis(.23);z=r.standard_normal(len(t)).astype(np.float32)
 z=z-(np.convolve(z,np.ones(21)/21,'same'))
 snare=(.51*z*np.exp(-t*21)+.28*np.sin(2*np.pi*(180*t+43*t*t))*np.exp(-t*29))
 t=timeaxis(.16);z=r.standard_normal(len(t)).astype(np.float32)
 ghost=(.29*z*np.exp(-t*27)+.15*np.sin(2*np.pi*163*t)*np.exp(-t*40))
 t=timeaxis(.06);z=r.standard_normal(len(t)).astype(np.float32);hat=(z-np.convolve(z,np.ones(23)/23,'same'))*np.exp(-t*70)*.32
 t=timeaxis(.23);z=r.standard_normal(len(t)).astype(np.float32);openh=(z-np.convolve(z,np.ones(23)/23,'same'))*np.exp(-t*17)*.27
 t=timeaxis(.10);z=r.standard_normal(len(t)).astype(np.float32);shake=(z-np.convolve(z,np.ones(11)/11,'same'))*np.exp(-t*49)*.25
 t=timeaxis(.72);z=r.standard_normal(len(t)).astype(np.float32);crash=(z-np.convolve(z,np.ones(25)/25,'same'))*np.exp(-t*5)*.19
 t=timeaxis(.10);rim=(.3*r.standard_normal(len(t))*np.exp(-t*75)+.23*np.sin(2*np.pi*830*t)*np.exp(-t*60))
 return dict(kick=kick.astype('float32'),snare=snare.astype('float32'),ghost=ghost.astype('float32'),hat=hat.astype('float32'),open=openh.astype('float32'),shake=shake.astype('float32'),crash=crash.astype('float32'),rim=rim.astype('float32'))
PATCHES=drum_patches()

def render(t):
 n=round(t.seconds*SR)
 # extra tails wrapped into beginning for seamless track
 extra=round(SR*.75);sound=np.zeros((n+extra,2),dtype=np.float32)
 beat_dur=60/t.bpm
 # Synthesise note stream
 for idx,(patch,p,b,d,v,pan) in enumerate(t.notes):
  offset=round(b*beat_dur*SR)
  audio=signal_for_note(p,d*beat_dur,patch,v)
  length=min(len(audio),n+extra-offset)
  if length>0:
   pan=max(-.8,min(.8,pan));l=np.sqrt((1-pan)/2);r=np.sqrt((1+pan)/2)
   sound[offset:offset+length,0]+=audio[:length]*l
   sound[offset:offset+length,1]+=audio[:length]*r
 # Circulant room reverb with subtle stereo multi-tap delay; no samples required
 sound[:extra]+=sound[n:n+extra]*np.linspace(.96,.0,extra,dtype=np.float32)[:,None]
 master=sound[:n].copy()
 for delay,fb,side in [(.093,.080,0),(.171,.070,1),(.239,.055,0),(.351,.048,1)]:
  step=int(delay*SR)
  master[:,side]+=(np.roll(sound[:n,1-side],step)*fb)
 # Drums not delayed, steady transients
 for kind,b,v,pan in t.drums:
  at=round(b*beat_dur*SR);sample=PATCHES[kind];l=min(len(sample),n-at)
  if l>0:
   pan=max(-.8,min(.8,pan));gl=(1-pan)**.5/2**.5;gr=(1+pan)**.5/2**.5
   master[at:at+l,0]+=sample[:l]*v*gl*.90
   master[at:at+l,1]+=sample[:l]*v*gr*.90
 # gently glue the band without mastering pumping
 master=np.tanh(master*.94)
 # remove DC; avoid low rumble
 master=master-master.mean(axis=0,keepdims=True)
 peak=np.max(np.abs(master));master*=.90/max(.001,peak)
 # smooth seam with circular cross-fade, last 160ms leads into opening buffer
 fade=int(SR*.160)
 # keep beginning mostly unchanged: move final section progressively toward beginning
 for j in range(fade):
  w=(j+1)/fade
  master[-fade+j]=master[-fade+j]*(1-w)+master[j]*w
 # Micro-fades around the wrap boundary prevent sample discontinuity / loop clicks.
 tiny=round(SR*.004)
 ramp=(.5-.5*np.cos(np.linspace(0,np.pi,tiny,dtype=np.float32)))[:,None]
 master[:tiny]*=ramp
 master[-tiny:]*=ramp[::-1]
 return master

def main():
 manifesto=[]
 for data in SONGS:
  st=time.time();t=Tune(data)
  if data['id']=='josperd_neon_step_dx':add_original_neon(t)
  else:compose_other(t)
  compose_drums(t)
  folder=BASE/data['who'];folder.mkdir(parents=True,exist_ok=True)
  p=folder/data['id']; m=p.with_suffix('.mid');wav=p.with_suffix('.wav');mp3=p.with_suffix('.mp3');ogg=p.with_suffix('.ogg')
  midi_write(t,m)
  audio=render(t)
  sf.write(wav,audio,SR,subtype='PCM_16')
  subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','192k',str(mp3)],check=True)
  subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(wav),'-codec:a','libvorbis','-qscale:a','5',str(ogg)],check=True)
  row={k:v for k,v in data.items() if k!='patch'}
  row.update(duration=round(t.seconds,2),number_notes=len(t.notes),number_drums=len(t.drums),files={'mp3':str(mp3.relative_to(BASE)),'ogg':str(ogg.relative_to(BASE)),'wav':str(wav.relative_to(BASE)),'midi':str(m.relative_to(BASE))})
  manifesto.append(row)
  print(data['name'], 'time',round(t.seconds,1),'s','notes',len(t.notes),'drums',len(t.drums),'render',round(time.time()-st,2),'s',flush=True)
 (BASE/'manifest.json').write_text(json.dumps(dict(project='Modo Treino • Josperd Jump',release='OST V2',original_compositions=True,tracks=manifesto),ensure_ascii=False,indent=2),encoding='utf-8')
 (BASE/'README.txt').write_text('JOSPERD JUMP — ORIGINAL SOUNDTRACK V2\n\n6 músicas originais: 3 Josperd e 3 Camila. NEON STEP DX refina a primeira NEON STEP.\n\nA música SALTO DE BOLSO não está substituída: permanece reservada para uso futuro (possível tela de título).\n\nCada música vem em MP3/OGG (para o jogo), WAV (master de trabalho), e MIDI (partitura editável).\nOs timbres são sintetizados por código (sem usar samples, faixas de outros jogos ou soundfonts).\nTodas as faixas têm estrutura rítmica fechada e trecho final tratado para loop. MP3 pode acrescentar pequenos atrasos de encoder; prefira OGG para loop em navegadores.\n\nO código-fonte do compositor encontra-se em produzir_ost.py. Requer: numpy, scipy, soundfile, mido, ffmpeg.\n\nInspirado pela estética de jogos de luta e breakbeats dos anos 90, sem copiar melodias ou gravações.\n',encoding='utf-8')
 print('DONE',flush=True)

if __name__=='__main__':main()
