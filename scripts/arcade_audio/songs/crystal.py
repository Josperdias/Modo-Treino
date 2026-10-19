"""Cristal — 126 bpm, mi lídio. Arpejos de vidro (corpos modais), pads FM brilhantes, bumbo suave com sidechain, hats no contratempo.
Forma (48 compassos, ~1:31): intro 4 · A 8 · refrão 8 · A+batida 8 · CONGELA 8 (sem bateria, escada de Shepard, reverb enorme) · refrão final 8 · saída 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import lp_post, aux_default

A_L = parse("""
b5 . . g#5 . . e5 . g#5 . b5 - - - - - |
c#6 . . a#5 . . f#5 . a#5 . c#6 - - - - - |
d#6 . . b5 . . g#5 . b5 . d#6 - - f#6 - - |
c#6 . a#5 . f#5 . a#5 . c#6 - - - - - - - |
e6 . . d#6 . . b5 . g#5 . b5 . e6 - - - |
f#6 . . e6 . . c#6 . a#5 . c#6 . f#6 - - - |
g#6 . . e6 . . c#6 . e6 . g#6 - - b6 - - |
f#6 - - - d#6 - - - b5 - - - . . . . |
""", 16)
B_L = parse("""
e6 - - - g#6 - - - e6 - - - c#6 - - - |
d#6 - - - f#6 - - - d#6 - - - b5 - - - |
g#6 - - - b6 - - - g#6 - - - e6 - - - |
c#6 - a#5 - c#6 - f#6 - c#6 - - - a#5 - - - |
e6 . g#6 . e6 . c#6 . b5 . c#6 . e6 - - - |
d#6 . f#6 . d#6 . b5 . f#5 . b5 . d#6 - - - |
c#6 . e6 . g#6 . e6 . a#5 . c#6 . f#6 - - - |
d#6 - - - b5 - - - f#5 - - - . . . . |
""", 16)
OUT_L = parse("d#6 - - - - - - - b5 - - - - - - - |" * 4, 16)
INTRO_L = parse("""
. . . . . . . . . . . . b5 . g#5 . |
. . . . . . . . . . . . c#6 . a#5 . |
. . . . . . . . . . . . . . . . |
. . . . . . . . . . . . . . . . |
""", 16)

H_I = Harmony("Emaj7 F# Emaj7 F#")
H_A = Harmony("Emaj7 F# G#m7 F# Emaj7 F# C#m7 B")
H_B = Harmony("C#m7 B Emaj7 F# C#m7 B A#m7b5_F# B")
H_F = Harmony("Emaj7 Emaj7 F# F# G#m7 G#m7 B B")
H_O = Harmony("C#m7 B Emaj7 B")


def build():
    spb = 16
    sg = K.Song(126, 48, spb=16, tail=4.0, seed=31, name='crystal')
    rng = sg.rng
    iI, iA, iB, iA2, iF, iB2, iO = 0, 4, 12, 20, 28, 36, 44
    # --- arpejos de vidro (sempre presentes; mudam de densidade)
    arp_dense = '0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1'
    arp_sparse = '0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .'
    for h, bar, pat, g in ((H_I, iI, arp_sparse, 0.6), (H_A, iA, arp_sparse, 0.6), (H_B, iB, arp_dense, 0.5), (H_A, iA2, arp_dense, 0.55),
                           (H_B, iB2, arp_dense, 0.55), (H_O, iO, arp_sparse, 0.55)):
        sg.arp('arp', K.i_glass, h, bar, pat, lo=64, gain=g, pan=0.55, tilt=0.55)
    # congela: arpejo lento, cada nota longa e muito reverb
    sg.arp('arp', K.i_glass, H_F, iF, '0 . . . 2 . . . 4 . . . 2 . . .', lo=64, gain=0.7, pan=0.4, step_len=4, tilt=1.6)
    # --- pads brilhantes (FM/serra com filtro) e baixo
    for h, bar, g in ((H_I, iI, 0.4), (H_A, iA, 0.5), (H_B, iB, 0.55), (H_A, iA2, 0.5), (H_F, iF, 0.6), (H_B, iB2, 0.6), (H_O, iO, 0.5)):
        sg.pads('pad', K.i_pad, h, bar, 52, 76, gain=g, cutoff=2400 if bar != iF else 1800, a=0.5)
    for h, bar in ((H_A, iA2), (H_B, iB), (H_B, iB2)):
        sg.bass('bass', K.i_fmbass, h, bar, 'R . . R . . 5 . R . . . R . o .', octave=40, gain=0.85, tau=0.2, index=2.2)
    for h, bar in ((H_A, iA), (H_O, iO)):
        sg.bass('bass', K.i_tri, h, bar, 'R - - - - - - - 5 - - - - - - -', octave=40, gain=0.8)
    sg.bass('bass', K.i_tri, H_F, iF, 'R - - - - - - - - - - - - - - -', octave=40, gain=0.8)
    # --- melodias (sino FM / vidro)
    sg.line('lead', K.i_fmep, INTRO_L, iI, gain=0.7, tau=1.0, bright=1.2)
    sg.line('lead', K.i_fmep, A_L, iA, gain=0.75, tau=0.9, bright=1.2)
    sg.line('lead', K.i_modal, shift(A_L, 0, 12, 0.5), iA, gain=0.16, kind='glass', tilt=1.0, pan=-0.4)
    sg.line('lead', K.i_fmep, B_L, iB, gain=0.8, tau=1.1, bright=1.3)
    sg.line('lead', K.i_modal, shift(B_L, 0, 12, 0.6), iB, gain=0.2, kind='glass', tilt=1.2, pan=-0.4)
    sg.line('lead', K.i_fmep, A_L, iA2, gain=0.8, tau=0.9, bright=1.2)
    sg.line('lead', K.i_nes, shift(A_L, 0, 0, 0.6), iA2, gain=0.3, duty=0.125, decay=0.12, pan=0.3)
    sg.line('lead', K.i_fmep, B_L, iB2, gain=0.85, tau=1.1, bright=1.3)
    sg.line('lead', K.i_nes, shift(B_L, 0, 12, 0.6), iB2, gain=0.3, duty=0.125, decay=0.2, pan=-0.35)
    sg.line('lead', K.i_modal, shift(B_L[:16], 0, 0, 0.7), iF + 2, gain=0.45, kind='bell', tilt=2.0, pan=0.0)
    sg.line('lead', K.i_fmep, OUT_L, iO, gain=0.7, tau=1.4)
    # --- Shepard subindo devagar durante o CONGELA
    n = int(8 * spb * sg.step_s * SR)
    sh = S.shepard(n, start_oct=0.0, rate=0.07, f0=82.4, voices=9) * 0.35
    sh *= np.minimum(1, np.linspace(0, 1, n) * 4) * np.minimum(1, np.linspace(1, 0, n) * 4)
    sg.put('pad2', sh, sg.t_step(iF * spb), 0.8, 0.0)
    # --- bateria: bumbo no tempo, hats no contratempo, estalo no 2 e 4 (entra no refrão)
    kit = K.kit_sega
    D_A = {'k': 'x...x...x...x...', 'h': '..x...x...x...x.'}
    D_B = {'k': 'x...x...x...x...', 's': '....x.......x...', 'h': '..x...x...x...x.', 'sh': 'xxxxxxxxxxxxxxxx', 'c': 'X...............'}
    sg.drums(kit, iI + 2, 2, {'h': '..x...x...x...x.'}, gain=0.5)
    sg.drums(kit, iA, 8, {'h': '..x...x...x...x.', 'sh': 'x.x.x.x.x.x.x.x.'}, gain=0.5)
    sg.drums(kit, iB, 8, D_B, gain=0.7)
    sg.drums(kit, iA2, 8, D_A | {'sh': 'xxxxxxxxxxxxxxxx'}, gain=0.7)
    sg.drums(kit, iB2, 8, D_B, gain=0.75)
    sg.drums(kit, iO, 4, {'h': '..x...x...x...x.'}, gain=0.4)
    for bar in (iB, iB2, iF):
        sg.sample('fx', S.riser(rng, int(2 * spb * sg.step_s * SR), 500, 9000, 0.2, 440), (bar - 2) * spb, 0.7)
        sg.sample('fx', S.crash(rng) * 0.5, bar * spb, 0.5)
    sg.duck(['pad', 'pad2', 'arp'], 0.45, 0.16)
    lp_post(sg, 10500)
    fx = {
        'arp': [Chorus(rate_hz=0.3, depth=0.2, mix=0.25), Reverb(room_size=0.5, wet_level=0.25, dry_level=0.85)],
        'pad': [Chorus(rate_hz=0.5, depth=0.25, mix=0.4), Reverb(room_size=0.75, wet_level=0.3, dry_level=0.75)],
        'pad2': [Reverb(room_size=0.95, wet_level=0.5, dry_level=0.6)],
        'lead': [Reverb(room_size=0.45, wet_level=0.25, dry_level=0.85)],
    }
    sg.sends = {'lead': {'echo': 0.25, 'verb': 0.2}, 'arp': {'echo': 0.2}, 'fx': {'verb': 0.3}}
    # congelar: o reverb 'prende' tudo no meio (cauda longa só no auxiliar)
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(3), wow=0.0006, flutter=0.0004))
    return sg, fx, aux_default(126, room=0.8, delay_fb=0.4, delay_beats=0.75)
