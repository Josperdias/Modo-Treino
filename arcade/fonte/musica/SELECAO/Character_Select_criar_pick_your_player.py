#!/usr/bin/env python3
"""PICK YOUR PLAYER! - original character select music for Josperd Jump.
24 bars of original jazz-funk / 90s arcade music at 138 BPM.
Synths/drums are procedural; no samples, soundfonts, borrowed melodies.
Outputs OGG, MP3, WAV, editable MIDI, and analysis/README.
Requires numpy soundfile mido ffmpeg and motor_original_v2.py from OST V3.
"""
from __future__ import annotations
import json, sys, subprocess
from pathlib import Path
import numpy as np, soundfile as sf, mido
BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE/'Josperd_Jump_OST_V3'))
sys.path.insert(0, str(BASE/'engine'))
import motor_original_v2 as eng
OUT=(BASE/'Josperd_Jump_PERSONAGEM_SELECT') if (BASE/'Josperd_Jump_OST_V3').exists() else BASE
OUT.mkdir(exist_ok=True)
BPM=138; BARS=24
T=eng.Tune(dict(id='character_select_pick_your_player',name='PICK YOUR PLAYER!',bpm=BPM,bars=BARS,mode='funk',patch='synth'))
# Pitch class check for every accent: jazz tensions allowed on weak beats only.
# 8-bar tonal arc F minor -> Bb dominant -> Ebmaj9 -> C7b9 -> Dbmaj9 -> Eb13 -> Fm9 -> C7alt.
H=[
 ('Fm9', 41,[56,60,63,67],[41,44,48,51,55]),
 ('Bb13',46,[56,60,62,67],[46,50,53,56,60,67]),
 ('Ebmaj9',39,[55,58,62,65],[39,43,46,50,53]),
 ('C7b9',36,[52,58,61,67],[36,40,43,46,49]),
 ('Dbmaj9',37,[53,56,60,63],[37,41,44,48,51]),
 ('Eb13',39,[55,58,61,65],[39,43,46,49,53,60]),
 ('Fm9',41,[56,60,63,67],[41,44,48,51,55]),
 ('C7alt',36,[52,58,61,68],[36,40,43,46,49,56]),
]
# Manually composed A melody; each bar's accented notes are chord or selected 9/13.
A=[
 [(0,72,.34),(.5,75,.27),(.75,77,.54),(1.75,80,.33),(2.50,79,.28),(3.0,77,.60)],
 [(0,74,.37),(.5,77,.25),(1.0,79,.36),(1.75,84,.46),(2.62,80,.26),(3.0,79,.60)],
 [(0,79,.42),(.75,82,.32),(1.5,77,.43),(2.25,74,.32),(3.0,79,.61)],
 [(0,76,.35),(.5,79,.27),(1.25,82,.43),(2.0,85,.37),(2.75,82,.29),(3.25,79,.41)],
 [(0,77,.35),(.5,80,.26),(.75,84,.58),(1.75,82,.26),(2.5,80,.32),(3,77,.65)],
 [(0,79,.35),(.5,82,.26),(1.0,84,.40),(1.75,82,.32),(2.5,77,.28),(3.0,75,.64)],
 [(0,72,.34),(.5,75,.25),(1.0,77,.42),(1.75,80,.43),(2.5,84,.29),(3.0,80,.62)],
 [(0,76,.35),(.5,79,.28),(1.25,82,.43),(2,85,.33),(2.75,82,.24),(3.0,79,.44)]
]
# Explicit, lower-register answering B phrase; more breathing room & two call/response turnarounds.
B=[
 [(0,77,.38),(.75,75,.34),(1.5,72,.38),(2.5,75,.26),(3.0,77,.57)],
 [(0,79,.29),(.5,77,.37),(1.25,74,.36),(2.0,79,.30),(3.0,84,.55)],
 [(0,82,.36),(.75,79,.34),(1.5,77,.35),(2.5,74,.30),(3.0,77,.48)],
 [(0,76,.48),(1.0,79,.33),(1.75,82,.35),(2.5,79,.31),(3.0,76,.57)],
 [(0,80,.38),(.75,77,.32),(1.5,72,.42),(2.5,77,.30),(3.0,80,.54)],
 [(0,79,.36),(.75,77,.28),(1.25,75,.48),(2.25,79,.26),(3.0,82,.56)],
 [(0,84,.33),(.75,80,.32),(1.5,77,.42),(2.25,75,.34),(3.0,72,.48)],
 [(0,76,.34),(.5,79,.30),(1.25,82,.34),(2.0,85,.37),(3.0,79,.57)]
]
# Drum arrangement: backbeat on beats 2/4, swung hi-hats, ghost and breaks in turnarounds.
for bar in range(BARS):
 b=bar*4; section=bar//8; end=(bar%8==7)
 for k,x in enumerate([0,1.5,2.5,3.5] + ([.75] if bar%2 else [])):
  T.hit('kick',b+x,1.0 if x in (0,2.5) else .61)
 for x in [1,3]:T.hit('snare',b+x,.88 if section==1 else 1.0)
 for x in [.75,2.76]+([3.75] if bar%4==3 else []):T.hit('ghost',b+x,.24)
 for k in range(8):
  pos=k*.5 + (.07 if k%2 else 0)
  T.hit('open' if k==7 and not end else 'hat',b+pos,.22 if k%2 else .31,pan=(-.18 if k%2 else .18))
 if bar%2==0:
  for x in [.25,1.25,2.25,3.25]:T.hit('shake',b+x,.11,pan=.15)
 if bar%8==0:T.hit('crash',b,.18)
 if end:
  for pos,v in [(3.5,.24),(3.75,.45)]:T.hit('snare',b+pos,v)

for bar in range(BARS):
 b=bar*4; idx=bar%8; section=bar//8; label,root,voicing,pcs=H[idx]
 nextroot=H[(idx+1)%8][1]
 # bass: root/fifth/octave; accented 16th leading tone resolves into next root on downbeat.
 bass=[(0,root,.43,.55),(.75,root+12,.24,.36),(1.5,root+7,.31,.40),
       (2.0,root,.42,.49),(2.75,root+12,.26,.34),(3.25,root+7,.26,.33)]
 if idx in (3,7):bass.append((3.75,nextroot-1,.18,.20))
 for p,n,d,v in bass:T.add('bass',n,b+p,d,v,pan=0)
 # rhodes comping deliberately avoids lead's strong downbeats.
 for pos,dur,vol in [(.42,.29,.20),(1.47,.31,.21),(2.46,.38,.23)]:
  T.chord('rhodes',voicing,b+pos,dur,vol,pan=-.27)
 # brief pads in A2, controlled density so lead stays audible
 if section==2 and idx in (0,4): T.chord('pad',voicing[1:],b+.05,1.05,.105,pan=.24)
 if section==1 and idx in (0,2,4,6):
  T.add('clav',voicing[-2]+12,b+3.6,.19,.13,pan=.33)
 # Lead; A B A' melodic form, with second statement highlighted but not buried.
 line=A[idx] if section!=1 else B[idx]
 for j,(pos,n,dur) in enumerate(line):
  if section==2 and idx in (0,4) and j==3:n+=0 # keep original hook clear
  T.add('synth',n,b+pos,dur,.33 if section==1 else .39,pan=.07)
 # Metallic little response belongs only in the gaps, no lead double.
 if idx in (2,6) and section!=1:
  response=[(3.51,77 if idx==2 else 75,.25)]
  for pos,n,dur in response:
   # omit when within main sustained note; placement at 3.51 lightly post-line
   T.add('vibes',n,b+pos,dur,.11,pan=.38)
 # Horn interjection at important harmonic pickups only, 2-note stab, keep it off melody.
 if idx==3 and section>0:
  for n in (64,70):T.add('brass',n,b+3.48,.24,.10,pan=-.31) # E4 Bb4 C7b9
 if idx==7 and section==1:
  for n in (64,70):T.add('brass',n,b+3.47,.24,.11,pan=-.31)
 # little upbeat percussive claves groove for last 8 bars
 if section==2 and idx in (1,3,5,7):
  T.add('clav',voicing[-1]+12,b+3.52,.16,.11,pan=.29)

# quantifiable check for strong note key compatibility
check=[]
for bar in range(BARS):
 _,root,voicing,pcs=H[bar%8]
 for pos,n,d in (A if bar//8!=1 else B)[bar%8]:
  if pos in (0,1,2,3):check.append((bar,n,n%12 in {x%12 for x in pcs}))
assert all(x[-1] for x in check),[x for x in check if not x[-1]]
assert len(T.notes)>450

# Write valid MIDI ensuring channel 10 reserved for percussion.
mid=mido.MidiFile(ticks_per_beat=480)
meta=mido.MidiTrack();mid.tracks.append(meta)
meta.append(mido.MetaMessage('track_name',name='PICK YOUR PLAYER! - Josperd Jump Character Select',time=0))
meta.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(BPM),time=0))
meta.append(mido.MetaMessage('time_signature',numerator=4,denominator=4,time=0))
channels={'bass':(0,38),'rhodes':(1,4),'synth':(2,80),'vibes':(3,11),'clav':(4,7),'brass':(5,61),'pad':(6,89)}
for patch,(channel,program) in channels.items():
 events=[]
 for typ,n,b,d,v,pan in T.notes:
  if typ==patch:
   events += [(round(b*480),1,n,int(max(1,min(127,v*126)))),(round((b+d)*480),0,n,0)]
 if not events:continue
 tr=mido.MidiTrack();mid.tracks.append(tr)
 tr.append(mido.MetaMessage('track_name',name=patch.upper(),time=0))
 tr.append(mido.Message('program_change',program=program,channel=channel,time=0))
 last=0
 for tic,on,n,vel in sorted(events,key=lambda e:(e[0],e[1])):
  tr.append(mido.Message('note_on' if on else 'note_off',channel=channel,note=n,velocity=vel,time=tic-last));last=tic
tr=mido.MidiTrack();mid.tracks.append(tr)
tr.append(mido.MetaMessage('track_name',name='Drum kit',time=0))
drummap={'kick':36,'snare':38,'ghost':37,'hat':42,'open':46,'shake':70,'crash':49,'rim':37}
ev=[]
for kind,b,v,pan in T.drums:
 tic=round(b*480)
 ev += [(tic,1,drummap[kind],int(max(4,min(127,v*110)))),(tic+25,0,drummap[kind],0)]
last=0
for tic,on,n,vel in sorted(ev,key=lambda e:(e[0],e[1])):
 tr.append(mido.Message('note_on' if on else 'note_off',channel=9,note=n,velocity=vel,time=tic-last));last=tic
name='Josperd_Jump_PICK_YOUR_PLAYER_Character_Select'
midpath=OUT/(name+'.mid');mid.save(midpath)

# Use already-audited note engine with mathematical synthesizer; samples/soundfonts not used.
audio=eng.render(T)
assert np.isfinite(audio).all()
wav=OUT/(name+'.wav');sf.write(wav,audio,eng.SR,subtype='PCM_16')
mp3=OUT/(name+'.mp3');ogg=OUT/(name+'.ogg')
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','192k',str(mp3)],check=True)
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(wav),'-codec:a','libvorbis','-qscale:a','5',str(ogg)],check=True)
# Separate MIDI re-parse validation
validated=mido.MidiFile(midpath)
assert all(event.channel!=9 for track in validated.tracks for event in track if event.type=='program_change')
report={'name':'PICK YOUR PLAYER!','bpm':BPM,'bars':BARS,'duration_seconds':round(T.seconds,2),'mode':'F minor / jazz-funk','melodic_notes':len(T.notes),'drum_events':len(T.drums),'harmony':['Fm9','Bb13','Ebmaj9','C7b9','Dbmaj9','Eb13','Fm9','C7alt'],'strong_beat_melody_notes_tested':len(check),'off_chord_on_downbeat':sum(not x[-1] for x in check),'true_peak':round(float(np.abs(audio).max()),5),'audio_rms':round(float(np.sqrt(np.mean(audio**2))),5),'sample_rate':eng.SR,'uses_external_samples':False}
(OUT/'analise.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
(OUT/'LEIA_ME.txt').write_text('JOSPERD JUMP • PICK YOUR PLAYER!\nTema original para tela de seleção de personagens.\n138 BPM • 24 compassos • Aproximadamente 42 segundos • Faixa pensada para repetição.\nTrilha original com síntese matemática em Python, sem samples, soundfonts ou música de terceiros.\nOGG sugerido para loop no jogo; MP3 para audição e compartilhamento; MIDI para editar a melodia; WAV master.\nOBS: MP3 pode introduzir atraso de codificação, o OGG geralmente é mais apropriado para reprodução contínua.\nPara regenerar: colocar este script junto à pasta Josperd_Jump_OST_V3 com motor_original_v2.py e rodar python criar_pick_your_player.py.\nA OST de gameplay V3 e a música Salto de Bolso continuam preservadas.\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False,indent=2))
