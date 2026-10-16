#!/usr/bin/env python3
"""Create an original new-jack-swing-inspired game BGM: original notes and synthesis only.
No copying, transcription or sampling of commercial recordings/compositions.
"""
import sys,subprocess,json
from pathlib import Path
import numpy as np, soundfile as sf, pretty_midi
ROOT=Path('/mnt/data/NEON_STEP_DX_OST_V6_EDICAO_MELODICA/Bonus_NewJack')
ROOT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,'/mnt/data/ost_revision_work')
sys.path.insert(0,'/mnt/data/NEON_STEP_DX_EXPERIMENTO_CLASSICOS')
import motor_original_v2 as eng
from compor_classicos import write_midi

# Original 4-bar phrase, minor funk with upward answer. 110 BPM, 24 bars, G minor -> Eb maj7 -> Bb maj7 -> F7.
# Section A (8 bars), B (8 bars), A' (8 bars), with intentional turnarounds for gapless loop.
T=eng.Tune(dict(bpm=112,bars=24,mode='boom',patch='synth',name='NIGHTSHIFT SHUFFLE'))
chords=[('Gm9',43,[58,62,65,69]),('Ebmaj9',39,[55,58,62,65]),('Bbmaj9',46,[57,60,62,65]),('F9',41,[55,57,60,63])]
# Every melodic downbeat participates in a chord; motifs developed by repetition and variation.
A=[[(0,74,.34),(.75,70,.24),(1.5,69,.34),(2.25,70,.22),(3,74,.58)],
   [(0,70,.48),(1.0,67,.28),(1.75,70,.26),(2.5,74,.34),(3.25,70,.30)],
   [(0,72,.35),(.50,69,.30),(1.25,67,.36),(2.0,69,.35),(3.0,72,.62)],
   [(0,69,.35),(.75,67,.25),(1.50,72,.28),(2.50,75,.25),(3.25,69,.40)]]
# Relative bridge melody: spacious, lower-energy first half and rising answer.
B=[[(0,70,.6),(1.25,74,.35),(2.25,77,.34),(3.25,74,.24)],
   [(0,70,.53),(.75,67,.35),(2,70,.36),(3,74,.34)],
   [(0,72,.5),(.75,69,.24),(2,72,.35),(2.75,74,.35)],
   [(0,72,.4),(1.0,69,.32),(2.25,67,.23),(3,69,.45)]]
for bar in range(24):
  rootname,root,tones=chords[bar%4]
  start=bar*4
  sec='A' if bar<8 else 'B' if bar<16 else 'A2'
  for ix,(pos,pitch,duration) in enumerate((A if sec!='B' else B)[bar%4]):
    shift=0 if sec!='A2' else (2 if bar%4==1 and ix==3 else 0)
    # Applied only to weaker tone, avoid changing chordal anchors.
    T.add('synth',pitch+shift,start+pos,duration,.26 if sec=='B' else .30,pan=.12)
  # Bass syncopates around the drums, with consistent harmonic target.
  nextroot=chords[(bar+1)%4][1]
  bassline=[(0,root,.44),(.75,root+12,.17),(1.5,root+7,.25),(2.25,root,.3),(3.25,(nextroot if bar%4==3 else root+7),.2)]
  for j,(beat,pitch,dur) in enumerate(bassline):T.add('bass',pitch,start+beat,dur,.39 if j==0 else .25,pan=-.08)
  # The chord voices fall into melody rests: concise rhythmic comp stabs.
  for beat in [1.0,2.75]:
    T.chord('rhodes',tones,start+beat,.26,.12,pan=-.27)
  if bar%4 in (0,2):
    for beat in (1.75,3.5):T.add('clav',tones[1]+12,start+beat,.14,.12,pan=.29)
  if bar%8==7:T.add('vibes',tones[-1]+12,start+3.25,.3,.12,pan=.3)
  # Kick syncopation is repetitive and drums remain paired with snare on 2/4.
  for beat in (0, .75, 2,2.75):T.hit('kick',start+beat,.65 if beat==0 else .46)
  for beat in (1,3):T.hit('snare',start+beat,.62)
  for sub in range(16):
    # 16th hats, one swung and low-velocity on off subdivisions.
    T.hit('hat',start+sub*.25+(0.04 if sub%2 else 0), .115 if sub%2 else .17,pan=(-.22 if sub%2 else .22))
  if bar%4==3:
    T.hit('ghost',start+3.5,.19)
    T.hit('open',start+3.75,.15)
  if bar in [0,8,16]:T.hit('crash',start,.12)

stem=ROOT/'camila_nightshift_shuffle'
write_midi(T,stem.with_suffix('.mid'))
wave=eng.render(T)
assert np.isfinite(wave).all() and len(wave)>100000
sf.write(stem.with_suffix('.wav'),wave,eng.SR,subtype='PCM_16')
for fmt,args in [('mp3',['-c:a','libmp3lame','-q:a','4']),('ogg',['-c:a','libvorbis','-qscale:a','4'])]:
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(stem.with_suffix('.wav')),*args,str(stem.with_suffix('.'+fmt))],check=True)
m=pretty_midi.PrettyMIDI(str(stem.with_suffix('.mid')))
assert sum(x.is_drum for x in m.instruments)==1
report=dict(name='NIGHTSHIFT SHUFFLE',character='Camila',style='New jack swing / Arcade funk',inspiration='production techniques only; no commercial recordings or compositions sampled',bpm=112,duration=round(T.seconds,2),midi_notes=sum(len(i.notes) for i in m.instruments),instruments=[i.name for i in m.instruments])
(stem.with_suffix('.json')).write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
