"""Menu 3 — "Pista de Neon": disco-funk, 112 bpm, fá sustenido dórico. Baixo FM "slap" saltando oitavas, clavinete com wah arranhando em 16, palmas e
bumbo de quatro, chimbal aberto no contratempo, pandeiro de 16, cordas em pad com subida de escala, metais no refrão e um cowbell na quebra.
Forma (32 compassos, ~69 s): intro 2 · A 8 (tema dos metais) · B 8 (refrão) · quebra 4 (só baixo, clavinete e sinos; caixa em rufo) · B' 8 (refrão cheio, cordas em oitavas)
· coda 2 (acaba no Si9 e volta ao Fá# menor)."""
import numpy as np
from pedalboard import Reverb, Chorus, LowpassFilter, HighpassFilter, Compressor, Phaser
import synth as S
from synth import SR
import comp as K
from comp import Harmony
import inst2 as I2
import inst_a as IA
import kits_a as KA
from inst_a import score, comp_chords
from songs.common import aux_default

SPB = 16
NB = 32
HOOK = score(SPB, 8, {
    0: 'e5 - - c#5 - - e5 - f#5 - - - e5 - c#5 -',
    1: 'a5 - - f#5 - - e5 - c#5 - - . a4 - c#5 -',
    2: 'd#5 - - f#5 - - a5 - b5 - - a5 - f#5 - d#5',
    3: 'f#5 - - d#5 - - c#5 - b4 - - . . . . .',
    4: 'e5 - - c#5 - - e5 - g#5 - - - e5 - c#5 -',
    5: 'd#5 - - b4 - - d#5 - f#5 - - . d#5 - b4 -',
    6: 'e5 - - g#5 - - b5 - g#5 - - e5 - - . .',
    7: 'f#5 - - d#5 - - b4 - - - . a4 c#5 e5 - -',
})
CHORUS = score(SPB, 8, {
    0: 'a5 - - c#6 - - e6 - - - - - e6 - c#6 -',
    1: 'd#6 - - f#6 - - a6 - - - f#6 - d#6 - b5 -',
    2: 'g#5 - - b5 - - d#6 - - - f#6 - - d#6 - b5',
    3: 'e6 - - g#6 - - e6 - c#6 - - . . . . .',
    4: 'c#6 - - e6 - - a6 - - - g#6 - e6 - c#6 -',
    5: 'd#6 - - f#6 - - b6 - - - a6 - f#6 - d#6 -',
    6: 'b5 - - e6 - - g#6 - - - d#6 - - b5 - g#5',
    7: 'a5 - - f#5 - - d#5 - b4 - - . . . . .',
})
# o refrão final termina diferente (sobe até o agudo e desce em oitavas) — só o último compasso muda
CHORUS2_END = score(SPB, 1, {0: 'a5 - - c#6 - - f#6 - - - e6 - c#6 - a5 -'})
RUN = score(SPB, 1, {0: 'f#5 - g#5 - a5 - b5 - c#6 - d#6 - e6 - f#6 -'})
CODA = score(SPB, 2, {
    0: 'a5 - - c#6 - - e6 - - - - - c#6 - a5 -',
    1: '. . . . . . . . . . . . d#6! - - -',
})

H_I = Harmony("F#m9 F#m9", SPB)
H_A = Harmony("F#m9 F#m9 B9 B9 Amaj7 G#m7 C#m7 B9", SPB)
H_B = Harmony("Amaj7 B9 G#m7 C#m7 Amaj7 B9 Emaj7 B9", SPB)
H_K = Harmony("D#m7b5 G#m7 C#m7 B9", SPB)
H_O = Harmony("F#m9 B9", SPB)


def crash(sg, bar, gain=0.5, tau=1.2):
    sg.sample('fx', S.crash(sg.rng, None, tau) * 0.7, bar * SPB, gain)


def rev_crash(sg, bar, gain=0.4):
    y = S.reverse(S.crash(sg.rng, int(1.4 * SR), 0.5))
    t0 = sg.t_step(bar * sg.spb) - len(y) / SR
    if t0 >= 0:
        sg.put('fx', y * 0.8, t0, gain)


def build():
    sg = K.Song(112, NB, spb=SPB, tail=3.0, seed=112, name='menu3')
    rng = sg.rng
    iI, iA, iB, iK, iC, iO = 0, 2, 10, 18, 22, 30
    # ---- baixo FM "slap" (e um sub redondo por baixo)
    BA = 'R . o . R . o . R . o . R . 5 b'
    BB = 'R . o R . o . R R . o . R . 5 .'
    BK = 'R . . . . . R . . . . . R . . .'
    for h, bar, pat, g in ((H_A, iA, BA, 0.9), (H_B, iB, BB, 1.0), (H_B, iC, BB, 1.1)):
        sg.bass('bass', K.i_fmbass, h, bar, pat, octave=36, gain=g, tau=0.16, index=3.2)
        sg.bass('sub', I2.i_sub, h, bar, pat, octave=36, gain=0.6 * g)
    sg.bass('bass', K.i_fmbass, H_K, iK, BK, octave=36, gain=0.6, tau=0.2, index=2.4)
    sg.bass('sub', I2.i_sub, H_K, iK, BK, octave=36, gain=0.35)
    sg.bass('bass', K.i_fmbass, H_I, iI, 'R . . . . . . . R . . . . . . .', octave=36, gain=0.8, tau=0.2, index=2.4)
    sg.bass('bass', K.i_fmbass, H_O, iO, 'R . o . R . o . R . o . R . . .', octave=36, gain=0.95, tau=0.16, index=3.2)
    # ---- clavinete com wah (acordes em 16, curtos)
    CL_A = {3: 1, 6: 1, 7: 1, 10: 1, 11: 1, 14: 1}
    CL_B = {0: 2, 3: 1, 6: 1, 7: 1, 10: 1, 11: 1, 14: 1}
    comp_chords(sg, 'clav', IA.i_clav, H_A, iA, CL_A, 55, 74, gain=0.5, n=3, tau=0.13, wah=0.07)
    comp_chords(sg, 'clav', IA.i_clav, H_B, iB, CL_B, 55, 74, gain=0.9, n=3, tau=0.13, wah=0.08)
    comp_chords(sg, 'clav', IA.i_clav, H_K, iK, {0: 1, 2: 1, 3: 1, 6: 1, 8: 1, 10: 1, 11: 1, 14: 1}, 55, 74, gain=0.45, n=3, tau=0.12, wah=0.1, top=6500)
    comp_chords(sg, 'clav', IA.i_clav, H_B, iC, CL_B, 55, 74, gain=1.0, n=3, tau=0.13, wah=0.08)
    comp_chords(sg, 'clav', IA.i_clav, H_I, iI, {6: 1, 10: 1, 14: 1}, 55, 74, gain=0.55, n=3, tau=0.12, wah=0.07)
    comp_chords(sg, 'clav', IA.i_clav, H_O, iO, {0: 1, 3: 1, 6: 1, 10: 1, 14: 1}, 55, 74, gain=0.7, n=3, tau=0.12, wah=0.07)
    # ---- cordas em pad (quase só no refrão) e subidas de escala
    sg.pads('str', IA.i_strings, H_I, iI, 54, 78, gain=0.5, a=0.5, r=0.6)
    sg.pads('str', IA.i_strings, H_A, iA, 54, 78, gain=0.15, a=0.4, r=0.5, cutoff=2400)
    sg.pads('str', IA.i_strings, H_B, iB, 54, 78, gain=0.6, a=0.2, r=0.5)
    sg.pads('str', IA.i_strings, H_B, iC, 54, 78, gain=0.95, a=0.2, r=0.5)
    sg.pads('str', IA.i_strings, H_O, iO, 54, 78, gain=0.5, a=0.1, r=0.8)
    sg.line('str', IA.i_strings, RUN, iI + 1, gain=0.55, a=0.05, r=0.3)
    sg.line('str', IA.i_strings, RUN, iK + 3, gain=0.55, a=0.05, r=0.3)
    # ---- temas: metais no verso, metais+cordas no refrão, oitavas no refrão final
    sg.line('lead', K.i_brass, HOOK, iA, gain=0.7, cutoff=2300)
    sg.line('lead', K.i_brass, CHORUS, iB, gain=0.9, cutoff=3600)
    sg.line('lead2', IA.i_strings, CHORUS, iB, gain=0.5, pan=0.3)
    sg.line('lead', K.i_brass, K.bars_of(CHORUS, SPB, 0, 7), iC, gain=0.95, cutoff=4200)
    sg.line('lead', K.i_brass, CHORUS2_END, iC + 7, gain=0.95, cutoff=4200)
    sg.line('lead2', IA.i_strings, K.shift(CHORUS, 0, -12), iC, gain=0.55, pan=-0.3)
    sg.line('lead2', K.i_modal, K.shift(CHORUS, 0, 12, 0.6), iC, gain=0.28, kind='glass', tilt=1.2, pan=0.35)
    sg.line('lead', K.i_brass, CODA, iO, gain=0.9, cutoff=3600)
    # sinos de vibrafone sobre a quebra
    sg.arp('bell', K.i_modal, H_K, iK, '0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .', lo=72, gain=0.2, pan=0.4, kind='vibes', tilt=1.0, step_len=2)
    # ---- bateria
    kit = KA.kit_disco
    FLOOR = 'x...x...x...x...'
    D_A = {'k': FLOOR, 's': '....x.......x...', 'p': '....X.......X...', 'o': '..x...x...x...x.', 'sh': 'xoxoxoxoxoxoxoxo'}
    D_B = {'k': FLOOR, 's': '....x.......x...', 'p': '....X.......X...', 'o': '..x...x...x...x.', 'h': 'x...x...x...x...', 'sh': 'xoxoxoxoxoxoxoxo'}
    D_C = dict(D_B, cb='..x...x...x...x.', h='x.x.x.x.x.x.x.x.')
    sg.drums(kit, iI, 2, {'sh': 'xoxoxoxoxoxoxoxo', 'p': '............X...'}, gain=0.5)
    sg.drums(kit, iA, 8, D_A, gain=0.6)
    sg.drums(kit, iB, 8, D_B, gain=1.0)
    sg.drums(kit, iK, 3, {'cb': 'x..x..x.x..x..x.', 'sh': 'xoxoxoxoxoxoxoxo', 'h': '..x...x...x...x.'}, gain=0.4)
    sg.drums(kit, iK + 3, 1, {'s': 'o.o.o.o.x.x.xxXX', 'k': 'x...x...x...x...', 'sh': 'xoxoxoxoxoxoxoxo'}, gain=0.8)
    sg.drums(kit, iC, 8, D_C, gain=1.15)
    sg.drums(kit, iO, 1, D_B, gain=1.0)
    sg.drums(kit, iO + 1, 1, {'k': 'x...x...x.......', 's': '....x.......x...', 'p': '....X.......X...', 'sh': 'xoxoxoxoxoxo....'}, gain=1.0)
    for bar in (iB - 1, iK - 1, iO - 1):
        sg.drums(kit, bar, 1, {'t1': '............x...', 't2': '..............x.', 't3': '...............x', 's': '............x.x.'}, gain=0.85)
    # ---- efeitos
    for bar in (iA, iB, iC):
        crash(sg, bar, 0.5)
    for bar in (iB, iC, iK, iO):
        rev_crash(sg, bar, 0.35)
    sg.sample('fx', S.riser(rng, int(2 * SPB * sg.step_s * SR), 300, 8000, 0.15, 330) * 0.5, (iK + 2) * SPB, 0.3)
    sg.duck(['str', 'lead2', 'bell'], 0.3, 0.12)
    sg.trim = {'bass': -5.0, 'sub': -4.0, 'clav': 1.0, 'str': 6.5, 'lead': 7.5, 'lead2': 8.0, 'bell': 6.0, 'drums': 0.0, 'fx': 6.0}
    fx = {
        'bass': [LowpassFilter(2600)],
        'sub': [LowpassFilter(300)],
        'clav': [Phaser(rate_hz=0.25, depth=0.35, mix=0.25), Reverb(room_size=0.2, wet_level=0.1, dry_level=0.92)],
        'str': [Chorus(rate_hz=0.35, depth=0.3, mix=0.4), Reverb(room_size=0.6, wet_level=0.25, dry_level=0.8)],
        'lead': [Reverb(room_size=0.3, wet_level=0.15, dry_level=0.9)],
        'lead2': [Chorus(rate_hz=0.5, depth=0.2, mix=0.3), Reverb(room_size=0.4, wet_level=0.2, dry_level=0.85)],
        'bell': [Reverb(room_size=0.5, wet_level=0.3, dry_level=0.75)],
        'drums': [Compressor(threshold_db=-16, ratio=2.4, attack_ms=10, release_ms=80)],
    }
    sg.sends = {'lead': {'echo': 0.15, 'verb': 0.08}, 'lead2': {'echo': 0.1}, 'bell': {'echo': 0.3}, 'clav': {'echo': 0.06}, 'fx': {'verb': 0.3}}
    return sg, fx, aux_default(112, room=0.45, delay_fb=0.3, delay_beats=0.75)
