"""Bônus 3 — "Roda de Samba Dourada": samba-pagode, 100 bpm (compasso de 16 passos = dois 2/4), sol maior. Cavaquinho de aço (Karplus) riscando em semicolcheias, violão de nylon na batida,
baixo andando, kit próprio de escola (surdo aberto/abafado, tamborim, pandeiro com platinelas, ganzá, agogô de dois sinos, tantã, reco-reco), flauta de choro na melodia, apito de
chamada e metais curtos no refrão final. A "quebra" deixa só o cavaquinho e o surdo (pergunta) e o refrão volta com tudo.
Forma (28 compassos, ~67 s): chamada 2 · A 8 (verso) · B 8 (refrão) · quebra 2 · B' 8 (refrão cheio, metais e agogô)."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import Harmony, shift, voice
import inst2 as I2
import inst_a as IA
import kits_a as KA
from inst_a import score, comp_chords
from songs.common import aux_default

SPB = 16
NB = 28

A_L = score(SPB, 8, {
    0: 'b4 - d5 - g5 - . d5 - e5 - d5 - b4 - g4',
    1: 'e5 - g5 - b5 - . g5 - a5 - g5 - e5 - d5',
    2: 'c5 - e5 - g5 - . e5 - d5 - c5 - e5 - g5',
    3: 'a5 - - f#5 - - d5 - . . f#5 - a5 - c6 -',
    4: 'b5 - - a5 - - f#5 - d5 - f#5 - a5 - b5 -',
    5: 'g5 - e5 - g5 - b5 - . . a5 - g5 - e5 -',
    6: 'c6 - - b5 - - a5 - g5 - e5 - g5 - a5 -',
    7: 'f#5 - - a5 - - d6 - - - c6 - a5 - f#5 -',
})
B_L = score(SPB, 8, {
    0: 'g5 - g5 - b5 - d6 - - - b5 - g5 - d5 -',
    1: 'f#5 - f#5 - b5 - d#6 - - - b5 - f#5 - d#5 -',
    2: 'e5 - e5 - g5 - b5 - - - g5 - e5 - b4 -',
    3: 'e5 - e5 - a5 - c#6 - - - a5 - e5 - c#5 -',
    4: 'a5 - - c6 - - e6 - - - d6 - c6 - a5 -',
    5: 'd6 - - c6 - - a5 - f#5 - a5 - c6 - d6 -',
    6: 'g6 - - d6 - - b5 - g#5 - b5 - e6 - - -',
    7: 'a5 - c6 - e6 - c6 - f#5 - a5 - d6 - . .',
})
BREAK_L = score(SPB, 2, {
    0: 'e6 d6 c6 b5 c6 d6 e6 g6 e6 d6 c6 b5 g5 - - -',
    1: 'a5 c6 e6 c6 a5 c6 e6 a6 f#6 d6 a5 f#5 d5 - . .',
})

H_I = Harmony("G D7", SPB)
H_A = Harmony("G Em7 C D7 Bm7 Em7 Am7 D7", SPB)
H_B = Harmony("G B7 Em A7 Am7 D7 G_E7 Am7_D7", SPB)
H_K = Harmony("Cmaj7 Am7_D7", SPB)


def apito(sg, step, dur=0.11, gain=0.5, f=2850):
    """Apito de samba: seno agudo com trinado de 28 Hz e um pouco de sopro."""
    n = int((dur + 0.04) * SR)
    t = S.tt(n)
    fr = f * (1 + 0.035 * np.sin(2 * np.pi * 26 * t))
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * (0.65 + 0.35 * np.sin(2 * np.pi * 26 * t)) + 0.1 * S.bp(sg.rng.standard_normal(n), 2500, 6000, 1)
    sg.sample('fx', y * S.env_adsr(n, 0.008, 0.02, 0.9, 0.03), step, gain)


def cavaco(sg, harm, bar0, steps, gain=0.8, lo=62, hi=80, pan=0.35):
    """Cavaquinho: acorde de 4 cordas riscado para baixo/para cima nos passos dados (dict passo -> intensidade)."""
    evs = harm.events()
    prev = None
    for bi in range(len(harm)):
        for k, (st, vel) in enumerate(sorted(steps.items())):
            sa = bi * SPB + st
            cur = [e for e in evs if e[0] <= sa < e[0] + e[1]][-1]
            v = voice(prev, cur[2], cur[3], lo, hi, 4)
            prev = v
            IA.strum(sg, 'cavaco', IA.i_cavaco, v, (bar0 + bi) * SPB + st, 2, gain=gain, spread=0.1, up=(k % 2 == 1), pan=pan, vel=vel)


def build():
    sg = K.Song(100, NB, spb=SPB, tail=3.0, seed=100, name='bonus3')
    rng = sg.rng
    iI, iA, iB, iK, iB2 = 0, 2, 10, 18, 20
    CAV = {0: 0.95, 2: 0.65, 3: 0.75, 5: 0.7, 6: 0.85, 8: 0.9, 10: 0.65, 11: 0.75, 13: 0.7, 14: 0.8}
    CAV_L = {0: 0.9, 3: 0.7, 6: 0.8, 8: 0.85, 11: 0.7, 14: 0.75}
    # ---------------- chamada
    cavaco(sg, H_I, iI, CAV_L, gain=0.7)
    apito(sg, iI * SPB + 0, 0.1, 0.5)
    apito(sg, iI * SPB + 2, 0.1, 0.5)
    apito(sg, iI * SPB + 4, 0.28, 0.55)
    sg.bass('bass', I2.i_walk, H_I, iI, 'R . . . . . . 5 R . . . . . . 5', octave=38, gain=0.8, tau=0.5)
    # ---------------- A: flauta, violão na batida, cavaquinho leve, baixo sincopado
    BASS_A = 'R . . . 5 . . 5 R . . . 5 . . 5'
    BASS_B = 'R . . . 3 . . . 5 . . . 3 . . 5'
    sg.line('lead', IA.i_choro, A_L, iA, gain=0.75)
    comp_chords(sg, 'gtr', I2.i_gtr, H_A, iA, {2: 2, 6: 2, 10: 2, 14: 2}, 52, 68, gain=0.75, n=4, spread=0.12, decay=0.994, bright=0.3)
    cavaco(sg, H_A, iA, {0: 0.8, 3: 0.55, 6: 0.65, 8: 0.75, 11: 0.55, 14: 0.65}, gain=0.4)
    sg.bass('bass', I2.i_walk, H_A, iA, BASS_A, octave=38, gain=0.85, tau=0.5)
    # ---------------- B: refrão (flauta + cavaquinho em oitava), baixo andando
    sg.line('lead', IA.i_choro, B_L, iB, gain=1.0)
    sg.line('lead2', IA.i_cavaco, shift(B_L, 0, 12, 0.7), iB, gain=0.4, pan=0.3)
    comp_chords(sg, 'gtr', I2.i_gtr, H_B, iB, {2: 2, 6: 2, 10: 2, 14: 2}, 52, 68, gain=0.75, n=4, spread=0.12, decay=0.994, bright=0.3)
    cavaco(sg, H_B, iB, CAV, gain=0.8)
    sg.bass('bass', I2.i_walk, H_B, iB, BASS_B, octave=38, gain=0.9, tau=0.5)
    # ---------------- quebra: cavaquinho solista
    sg.line('lead2', IA.i_cavaco, BREAK_L, iK, gain=1.0, pan=0.2)
    sg.bass('bass', I2.i_walk, H_K, iK, 'R . . . . . . . 5 . . . . . . .', octave=38, gain=0.7, tau=0.6)
    # ---------------- B': tudo, mais metais curtos no contratempo
    sg.line('lead', IA.i_choro, B_L, iB2, gain=1.1)
    sg.line('lead', IA.i_choro, shift(B_L, 0, 12, 0.6), iB2, gain=0.5, vib=0.0)
    sg.line('lead2', IA.i_cavaco, shift(B_L, 0, 12, 0.8), iB2, gain=0.5, pan=0.3)
    comp_chords(sg, 'gtr', I2.i_gtr, H_B, iB2, {2: 2, 6: 2, 10: 2, 14: 2}, 52, 68, gain=0.8, n=4, spread=0.12, decay=0.994, bright=0.3)
    cavaco(sg, H_B, iB2, CAV, gain=1.1)
    sg.bass('bass', I2.i_walk, H_B, iB2, BASS_B, octave=38, gain=0.95, tau=0.5)
    comp_chords(sg, 'brass', K.i_brass, H_B, iB2, {6: 1, 14: 1}, 57, 72, gain=0.85, n=3, cutoff=2800)
    # ---------------- percussão
    kit = KA.kit_samba
    SURDO = {'sm': 'x.......x.......', 'su': '....X.......X...'}
    TAM = 'X.xx.x.xX.xx.x.x'
    sg.drums(kit, iI, 1, dict(SURDO, ta='xxxxxxxxxxxxxxxx', pj='xoxoxoxoxoxoxoxo'), gain=0.7)
    sg.drums(kit, iI + 1, 1, dict(SURDO, ta=TAM, ag='x.....x.x.....x.', pj='xoxoxoxoxoxoxoxo'), gain=0.75)
    sg.drums(kit, iA, 8, dict(SURDO, ta=TAM, pj='xoxoxoxoxoxoxoxo', rc='x.x.x.x.x.x.x.x.'), gain=0.45)
    sg.drums(kit, iB, 8, dict(SURDO, ta=TAM, pd='x.....x.x.....x.', pj='xoxoxoxoxoxoxoxo', sh='xoxoxoxoxoxoxoxo', tt='....x.......x...', ag='x.....x.x.....x.', ag2='..x...x...x...x.'), gain=0.85)
    sg.drums(kit, iK, 2, {'su': '....X.......X...', 'sm': 'x.......x.......', 'pj': 'o.o.o.o.o.o.o.o.'}, gain=0.5)
    sg.drums(kit, iK + 1, 1, {'ta': '............xxxx', 'su': '....X.......X.X.'}, gain=0.8)
    sg.drums(kit, iB2, 8, dict(SURDO, ta=TAM, pd='x.....x.x.....x.', pj='xoxoxoxoxoxoxoxo', sh='xoxoxoxoxoxoxoxo', tt='....x.......x...', ag='x.....x.x.....x.', ag2='..x...x...x...x.', rc='x.x.x.x.x.x.x.x.'), gain=1.25)
    for bar in (iB - 1, iB2 + 7):
        sg.drums(kit, bar, 1, {'ta': 'xxxxxxxxxxxxxxxx', 'su': '....X...X...X.XX'}, gain=0.8)
    sg.sample('fx', S.crash(rng, None, 0.9) * 0.5, iB * SPB, 0.35)
    sg.sample('fx', S.crash(rng, None, 0.9) * 0.5, iB2 * SPB, 0.4)
    apito(sg, iB2 * SPB - 6, 0.1, 0.45)
    apito(sg, iB2 * SPB - 4, 0.1, 0.45)
    apito(sg, iB2 * SPB - 2, 0.2, 0.5)
    sg.trim = {'lead': -3.0, 'lead2': 12.0, 'cavaco': 8.5, 'gtr': 6.0, 'bass': 0.0, 'brass': 12.0, 'drums': -4.0, 'fx': 8.0}
    fx = {
        'lead': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'cavaco': [Reverb(room_size=0.25, wet_level=0.1, dry_level=0.92)],
        'gtr': [Reverb(room_size=0.3, wet_level=0.12, dry_level=0.9)],
        'bass': [LowpassFilter(1500)],
        'brass': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'drums': [Compressor(threshold_db=-18, ratio=2.0, attack_ms=10, release_ms=90)],
    }
    sg.sends = {'lead': {'verb': 0.1, 'echo': 0.08}, 'lead2': {'verb': 0.1}, 'fx': {'verb': 0.25}}
    return sg, fx, aux_default(100, room=0.35, delay_fb=0.25, delay_beats=0.75)
