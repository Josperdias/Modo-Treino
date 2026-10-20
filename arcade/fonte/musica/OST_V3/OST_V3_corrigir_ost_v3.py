#!/usr/bin/env python3
"""Josperd Jump OST V3: chord-aware melody correction and quantized groove.
Original v2 MIDI arrangements are preserved in ../Josperd_Jump_OST_V2.
Dependencies: numpy, scipy, soundfile, mido, pretty_midi, ffmpeg.
Run: python corrigir_ost_v3.py
All patches and drum sounds are oscillator/noise synthesis, no samples.
"""
from __future__ import annotations
import sys, json, math, itertools, subprocess, pathlib, shutil, statistics
from collections import Counter
from functools import lru_cache
import numpy as np
import pretty_midi
import mido
import soundfile as sf
import motor_original_v2 as orig

BASE=pathlib.Path(__file__).resolve().parent
V2=BASE.parent/'Josperd_Jump_OST_V2'
SR=orig.SR
NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']

def swing_grid(beat, step=.25, swing=.045):
    q=round(beat/step)*step
    if abs((q*2)%2-1)<.01: q+=swing # delay offbeat eighths, not main pulses
    return max(0,q)

def chord_pcs(root, chord): return {root%12}|{p%12 for p in chord}

def voice_candidates(ch):
    arr=set()
    for sh in itertools.product((-12,0,12),repeat=len(ch)):
        pitches=tuple(sorted(p+s for p,s in zip(ch,sh)))
        if len(set(pitches))!=4 or pitches[0]<49 or pitches[-1]>78 or pitches[-1]-pitches[0]>24:continue
        if any(b-a<2 for a,b in zip(pitches,pitches[1:])): continue
        arr.add(pitches)
    return sorted(arr) or [tuple(ch)]

def optimized_voicings(harmony):
    """DP finds chord inversions minimizing voice jumps, retaining original chord PCs."""
    vc=[voice_candidates(ch) for root,ch in harmony]
    def static_cost(pitch,old):
        return .10*sum(abs(x-y) for x,y in zip(pitch,old))+.09*abs(sum(pitch)/4-62.5)
    dp={p:(static_cost(p,harmony[0][1]),[p]) for p in vc[0]}
    for i in range(1,len(vc)):
        nd={}
        for cand in vc[i]:
            best=min((cost+.31*sum(abs(a-b) for a,b in zip(prev,cand)),path+[cand]) for prev,(cost,path) in dp.items())
            nd[cand]=(best[0]+static_cost(cand,harmony[i][1]),best[1])
        dp=nd
    # include transition to first bar to improve seamless loops
    end=min(dp.items(),key=lambda kv:kv[1][0]+.45*sum(abs(a-b) for a,b in zip(kv[0],kv[1][1][0])))
    return end[1][1]

def harmony_for_neon():
    # Roots and keyboard pitch classes from the ORIGINAL MIDI source
    return [(38,[53,57,60,64]),(43,[52,57,59,64]),(36,[55,59,62,64]),(33,[52,55,60,61]),
            (41,[52,57,60,64]),(34,[52,56,60,62]),(40,[53,55,58,62]),(33,[52,55,60,61])]

def motif_for_neon():
    return [
       [(0,69,.37),(.75,72,.29),(1.25,74,.43),(2,77,.58),(3,76,.29),(3.5,74,.35)],
       [(0,74,.42),(.75,76,.25),(1.5,79,.55),(2.45,76,.36),(3.25,74,.44)],
       [(0,76,.37),(.5,79,.28),(1.0,71,.3),(1.5,74,.4),(2.75,79,.31),(3.25,76,.27)],
       [(0,72,.4),(.75,73,.29),(1.25,76,.4),(2,79,.44),(3.05,76,.4)],
       [(0,69,.34),(.5,72,.26),(1.25,76,.42),(2,79,.48),(2.75,77,.3),(3.25,76,.35)],
       [(0,68,.37),(.75,72,.32),(1.5,76,.4),(2.25,80,.38),(3.25,76,.36)],
       [(0,70,.33),(.5,74,.25),(1.25,79,.43),(2,77,.38),(2.75,74,.29),(3.25,70,.38)],
       [(0,72,.33),(.75,73,.25),(1.5,76,.42),(2.25,79,.42),(3.25,72,.35)]]

def optimized_motif(original_motif, chords):
    """Viterbi note selection: close to original, chord resolution on accented beats,
    smooth leaps, chromatic passing tones permitted on weak beats."""
    seq=[(bar,i,pos,int(p),float(d)) for bar,notes in enumerate(original_motif) for i,(pos,p,d) in enumerate(notes)]
    candidates=[]
    for bar,k,pos,p,d in seq:
        row=[]
        for n in sorted(set([p+o for o in [-3,-2,-1,0,1,2,3]]+[p-12,p+12])):
            if 66<=n<=91:row.append(n)
        candidates.append(row)
    dp={n:(0.0,[]) for n in candidates[0]}
    def unary(bar,pos,original,n,d):
        root, chord=chords[bar]
        pcs=chord_pcs(root,chord)
        accent=min(abs(pos-0),abs(pos-2))<=.26 or d>=.49
        pc=n%12
        # Tensions relative to local bass: 9ths/11ths accepted if short or resolving
        tensions={(root+2)%12,(root+5)%12,(root+9)%12}
        harmony_pen=(0 if pc in pcs else (1.5 if pc in tensions else 4.5) if accent else (.3 if pc in tensions else 1.3))
        # Strongly preserve the existing hook and its recognizable contour.
        return abs(n-original)*.88+harmony_pen + (1.4 if abs(n-original)>4 else 0)
    for i,(bar,k,pos,p,d) in enumerate(seq):
        if i==0:
            dp={n:(unary(bar,pos,p,n,d),[n]) for n in candidates[i]};continue
        nd={}
        for n in candidates[i]:
            def transition(z,record):
                change=abs(n-z)
                return record[0]+(.15*max(0,change-4)**1.4)+(.7 if change>9 else 0)+(.10 if n==z else 0)
            z=min(dp,key=lambda key:transition(key,dp[key]))
            nd[n]=(transition(z,dp[z])+unary(bar,pos,p,n,d), dp[z][1]+[n])
        dp=nd
    best=min(dp,key=lambda n:dp[n][0]+(.12*abs(n-seq[0][3])))
    pitches=dp[best][1]
    fixed=[[] for _ in chords]
    for (bar,k,pos,p,d),new in zip(seq,pitches):fixed[bar].append((pos,new,d))
    return fixed

def lead_score(motif,chords):
    # Number of melody attacks on harmonic accents not in underlying chord or root.
    metrics=[]
    for i,seq in enumerate(motif):
        pcs=chord_pcs(*chords[i])
        for pos,p,d in seq:
            if min(abs(pos),abs(pos-2))<=.27 or d>=.49:
                metrics.append((pos,p, p%12 in pcs))
    return {'accented_notes':len(metrics),'accented_non_chord_tones':sum(not x[2] for x in metrics)}

def bass_groove(mode):
    return {'funk':[(0,0,.38),(.75,12,.24),(1.5,7,.30),(2.0,0,.41),(2.75,7,.28),(3.50,12,.23)],
     'lounge':[(0,0,.57),(1.0,12,.29),(1.75,7,.34),(2.5,0,.50),(3.5,7,.26)],
     'dance':[(0,0,.40),(.75,12,.25),(1.5,7,.33),(2,0,.38),(2.75,12,.26),(3.5,7,.28)],
     'jungle':[(0,0,.32),(.75,12,.22),(1.25,7,.32),(1.75,0,.35),(2.5,7,.35),(3,12,.25),(3.5,7,.25)],
     'breaks':[(0,0,.42),(.75,12,.26),(1.25,7,.35),(1.75,0,.40),(2.5,12,.29),(3.25,7,.27),(3.75,0,.17)],
     'boom':[(0,0,.50),(.75,7,.27),(1.5,12,.33),(2,0,.49),(2.75,7,.31),(3.5,12,.23)]}[mode]

def apply_arrangement(t, harmony, motif):
    """Separate main theme, accompanying chords, bass, and small responses.
    Reduce spectral masking by keeping rhythmic stabs and counter-lines sparse."""
    song=t.data; mode=song['mode']; lead= song['patch']
    voicings=optimized_voicings(harmony)
    for bar in range(t.barcount):
        b=bar*4; h=bar%8; section=bar//8;root,ch=harmony[h]; notes=voicings[h]
        # Keyboard stabs on the offbeat; stable, closed chord voicings, less density.
        for off,d,vol in [(0.5,.32,.28),(1.75,.33,.31),(3,.45,.32)]:
            if mode=='lounge' and off==.5:d=.67
            t.chord('rhodes', notes, b+off,d,vol,pan=-.22)
        if h in (0,4) and section%2==0:
            t.chord('pad',notes[1:],b+.04,1.45,.10,pan=.30)
        # Clav / organ not always present — keep the main melody prominent.
        if mode in ('boom','breaks','jungle') and h in (1,3,5,7):
            for off,p in [(1.25,notes[1]),(2.75,notes[2])]: t.add('clav',p,b+off,.17,.12,pan=.34)
        if mode=='lounge' and h%2==1:
            t.add('organ',notes[2],b+2.50,.62,.12,pan=.24)
        # Bass starts on/downbeat or syncopation, last approach prepares ACTUAL next root.
        groove=bass_groove(mode)
        for k,(off,interval,dur) in enumerate(groove):
            pitch=root+interval
            if k==len(groove)-1 and h in (3,7):
                next_root=harmony[(h+1)%8][0]
                pitch=next_root-1 if abs((next_root-1)-pitch)<abs((next_root+1)-pitch) else next_root+1
                pitch=np.clip(pitch,32,59)
            t.add('bass',int(pitch),b+off,dur,.42 if k==0 else .29,pan=0)
        # Theme: recognizable originals, but chord-aware adapted, aligned to 1/8 & 1/16.
        seq=motif[h]
        for i,(off,p,d) in enumerate(seq):
            if section%3==1 and i==len(seq)-2 and h not in (0,4):continue # rests for phrasing
            pos=swing_grid(off,.25,swing=.045 if mode!='lounge' else .065)
            dur=round(d*4)/4
            dur=max(.18,min(dur,3.98-pos))
            # Avoid note overlap in lead, preserving distinct attacks.
            if i+1<len(seq):
                next_at=swing_grid(seq[i+1][0],.25,.045)
                dur=min(dur,max(.16,next_at-pos-.035))
            # First half / second half with subtle variations, not wildly changing melody
            patch=lead
            t.add(patch,p,b+pos,dur,.52 if mode!='lounge' else .48,pan=.09)
        # Response only after the sung line, never unison melody doubling.
        if h in (3,7) and section in (1,2):
            reply=notes[-1]+12
            if reply>88:reply-=12
            t.add('pluck' if mode!='boom' else 'brass',reply,b+3.75,.17,.17,pan=.34)
        # Brief accents on the turnaround instead of constant busy counter-melodies.
        if h==7 and section==2:
            t.add('vibes',min(88,notes[2]+12),b+3.5,.22,.15,pan=-.36)

def better_drums(t):
    """Maintain the style of the old drum sequences while placing the kicks/ghosts
    on the shared sixteenth grid, with deterministic swung hats."""
    old=orig.Tune(t.data)
    orig.compose_drums(old)
    bars=t.barcount;mode=t.data['mode']
    for name,b,v,pan in old.drums:
        if name=='crash':
            if int(b//4)%8==0:t.hit(name,b,.16,pan)
            continue
        # Drop 50% of shaker content: give pitched instruments breathing room.
        if name=='shake' and int(round(b*4))%2==0:continue
        pos=b%4
        adjusted=swing_grid(pos,step=.25,swing=.04 if name in ('hat','open','shake') else 0)
        loc=int(b//4)*4+adjusted
        if loc>=bars*4:continue
        if name=='ghost':v*=.73
        if name in ('open','hat'):v*=.75
        if name=='snare':v*=.91
        t.hit(name,loc,v,pan)

def compose(s):
    t=orig.Tune(s)
    if s['id']=='josperd_neon_step_dx':
        h=harmony_for_neon(); motif=motif_for_neon()
    else:
        h=orig.HARM[s['id']]; motif=orig.HOOK[s['id']]
    refined=optimized_motif(motif,h)
    apply_arrangement(t,h,refined)
    better_drums(t)
    return t,h,motif,refined

def safe_midi_write(t, outfile):
    """Write proper MIDI: never assign melodic instruments to GM channel 10."""
    mf=mido.MidiFile(ticks_per_beat=480)
    mt=mido.MidiTrack();mf.tracks.append(mt)
    mt.append(mido.MetaMessage('track_name',name=t.data['name']+' Harmony Edition',time=0))
    mt.append(mido.MetaMessage('set_tempo',tempo=mido.bpm2tempo(t.bpm),time=0))
    mt.append(mido.MetaMessage('time_signature',numerator=4,denominator=4,time=0))
    patches={'bass':38,'rhodes':4,'vibes':11,'clav':7,'synth':80,'brass':61,'organ':16,'pad':89,'bell':10,'pluck':12,'guitar':26}
    melodic_channels=[j for j in range(16) if j!=9]
    for i,(patch,program) in enumerate(patches.items()):
        events=[];ch=melodic_channels[i]
        for name,p,b,d,v,pan in t.notes:
            if name!=patch:continue
            vel=int(np.clip(round(v*126),5,125))
            events.extend([(round(b*480),1,p,vel),(round((b+d)*480),0,p,0)])
        if not events:continue
        track=mido.MidiTrack();mf.tracks.append(track)
        track.append(mido.MetaMessage('track_name',name=patch,time=0))
        track.append(mido.Message('program_change',program=program,channel=ch,time=0))
        last=0
        for tick,on,p,vel in sorted(events,key=lambda e:(e[0],e[1])):
            track.append(mido.Message('note_on' if on else 'note_off',note=p,velocity=vel,channel=ch,time=tick-last))
            last=tick
    dm=mido.MidiTrack();mf.tracks.append(dm)
    dm.append(mido.MetaMessage('track_name',name='Drums',time=0))
    drmap={'kick':36,'snare':38,'ghost':37,'hat':42,'open':46,'shake':70,'crash':49,'rim':37}
    events=[]
    for name,b,v,pan in t.drums:
        tick=round(b*480);note=drmap[name];vel=int(np.clip(round(v*115),5,125))
        events.extend([(tick,1,note,vel),(tick+25,0,note,0)])
    last=0
    for tick,on,p,vel in sorted(events,key=lambda e:(e[0],e[1])):
        dm.append(mido.Message('note_on' if on else 'note_off',channel=9,note=p,velocity=vel,time=tick-last));last=tick
    mf.save(outfile)


def pretty_midi_verification(path):
    p=pretty_midi.PrettyMIDI(str(path)); parts=[x for x in p.instruments if not x.is_drum];dr=[x for x in p.instruments if x.is_drum]
    bad=sum(n.end<=n.start or n.pitch<0 or n.pitch>127 for part in p.instruments for n in part.notes)
    return {'instruments':len(parts),'drum_tracks':len(dr),'notes':sum(len(i.notes) for i in parts),'drum_hits':sum(len(i.notes) for i in dr),'invalid_midi_notes':bad,'duration_seconds':round(p.get_end_time(),2)}

def audio_stats(audio):
    peak=float(np.max(abs(audio)))
    rms=float(np.sqrt(np.mean(audio.astype(np.float64)**2)))
    if not np.isfinite(rms):raise ValueError('Non-finite audio values')
    return {'peak':round(peak,4),'rms':round(rms,4),'samples':len(audio),'sr':SR}

def main():
    report=[]
    for s in orig.SONGS:
        t,h,old,new=compose(s)
        folder=BASE/s['who']; folder.mkdir(parents=True,exist_ok=True)
        p=folder/(s['id']+'_v3')
        safe_midi_write(t,p.with_suffix('.mid'))
        verify=pretty_midi_verification(p.with_suffix('.mid'))
        if verify['invalid_midi_notes'] or verify['drum_tracks']!=1:raise RuntimeError('MIDI validation failed')
        audio=orig.render(t)
        audio=audio_stats(audio) and audio
        sf.write(p.with_suffix('.wav'),audio,SR,subtype='PCM_16')
        for ext,codec,opt in [('ogg','libvorbis',['-qscale:a','5']),('mp3','libmp3lame',['-b:a','192k'])]:
            subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(p.with_suffix('.wav')),'-codec:a',codec,*opt,str(p.with_suffix('.'+ext))],check=True)
        before=lead_score(old,h);after=lead_score(new,h)
        row={'id':s['id'],'title':s['name']+' — Harmony Edition','character':s['who'],'bpm':s['bpm'],'seconds':round(t.seconds,1),'mode':s['mode'],
            'pre_revision':before,'post_revision':after,'midi_validation':verify,'audio_validation':audio_stats(audio),
            'files':{x:str(p.with_suffix('.'+x).relative_to(BASE)) for x in ('mp3','ogg','wav','mid')}}
        print(f"{s['name']}: {before['accented_non_chord_tones']}/{before['accented_notes']} -> {after['accented_non_chord_tones']}/{after['accented_notes']} non-chord accents | {verify['notes']} MIDI notes",flush=True)
        report.append(row)
    (BASE/'relatorio_analise.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (BASE/'LEIA_ME.txt').write_text('JOSPERD JUMP — OST V3 HARMONY EDITION\n\nRevisões das seis faixas originais preservando melodias e temas.\nCorreções musicais: dinâmica de notas, vozes dos acordes por programação dinâmica, notas fortes relacionadas com os acordes, ritmos das baterias alinhados em grade 1/16 com groove leve, baixo apontando para próxima fundamental, limpeza de camadas.\nFerramentas: mido, pretty_midi (validação MIDI), numpy e soundfile (síntese e WAV), ffmpeg (MP3 e OGG).\n\nNotas fora do acorde NEM SEMPRE são erradas: tensões jazzísticas e notas de passagem são intencionais. Comparar ouvindo!\n\nOs arquivos V2 continuam intocados na pasta original.\nA faixa Salto de Bolso continua reservada para título ou outro uso.\n\nRodar: python corrigir_ost_v3.py\n',encoding='utf-8')

if __name__=='__main__':main()
