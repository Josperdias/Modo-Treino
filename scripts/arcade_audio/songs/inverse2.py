"""Queda Livre — drum & bass, 172 bpm, fá# menor. Uma escada de Shepard descendo (a queda que nunca chega ao chão) por baixo de tudo, quebra de
bateria em dois passos com caixas fantasma, baixo reese que balança no drop, piano líquido, coro de vogais e um 'impacto' de subgrave quando o chão some.
Forma (64 compassos, ~1:29): queda 8 · rufo 4 · DROP 16 · quebra (meio tempo) 8 · rufo 4 · DROP II 16 · pouso 8."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor, Distortion
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import kits2 as K2
import inst2 as I2
from songs.common import aux_default

HOOK = parse("""
c#6 - - - a5 - - - f#5 - c#6 - a5 - - . |
d6 - - - a5 - - - f#5 - d6 - a5 - - . |
e6 - - - c#6 - - - a5 - e6 - c#6 - - . |
e6 - - - b5 - - - g#5 - e6 - b5 - - . |
a5 - - c#6 - - f#6 - - e6 - - c#6 - - . |
a5 - - d6 - - f#6 - - e6 - - d6 - - . |
d6 - - f#6 - - b6 - - a6 - - f#6 - - . |
c#6 - - f6 - - g#6 - - f6 - - c#6 - - . |
""")
LIQ = parse("""
f#5 - - c#6 - - a5 - - f#5 - - . . . . |
d5 - - a5 - - f#5 - - d5 - - . . . . |
a4 - - e5 - - c#5 - - a4 - - . . . . |
e5 - - b5 - - g#5 - - e5 - - . . . . |
""")

H_I = Harmony("F#m9 Dmaj9 F#m9 Dmaj9 F#m9 Dmaj9 Amaj9 Amaj9")
H_A = Harmony("F#m Dmaj7 A E F#m Dmaj7 Bm C#7")
H_BD = Harmony("F#m9 Dmaj9 Amaj9 Amaj9")
H_O = Harmony("F#m9 Dmaj9 F#m9 F#m9 F#m9 F#m9 F#m9 F#m9")


def sub_boom(sg, bar, gain=0.9):
    n = int(2.6 * SR)
    y = S.kick(n, 95, 27, 0.9, 0.0) * 0.9 + 0.25 * S.sine(S.sweep(70, 25, n), n) * np.exp(-S.tt(n) / 1.2)
    sg.sample('fx', y, bar * sg.spb, gain)


def build():
    sg = K.Song(172, 64, spb=16, tail=3.5, seed=88, name='inverse2')
    rng = sg.rng
    iQ, iR1, iD1, iBK, iR2, iD2, iL = 0, 8, 12, 28, 36, 40, 56
    # ---- a queda: Shepard descendo por baixo de tudo (toda a introdução e a quebra) + vento
    n_i = int(8 * 16 * sg.step_s * SR)
    sh = S.shepard(n_i, start_oct=0.0, rate=-0.12, f0=55.0, voices=9) * 0.3
    sg.sample('fall', sh, iQ * 16, 0.6)
    n_b = int(8 * 16 * sg.step_s * SR)
    sg.sample('fall', S.shepard(n_b, start_oct=0.0, rate=-0.12, f0=55.0, voices=9) * 0.3, iBK * 16, 0.5)
    for bar in (iQ, iBK, iL):
        nn = int(8 * 16 * sg.step_s * SR)
        wind = S.bp(rng.standard_normal(nn), 400, 2800, 1) * np.linspace(0.2, 1.0, nn) ** 1.5 * 0.35
        sg.sample('wind', wind, bar * 16, 0.5)
    # ---- harmonia: pads, coro e piano líquido
    sg.pads('pad', K.i_pad, H_I, iQ, 50, 74, gain=0.6, cutoff=1500, a=0.8, r=1.0)
    sg.pads('pad', K.i_pad, H_BD, iBK, 50, 74, gain=0.7, cutoff=1600, a=0.8, r=1.0)
    sg.pads('pad', K.i_pad, H_BD, iBK + 4, 50, 74, gain=0.7, cutoff=1600, a=0.8, r=1.0)
    sg.pads('pad', K.i_pad, H_O, iL, 50, 74, gain=0.6, cutoff=1200, a=0.8, r=1.4)
    for h, bar, g in ((H_I, iQ, 0.5), (H_BD, iBK, 0.6), (H_BD, iBK + 4, 0.6), (H_O, iL, 0.5)):
        prev = None
        for (st, ln, pc, q) in h.events():
            v = K.voice(prev, pc, q, 57, 76, 3)
            prev = v
            for k, m in enumerate(v):
                sg.note('choir', K.i_choir, bar * 16 + st, m, ln, gain=g / 1.7, pan=-0.4 + 0.4 * k, vowel='a' if k != 1 else 'o', a=0.8, r=1.0, vel=0.7)
    for bar in (iBK, iBK + 4):
        sg.line('lead2', K.i_fmep, LIQ, bar, gain=0.8, tau=1.2, bright=0.8)
    # ---- baixo: reese (drop) e subgrave
    RS = 'R - - - - - - - . . R - - - 5 -'
    RS2 = 'R - - - - - . . R - - - 5 - R -'
    for h, bar, pat in ((H_A, iD1, RS), (H_A, iD1 + 8, RS2), (H_A, iD2, RS2), (H_A, iD2 + 8, RS)):
        sg.bass('bass', I2.i_reese, h, bar, pat, octave=30, gain=1.0, cutoff=900, wob_hz=0.0 if bar < iD2 else 2.87)
        sg.bass('sub', I2.i_sub, h, bar, pat, octave=30, gain=0.8)
    sg.bass('sub', I2.i_sub, H_O, iL, 'R - - - - - - - - - - - - - - -', octave=30, gain=0.7)
    # ---- melodia do drop (serra larga) e contracanto
    sg.line('lead', K.i_super, HOOK, iD1, gain=0.8, cutoff=4200, spread=0.012)
    sg.line('lead', K.i_super, HOOK, iD1 + 8, gain=0.85, cutoff=4800, spread=0.014)
    sg.line('lead', K.i_super, HOOK, iD2, gain=0.85, cutoff=5200, spread=0.016)
    sg.line('lead2', K.i_super, shift(HOOK, 0, 12, 0.5), iD2 + 8, gain=0.4, cutoff=6000, spread=0.012, pan=0.35)
    sg.line('lead', K.i_super, HOOK, iD2 + 8, gain=0.85, cutoff=5200, spread=0.016)
    sg.line('lead2', K.i_modal, shift(LIQ, 0, 12, 0.6), iL, gain=0.45, kind='glass', tilt=1.8)
    # ---- bateria
    kit = K2.kit_dnb
    D_I = {'r': 'x.x.x.x.x.x.x.x.'}
    D_A = {'k': 'x.........x.....', 's': '....x.......x...', 'g': '.......o...o...o', 'h': 'x.x.x.x.x.x.x.xx', 'o': '..............x.'}
    D_A2 = {'k': 'x.x.......x.....', 's': '....x.......x..x', 'g': '.......o..o....o', 'h': 'xxxxxxxxxxxxxxxx', 'o': '......x.......x.', 'c': 'X...............'}
    D_BK = {'k': 'x.......x.......', 's': '........x.......', 'h': 'x...x...x...x...', 'r': '..x...x...x...x.'}
    sg.drums(kit, iQ, 8, D_I, gain=0.4)
    sg.drums(kit, iD1, 8, D_A, gain=1.0)
    sg.drums(kit, iD1 + 8, 8, D_A2, gain=1.0)
    sg.drums(kit, iBK, 8, D_BK, gain=0.7)
    sg.drums(kit, iD2, 8, D_A, gain=1.0)
    sg.drums(kit, iD2 + 8, 8, D_A2, gain=1.05)
    sg.drums(kit, iL, 4, {'k': 'x.........x.....', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}, gain=0.7)
    # rufos antes de cada drop (caixa acelerando) e viradas
    for r0 in (iR1, iR2):
        for b, pat in enumerate(('x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx')):
            sg.drums(kit, r0 + b, 1, {'s': pat, 'k': 'x.......x.......' if b < 2 else ''}, gain=0.7 + 0.1 * b)
        sg.sample('fx', S.riser(rng, int(4 * 16 * sg.step_s * SR), 250, 9000, 0.25, 260), r0 * 16, 0.7)
    sub_boom(sg, iD1)
    sub_boom(sg, iD2)
    for bar in (iD1, iD1 + 8, iD2, iD2 + 8, iL):
        y = S.reverse(S.crash(rng, int(1.4 * SR), 0.5))
        t0 = sg.t_step(bar * 16) - len(y) / SR
        if t0 >= 0:
            sg.put('fx', y * 0.7, t0, 0.5)
    sg.duck(['pad', 'choir', 'lead2'], 0.4, 0.1)
    sg.trim = {'bass': 6.3, 'sub': -6.6, 'pad': 9.0, 'choir': 8.0, 'lead': 14.0, 'lead2': -1.0, 'fall': 9.0, 'wind': 8.0, 'drums': 0.0, 'fx': 0.0}
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(3), drive=1.2, lp_hz=12500, hiss_level=0.002))
    fx = {
        'pad': [Chorus(rate_hz=0.3, depth=0.3, mix=0.4), Reverb(room_size=0.85, wet_level=0.35, dry_level=0.75)],
        'choir': [Reverb(room_size=0.9, wet_level=0.45, dry_level=0.55)],
        'lead': [Reverb(room_size=0.4, wet_level=0.15, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.6, wet_level=0.3, dry_level=0.8)],
        'bass': [Distortion(drive_db=6), LowpassFilter(2200)],
        'sub': [LowpassFilter(180)],
        'fall': [Reverb(room_size=0.9, wet_level=0.3, dry_level=0.8)],
        'wind': [HighpassFilter(300)],
        'drums': [Compressor(threshold_db=-16, ratio=2.5, attack_ms=8, release_ms=80)],
    }
    sg.sends = {'lead': {'echo': 0.2}, 'lead2': {'echo': 0.3, 'verb': 0.2}, 'fx': {'verb': 0.3}, 'drums': {'verb': 0.04}}
    return sg, fx, aux_default(172, room=0.6, delay_fb=0.35, delay_beats=0.75)
