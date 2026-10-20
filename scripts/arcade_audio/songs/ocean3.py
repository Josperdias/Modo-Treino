"""Arrebentação — surf rock instrumental, 150 bpm, lá menor harmônico. Guitarra em palhetada de tremolo com reverb de mola (resposta ao impulso de
'boings' convolvida), baixo de palheta galopante, bateria de surf com tons de chão e rufos descendo, guitarra base abafada, ondas de ruído que enchem e
arrebentam. A melodia é feita de arcos longos (a 'onda': sobe, quebra, escorre) e o B responde com corridas de colcheias em fá/mi. A quebra é uma
praia com arpejo limpo; o final termina num 'mergulho' de guitarra (a barra desce) até a maré da intro.
Forma (40 compassos, ~1:04): maré 2 · A 8 · B 8 · praia 4 · A' 8 · B' 8 · mergulho 2."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor, Convolution
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst_d as ID
import kits_d as KD
from songs.common import aux_default

H_I = Harmony("Am Am")
H_A = Harmony("Am Am Dm Dm F E7 Am Am_E7")
H_B = Harmony("F E F E Dm E7 Am E7")
H_C = Harmony("Am F Dm E7")
H_O = Harmony("E7 E7")

MA = parse("""
e5 - - - a5 - - - c6 - - - b5 - - - |
a5 - - - - - - - g#5 - e5 - a5 - - - |
f5 - - - a5 - - - d6 - - - c6 - a5 - |
d6 - - - - - - - c6 - a5 - f5 - - - |
a5 - - - c6 - - - f6 - - - e6 - c6 - |
b5 - - - g#5 - - - e5 - - - d5 - b4 - |
a4 - - - c5 - - - e5 - - - a5 - - - |
c6 - - - b5 - - - g#5 - - - e5 - - - |
""")
MB = parse("""
a5 a5 c6 c6 a5 a5 c6 c6 f6 - - - e6 - c6 - |
b5 b5 e6 e6 b5 b5 e6 e6 d6 - - - b5 - g#5 - |
a5 a5 c6 c6 a5 a5 c6 c6 f6 - - - a6 - - - |
g#6 - - - - - - - e6 - - - b5 - - - |
d6 d6 f6 f6 d6 d6 f6 f6 a6 - - - f6 - d6 - |
b5 b5 d6 d6 b5 b5 d6 d6 g#6 - - - e6 - d6 - |
c6 - - - e6 - - - a6 - - - - - - - |
g#6 - b6 - g#6 - e6 - d6 - b5 - g#5 - e5 - |
""")
MC = parse("""
c6 - - - - - - - - - - - b5 - - - |
a5 - - - - - - - - - - - c6 - - - |
d6 - - - - - - - - - - - a5 - - - |
b5 - - - - - - - g#5 - - - - - - - |
""")
MO = parse("""
e6 - - - - - - - d6 - - - b5 - - - |
g#5 - - - - - - - - - - - . . . . |
""")


def chops(sg, harm, bar0, steps, lo=45, gain=0.5, pan=-0.3):
    """Guitarra base abafada: raiz + quinta nos passos dados de cada compasso."""
    ev = harm.events()
    for bi in range(len(harm)):
        for s in steps:
            ab = bi * 16 + s
            cur = [e for e in ev if e[0] <= ab < e[0] + e[1]][-1]
            r = lo + ((cur[2] - lo) % 12)
            for m in (r, r + 7):
                sg.note('chop', ID.i_chop, bar0 * 16 + ab, m, 1, gain=gain / 1.4, pan=pan, vel=0.95 if s % 4 == 0 else 0.7)


def build():
    sg = K.Song(150, 40, spb=16, tail=4.0, seed=505, name='ocean3')
    rng = sg.rng
    iI, iA, iB, iC, iA2, iB2, iO = 0, 2, 10, 18, 22, 30, 38

    # ---- baixo de palheta: galope (A, A'), colcheias (B), sustentado (praia)
    GAL = 'R - r r R - r r R - r r R - r r'
    EIGHT = 'R - r - R - r - R - r - R - r -'
    for h, bar in ((H_I, iI),):
        sg.bass('bass', ID.i_pbass, h, bar, 'R - - - - - - - - - - - - - - -', octave=38, gain=0.7)
    for h, bar in ((H_A, iA), (H_A, iA2)):
        sg.bass('bass', ID.i_pbass, h, bar, GAL, octave=38, gain=0.95)
    for h, bar in ((H_B, iB), (H_B, iB2)):
        sg.bass('bass', ID.i_pbass, h, bar, EIGHT, octave=38, gain=1.0, tau=0.2)
    sg.bass('bass', ID.i_pbass, H_C, iC, 'R - - - - - - - - - - - - - - -', octave=38, gain=0.75, tau=0.6)
    sg.bass('bass', ID.i_pbass, H_O, iO, 'R - - - - - - - R - - - r - r -', octave=38, gain=0.9)

    # ---- guitarra base abafada
    chops(sg, H_A, iA, range(0, 16, 2), gain=0.55)
    chops(sg, H_A, iA2, range(0, 16, 2), gain=0.6)
    chops(sg, H_B, iB, (0, 3, 6, 8, 11, 14), gain=0.6, pan=-0.35)
    chops(sg, H_B, iB2, (0, 3, 6, 8, 11, 14), gain=0.65, pan=-0.35)

    # ---- melodias em tremolo (principal) + oitava acima no retorno
    sg.line('lead', ID.i_trem, MA, iA, gain=0.9)
    sg.line('lead', ID.i_trem, MB, iB, gain=0.95, rate=17.0)
    sg.line('lead', ID.i_trem, MA, iA2, gain=0.95)
    sg.line('lead2', ID.i_trem, shift(MA, 0, 12, 0.7), iA2, gain=0.45, rate=13.0, pan=0.4, cutoff=6000)
    sg.line('lead', ID.i_trem, MB, iB2, gain=1.0, rate=17.0)
    sg.line('lead2', ID.i_trem, shift(MB, 0, -12, 0.7), iB2, gain=0.5, rate=14.0, pan=-0.4)
    sg.line('lead', ID.i_trem, MO, iO, gain=0.9, rate=14.0)
    # praia: melodia longa (limpa) e arpejo
    sg.line('clean', ID.i_eguitar, MC, iC, gain=0.8, drive=1.2, cutoff=3800, decay=0.9985)
    sg.arp('clean', ID.i_eguitar, H_C, iC, '0 . 1 . 2 . 3 . 2 . 1 . 2 . 3 .', lo=50, gain=0.5, drive=1.1, cutoff=3200)
    # mergulho (barra descendo) no final
    ID.glide(sg, 'lead', (iO + 1) * 16 + 4, 2.2, 92, 40, gain=0.7, kind='saw')

    # ---- bateria de surf
    kit = KD.kit_surf
    D_A = {'k': 'x.....x.x.......', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..............o.'}
    D_B = {'k': 'x.....x.x.....x.', 's': '....x.......x...', 'r': 'x.x.x.x.x.x.x.x.', 't3': '..x...x...x...x.', 'x': '...o...o...o...o'}
    FILL = {'k': 'x...............', 's': '....xxxx........', 't1': '........xx......', 't2': '..........xx....', 't3': '............xxxx'}

    def kitbars(bar0, bars, base, gain=1.0):
        for b in range(bar0, bar0 + bars):
            sg.drums(kit, b, 1, FILL if (b - bar0) % 4 == 3 else base, gain=gain)
    sg.drums(kit, iI, 1, {'s': 'oooooooooooooooo'}, gain=0.55)
    sg.drums(kit, iI + 1, 1, {'s': 'xxxxxxxxxxxxxxxx', 't3': 'x...x...x...x...'}, gain=0.8)
    kitbars(iA, 8, D_A)
    kitbars(iB, 8, D_B, gain=1.05)
    sg.drums(kit, iC, 3, {'k': 'x...............', 'x': '....o.......o...', 'o': '..o...o...o...o.'}, gain=0.55)
    sg.drums(kit, iC + 3, 1, {'s': 'oooooooooxxxxxxx', 't3': 'o...o...x...x...'}, gain=0.8)
    kitbars(iA2, 8, D_A)
    kitbars(iB2, 8, D_B, gain=1.1)
    sg.drums(kit, iO, 1, D_A, gain=0.9)
    sg.drums(kit, iO + 1, 1, {'k': 'x...............', 's': '....xxxx........', 't1': '........xx......', 't2': '..........xx....', 't3': '............xxxx'}, gain=0.8)
    for bar in (iA, iB, iA2, iB2):
        sg.sample('fx', S.crash(rng, None, 1.4) * 0.6, bar * 16, 0.7)

    # ---- ondas
    def wash(bar, bars=2, peak=0.5, pan=0.0):
        sg.sample('wave', ID.ocean_wash(rng, bars * 16 * sg.step_s, 200, 3200, peak), bar * 16, 1.0, pan=pan)
    wash(iI, 2, 0.7)
    wash(iC, 2, 0.7, -0.3)
    wash(iC + 2, 2, 0.7, 0.3)
    wash(iB - 1, 1, 0.3)
    wash(iB2 - 1, 1, 0.3)
    wash(iO, 2, 0.8)

    sg.duck(['clean'], 0.2, 0.15)
    sg.trim = {'bass': -6.5, 'chop': 9.0, 'lead': 0.0, 'lead2': 4.5, 'clean': 8.0, 'drums': -5.5, 'wave': -2.5, 'fx': 4.0}
    ID.automate(sg, [(0, -5), (2, 0), (17.5, 0), (18.5, -4), (21, -4), (22, 0), (38, 0), (40, -2)])
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(51), drive=1.2, lp_hz=12000, hiss_level=0.002))
    spring = lambda mix=0.4: Convolution(ID.spring_ir(), mix=mix, sample_rate=SR)
    fx = {
        'bass': [LowpassFilter(1800)],
        'chop': [HighpassFilter(120), spring(0.25)],
        'lead': [spring(0.45), Reverb(room_size=0.3, wet_level=0.12, dry_level=0.95)],
        'lead2': [spring(0.45), Reverb(room_size=0.3, wet_level=0.12, dry_level=0.95)],
        'clean': [Chorus(rate_hz=0.5, depth=0.2, mix=0.3), spring(0.5), Reverb(room_size=0.6, wet_level=0.25, dry_level=0.85)],
        'wave': [LowpassFilter(3600)],
        'drums': [Compressor(threshold_db=-18, ratio=2.2, attack_ms=8, release_ms=100)],
    }
    sg.sends = {'lead': {'echo': 0.15}, 'clean': {'echo': 0.3}, 'fx': {'verb': 0.25}, 'drums': {'verb': 0.05}}
    return sg, fx, aux_default(150, room=0.5, delay_fb=0.3, delay_beats=0.75)
