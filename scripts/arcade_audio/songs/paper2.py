"""Origami Lo-fi — hip hop de fita velha, 78 bpm, lá menor, swing leve. Caixinha de música (modal 'box') e piano elétrico, baixo macio, bumbo e caixa
de boom bap, chimbal que é farfalhar de papel, tesoura estalando no fim das frases. A melodia vai e volta de trás para frente (retrógrado: a folha
dobrada) e espelha de um lado para o outro do estéreo. Chiado e estalinhos de vinil. Forma (32 compassos, ~1:38): papel em branco 4 · A 8 · A espelhada 8 · A' 8 · dobra 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony, retro, fit
import tape as TP
import inst2 as I2
from songs.common import aux_default

A_L = parse("""
e6 - - . c6 - a5 - . . e5 - - . . . |
f6 - - . d6 - a5 - . . f5 - - . . . |
d6 - - . b5 - g5 - . . d5 - - . . . |
e6 - - . g6 - e6 - c6 - - . g5 - - . |
c6 - - . a5 - f5 - . . c6 - - . . . |
d6 - - . f5 - b5 - . . d6 - - . . . |
b5 - - . g#5 - e5 - . . d6 - b5 - g#5 - |
a5 - - - - - - - e5 - - - - - - - |
""")
H_A = Harmony("Am9 Dm9 Gmaj9 Cmaj9 Fmaj9 Bm7b5 E7 Am9")
H_I = Harmony("Am9 Dm9 Am9 E7")
B_L = fit(retro(A_L, 8 * 16), H_A)
OUT_L = parse("""
e6 - - . c6 - a5 - . . e5 - - . . . |
f6 - - . d6 - a5 - . . f5 - - - - - |
e5 - - - - - - - - - - - - - - - |
. . . . . . . . . . . . . . . . |
""")


def mirror(notes, steps_per, pan_a=-0.55, pan_b=0.55):
    """Divide a linha em duas metades alternadas: a dobra do papel (um lado, depois o outro)."""
    a = [n for n in notes if (n[0] // steps_per) % 2 == 0]
    b = [n for n in notes if (n[0] // steps_per) % 2 == 1]
    return (a, pan_a), (b, pan_b)


def build():
    sg = K.Song(78, 32, spb=16, tail=4.0, seed=33, swing=0.12, name='paper2')
    rng = sg.rng
    iI, iA, iB, iA2, iO = 0, 4, 12, 20, 28
    # ---- harmonia: piano elétrico e baixo macio
    for h, bar, g in ((H_I, iI, 0.5), (H_A, iA, 0.55), (H_A, iB, 0.6), (H_A, iA2, 0.6)):
        sg.pads('ep', K.i_fmep, h, bar, 55, 76, gain=g, tau=1.1, bright=0.7)
    sg.pads('ep', K.i_fmep, Harmony("Am9 Dm9 Am9 Am9"), iO, 55, 76, gain=0.45, tau=1.4, bright=0.6)
    BASS = 'R . . . . . R . . . 5 . . . . .'
    for h, bar, g in ((H_A, iA, 0.8), (H_A, iB, 0.85), (H_A, iA2, 0.85)):
        sg.bass('bass', I2.i_sub, h, bar, BASS, octave=36, gain=g, drive=0.3)
    sg.bass('bass', I2.i_sub, H_I, iI, 'R - - - - - - - - - - - - - - -', octave=36, gain=0.6)
    # ---- melodias: caixinha de música (A), retrógrado espelhado (B), caixinha + vibrafone (A')
    sg.line('lead', K.i_modal, A_L, iA, gain=0.85, kind='box', tilt=1.8)
    (ba, pa), (bb, pb) = mirror(B_L, 16)
    sg.line('lead', K.i_modal, ba, iB, gain=0.85, kind='box', tilt=1.8, pan=pa)
    sg.line('lead', K.i_modal, bb, iB, gain=0.85, kind='box', tilt=1.8, pan=pb)
    sg.line('lead2', K.i_modal, shift(B_L, 0, 12, 0.5), iB, gain=0.25, kind='glass', tilt=1.2, pan=0.0)
    sg.line('lead', K.i_modal, A_L, iA2, gain=0.85, kind='box', tilt=1.8)
    sg.line('lead2', K.i_modal, shift(A_L, 6, -12, 0.6), iA2, gain=0.5, kind='vibes', tilt=1.6, pan=0.35)
    sg.line('lead', K.i_modal, OUT_L, iO, gain=0.8, kind='box', tilt=2.2)
    # ---- bateria boom bap (bumbo, caixa) com chimbal de farfalhar de papel
    kit = K.kit_soft

    def paper_hat(ins, rng_, v):
        if ins == 'h':
            n = int(0.07 * SR)
            return S.bp(rng_.standard_normal(n), 3000, 9500, 1) * np.exp(-S.tt(n) / 0.02) * v * 0.7
        if ins == 'z':   # tesoura: estalo metálico curto
            n = int(0.09 * SR)
            return (S.hp(rng_.standard_normal(n), 4500) * np.exp(-S.tt(n) / 0.012) + 0.4 * S.sine(3300, n) * np.exp(-S.tt(n) / 0.02)) * v * 0.8
        return kit(ins, rng_, v)

    D_A = {'k': 'x.....x...x.....', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.'}
    D_B = {'k': 'x.....x...x...o.', 's': '....x.......x..o', 'h': 'xoxoxoxoxoxoxoxo', 'sh': '.....o.o.....o.o'}
    sg.drums(paper_hat, iI, 4, {'h': 'x...x...x...x...'}, gain=0.5)
    sg.drums(paper_hat, iA, 8, D_A, gain=0.85)
    sg.drums(paper_hat, iB, 8, D_B, gain=0.85)
    sg.drums(paper_hat, iA2, 8, D_B, gain=0.9)
    sg.drums(paper_hat, iO, 4, {'k': 'x...............', 'h': 'x.x.x.x.x.x.x.x.'}, gain=0.6)
    for bar in (iA + 3, iA + 7, iB + 3, iB + 7, iA2 + 3, iA2 + 7):   # tesoura no fim das frases
        sg.drums(paper_hat, bar, 1, {'z': '..............x.'}, gain=0.8)
    # folhas virando: ruído filtrado subindo, no começo de A, B e A'
    for bar in (iA, iB, iA2):
        n = int(0.5 * SR)
        sw = S.bp(rng.standard_normal(n), 1500, 7000, 1) * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5 * 0.5
        sg.sample('fx', sw, bar * 16 - 3, 0.35, pan=0.2)
    sg.duck(['ep'], 0.2, 0.2)
    sg.trim = {'ep': 2.2, 'bass': -3.1, 'lead': 6.2, 'lead2': 4.9, 'drums': 3.0, 'fx': 14.4}
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(14), wow=0.0026, flutter=0.0007, wow_hz=0.3))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(15), drive=1.4, lp_hz=7600, hiss_level=0.006, crackle=0.07))
    fx = {
        'ep': [Chorus(rate_hz=0.35, depth=0.25, mix=0.3), Reverb(room_size=0.45, wet_level=0.2, dry_level=0.9)],
        'bass': [LowpassFilter(900)],
        'lead': [Reverb(room_size=0.4, wet_level=0.2, dry_level=0.9)],
        'lead2': [Reverb(room_size=0.5, wet_level=0.25, dry_level=0.85)],
        'drums': [Compressor(threshold_db=-20, ratio=2.5, attack_ms=10, release_ms=90)],
    }
    sg.sends = {'lead': {'echo': 0.2, 'verb': 0.12}, 'lead2': {'echo': 0.2}, 'fx': {'verb': 0.2}}
    return sg, fx, aux_default(78, room=0.6, delay_fb=0.32, delay_beats=0.75)
