"""Deriva no Escuro — dub techno / espaço profundo, 118 bpm, fá menor. Bumbo macio de quatro, chimbal no contratempo, acordes 'dub' picados que
viajam num eco enorme, sub longo, coro de vogais ao fundo, vibrafone esparso, pulsar de blips ao acaso e uma nave passando (Doppler:
o tom cai e o som cruza de um lado para o outro). Forma (48 compassos, ~1:38): vazio 4 · A 8 · B 8 · quebra 4 · A' 8 · B' 8 · lavagem 8."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import kits2 as K2
import inst2 as I2
from songs.common import aux_default

M_L = parse("""
c6 - - - . . . . ab5 - - - . . . . |
. . . . g5 - - - f5 - - - . . . . |
ab5 - - - . . . . f5 - - - . . . . |
. . . . eb5 - - - db5 - - - . . . . |
bb5 - - - . . . . g5 - - - . . . . |
. . . . f5 - - - eb5 - - - . . . . |
g5 - - - . . eb5 - c5 - - - . . . . |
. . . . . . . . g5 - - - - - - - |
""")
H_A = Harmony("Fm9 Fm9 Dbmaj9 Dbmaj9 Ebmaj9 Ebmaj9 Cm7 Cm7")
H_I = Harmony("Fm9 Fm9 Fm9 Fm9")
H_BR = Harmony("Dbmaj9 Dbmaj9 Cm7 Cm7")
H_O = Harmony("Fm9 Dbmaj9 Ebmaj9 Fm9 Fm9 Fm9 Fm9 Fm9")


def stab_pat(sg, harm, bar0, steps, lo, hi, gain, **kw):
    prev = None
    for bi, ev in enumerate(harm.bars):
        pc, q = ev[0][2], ev[0][3]
        v = K.voice(prev, pc, q, lo, hi, 4)
        prev = v
        for st in steps:
            for k, m in enumerate(v):
                sg.note('stab', I2.i_stab, (bar0 + bi) * sg.spb + st, m, 2, gain=gain / len(v) ** 0.5, pan=-0.3 + 0.2 * k, **kw)


def flyby(sg, bar, step, dur_s, f0, f1, gain=0.5, left_to_right=True):
    """Nave passando: ruído filtrado cujo centro cai (Doppler) e que atravessa o estéreo."""
    n = int(dur_s * SR)
    t = np.linspace(0, 1, n)
    f = S.sweep(f0, f1, n)
    carrier = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
    nz = S.bp(sg.rng.standard_normal(n), 400, 3500, 1) * 0.6
    sig = (carrier + nz) * np.sin(np.pi * t) ** 1.5 * gain
    pan = (-1 + 2 * t) if left_to_right else (1 - 2 * t)
    a = (pan + 1.0) * np.pi / 4.0
    i = int(round(sg.t_step(bar * sg.spb + step) * SR))
    b = sg.bus('fx')
    m = min(n, sg.N - i)
    b[0, i:i + m] += sig[:m] * np.cos(a[:m])
    b[1, i:i + m] += sig[:m] * np.sin(a[:m])


def build():
    sg = K.Song(118, 48, spb=16, tail=5.0, seed=57, name='cosmos2')
    rng = sg.rng
    iI, iA, iB, iBR, iA2, iB2, iO = 0, 4, 12, 20, 24, 32, 40
    # ---- sub longo e pads
    SUB = 'R - - - - - - - - - . . R - - -'
    for h, bar in ((H_A, iA), (H_A, iB), (H_A, iA2), (H_A, iB2)):
        sg.bass('bass', I2.i_sub, h, bar, SUB, octave=34, gain=0.95, drive=0.4)
    sg.bass('bass', I2.i_sub, H_I, iI, 'R - - - - - - - - - - - - - - -', octave=34, gain=0.7)
    sg.bass('bass', I2.i_sub, H_BR, iBR, 'R - - - - - - - - - - - - - - -', octave=34, gain=0.75)
    sg.bass('bass', I2.i_sub, H_O, iO, 'R - - - - - - - - - - - - - - -', octave=34, gain=0.7)
    for h, bar, g in ((H_I, iI, 0.8), (H_A, iA, 0.6), (H_A, iB, 0.7), (H_BR, iBR, 0.85), (H_A, iA2, 0.6), (H_A, iB2, 0.7), (H_O, iO, 0.8)):
        sg.pads('pad', K.i_pad, h, bar, 48, 72, gain=g, cutoff=1100, a=1.2, r=1.5, det=0.01)
    # ---- acordes 'dub' (picados, com eco enorme): contratempos
    for h, bar, g in ((H_A, iA, 0.55), (H_A, iB, 0.6), (H_A, iA2, 0.6), (H_A, iB2, 0.65)):
        stab_pat(sg, h, bar, (2, 6, 12), 57, 76, g, cutoff=1500, tau=0.1)
    stab_pat(sg, H_O, iO, (2,), 57, 76, 0.5, cutoff=1200, tau=0.12)
    # ---- coro de vogais ao fundo (B, quebra, lavagem) e vibrafone esparso
    for h, bar, g in ((H_A, iB, 0.4), (H_BR, iBR, 0.6), (H_A, iB2, 0.45), (H_O, iO, 0.5)):
        prev = None
        for (st, ln, pc, q) in h.events():
            v = K.voice(prev, pc, q, 55, 74, 3)
            prev = v
            for k, m in enumerate(v):
                sg.note('choir', K.i_choir, bar * 16 + st, m, ln, gain=g / 1.7, pan=-0.4 + 0.4 * k, vowel='u' if k != 1 else 'o', a=0.9, r=1.2, vel=0.7)
    sg.line('lead', K.i_modal, M_L, iB, gain=0.8, kind='vibes', tilt=2.0)
    sg.line('lead', K.i_modal, M_L, iB2, gain=0.85, kind='vibes', tilt=2.2)
    sg.line('lead2', K.i_modal, shift(M_L, 0, 12, 0.5), iB2, gain=0.3, kind='bell', tilt=1.6, pan=0.35)
    sg.line('lead', K.i_modal, M_L[:8], iBR, gain=0.7, kind='glass', tilt=2.2)
    # ---- pulsar: blips agudos ao acaso (pentatônica de fá) em A' e B'
    PENT = [77, 80, 82, 84, 87, 89]
    for bar0, bars, dens in ((iA, 8, 0.05), (iB, 8, 0.08), (iA2, 8, 0.06), (iB2, 8, 0.1), (iO, 8, 0.07)):
        for st in range(bar0 * 16, (bar0 + bars) * 16):
            if rng.random() < dens:
                sg.note('pulsar', I2.i_chime, st, int(rng.choice(PENT)), 1, gain=float(rng.uniform(0.3, 0.6)), pan=float(rng.uniform(-0.9, 0.9)), tilt=0.5)
    # ---- bateria dub
    kit = K2.kit_dub
    D_A = {'k': 'x...x...x...x...', 'o': '..x...x...x...x.', 'sh': '.x.x.x.x.x.x.x.x'}
    D_B = {'k': 'x...x...x...x...', 'o': '..x...x...x...x.', 'h': 'x.x.x.x.x.x.x.x.', 'r': '....x.......x...', 'sh': '.x.xx.x..x.xx.x.'}
    sg.drums(kit, iI, 4, {'h': 'x.x.x.x.x.x.x.x.'}, gain=0.5)
    sg.drums(kit, iA, 8, D_A, gain=1.0)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iA2, 8, D_A, gain=1.0)
    sg.drums(kit, iB2, 8, D_B, gain=1.0)
    sg.drums(kit, iO, 4, {'k': 'x...............', 'o': '..x.............'}, gain=0.7)
    # ---- nave passando e varreduras
    flyby(sg, iBR, 0, 6.0, 1500, 300, gain=0.5, left_to_right=True)
    flyby(sg, iB2 + 6, 0, 7.0, 1800, 260, gain=0.55, left_to_right=False)
    flyby(sg, iO, 8, 9.0, 1300, 180, gain=0.45, left_to_right=True)
    for bar in (iB, iA2, iB2):
        sg.sample('fx', S.riser(rng, int(2 * 16 * sg.step_s * SR), 200, 6000, 0.0, 0.0) * 0.5, (bar - 2) * 16, 0.5)
    sg.duck(['pad', 'choir'], 0.35, 0.2)
    sg.trim = {'bass': -8.1, 'pad': 6.0, 'stab': 14.0, 'choir': 9.0, 'lead': 4.0, 'lead2': 14.0, 'pulsar': 8.0, 'drums': 0.0, 'fx': 2.0}
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(12), wow=0.0012, flutter=0.0003, wow_hz=0.2))
    fx = {
        'pad': [Chorus(rate_hz=0.18, depth=0.35, mix=0.5), Reverb(room_size=0.9, wet_level=0.4, dry_level=0.7)],
        'stab': [HighpassFilter(200)],
        'choir': [Reverb(room_size=0.95, wet_level=0.5, dry_level=0.5)],
        'lead': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.8)],
        'lead2': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.8)],
        'pulsar': [Reverb(room_size=0.8, wet_level=0.4, dry_level=0.6)],
        'bass': [LowpassFilter(900)],
        'drums': [],
    }
    sg.sends = {'stab': {'echo': 0.85, 'verb': 0.3}, 'lead': {'echo': 0.4}, 'pulsar': {'echo': 0.5}, 'drums': {'verb': 0.05}, 'fx': {'verb': 0.3}}
    aux = aux_default(118, room=0.92, delay_fb=0.62, delay_beats=0.75)
    aux['echo'] = [Delay(delay_seconds=60.0 / 118 * 0.75, feedback=0.62, mix=1.0), HighpassFilter(280), LowpassFilter(3200), Reverb(room_size=0.5, wet_level=0.3, dry_level=0.7)]
    return sg, fx, aux
