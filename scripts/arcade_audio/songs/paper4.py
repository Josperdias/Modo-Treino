"""Papel de Seda — shoegaze / dream pop, 92 bpm, fá# menor. Parede de guitarras (serras desafinadas saturadas, chorus e reverb enorme, alavanca que
afina para baixo no fim das frases), bateria enterrada na névoa, baixo em colcheias, arpejo limpo de piano elétrico com eco e uma voz etérea de
formantes que flutua por cima. Reverso de reverb puxa cada seção. Forma (28 compassos, ~1:13): névoa 4 · verso 8 · REFRÃO 8 · quebra 4 · dissolução 4."""
import numpy as np
from pedalboard import Pedalboard, Reverb, Delay, Chorus, Compressor, LowpassFilter, HighpassFilter
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_e as E
from songs.common import aux_default

H_I = Harmony("F#m9 F#m9 Dmaj9 Dmaj9")
H_A = Harmony("F#m9 Dmaj9 Amaj9 C#m7 F#m9 Dmaj9 Bm7 C#sus4")
H_B = Harmony("Dmaj9 Amaj9 E6 F#m9 Dmaj9 Amaj9 Bm7 C#m7")
H_K = Harmony("F#m9 F#m9 Bm7 C#sus4")
H_O = Harmony("Dmaj9 Amaj9 E6 F#m9")


def dbl(h):
    """Duas batidas por compasso: o acorde de cada compasso é repetido no meio (guitarra reatacada)."""
    return Harmony(' '.join(f'{n}_{n}' for n in _names(h)), 16)


def _names(h):
    NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return [NN[b[0][2]] + b[0][3] for b in h.bars]


M_A = parse("""
. . . . . . . . c#5 - - - e5 - - - |
f#5 - - - - - - - a5 - - - f#5 - - - |
e5 - - - - - - - c#5 - - - e5 - - - |
b4 - - - - - - - c#5 - - - . . . . |
. . . . . . . . a4 - - - c#5 - - - |
d5 - - - f#5 - - - a5 - - - - - - - |
f#5 - - - d5 - - - b4 - - - d5 - - - |
f#5 - - - - - - - e5 - - - c#5 - - - |
""")
M_B = parse("""
a5 - - - - - - - f#5 - - - e5 - - - |
e5 - - - c#5 - - - e5 - - - a5 - - - |
g#5 - - - b5 - - - g#5 - - - e5 - - - |
f#5 - - - - - - - c#5 - - - - - - - |
a5 - - - f#5 - - - d5 - - - f#5 - - - |
e5 - - - a5 - - - c#6 - - - b5 - - - |
d6 - - - c#6 - - - b5 - - - a5 - - - |
g#5 - - - - - - - e5 - - - c#5 - - - |
""")
M_K = parse("""
a5 - - - - - - - c#6 - - - - - - - |
e6 - - - - - - - c#6 - - - - - - - |
d6 - - - - - - - b5 - - - - - - - |
f#5 - - - g#5 - - - f#5 - - - . . . . |
""")


def rev_swell(sg, bar, notes, gain=0.6, length=3.0):
    """Acorde com reverb enorme tocado ao contrário: o brilho cresce até a primeira batida da seção."""
    n = int(length * SR)
    y = np.zeros(n)
    for m in notes:
        y += np.pad(E.i_wall(sg, m, 0.35, vel=0.8, a=0.03, r=0.2, cutoff=3000), (0, n))[:n]
    st = np.stack([y, y]).astype(np.float32)
    wet = Pedalboard([Reverb(room_size=0.95, damping=0.4, wet_level=1.0, dry_level=0.15, width=1.0)])(st, SR)
    sig = S.reverse(wet.mean(axis=0).astype(np.float64))
    t0 = sg.t_step(bar * 16) - len(sig) / SR
    if t0 < 0:
        sig = sig[int(-t0 * SR):]
        t0 = 0.0
    sg.put('swell', sig, t0, gain)


def wash(sg, bar, bars, gain=0.5, lo=500, hi=6500):
    n = int(bars * 16 * sg.step_s * SR)
    x = S.bp(sg.rng.standard_normal(n), lo, hi, 1) * np.linspace(0.05, 1.0, n) ** 2.2 * 0.5
    sg.sample('noise', x, bar * 16, gain)


def build():
    sg = K.Song(92, 28, spb=16, tail=4.5, seed=404, name='paper4')
    rng = sg.rng
    iI, iA, iB, iK, iO = 0, 4, 12, 20, 24
    # ---- parede de guitarras
    sg.pads('wall', E.i_wall, H_I, iI, 47, 70, gain=0.7, n=4, a=1.6, r=1.4, cutoff=1800, bend=-0.6)
    sg.pads('wall', E.i_wall, H_A, iA, 47, 70, gain=0.85, n=4, a=0.5, r=1.2, cutoff=2200, bend=-0.5)
    sg.pads('wall', E.i_wall, dbl(H_B), iB, 47, 72, gain=1.0, n=4, a=0.08, r=1.0, cutoff=2800, bend=-0.35)
    sg.pads('wall', E.i_wall, H_K, iK, 50, 72, gain=0.6, n=4, a=1.0, r=1.4, cutoff=1500, bend=-0.5)
    sg.pads('wall', E.i_wall, H_O, iO, 47, 70, gain=0.8, n=4, a=0.4, r=2.4, cutoff=2000, bend=-0.4, dive=2.0)
    # alavanca: último acorde de cada seção cai de afinação
    for bar, h in ((iA + 7, 'C#sus4'), (iB + 7, 'C#m7')):
        for m in (49, 56, 61, 66):
            sg.note('wall2', E.i_wall, bar * 16 + 8, m, 8, gain=0.5, vel=0.8, a=0.1, r=1.4, cutoff=2200, dive=3.5)
    # brilho: oitava acima, com chorus e reverb
    sg.pads('shim', K.i_pad, H_A, iA, 66, 88, gain=0.5, n=3, cutoff=3200, a=0.9, r=1.2)
    sg.pads('shim', K.i_pad, H_B, iB, 66, 88, gain=0.7, n=3, cutoff=3600, a=0.8, r=1.2)
    sg.pads('shim', K.i_pad, H_K, iK, 66, 88, gain=0.6, n=3, cutoff=3000, a=1.0, r=1.4)
    # ---- arpejo limpo (piano elétrico) com eco
    sg.arp('arp', K.i_fmep, H_A, iA, '0 . 2 . 1 . 3 . 2 . 1 . 4 . 2 .', lo=57, gain=0.6, pan=-0.35, tau=1.3, bright=0.45)
    sg.arp('arp', K.i_fmep, H_B, iB, '0 . 2 . 1 . 3 . 2 . 1 . 4 . 3 .', lo=57, gain=0.5, pan=0.3, tau=1.1, bright=0.5)
    sg.arp('bells', K.i_modal, H_K, iK, '0 . . 1 . . 2 . . 3 . . 2 . 1 .', lo=69, gain=0.7, pan=0.2, kind='glass', tilt=2.0)
    # ---- voz etérea
    sg.line('voice', K.i_choir, M_A, iA, gain=0.8, vowel='u', a=0.25, r=0.8, vel_scale=0.7)
    sg.line('voice', K.i_choir, M_B, iB, gain=0.9, vowel='a', a=0.25, r=0.8, vel_scale=0.8)
    sg.line('voice2', K.i_choir, [(s, m + 12, l, v) for (s, m, l, v) in M_B if s >= 4 * 16], iB, gain=0.4, vowel='o', a=0.3, r=0.8, vel_scale=0.6, pan=0.4)
    sg.line('voice', K.i_choir, M_K, iK, gain=0.85, vowel='o', a=0.4, r=1.0, vel_scale=0.75)
    sg.line('voice', K.i_choir, [(s, m, l, v) for (s, m, l, v) in M_B if s < 4 * 16], iO, gain=0.7, vowel='a', a=0.3, r=1.4, vel_scale=0.65)
    # ---- baixo
    sg.bass('bass', I2.i_sub, H_A, iA, 'R - - - - - - - R - - - - - 5 -', octave=36, gain=0.85, drive=0.8)
    sg.bass('bass', I2.i_sub, H_B, iB, 'R . R . R . R . R . R . R . R .', octave=36, gain=0.8, drive=0.9)
    sg.bass('bass', I2.i_sub, H_K, iK, 'R - - - - - - - - - - - - - - -', octave=36, gain=0.6, drive=0.5)
    sg.bass('bass', I2.i_sub, H_O, iO, 'R - - - - - - - R - - - - - 5 -', octave=36, gain=0.6, drive=0.6)
    # ---- bateria na névoa
    kit = E.kit_fog
    D_A = {'k': 'x.......x.x.....', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}
    D_B = {'k': 'x.....x.x.x.....', 's': '....x.......x...', 'h': 'xoxoxoxoxoxoxoxo', 'o': '..............x.', 'c': 'x...............'}
    sg.drums(kit, iI + 3, 1, {'r': '....x.......x...'}, gain=0.5)
    sg.drums(kit, iA, 8, D_A, gain=0.85)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iK, 3, {'k': 'x...............', 'r': '........x.......'}, gain=0.55)
    sg.drums(kit, iK + 3, 1, {'t3': 'x.......x.......', 't2': '....x.......x...', 's': '............xxxx'}, gain=0.8)
    sg.drums(kit, iO, 2, D_A, gain=0.7)
    sg.drums(kit, iO + 2, 2, {'k': 'x...............', 'h': 'x.......x.......'}, gain=0.5)
    sg.drums(kit, iA, 1, {'c': 'x...............'}, gain=0.6)
    sg.drums(kit, iB, 1, {'c': 'x...............'}, gain=0.8)
    # ---- reversos e lavagens de ruído
    A_CH = [47, 54, 61, 66]
    rev_swell(sg, iA, A_CH, 0.7, 3.5)
    rev_swell(sg, iB, [50, 57, 61, 66], 0.9, 3.0)
    rev_swell(sg, iK, [47, 54, 61, 68], 0.7, 3.0)
    rev_swell(sg, iO, [50, 57, 61, 66], 0.7, 3.0)
    wash(sg, iI, 4, 0.5, 400, 5000)
    wash(sg, iB - 2, 2, 0.5)
    wash(sg, iK + 2, 2, 0.5)
    # sub-grave sustentado na névoa de abertura
    sg.note('bass', I2.i_sub, 0, 42, 32, gain=0.4, vel=0.6, drive=0.3)
    sg.duck(['shim', 'arp'], 0.25, 0.12)
    sg.trim = {'wall': -3.0, 'wall2': 6.0, 'shim': 8.0, 'arp': 0.0, 'bells': 4.0, 'voice': 10.0, 'voice2': 24.0, 'bass': -6.0, 'drums': -3.0, 'swell': -4.0, 'noise': 5.0}
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(9), drive=1.2, lp_hz=11000, hiss_level=0.002))
    big = lambda w, room=0.9: Reverb(room_size=room, damping=0.45, wet_level=w, dry_level=1.0 - w * 0.5, width=1.0)
    fx = {
        'wall': [Chorus(rate_hz=0.4, depth=0.35, mix=0.5), big(0.5, 0.92), Compressor(threshold_db=-16, ratio=2.0, attack_ms=20, release_ms=200)],
        'wall2': [Chorus(rate_hz=0.5, depth=0.4, mix=0.5), big(0.5, 0.92)],
        'shim': [Chorus(rate_hz=0.3, depth=0.4, mix=0.5), big(0.6, 0.95)],
        'arp': [big(0.3, 0.8)],
        'bells': [big(0.4, 0.9)],
        'voice': [Chorus(rate_hz=0.35, depth=0.25, mix=0.3), big(0.55, 0.95)],
        'voice2': [big(0.6, 0.95)],
        'bass': [LowpassFilter(900)],
        'drums': [LowpassFilter(7000), Reverb(room_size=0.85, damping=0.5, wet_level=0.5, dry_level=0.6, width=1.0)],
        'swell': [LowpassFilter(9000)],
        'noise': [HighpassFilter(300)],
    }
    sg.sends = {'arp': {'echo': 0.35}, 'voice': {'echo': 0.25, 'verb': 0.2}, 'bells': {'echo': 0.3}}
    return sg, fx, aux_default(92, room=0.9, delay_fb=0.45, delay_beats=0.75)
