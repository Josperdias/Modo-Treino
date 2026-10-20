"""Planta Baixa em Névoa — trip-hop noir, 72 bpm, dó menor. Batida arrastada (a caixa só no tempo 3, fantasmas atrasados pelo swing), baixo sujo,
cordas lentas, um violino de arco que respira, piano distante e disco de vinil rangendo o tempo todo. Na quebra a fita para e a batida volta pesada.
Forma (20 compassos, ~1:07): névoa 2 · A (piano + batida) 4 · B (cordas e violino) 4 · quebra 2 · A' (violão) 4 · B' (cordas cheias) 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor, Distortion
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_b as IB
import kits_b as KB
from songs.common import aux_default

P_L = parse("""
g4 . . . . . . . bb4 - - - . . . . |
d5 - - - c5 . . . bb4 . . . g4 - - - |
eb5 - - - . . . . c5 - - . eb5 - - - |
d5 . . . f5 . . . b4 - - - . . . . |
""")
L_B = parse("""
c6 - - - - - - - ab5 - - - . . . . |
bb5 - - - - - - - d6 - - - c6 - - - |
g5 - - - - - - - bb5 - - - g5 - - - |
ab5 - - - - - - - . . . . eb5 - - - |
""")
L_B2 = parse("""
eb6 - - - - - - - c6 - - - bb5 - - - |
d6 - - - - - - - f6 - - - eb6 - d6 - |
bb5 - - - - - - - d6 - - - bb5 - - - |
c6 - - - - - - - - - - - g5 - - - |
""")
H_I = Harmony("Cm9 Cm9")
H_A = Harmony("Cm9 Cm9 Abmaj7 G7")
H_B = Harmony("Fm9 Bb7 Ebmaj7 Abmaj7")
H_BR = Harmony("Abmaj7 G7")


def rev_crash(sg, bar, gain=0.5, length=2.2):
    y = S.reverse(S.crash(sg.rng, int(length * SR), 0.9))
    t0 = sg.t_step(bar * sg.spb) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def build():
    sg = K.Song(72, 20, spb=16, tail=4.0, seed=29, name='sketch4', swing=0.2)
    rng = sg.rng
    iI, iA, iB, iBR, iA2, iB2 = 0, 2, 6, 10, 12, 16
    # ---- baixo sujo
    BA = 'R - - . . . R . . . . R - - 5 .'
    BB = 'R - - - - - . . R - - . . . 5 .'
    sg.bass('bass', IB.i_dirty, H_A, iA, BA, octave=36, gain=0.9, cutoff=480)
    sg.bass('bass', IB.i_dirty, H_B, iB, BB, octave=36, gain=0.95, cutoff=520)
    sg.bass('bass', IB.i_dirty, H_BR, iBR, 'R - - - - - - - - - - - - - - -', octave=36, gain=0.4, cutoff=420)
    sg.bass('bass', IB.i_dirty, H_A, iA2, BA, octave=36, gain=0.95, cutoff=600, drive=3.2, slide=1.0)
    sg.bass('bass', IB.i_dirty, H_B, iB2, BB, octave=36, gain=1.0, cutoff=650, drive=3.2, slide=1.0)
    # ---- piano distante
    sg.line('piano', IB.i_piano, P_L[:len([n for n in P_L if n[0] < 2 * 16])], iI, gain=0.9, tau=1.1, bright=0.9)
    sg.line('piano', IB.i_piano, P_L, iA, gain=0.9, tau=1.1, bright=0.9)
    sg.line('piano', IB.i_piano, shift(P_L, 0, 12, 0.7), iA2, gain=0.65, tau=1.0, pan=0.3)
    sg.line('piano', IB.i_piano, P_L, iA2, gain=0.8, tau=1.1, pan=-0.2)
    sg.arp('piano2', IB.i_piano, H_B, iB, '0 . . . 2 . . . 1 . . . 3 . . .', lo=48, gain=0.55, tau=0.9)
    sg.arp('piano2', IB.i_piano, H_B, iB2, '0 . . . 2 . . . 1 . . . 3 . . .', lo=48, gain=0.6, tau=0.9)
    sg.arp('piano2', IB.i_piano, H_BR, iBR, '0 . . . 2 . . . 3 . . . 1 . . .', lo=51, gain=0.55, tau=1.1)
    # ---- violão sobre o A'
    sg.arp('gtr', I2.i_gtr, H_A, iA2, '0 . . 2 . . 1 . . 3 . . . . . .', lo=55, gain=0.55, decay=0.994, bright=0.25)
    # ---- cordas lentas
    sg.pads('str', IB.i_strings, H_I, iI, 48, 67, gain=0.3, a=1.2, r=1.5, cutoff=1500)
    sg.pads('str', IB.i_strings, H_B, iB, 48, 67, gain=0.7, a=1.0, r=1.2, cutoff=1900)
    sg.pads('str', IB.i_strings, H_BR, iBR, 48, 67, gain=0.6, a=1.4, r=1.6, cutoff=1500)
    sg.pads('str', IB.i_strings, H_A, iA2, 48, 67, gain=0.5, a=1.0, r=1.2, cutoff=1500)
    sg.pads('str', IB.i_strings, H_B, iB2, 50, 69, gain=1.1, a=1.0, r=1.2, cutoff=2300)
    # ---- violino de arco
    sg.line('lead', IB.i_bow, L_B, iB, gain=0.85, a=0.2, vib=0.007, cutoff=2800)
    sg.line('lead', IB.i_bow, L_B2, iB2, gain=1.0, a=0.2, vib=0.008, cutoff=3200)
    sg.line('lead2', IB.i_bow, shift(L_B, 0, -12, 0.6), iB2, gain=0.5, a=0.25, vib=0.006, cutoff=2200, pan=-0.3)
    # vozes ao fundo (sussurro de vogais) na quebra e no último B
    for h, bar, g in ((H_BR, iBR, 0.5), (H_B, iB2, 0.4)):
        for (st, ln, pc, q) in h.events():
            v = K.voice(None, pc, q, 55, 70, 3)
            for k, m in enumerate(v):
                sg.note('vox', IB.i_vox, bar * 16 + st, m, ln, gain=g, vowel='o' if k % 2 else 'u', vowel2='a', shift=0.95, a=0.9, r=1.2, vib=0.005, breath=0.12, pan=-0.5 + 0.5 * k)
    # ---- bateria arrastada
    kit = KB.kit_trip
    D_I = {'sh': '..x...x...x...x.'}  # só chiado de chimbal
    D_A = {'k': 'x..x......x.....', 's': '........x.......', 'g': '...........o..o.', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..............o.'}
    D_B = {'k': 'x..x......x.....', 's': '........x.......', 'g': '...........o..o.', 'h': 'x.x.x.x.x.x.x.x.', 'r': '....x.......x...', 'o': '..............o.'}
    D_BR = {'r': '................'}
    D_A2 = {'k': 'x..x......x..x..', 's': '........x.......', 'g': '..o........o..o.', 'h': 'xoxoxoxoxoxoxoxo', 'o': '..............o.', 'w': '.....x.......x..'}
    sg.drums(kit, iI, 2, D_I, gain=0.4)
    sg.drums(kit, iA, 4, D_A, gain=0.95)
    sg.drums(kit, iB, 4, D_B, gain=0.95)
    sg.drums(kit, iBR, 1, {'k': 'x...............', 'sh': '..x...x...x...x.'}, gain=0.5)
    sg.drums(kit, iBR + 1, 1, {'k': 'x...............', 'sh': '..x...x...x...x.', 's': '............x...'}, gain=0.8)
    sg.drums(kit, iA2, 4, D_A2, gain=1.0)
    sg.drums(kit, iB2, 4, D_B, gain=1.0)
    for bar in (iA, iB, iA2, iB2):
        rev_crash(sg, bar, 0.35)
    # ---- sinos de vidro esparsos (nota de dó, muito longe)
    for bar, m in ((iB, 84), (iA2, 79), (iB2, 84)):
        sg.note('chime', I2.i_chime, bar * 16, m, 8, gain=0.4, tilt=1.8, pan=0.4)
    sg.duck(['str', 'vox'], 0.25, 0.2)
    sg.trim = {'bass': -7.0, 'piano': 6.0, 'piano2': 5.0, 'gtr': 16.0, 'str': 5.0, 'lead': 8.0, 'lead2': 11.0, 'vox': 8.0, 'drums': 2.0, 'chime': 8.0, 'fx': 9.0}
    # ---- a fita para no fim da quebra (e volta com a batida); vinil o tempo todo
    i0 = int(sg.t_step((iBR + 1) * 16 + 8) * SR)
    sg.post.append(lambda mix, song: TP.tape_stop(mix, i0, int(sg.step_s * 8 * SR), power=1.2))
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(21), wow=0.003, flutter=0.0009, wow_hz=0.35))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(22), drive=1.6, lp_hz=8500, hiss_level=0.005, crackle=0.22))
    fx = {
        'bass': [LowpassFilter(900)],
        'piano': [LowpassFilter(4200), Reverb(room_size=0.85, wet_level=0.4, dry_level=0.65)],
        'piano2': [LowpassFilter(3500), Reverb(room_size=0.8, wet_level=0.35, dry_level=0.7)],
        'gtr': [LowpassFilter(3800), Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'str': [Chorus(rate_hz=0.2, depth=0.3, mix=0.4), Reverb(room_size=0.85, wet_level=0.35, dry_level=0.7)],
        'lead': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'lead2': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'vox': [LowpassFilter(3500), Reverb(room_size=0.95, wet_level=0.5, dry_level=0.5)],
        'drums': [HighpassFilter(35), LowpassFilter(7000), Distortion(drive_db=5), Compressor(threshold_db=-16, ratio=3.5, attack_ms=18, release_ms=140)],
        'chime': [Reverb(room_size=0.9, wet_level=0.45, dry_level=0.6)],
    }
    sg.sends = {'piano': {'echo': 0.25}, 'lead': {'echo': 0.15}, 'drums': {'verb': 0.1}, 'fx': {'verb': 0.3}, 'gtr': {'echo': 0.2}}
    return sg, fx, aux_default(72, room=0.7, delay_fb=0.4, delay_beats=1.5)
