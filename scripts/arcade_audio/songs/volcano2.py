"""Ritual de Magma — taiko e metal em compasso de 5/4, 108 bpm, ré frígio dominante. Bordão de serras que respira, riff de baixo distorcido em grupos de
3+3+2+2+3+3+2+2, taikos graves, canos de metal e gongo, metais chamando e coro de vogais cantando. A lava borbulha na quebra (bolhas graves) e um
rumor de ruído sobe antes da erupção. Forma (32 compassos de 5/4, ~1:29): rumor 4 · A 8 · B 8 · quebra 4 · A' 8."""
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

SPB = 20
RIFF = parse("""
d3 - - d3 - - f3 - d3 - eb3 - - d3 - - f#3 - g3 - |
""", SPB)
RIFF2 = parse("""
d3 - - d3 - - f3 - d3 - eb3 - - d3 - - c3 - d3 - |
""", SPB)
P1 = parse("""
d5 - - - - - eb5 - f#5 - - - g5 - - - f#5 - eb5 - |
d5 - - - - - c5 - d5 - - - a4 - - - bb4 - a4 - |
eb5 - - - g5 - - - bb5 - - - a5 - - - g5 - eb5 - |
d5 - - d5 - - f#5 - a5 - - - bb5 - a5 - f#5 - d5 - |
""", SPB)
P2 = parse("""
a5 - - - - - bb5 - a5 - - - g5 - - - f#5 - eb5 - |
d6 - - - - - c6 - bb5 - - - a5 - - - g5 - f#5 - |
eb6 - - - d6 - - - bb5 - - - g5 - - - a5 - bb5 - |
a5 - - a5 - - f#5 - d5 - - - eb5 - f#5 - d5 - - - |
""", SPB)
H_A = Harmony("D5 D5 Eb5 D5 G5 D5 Eb5 D5", SPB)
H_B = Harmony("D5 D5 Eb5 D5 Bb5 A5 Eb5 D5", SPB)
H_I = Harmony("D5 D5 D5 D5", SPB)
H_BR = Harmony("Eb5 Eb5 D5 D5", SPB)


def gong(sg, bar, gain=0.8):
    sg.sample('gong', S.modal(92, int(4.0 * SR), 'bowl', 2.6) * 0.9, bar * SPB, gain)


def rumble(sg, bar0, bars, gain=0.5, rise=True):
    n = int(bars * SPB * sg.step_s * SR)
    x = S.lp(sg.rng.standard_normal(n), 140, 2) * 3.0
    env = np.linspace(0.2, 1.0, n) ** (1.6 if rise else 1.0)
    sg.sample('rumble', x * env, bar0 * SPB, gain)


def build():
    sg = K.Song(108, 32, spb=SPB, tail=4.0, seed=93, name='volcano2')
    rng = sg.rng
    iI, iA, iB, iBR, iA2 = 0, 4, 12, 20, 24
    # ---- bordão e rumor
    for h, bar, g in ((H_I, iI, 0.8), (H_A, iA, 0.7), (H_B, iB, 0.75), (H_BR, iBR, 0.8), (H_A, iA2, 0.75)):
        for (st, ln, pc, q) in h.events():
            base = 38 + ((pc - 38) % 12)
            sg.note('drone', I2.i_drone, bar * SPB + st, base, ln, gain=g, cutoff=520)
            sg.note('drone', I2.i_drone, bar * SPB + st, base + 7, ln, gain=g * 0.6, cutoff=480, pan=0.2)
    rumble(sg, iI, 4, 0.7)
    rumble(sg, iBR + 2, 2, 0.7)
    # ---- riff de baixo (distorcido) em A, B e A' (variação)
    for bar in range(iA, iA + 8):
        sg.line('bass', K.i_fmbass, RIFF if bar % 4 != 3 else RIFF2, bar, gain=0.9, tau=0.4, index=2.2)
    for bar in range(iB, iB + 8):
        sg.line('bass', K.i_fmbass, RIFF if bar % 4 != 3 else RIFF2, bar, gain=0.9, tau=0.4, index=2.6)
        sg.line('bass2', K.i_brass, shift(RIFF, 0, 12, 0.7) if bar % 4 != 3 else shift(RIFF2, 0, 12, 0.7), bar, gain=0.35, cutoff=1600)
    for bar in range(iA2, iA2 + 8):
        sg.line('bass', K.i_fmbass, RIFF if bar % 4 != 3 else RIFF2, bar, gain=0.95, tau=0.4, index=2.8)
        sg.line('bass2', K.i_brass, shift(RIFF, 0, 12, 0.7) if bar % 4 != 3 else shift(RIFF2, 0, 12, 0.7), bar, gain=0.4, cutoff=1800)
    sg.bass('bass', I2.i_sub, H_BR, iBR, 'R - - - - - - - - - - - - - - - - - - -', octave=33, gain=0.8)
    # ---- metais chamando (B e A') e coro cantando
    sg.line('lead', K.i_brass, P1, iB, gain=0.8, cutoff=2400)
    sg.line('lead', K.i_brass, P2, iB + 4, gain=0.85, cutoff=2600)
    sg.line('lead', K.i_brass, P1, iA2, gain=0.85, cutoff=2600)
    sg.line('lead2', K.i_brass, shift(P1, 0, -12, 0.6), iA2, gain=0.4, cutoff=1400, pan=-0.3)
    sg.line('lead', K.i_brass, P2, iA2 + 4, gain=0.9, cutoff=3000)
    sg.line('lead2', K.i_brass, shift(P2, 0, -12, 0.6), iA2 + 4, gain=0.4, cutoff=1500, pan=0.3)
    for h, bar, g in ((H_B, iB, 0.5), (H_BR, iBR, 0.7), (H_A, iA2, 0.5)):
        prev = None
        for (st, ln, pc, q) in h.events():
            v = K.voice(prev, pc, q, 45, 67, 3)
            prev = v
            for k, m in enumerate(v):
                sg.note('choir', K.i_choir, bar * SPB + st, m, ln, gain=g / 1.7, pan=-0.4 + 0.4 * k, vowel='o' if k != 1 else 'a', a=0.5, r=0.9, vel=0.8)
    # ---- bolhas graves de lava na quebra
    for st in range(iBR * SPB, (iBR + 4) * SPB):
        if rng.random() < 0.22:
            sg.note('bub', K.i_bub, st, int(rng.choice([38, 41, 43, 45, 50])), 3, gain=float(rng.uniform(0.5, 0.9)), pan=float(rng.uniform(-0.7, 0.7)), rise=float(rng.uniform(0.2, 0.4)), tau=float(rng.uniform(0.07, 0.14)))
    # ---- percussão em 5/4: grupos 3+3+2+2+3+3+2+2
    kit = K2.kit_ritual
    G = [0, 3, 6, 8, 10, 13, 16, 18]

    def pat(steps, ch='x'):
        s = ['.'] * SPB
        for i in steps:
            s[i] = ch
        return ''.join(s)
    D_I = {'g': pat([0], 'x')}
    D_A = {'k': pat(G), 'd': pat([8, 18], 'x'), 'sh': pat(range(0, SPB, 2), 'o'), 'p': pat([10], 'x')}
    D_B = {'k': pat(G), 'd': pat([3, 8, 13, 18], 'x'), 't1': pat([6, 16], 'x'), 'sh': pat(range(SPB), 'o'), 'p': pat([0, 10], 'x'), 'c': pat([0], 'X')}
    D_BR = {'k': pat([0, 3, 6]), 't1': pat([8, 10, 13]), 't2': pat([16, 18]), 'p': pat([0, 8, 13])}
    sg.drums(kit, iI, 4, D_I, gain=0.5)
    sg.drums(kit, iA, 8, D_A, gain=1.0)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iBR, 4, D_BR, gain=0.95)
    sg.drums(kit, iA2, 8, D_B, gain=1.05)
    # gongos e canos nas viradas; erupção (riser + prato ao contrário) antes de A'
    for bar in (iA, iB, iBR, iA2):
        gong(sg, bar, 0.7)
    y = S.reverse(S.crash(rng, int(2.2 * SR), 0.8))
    t0 = sg.t_step(iA2 * SPB) - len(y) / SR
    sg.put('fx', y * 0.9, t0, 0.7)
    sg.sample('fx', S.riser(rng, int(3 * SPB * sg.step_s * SR), 120, 6000, 0.3, 80), (iA2 - 3) * SPB, 0.6)
    sg.duck(['drone', 'choir'], 0.3, 0.2)
    sg.trim = {'drone': 0.2, 'rumble': 2.3, 'bass': -4.2, 'bass2': 8.5, 'lead': 9.7, 'lead2': 12.2, 'choir': 13.4, 'bub': 4.0, 'gong': 2.0, 'drums': -2.4, 'fx': 0.0}
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(30), drive=1.5, lp_hz=11000, hiss_level=0.003))
    fx = {
        'drone': [Reverb(room_size=0.85, wet_level=0.3, dry_level=0.8)],
        'rumble': [LowpassFilter(220)],
        'bass': [Distortion(drive_db=9), LowpassFilter(2400)],
        'bass2': [Distortion(drive_db=5), Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'lead': [Reverb(room_size=0.7, wet_level=0.28, dry_level=0.85)],
        'lead2': [Reverb(room_size=0.7, wet_level=0.28, dry_level=0.85)],
        'choir': [Reverb(room_size=0.95, wet_level=0.5, dry_level=0.5)],
        'bub': [Reverb(room_size=0.6, wet_level=0.25, dry_level=0.8)],
        'gong': [Reverb(room_size=0.9, wet_level=0.35, dry_level=0.75)],
        'drums': [Reverb(room_size=0.35, wet_level=0.15, dry_level=0.9), Compressor(threshold_db=-16, ratio=2.4, attack_ms=10, release_ms=120)],
    }
    sg.sends = {'lead': {'echo': 0.2}, 'fx': {'verb': 0.3}, 'drums': {'verb': 0.08}}
    return sg, fx, aux_default(108, room=0.8, delay_fb=0.3, delay_beats=1.0)
