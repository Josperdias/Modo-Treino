"""Recorte e Colagem — indie-pop de ukulele, 118 bpm, fá maior. Ukulele de ataque estalado, glockenspiel de brinquedo, assobio no refrão, baixo
saltitante, palmas, pandeiro, estalar de dedos, pisada em caixa de papelão e um farfalhar de papel; a tesoura estala no fim das frases e o carimbo
bate nas viradas. Forma (32 compassos, ~1:05): título 2 · verso 8 · REFRÃO assobiado 8 · quebra 4 · refrão final (com coro e glock) 8 · fecho 2."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, Compressor, LowpassFilter, HighpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_e as E
from songs.common import aux_default

H_I = Harmony("F C")
H_A = Harmony("F Dm Bb C F Am Gm7 C7")
H_B = Harmony("Bb C Am Dm Bb C F F")
H_K = Harmony("Dm Bb Gm C")
H_O = Harmony("Bb F")

V_GLOCK = parse("""
a5 - c6 - a5 - f5 - . . g5 - a5 - . . |
f5 - a5 - d6 - c6 - a5 - . . d6 - c6 - |
bb5 - d6 - bb5 - f5 - . . g5 - bb5 - . . |
c6 - e6 - c6 - g5 - . . e6 - d6 - c6 - |
a5 - c6 - a5 - f5 - . . g5 - a5 - c6 - |
e6 - c6 - a5 - c6 - e6 - . . d6 - c6 - |
d6 - bb5 - g5 - bb5 - d6 - . . f6 - d6 - |
e6 - g6 - e6 - c6 - bb5 - . . g5 - . . |
""")
WHISTLE = parse("""
f6 - - d6 - bb5 - - d6 - - f6 - - - - |
e6 - - c6 - g5 - - c6 - - e6 - - - - |
c6 - - e6 - c6 - a5 - - c6 - e6 - - - |
a5 - - d6 - - f6 - e6 d6 c6 - - . . . |
f6 - - d6 - bb5 - - d6 - f6 - g6 - - - |
g6 - - e6 - c6 - - e6 - g6 - - . . . |
c6 - - a5 - c6 - f6 - - - - - - - - |
. . . . . . . . . . . . g5 - a5 - |
""")
K_GLOCK = parse("""
d6 - - - a5 - f5 - a5 - - - d6 - - - |
d6 - - - bb5 - f5 - bb5 - - - d6 - - - |
g5 - bb5 - d6 - g6 - f6 - d6 - bb5 - g5 - |
c6 - e6 - g6 - . . . . . . g5 - a5 - |
""")
O_GLOCK = parse("""
d6 - - - bb5 - - - f5 - - - . . . . |
a5 - c6 - f6 - - - . . . . . . . . |
""")
I_GLOCK = parse("""
a5 - c6 - a5 - f5 - . . . . . . . . |
c6 - e6 - c6 - g5 - . . . . . . . . |
""")

UKE = [(0, 'd', 1.0), (4, 'm', .6), (6, 'u', .6), (10, 'u', .7), (12, 'd', .85), (14, 'u', .6)]
UKE_C = [(0, 'd', .9), (2, 'u', .5), (4, 'd', 1.0), (6, 'u', .55), (8, 'd', .85), (10, 'u', .5), (12, 'd', 1.0), (14, 'u', .6)]
UKE_I = [(0, 'd', 1.0), (6, 'u', .6), (10, 'u', .6)]


def voicings(h):
    prev, out = None, {}
    for (st, ln, pc, q) in h.events():
        v = sorted(K.voice(prev, pc, q, 60, 76, 4))
        prev = v
        out[st] = v
    return out


def uke(sg, h, bar0, pattern, gain=0.7, pan=-0.2):
    vo = voicings(h)
    for b in range(len(h)):
        for (st, d, v) in pattern:
            notes = vo[b * 16] if b * 16 in vo else vo[max(k for k in vo if k <= b * 16 + st)]
            kw = {'hold': 0.05} if d == 'm' else {}
            E.strum(sg, 'uke', E.i_uke, notes, (bar0 + b) * 16 + st, down=(d != 'u'), gain=gain * (0.6 if d == 'm' else 1.0), pan=pan, spread=0.006, velmul=v, nstr=4, **kw)


def pat(d):
    s = ['.'] * 16
    for k, ch in d.items():
        s[k] = ch
    return ''.join(s)


def snips(sg, bar, steps=(12, 13, 14, 15), gain=0.8):
    for i, st in enumerate(steps):
        sg.drums(E.kit_craft, bar, 1, {'z': pat({st: 'x' if i % 2 == 0 else 'o'})}, gain=gain)


def swish(sg, bar, bars=1, gain=0.6, hi=9000):
    """Virar de página: ruído que sobe e fecha (papel passando)."""
    n = int(bars * 16 * sg.step_s * SR)
    x = S.bp(sg.rng.standard_normal(n), 1800, hi, 1) * np.linspace(0, 1, n) ** 2.0 * 0.5
    sg.sample('fx', x, bar * 16, gain)


def build():
    sg = K.Song(118, 32, spb=16, tail=3.0, seed=303, name='paper3')
    rng = sg.rng
    iI, iA, iB, iK, iB2, iO = 0, 2, 10, 18, 22, 30
    # ---- ukulele
    uke(sg, H_I, iI, UKE_I, gain=0.7)
    uke(sg, H_A, iA, UKE, gain=0.7)
    uke(sg, H_B, iB, UKE_C, gain=0.8)
    uke(sg, H_B, iB2, UKE_C, gain=0.85)
    uke(sg, H_O, iO, UKE_I, gain=0.7)
    # quebra: ukulele dedilhado
    sg.arp('uke', E.i_uke, H_K, iK, '0 . 1 . 2 . 3 . 2 . 1 . 2 . 1 .', lo=58, gain=0.8, pan=-0.1, ring=0.8, decay=0.99)
    # ---- glockenspiel: título, verso, quebra, contracanto no refrão, fecho
    sg.line('glock', K.i_modal, I_GLOCK, iI, gain=0.8, kind='bell', tilt=0.4)
    sg.line('glock', K.i_modal, V_GLOCK, iA, gain=0.85, kind='bell', tilt=0.4, pan=0.2)
    sg.line('glock', K.i_modal, K_GLOCK, iK, gain=0.85, kind='bell', tilt=0.5, pan=0.2)
    sg.arp('glock', K.i_modal, H_B, iB, '0 . 1 . 2 . 1 . 0 . 1 . 2 . 1 .', lo=60, gain=0.35, pan=0.45, kind='bell', tilt=0.3)
    sg.line('glock', K.i_modal, WHISTLE, iB2, gain=0.55, kind='bell', tilt=0.35, pan=0.4)
    sg.line('glock', K.i_modal, O_GLOCK, iO, gain=0.85, kind='bell', tilt=0.6, pan=0.2)
    # ---- assobio do refrão (e coro 'ooh' na última vez)
    sg.line('whistle', E.i_whistle, WHISTLE, iB, gain=0.9)
    sg.line('whistle', E.i_whistle, WHISTLE, iB2, gain=0.95)
    sg.line('whistle2', E.i_whistle, [(s, m - 12, l, v) for (s, m, l, v) in WHISTLE], iB2, gain=0.4, pan=-0.3, vib=0.004)
    sg.pads('pad', K.i_choir, H_B, iB2, 57, 74, gain=0.7, vowel='o', a=0.25, r=0.5, vel=0.7)
    sg.pads('pad', K.i_choir, H_K, iK, 57, 74, gain=0.5, vowel='u', a=0.4, r=0.6, vel=0.6)
    # ---- baixo saltitante
    BA = 'R . . r . . 5 . R . . . 5 . o .'
    BB = 'R . r . 5 . r . R . r . 5 . o .'
    sg.bass('bass', I2.i_walk, H_A, iA, BA, octave=36, gain=0.9)
    sg.bass('bass', I2.i_walk, H_B, iB, BB, octave=36, gain=0.95)
    sg.bass('bass', I2.i_walk, H_K, iK, 'R . . . . . 5 . R . . . . . 5 .', octave=36, gain=0.8)
    sg.bass('bass', I2.i_walk, H_B, iB2, BB, octave=36, gain=1.0)
    sg.bass('bass', I2.i_walk, H_O, iO, 'R - - - - - - - - - - - - - - -', octave=36, gain=0.8)
    # ---- percussão artesanal
    kit = E.kit_craft
    sg.drums(kit, iI, 2, {'k': pat({0: 'x', 8: 'o'}), 'f': pat({2: 'x', 6: 'x', 10: 'x', 14: 'x'})}, gain=0.8)
    D_A = {'k': pat({0: 'x', 8: 'x', 10: 'o'}), 'p': pat({4: 'x', 12: 'x'}), 'h': 'o.o.o.o.o.o.o.o.'}
    D_A2 = {'k': pat({0: 'x', 8: 'x', 10: 'o', 14: 'o'}), 'p': pat({4: 'x', 12: 'x'}), 'h': 'o.o.o.o.o.o.o.o.', 'f': pat({6: 'o', 14: 'o'})}
    sg.drums(kit, iA, 4, D_A, gain=0.85)
    sg.drums(kit, iA + 4, 4, D_A2, gain=0.9)
    D_B = {'k': pat({0: 'x', 4: 'x', 8: 'x', 12: 'x'}), 'p': pat({4: 'x', 12: 'x'}), 'j': 'x.o.x.o.x.o.x.o.', 'h': '..o...o...o...o.'}
    sg.drums(kit, iB, 8, D_B, gain=0.95)
    sg.drums(kit, iB2, 8, D_B, gain=1.0)
    sg.drums(kit, iK, 4, {'p': pat({4: 'x', 12: 'x'}), 'f': pat({2: 'o', 6: 'o', 10: 'o', 14: 'o'})}, gain=0.8)
    sg.drums(kit, iK + 3, 1, {'h': 'o.o.o.o.xxxxxxxx'}, gain=0.8)
    sg.drums(kit, iO, 1, {'k': pat({0: 'x', 8: 'o'}), 'f': pat({2: 'x', 6: 'x', 10: 'x', 14: 'x'})}, gain=0.8)
    sg.drums(kit, iO + 1, 1, {'k': pat({0: 'X'}), 'p': pat({0: 'X'}), 't': pat({0: 'X'})}, gain=1.0)
    # tesouras, carimbos, páginas e papel amassado nas viradas
    for bar in (iA + 3, iA + 7, iB + 3, iB + 7, iB2 + 3, iB2 + 7):
        snips(sg, bar)
    sg.drums(kit, iA + 7, 1, {'t': pat({15: 'x'})}, gain=0.8)
    sg.drums(kit, iB - 1, 1, {'c': pat({13: 'x'})}, gain=0.8)
    for bar in (iA, iB, iK, iB2):
        sg.drums(kit, bar, 1, {'t': pat({0: 'x'})}, gain=0.7)
    for bar in (iA, iB, iB2):
        swish(sg, bar - 1, 1, 0.32)
    swish(sg, iK + 2, 2, 0.4)
    sg.duck(['pad'], 0.25, 0.1, steps=[b * 16 + s for b in range(iB2, iB2 + 8) for s in (0, 4, 8, 12)])
    sg.trim = {'uke': 3.5, 'glock': 1.5, 'whistle': -0.5, 'whistle2': 2.0, 'bass': -0.5, 'drums': 2.5, 'pad': 8.0, 'fx': 5.0}
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(17), drive=1.1, lp_hz=12000, hiss_level=0.0008, crackle=0.01))
    fx = {
        'uke': [Reverb(room_size=0.25, wet_level=0.1, dry_level=0.9), Compressor(threshold_db=-18, ratio=2.0, attack_ms=10, release_ms=90)],
        'glock': [Reverb(room_size=0.45, wet_level=0.2, dry_level=0.85)],
        'whistle': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'whistle2': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'bass': [LowpassFilter(1200)],
        'pad': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'drums': [Reverb(room_size=0.2, wet_level=0.08, dry_level=0.95), Compressor(threshold_db=-18, ratio=2.2, attack_ms=8, release_ms=90)],
        'fx': [Reverb(room_size=0.4, wet_level=0.15, dry_level=0.9)],
    }
    sg.sends = {'glock': {'echo': 0.15}, 'whistle': {'echo': 0.15, 'verb': 0.1}, 'fx': {'verb': 0.1}}
    return sg, fx, aux_default(118, room=0.45, delay_fb=0.25, delay_beats=0.75)
