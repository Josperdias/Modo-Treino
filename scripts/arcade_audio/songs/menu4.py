"""Menu 4 — "Fuga de Fliperama": barroco de 8 bits, 96 bpm, si menor. Cravo (cordas Karplus em oitava) em duas vozes: sujeito, resposta tonal na dominante
com contra-sujeito, episódio em sequência pela escala de quintas (Si m · Mi m · Lá · Ré · Sol · Dó# dim · Fá# · Si m), cordas pizzicato e violoncelo no baixo, caixinha
de timpano/triângulo e tick de chip. A parte B muda de humor (ré maior, tema novo e síncopado com eco em cânone de pulso). No A' o violoncelo toma o sujeito e o cravo
inverte as vozes. A coda para na dominante (Fá# → Fá#7, arpejo rolado) e o laço volta ao arpejo de chip do começo.
Forma (28 compassos, ~70 s): intro 2 · A 8 (exposição + episódio) · B 8 · A' 8 · coda 2."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import Harmony, shift, bars_of
import inst_a as IA
import kits_a as KA
from inst_a import score, comp_chords
from songs.common import aux_default

SPB = 16
NB = 28

# ---------------- sujeito (2 compassos), resposta (dominante, tonal) e contra-sujeito
S1 = score(SPB, 2, {
    0: 'b4 - d5 - f#5 - b5 - - - a5 g5 f#5 e5 d5 c#5',
    1: 'b4 - e5 - g5 - e5 - c#5 - a#4 - c#5 - f#5 -',
})
S2 = score(SPB, 2, {
    0: 'f#4 - a#4 - c#5 - f#5 - - - e5 d5 c#5 b4 a#4 g#4',
    1: 'f#4 - b4 - d5 - b4 - c#5 - a#4 - c#5 - f#5 -',
})
CS = score(SPB, 2, {
    0: 'c#6 b5 a#5 b5 c#6 - - - a#5 - c#6 - f#6 - e6 -',
    1: 'd6 - b5 - d6 - f#6 - e6 - c#6 - a#5 - c#6 -',
})
C1 = score(SPB, 2, {
    0: 'b5 a5 b5 c#6 d6 - - - f#6 - d6 - b5 - d6 -',
    1: 'e6 d6 e6 f#6 g6 - - - c#6 - a#5 - c#6 - e6 -',
})
# episódio: arpejos de semicolcheias, um por acorde (8 passos); a sequência desce por quintas
EPI = score(SPB, 4, {
    0: 'f#5 d5 b4 d5 f#5 b5 a5 f#5 g5 e5 b4 e5 g5 b5 a5 g5',
    1: 'e5 c#5 a4 c#5 e5 a5 g5 e5 f#5 d5 a4 d5 f#5 a5 g5 f#5',
    2: 'g5 d5 b4 d5 g5 b5 a5 g5 g5 e5 c#5 e5 g5 e5 c#5 e5',
    3: 'c#5 a#4 f#4 a#4 c#5 f#5 e5 c#5 d5 b4 f#4 b4 d5 f#5 b5 .',
})
EPI_END = score(SPB, 4, {   # no A' a frase termina na dominante (meia-cadência)
    3: 'g5 e5 b4 e5 g5 b5 a5 g5 c#5 a#4 f#4 a#4 c#5 f#5 e5 c#5',
})
EPI_V2 = score(SPB, 4, {   # tenor em semínimas
    0: 'b3 - - - d4 - - - e4 - - - g4 - - -',
    1: 'a3 - - - c#4 - - - d4 - - - f#4 - - -',
    2: 'g3 - - - b3 - - - c#4 - - - e4 - - -',
    3: 'f#3 - - - a#3 - - - b3 - - - d4 - - -',
})
# ---------------- parte B (ré maior): tema síncopado em 3+3+4+2+2+2
T_B = score(SPB, 8, {
    0: 'f#5 - . a5 - . d6 - - - a5 - f#5 - d5 -',
    1: 'd5 - . f#5 - . b5 - - - f#5 - d5 - b4 -',
    2: 'g5 - . b5 - . d6 - c#6 - e6 - a5 - c#6 -',
    3: 'd6 - a5 - f#5 - . . a#5 - c#6 - f#6 - c#6 -',
    4: 'b5 - . d6 - . f#6 - - - d6 - b5 - f#5 -',
    5: 'g5 - b5 - d6 - g6 - e6 - b5 - g5 - e5 -',
    6: 'a5 - c#6 - e6 - a6 - b5 - d6 - f#6 - d6 -',
    7: 'c#6 - a#5 - f#5 - . . c#6 . a#5 . f#5 - - -',
})
FANFARE = score(SPB, 2, {
    0: 'b3 d4 f#4 b4 d5 f#5 b5 f#5 d5 b4 f#4 d4 b3 - - -',
    1: 'e4 g4 b4 e5 g5 b5 e6 b5 a#5 f#5 c#5 a#4 f#4 - - -',
})
CODA1 = score(SPB, 2, {
    0: 'c#6 - - - a#5 - - - f#5 - - - c#5 - - -',
    1: 'f#4 a#4 c#5 e5 f#5 a#5 c#6 - - - - - - - - -',
})

H_I = Harmony("Bm Em_F#", SPB)
H_A = Harmony("Bm Em_F# F# Bm_F# Bm_Em A_D G_C#dim F#_Bm", SPB)
H_B = Harmony("D Bm G_A D_F# Bm G_Em A_Bm F#", SPB)
H_A2 = Harmony("Bm Em_F# F# Bm_F# Bm_Em A_D G_C#dim Em_F#", SPB)
H_O = Harmony("F# F#7", SPB)


def sub(h, a, b):
    s = Harmony('', h.spb)
    s.bars = h.bars[a:b]
    return s


def build():
    sg = K.Song(96, NB, spb=SPB, tail=3.0, seed=96, name='menu4')
    rng = sg.rng
    iI, iA, iB, iA2, iO = 0, 2, 10, 18, 26
    # ---------------- intro: arpejo de chip (fanfarra de "insira a moeda")
    sg.line('chip', K.i_nes, FANFARE, iI, gain=0.22, duty=0.125, decay=0.25, vib=0.0)
    sg.pads('str', IA.i_strings, H_I, iI, 52, 76, gain=0.2, a=0.5, r=0.8)
    sg.bass('cello', IA.i_cello, H_I, iI, 'R - - - - - - - - - - - - - - -', octave=40, gain=0.8)
    # ---------------- A: exposição (cravo 1 sujeito, cravo 2 resposta) e episódio
    hp = dict(bright=0.1, decay=0.9968)
    sg.line('hp1', IA.i_harpsi, S1, iA, gain=0.55, pan=-0.25, **hp)
    sg.line('hp2', IA.i_harpsi, S2, iA + 2, gain=0.9, pan=0.3, **hp)
    sg.line('hp1', IA.i_harpsi, CS, iA + 2, gain=0.85, pan=-0.25, **hp)
    sg.line('hp1', IA.i_harpsi, EPI, iA + 4, gain=0.8, pan=-0.2, **hp)
    sg.line('hp2', IA.i_harpsi, EPI_V2, iA + 4, gain=0.7, pan=0.3, **hp)
    sg.bass('cello', IA.i_cello, sub(H_A, 0, 4), iA, 'R - - - - - - - 5 - - - - - - -', octave=40, gain=0.4)
    sg.bass('pizz', IA.i_pizz, sub(H_A, 4, 8), iA + 4, 'R . . . . . . . R . . . . . . .', octave=40, gain=0.9)
    sg.bass('cello', IA.i_cello, sub(H_A, 4, 8), iA + 4, 'R - - - - - - - R - - - - - - -', octave=40, gain=0.55)
    sg.pads('str', IA.i_strings, sub(H_A, 4, 8), iA + 4, 52, 76, gain=0.4, a=0.3, r=0.6, cutoff=2800)
    # ---------------- B: tema novo (ré maior), pizzicato "oom-pah", eco de pulso em cânone de uma semínima
    sg.line('hp1', IA.i_harpsi, T_B, iB, gain=0.9, pan=-0.2, **hp)
    sg.line('chip', K.i_nes, shift(T_B, 4, 12, 0.5), iB, gain=0.32, duty=0.25, decay=0.18, vib=0.0, pan=0.4)
    comp_chords(sg, 'pizz', IA.i_pizz, H_B, iB, {4: 2, 12: 2}, 55, 75, gain=0.8, n=3)
    sg.bass('cello', IA.i_cello, H_B, iB, 'R - - - 5 - - - R - - - 5 - - -', octave=40, gain=0.7)
    sg.bass('pizz', IA.i_pizz, H_B, iB, 'R . . . . . . . R . . . . . . .', octave=40, gain=0.8)
    sg.pads('str', IA.i_strings, H_B, iB, 52, 76, gain=0.5, a=0.3, r=0.6, cutoff=2800)
    # ---------------- A': o violoncelo toma o sujeito, o cravo 1 faz o contracanto (C1) e depois as vozes trocam (resposta no agudo, contra-sujeito no grave)
    sg.line('cello', IA.i_cello, shift(S1, 0, -24), iA2, gain=1.25)
    sg.line('hp1', IA.i_harpsi, C1, iA2, gain=1.0, pan=-0.25, **hp)
    sg.line('hp1', IA.i_harpsi, shift(S2, 0, 12), iA2 + 2, gain=1.05, pan=-0.25, **hp)
    sg.line('hp2', IA.i_harpsi, shift(CS, 0, -12), iA2 + 2, gain=0.8, pan=0.3, **hp)
    sg.line('hp1', IA.i_harpsi, bars_of(EPI, SPB, 0, 3), iA2 + 4, gain=0.8, pan=-0.2, **hp)
    sg.line('hp1', IA.i_harpsi, EPI_END, iA2 + 4, gain=0.8, pan=-0.2, **hp)
    sg.line('chip', K.i_nes, shift(bars_of(EPI, SPB, 0, 3), 0, 12, 0.5), iA2 + 4, gain=0.35, duty=0.125, decay=0.1, vib=0.0, pan=0.4)
    sg.line('chip', K.i_nes, shift(EPI_END, 0, 12, 0.5), iA2 + 4, gain=0.35, duty=0.125, decay=0.1, vib=0.0, pan=0.4)
    sg.line('hp2', IA.i_harpsi, EPI_V2, iA2 + 4, gain=0.7, pan=0.3, **hp)
    sg.bass('cello', IA.i_cello, sub(H_A2, 2, 4), iA2 + 2, 'R - - - - - - - 5 - - - - - - -', octave=40, gain=0.85)
    sg.bass('pizz', IA.i_pizz, sub(H_A2, 4, 8), iA2 + 4, 'R . . . . . . . R . . . . . . .', octave=40, gain=0.9)
    sg.bass('cello', IA.i_cello, sub(H_A2, 4, 8), iA2 + 4, 'R - - - - - - - R - - - - - - -', octave=40, gain=0.55)
    sg.pads('str', IA.i_strings, H_A2, iA2, 52, 76, gain=0.8, a=0.3, r=0.6, cutoff=3000)
    # ---------------- coda: dominante em suspensão e o arpejo rolado
    sg.line('hp1', IA.i_harpsi, CODA1, iO, gain=0.9, pan=-0.2, **hp)
    sg.pads('str', IA.i_strings, H_O, iO, 52, 76, gain=0.5, a=0.3, r=0.9)
    sg.bass('cello', IA.i_cello, H_O, iO, 'R - - - - - - - - - - - - - - -', octave=40, gain=0.9)
    # ---------------- percussão de fliperama barroco
    kit = KA.kit_arc
    sg.drums(kit, iI, 2, {'h': 'x.x.x.x.x.x.x.x.'}, gain=0.35)
    sg.drums(kit, iA, 2, {'tr': 'x...............'}, gain=0.5)
    sg.drums(kit, iA + 2, 2, {'k': 'x.......x.......', 'h': '..x...x...x...x.'}, gain=0.45)
    sg.drums(kit, iA + 4, 4, {'k': 'x...x...x...x...', 'h': 'x.x.x.x.x.x.x.x.', 'w': '..x...x...x...x.'}, gain=0.7)
    sg.drums(kit, iB, 8, {'b': 'x.......x...x...', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'w': '..x...x...x...x.'}, gain=0.9)
    sg.drums(kit, iA2, 4, {'k': 'x...x...x...x...', 'h': '..x...x...x...x.', 'tr': 'x...............'}, gain=0.85)
    sg.drums(kit, iA2 + 4, 4, {'k': 'x...x...x...x...', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'w': '..x...x...x...x.'}, gain=1.2)
    sg.drums(kit, iO, 1, {'k': 'x...............', 'tr': 'x...............'}, gain=0.8)
    for bar in (iB - 1, iA2 - 1):
        sg.drums(kit, bar, 1, {'t1': '............x...', 't2': '..............x.', 't3': '...............x', 's': '............x.x.'}, gain=0.8)
    sg.sample('fx', S.crash(rng, None, 0.9) * 0.5, iB * SPB, 0.5)
    sg.sample('fx', S.crash(rng, None, 0.9) * 0.5, iA2 * SPB, 0.35)
    sg.duck(['str'], 0.2, 0.12, steps=None)
    sg.trim = {'chip': 6.0, 'str': 9.0, 'cello': 6.5, 'pizz': 9.0, 'hp1': 12.0, 'hp2': 11.0, 'drums': 4.0, 'fx': 12.0}
    fx = {
        'hp1': [Reverb(room_size=0.35, wet_level=0.18, dry_level=0.9)],
        'hp2': [Reverb(room_size=0.35, wet_level=0.18, dry_level=0.9)],
        'chip': [Reverb(room_size=0.25, wet_level=0.12, dry_level=0.92), LowpassFilter(7500)],
        'str': [Chorus(rate_hz=0.3, depth=0.2, mix=0.3), Reverb(room_size=0.55, wet_level=0.25, dry_level=0.8)],
        'cello': [LowpassFilter(2200)],
        'pizz': [Reverb(room_size=0.25, wet_level=0.1, dry_level=0.92)],
        'drums': [Compressor(threshold_db=-18, ratio=2.0, attack_ms=10, release_ms=90)],
    }
    sg.sends = {'hp1': {'echo': 0.08, 'verb': 0.08}, 'hp2': {'echo': 0.08}, 'chip': {'echo': 0.15}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(96, room=0.45, delay_fb=0.25, delay_beats=0.75)
