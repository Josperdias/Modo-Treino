"""Relógio — 7/8 (2+2+3), 126 bpm, si dórico. Madeiras de três 'ponteiros' com ciclos diferentes (3, 7 e 14 passos: defasam entre si),
piano elétrico FM, baixo caminhando, sinos de hora (coluna modal) no início das seções. Refrão em ré maior; ponte em engrenagens (Reich 3:2).
Forma (56 compassos de 7/8, ~1:33)."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import lp_post, aux_default, loader_in_gap

SPB = 14
A_L = parse("""
b5 . . . d6 . . . f#6 - - - e6 . |
d6 . . . b5 . . . g5 - - - a5 . |
g5 . . . b5 . . . d6 - - - e6 . |
c#6 . . . a#5 . . . f#5 - - - a#5 . |
f#6 . . . d6 . . . b5 - - - d6 . |
g6 . . . d6 . . . b5 - - - g5 . |
e6 . . . c#6 . . . a5 - - - c#6 . |
f#6 . . . b5 . . a#5 . c#6 . f#6 - - |
""", SPB)
B_L = parse("""
a5 . f#5 . a5 . d6 . f#6 - - - d6 . |
e6 . c#6 . e6 . a5 . c#6 - - - e6 . |
d6 . b5 . d6 . f#6 . b6 - - - f#6 . |
d6 . b5 . g5 . b5 . d6 - - - b5 . |
a5 . d6 . f#6 . a6 . f#6 - - - d6 . |
e6 . a6 . e6 . c#6 . a5 - - - c#6 . |
g6 . e6 . b5 . g5 . b5 - - - e6 . |
c#6 . e6 . a#5 . c#6 . f#6 - - - . . |
""", SPB)
BRIDGE_L = parse("""
b5 - - - - - - - - - - - - - |
. . . . d6 - - - - - - - - - |
f#6 - - - - - - - e6 - - - - - |
d6 - - - - - - - - - - - - - |
""", SPB)

H_A = Harmony("Bm7 G Em7 F#7 Bm7 G A F#7sus4_F#7", SPB)
H_B = Harmony("D A Bm7 G D A Em7 F#7", SPB)
H_C = Harmony("Bm7 Bm7 G G", SPB)
H_O = Harmony("Em7 F#7 Bm7 F#7", SPB)

# sinos da hora: quatro notas que descem em si menor pentatônico (invenção própria)
CHIME = ['f#6', 'd6', 'e6', 'b5']


def chime(sg, bar, vol=0.8):
    for k, n in enumerate(CHIME):
        sg.note('bells', K.i_modal, bar * SPB + k * 3, K.midi_of(n), 3, gain=vol, kind='bell', tilt=1.2, vel=0.9)
    sg.note('bells', K.i_modal, bar * SPB + 12, K.midi_of('b4'), 2, gain=vol * 0.9, kind='bell', tilt=2.0, vel=1.0)


def build():
    sg = K.Song(126, 56, spb=SPB, tail=3.5, seed=41, name='clock')
    rng = sg.rng
    # seções: intro 4 · A 8 · A2 8 · B 8 · ponte 8 (engrenagens) · A3 8 · B2 8 · saída 4
    iI, iA, iA2, iB, iC, iA3, iB2, iO = 0, 4, 12, 20, 28, 36, 44, 52
    # --- três ponteiros de madeira: ciclos de 2, 3 e 7 passos (defasam)
    def hands(bar0, bars, gain=1.0, h2=True, h3=True):
        for st in range(bar0 * SPB, (bar0 + bars) * SPB):
            if st % 2 == 0:
                sg.sample('wood', S.wood(2300, int(0.05 * SR), 0.014) * 0.7, st, 0.5 * gain, pan=-0.5)
            if h2 and st % 3 == 0:
                sg.sample('wood', S.wood(1500, int(0.06 * SR), 0.02) * 0.8, st, 0.45 * gain, pan=0.5)
            if h3 and st % 7 == 0:
                sg.sample('wood', S.wood(620, int(0.1 * SR), 0.04), st, 0.55 * gain, pan=0.0)
    hands(iI, 4, 0.9, False, True)
    hands(iA, 8, 0.8, True, True)
    hands(iA2, 8, 0.8)
    hands(iB, 8, 0.7)
    hands(iC, 8, 1.1)
    hands(iA3, 8, 0.8)
    hands(iB2, 8, 0.7)
    hands(iO, 4, 0.9, True, False)
    # --- harmonia
    for h, bar, g in ((H_A, iA, 0.45), (H_A, iA2, 0.5), (H_B, iB, 0.55), (H_A, iA3, 0.5), (H_B, iB2, 0.55)):
        sg.pads('pad', K.i_pad, h, bar, 50, 72, gain=g, cutoff=1400, a=0.25)
    sg.pads('pad', K.i_pad, H_C, iC, 48, 70, gain=0.5, cutoff=1000)
    sg.pads('pad', K.i_pad, H_O, iO, 50, 72, gain=0.5, cutoff=1100)
    # baixo caminhando no padrão 2+2+3
    BW = 'R . . . 5 . . . o . 5 . 3 .'
    for h, bar in ((H_A, iA), (H_A, iA2), (H_B, iB), (H_A, iA3), (H_B, iB2), (H_O, iO)):
        sg.bass('bass', K.i_fmbass, h, bar, BW, octave=36, gain=0.8, tau=0.22, index=2.0)
    sg.bass('bass', K.i_tri, H_C, iC, 'R - - - - - - - - - - - - -', octave=36, gain=0.8)
    sg.bass('bass', K.i_tri, Harmony("Bm7 F#7 Bm7 F#7", SPB), iI, 'R - - - - - - - 5 - - - - -', octave=36, gain=0.7)
    # --- melodias
    sg.line('lead', K.i_fmep, A_L, iA, gain=0.8, tau=0.6)
    sg.line('lead', K.i_fmep, A_L, iA2, gain=0.8, tau=0.6)
    sg.line('lead', K.i_modal, shift(A_L, 0, 12, 0.55), iA2, gain=0.35, kind='vibes', tilt=0.8, pan=0.35)
    sg.line('lead', K.i_nes, shift(B_L, 0, 0, 0.9), iB, gain=0.55, duty=0.25, vib=0.005, decay=0.35)
    sg.line('lead', K.i_fmep, B_L, iB, gain=0.55, tau=0.7)
    sg.line('lead', K.i_vrc6, A_L, iA3, gain=0.6, vib=0.005)
    sg.line('lead', K.i_fmep, shift(A_L, 0, 12, 0.7), iA3, gain=0.4, tau=0.5, pan=-0.3)
    sg.line('lead', K.i_nes, B_L, iB2, gain=0.6, duty=0.25, vib=0.006, decay=0.4)
    sg.line('lead', K.i_fmep, shift(B_L, 0, 12, 0.7), iB2, gain=0.45, tau=0.7, pan=0.3)
    sg.line('lead', K.i_modal, BRIDGE_L, iC, gain=0.6, kind='vibes', tilt=2.0)
    sg.line('lead', K.i_modal, BRIDGE_L, iC + 4, gain=0.6, kind='vibes', tilt=2.0)
    sg.line('lead', K.i_modal, parse("e6 - - - - - - - - - - - - - |" * 4, SPB), iO, gain=0.6, kind='bell', tilt=1.5)
    # --- ponte: engrenagens (Reich 3:2) em marimba — dois ciclos de células curtas defasadas
    CELL3 = ['b4', 'd5', 'f#5']
    CELL2 = ['b5', 'f#5']
    for st in range(iC * SPB, (iC + 8) * SPB):
        sg.note('gear', K.i_modal, st, K.midi_of(CELL3[(st - iC * SPB) % 3]), 1, gain=0.6, pan=-0.5, kind='marimba', tilt=0.7, vel=0.8 if (st % 3 == 0) else 0.55)
        if (st - iC * SPB) % 2 == 0:
            sg.note('gear', K.i_modal, st, K.midi_of(CELL2[((st - iC * SPB) // 2) % 2]) + 12, 1, gain=0.5, pan=0.5, kind='marimba', tilt=0.7, vel=0.7)
    # --- percussão (tick/tock em 2+2+3)
    kit = K.kit_tick
    D_A = {'k': 'x...x...x.....', 's': '....x.....x...', 'h': 'x.x.x.x.x.x.x.'}
    D_B = {'k': 'x...x...x...x.', 's': '....x...x.x...', 'h': 'x.x.x.x.x.x.x.', 'o': '..........x...', 'c': 'X.............'}
    sg.drums(kit, iA, 8, D_A, gain=0.9)
    sg.drums(kit, iA2, 8, D_A, gain=0.95)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iA3, 8, D_A | {'k': 'x...x...x.x...'}, gain=1.0)
    sg.drums(kit, iB2, 8, D_B, gain=1.0)
    for bar in (iA, iA2, iB, iC, iA3, iB2):
        chime(sg, bar - 1 if bar > 0 else 0, 0.55)
    chime(sg, iI, 0.8)
    sg.sample('fx', S.riser(rng, int(4 * SPB * sg.step_s * SR), 400, 7000, 0.15, 500), (iA3 - 4) * SPB, 0.6)
    sg.duck(['pad'], 0.35, 0.16)
    loader_in_gap(sg, A_L, 55, 4, gain=0.3, pan=0.2, pilot_s=0.2)
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(8), wow=0.0008, flutter=0.0005))
    lp_post(sg, 11000)
    fx = {
        'wood': [Reverb(room_size=0.2, wet_level=0.15, dry_level=0.9)],
        'bells': [Reverb(room_size=0.7, wet_level=0.35, dry_level=0.7)],
        'gear': [Reverb(room_size=0.3, wet_level=0.2, dry_level=0.85)],
        'lead': [Reverb(room_size=0.3, wet_level=0.2, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.35, depth=0.2, mix=0.3), Reverb(room_size=0.6, wet_level=0.25, dry_level=0.8)],
    }
    sg.sends = {'lead': {'echo': 0.15, 'verb': 0.15}, 'bells': {'verb': 0.3}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(126, room=0.5, delay_fb=0.3, delay_beats=0.75)
