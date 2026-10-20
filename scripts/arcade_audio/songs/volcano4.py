"""Fogo de Bulería — flamenco em compás de 12 tempos, 104 bpm (cada tempo = 2 passos; acentos nos tempos 3 6 8 10 12), lá frígio dominante.
Violão de nylon (rasgueado, rolos e picado em semicolcheias), palmas fuertes e sordas, cajón, taconeo, contrabaixo dedilhado, cante de formantes
('ay' que escorrega para a nota) sobre o baixo que desce Ré-Sib-Lá-Sol-Fá-Mi, e um fogo que cresce em estalos. Forma (20 compassos de 12 tempos, ~1:09):
toque 2 · picado (A) 4 · cante (B) 4 · falseta rápida (C) 4 · cante alto e fogo (D) 4 · remate 2."""
import numpy as np
from pedalboard import Reverb, Delay, Compressor, LowpassFilter, HighpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony, bars_of
import tape as TP
import inst2 as I2
import inst_e as E
from songs.common import aux_default

SPB = 24
VO = {
    (9, ''): [45, 52, 57, 61, 64], (10, ''): [46, 53, 58, 62, 65], (7, ''): [43, 50, 55, 62, 67],
    (5, ''): [41, 48, 53, 57, 60, 65], (4, ''): [40, 47, 52, 56, 59, 64], (2, 'm'): [38, 45, 50, 53, 57, 62], (7, 'm'): [43, 50, 55, 58, 62],
}

H_I = Harmony("A_Bb A_E", SPB)
H_A = Harmony("A_Bb A_Bb A_G F_E", SPB)
H_B = Harmony("Dm_Bb A_G F_E E_E", SPB)
H_C = Harmony("A_E A_E Dm_Bb G_E", SPB)
H_E = Harmony("F_E A_A", SPB)

# picado do tema (A): 4 compassos de 24 passos
PICADO = parse("""
e5 d5 c#5 d5 e5! - f5 e5 d5 c#5 a4! - d5 - f5! - e5 d5 bb4! - a4 bb4 d5! - |
e5 d5 c#5 d5 e5! - a5 g5 f5 e5 c#5! - d5 - f5! - g5 f5 d5! - bb4 - a4! - |
a4 - c#5 d5 e5! - f5 e5 d5 c#5 e5! - d5 - g5! - f5 e5 d5! - e5 - f5! - |
f5 - a5 g5 f5! - e5 f5 g5 f5 c5! - e5 f5 e5! - d5 - e5! - - - e5! - |
""", SPB)

# falseta rápida (C): grade de 48 passos por compasso (semicolcheias de tempo), depois reduzida à metade
FAL = parse("""
a4 bb4 c#5 d5 e5 f5 g5 a5 g5 f5 e5 d5 c#5 bb4 a4 bb4 c#5 e5 a5! - - - - - e5 e5 e5 e5 e5 e5 f5 e5 d5 e5 d5 c#5 bb4 c#5 d5 e5 f5 e5 d5 c#5 d5 e5! - - |
a5 g5 f5 e5 d5 c#5 bb4 a4 bb4 c#5 d5 e5 f5 g5 a5 g5 f5 e5 c#5 e5 a5! - - - e5 e5 e5 e5 e5 e5 f5 e5 d5 e5 d5 c#5 bb4 c#5 d5 e5 f5 e5 d5 c#5 d5 e5! - - |
f5 e5 d5 a4 d5 f5 a5 f5 d5 a4 d5 f5 e5 d5 c#5 d5 e5 f5 a5! - - - - - bb5 a5 g5 f5 d5 f5 g5 a5 bb5 a5 g5 f5 e5 d5 f5 g5 f5 d5 bb4! - - - - - |
d5 g5 d5 g5 f5 e5 d5 f5 e5 d5 c#5 d5 g5 f5 e5 d5 f5 g5 d5! - - - - - e5 e5 e5 e5 e5 e5 e5 e5 e5 e5 e5 e5 f5 e5 f5 e5 d5 e5 a5! - - - - - |
""", 48)
FAL = [(s / 2.0, m, l / 2.0, v) for (s, m, l, v) in FAL]

CANTE_B = parse("""
a4 - - - - - g4 f4 g4 a4 - - bb4 - - - a4 g4 f4 - - d4 - - |
a4 - - - c#5 - e5 - - d5 c#5 - d5 - - - bb4 a4 g4 - - f4 - - |
f4 - - - a4 - c5 - - bb4 a4 f4 e4 - - - f4 e4 e4 - d4 - e4 - |
e5 - - - - - f5 e5 d5 e5 - - e5 - d5 - c#5 bb4 a4 - - - e4 - |
""", SPB)


def pat(d, n=SPB):
    s = ['.'] * n
    for k, ch in d.items():
        s[k] = ch
    return ''.join(s)


def stepsd(steps, ch='x'):
    return pat({k: ch for k in steps})


def bpat(d):
    s = ['.'] * SPB
    for k, ch in d.items():
        s[k] = ch
    return ' '.join(s)


ACC = [4, 10, 14, 18, 22]
SORD = [0, 2, 6, 8, 12, 16, 20]
RA = [(0, 'd', .75), (2, 'u', .4), (4, 'd', 1.0), (6, 'u', .45), (8, 'd', .5), (10, 'd', 1.0), (12, 'u', .45), (14, 'd', 1.0),
      (16, 'u', .4), (18, 'd', 1.0), (20, 'u', .5), (21, 'd', .5), (22, 'd', 1.0), (23, 'u', .5)]
ROLL = [(20, 'd', .7), (20.5, 'u', .6), (21, 'd', .8), (21.5, 'u', .7), (22, 'd', 1.0), (23, 'u', .5)]
RA_FILL = [x for x in RA if x[0] < 20] + ROLL
R_ACC = [(s, 'd', v) for s, v in ((4, .6), (10, .6), (14, .6), (18, .6), (22, .7))]
R_ACC_C = [(s, 'd', v) for s, v in ((4, .75), (10, .75), (14, .75), (18, .75), (22, .85))]
INTRO0 = [(0, 'd', 1.0, 0.03), (6, 'u', .5), (10, 'd', .8), (14, 'd', .8), (18, 'd', .9)] + ROLL


def chord_at(h, bar, st):
    for (s0, ln, pc, q) in h.bars[bar]:
        if s0 <= st < s0 + ln:
            return VO[(pc, q)]
    return VO[(h.bars[bar][-1][2], h.bars[bar][-1][3])]


def rasg(sg, h, bar0, patterns, gain=0.8, pan=-0.15, spread=0.009):
    """patterns: um padrão para todos os compassos, ou lista (um por compasso)."""
    for b in range(len(h)):
        p = patterns[b] if isinstance(patterns[0], list) else patterns
        for ev in p:
            st, d, v = ev[0], ev[1], ev[2]
            sp = ev[3] if len(ev) > 3 else spread
            E.strum(sg, 'gtr', E.i_flam, chord_at(h, b, int(st)), (bar0 + b) * SPB + st, down=(d == 'd'), gain=gain, pan=pan,
                    spread=sp, velmul=v, decay=0.9935, bright=0.62, ring=1.1)


def pick(sg, notes, bar0, gain=0.8, pan=0.2, **kw):
    for i, (st, m, ln, v) in enumerate(notes):
        sg.note('lead', E.i_flam, bar0 * SPB + st, m, ln, gain=gain, pan=pan, vel=v, var=i, hold=ln * sg.step_s * 1.5 + 0.09, **kw)


def build():
    sg = K.Song(104, 20, spb=SPB, tail=4.0, seed=412, name='volcano4')
    rng = sg.rng
    iI, iA, iB, iC, iD, iE = 0, 2, 6, 10, 14, 18
    # ---- violão: toque (intro), rasgueado nas seções, picado do tema e falseta
    rasg(sg, H_I, iI, [INTRO0, RA], gain=0.85)
    rasg(sg, H_A, iA, [R_ACC, R_ACC, R_ACC, RA_FILL], gain=0.7)
    rasg(sg, H_B, iB, [RA, RA, RA, RA_FILL], gain=0.85)
    rasg(sg, H_C, iC, [R_ACC_C, R_ACC_C, R_ACC_C, RA_FILL], gain=0.75)
    rasg(sg, H_B, iD, [RA, RA, RA, RA_FILL], gain=1.0)
    rasg(sg, H_E, iE, [RA_FILL, [(0, 'd', 1.0, 0.045), (22, 'd', 1.0)]], gain=1.0)
    pick(sg, PICADO, iA, gain=0.85, decay=0.992, bright=0.6, ring=0.9)
    for b in range(4):
        pick(sg, [(s - b * SPB, m, l, v) for (s, m, l, v) in FAL if b * SPB <= s < (b + 1) * SPB], iC + b, gain=0.8, pan=0.15, decay=0.99, bright=0.6, ring=0.7)
    # contracanto de picado no cante alto (só nas notas longas do tema, uma oitava abaixo e suave)
    pick(sg, [(s, m - 12, l, v * 0.7) for (s, m, l, v) in PICADO if s < 2 * SPB], iD + 2, gain=0.45, pan=0.3, decay=0.992, bright=0.7, ring=0.9)
    # ---- cante
    sg.note('voice', E.i_cante, iI * SPB + SPB + 12, 64, 11, gain=0.8, vel=0.95, v1='a', v2='i', scoop=2.0, vib=0.016)
    sg.line('voice', E.i_cante, CANTE_B, iB, gain=0.85, v1='a', v2='i')
    hi = [(s, m + 12, l, v) for (s, m, l, v) in bars_of(CANTE_B, SPB, 0, 2)]
    sg.line('voice', E.i_cante, hi, iD, gain=0.7, v1='a', v2='i', vib=0.018, grit=0.4)
    sg.line('voice', E.i_cante, bars_of(CANTE_B, SPB, 0, 2), iD, gain=0.5, v1='a', v2='e', pan=-0.3)
    sg.line('voice', E.i_cante, bars_of(CANTE_B, SPB, 2, 2), iD + 2, gain=0.85, v1='a', v2='i', vib=0.018, grit=0.3)
    sg.line('voice', E.i_cante, [(s, m + 12, l, v) for (s, m, l, v) in bars_of(CANTE_B, SPB, 2, 2)], iD + 2, gain=0.45, v1='e', v2='i', pan=0.3)
    sg.note('voice', E.i_cante, iE * SPB + 12, 76, 11, gain=0.8, vel=1.0, v1='a', v2='i', scoop=2.0, vib=0.018, grit=0.4)
    # ---- baixo dedilhado
    BA = bpat({0: 'R', 4: '5', 10: 'r', 12: 'R', 14: '5', 18: 'o', 22: 'r'})
    BB = bpat({0: 'R', 10: '5', 12: 'R', 22: '5'})
    BC = bpat({0: 'R', 2: 'r', 4: '5', 6: 'r', 10: 'R', 12: 'R', 14: '5', 16: 'r', 18: 'o', 20: '5', 22: 'r'})
    BD = bpat({0: 'R', 4: 'r', 10: '5', 12: 'R', 14: 'r', 18: '5', 22: 'r'})
    sg.bass('bass', I2.i_walk, H_A, iA, BA, octave=36, gain=0.9)
    sg.bass('bass', I2.i_walk, H_B, iB, BB, octave=36, gain=0.9)
    sg.bass('bass', I2.i_walk, H_C, iC, BC, octave=36, gain=0.95)
    sg.bass('bass', I2.i_walk, H_B, iD, BD, octave=36, gain=1.0)
    sg.bass('bass', I2.i_walk, H_E, iE, bpat({0: 'R', 6: '5', 12: 'R', 22: 'r'}), octave=36, gain=0.9)
    sg.note('bass', I2.i_walk, iE * SPB + SPB, 45, 18, gain=1.0, vel=1.0)
    # ---- percussão: palmas fuertes (p) e sordas (q), cajón (k, s), taconeo (z), golpe (g)
    kit = E.kit_flam
    sg.drums(kit, iI, 1, {'g': pat({4: 'x', 10: 'x'})}, gain=0.6)
    sg.drums(kit, iI + 1, 1, {'q': stepsd(SORD, 'o'), 'p': stepsd([22], 'x')}, gain=0.6)
    D_A = {'q': stepsd(SORD, 'o'), 'p': stepsd([10, 22], 'x')}
    D_A2 = {'q': stepsd(SORD, 'o'), 'p': stepsd(ACC, 'x'), 'k': pat({22: 'x', 4: 'o'}), 's': pat({10: 'o'})}
    sg.drums(kit, iA, 2, D_A, gain=0.9)
    sg.drums(kit, iA + 2, 2, D_A2, gain=0.95)
    D_B = {'q': stepsd(SORD, 'o'), 'p': pat({4: 'x', 10: 'X', 14: 'x', 18: 'X', 22: 'X'}), 'k': pat({22: 'X', 4: 'x', 12: 'x'}), 's': pat({10: 'x', 18: 'x', 16: 'o', 20: 'o'})}
    sg.drums(kit, iB, 4, D_B, gain=1.0)
    D_C = dict(D_B)
    D_C['z'] = pat({4: 'o', 10: 'x', 14: 'x', 18: 'x', 22: 'X'})
    sg.drums(kit, iC, 4, D_C, gain=1.0)
    D_D = dict(D_C)
    D_D['q'] = stepsd(range(0, 24, 2), 'o')
    D_D['g'] = pat({0: 'x', 8: 'x', 20: 'o'})
    sg.drums(kit, iD, 4, D_D, gain=1.05)
    sg.drums(kit, iE, 1, {'p': pat({4: 'x', 10: 'X', 14: 'x', 18: 'X', 20: 'o', 21: 'o', 22: 'X'}), 'k': pat({22: 'X', 4: 'x', 12: 'x'}), 'z': pat({10: 'x', 14: 'x', 18: 'x', 22: 'X'})}, gain=1.05)
    sg.drums(kit, iE + 1, 1, {'p': pat({0: 'X', 22: 'X'}), 'k': pat({0: 'X', 22: 'X'}), 'z': pat({0: 'X'}), 'c': pat({0: 'x'})}, gain=1.1)
    sg.drums(kit, iC, 1, {'c': pat({0: 'x'})}, gain=0.7)
    sg.drums(kit, iD, 1, {'c': pat({0: 'x'})}, gain=0.9)
    # ---- fogo que cresce (C e D) e estouro do remate
    n_f = int(8 * SPB * sg.step_s * SR)
    sg.sample('fire', E.fire(rng, n_f, level=0.5, density=90.0), iC * SPB, 0.9)
    yrev = S.reverse(S.crash(rng, int(2.2 * SR), 0.7))
    sg.put('fx', yrev * 0.8, sg.t_step(iD * SPB) - len(yrev) / SR, 0.6)
    sg.put('fx', yrev * 0.9, sg.t_step((iE + 1) * SPB) - len(yrev) / SR, 0.7)
    sg.trim = {'gtr': -6.2, 'lead': 9.0, 'voice': 9.5, 'bass': 1.5, 'drums': -2.5, 'fire': 7.0, 'fx': 6.0}
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(41), drive=1.15, lp_hz=12500, hiss_level=0.0006))
    fx = {
        'gtr': [Reverb(room_size=0.3, wet_level=0.12, dry_level=0.9), Compressor(threshold_db=-20, ratio=2.2, attack_ms=12, release_ms=120)],
        'lead': [Reverb(room_size=0.35, wet_level=0.14, dry_level=0.9)],
        'voice': [Reverb(room_size=0.55, wet_level=0.25, dry_level=0.8)],
        'bass': [LowpassFilter(1000)],
        'drums': [Reverb(room_size=0.25, wet_level=0.12, dry_level=0.92), Compressor(threshold_db=-18, ratio=2.2, attack_ms=8, release_ms=100)],
        'fire': [HighpassFilter(400)],
    }
    sg.sends = {'lead': {'echo': 0.12}, 'voice': {'echo': 0.18, 'verb': 0.15}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(104, room=0.5, delay_fb=0.3, delay_beats=1.5)
