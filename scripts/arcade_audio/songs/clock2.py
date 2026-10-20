"""Clockwork Swing — electro-swing, 130 bpm, sol menor. Grade de tercinas (12 passos por compasso): ride de jazz, bumbo de quatro, contrabaixo
andando, clarinete e metais no contratempo (Charleston), piano elétrico e um tique-taque de relógio atravessando tudo. Começa como um
gramofone de 78 rotações (banda estreita + estalos) que se abre quando o swing entra.
Forma (48 compassos, ~1:29): gramofone 4 · A 8 · A+metais 8 · B 8 · A cheio 8 · B' 8 · fim 4 (o disco desacelera)."""
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

SPB = 12
A_L = parse("""
g5 - bb5 d6 - bb5 g5 - bb5 d6 - - |
c6 - bb5 g5 - . d5 - g5 bb5 - . |
c6 - eb6 g6 - eb6 c6 - eb6 g6 - - |
f6 - eb6 c6 - . g5 - c6 eb6 - . |
d6 - f#6 a6 - f#6 d6 - c6 a5 - f#5 |
a5 - c6 d6 - . f#5 - a5 c6 - . |
bb5 - d6 g6 - d6 bb5 - g5 a5 - bb5 |
g5 - - - - - . . . . . . |
""", SPB)
B_L = parse("""
f6 - - d6 - bb5 d6 - f6 bb6 - f6 |
d6 - - bb5 - . f5 - bb5 d6 - . |
g6 - - eb6 - bb5 eb6 - g6 bb6 - g6 |
eb6 - - bb5 - . g5 - bb5 eb6 - . |
g6 - eb6 c6 - eb6 g6 - bb6 g6 - eb6 |
f#6 - a6 d7 - a6 f#6 - d6 a5 - f#5 |
bb5 - d6 g6 - bb6 a6 - g6 f6 - d6 |
a5 - - c6 - . d6 - - . . . |
""", SPB)
# contracanto dos metais (curto, no contratempo)
H_L = parse("""
. . . . . . d5 - . g5 - . |
. . . . . . d5 - . g5 - . |
. . . . . . eb5 - . g5 - . |
. . . . . . eb5 - . g5 - . |
. . . . . . f#5 - . a5 - . |
. . . . . . f#5 - . a5 - . |
. . . . . . d5 - . g5 - . |
. . . . . . d5 - . g5 - . |
""", SPB)
TAG_L = parse("""
g5 - bb5 d6 - bb5 g5 - - - - - |
d6 - - bb5 - . g5 - - - - - |
g5 - - - - - - - - - - - |
. . . . . . . . . . . . |
""", SPB)

H_A = Harmony("Gm Gm7 Cm Cm7 D7 D7 Gm Gm", SPB)
H_B = Harmony("Bb Bb Eb Eb Cm7 D7 Gm D7", SPB)
H_I = Harmony("Gm Cm D7 D7", SPB)
H_T = Harmony("Gm Cm Gm Gm", SPB)


def stabs(sg, harm, bar0, steps, lo, hi, inst, gain, ln=2, **kw):
    """Acordes curtos nos passos dados de cada compasso (Charleston: 0 e 5, ou só 'a' do 2)."""
    prev = None
    for bi, ev in enumerate(harm.bars):
        pc, q = ev[0][2], ev[0][3]
        v = K.voice(prev, pc, q, lo, hi, 4)
        prev = v
        for st in steps:
            for k, m in enumerate(v):
                sg.note('stab', inst, (bar0 + bi) * SPB + st, m, ln, gain=gain / len(v) ** 0.5, pan=-0.2 + 0.13 * k, **kw)


def build():
    sg = K.Song(97.5, 48, spb=SPB, tail=3.0, seed=41, name='clock2')   # 97,5 = 130 bpm reais em tercinas (3 passos por tempo)
    rng = sg.rng
    iI, iA, iA2, iB, iA3, iB2, iT = 0, 4, 12, 20, 28, 36, 44
    # ---- contrabaixo andando (R na 1, quinta na 2, terça na 3, aproximação cromática na 4)
    WALK = 'R . . 5 . . 3 . . a . .'
    WALK2 = 'R . . 5 . . o . . a . .'
    for h, bar, pat, g in ((H_I, iI, WALK, 0.7), (H_A, iA, WALK, 0.9), (H_A, iA2, WALK2, 0.9), (H_B, iB, WALK, 0.9), (H_A, iA3, WALK2, 0.95), (H_B, iB2, WALK2, 0.95), (H_T, iT, WALK, 0.8)):
        sg.bass('bass', I2.i_walk, h, bar, pat, octave=36, gain=g, tau=0.45)
    # ---- piano elétrico (comp leve) e pads de órgão
    for h, bar, g in ((H_A, iA, 0.45), (H_B, iB, 0.5), (H_A, iA3, 0.5), (H_B, iB2, 0.55)):
        stabs(sg, h, bar, (0, 5), 55, 76, K.i_fmep, g, ln=2, tau=0.35, bright=0.8)
    # ---- metais no contratempo (Charleston) nas seções cheias
    for h, bar, g in ((H_A, iA2, 0.6), (H_B, iB, 0.55), (H_A, iA3, 0.65), (H_B, iB2, 0.7)):
        stabs(sg, h, bar, (5, 10), 60, 80, K.i_brass, g, ln=1, cutoff=2300)
    # ---- melodias: clarinete no A e no B (metais respondem)
    sg.line('lead', I2.i_clar, A_L, iA, gain=0.9)
    sg.line('lead', I2.i_clar, A_L, iA2, gain=0.9)
    sg.line('lead2', K.i_brass, H_L, iA2, gain=0.55, cutoff=2500, pan=-0.3)
    sg.line('lead', I2.i_clar, B_L, iB, gain=0.95)
    sg.line('lead2', K.i_modal, shift(B_L, 0, 12, 0.5), iB, gain=0.35, kind='vibes', tilt=1.2, pan=0.35)
    sg.line('lead', I2.i_clar, A_L, iA3, gain=0.9, cutoff=3200)
    sg.line('lead2', K.i_brass, shift(A_L, 0, -12, 0.6), iA3, gain=0.4, cutoff=1800, pan=0.3)
    sg.line('lead', I2.i_clar, B_L, iB2, gain=0.95, cutoff=3200)
    sg.line('lead2', K.i_brass, shift(B_L, 0, -12, 0.6), iB2, gain=0.45, cutoff=2000, pan=-0.3)
    sg.line('lead', I2.i_clar, TAG_L, iT, gain=0.8, vib=0.008)
    sg.line('lead2', K.i_modal, shift(A_L[:16], 0, 12, 0.5), iI, gain=0.4, kind='bell', tilt=1.0)  # sinos do gramofone na entrada
    # ---- bateria de jazz (ride em tercinas), bumbo de quatro e escova
    kit = K2.kit_swing
    RIDE = 'x..x.xx..x.x'
    D_I = {'h': RIDE, 'f': '...x.....x..'}
    D_A = {'h': RIDE, 'f': '...x.....x..', 'k': 'o..o..o..o..', 's': '.....o....o.'}
    D_F = {'h': RIDE, 'f': '...x.....x..', 'k': 'X..X..X..X..', 's': '...o..o.o..o', 'r': '.....x....x.'}
    sg.drums(kit, iI, 4, D_I, gain=0.7)
    sg.drums(kit, iA, 8, D_A, gain=0.9)
    sg.drums(kit, iA2, 8, D_F, gain=0.95)
    sg.drums(kit, iB, 8, D_F, gain=0.95)
    sg.drums(kit, iA3, 8, D_F, gain=1.0)
    sg.drums(kit, iB2, 8, D_F, gain=1.0)
    sg.drums(kit, iT, 4, D_A, gain=0.8)
    for bar in (iA2 - 1, iB - 1, iB2 - 1):   # viradas de caixa e tons
        sg.drums(kit, bar, 1, {'s': '.........xoo', 't1': '.......x....', 't2': '..........x.', 'c': '............'}, gain=0.9)
    # ---- o relógio: tique e taque (madeira aguda e grave) a cada tempo, ao longo de tudo
    for bar in range(0, 48):
        for k, st in enumerate((0, 3, 6, 9)):
            hi = k % 2 == 0
            sg.sample('tick', S.wood(2500 if hi else 1700, int(0.05 * SR), 0.012) * 0.45, bar * SPB + st, 0.5 if hi else 0.42, pan=-0.5 if hi else 0.5)
    # sinos a cada 8 compassos (relógio dando a hora) e o disco que desacelera no fim
    for bar in (iA, iA2, iB, iA3, iB2):
        sg.note('chime', I2.i_chime, bar * SPB, 79, 6, gain=0.5, tilt=1.4)
        sg.note('chime', I2.i_chime, bar * SPB, 67, 6, gain=0.4, tilt=1.6, pan=0.3)
    sg.sample('fx', S.crash(rng, None, 1.0) * 0.5, iA2 * SPB, 0.4)
    sg.sample('fx', S.crash(rng, None, 1.0) * 0.5, iB2 * SPB, 0.4)
    # ---- gramofone: banda estreita + estalos na entrada e no fim, abrindo no swing
    def gramophone(mix, song):
        n = mix.shape[1]
        narrow = np.stack([S.bp(c, 280, 4300, 2) for c in mix]) * 1.5
        crack = np.stack([S.crackle(np.random.default_rng(7 + k), n, 16.0, 0.12) for k in range(2)])
        t_open = song.t_step(iA * SPB) * SR
        w = np.clip(1 - (np.arange(n) - t_open + 1.5 * SR) / (1.5 * SR), 0, 1)      # 1 até o swing entrar, depois abre em 1,5 s
        t_close = song.t_step((iT + 1) * SPB) * SR
        w2 = np.clip((np.arange(n) - t_close) / (3.0 * SR), 0, 1) * 0.0
        wm = np.maximum(w, w2)
        return mix * (1 - wm) + (narrow + crack * 1.0) * wm + crack * 0.35 * (1 - wm) * 0.4
    sg.post.append(gramophone)
    sg.post.append(lambda mix, song: TP.tape_stop(mix, int(song.t_step((iT + 3) * SPB) * SR), int(1.8 * SPB * song.step_s * SR), power=1.3))
    sg.duck(['stab'], 0.25, 0.1, steps=[b * SPB + s for b in range(48) for s in (0, 3, 6, 9)])
    sg.trim = {'bass': -0.2, 'stab': 5.7, 'lead': -2.2, 'lead2': 6.5, 'drums': 1.8, 'tick': 10.8, 'chime': 7.6}
    fx = {
        'lead': [Reverb(room_size=0.28, wet_level=0.14, dry_level=0.92)],
        'lead2': [Reverb(room_size=0.3, wet_level=0.18, dry_level=0.88)],
        'stab': [Reverb(room_size=0.25, wet_level=0.12, dry_level=0.92)],
        'bass': [LowpassFilter(1800)],
        'drums': [Compressor(threshold_db=-20, ratio=2.0, attack_ms=14, release_ms=100)],
        'chime': [Reverb(room_size=0.8, wet_level=0.35, dry_level=0.7)],
    }
    sg.sends = {'lead': {'verb': 0.15, 'echo': 0.1}, 'tick': {'verb': 0.12}, 'chime': {'verb': 0.2}}
    return sg, fx, aux_default(130, room=0.4, delay_fb=0.25, delay_beats=1.0)
