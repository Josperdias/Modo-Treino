"""Rascunho — 5/4 (3+2), 112 bpm, lá menor. Linhas de lápis (ruído com varredura), violão e vibrafone. O tema aparece de trás para frente
(retrógrado) e de cabeça para baixo (inversão) na ponte, onde os canais esquerdo e direito TROCAM (o controle inverte). Borracha = ruído ao contrário.
Forma (40 compassos de 5/4, ~1:47): rabisco 4 · tema 8 · tema+batida 8 · ponte invertida 8 · tema com os dois lados 8 · apagando 4."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, Delay
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony, invert, retro, fit
import tape as TP
from songs.common import aux_default, loader_in_gap

SPB = 20
T1 = parse("""
a4 . . . c5 . . . e5 . . . a5 . . . g5 . e5 . |
f5 . . . d5 . . . a4 . . . d5 . f5 . a5 . . . |
b4 . . . d5 . . . g5 . . . f5 . d5 . b4 . . . |
c5 . e5 . g5 . . . b5 . . . g5 . e5 . c5 . . . |
""", SPB)
T2 = parse("""
a5 . . . f5 . . . c5 . . . a4 . . . c5 . f5 . |
d5 . . . f5 . . . b5 . . . a5 . . . f5 . d5 . |
g#5 . . . b5 . . . e6 . . . d6 . . . b5 . g#5 . |
a5 . . . e5 . . . c5 . . . e5 . . . a4 . . . |
""", SPB)
H1 = Harmony("Am7 Dm7 G7 Cmaj7", SPB)
H2 = Harmony("F Bm7b5 E7 Am", SPB)
H_A = H1 + H2
H_B = Harmony("Am7 Am7 Am7 Am7 Dm7 Dm7 E7 E7", SPB)
H_O = Harmony("Am7 Am7 E7 Am7", SPB)


def pencil(sg, bar, step, dur_s=0.5, f0=1800, f1=5200, gain=0.4, pan=0.0, rise=True):
    n = int(dur_s * SR)
    x = sg.rng.standard_normal(n)
    out = np.zeros(n)
    fc = S.sweep(f0, f1, n) if rise else S.sweep(f1, f0, n)
    for c in np.geomspace(800, 8000, 8):
        out += S.bp(x, c / 1.3, c * 1.3, 1) * np.exp(-(np.log2(fc / c) / 0.5) ** 2)
    # granulação de traço: modulação rápida
    out *= 0.6 + 0.4 * np.sin(2 * np.pi * 38 * np.arange(n) / SR)
    out *= np.sin(np.pi * np.linspace(0, 1, n)) ** 0.8
    sg.sample('pencil', out * 0.7, bar * SPB + step, gain, pan)


def erase(sg, bar, step, dur_s=1.2, gain=0.4):
    n = int(dur_s * SR)
    x = S.bp(sg.rng.standard_normal(n), 900, 4200, 1) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * np.arange(n) / SR))
    x *= np.linspace(0, 1, n) ** 1.5
    sg.sample('pencil', x, bar * SPB + step, gain, pan=float(sg.rng.uniform(-0.4, 0.4)))


def build():
    sg = K.Song(112, 40, spb=SPB, tail=3.5, seed=91, name='sketch')
    rng = sg.rng
    iS, iA, iA2, iB, iA3, iO = 0, 4, 12, 20, 28, 36
    mir = lambda notes, h: fit(invert(notes, 9, 'minor', 72), h)
    # --- rabisco de abertura
    for k, (st, d) in enumerate(((0, 0.5), (6, 0.7), (14, 0.4), (23, 0.8), (31, 0.5), (40, 0.6), (51, 0.9), (60, 0.7), (70, 0.8))):
        pencil(sg, 0, st, d, 1200 + 300 * k, 5200, 0.35, pan=float(rng.uniform(-0.6, 0.6)), rise=(k % 2 == 0))
    for st in range(0, 4 * SPB, 4):
        sg.sample('wood', S.wood(1900, int(0.04 * SR), 0.01) * 0.6, st, 0.3 + 0.03 * (st // 4 % 5), pan=-0.3 if (st // 4) % 2 else 0.3)
    sg.line('lead', K.i_pluck, parse(". . . . . . . . . . . . . . . . a4 . c5 . |" + " . " * 20 + "|" + " . " * 20 + "|" + ". . . . . . . . . . . . . . . . c5 . e5 . |", SPB), iS, gain=0.7, decay=0.994, bright=0.5)
    # --- harmonia: pads suaves, baixo e acordes de vibrafone no tempo forte
    for h, bar, g in ((H_A, iA, 0.4), (H_A, iA2, 0.45), (H_B, iB, 0.45), (H_A, iA3, 0.5), (H_O, iO, 0.4)):
        sg.pads('pad', K.i_pad, h, bar, 48, 72, gain=g, cutoff=1100, a=0.35)
    BASS = 'R . . . . . 5 . . . R . . . . . o . . .'
    for h, bar in ((H_A, iA2), (H_A, iA3)):
        sg.bass('bass', K.i_fmbass, h, bar, BASS, octave=33, gain=0.8, tau=0.28, index=1.8)
    sg.bass('bass', K.i_tri, H_A, iA, 'R - - - - - - - - - - - - - - - - - - -', octave=33, gain=0.7)
    sg.bass('bass', K.i_tri, H_B, iB, 'R - - - - - - - - - - - - - - - - - - -', octave=33, gain=0.7)
    sg.bass('bass', K.i_tri, H_O, iO, 'R - - - - - - - - - - - - - - - - - - -', octave=33, gain=0.7)
    # --- tema (violão + vibrafone)
    def theme(bar, inst, **kw):
        sg.line('lead', inst, T1, bar, **kw)
        sg.line('lead', inst, T2, bar + 4, **kw)
    theme(iA, K.i_pluck, gain=0.85, decay=0.995, bright=0.5)
    theme(iA2, K.i_pluck, gain=0.85, decay=0.995, bright=0.5)
    sg.line('vib', K.i_modal, T1, iA2, gain=0.45, kind='vibes', tilt=1.0, pan=0.4)
    sg.line('vib', K.i_modal, T2, iA2 + 4, gain=0.45, kind='vibes', tilt=1.0, pan=0.4)
    # --- ponte: retrógrado do tema (caixa de música) sobre pedal; a inversão (fit) em vibrafone; canais trocados no pós
    R1 = fit(retro(T1, 4 * SPB), Harmony("Am7 Am7 Am7 Am7", SPB))
    R2 = fit(retro(T2, 4 * SPB), Harmony("Am7 Am7 Am7 Am7", SPB))
    I1 = fit(invert(T1, 9, 'minor', 72), Harmony("Am7 Am7 Am7 Am7", SPB))
    I2 = fit(invert(T2, 9, 'minor', 72), Harmony("Am7 Am7 Am7 Am7", SPB))
    sg.line('box', K.i_modal, R1, iB, gain=0.8, kind='box', tilt=1.5, pan=0.4)
    sg.line('box', K.i_modal, R2, iB + 4, gain=0.8, kind='box', tilt=1.5, pan=0.4)
    sg.line('vib', K.i_modal, I1, iB, gain=0.6, kind='vibes', tilt=1.4, pan=-0.4)
    sg.line('vib', K.i_modal, I2, iB + 4, gain=0.6, kind='vibes', tilt=1.4, pan=-0.4)
    # --- final: o tema e o espelho ao mesmo tempo, um em cada lado
    theme(iA3, K.i_pluck, gain=0.8, decay=0.995, bright=0.5, pan=0.35)
    sg.line('vib', K.i_modal, mir(T1, Harmony("Am7 Dm7 G7 Cmaj7", SPB)), iA3, gain=0.6, kind='vibes', tilt=1.2, pan=-0.35)
    sg.line('vib', K.i_modal, mir(T2, Harmony("F Bm7b5 E7 Am", SPB)), iA3 + 4, gain=0.6, kind='vibes', tilt=1.2, pan=-0.35)
    sg.line('lead', K.i_fmep, shift(T1, 0, 12, 0.6), iA3, gain=0.3, tau=0.6, pan=0.1)
    sg.line('lead', K.i_fmep, shift(T2, 0, 12, 0.6), iA3 + 4, gain=0.3, tau=0.6, pan=0.1)
    sg.line('lead', K.i_modal, parse("a4 - - - - - - - - - - - - - - - - - - - |" * 4, SPB), iO, gain=0.6, kind='bell', tilt=2.0)
    # --- percussão em 3+2
    kit = K.kit_soft
    D_A = {'k': 'x...........x.......', 's': '........x.......x...', 'h': 'x.x.x.x.x.x.x.x.x.x.', 'w': '..x.......x.........'}
    D_B = {'k': 'x...........x...x...', 's': '........x.......x..x', 'h': 'x.x.x.x.x.x.x.x.x.x.', 'w': '..x.......x.....x...', 'c': 'X...................'}
    sg.drums(kit, iA, 8, {'k': D_A['k'], 'w': D_A['w']}, gain=0.5)
    sg.drums(kit, iA2, 8, D_A, gain=0.75)
    sg.drums(kit, iB, 8, {'k': 'x...................', 'h': 'x...x...x...x...x...', 'w': '..x.......x.........'}, gain=0.55)
    sg.drums(kit, iA3, 8, D_B, gain=0.85)
    sg.drums(kit, iO, 4, {'w': 'x.......x...........'}, gain=0.5)
    # traços de lápis nas viradas e borracha na saída
    for bar in (iA - 1, iA2 - 1, iB - 1, iA3 - 1):
        pencil(sg, bar, 8, 1.1, 800, 6500, 0.45, pan=0.0, rise=True)
    pencil(sg, iB + 3, 10, 1.0, 5200, 900, 0.4, pan=-0.4, rise=False)
    erase(sg, iO, 0, 6.0, 0.4)
    erase(sg, iO + 2, 6, 4.0, 0.35)
    sg.sample('fx', S.crash(rng, None, 1.4) * 0.4, iA3 * SPB, 0.4)
    sg.duck(['pad'], 0.25, 0.2)
    loader_in_gap(sg, T1, 39, 2, gain=0.25, pan=0.0, pilot_s=0.2)
    # o controle inverte: na ponte os lados trocam
    def swap_lr(mix, song):
        a = int(song.t_step(iB * SPB) * SR)
        b = int(song.t_step((iB + 8) * SPB) * SR)
        y = mix.copy()
        y[0, a:b], y[1, a:b] = mix[1, a:b], mix[0, a:b]
        return y
    sg.post.append(swap_lr)
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(15), wow=0.0012, flutter=0.0008))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(16), drive=1.3, lp_hz=11000, hiss_level=0.0025, crackle=0.012))
    fx = {
        'lead': [Reverb(room_size=0.35, wet_level=0.18, dry_level=0.9)],
        'vib': [Reverb(room_size=0.45, wet_level=0.2, dry_level=0.88)],
        'box': [Reverb(room_size=0.55, wet_level=0.25, dry_level=0.85)],
        'pencil': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.3, depth=0.2, mix=0.3), Reverb(room_size=0.65, wet_level=0.3, dry_level=0.75)],
        'wood': [Reverb(room_size=0.2, wet_level=0.12, dry_level=0.92)],
    }
    sg.sends = {'lead': {'echo': 0.18, 'verb': 0.12}, 'vib': {'echo': 0.15}, 'box': {'echo': 0.2}}
    return sg, fx, aux_default(112, room=0.55, delay_fb=0.35, delay_beats=0.75)
