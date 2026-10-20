#!/usr/bin/env python3
"""NEON STEP DX OST V6 — phrase-first MIDI composition engine and offline procedural synthesizer.
Uses numpy, soundfile, pretty_midi/mido, and ffmpeg. Entirely local; no third-party samples.
Creates MIDI, OGG and MP3 for the 24 V5 expansion compositions without overwriting originals.
"""
import ast, json, math, subprocess, sys, time, zipfile, hashlib
from collections import defaultdict
from pathlib import Path
import numpy as np
import soundfile as sf
import pretty_midi

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import motor_original_v2 as eng
SOURCE=HERE/'build_neon_step_dx_ost_expansion.py'
AST=ast.parse(SOURCE.read_text())
const={}
for node in AST.body:
 if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in ('SPECS','SCALES'):
  const[node.targets[0].id]=ast.literal_eval(node.value)
SPECS=const['SPECS'];SCALES=const['SCALES']
ROOT=HERE/'NEON_STEP_DX_OST_V6_HARMONY';ROOT.mkdir(exist_ok=True)

PROG={
 'major':   ([0,5,3,4],[3,4,1,4]),
 'minor':   ([0,5,3,6],[3,4,5,0]),
 'dorian':  ([0,3,4,0],[5,3,1,4]),
 'mixolydian':([0,6,3,0],[5,3,6,0])
}
# Musical gestures are invented note by note, then harmonized to a functional four-chord loop.
# Each row below describes a coherent 4-bar lyrical idea, not independently randomized bars.
IDEAS=[
 [[0,2,4,3,2,0],[1,2,4,5,4,2],[2,3,4,2,1,0],[2,1,0,-1,0]],
 [[0,1,3,4,3,1],[2,4,5,4,2,1],[3,4,6,5,4,2],[1,2,0,-1,0]],
 [[0,2,3,2,4,3],[2,3,5,4,2,1],[4,5,4,3,2,1],[2,0,1,0,-1]],
 [[0,2,1,3,4,2],[2,4,3,5,4,2],[3,5,6,5,3,2],[1,2,0,-1,0]],
 [[0,3,4,2,1,0],[2,4,5,3,2,1],[3,4,6,4,3,1],[2,1,0,1,0]],
 [[0,1,4,3,2,0],[2,3,5,4,3,1],[4,3,6,5,4,2],[1,0,2,1,0]],
 [[0,2,4,2,3,0],[1,3,5,3,2,1],[2,4,6,4,3,2],[2,1,0,-1,0]],
 [[0,1,3,2,4,1],[2,4,6,5,3,2],[4,5,7,5,4,2],[3,2,1,0,0]]
]
PATTERNS={
 'breaks': [[0,.5,1.25,2,2.75,3.35],[0,.75,1.5,2.25,3.0],[0,.5,1,1.75,2.75,3.35],[0,.75,1.5,2.5,3.1]],
 'jungle': [[0,.5,1.0,1.75,2.5,3.0],[0,.5,1.25,2.0,2.75],[0,.5,1.5,2,2.75,3.5],[0,.75,1.5,2.25,3]],
 'dance': [[0,.75,1.5,2.0,2.75,3.5],[0,.5,1.5,2.5,3.25],[0,.5,1.25,2,2.75,3.5],[0,.75,1.5,2.5,3]],
 'disco': [[0,.5,1,1.5,2.5,3],[0,.75,1.25,2,3.25],[0,.5,1.5,2.25,3,3.5],[0,.5,1.5,2.5,3]],
 'boom': [[0,.75,1.75,2.5,3.1],[0,1,1.5,2.5,3.25],[0,.75,1.25,2,3],[0,.75,2,3]],
 'lounge': [[0,1,1.75,3],[0,1.25,2.25,3.1],[0,.75,1.75,2.75,3.25],[0,1.25,2.25,3]],
 'bossa': [[0,.75,1.75,2.5,3.25],[0,1,1.75,2.5,3.5],[0,.75,1.5,2.5,3.5],[0,1.25,2.25,3.25]],
 'garage': [[0,.75,1.5,2.25,3.25],[0,.5,1.25,2.5,3.25],[0,.75,1.5,2.25,3],[0,.75,2,3.25]],
 'retro': [[0,.75,1.75,2.5,3.25],[0,.5,1.5,2.5,3.25],[0,1,1.5,2.5,3.25],[0,.75,1.75,3]],
 'electro': [[0,.5,1.25,2.0,2.75,3.25],[0,.75,1.5,2.25,3.25],[0,.5,1.0,2,2.75,3.5],[0,.75,1.5,2.5,3]],
}
DRUMS={
 'breaks':[0,.75,1.5,2.5,3.25], 'jungle':[0,.75,1.5,2.5,3.25],
 'boom':[0,1.75,2.5], 'dance':[0,1,2,3], 'disco':[0,1,2,3],
 'garage':[0,.75,2,2.75], 'electro':[0,.75,2,2.75,3.5],
 'retro':[0,1.5,2.5], 'lounge':[0,1.75,2.5], 'bossa':[0,1.5,2.5,3.5]
}

def note_of(key,sc,diatonic,near=74):
 step=diatonic%7; octave=diatonic//7
 pc=(key+sc[step])%12
 return min((n for n in range(64,90) if n%12==pc),key=lambda n:abs(n-(near+12*octave)))

def root_degree(key,scale,degree):return (key+scale[degree])%12

def harmonic_chord(key,scale,degree):
 pcs=[(key+scale[(degree+i)%7])%12 for i in (0,2,4,6)]
 return pcs

def voice_choices(pcs):
 # rootless three-voice chord shell: 3rd + 5th + 7th, avoid muddy bass range.
 allc=[]
 for a in range(51,64):
  if a%12!=pcs[1]:continue
  for b in range(a+3,min(69,a+13)):
   if b%12!=pcs[2]:continue
   for c in range(b+3,74):
    if c%12==pcs[3]:allc.append((a,b,c))
 return allc

def voicings_for(key,scale,prog):
 out=[];prev=None
 for degree in prog:
  pcs=harmonic_chord(key,scale,degree)
  opt=voice_choices(pcs)
  if not opt:
   # mild fallback: chord shell thirds/sevenths without a specified fifth
   opt=[tuple(sorted([min([n for n in range(53,66) if n%12==p],key=lambda n:abs(n-60)) for p in pcs[1:4]]))]
  score=lambda v:sum((p-q)**2 for p,q in zip(v,prev)) * 1.25 if prev else sum((p-t)**2 for p,t in zip(v,(55,60,66)))
  v=min(opt,key=score)
  out.append(v);prev=v
 return out

def get_section(bar):
 # A (0-7), B (8-15), A' (16-23) — three genuinely distinct parts.
 if bar<8:return 'A',bar%4
 if bar<16:return 'B',bar%4
 return 'A2',bar%4

def phrase_events(key,scale,mode,prog,idx,section):
 # Build a complete 4-bar line using DP (global continuity instead of fixing each isolated note).
 proto=IDEAS[(idx*3+idx//4)%len(IDEAS)]
 patterns=PATTERNS[mode]
 events=[]
 for bar in range(4):
  degrees=list(proto[bar]);times=patterns[bar]
  if section=='B':
   # contrasting bridge: one register higher, fewer events, different rhythmic emphasis.
   degrees=[d+2 if j%3 else d+1 for j,d in enumerate(reversed(degrees))]
   times=[min(3.75, max(0,round(v*2)/2+.25)) for v in times]
  if section=='A2' and bar in (2,3):degrees=[d+(1 if j==2 else 0) for j,d in enumerate(degrees)]
  if len(degrees)<len(times): degrees+=degrees[-1:]*(len(times)-len(degrees))
  if len(degrees)>len(times): degrees=degrees[:len(times)]
  degree=prog[bar]
  pcs=set(harmonic_chord(key,scale,degree));globalpcs={(key+n)%12 for n in scale}
  for j,(pos,d) in enumerate(zip(times,degrees)):
   # Restrict downbeat/third-beat melody to actual harmony; passing tones retain scale freedom.
   strong=(abs(pos-0)<.001 or abs(pos-2)<.001 or (bar==3 and j==len(times)-1))
   desired=note_of(key,scale,d,73+(idx%3))
   if section=='B':desired+=2
   candidates=[n for n in range(67,87) if n%12 in globalpcs and (not strong or n%12 in pcs)]
   events.append(dict(bar=bar,beat=float(pos),target=desired,candidates=candidates,chord=pcs,strong=strong))
 # DP penalizes arbitrary leaps and loss of motif identity. Strong tones are chordal.
 dp={};links=[]
 for i,e in enumerate(events):
  now={};link={}
  for n in e['candidates']:
   cost=(n-e['target'])**2*.50
   if n%12 not in e['chord']:
    cost+= 0.7 if e['strong'] else .28
   if i==0:
    cost+=.1*(n-(72+(idx%4)))**2
    now[n]=cost; link[n]=None
   else:
    p,score=min(dp.items(),key=lambda kv:kv[1]+cost+.075*(n-kv[0])**2+(14 if abs(n-kv[0])>9 else 0)+(1.1 if n==kv[0] else 0))
    now[n]=score+cost+.075*(n-p)**2+(14 if abs(n-p)>9 else 0)+(1.1 if n==p else 0)
    link[n]=p
  dp=now;links.append(link)
 fin=min(dp,key=dp.get);result=[fin]
 for i in range(len(events)-1,0,-1):result.append(links[i][result[-1]])
 result.reverse()
 return [(e['bar'],e['beat'],n,e['chord'],e['strong']) for e,n in zip(events,result)]

def build_tune(spec,idx):
 ident,who,name,genre,bpm,key,mode,lead,beat,pr,energy=spec
 special=idx>=20
 bars=24
 t=eng.Tune(dict(id=ident,who=who,name=name+' [Harmony Edition]',bpm=bpm,bars=bars,mode=beat,patch=lead))
 sc=SCALES[mode]
 A,B=PROG[mode]
 # 4-bar loops repeat only when the leading motif returns; B introduces another chord cycle.
 prog=[A[i%4] if bar<8 or bar>=16 else B[i%4] for bar in range(bars) for i in [bar]]
 voicings=voicings_for(key,sc,prog)
 vcount=defaultdict(int)
 for bar in range(bars):
  b=bar*4;degree=prog[bar];pcs=harmonic_chord(key,sc,degree)
  root=36+root_degree(key,sc,degree)
  nextroot=36+root_degree(key,sc,prog[(bar+1)%bars])
  character_boost=1.03 if who=='Josperd' else .94
  # Strong downbeat establishes chord; other bass notes are root/fifth, with sparse octave pickup.
  basstime=([0,.75,1.75,2.5,3.25] if beat in ('breaks','garage','jungle','electro') else
            [0,1.0,2.0,3.25] if beat in ('dance','disco') else
            [0,1.5,2.5,3.25])
  for j,bt in enumerate(basstime):
   nn=root+(12 if j==1 and beat!='lounge' else 0)
   if j==2:nn=root+(7 if (root+7)%12 in set(pcs) else 0)
   if j==len(basstime)-1 and bar%4==3:
    # stepwise lead-in to next harmonic root, respecting modal key
    nn=min((n for n in range(nextroot-2,nextroot+3) if n%12 in {(key+x)%12 for x in sc}),key=lambda n:abs(n-nextroot)+(.1 if n==nextroot else 0))
   t.add('bass',nn,b+bt,.35 if j else .62,(.29 if j else .43)*energy*character_boost,pan=0)
  # Consistent chord pattern: leave the melodic downbeat uncovered.
  v=voicings[bar]
  hits={'bossa':[.75,2.25,3.25],'lounge':[.15,2.15], 'retro':[.5,2.5],
        'boom':[1.0,2.75], 'garage':[.75,2.75], 'breaks':[.75,2.5],
        'jungle':[.75,2.5], 'electro':[.75,2.5], 'dance':[.5,1.5,2.5,3.5],
        'disco':[.5,1.5,2.5,3.5]}[beat]
  comp='guitar' if beat in ('bossa','retro') else 'rhodes'
  for j,bt in enumerate(hits):
   for k,n in enumerate(v):t.add(comp,n,b+bt,.35 if beat!='lounge' else .65,(.115 if j%2 else .125)*energy,pan=-.31)
  # section-specific layer density; never create simultaneous competing leads.
  if bar%8==0 and beat in ('retro','lounge','garage'):
   for n in v:t.add('pad',n,b,1.75,.06*energy,pan=.35)
  if beat in ('electro','breaks','disco') and bar%4==3:
   t.add('clav',v[1]+12,b+3.5,.14,.095*energy,pan=.35)
  # Genre-conscious drummer: steady kick/snare anchors; structured 4/8 bar variations.
  kicks=DRUMS[beat]
  for j,bt in enumerate(kicks):
   if bar%8==6 and bt==kicks[-1]:continue
   t.hit('kick',b+bt,(.55 if j else .79)*energy)
  snare=[1.5,3.5] if beat=='bossa' else [1.5,3] if beat=='garage' else [1,3]
  for bt in snare:t.hit('rim' if beat=='bossa' else 'snare',b+bt,.61*energy)
  hrate=16 if beat in ('jungle','breaks','garage','electro') else 8
  for k in range(hrate):
   bt=k*4/hrate
   sw=.037 if k%2 and beat in ('garage','boom','lounge','bossa') else 0
   t.hit('hat' if k!=hrate-1 or bar%4!=3 else 'open',b+bt+sw,(.14 if k%2 else .19)*energy,pan=.22 if k%2 else -.2)
  if beat in ('lounge','bossa','disco','dance'):
   for bt in (.5,1.5,2.5,3.5):t.hit('shake',b+bt,.12*energy,pan=.25)
  if bar%4==3:
   t.hit('ghost',b+3.5,.16*energy)
  if bar in (0,8,16):t.hit('crash',b,.16*energy)
 # continuous vocal-like phrase rather than auto-generating every bar in isolation
 sections={a:phrase_events(key,sc,beat,A if a!='B' else B,idx,a) for a in ('A','B','A2')}
 for bar in range(bars):
  b=bar*4; sec,inside=get_section(bar)
  phr=sections[sec]
  notes=[(pos,n,pcs,strong) for bn,pos,n,pcs,strong in phr if bn==inside]
  # A phrases repeat with small endpoint/rhythmic articulations; B is true contrast.
  for j,(pos,n,pcs,strong) in enumerate(notes):
   nextpos=notes[j+1][0] if j+1<len(notes) else 4
   length=max(.19,min(1.0, nextpos-pos-(.08 if beat=='lounge' else .13)))
   if inside==3 and j==len(notes)-1:length=min(.62,length)
   vel=(.27+(.045 if strong else 0)+(.015 if bar>=16 else 0))*energy
   if sec=='B':vel*=.88
   t.add(lead,n,b+pos,length,vel,pan=.10)
   vcount[sec]+=1
  # answering spark only AFTER lead phrase ends
  if inside==3 and notes[-1][0]<3.3:
   current_pcs=harmonic_chord(key,sc,prog[bar]); target=notes[-1][1]-5
   response=min((n for n in range(66,84) if n%12 in current_pcs),key=lambda n:abs(n-target))
   t.add('vibes' if lead not in ('vibes','bell') else 'pluck',response,b+3.65,.22,.10*energy,pan=.32)
 assert t.bpm==bpm and len(t.notes)>150
 return t,prog,vcount

def write_midi(t,out):
 # Pretty MIDI assigns separate dedicated melodic channels and channel 10 exclusively to drums.
 pm=pretty_midi.PrettyMIDI(initial_tempo=t.bpm,resolution=480)
 programs={'bass':38,'rhodes':4,'vibes':11,'clav':7,'synth':80,'brass':61,'organ':16,'pad':89,'bell':10,'pluck':12,'guitar':26}
 by_patch=defaultdict(list)
 for patch,n,b,d,v,pan in t.notes:
  by_patch[patch].append(pretty_midi.Note(pitch=int(n),velocity=max(15,min(126,int(v*125))),start=b*60/t.bpm,end=(b+d)*60/t.bpm))
 for patch,notes in by_patch.items():
  instrument=pretty_midi.Instrument(program=programs[patch],name=patch)
  instrument.notes=notes;pm.instruments.append(instrument)
 drumkit=pretty_midi.Instrument(program=0,is_drum=True,name='Percussão original')
 drmap={'kick':36,'snare':38,'ghost':37,'hat':42,'open':46,'shake':70,'crash':49,'rim':37}
 for kind,b,v,pan in t.drums:
  drumkit.notes.append(pretty_midi.Note(pitch=drmap[kind],velocity=max(10,min(126,int(v*116))),start=b*60/t.bpm,end=(b+.0625)*60/t.bpm))
 pm.instruments.append(drumkit)
 pm.write(str(out))
 reread=pretty_midi.PrettyMIDI(str(out))
 assert sum(k.is_drum for k in reread.instruments)==1
 assert all(0<=n.pitch<=127 and n.end>n.start for k in reread.instruments for n in k.notes)

def assess(t,prog,key,sc):
 leads=[(patch,n,b) for patch,n,b,d,v,pan in t.notes if patch==t.data['patch']]
 leaps=[abs(y[1]-x[1]) for x,y in zip(leads,leads[1:])]
 stronger=[(n,b) for patch,n,b in leads if abs(b%4)<.01 or abs(b%4-2)<.01]
 hits=sum(n%12 in harmonic_chord(key,sc,prog[min(int(b//4),len(prog)-1)]) for n,b in stronger)
 return dict(melody_notes=len(leads),leaps_over_octave=sum(x>12 for x in leaps),mean_interval=round(float(np.mean(leaps)),2),chord_tone_on_strong_beats=round(hits/max(1,len(stronger)),3),notes_total=len(t.notes),drum_events=len(t.drums))

def main():
 outputs=[]
 for idx,spec in enumerate(SPECS):
  tm=time.time();ident,who,name,genre,bpm,key,mode,lead,beat,*_=spec
  t,prog,counts=build_tune(spec,idx)
  base=ROOT/'Musicas'/who; base.mkdir(exist_ok=True,parents=True)
  path=base/(who.lower()+'_'+ident)
  write_midi(t,path.with_suffix('.mid'))
  wav=eng.render(t)
  sf.write(path.with_suffix('.wav'),wav,eng.SR,subtype='PCM_16')
  for ext,opts in [('ogg',['-c:a','libvorbis','-qscale:a','4']),('mp3',['-c:a','libmp3lame','-q:a','4'])]:
   subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(path.with_suffix('.wav')),*opts,str(path.with_suffix('.'+ext))],check=True)
  qa=assess(t,prog,key,SCALES[mode]);qa.update({'id':ident,'character':who,'title':name,'genre':genre,'bpm':bpm,'role':'special' if idx>=20 else 'normal','seconds':round(t.seconds,2),'section_notes':dict(counts),'files':{e:str(path.with_suffix('.'+e).relative_to(ROOT)) for e in ('mid','ogg','mp3','wav')}})
  outputs.append(qa)
  print(f'[{idx+1:02}/24] {name:<24} {round(time.time()-tm,1)}s, {qa["chord_tone_on_strong_beats"]:.0%} consonant anchors',flush=True)
 (ROOT/'manifest.json').write_text(json.dumps({'release':'V6 Harmony & Melody','source':'new original harmonically constrained phrases; V5 archived separately','songs':outputs},ensure_ascii=False,indent=2),encoding='utf-8')
 (ROOT/'LEIA_ME.txt').write_text('NEON STEP DX — OST V6 HARMONY & MELODY\n\n24 versões rearranjadas para maior continuidade melódica, 3 seções A/B/A\', progressões funcionais, condução de vozes e fraseado de chamada/resposta. Não substitui automaticamente V5 nem Salto de Bolso.\n\nO diagnóstico dos tempos fortes indica apenas compatibilidade com os acordes — a escolha artística depende da audição humana.\n\nInstrumentos sintetizados inteiramente por código sem usar gravações comerciais.\nMP3/OGG para audição/jogo; WAV e MIDI para editar.\n\nPara reproduzir: pip install numpy scipy soundfile pretty_midi mido; instalar ffmpeg; python refinar_ost_v6.py\n',encoding='utf-8')
 print('COMPLETE',flush=True)

if __name__=='__main__':main()
