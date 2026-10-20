"""Relógio de Bronze — gamelan de polirritmia, ~100 bpm, si pelog (si dó ré fá# sol, com lá e mi de passagem; fica dentro do frígio de si). O compasso tem
60 passos = 4 tempos de 15: o saron toca o balungan em 4 (a cada 15), o bonang gira um ciclo de 5 (a cada 12), o gender gira 3 (a cada 20) e o peking
interliga polos/sangsih em 5 por tempo (a cada 3): quatro contra cinco contra três, tudo se encaixa no tempo 1. Colotomia de gongos: gongo grande a
cada 4 compassos, kenong no fim de cada compasso, kempul no meio, kethuk entre os tempos. Pares de lâminas desafinadas fazem o ombak (batimento).
Forma (28 compassos de 60 passos, ~1:07; 7 gongans): buka 4 · A 4 · B 4 · C 4 (tutti) · B' 4 · quebra 4 (só gender e bonang) · A'' 4 (tutti)."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
import inst2 as I2
import inst_c as IC
from songs.common import aux_default

SPB = 60
# pelog em si: B C D F# G (deslocamentos 0 1 3 7 8) em todas as oitavas
ALLP = sorted(59 + p + 12 * o for o in range(-3, 5) for p in (0, 1, 3, 7, 8))

BAL = {
    'A': [71, 72, 74, 74, 78, 79, 78, 74, 72, 74, 72, 71, 74, 72, 71, 69],
    'B': [71, 74, 78, 79, 83, 79, 78, 74, 79, 78, 74, 72, 72, 71, 69, 66],
    'C': [83, 84, 83, 79, 78, 79, 83, 79, 78, 74, 72, 74, 79, 78, 74, 71],
    'D': [71, 69, 71, 72, 74, 72, 71, 69, 67, 66, 67, 69, 71, 72, 74, 71],
}
GONGANS = ['A', 'A', 'B', 'C', 'B', 'D', 'A']
# suling (flauta): (passo no compasso, nota, duração)
F1 = [
    [(0, 79, 22), (30, 78, 8), (38, 74, 21)],
    [(0, 78, 14), (15, 79, 14), (30, 83, 28)],
    [(0, 79, 13), (15, 78, 8), (23, 74, 7), (30, 72, 14), (45, 71, 14)],
    [(0, 74, 28), (30, 72, 14), (45, 71, 14)],
]
F2 = [
    [(0, 83, 22), (30, 84, 8), (38, 83, 21)],
    [(0, 79, 14), (15, 78, 14), (30, 79, 14), (45, 83, 14)],
    [(0, 84, 28), (30, 83, 14), (45, 79, 14)],
    [(0, 78, 14), (15, 79, 14), (30, 74, 14), (45, 71, 14)],
]


def pel(n, k):
    """Anda `k` degraus da escala de 5 notas a partir de `n` (se `n` não estiver nela, parte da nota imediatamente abaixo)."""
    i = max(j for j, m in enumerate(ALLP) if m <= n)
    return ALLP[max(0, min(len(ALLP) - 1, i + k))]


def build():
    sg = K.Song(375, 28, spb=SPB, tail=4.5, seed=1004, name='clock4')   # 375 'bpm' de semicolcheia = 100 bpm reais (tempo = 15 passos)
    rng = sg.rng
    G = lambda b: GONGANS[b // 4]

    for b in range(28):
        g = b // 4
        bal = BAL[GONGANS[g]]
        beats = bal[(b % 4) * 4:(b % 4) * 4 + 4]
        base = b * SPB
        loud = g in (3, 4, 6)
        # ---- saron: balungan em 4 por compasso (na abertura só nos tempos 1 e 3, bem leve)
        for k, n in enumerate(beats):
            if g == 0 and k % 2 == 1:
                continue
            if g == 5:
                continue
            sg.note('saron', IC.i_saron, base + 15 * k, n, 14, gain=(0.55 if g == 0 else 0.85 if not loud else 1.0), vel=1.0 if k == 0 else 0.8,
                    pan=-0.2, beat=0.7, tilt=1.0)
        # ---- bonang: ciclo de 5 notas por compasso (a cada 12 passos), partindo da 1ª nota do balungan
        if g >= 1:
            n0 = beats[0] - 12
            cyc = [0, 2, 1, 3, 2] if b % 2 == 0 else [0, 3, 2, 1, 2]
            for j, d in enumerate(cyc):
                sg.note('bonang', IC.i_bonang, base + 12 * j, pel(n0, d), 11, gain=(0.55 if g == 1 else 0.8), vel=1.0 if j == 0 else 0.72,
                        pan=-0.5 if j % 2 == 0 else -0.25, beat=0.5, tilt=1.0)
        # ---- gender: ciclo de 3 notas por compasso (a cada 20 passos), uma oitava acima do 1º tom
        nlast = beats[3]
        gcyc = [2, 4, 3] if b % 2 == 0 else [3, 1, 2]
        for j, d in enumerate(gcyc):
            sg.note('gender', IC.i_gender, base + 20 * j, pel(nlast - 12, d), 18, gain=(0.5 if g == 0 else 0.55 if g == 1 else 0.75), vel=0.9 if j == 0 else 0.7,
                    pan=0.4 if j % 2 == 0 else 0.1, beat=0.8, tilt=1.0)
        # ---- peking: interlocking polos/sangsih em 5 por tempo (passos 0,3,6,9,12 de cada tempo de 15)
        if g in (2, 3, 4, 6):
            for k, n in enumerate(beats):
                hi = n + 12
                polos = pel(hi, 0)
                sang = pel(hi, 1)
                for o, who in ((0, polos), (6, polos), (12, polos), (3, sang), (9, sang)):
                    sg.note('peking', IC.i_peking, base + 15 * k + o, who, 2, gain=0.42 if g == 2 else 0.52, vel=0.95 if o == 0 else 0.7,
                            pan=0.45 if who == polos else 0.7, beat=1.2, tilt=0.8)
        # ---- colotomia: gongo grande a cada 4 compassos; kenong no fim do compasso; kempul no meio; kethuk entre os tempos
        if b % 4 == 0:
            sg.note('gong', IC.i_gongc, base, 35, 8, gain=1.0 if g else 0.9, tilt=1.0)
        if g >= 1:
            sg.note('kenong', IC.i_kenong, base + 45, beats[3] - 12, 14, gain=0.8, pan=-0.1, tilt=1.0)
            if b % 2 == 1:
                sg.note('kempul', IC.i_gongc, base + 30, pel(beats[2] - 24, 0), 14, gain=0.45, tilt=0.35, pan=0.15)
        if g >= 2 and g != 5:
            for st in (7, 22, 37, 52):
                sg.note('kethuk', IC.i_kethuk, base + st, 91, 3, gain=0.4, vel=0.8 if st in (7, 37) else 0.6, pan=0.3 if st < 30 else -0.3)
        # ---- kendang (tambor): acompanha nos tutti
        if g in (3, 4, 6) or (g == 2 and b % 4 >= 2):
            kit = IC.kit_kendang
            pat = {'k': (0, 25, 30) if b % 2 == 0 else (0, 22, 30, 42),
                   'd': (15, 45, 52) if b % 2 == 0 else (15, 37, 45),
                   't': (7, 22, 37, 57),
                   'l': (10, 40)}
            for ins, sts in pat.items():
                for st in sts:
                    sg.sample('drum', kit(ins, rng, 0.9 if st in (0, 30) else 0.7), base + st, gain=0.7)

    # ---- suling: duas frases (g3 e g6 com F1; g4 com F2), notas longas por cima
    for gb, F in ((12, F1), (16, F2), (24, F1)):
        for i, bar in enumerate(F):
            for (st, n, ln) in bar:
                sg.note('flute', I2.i_flute, (gb + i) * SPB + st, n, ln, gain=0.85, vib=0.006, vel=0.85, pan=0.0)
    sg.trim = {'saron': 0.0, 'peking': -0.8, 'bonang': -1.2, 'gender': -2.3, 'kenong': -1.1, 'kempul': 2.9, 'kethuk': 7.4, 'gong': -1.0, 'drum': 1.2, 'flute': -0.5}
    fx = {
        'saron': [Reverb(room_size=0.5, wet_level=0.18, dry_level=0.9)],
        'peking': [Reverb(room_size=0.45, wet_level=0.16, dry_level=0.9)],
        'bonang': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.9)],
        'gender': [Reverb(room_size=0.6, wet_level=0.25, dry_level=0.85)],
        'kenong': [Reverb(room_size=0.6, wet_level=0.2, dry_level=0.9)],
        'kempul': [Reverb(room_size=0.6, wet_level=0.2, dry_level=0.9)],
        'gong': [Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'drum': [Reverb(room_size=0.3, wet_level=0.12, dry_level=0.92)],
        'flute': [Reverb(room_size=0.55, wet_level=0.25, dry_level=0.85)],
    }
    sg.sends = {'saron': {'echo': 0.05}, 'flute': {'echo': 0.15}, 'bonang': {'verb': 0.1}, 'gender': {'verb': 0.15}}
    return sg, fx, aux_default(100, room=0.6, delay_fb=0.3, delay_beats=0.75)
