"""Menu 2 — "Neon Lounge 1987": chillwave / vaporwave, 88 bpm, mi bemol maior. Pads com chorus lento, piano elétrico FM, synth de serras que
escorrega para cada nota, baixo macio, caixa-de-ritmos de fita (swing leve), sinos de vidro respondendo nos silêncios. A fita é "slowed":
balanço largo, agudos caídos, estalinhos e falhas de óxido. A última harmonia fica suspensa (Si bemol sus4) e um sopro de ruído sobe até a tônica
do começo: expectativa antes do PRESS START.
Forma (24 compassos, ~65 s): intro 2 · A 8 (tema) · B 8 (refrão, synth mais aberto) · A' 4 (tema no piano elétrico) · suspensão 2."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import Harmony
import tape as TP
import inst2 as I2
import inst_a as IA
import kits_a as KA
from inst_a import score, comp_chords
from songs.common import aux_default

SPB = 16
NB = 24
A_L = score(SPB, 8, {
    0: '. . . . g5 - - - bb5 - - d6 - - eb6 -',
    1: 'g6 - - eb6 - - d6 - - c6 - - bb5 - . .',
    2: 'c6 - - - eb6 - - - g6 - - - f6 - eb6 -',
    3: 'f6 - - - eb6 - - - d6 - - c6 - - bb5 -',
    4: '. . . . bb5 - - - d6 - - f6 - - g6 -',
    5: 'bb6 - - g6 - - eb6 - - d6 - - c6 - - -',
    6: 'ab5 - - c6 - - eb6 - - f6 - - eb6 - c6 -',
    7: 'f6 - - - - - - - - - - - . . . .',
})
B_L = score(SPB, 8, {
    0: 'eb6 - - - c6 - - eb6 g6 - - - f6 - eb6 -',
    1: 'f6 - - ab6 - - f6 - d6 - - f6 - - d6 -',
    2: 'bb5 - - d6 - - g6 - - f6 - - d6 - - bb5',
    3: 'c6 - - eb6 - - g6 - - - bb6 - - g6 - -',
    4: 'eb6 - - g6 - - bb6 - - c7 - - bb6 - g6 -',
    5: 'ab6 - - f6 - - c6 - - eb6 - - f6 - ab6 -',
    6: 'f6 - - - eb6 - - - f6 - - - ab6 - - -',
    7: 'g6 - - f6 - - d6 - - - bb5 - - - . .',
})
# o tema volta no piano elétrico (A1 A2 A3 e uma frase nova que sobe) e a suspensão
A2_L = score(SPB, 4, {
    0: '. . . . g5 - - - bb5 - - d6 - - eb6 -',
    1: 'g6 - - eb6 - - d6 - - c6 - - bb5 - . .',
    2: 'c6 - - - eb6 - - - g6 - - - bb6 - ab6 -',
    3: 'bb5 - - d6 - - g6 - - f6 - - d6 - - -',
})
O_L = score(SPB, 2, {
    0: 'c6 - - - eb6 - - - f6 - - - - - - -',
    1: 'f6 - - - - - - - - - - - - - - -',
})
CH_A = score(SPB, 8, {
    0: 'bb6 - - - . . . . . . . . . . . .',
    4: 'd6 - - - . . . . . . . . . . . .',
    7: '. . . . . . . . . . . . . bb6 - -',
})
CH_B = score(SPB, 8, {
    1: '. . . . . . . . . . . . . . ab6 -',
    3: '. . . . . . . . . . . . . . . g6',
    5: '. . . . . . . . . . . . . . . bb6',
    7: '. . . . . . . . . . . . . . . .',
})

H_I = Harmony("Ebmaj9 Abmaj9", SPB)
H_A = Harmony("Ebmaj7 Cm7 Abmaj7 Bb7sus4_Bb7 Gm7 Cm7 Fm7 Bb7sus4", SPB)
H_B = Harmony("Abmaj9 Bb7sus4_Bb7 Gm7 Cm7 Abmaj9 Fm7 Bb7sus4 Bb7", SPB)
H_A2 = Harmony("Ebmaj9 Cm9 Abmaj9 Gm7", SPB)
H_O = Harmony("Fm7 Bb7sus4", SPB)


def rev_crash(sg, bar, gain=0.4):
    y = S.reverse(S.crash(sg.rng, int(1.8 * SR), 0.6))
    t0 = sg.t_step(bar * sg.spb) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def build():
    sg = K.Song(88, NB, spb=SPB, tail=4.0, swing=0.11, seed=88, name='menu2')
    rng = sg.rng
    iI, iA, iB, iA2, iO = 0, 2, 10, 18, 22
    # ---- pads (camadas lentas) e coro de vogal "o" no refrão
    for h, bar, g, c in ((H_I, iI, 0.8, 900), (H_A, iA, 0.6, 1200), (H_B, iB, 1.0, 1700), (H_A2, iA2, 0.65, 1300), (H_O, iO, 0.7, 1000)):
        sg.pads('pad', K.i_pad, h, bar, 52, 76, gain=g, cutoff=c, a=0.9, r=1.2, det=0.009)
    sg.pads('choir', K.i_choir, H_B, iB, 58, 74, gain=0.22, vowel='o', a=0.5, r=0.8, n=3)
    sg.pads('choir', K.i_choir, H_O, iO, 58, 74, gain=0.2, vowel='o', a=0.5, r=0.8, n=3)
    # ---- baixo
    BASS = 'R - - - - - - - . . R - - - 5 -'
    for h, bar, g in ((H_A, iA, 0.9), (H_B, iB, 0.95), (H_A2, iA2, 0.9)):
        sg.bass('bass', I2.i_sub, h, bar, BASS, octave=36, gain=g, drive=0.5)
    sg.bass('bass', I2.i_sub, H_I, iI, 'R - - - - - - - - - - - - - - -', octave=36, gain=0.7)
    sg.bass('bass', I2.i_sub, H_O, iO, 'R - - - - - - - - - - - - - - -', octave=36, gain=0.8)
    # ---- piano elétrico comping (acordes em síncope) e arpejo de vidro no refrão
    comp_chords(sg, 'ep', K.i_fmep, H_A, iA, {0: 6, 10: 5}, 58, 76, gain=0.5, tau=0.9, bright=0.7)
    comp_chords(sg, 'ep', K.i_fmep, H_B, iB, {0: 5, 6: 3, 10: 5}, 58, 76, gain=0.85, tau=0.9, bright=0.85)
    comp_chords(sg, 'ep', K.i_fmep, H_I, iI, {0: 16}, 58, 76, gain=0.45, tau=1.4, bright=0.6)
    sg.arp('arp', K.i_modal, H_B, iB, '0 . 2 . 1 . 3 . 2 . 4 . 3 . 1 .', lo=72, gain=0.4, pan=0.45, kind='glass', tilt=0.7, step_len=2)
    # ---- melodias
    sg.line('lead', IA.i_cwlead, A_L, iA, gain=0.85, cutoff=1900)
    sg.line('lead', IA.i_cwlead, B_L, iB, gain=1.1, cutoff=3200, det=0.009)
    sg.line('lead2', K.i_fmep, B_L, iB, gain=0.25, tau=0.8, bright=0.9, pan=-0.35)
    sg.line('lead', K.i_fmep, A2_L, iA2, gain=0.85, tau=1.0, bright=0.9)
    sg.line('lead2', K.i_modal, A2_L, iA2, gain=0.3, kind='glass', tilt=1.2, pan=0.35)
    sg.line('lead', K.i_fmep, O_L, iO, gain=0.8, tau=1.4, bright=0.8)
    sg.line('chime', K.i_modal, CH_A, iA, gain=0.5, kind='glass', tilt=1.8, pan=0.45)
    sg.line('chime', K.i_modal, CH_B, iB, gain=0.5, kind='glass', tilt=1.8, pan=-0.4)
    # ---- bateria de fita
    kit = KA.kit_chill
    D_A = {'k': 'x.....x...x.....', 's': '....X.......X...', 'h': 'x.o.x.o.x.o.x.o.'}
    D_B = {'k': 'x.....x...x...x.', 's': '....X.......X...', 'h': 'x.o.x.o.x.o.x.o.', 'o': '..............x.', 'sh': 'oooooooooooooooo'}
    sg.drums(kit, iI + 1, 1, {'r': '........x.......', 'h': 'o.o.o.o.o.o.o.o.'}, gain=0.7)
    sg.drums(kit, iA, 8, D_A, gain=0.75)
    sg.drums(kit, iB, 8, D_B, gain=1.1)
    sg.drums(kit, iA2, 4, D_A, gain=0.9)
    sg.drums(kit, iO, 1, {'k': 'x...............', 'h': 'x.o.x.o.x.o.x.o.'}, gain=0.8)
    for bar in (iB - 1, iA2 - 1):
        sg.drums(kit, bar, 1, {'t1': '............x...', 't2': '..............x.', 't3': '...............x'}, gain=0.8)
    # ---- efeitos: pratos ao contrário e o sopro de expectativa
    for bar in (iA, iB, iA2):
        rev_crash(sg, bar, 0.35)
    sg.sample('fx', S.riser(rng, int(2 * SPB * sg.step_s * SR), 250, 6500, 0.0, 0.0) * 0.5, iO * SPB, 0.55)
    sg.duck(['pad', 'ep', 'arp', 'choir'], 0.28, 0.2)
    sg.trim = {'pad': 6.0, 'choir': 14.0, 'bass': -8.0, 'ep': 1.0, 'arp': 7.0, 'lead': 3.5, 'lead2': 4.0, 'chime': 6.0, 'drums': 2.0, 'fx': 5.0}
    # ---- fita "slowed": balanço largo, agudos caídos, chiado, estalinhos e falhas
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(31), wow=0.0036, flutter=0.0011, wow_hz=0.4))
    sg.post.append(lambda mix, song: TP.dropouts(mix, np.random.default_rng(32), count=4, ms=(25, 90), depth=0.6))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(33), drive=1.55, lp_hz=7200, hiss_level=0.0045, crackle=0.035))
    fx = {
        'pad': [Chorus(rate_hz=0.17, depth=0.5, mix=0.5), Reverb(room_size=0.85, wet_level=0.35, dry_level=0.7), LowpassFilter(3600)],
        'choir': [Chorus(rate_hz=0.2, depth=0.4, mix=0.4), Reverb(room_size=0.85, wet_level=0.4, dry_level=0.6)],
        'bass': [LowpassFilter(900)],
        'ep': [Chorus(rate_hz=0.45, depth=0.3, mix=0.4), Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'arp': [Reverb(room_size=0.5, wet_level=0.25, dry_level=0.8)],
        'lead': [Chorus(rate_hz=0.3, depth=0.25, mix=0.3), Reverb(room_size=0.5, wet_level=0.22, dry_level=0.85)],
        'lead2': [Reverb(room_size=0.5, wet_level=0.25, dry_level=0.8)],
        'chime': [Reverb(room_size=0.7, wet_level=0.35, dry_level=0.7)],
        'drums': [Compressor(threshold_db=-18, ratio=2.2, attack_ms=14, release_ms=100), LowpassFilter(9500)],
    }
    sg.sends = {'lead': {'echo': 0.32, 'verb': 0.1}, 'lead2': {'echo': 0.2}, 'chime': {'echo': 0.35, 'verb': 0.2}, 'ep': {'echo': 0.1}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(88, room=0.75, delay_fb=0.42, delay_beats=0.75)
