"""Gigue do Convés — jig de marinheiros em 6/8, 124 bpm (por colcheia pontuada), sol mixolídio. Acordeão no oom-pah-pah, rabeca e apito de lata
cantando o tema, bodhran, colheres e botas no convés, baixo de contrabaixo em raiz-e-quinta, gritos de 'HEY!' da tripulação e o sino de bordo.
O tema A (oito compassos) volta variado (acordeão com oitava, depois rabeca com 'cuts' de enfeite), o B sobe para a região do apito e uma ponte
de canto de maré (coro e acordeão lentos, mar ao fundo) prepara a última volta. Grade: 12 passos (semicolcheias) por compasso, 'bpm' do motor = 124 x 1,5.
Forma (64 compassos, ~1:02): convés 4 · A 8 · A2 8 · B 8 · B2 8 · ponte 8 · A3 8 · B3 8 · saída 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_d as ID
import kits_d as KD
from songs.common import aux_default

SPB = 12
H_I = Harmony("G F G G", SPB)
H_A = Harmony("G G F G C G Am_Dm G", SPB)
H_B = Harmony("Em Em C G Em Am F_C G", SPB)
H_BR = Harmony("Am F C G Am F Dm_G G", SPB)
H_O = Harmony("C G Am_Dm G", SPB)

A1 = parse("""
d5 - d5 - b4 - g4 - b4 - d5 - |
g5 - - - e5 - d5 - b4 - a4 - |
a4 - c5 - f5 - - - e5 - c5 - |
d5 - b4 - g4 - a4 - b4 - - - |
c5 - e5 - g5 - - - e5 - c5 - |
d5 - b4 - g4 - b4 - d5 - g5 - |
a4 - c5 - e5 - f5 - a5 - f5 - |
g4 - b4 - d5 - g5 - - - - - |
""", SPB)
A2_TAIL = parse("""
e5 - g5 - c6 - - - g5 - e5 - |
d5 - g5 - b5 - - - a5 - g5 - |
a5 - c6 - e6 - d6 - c6 - a5 - |
g5 - b5 - d6 - g6 - - - - - |
""", SPB)
A2 = [n for n in A1 if n[0] < 4 * SPB] + [(4 * SPB + s, m, l, v) for (s, m, l, v) in A2_TAIL]
B1 = parse("""
e5 - g5 - b5 - - - g5 - e5 - |
g5 - b5 - e6 - - - d6 - b5 - |
c6 - - - g5 - e5 - g5 - c6 - |
b5 - a5 - g5 - - - - - d5 - |
e5 - g5 - b5 - e6 - - - b5 - |
a5 - c6 - e6 - - - c6 - a5 - |
a5 - - - f5 - g5 - e5 - c5 - |
d5 - g5 - b5 - d6 - - - - - |
""", SPB)
B3 = [n for n in B1 if n[0] < 7 * SPB] + [(7 * SPB + s, m, l, v) for (s, m, l, v) in parse("g5 - b5 - d6 - g6 - - - - -", SPB)]
BR = parse("""
e5 - - - - - c5 - - - - - |
a4 - - - - - c5 - - - - - |
e5 - - - - - g5 - - - - - |
d5 - - - b4 - - - g4 - - - |
e5 - - - a5 - - - c6 - - - |
a5 - - - f5 - - - c5 - - - |
f5 - - - - - b4 - - - - - |
g4 - - - - - - - - - - - |
""", SPB)
TEASE = parse("""
a4 - c5 - e5 - f5 - a5 - f5 - |
g4 - b4 - d5 - g5 - - - - - |
""", SPB)
MIXO = {7, 9, 11, 0, 2, 4, 5}


def cuts(notes, pcs=MIXO):
    """Enfeite de rabeca: antes de notas longas coloca uma 'cut' (nota vizinha acima, 1 passo) encurtando a nota anterior."""
    notes = sorted(notes)
    res = []
    for i, (s, m, l, v) in enumerate(notes):
        if l >= 4 and i > 0:
            ps, pm, pl, pv = notes[i - 1]
            if ps + pl == s and pl >= 2 and res and res[-1][0] == ps:
                res[-1] = (ps, pm, pl - 1, pv)
                up = m + 1
                while up % 12 not in pcs:
                    up += 1
                res.append((s - 1, up, 1, v * 0.8))
        res.append((s, m, l, v))
    return res


def oompah(sg, harm, bar0, gain=0.5, steps=(2, 4, 8, 10), lo=55, hi=71, pan=0.2):
    """Acordeão do jig: a mão esquerda marca o baixo (outra parte) e a direita faz 'pah' nos contratempos das colcheias."""
    evs = harm.events()
    prev, voiced = None, {}
    for e in evs:
        v = K.voice(prev, e[2], e[3], lo, hi, 3)
        prev = v
        voiced[e[0]] = v
    for bi in range(len(harm)):
        for s in steps:
            ab = bi * SPB + s
            e = [x for x in evs if x[0] <= ab < x[0] + x[1]][-1]
            vv = voiced[e[0]]
            for k, m in enumerate(vv):
                sg.note('acc', ID.i_accordion, bar0 * SPB + ab, m, 2, gain=gain / len(vv) ** 0.5, pan=pan + 0.1 * (k - 1), vel=0.85 if s in (2, 8) else 0.65, a=0.01, r=0.04)


def hey(sg, bar, step=0, gain=0.7):
    for m, vw in ((50, 'a'), (55, 'e'), (59, 'a')):
        sg.note('shout', ID.i_shout, bar * SPB + step, m, 3, gain=gain, vowel=vw, vel=1.0)


def build():
    sg = K.Song(124 * 1.5, 64, spb=SPB, tail=4.0, seed=606, name='ocean4')
    rng = sg.rng
    iI, iA, iA2, iB, iB2, iBr, iA3, iB3, iO = 0, 4, 12, 20, 28, 36, 44, 52, 60

    # ---- contrabaixo: raiz e quinta (oom), sustentado no convés e na ponte
    OOM = 'R - - . . . 5 - - . . .'
    LONG = 'R - - - - - - - - - - -'
    sg.bass('bass', I2.i_walk, H_I, iI, LONG, octave=36, gain=0.55, tau=0.7)
    for h, bar, g in ((H_A, iA, 0.9), (H_A, iA2, 0.9), (H_B, iB, 0.95), (H_B, iB2, 0.95), (H_A, iA3, 1.0), (H_B, iB3, 1.0), (H_O, iO, 0.8)):
        sg.bass('bass', I2.i_walk, h, bar, OOM, octave=36, gain=g, tau=0.5)
    sg.bass('bass', I2.i_walk, H_BR, iBr, 'R - - - - - 5 - - - - -', octave=36, gain=0.7, tau=0.7)

    # ---- acordeão: pah nos contratempos; na ponte, acordes longos
    oompah(sg, H_A, iA, 0.45)
    oompah(sg, H_A, iA2, 0.35)
    oompah(sg, H_B, iB, 0.5)
    oompah(sg, H_B, iB2, 0.5)
    oompah(sg, H_A, iA3, 0.5)
    oompah(sg, H_B, iB3, 0.5)
    oompah(sg, H_O, iO, 0.4)
    sg.pads('acc', ID.i_accordion, H_I, iI, 50, 67, gain=0.5, n=3, a=0.4, r=0.6, cutoff=2200)
    sg.pads('acc', ID.i_accordion, H_BR, iBr, 52, 70, gain=0.55, n=3, a=0.25, r=0.5, cutoff=2400)

    # ---- tema: rabeca (A), acordeão + rabeca em oitava (A2), rabeca + apito (B, B2), ponte, A3 e B3 com enfeites
    sg.line('whistle', ID.i_whistle, TEASE, iI + 2, gain=0.5)
    sg.line('fid', ID.i_fiddle, A1, iA, gain=0.95)
    sg.line('accm', ID.i_accordion, A2, iA2, gain=0.85)
    sg.line('fid', ID.i_fiddle, shift(A2, 0, 12, 0.8), iA2, gain=0.55, pan=0.25)
    sg.line('fid', ID.i_fiddle, B1, iB, gain=0.95)
    sg.line('whistle', ID.i_whistle, shift(B1, 0, 12, 0.6), iB, gain=0.35, pan=0.3)
    sg.line('fid', ID.i_fiddle, cuts(B1), iB2, gain=1.0)
    sg.line('accm', ID.i_accordion, B1, iB2, gain=0.6, pan=-0.25)
    sg.line('whistle', ID.i_whistle, shift(B1, 0, 12, 0.7), iB2, gain=0.5, pan=0.3)
    sg.line('accm', ID.i_accordion, BR, iBr, gain=0.8)
    sg.line('whistle', ID.i_whistle, shift(BR, 0, 12, 0.5), iBr, gain=0.3, pan=0.3)
    sg.line('fid', ID.i_fiddle, cuts(A1), iA3, gain=1.0)
    sg.line('whistle', ID.i_whistle, shift(A2, 0, 12, 0.8), iA3, gain=0.5, pan=0.3)
    sg.line('accm', ID.i_accordion, shift(A1, 0, -12, 0.6), iA3, gain=0.5, pan=-0.3)
    sg.line('fid', ID.i_fiddle, cuts(B3), iB3, gain=1.0)
    sg.line('whistle', ID.i_whistle, shift(B3, 0, 12, 0.8), iB3, gain=0.5, pan=0.3)
    sg.line('accm', ID.i_accordion, shift(B3, 0, -12, 0.6), iB3, gain=0.45, pan=-0.3)
    tail = [n for n in A2 if n[0] >= 4 * SPB]
    tail = [(s - 4 * SPB, m, l, v) for (s, m, l, v) in tail]
    sg.line('fid', ID.i_fiddle, shift(tail, 0, -12, 0.9), iO, gain=1.0)
    sg.line('whistle', ID.i_whistle, tail, iO, gain=0.4, pan=0.3)

    # ---- coro de maré na ponte
    prev = None
    for (st, ln, pc, q) in H_BR.events():
        v = K.voice(prev, pc, q, 50, 67, 3)
        prev = v
        for k, m in enumerate(v):
            sg.note('choir', K.i_choir, iBr * SPB + st, m, ln, gain=0.55 / 1.7, pan=-0.4 + 0.4 * k, vowel='o' if k != 1 else 'a', a=0.5, r=0.9, vel=0.7)

    # ---- percussão: bodhran, guizos, botas, colheres, sino
    kit = KD.kit_celt
    BO_I = {'b': 'x.....o.....'}
    BO_A = {'b': 'x.....x.....', 'h': '..x.x...x.x.', 's': 'o.o.o.o.o.o.'}
    BO_F = {'b': 'x.....x.....', 'h': '..x.x...x.x.', 'r': '....x.....x.', 'f': 'x.....x.....', 's': 'x.o.x.o.x.o.', 'w': '..o.o...o.o.'}
    FILL = {'b': 'x.....x.x.x.', 'h': '..x.x.x.....', 'r': '..........x.', 's': 'x.x.x.x.x.x.'}

    def bars(bar0, n, base, gain=1.0, fills=True):
        for b in range(bar0, bar0 + n):
            sg.drums(kit, b, 1, FILL if (fills and (b - bar0) % 4 == 3) else base, gain=gain)
    sg.drums(kit, iI, 4, BO_I, gain=0.6)
    bars(iA, 8, BO_A, 0.9)
    bars(iA2, 8, BO_A, 1.0)
    bars(iB, 8, BO_F, 0.95)
    bars(iB2, 8, BO_F, 1.05)
    for b in range(iBr, iBr + 7):
        sg.drums(kit, b, 1, {'b': 'x.....o.....'}, gain=0.55)
    sg.drums(kit, iBr + 7, 1, {'h': 'oooooooooxxx', 'b': 'x.....x.....'}, gain=0.8)
    bars(iA3, 8, BO_F, 1.05)
    bars(iB3, 8, BO_F, 1.1)
    bars(iO, 3, BO_A, 0.85, fills=False)
    sg.drums(kit, iO + 3, 1, {'b': 'x.....X.....', 'f': 'x.....x.....'}, gain=0.9)
    for bar in (iI, iBr, iBr + 4):
        sg.drums(kit, bar, 1, {'c': 'x...........'}, gain=0.7)
    for bar in (iA, iB, iA3, iB3):
        hey(sg, bar, 0, 0.55)
    hey(sg, iB2, 0, 0.6)
    hey(sg, iO + 3, 0, 0.7)
    hey(sg, iA3 + 4, 6, 0.4)

    # ---- mar: ondas na entrada, na ponte e no fim
    def wash(bar, nb, peak, pan=0.0):
        sg.sample('wave', ID.ocean_wash(rng, nb * SPB * sg.step_s, 200, 3000, peak), bar * SPB, 1.0, pan=pan)
    wash(iI, 2, 0.6, -0.2)
    wash(iBr, 3, 0.7, -0.3)
    wash(iBr + 3, 3, 0.7, 0.3)
    wash(iBr + 6, 2, 0.6)
    wash(iO + 2, 2, 0.6, 0.2)
    sg.sample('fx', S.riser(rng, int(2 * SPB * sg.step_s * SR), 250, 7000, 0.0, 0.0) * 0.5, (iBr + 6) * SPB, 0.5)
    sg.sample('fx', S.crash(rng, None, 1.2) * 0.5, iA3 * SPB, 0.6)

    sg.trim = {'bass': 0.0, 'acc': 0.0, 'accm': 0.0, 'fid': 1.0, 'whistle': 0.0, 'choir': 13.0, 'shout': 12.0, 'drums': -3.5, 'wave': 0.0, 'fx': 8.0}
    ID.automate(sg, [(0, -1), (4, 0), (36, 0), (37, -5), (43, -5), (44, 0), (60, 0), (63, -2), (64, -1)])
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(61), drive=1.2, lp_hz=11500, hiss_level=0.002))
    fx = {
        'bass': [LowpassFilter(1500)],
        'acc': [Reverb(room_size=0.3, wet_level=0.14, dry_level=0.95)],
        'accm': [Reverb(room_size=0.3, wet_level=0.16, dry_level=0.95)],
        'fid': [Reverb(room_size=0.35, wet_level=0.17, dry_level=0.95)],
        'whistle': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.9)],
        'choir': [Reverb(room_size=0.9, wet_level=0.45, dry_level=0.55)],
        'shout': [Reverb(room_size=0.4, wet_level=0.2, dry_level=0.9)],
        'wave': [LowpassFilter(3400)],
        'drums': [Compressor(threshold_db=-18, ratio=2.0, attack_ms=8, release_ms=90)],
    }
    sg.sends = {'fid': {'echo': 0.1}, 'whistle': {'echo': 0.15}, 'fx': {'verb': 0.25}, 'drums': {'verb': 0.05}}
    return sg, fx, aux_default(124, room=0.6, delay_fb=0.25, delay_beats=1.5)
