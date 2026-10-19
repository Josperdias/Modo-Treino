"""Motor de composição: escalas, acordes, melodias geradas por regras de teoria, baixos, arpejos, baterias e mixagem em barramentos."""
import numpy as np
from pedalboard import Pedalboard, Reverb, Delay, Chorus, Compressor, Limiter, HighpassFilter, LowpassFilter, Distortion, Gain, Bitcrush, Phaser
import synth as S
from synth import SR

SCALES = {
    'minor': [0, 2, 3, 5, 7, 8, 10], 'major': [0, 2, 4, 5, 7, 9, 11], 'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10], 'lydian': [0, 2, 4, 6, 7, 9, 11], 'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'harmonic': [0, 2, 3, 5, 7, 8, 11], 'phrygdom': [0, 1, 4, 5, 7, 8, 10],
}


def deg(root, scale, d):
    sc = SCALES[scale]
    o, i = divmod(int(d), len(sc))
    return root + 12 * o + sc[i]


def triad(root, scale, d, seventh=False):
    t = [deg(root, scale, d), deg(root, scale, d + 2), deg(root, scale, d + 4)]
    if seventh:
        t.append(deg(root, scale, d + 6))
    return t


# padrões rítmicos de um compasso (16 passos): (passo, duração)
RHYTHMS = [
    [(0, 3), (3, 3), (6, 2), (8, 4), (12, 4)],
    [(0, 2), (2, 2), (4, 4), (8, 2), (10, 2), (12, 4)],
    [(0, 4), (4, 2), (6, 2), (8, 3), (11, 3), (14, 2)],
    [(0, 1), (1, 1), (2, 2), (4, 3), (7, 1), (8, 4), (12, 2), (14, 2)],
    [(2, 2), (4, 2), (6, 2), (8, 2), (10, 2), (12, 4)],
    [(0, 6), (6, 2), (8, 2), (10, 2), (12, 4)],
    [(0, 2), (3, 1), (4, 2), (7, 1), (8, 2), (11, 1), (12, 4)],
    [(0, 8), (8, 4), (12, 2), (14, 2)],
]
CALM = [RHYTHMS[5], RHYTHMS[7], RHYTHMS[0], RHYTHMS[2]]
BUSY = [RHYTHMS[3], RHYTHMS[6], RHYTHMS[4], RHYTHMS[1]]


def motif(seed, scale, root, chord_degs, lo, hi, rhythms, start=None, arch=0.5):
    """Melodia de N compassos sobre `chord_degs` (grau do acorde por compasso).
    Teoria: tempos fortes (passo %4==0) caem em notas do acorde; o resto anda por grau conjunto; saltos <= 4 graus;
    a última nota é nota do acorde. Mesma `seed` = contorno parecido em outro acorde (resposta de frase)."""
    rng = np.random.default_rng(seed)
    cur = start if start is not None else (lo + hi) // 2
    notes = []
    for b, cd in enumerate(chord_degs):
        pat = rhythms[int(rng.integers(len(rhythms)))]
        tones = {(cd) % 7, (cd + 2) % 7, (cd + 4) % 7}
        for (st, ln) in pat:
            strong = st % 4 == 0
            direction = 1 if rng.random() < (arch if b < len(chord_degs) / 2 else 1 - arch) else -1
            if strong:
                cands = [d for d in range(lo, hi + 1) if d % 7 in tones and abs(d - cur) <= 4]
                if not cands:
                    cands = [d for d in range(lo, hi + 1) if d % 7 in tones]
                cands.sort(key=lambda d: (abs(d - cur), -direction * (d - cur)))
                pick = cands[int(rng.integers(min(2, len(cands))))]
            else:
                step = int(rng.integers(1, 3)) * direction
                pick = min(hi, max(lo, cur + step))
            cur = pick
            notes.append((b * 16 + st, deg(root, scale, pick), ln, pick))
        # fecha o compasso no acorde se for o último
    if notes:
        last = notes[-1]
        cd = chord_degs[-1]
        tones = [d for d in range(lo, hi + 1) if d % 7 in {cd % 7, (cd + 2) % 7, (cd + 4) % 7}]
        tones.sort(key=lambda d: abs(d - last[3]))
        notes[-1] = (last[0], deg(root, scale, tones[0]), last[2], tones[0])
    return notes


def shift_notes(notes, step_off, semis=0):
    return [(s + step_off, m + semis, l, d) for (s, m, l, d) in notes]


BASS = {
    'root8': [(0, 'r', 2), (2, 'r', 2), (4, 'r', 2), (6, 'r', 2), (8, 'r', 2), (10, 'r', 2), (12, 'r', 2), (14, 'r', 2)],
    'octave': [(0, 'r', 2), (3, 'o', 1), (4, 'r', 2), (7, 'o', 1), (8, 'r', 2), (11, 'o', 1), (12, 'f', 2), (14, 'o', 2)],
    'walk': [(0, 'r', 4), (4, 'f', 4), (8, 'o', 4), (12, 'f', 4)],
    'funk': [(0, 'r', 2), (2, 'r', 1), (4, 'o', 1), (6, 'r', 2), (8, 'f', 1), (10, 'r', 2), (12, 'o', 1), (13, 'f', 1), (14, 'r', 2)],
    'pedal': [(0, 'r', 16)],
    'half': [(0, 'r', 8), (8, 'f', 8)],
    'gallop': [(0, 'r', 1), (1, 'r', 1), (2, 'r', 2), (4, 'r', 1), (5, 'r', 1), (6, 'r', 2), (8, 'r', 1), (9, 'r', 1), (10, 'r', 2), (12, 'r', 1), (13, 'r', 1), (14, 'r', 2)],
    'bounce': [(0, 'r', 3), (3, 'r', 1), (6, 'f', 2), (8, 'r', 3), (11, 'o', 1), (14, 'f', 2)],
}
ARPS = {
    'up': [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
    'updown': [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1],
    'wide': [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3],
    'down': [3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0],
    'sixt': [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 2, 3],
    'slow': [0, None, 1, None, 2, None, 1, None, 0, None, 1, None, 2, None, 3, None],
}
DRUMS = {
    'four': {'k': 'x...x...x...x...', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..x...x...x...x.'},
    'funk': {'k': 'x..x..x...x.x...', 's': '....x..x.x..x...', 'h': 'xxxxxxxxxxxxxxxx', 'o': '......x.......x.'},
    'break': {'k': 'x.....x...x.....', 's': '....x.......x..x', 'h': 'x.x.x.x.x.x.x.xx', 'o': '.......x........'},
    'half': {'k': 'x...............', 's': '........x.......', 'h': 'x...x...x...x...', 'o': ''},
    'double': {'k': 'x.x.x.x.x.x.x.x.', 's': '..x...x...x...x.', 'h': 'xxxxxxxxxxxxxxxx', 'o': ''},
    'light': {'k': 'x.......x.......', 's': '........x.......', 'h': '..x...x...x...x.', 'o': ''},
    'tick': {'k': 'x...x...x...x...', 's': '', 'h': 'x.x.x.x.x.x.x.x.', 'o': ''},
    'none': {'k': '', 's': '', 'h': '', 'o': ''},
}


class Song:
    def __init__(self, bpm, bars, tail=3.0, swing=0.0, seed=1, name=''):
        self.bpm, self.bars, self.swing = bpm, bars, swing
        self.step_s = 60.0 / bpm / 4.0
        self.n_steps = bars * 16
        self.loop_n = int(round(self.n_steps * self.step_s * SR))
        self.N = self.loop_n + int(tail * SR)
        self.rng = np.random.default_rng(seed)
        self.buses = {}
        self.fx = {}
        self.name = name

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros((2, self.N), dtype=np.float64)
        return self.buses[name]

    def t_step(self, step):
        t = step * self.step_s
        if self.swing and int(step) % 2 == 1:
            t += self.swing * self.step_s
        return t

    def put(self, bus, sig, t0, gain=1.0, pan=0.0):
        b = self.bus(bus)
        i = int(round(t0 * SR))
        if i >= self.N or i < 0:
            return
        n = min(len(sig), self.N - i)
        a = (pan + 1.0) * np.pi / 4.0
        b[0, i:i + n] += sig[:n] * np.cos(a) * gain
        b[1, i:i + n] += sig[:n] * np.sin(a) * gain

    def note(self, bus, fn, step, midi, len_steps, gain=1.0, pan=0.0, **kw):
        dur = max(0.04, len_steps * self.step_s)
        sig = fn(self, midi, dur, **kw)
        self.put(bus, sig, self.t_step(step), gain, pan)

    def finalize(self, fx, target_db=-17.0, ceiling_db=-1.2):
        mix = np.zeros((2, self.N), dtype=np.float32)
        for name, buf in self.buses.items():
            chain = fx.get(name)
            x = buf.astype(np.float32)
            if chain:
                x = Pedalboard(chain)(x, SR, reset=True)
            mix += x
        # dobra a cauda (reverb/delay) sobre o começo: loop sem emenda
        tail = mix[:, self.loop_n:]
        out = mix[:, :self.loop_n].copy()
        m = min(tail.shape[1], out.shape[1])
        out[:, :m] += tail[:, :m]
        # nivela por RMS e limita
        rms = np.sqrt(np.mean(out.astype(np.float64) ** 2) + 1e-12)
        g = 10 ** (target_db / 20.0) / rms
        out = out * g
        out = Pedalboard([HighpassFilter(28), Compressor(threshold_db=-14, ratio=2.2, attack_ms=12, release_ms=120), Limiter(threshold_db=ceiling_db)])(out, SR)
        # teto duro e entrada suave (3 ms) para o loop não estalar na emenda
        lim = 10 ** (ceiling_db / 20.0)
        pk = float(np.max(np.abs(out)))
        if pk > lim:
            out = out * (lim / pk)
        k = int(0.003 * SR)
        out[:, :k] *= np.linspace(0, 1, k)
        out[:, -k:] *= np.linspace(1, 0, k)
        return out


# ---------------- instrumentos (mono) ----------------

def _vel(v):
    return 0.35 + 0.65 * v


def i_pulse(song, midi, dur, duty=0.25, vib=0.0, a=0.003, d=0.08, s=0.65, r=0.04, vel=0.9, slide=0.0):
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.5 * np.maximum(0, t - 0.12)) * np.minimum(1, t / 0.4))
    if slide:
        f = f * (1 + slide * np.exp(-t / 0.05))
    return S.pulse(f, n, duty) * S.env_adsr(n, a, d, s, r) * _vel(vel) * 0.5


def i_tri(song, midi, dur, bits=4, r=0.02, vel=0.9):
    n = int((dur + r) * SR)
    return S.tri(S.hz(midi), n, bits) * S.env_adsr(n, 0.002, 0.02, 0.95, r) * _vel(vel) * 0.8


def i_saw(song, midi, dur, cutoff=1800, a=0.004, d=0.1, s=0.6, r=0.04, vel=0.9, det=0.0):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = S.saw(f, n)
    if det:
        y = (y + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n)) / 3.0
    return S.lp(y, cutoff) * S.env_adsr(n, a, d, s, r) * _vel(vel) * 0.55


def i_pad(song, midi, dur, cutoff=1400, a=0.35, r=0.5, vel=0.7, det=0.006):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n) + 0.5 * S.pulse(f * 0.5, n, 0.5)) / 3.5
    y = S.lp(y, cutoff)
    return y * S.env_adsr(n, a, 0.2, 0.85, r) * _vel(vel) * 0.45


def i_fm(song, midi, dur, ratio=2.0, index=2.5, tau=0.25, r=0.1, vel=0.9, fb=0.0):
    n = int((dur + r) * SR)
    ie = np.exp(-S.tt(n) / tau)
    y = S.fm(S.hz(midi), n, ratio, index, ie)
    return y * S.env_adsr(n, 0.002, tau, 0.35, r) * _vel(vel) * 0.55


def i_bell(song, midi, dur, kind='bell', tilt=1.0, vel=0.9):
    n = int((max(dur, 0.2) + 0.6 * tilt) * SR)
    return S.modal(S.hz(midi), n, kind, tilt) * _vel(vel) * 0.8


def i_ks(song, midi, dur, decay=0.996, bright=0.5, vel=0.9):
    n = int((dur + 0.3) * SR)
    y = S.karplus(S.hz(midi), n, song.rng, decay, bright)
    return y * _vel(vel) * 0.7


def i_bubble(song, midi, dur, rise=0.2, tau=0.06, vel=0.9):
    n = int((max(dur, 0.25)) * SR)
    return S.bubble(S.hz(midi), n, rise, tau) * _vel(vel) * 0.9


def i_organ(song, midi, dur, vel=0.8, r=0.06):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = sum(a * S.sine(f * h, n) for h, a in [(1, 1.0), (2, 0.5), (3, 0.3), (4, 0.2), (6, 0.12)]) / 2.2
    return y * S.env_adsr(n, 0.02, 0.05, 0.9, r) * _vel(vel) * 0.55


def i_brass(song, midi, dur, vel=0.9, cutoff=2600, r=0.05):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    t = S.tt(n)
    c = cutoff * (0.35 + 0.65 * np.minimum(1, t / 0.08))
    y = (S.saw(f, n) + 0.8 * S.saw(f * 1.004, n)) / 1.8
    # filtro com corte variável aproximado por mistura
    lo, hi = S.lp(y, 700), S.lp(y, cutoff)
    w = np.minimum(1, t / 0.09)
    y = lo * (1 - w) + hi * w
    return y * S.env_adsr(n, 0.01, 0.1, 0.8, r) * _vel(vel) * 0.55


def play_chord(song, bus, inst, tones, step, len_steps, gain=1.0, pan=0.0, spread=0.0, **kw):
    for k, m in enumerate(tones):
        song.note(bus, inst, step + k * spread, m, len_steps, gain=gain / max(1.0, len(tones) ** 0.5), pan=pan + (k - (len(tones) - 1) / 2) * 0.25, **kw)


# ---------------- camadas ----------------

def lay_bass(song, bus, inst, roots, style, gain=1.0, octave_shift=0, pan=0.0, **kw):
    """roots: nota-raiz (midi) por compasso."""
    for b, r in enumerate(roots):
        for (st, kind, ln) in BASS[style]:
            m = r + octave_shift + (12 if kind == 'o' else 7 if kind == 'f' else 0)
            song.note(bus, inst, b * 16 + st, m, ln, gain=gain, pan=pan, **kw)


def lay_arp(song, bus, inst, chords, style, gain=1.0, step_len=1, pan=0.0, lift=0, **kw):
    """chords: lista de acordes (lista de midi) por compasso."""
    pat = ARPS[style]
    for b, ch in enumerate(chords):
        for k, ix in enumerate(pat):
            if ix is None:
                continue
            m = ch[ix % len(ch)] + (12 if ix >= len(ch) else 0) + lift
            song.note(bus, inst, b * 16 + k, m, step_len, gain=gain, pan=pan * (1 if k % 2 else -1), vel=0.55 + 0.45 * (k % 4 == 0), **kw)


def lay_melody(song, bus, inst, notes, bar0, gain=1.0, pan=0.0, **kw):
    for (st, m, ln, _d) in notes:
        song.note(bus, inst, bar0 * 16 + st, m, ln, gain=gain, pan=pan, vel=0.95 if st % 4 == 0 else 0.75, **kw)


def lay_pad(song, bus, inst, chords, bar0=0, bars_each=1, gain=1.0, pan=0.0, **kw):
    for i, ch in enumerate(chords):
        for m in ch:
            song.note(bus, inst, (bar0 + i * bars_each) * 16, m, bars_each * 16, gain=gain / len(ch) ** 0.5, pan=pan, **kw)


def lay_drums(song, style, bar0, bars, gain=1.0, kit='chip', fills=True, hat_gain=1.0, pan_hat=0.2):
    spec = DRUMS[style]
    rng = song.rng
    for b in range(bar0, bar0 + bars):
        for st in range(16):
            gstep = b * 16 + st
            t = song.t_step(gstep)
            if kit == 'chip':
                if spec['k'] and spec['k'][st] == 'x':
                    song.put('drums', S.chip_kick(), t, 0.9 * gain)
                if spec['s'] and spec['s'][st] == 'x':
                    song.put('drums', S.chip_snare(), t, 0.7 * gain)
                if spec['h'] and spec['h'][st] == 'x':
                    song.put('drums', S.chip_hat(), t, 0.35 * gain * hat_gain, pan_hat * (1 if st % 4 == 2 else -1))
                if spec['o'] and spec['o'][st] == 'x':
                    song.put('drums', S.chip_hat(open_=True), t, 0.32 * gain * hat_gain, pan_hat)
            else:
                if spec['k'] and spec['k'][st] == 'x':
                    song.put('drums', S.kick(), t, 0.95 * gain)
                if spec['s'] and spec['s'][st] == 'x':
                    song.put('drums', S.snare(rng), t, 0.7 * gain)
                if spec['h'] and spec['h'][st] == 'x':
                    song.put('drums', S.hat(rng), t, 0.45 * gain * hat_gain, pan_hat * (1 if st % 4 == 2 else -1))
                if spec['o'] and spec['o'][st] == 'x':
                    song.put('drums', S.hat(rng, open_=True), t, 0.4 * gain * hat_gain, pan_hat)
        # virada no último compasso de cada 4
        if fills and (b % 4 == 3) and spec['s']:
            for k in range(8):
                t = song.t_step(b * 16 + 8 + k)
                snr = S.chip_snare() if kit == 'chip' else S.snare(rng)
                song.put('drums', snr, t, (0.35 + 0.05 * k) * gain)


def chords_of(root, scale, progression, seventh=False):
    return [triad(root, scale, d, seventh) for d in progression]


def roots_of(root, scale, progression, octave=-24):
    return [deg(root, scale, d) + octave for d in progression]


def loop_score(buf, sr=SR):
    """Descontinuidade na emenda do loop (0 = perfeito): salto entre o fim e o começo comparado ao passo típico."""
    mono = buf.mean(axis=0)
    jump = abs(mono[0] - mono[-1])
    typical = np.mean(np.abs(np.diff(mono))) + 1e-9
    return float(jump / (typical * 6.0))
