"""Neon Runner — synthwave / outrun, 116 bpm, ré menor. Baixo de 16 pulsando oitavas, arpejos de serra, supersaw no refrão, caixa com reverb
'gated' (o rabo é cortado seco), pratos ao contrário, tons de fill e a fita de VHS balançando por cima de tudo.
Forma (48 compassos, ~1:39): intro 4 · A 8 · B 8 · quebra 4 · A' 8 · B' 8 · saída 8 (some em eco)."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import kits2 as K2
import inst2 as I2
from songs.common import aux_default

A_L = parse("""
a4! - - a4 . d5 - e5 f5 - - e5 d5 - - . |
d5! - - d5 . f5 - g5 a5 - - g5 f5 - - . |
c5! - - c5 . f5 - a5 c6 - - a5 f5 - - . |
g5! - - e5 . g5 - c6 b5 - a5 - g5 - - . |
a5! - - a5 . f5 - d5 f5 - a5 - d6 - - . |
d6! - - d6 . c6 - bb5 a5 - g5 - f5 - - . |
g5! - - bb5 . d6 - bb5 g5 - - . a5 - bb5 - |
a5! - - e5 . g5 - a5 c#6 - - . e6 - - - |
""")
B_L = parse("""
d6! - - - f6 - - - d6 - - - bb5 - - . |
c6! - - - f6 - - - a5 - - - c6 - - . |
e6! - - - g6 - - - e6 - - - c6 - - . |
d6! - - - a5 - - - d6 - - - f6 - e6 d6 |
d6! - - - f6 - - - bb6 - - - a6 - f6 - |
a6! - - - f6 - - - c6 - - - a5 - c6 - |
bb5! - - d6 - - g6 - - d6 - - bb5 - - . |
a5! . c#6 . e6 . a6 - - - g6 f6 e6 - - - |
""")
# contracanto do 2º refrão (uma oitava abaixo, em terças) e saída
C_L = parse("""
f5 - - - a5 - - - f5 - - - d5 - - . |
a5 - - - c6 - - - a5 - - - f5 - - . |
g5 - - - c6 - - - g5 - - - e5 - - . |
f5 - - - d5 - - - f5 - - - a5 - g5 f5 |
""")
OUT_L = parse("""
d5 - - - f5 - - - a5 - - - d6 - - - |
bb4 - - - d5 - - - f5 - - - bb5 - - - |
c5 - - - e5 - - - g5 - - - c6 - - - |
d6 - - - - - - - - - - - - - - - |
""")

H_A = Harmony("Dm Bb F C Dm Bb Gm A")
H_B = Harmony("Bb F C Dm Bb F Gm A")
H_I = Harmony("Dm Bb Dm Bb")
H_BR = Harmony("Bb Bb A A")
H_O = Harmony("Dm Bb F C")


def rev_crash(sg, bar, gain=0.5):
    """Prato ao contrário que termina exatamente no tempo 1 do compasso `bar`."""
    y = S.reverse(S.crash(sg.rng, int(1.8 * SR), 0.6))
    t0 = sg.t_step(bar * sg.spb) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def build():
    sg = K.Song(116, 48, spb=16, tail=3.5, seed=23, name='neon2')
    rng = sg.rng
    iI, iA, iB, iBR, iA2, iB2, iO = 0, 4, 12, 20, 24, 32, 40
    # ---- baixo (16 pulsando com oitavas) e pads
    BASS_A = 'R . R o R . R o R . R o R . R o'
    BASS_B = 'R R o R R R o R R R o R R o R o'
    for h, bar, pat, g in ((H_A, iA, BASS_A, 0.95), (H_B, iB, BASS_B, 1.0), (H_A, iA2, BASS_A, 0.95), (H_B, iB2, BASS_B, 1.0)):
        sg.bass('bass', I2.i_sub, h, bar, pat, octave=33, gain=g, drive=1.2)
        sg.bass('bass2', I2.i_sawpluck, h, bar, pat, octave=45, gain=g * 0.28, cutoff=1500, tau=0.07)
    sg.bass('bass', I2.i_sub, H_I, iI, 'R - - - - - - - R - - - - - - -', octave=33, gain=0.8)
    sg.bass('bass', I2.i_sub, H_BR, iBR, 'R - - - - - - - - - - - - - - -', octave=33, gain=0.85)
    sg.bass('bass', I2.i_sub, H_O, iO, 'R - - - - - - - - - - - - - - -', octave=33, gain=0.8)
    for h, bar, g in ((H_I, iI, 0.5), (H_A, iA, 0.45), (H_B, iB, 0.55), (H_BR, iBR, 0.6), (H_A, iA2, 0.45), (H_B, iB2, 0.55), (H_O, iO, 0.5)):
        sg.pads('pad', K.i_pad, h, bar, 50, 74, gain=g, cutoff=1700, a=0.5, r=0.9)
    # ---- arpejos de serra (16 em 16) e o 'respiro' da intro
    ARP = '0 2 1 2 0 2 1 2 0 2 1 2 0 2 3 2'
    for h, bar, g in ((H_I, iI, 0.5), (H_A, iA, 0.4), (H_B, iB, 0.45), (H_A, iA2, 0.42), (H_B, iB2, 0.5)):
        sg.arp('arp', I2.i_sawpluck, h, bar, ARP, lo=57, gain=g, pan=0.35, cutoff=3000, tau=0.12)
    sg.arp('arp', K.i_fmep, H_BR, iBR, '0 . . . 1 . . . 2 . . . 3 . . .', lo=65, gain=0.5, tau=0.9)
    # ---- melodias
    sg.line('lead', K.i_super, A_L, iA, gain=0.7, cutoff=3800, spread=0.009)
    sg.line('lead', K.i_super, A_L, iA2, gain=0.7, cutoff=4200, spread=0.01)
    sg.line('lead2', K.i_fmep, shift(A_L, 0, 12, 0.55), iA2, gain=0.22, tau=0.5, pan=-0.4)
    sg.line('lead', K.i_super, B_L, iB, gain=0.85, cutoff=5200, spread=0.014, a=0.012, s=0.8)
    sg.line('lead', K.i_super, B_L, iB2, gain=0.85, cutoff=5600, spread=0.016, a=0.012, s=0.8)
    sg.line('lead2', K.i_super, shift(B_L, 0, -12, 0.55), iB2, gain=0.3, cutoff=3000, spread=0.01, pan=0.3)
    sg.line('lead2', K.i_super, C_L, iB2, gain=0.35, cutoff=3600, spread=0.01, pan=-0.35)
    sg.line('lead', K.i_super, OUT_L, iO, gain=0.7, cutoff=3500, spread=0.01, a=0.03, r=0.3)
    # ---- bateria
    kit = K2.kit_wave
    D_A = {'k': 'x.....x.x.......', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '.......x.......x'}
    D_B = {'k': 'x..x..x.x..x..x.', 's': '....x.......x...', 'p': '....x.......x...', 'h': 'xxxxxxxxxxxxxxxx', 'o': '..x...x...x...x.', 'c': 'X...............'}
    D_I = {'h': 'x.x.x.x.x.x.x.x.', 'k': 'x...............'}
    sg.drums(kit, iI, 4, D_I, gain=0.8)
    sg.drums(kit, iA, 8, D_A, gain=1.0)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iA2, 8, D_A, gain=1.0)
    sg.drums(kit, iB2, 8, D_B, gain=1.0)
    sg.drums(kit, iO, 4, {'k': 'x.......x.......', 's': '........x.......', 'h': 'x.x.x.x.x.x.x.x.'}, gain=0.8)
    # fills de tom ao fim das seções (t1 t2 t3 descendo)
    for bar in (iB - 1, iBR + 3, iB2 - 1, iO - 1):
        sg.drums(kit, bar, 1, {'t1': '............x...', 't2': '..............x.', 't3': '...............x', 's': '............x.x.'}, gain=0.9)
    # ---- efeitos: pratos ao contrário, riser na quebra, crash
    for bar in (iB, iBR, iA2, iB2, iO):
        rev_crash(sg, bar)
    sg.sample('fx', S.riser(rng, int(4 * 16 * sg.step_s * SR), 300, 9000, 0.2, 220), iBR * 16, 0.55)
    for bar in (iB, iB2):
        sg.sample('fx', S.crash(rng) * 0.6, bar * 16, 0.5)
    # quebra: o baixo some e a caixa fica só no tempo 3
    sg.duck(['pad', 'arp', 'bass2'], 0.45, 0.13)
    sg.trim = {'bass': -9.0, 'bass2': 12.0, 'pad': 8.0, 'arp': 9.0, 'lead': 12.5, 'lead2': 12.0, 'drums': -1.0}
    # VHS: balanço lento, agudos cortados e chiado
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(5), wow=0.0016, flutter=0.0005, wow_hz=0.3))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(6), drive=1.25, lp_hz=10500, hiss_level=0.0035))
    fx = {
        'lead': [Chorus(rate_hz=0.4, depth=0.18, mix=0.3), Reverb(room_size=0.35, wet_level=0.18, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.4, wet_level=0.2, dry_level=0.85)],
        'arp': [Chorus(rate_hz=0.6, depth=0.2, mix=0.3)],
        'pad': [Chorus(rate_hz=0.25, depth=0.3, mix=0.45), Reverb(room_size=0.8, wet_level=0.3, dry_level=0.8)],
        'bass': [LowpassFilter(1400)],
        'bass2': [LowpassFilter(2600)],
        'drums': [Compressor(threshold_db=-18, ratio=2.2, attack_ms=12, release_ms=90)],
    }
    sg.sends = {'lead': {'echo': 0.25}, 'lead2': {'echo': 0.2}, 'fx': {'verb': 0.3}, 'arp': {'echo': 0.1}}
    return sg, fx, aux_default(116, room=0.55, delay_fb=0.38, delay_beats=0.75)
