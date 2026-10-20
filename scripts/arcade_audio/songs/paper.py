"""Papel — valsa (3/4), 132 bpm, ré menor. Caixa de música e celesta tocam o tema; a segunda voz é o ESPELHO do tema (inversão diatônica
em torno do lá), os dois heróis do Papel, e no refrão as vozes trocam de lado. Pizzicato oom-pah-pah, farfalhar de papel, virada de página.
Forma (64 compassos de 3/4, ~1:26): abertura 8 (um herói) · tema+espelho 8 · refrão 8 · tema+espelho com pizzicato 8 · interlúdio 8 (ponte em papel) · refrão com troca 8 · volta 8 · saída 8."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, Delay
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony, invert
import tape as TP
from songs.common import aux_default, loader_in_gap

SPB = 12
A_L = parse("""
d5 - - - f5 - a5 - d6 - - - |
c6 - a5 - f5 - a5 - d5 - - - |
bb5 - - - d6 - f6 - d6 - - - |
c6 - e6 - g6 - e6 - c6 - - - |
a5 - - - d6 - f6 - a6 - - - |
g5 - bb5 - d6 - bb5 - g5 - - - |
e6 - c#6 - a5 - c#6 - e6 - g6 - |
f6 - - - e6 - d6 - d6 - - - |
""", SPB)
B_L = parse("""
a5 - c6 - f6 - c6 - a5 - - - |
g5 - c6 - e6 - g6 - e6 - - - |
f5 - a5 - d6 - f6 - d6 - - - |
e6 - c6 - a5 - c6 - e6 - - - |
bb5 - d6 - f6 - d6 - bb5 - - - |
a5 - c6 - f6 - e6 - c6 - g5 - |
g5 - bb5 - d6 - c#6 - e6 - a5 - |
d6 - - - a5 - f5 - d5 - - - |
""", SPB)
INTERLUDE = parse("""
d6 . . . . . . . . . . . |
. . . . a5 . . . . . . . |
f5 . . . . . . . d5 . . . |
. . . . . . e5 . . . . . |
bb5 - - - - - - - - - - - |
a5 - - - - - c6 - - - - - |
g5 - - - - - - - e5 - - - |
a5 - - - - - c#6 - - - - - |
""", SPB)
OUT_L = parse("""
d5 - - - f5 - - - a5 - - - |
d6 - - - - - - - - - - - |
bb4 - - - d5 - - - f5 - - - |
a5 - - - - - - - - - - - |
""", SPB)

H_A = Harmony("Dm Dm Bb C Dm Gm A7 Dm", SPB)
H_B = Harmony("F C Dm Am Bb F_C Gm_A7 Dm", SPB)
H_I = Harmony("Dm Dm Bb Bb Gm Gm A7 A7", SPB)
H_O = Harmony("Gm Dm A7 Dm", SPB)


def page_turn(sg, bar, step=0, gain=0.5):
    n = int(0.5 * SR)
    y = S.hp(sg.rng.standard_normal(n), 2500) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    y = S.bp(y, 2500, 9000, 1)
    sg.sample('paper', y * 0.45, bar * SPB + step, gain, pan=float(sg.rng.uniform(-0.5, 0.5)))


def rustle(sg, bar0, bars, dens=0.35, gain=0.35):
    for st in range(bar0 * SPB, (bar0 + bars) * SPB):
        if st % 2 == 0 and sg.rng.random() < dens:
            n = int(float(sg.rng.uniform(0.02, 0.07)) * SR)
            y = S.hp(sg.rng.standard_normal(n), 3500) * np.exp(-np.arange(n) / (n * 0.35))
            sg.sample('paper', y * 0.5, st, gain, pan=float(sg.rng.uniform(-0.8, 0.8)))


def build():
    sg = K.Song(132, 64, spb=SPB, tail=3.5, seed=81, name='paper')
    rng = sg.rng
    iO, iT, iC, iT2, iL, iC2, iV, iX = 0, 8, 16, 24, 32, 40, 48, 56
    # espelho do tema: inversão diatônica de ré menor em torno do lá5
    def mirror(notes, harm=None):
        m = invert(notes, 2, 'minor', 77)
        return K.fit(m, harm) if harm is not None else m
    # --- abertura: um herói (caixa de música) sozinho com pizz
    sg.line('boxR', K.i_modal, A_L, iO, gain=0.8, kind='box', tilt=1.2, pan=0.45)
    # --- tema + espelho
    sg.line('boxR', K.i_modal, A_L, iT, gain=0.8, kind='box', tilt=1.2, pan=0.45)
    sg.line('celL', K.i_modal, mirror(A_L, H_A), iT, gain=0.7, kind='glass', tilt=0.8, pan=-0.45)
    sg.line('boxR', K.i_modal, A_L, iT2, gain=0.8, kind='box', tilt=1.2, pan=0.45)
    sg.line('celL', K.i_modal, mirror(A_L, H_A), iT2, gain=0.7, kind='glass', tilt=0.8, pan=-0.45)
    sg.line('lead', K.i_fmep, A_L, iT2, gain=0.3, tau=0.5)
    # --- refrão
    sg.line('boxR', K.i_modal, B_L, iC, gain=0.8, kind='box', tilt=1.4, pan=0.45)
    sg.line('celL', K.i_modal, mirror(B_L, H_B), iC, gain=0.7, kind='glass', tilt=0.9, pan=-0.45)
    sg.line('lead', K.i_fmep, B_L, iC, gain=0.4, tau=0.7)
    # --- interlúdio: ponte em papel (notas esparsas e a página virando)
    sg.line('boxR', K.i_modal, INTERLUDE, iL, gain=0.8, kind='box', tilt=2.0, pan=0.3)
    sg.line('celL', K.i_modal, mirror(INTERLUDE, H_I), iL, gain=0.7, kind='glass', tilt=1.6, pan=-0.3)
    # --- refrão com troca de lado e oitava
    sg.line('boxR', K.i_modal, mirror(B_L, H_B), iC2, gain=0.8, kind='box', tilt=1.4, pan=-0.45)
    sg.line('celL', K.i_modal, B_L, iC2, gain=0.7, kind='glass', tilt=0.9, pan=0.45)
    sg.line('lead', K.i_fmep, B_L, iC2, gain=0.45, tau=0.7)
    sg.line('lead', K.i_nes, shift(B_L, 0, 12, 0.6), iC2, gain=0.25, duty=0.125, decay=0.2, pan=0.2)
    # --- volta e saída
    sg.line('boxR', K.i_modal, A_L, iV, gain=0.8, kind='box', tilt=1.2, pan=0.45)
    sg.line('celL', K.i_modal, mirror(A_L, H_A), iV, gain=0.7, kind='glass', tilt=0.8, pan=-0.45)
    sg.line('lead', K.i_fmep, shift(A_L, 0, 12, 0.6), iV, gain=0.35, tau=0.5, pan=0.2)
    sg.line('boxR', K.i_modal, OUT_L, iX, gain=0.7, kind='box', tilt=1.6, pan=0.4)
    sg.line('celL', K.i_modal, mirror(OUT_L, H_O), iX, gain=0.6, kind='glass', tilt=1.2, pan=-0.4)
    # --- harmonia: oom-pah-pah (pizzicato) + baixo + pads
    PAH = {'a': '. . . . 1 . . . 2 . . .', 'b': '. . . . 2 . . . 1 . . .'}
    for h, bar in ((H_A, iT), (H_B, iC), (H_A, iT2), (H_B, iC2), (H_A, iV), (H_O, iX)):
        sg.arp('pah', K.i_pluck, h, bar, PAH['a'], lo=57, gain=0.5, pan=-0.2, decay=0.99, bright=0.55, step_len=2)
        sg.arp('pah', K.i_pluck, h, bar, PAH['b'], lo=64, gain=0.4, pan=0.2, decay=0.99, bright=0.55, step_len=2)
        sg.bass('bass', K.i_pluck, h, bar, 'R . . . . . . . . . . .', octave=38, gain=1.1, decay=0.996, bright=0.35)
        sg.bass('bass', K.i_tri, h, bar, 'R - - - . . . . . . . .', octave=38, gain=0.7)
    for h, bar in ((H_A, iO),):
        sg.arp('pah', K.i_pluck, h, bar, PAH['a'], lo=57, gain=0.35, pan=-0.2, decay=0.99, bright=0.55, step_len=2)
        sg.bass('bass', K.i_pluck, h, bar, 'R . . . . . . . . . . .', octave=38, gain=0.8, decay=0.996, bright=0.35)
    sg.pads('pad', K.i_pad, H_I, iL, 46, 70, gain=0.5, cutoff=1000, a=0.5)
    for h, bar, g in ((H_B, iC, 0.4), (H_B, iC2, 0.45)):
        sg.pads('pad', K.i_pad, h, bar, 48, 72, gain=g, cutoff=1200, a=0.3)
    # --- farfalhar de papel + virada de página nos finais de seção
    rustle(sg, iO, 8, 0.3)
    rustle(sg, iT, 16, 0.35)
    rustle(sg, iC, 8, 0.4)
    rustle(sg, iL, 8, 0.6, 0.45)
    rustle(sg, iC2, 8, 0.4)
    rustle(sg, iV, 8, 0.3)
    for bar in (7, 15, 23, 31, 39, 47, 55):
        page_turn(sg, bar, 6)
    # --- percussão: só madeira e brush no refrão
    kit = K.kit_soft
    sg.drums(kit, iC, 8, {'k': 'x...........', 'sh': '..x...x...x.', 'w': '....x...x...'}, gain=0.5)
    sg.drums(kit, iC2, 8, {'k': 'x...........', 'sh': 'x.x.x.x.x.x.', 'w': '....x...x...', 'r': '........x...'}, gain=0.55)
    sg.sample('fx', S.riser(rng, int(2 * SPB * sg.step_s * SR), 600, 9000, 0.0, 0) * 0.5, (iC2 - 2) * SPB, 0.5)
    sg.duck(['pad'], 0.25, 0.2)
    loader_in_gap(sg, A_L, 63, 2, gain=0.22, pan=0.0, pilot_s=0.15)
    sg.post.append(lambda mix, song: TP.wow_flutter(mix, np.random.default_rng(13), wow=0.0014, flutter=0.0007))
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(14), drive=1.2, lp_hz=12500, hiss_level=0.002, crackle=0.01))
    fx = {
        'boxR': [Reverb(room_size=0.5, wet_level=0.25, dry_level=0.85)],
        'celL': [Reverb(room_size=0.5, wet_level=0.25, dry_level=0.85)],
        'pah': [Reverb(room_size=0.35, wet_level=0.2, dry_level=0.9)],
        'lead': [Reverb(room_size=0.4, wet_level=0.2, dry_level=0.9)],
        'paper': [LowpassFilter(9000), Reverb(room_size=0.3, wet_level=0.2, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.4, depth=0.2, mix=0.3), Reverb(room_size=0.65, wet_level=0.3, dry_level=0.75)],
    }
    sg.sends = {'boxR': {'echo': 0.18, 'verb': 0.15}, 'celL': {'echo': 0.18, 'verb': 0.15}, 'lead': {'echo': 0.12}}
    return sg, fx, aux_default(132, room=0.6, delay_fb=0.35, delay_beats=1.5)
