"""Queda Livre III — phonk / trap em meio tempo, 142 bpm, ré# frígio. 808 que escorrega de uma nota à outra (e despenca uma oitava inteira), bumbo curto,
caixa+palma no terceiro tempo, chimbais em rolos (tercinas e trigésimas), cowbell sinistro tocando a melodia, cortes de voz de formantes 'descidos',
pad escuro e sinos de caixa de música no começo. Antes do drop o chão some por um tempo; a fita para no fim do primeiro drop e no fim da faixa.
Forma (40 compassos, ~1:08): névoa 4 · verso 8 · subida 4 · DROP 8 · quebra 4 · DROP II 8 · saída 4."""
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

HL = Harmony("D#m E D#m B")
HL2 = Harmony("D#m G#m E E")
H_U = Harmony("D#m E D#m E")
H_BR = Harmony("G#m B E D#m")

COW = parse("""
d#5 . . d#5 . . f#5 . . d#5 . . c#5 . . . |
e5 . . e5 . . g#5 . . e5 . . d#5 . . . |
d#5 . . d#5 . . f#5 . . a#5 . . g#5 . . . |
b4 . . b4 . . d#5 . . f#5 . . d#5 . . . |
""")
COW2 = parse("""
d#5 . . d#5 . . f#5 . . d#5 . . c#5 . . . |
g#5 . . g#5 . . b5 . . g#5 . . f#5 . . . |
e5 . . e5 . . g#5 . . b5 . . g#5 . . . |
e5 . . g#5 . . e5 . . d#5 . . c#5 . . . |
""")
CHOP = [
    ". . . . a#4 - . . . . d#5 - . . . .",
    ". . . . b4 - . . . . e5 - . . . .",
    ". . . . a#4 - . . f#5 - d#5 - . . . .",
    ". . . . f#4 - . . . . b4 - d#5 - . .",
]
CHOP2 = [
    ". . . . g#4 - . . . . b4 - . . . .",
    ". . . . g#4 - . . . . b4 - e5 - . .",
    ". . . . g#4 - . . . . g#4 - b4 - . .",
    ". . . . g#4 - . . b4 - e5 - g#5 - . .",
]
BELL = parse("""
d#6 - - - - - - - f#6 - - - a#5 - - - |
e6 - - - - - - - g#6 - - - b5 - - - |
d#6 - - - - - - - f#6 - - - a#5 - - - |
b5 - - - d#6 - - - f#6 - - - . . . . |
""")

# 808: (passo, midi, duração em passos, nota de origem do glide, tempo de glide em s)
N8 = {
    'D1': [(0, 51, 6, None), (7, 51, 2, None), (10, 49, 3, 51), (14, 51, 2, None)],
    'E': [(0, 52, 6, None), (7, 52, 2, None), (10, 52, 2, None), (12, 51, 4, 52)],
    'D2': [(0, 51, 5, None), (6, 51, 2, None), (8, 63, 1, None), (10, 51, 3, None), (13, 54, 3, 51)],
    'B': [(0, 47, 6, None), (7, 47, 2, None), (10, 47, 2, None), (12, 51, 4, 47)],
    'G': [(0, 44, 6, None), (7, 44, 2, None), (10, 44, 3, None), (14, 46, 2, 44)],
    'E2': [(0, 52, 6, None), (7, 52, 2, None), (10, 54, 3, 52), (14, 52, 2, None)],
    'E3': [(0, 52, 5, None), (6, 52, 2, None), (8, 40, 8, 52, 0.35)],
}
LOOP_A = ['D1', 'E', 'D2', 'B']
LOOP_B = ['D1', 'G', 'E2', 'E3']


def pat(d):
    s = ['.'] * 16
    for k, ch in d.items():
        s[k] = ch
    return ''.join(s)


def put808(sg, names, bar0, gain=1.0, drive=2.4, cut_last=False):
    for b, nm in enumerate(names):
        for ev in N8[nm]:
            st, m, ln, fr = ev[0], ev[1], ev[2], ev[3]
            gl = ev[4] if len(ev) > 4 else 0.1
            if cut_last and b == len(names) - 1 and st >= 12:
                continue
            sg.note('b808', E.i_808, (bar0 + b) * 16 + st, m, ln, gain=gain, vel=1.0, from_midi=fr, glide=gl, drive=drive)


def hats(sg, kit, bar, style, gain=1.0, cut_last=False):
    ev = []
    if style == 'v':
        ev += [(i, 0.7 if i % 4 == 0 else 0.5) for i in range(0, 16, 2)]
        if bar % 2 == 1:
            ev += [(14 + 0.5 * k, 0.5 + 0.1 * k) for k in range(4)]
    elif style == 'u':
        ev += [(i, (0.8 if i % 4 == 0 else 0.55)) for i in range(16)]
        ev += [(15 + 0.5 * k - 0.5, 0.6 + 0.1 * k) for k in range(2)]
    else:
        base = [1.0, 0.4, 0.7, 0.4]
        ev += [(i, 0.75 * base[i % 4]) for i in range(16) if i not in (6, 7, 14, 15)]
        kind = bar % 4
        if kind in (0, 2):
            ev += [(6, 0.6), (6 + 2 / 3, 0.7), (6 + 4 / 3, 0.8)]
            ev += [(14 + 0.25 * k, 0.45 + 0.08 * k) for k in range(8)]
        elif kind == 1:
            ev += [(6, 0.7), (7, 0.55)]
            ev += [(14 + 2 / 3 * k, 0.6 + 0.12 * k) for k in range(3)]
        else:
            ev += [(6 + 0.5 * k, 0.5 + 0.07 * k) for k in range(4)]
            ev += [(14 + 0.25 * k, 0.5 + 0.07 * k) for k in range(8)]
    for st, v in ev:
        if cut_last and st >= 12:
            continue
        sg.sample('drums', kit('h', sg.rng, v), bar * 16 + st, gain=gain * 0.85, pan=float(sg.rng.uniform(-0.25, 0.25)))


def build():
    sg = K.Song(142, 40, spb=16, tail=3.5, seed=616, name='inverse4')
    rng = sg.rng
    iI, iV, iU, iD, iBR, iD2, iO = 0, 4, 12, 16, 24, 28, 36
    kit = E.kit_trap
    # ---- bateria e chimbais
    KICK = pat({0: 'x', 7: 'x', 10: 'x'})
    KICK2 = pat({0: 'x', 7: 'x', 10: 'x', 13: 'o'})
    SN = pat({8: 'x'})
    sg.drums(kit, iV, 4, {'k': KICK}, gain=1.0)
    sg.drums(kit, iV + 4, 4, {'k': KICK, 's': SN, 'p': SN}, gain=1.0)
    sg.drums(kit, iU, 4, {'k': pat({0: 'x', 10: 'x'}), 's': SN}, gain=1.0)
    sg.drums(kit, iD, 8, {'k': KICK, 's': SN, 'p': SN, 'o': pat({11: 'x'}), 'r': pat({15: 'o'})}, gain=1.0)
    sg.drums(kit, iBR + 3, 1, {'s': pat({8: 'x', 12: 'x', 14: 'x', 15: 'x'})}, gain=0.8)
    sg.drums(kit, iD2, 8, {'k': KICK2, 's': pat({8: 'x', 15: 'o'}), 'p': SN, 'o': pat({3: 'o', 11: 'x'}), 'r': pat({15: 'x', 5: 'o'})}, gain=1.0)
    sg.drums(kit, iO, 2, {'k': KICK}, gain=0.9)
    for b in range(iV, iV + 8):
        hats(sg, kit, b, 'v', gain=0.8)
    for b in range(iU, iU + 4):
        hats(sg, kit, b, 'u', gain=0.9, cut_last=(b == iU + 3))
    for b in range(iD, iD + 8):
        hats(sg, kit, b, 'd')
    for b in range(iD2, iD2 + 8):
        hats(sg, kit, b, 'd', gain=1.05)
    for b in range(iO, iO + 2):
        hats(sg, kit, b, 'v', gain=0.6)
    # rolo de caixa na subida
    for k in range(16):
        sg.sample('drums', kit('s', rng, 0.35 + 0.04 * k), (iU + 3) * 16 + (0 if k < 8 else 8) + (k % 8) * (1.0 if k < 8 else 0.5), gain=0.7)
    # ---- 808
    put808(sg, LOOP_A, iV + 4, gain=0.7)
    put808(sg, LOOP_A, iV, gain=0.55)
    put808(sg, ['D1', 'E', 'D2', 'E'], iU, gain=0.8, cut_last=True)
    put808(sg, LOOP_A, iD, gain=1.0)
    put808(sg, LOOP_A, iD + 4, gain=1.0)
    sg.note('b808', E.i_808, iBR * 16, 44, 40, gain=0.8, vel=1.0, glide=0.1, decay=3.0)
    put808(sg, LOOP_A, iD2, gain=1.0, drive=2.8)
    put808(sg, LOOP_B, iD2 + 4, gain=1.0, drive=2.8)
    sg.note('b808', E.i_808, iO * 16, 51, 24, gain=0.8, vel=1.0, decay=3.0)
    sg.note('b808', E.i_808, (iO + 2) * 16, 49, 24, gain=0.7, vel=1.0, decay=3.0, from_midi=51, glide=0.3)
    # ---- cowbell sinistro
    sg.line('cow', E.i_cowbell, COW, iV + 4, gain=0.7, pan=-0.2, vel_scale=0.8)
    sg.line('cow', E.i_cowbell, COW, iD, gain=0.9, pan=-0.2)
    sg.line('cow', E.i_cowbell, COW, iD + 4, gain=0.9, pan=-0.2)
    sg.line('cow', E.i_cowbell, COW, iD2, gain=0.95, pan=-0.2)
    sg.line('cow', E.i_cowbell, COW2, iD2 + 4, gain=0.95, pan=-0.2)
    sg.line('cow2', E.i_cowbell, [(s, m + 12, l, v) for (s, m, l, v) in COW], iD2, gain=0.4, pan=0.4, tau=0.06, vel_scale=0.7)
    sg.line('cow2', E.i_cowbell, [(s, m + 12, l, v) for (s, m, l, v) in COW2], iD2 + 4, gain=0.4, pan=0.4, tau=0.06, vel_scale=0.7)
    sg.line('cow', E.i_cowbell, shift(COW, 0, 0, 0.5), iBR, gain=0.6, pan=-0.2, tau=0.2)
    # ---- cortes de voz
    def chops(lines, bar0, gain, vowels=('a', 'o'), **kw):
        for b, txt in enumerate(lines):
            notes = parse(txt)
            sg.line('chop', E.i_chop, notes, bar0 + b, gain=gain, vowel=vowels[b % 2], **kw)
    chops(CHOP, iI, 0.7)
    chops(CHOP, iV + 4, 0.7, pan=0.3)
    chops(CHOP, iD, 0.9)
    chops(CHOP, iD + 4, 0.9, vowels=('o', 'a'))
    chops(CHOP, iD2, 1.0, shift=0.78)
    chops(CHOP2, iD2 + 4, 1.0, shift=0.78)
    chops(CHOP, iBR, 0.8, vowels=('u', 'o'))
    # ---- sinos de caixa de música, pad escuro
    sg.line('bell', K.i_modal, BELL, iI, gain=0.75, kind='glass', tilt=1.6, pan=0.3)
    sg.line('bell', K.i_modal, BELL, iBR, gain=0.6, kind='glass', tilt=1.8, pan=-0.3)
    sg.pads('pad', E.i_sinpad, HL, iI, 48, 70, gain=0.9, n=3, cutoff=800, a=0.8, r=1.0)
    sg.pads('pad', E.i_sinpad, HL, iV, 48, 70, gain=0.7, n=3, cutoff=700, a=0.8, r=1.0)
    sg.pads('pad', E.i_sinpad, HL, iV + 4, 48, 70, gain=0.8, n=3, cutoff=800, a=0.8, r=1.0)
    sg.pads('pad', E.i_sinpad, H_U, iU, 48, 70, gain=0.9, n=3, cutoff=1100, a=0.6, r=1.0)
    sg.pads('pad', E.i_sinpad, HL, iD, 48, 70, gain=0.9, n=3, cutoff=900, a=0.5, r=1.0)
    sg.pads('pad', E.i_sinpad, HL, iD + 4, 48, 70, gain=0.9, n=3, cutoff=900, a=0.5, r=1.0)
    sg.pads('pad', E.i_sinpad, H_BR, iBR, 48, 70, gain=0.9, n=3, cutoff=900, a=0.8, r=1.2)
    sg.pads('pad', E.i_sinpad, HL, iD2, 48, 70, gain=0.9, n=3, cutoff=1000, a=0.5, r=1.0)
    sg.pads('pad', E.i_sinpad, HL2, iD2 + 4, 48, 70, gain=0.9, n=3, cutoff=1000, a=0.5, r=1.0)
    sg.pads('pad', E.i_sinpad, HL, iO, 48, 70, gain=0.8, n=3, cutoff=700, a=0.8, r=1.6)
    # ---- queda: sirene e assobio de bomba, risers, impactos
    sg.note('fall', E.i_siren, iU * 16, 87, 48, gain=0.5, vel=0.8, fall=26.0, pan=-0.3)
    sg.sample('fall', E.faller(rng, int(4 * 16 * sg.step_s * SR), 3000.0, 110.0, 0.5, 0.5), iU * 16, 0.7)
    sg.note('fall', E.i_siren, (iBR + 2) * 16, 82, 30, gain=0.45, vel=0.8, fall=24.0, pan=0.3)
    sg.sample('fx', S.riser(rng, int(2 * 16 * sg.step_s * SR), 250, 9000, 0.25, 260), (iBR + 2) * 16, 0.55)
    for bar in (iD, iD2):
        n = int(2.6 * SR)
        y = S.kick(n, 95, 28, 0.8, 0.0) * 0.9
        sg.sample('fx', y, bar * 16, 0.8)
        yr = S.reverse(S.crash(rng, int(1.8 * SR), 0.8))
        t0 = sg.t_step(bar * 16) - len(yr) / SR
        sg.put('fx', yr * 0.8, t0, 0.6)
    yr = S.reverse(S.crash(rng, int(2.0 * SR), 0.9))
    sg.put('fx', yr * 0.8, sg.t_step(iV * 16) - len(yr) / SR, 0.5)
    sg.duck(['pad', 'bell', 'chop', 'cow'], 0.35, 0.1)
    sg.duck(['b808'], 0.35, 0.07)
    sg.trim = {'drums': 0.0, 'b808': 0.0, 'cow': 0.0, 'cow2': 0.0, 'chop': 0.0, 'bell': 0.0, 'pad': 0.0, 'fall': 0.0, 'fx': 0.0}

    def stops(mix, song):
        i0 = int(song.t_step((iD - 1 + 8) * 16 + 8) * SR)
        mix = TP.tape_stop(mix, i0, int(song.t_step((iBR) * 16) * SR) - i0, power=1.8, tail_fade=0.4)
        j0 = int(song.t_step((iO + 3) * 16 + 4) * SR)
        return TP.tape_stop(mix, j0, mix.shape[1] - j0, power=1.7, tail_fade=0.5)
    sg.post.append(stops)
    fx = {
        'drums': [Compressor(threshold_db=-16, ratio=2.5, attack_ms=6, release_ms=90)],
        'b808': [Compressor(threshold_db=-14, ratio=3.0, attack_ms=10, release_ms=120), LowpassFilter(1400)],
        'cow': [Reverb(room_size=0.5, wet_level=0.22, dry_level=0.85)],
        'cow2': [Reverb(room_size=0.6, wet_level=0.3, dry_level=0.8)],
        'chop': [HighpassFilter(180), Reverb(room_size=0.6, wet_level=0.3, dry_level=0.8)],
        'bell': [Reverb(room_size=0.8, wet_level=0.35, dry_level=0.75)],
        'pad': [Reverb(room_size=0.9, wet_level=0.3, dry_level=0.75)],
        'fall': [Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'fx': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
    }
    sg.sends = {'cow': {'echo': 0.3}, 'chop': {'echo': 0.35}, 'bell': {'echo': 0.3}}
    return sg, fx, aux_default(142, room=0.6, delay_fb=0.4, delay_beats=0.75)
