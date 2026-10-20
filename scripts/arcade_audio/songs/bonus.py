"""Bônus — 176 bpm, dó maior e depois ré maior (sobe um tom), baixo FM 'slap' de Mega Drive, metais curtos, chuva de marimba (as fitas caindo).
Forma (36 compassos, ~49 s): A 8 · B 8 · A+2 8 · B+2 8 · virada 4 (volta a dó pelo V7)."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import lp_post, aux_default, loader_in_gap

A_L = parse("""
e5! . e5 . g5 . e5 . c5 . e5 . g5 . c6 . |
c6! . c6 . a5 . c6 . e6 . c6 . a5 . e5 . |
a5! . a5 . c6 . a5 . f5 . a5 . c6 . f6 . |
d6! . b5 . g5 . b5 . d6 . g6 . d6 - - - |
e6! . c6 . g5 . c6 . e6 . g6 . e6 . c6 . |
c6! . a5 . e5 . a5 . c6 . e6 . a6 . e6 . |
d6! . f6 . a6 . f6 . d6 . a5 . f5 . d5 . |
g5 . b5 . d6 . f6 . g6 - - - . . . . |
""", 16)
B_L = parse("""
a5! - - a5 c6 - - c6 f6 - - f6 c6 - a5 - |
b5! - - b5 d6 - - d6 g6 - - g6 d6 - b5 - |
g5! - - g5 b5 - - b5 e6 - - e6 b5 - g5 - |
a5! - - a5 c6 - - c6 e6 - - e6 c6 - a5 - |
a5! - - a5 c6 - - c6 f6 - - f6 a6 - - - |
b5! - - b5 d6 - - d6 g6 - - g6 b6 - - - |
e6 . g6 . c6 - - - d6 . b5 . g5 - - - |
c6 . e6 . g6 . e6 . g5 . c6 . e6 - - - |
""", 16)
TURN_L = parse("""
b5 . e6 . g6 . e6 . b5 . g5 . e5 - - - |
c#6 . e6 . g6 . e6 . c#6 . a5 . e5 - - - |
a5 . d6 . f6 . d6 . a5 . f5 . d5 - - - |
b5 . d6 . f6 . g6 . b6 - - - . . . . |
""", 16)

H_A = Harmony("C Am F G C Am Dm G7")
H_B = Harmony("F G Em Am F G C_G C")
H_T = Harmony("Em7 A7 Dm7 G7")


def build():
    spb = 16
    sg = K.Song(176, 36, spb=16, tail=2.5, seed=111, name='bonus')
    rng = sg.rng
    iA, iB, iA2, iB2, iT = 0, 8, 16, 24, 32
    H_A2, H_B2 = H_A.transposed(2), H_B.transposed(2)
    # --- baixo FM slap e chuva de marimba (cada fita que cai)
    BASS = 'R . R . . R . . R . R . R . o .'
    for h, bar in ((H_A, iA), (H_B, iB), (H_A2, iA2), (H_B2, iB2), (H_T, iT)):
        sg.bass('bass', K.i_fmbass, h, bar, BASS, octave=36 if h is not H_A2 and h is not H_B2 else 38, gain=0.9, tau=0.14, index=3.2)
    for h, bar, g in ((H_A, iA, 0.5), (H_B, iB, 0.55), (H_A2, iA2, 0.5), (H_B2, iB2, 0.55), (H_T, iT, 0.5)):
        sg.pads('pad', K.i_pad, h, bar, 52, 76, gain=g * 0.7, cutoff=2200, a=0.1)
        sg.arp('arp', K.i_modal, h, bar, '0 1 2 3 2 1 0 1 2 3 4 3 2 1 0 .', lo=60, gain=g * 0.8, pan=0.5, kind='marimba', tilt=0.5, step_len=1)
    # chuva aleatória de marimba sobre a escala (coletas) — semente fixa
    scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81]
    for st in range(0, 36 * spb):
        if rng.random() < 0.16:
            sh = 2 if 16 * spb <= st < 32 * spb else 0
            sg.note('rain', K.i_modal, st, scale[int(rng.integers(0, len(scale)))] + 12 * int(rng.integers(0, 2)) + sh, 1, gain=0.17 * float(rng.uniform(0.5, 1)), pan=float(rng.uniform(-0.9, 0.9)), kind='marimba', tilt=0.5)
    # --- melodias
    sg.line('lead', K.i_nes, A_L, iA, gain=0.85, duty=0.25, vib=0.005, decay=0.3)
    sg.line('lead', K.i_nes, B_L, iB, gain=0.85, duty=0.5, vib=0.005, decay=0.3)
    sg.line('lead', K.i_vrc6, shift(B_L, 0, 12, 0.6), iB, gain=0.3, vib=0.004, pan=-0.3)
    sg.line('lead', K.i_nes, shift(A_L, 0, 2), iA2, gain=0.85, duty=0.25, vib=0.005, decay=0.3)
    sg.line('lead', K.i_modal, shift(A_L, 0, 14, 0.6), iA2, gain=0.35, kind='glass', pan=0.3)
    sg.line('lead', K.i_nes, shift(B_L, 0, 2), iB2, gain=0.85, duty=0.5, vib=0.005, decay=0.3)
    sg.line('lead', K.i_vrc6, shift(B_L, 0, 14, 0.6), iB2, gain=0.3, vib=0.004, pan=-0.3)
    sg.line('lead', K.i_nes, TURN_L, iT, gain=0.85, duty=0.25, vib=0.005, decay=0.3)
    # metais curtos nos acentos
    for h, bar in ((H_B, iB), (H_B2, iB2)):
        for (st, m, l, v) in shift(B_L, 0, 0):
            if st % 16 == 0 and v >= 1.0:
                sg.note('brass', K.i_brass, bar * spb + st, m, 2, gain=0.3, vel=0.95)
    # --- bateria 'de Mega Drive'
    kit = K.kit_sega
    D_A = {'k': 'x...x...x...x...', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..x...x...x...x.'}
    D_B = {'k': 'x..xx..xx..xx.x.', 's': '....x.......x..x', 'h': 'xxxxxxxxxxxxxxxx', 'o': '......x.......x.', 'c': 'X...............'}
    sg.drums(kit, iA, 8, D_A, gain=0.85)
    sg.drums(kit, iB, 8, D_B, gain=0.85)
    sg.drums(kit, iA2, 8, D_A, gain=0.9)
    sg.drums(kit, iB2, 8, D_B, gain=0.9)
    sg.drums(kit, iT, 3, D_A, gain=0.9)
    sg.drums(kit, iT + 3, 1, {'s': 'xxxxxxxxxxxxxxxx', 'k': 'x...x...x...x...'}, gain=0.9)
    for bar in (iB, iA2, iB2):
        sg.sample('fx', S.crash(rng) * 0.5, bar * spb, 0.5)
    sg.sample('fx', S.riser(rng, int(2 * spb * sg.step_s * SR), 400, 9000, 0.2, 392), (iA2 - 2) * spb, 0.7)
    sg.sample('fx', S.riser(rng, int(2 * spb * sg.step_s * SR), 400, 9000, 0.2, 440), (iT + 2) * spb, 0.7)
    sg.duck(['pad', 'arp'], 0.35, 0.1)
    loader_in_gap(sg, A_L[:30], 35, 6, gain=0.28, pan=0.0, pilot_s=0.1)
    lp_post(sg, 7800)
    fx = {
        'lead': [Reverb(room_size=0.2, wet_level=0.12, dry_level=0.92)],
        'arp': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'rain': [Reverb(room_size=0.4, wet_level=0.2, dry_level=0.85)],
        'brass': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.5, depth=0.2, mix=0.3), Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
    }
    sg.sends = {'lead': {'echo': 0.12}, 'rain': {'echo': 0.2}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(176, room=0.4, delay_fb=0.3, delay_beats=0.75)
