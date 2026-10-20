"""Valsa de Giz — valsa em 3/4, 96 bpm (semínima), ré menor. Pizzicato de cordas (oom-pah-pah), piano seco, um violino que 'desenha arcos' e
traços de giz (ruído estreito que sobe e desce em arco). O truque: a mão esquerda é o ESPELHO (inversão diatônica) da direita e, na ponte, a
frase inteira volta de trás para frente (melodia E harmonia em retrógrado) enquanto os lados esquerdo/direito trocam (o controle inverte).
Forma (32 compassos de 3/4, ~1:00): giz 4 · tema 8 · arcos (violino) 8 · ponte retrógrada 4 · tema com espelho 8."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony, invert, retro, fit
import inst2 as I2
import inst_b as IB
import kits_b as KB
from songs.common import aux_default

SPB = 12
A_L = parse("""
a4 - - - d5 - e5 - f5 - - - |
g5 - - - f5 - e5 - d5 - - - |
f5 - a5 - d6 - - - c6 - a5 - |
c#6 - - - e6 - d6 - c#6 - - - |
a5 - - - c6 - a5 - f5 - - - |
bb5 - - - d6 - c6 - bb5 - g5 - |
a5 - c#6 - e6 - - - g6 - f6 - |
d6 - - - a5 - - - d5 - - - |
""", SPB)
B_L = parse("""
d6 - - - c6 - bb5 - d6 - f6 - |
a5 - - - c6 - f6 - e6 - d6 - |
bb5 - - - d6 - g6 - f6 - d6 - |
a5 - - - d6 - f6 - a6 - - - |
g6 - - - f6 - d6 - bb5 - - - |
a5 - c6 - f6 - - - c6 - a5 - |
e6 - - - c#6 - e6 - g6 - e6 - |
c#6 - - - a5 - - - e5 - - - |
""", SPB)
H_I = Harmony("Dm Gm A7 Dm", SPB)
H_A = Harmony("Dm Gm Dm A7 F Gm A7 Dm", SPB)
H_B = Harmony("Bb F Gm Dm Bb F A7 A7", SPB)
H_A4 = Harmony("Dm Gm Dm A7", SPB)
H_BR = Harmony("A7 Dm Gm Dm", SPB)   # a harmonia do começo do tema, de trás para frente
BR_L = retro([n for n in A_L if n[0] < 4 * SPB], 4 * SPB)


def arc_sound(rng, n, f_lo, f_hi):
    """Risco de giz que sobe e desce em arco (a frequência central e o volume desenham a curva)."""
    t = np.linspace(0, 1, n)
    fc = f_lo * (f_hi / f_lo) ** np.sin(np.pi * t)
    x = rng.standard_normal(n)
    y = np.zeros(n)
    for c in np.geomspace(f_lo / 1.4, f_hi * 1.4, 10):
        y += S.bp(x, c / 1.3, c * 1.3, 1) * np.exp(-(np.log2(fc / c) / 0.4) ** 2)
    tt = np.arange(n) / SR
    return y * np.sin(np.pi * t) ** 0.8 * (0.65 + 0.35 * np.sin(2 * np.pi * 37 * tt)) * 0.8


def arc(sg, bar, step, bars, f_lo=900, f_hi=5200, gain=0.4, pan=0.0):
    n = int(bars * SPB * sg.step_s * SR)
    sg.sample('chalk', arc_sound(sg.rng, n, f_lo, f_hi), bar * SPB + step, gain, pan)


def pizz_chords(sg, harm, bar0, steps, lo, hi, gain, **kw):
    prev = None
    for bi, ev in enumerate(harm.bars):
        pc, q = ev[0][2], ev[0][3]
        v = K.voice(prev, pc, q, lo, hi, 3)
        prev = v
        for st in steps:
            for k, m in enumerate(v):
                sg.note('pizz', IB.i_pizz, (bar0 + bi) * SPB + st, m, 2, gain=gain / len(v) ** 0.5, pan=-0.3 + 0.3 * k, **kw)


def mirror(notes, harm, axis=79, drop=24):
    """A mão esquerda = ESPELHO da direita: cada nota é refletida em torno de sol5 (o contorno sobe quando o original desce), cai duas oitavas
    e é ajustada à escala do compasso (ré menor natural; harmônica sobre o A7) e, no tempo 1, ao tom do acorde."""
    out = []
    for (s, m, l, v) in notes:
        b = min(len(harm.bars) - 1, s // SPB)
        pc, q = harm.bars[b][0][2], harm.bars[b][0][3]
        chord = {(pc + i) % 12 for i in K.QUAL[q]}
        scale = {2, 4, 5, 7, 9, 10, 1} if q == '7' else {2, 4, 5, 7, 9, 10, 0}
        m2 = 2 * axis - m - drop
        allowed = chord if s % SPB == 0 else (scale | chord)
        cands = [m2 + d for d in (0, 1, -1, 2, -2, 3, -3) if (m2 + d) % 12 in allowed]
        out.append((s, min(cands, key=lambda x: (abs(x - m2), x)) if cands else m2, l, v))
    return out


def build():
    sg = K.Song(96, 32, spb=SPB, tail=3.0, seed=61, name='sketch2')
    rng = sg.rng
    iI, iA, iB, iBR, iA2 = 0, 4, 12, 20, 24
    # ---- baixo e pizzicato (oom-pah-pah)
    for h, bar, pat, g in ((H_I, iI, 'R - - - . . . . . . . .', 0.6), (H_A, iA, 'R - - - . . . . . . . .', 0.85), (H_B, iB, 'R - - - . . . . 5 - - .', 0.85),
                           (H_BR, iBR, 'R - - - . . . . . . . .', 0.8), (H_A, iA2, 'R - - - . . . . 5 - - .', 0.9)):
        sg.bass('bass', I2.i_walk, h, bar, pat, octave=38, gain=g, tau=0.5)
    for h, bar, g in ((H_I, iI, 0.35), (H_A, iA, 0.5), (H_B, iB, 0.5), (H_BR, iBR, 0.5), (H_A, iA2, 0.55)):
        pizz_chords(sg, h, bar, (4, 8), 55, 72, g)
    # ---- giz: arcos na intro (cada um um compasso e meio) e na ponte
    for b, (lo, hi) in enumerate(((900, 3800), (1200, 5200), (700, 3000), (1500, 6500))):
        arc(sg, iI + b, 0, 1, lo, hi, 0.45, pan=-0.5 if b % 2 == 0 else 0.5)
    arc(sg, iBR, 0, 2, 800, 5000, 0.5, pan=-0.6)
    arc(sg, iBR + 2, 0, 2, 800, 5000, 0.5, pan=0.6)
    arc(sg, iA2 - 1, 0, 1, 700, 6000, 0.35)
    # ---- intro: o início do tema nos pizzicatos
    sg.line('lead', IB.i_pizz, shift(A_L[:6], 0, 0, 0.8), iI, gain=0.7, pan=0.2)
    sg.line('lead', IB.i_pizz, shift(A_L[:6], 0, 0, 0.8), iI + 2, gain=0.7, pan=-0.2)
    # ---- tema A (piano), 8 compassos
    sg.line('lead', IB.i_piano, A_L, iA, gain=0.9, tau=0.55)
    # ---- arcos B: o violino 'desenha' e o piano acompanha em acordes quebrados
    sg.line('lead', IB.i_bow, B_L, iB, gain=0.85, a=0.12, vib=0.007)
    sg.line('lead2', IB.i_piano, shift(B_L, 0, -12, 0.55), iB, gain=0.35, tau=0.5, pan=-0.3)
    sg.pads('str', IB.i_strings, H_B, iB, 48, 66, gain=0.5, a=0.5, r=0.6, cutoff=1700)
    # ---- ponte retrógrada: a frase de trás para frente; esquerda e direita trocam no meio (pan)
    bl = [n for n in BR_L]
    first = [n for n in bl if n[0] < 2 * SPB]
    second = [(s - 2 * SPB, m, l, v) for (s, m, l, v) in bl if s >= 2 * SPB]
    sg.line('lead', IB.i_piano, first, iBR, gain=0.9, tau=0.7, pan=-0.55)
    sg.line('lead', IB.i_piano, second, iBR + 2, gain=0.9, tau=0.7, pan=0.55)
    mir = mirror(bl, H_BR)
    mfirst = [n for n in mir if n[0] < 2 * SPB]
    msecond = [(s - 2 * SPB, m, l, v) for (s, m, l, v) in mir if s >= 2 * SPB]
    sg.line('lead2', IB.i_piano, mfirst, iBR, gain=0.7, tau=0.8, pan=0.55)
    sg.line('lead2', IB.i_piano, msecond, iBR + 2, gain=0.7, tau=0.8, pan=-0.55)
    sg.line('lead2', K.i_modal, shift(bl, 0, 12, 0.45), iBR, gain=0.2, kind='glass', tilt=1.2, pan=0.0)
    sg.pads('str', IB.i_strings, H_BR, iBR, 48, 66, gain=0.6, a=0.6, r=0.8, cutoff=1500)
    # ---- tema final: direita (piano + violino em oitava) e esquerda em ESPELHO
    sg.line('lead', IB.i_piano, A_L, iA2, gain=0.9, tau=0.55, pan=0.15)
    sg.line('lead2', IB.i_bow, shift(A_L, 0, 12, 0.6), iA2, gain=0.35, a=0.12, pan=0.35)
    sg.line('lead2', IB.i_piano, mirror(A_L, H_A), iA2, gain=0.75, tau=0.7, pan=-0.35)
    sg.pads('str', IB.i_strings, H_A, iA2, 48, 66, gain=0.5, a=0.5, r=0.8, cutoff=1700)
    # ---- percussão de giz
    kit = KB.kit_chalk
    D_I = {'h': '..x...x...x.'}
    D_A = {'k': 'x...........', 's': '....x...x...', 'h': '..o...o...o.'}
    D_B = {'k': 'x.......o...', 's': '....x...x...', 'h': '.xox.xox.xox', 'w': '..........x.'}
    D_BR = {'k': 'x...........', 'r': '....x...x...'}
    sg.drums(kit, iI, 4, D_I, gain=0.6)
    sg.drums(kit, iA, 8, D_A, gain=0.8)
    sg.drums(kit, iB, 8, D_B, gain=0.85)
    sg.drums(kit, iBR, 4, D_BR, gain=0.8)
    sg.drums(kit, iA2, 8, D_B, gain=0.9)
    for bar in (iB - 1, iBR - 1, iA2 - 1):
        sg.drums(kit, bar, 1, {'t1': '........x...', 't2': '.........x..', 't3': '..........x.', 's': 'x.x.x.......'}, gain=0.7)
    # sinos de vidro: um por seção e a cadência final
    for bar in (iA, iB, iA2):
        sg.note('chime', I2.i_chime, bar * SPB, 86, 6, gain=0.4, tilt=1.4)
        sg.note('chime', I2.i_chime, bar * SPB, 74, 6, gain=0.35, tilt=1.6, pan=0.3)
    sg.duck(['str'], 0.25, 0.12, steps=[b * SPB for b in range(32)])
    sg.trim = {'bass': 3.5, 'pizz': 16.0, 'lead': 4.5, 'lead2': 1.0, 'str': 8.0, 'chalk': 2.0, 'drums': 6.0, 'chime': 8.0}
    fx = {
        'lead': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.92)],
        'lead2': [Reverb(room_size=0.35, wet_level=0.2, dry_level=0.9)],
        'pizz': [Reverb(room_size=0.25, wet_level=0.12, dry_level=0.92)],
        'bass': [LowpassFilter(1200)],
        'str': [Chorus(rate_hz=0.3, depth=0.25, mix=0.35), Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'chalk': [HighpassFilter(500)],
        'drums': [Compressor(threshold_db=-20, ratio=2.0, attack_ms=10, release_ms=90)],
        'chime': [Reverb(room_size=0.8, wet_level=0.35, dry_level=0.7)],
    }
    sg.sends = {'lead': {'verb': 0.15, 'echo': 0.08}, 'lead2': {'verb': 0.15}, 'chime': {'verb': 0.2}, 'chalk': {'verb': 0.1}}
    return sg, fx, aux_default(96, room=0.45, delay_fb=0.25, delay_beats=1.5)
