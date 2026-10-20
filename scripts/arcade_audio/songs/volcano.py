"""Vulcão — 164 bpm, ré frígio (dominante). Taiko em conjunto, metais, serra de VRC6 e pulso de chip em uníssono, coro de 'ó' no refrão,
magma borbulhando (bolhas graves de Minnaert) na ponte. Rufo de taiko e prato no fim.
Forma (64 compassos, ~1:34): intro de taiko 4 · riff 8 · riff+metais 8 · refrão 8 · ponte/magma 8 · subida 4 · riff em saw 8 · refrão 8 · saída 8."""
import numpy as np
from pedalboard import Reverb, Chorus, Distortion, LowpassFilter, Delay
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import lp_post, aux_default, loader_in_gap, corrupt

RIFF = parse("""
d5! . d5 d5 . f5 . d5 a5 . d5 . eb5 d5 . . |
d5! . d5 d5 . f5 . g5 a5 . g5 . f5 d5 . . |
eb5! . eb5 eb5 . g5 . eb5 bb5 . eb5 . f5 eb5 . . |
eb5! . eb5 eb5 . g5 . bb5 d6 . bb5 . g5 eb5 . . |
d5! . d5 d5 . f5 . d5 a5 . d5 . eb5 d5 . . |
d5! . f5 . a5 . d6 . c6 . a5 . f5 . d5 . |
bb5! . bb5 bb5 . d6 . bb5 f5 . bb5 . d6 . f6 . |
a5! . c#6 . e6 . c#6 . a5 . c#6 . e6 - - - |
""", 16)
CHORUS = parse("""
f5! - - - d5 - - - bb4 - - - d5 - f5 - |
g5! - - - e5 - - - c5 - - - e5 - g5 - |
a5! - - - f5 - - - d5 - - - f5 - a5 - |
d6! - - - a5 - - - f5 - - - a5 - d6 - |
d6! - - - bb5 - - - f5 - - - bb5 - d6 - |
e6! - - - c6 - - - g5 - - - c6 - e6 - |
g6! - - - eb6 - - - bb5 - - - eb6 - g6 - |
a5 . c#6 . e6 . a6 . g6 - - - e6 - - - |
""", 16)
BRIDGE = parse("""
d5 - - - - - - - f5 - - - e5 - - - |
d5 - - - - - - - a4 - - - bb4 - - - |
d5 - - - f5 - - - a5 - - - g5 - - - |
f5 - - - e5 - - - d5 - - - . . . . |
eb5 - - - g5 - - - bb5 - - - g5 - - - |
eb6 - - - d6 - - - bb5 - - - g5 - - - |
c#6 - - - e6 - - - a6 - - - e6 - - - |
c#6 - - - a5 - - - e5 - - - . . . . |
""", 16)
BUILD = parse("""
a4 bb4 c#5 d5 e5 f5 g5 a5 bb5 c#6 d6 e6 f6 g6 a6 . |
d5 e5 f5 g5 a5 bb5 c#6 d6 e6 f6 g6 a6 bb6 c#7? . . |
""".replace("c#7?", "a6"), 16)
BUILD2 = parse("""
a5! . a5 . a5 . a5 . a5 a5 a5 a5 a5 a5 a5 a5 |
a5! . . . . . . . . . . . . . . . |
""", 16)

H_A = Harmony("Dm Dm Eb Eb Dm Dm Bb A")
H_B = Harmony("Bb C Dm Dm Bb C Eb A")
H_C = Harmony("Dm Dm Dm Dm Eb Eb A A")
H_BU = Harmony("A A A A")
H_O = Harmony("Dm Dm Eb A Dm Dm Dm Dm")


def magma(sg, bar0, bars, dens):
    d_pent = ['d3', 'f3', 'g3', 'a3', 'c4', 'd4']
    for st in range(bar0 * 16, (bar0 + bars) * 16):
        if sg.rng.random() < dens:
            sg.note('magma', K.i_bub, st, K.midi_of(d_pent[int(sg.rng.integers(0, len(d_pent)))]), 3, gain=0.55, pan=float(sg.rng.uniform(-0.6, 0.6)),
                    rise=0.35, tau=float(sg.rng.uniform(0.09, 0.18)))


def build():
    spb = 16
    sg = K.Song(164, 64, spb=16, tail=3.0, seed=71, name='volcano')
    rng = sg.rng
    iI, iA, iA2, iB, iC, iBU, iA3, iB2, iO = 0, 4, 12, 20, 28, 36, 40, 48, 56
    # --- baixo: serra VRC6 oitavada em 16s, pedal na ponte
    for h, bar in ((H_A, iA), (H_A, iA2), (H_A, iA3)):
        sg.bass('bass', K.i_vrc6, h, bar, 'R . R R . R . R R . R R . R o .', octave=38, gain=0.6, decay=0.25)
    for h, bar in ((H_B, iB), (H_B, iB2)):
        sg.bass('bass', K.i_vrc6, h, bar, 'R R o R R o R R o R R o R R 5 5', octave=38, gain=0.55, decay=0.4)
    sg.bass('bass', K.i_tri, H_C, iC, 'R - - - - - - - - - - - - - - -', octave=34, gain=0.9, bits=6)
    sg.bass('bass', K.i_vrc6, H_BU, iBU, 'R . R . R . R . R R R R R R R R', octave=38, gain=0.8, decay=0.2)
    sg.bass('bass', K.i_vrc6, H_O, iO, 'R . . R . . R . R . . R . . o .', octave=38, gain=0.8, decay=0.25)
    # --- riffs: pulso 12,5 % + serra em uníssono; refrão com metais e coro
    sg.line('lead', K.i_nes, RIFF, iA, gain=0.75, duty=0.125, decay=0.25)
    sg.line('lead2', K.i_vrc6, shift(RIFF, 0, -12), iA, gain=0.6, decay=0.3)
    sg.line('lead', K.i_nes, RIFF, iA2, gain=0.7, duty=0.125, decay=0.25)
    sg.line('lead2', K.i_vrc6, shift(RIFF, 0, -12), iA2, gain=0.55, decay=0.3)
    for k, (st, m, l, v) in enumerate(RIFF):  # metais respondem em acentos
        if st % 16 == 0 and v >= 1.0:
            sg.note('brass', K.i_brass, iA2 * spb + st, m + 12, 3, gain=0.5, vel=1.0)
    sg.line('lead', K.i_vrc6, RIFF, iA3, gain=0.7, decay=0.3)
    sg.line('lead2', K.i_nes, shift(RIFF, 0, 12), iA3, gain=0.35, duty=0.25, decay=0.2, pan=-0.3)
    for bar in (iB, iB2):
        sg.line('lead', K.i_brass, CHORUS, bar, gain=0.55, cutoff=3200)
        sg.line('lead2', K.i_nes, CHORUS, bar, gain=0.4, duty=0.25, vib=0.006, pan=0.3)
        sg.line('choir', K.i_choir, shift(CHORUS, 0, -12, 0.8), bar, gain=0.45, vowel='o', a=0.08, r=0.4)
    sg.line('lead', K.i_modal, BRIDGE, iC, gain=0.8, kind='bell', tilt=1.2)
    sg.line('choir', K.i_choir, shift(BRIDGE, 0, -12, 0.7), iC, gain=0.4, vowel='u', a=0.3, r=0.9)
    sg.line('lead', K.i_nes, BUILD, iBU, gain=0.8, duty=0.25, decay=0.3)
    sg.line('lead', K.i_nes, BUILD2, iBU + 2, gain=0.85, duty=0.5, decay=0.3)
    sg.line('lead', K.i_nes, bars4(RIFF), iO, gain=0.75, duty=0.125, decay=0.25)
    sg.line('lead2', K.i_vrc6, shift(bars4(RIFF), 0, -12), iO, gain=0.55, decay=0.3)
    sg.pads('pad', K.i_pad, H_C, iC, 46, 70, gain=0.5, cutoff=800)
    sg.pads('pad', K.i_pad, H_B, iB, 46, 70, gain=0.4, cutoff=1500)
    sg.pads('pad', K.i_pad, H_B, iB2, 46, 70, gain=0.4, cutoff=1500)
    # magma e rufos
    magma(sg, iI, 4, 0.12)
    magma(sg, iC, 8, 0.28)
    # --- taiko e bateria
    taiko = K.kit_taiko
    chip = K.kit_chip
    D_IN = {'k': 'x...x...x...x.xx', 't1': '..............x.', 't2': '...............x'}
    D_A = {'k': 'x..x..x.x..x..x.', 's': '....x.......x...', 't3': '..x.............', 'h': 'x.x.x.x.x.x.x.x.'}
    D_B = {'k': 'x.x.x.x.x.x.x.x.', 's': '....x.......x..x', 'c': 'X...............', 'h': 'x.x.x.x.x.x.x.x.'}
    D_C = {'k': 'x.......x.......', 't1': '......x.........', 't2': '..............x.', 'o': '..x.....'+'..x.....'}
    sg.drums(taiko, iI, 4, D_IN, gain=1.0)
    sg.drums(taiko, iA, 8, {'k': D_A['k'], 's': D_A['s'], 't3': D_A['t3']}, gain=0.95)
    sg.drums(chip, iA, 8, {'h': D_A['h']}, gain=0.8)
    sg.drums(taiko, iA2, 8, {'k': D_A['k'], 's': D_A['s'], 't3': D_A['t3']}, gain=0.95)
    sg.drums(chip, iA2, 8, {'h': D_A['h'], 's': D_A['s']}, gain=0.8)
    sg.drums(taiko, iB, 8, {'k': D_B['k'], 's': D_B['s'], 'c': D_B['c']}, gain=0.95)
    sg.drums(chip, iB, 8, {'h': D_B['h']}, gain=0.8)
    sg.drums(taiko, iC, 8, D_C, gain=1.0)
    for b, s in enumerate(('x.x.x.x.x.x.x.x.', 'x.x.x.x.xxxxxxxx', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx')):
        sg.drums(taiko, iBU + b, 1, {'k': s}, gain=0.9)
    sg.drums(taiko, iA3, 8, {'k': D_B['k'], 's': D_B['s']}, gain=0.95)
    sg.drums(chip, iA3, 8, {'h': D_B['h']}, gain=0.8)
    sg.drums(taiko, iB2, 8, {'k': D_B['k'], 's': D_B['s'], 'c': D_B['c']}, gain=0.95)
    sg.drums(chip, iB2, 8, {'h': D_B['h']}, gain=0.8)
    sg.drums(taiko, iO, 4, D_A | {'h': ''}, gain=0.95)
    # rufo final em 4 compassos (t1,t2,t3 acelerando) + prato
    for b in range(4):
        pat = {'t1': 'x...x...x...x...', 't2': '..x...x...x...x.', 't3': 'x.x.x.x.x.x.x.x.'} if b < 3 else {'t1': 'xxxxxxxx........', 't2': '........xxxxxxxx', 'k': 'x...............'}
        sg.drums(taiko, iO + 4 + b, 1, pat, gain=0.9)
    sg.drums(taiko, iO + 7, 1, {'c': 'X...............'}, gain=1.0)
    sg.sample('fx', S.riser(rng, int(4 * spb * sg.step_s * SR), 300, 9000, 0.25, 220), iBU * spb, 0.7)
    sg.sample('fx', S.crash(rng) * 0.6, iB * spb, 0.5)
    sg.sample('fx', S.crash(rng) * 0.6, iA3 * spb, 0.5)
    sg.sample('fx', S.crash(rng) * 0.6, iC * spb, 0.5)
    sg.duck(['pad', 'choir'], 0.4, 0.14)
    loader_in_gap(sg, RIFF[:30], 60, 8, gain=0.3, pan=-0.2, pilot_s=0.15)
    # a rocha 'trinca': corrupção curtíssima antes do refrão final
    sg.post.append(lambda mix, song: corrupt(song, mix, iA3 + 7, 1, np.random.default_rng(12), bits=6, hold=4))
    lp_post(sg, 11000)
    fx = {
        'lead': [Distortion(drive_db=4), Reverb(room_size=0.2, wet_level=0.1, dry_level=0.92)],
        'lead2': [Reverb(room_size=0.2, wet_level=0.1, dry_level=0.92)],
        'brass': [Reverb(room_size=0.4, wet_level=0.2, dry_level=0.85)],
        'choir': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'pad': [Chorus(rate_hz=0.3, depth=0.25, mix=0.3), Reverb(room_size=0.7, wet_level=0.3, dry_level=0.75)],
        'magma': [Reverb(room_size=0.8, wet_level=0.4, dry_level=0.65)],
        'drums': [Reverb(room_size=0.25, wet_level=0.1, dry_level=0.95)],
    }
    sg.sends = {'lead': {'echo': 0.12}, 'brass': {'verb': 0.2}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(164, room=0.5, delay_fb=0.28, delay_beats=0.75)


def bars4(notes):
    return [n for n in notes if n[0] < 4 * 16]
