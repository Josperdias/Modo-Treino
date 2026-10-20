"""Bônus 2 — "Chuva de Ouro (rag)": ragtime / stride, 138 bpm, dó maior com o trio em fá maior. Piano "honky-tonk" (três cordas FM desafinadas), mão esquerda
de stride (baixo-acorde alternado) com tuba, sincopado 3+3+2 na melodia, tábua de lavar e bloquinhos de madeira, clarineta no trio, metais no último A e cascatas de vibrafone
(as fitas douradas caindo) a cada seção. Termina na dominante e volta ao rufar de ouro do começo.
Forma (40 compassos, ~70 s): intro 4 (chuva de vibrafone) · A 8 · A' 8 (oitavas) · B trio 8 (fá maior, clarineta) · A'' 8 (metais, glissando) · coda 4."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import Harmony, shift, fit, voice
import inst2 as I2
import inst_a as IA
import kits_a as KA
from inst_a import score
from songs.common import aux_default

SPB = 16
NB = 40

A_L = score(SPB, 8, {
    0: 'e5 - - g5 - - c6 - g5 - - e5 - - g5 -',
    1: 'c6 - - a5 - - g5 - f5 - - d5 - - b4 -',
    2: 'e5 - - g5 - - c6 - e6 - - d6 - - c6 -',
    3: 'g5 - - e5 - - c5 - b4 - - g#4 - - e5 -',
    4: 'c6 - - e6 - - a5 - c6 - - b5 - - a5 -',
    5: 'd6 - - c6 - - a5 - b5 - - d6 - - g6 -',
    6: 'f6 - - d6 - - b5 - g5 - - b5 - - d6 -',
    7: 'f6 - - d6 - - b5 - c6 - - - - - . .',
})
A2_END = score(SPB, 1, {0: 'f6 - - d6 - - b5 - c6 d6 e6 f6 g6 a6 b6 c7'})
B_L = score(SPB, 8, {
    0: 'a5 - - c6 - - a5 - f5 - - a5 - - c6 -',
    1: 'f6 - - e6 - - c6 - bb5 - - g5 - - e5 -',
    2: 'f5 - - a5 - - c6 - f6 - - e6 - - d6 -',
    3: 'c6 - - a5 - - f#5 - d5 - - f#5 - - a5 -',
    4: 'bb5 - - d6 - - g6 - f6 - - d6 - - bb5 -',
    5: 'c6 - - bb5 - - g5 - e5 - - g5 - - bb5 -',
    6: 'a5 - - c6 - - f6 - a6 - - f6 - - c6 -',
    7: 'a5 - - f5 - - d5 - g5 - - b5 - - d6 -',
})
INTRO_L = score(SPB, 4, {
    2: 'd6 - - b5 - - g5 - f5 - - d5 - - b4 -',
    3: 'g5 - - b5 - - d6 - f6 - - b5 - - . .',
})
CODA_L = score(SPB, 4, {
    0: 'g6 - - e6 - - c6 - e6 - - c6 - - a5 -',
    1: 'f6 - - d6 - - a5 - b5 - - d6 - - f6 -',
    2: 'g6 - - e6 - - b5 - c6 - - e6 - - a6 -',
    3: 'f6 - - d6 - - a5 - b5 - - d6 - - g6 -',
})
# cascatas de vibrafone: oito semicolcheias descendo a escala (as fitas douradas caindo) e uma subida de oito
FALL_HI = score(SPB, 1, {0: 'c7 b6 a6 g6 f6 e6 d6 c6 . . . . . . . .'})
FALL_MID = score(SPB, 1, {0: 'g6 f6 e6 d6 c6 b5 a5 g5 . . . . . . . .'})
FALL_F = score(SPB, 1, {0: 'c7 bb6 a6 g6 f6 e6 d6 c6 . . . . . . . .'})
INTRO_RAIN = score(SPB, 2, {
    0: 'c7 b6 a6 g6 f6 e6 d6 c6 b5 a5 g5 f5 e5 d5 c5 b4',
    1: 'c5 d5 e5 f5 g5 a5 b5 c6 d6 e6 f6 g6 a6 b6 c7 -',
})

H_I = Harmony("C C G7 G7", SPB)
H_A = Harmony("C C_G7 C C_E7 Am D7_G7 G7 G7_C", SPB)
H_B = Harmony("F F_C7 F D7 Gm C7 F Dm_G7", SPB)
H_O = Harmony("C_Am Dm_G7 Em_Am Dm_G7", SPB)


def stride(sg, harm, bar0, gain=1.0, mode='stride', lo=51, hi=67):
    """Mão esquerda: 'stride' = baixo nos tempos 1 e 3 (raiz, depois quinta ou raiz do acorde novo) e acorde nos tempos 2 e 4; 'oompah' = o mesmo em colcheias."""
    evs = harm.events()
    prev = None
    bass_steps = (0, 8) if mode == 'stride' else (0, 4, 8, 12)
    chord_steps = (4, 12) if mode == 'stride' else (2, 6, 10, 14)
    for bi in range(len(harm)):
        first = [e for e in evs if e[0] <= bi * SPB < e[0] + e[1]][-1]
        for st in sorted(bass_steps + chord_steps):
            sa = bi * SPB + st
            cur = [e for e in evs if e[0] <= sa < e[0] + e[1]][-1]
            pc, q = cur[2], cur[3]
            step = (bar0 + bi) * SPB + st
            if st in bass_steps:
                root = 36 + ((pc - 36) % 12)
                same = cur is first
                m = root if (st == 0 or not same or (mode != 'stride' and st in (0, 8))) else root + 7
                sg.note('lh', IA.i_honky, step, m, 2, gain=gain * 0.9, vel=1.0 if st == 0 else 0.85, tau=0.5)
                sg.note('lh', IA.i_honky, step, m + 12, 2, gain=gain * 0.4, vel=0.8, tau=0.4)
                sg.note('tuba', IA.i_tuba, step, m, 2, gain=gain * 0.9, vel=0.95 if st in (0, 8) else 0.8)
            else:
                v = voice(prev, pc, q, lo, hi, 4 if q == '7' else 3)
                prev = v
                for k, m in enumerate(v):
                    sg.note('lh', IA.i_honky, step, m, 2, gain=gain * 0.55 / len(v) ** 0.5, vel=0.8, pan=(k - 1) * 0.1, tau=0.35)


def rain(sg, notes, bar, gain=0.5, pan=0.3, kind='vibes', tilt=1.1):
    sg.line('rain', K.i_modal, notes, bar, gain=gain, kind=kind, tilt=tilt, pan=pan)


def build():
    sg = K.Song(138, NB, spb=SPB, tail=3.0, seed=138, name='bonus2')
    rng = sg.rng
    iI, iA, iA2, iB, iA3, iO = 0, 4, 12, 20, 28, 36
    # ---------------- intro: chuva de vibrafone e a mão esquerda chegando
    sg.line('rain', K.i_modal, INTRO_RAIN, iI, gain=0.55, kind='vibes', tilt=1.2, pan=0.25)
    sg.line('rain', K.i_modal, shift(INTRO_RAIN, 0, 12, 0.55), iI, gain=0.22, kind='glass', tilt=1.4, pan=-0.3)
    sg.line('rh', IA.i_honky, INTRO_L, iI, gain=0.9, bright=1.0)
    stride(sg, K.Harmony("G7 G7", SPB), iI + 2, gain=0.7)
    # ---------------- A (melodia no registro médio, só a mão direita)
    stride(sg, H_A, iA, gain=0.65)
    sg.line('rh', IA.i_honky, A_L, iA, gain=0.8, bright=1.0)
    rain(sg, FALL_HI, iA, gain=0.35)
    # ---------------- A' (oitavas, brilho e cascatas)
    stride(sg, H_A, iA2, gain=0.95)
    A_RUN = K.bars_of(A_L, SPB, 0, 7) + [(s + 7 * SPB, m, l, v) for (s, m, l, v) in A2_END]
    sg.line('rh', IA.i_honky, A_RUN, iA2, gain=0.95, bright=1.1)
    sg.line('rh2', IA.i_honky, shift(A_RUN, 0, 12, 0.7), iA2, gain=0.55, bright=1.0, pan=0.2)
    rain(sg, FALL_HI, iA2, gain=0.4)
    rain(sg, FALL_MID, iA2 + 4, gain=0.3, pan=-0.3)
    # ---------------- B: trio em fá maior (suave): oompah, clarineta, vibrafone
    stride(sg, H_B, iB, gain=0.5, mode='oompah', lo=50, hi=64)
    sg.line('rh', IA.i_honky, B_L, iB, gain=0.75, bright=0.85)
    sg.line('clar', IA.i_choro, fit(shift(B_L, 0, -12, 0.8), H_B), iB, gain=0.4, pan=-0.3)
    rain(sg, FALL_F, iB, gain=0.35, pan=0.35)
    rain(sg, FALL_F, iB + 4, gain=0.25, pan=-0.35)
    # ---------------- A'' (clímax): oitavas, metais, glissando
    stride(sg, H_A, iA3, gain=1.15)
    sg.line('rh', IA.i_honky, A_RUN, iA3, gain=1.0, bright=1.15)
    sg.line('rh2', IA.i_honky, shift(A_RUN, 0, 12, 0.8), iA3, gain=0.9, bright=1.1, pan=0.2)
    sg.line('brass', K.i_brass, shift(A_RUN, 0, -12, 0.8), iA3, gain=0.6, cutoff=2600)
    rain(sg, FALL_HI, iA3, gain=0.5)
    rain(sg, FALL_MID, iA3 + 4, gain=0.4, pan=-0.3)
    for st in range(iA3 * SPB, (iA3 + 8) * SPB):  # faíscas douradas (deterministas)
        if rng.random() < 0.09:
            sg.note('rain', K.i_modal, st, int(rng.choice([84, 86, 88, 91, 93, 96])), 1, gain=float(rng.uniform(0.15, 0.3)), pan=float(rng.uniform(-0.8, 0.8)), kind='glass', tilt=0.8)
    # ---------------- coda
    stride(sg, H_O, iO, gain=0.95)
    sg.line('rh', IA.i_honky, CODA_L, iO, gain=0.95, bright=1.1)
    sg.line('rh2', IA.i_honky, shift(CODA_L, 0, 12, 0.7), iO, gain=0.45, bright=1.0, pan=0.2)
    rain(sg, FALL_HI, iO, gain=0.4)
    rain(sg, score(SPB, 1, {0: 'c6 d6 e6 g6 a6 c7 e7 g7 . . . . . . . .'}), iO + 3, gain=0.4, pan=-0.2)
    # ---------------- percussão de salão
    kit = KA.kit_rag
    sg.drums(kit, iI + 2, 2, {'w': 'x...x...x...x...', 'k': 'x.......x.......'}, gain=0.6)
    sg.drums(kit, iA, 8, {'k': 'x.......x.......', 'w': '....x.......x...', 'wb': 'x.x.x.x.x.x.x.x.'}, gain=0.55)
    sg.drums(kit, iA2, 8, {'k': 'x.......x.......', 'x': '....x.......x...', 'wb': 'xoxoxoxoxoxoxoxo', 's': '....x.......x...'}, gain=0.85)
    sg.drums(kit, iB, 8, {'k': 'x.......x.......', 'w': 'x.x.x.x.x.x.x.x.', 'h': '..x...x...x...x.'}, gain=0.35)
    sg.drums(kit, iA3, 8, {'k': 'x...x...x...x...', 'x': '....x.......x...', 'wb': 'xoxoxoxoxoxoxoxo', 's': '....x.......x...', 'w': '..x...x...x...x.'}, gain=1.15)
    sg.drums(kit, iO, 4, {'k': 'x.......x.......', 'x': '....x.......x...', 'wb': 'x.x.x.x.x.x.x.x.'}, gain=0.8)
    for bar in (iA2 - 1, iB - 1, iA3 - 1):
        sg.drums(kit, bar, 1, {'t1': '............x...', 't2': '..............x.', 't3': '...............x', 's': '............xxxx'}, gain=0.8)
    for bar in (iA2, iB, iA3):
        sg.sample('fx', S.crash(rng, None, 0.9) * 0.5, bar * SPB, 0.45)
    sg.duck(['rain'], 0.15, 0.1)
    sg.trim = {'rh': 3.5, 'rh2': 5.0, 'lh': -1.0, 'tuba': 6.0, 'rain': 0.5, 'brass': 10.0, 'clar': 4.0, 'drums': 3.0, 'fx': 14.0}
    fx = {
        'rh': [Reverb(room_size=0.25, wet_level=0.1, dry_level=0.92)],
        'rh2': [Reverb(room_size=0.25, wet_level=0.1, dry_level=0.92)],
        'lh': [LowpassFilter(5000)],
        'tuba': [LowpassFilter(900)],
        'rain': [Reverb(room_size=0.5, wet_level=0.3, dry_level=0.8)],
        'brass': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'clar': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'drums': [Compressor(threshold_db=-18, ratio=2.0, attack_ms=10, release_ms=90)],
    }
    sg.sends = {'rh': {'verb': 0.1}, 'rain': {'echo': 0.25}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(138, room=0.35, delay_fb=0.25, delay_beats=0.75)
