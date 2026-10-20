"""Queda Livre II — hard techno industrial, 150 bpm, sol# menor. Bumbo saturado de quatro, rumble de subgrave nos contratempos, stabs metálicos em 3+3+4+3+3,
chimbais e clanks de ferro, rufo de caixa que acelera até o limite e um assobio de bomba que despenca (a queda). Na quebra o chão some: arpejos que só descem,
sirenes caindo, bolinha de metal quicando cada vez mais rápido. Forma (40 compassos, ~1:04): intro 4 · subida 4 · DROP 8 · quebra 8 · subida 4 · DROP II (ácido) 8 · saída 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, Compressor, LowpassFilter, HighpassFilter, Distortion
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_e as E
from songs.common import aux_default

HD = Harmony("G#m G#m E F#")
H_BR = Harmony("G#m F# E D#m G#m F# E E")

LEAD = parse("""
g#4 . . g#4 . . b4 . . d#5 . . b4 . g#4 . |
g#4 . . g#4 . . b4 . . d#5 . . f#5 . e5 . |
e4 . . e4 . . g#4 . . b4 . . g#4 . e4 . |
f#4 . . f#4 . . a#4 . . c#5 . . a#4 . f#4 . |
""")
BRK = parse("""
g#5 - - d#5 - - b4 - - g#4 - - . . . . |
f#5 - - c#5 - - a#4 - - f#4 - - . . . . |
e5 - - b4 - - g#4 - - e4 - - . . . . |
d#5 - - a#4 - - f#4 - - d#4 - - . . . . |
g#5 d#5 b4 g#4 g#5 d#5 b4 g#4 g#5 d#5 b4 g#4 d#5 b4 g#4 d#4 |
f#5 c#5 a#4 f#4 f#5 c#5 a#4 f#4 f#5 c#5 a#4 f#4 c#5 a#4 f#4 c#4 |
e5 b4 g#4 e4 e5 b4 g#4 e4 e5 b4 g#4 e4 b4 g#4 e4 b3 |
g#5 - b5 - e6 - - - . . . . . . . . |
""")
STAB = (0, 3, 6, 10, 13)


def pat(d):
    s = ['.'] * 16
    for k, ch in d.items():
        s[k] = ch
    return ''.join(s)


def roll(sg, kit, ins, bar, step0, n, sub, v0, v1, gain=1.0):
    for i in range(n):
        v = v0 + (v1 - v0) * i / max(1, n - 1)
        sg.sample('drums', kit(ins, sg.rng, v), bar * 16 + step0 + i * sub, gain=gain)


def stabs(sg, h, bar0, steps=STAB, gain=0.8, cutoff=6000, tau=0.15, index=5.0):
    prev = None
    evs = h.events()
    for (st, ln, pc, q) in evs:
        v = K.voice(prev, pc, q, 56, 72, 3)
        prev = v
        b = st // 16
        for s in steps:
            for m in v:
                sg.note('stab', E.i_metal, (bar0 + b) * 16 + s, m, 1, gain=gain / 1.6, vel=1.0 if s in (0, 6, 13) else 0.8, tau=tau, index=index, cutoff=cutoff, ratio=1.5)


def sub_boom(sg, bar, gain=0.9):
    n = int(2.4 * SR)
    y = S.kick(n, 95, 27, 0.8, 0.0) * 0.9 + 0.25 * S.sine(S.sweep(70, 25, n), n) * np.exp(-S.tt(n) / 1.1)
    sg.sample('fx', y, bar * 16, gain)


def rev_crash(sg, bar, gain=0.6, tau=0.8):
    y = S.reverse(S.crash(sg.rng, int(1.8 * SR), tau))
    t0 = sg.t_step(bar * 16) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def build():
    sg = K.Song(150, 40, spb=16, tail=3.5, seed=515, name='inverse3')
    rng = sg.rng
    iI, iU, iD, iBR, iU2, iD2, iO = 0, 4, 8, 16, 24, 28, 36
    kit = E.kit_hard
    # ---- percussão
    K4 = 'x...x...x...x...'
    OFF = '..x...x...x...x.'
    D_I1 = {'k': K4, 'o': OFF}
    D_I2 = {'k': K4, 'o': OFF, 'h': 'o.o.o.o.o.o.o.o.'}
    sg.drums(kit, iI, 2, D_I1, gain=1.0)
    sg.drums(kit, iI + 2, 2, D_I2, gain=1.0)
    sg.drums(kit, iU, 2, {'k': K4, 'o': OFF, 'h': 'xoxoxoxoxoxoxoxo'}, gain=1.0)
    sg.drums(kit, iU + 2, 2, {'k': K4, 'o': OFF, 'h': 'xoxoxoxoxoxoxoxo', 'c': '....x.......x...'}, gain=1.0)
    D_D = {'k': K4, 'o': OFF, 'h': 'xoxoxoxoxoxoxoxo', 'c': '....x.......x...', 'm': '.......x.......x'}
    D_D2 = dict(D_D)
    D_D2['r'] = 'x.x.x.x.x.x.x.x.'
    D_D2['x'] = '...............x'
    sg.drums(kit, iD, 8, D_D, gain=1.0)
    sg.drums(kit, iD2, 8, D_D2, gain=1.0)
    # quebra: o chão some (sem bumbo); chimbal fantasma e toms descendo
    sg.drums(kit, iBR, 4, {'h': 'x...x...x...x...'}, gain=0.5)
    sg.drums(kit, iBR + 4, 3, {'h': 'x.x.x.x.x.x.x.x.', 't3': 'x.......x.......'}, gain=0.6)
    sg.drums(kit, iBR + 7, 1, {'t1': 'x.x.....x.x.....', 't2': '....x.x.....x.x.', 't3': 'x...x...x...x...', 'h': 'xxxxxxxxxxxxxxxx'}, gain=0.7)
    sg.drums(kit, iU2, 2, {'k': K4, 'o': OFF, 'h': 'x.x.x.x.x.x.x.x.'}, gain=1.0)
    sg.drums(kit, iU2 + 2, 2, {'k': K4, 'o': OFF, 'h': 'xoxoxoxoxoxoxoxo', 'c': '....x.......x...'}, gain=1.0)
    sg.drums(kit, iO, 2, {'k': K4, 'o': OFF, 'h': 'xoxoxoxoxoxoxoxo', 'c': '....x.......x...'}, gain=1.0)
    sg.drums(kit, iO + 2, 2, {'k': K4, 'o': OFF, 'h': 'o.o.o.o.o.o.o.o.'}, gain=1.0)
    # rufos de caixa: acelera da semínima até a trigésima segunda nota
    for b0 in (iU, iU2):
        roll(sg, kit, 's', b0 + 2, 0, 4, 4, 0.5, 0.7)
        roll(sg, kit, 's', b0 + 2, 8, 8, 1, 0.5, 0.8)
        roll(sg, kit, 's', b0 + 3, 0, 16, 1, 0.6, 0.9)
        roll(sg, kit, 's', b0 + 3, 8, 16, 0.5, 0.7, 1.0)
    # bolinha de metal: quicando cada vez mais rápido (ela está caindo) antes do segundo drop
    t = 0.0
    gap = 0.62
    t0 = sg.t_step((iU2 + 2) * 16)
    while gap > 0.045 and t0 + t < sg.t_step((iD2) * 16) - 0.02:
        sg.put('drums', kit('m', rng, 0.5 + 0.4 * (1 - gap)), t0 + t, 0.6)
        t += gap
        gap *= 0.84
    # ---- rumble e baixo
    RUM = '. . R - . . R - . . R - . . R -'
    sg.bass('rumble', E.i_rumble, Harmony("G#m G#m"), iU + 2, RUM, octave=32, gain=0.7)
    sg.bass('rumble', E.i_rumble, HD + HD, iD, RUM, octave=32, gain=1.0)
    sg.bass('rumble', E.i_rumble, Harmony("G#m G#m"), iU2 + 2, RUM, octave=32, gain=0.7)
    sg.bass('rumble', E.i_rumble, HD + HD, iD2, RUM, octave=32, gain=1.0)
    sg.bass('rumble', E.i_rumble, Harmony("G#m G#m"), iO, RUM, octave=32, gain=0.8)
    # ---- stabs metálicos
    stabs(sg, Harmony("G#m"), iU + 3, steps=(0,), gain=0.7, cutoff=3500)
    stabs(sg, HD + HD, iD, gain=0.85, cutoff=5500)
    stabs(sg, Harmony("G#m"), iU2 + 3, steps=(0, 6), gain=0.7, cutoff=4000)
    stabs(sg, HD + HD, iD2, gain=0.9, cutoff=7000, index=6.0)
    # ---- ácido (segundo drop; no primeiro entra só na segunda metade)
    for rep in range(2):
        sg.line('lead', E.i_acid, LEAD, iD2 + 4 * rep, gain=0.8, cutoff=2600 + 600 * rep, tau=0.1)
    sg.line('lead', E.i_acid, LEAD, iD + 4, gain=0.55, cutoff=2000, tau=0.12)
    # ---- quebra: arpejos que só descem, base e sirenes caindo
    sg.line('brk', E.i_metal, BRK, iBR, gain=0.75, tau=0.5, index=2.4, ratio=2.0, cutoff=4500)
    sg.pads('pad', E.i_sinpad, H_BR, iBR, 44, 68, gain=0.9, n=3, cutoff=900, a=0.5, r=1.0)
    sg.bass('rumble', I2.i_sub, H_BR, iBR, 'R - - - - - - - - - - - - - - -', octave=32, gain=0.8, drive=0.6)
    for k, bar in enumerate((iBR, iBR + 2, iBR + 4, iBR + 6)):
        sg.note('fall', E.i_siren, bar * 16, 80, 30, gain=0.55, vel=0.8, fall=20.0 + 3 * k, pan=-0.35 if k % 2 == 0 else 0.35)
    # ---- quedas: assobio de bomba nas subidas e no fim da quebra, risers, impactos
    for b0, bars in ((iU, 4), (iBR + 4, 4), (iU2, 4)):
        n = int(bars * 16 * sg.step_s * SR)
        sg.sample('fall', E.faller(rng, n, 3400.0 if b0 != iBR + 4 else 2600.0, 120.0, 0.55, 0.5), b0 * 16, 0.8)
    for b0 in (iU, iU2):
        sg.sample('fx', S.riser(rng, int(4 * 16 * sg.step_s * SR), 250, 9000, 0.25, 260), b0 * 16, 0.55)
    for bar in (iD, iD2):
        sub_boom(sg, bar)
        rev_crash(sg, bar)
        sg.drums(kit, bar, 1, {'z': 'x...............'}, gain=0.9)
    rev_crash(sg, iBR, 0.5)
    sg.duck(['rumble', 'stab', 'pad', 'brk', 'lead'], 0.62, 0.12)
    sg.trim = {'drums': -8.5, 'rumble': -5.5, 'stab': 5.5, 'lead': 9.0, 'brk': 3.0, 'pad': 8.0, 'fall': -3.0, 'fx': -3.0}
    sg.post.append(lambda mix, song: np.tanh(mix * 1.25) / np.tanh(1.25))
    fx = {
        'drums': [Compressor(threshold_db=-14, ratio=3.0, attack_ms=5, release_ms=80)],
        'rumble': [LowpassFilter(240)],
        'stab': [HighpassFilter(180), Distortion(drive_db=5), Reverb(room_size=0.3, wet_level=0.12, dry_level=0.9)],
        'lead': [Distortion(drive_db=7), Reverb(room_size=0.3, wet_level=0.12, dry_level=0.9)],
        'brk': [Reverb(room_size=0.8, wet_level=0.35, dry_level=0.75)],
        'pad': [Reverb(room_size=0.9, wet_level=0.35, dry_level=0.7)],
        'fall': [Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'fx': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
    }
    sg.sends = {'stab': {'echo': 0.3}, 'lead': {'echo': 0.25}, 'brk': {'echo': 0.35}}
    return sg, fx, aux_default(150, room=0.5, delay_fb=0.35, delay_beats=0.75)
