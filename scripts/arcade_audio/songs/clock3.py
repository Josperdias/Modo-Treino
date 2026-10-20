"""Fundição de Engrenagens — EBM / industrial, 126 bpm, dó# frígio. Baixo sequenciado em semicolcheias com saltos de oitava (filtro que fecha a cada nota),
bumbo de quatro, caixa de cano, bigorna, catraca de engrenagem, corrente e canos afinados; voz de robô cantarolando por formantes esmagados; zumbido
desafinado e o intervalo de segunda menor (ré sobre dó#) segurando a tensão. Forma (32 compassos, ~1:01): engrenagens 4 · A 8 (baixo+bateria) ·
B 8 (voz + pad) · quebra 4 (vapor, cano, subida) · C 8 (tudo, stabs e lead de alarme)."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor, Distortion
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import inst_c as IC
from songs.common import aux_default

H_I = Harmony("C#5 C#5 C#5 C#5")
H_A = Harmony("C#m C#m A A C#m C#m Bsus2 D5")
H_B = Harmony("C#m D5 C#m D5 A B5 C#m C#m")
H_K = Harmony("D5 D5 C#5 C#5")
H_C = Harmony("C#m A D5 C#m C#m A B5 D5")

BS1 = 'R r o r R r o r R r o r R r b o'
BS2 = 'R r R o r R o r R r R o r 5 b a'
BS3 = 'R . R . R r o r R . R . R r b r'

# ---- voz de robô (sílabas: passo, nota, duração, vogal). C# frígio: c#4 61 · d4 62 · e4 64 · f#4 66 · g#4 68 · a4 69 · b4 71
P1 = [(0, 61, 2, 'u'), (2, 61, 2, 'a'), (4, 64, 3, 'o'), (8, 61, 2, 'i'), (10, 61, 2, 'a'), (12, 62, 4, 'e'),
      (16, 61, 2, 'u'), (18, 61, 2, 'a'), (20, 64, 2, 'o'), (24, 66, 2, 'a'), (26, 64, 2, 'e'), (28, 61, 4, 'u')]
P2 = [(0, 64, 2, 'a'), (2, 66, 2, 'o'), (4, 68, 2, 'a'), (6, 69, 3, 'e'), (10, 68, 2, 'i'), (12, 66, 2, 'o'), (14, 64, 2, 'a'),
      (16, 62, 4, 'u'), (20, 61, 2, 'a'), (22, 62, 2, 'e'), (24, 64, 4, 'o'), (28, 62, 2, 'i'), (30, 61, 2, 'u')]
# alarme: lead sequenciado de 2 compassos (em semicolcheias), só C, B e frígio
ALARM = parse("""
c#5! . . c#5 . . d5 . . c#5 . . e5 . d5 . |
c#5! . . c#5 . . e5 . . f#5 . . e5 . d5 . |
""")


def chant(sg, phrase, bar0, gain, **kw):
    for (st, m, ln, v) in phrase:
        sg.note('voice', IC.i_robot, bar0 * 16 + st, m, ln, gain=gain, vowel=v, **kw)


def rev(sg, bar, gain=0.4, L=1.6, hp=2500):
    y = S.hp(S.reverse(S.crash(sg.rng, int(L * SR), 0.7)), hp)
    t0 = sg.t_step(bar * 16) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y, t0, gain)


def build():
    sg = K.Song(126, 32, spb=16, tail=3.0, seed=303, name='clock3')
    rng = sg.rng
    iI, iA, iB, iK, iC = 0, 4, 12, 20, 24

    # ---- baixo sequenciado (+ sub de seno que segura o chão)
    for h, bar, pat, g in ((H_A, iA, BS1, 0.95), (H_B, iB, BS2, 1.0), (H_C, iC, BS2, 1.05)):
        sg.bass('bass', IC.i_seqbass, h, bar, pat, octave=37, gain=g, cutoff=950, tau=0.1)
        sg.bass('sub', IC.i_gsub, h, bar, 'R - - - - - - - R - - - - - - -', octave=25, gain=0.9)
    # A, 2ª metade: o baixo abre espaço no compasso 8 e na repetição do 4
    sg.bass('bass', IC.i_seqbass, Harmony("C#5 C#5"), iI + 2, BS3, octave=37, gain=0.6, cutoff=600, tau=0.14)
    sg.bass('bass', IC.i_seqbass, H_K, iK, BS3, octave=37, gain=0.7, cutoff=700, tau=0.14)
    sg.bass('sub', IC.i_gsub, H_K, iK, 'R - - - - - - - - - - - - - - -', octave=25, gain=0.9)

    # ---- zumbido (drone) desafinado e pad de tensão (segunda menor)
    for h, bar, g in ((H_I, iI, 0.8), (H_A, iA, 0.5), (H_B, iB, 0.8), (H_K, iK, 1.0), (H_C, iC, 0.7)):
        for (st, ln, pc, q) in h.events():
            base = 37 + ((pc - 37) % 12)
            sg.note('drone', IC.i_dronec, bar * 16 + st, base, ln, gain=g, cutoff=520, a=0.8)
            sg.note('drone', IC.i_dronec, bar * 16 + st, base + 7, ln, gain=g * 0.45, cutoff=480, a=1.0, pan=0.25)
    # segunda menor: o ré (bII) sobre o dó# do drone, entrando devagar no B e no C
    for bar in (iB + 1, iB + 3, iC + 2, iC + 7):
        sg.note('tension', IC.i_dronec, bar * 16, 50, 16, gain=0.55, cutoff=900, a=0.5, r=0.4, pan=-0.3)
    sg.pads('pad', K.i_pad, H_B, iB, 52, 70, gain=0.5, cutoff=1100, a=0.8, r=0.8)
    sg.pads('pad', K.i_pad, H_C, iC, 52, 72, gain=0.55, cutoff=1300, a=0.5, r=0.8)

    # ---- voz de robô no B e no C
    chant(sg, P1, iB, 0.85)
    chant(sg, P2, iB + 4, 0.9)
    chant(sg, P1, iC, 0.9)
    chant(sg, P2, iC + 4, 0.95)
    chant(sg, [(0, 61, 4, 'u'), (4, 62, 4, 'a'), (8, 61, 8, 'o')], iK + 2, 0.8, bits=5, hold=3)   # eco curto na quebra
    # ---- stabs e lead de alarme (C)
    prev = None
    for bi, ev in enumerate(H_C.bars):
        pc, q = ev[0][2], ev[0][3]
        v = K.voice(prev, pc, q, 52, 72, 3)
        prev = v
        for st in (3, 6, 11):
            for k, m in enumerate(v):
                sg.note('stab', IC.i_stabc, (iC + bi) * 16 + st, m, 1, gain=0.55 / len(v) ** 0.5, pan=-0.3 + 0.3 * k, cutoff=2000, tau=0.09)
    for bar in (iC, iC + 2, iC + 4, iC + 6):
        sg.line('lead', IC.i_seqbass, ALARM, bar, gain=0.6, cutoff=2500, tau=0.12, drive=3.0, pw=0.25)
    # alarme curto no B (2 vezes, só a primeira metade)
    sg.line('lead', IC.i_seqbass, ALARM[:7], iB + 6, gain=0.45, cutoff=2200, tau=0.12, drive=3.0, pw=0.25)

    # ---- bateria industrial e metais
    kit = IC.kit_ind
    D_I = {'h': 'x.x.x.x.x.x.x.x.', 'g': '..............x.', 'ch': '...........x....'}
    D_I2 = {'k': 'x...x...x...x...', 'h': 'x.x.x.x.x.x.x.x.', 'p': '.......x........', 'g': '..............x.'}
    D_A = {'k': 'X...X...X...X...', 's': '....x.......x...', 'cl': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..o...o...o...o.',
           'q': '.x.....x.....x..', 'a': '......x.......x.'}
    D_B = {'k': 'X..xX...X.x.X...', 's': '....x.......x...', 'cl': '....x.......x...', 'h': 'xoxoxoxoxoxoxoxo',
           'p': '...x.....x..x...', 'n': '.........x......', 'ch': '.......x........', 'a': '......x.......x.'}
    D_K = {'h': 'x...x...x...x...', 'p': 'x.......x.......', 'g': '..x.......x.....', 'ch': '.......x.......x'}
    D_C = {'k': 'X..xX..xX.x.X...', 's': '....x.......x...', 'cl': '....x.x.....x...', 'h': 'xoxoxoxoxoxoxoxo', 'o': '..o...o...o...o.',
           'p': '...x.....x..x...', 'q': '.x.....x.....x..', 'n': '.........x......', 'ch': '.......x........', 'a': '......x.......x.', 'w': 'X...............'}
    sg.drums(kit, iI, 2, D_I, gain=0.8)
    sg.drums(kit, iI + 2, 2, D_I2, gain=0.9)
    sg.drums(kit, iA, 8, D_A, gain=1.0)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iK, 4, D_K, gain=0.9)
    sg.drums(kit, iC, 8, D_C, gain=1.05)
    # viradas de caixa ao fim das seções
    for bar in (iA - 1, iB - 1, iC - 1):
        sg.drums(kit, bar, 1, {'s': '............xxxx', 'g': '........x.......', 'a': '..............x.'}, gain=0.9)
    sg.drums(kit, iB - 1, 1, {'k': 'X...X...X...XXXX'}, gain=1.0)
    # catraca e canos soltos na quebra
    sg.drums(kit, iK + 3, 1, {'s': 'x.x.x.x.xxxxxxxx', 'g': 'x.......x.......'}, gain=0.9)

    # ---- efeitos: vapor, subidas, pratos ao contrário
    for bar in (iI + 1, iA + 3, iB + 5, iK + 1):
        n = int(1.1 * SR)
        steam = S.hp(rng.standard_normal(n), 4500) * np.exp(-S.tt(n) / 0.35) * np.minimum(1, S.tt(n) / 0.02) * 0.5
        sg.sample('fx', steam, bar * 16 + 12, 0.45, pan=float(rng.uniform(-0.6, 0.6)))
    sg.sample('fx', S.riser(rng, int(4 * 16 * sg.step_s * SR), 300, 9000, 0.15, 150) * 0.6, iK * 16, 0.5)
    for bar in (iA, iB, iC):
        rev(sg, bar)
        sg.sample('fx', S.crash(rng, None, 1.0) * 0.5, bar * 16, 0.4)
    sg.duck(['drone', 'pad', 'stab', 'tension'], 0.4, 0.12)
    sg.duck(['bass'], 0.25, 0.08)
    sg.post.append(lambda mix, song: np.tanh(mix * 1.25) / np.tanh(1.25))

    sg.trim = {'bass': -4.8, 'sub': -16.0, 'drone': -1.0, 'tension': 6.0, 'pad': 12.0, 'voice': 13.6, 'stab': 17.0, 'lead': 5.0, 'drums': -4.8, 'fx': 2.4}
    fx = {
        'bass': [HighpassFilter(40), LowpassFilter(2800)],
        'sub': [LowpassFilter(200)],
        'drone': [Reverb(room_size=0.6, wet_level=0.2, dry_level=0.9)],
        'tension': [Reverb(room_size=0.6, wet_level=0.2, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.3, depth=0.3, mix=0.35), Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'voice': [Reverb(room_size=0.35, wet_level=0.2, dry_level=0.9)],
        'stab': [Reverb(room_size=0.4, wet_level=0.15, dry_level=0.9)],
        'lead': [Reverb(room_size=0.3, wet_level=0.12, dry_level=0.92)],
        'drums': [Compressor(threshold_db=-16, ratio=2.8, attack_ms=10, release_ms=80)],
    }
    sg.sends = {'voice': {'echo': 0.3}, 'lead': {'echo': 0.2}, 'fx': {'verb': 0.25}, 'drums': {'verb': 0.06}}
    return sg, fx, aux_default(126, room=0.45, delay_fb=0.4, delay_beats=0.75)
