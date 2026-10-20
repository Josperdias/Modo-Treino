"""Caldeira — doom / sludge, 70 bpm, fá sustenido frígio. Microfonia e bordão na boca da cratera, riff lento de duas guitarras graves em serras com
distorção pesada (o semitom 'ré-fá#-sol' que cai de volta ao fá#), segunda volta em 'chugs' que acompanham o bumbo, um canto fúnebre de guitarra solo
sobre acordes de potência arrastados com coro grave, uma quebra de microfonia e gongo, e o clímax: o riff com tudo, china batendo em colcheias, uivo
agudo de guitarra e a queda final de tom (a lava rompendo). Bateria enorme em meio-tempo.
Forma (20 compassos de 4/4 a 70 bpm, ~1:09): cratera 2 · riff 4 · riff em chugs 4 · lamento 4 · quebra 2 · erupção 4."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, LowpassFilter, HighpassFilter, Compressor, Distortion
import synth as S
from synth import SR
import comp as K
from comp import parse, shift, Harmony
import tape as TP
import inst2 as I2
import inst_d as ID
import kits_d as KD
from songs.common import aux_default

RA = parse("""
f#2 - - - - - - - f#2 - - - g2 - f#2 - |
a2 - - - - - - - g2 - - - f#2 - - - |
f#2 - - - - - - - f#2 - - - b2 - a2 - |
g2 - - - - - - - f#2 - - - - - - - |
""")
RB = parse("""
f#2 . f#2 f#2 . . f#2 . f#2 . . f#2 g2 - f#2 - |
a2 . a2 a2 . . a2 . g2 . . g2 f#2 - - - |
f#2 . f#2 f#2 . . f#2 . f#2 . . f#2 b2 - a2 - |
g2 . g2 g2 . . g2 . f#2 - - - - - - - |
""")
RC_LAST = parse("""
f#2 - - - - - - - - - - - - - - - |
""")
DB = parse("""
b2 - - - - - - - - - - - - - - - |
a2 - - - - - - - - - - - - - - - |
f#2 - - - - - - - - - - - - - - - |
g2 - - - - - - - f#2 - - - - - - - |
""")
LA2 = parse("""
c#5 - - - - - - - - - - - a4 - - - |
b4 - - - g4 - - - f#4 - - - - - - - |
""")
LB = parse("""
d5 - - - - - - - - - - - c#5 - - - |
e5 - - - - - - - d5 - - - - - - - |
c#5 - - - - - - - a4 - - - - - - - |
b4 - - - - - - - f#4 - - - - - - - |
""")
LC = parse("""
f#5 - - - - - - - c#6 - - - - - - - |
a5 - - - - - - - e6 - - - d6 - - - |
d6 - - - - - - - c#6 - - - a5 - - - |
b5 - - - g5 - - - f#5 - - - - - - - |
""")
H_B = Harmony("B5 A5 F#5 G5_F#5")
H_I = Harmony("F#5 F#5")
H_C = Harmony("E5 E5")


def build():
    sg = K.Song(70, 20, spb=16, tail=5.0, seed=707, name='volcano3')
    rng = sg.rng
    iI, iA, iA2, iB, iBr, iC = 0, 2, 6, 10, 14, 16
    RC = [n for n in RB if n[0] < 3 * 16] + [(3 * 16 + s, m, l, v) for (s, m, l, v) in RC_LAST]

    # ---- microfonia e bordão (cratera, lamento, quebra, e o resto do clímax como sustentação)
    sg.note('fb', ID.i_feedback, iI * 16, 66, 28, gain=0.7)
    sg.note('fb', ID.i_feedback, iI * 16, 73, 28, gain=0.35, pan=0.4)
    sg.note('fb', ID.i_feedback, (iB + 2) * 16, 66, 28, gain=0.35, pan=-0.3)
    sg.note('fb', ID.i_feedback, iBr * 16, 73, 28, gain=0.7)
    sg.note('fb', ID.i_feedback, iBr * 16, 78, 28, gain=0.4, pan=0.4)
    sg.note('drone', I2.i_drone, iI * 16, 30, 32, gain=0.9, cutoff=300)
    sg.note('drone', I2.i_drone, iI * 16, 37, 32, gain=0.5, cutoff=260)
    sg.note('drone', I2.i_drone, iBr * 16, 30, 32, gain=1.0, cutoff=320)
    sg.note('drone', I2.i_drone, iC * 16 + 48, 30, 16, gain=0.8, cutoff=300, a=0.05)
    n = int(2 * 16 * sg.step_s * SR)
    rumb = S.lp(rng.standard_normal(n), 130, 2) * 3.0 * np.linspace(0.2, 1, n) ** 1.6
    sg.sample('rumble', rumb, iBr * 16, 0.9)

    # ---- riff: duas guitarras (esquerda/direita, afinações ligeiramente diferentes) + baixo sujo uma oitava abaixo
    sg.line('gtrL', ID.i_pgtr, RA, iA, gain=0.9, pan=-0.75, det=0.004)
    sg.line('gtrR', ID.i_pgtr, RA, iA, gain=0.9, pan=0.75, det=0.0055)
    sg.line('bass', ID.i_sub2, shift(RA, 0, -12), iA, gain=0.9)
    sg.line('gtrL', ID.i_pgtr, RB, iA2, gain=0.95, pan=-0.75, det=0.004, r=0.1)
    sg.line('gtrR', ID.i_pgtr, RB, iA2, gain=0.95, pan=0.75, det=0.0055, r=0.1)
    sg.line('bass', ID.i_sub2, shift(RB, 0, -12), iA2, gain=0.95)
    sg.line('lead', ID.i_lgtr, LA2, iA2 + 2, gain=0.65, bend=1.0, cutoff=3000)
    # ---- lamento: acordes de potência arrastados, canto da guitarra solo, coro grave
    sg.line('gtrL', ID.i_pgtr, DB, iB, gain=0.9, pan=-0.6, det=0.004, r=0.5)
    sg.line('gtrR', ID.i_pgtr, DB, iB, gain=0.9, pan=0.6, det=0.0055, r=0.5)
    sg.line('bass', ID.i_sub2, shift(DB, 0, -12), iB, gain=0.9, r=0.3)
    sg.line('lead', ID.i_lgtr, LB, iB, gain=0.95, bend=1.5, cutoff=3200)
    prev = None
    for (st, ln, pc, q) in H_B.events():
        v = K.voice(prev, pc, q, 47, 66, 3)
        prev = v
        for k, m in enumerate(v):
            sg.note('choir', K.i_choir, iB * 16 + st, m, ln, gain=0.6 / 1.7, pan=-0.4 + 0.4 * k, vowel='o' if k != 1 else 'u', a=0.8, r=1.3, vel=0.7)
    # ---- erupção: o riff com tudo, uivo agudo, queda de tom no fim
    sg.line('gtrL', ID.i_pgtr, RC, iC, gain=1.0, pan=-0.8, det=0.004, r=0.2)
    sg.line('gtrR', ID.i_pgtr, RC, iC, gain=1.0, pan=0.8, det=0.0055, r=0.2)
    sg.line('gtrL', ID.i_pgtr, shift(RC, 0, 12, 0.7), iC, gain=0.45, pan=-0.3, det=0.003, r=0.2, fifth=False, oct_=False)
    sg.line('bass', ID.i_sub2, shift(RC, 0, -12), iC, gain=1.0)
    sg.line('lead', ID.i_lgtr, LC, iC, gain=0.9, bend=2.0, cutoff=3800, vib=0.014)
    ID.glide(sg, 'lead', (iC + 3) * 16 + 8, 3.4, 90, 38, gain=0.6, kind='saw')

    # ---- bateria enorme em meio-tempo
    kit = KD.kit_doom
    D_A = {'k': 'x.....x.x.......', 's': '........x.......', 'h': 'x...x...x...x...'}
    D_A2 = {'k': 'x.....x.x...x...', 's': '........x.......', 'h': 'x.x.x.x.x.x.x.x.'}
    D_B = {'k': 'x.......x.......', 's': '........x.......', 't3': '....o.......o...', 'h': 'x...............'}
    D_C = {'k': 'x.x...x.x.x...x.', 's': '....x.......x...', 'x': 'x.x.x.x.x.x.x.x.', 't3': '..............o.'}
    FILL = {'k': 'x...x...x.......', 's': '........x.......', 't1': '..........x.....', 't2': '............x...', 't3': '..............xx', 'c': 'x...............'}
    sg.drums(kit, iI + 1, 1, {'t3': '............x...'}, gain=0.5)
    sg.drums(kit, iA, 4, D_A, gain=0.95)
    sg.drums(kit, iA2, 3, D_A2, gain=1.0)
    sg.drums(kit, iA2 + 3, 1, FILL, gain=1.0)
    sg.drums(kit, iB, 4, D_B, gain=0.95)
    sg.drums(kit, iBr, 1, {'t3': 'x.......x.......'}, gain=0.8)
    sg.drums(kit, iBr + 1, 1, {'t3': 'x...x...x.x.x.xx', 't2': '..........x.x...'}, gain=0.9)
    sg.drums(kit, iC, 3, D_C, gain=1.1)
    sg.drums(kit, iC + 3, 1, {'k': 'x...x...x.......', 's': '........x.......', 't1': '..........x.....', 't2': '............x...', 't3': '..............xx'}, gain=1.1)
    for bar in (iA, iA2, iB, iC):
        sg.drums(kit, bar, 1, {'c': 'x...............', 'g': 'x...............'}, gain=0.8)
    sg.drums(kit, iBr + 1, 1, {'g': 'x...............'}, gain=0.5)
    sg.drums(kit, iI, 1, {'g': 'x...............'}, gain=0.7)
    sg.drums(kit, iC + 3, 1, {'x': '........x.......', 'g': '........x.......'}, gain=1.0)
    y = S.reverse(S.crash(rng, int(3.0 * SR), 1.3))
    sg.put('fx', y * 0.9, sg.t_step(iC * 16) - len(y) / SR, 0.8)
    sg.note('fx', ID.i_impact, iC * 16, 30, 28, gain=0.9)
    sg.note('fx', ID.i_impact, (iC + 3) * 16 + 8, 30, 28, gain=0.9)

    sg.duck(['drone', 'choir'], 0.3, 0.2)
    sg.trim = {'fb': 2.0, 'drone': 3.0, 'rumble': 0.0, 'gtrL': 2.0, 'gtrR': 1.5, 'bass': -5.0, 'lead': 8.0, 'choir': 15.0, 'drums': -4.0, 'fx': 0.0}
    ID.automate(sg, [(0, -5), (2, -1), (10, -3), (14, -8), (15.5, -4), (16, 2), (19, 2), (20, -5)])
    sg.post.append(lambda mix, song: TP.tape_color(mix, np.random.default_rng(71), drive=1.4, lp_hz=10500, hiss_level=0.003))
    gtr = lambda: [HighpassFilter(85), Distortion(drive_db=24), LowpassFilter(4800), Reverb(room_size=0.3, wet_level=0.1, dry_level=0.95)]
    fx = {
        'fb': [Reverb(room_size=0.9, wet_level=0.4, dry_level=0.7)],
        'drone': [LowpassFilter(400), Reverb(room_size=0.85, wet_level=0.3, dry_level=0.8)],
        'rumble': [LowpassFilter(200)],
        'gtrL': gtr(), 'gtrR': gtr(),
        'bass': [Distortion(drive_db=8), LowpassFilter(1100)],
        'lead': [Distortion(drive_db=14), LowpassFilter(4600), Reverb(room_size=0.7, wet_level=0.25, dry_level=0.85)],
        'choir': [Reverb(room_size=0.95, wet_level=0.5, dry_level=0.5)],
        'drums': [Reverb(room_size=0.5, wet_level=0.2, dry_level=0.9), Compressor(threshold_db=-16, ratio=2.4, attack_ms=10, release_ms=120)],
    }
    sg.sends = {'lead': {'echo': 0.3}, 'fb': {'echo': 0.3}, 'fx': {'verb': 0.3}, 'drums': {'verb': 0.08}}
    return sg, fx, aux_default(70, room=0.85, delay_fb=0.4, delay_beats=1.5)
