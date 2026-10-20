"""Madrugada na Avenida — eurodance / trance, 138 bpm, fá menor. Bumbo de quatro, baixo no contratempo, acordes de piano em 3-3-4-3-3, stabs de rave
('hoover': o tom despenca no ataque), coro de vozes com sílabas, supersaw no refrão e uma quebra emocional sem bumbo (piano + cordas) que sobe
num rufo até o drop final com oitavas e riser.
Forma (36 compassos, ~1:03): intro 4 · A (piano + voz) 8 · B (supersaw) 8 · quebra 4 · subida 4 · C (drop cheio) 8."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import inst2 as I2
import inst_b as IB
import kits_b as KB
from songs.common import aux_default

B_L = parse("""
f6! - - ab5 - - c6 - - db6 - - c6 - - ab5 |
c6! - - eb6 - - ab6 - - g6 - - eb6 - - c6 |
bb5! - - eb6 - - g6 - - f6 - - eb6 - - bb5 |
c6! - - f6 - - ab6 - - c7 - - - - - . |
f6! - - ab5 - - c6 - - db6 - - f6 - - db6 |
c6! - - eb6 - - ab6 - - g6 - - eb6 - - g6 |
bb5! - - eb6 - - g6 - - bb6 - - g6 - - eb6 |
g5! - - c6 - - eb6 - - g6 - - - - - . |
""")
A_V = parse("""
. . . . . . c5 . f5 - - . ab5 - - . |
. . . . . . db5 . f5 - - . ab5 - - . |
. . . . . . c5 . eb5 - - . c6 - - . |
. . . . . . bb4 . eb5 - - . g5 - - . |
. . . . . . c5 . f5 - - . ab5 - - . |
. . . . . . db5 . f5 - - . ab5 - - . |
. . . . . . db5 . f5 - - . bb5 - - . |
. . . . . . bb4 . eb5 . g5 . bb5 - - - |
""")
BD_L = parse("""
f5 - - - - - - - ab5 - - - c6 - - - |
eb6 - - - - - - - c6 - - - ab5 - - - |
db6 - - - - - - - bb5 - - - f5 - - - |
c6 - - - - - - - eb6 - - - g6 - - - |
""")
H_I = Harmony("Fm Db Ab Eb")
H_A = Harmony("Fm Db Ab Eb Fm Db Bbm Eb")
H_B = Harmony("Db Ab Eb Fm Db Ab Eb Cm")
H_BD = Harmony("Db Ab Bbm Cm")
H_U = Harmony("Db Ab Eb C")


def rev_crash(sg, bar, gain=0.5, length=1.9):
    y = S.reverse(S.crash(sg.rng, int(length * SR), 0.8))
    t0 = sg.t_step(bar * sg.spb) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def chord_hits(sg, bus, fn, harm, bar0, steps, lo, hi, gain, ln=2, **kw):
    prev = None
    for bi, ev in enumerate(harm.bars):
        pc, q = ev[0][2], ev[0][3]
        v = K.voice(prev, pc, q, lo, hi, 3)
        prev = v
        for st in steps:
            for k, m in enumerate(v):
                sg.note(bus, fn, (bar0 + bi) * sg.spb + st, m, ln, gain=gain / len(v) ** 0.5, pan=-0.3 + 0.3 * k, **kw)


def build():
    sg = K.Song(138, 36, spb=16, tail=3.5, seed=47, name='neon3')
    rng = sg.rng
    iI, iA, iB, iBD, iU, iC = 0, 4, 12, 20, 24, 28
    SIX = int(4 * 16 * sg.step_s * SR)
    # ---- baixo no contratempo (a partir do compasso 3 da intro) e sub longo na quebra
    OFF = '. . R - . . R - . . R - . . R -'
    sg.bass('bass', IB.i_offbass, Harmony("Ab Eb"), iI + 2, OFF, octave=29, gain=0.8)
    for h, bar, g in ((H_A, iA, 0.95), (H_B, iB, 1.0), (H_B, iC, 1.0)):
        sg.bass('bass', IB.i_offbass, h, bar, OFF, octave=29, gain=g)
    sg.bass('sub', I2.i_sub, H_BD, iBD, 'R - - - - - - - - - - - - - - -', octave=29, gain=0.5)
    sg.bass('sub', I2.i_sub, H_U, iU, 'R - - - - - - - R - - - - - - -', octave=29, gain=0.7)
    # ---- piano: acordes em 3-3-4-3-3 (A, B, C); na quebra, arpejo e tema lento
    PS = (0, 3, 6, 10, 13)
    chord_hits(sg, 'piano', IB.i_piano, H_A, iA, PS, 53, 77, 0.8, ln=2, tau=0.45, bright=0.95)
    chord_hits(sg, 'piano', IB.i_piano, H_B, iB, (0, 6, 10), 53, 77, 0.55, ln=2, tau=0.45, bright=0.95)
    chord_hits(sg, 'piano', IB.i_piano, H_B, iC, PS, 53, 77, 0.7, ln=2, tau=0.45, bright=0.95)
    sg.line('piano', IB.i_piano, BD_L, iBD, gain=0.45, tau=1.2, bright=0.9)
    sg.line('piano', IB.i_piano, shift(BD_L, 0, -12, 0.6), iBD, gain=0.3, tau=1.2, pan=-0.2)
    sg.arp('piano2', IB.i_piano, H_BD, iBD, '0 . 1 . 2 . 1 . 0 . 1 . 2 . 3 .', lo=53, gain=0.22, tau=0.8)
    sg.arp('piano2', IB.i_piano, H_U, iU, '0 . 1 . 2 . 1 . 0 . 1 . 2 . 3 .', lo=53, gain=0.55, tau=0.8)
    # ---- stabs de rave (hoover): teaser na intro, fills no A, 3-3-2 no B e no C
    chord_hits(sg, 'stab', IB.i_hoover, Harmony("Ab Eb"), iI + 2, (0, 3, 6), 55, 75, 0.7, ln=1, cutoff=3800)
    chord_hits(sg, 'stab', IB.i_hoover, Harmony("Bbm Eb"), iA + 6, (8, 11, 14), 55, 75, 0.65, ln=1)
    chord_hits(sg, 'stab', IB.i_hoover, H_B, iB, (8, 11, 14), 55, 75, 0.6, ln=1)
    chord_hits(sg, 'stab', IB.i_hoover, H_B, iC, (0, 3, 6, 8, 11, 14), 55, 75, 0.75, ln=1, cutoff=5200)
    # ---- pad/cordas
    sg.pads('pad', IB.i_strings, H_I, iI, 48, 69, gain=0.7, a=0.6, r=0.8, cutoff=1500)
    sg.pads('pad', IB.i_strings, H_A, iA, 48, 69, gain=0.4, a=0.5, r=0.7, cutoff=1900)
    sg.pads('pad', IB.i_strings, H_B, iB, 48, 70, gain=0.55, a=0.4, r=0.7, cutoff=2400)
    sg.pads('pad', IB.i_strings, H_BD, iBD, 48, 70, gain=0.55, a=0.9, r=1.0, cutoff=2200)
    sg.pads('pad', IB.i_strings, H_U, iU, 48, 70, gain=0.7, a=0.6, r=0.8, cutoff=2800)
    sg.pads('pad', IB.i_strings, H_B, iC, 48, 70, gain=0.6, a=0.3, r=0.6, cutoff=3000)
    # ---- arpejo agudo (contratempo de 16) no B e no C
    for h, bar, g in ((H_B, iB, 0.4), (H_B, iC, 0.5)):
        sg.arp('arp', IB.i_hsaw, h, bar, '. 0 . 1 . 2 . 1 . 0 . 1 . 2 . 3', lo=65, gain=g, pan=0.4, cutoff=5500, spread=0.012, voices=3, a=0.002, d=0.07, s=0.15, r=0.04)
    # ---- voz (sílabas por nota)
    sg.line('vox', IB.i_vox, A_V, iA, gain=0.8, shift=1.2, scoop=1.5, vib=0.004)
    # ---- lead supersaw (B e C) e a quebra
    sg.line('lead', IB.i_hsaw, B_L, iB, gain=0.8, cutoff=7500, spread=0.017, voices=7, a=0.006, s=0.9, r=0.1)
    sg.line('lead', IB.i_hsaw, B_L, iC, gain=0.8, cutoff=9000, spread=0.019, voices=7, a=0.006, s=0.9, r=0.1)
    sg.line('lead2', IB.i_hsaw, shift(B_L, 0, 12, 0.5), iC, gain=0.45, cutoff=9000, spread=0.014, voices=5, pan=0.35)
    sg.line('lead2', IB.i_hsaw, shift(B_L, 0, -12, 0.5), iC, gain=0.4, cutoff=3500, spread=0.01, voices=3, pan=-0.35)
    sg.line('lead2', IB.i_hsaw, BD_L, iBD, gain=0.22, cutoff=4500, spread=0.012, voices=5, a=0.15, s=0.9, r=0.4, pan=0.2)
    sg.line('vox', IB.i_vox, shift(A_V, 0, 0, 0.8), iC, gain=0.5, shift=1.2, scoop=1.5, vib=0.004, pan=0.3)
    # ---- bateria
    kit = KB.kit_trance
    K4 = 'x...x...x...x...'
    D_I = {'k': K4, 'h': '.x.x.x.x.x.x.x.x'}
    D_I2 = {'k': K4, 'o': '..x...x...x...x.', 'h': '.x.x.x.x.x.x.x.x'}
    D_A = {'k': K4, 'o': '..x...x...x...x.', 'p': '....x.......x...', 'h': '.x.x.x.x.x.x.x.x'}
    D_B = {'k': K4, 'o': '..x...x...x...x.', 'p': '....x.......x...', 'h': '.x.x.x.x.x.x.x.x', 'sh': 'xxxxxxxxxxxxxxxx', 'c': 'X...............'}
    D_BD = {'sh': 'x.x.x.x.x.x.x.x.'}
    sg.drums(kit, iI, 2, D_I, gain=1.0)
    sg.drums(kit, iI + 2, 2, D_I2, gain=1.0)
    sg.drums(kit, iA, 8, D_A, gain=0.95)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iBD, 4, D_BD, gain=0.3)
    # subida: rufo de caixa, bumbo volta no 3º compasso, lacuna antes do drop
    for b, pat in enumerate(('x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxx....')):
        sg.drums(kit, iU + b, 1, {'z': pat}, gain=0.5 + 0.15 * b)
    sg.drums(kit, iU + 2, 1, {'k': K4}, gain=0.9)
    sg.drums(kit, iU + 3, 1, {'k': 'x...x...x.......'}, gain=0.9)
    sg.drums(kit, iC, 8, D_B, gain=1.05)
    sg.drums(kit, iC + 7, 1, {'t1': '..........x.....', 't2': '............x...', 't3': '..............x.', 'z': '........x.x.x.x.'}, gain=0.7)
    # ---- efeitos: risers, pratos ao contrário, impacto do drop
    sg.sample('fx', S.riser(rng, SIX, 250, 9500, 0.3, 280), iU * 16, 0.8)
    sg.sample('fx', S.riser(rng, int(2 * 16 * sg.step_s * SR), 200, 7000, 0.0, 0.0), (iBD + 2) * 16, 0.6)
    sg.sample('fx', S.riser(rng, int(2 * 16 * sg.step_s * SR), 200, 7000, 0.0, 0.0), (iB - 2) * 16, 0.45)
    for bar in (iA, iB, iBD, iU, iC, 36):
        rev_crash(sg, bar, 0.45)
    for bar in (iA, iB, iC):
        sg.sample('fx', S.crash(rng, None, 1.4) * 0.7, bar * 16, 0.45)
    n = int(1.0 * SR)
    sg.sample('fx', np.sin(2 * np.pi * np.cumsum(S.sweep(170, 34, n)) / SR) * S.env_exp(n, 0.3), iC * 16, 0.9)
    sg.duck(['pad', 'stab', 'arp', 'piano', 'piano2', 'lead2'], 0.45, 0.12)
    sg.trim = {'bass': 1.5, 'sub': -5.0, 'piano': 2.0, 'piano2': 5.0, 'stab': 7.0, 'pad': 6.0, 'arp': 16.0, 'vox': 14.0, 'lead': 13.0, 'lead2': 11.0, 'drums': -1.5, 'fx': -4.0}
    fx = {
        'bass': [LowpassFilter(1400)],
        'sub': [LowpassFilter(300)],
        'piano': [Reverb(room_size=0.35, wet_level=0.15, dry_level=0.9)],
        'piano2': [Reverb(room_size=0.6, wet_level=0.3, dry_level=0.75)],
        'stab': [HighpassFilter(200), Reverb(room_size=0.4, wet_level=0.15, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.3, depth=0.3, mix=0.4), Reverb(room_size=0.8, wet_level=0.3, dry_level=0.75)],
        'arp': [Chorus(rate_hz=0.5, depth=0.2, mix=0.3)],
        'vox': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'lead': [Chorus(rate_hz=0.4, depth=0.2, mix=0.3), Reverb(room_size=0.4, wet_level=0.16, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'drums': [Compressor(threshold_db=-16, ratio=2.5, attack_ms=10, release_ms=90)],
    }
    sg.sends = {'vox': {'echo': 0.3}, 'lead': {'echo': 0.2}, 'arp': {'echo': 0.3}, 'stab': {'echo': 0.15}, 'fx': {'verb': 0.25}, 'piano2': {'echo': 0.2}}
    return sg, fx, aux_default(138, room=0.55, delay_fb=0.35, delay_beats=0.75)
