"""Fundo do Mar — 6/8 (barcarola), 92 bpm, mi menor. Bolhas de Minnaert fazem de ornamento e de chimbal, marimba e piano FM em ondas,
baleia (formante deslizando), sonar com reverb longo, toms macios. A fita 'debaixo d'água': wow forte e agudos cortados.
Forma (48 compassos de 6/8, ~1:34): superfície 4 · A 8 · A+ritmo 8 · B 8 · ponte (baleia) 8 · A final 8 · volta 4."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, Delay
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import aux_default, loader_in_gap

SPB = 12
A_L = parse("""
e5 . g5 . b5 . g5 . e5 - - - |
e5 . g5 . c6 . g5 . e5 - - - |
d5 . g5 . b5 . d6 . b5 - - - |
a5 . f#5 . a5 . d6 . a5 - - - |
g5 . b5 . e6 . d6 . b5 - - - |
g5 . c6 . e6 . d6 . c6 - - - |
a5 . c6 . e6 . g6 . e6 - - - |
d#6 . f#6 . b5 . a5 . f#5 - - - |
""", SPB)
B_L = parse("""
g5 - - e6 - - d6 - - c6 - - |
b5 - - d6 - - g6 - - d6 - - |
a5 - - d6 - - f#6 - - d6 - - |
g5 - - b5 - - e6 - - b5 - - |
g5 - - e6 - - c6 - - e6 - - |
b5 - - g6 - - d6 - - b5 - - |
e6 - c6 - a5 - d#6 - f#6 - b5 - |
g5 - - b5 - - e6 - - - - - |
""", SPB)
C_L = parse("""
b5 . e6 . g6 . e6 . b5 - - - |
a5 . d6 . f#6 . d6 . a5 - - - |
g5 . c6 . e6 . c6 . g5 - - - |
g5 . b5 . d6 . b5 . g5 - - - |
b5 . e6 . g6 . e6 . b5 - - - |
a5 . d6 . f#6 . d6 . a5 - - - |
c6 . e6 . a5 - e6 . f#6 . b5 - |
d#6 . f#6 . b5 . a5 . f#5 - - - |
""", SPB)
OUT_L = parse("""
e5 . . . g5 . . . b5 - - - |
e5 . . . g5 . . . c6 - - - |
d5 . . . g5 . . . b5 - - - |
b4 . . . d#5 . . . f#5 - - - |
""", SPB)

H_A = Harmony("Em C G D Em C Am7 B7", SPB)
H_B = Harmony("C G D Em C G Am7_B7 Em", SPB)
H_C = Harmony("Cmaj7 Bm7 Am7 G Cmaj7 Bm7 Am7_B7sus4 B7", SPB)
H_S = Harmony("Em Em C B7", SPB)

E_MINOR_PENT = ['e5', 'g5', 'a5', 'b5', 'd6', 'e6', 'g6']


def whale(sg, bar, step, f_from, f_to, dur_s, gain=0.5, pan=0.0):
    n = int(dur_s * SR)
    f = S.sweep(f_from, f_to, n)
    f = f * (1 + 0.01 * np.sin(2 * np.pi * 0.7 * np.arange(n) / SR))
    y = S.formant(f, n, 'o', sg.rng, breath=0.01)
    y *= np.sin(np.pi * np.linspace(0, 1, n)) ** 1.3
    sg.sample('whale', y * 0.8, bar * SPB + step, gain, pan)


def sonar(sg, bar, step, gain=0.35, pan=0.0):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 1320 * t) * np.exp(-t / 0.18) * np.minimum(1, t / 0.004)
    sg.sample('sonar', y, bar * SPB + step, gain, pan)


def build():
    sg = K.Song(92, 48, spb=SPB, tail=5.0, seed=61, name='ocean')
    rng = sg.rng
    iS, iA, iA2, iB, iC, iA3, iO = 0, 4, 12, 20, 28, 36, 44
    # --- bolhas de Minnaert: ornamentos espalhados (determinístico, pentatônica de mi) e 'chimbal' de bolhinhas
    def bubbles(bar0, bars, dens, lo=0, hi=7, gain=0.4):
        for st in range(bar0 * SPB, (bar0 + bars) * SPB):
            if rng.random() < dens:
                n = E_MINOR_PENT[int(rng.integers(lo, hi))]
                sg.note('bub', K.i_bub, st, K.midi_of(n) + 12 * int(rng.integers(0, 2)), 2, gain=gain * float(rng.uniform(0.5, 1.0)), pan=float(rng.uniform(-0.8, 0.8)),
                        rise=float(rng.uniform(0.15, 0.3)), tau=float(rng.uniform(0.04, 0.09)))
    bubbles(iS, 4, 0.12)
    bubbles(iA, 8, 0.07)
    bubbles(iA2, 8, 0.12)
    bubbles(iB, 8, 0.08)
    bubbles(iC, 8, 0.2, gain=0.35)
    bubbles(iA3, 8, 0.12)
    bubbles(iO, 4, 0.2, 0, 4)
    # --- harmonia
    for h, bar, g in ((H_S, iS, 0.4), (H_A, iA, 0.45), (H_A, iA2, 0.5), (H_B, iB, 0.55), (H_C, iC, 0.5), (H_A, iA3, 0.55)):
        sg.pads('pad', K.i_pad, h, bar, 46, 70, gain=g, cutoff=900, a=0.6, r=0.8)
    sg.pads('pad', K.i_pad, Harmony("Em Em C B7", SPB), iO, 46, 70, gain=0.45, cutoff=800)
    # baixo: tuba de ondas (6/8: raiz no 1, quinta no 4) e piano em ondas (arpejo ondulante)
    BW = 'R . . . . . 5 . . . . .'
    BWB = 'R . . . 5 . R . . . o .'
    for h, bar, pat in ((H_A, iA, BW), (H_A, iA2, BWB), (H_B, iB, BWB), (H_C, iC, BW), (H_A, iA3, BWB)):
        sg.bass('bass', K.i_fmbass, h, bar, pat, octave=36, gain=0.85, tau=0.35, index=1.4)
    sg.bass('bass', K.i_tri, H_S, iS, 'R - - - - - - - - - - -', octave=36, gain=0.7)
    sg.bass('bass', K.i_tri, Harmony("Em Em C B7", SPB), iO, 'R - - - - - - - - - - -', octave=36, gain=0.7)
    WAVE = '0 . 1 . 2 . 3 . 2 . 1 .'
    for h, bar, g in ((H_A, iA2, 0.45), (H_B, iB, 0.5), (H_C, iC, 0.55), (H_A, iA3, 0.5)):
        sg.arp('arp', K.i_modal, h, bar, WAVE, lo=55, gain=g, pan=-0.45, kind='marimba', tilt=1.1, step_len=2)
    # --- melodias
    sg.line('lead', K.i_fmep, A_L, iA, gain=0.8, tau=1.0, bright=0.9)
    sg.line('lead', K.i_fmep, A_L, iA2, gain=0.8, tau=1.0, bright=0.9)
    sg.line('lead', K.i_modal, shift(A_L, 3, 12, 0.5), iA2, gain=0.3, kind='vibes', tilt=1.0, pan=0.4)
    sg.line('lead', K.i_modal, B_L, iB, gain=0.8, kind='marimba', tilt=1.8)
    sg.line('lead', K.i_fmep, B_L, iB, gain=0.55, tau=1.2, pan=0.3)
    sg.line('lead', K.i_fmep, C_L, iC, gain=0.8, tau=1.2)
    sg.line('lead', K.i_modal, shift(C_L, 0, 12, 0.5), iC, gain=0.3, kind='glass', tilt=1.0, pan=-0.4)
    sg.line('lead', K.i_fmep, A_L, iA3, gain=0.8, tau=1.0)
    sg.line('lead', K.i_modal, shift(A_L, 0, 12, 0.5), iA3, gain=0.35, kind='vibes', pan=0.3)
    sg.line('lead', K.i_modal, OUT_L, iO, gain=0.7, kind='bell', tilt=2.0)
    # --- baleia, sonar
    whale(sg, iC, 0, 196.0, 294.0, 5.5, gain=0.45, pan=-0.3)
    whale(sg, iC + 4, 4, 330.0, 196.0, 6.0, gain=0.45, pan=0.3)
    whale(sg, iS, 4, 147.0, 220.0, 5.0, gain=0.35, pan=0.0)
    for bar, st, pan in ((1, 0, -0.5), (6, 6, 0.5), (14, 0, -0.4), (22, 6, 0.4), (30, 0, -0.5), (38, 6, 0.4), (45, 0, 0.0)):
        sonar(sg, bar, st, 0.3, pan)
    # --- toms macios (6/8) e chiado de ondas
    kit = K.kit_soft
    D_A2 = {'k': 'x.....x.....', 'sh': '..x...x...x.'}
    D_B = {'k': 'x.....x.....', 't1': '........x...', 't2': '.....x......', 'sh': 'x.x.x.x.x.x.', 'c': 'X...........'}
    sg.drums(kit, iA2, 8, D_A2, gain=0.6)
    sg.drums(kit, iB, 8, D_B, gain=0.65)
    sg.drums(kit, iC, 8, {'k': 'x...........', 'sh': '..x...x...x.'}, gain=0.5)
    sg.drums(kit, iA3, 8, D_B, gain=0.7)
    # ondas: ruído filtrado com envelope lento (maré), uma por 2 compassos
    for bar in range(0, 48, 2):
        n = int(2 * SPB * sg.step_s * SR)
        sw = S.bp(rng.standard_normal(n), 300, 2400, 1) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * 0.4
        sg.sample('wave', sw, bar * SPB, 0.4 if bar < 28 else 0.5, pan=float(rng.uniform(-0.3, 0.3)))
    sg.sample('fx', S.crash(rng, None, 1.5) * 0.4, iB * SPB, 0.4)
    sg.sample('fx', S.crash(rng, None, 1.5) * 0.4, iA3 * SPB, 0.4)
    sg.duck(['pad'], 0.3, 0.25)
    loader_in_gap(sg, A_L, 47, 4, gain=0.25, pan=0.0, pilot_s=0.2)
    # fita 'debaixo d'água'
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(10), wow=0.0035, flutter=0.0006, wow_hz=0.4))
    sg.post.append(lambda mix, song: np.stack([S.lp(c, 6500, 1) for c in mix]))
    fx = {
        'bub': [Reverb(room_size=0.6, wet_level=0.25, dry_level=0.85)],
        'pad': [Chorus(rate_hz=0.3, depth=0.3, mix=0.4), Reverb(room_size=0.85, wet_level=0.35, dry_level=0.7)],
        'whale': [Reverb(room_size=0.95, wet_level=0.5, dry_level=0.55)],
        'sonar': [Reverb(room_size=0.95, wet_level=0.6, dry_level=0.4), Delay(delay_seconds=0.52, feedback=0.45, mix=0.4)],
        'arp': [Reverb(room_size=0.6, wet_level=0.2, dry_level=0.85)],
        'lead': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.9)],
        'wave': [LowpassFilter(3000)],
    }
    sg.sends = {'lead': {'echo': 0.25, 'verb': 0.2}, 'bub': {'verb': 0.2, 'echo': 0.15}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(92, room=0.85, delay_fb=0.4, delay_beats=1.5)
