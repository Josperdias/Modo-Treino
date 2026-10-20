"""Cidade Neon — 150 bpm, lá menor. Chip NES + VRC6 (saw em degraus), baixo triângulo, eco de canal, bateria de ruído.
Forma (64 compassos, ~1:42): intro 4 · A 8 · A+eco 8 · refrão 8 · ponte (meio tempo) 8 · subida 4 · A em saw 8 · refrão 8 · 'cartucho corrompe', fita para e reinicia 8."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, Gain, LowpassFilter, HighpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
from songs.common import aux_default, loader_in_gap, coin_reboot, corrupt

A_LEAD = parse("""
e5! . . e5 . d5 c5 . a4 - - . c5 . d5 . |
e5! . . e5 . f5 e5 . c5 - - . a4 . c5 . |
g5! . . g5 . e5 d5 . c5 - - . e5 . g5 . |
d5! . . d5 . e5 d5 . b4 - - . d5 - g5 - |
a4! . c5 e5 . a5 . e5 c5 . a4 . e5 - - . |
f5! . a5 . f5 . c5 . a4 . c5 . f5 - - . |
g5! . d5 . b4 . d5 . g5 . b5 . g5 - - . |
e5! . g#5 . b5 . g#5 . e5 - - . d5 . b4 . |
""", 16)
B_LEAD = parse("""
c6! - - c6 . a5 . f5 a5 - - . c6 - - . |
b5! - - b5 . g5 . d5 g5 - - . b5 - - . |
a5! - - a5 . e5 . c5 e5 - - . a5 - - . |
e5 . a5 . c6 . b5 . g#5 . b5 . e6 - - . |
c6! - - c6 . a5 . f5 a5 - c6 - f6 - - . |
d6! - - d6 . b5 . g5 b5 - d6 - g6 - - . |
e6! - - e6 . c6 . a5 c6 - e6 - a6 - - . |
g#5! . b5 . e6 . g#6 . e6 - - - b5 - - . |
""", 16)
C_LEAD = parse("""
a4 - - - - - - - d5 - - - f5 - - - |
e5 - - - d5 - - - a4 - - - . . . . |
c5 - - - e5 - - - a5 - - - g5 - e5 - |
c5 - - - . . . . e5 - d5 - c5 - b4 - |
a4 - - - c5 - - - f5 - - - e5 - c5 - |
b4 - - - d5 - - - g5 - - - f5 - d5 - |
d5 - - - f5 - - - g#5 - - - b5 - - - |
d6 . . . b5 . . . g#5 . . . e5 . . . |
""", 16)
BUILD = parse("""
e5 f5 g#5 a5 b5 c6 d6 e6 e5 f5 g#5 a5 b5 c6 d6 e6 |
e6 d6 c6 b5 a5 g#5 f5 e5 e6 . e6 . e6 . e6 . |
e5! . e5 . e5 . e5 . e5 e5 e5 e5 e5 e5 e5 e5 |
e6! . . . . . . . . . . . . . . . |
""", 16)

H_INTRO = Harmony("Am Am F G")
H_A = Harmony("Am F C G Am F G E7")
H_B = Harmony("F G Am Am_E F G Am E")
H_C = Harmony("Dm Dm Am Am F G Bdim_E E7")
H_BUILD = Harmony("E E E E")
H_TAG = Harmony("F G Am Am_E Am Am Am Am")


def build():
    spb = 16
    S_ = K.Song(150, 64, spb=16, tail=2.5, seed=11, name='neon')
    rng = S_.rng
    sg = S_
    # estrutura (compasso inicial de cada seção)
    iIN, iA1, iA2, iB, iC, iBU, iA3, iB2, iTAG = 0, 4, 12, 20, 28, 36, 40, 48, 56

    BASS_A = 'R . . R . . R . R . . R . . o 5'
    BASS_B = 'R . R R . R . R R . R R . R o .'
    BASS_C = 'R - - - - - - - R - - - - - - -'
    # ---- harmonia e baixo
    for h, bar in ((H_INTRO, iIN), (H_A, iA1), (H_A, iA2), (H_A, iA3)):
        sg.bass('bass', K.i_tri, h, bar, BASS_A if bar else 'R - - - - - - - R - - - - - - -', octave=33, gain=1.0)
    for h, bar in ((H_B, iB), (H_B, iB2)):
        sg.bass('bass', K.i_tri, h, bar, BASS_B, octave=33, gain=1.0)
    sg.bass('bass', K.i_tri, H_C, iC, BASS_C, octave=33, gain=1.0)
    sg.bass('bass', K.i_tri, H_BUILD, iBU, 'R . R . R . R . R R R R R R R R', octave=33, gain=1.0)
    sg.bass('bass', K.i_tri, H_TAG, iTAG, BASS_B, octave=33, gain=1.0)
    # ---- acordes de NES (arpejo rápido) e arpejos
    for h, bar in ((H_INTRO, iIN), (H_A, iA1), (H_A, iA2), (H_A, iA3)):
        sg.fast_arp('arp', h, bar, lo=57, gain=0.5 if bar else 0.6, duty=0.125, pan=0.3)
    for h, bar in ((H_B, iB), (H_B, iB2), (H_TAG, iTAG)):
        sg.fast_arp('arp', h, bar, lo=60, gain=0.5, duty=0.25, pan=-0.3)
    sg.pads('pad', K.i_pad, H_C, iC, 52, 72, gain=0.55, cutoff=1300)
    sg.arp('arp', K.i_nes, H_C, iC, '0 . 1 . 2 . 1 . 0 . 1 . 2 . 3 .', lo=69, gain=0.5, duty=0.125, decay=0.09)
    # ---- melodias
    sg.line('lead', K.i_nes, A_LEAD, iA1, gain=0.9, duty=0.25, vib=0.006)
    sg.line('lead', K.i_nes, A_LEAD, iA2, gain=0.9, duty=0.25, vib=0.006)
    echo = shift(A_LEAD, 3, 0, 0.45)
    sg.line('lead2', K.i_nes, [n for n in echo if n[0] < 8 * spb], iA2, gain=0.55, duty=0.5, pan=0.4, decay=0.1)
    sg.line('lead', K.i_vrc6, A_LEAD, iA3, gain=0.85, vib=0.005)
    sg.line('lead2', K.i_nes, shift(A_LEAD, 0, 12), iA3, gain=0.4, duty=0.125, pan=-0.35, decay=0.14)
    for bar in (iB, iB2):
        sg.line('lead', K.i_vrc6 if bar == iB else K.i_nes, B_LEAD, bar, gain=0.85, **({'vib': 0.006} if bar == iB else {'duty': 0.25, 'vib': 0.007}))
    sg.line('lead2', K.i_nes, shift(B_LEAD, 0, -12, 0.5), iB2, gain=0.5, duty=0.5, pan=0.35)
    sg.line('lead', K.i_tri, C_LEAD, iC, gain=0.9, bits=6)
    sg.line('lead2', K.i_fmep, shift(C_LEAD, 0, 0, 0.55), iC, gain=0.35, pan=0.3, tau=0.5)
    sg.line('lead', K.i_nes, BUILD, iBU, gain=0.8, duty=0.25, decay=0.2)
    # tag: o refrão trava e a fita carrega a partitura
    sg.line('lead', K.i_nes, bars_4(B_LEAD), iTAG, gain=0.85, duty=0.25, vib=0.005)
    sg.line('lead', K.i_nes, shift(bars_4(A_LEAD), 0), iTAG + 4, gain=0.8, duty=0.125)
    # ---- bateria
    kit = K.kit_chip
    D_A = {'k': 'x...x...x..xx...', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.xx', 'o': '..x...x...x...x.'}
    D_B = {'k': 'x..xx..xx..xx.x.', 's': '....x.......x..x', 'h': 'xxxxxxxxxxxxxxxx', 'o': '......x.......x.', 'c': 'X...............'}
    D_C = {'k': 'x.......x.......', 's': '........x.......', 'h': 'x...x...x...x...', 'r': '..............x.'}
    D_IN = {'h': 'x.x.x.x.x.x.x.x.'}
    sg.drums(kit, iIN, 4, D_IN, gain=0.8)
    sg.drums(kit, iA1, 8, D_A, gain=1.0)
    sg.drums(kit, iA2, 8, D_A, gain=1.0)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iC, 8, D_C, gain=0.9)
    for b, s in enumerate(('x.x.x.x.x.x.x.x.', 'x.x.x.x.xxxxxxxx', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx')):
        sg.drums(kit, iBU + b, 1, {'s': s, 'k': 'x...x...x...x...' if b < 2 else ''}, gain=0.9 + 0.05 * b)
    sg.drums(kit, iA3, 8, D_B, gain=1.0)
    sg.drums(kit, iB2, 8, D_B, gain=1.0)
    sg.drums(kit, iTAG, 4, D_B, gain=1.0)
    sg.sample('fx', S.crash(rng) * 0.6, iA3 * spb, 0.6)
    sg.sample('fx', S.riser(rng, int(4 * spb * sg.step_s * SR), 300, 8000, 0.25, 330), iBU * spb, 0.7)
    sg.sample('fx', S.crash(rng) * 0.6, iC * spb, 0.5)
    # pós: corrompe o fim, a fita para, e o jingle de reinício
    stop_bar = iTAG + 4
    sg.post.append(lambda mix, song: corrupt(song, mix, iTAG + 2, 2, rng, bits=5, hold=6))
    sg.post.append(lambda mix, song: TP.tape_stop(mix, int(song.t_step((stop_bar + 1) * spb) * SR), int(2.2 * spb * song.step_s * SR), power=1.5))
    coin_reboot(sg, 63, 8, root=57)
    loader_in_gap(sg, A_LEAD[:36], 62, 10, gain=0.35, pan=-0.2, pilot_s=0.2)
    sg.duck(['pad', 'arp'], 0.4, 0.12)
    fx = {
        'lead': [Reverb(room_size=0.18, wet_level=0.12, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.2, wet_level=0.15, dry_level=0.85)],
        'arp': [Chorus(rate_hz=0.5, depth=0.12, mix=0.25)],
        'pad': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.8)],
        'drums': [],
    }
    sg.sends = {'lead': {'echo': 0.18}, 'lead2': {'echo': 0.15}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(150, room=0.45, delay_fb=0.3, delay_beats=0.75)


def bars_4(notes):
    return [n for n in notes if n[0] < 4 * 16]
