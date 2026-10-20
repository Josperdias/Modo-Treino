#!/usr/bin/env python3
"""NEON STEP DX — laboratório de motivos clássicos em domínio público.
Transformações e arranjos autorais, sintetizados sem samples externos.
Requer: numpy, scipy, soundfile, pretty_midi, ffmpeg.
Colocar motor_original_v2.py junto ao script.
"""
from pathlib import Path
import json, math, subprocess, shutil, zipfile, base64, html, sys
import numpy as np
import soundfile as sf
import pretty_midi
sys.path.insert(0,str(Path(__file__).parent))
import motor_original_v2 as eng
ROOT=Path(__file__).parent

# Musicological source: motifs/traditional pitches only, never sound recordings or modern arrangements.
# (beat, MIDI_pitch) per 4/4 measure. A is an intentionally transformed/reaccented classical excerpt.
TRACKS=[
 dict(slug='josperd_joy_in_motion',who='Josperd',name='JOY IN MOTION',source='Beethoven — Sinfonia n.º 9 / Ode à Alegria',bpm=138,
  genre='Breakbeat funk / jazz arcade',mode='breaks',lead='synth',key=2,scale='major',
  chords=[(43,'maj9'),(43,'maj9'),(47,'min11'),(45,'dom13')],
  A=[[(0,78),(1,78),(2,79),(3,81)],[(0,81),(1,79),(2,78),(3,76)],[(0,74),(1,74),(2,76),(3,78)],[(0,78),(1,76),(2,76),(3.5,74)]],
  B=[[(0,74),(.5,76),(1,78),(2,81),(3,78)],[(0,79),(.5,81),(1.5,79),(2.5,76),(3.25,74)],[(0,76),(.5,78),(1.5,81),(2.5,78),(3.25,76)],[(0,73),(.75,76),(1.75,78),(2.5,76),(3.25,74)]]),
 dict(slug='camila_elise_sunlight',who='Camila',name='ELISE SUNLIGHT',source='Beethoven — Für Elise, WoO 59',bpm=126,
  genre='Future funk / jazz-house',mode='dance',lead='vibes',key=9,scale='minor',
  chords=[(45,'min9'),(41,'maj9'),(38,'min9'),(40,'dom7b9')],
  A=[[(0,76),(.5,75),(1,76),(1.5,75),(2,76),(2.5,71),(3,74),(3.5,72)],[(0,69),(.75,72),(1.5,76),(2.5,69),(3.25,71)],[(0,72),(.75,77),(1.5,76),(2.5,72),(3.25,69)],[(0,71),(.5,75),(1,76),(2,77),(3,76)]],
  chordsB=[(45,'min9'),(40,'dom7b9'),(38,'min9'),(40,'dom7b9')],
  B=[[(0,72),(.75,76),(1.5,79),(2.5,81),(3.25,79)],[(0,80),(.75,77),(1.5,76),(2.5,75),(3.25,76)],[(0,72),(.75,77),(1.5,79),(2.5,77),(3.25,72)],[(0,71),(.75,75),(1.5,76),(2.5,80),(3.25,76)]]),
 dict(slug='josperd_little_night_run',who='Josperd',name='LITTLE NIGHT RUN',source='Mozart — Eine kleine Nachtmusik, K.525',bpm=144,
  genre='Big beat / jazz-funk arcade',mode='breaks',lead='brass',key=7,scale='major',
  chords=[(43,'maj9'),(40,'min7'),(45,'min7'),(38,'dom7')],
  A=[[(0,79),(.75,74),(1.5,79),(2.5,74),(3.25,79)],[(0,74),(.75,79),(1.5,83),(2.5,86)],[(0,84),(.75,83),(1.5,81),(2.5,79),(3.25,76)],[(0,78),(.75,76),(1.5,74),(2.5,79)]],
  B=[[(0,74),(.5,79),(1.5,81),(2.25,83),(3.25,79)],[(0,76),(.75,79),(1.5,83),(2.5,79),(3.25,76)],[(0,81),(.5,84),(1.5,81),(2.5,79),(3.25,76)],[(0,78),(.75,81),(1.5,86),(2.5,81),(3.25,79)]]),
 dict(slug='camila_canon_bloom',who='Camila',name='CANON BLOOM',source='Pachelbel — Cânone em Ré (progressão harmônica)',bpm=128,
  genre='City pop / house / bossa eletrônica',mode='dance',lead='bell',key=2,scale='major',
  chords=[(38,'maj9'),(45,'dom7'),(47,'min7'),(42,'min7'),(43,'maj9'),(38,'maj9'),(43,'maj9'),(45,'dom7')],
  A=[[(0,78),(.75,81),(1.5,83),(2.5,81),(3.25,78)],[(0,76),(.75,78),(1.5,73),(2.5,71),(3.25,73)],[(0,74),(.75,78),(1.5,81),(2.5,78),(3.25,74)],[(0,73),(.75,76),(1.5,81),(2.5,80),(3.25,76)],[(0,79),(.75,83),(1.5,86),(2.5,81),(3.25,79)],[(0,81),(.75,78),(1.5,74),(2.5,78),(3.25,81)],[(0,83),(.75,79),(1.5,76),(2.5,74),(3.25,79)],[(0,76),(.75,73),(1.5,69),(2.5,73),(3.25,76)]],
  B=[[(0,81),(.75,78),(1.5,74),(2.5,78),(3.25,81)],[(0,76),(.75,73),(1.5,69),(2.5,73),(3.25,76)],[(0,78),(.75,74),(1.5,71),(2.5,74),(3.25,78)],[(0,73),(.75,76),(1.5,78),(2.5,76),(3.25,73)],[(0,83),(.75,79),(1.5,76),(2.5,79),(3.25,83)],[(0,78),(.75,81),(1.5,86),(2.5,81),(3.25,78)],[(0,79),(.75,83),(1.5,86),(2.5,83),(3.25,79)],[(0,76),(.75,73),(1.5,69),(2.5,73),(3.25,74)]])
]
INTERVALS={'maj9':[0,4,7,11,14],'min9':[0,3,7,10,14],'min7':[0,3,7,10],'dom7':[0,4,7,10],'dom13':[0,4,7,10,14,21],'min11':[0,3,7,10,14,17],'dom7b9':[0,4,7,10,13]}
MAJPCS={0,2,4,5,7,9,11};MINPCS={0,2,3,5,7,8,10}

def voices(chords):
  prev=None;out=[]
  for root,quality in chords:
    pcs={(root+i)%12 for i in INTERVALS[quality][1:]}
    options=[]
    for p in pcs:
      for n in range(54,73):
        if n%12==p: options.append(n)
    combos=[]
    for a in options:
      for b in options:
        if 3<=b-a<=9:
          for c in options:
            if 3<=c-b<=9 and len({a%12,b%12,c%12})==3: combos.append((a,b,c))
    if not combos:raise RuntimeError('voicing not found')
    v=min(combos,key=lambda x:sum((u-w)**2 for u,w in zip(x,prev)) if prev else sum((u-w)**2 for u,w in zip(x,(55,60,66))))
    out.append(v);prev=v
  return out

def counterpoint_fill(t,bar,lead_events,pcs,b,section):
  # No simultaneous second melody: put one short answer only AFTER melodic rests.
  if section=='B' and bar%4==3 and lead_events[-1][0] <3.25:
    n=min((x for x in range(68,85) if x%12 in pcs),key=lambda x:abs(x-(lead_events[-1][1]-3)))
    t.add('pluck' if t.data['patch'] not in ('pluck','bell') else 'vibes',n,b+3.67,.22,.10,pan=.25)

def build(data):
  bars=24;ch=data['chords'];nch=len(ch);vs=voices(ch);chB=data.get('chordsB',ch);vB=voices(chB);lead=data['lead']
  t=eng.Tune(dict(name=data['name'],id=data['slug'],who=data['who'],bpm=data['bpm'],bars=bars,mode=data['mode'],patch=lead))
  report={'nonchord_accent_beats':[],'melody_note_count':0,'root_notes':[],'chord_rhythm_collisions':0}
  for bar in range(bars):
    b=bar*4;seg='A' if bar<8 else 'B' if bar<16 else 'A2'
    active=chB if seg=='B' else ch;activevoices=vB if seg=='B' else vs
    root,quality=active[bar%len(active)];v=activevoices[bar%len(active)];rootpc=root%12;pcs={(root+i)%12 for i in INTERVALS[quality]}
    # Theme A and bridge B are repeated coherent multi-bar motifs, not generated independently for each bar.
    phrase=(data['B'] if seg=='B' else data['A'])[bar%(len(data['B'] if seg=='B' else data['A']))]
    # A2 retains motif, with a single ornament near the ending of every 4th measure.
    notes=list(phrase)
    if seg=='A2' and bar%4==2 and len(notes)>3:
      j=len(notes)-2
      note=notes[j][1]
      notes.insert(j,(max(notes[j-1][0]+.22,notes[j][0]-.22),note-2 if note-2>=69 else note+2))
    # Chord stabs are deliberately on the offbeats, leaving the motif fully in front.
    for i,bt in enumerate([.5,1.5,2.5] if data['mode']=='dance' else [.75,2.5]):
      for n in v:t.add('rhodes',n,b+bt,.27,.115 if i==0 else .105,pan=-.32)
    if bar%8==0:
      for n in v:t.add('pad',n,b+.04,1.6,.063,pan=.32)
    # Bass always follows the present chord. Approaches on last eighth lead into next root, not arbitrary chromatic notes.
    nextroot=active[(bar+1)%len(active)][0]
    basspat=[(0,root,.44),(.75,root+12,.21),(1.5,root+7,.27),(2.5,root,.38),(3.5,nextroot-1 if (nextroot-1)%12 in MAJPCS else nextroot,.23)] if data['mode']=='breaks' else [(0,root,.42),(1,root+12,.24),(2,root+7,.30),(3.25,nextroot,.21)]
    for pos,n,dur in basspat:t.add('bass',n,b+pos,dur,.35 if pos==0 else .23,pan=0)
    for j,(pos,n) in enumerate(notes):
      gap=(notes[j+1][0]-pos) if j+1<len(notes) else 4-pos
      duration=max(.16,min(.65,gap-.09))
      vol=.34 if pos in (0,2) else .30
      if j>0 and abs(n-notes[j-1][1])>=8:vol*=.86
      t.add(lead,n,b+pos,duration,vol,pan=.19)
      report['melody_note_count']+=1
      if pos in (0,2) and n%12 not in pcs:report['nonchord_accent_beats'].append((bar+1,pos,n))
    counterpoint_fill(t,bar,notes,pcs,b,seg)
    # A repeating groove built around the same snare backbeat; texture sections change by velocity and hats.
    kicks=([0,.75,1.5,2.5,3.25] if data['mode']=='breaks' else [0,1,2,3])
    for i,bt in enumerate(kicks):t.hit('kick',b+bt,.75 if i==0 else .56)
    for bt in (1,3):t.hit('snare',b+bt,.77)
    for i in range(8 if data['mode']=='dance' else 16):
      bt=4*i/(8 if data['mode']=='dance' else 16)
      t.hit('hat' if not (bar%4==3 and i==(7 if data['mode']=='dance' else 15)) else 'open',b+bt,.12 if i%2 else .17,pan=-.21 if i%2 else .21)
    if bar%8==0:t.hit('crash',b,.15)
    if bar%8==7:
      for bt in [3.48,3.72,3.86]:t.hit('ghost',b+bt,.14)
  return t,report

def write_midi(t,out):
  pm=pretty_midi.PrettyMIDI(initial_tempo=t.bpm,resolution=480)
  programs={'bass':38,'rhodes':4,'vibes':11,'clav':7,'synth':80,'brass':61,'organ':16,'pad':89,'bell':10,'pluck':12,'guitar':26}
  patches=sorted(set(n[0] for n in t.notes))
  for patch in patches:
    inst=pretty_midi.Instrument(program=programs[patch],name=patch)
    for p,n,b,d,v,pan in t.notes:
      if p==patch:
        start=b*60/t.bpm
        inst.notes.append(pretty_midi.Note(pitch=int(n),velocity=max(15,min(127,round(v*120))),start=start,end=(b+d)*60/t.bpm))
    pm.instruments.append(inst)
  inst=pretty_midi.Instrument(program=0,is_drum=True,name='drums')
  dm={'kick':36,'snare':38,'ghost':37,'hat':42,'open':46,'shake':70,'crash':49,'rim':37}
  for p,b,v,pan in t.drums:
    start=b*60/t.bpm
    inst.notes.append(pretty_midi.Note(pitch=dm[p],velocity=max(8,min(125,round(v*116))),start=start,end=start+.06))
  pm.instruments.append(inst);pm.write(str(out))
  reread=pretty_midi.PrettyMIDI(str(out))
  assert sum(x.is_drum for x in reread.instruments)==1
  assert all(n.end>n.start for ins in reread.instruments for n in ins.notes)


def main():
  report=[]
  for data in TRACKS:
    t,qa=build(data)
    stem=ROOT/data['slug'];write_midi(t,stem.with_suffix('.mid'))
    sound=eng.render(t)
    assert np.isfinite(sound).all()
    sf.write(stem.with_suffix('.wav'),sound,eng.SR,subtype='PCM_16')
    for extension,formatargs in [('mp3',['-c:a','libmp3lame','-b:a','160k']),('ogg',['-c:a','libvorbis','-qscale:a','4'])]:
      subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(stem.with_suffix('.wav')),*formatargs,str(stem.with_suffix('.'+extension))],check=True)
    row={k:data[k] for k in ['name','slug','who','source','bpm','genre']};row['duration_seconds']=round(t.seconds,2);row['qa']=qa
    report.append(row)
    print('OK',data['name'],t.seconds,'seconds',len(t.notes),'note events',qa['nonchord_accent_beats'],flush=True)
  (ROOT/'relatorio.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
  (ROOT/'LEIA_ME.txt').write_text('NEON STEP DX — LABORATÓRIO DE MELODIAS CLÁSSICAS\n\n4 FAIXAS EXPERIMENTAIS. Não substituem a OST existente.\n\nJoy in Motion — fragmento melódico de Ode à Alegria (Beethoven).\nElise Sunlight — células cromáticas de Für Elise (Beethoven).\nLittle Night Run — motivos de Eine kleine Nachtmusik (Mozart).\nCanon Bloom — progressão de acordes de Cânone em Ré (Pachelbel), nova melodia.\n\nTodas as produções eletrônicas, baterias, linhas de baixo, harmonizações e gravações são feitas por código, sem copiar áudio, fonogramas ou arranjos contemporâneos. São ADAPTAÇÕES/DERIVAÇÕES de fontes musicais em domínio público, não composições inteiramente originais.\n\nRoteiro: o tema melódico guia a harmonia; acordes tocados nos contratempos; baixo segue raízes/fundamentais; frases A/B/A2. Não confundir testes automáticos com avaliação estética auditiva.\n',encoding='utf-8')
  # Four embedded full songs: HTML player works standalone offline.
  blocks=[]
  colors=['#fa42bd','#ffc63d','#a86cff','#61f0ef']
  for i,d in enumerate(TRACKS):
    mp3=(ROOT/(d['slug']+'.mp3')).read_bytes(); src=base64.b64encode(mp3).decode()
    blocks.append(f'''<article class="track"><div class="number" style="background:{colors[i]}">{i+1:02d}</div><div class="meta"><span class="tag">{d['who'].upper()} · {d['bpm']} BPM</span><h2>{html.escape(d['name'])}</h2><p>{html.escape(d['genre'])}</p><small>Motivo: {html.escape(d['source'])}</small></div><audio controls preload="none" src="data:audio/mpeg;base64,{src}"></audio></article>''')
  doc='''<!doctype html><html lang="pt-br"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>NEON STEP DX — Melodias Clássicas</title><style>body{margin:0;color:#f7ecff;background:radial-gradient(circle at top,#26113e,#070616 70%);font:15px system-ui,-apple-system,sans-serif;}main{max-width:780px;margin:auto;padding:27px 18px 55px;}h1{font-size:clamp(30px,6vw,55px);margin:10px 0;line-height:1.05;color:#fff;text-shadow:4px 4px #b4108c;}header>p{color:#afacc9;max-width:620px;line-height:1.5}.k{letter-spacing:.15em;color:#42ecff;font-size:12px;font-weight:800}.track{background:#1c1935;border:1px solid #4d3c76;display:flex;align-items:center;gap:15px;flex-wrap:wrap;padding:17px;border-radius:17px;margin:18px 0;box-shadow:0 9px 30px #0005}.number{width:55px;height:55px;display:grid;place-items:center;border-radius:12px;font-size:23px;font-weight:1000;color:#121124}.meta{flex:1;min-width:180px}.meta h2{margin:5px 0;font-size:21px}.meta p{margin:0 0 5px;color:#e2caed}.meta small{color:#9895b7}.tag{color:#60e3fd;font-size:11px;font-weight:800;letter-spacing:.1em}audio{width:100%;height:41px;filter:invert(.92) hue-rotate(170deg)}footer{color:#aba2bd;line-height:1.55;font-size:13px;border-top:1px solid #494161;padding-top:17px;margin-top:35px}b{color:#fff}</style><main><header><div class="k">JOSPERD JUMP · EXPERIMENTO V7</div><h1>CLASSICAL<br>REMIX LAB<span style="color:#ff42ad">.</span></h1><p>Quatro testes de harmonização: motivos clássicos, arranjos novos e temas realmente conectados aos acordes. Ouça e escolha a direção para a OST.</p></header>'''+'\n'.join(blocks)+'''<footer><b>Experimento musical, não substitui a trilha oficial.</b> Motivos de obras em domínio público, reinterpretados; nenhum fonograma de terceiros foi utilizado. Cada tema tem versões MIDI e OGG para edição e integração posterior. Interrompa uma faixa antes de tocar outra.</footer></main></html>'''
  (ROOT/'OUVIR_CLASSICAL_REMIX_LAB.html').write_text(doc,encoding='utf-8')
  with zipfile.ZipFile(ROOT/'NEON_STEP_DX_CLASSICAL_REMIX_LAB.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for file in ROOT.iterdir():
      if file.suffix in ('.mp3','.ogg','.mid','.py','.txt','.json','.html'):z.write(file,file.name)
  print('COMPLETE',flush=True)
if __name__=='__main__':main()
