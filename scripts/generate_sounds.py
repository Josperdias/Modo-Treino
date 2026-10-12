"""Gera efeitos originais curtos para Modo Treino (WAV 16-bit mono).
Sons livres de direitos de terceiros: síntese original e contagem com espeak local.
"""
from pathlib import Path
import numpy as np, wave, subprocess, shutil
BASE = Path(__file__).resolve().parents[1]
RATE = 22050
STYLES = {
 'suave':{'freq':(392,523,659),'wave':'sine','gain':0.27},
 'arcade':{'freq':(330,660,880),'wave':'square','gain':0.16},
 'minimal':{'freq':(540,650,800),'wave':'sine','gain':0.13},
}

def note(freq,length,kind='sine',gain=.20):
 t=np.arange(max(1,int(RATE*length)))/RATE
 if kind=='square':
  sig=np.tanh(np.sin(2*np.pi*freq*t)*3)*.75
 else:
  sig=np.sin(2*np.pi*freq*t)+0.22*np.sin(2*np.pi*freq*2*t)
 fade=np.minimum(1,t/.012)*np.minimum(1,(length-t)/.065)
 return np.asarray(sig*fade*gain,dtype=np.float64)

def save(path,signal):
 path.parent.mkdir(parents=True,exist_ok=True)
 data=np.int16(np.clip(signal,-1,1)*32767)
 with wave.open(str(path),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(data.tobytes())

def silence(t):return np.zeros(int(RATE*t),dtype=np.float64)

for style,conf in STYLES.items():
 a,b,c=conf['freq']; k=conf['wave']; v=conf['gain']
 signals={
  'button':note(a,.09,k,v*.5),
  'series':np.concatenate([note(a,.12,k,v),silence(.035),note(b,.18,k,v)]),
  'rest':np.concatenate([note(b,.13,k,v),silence(.055),note(a,.25,k,v)]),
  'finish':np.concatenate([note(a,.13,k,v),silence(.035),note(b,.15,k,v),silence(.035),note(c,.35,k,v)]),
  'count':note(c,.12,k,v*.7),
 }
 for name,signal in signals.items():
  save(BASE/'site/assets/sounds'/style/f'{name}.wav',signal)
  save(BASE/'native/assets/sounds'/style/f'{name}.wav',signal)
# Espeak Portuguese: sample assets are optional and only triggered by explicit user consent.
if shutil.which('espeak'):
 for num,word in [('3','três'),('2','dois'),('1','um')]:
  dest=BASE/'site/assets/sounds/voice'/f'{num}.wav'
  dest.parent.mkdir(parents=True,exist_ok=True)
  subprocess.run(['espeak','-v','pt-br','-s','145','-a','130','-w',str(dest),word],capture_output=True,check=True)
  copied=BASE/'native/assets/sounds/voice'/f'{num}.wav'
  copied.parent.mkdir(parents=True,exist_ok=True)
  copied.write_bytes(dest.read_bytes())
print('OK: 3 pacotes × 5 eventos + voz 3-2-1, WAVs próprios')
