#!/usr/bin/env python3
"""NEON STEP DX V7: synth, sampling original and public-domain melody adaptations.
All sample banks synthesized locally, no protected sound recordings. Reproducible.
Requires numpy scipy pretty_midi soundfile and ffmpeg for optional mp3/ogg.
"""
import numpy as np, pretty_midi, soundfile as sf, json, math, os, pathlib, subprocess, hashlib, functools
from scipy.signal import butter,sosfilt
ROOT=pathlib.Path(__file__).resolve().parents[1]
SR=22050
ROOT.joinpath('AMOSTRAS').mkdir(exist_ok=True)
# All melodic note patterns below are newly made, except the annotated old public-domain motives.
NOTE_MAP={'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
def note(s):
    k=2 if len(s)>2 and s[1] in '#b' else 1
    return (int(s[k:])+1)*12+NOTE_MAP[s[:k]]
def chord(ch,octave=3):
    root=ch[0]; n=1
    if len(ch)>1 and ch[1] in '#b':root=ch[:2];n=2
    typ=ch[n:]
    ints={'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'m7':[0,3,7,10],'maj7':[0,4,7,11],'dim':[0,3,6],'sus4':[0,5,7]}[typ]
    return [(octave+1)*12+NOTE_MAP[root]+i for i in ints]

def wave(kind,midi,duration,velocity=1):
    N=max(8,int(duration*SR)); t=np.arange(N,dtype=np.float32)/SR
    f=440.*(2.**((midi-69)/12))
    p=t*f
    if kind=='pulse': a=np.where(np.mod(p,1)<.25,1.,-1.); a=.77*a+.23*np.sin(2*np.pi*p)
    elif kind=='chip': a=np.where(np.mod(p,1)<.125,1.,-1.);a=.64*a+.36*np.sin(2*np.pi*p)
    elif kind=='triangle':a=2*np.abs(2*(p-np.floor(p+.5)))-1
    elif kind=='fm':a=np.sin(2*np.pi*f*t+2.6*np.sin(2*np.pi*2*f*t)*np.exp(-t*12))
    elif kind=='brass':a=np.sin(2*np.pi*f*t+1.8*np.sin(2*np.pi*f*t)*(.38+.62*np.exp(-t*8)))
    elif kind=='bell':a=.6*np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*2.01*f*t)+.18*np.sin(2*np.pi*3.97*f*t)
    elif kind=='saw':a=2*np.mod(p,1)-1
    elif kind=='organ':a=(.63*np.sin(2*np.pi*p)+.27*np.sin(4*np.pi*p)+.1*np.sin(6*np.pi*p))
    elif kind=='pluck':a=(np.sin(2*np.pi*p)+.4*np.sin(4*np.pi*p)+.2*np.sin(6*np.pi*p))*np.exp(-t*11)
    elif kind=='vox':a=(np.sin(2*np.pi*p)+.58*np.sin(4*np.pi*p)+.25*np.sin(6*np.pi*p))*np.exp(-t*5)
    else:raise ValueError(kind)
    attack=np.minimum(1,t/.007)
    release=np.minimum(1,(duration-t)/.055)
    env=np.maximum(0,attack)*np.maximum(0,release)
    if kind in ('bell','fm'): env*=.7+.3*np.exp(-t*6)
    if kind in ('chip','pulse','saw'):env*=.75+.25*np.exp(-t*4)
    return np.asarray(a*env*velocity,dtype=np.float32)

def create_samples():
    samples={}
    for typ,midi,dur in [('vox',72,.36),('brass',66,.48),('fm',72,.46),('bell',79,.36),('pluck',74,.42),('organ',69,.56)]:
        s=wave(typ,midi,dur,.75)
        # Genuine 8-bit sample quantization on a fixed base-note one-shot
        s=np.round(np.clip(s,-1,1)*127).astype(np.int8).astype(np.float32)/127
        samples[typ]=(midi,s)
        sf.write(ROOT/'AMOSTRAS'/f'{typ}_original_CRIADO.wav',s,SR,subtype='PCM_16')
    rng=np.random.default_rng(7007)
    n=int(.52*SR);t=np.arange(n)/SR
    noise=rng.standard_normal(n)
    # Synthesized kick/noise snare/hat/percussion -- no external samples
    ph=2*np.pi*np.cumsum((48+118*np.exp(-t*28)))/SR
    kick=np.sin(ph)*np.exp(-t*19)
    sna=(.6*noise+.36*np.sin(2*np.pi*183*t))*np.exp(-t*18)
    hat=np.r_[np.diff(noise),0]*np.exp(-t*80)
    clap=np.sign(noise)*np.exp(-t*25)*(1+.5*np.sin(2*np.pi*32*t))
    tom=np.sin(2*np.pi*(125*t+20/(2*np.pi*26)*(1-np.exp(-t*26))))*np.exp(-t*22)
    for name,raw in [('kick',kick),('snare',sna),('hat',hat),('clap',clap),('tom',tom)]:
        s=np.asarray(raw/np.max(abs(raw))*.73,dtype=np.float32)
        s=np.round(s*127).astype('int8').astype(np.float32)/127
        samples[name]=(None,s)
        sf.write(ROOT/'AMOSTRAS'/f'{name}_original_CRIADO.wav',s,SR,subtype='PCM_16')
    return samples
SAMPLES=create_samples()
@functools.lru_cache(maxsize=16384)
def render_note(kind,pitch,durtick):
    dur=durtick/1000
    if kind.startswith('sample:'):
        sample=kind.split(':',1)[1]
        base,raw=SAMPLES[sample]
        rate=2**((pitch-base)/12)
        length=max(1,int(len(raw)/rate))
        out=np.interp(np.arange(length)*rate,np.arange(len(raw)),raw,right=0).astype(np.float32)
        cutoff=min(len(out),int(dur*SR))
        out=out[:cutoff].copy()
        if len(out)>80:
            rn=min(int(SR*.04),len(out)//3);out[-rn:]*=np.linspace(1,0,rn)
        return out
    return wave(kind,pitch,dur,.8)

MAJOR=[0,2,4,5,7,9,11]
MINOR=[0,2,3,5,7,8,10]

def harmonize(melody,chordnotes,strong=True,preserve=False):
    if preserve or not strong:return melody
    choices=[n+k*12 for n in chordnotes for k in (-1,0,1,2,3)]
    a=min(choices,key=lambda v:(abs(v-melody),abs(v-melody)%12))
    return int(a) if abs(a-melody)<=3 else melody

def tone_line(n,scale,root):return root+scale[n%7]+12*(n//7)
# Melodies below transcribed as approximate well-known public-domain fragments,
# deliberately rearranged; these are not copied from modern recordings/editions.
CLASSICS=[
 dict(slug='01_joyride_finale',title='Joyride Finale',character='Josperd',source='Beethoven — Ode à Alegria (tema, séc. XIX)',bpm=162,mode='major',key='C',prog=['C','G','Am','F','C','F','G','C'],style='speedrun',motif='E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4',lead='pulse'),
 dict(slug='02_elise_turbo',title='Elise Turbo',character='Camila',source='Beethoven — Für Elise (motivo de abertura, 1810)',bpm=149,mode='minor',key='A',prog=['Am','E7','Am','G','C','E7','Am','Am'],style='futurefunk',motif='E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G#4 B4',lead='fm'),
 dict(slug='03_turkish_boost',title='Turkish Boost',character='Josperd',source='Mozart — Rondo Alla Turca (motivos, 1783)',bpm=176,mode='minor',key='A',prog=['Am','E7','Am','G','C','G','E7','Am'],style='fm',motif='A4 B4 C5 D5 E5 F5 E5 D5 C5 B4 A4 B4 C5 B4 A4 G#4',lead='brass'),
 dict(slug='04_mountain_dash',title='Mountain Dash',character='Camila',source='Grieg — No Salão do Rei da Montanha (1875)',bpm=169,mode='minor',key='B',prog=['Bm','F#7','Bm','A','G','Em','F#7','Bm'],style='dnb',motif='B3 C#4 D4 E4 F#4 D4 F#4 E4 C#4 E4 D4 B3 D4 C#4 B3 F#3',lead='chip'),
 dict(slug='05_springboard_seasons',title='Springboard Seasons',character='Camila',source='Vivaldi — Primavera / As Quatro Estações (1725)',bpm=156,mode='major',key='E',prog=['E','B','C#m','A','E','A','B','E'],style='sparkle',motif='E5 E5 E5 F#5 G#5 G#5 G#5 A5 G#5 F#5 E5 F#5 G#5 F#5 E5 B4',lead='bell'),
 dict(slug='06_canon_acceleration',title='Canon Acceleration',character='Josperd',source='Pachelbel — Cânone em Ré (progressão de domínio público)',bpm=160,mode='major',key='D',prog=['D','A','Bm','F#m','G','D','G','A'],style='breakbeat',motif='F#4 A4 D5 C#5 A4 F#4 E4 F#4 G4 B4 D5 B4 A4 G4 F#4 E4',lead='pulse'),
 dict(slug='07_minuet_sunbeam',title='Minuet Sunbeam',character='Camila',source='Christian Petzold — Minueto em Sol (c. 1725)',bpm=146,mode='major',key='G',prog=['G','D','Em','C','G','Am','D','G'],style='citypop',motif='D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F#5 G5 G4 G4',lead='pluck'),
 dict(slug='08_greensleeves_nitro',title='Greensleeves Nitro',character='Josperd',source='Greensleeves — melodia tradicional (séc. XVI)',bpm=158,mode='minor',key='A',prog=['Am','G','F','E7','Am','G','E7','Am'],style='speedrun',motif='A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 A4 G4 F#4 E4',lead='chip'),
 dict(slug='09_frere_arcade',title='Frere Arcade',character='Camila',source='Frère Jacques — canção tradicional francesa',bpm=172,mode='major',key='C',prog=['C','G','Am','F','C','F','G','C'],style='bounce',motif='C5 D5 E5 C5 C5 D5 E5 C5 E5 F5 G5 E5 F5 G5 G5 A5 G5 F5',lead='brass'),
 dict(slug='10_twinkle_cosmic_rush',title='Twinkle Cosmic Rush',character='Josperd',source='Ah! vous dirai-je, maman — melodia tradicional séc. XVIII',bpm=164,mode='major',key='C',prog=['C','F','G','C','Am','F','G','C'],style='sparkle',motif='C5 C5 G5 G5 A5 A5 G5 F5 F5 E5 E5 D5 D5 C5 G4 A4',lead='fm'),
]

# Original NEW tunes; motif defined as degrees of the diatonic mode: stable thematic identity
ORIGINALS=[
 ('11_skyline_overclock','Skyline Overclock','Josperd',174,'E','major','speedrun','brass',[0,2,4,6,5,4,2,4,7,6,4,2,3,4,2,0],['E','B','C#m','A','E','A','B','E'],'stabs'),
 ('12_tangerine_velocity','Tangerine Velocity','Camila',168,'D','major','futurefunk','bell',[0,4,5,4,2,0,2,4,5,7,6,4,2,3,2,0],['D','Bm','G','A','D','G','A','D'],'stabs'),
 ('13_magnet_rush','Magnet Rush','Josperd',180,'F#','minor','dnb','fm',[0,2,3,5,7,5,3,2,0,7,5,3,2,3,1,0],['F#m','D','A','E','F#m','D','E','F#m'],'chops'),
 ('14_neon_boardwalk','Neon Boardwalk','Camila',154,'G','major','citypop','pluck',[0,2,4,7,6,4,2,4,5,4,2,0,2,4,5,7],['G','Em','C','D','G','C','D','G'],'vocal'),
 ('15_comet_circuit','Comet Circuit','Josperd',176,'A','minor','fm','chip',[0,2,3,4,7,6,4,3,2,4,5,7,5,4,2,0],['Am','F','C','G','Am','Dm','E7','Am'],'stabs'),
 ('16_pocket_breakers','Pocket Breakers','Camila',165,'A','major','breakbeat','pulse',[0,2,4,5,7,5,4,2,3,2,0,2,4,5,4,0],['A','E','F#m','D','A','D','E','A'],'chops'),
 ('17_supernova_funk','Supernova Funk','Josperd',160,'B','minor','newjack','brass',[0,4,2,3,5,7,5,3,0,2,3,5,6,7,5,2],['Bm','G','D','A','Bm','Em','F#7','Bm'],'vocal'),
 ('18_bitcrush_boulevard','Bitcrush Boulevard','Camila',171,'F','major','bounce','fm',[0,2,4,2,0,4,5,7,5,4,2,0,2,4,5,0],['F','C','Dm','Bb','F','Bb','C','F'],'chops'),
 ('19_sunrise_sprint','Sunrise Sprint','Camila',178,'E','major','dnb','bell',[0,1,2,4,5,6,7,5,4,2,3,4,5,2,1,0],['E','C#m','A','B','E','A','B','E'],'vocal'),
 ('20_jumpstart_frenzy','Jumpstart Frenzy','Josperd',182,'C','major','speedrun','pulse',[0,4,5,7,6,4,2,0,2,3,4,7,5,4,2,0],['C','Am','F','G','C','F','G','C'],'stabs'),
]
for t in ORIGINALS:
 slug,title,character,bpm,key,mode,style,lead,degs,prog,chop=t
 CLASSICS.append(dict(slug=slug,title=title,character=character,source='Original — sampling de amostras sintetizadas internamente',bpm=bpm,mode=mode,key=key,prog=prog,style=style,motif_degrees=degs,lead=lead,sampling=chop))

PC_NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
def classical_half_harmonies(cfg):
    # Choose a (possibly new) chord at each half-bar, harmonizing the original
    # motif's strong notes rather than mutating the recognizable melody.
    raw=[note(x) for x in cfg['motif'].split()]
    pcs=MAJOR if cfg['mode']=='major' else MINOR
    q=['','m','m','','','m','dim'] if cfg['mode']=='major' else ['m','dim','','m','m','','']
    pal=list(dict.fromkeys(cfg['prog']+[PC_NAMES[(NOTE_MAP[cfg['key']]+pc)%12]+qu for pc,qu in zip(pcs,q)]))
    if cfg['mode']=='minor':pal+= [PC_NAMES[(NOTE_MAP[cfg['key']]+7)%12]+'7']
    output=[];prev=cfg['prog'][0]
    for half in range(16):
        bar=half//2; first=half%2==0
        notes=raw[(bar%2)*8+(0 if first else 4):(bar%2)*8+(4 if first else 8)]
        target=cfg['prog'][bar]
        best=None
        for cand in pal:
            cp={n%12 for n in chord(cand,4)}
            score=12*(notes[0]%12 in cp)+1.8*sum(n%12 in cp for n in notes[1:])
            if cand==target:score+=1.2
            if cand==prev:score-=.4
            if cand==cfg['prog'][bar%8]:score+=.25
            # functional harmonic motion: 4ths and 5ths receive a bonus
            dst=(chord(cand,2)[0]-chord(prev,2)[0])%12
            if dst in (5,7):score+=.6
            if bar==7 and not first and cand==cfg['prog'][7]:score+=1
            if best is None or score>best[0]:best=(score,cand)
        output.append(best[1]);prev=best[1]
    return output
KINDS=['kick','snare','hat','clap','tom']
class Composer:
 def __init__(self,track):
    self.cfg=track; self.bpm=track['bpm'];self.spb=60/self.bpm;self.bar=4*self.spb
    self.total=32*self.bar
    self.snd=np.zeros((int((self.total+.36)*SR),2),dtype=np.float32)
    self.mid=pretty_midi.PrettyMIDI(initial_tempo=self.bpm,resolution=480)
    self.instr={};self.events=0
    self.gain={'lead':.26,'answer':.16,'bass':.22,'chords':.12,'arp':.10,'sample':.13,'drums':.24}
    self.rng=np.random.default_rng(int.from_bytes(hashlib.sha256(track['slug'].encode()).digest()[:4],'big'))
    self.scale=MAJOR if track['mode']=='major' else MINOR
    self.tonic=(5+1)*12+NOTE_MAP[track['key']] # root octave 5
    self.prog=track['prog']
    self.half_prog=classical_half_harmonies(track) if 'motif' in track else None
    self.channels={'lead':0,'answer':1,'bass':2,'chords':3,'arp':4,'sample':5,'drums':9}
    self.programs={'lead':80,'answer':81,'bass':38,'chords':4,'arp':11,'sample':61,'drums':0}
 def ins(self,part):
    if part not in self.instr:
      self.instr[part]=pretty_midi.Instrument(program=self.programs[part],is_drum=part=='drums',name=part)
    return self.instr[part]
 def event(self,part,kind,pitch,start,dur,volume=1,pan=0):
    if start<0 or start>=self.total or dur<=0:return
    dur=min(dur,self.total-start-.004);dur=max(.009,dur)
    s=render_note(kind,int(pitch),int(dur*1000))
    i=int(start*SR);length=min(len(s),len(self.snd)-i)
    if length<=0:return
    g=self.gain[part]*volume
    self.snd[i:i+length,0]+=s[:length]*g*(1-max(0,pan)*.45)
    self.snd[i:i+length,1]+=s[:length]*g*(1+min(0,pan)*.45)
    midi_pitch={'kick':36,'snare':38,'hat':42,'clap':39,'tom':45}.get(kind,pitch)
    self.ins(part).notes.append(pretty_midi.Note(pitch=int(midi_pitch),velocity=int(np.clip(78*volume,1,127)),start=max(.0,start),end=start+dur))
    self.events+=1
 def beat(self,bar,pos):return (bar*4+pos)*self.spb
 def active_chord(self,b,pos):return self.half_prog[(b%8)*2+(pos>=2)] if self.half_prog else self.prog[b%8]
 def drums(self):
    style=self.cfg['style']
    for b in range(32):
      section='B' if 16<=b<24 else 'A'
      kick=[0,2] if style in ('speedrun','bounce','fm','futurefunk','citypop') else [0,1.5,2.75]
      if style=='newjack':kick=[0,1.75,2.5]
      if style=='dnb':kick=[0,2.75]
      if style=='breakbeat':kick=[0,1.75,2.5,3.25]
      if b%4==3:kick=kick+[3.5]
      if section=='B' and b%2==0:kick=kick+[3]
      for pos in kick:self.drumhit('kick',b,pos,.92 if pos==0 else .67)
      for pos in (1,3): self.drumhit('snare',b,pos,.7 if section=='B' else .83)
      if b%4==3:self.drumhit('tom',b,3.75,.3)
      hh=0.25 if style in ('dnb','breakbeat','speedrun') else .5
      for i in np.arange(0,4,hh):
        strength=.24 if (int(round(i/hh))%2) else .32
        if style=='newjack' and int(i*2)%2:strength*=1.4
        self.drumhit('hat',b,float(i),strength, swing=(int(i/hh)%2)*(.035 if style in ('newjack','futurefunk') else .01))
      if b%8==7:self.drumhit('clap',b,3.75,.42)
 def drumhit(self,name,b,pos,vol,swing=0):
    s=SAMPLES[name][1]
    i=int((self.beat(b,pos+swing))*SR)
    if i>=len(self.snd):return
    length=min(len(s),len(self.snd)-i)
    a=s[:length]*vol*self.gain['drums']
    self.snd[i:i+length,0]+=a*.96;self.snd[i:i+length,1]+=a*1.04
    self.ins('drums').notes.append(pretty_midi.Note(pitch={'kick':36,'snare':38,'hat':42,'clap':39,'tom':45}[name],velocity=int(max(1,110*vol)),start=self.beat(b,pos+swing),end=self.beat(b,pos+swing)+.10))
    self.events+=1
 def chord_play(self):
    for b in range(32):
      c=chord(self.active_chord(b,0),4)
      pattern={'dnb':[0,1.5,2.75,3.5],'speedrun':[0,.75,2,2.75],'newjack':[0,1.5,2.5,3.25],'citypop':[0,1.5,2,3.5]}.get(self.cfg['style'],[0,1.5,2.5,3.25])
      for j,p in enumerate(pattern):
        bass=chord(self.active_chord(b,p),2)[0]
        pit=bass if j in (0,2) else (bass+7 if j==1 else bass+12)
        if b%8==7 and j==3:pit=bass+7
        self.event('bass','triangle' if self.cfg['style']!='fm' else 'fm',pit,self.beat(b,p),(.5 if j!=0 else .8)*self.spb,.9,pan=-.05)
      voicing=c[:3]
      ptn=[.0,2.0] if self.cfg['style'] in ('speedrun','fm') else [0,1.5,3.0]
      for onset in ptn:
        for n in voicing:
          n=chord(self.active_chord(b,onset),4)[voicing.index(n)]
          self.event('chords','organ' if self.cfg['style'] in ('citypop','futurefunk','newjack') else 'chip',n,self.beat(b,onset),.4*self.spb,.54,pan=-.25)
      if b%2==1:
        for j,onset in enumerate([.25,1.25,2.25,3.25]):
          self.event('arp','pluck' if self.cfg['style']!='fm' else 'chip',chord(self.active_chord(b,onset),4)[j%3]+12,self.beat(b,onset),.3*self.spb,.44,pan=.2)
 def get_motif(self):
    if 'motif_degrees' in self.cfg:
       d=self.cfg['motif_degrees']
       root=(4+1)*12+NOTE_MAP[self.cfg['key']]
       return [tone_line(x,self.scale,root) for x in d]
    return [note(x) for x in self.cfg['motif'].split()]
 def melody(self):
    theme=self.get_motif();n=len(theme)
    # Strict phrase A -> A' -> B (motivic inversion/sequence) -> A'' + cadence.
    # Every 2 bars, the 16-note motif is heard. Countermelody only in rests.
    for b in range(32):
      half=b%2; section=b//8
      for j in range(8):
        c=chord(self.active_chord(b,j*.5),4)
        idx=half*8+j
        if idx>=n:continue
        orig=theme[idx]
        pitch=orig
        if section==1:
          if idx in (3,7,11):pitch=orig+2
          elif idx in (5,13):pitch=orig-2
        if section==2:
          # recognizable rhythmic transformation, keep melodic contour
          center=theme[0]
          pitch=center-(orig-center)//2+2
        if section==3:
          if idx in (2,6,10,14):pitch=orig+12 if orig<70 else orig
        # Guardrails: preserve the original public-domain motif in first and final A sections
        if 'motif_degrees' in self.cfg or section in (1,2):
          pitch=harmonize(pitch,c,strong=(j%4==0),preserve=False)
        # 8ths with intentional gaps in B; no 7 simultaneous layers
        if section==2 and j in (2,6):continue
        pos=j*.5
        vol=1 if j in (0,4) else .78
        duration=(.47 if j!=7 else .61)*self.spb
        self.event('lead',self.cfg['lead'],pitch,self.beat(b,pos),duration,vol,pan=.14)
      # distinct question-answer in melodic gaps, short 2-note harmonic cadence
      if b%2==1:
        for k,p in enumerate((2.5,3.25)):
          target=chord(self.active_chord(b,p),4)[(k+1)%3]+12
          self.event('answer','bell' if self.cfg['character']=='Camila' else 'pulse',target,self.beat(b,p),.26*self.spb,.42,pan=-.3)
      # solo break fills at 8-bar transitions
      if b%8==7:
        for k,p in enumerate([3.0,3.25,3.5,3.75]):
           nn=chord(self.active_chord((b+1)%8,0),5)[k%3]
           self.event('answer','chip',nn,self.beat(b,p),.20*self.spb,.37,pan=.25)
 def sampling(self):
    # Actual sample playback: locally generated and 8-bit quantized one-shot banks
    if 'sampling' not in self.cfg:return
    scheme=self.cfg['sampling'];amp={'vocal':'vox','chops':'pluck','stabs':'brass'}[scheme]
    for b in range(32):
      c=chord(self.prog[b%8],4)
      # pattern evolves across sections but stays on-beat and harmonized
      if scheme=='vocal': ptn=[(1.75,0), (3.5,1)]
      elif scheme=='stabs':ptn=[(.75,0),(2.75,1)]
      else:ptn=[(1.75,0),(2.5,2),(3.25,1)]
      if 16<=b<24:ptn=[(1.25,1),(3.0,0)]
      for pos,idx in ptn:
        pitch=c[idx%3]+12
        self.event('sample','sample:'+amp,pitch,self.beat(b,pos),.26*self.spb,.54,pan=.3)
 def finish(self):
    self.drums(); self.chord_play();self.melody();self.sampling()
    # Bus compressor soft saturator, DC removal, fade-in/out short to reduce pops in standalone playback
    snd=np.tanh(self.snd*1.35)
    # Make seamless loop: short overlap match at both ends, avoiding clicks
    N=int(self.total*SR);snd=snd[:N]
    snd-=np.mean(snd,axis=0)
    L=min(512,N//10);snd[:L]*=np.linspace(0,1,L)[:,None];snd[-L:]*=np.linspace(1,0,L)[:,None]
    peak=np.max(abs(snd));snd=np.asarray(snd/max(peak/0.92,1),dtype=np.float32)
    for part,ins in self.instr.items():self.mid.instruments.append(ins)
    return snd

def analyze(config,m):
    melody=[i for i in m.instruments if i.name=='lead'][0].notes
    bass=[i for i in m.instruments if i.name=='bass'][0].notes
    sc=0;tot=0
    for n in melody:
      beat=n.start*config['bpm']/60
      if (round(beat*2)%4)!=0:continue
      bar=int(beat//4)
      chord_pc={x%12 for x in chord(classical_half_harmonies(config)[(bar%8)*2+(beat%4>=2)] if 'motif' in config else config['prog'][bar%8],4)}
      sc+=(n.pitch%12 in chord_pc);tot+=1
    return {'notes_lead':len(melody),'notes_bass':len(bass),'tempo_bpm':config['bpm'], 'strong_beat_chord_fit':round(sc/max(1,tot),3),'strong_beat_notes_checked':tot,'instruments':len(m.instruments),'score_not_subjective':True}

def main():
  results=[]
  for idx,cfg in enumerate(CLASSICS):
    group='CLASSICOS' if idx<10 else 'SAMPLING_ORIGINAL'
    prefix=('C' if idx<10 else 'S')+f'{(idx%10)+1:02d}'
    c=Composer(cfg);snd=c.finish();base=f'{prefix}_{cfg["slug"]}'
    wav=ROOT/'PROJETO'/(base+'.wav');sf.write(wav,snd,SR,subtype='PCM_16')
    mid=ROOT/'MIDI'/(base+'.mid');c.mid.write(str(mid))
    mp3=ROOT/'MP3'/(base+'.mp3');ogg=ROOT/'OGG'/(base+'.ogg')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-codec:a','libmp3lame','-b:a','128k',str(mp3)],check=True)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(wav),'-codec:a','libvorbis','-qscale:a','3',str(ogg)],check=True)
    audit=analyze(cfg,c.mid)
    row=dict(index=idx+1,category=group,code=prefix,title=cfg['title'],slug=base,character=cfg['character'],style=cfg['style'],bpm=cfg['bpm'],duration_seconds=round(c.total,2),source=cfg['source'],mp3=f'MP3/{base}.mp3',ogg=f'OGG/{base}.ogg',midi=f'MIDI/{base}.mid',audit=audit)
    results.append(row)
    wav.unlink()
    print(f'{idx+1:02d}/20 {cfg["title"]:26s} {cfg["bpm"]} BPM {c.total:.1f}s {c.events} events  harmony={audit["strong_beat_chord_fit"]}',flush=True)
  (ROOT/'manifesto.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
  print('COMPLETE',flush=True)
if __name__=='__main__':main()
