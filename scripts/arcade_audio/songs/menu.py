"""Menu — "Cassete de fliperama". 100 bpm, ré maior (lídio), swing leve.
Duas marimbas em fase de Reich (a B adianta um passo a cada ciclo de 12 passos, volta ao uníssono em 9 compassos), depois canção
com piano elétrico FM, violão de corda e baixo FM; tudo passa por fita (wow/flutter, chiado, estalinhos). No fim do laço a fita
'carrega' a partitura do tema (pulsos de loader) e acelera de novo."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import aux_default, loader_in_gap

A1 = parse("""
f#5 . . a5 . . f#5 . e5 . d5 - - - - - |
d5 . . f#5 . . a5 . b5 . a5 - - - . . |
b5 . . d6 . . b5 . g5 . b5 - - - . . |
a5 . e5 . . . . . c#6 . e6 - - - - - |
""", 16)
A2 = parse("""
a5 . . f#5 . . d5 . f#5 . a5 - - - . . |
b5 . . a5 . . f#5 . d5 . f#5 - - - . . |
g5 . b5 . d6 . b5 . g5 - - - e5 - - - |
e5 . a5 . c#6 . e6 . a6 - - - - - - - |
""", 16)
B1 = parse("""
d6 - - - b5 - - - g5 - - - b5 - d6 - |
c#6 - - - a5 - - - f#5 - - - a5 - c#6 - |
b5 - - - g5 - - - e5 - - - g5 - b5 - |
e6 - - - c#6 - - - a5 - - - c#6 - e6 - |
""", 16)
B2 = parse("""
g6 - - f#6 d6 - - b5 g5 - b5 - d6 - - - |
e6 - - d6 c#6 - - a5 e5 - a5 - c#6 - - - |
d6 - - c#6 b5 - - f#5 d5 - f#5 - b5 - - - |
c#6 . e6 . a5 - - - b5 . d6 . g6 - - - |
""", 16)
OUT = parse("""
f#5 . . . a5 . . . d6 - - - - - - - |
f#5 . . . a5 . . . c#6 - - - - - - - |
d5 . . . f#5 . . . b5 - - - a5 - - - |
e5 . . . a5 . . . c#6 - - - e6 - - - |
""", 16)

H_A = Harmony("Dmaj7 Bm7 Gmaj7 A7sus4_A Dmaj7 Bm7 Em7 A")
H_B = Harmony("Gmaj7 F#m7 Em7 A Gmaj7 A Bm7 A_Gmaj7")
H_O = Harmony("Dmaj7 Dmaj7 Bm7 A")

# célula de 12 passos (pentatônica de ré) para as marimbas em fase
CELL = ['d5', 'e5', 'f#5', 'a5', 'b5', 'a5', 'f#5', 'e5', 'd5', 'e5', 'f#5', 'b5']


def build():
    spb = 16
    n_ph = 9           # compassos de fase
    sg = K.Song(100, n_ph + 8 + 8 + 8 + 8 + 4, spb=16, tail=3.0, swing=0.1, seed=21, name='menu')
    rng = sg.rng
    iA, iB, iA2, iB2, iO = n_ph, n_ph + 8, n_ph + 16, n_ph + 24, n_ph + 32
    # --- Reich: A fixa, B adianta um passo a cada 12 passos
    for st in range(n_ph * spb):
        a = K.midi_of(CELL[st % 12])
        sg.note('marA', K.i_modal, st, a, 1, gain=0.7, pan=-0.55, kind='marimba', tilt=0.9, vel=0.85 if st % 3 == 0 else 0.6)
        j = (st + st // 12) % 12
        b = K.midi_of(CELL[j])
        sg.note('marB', K.i_modal, st, b, 1, gain=0.7, pan=0.55, kind='marimba', tilt=0.9, vel=0.85 if st % 3 == 0 else 0.6)
    # depois da fase, a marimba A segue baixinho sob a canção (uníssono, uma oitava acima)
    for st in range(n_ph * spb, (n_ph + 16) * spb):
        a = K.midi_of(CELL[(st - n_ph * spb) % 12]) + 12
        sg.note('marA', K.i_modal, st, a, 1, gain=0.28, pan=-0.3, kind='marimba', tilt=0.7, vel=0.5)
    # --- harmonia
    sg.pads('pad', K.i_pad, H_A, iA, 50, 74, gain=0.5, cutoff=1100)
    sg.pads('pad', K.i_pad, H_B, iB, 50, 74, gain=0.55, cutoff=1300)
    sg.pads('pad', K.i_pad, H_A, iA2, 50, 74, gain=0.5, cutoff=1200)
    sg.pads('pad', K.i_pad, H_B, iB2, 50, 74, gain=0.6, cutoff=1400)
    sg.pads('pad', K.i_pad, H_O, iO, 50, 74, gain=0.5, cutoff=900)
    sg.pads('pad', K.i_pad, Harmony("Dmaj7 Dmaj7 Bm7 Bm7 Gmaj7 Gmaj7 A A"), 1, 52, 72, gain=0.4, cutoff=800)
    for h, bar in ((H_A, iA), (H_B, iB), (H_A, iA2), (H_B, iB2), (H_O, iO)):
        sg.bass('bass', K.i_fmbass, h, bar, 'R . . . . . 5 . . . R . . . o .', octave=38, gain=0.8, tau=0.3, index=1.6)
    sg.bass('bass', K.i_tri, Harmony("Dmaj7 Dmaj7 Bm7 Bm7 Gmaj7 Gmaj7 A A"), 4, 'R - - - - - - - - - - - - - - -', octave=38, gain=0.6)
    # --- melodias
    sg.line('lead', K.i_fmep, A1, iA, gain=0.8, tau=0.7)
    sg.line('lead', K.i_fmep, A2, iA + 4, gain=0.8, tau=0.7)
    sg.line('lead', K.i_fmep, B1, iB, gain=0.75, tau=0.9, bright=0.8)
    sg.line('lead', K.i_fmep, B2, iB + 4, gain=0.75, tau=0.9, bright=0.8)
    sg.line('lead', K.i_fmep, A1, iA2, gain=0.7, tau=0.7)
    sg.line('lead', K.i_modal, shift(A1, 0, 12, 0.5), iA2, gain=0.4, kind='vibes', tilt=1.0, pan=0.3)
    sg.line('lead', K.i_fmep, A2, iA2 + 4, gain=0.7, tau=0.7)
    sg.line('lead', K.i_modal, shift(A2, 0, 12, 0.5), iA2 + 4, gain=0.4, kind='vibes', tilt=1.0, pan=0.3)
    sg.line('lead', K.i_fmep, B1, iB2, gain=0.75, tau=0.9, bright=0.8)
    sg.line('lead', K.i_modal, shift(B1, 0, 12, 0.5), iB2, gain=0.35, kind='glass', pan=0.35)
    sg.line('lead', K.i_fmep, B2, iB2 + 4, gain=0.75, tau=0.9, bright=0.8)
    sg.line('lead', K.i_modal, shift(B2, 0, 12, 0.5), iB2 + 4, gain=0.35, kind='glass', pan=0.35)
    sg.line('lead', K.i_modal, OUT, iO, gain=0.7, kind='vibes', tilt=1.4)
    # violão (corda) arpejando nas seções B e A2
    for h, bar in ((H_B, iB), (H_A, iA2), (H_B, iB2)):
        sg.arp('gtr', K.i_pluck, h, bar, '0 . 1 . 2 . 3 . 2 . 1 . 0 . 1 .', lo=54, gain=0.55, pan=-0.35, decay=0.994, bright=0.5, step_len=2)
    # --- percussão macia (entra no A)
    kit = K.kit_soft
    A_D = {'k': 'x.....x...x.....', 's': '........x.......', 'h': 'x.x.x.x.x.x.x.x.'}
    B_D = {'k': 'x.....x...x...x.', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..............x.', 'w': '.......x......x.'}
    sg.drums(kit, iA, 8, A_D, gain=0.8)
    sg.drums(kit, iB, 8, B_D, gain=0.9)
    sg.drums(kit, iA2, 8, B_D, gain=0.9)
    sg.drums(kit, iB2, 8, B_D, gain=0.95)
    sg.sample('fx', S.crash(rng, None, 0.9) * 0.5, iB * spb, 0.4)
    sg.sample('fx', S.crash(rng, None, 0.9) * 0.5, iB2 * spb, 0.4)
    sg.sample('fx', S.riser(rng, int(2 * spb * sg.step_s * SR), 400, 6000) * 0.5, (iB - 2) * spb, 0.5)
    sg.sample('fx', S.riser(rng, int(2 * spb * sg.step_s * SR), 400, 6000) * 0.5, (iB2 - 2) * spb, 0.5)
    sg.duck(['pad', 'gtr'], 0.3, 0.2)
    # --- fita: wow/flutter, chiado, estalinhos; a fita acelera de novo no começo do laço e carrega a partitura no fim
    loader_in_gap(sg, A1, sg.bars - 1, 6, gain=0.28, pan=0.0, pilot_s=0.25)
    sg.post.append(lambda mix, song: TP.tape_start(mix, int(1.0 * spb * song.step_s * SR), int(1.0 * spb * song.step_s * SR), power=1.8))
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(5), wow=0.0024, flutter=0.001))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(6), drive=1.5, lp_hz=10500, hiss_level=0.003, crackle=0.022))
    fx = {
        'marA': [Reverb(room_size=0.35, wet_level=0.2, dry_level=0.85)],
        'marB': [Reverb(room_size=0.35, wet_level=0.2, dry_level=0.85)],
        'pad': [Chorus(rate_hz=0.4, depth=0.2, mix=0.35), Reverb(room_size=0.6, wet_level=0.25, dry_level=0.8)],
        'gtr': [Reverb(room_size=0.3, wet_level=0.2, dry_level=0.85)],
        'lead': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
    }
    sg.sends = {'lead': {'echo': 0.2, 'verb': 0.15}, 'marA': {'verb': 0.2}, 'marB': {'verb': 0.2}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(100, room=0.55, delay_fb=0.35, delay_beats=0.75)
