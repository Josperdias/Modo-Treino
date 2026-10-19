"""Queda livre — 170 bpm, si menor. Tudo CAI: riffs em escadas descendentes, escada de Shepard descendo, vento; só o baixo sobe (movimento contrário).
No meio, 'sem peso': notas longas e quase sem batida, sinos subindo devagar. Depois a queda recomeça mais forte.
Forma (64 compassos, ~1:30): vento 4 · A 8 · B 8 · refrão 8 · sem peso 8 · subida 4 · A forte 8 · refrão 8 · fim 8."""
import numpy as np
from pedalboard import Reverb, Chorus, Distortion, LowpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import lp_post, aux_default, loader_in_gap, coin_reboot

A_L = parse("""
f#6 e6 d6 b5 f#6 e6 d6 b5 f#6 e6 d6 b5 a5 f#5 d5 b4 |
d6 b5 g5 d5 d6 b5 g5 d5 b5 g5 d5 b4 g4 . . . |
a5 f#5 d5 a4 a5 f#5 d5 a4 f#5 d5 a4 f#4 d4 . . . |
e6 c#6 a5 e5 e6 c#6 a5 e5 c#6 a5 e5 c#5 a4 . . . |
f#6 e6 d6 b5 f#6 e6 d6 b5 f#6 e6 d6 b5 a5 f#5 d5 b4 |
g6 d6 b5 g5 g6 d6 b5 g5 d6 b5 g5 d5 b4 . . . |
b5 g5 e5 b4 b5 g5 e5 b4 g5 e5 b4 g4 e4 . . . |
c#6 a#5 f#5 c#5 c#6 a#5 f#5 c#5 a#5 f#5 c#5 a#4 f#4 . . . |
""", 16)
C_L = parse("""
g6! - - - f#6 - e6 - d6 - - - b5 - - - |
a6! - - - f#6 - - - d6 - - - a5 - - - |
g6! - - - e6 - - - b5 - - - g5 - - - |
f#6! - - - d6 - - - b5 - - - f#5 - - - |
d6 - b5 - g5 - d5 - b4 - - - g4 - - - |
a5 - f#5 - d5 - a4 - f#4 - - - d4 - - - |
c#6 - a#5 - f#5 - c#5 - a#4 - - - f#4 - - - |
a#5 . c#6 . f#6 - - - - - - - - - - - |
""", 16)
FLOAT_L = parse("""
b5 - - - - - - - d6 - - - - - - - |
f#6 - - - - - - - d6 - - - - - - - |
a5 - - - - - - - c#6 - - - - - - - |
f#6 - - - e6 - - - c#6 - - - a5 - - - |
g5 - - - - - - - b5 - - - - - - - |
d6 - - - - - - - b5 - - - - - - - |
e6 - - - - - - - c#6 - - - - - - - |
a#5 - - - c#6 - - - e6 - - - f#6 - - - |
""", 16)
UP = parse("""
b4 c#5 d5 e5 f#5 g5 a5 b5 c#6 d6 e6 f#6 g6 a6 b6 . |
b5 . b5 . b5 . b5 . b5 b5 b5 b5 b5 b5 b5 b5 |
f#6! . . . . . . . . . . . . . . . |
. . . . . . . . . . . . . . . . |
""", 16)

H_A = Harmony("Bm G D A Bm G Em F#")
H_C = Harmony("G D Em Bm G D F# F#")
H_F = Harmony("Gmaj7 Gmaj7 Dmaj7 Dmaj7 Em7 Em7 F#7sus4 F#7")
H_U = Harmony("F# F# F# F#")


def wind(sg, bar0, bars, gain=0.4, lo=300, hi=2800):
    n = int(bars * 16 * sg.step_s * SR)
    x = sg.rng.standard_normal(n)
    out = np.zeros(n)
    t = np.arange(n) / SR
    fc = 900 + 700 * np.sin(2 * np.pi * 0.11 * t) + 350 * np.sin(2 * np.pi * 0.27 * t + 1)
    for c in np.geomspace(lo, hi, 8):
        out += S.bp(x, c / 1.4, c * 1.4, 1) * np.exp(-(np.log2(np.maximum(fc, 100) / c) / 0.8) ** 2)
    sg.sample('wind', out * 0.5, bar0 * 16, gain)


def build():
    spb = 16
    sg = K.Song(170, 64, spb=16, tail=3.0, seed=101, name='inverse')
    rng = sg.rng
    iW, iA, iB, iC, iF, iU, iA3, iC3, iO = 0, 4, 12, 20, 28, 36, 40, 48, 56
    # --- vento por toda a faixa; Shepard descendo (volta ao mesmo espectro no fim do laço)
    wind(sg, 0, 64, 0.35)
    n = int(64 * spb * sg.step_s * SR)
    pos = np.cumsum(np.full(n, -0.09)) / SR
    pos = pos * (max(1, round(abs(pos[-1]))) / abs(pos[-1]))
    voices = 8
    y = np.zeros(n)
    for k in range(voices):
        o = (pos + k) % voices
        f = 55.0 * 2.0 ** o
        loud = np.exp(-0.5 * ((o - voices / 2) / (voices * 0.18)) ** 2) * np.clip((0.4 * SR - f) / (0.08 * SR), 0, 1)
        y += loud * np.sin(2 * np.pi * np.cumsum(f) / SR)
    sg.put('shep', y / voices * 1.5 * 0.5, 0.0, 0.8)
    # --- baixo: sobe (movimento contrário) — aproximação cromática de baixo para cima antes de cada acorde
    BA = 'R . R R . R . R R . R R . R a a'
    for h, bar in ((H_A, iA), (H_A, iB), (H_A, iA3)):
        sg.bass('bass', K.i_vrc6, h, bar, BA, octave=35, gain=0.85, decay=0.3)
    for h, bar in ((H_C, iC), (H_C, iC3)):
        sg.bass('bass', K.i_vrc6, h, bar, 'R . . R . . R . R . . R . . o .', octave=35, gain=0.85, decay=0.35)
    sg.bass('bass', K.i_tri, H_F, iF, 'R - - - - - - - - - - - - - - -', octave=35, gain=0.8, bits=6)
    sg.bass('bass', K.i_vrc6, H_U, iU, 'R . R . R . R . R R R R R R R R', octave=35, gain=0.8, decay=0.25)
    sg.bass('bass', K.i_vrc6, Harmony("Bm Bm F# Bm", 16), iO, BA, octave=35, gain=0.85, decay=0.3)
    # --- melodia: escadas que caem (pulso + eco de canal) e refrão
    sg.line('lead', K.i_nes, A_L, iA, gain=0.8, duty=0.25, decay=0.2)
    sg.line('lead', K.i_nes, A_L, iB, gain=0.8, duty=0.25, decay=0.2)
    sg.line('lead2', K.i_nes, shift(A_L, 3, 0, 0.45), iB, gain=0.5, duty=0.5, decay=0.15, pan=0.35)
    sg.line('lead', K.i_vrc6, C_L, iC, gain=0.8, vib=0.005)
    sg.line('lead2', K.i_nes, shift(C_L, 0, 12, 0.6), iC, gain=0.4, duty=0.25, decay=0.25, pan=-0.3)
    sg.line('choir', K.i_choir, shift(C_L, 0, -12, 0.8), iC, gain=0.4, vowel='a', a=0.1, r=0.5)
    sg.line('lead', K.i_modal, FLOAT_L, iF, gain=0.8, kind='bell', tilt=2.0)
    sg.line('lead2', K.i_fmep, shift(FLOAT_L, 0, 12, 0.5), iF, gain=0.3, tau=1.2, pan=0.3)
    sg.line('lead', K.i_nes, UP, iU, gain=0.85, duty=0.25, decay=0.3)
    sg.line('lead', K.i_vrc6, A_L, iA3, gain=0.85)
    sg.line('lead2', K.i_nes, shift(A_L, 0, 0, 0.6), iA3, gain=0.35, duty=0.5, decay=0.15, pan=-0.35)
    sg.line('lead', K.i_vrc6, C_L, iC3, gain=0.85, vib=0.005)
    sg.line('lead2', K.i_nes, shift(C_L, 0, 12, 0.7), iC3, gain=0.5, duty=0.25, decay=0.25, pan=0.3)
    sg.line('choir', K.i_choir, shift(C_L, 0, -12, 0.8), iC3, gain=0.45, vowel='a', a=0.1, r=0.5)
    sg.line('lead', K.i_nes, bars4(A_L), iO, gain=0.8, duty=0.25, decay=0.2)
    for h, bar, g in ((H_A, iA, 0.3), (H_A, iB, 0.35), (H_C, iC, 0.4), (H_F, iF, 0.55), (H_A, iA3, 0.4), (H_C, iC3, 0.4)):
        sg.pads('pad', K.i_pad, h, bar, 50, 74, gain=g, cutoff=1500, a=0.2)
    for h, bar in ((H_A, iA), (H_A, iB), (H_A, iA3)):
        sg.fast_arp('arp', h, bar, lo=55, gain=0.3, duty=0.25, pan=0.3)
    # --- bateria
    chip = K.kit_chip
    sega = K.kit_sega
    D_A = {'k': 'x..x..x.x..x..x.', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}
    D_B = {'k': 'x.x.x.x.x.x.x.x.', 's': '....x.......x..x', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..x...x...x...x.', 'c': 'X...............'}
    sg.drums(chip, iA, 8, D_A, gain=0.9)
    sg.drums(chip, iB, 8, D_A | {'k': 'x.x.x.x.x.x.x.xx'}, gain=0.95)
    sg.drums(sega, iC, 8, D_B, gain=0.8)
    sg.drums(sega, iF, 8, {'k': 'x...............', 'h': 'x...x...x...x...'}, gain=0.35)
    for b, s in enumerate(('x.x.x.x.x.x.x.x.', 'x.x.x.x.xxxxxxxx', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx')):
        sg.drums(chip, iU + b, 1, {'s': s, 'k': 'x...x...x...x...' if b < 2 else ''}, gain=0.9)
    sg.drums(chip, iA3, 8, D_A | {'k': 'x.x.x.x.x.x.x.xx', 'o': '..x...x...x...x.'}, gain=1.0)
    sg.drums(sega, iC3, 8, D_B, gain=0.85)
    sg.drums(chip, iO, 4, D_A, gain=0.9)
    sg.sample('fx', S.riser(rng, int(4 * spb * sg.step_s * SR), 250, 9000, 0.3, 247), iU * spb, 0.7)
    for bar in (iC, iA3, iC3):
        sg.sample('fx', S.crash(rng) * 0.6, bar * spb, 0.5)
    # a queda reinicia: no fim, o chão 'some' (fita para) e o jingle religa
    sg.post.append(lambda mix, song: TP.tape_stop(mix, int(song.t_step((iO + 6) * spb) * SR), int(1.7 * spb * song.step_s * SR), power=1.4))
    coin_reboot(sg, 63, 9, root=59)
    loader_in_gap(sg, A_L[:40], 63, 0, gain=0.3, pan=0.0, pilot_s=0.1)
    sg.duck(['pad', 'shep'], 0.4, 0.14)
    lp_post(sg, 7800)
    fx = {
        'lead': [Reverb(room_size=0.25, wet_level=0.12, dry_level=0.92)],
        'lead2': [Reverb(room_size=0.25, wet_level=0.14, dry_level=0.9)],
        'choir': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'pad': [Chorus(rate_hz=0.4, depth=0.25, mix=0.3), Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'shep': [Reverb(room_size=0.8, wet_level=0.3, dry_level=0.75)],
        'wind': [LowpassFilter(5000)],
    }
    sg.sends = {'lead': {'echo': 0.16}, 'lead2': {'echo': 0.12}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(170, room=0.5, delay_fb=0.3, delay_beats=0.75)


def bars4(notes):
    return [n for n in notes if n[0] < 4 * 16]
