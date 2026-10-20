"""Motor de composição v2: partitura escrita à mão (grade de passos), acordes por nome, baixo/arpejo/bateria por padrões,
barramentos com efeitos, sidechain, envios (reverb/eco) e ganchos de pós-produção (fita). Compassos de qualquer tamanho (spb)."""
import re
import numpy as np
from pedalboard import Pedalboard, Reverb, Delay, Chorus, Compressor, Limiter, HighpassFilter, LowpassFilter
import synth as S
from synth import SR
import compose as C  # instrumentos mono já prontos

NOTE = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def midi_of(tok):
    m = re.fullmatch(r"([a-g])([#b]?)(-?\d)", tok)
    if not m:
        raise ValueError(f'nota inválida: {tok!r}')
    pc = NOTE[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + pc


def parse(text, spb=16):
    """Partitura em texto. Um compasso = `spb` fichas separadas por espaço; compassos separados por `|` (opcional).
    ficha: nota (c4, f#3, bb2) | `-` segura | `.` pausa. Sufixos: `!` acento, `'` staccato, `_` fantasma.
    Devolve [(passo, midi, duração, vel)] com passo absoluto a partir do início do texto."""
    segs = [g for g in text.strip().split('|') if g.strip()]
    toks = []
    for bi, g in enumerate(segs):
        tk = g.split()
        if len(tk) != spb:
            raise ValueError(f'compasso {bi + 1} tem {len(tk)} fichas (esperado {spb}): {g.strip()[:60]}')
        toks += tk
    out = []
    cur = None
    for i, t in enumerate(toks):
        if t == '-':
            if cur is not None:
                cur[2] += 1
            continue
        if t == '.':
            cur = None
            continue
        vel, stac = 0.85, False
        while t[-1] in "!'_":
            if t[-1] == '!': vel = 1.0
            elif t[-1] == '_': vel = 0.5
            else: stac = True
            t = t[:-1]
        cur = [i, midi_of(t), 1, vel, stac]
        out.append(cur)
    res = []
    for st, m, ln, v, stac in out:
        res.append((st, m, 1 if stac else ln, v))
    return res


def shift(notes, step=0, semis=0, vel=None):
    return [(s + step, m + semis, l, (vel if vel is not None else v)) for (s, m, l, v) in notes]


def bars_of(notes, spb, bar0, nbars):
    """Recorta as notas de [bar0, bar0+nbars) e renumera para começar em 0."""
    a, b = bar0 * spb, (bar0 + nbars) * spb
    return [(s - a, m, l, v) for (s, m, l, v) in notes if a <= s < b]


QUAL = {
    '': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10), 'm7': (0, 3, 7, 10), 'maj7': (0, 4, 7, 11), 'add9': (0, 4, 7, 14),
    'm9': (0, 3, 7, 10, 14), 'sus4': (0, 5, 7), 'sus2': (0, 2, 7), 'dim': (0, 3, 6), 'm7b5': (0, 3, 6, 10), '5': (0, 7),
    '6': (0, 4, 7, 9), 'm6': (0, 3, 7, 9), 'aug': (0, 4, 8), '7sus4': (0, 5, 7, 10), 'maj9': (0, 4, 7, 11, 14), 'dim7': (0, 3, 6, 9),
    '9': (0, 4, 7, 10, 14), 'm11': (0, 3, 7, 10, 17),
}
PC = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def chord_spec(name):
    m = re.fullmatch(r"([A-G])([#b]?)(.*)", name)
    if not m:
        raise ValueError(f'acorde inválido: {name!r}')
    pc = PC[m.group(1).lower()] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    q = m.group(3)
    if q not in QUAL:
        raise ValueError(f'qualidade desconhecida: {q!r} em {name!r}')
    return pc % 12, q


class Harmony:
    """Progressão por compasso: 'Am F C G' (um acorde por compasso) ou 'Am_E' (dois por compasso, divididos em partes iguais)."""

    def __init__(self, text, spb=16):
        self.spb = spb
        self.bars = []
        for tok in text.split():
            parts = tok.split('_')
            L = spb // len(parts)
            ev = []
            for k, p in enumerate(parts):
                ev.append((k * L, L if k < len(parts) - 1 else spb - k * L, *chord_spec(p)))
            self.bars.append(ev)

    def __len__(self):
        return len(self.bars)

    def transposed(self, semis):
        h = Harmony('', self.spb)
        h.bars = [[(st, ln, (pc + semis) % 12, q) for (st, ln, pc, q) in b] for b in self.bars]
        return h

    def __add__(self, other):
        h = Harmony('', self.spb)
        h.bars = self.bars + other.bars
        return h

    def events(self):
        """[(passo_abs, dur, pc, qual)]"""
        out = []
        for b, ev in enumerate(self.bars):
            for st, ln, pc, q in ev:
                out.append((b * self.spb + st, ln, pc, q))
        return out


def tones(pc, q, base):
    """Notas do acorde acima de `base` (midi) com a raiz mais próxima de baixo."""
    root = base + ((pc - base) % 12)
    return [root + i for i in QUAL[q]]


def voice(prev, pc, q, lo, hi, n=4):
    """Escolhe a inversão que menos se move em relação ao acorde anterior (conduz as vozes)."""
    base = []
    ts = [(pc + i) for i in QUAL[q]]
    pcs = sorted({t % 12 for t in ts}, key=lambda p: ts.index(next(t for t in ts if t % 12 == p)))
    cands = []
    for root_oct in range(lo - 12, hi):
        for inv in range(len(pcs)):
            order = pcs[inv:] + pcs[:inv]
            v, cur = [], root_oct
            for p in order:
                m = cur + ((p - cur) % 12)
                v.append(m)
                cur = m
            if lo <= v[0] and v[-1] <= hi:
                cands.append(v[:max(n, 3)] if len(v) >= n else v)
    if not cands:
        return tones(pc, q, lo)
    if prev is None:
        mid = (lo + hi) / 2
        return min(cands, key=lambda v: abs(np.mean(v) - mid))
    return min(cands, key=lambda v: sum(abs(a - b) for a, b in zip(sorted(v), sorted(prev))) + 0.3 * abs(len(v) - len(prev)))


def add(*xs):
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[:len(x)] += x
    return out


DRUM_FN = {}


class Song:
    def __init__(self, bpm, bars, spb=16, tail=3.0, swing=0.0, seed=1, name=''):
        self.bpm, self.bars, self.spb, self.swing = bpm, bars, spb, swing
        self.step_s = 60.0 / bpm / 4.0
        self.n_steps = bars * spb
        self.loop_n = int(round(self.n_steps * self.step_s * SR))
        self.N = self.loop_n + int(tail * SR)
        self.rng = np.random.default_rng(seed)
        self.buses = {}
        self.sends = {}
        self.ducks = []
        self.post = []
        self.name = name
        self.kick_steps = []
        self.lead_notes = []
        self.trim = {}  # ganho final por barramento (dB), aplicado antes de tudo: equilibra a mixagem sem mexer nas partituras

    # ---- mix
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

    def line(self, bus, fn, notes, bar0, gain=1.0, pan=0.0, vel_scale=1.0, **kw):
        base = bar0 * self.spb
        for (st, m, ln, v) in notes:
            self.note(bus, fn, base + st, m, ln, gain=gain, pan=pan, vel=min(1.0, v * vel_scale), **kw)

    def sample(self, bus, sig, step, gain=1.0, pan=0.0, offset_s=0.0):
        self.put(bus, sig, self.t_step(step) + offset_s, gain, pan)

    # ---- camadas automáticas a partir da harmonia
    def pads(self, bus, fn, harm, bar0, lo, hi, gain=1.0, pan=0.0, n=4, split=True, **kw):
        prev = None
        for (st, ln, pc, q) in harm.events():
            v = voice(prev, pc, q, lo, hi, n)
            prev = v
            for k, m in enumerate(v):
                self.note(bus, fn, bar0 * self.spb + st, m, ln, gain=gain / len(v) ** 0.5,
                          pan=pan + ((k - (len(v) - 1) / 2) * 0.3 if split else 0), **kw)

    def bass(self, bus, fn, harm, bar0, pattern, gain=1.0, octave=36, pan=0.0, **kw):
        """pattern: `spb` fichas por compasso: r=raiz 5=quinta 3=terça o=oitava b=blue(7ª) a=aproximação cromática ao próximo acorde,
        - segura, . pausa. Maiúscula = acento. Ex.: 'R . . r . . 5 . R . . r . o 5 .'"""
        toks = pattern.split()
        assert len(toks) == self.spb, f'padrão de baixo com {len(toks)} fichas (spb={self.spb})'
        evs = harm.events()
        for bi in range(len(harm)):
            ch = [e for e in evs if e[0] // self.spb == bi]
            for k in range(self.spb):
                t = toks[k]
                if t in '.-':
                    continue
                step_abs = bi * self.spb + k
                cur = [e for e in ch if e[0] <= step_abs < e[0] + e[1]][0]
                pc, q = cur[2], cur[3]
                root = octave + ((pc - octave) % 12)
                kind = t.lower()
                off = {'r': 0, '5': 7, '3': (3 if q.startswith('m') or q.startswith('dim') else 4), 'o': 12, 'b': 10, 'a': None}[kind]
                if off is None:
                    nxt = [e for e in evs if e[0] > step_abs]
                    npc = nxt[0][2] if nxt else pc
                    nroot = octave + ((npc - octave) % 12)
                    m = nroot - 1 if (nroot - root) % 12 != 0 else nroot + 2
                else:
                    m = root + off
                ln = 1
                while k + ln < self.spb and toks[k + ln] == '-':
                    ln += 1
                self.note(bus, fn, bar0 * self.spb + step_abs, m, ln, gain=gain, pan=pan, vel=1.0 if t.isupper() else 0.8, **kw)

    def arp(self, bus, fn, harm, bar0, pattern, lo=60, gain=1.0, pan=0.0, step_len=1, **kw):
        """pattern: `spb` fichas: índice do tom do acorde (0..), +/- para oitava (ex. '0 1 2 3', '5' = 2º tom na oitava acima), '.' pausa."""
        toks = pattern.split()
        assert len(toks) == self.spb, f'padrão de arpejo com {len(toks)} fichas (spb={self.spb})'
        evs = harm.events()
        for bi in range(len(harm)):
            for k, t in enumerate(toks):
                if t == '.':
                    continue
                step_abs = bi * self.spb + k
                cur = [e for e in evs if e[0] <= step_abs < e[0] + e[1]][-1]
                tn = tones(cur[2], cur[3], lo)
                ix = int(t)
                m = tn[ix % len(tn)] + 12 * (ix // len(tn))
                self.note(bus, fn, bar0 * self.spb + step_abs, m, step_len, gain=gain, pan=pan * (1 if k % 2 else -1), vel=0.6 + 0.4 * (k % 4 == 0), **kw)

    def fast_arp(self, bus, harm, bar0, lo=60, gain=0.5, rate_hz=60.0, duty=0.25, pan=0.0, n=3, vol=0.8, d=0.12):
        """Acorde 'de NES': um canal de pulso que troca de nota 60 vezes por segundo (soa como acorde)."""
        for (st, ln, pc, q) in harm.events():
            tn = tones(pc, q, lo)[:n]
            dur = ln * self.step_s
            nn = int(dur * SR)
            t = S.tt(nn)
            idx = (t * rate_hz).astype(int) % len(tn)
            f = np.array([S.hz(m) for m in tn])[idx]
            sig = S.pulse(f, nn, duty) * S.env_adsr(nn, 0.003, d, vol, 0.03) * 0.4
            self.put(bus, sig, self.t_step(bar0 * self.spb + st), gain, pan)

    # ---- bateria
    def drums(self, kit, bar0, bars, pat, gain=1.0, fill=None):
        """pat: dict instrumento -> string de `spb` caracteres (x batida, X acento, o fantasma, . nada)."""
        for b in range(bar0, bar0 + bars):
            for ins, s in pat.items():
                if not s:
                    continue
                assert len(s) == self.spb, f'bateria {ins!r} com {len(s)} passos (spb={self.spb})'
                for k, ch in enumerate(s):
                    if ch == '.':
                        continue
                    v = {'x': 0.8, 'X': 1.0, 'o': 0.4}[ch]
                    step = b * self.spb + k
                    if ins == 'k':
                        self.kick_steps.append(step)
                    self.sample('drums', kit(ins, self.rng, v), step, gain=gain)

    def duck(self, buses, depth=0.55, rel=0.14, steps=None):
        self.ducks.append((buses, depth, rel, steps))

    # ---- render
    def finalize(self, fx, aux, target_db=-17.0, ceiling_db=-1.2, final_db=-14.8):
        for b, db in self.trim.items():
            if b in self.buses:
                self.buses[b] = self.buses[b] * 10 ** (db / 20.0)
        # sidechain nos barramentos escolhidos
        for buses, depth, rel, steps in self.ducks:
            ks = steps if steps is not None else self.kick_steps
            if not ks:
                continue
            g = np.ones(self.N)
            for st in ks:
                i = int(self.t_step(st) * SR)
                if i >= self.N:
                    continue
                m = min(self.N - i, int(rel * 6 * SR))
                curve = 1 - depth * np.exp(-np.arange(m) / (rel * SR))
                g[i:i + m] = np.minimum(g[i:i + m], curve)
            for b in buses:
                if b in self.buses:
                    self.buses[b] = self.buses[b] * g
        # envios (reverb/eco compartilhados)
        auxbuf = {a: np.zeros((2, self.N)) for a in aux}
        for bname, sends in self.sends.items():
            if bname in self.buses:
                for a, lvl in sends.items():
                    auxbuf[a] += self.buses[bname] * lvl
        mix = np.zeros((2, self.N), dtype=np.float32)
        for name, buf in self.buses.items():
            x = buf.astype(np.float32)
            chain = fx.get(name)
            if chain:
                x = Pedalboard(chain)(x, SR, reset=True)
            mix += x
        for a, buf in auxbuf.items():
            mix += Pedalboard(aux[a])(buf.astype(np.float32), SR, reset=True)
        # cauda dobrada no começo: o loop não tem emenda
        tail = mix[:, self.loop_n:]
        out = mix[:, :self.loop_n].copy()
        m = min(tail.shape[1], out.shape[1])
        out[:, :m] += tail[:, :m]
        out = out.astype(np.float64)
        for fn in self.post:
            out = fn(out, self)
        lim = 10 ** (ceiling_db / 20.0)
        base = out.copy()
        gain = 10 ** (target_db / 20.0) / np.sqrt(np.mean(base ** 2) + 1e-12)
        for _ in range(4):  # iguala o volume final (depois do limitador) de todas as faixas
            o = Pedalboard([HighpassFilter(26), Compressor(threshold_db=-14, ratio=2.4, attack_ms=10, release_ms=110), Limiter(threshold_db=ceiling_db)])((base * gain).astype(np.float32), SR)
            r = float(np.sqrt(np.mean(o.astype(np.float64) ** 2) + 1e-12))
            err = 20 * np.log10(10 ** (final_db / 20.0) / r)
            if abs(err) < 0.4:
                break
            gain *= 10 ** (err / 20.0)
        out = o
        pk = float(np.max(np.abs(out)))
        if pk > lim:
            out = out * (lim / pk)
        k = int(0.003 * SR)
        out[:, :k] *= np.linspace(0, 1, k)
        out[:, -k:] *= np.linspace(1, 0, k)
        return out


# ---------------- instrumentos novos (mesma assinatura: song, midi, dur, **kw) ----------------

def _v(v):
    return 0.35 + 0.65 * v


def i_nes(song, midi, dur, duty=0.25, vib=0.0, vib_delay=0.15, decay=0.0, a=0.002, r=0.03, vel=0.9, slide=0.0, duty2=None):
    """Pulso de NES com macro de volume (decay = tempo de queda exponencial; 0 = sustenta) e ciclo de duty opcional."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.8 * np.maximum(0, t - vib_delay)) * np.minimum(1, np.maximum(0, t - vib_delay) / 0.2))
    if slide:
        f = f * (1 + slide * np.exp(-t / 0.04))
    d = duty if duty2 is None else np.where((t * 20).astype(int) % 2 == 0, duty, duty2)
    env = S.env_adsr(n, a, 0.02, 1.0, r)
    if decay:
        env = env * (0.25 + 0.75 * np.exp(-t / decay))
    return S.pulse(f, n, d) * env * _v(vel) * 0.5


def i_vrc6(song, midi, dur, vel=0.9, r=0.03, decay=0.0, vib=0.0):
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.5 * np.maximum(0, t - 0.15)))
    env = S.env_adsr(n, 0.003, 0.03, 0.9, r)
    if decay:
        env = env * (0.3 + 0.7 * np.exp(-t / decay))
    return S.saw6(f, n) * env * _v(vel) * 0.5


def i_tri(song, midi, dur, bits=5, r=0.015, vel=0.9):
    n = int((dur + r) * SR)
    return S.tri(S.hz(midi), n, bits) * S.env_adsr(n, 0.002, 0.02, 0.95, r) * _v(vel) * 0.85


def i_fmep(song, midi, dur, tau=0.6, bright=1.0, vel=0.9, r=0.08):
    n = int((dur + r + 0.2) * SR)
    y = S.fm_ep(S.hz(midi), n, tau, bright)
    y[int((dur + r) * SR):] *= np.linspace(1, 0, n - int((dur + r) * SR))
    return y * _v(vel) * 0.55


def i_fmbass(song, midi, dur, tau=0.22, index=3.0, vel=0.9):
    n = int((dur + 0.1) * SR)
    return S.fm_bass(S.hz(midi), n, tau, index) * _v(vel) * 0.8


def i_super(song, midi, dur, cutoff=3200, spread=0.012, a=0.01, d=0.2, s=0.7, r=0.08, vel=0.9):
    n = int((dur + r) * SR)
    y = S.supersaw(S.hz(midi), n, spread)
    t = S.tt(n)
    lo, hi = S.lp(y, cutoff * 0.35), S.lp(y, cutoff)
    w = np.clip(t / 0.25, 0, 1)
    return (lo * (1 - w) + hi * w) * S.env_adsr(n, a, d, s, r) * _v(vel) * 0.5


def i_choir(song, midi, dur, vowel='a', a=0.12, r=0.3, vel=0.8):
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + 0.004 * np.sin(2 * np.pi * 5.0 * t) * np.minimum(1, t / 0.5))
    return S.formant(f, n, vowel, song.rng) * S.env_adsr(n, a, 0.1, 0.9, r) * _v(vel) * 0.7


def i_modal(song, midi, dur, kind='marimba', tilt=1.0, vel=0.9, tail=0.0):
    n = int((max(dur, 0.15) + (tail or 0.5 * tilt)) * SR)
    return S.modal(S.hz(midi), n, kind, tilt) * _v(vel) * 0.8


def i_pluck(song, midi, dur, decay=0.995, bright=0.45, vel=0.9):
    n = int((dur + 0.4) * SR)
    return S.karplus(S.hz(midi), n, song.rng, decay, bright) * _v(vel) * 0.7


def i_bub(song, midi, dur, rise=0.22, tau=0.07, vel=0.9):
    n = int(max(dur, 0.3) * SR)
    return S.bubble(S.hz(midi), n, rise, tau) * _v(vel) * 0.9


def i_pad(song, midi, dur, cutoff=1500, a=0.4, r=0.6, vel=0.7, det=0.007):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n) + 0.5 * S.pulse(f * 0.5, n, 0.5)) / 3.5
    return S.lp(y, cutoff) * S.env_adsr(n, a, 0.2, 0.85, r) * _v(vel) * 0.45


i_brass = C.i_brass


def i_glass(song, midi, dur, vel=0.9, tilt=1.0):
    return i_modal(song, midi, dur, 'glass', tilt, vel)


# ---------------- kits de bateria ----------------

def kit_chip(ins, rng, v):
    if ins == 'k': return S.chip_kick() * v
    if ins == 's': return S.chip_snare() * v * 0.5
    if ins == 'h': return S.chip_hat() * v * 0.3
    if ins == 'o': return S.chip_hat(open_=True) * v * 0.3
    if ins == 'c': return S.noise(14000, int(0.9 * SR)) * S.env_exp(int(0.9 * SR), 0.35) * 0.28 * v
    if ins in ('t1', 't2', 't3'): return S.tri(S.sweep({'t1': 220, 't2': 165, 't3': 120}[ins], 70, int(0.2 * SR)), int(0.2 * SR)) * S.env_exp(int(0.2 * SR), 0.09) * v
    if ins == 'r': return S.noise(30000, int(0.05 * SR), short=True) * S.env_exp(int(0.05 * SR), 0.015) * v * 0.6
    raise KeyError(ins)


def kit_sega(ins, rng, v):
    """Bateria 'de Mega Drive': kick/snare curtos e secos, hats de ruído branco filtrado."""
    if ins == 'k': return S.kick(None, 180, 48, 0.1, 0.35) * v
    if ins == 's': return S.snare(rng, None, 210, 0.07, 0.75) * v
    if ins == 'h': return S.hat(rng, None, 0.02) * v * 0.9
    if ins == 'o': return S.hat(rng, None, 0.02, True) * v * 0.8
    if ins == 'c': return S.crash(rng) * v
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 190, 't2': 140, 't3': 100}[ins]) * v
    if ins == 'r': return S.rim(rng) * v
    if ins == 'w': return S.wood(1100) * v
    if ins == 'sh': return S.shaker(rng) * v
    raise KeyError(ins)


def kit_taiko(ins, rng, v):
    if ins == 'k': return S.taiko(None, 118.0, 72.0, 0.3) * v * 0.45
    if ins == 's': return S.taiko(None, 150, 90, 0.2) * v * 0.7
    if ins == 'h': return S.shaker(rng) * v * 0.6
    if ins == 'o': return S.wood(700) * v
    if ins == 'c': return S.crash(rng, None, 1.2) * v
    if ins in ('t1', 't2', 't3'): return S.taiko(None, {'t1': 150, 't2': 120, 't3': 95}[ins], 70, 0.3) * v * 0.6
    if ins == 'r': return S.rim(rng) * v
    if ins == 'w': return S.wood(900) * v
    if ins == 'sh': return S.shaker(rng) * v
    raise KeyError(ins)


def kit_soft(ins, rng, v):
    """Bateria de fita velha: bumbo macio, estalo de caixa, chiado de chimbal."""
    if ins == 'k': return S.kick(None, 120, 52, 0.16, 0.1) * v * 0.9
    if ins == 's': return add(S.snare(rng, None, 180, 0.12, 0.6) * 0.8, S.rim(rng) * 0.2) * v
    if ins == 'h': return S.shaker(rng, None, 0.03) * v
    if ins == 'o': return S.shaker(rng, int(0.2 * SR), 0.1) * v
    if ins == 'c': return S.crash(rng, None, 0.5) * v * 0.7
    if ins == 'w': return S.wood(1300) * v
    if ins == 'r': return S.rim(rng) * v
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 200, 't2': 150, 't3': 110}[ins], None, 0.28) * v
    if ins == 'sh': return S.shaker(rng) * v
    raise KeyError(ins)


def kit_tick(ins, rng, v):
    """Relógio: madeiras secas e metal."""
    if ins == 'k': return S.wood(160, int(0.2 * SR), 0.07) * v * 1.2
    if ins == 's': return S.wood(950, None, 0.05) * v
    if ins == 'h': return S.wood(2200, int(0.04 * SR), 0.012) * v * 0.8
    if ins == 'o': return S.modal(2000, int(0.5 * SR), 'bell', 0.25) * v * 0.4
    if ins == 'c': return S.crash(rng, None, 0.4) * v * 0.6
    if ins in ('t1', 't2', 't3'): return S.wood({'t1': 520, 't2': 410, 't3': 330}[ins], None, 0.06) * v
    if ins == 'r': return S.rim(rng) * v
    if ins == 'w': return S.wood(1500) * v
    if ins == 'sh': return S.shaker(rng) * v
    raise KeyError(ins)


# ---------------- transformações de tema ----------------

def retro(notes, nsteps):
    """Retrógrado: toca o trecho de trás para frente (mantém as durações)."""
    return sorted([(nsteps - (s + l), m, l, v) for (s, m, l, v) in notes])


SCALE_PCS = {
    'minor': (0, 2, 3, 5, 7, 8, 10), 'major': (0, 2, 4, 5, 7, 9, 11), 'dorian': (0, 2, 3, 5, 7, 9, 10), 'lydian': (0, 2, 4, 6, 7, 9, 11),
}


def invert(notes, root_pc, scale, axis):
    """Inversão diatônica (espelho) em torno da nota `axis` (midi) dentro da escala `scale` de tônica `root_pc`."""
    pcs = SCALE_PCS[scale]
    allm = [12 * o + (root_pc + p) % 12 + 0 for o in range(0, 11) for p in pcs]
    allm = sorted({12 * (m // 12) + m % 12 for m in allm})
    allm = sorted({m for m in allm if 0 <= m < 128})

    def idx(m):
        return min(range(len(allm)), key=lambda i: (abs(allm[i] - m), allm[i]))

    ax = idx(axis)
    out = []
    for (s, m, l, v) in notes:
        j = 2 * ax - idx(m)
        j = max(0, min(len(allm) - 1, j))
        out.append((s, allm[j], l, v))
    return out


def fit(notes, harm, strong=4, reach=3):
    """Acomoda uma linha à harmonia: nos tempos fortes (passo % strong == 0) puxa a nota para o tom de acorde mais próximo
    (até `reach` semitons). Usada nas vozes espelhadas, para o espelho nunca bater feio com o acorde."""
    ev = harm.events()
    out = []
    for (s, m, l, v) in notes:
        if s % strong == 0:
            cur = [e for e in ev if e[0] <= s < e[0] + e[1]]
            if cur:
                ch = cur[-1]
                pcs = {(ch[2] + i) % 12 for i in QUAL[ch[3]]}
                if m % 12 not in pcs:
                    cands = [m + d for d in range(-reach, reach + 1) if (m + d) % 12 in pcs]
                    if cands:
                        m = min(cands, key=lambda x: (abs(x - m), x))
        out.append((s, m, l, v))
    return out
