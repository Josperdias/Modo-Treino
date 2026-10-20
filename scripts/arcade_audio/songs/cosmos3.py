"""Hipnose Motorik — krautrock / motorik espacial, 142 bpm, mi bemol dórico. Batida constante (bumbo seco, caixa no 2 e 4, chimbal de oitavos), baixo
de colcheias, arpejo de sintetizador com phaser e uma segunda camada de arpejo em ciclo de 5 passos que 'anda' contra o compasso (defasagem lenta),
guitarra de eco (colcheia pontuada) cantando um motivo que sobe e desce em ondas, monossintetizador dobrando no retorno e varreduras de nave na quebra.
Forma (36 compassos, ~1:01): ignição 4 · A 8 · B 8 · quebra 4 · A' 8 · saída 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor, Phaser
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_d as ID
import kits_d as KD
from songs.common import aux_default

H_I = Harmony("Ebm7 Ebm7 Ebm7 Ebm7")
H_A = Harmony("Ebm7 Ebm7 Ab9 Ab9 Ebm7 Ebm7 Fm7 Dbmaj7")
H_B = Harmony("Ab9 Ab9 Bbm7 Bbm7 Dbmaj7 Dbmaj7 Fm7 Fm7")
H_BR = Harmony("Dbmaj7 Dbmaj7 Bbm7 Bbm7")
H_O = Harmony("Ebm7 Ebm7 Ebm7 Ebm7")

MA = parse("""
bb4 - - - eb5 - - - gb5 - - - f5 - eb5 - |
db5 - - - . . . . bb4 - - - . . . . |
c5 - - - eb5 - - - ab5 - - - gb5 - eb5 - |
c5 - - - . . . . bb4 - - - . . . . |
bb4 - - - eb5 - - - gb5 - - - bb5 - - - |
ab5 - - - gb5 - f5 - eb5 - - - . . . . |
f5 - - - ab5 - - - c6 - - - bb5 - ab5 - |
f5 - - - . . . . db5 - - - c5 - - - |
""")
MA_END = parse("""
f5 - - - ab5 - - - c6 - - - db6 - - - |
""")
MB = parse("""
eb5 - - - - - gb5 - ab5 - - - bb5 - - - |
c6 - - - - - - - bb5 - - - gb5 - - - |
f5 - - - - - bb5 - db6 - - - c6 - bb5 - |
ab5 - - - - - - - f5 - - - . . . . |
db6 - - - c6 - - - ab5 - - - f5 - - - |
ab5 - - - c6 - - - f6 - - - - - - - |
eb6 - - - c6 - - - ab5 - - - c6 - eb6 - |
f6 - - - - - - - - - - - . . . . |
""")
MBR = parse("""
f6 - - - - - - - c6 - - - - - - - |
ab5 - - - - - - - . . . . . . . . |
db6 - - - - - - - bb5 - - - - - - - |
f5 - - - - - - - . . . . . . . . |
""")
MO = parse("""
bb4 - - - eb5 - - - gb5 - - - f5 - eb5 - |
db5 - - - . . . . bb4 - - - . . . . |
eb5 - - - - - - - - - - - - - - - |
. . . . . . . . . . . . . . . . |
""")

ARP1 = [0, 2, 3, 2, 1, 2, 3, 2, 0, 2, 3, 5, 4, 3, 2, 1]
ARP2 = [2, 4, 3, 5, 4]  # ciclo de 5 passos: anda contra o compasso de 16


def cyc(sg, bus, fn, harm, bar0, seq, lo, gain, pan=0.0, **kw):
    """Arpejo em ciclo contínuo: o índice vem do passo ABSOLUTO, então ciclos que não dividem 16 vão se defasando de compasso a compasso."""
    for (st, ln, pc, q) in harm.events():
        tn = K.tones(pc, q, lo)
        for s in range(st, st + ln):
            ab = bar0 * sg.spb + s
            ix = seq[ab % len(seq)]
            m = tn[ix % len(tn)] + 12 * (ix // len(tn))
            sg.note(bus, fn, ab, m, 1, gain=gain, pan=pan * (1 if (ab // 1) % 2 else -1), vel=0.9 if ab % 4 == 0 else 0.62, **kw)


def build():
    sg = K.Song(142, 36, spb=16, tail=4.0, seed=301, name='cosmos3')
    rng = sg.rng
    iI, iA, iB, iBR, iA2, iO = 0, 4, 12, 20, 24, 32

    # ---- baixo de colcheias
    P1 = 'R - R - R - R - R - R - R - R -'
    P2 = 'R - R - o - R - R - R - 5 - R -'
    P3 = 'R - R - R - R - R - R - o - 5 -'
    sg.bass('bass', ID.i_kbass, Harmony("Ebm7 Ebm7", 16), iI + 2, P1, octave=34, gain=0.8)
    for h, bar in ((H_A, iA), (H_A, iA2)):
        sg.bass('bass', ID.i_kbass, h, bar, P1, octave=34, gain=0.9)
    sg.bass('bass', ID.i_kbass, H_B, iB, P2, octave=34, gain=0.95, cutoff=1100)
    sg.bass('bass', ID.i_kbass, H_BR, iBR, 'R - - - - - - - - - - - - - - -', octave=34, gain=0.75, cutoff=500)
    sg.bass('bass', ID.i_kbass, Harmony("Ebm7 Ebm7", 16), iO, P3, octave=34, gain=0.7)
    sg.bass('bass', ID.i_kbass, Harmony("Ebm7 Ebm7", 16), iO + 2, 'R - - - - - - - - - - - - - - -', octave=34, gain=0.55, cutoff=500)

    # ---- arpejo hipnótico (phaser) em A, B, A' e saída; camada de 5 passos em B e A'
    cyc(sg, 'arp', I2.i_sawpluck, Harmony("Ebm7", 16), iI + 3, ARP1, 55, 0.5, pan=0.2, cutoff=2600, tau=0.14)
    for h, bar, g in ((H_A, iA, 0.62), (H_B, iB, 0.7), (H_A, iA2, 0.72)):
        cyc(sg, 'arp', I2.i_sawpluck, h, bar, ARP1, 55, g, pan=0.25, cutoff=3000, tau=0.15)
    cyc(sg, 'arp', I2.i_sawpluck, H_BR, iBR, ARP1, 55, 0.38, pan=0.25, cutoff=1800, tau=0.22)
    cyc(sg, 'arp', I2.i_sawpluck, H_O, iO, ARP1, 55, 0.5, pan=0.25, cutoff=2200, tau=0.15)
    for h, bar, g in ((H_B, iB, 0.4), (H_A, iA2, 0.38)):
        cyc(sg, 'arp2', I2.i_sawpluck, h, bar, ARP2, 67, g, pan=0.7, cutoff=4200, tau=0.1)

    # ---- pads (cordas de sintetizador) e coro distante na quebra
    for h, bar, g in ((H_I, iI, 0.5), (H_A, iA, 0.5), (H_B, iB, 0.65), (H_BR, iBR, 0.9), (H_A, iA2, 0.6), (H_O, iO, 0.6)):
        sg.pads('pad', K.i_pad, h, bar, 51, 72, gain=g, cutoff=1150, a=0.9, r=1.3, det=0.009)
    prev = None
    for (st, ln, pc, q) in H_BR.events():
        v = K.voice(prev, pc, q, 57, 76, 3)
        prev = v
        for k, m in enumerate(v):
            sg.note('choir', K.i_choir, iBR * 16 + st, m, ln, gain=0.4 / 1.7, pan=-0.4 + 0.4 * k, vowel='u' if k != 1 else 'o', a=0.9, r=1.2, vel=0.7)

    # ---- guitarra de eco e leads
    sg.line('gtr', ID.i_eguitar, MA, iA, gain=0.8, drive=2.0)
    sg.line('gtr', ID.i_eguitar, MB, iB, gain=0.9, drive=2.4, cutoff=4200)
    sg.line('lead', K.i_modal, MBR, iBR, gain=0.8, kind='glass', tilt=2.2)
    A2 = [n for n in MA if n[0] < 7 * 16] + [(7 * 16 + s, m, l, v) for (s, m, l, v) in MA_END]
    sg.line('gtr', ID.i_eguitar, A2, iA2, gain=0.85, drive=2.2)
    sg.line('lead2', ID.i_moog, shift(A2, 0, 12, 0.7), iA2, gain=0.5, cutoff=2600, pan=0.3)
    sg.line('lead2', ID.i_moog, shift(MB, 0, -12, 0.55), iB, gain=0.42, cutoff=2000, pan=-0.3)
    sg.line('gtr', ID.i_eguitar, MO, iO, gain=0.75, drive=1.8)

    # ---- bateria motorik
    kit = KD.kit_kraut
    D_I1 = {'h': 'x...x...x...x...', 'o': '..o...o...o...o.'}
    D_I2 = {'k': 'x.....x.x.......', 's': '....x.......x...', 'h': 'x...x...x...x...', 'o': '..o...o...o...o.'}
    D_A = {'k': 'x.....x.x.......', 's': '....x.......x...', 'h': 'x...x...x...x...', 'o': '..x...x...x...x.'}
    D_B = {'k': 'x.....x.x.....x.', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..o...o...o...o.', 'x': '..............o.'}
    D_BR = {'k': 'x...............', 'h': 'x...x...x...x...', 'x': '....o.......o...'}
    FILL = {'k': 'x.......x.......', 's': '....x.........xx', 't1': '........x.......', 't2': '..........x.....', 't3': '............x...'}

    def kitbars(bar0, bars, base, fills=True, gain=1.0):
        for b in range(bar0, bar0 + bars):
            last = fills and ((b - bar0) % 4 == 3) and bars >= 4
            sg.drums(kit, b, 1, FILL if last else base, gain=gain)
    sg.drums(kit, iI, 2, D_I1, gain=0.7)
    sg.drums(kit, iI + 2, 2, D_I2, gain=0.85)
    kitbars(iA, 8, D_A)
    kitbars(iB, 8, D_B, gain=1.05)
    sg.drums(kit, iBR, 4, D_BR, gain=0.8)
    kitbars(iA2, 8, D_B, gain=1.05)
    sg.drums(kit, iO, 2, D_A, gain=0.85)
    sg.drums(kit, iO + 2, 1, {'k': 'x.....x.........', 'h': 'x...x...x...x...'}, gain=0.7)
    sg.drums(kit, iO + 3, 1, {'h': 'x.......x.......'}, gain=0.55)
    for bar in (iB, iA2):
        sg.sample('fx', S.crash(rng, None, 1.3) * 0.5, bar * 16, 0.7)

    # ---- viagem: varreduras, riser e nave na quebra
    ID.glide(sg, 'fx', iBR * 16, 6.0, 96, 60, gain=0.35, pan=-0.5)
    ID.glide(sg, 'fx', iBR * 16 + 8, 5.0, 55, 100, gain=0.25, pan=0.5)
    ID.glide(sg, 'fx', iO * 16 + 16, 5.0, 100, 50, gain=0.3, pan=0.3)
    sg.sample('fx', S.riser(rng, int(2 * 16 * sg.step_s * SR), 200, 7000, 0.0, 0.0) * 0.5, (iBR + 2) * 16, 0.55)
    y = S.reverse(S.crash(rng, int(1.8 * SR), 0.7))
    sg.put('fx', y * 0.7, sg.t_step(iA2 * 16) - len(y) / SR, 0.7)

    sg.duck(['pad', 'choir'], 0.3, 0.16)
    sg.trim = {'bass': 1.5, 'arp': 6.0, 'arp2': 11.0, 'pad': 6.0, 'choir': 14.0, 'gtr': 6.0, 'lead': 9.0, 'lead2': 8.0, 'drums': 0.0, 'fx': 0.0}
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(31), drive=1.25, lp_hz=12500, hiss_level=0.002))
    fx = {
        'bass': [LowpassFilter(1400)],
        'arp': [Phaser(rate_hz=0.23, depth=0.85, centre_frequency_hz=950, feedback=0.45, mix=0.55), Reverb(room_size=0.35, wet_level=0.12, dry_level=0.92)],
        'arp2': [Phaser(rate_hz=0.37, depth=0.8, centre_frequency_hz=1500, feedback=0.4, mix=0.5), HighpassFilter(500)],
        'pad': [Chorus(rate_hz=0.2, depth=0.35, mix=0.5), Reverb(room_size=0.9, wet_level=0.4, dry_level=0.7)],
        'choir': [Reverb(room_size=0.95, wet_level=0.5, dry_level=0.5)],
        'gtr': [Chorus(rate_hz=0.6, depth=0.15, mix=0.25), Reverb(room_size=0.4, wet_level=0.15, dry_level=0.9)],
        'lead': [Reverb(room_size=0.8, wet_level=0.3, dry_level=0.8)],
        'lead2': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.85)],
        'drums': [Compressor(threshold_db=-18, ratio=2.2, attack_ms=8, release_ms=100)],
    }
    sg.sends = {'gtr': {'echo': 0.75, 'verb': 0.08}, 'arp': {'echo': 0.3}, 'arp2': {'echo': 0.5}, 'lead': {'echo': 0.35}, 'lead2': {'echo': 0.4}, 'fx': {'verb': 0.3}, 'drums': {'verb': 0.04}}
    aux = aux_default(142, room=0.85, delay_fb=0.55, delay_beats=0.75)
    return sg, fx, aux
