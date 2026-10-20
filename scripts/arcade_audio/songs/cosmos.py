"""Cosmos — 84 bpm, dó lídio que sobe um tom (ré lídio) no último terço. Vibrafone e sinos em arpejos de 5 notas, coro de formantes,
escada de Shepard subindo, pulsar de seno (ciclo de 7 passos contra compasso de 16), rádio-estática. Quase sem bateria.
Forma (32 compassos, ~1:31): céu 4 · A 8 · B 8 · C (+2 tons) 8 · volta 4."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import aux_default

A_L = parse("""
g5 . . . e6 . . . d6 . b5 . g5 - - - |
a5 . . . f#6 . . . e6 . d6 . a5 - - - |
b5 . . . g6 . . . f#6 . e6 . b5 - - - |
a5 . . . d6 . f#6 . a6 - - - . . . . |
e6 . . . g6 . . . b6 . a6 . g6 - - - |
f#6 . . . a6 . . . d6 - - - f#6 - - - |
d6 . . . f#6 . . . b6 - - - a6 - - - |
g6 . . . e6 . . . b5 . d6 . e6 - - - |
""", 16)
B_L = parse("""
c6 - - - - - - - e6 - - - - - - - |
b5 - - - - - - - g6 - - - - - - - |
a5 - - - c6 - - - f6 - - - e6 - - - |
d6 - - - g6 - - - b5 - - - d6 - - - |
e6 - - - c6 - - - a5 - - - c6 - - - |
f#6 - - - a6 - - - d6 - - - a5 - - - |
g6 - - - e6 - - - c6 - - - e6 - - - |
a6 - - - f#6 - - - d6 - - - a5 - - - |
""", 16)
C_L = parse("""
a5 . d6 . f#6 . a6 . f#6 . d6 . a5 - - - |
c#6 . f#6 . a6 . f#6 . c#6 . a5 . f#5 - - - |
b5 . e6 . g6 . b6 . g6 . e6 . b5 - - - |
d6 . g6 . b6 . g6 . d6 . b5 . g5 - - - |
c#6 . f#6 . a6 . f#6 . e6 . c#6 . a5 - - - |
e6 . a6 . c#6 . f#6 . a6 . e6 . c#6 - - - |
d6 . f#6 . g#6 . b6 . f#6 . d6 . b5 - - - |
e6 . a6 . c#6 . e6 . a5 . c#6 . e6 - - - |
""", 16)
OUT_L = parse("""
d6 . . . f#6 . . . b5 - - - a5 - - - |
e6 . . . b5 . . . g5 - - - b5 - - - |
f6 . . . d6 . . . a5 - - - c6 - - - |
d6 . c6 . g5 - - - b5 . d6 . f6 - - - |
""", 16)

H_SKY = Harmony("Cmaj7 Cmaj7 D D")
H_A = Harmony("Cmaj7 D Em7 D Cmaj7 D Bm7 Em7")
H_B = Harmony("Am7 Em7 Fmaj7 G Am7 D Cmaj7 D")
H_C = Harmony("Dmaj7 Dmaj7 Em7 Em7 F#m7 F#m7 G#m7b5 A")
H_O = Harmony("Bm7 Em7 Dm7 G7sus4_G7")

VOW = ['a', 'o', 'u', 'o']


def build():
    spb = 16
    sg = K.Song(84, 32, spb=16, tail=5.0, seed=51, name='cosmos')
    rng = sg.rng
    iS, iA, iB, iC, iO = 0, 4, 12, 20, 28
    # --- Shepard subindo a faixa toda (mais rápido na volta, acelera para o laço)
    n = int(32 * spb * sg.step_s * SR)
    rate = np.concatenate([np.full(int(n * 0.85), 0.045), np.linspace(0.045, 0.18, n - int(n * 0.85))])
    t = np.arange(n) / SR
    f0 = 65.4
    pos = np.cumsum(rate) / SR
    pos = pos * (max(1, round(pos[-1])) / pos[-1])  # volta ao mesmo espectro no fim do laço
    voices = 8
    y = np.zeros(n)
    for k in range(voices):
        o = (pos + k) % voices
        f = f0 * 2.0 ** o
        loud = np.exp(-0.5 * ((o - voices / 2) / (voices * 0.18)) ** 2) * np.clip((0.4 * SR - f) / (0.08 * SR), 0, 1)
        y += loud * np.sin(2 * np.pi * np.cumsum(f) / SR)
    y = y / voices * 1.6
    sg.put('shep', y * 0.5, 0.0, 0.8)
    # --- coro de formantes e pads
    for h, bar, g in ((H_SKY, iS, 0.5), (H_A, iA, 0.5), (H_B, iB, 0.6), (H_C, iC, 0.65), (H_O, iO, 0.5)):
        sg.pads('pad', K.i_pad, h, bar, 48, 72, gain=g, cutoff=1500, a=1.2, r=1.6)
        k = 0
        prev = None
        for (st, ln, pc, q) in h.events():
            v = K.voice(prev, pc, q, 55, 79, 3)
            prev = v
            for j, m in enumerate(v):
                sg.note('choir', K.i_choir, bar * spb + st, m, ln, gain=0.32 / len(v) ** 0.5, pan=(j - 1) * 0.35, vowel=VOW[(k + j) % 4], a=0.6, r=1.2, vel=0.7)
            k += 1
    for h, bar in ((H_SKY, iS), (H_A, iA), (H_B, iB), (H_C, iC), (H_O, iO)):
        sg.bass('bass', K.i_tri, h, bar, 'R - - - - - - - - - - - - - - -', octave=34, gain=0.9, bits=6)
    # --- arpejos de vibrafone (5 notas) — padrão deslocado a cada compasso (fase de Reich lenta)
    for h, bar, g in ((H_A, iA, 0.5), (H_B, iB, 0.45), (H_C, iC, 0.6), (H_O, iO, 0.45)):
        sg.arp('arp', K.i_modal, h, bar, '0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .', lo=60, gain=g, pan=0.5, kind='vibes', tilt=1.0)
        sg.arp('arp2', K.i_modal, h, bar, '. 2 . 3 . 4 . 3 . 2 . 1 . 0 . 1', lo=60, gain=g * 0.7, pan=-0.5, kind='glass', tilt=0.8)
    # --- melodias
    sg.line('lead', K.i_modal, A_L, iA, gain=0.85, kind='vibes', tilt=2.0)
    sg.line('lead', K.i_modal, B_L, iB, gain=0.8, kind='bell', tilt=1.8)
    sg.line('lead', K.i_choir, shift(B_L, 0, -12, 0.7), iB, gain=0.35, vowel='o', a=0.4, r=0.8)
    sg.line('lead', K.i_modal, C_L, iC, gain=0.85, kind='vibes', tilt=1.8)
    sg.line('lead', K.i_modal, shift(C_L, 0, 12, 0.5), iC, gain=0.3, kind='glass', tilt=1.4, pan=-0.3)
    sg.line('lead', K.i_modal, OUT_L, iO, gain=0.75, kind='bell', tilt=2.0)
    # --- pulsar: seno agudo a cada 7 passos (contra compasso de 16); entra a partir do B
    for st in range(iB * spb, (iO + 4) * spb):
        if (st - iB * spb) % 7 == 0:
            pulse = S.sine(np.full(int(0.06 * SR), 1760.0), int(0.06 * SR)) * S.env_exp(int(0.06 * SR), 0.015)
            sg.sample('pulsar', pulse * 0.4, st, 0.5, pan=0.0)
    # --- bateria mínima: batida de coração (seno) a partir do B
    kit = K.kit_soft
    sg.drums(kit, iB, 8, {'k': 'x.......x.......', 'sh': '....x.......x...'}, gain=0.55)
    sg.drums(kit, iC, 8, {'k': 'x.......x.....x.', 's': '........x.......', 'sh': 'x.x.x.x.x.x.x.x.'}, gain=0.65)
    sg.drums(kit, iO, 4, {'k': 'x.......x.......'}, gain=0.5)
    # --- estática de rádio: rajadas filtradas em lugares fixos (a fita da transmissão)
    for bar, st in ((6, 4), (11, 10), (17, 2), (19, 12), (26, 6), (29, 14)):
        L = int(0.35 * SR)
        nz = S.bp(rng.standard_normal(L), 1200, 5200, 1) * np.sin(np.linspace(0, np.pi, L)) ** 2 * 0.35
        sg.sample('fx', nz, bar * spb + st, 0.35, pan=float(rng.uniform(-0.6, 0.6)))
    # subida de tom (C → D): riser + tape_start curto no 1º compasso da seção C
    sg.sample('fx', S.riser(rng, int(2 * spb * sg.step_s * SR), 300, 9000, 0.3, 392), (iC - 2) * spb, 0.7)
    sg.sample('fx', S.crash(rng, None, 1.6) * 0.5, iC * spb, 0.5)
    sg.sample('fx', S.riser(rng, int(2 * spb * sg.step_s * SR), 300, 9000, 0.3, 330), (iO + 2) * spb, 0.7)
    sg.duck(['pad', 'choir'], 0.25, 0.3)
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(9), wow=0.0007, flutter=0.0003))
    fx = {
        'shep': [Reverb(room_size=0.9, wet_level=0.35, dry_level=0.7)],
        'pad': [Chorus(rate_hz=0.25, depth=0.3, mix=0.4), Reverb(room_size=0.85, wet_level=0.35, dry_level=0.7)],
        'choir': [Reverb(room_size=0.9, wet_level=0.4, dry_level=0.6)],
        'arp': [Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'arp2': [Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'lead': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.85)],
        'pulsar': [Reverb(room_size=0.8, wet_level=0.35, dry_level=0.7)],
    }
    sg.sends = {'lead': {'echo': 0.3, 'verb': 0.25}, 'arp': {'echo': 0.25}, 'fx': {'verb': 0.4}}
    return sg, fx, aux_default(84, room=0.92, delay_fb=0.45, delay_beats=1.5)
