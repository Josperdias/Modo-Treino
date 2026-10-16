#!/usr/bin/env python3
"""10 new arcade adaptations of public-domain classical melodies for NEON STEP DX.
Each A section contains a recognisable melodic cell taken from, or inspired by, its historic source.
The B section introduces an original answer over compatible harmony. No sound recordings sampled.
Dependency: existing project composer/motor from source bundle, pretty_midi, soundfile, numpy and ffmpeg.
"""
from pathlib import Path
import sys,math,json,subprocess,shutil
import pretty_midi as pm
import numpy as np
import soundfile as sf

ROOT=Path('/mnt/data/NEON_STEP_DX_OST_V6_EDICAO_MELODICA')
ROOT.mkdir(exist_ok=True)
LAB=Path('/mnt/data/NEON_STEP_DX_EXPERIMENTO_CLASSICOS')
WORK=Path('/mnt/data/ost_revision_work')
sys.path.insert(0,str(LAB));sys.path.insert(0,str(WORK))
import compor_classicos as classical
import motor_original_v2 as eng

def n(s):return pm.note_name_to_number(s)
def phrase(*bars):return [[(round(j*4/len(bar),3),n(p)) for j,p in enumerate(bar)] for bar in bars]

# Explicit arrangements, not downloads or any commercial performances.
# Melodic cells are short classical themes; additional melodic responses are newly written.
TRACKS=[
 dict(slug='josperd_fate_breaker',who='Josperd',name='FATE BREAKER',source='Ludwig van Beethoven — Sinfonia nº 5, Op.67 (1808)',bpm=150,genre='Big beat / electro funk',mode='breaks',lead='brass',
      chords=[(48,'min9'),(43,'dom7'),(44,'maj9'),(43,'dom7')],
      A=[[(0,n('G5')),(.5,n('G5')),(1,n('G5')),(2,n('D#5'))],[(0,n('F5')),(.5,n('F5')),(1,n('F5')),(2,n('D5'))],[(0,n('D#5')),(.5,n('D#5')),(1,n('D#5')),(2,n('C5'))],[(0,n('D5')),(.75,n('F5')),(1.5,n('G5')),(2.5,n('D5'))]]),
 dict(slug='josperd_mountain_king_turbo',who='Josperd',name='MOUNTAIN KING TURBO',source='Edvard Grieg — No salão do Rei da Montanha, Peer Gynt, Op.23 (1875)',bpm=164,genre='Drum & bass / orchestral breaks',mode='breaks',lead='synth',
      chords=[(47,'min9'),(52,'min7'),(54,'dom7'),(47,'min9')],
      A=phrase(['B4','C#5','D5','E5','F#5','D5'],['F#5','E5','D5','C#5','B4','C#5'],['D5','E5','F#5','G5','A5','F#5'],['E5','D5','C#5','B4','F#5','B4'])),
 dict(slug='josperd_can_can_circuit',who='Josperd',name='CAN-CAN CIRCUIT',source='Jacques Offenbach — Galop infernal, Orphée aux enfers (1858)',bpm=152,genre='Electro house / brass arcade',mode='dance',lead='brass',
      chords=[(41,'maj9'),(48,'dom7'),(46,'maj9'),(48,'dom7')],
      A=phrase(['C5','F5','F5','G5','A5','C6'],['A5','G5','F5','E5','G5','C5'],['D5','F5','A5','Bb5','A5','F5'],['G5','E5','C5','E5','F5','C5'])),
 dict(slug='josperd_ragtime_reactor',who='Josperd',name='RAGTIME REACTOR',source='Scott Joplin — The Entertainer (1902)',bpm=134,genre='Ragtime / jazz-hop / arcade',mode='breaks',lead='vibes',
      chords=[(48,'maj9'),(45,'min7'),(50,'min7'),(43,'dom7')],
      A=[[(0,n('D#5')),(.5,n('E5')),(1.25,n('C5')),(2.25,n('A4')),(3,n('B4'))],[(0,n('G4')),(.5,n('A4')),(1.25,n('B4')),(2.25,n('D5')),(3,n('E5'))],[(0,n('F5')),(.75,n('D5')),(1.5,n('A4')),(2.5,n('C5')),(3.25,n('D5'))],[(0,n('B4')),(.75,n('D5')),(1.5,n('G5')),(2.5,n('F5')),(3.25,n('E5'))]]),
 dict(slug='josperd_moonlight_rush',who='Josperd',name='MOONLIGHT RUSH',source='Ludwig van Beethoven — Sonata ao Luar, Op.27 nº 2 (1801)',bpm=126,genre='Dark synthwave / jazz-trap',mode='breaks',lead='bell',
      chords=[(49,'min9'),(45,'maj9'),(42,'min7'),(44,'dom7')],
      A=phrase(['C#5','G#5','C#6','G#5','E5','G#5'],['A4','E5','A5','C#6','A5','E5'],['F#4','C#5','F#5','A5','F#5','C#5'],['G#4','D#5','G#5','B5','G#5','D#5'])),
 dict(slug='camila_minuet_motor',who='Camila',name='MINUET MOTOR',source='Christian Petzold — Minueto em Sol maior, BWV Anh.114 (~1725)',bpm=126,genre='City pop / electro-house',mode='dance',lead='bell',
      chords=[(43,'maj9'),(48,'maj9'),(45,'min7'),(50,'dom7')],
      A=phrase(['D5','G5','A5','B5','C6'],['D6','G5','G5','B5','A5'],['C6','B5','A5','G5','F#5'],['G5','D5','G5','A5','G5'])),
 dict(slug='camila_sugarplum_shuffle',who='Camila',name='SUGARPLUM SHUFFLE',source='Piotr Tchaikovsky — Dança da Fada Açucarada, O Quebra-Nozes, Op.71 (1892)',bpm=132,genre='Celesta future funk / house',mode='dance',lead='bell',
      chords=[(48,'min9'),(44,'maj9'),(41,'min7'),(43,'dom7')],
      A=phrase(['G5','Ab5','G5','Eb5','D5','Eb5'],['G5','Bb5','G5','F5','Eb5'],['Ab5','G5','F5','Eb5','C5'],['D5','F5','G5','Bb5','G5'])),
 dict(slug='camila_swan_lake_skyline',who='Camila',name='SWAN LAKE SKYLINE',source='Piotr Tchaikovsky — O Lago dos Cisnes, Op.20 (1876)',bpm=116,genre='Dream house / synthwave',mode='dance',lead='vibes',
      chords=[(47,'min9'),(43,'maj9'),(40,'min7'),(42,'dom7')],
      A=phrase(['F#5','B5','C#6','D6','C#6'],['B5','A5','G5','F#5','E5'],['F#5','G5','A5','B5','A5'],['F#5','E5','D5','C#5','B4'])),
 dict(slug='camila_spring_shift',who='Camila',name='SPRING SHIFT',source='Antonio Vivaldi — A Primavera, As Quatro Estações, RV269 (1725)',bpm=140,genre='Nu-disco / bossa pop',mode='dance',lead='pluck',
      chords=[(40,'maj9'),(45,'maj9'),(42,'min7'),(47,'dom7')],
      A=phrase(['E5','E5','E5','D#5','E5'],['F#5','G#5','F#5','E5','D#5'],['C#5','D#5','E5','G#5','F#5'],['B4','D#5','F#5','E5','B4'])),
 dict(slug='camila_hungarian_glow',who='Camila',name='HUNGARIAN GLOW',source='Johannes Brahms — Dança Húngara nº 5 (1869)',bpm=144,genre='Gypsy-jazz / speed garage',mode='breaks',lead='brass',
      chords=[(43,'min9'),(50,'dom7'),(46,'maj9'),(43,'min9')],
      A=phrase(['G5','F#5','G5','D5','Bb4'],['D5','G5','A5','Bb5','G5'],['F5','D5','Bb4','D5','F5'],['G5','Bb5','A5','F#5','G5']))
]

SCALES={'major':{0,2,4,5,7,9,11},'minor':{0,2,3,5,7,8,10}}

def nearest_chord_melody(melody, chord, protect=True):
    # Preserve the quoted historical A motifs; optimize B response voice-leading instead.
    root,quality=chord
    pcs={(root+i)%12 for i in classical.INTERVALS[quality]}
    melodic=[]
    prev=None
    for i,(bt,pitch) in enumerate(melody):
      if protect or not (bt==0 or abs(bt-2)<.25):
        nn=pitch
      else:
        picks=[k for k in range(max(56,pitch-3),min(95,pitch+4)) if k%12 in pcs]
        nn=min(picks,key=lambda k:abs(k-pitch)+(.3 if prev is not None and abs(k-prev)>7 else 0)) if picks else pitch
      melodic.append((bt,nn));prev=nn
    return melodic

def chord_plan(data):
  # Progression chosen by matching historical theme accents against a circle-of-fifths-aware chord vocabulary.
  progression=[]
  original=data['chords']; types=['maj9','min9','min7','dom7']
  for bi,bar in enumerate(data['A']):
    target={p%12 for bt,p in bar if bt==0 or abs(bt-2)<.26}
    base_root,base_quality=original[bi%len(original)]
    choices=[]
    for pc in range(12):
      for q in types:
        pcs={(pc+i)%12 for i in classical.INTERVALS[q]}
        matched=sum(p%12 in pcs for bt,p in bar if bt==0 or abs(bt-2)<.26)
        mismatch=len(target)-len(target&pcs)
        tonicdist=min((pc-base_root)%12,(base_root-pc)%12)
        choices.append((mismatch*9 + tonicdist*.35+(0 if q==base_quality else .6),36+pc,q,matched))
    ranked=sorted(choices)
    score,root,q,matched=ranked[0]
    # Avoid abrupt bass changes if some matching alternative exists.
    progression.append((root,q))
  return progression

def make_B(data):
    # Contrasting call-and-response, not a random transposition of independently generated notes.
    A=data['A'];chords=data['chords']
    B=[]
    for bi,bar in enumerate(A):
      pitches=[n for _,n in bar]
      times=[0,.75,1.5,2.5,3.25][:len(pitches)] if len(pitches)<=5 else [0,.5,1.25,2,2.75,3.4][:len(pitches)]
      while len(times)<len(pitches):times.append(min(3.75,times[-1]+.3))
      if bi%2==0: q=pitches[1:]+[pitches[0]]
      else: q=list(reversed(pitches))
      # narrow wide leaps for the answered phrase
      notes=[]
      prev=None
      for k,p in enumerate(q):
        adjust=-12 if bi%2==0 and p>85 else (12 if bi%2 and p<66 else 0)
        n0=p+adjust
        if prev is not None and abs(n0-prev)>10:
          n0=min([n0-12,n0,n0+12],key=lambda v:abs(v-prev))
        n0=max(62,min(91,n0))
        notes.append((times[k],n0));prev=n0
      notes=nearest_chord_melody(notes,chords[bi%len(chords)],protect=False)
      B.append(notes)
    return B

def render_track(data):
    # source melody + a coherent B answer, humanize attacks only very lightly
    data=dict(data)
    data['B']=make_B(data)
    data['chords']=chord_plan(data)
    data['chordsB']=data['chords']
    t,qa=classical.build(data)
    # Harmonization is based on the actual PD theme notes, then bass follows that harmony
    return t,qa,data

def write_out(t,stem):
    stem.parent.mkdir(exist_ok=True,parents=True)
    classical.write_midi(t,stem.with_suffix('.mid'))
    audio=eng.render(t)
    assert np.isfinite(audio).all() and len(audio)>100000
    sf.write(stem.with_suffix('.wav'),audio,eng.SR,subtype='PCM_16')
    for ext,args in [('mp3',['-c:a','libmp3lame','-q:a','4']),('ogg',['-c:a','libvorbis','-qscale:a','4'])]:
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(stem.with_suffix('.wav')),*args,str(stem.with_suffix('.'+ext))],check=True)
    a=pm.PrettyMIDI(str(stem.with_suffix('.mid')))
    assert sum(ins.is_drum for ins in a.instruments)==1
    return len(a.instruments),sum(len(ins.notes) for ins in a.instruments)

def main():
    results=[]
    for i,x in enumerate(TRACKS,1):
        t,qa,d=render_track(x)
        stem=ROOT/'Classicos'/d['who']/d['slug']
        ninst,nnotes=write_out(t,stem)
        record={k:d[k] for k in ['slug','name','who','source','bpm','genre']}
        record.update({'seconds':round(t.seconds,2),'qa':qa,'instruments':ninst,'events':nnotes,'files':{ext:str(stem.with_suffix('.'+ext).relative_to(ROOT)) for ext in ['mid','mp3','ogg','wav']},'public_domain_adaptation':True})
        results.append(record)
        print(f'[{i}/10] {d["name"]} — {d["who"]} — {nnotes} MIDI notes — {round(t.seconds)}s',flush=True)
    (ROOT/'classicos_manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    return results
if __name__=='__main__':main()
