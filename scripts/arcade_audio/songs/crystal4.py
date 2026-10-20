"""Cacos de Vidro — glitch / IDM, 108 bpm, sol sustenido menor. A bateria nunca repete duas vezes seguidas (bumbo em 3+3+4+3+3, caixa esmagada,
rolos de hats em fusas, cliques e bips), bips de pulso em ciclo de 3 passos contra o compasso de 16, voz de vidro fatiada por portas rítmicas, sub
de seno irregular e um tema de sinos digitais (motivo, resposta, queda). Na quebra o som trava (stutter) e é esmagado (bitcrush).
Forma (32 compassos, ~1:11): intro 4 · A 8 · B 8 · quebra 4 · A' 8."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor, Bitcrush
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst_c as IC
from songs.common import aux_default

# ---- tema de sinos (sol# menor): motivo 3+3+2+3+3+2, resposta ascendente, volta e queda
HOOK = parse("""
g#5 . . d#6 . . c#6 . b5 . . g#5 . . f#5 . |
g#5 . . b5 . . d#6 . f#6 . . e6 . . d#6 . |
c#6 . . b5 . . g#5 . e5 . . g#5 . . b5 . |
d#6 . . . . . b5 . . . g#5 . . . . . |
""")
# ---- variação do refrão (uma oitava acima, notas mais longas)
HOOK_B = parse("""
g#6 - - - . . f#6 - e6 - - d#6 - - b5 - |
c#6 - - e6 - - g#6 - . . b6 - - g#6 - . |
f#6 - - e6 - - d#6 - b5 - - d#6 - - e6 - |
d#6 - - - - - b5 - - - g#5 - - - . . |
""")
# ---- vozes de vidro: notas longas (fatiadas pelas portas)
H_I = Harmony("G#m7 G#m7 Emaj7 Emaj7")
H_A = Harmony("G#m7 Emaj7 G#m7 Emaj7 C#m7 F#7 G#m7 D#m7")
H_B = Harmony("Emaj7 B F#7 G#m7 Emaj7 B C#m7 D#m7")
H_K = Harmony("C#m7 C#m7 D#m7 D#m7")

BP1 = 'R - - . R . . r - . . 5 . . R -'
BP2 = 'R - . . . R . - . r . . 5 - . .'
BP3 = 'R . . R - . . . o . r . . 5 - .'

K1 = 'x..x..x...x..x..'
K2 = 'x..x....x..x.x..'
K3 = 'x.....x..x..x..x'
K4 = 'x..x..x.x.....x.'
S1 = '....x.......x...'
S2 = '....x....o..x..o'
H1 = '..x..x..x.x..x.x'
H2 = 'x.x..x.xx..x.x..'
C1 = 'x.xx...x.x..x...'
C2 = '.x..x.x...x.x.x.'
Q1 = '.......x.....x..'
G1 = '.o..o..o.o..o.o.'


def roll(sg, kit, bar, step, n, ins='h', v=0.6, spacing=0.5, ramp=True, gain=0.9):
    """Rolo em fusas: `n` golpes colados a partir de `step`, com crescendo."""
    for k in range(n):
        vv = v * (0.5 + 0.5 * k / max(1, n - 1)) if ramp else v
        sg.sample('drums', kit(ins, sg.rng, vv), bar * 16 + step, gain=gain, offset_s=k * sg.step_s * spacing)


def bell_cycle(sg, bars0, nbars, notes, every=3, gain=0.4, pan=0.3, bits=5, tilt=0.5):
    """Bips/sinos em ciclo de `len(notes)` notas a cada `every` passos: o ciclo não coincide com o compasso (polimetria)."""
    a, b = bars0 * 16, (bars0 + nbars) * 16
    i = 0
    st = a
    while st < b:
        sg.note('blip', IC.i_blip, st, notes[i % len(notes)], 1, gain=gain, pan=pan if i % 2 else -pan, bits=bits, hold=2, vel=0.55 + 0.35 * (i % 3 == 0))
        st += every
        i += 1


def build():
    sg = K.Song(108, 32, spb=16, tail=4.0, seed=868, name='crystal4')
    rng = sg.rng
    iI, iA, iB, iK, iA2 = 0, 4, 12, 20, 24
    kit = IC.kit_glitch

    # ---- sub irregular
    for h, bar, pat in ((H_I, iI + 2, BP1), (H_A, iA, BP1), (H_B, iB, BP2), (H_A, iA2, BP3)):
        if h is H_I:
            sg.bass('sub', IC.i_gsub, Harmony("Emaj7 Emaj7"), bar, BP1, octave=32, gain=0.8)
        else:
            sg.bass('sub', IC.i_gsub, h, bar, pat, octave=32, gain=0.95)
    sg.bass('sub', IC.i_gsub, H_K, iK, 'R - - - - - - - - - - - - - - -', octave=32, gain=0.8)

    # ---- tema de sinos digitais
    for bar in (iA, iA + 4):
        sg.line('lead', IC.i_bellg, HOOK, bar, gain=0.9, tilt=0.6, bits=0)
    sg.line('lead', IC.i_bellg, HOOK_B, iB, gain=0.9, tilt=0.8)
    sg.line('lead', IC.i_bellg, HOOK_B, iB + 4, gain=0.95, tilt=0.8, bits=6, hold=2)
    sg.line('lead2', IC.i_bellg, shift(HOOK, 0, -12, 0.6), iB, gain=0.4, tilt=0.5, pan=-0.35)
    sg.line('lead', IC.i_bellg, HOOK, iA2, gain=0.9, tilt=0.6)
    sg.line('lead2', IC.i_bellg, shift(HOOK, 0, 12, 0.6), iA2, gain=0.45, tilt=0.5, pan=0.35, bits=5)
    sg.line('lead', IC.i_bellg, HOOK_B, iA2 + 4, gain=0.95, tilt=0.8)
    sg.line('lead2', IC.i_bellg, shift(HOOK, 0, 12, 0.6), iA2 + 4, gain=0.45, tilt=0.5, pan=0.35, bits=5)
    # fragmento do tema na intro (só o início, com bits esmagados) e na quebra (só o fim, ecoando)
    sg.line('lead', IC.i_bellg, HOOK[:6], iI + 2, gain=0.55, tilt=0.5, bits=4, hold=4)
    sg.line('lead', IC.i_bellg, HOOK[:6], iI + 3, gain=0.65, tilt=0.5, bits=5, hold=3)
    sg.line('lead', IC.i_bellg, shift(HOOK[-3:], -48), iK + 3, gain=0.9, tilt=1.2)

    # ---- bips em ciclo de 3 passos (polimetria 3 contra 16) e vozes de vidro fatiadas
    bell_cycle(sg, iA, 8, [80, 87, 83, 90, 78, 85, 83], gain=0.35, bits=5)
    bell_cycle(sg, iB, 8, [87, 83, 90, 80, 85, 78, 83, 87, 90], every=3, gain=0.4, bits=4)
    bell_cycle(sg, iA2, 8, [80, 87, 83, 90, 78, 85, 83], gain=0.4, bits=5)
    bell_cycle(sg, iK, 3, [87, 90, 83, 85], every=2, gain=0.3, bits=4)
    GATES = [(1, 1, 0, 1, 0, 1, 1, 0), (1, 0, 1, 1, 0, 0, 1, 1), (1, 1, 1, 0, 1, 0, 0, 1), (0, 1, 1, 0, 1, 1, 0, 1)]
    for h, bar, g in ((H_I, iI, 0.45), (H_A, iA, 0.6), (H_B, iB, 0.8), (H_K, iK, 0.6), (H_A, iA2, 0.7)):
        for rep, (st, ln, pc, q) in enumerate(h.events()):
            v = K.voice(None, pc, q, 56, 78, 4)
            for k, m in enumerate(v):
                sg.note('slice', IC.i_slice, bar * 16 + st, m, ln, gain=g / 2.0, pan=-0.4 + 0.27 * k, gate=GATES[(rep + k) % 4], rate=22.0 if rep % 2 == 0 else 31.0)
    # pad de vidro suave por baixo no B (respiro entre os cacos)
    sg.pads('pad', K.i_modal, H_B, iB, 52, 72, gain=0.35, kind='glass', tilt=4.0)

    # ---- bateria irregular: 4 variações que giram
    VAR = [
        {'k': K1, 's': S1, 'h': H1, 'c': C1, 'q': Q1},
        {'k': K2, 's': S1, 'h': H2, 'c': C2, 'g': G1},
        {'k': K1, 's': S2, 'h': H1, 'c': C2, 'q': Q1},
        {'k': K4, 's': S1, 'h': H2, 'c': C1, 'g': G1},
    ]
    VAR_B = [
        {'k': K3, 's': S1, 'h': H2, 'c': C1, 'g': G1},
        {'k': K4, 's': S2, 'h': H1, 'c': C2, 'q': Q1},
        {'k': K3, 's': S1, 'h': H1, 'c': C1, 'g': G1},
        {'k': K2, 's': S2, 'h': H2, 'c': C2, 'q': Q1},
    ]
    for i in range(4):   # intro: só cliques e hats, bumbo entra no 4º compasso
        d = {'c': C1 if i % 2 == 0 else C2, 'h': H1 if i < 2 else H2}
        if i == 3:
            d['k'] = K1
        sg.drums(kit, iI + i, 1, d, gain=0.7 + 0.1 * i)
    for i in range(8):
        sg.drums(kit, iA + i, 1, VAR[i % 4], gain=1.0)
        sg.drums(kit, iB + i, 1, VAR_B[i % 4], gain=1.0)
        sg.drums(kit, iA2 + i, 1, dict(VAR[(i + 1) % 4], d='x.......x.x.....' if i % 2 else '.......x..x.....'), gain=1.05)
    # quebra: sem bumbo, só cliques, zaps e rufos de caixa esmagada
    for i in range(4):
        sg.drums(kit, iK + i, 1, {'c': C2 if i % 2 else C1, 'z': '...x.......x....' if i % 2 else '.......x....x...', 'g': G1}, gain=0.9)
    roll(sg, kit, iK + 3, 8, 8, 's', 0.7, 0.5)
    roll(sg, kit, iK + 3, 12, 8, 's', 0.9, 0.25)
    # rolos de hat em fusas nas viradas
    for bar, st, n in ((iA + 3, 12, 6), (iA + 7, 14, 4), (iB + 3, 10, 8), (iB + 7, 12, 8), (iA2 + 3, 12, 6), (iA2 + 7, 8, 12)):
        roll(sg, kit, bar, st, n, 'h', 0.7, 0.5)

    # ---- efeitos: pratos ao contrário e subida de ruído para a volta
    def rev(bar, gain=0.4, L=1.6):
        y = S.hp(S.reverse(S.crash(rng, int(L * SR), 0.6)), 4000)
        t0 = sg.t_step(bar * 16) - len(y) / SR
        if t0 >= 0:
            sg.put('fx', y, t0, gain)
    for bar in (iA, iB, iK, iA2):
        rev(bar)
    sg.sample('fx', S.riser(rng, int(4 * 16 * sg.step_s * SR), 500, 9000, 0.1, 400) * 0.5, iK * 16, 0.4)
    sg.duck(['pad', 'slice'], 0.25, 0.14)

    # ---- pós: stutters, esmagamento na quebra, falhas curtas
    def bar_i(b, st=0):
        return int(sg.t_step(b * 16 + st) * SR)

    def glitch(mix, song):
        y = mix
        y = TP.stutter(y, bar_i(iA + 7, 12), int(3 * sg.step_s * SR), 6, 0.8)
        y = TP.stutter(y, bar_i(iB + 7, 12), int(2 * sg.step_s * SR), 8, 0.82)
        y = TP.crush(y, bar_i(iK, 0), bar_i(iK + 2, 0), 6, 3)
        y = TP.stutter(y, bar_i(iK + 3, 4), int(2 * sg.step_s * SR), 7, 0.8)
        y = TP.stutter(y, bar_i(iA2 + 7, 14), int(1 * sg.step_s * SR), 8, 0.8)
        y = TP.dropouts(y, np.random.default_rng(3), count=7, ms=(10, 45), depth=0.9)
        return y
    sg.post.append(glitch)

    sg.trim = {'sub': -5.4, 'lead': 3.1, 'lead2': 10.0, 'blip': 14.0, 'slice': -3.2, 'pad': 6.0, 'drums': 0.0, 'fx': 3.0}
    fx = {
        'lead': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.5, wet_level=0.25, dry_level=0.85)],
        'blip': [Reverb(room_size=0.3, wet_level=0.12, dry_level=0.92)],
        'slice': [Bitcrush(bit_depth=10), Reverb(room_size=0.7, wet_level=0.3, dry_level=0.8)],
        'pad': [Reverb(room_size=0.9, wet_level=0.4, dry_level=0.65)],
        'sub': [LowpassFilter(240)],
        'drums': [Compressor(threshold_db=-18, ratio=2.4, attack_ms=6, release_ms=80)],
    }
    sg.sends = {'lead': {'echo': 0.35}, 'lead2': {'echo': 0.3}, 'blip': {'echo': 0.2}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(108, room=0.6, delay_fb=0.4, delay_beats=0.75)
