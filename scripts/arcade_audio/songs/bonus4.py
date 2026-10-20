"""Chuva de Fitas — hyperpop / future bass, 152 bpm, lá maior. Vocal chops de formantes (voz de esquilo), supersaws com acordes 'rasgados'
(o tom sobe de baixo para a nota), wub de reese, kick com sidechain e uma chuva de vidro descendo a cada entrada de seção.
Forma (40 compassos, ~1:03): intro 4 · verso (chops) 8 · subida 4 · DROP 8 · quebra de piano 4 · subida 4 · DROP' 8 (com coro e oitavas)."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import inst2 as I2
import inst_b as IB
import kits_b as KB
from songs.common import aux_default

# ---- verso: o gancho de voz (2 frases, a segunda mais alta)
V_L = parse("""
c#5! . . c#5 . e5 . . c#5 . a4 . . c#5 . . |
d5! . . d5 . f#5 . . e5 . d5 . . b4 . . |
a4! . . a4 . c#5 . . e5 - - - . . e5 . |
e5! . . d5 . c#5 . . b4 - - - . . . . |
c#5! . . c#5 . e5 . . a5 - - . g#5 . e5 . |
d5! . . d5 . f#5 . . a5 - - . f#5 . d5 . |
c#5! . e5 . a5 . . . g#5 . e5 . c#5 . a4 . |
b4! . . . e5 - - - . . . . . . . . |
""")
# ---- drop: refrão brilhante
D_L = parse("""
e6! . . c#6 . a5 . . c#6 . e6 . . a5 . . |
b5! . . g#5 . e5 . . g#5 . b5 . . e6 - - |
c#6! . . a5 . f#5 . . a5 . c#6 . . f#6 - - |
f#6! . e6 . d6 . . . a5 - - - f#5 . a5 . |
e6! . . c#6 . a5 . . c#6 . e6 . . a6 - - |
g#6! . . e6 . c#6 . . e6 . g#6 . . b6 - - |
a6! . f#6 . d6 . . . f#6 - - . e6 . d6 . |
e6! . . . b5 . . . g#5 . . . e5 - - - |
""")
# ---- quebra de piano (meia-nota)
B_L = parse("""
f#5 - - - a5 - - - d6 - - - a5 - - - |
g#5 - - - b5 - - - e6 - - - b5 - - - |
e5 - - - g#5 - - - c#6 - - - b5 - - - |
a5 - - - c#6 - - - f#6 - - - e6 - c#6 - |
""")
# ---- escadinha de voz que sobe (subida 1)
U_L = parse("""
a4 - - . a4 - - . a4 - - . c#5 - - . |
c#5 - . . c#5 - . . e5 - . . e5 - . . |
e5 . f#5 . e5 . f#5 . g#5 . a5 . g#5 . a5 . |
b5 . b5 . b5 . b5 . b5 b5 b5 b5 . . . . |
""")
U2_L = parse("""
c#5 - - . c#5 - - . e5 - - . e5 - - . |
e5 - . . f#5 - . . a5 - . . a5 - . . |
a5 . b5 . a5 . b5 . c#6 . d6 . c#6 . d6 . |
e6 . e6 . e6 . e6 . e6 e6 e6 e6 . . . . |
""")

H_I = Harmony("A E F#m D")
H_V = Harmony("F#m D A E F#m D A E")
H_U1 = Harmony("D D E E")
H_D = Harmony("A E F#m D A C#m D E")
H_B = Harmony("D E C#m F#m")
H_U2 = Harmony("D E F#m E")
PENT = [93, 95, 97, 100, 102, 105]   # A6 B6 C#7 E7 F#7 A7 (pentatônica de lá)


def rain(sg, bar, step=0, gain=0.5, n=12, start=105):
    """A chuva de fitas douradas: vidro descendo pela pentatônica em passos de meio sub-passo."""
    pent = [0, -2, -4, -7, -9, -12]   # A B C# E F# A (descendo)
    for k in range(n):
        m = start + pent[k % 6] - 12 * (k // 6)
        sg.sample('rain', I2.i_chime(sg, m, 0.1, tilt=0.45), bar * sg.spb + step, gain * (1 - 0.04 * k),
                  pan=(-0.7 + 1.4 * ((k * 5) % 7) / 6), offset_s=k * 0.5 * sg.step_s)


def rev_crash(sg, bar, gain=0.5, length=1.9):
    y = S.reverse(S.crash(sg.rng, int(length * SR), 0.7))
    t0 = sg.t_step(bar * sg.spb) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def stabs(sg, harm, bar0, steps, lo, hi, gain, ln=2, **kw):
    prev = None
    for bi, ev in enumerate(harm.bars):
        pc, q = ev[0][2], ev[0][3]
        v = K.voice(prev, pc, q, lo, hi, 4)
        prev = v
        for st in steps:
            for k, m in enumerate(v):
                sg.note('stab', IB.i_hsaw, (bar0 + bi) * sg.spb + st, m, ln, gain=gain / len(v) ** 0.5, pan=-0.35 + 0.23 * k, **kw)


def build():
    sg = K.Song(152, 40, spb=16, tail=3.5, seed=88, name='bonus4')
    rng = sg.rng
    iI, iV, iU1, iD, iB, iU2, iD2 = 0, 4, 12, 16, 24, 28, 32
    SIX = int(4 * 16 * sg.step_s * SR)
    # ---- acordes: sustentados (com sidechain) e 'rasgados' em 3-3-2
    for h, bar, g in ((H_I, iI, 0.5), (H_V, iV, 0.45), (H_B, iB, 0.4)):
        sg.pads('chord', IB.i_hsaw, h, bar, 55, 80, gain=g, cutoff=2600, spread=0.012, a=0.05, s=0.85, r=0.25, open_t=1.2)
    for h, bar, g in ((H_D, iD, 0.55), (H_D, iD2, 0.6)):
        sg.pads('chord', IB.i_hsaw, h, bar, 52, 76, gain=g, cutoff=6500, spread=0.02, a=0.01, s=0.9, r=0.2)
    STEPS = (0, 3, 6, 8, 11, 14)
    stabs(sg, H_D, iD, STEPS, 60, 84, 0.7, cutoff=8000, spread=0.024, bend=-2.5, d=0.1, s=0.5)
    stabs(sg, H_D, iD2, STEPS, 60, 84, 0.75, cutoff=9000, spread=0.026, bend=-3.0, d=0.1, s=0.5, drive=1.2)
    # subidas: acordes que abrem o filtro
    for h, bar in ((H_U1, iU1), (H_U2, iU2)):
        sg.pads('chord', IB.i_hsaw, h, bar, 55, 80, gain=0.55, cutoff=9000, spread=0.02, a=0.2, s=0.9, r=0.2, open_t=3.5)
    # ---- baixo: sub + wub nos drops
    SUB_V = 'R - - - - - . . R - - . R - . .'
    SUB_D = 'R - - - - - - . R - - . R - r .'
    for h, bar, pat, g in ((H_V, iV, SUB_V, 0.85), (H_D, iD, SUB_D, 1.0), (H_D, iD2, SUB_D, 1.0)):
        sg.bass('bass', I2.i_sub, h, bar, pat, octave=33, gain=g, drive=0.8)
    for h, bar, g in ((H_D, iD, 0.6), (H_D, iD2, 0.7)):
        sg.bass('wub', I2.i_reese, h, bar, SUB_D, octave=45, gain=g, cutoff=1100, wob_hz=152 / 60 * 2, det=0.014)
    sg.bass('bass', I2.i_sub, H_I, iI, 'R - - - - - - - - - - - - - - -', octave=33, gain=0.6)
    sg.bass('bass', I2.i_sub, H_U1, iU1, 'R - - - - - - - R - - - - - - -', octave=33, gain=0.8)
    sg.bass('bass', I2.i_sub, H_U2, iU2, 'R - - - - - - - R - - - - - - -', octave=33, gain=0.8)
    # ---- vocal chops
    sg.line('vox', IB.i_vox, shift(V_L[:12], 0, 12, 0.6), iI, gain=0.35, shift=1.25, scoop=2.0)   # a intro só insinua
    sg.line('vox', IB.i_vox, V_L, iV, gain=0.75, shift=1.3, scoop=2.0)
    sg.line('vox', IB.i_vox, U_L, iU1, gain=0.8, shift=1.35, scoop=3.0)
    sg.line('vox', IB.i_vox, U2_L, iU2, gain=0.8, shift=1.4, scoop=3.0)
    # eco de oitava no verso 2 (segunda frase)
    sg.line('vox2', IB.i_vox, shift(V_L[len(V_L) // 2:], 0, 12, 0.5), iV + 4, gain=0.3, shift=1.3, scoop=2.0, pan=0.4)
    # ---- leads
    sg.line('lead', IB.i_hsaw, D_L, iD, gain=0.8, cutoff=9500, spread=0.016, voices=5, a=0.006, s=0.85, r=0.12)
    sg.line('lead', IB.i_hsaw, D_L, iD2, gain=0.8, cutoff=10000, spread=0.018, voices=5, a=0.006, s=0.85, r=0.12, drive=0.8)
    sg.line('lead2', IB.i_hsaw, shift(D_L, 0, 12, 0.55), iD2, gain=0.4, cutoff=9000, spread=0.014, voices=3, pan=0.3)
    sg.line('vox2', IB.i_vox, shift(D_L, 0, 0, 0.5), iD2, gain=0.5, shift=1.25, vib=0.004, pan=-0.3, a=0.02)
    # quebra: piano seco + vidro
    sg.line('piano', IB.i_piano, B_L, iB, gain=0.85, tau=0.9)
    sg.line('piano', IB.i_piano, shift(B_L, 0, -12, 0.5), iB, gain=0.55, tau=0.9)
    sg.line('lead2', K.i_modal, shift(B_L, 0, 24, 0.4), iB, gain=0.25, kind='glass', tilt=1.2, pan=0.4)
    for (st, ln, pc, q) in H_B.events():
        v = K.voice(None, pc, q, 58, 72, 3)
        for k, m in enumerate(v):
            sg.note('vox2', IB.i_vox, iB * 16 + st, m, ln, gain=0.3, vowel='u' if k % 2 == 0 else 'o', shift=1.1, a=0.2, r=0.5, vib=0.005, pan=-0.4 + 0.4 * k)
    # ---- bateria
    kit = KB.kit_hyper
    D_I = {'h': 'x.x.x.x.x.x.x.x.'}
    D_V = {'k': 'x.....x...x.....', 's': '........x.......', 'h': 'x.xxx.xxx.xxx.xx', 'o': '......x.......x.', 'g': '.o..o.o...o..o.o'}
    D_U = {'k': 'x...x...x...x...', 'h': 'x.x.x.x.x.x.x.x.'}
    D_D = {'k': 'x......x..x.....', 's': '........x.......', 'p': '........x.......', 'h': 'xxxxxxxxxxxxxxxx', 'o': '..o...o...o...o.', 'g': 'o...o..o..o...o.', 'c': 'X...............'}
    sg.drums(kit, iI, 4, D_I, gain=0.5)
    sg.drums(kit, iV, 8, D_V, gain=0.9)
    sg.drums(kit, iU1, 4, D_U, gain=0.85)
    # rufos de caixa
    for bar0 in (iU1, iU2):
        for b, pat in enumerate(('x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx')):
            sg.drums(kit, bar0 + b, 1, {'z': pat}, gain=0.55 + 0.12 * b)
            if b == 3:   # 32avos no último compasso
                for st in range(12):
                    sg.sample('drums', kit('z', rng, 0.7), (bar0 + b) * 16 + st, gain=0.8, offset_s=0.5 * sg.step_s)
    sg.drums(kit, iD, 8, D_D, gain=1.0)
    sg.drums(kit, iB, 4, {'h': 'x.x.x.x.x.x.x.x.', 'g': '.o.o.o.o.o.o.o.o'}, gain=0.4)
    sg.drums(kit, iU2, 4, D_U, gain=0.85)
    sg.drums(kit, iD2, 8, D_D, gain=1.05)
    # viradas
    sg.drums(kit, iV - 1, 1, {'z': '............xxxx', 'k': 'x...............'}, gain=0.7)
    sg.drums(kit, iB - 1, 1, {'t1': '............x...', 't2': '..............x.', 't3': '...............x', 'z': 'x.x.x.x.x.x.....'}, gain=0.7)
    sg.drums(kit, iD2 + 7, 1, {'t1': '............x...', 't2': '..............x.', 't3': '...............x'}, gain=0.8)
    # ---- efeitos: chuva de vidro nas entradas, risers, impactos e pratos ao contrário
    for bar, g in ((iI, 0.55), (iV, 0.4), (iD, 0.6), (iB, 0.45), (iD2, 0.65)):
        rain(sg, bar, 0, g)
    rain(sg, iD2 + 4, 0, 0.35, n=12, start=100)
    for bar in (iU1, iU2):
        sg.sample('fx', S.riser(rng, SIX, 250, 9500, 0.3, 300), bar * 16, 0.75)
    for bar in (iV, iU1, iD, iB, iU2, iD2, 40):
        rev_crash(sg, bar, 0.45)
    for bar in (iD, iD2):   # impacto do drop: sub que despenca
        n = int(0.9 * SR)
        boom = np.sin(2 * np.pi * np.cumsum(S.sweep(180, 38, n)) / SR) * S.env_exp(n, 0.28)
        sg.sample('fx', boom, bar * 16, 0.9)
        sg.sample('fx', S.crash(rng, None, 1.4) * 0.8, bar * 16, 0.5)
    # purpurina: fitinhas ao acaso na pentatônica
    for bar0, bars, dens in ((iI, 4, 0.05), (iV, 8, 0.07), (iD, 8, 0.1), (iB, 4, 0.1), (iD2, 8, 0.12)):
        for st in range(bar0 * 16, (bar0 + bars) * 16):
            if rng.random() < dens:
                sg.note('rain', I2.i_chime, st, int(rng.choice(PENT)), 1, gain=float(rng.uniform(0.25, 0.5)), pan=float(rng.uniform(-0.9, 0.9)), tilt=0.4)
    sg.duck(['chord', 'stab', 'wub', 'vox2'], 0.62, 0.17)
    sg.trim = {'chord': 8.0, 'stab': 9.0, 'bass': -7.5, 'wub': 5.0, 'vox': 14.0, 'vox2': 14.0, 'lead': 12.0, 'lead2': 12.0, 'piano': 6.0, 'rain': 0.0, 'drums': -0.5, 'fx': -5.0}
    fx = {
        'chord': [Chorus(rate_hz=0.5, depth=0.25, mix=0.3), Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'stab': [HighpassFilter(180), Reverb(room_size=0.35, wet_level=0.12, dry_level=0.9)],
        'bass': [LowpassFilter(300)],
        'wub': [HighpassFilter(90), LowpassFilter(2800)],
        'vox': [Reverb(room_size=0.4, wet_level=0.2, dry_level=0.85)],
        'vox2': [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.7)],
        'lead': [Chorus(rate_hz=0.4, depth=0.2, mix=0.25), Reverb(room_size=0.4, wet_level=0.15, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'piano': [Reverb(room_size=0.6, wet_level=0.25, dry_level=0.8)],
        'rain': [Reverb(room_size=0.8, wet_level=0.35, dry_level=0.7)],
        'drums': [Compressor(threshold_db=-18, ratio=2.4, attack_ms=8, release_ms=80)],
    }
    sg.sends = {'vox': {'echo': 0.3}, 'vox2': {'echo': 0.2}, 'lead': {'echo': 0.18}, 'rain': {'verb': 0.15}, 'fx': {'verb': 0.25}, 'piano': {'echo': 0.15}}
    return sg, fx, aux_default(152, room=0.55, delay_fb=0.35, delay_beats=0.75)
