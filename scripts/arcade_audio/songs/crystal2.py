"""Vitral — minimalismo de vidro em 7/8, 112 bpm, dó lídio. Duas vozes de vidro tocam ciclos de tamanhos diferentes (14 e 12 passos) e se afastam e
se reencontram a cada 6 compassos (música de fase); harmônica de vidro e pads respiram por baixo, sub longo, brilhos de gelo estalando e um prisma
(eco que ricocheteia de um lado para o outro). Sem bateria: só um tique fino. Forma (48 compassos, ~1:30): uma voz 8 · +pad 8 · +fase 8 · +brilhos 8 · cheio 8 · desfaz 8."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony, midi_of
import tape as TP
import inst2 as I2
from songs.common import aux_default

SPB = 14
H = Harmony("Cmaj9 D6 Cmaj9 D6 Em7 D6 Fmaj7 G6", SPB)
A_PAT = [(0, 'e5'), (2, 'g5'), (3, 'a5'), (5, 'd6'), (7, 'e6'), (9, 'd6'), (10, 'a5'), (12, 'g5')]       # ciclo de 14
B_PAT = [(0, 'c6'), (2, 'e6'), (4, 'g5'), (6, 'a5'), (8, 'd6'), (10, 'e5')]                               # ciclo de 12
M_L = parse("""
e6 - - - - - - - - - - - - - |
g6 - - - - - - - d6 - - - - - |
e6 - - - - - - - . . . . . . |
a6 - - - - - - - f#6 - - - - - |
b6 - - - - - - - g6 - - - - - |
f#6 - - - - - - - d6 - - - - - |
a6 - - - - - - - c7 - - - - - |
b6 - - - - - - - - - - - - - |
""", SPB)


def cycle(sg, bus, pat, period, bar0, bars, gain, pan, kind, tilt, vel=0.8, shift_semi=0):
    """Repete `pat` a cada `period` passos de bar0*SPB até bar0+bars."""
    a, b = bar0 * SPB, (bar0 + bars) * SPB
    st = a
    while st < b:
        for (o, n) in pat:
            if st + o < b:
                sg.note(bus, K.i_modal, st + o, midi_of(n) + shift_semi, 2, gain=gain, pan=pan, kind=kind, tilt=tilt, vel=vel)
        st += period


def build():
    sg = K.Song(112, 48, spb=SPB, tail=5.0, seed=64, name='crystal2')
    rng = sg.rng
    # entradas: voz A 0–48 (sai no fim), pads 8, fase B 16, brilhos 24, melodia 32, saída 40
    cycle(sg, 'glassA', A_PAT, 14, 0, 44, 0.9, -0.35, 'glass', 1.1)
    cycle(sg, 'glassB', B_PAT, 12, 16, 28, 0.8, 0.35, 'glass', 1.0, vel=0.7)
    cycle(sg, 'glassB', B_PAT, 12, 32, 12, 0.5, 0.0, 'bell', 0.8, vel=0.6, shift_semi=12)
    # pads de harmônica de vidro e sub
    for bar0, bars in ((8, 40),):
        for rep in range(bars // 8):
            sg.pads('pad', K.i_modal, H, bar0 + rep * 8, 52, 72, gain=0.6, kind='glass', tilt=4.5)
    sg.pads('pad2', K.i_pad, H, 16, 48, 70, gain=0.4, cutoff=900, a=1.2, r=1.5)
    sg.pads('pad2', K.i_pad, H, 24, 48, 70, gain=0.45, cutoff=1000, a=1.2, r=1.5)
    sg.pads('pad2', K.i_pad, H, 32, 48, 70, gain=0.5, cutoff=1100, a=1.2, r=1.5)
    sg.pads('pad2', K.i_pad, H, 40, 48, 70, gain=0.4, cutoff=900, a=1.2, r=2.0)
    for bar0 in (16, 24, 32, 40):
        sg.bass('bass', I2.i_sub, H, bar0, 'R - - - - - - - - - - - - -', octave=36, gain=0.7)
    # brilhos de gelo: estalos agudos ao acaso + sinos finos
    for st in range(24 * SPB, 44 * SPB):
        if rng.random() < 0.09:
            sg.note('ice', I2.i_chime, st, int(rng.choice([88, 91, 93, 95, 98])), 1, gain=float(rng.uniform(0.3, 0.7)), pan=float(rng.uniform(-0.9, 0.9)), tilt=0.4)
        if rng.random() < 0.05:
            sg.sample('ice', S.hp(rng.standard_normal(int(0.02 * SR)), 5000) * np.exp(-S.tt(int(0.02 * SR)) / 0.004) * 0.7, st, 0.35, pan=float(rng.uniform(-0.8, 0.8)))
    # melodia: vibrafone/vidro longo no trecho cheio (32–40)
    sg.line('lead', K.i_modal, M_L, 32, gain=0.7, kind='glass', tilt=3.0)
    # tique fino (a partir da fase) e crescimento de cristal (riser) antes de cada entrada
    for bar in range(16, 44):
        for st in (0, 4, 7, 11):
            sg.sample('tick', S.wood(3100, int(0.03 * SR), 0.006) * 0.25, bar * SPB + st, 0.4, pan=0.0)
    for bar in (8, 16, 24, 32):
        sg.sample('fx', S.riser(rng, int(2 * SPB * sg.step_s * SR), 600, 9000, 0.12, 900) * 0.5, (bar - 2) * SPB, 0.5)
    sg.sample('fx', S.crash(rng, None, 1.8) * 0.3, 32 * SPB, 0.4)
    sg.duck(['pad', 'pad2'], 0.15, 0.3, steps=[b * SPB for b in range(48)])
    sg.trim = {'glassA': -3.4, 'glassB': -0.9, 'pad': -1.3, 'pad2': 8.0, 'bass': -8.3, 'ice': 8.1, 'lead': 8.4, 'tick': 18.7, 'fx': 4.0}
    fx = {
        'glassA': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.85)],
        'glassB': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.85)],
        'pad': [Chorus(rate_hz=0.2, depth=0.3, mix=0.4), Reverb(room_size=0.9, wet_level=0.45, dry_level=0.6)],
        'pad2': [Reverb(room_size=0.9, wet_level=0.4, dry_level=0.7)],
        'ice': [Reverb(room_size=0.8, wet_level=0.4, dry_level=0.7)],
        'lead': [Reverb(room_size=0.8, wet_level=0.35, dry_level=0.8)],
        'bass': [LowpassFilter(300)],
    }
    sg.sends = {'glassA': {'echo': 0.35}, 'glassB': {'echo': 0.35}, 'lead': {'echo': 0.4}, 'ice': {'echo': 0.3}, 'fx': {'verb': 0.3}}
    aux = aux_default(112, room=0.88, delay_fb=0.5, delay_beats=0.75)
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(8), wow=0.0008, flutter=0.0002, wow_hz=0.2))
    return sg, fx, aux
