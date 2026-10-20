"""Valsa da Geada — valsa de harpa em 3/4, 84 bpm, si bemol maior. Harpa macia (Karplus afinado) conta o tema em oom-pah-pah, harmônica de
vidro canta por cima, pads de aurora respiram e sineta de gelo cintila nos acordes. O refrão sobe uma oitava com cascatas de harpa em colcheias
duplas. Forma (32 compassos de 3/4, ~1:09): intro 4 · A 8 · B 8 · C 8 (clímax) · saída 4 (a dominante puxa de volta à intro)."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import inst2 as I2
import inst_c as IC
from songs.common import aux_default

SPB = 12
# ---- temas (12 fichas por compasso: 3 tempos de 4 passos)
A_L = parse("""
f5 - - - - - d5 - bb4 - d5 - |
g5 - - - - - f5 - d5 - bb4 - |
g5 - - - - - bb5 - g5 - eb5 - |
a5 - - - - - c6 - a5 - f5 - |
f5 - - - a5 - - - d6 - - - |
d6 - - - c6 - bb5 - g5 - bb5 - |
c6 - - - eb6 - - - g5 - bb5 - |
a5 - - - - - c6 - - - . . |
""", SPB)
B_L = parse("""
bb5 - - - - - g5 - eb6 - - - |
d6 - - - - - c6 - a5 - c6 - |
d6 - - - f6 - - - a5 - - - |
g6 - - - f6 - d6 - bb5 - d6 - |
eb6 - - - d6 - c6 - g5 - c6 - |
bb5 - - - c6 - eb6 - c6 - bb5 - |
d6 - - - - - f6 - - - a6 - |
a6 - - - - - f6 - c6 - a5 - |
""", SPB)
C_L = parse("""
f6 - - - - - d6 - bb5 - d6 - |
f6 - - - a6 - - - f6 - d6 - |
g6 - - - bb6 - - - g6 - eb6 - |
d6 - - - g6 - - - f6 - d6 - |
eb6 - - - g6 - - - c7 - - - |
a6 - - - - - c7 - a6 - f6 - |
f6 - - - d6 - bb5 - - - d6 - |
c6 - - - eb6 - - - - - - - |
""", SPB)
O_L = parse("""
bb5 - - - - - g5 - bb5 - - - |
g5 - - - eb5 - - - g5 - - - |
bb4 - - - - - c5 - eb5 - - - |
a4 - - - - - - - - - - - |
""", SPB)
I_L = parse("""
f5 - - - - - - - - - - - |
g5 - - - - - - - - - - - |
g5 - - - - - - - - - - - |
a5 - - - - - - - - - - - |
""", SPB)

H_I = Harmony("Bbmaj7 Gm7 Ebmaj7 F", SPB)
H_A = Harmony("Bbmaj7 Gm7 Ebmaj7 Fadd9 Dm7 Gm7 Cm7 F", SPB)
H_B = Harmony("Ebmaj7 F Dm7 Gm7 Cm7 F7sus4 Bbmaj9 F", SPB)
H_C = Harmony("Bbmaj7 Dm7 Ebmaj7 Gm7 Cm7 F Dm7_Gm7 F7sus4", SPB)
H_O = Harmony("Ebmaj7 Cm7 F7sus4 F", SPB)


def waltz(sg, harm, bar0, g, beats=(4, 8), lo=55, hi=71, strum=0.22):
    """Oom-pah-pah da harpa: acordes em 2 e 3 (com um leve rasgado) conduzindo as vozes."""
    evs = harm.events()
    prev = None
    for bi in range(len(harm)):
        for st in beats:
            sa = bi * SPB + st
            cur = [e for e in evs if e[0] <= sa][-1]
            v = K.voice(prev, cur[2], cur[3], lo, hi, 3)
            prev = v
            for k, m in enumerate(v):
                sg.note('harpC', IC.i_harp, (bar0 + bi) * SPB + st + k * strum, m, 2, gain=g / len(v) ** 0.5,
                        pan=-0.2 + 0.2 * k, vel=0.62 + 0.1 * (st == beats[0]), cutoff=3800, tail=1.2)


def sparkle(sg, harm, bar0, p, g, rng, lo=84):
    """Sinetas de gelo caindo sobre as notas do acorde (alturas escolhidas pelo acorde do momento)."""
    evs = harm.events()
    for sa in range(len(harm) * SPB):
        if rng.random() < p:
            cur = [e for e in evs if e[0] <= sa][-1]
            tn = K.tones(cur[2], cur[3], lo)
            m = tn[int(rng.integers(0, len(tn)))] + (12 if rng.random() < 0.35 else 0)
            sg.note('ice', IC.i_icebell, bar0 * SPB + sa, m, 1, gain=g * float(rng.uniform(0.5, 1.0)), pan=float(rng.uniform(-0.8, 0.8)), tilt=0.7,
                    vel=float(rng.uniform(0.5, 0.9)))


def rev_ice(sg, bar, gain=0.5, length=2.4):
    y = S.reverse(S.crash(sg.rng, int(length * SR), 0.9))
    y = S.hp(y, 5000)
    t0 = sg.t_step(bar * SPB) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.9, t0, gain)
    else:   # no começo do laço, a cauda dobrada cuida do resto
        pass


def build():
    sg = K.Song(84, 32, spb=SPB, tail=5.0, seed=733, name='crystal3')
    rng = sg.rng
    iI, iA, iB, iC, iO = 0, 4, 12, 20, 28

    # ---- harpa: baixo (raiz grave + subgrave suave) em cada compasso
    for h, bar, g in ((H_I, iI, 0.7), (H_A, iA, 0.9), (H_B, iB, 0.95), (H_C, iC, 1.0), (H_O, iO, 0.75)):
        sg.bass('harpL', IC.i_harp, h, bar, 'R - - - - - - - - - - -', octave=46, gain=g, decay=0.9985, cutoff=2400, bright=0.2, tail=2.2)
        sg.bass('bass', I2.i_sub, h, bar, 'R - - - - - 5 - - - - -', octave=34, gain=g * 0.7)
    # ---- oom-pah-pah (A, B, C, saída)
    waltz(sg, H_A, iA, 0.7)
    waltz(sg, H_B, iB, 0.75)
    waltz(sg, H_C, iC, 0.6, beats=(2, 4, 6, 8, 10), lo=57, hi=76, strum=0.1)
    waltz(sg, H_O, iO, 0.5)
    # ---- intro: arpejo lento que sobe a cada compasso; B: rolagem de colcheias; C: cascata de harpa
    sg.arp('harpA', IC.i_harp, H_I, iI, '1 . . . 2 . . . 4 . . .', lo=58, gain=0.8, pan=0.2, cutoff=4200)
    sg.arp('harpA', IC.i_harp, H_B, iB, '. . 3 . . . 4 . . . 5 .', lo=62, gain=0.5, pan=0.35, cutoff=4800)
    sg.arp('harpA', IC.i_harp, H_C, iC, '0 1 2 3 4 5 4 3 2 3 4 5', lo=58, gain=0.5, pan=0.5, cutoff=5200, tail=1.0)
    # ---- melodias: harpa conta o tema, vidro canta por cima
    sg.line('lead', IC.i_hglass, I_L, iI, gain=0.7, a=0.6, r=1.2)
    sg.line('lead', IC.i_harp, A_L, iA, gain=1.0, vel_scale=1.0, tail=2.0)
    sg.line('lead', IC.i_harp, B_L, iB, gain=1.0, tail=2.0)
    sg.line('lead2', IC.i_hglass, B_L, iB, gain=0.55, a=0.15, r=0.9, pan=0.15)
    sg.line('lead2', IC.i_hglass, C_L, iC, gain=0.85, a=0.12, r=1.0)
    sg.line('lead', IC.i_harp, C_L, iC, gain=0.65, tail=2.0, pan=-0.15)
    sg.line('lead3', IC.i_icebell, shift(C_L, 0, 12, 0.7), iC, gain=0.28, tilt=1.0, pan=0.3)
    sg.line('lead', IC.i_harp, O_L, iO, gain=0.9, tail=2.4)
    sg.line('lead2', IC.i_hglass, O_L, iO, gain=0.5, a=0.2, r=1.4)
    # ---- pads de aurora
    for h, bar, g in ((H_I, iI, 0.55), (H_A, iA, 0.55), (H_B, iB, 0.8), (H_C, iC, 1.0), (H_O, iO, 0.6)):
        sg.pads('pad', IC.i_aurora, h, bar, 46, 70, gain=g, a=0.9, r=1.4, cutoff=2200)
    sg.pads('padH', IC.i_hglass, H_C, iC, 58, 78, gain=0.5, a=0.5, r=1.2, n=3)
    sg.pads('padH', IC.i_hglass, H_B, iB, 58, 78, gain=0.3, a=0.5, r=1.2, n=3)
    # ---- gelo: sinetas e estalos, pratos ao contrário, riser antes do clímax
    sparkle(sg, H_I, iI, 0.03, 0.5, rng)
    sparkle(sg, H_A, iA, 0.05, 0.5, rng)
    sparkle(sg, H_B, iB, 0.09, 0.6, rng)
    sparkle(sg, H_C, iC, 0.14, 0.7, rng, lo=84)
    sparkle(sg, H_O, iO, 0.05, 0.5, rng)
    for st in range(iA * SPB, iO * SPB):
        if rng.random() < 0.03:
            n = int(0.02 * SR)
            sg.sample('ice', S.hp(rng.standard_normal(n), 6000) * np.exp(-S.tt(n) / 0.004) * 0.7, st, 0.3, pan=float(rng.uniform(-0.8, 0.8)))
    for bar in (iA, iB, iC, iO):
        rev_ice(sg, bar, 0.5)
    sg.sample('fx', S.riser(rng, int(2 * SPB * sg.step_s * SR), 600, 9000, 0.1, 700) * 0.5, (iC - 2) * SPB, 0.4)
    sg.sample('fx', S.crash(rng, None, 1.6) * 0.35, iC * SPB, 0.35)
    sg.duck(['pad'], 0.2, 0.3, steps=[b * SPB for b in range(32)])

    sg.trim = {'harpL': 3.6, 'bass': -7.6, 'harpC': 8.4, 'harpA': 7.0, 'lead': 7.6, 'lead2': 0.5, 'lead3': 5.7, 'pad': 4.6, 'padH': 2.3, 'ice': 5.6, 'fx': -0.5}
    fx = {
        'harpL': [Reverb(room_size=0.5, wet_level=0.15, dry_level=0.9)],
        'harpC': [Reverb(room_size=0.6, wet_level=0.2, dry_level=0.9)],
        'harpA': [Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'lead': [Reverb(room_size=0.6, wet_level=0.2, dry_level=0.9)],
        'lead2': [Chorus(rate_hz=0.3, depth=0.25, mix=0.3), Reverb(room_size=0.8, wet_level=0.35, dry_level=0.75)],
        'lead3': [Reverb(room_size=0.8, wet_level=0.4, dry_level=0.7)],
        'pad': [Chorus(rate_hz=0.18, depth=0.3, mix=0.4), Reverb(room_size=0.9, wet_level=0.4, dry_level=0.65)],
        'padH': [Reverb(room_size=0.9, wet_level=0.4, dry_level=0.7)],
        'ice': [Reverb(room_size=0.85, wet_level=0.4, dry_level=0.7)],
        'bass': [LowpassFilter(260)],
    }
    sg.sends = {'lead': {'echo': 0.22}, 'harpC': {'echo': 0.1}, 'harpA': {'echo': 0.2}, 'ice': {'echo': 0.3}, 'lead3': {'echo': 0.3}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(84, room=0.88, delay_fb=0.45, delay_beats=0.75)
