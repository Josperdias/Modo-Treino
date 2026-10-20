"""Rabisco de Garagem — pop-punk / garage, 176 bpm, mi maior. Guitarras de serra distorcida (acordes de força abafados e abertos, duas pistas
abertas nos lados), baixo de palheta em colcheias, bateria rápida e um refrão de cantar junto com coro de gritos.
Forma (44 compassos, ~1:00): riff 4 · verso 8 · pré 4 · REFRÃO 8 · verso curto 4 · quebra meio-tempo 4 · REFRÃO' 8 (coro) · saída 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_b as IB
import kits_b as KB
from songs.common import aux_default

RIFF = parse("""
e3 . e3 . g#3 . e3 . b3 . e3 . g#3 . b3 . |
e3 . e3 . g#3 . e3 . b3 . e3 . g#3 . b3 . |
a3 . a3 . c#4 . a3 . e4 . a3 . c#4 . e4 . |
b3 . b3 . d#4 . b3 . f#4 . b3 . d#4 . f#4 . |
""")
V_L = parse("""
e5 . . e5 . . g#5 . e5 . . c#5 . . . . |
c#5 . . c#5 . . e5 . c#5 . . a4 . . . . |
b4 . . b4 . . e5 . g#5 . . e5 . . . . |
f#5 - - - d#5 . . . b4 - - . . . . . |
e5 . . e5 . . g#5 . b5 . . g#5 . . e5 . |
c#6 . . c#6 . . b5 . a5 . . c#6 . . b5 . |
g#5 . . g#5 . . e5 . g#5 . . b5 . . . . |
f#5! - - - - - - - . . . . . . . . |
""")
PRE_L = parse("""
c#5 . c#5 . e5 . e5 . a5 . a5 . c#6 - - . |
c#6 . c#6 . b5 . a5 . e5 - - - a5 . b5 . |
d#6 . d#6 . d#6 . f#6 . d#6 . b5 . f#5 . b5 . |
b5! - - - - - - - f#5 - - . . . . . |
""")
C_L = parse("""
e6! . . e6 . c#6 . . a5 - - . c#6 . e6 . |
b5! . . b5 . g#5 . . e5 - - . g#5 . b5 . |
f#5! . . f#5 . g#5 . . b5 - - . d#6 - - . |
d#6! - - - . . e6 - - d#6 - . b5 - - - |
e6! . . e6 . c#6 . . a5 - - . c#6 . a5 . |
b5! . . b5 . g#5 . . e5 - - . g#5 . e5 . |
e6! . . c#6 . e6 . . g#6 - - . e6 . c#6 . |
f#6! - - - e6 - - d#6 - - b5 - - - - - |
""")
O_L = parse("""
e6! . . e6 . c#6 . . a5 - - . c#6 . e6 . |
f#6! . . f#6 . d#6 . . b5 - - . d#6 . f#6 . |
e6! - - - - - - - b5 - - - e5 - - - |
e5! - - - - - - - - - - - - - - - |
""")

H_I = Harmony("E E A B")
H_V = Harmony("C#m A E B C#m A E B")
H_P = Harmony("A A B B")
H_C = Harmony("A E B B A E C#m B")
H_V2 = Harmony("C#m A E B")
H_BR = Harmony("C#m C#m A B")
H_O = Harmony("A B E E")


def rev_crash(sg, bar, gain=0.5, length=1.4):
    y = S.reverse(S.crash(sg.rng, int(length * SR), 0.6))
    t0 = sg.t_step(bar * sg.spb) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def chug(sg, harm, bar0, pat, gain, tau=0.075):
    """Duas pistas de guitarra abafada (esquerda e direita, cortes de filtro diferentes)."""
    sg.bass('gtrL', IB.i_pwr, harm, bar0, pat, octave=40, gain=gain, pan=-0.7, tau=tau, cutoff=3400)
    sg.bass('gtrR', IB.i_pwr, harm, bar0, pat, octave=40, gain=gain, pan=0.7, tau=tau, cutoff=4000, drive=8.0)


def strum(sg, harm, bar0, pat, gain):
    sg.bass('gtrL', IB.i_pwr, harm, bar0, pat, octave=40, gain=gain, pan=-0.7, cutoff=3600)
    sg.bass('gtrR', IB.i_pwr, harm, bar0, pat, octave=40, gain=gain, pan=0.7, cutoff=4300, drive=8.0)


def build():
    sg = K.Song(176, 44, spb=16, tail=3.0, seed=17, name='sketch3')
    rng = sg.rng
    iI, iV, iP, iC, iV2, iBR, iC2, iO = 0, 4, 12, 16, 24, 28, 32, 40
    PM = 'r . r . r . r . r . r . r . r .'
    PM2 = 'r . r r . r r . r . r r . r r .'
    OPEN = 'R - - - R - R - R - - - R - R -'
    HOLD = 'R - - - - - - - - - - - - - - -'
    CHUG_BR = 'r . . r . . r . r . . r . . r .'
    # ---- guitarras
    sg.line('gtrL', IB.i_pwr, RIFF, iI, gain=0.7, pan=-0.6, fifth=False, tau=0.1, cutoff=3000)
    sg.line('gtrR', IB.i_pwr, RIFF, iI, gain=0.7, pan=0.6, fifth=False, tau=0.1, cutoff=3600, drive=8.0)
    chug(sg, H_V, iV, PM, 0.8)
    chug(sg, H_P, iP, PM2, 0.85)
    strum(sg, H_C, iC, OPEN, 0.8)
    chug(sg, H_V2, iV2, PM, 0.8)
    chug(sg, H_BR, iBR, CHUG_BR, 0.9, tau=0.11)
    strum(sg, H_C, iC2, OPEN, 0.85)
    strum(sg, Harmony("A B E"), iO, OPEN, 0.8)
    sg.bass('gtrL', IB.i_pwr, Harmony("E"), iO + 3, HOLD, octave=40, gain=0.8, pan=-0.7)
    sg.bass('gtrR', IB.i_pwr, Harmony("E"), iO + 3, HOLD, octave=40, gain=0.8, pan=0.7, drive=8.0)
    # ---- baixo de palheta em colcheias (raiz; oitava no refrão)
    BS = 'r . r . r . r . r . r . r . r .'
    BC = 'r r r r r r o r r r r r r r o r'
    sg.bass('bass', IB.i_pbass, H_I, iI, BS, octave=28, gain=0.8)
    sg.bass('bass', IB.i_pbass, H_V, iV, BS, octave=28, gain=0.85, tau=0.12)
    sg.bass('bass', IB.i_pbass, H_P, iP, 'r r r r r r r r r r r r r r r r', octave=28, gain=0.85, tau=0.1)
    sg.bass('bass', IB.i_pbass, H_C, iC, BC, octave=28, gain=0.9, tau=0.14)
    sg.bass('bass', IB.i_pbass, H_V2, iV2, BS, octave=28, gain=0.85, tau=0.12)
    sg.bass('bass', IB.i_pbass, H_BR, iBR, CHUG_BR, octave=28, gain=0.95, tau=0.12)
    sg.bass('bass', IB.i_pbass, H_C, iC2, BC, octave=28, gain=0.95, tau=0.14)
    sg.bass('bass', IB.i_pbass, Harmony("A B E"), iO, 'R - - - R - R - R - - - R - R -', octave=28, gain=0.9)
    sg.bass('bass', IB.i_pbass, Harmony("E"), iO + 3, HOLD, octave=28, gain=0.9)
    # ---- melodias
    sg.line('lead', IB.i_vox, V_L, iV, gain=0.85, vowel='o', vowel2='a', shift=0.95, vib=0.006, breath=0.08)
    sg.line('lead', IB.i_vox, V_L[:len([n for n in V_L if n[0] < 4 * 16])], iV2, gain=0.85, vowel='o', vowel2='a', shift=0.95, vib=0.006, breath=0.08)
    sg.line('lead', IB.i_hsaw, PRE_L, iP, gain=0.75, cutoff=4800, spread=0.006, voices=3, drive=1.4, a=0.006, s=0.8)
    sg.line('lead', IB.i_hsaw, C_L, iC, gain=0.85, cutoff=5200, spread=0.007, voices=3, drive=1.6, a=0.006, s=0.85)
    sg.line('lead', IB.i_hsaw, C_L, iC2, gain=0.85, cutoff=5600, spread=0.008, voices=3, drive=1.8, a=0.006, s=0.85)
    sg.line('lead2', IB.i_hsaw, shift(C_L, 0, -12, 0.55), iC2, gain=0.45, cutoff=3800, spread=0.006, voices=3, drive=1.4, pan=0.4)
    sg.line('lead', IB.i_hsaw, O_L, iO, gain=0.8, cutoff=5000, spread=0.007, voices=3, drive=1.5, a=0.01, r=0.3)
    # ---- coro de gritos (gang vocals) no fim das frases do refrão
    for bar0 in (iC, iC2):
        for b in (3, 7):
            for k, m in enumerate((71, 78, 83)):   # b4 f#5 b5
                sg.note('gang', IB.i_vox, (bar0 + b) * 16 + 12, m, 3, gain=0.5, vowel='e', shift=1.0, a=0.004, d=0.06, s=0.6, pan=-0.3 + 0.3 * k)
    for b in (1, 3, 5, 7):   # no refrão final: 'oh-oh' em terças no meio de cada frase
        for k, m in enumerate((76, 80)):
            sg.note('gang', IB.i_vox, (iC2 + b) * 16 + 8, m, 4, gain=0.35, vowel='o', shift=1.0, a=0.02, s=0.8, pan=-0.4 + 0.8 * k)
    # quebra: swell de 'oh' sobre a harmonia
    for (st, ln, pc, q) in H_BR.events():
        v = K.voice(None, pc, q, 59, 76, 3)
        for k, m in enumerate(v):
            sg.note('gang', IB.i_vox, iBR * 16 + st, m, ln, gain=0.3, vowel='o', vowel2='u', shift=1.0, a=0.5, r=0.4, vib=0.005, pan=-0.4 + 0.4 * k)
    # ---- bateria rápida
    kit = KB.kit_punk
    D_I1 = {'x': 'x...x...x.x.x...'}
    D_I = {'k': 'x.......x.x.....', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}
    D_V = {'k': 'x.....x.x.......', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}
    D_P = {'k': 'x...x...x...x...', 's': 'x.x.x.x.xxxxxxxx', 'h': 'x.x.x.x.x.x.x.x.'}
    D_C = {'k': 'x.....x.x.....x.', 's': '....x.......x...', 'o': 'x.x.x.x.x.x.x.x.', 'c': 'X...............'}
    D_BR = {'k': 'x.......x.x.....', 's': '........x.......', 'h': 'x...x...x...x...', 'c': 'X...............'}
    D_O = {'k': 'x.....x.x.....x.', 's': '....x.......x...', 'o': 'x.x.x.x.x.x.x.x.'}
    sg.drums(kit, iI, 1, D_I1, gain=0.8)
    sg.drums(kit, iI + 1, 3, D_I, gain=0.95)
    sg.drums(kit, iV, 8, D_V, gain=0.95)
    sg.drums(kit, iP, 4, D_P, gain=1.0)
    sg.drums(kit, iC, 8, D_C, gain=1.0)
    sg.drums(kit, iV2, 4, D_V, gain=0.95)
    sg.drums(kit, iBR, 4, D_BR, gain=0.95)
    sg.drums(kit, iC2, 8, D_C, gain=1.05)
    sg.drums(kit, iO, 3, D_O, gain=1.0)
    sg.drums(kit, iO + 3, 1, {'k': 'X...............', 'c': 'X...............'}, gain=1.0)
    # viradas de tom no fim das seções
    FILL = {'s': 'x.x.x.x.........', 't1': '........x.x.....', 't2': '..........x.x...', 't3': '............x.xx'}
    for bar in (iV - 1, iP - 1, iC - 1, iV2 - 1, iBR - 1, iC2 - 1):
        sg.drums(kit, bar, 1, FILL, gain=0.9)
    # pratos ao contrário e crashes
    for bar in (iV, iC, iV2, iBR, iC2, iO):
        rev_crash(sg, bar, 0.4)
    for bar in (iV, iC, iV2, iC2, iO):
        sg.sample('fx', S.crash(rng, None, 1.3) * 0.7, bar * 16, 0.4)
    sg.duck(['gtrL', 'gtrR'], 0.18, 0.08)
    sg.trim = {'gtrL': -3.5, 'gtrR': -3.5, 'bass': -2.6, 'lead': 5.0, 'lead2': 11.0, 'gang': 14.0, 'drums': -4.0, 'fx': 5.0}
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(9), drive=1.35, lp_hz=12500, hiss_level=0.004))
    fx = {
        'gtrL': [HighpassFilter(80), Reverb(room_size=0.2, wet_level=0.1, dry_level=0.95)],
        'gtrR': [HighpassFilter(80), Reverb(room_size=0.2, wet_level=0.1, dry_level=0.95)],
        'bass': [LowpassFilter(1500)],
        'lead': [Chorus(rate_hz=0.5, depth=0.15, mix=0.25), Reverb(room_size=0.3, wet_level=0.14, dry_level=0.92)],
        'lead2': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'gang': [Reverb(room_size=0.45, wet_level=0.2, dry_level=0.85)],
        'drums': [Compressor(threshold_db=-16, ratio=2.5, attack_ms=6, release_ms=80)],
    }
    sg.sends = {'lead': {'echo': 0.12}, 'gang': {'verb': 0.15}, 'fx': {'verb': 0.2}, 'drums': {'verb': 0.06}}
    return sg, fx, aux_default(176, room=0.35, delay_fb=0.25, delay_beats=0.75)
