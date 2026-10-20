"""Horizonte de Eventos — épico orquestral de ficção científica, 64 bpm, ré lídio. Harpa na aurora, trompa solo cantando o tema (quinta que sobe, o
'mi maior' lídio no fim da frase), cordas que respondem, ostinato de spiccato e tímpanos na segunda frase, subida de arpejos em duas oitavas, e o
clímax: o tema inteiro em violinos, trompas e coro, tímpanos, prato e uma pancada grave. A coda resolve em ré (do dó sustenido sensível) e volta à harpa.
Forma (18 compassos de 4/4 a 64 bpm, ~1:07): aurora 2 · tema 4 · resposta 4 · subida 2 · clímax 4 · coda 2."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst_d as ID
import kits_d as KD
from songs.common import aux_default

H_I = Harmony("Dadd9 Dadd9")
H_A = Harmony("D A Bm7 E")
H_B = Harmony("D F#m7 Bm7 E")
H_C = Harmony("Bm7 E")
H_D = Harmony("D E Bm7 E_A")
H_O = Harmony("D D")

T1 = parse("""
a4 - - - - - d5 - - - f#5 - - - - - |
e5 - - - - - c#5 - - - a4 - - - - - |
d5 - - - f#5 - - - b5 - - - - - a5 - |
g#5 - - - - - - - e5 - - - - - - - |
""")
T2 = parse("""
a4 - - - - - d5 - - - f#5 - - - a5 - |
a5 - - - - - c#6 - - - b5 - - - a5 - |
d6 - - - - - - - c#6 - - - b5 - a5 - |
g#5 - - - e5 - - - b5 - - - - - - - |
""")
TC = parse("""
b4 - - - d5 - - - f#5 - - - a5 - - - |
e5 - - - g#5 - - - b5 - - - e6 - - - |
""")
TD = parse("""
d6 - - - - - a5 - d6 - - - f#6 - - - |
e6 - - - g#6 - - - b6 - - - a6 - g#6 - |
f#6 - - - - - d6 - b5 - - - d6 - f#6 - |
g#6 - - - e6 - - - a6 - - - e6 - c#6 - |
""")
TO = parse("""
d6 - - - - - - - - - - - - - - - |
a5 - - - - - - - d5 - - - - - - - |
""")


def choir_pad(sg, harm, bar0, lo, hi, gain, vowels=('a', 'o', 'a'), a=0.4, r=0.9, n=3):
    prev = None
    for (st, ln, pc, q) in harm.events():
        v = K.voice(prev, pc, q, lo, hi, n)
        prev = v
        for k, m in enumerate(v):
            sg.note('choir', K.i_choir, bar0 * 16 + st, m, ln, gain=gain / 1.7, pan=-0.4 + 0.4 * k, vowel=vowels[k % len(vowels)], a=a, r=r, vel=0.8)


def build():
    sg = K.Song(64, 18, spb=16, tail=5.0, seed=404, name='cosmos4')
    rng = sg.rng
    iI, iA, iB, iC, iD, iO = 0, 2, 6, 10, 12, 16

    # ---- harpa (aurora, tema e coda) e celesta
    HARP = '0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .'
    sg.arp('harp', ID.i_harp, H_I, iI, HARP, lo=50, gain=0.8)
    sg.arp('harp', ID.i_harp, H_A, iA, HARP, lo=50, gain=0.55)
    sg.arp('harp', ID.i_harp, H_O, iO, HARP, lo=50, gain=0.7)
    for h, bar, g in ((H_B, iB, 0.4), (H_D, iD, 0.4)):
        for (st, ln, pc, q) in h.events():
            tn = K.tones(pc, q, 83)
            sg.note('cel', ID.i_celesta, bar * 16 + st, tn[0], 4, gain=g, pan=0.3)
            sg.note('cel', ID.i_celesta, bar * 16 + st + 4, tn[2 % len(tn)], 4, gain=g * 0.8, pan=-0.3)
    # ---- cordas: tapete (todas as seções), com ataque lento no começo e cheio no clímax
    for h, bar, g, a in ((H_I, iI, 0.5, 0.9), (H_A, iA, 0.5, 0.6), (H_B, iB, 0.7, 0.35), (H_C, iC, 0.85, 0.3), (H_D, iD, 1.0, 0.22), (H_O, iO, 0.6, 0.9)):
        sg.pads('str', ID.i_strings, h, bar, 48, 74, gain=g, n=4, a=a, r=0.9, cutoff=2800)
    # ---- contrabaixos/violoncelos e metais graves
    LOW = 'R - - - - - - - 5 - - - R - - -'
    sg.bass('low', ID.i_strings, H_A, iA, 'R - - - - - - - - - - - - - - -', octave=38, gain=0.9, cutoff=900, a=0.4)
    sg.bass('low', ID.i_strings, H_B, iB, LOW, octave=38, gain=1.0, cutoff=1000, a=0.15)
    sg.bass('low', ID.i_strings, H_C, iC, LOW, octave=38, gain=1.0, cutoff=1000, a=0.15)
    sg.bass('low', ID.i_strings, H_D, iD, LOW, octave=38, gain=1.1, cutoff=1100, a=0.1)
    sg.bass('low', ID.i_strings, H_O, iO, 'R - - - - - - - - - - - - - - -', octave=38, gain=0.8, cutoff=800, a=0.5)
    sg.bass('lowbr', ID.i_horn, H_D, iD, 'R - - - - - - - - - - - R - - -', octave=38, gain=0.7, cutoff=1000, a=0.1)
    # ---- ostinato de spiccato: colcheias na resposta, semicolcheias no clímax
    SP8 = '0 . 1 . 2 . 1 . 0 . 1 . 2 . 1 .'
    SP16 = '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1'
    sg.arp('spicc', ID.i_spicc, H_B, iB, SP8, lo=55, gain=0.55, cutoff=2600)
    sg.arp('spicc', ID.i_spicc, H_C, iC, SP8, lo=55, gain=0.65, cutoff=2800)
    sg.arp('spicc', ID.i_spicc, H_D, iD, SP16, lo=55, gain=0.7, cutoff=3200)

    # ---- tema: trompa solo (A), violinos + trompa (B), tudo (clímax), coda
    sg.line('horn', ID.i_horn, T1, iA, gain=0.95, cutoff=2000)
    sg.line('horn', ID.i_horn, T2, iB, gain=0.9, cutoff=2200)
    sg.line('vln', ID.i_strings, shift(T2, 0, 12, 0.8), iB, gain=0.7, a=0.1, cutoff=3800, vib=0.006)
    sg.line('vln', ID.i_strings, TC, iC, gain=0.85, a=0.08, cutoff=3800, vib=0.006)
    sg.line('horn', ID.i_horn, shift(TC, 0, -12, 0.8), iC, gain=0.6, cutoff=2000)
    sg.line('horn', ID.i_horn, shift(TD, 0, -12, 1.0), iD, gain=1.0, cutoff=2600, a=0.05)
    sg.line('vln', ID.i_strings, TD, iD, gain=0.85, a=0.07, cutoff=4200, vib=0.007)
    sg.line('tpt', K.i_brass, shift(TD, 0, -12, 0.9), iD, gain=0.5, cutoff=3000)
    sg.line('horn', ID.i_horn, TO, iO, gain=0.8, cutoff=1600, a=0.2, r=0.6)
    sg.line('vln', ID.i_strings, shift(TO, 0, 0, 0.7), iO, gain=0.45, a=0.5, r=1.2, cutoff=3000)
    # ---- coro de vogais
    choir_pad(sg, H_B, iB, 55, 79, 0.45, a=0.6)
    choir_pad(sg, H_C, iC, 55, 79, 0.6, a=0.5)
    choir_pad(sg, H_D, iD, 57, 81, 0.95, vowels=('a', 'o', 'a'), a=0.3, r=1.2)
    choir_pad(sg, H_O, iO, 55, 76, 0.55, vowels=('o', 'u', 'o'), a=0.9, r=1.5)

    # ---- percussão: tímpanos (k = ré, t1 = lá, t2 = ré agudo), caixa de marcha, prato, gongo
    kit = KD.kit_orch
    sg.drums(kit, iI, 1, {'t1': '............o.o.'}, gain=0.7)
    sg.drums(kit, iI + 1, 1, {'t1': '........o...oooo', 'k': '..............xx'}, gain=0.7)
    for bar in (iA, iA + 2):
        sg.drums(kit, bar, 1, {'k': 'x...............'}, gain=0.8)
    for bar in (iA + 1, iA + 3):
        sg.drums(kit, bar, 1, {'t1': '........x.......'}, gain=0.75)
    sg.drums(kit, iB, 2, {'k': 'x.......x.......', 't1': '....o.......o...', 's': 'o...o...o...o...'}, gain=0.85)
    sg.drums(kit, iB + 2, 2, {'k': 'x...x...x...x...', 't1': '..o...o...o...o.', 's': 'o.o.o.o.o.o.o.o.'}, gain=0.9)
    sg.drums(kit, iC, 1, {'s': 'oooooooooooooooo', 't1': 'o.o.o.o.o.o.o.o.'}, gain=0.8)
    sg.drums(kit, iC + 1, 1, {'s': 'xxxxxxxxxxxxxxxx', 'k': 'oooooooooooooooo', 't2': 'o...o...o...o...'}, gain=1.0)
    sg.drums(kit, iD, 4, {'k': 'x...x...x...x...', 't1': '..x...x...x...x.', 's': 'o.o.o.o.o.o.o.o.', 'tri': 'x...x...x...x...'}, gain=1.0)
    for bar in (iD, iD + 2):
        sg.drums(kit, bar, 1, {'c': 'x...............'}, gain=0.9)
    sg.drums(kit, iD, 1, {'g': 'x...............'}, gain=0.9)
    sg.drums(kit, iO, 1, {'k': 'x...............', 'g': 'o...............'}, gain=0.8)
    sg.drums(kit, iO + 1, 1, {'t1': '........o.......'}, gain=0.5)
    sg.note('fx', ID.i_impact, iD * 16, 26, 28, gain=0.9)
    y = S.reverse(S.crash(rng, int(3.0 * SR), 1.2))
    sg.put('fx', y * 0.9, sg.t_step(iD * 16) - len(y) / SR, 0.8)
    sg.sample('fx', S.riser(rng, int(2 * 16 * sg.step_s * SR), 250, 8000, 0.0, 0.0) * 0.5, iC * 16, 0.5)

    sg.trim = {'harp': 8.0, 'cel': 8.5, 'str': 3.0, 'low': 6.0, 'lowbr': 8.0, 'spicc': 8.0, 'horn': 6.5, 'vln': 6.0, 'tpt': 7.0, 'choir': 4.5, 'drums': 3.0, 'fx': 2.0}
    ID.automate(sg, [(0, -7), (2, -5), (6, -2), (10, 0), (12, 3), (15.5, 3), (16, -3), (18, -7)])
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(41), drive=1.15, lp_hz=13000, hiss_level=0.0015))
    hall = lambda wet, room=0.9: Reverb(room_size=room, wet_level=wet, damping=0.45, dry_level=1.0 - wet * 0.6)
    fx = {
        'harp': [hall(0.3)], 'cel': [hall(0.4)],
        'str': [hall(0.3, 0.92)], 'low': [LowpassFilter(1800)], 'lowbr': [hall(0.15, 0.8)],
        'spicc': [hall(0.2, 0.8)], 'horn': [hall(0.3, 0.9)], 'vln': [hall(0.32, 0.92)], 'tpt': [hall(0.25, 0.85)],
        'choir': [hall(0.45, 0.95)],
        'drums': [hall(0.22, 0.88), Compressor(threshold_db=-18, ratio=2.0, attack_ms=12, release_ms=160)],
    }
    sg.sends = {'horn': {'echo': 0.12}, 'harp': {'echo': 0.25}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(64, room=0.9, delay_fb=0.35, delay_beats=1.5)
