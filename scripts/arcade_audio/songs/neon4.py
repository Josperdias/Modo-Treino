"""Chip-Metal Skyline — speed metal de cartucho, 172 bpm, si menor. Guitarras de pulso+serra distorcidas (abafadas em galope, trêmolo nos refrões),
pedal duplo de bumbo curtíssimo, baixo de triângulo, tema cantado pelo pulso, solo com pré-bends e scoops, ponte épica em meio tempo com
cordas de cartucho, e uma subida de caixa até o refrão final.
Forma (44 compassos, ~1:01): intro 4 · A 8 (verso) · B 8 (refrão) · solo 8 · ponte 8 · B' 8 (refrão final, vozes dobradas)."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import inst_c as IC
from songs.common import aux_default

# ---- tema do verso (Si menor): motivo b-d-f#, resposta caindo, variação alta
A_L = parse("""
b4! - - d5 - - f#5 - - e5 d5 - b4 - - . |
a4 - - b4 - - d5 - - - - - . . . . |
g4 - - b4 - - d5 - - e5 - d5 - b4 - - |
a4 - - c#5 - - e5 - - a5 - - g5 - e5 - |
b4! - - d5 - - f#5 - - a5 f#5 - d5 - - . |
b5 - - - - - a5 - f#5 - - - d5 - - - |
g5 - - - f#5 - e5 - - d5 - b4 - - d5 - |
f#5 - - - - - - - c#5 - e5 - f#5 - - - |
""")
# ---- refrão: notas longas e altas, subida em arpejo e queda
B_L = parse("""
d6! - - - - - b5 - - - g5 - b5 - d6 - |
a5! - - - - - f#5 - - - d5 - f#5 - a5 - |
c#6! - - - - - e6 - - - c#6 - a5 - - - |
b5 - - - d6 - - - f#6 - - - e6 - d6 - |
d6! - - - - - b5 - - - g5 - b5 - d6 - |
f#6! - - - - - a6 - - - f#6 - d6 - a5 - |
g5 - - b5 - - e6 - - - d6 - b5 - g5 - |
f#6 - - - e6 - c#6 - - - a5 - f#5 - - - |
""")
# ---- solo
SOLO = parse("""
d6! - - - - - - - - - f#6 - e6 - d6 - |
b5 - - - g5 - b5 d6 - - b5 - g5 - - - |
a5 f#5 a5 d6 f#6 d6 a5 d6 f#6 a6 f#6 d6 a5 f#5 d5 f#5 |
e6! - - - - - - - c#6 - a5 - e5 - - - |
g5 b5 e6 b5 g5 b5 e6 g6 e6 b5 g5 b5 e6 g6 b6 - |
b6! - - - - - g6 - - - d6 - b5 - g5 - |
a5 c#6 e6 a6 e6 c#6 a5 c#6 e6 a6 g6 e6 c#6 a5 e5 c#5 |
c#6! - - - - - - - f#6 - - - - - - - |
""")
# ---- ponte épica
BR_L = parse("""
g5 - - - - - b5 - - - d6 - - - - - |
e6 - - - - - - - d6 - c#6 - a5 - - - |
b5 - - - - - d6 - - - f#6 - - - - - |
g6 - - - - - - - f#6 - e6 - d6 - - - |
b5 - - - d6 - - - g6 - - - - - b6 - |
a6 - - - - - - - e6 - - - c#6 - - - |
c#6 - - - - - - - - - - - . . . . |
. . . . . . . . . . . . . . . . |
""")

H_I = Harmony("Bm G A F#5")
H_A = Harmony("Bm Bm G A Bm Bm G F#5")
H_B = Harmony("G D A Bm G D Em F#5")
H_S = Harmony("Bm G D A Em G A F#5")
H_BR = Harmony("G A Bm G G A F#5 F#5")

GALLOP = 'R . r r R . r r R . r r R . r r'
GALLOP_V = 'R . r r R . r b R . r r R . 5 r'
GALLOP_S = 'R . r r R . r r R . r r R . r a'
RING = 'R - - - R - - - R - - - R - r r'
HALF = 'R - - - - - - - - - - - - - - -'


def build():
    sg = K.Song(172, 44, spb=16, tail=2.5, seed=412, name='neon4')
    rng = sg.rng
    iI, iA, iB, iS, iBR, iB2 = 0, 4, 12, 20, 28, 36

    # ---- guitarras duplas (esquerda: pulso fino, direita: pulso largo) e baixo de triângulo
    def gtr(h, bar, pat, mute, trem=0.0, g=1.0):
        sg.bass('gtrL', IC.i_riff, h, bar, pat, octave=47, gain=g, pan=-0.55, mute=mute, trem=trem, duty=0.125)
        sg.bass('gtrR', IC.i_riff, h, bar, pat, octave=47, gain=g, pan=0.55, mute=mute, trem=trem, duty=0.25)

    gtr(H_I, iI, RING, False, 15.0, 0.8)
    gtr(H_A, iA, GALLOP_V, True, 0.0, 0.9)
    gtr(H_B, iB, RING, False, 15.0, 1.0)
    gtr(H_S, iS, GALLOP_S, True, 0.0, 0.9)
    gtr(H_BR, iBR, HALF, False, 12.0, 0.85)
    gtr(H_B, iB2, RING, False, 15.0, 1.05)
    BASS8 = 'R . R . R . R . R . R . R . R .'
    BASS_G = 'R . r r R . r r R . r r R . r r'
    for h, bar, pat in ((H_I, iI, BASS8), (H_A, iA, BASS_G), (H_B, iB, BASS8), (H_S, iS, BASS_G), (H_BR, iBR, 'R - - - - - - - R - - - - - - -'), (H_B, iB2, BASS8)):
        sg.bass('bass', K.i_tri, h, bar, pat, octave=35, gain=1.0, bits=5)

    # ---- intro: arpejos rápidos de pulso sobre trêmolo
    for bar in range(4):
        sg.arp('arp', K.i_nes, H_I, iI + bar, '0 1 2 3 2 1 0 1 2 3 4 3 2 1 0 1', lo=59 if bar % 2 == 0 else 62, gain=0.55, pan=0.3,
               duty=0.125, decay=0.09, vib=0.0)

    # ---- melodias (pulso 25 % com vibrato; refrão dobra com pulso 12,5 % uma oitava abaixo)
    sg.line('lead', K.i_nes, A_L, iA, gain=1.0, duty=0.25, vib=0.008, decay=0.9)
    sg.line('lead', K.i_nes, B_L, iB, gain=1.05, duty=0.5, vib=0.01, duty2=0.25)
    sg.line('lead2', K.i_nes, shift(B_L, 0, -12, 0.7), iB, gain=0.5, duty=0.125, pan=-0.3)
    sg.line('lead', IC.i_solo, SOLO, iS, gain=1.0, pre=1.0, scoop=1.0)
    sg.line('lead', IC.i_pulsepad, BR_L, iBR, gain=1.0, a=0.1, r=0.3, cutoff=3200)
    sg.line('lead2', K.i_vrc6, shift(BR_L, 0, -12, 0.7), iBR, gain=0.55, vib=0.004, pan=0.3)
    sg.line('lead', K.i_nes, B_L, iB2, gain=1.1, duty=0.5, vib=0.011, duty2=0.25)
    sg.line('lead2', K.i_nes, shift(B_L, 0, -12, 0.7), iB2, gain=0.55, duty=0.125, pan=-0.3)
    sg.line('lead3', K.i_vrc6, shift(B_L, 0, 12, 0.6), iB2, gain=0.45, vib=0.006, pan=0.35)
    # ponte: cordas de cartucho nos acordes
    sg.pads('pad', IC.i_pulsepad, H_BR, iBR, 55, 76, gain=0.7, a=0.25, r=0.4, cutoff=2400)

    # ---- bateria
    kit = IC.kit_metal
    D_I = {'k': 'x...x...x...x...', 'h': 'x.x.x.x.x.x.x.x.', 'c': 'X...............'}
    D_A = {'k': 'x.xxx.xxx.xxx.xx', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}
    D_B = {'k': 'XxxxXxxxXxxxXxxx', 's': '....x.......x...', 'c': 'X...............', 'o': 'x.x.x.x.x.x.x.x.'}
    D_S = {'k': 'x.xxx.xxx.xxx.xx', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'c': 'X...............'}
    D_BR = {'k': 'X.......x.x.....', 's': '........x.......', 'h': 'x.x.x.x.x.x.x.x.', 'c': 'X...............'}
    sg.drums(kit, iI, 4, D_I, gain=0.9)
    sg.drums(kit, iA, 8, D_A, gain=1.0)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iS, 8, D_S, gain=1.0)
    sg.drums(kit, iBR, 7, D_BR, gain=1.0)
    sg.drums(kit, iB2, 8, D_B, gain=1.05)
    # viradas de tom ao fim das seções
    for bar in (iA - 1, iB - 1, iS - 1, iB2 - 1):
        sg.drums(kit, bar, 1, {'s': 'x...x...xxxxxxxx', 't1': '..........x.....', 't2': '............x...', 't3': '..............x.', 'k': 'x.x.x.x.x.......', 'c': '................'}, gain=0.95)
    # última virada (volta ao intro) e rufo de caixa na saída da ponte
    sg.drums(kit, 43, 1, {'s': 'x.x.x.x.xxxxxxxx', 'k': 'x...x...x.......', 't1': '..........x.....', 't2': '............x...', 't3': '..............x.'}, gain=0.95)
    sg.drums(kit, iBR + 7, 1, {'s': 'x.x.x.x.xxxxxxxx', 'k': 'x...x...xxxxxxxx', 'c': '................'}, gain=0.95)
    # ---- efeitos: subida de ruído para o refrão final, pratos nas entradas
    sg.sample('fx', S.riser(rng, int(16 * 4 * sg.step_s * SR), 400, 9000, 0.1, 250) * 0.5, (iBR + 6) * 16, 0.5)
    for bar in (iA, iB, iS, iBR, iB2):
        sg.sample('fx', S.crash(rng, None, 0.9) * 0.4, bar * 16, 0.35)

    sg.duck(['pad'], 0.3, 0.12)
    sg.trim = {'gtrL': -1.5, 'gtrR': 0.0, 'bass': -5.3, 'lead': -3.5, 'lead2': -1.0, 'lead3': 7.0, 'arp': 0.3, 'pad': 8.7, 'drums': -2.0, 'fx': 8.0}
    fx = {
        'lead': [Reverb(room_size=0.25, wet_level=0.12, dry_level=0.95)],
        'lead2': [Reverb(room_size=0.3, wet_level=0.14, dry_level=0.9)],
        'lead3': [Reverb(room_size=0.3, wet_level=0.14, dry_level=0.9)],
        'arp': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.5, depth=0.2, mix=0.3), Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'bass': [LowpassFilter(1500)],
        'gtrL': [HighpassFilter(80)],
        'gtrR': [HighpassFilter(80)],
        'drums': [Compressor(threshold_db=-18, ratio=2.2, attack_ms=8, release_ms=70)],
    }
    sg.sends = {'lead': {'echo': 0.12}, 'lead2': {'echo': 0.1}, 'fx': {'verb': 0.25}}
    return sg, fx, aux_default(172, room=0.4, delay_fb=0.3, delay_beats=0.75)
