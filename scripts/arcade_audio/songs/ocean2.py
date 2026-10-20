"""Maré de Bossa — bossa nova de praia (lo-fi), 84 bpm, ré menor / fá maior. Violão de nylon no ritmo clássico, baixo em tempo e contratempo, flauta cantando
com o vibrafone, estalo de 'rim' na clave, shaker, bolhas ao longe e ondas de verdade (ruído que enche e esvazia). A fita é velha: chiado, estalinhos e balanço.
Forma (32 compassos, ~1:31): praia 4 · A 8 · B (melodia espelhada) 8 · A' 8 · maré saindo 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony, invert, fit
import tape as TP
import kits2 as K2
import inst2 as I2
from songs.common import aux_default

A_L = parse("""
f5 - - a5 - - d6 - - - . c6 - a5 - - |
g5 - - e5 - - f5 - - - . . . . . . |
bb5 - - d6 - - g6 - - - . f6 - d6 - - |
e6 - - c6 - - bb5 - - - . g5 - bb5 - - |
a5 - - c6 - - e6 - - - . d6 - c6 - - |
a5 - - - - - . . g5 - - f5 - - e5 - |
d6 - - b5 - - f5 - - - . a5 - b5 - - |
g#5 - - b5 - - d6 - - - e6 - - - - - |
""")
H_A = Harmony("Dm9 Dm9 Gm9 C9 Fmaj9 Fmaj9 Bm7b5 E7")
H_B = Harmony("Bbmaj9 A7 Dm9 Dm9 Gm9 C9 Fmaj9 E7")
H_I = Harmony("Dm9 Gm9 C9 Fmaj9")
H_O = Harmony("Dm9 Gm9 Dm9 Dm9")
B_L = fit(invert(A_L, 2, 'minor', 80), H_B)
OUT_L = parse("""
f5 - - a5 - - d6 - - - - - - - - - |
bb5 - - g5 - - e5 - - - - - - - - - |
d5 - - - - - - - - - - - - - - - |
. . . . . . . . . . . . . . . . |
""")


def guitar(sg, harm, bar0, gain=0.7, steps=(0, 3, 6, 10, 13)):
    """Violão: o acorde dedilhado de baixo para cima nos passos da clave de bossa (curto)."""
    prev = None
    for bi, ev in enumerate(harm.bars):
        pc, q = ev[0][2], ev[0][3]
        v = K.voice(prev, pc, q, 52, 72, 4)
        prev = v
        for st in steps:
            for k, m in enumerate(v):
                sg.note('gtr', I2.i_gtr, (bar0 + bi) * sg.spb + st + 0.0, m, 2, gain=gain / len(v) ** 0.5, pan=-0.25 + 0.05 * k, decay=0.993, bright=0.35, vel=0.75 if st == 0 else 0.55)


def waves(sg, bar0, bars, gain=0.4):
    n = int(2 * sg.spb * sg.step_s * SR)
    for bar in range(bar0, bar0 + bars, 2):
        x = S.bp(sg.rng.standard_normal(n), 250, 3200, 1) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2.2
        sg.sample('wave', x * 0.8, bar * sg.spb, gain, pan=float(sg.rng.uniform(-0.4, 0.4)))


def build():
    sg = K.Song(84, 32, spb=16, tail=4.0, seed=71, name='ocean2')
    rng = sg.rng
    iI, iA, iB, iA2, iO = 0, 4, 12, 20, 28
    # ---- violão e baixo
    guitar(sg, H_I, iI, gain=0.55)
    guitar(sg, H_A, iA, gain=0.7)
    guitar(sg, H_B, iB, gain=0.75)
    guitar(sg, H_A, iA2, gain=0.75)
    guitar(sg, H_O, iO, gain=0.5, steps=(0, 6))
    BOSSA = 'R . . . . . 5 . R . . . . . 5 .'
    for h, bar, g in ((H_A, iA, 0.8), (H_B, iB, 0.85), (H_A, iA2, 0.85)):
        sg.bass('bass', I2.i_walk, h, bar, BOSSA, octave=38, gain=g, tau=0.55)
    sg.bass('bass', I2.i_walk, H_I, iI, 'R . . . . . . . 5 . . . . . . .', octave=38, gain=0.6, tau=0.6)
    sg.bass('bass', I2.i_walk, H_O, iO, 'R . . . . . . . . . . . . . . .', octave=38, gain=0.6, tau=0.7)
    # ---- piano elétrico macio sustentando (acordes longos) e pads do mar
    for h, bar, g in ((H_A, iA, 0.35), (H_B, iB, 0.4), (H_A, iA2, 0.4), (H_I, iI, 0.35)):
        sg.pads('ep', K.i_fmep, h, bar, 55, 74, gain=g, tau=1.6, bright=0.7)
    for h, bar, g in ((H_I, iI, 0.5), (H_A, iA, 0.45), (H_B, iB, 0.5), (H_A, iA2, 0.5), (H_O, iO, 0.5)):
        sg.pads('pad', K.i_pad, h, bar, 50, 70, gain=g, cutoff=1000, a=0.7, r=1.0)
    # ---- melodias: flauta (A), vibrafone espelhado (B), flauta + vibrafone (A')
    sg.line('lead', I2.i_flute, A_L, iA, gain=0.9)
    sg.line('lead', K.i_modal, B_L, iB, gain=0.85, kind='vibes', tilt=1.8)
    sg.line('lead2', I2.i_flute, shift(B_L, 0, 0, 0.7), iB, gain=0.55, pan=0.3)
    sg.line('lead', I2.i_flute, A_L, iA2, gain=0.95)
    sg.line('lead2', K.i_modal, shift(A_L, 3, 12, 0.5), iA2, gain=0.4, kind='vibes', tilt=1.6, pan=0.35)
    sg.line('lead', I2.i_flute, OUT_L, iO, gain=0.8, vib=0.008)
    # ---- bolhas esparsas (pentatônica de ré menor) e ondas
    PENT = [74, 77, 79, 81, 84, 86]
    for bar0, bars, dens in ((iI, 4, 0.1), (iA, 8, 0.04), (iB, 8, 0.07), (iA2, 8, 0.05), (iO, 4, 0.12)):
        for st in range(bar0 * 16, (bar0 + bars) * 16):
            if rng.random() < dens:
                sg.note('bub', K.i_bub, st, int(rng.choice(PENT)), 2, gain=float(rng.uniform(0.3, 0.6)), pan=float(rng.uniform(-0.8, 0.8)), rise=float(rng.uniform(0.15, 0.3)), tau=float(rng.uniform(0.04, 0.09)))
    waves(sg, iI, 4, 0.55)
    waves(sg, iA, 8, 0.3)
    waves(sg, iB, 8, 0.3)
    waves(sg, iA2, 8, 0.3)
    waves(sg, iO, 4, 0.55)
    # ---- percussão de bossa: bumbo no 1 e 3, rim na clave (suave), shaker contínuo
    kit = K.kit_soft
    D_A = {'k': 'x.......x.......', 'r': 'x..o..x...o..x..', 'sh': 'xoxoxoxoxoxoxoxo'}
    D_B = {'k': 'x.....o.x.....o.', 'r': 'x..x..x...x..x..', 'sh': 'xoxoxoxoxoxoxoxo', 'w': '..............x.'}
    sg.drums(kit, iI, 4, {'sh': '.o.o.o.o.o.o.o.o'}, gain=0.5)
    sg.drums(kit, iA, 8, D_A, gain=0.75)
    sg.drums(kit, iB, 8, D_B, gain=0.8)
    sg.drums(kit, iA2, 8, D_B, gain=0.8)
    sg.drums(kit, iO, 4, {'k': 'x...............', 'sh': '.o.o.o.o.o.o.o.o'}, gain=0.5)
    sg.sample('fx', S.crash(rng, None, 1.6) * 0.4, iB * 16, 0.4)
    sg.sample('fx', S.crash(rng, None, 1.6) * 0.4, iA2 * 16, 0.4)
    sg.duck(['pad'], 0.25, 0.2)
    sg.trim = {'gtr': 12.2, 'bass': 1.4, 'ep': 2.9, 'pad': 6.5, 'lead': -0.7, 'lead2': 1.6, 'bub': 7.9, 'wave': -1.6, 'drums': 2.6}
    # fita lo-fi: balanço lento, agudos macios, chiado e estalinhos
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(21), wow=0.0028, flutter=0.0006, wow_hz=0.35))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(22), drive=1.35, lp_hz=8200, hiss_level=0.0055, crackle=0.05))
    fx = {
        'gtr': [Reverb(room_size=0.3, wet_level=0.14, dry_level=0.9)],
        'bass': [LowpassFilter(1400)],
        'ep': [Chorus(rate_hz=0.4, depth=0.25, mix=0.35), Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'pad': [Chorus(rate_hz=0.2, depth=0.3, mix=0.4), Reverb(room_size=0.85, wet_level=0.35, dry_level=0.7)],
        'lead': [Reverb(room_size=0.45, wet_level=0.2, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.5, wet_level=0.22, dry_level=0.85)],
        'bub': [Reverb(room_size=0.6, wet_level=0.25, dry_level=0.85)],
        'wave': [LowpassFilter(3200)],
    }
    sg.sends = {'lead': {'echo': 0.15, 'verb': 0.15}, 'lead2': {'echo': 0.15}, 'gtr': {'verb': 0.1}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(84, room=0.7, delay_fb=0.3, delay_beats=1.5)
