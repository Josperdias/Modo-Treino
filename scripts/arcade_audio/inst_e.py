"""Instrumentos e kits da leva 'e' (volcano4, paper3, paper4, inverse3, inverse4). Mesma assinatura: fn(song, midi, dur, **kw); kit(ins, rng, v)."""
import numpy as np
import synth as S
from synth import SR
import comp as K


def _v(v):
    return 0.35 + 0.65 * v


# ---------------------------------------------------------------- cordas (com cache: Karplus é caro)
_KS = {}


def _ks(midi, n, decay, bright, var):
    key = (int(midi), n, round(decay, 4), round(bright, 2), var)
    if key not in _KS:
        rng = np.random.default_rng(int(midi) * 31 + var * 7 + 5)
        _KS[key] = S.karplus(float(S.hz(midi)), n, rng, decay, bright)
    return _KS[key]


def _damp(y, hold, rel=0.25):
    """Abafa a corda depois de `hold` segundos (queda linear em `rel`)."""
    n = len(y)
    i0 = int(hold * SR)
    if i0 >= n:
        return y
    k = min(n - i0, int(rel * SR))
    g = np.ones(n)
    g[i0:i0 + k] = np.linspace(1, 0, k)
    g[i0 + k:] = 0
    return y * g


def i_flam(song, midi, dur, vel=0.9, decay=0.9935, bright=0.62, ring=1.1, var=0, hold=None, hp=70):
    """Violão flamenco: corda de nylon brilhante, corpo ressonante, unhas (ataque seco)."""
    n = int(ring * SR)
    k = _ks(midi, n, decay, bright, var % 3)
    t = S.tt(n)
    nail = S.hp(song.rng.standard_normal(n), 3500) * np.exp(-t / 0.006) * 0.05
    body = S.bp(k, 160, 420, 1) * 0.35
    y = k * 0.9 + body + nail
    y = _damp(y, hold if hold is not None else max(dur * 3.0, 0.5), 0.3)
    return y * _v(vel) * 0.7


def i_uke(song, midi, dur, vel=0.9, decay=0.987, bright=0.72, ring=0.7, var=0, hold=None):
    """Ukulele: nylon agudo e saltitante, ataque estalado e queda rápida."""
    n = int(ring * SR)
    k = _ks(midi, n, decay, bright, var % 3)
    t = S.tt(n)
    y = S.lp(k, 6800, 1) + S.hp(song.rng.standard_normal(n), 4500) * np.exp(-t / 0.004) * 0.08
    y = _damp(y, hold if hold is not None else max(dur * 1.5, 0.12), 0.12)
    return y * _v(vel) * 0.75


def strum(sg, bus, fn, notes, step, down=True, gain=1.0, pan=0.0, spread=0.009, nstr=None, velmul=1.0, **kw):
    """Rasgueado: toca as cordas em sequência (descendo = grave→agudo). `nstr` limita às cordas mais agudas na subida."""
    ns = list(notes)
    if not down:
        ns = ns[::-1]
        ns = ns[: (nstr or 3)]
    t0 = sg.t_step(step)
    for i, m in enumerate(ns):
        v = min(1.0, velmul * (0.9 - 0.05 * i if down else 0.8 - 0.06 * i))
        sig = fn(sg, m, 0.4, vel=v, var=i + (0 if down else 1), **kw)
        sg.put(bus, sig, t0 + i * spread, gain, pan)


# ---------------------------------------------------------------- vozes
def _formant(freq, n, vowel, rng, breath=0.03, shift=1.0):
    F = {'a': (800, 1150, 2900), 'e': (400, 1600, 2700), 'i': (270, 2140, 2950), 'o': (450, 800, 2830), 'u': (325, 700, 2700)}[vowel]
    src = S.saw(freq, n)
    y = np.zeros(n)
    for f, a in zip(F, (1.0, 0.55, 0.3)):
        y += a * S.bp(src, f * shift * 0.88, f * shift * 1.12, 1)
    if rng is not None and breath:
        y += breath * S.bp(rng.standard_normal(n), 1500, 5000, 1)
    return y * 0.6


def i_cante(song, midi, dur, vel=0.85, vib=0.014, v1='a', v2='i', scoop=1.2, r=0.18, a=0.03, breath=0.05, grit=0.0):
    """Cante: entrada 'por baixo' (escorrega para a nota), vibrato que abre devagar e ditongo (a→i = 'ay')."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    vd = np.maximum(0, t - 0.25)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.7 * vd) * np.minimum(1, vd / 0.35)) * 2.0 ** (-scoop / 12 * np.exp(-t / 0.07))
    y1 = _formant(f, n, v1, song.rng, breath)
    if v2:
        y2 = _formant(f, n, v2, None, 0)
        w = np.clip((t - dur * 0.5) / 0.3, 0, 1)
        y = y1 * (1 - w) + y2 * w
    else:
        y = y1
    if grit:
        y = np.tanh(y * (1 + grit)) / np.tanh(1 + grit)
    return y * S.env_adsr(n, a, 0.05, 0.92, r) * _v(vel) * 0.85


def i_whistle(song, midi, dur, vel=0.85, vib=0.007, scoop=0.8, a=0.035, r=0.1, air=0.05):
    """Assobio: seno puro com sopro, vibrato tardio e subida de afinação no ataque."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    vd = np.maximum(0, t - 0.16)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.6 * vd) * np.minimum(1, vd / 0.2)) * 2.0 ** (-scoop / 12 * np.exp(-t / 0.05))
    y = S.sine(f, n) + 0.05 * S.sine(f * 2, n)
    y = y + S.bp(song.rng.standard_normal(n), 2800, 7000, 1) * air * (0.5 + 0.5 * np.exp(-t / 0.2))
    return y * S.env_adsr(n, a, 0.04, 0.92, r) * _v(vel) * 0.55


def i_chop(song, midi, dur, vel=0.9, vowel='a', shift=0.82, scoop=-1.5, a=0.004, r=0.07, grit=1.2):
    """Corte de voz (phonk): sílaba curta, formantes mais graves (voz 'descida'), entrada em glide e saturação."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * 2.0 ** (-scoop / 12 * np.exp(-t / 0.05))
    y = _formant(f, n, vowel, song.rng, 0.06, shift)
    y = np.tanh(y * (1 + grit)) / np.tanh(1 + grit)
    return y * S.env_adsr(n, a, 0.06, 0.8, r) * _v(vel) * 0.8


# ---------------------------------------------------------------- guitarra de parede, pads, metal
def i_wall(song, midi, dur, vel=0.8, cutoff=2400, det=0.009, a=0.18, r=0.9, bend=0.0, dive=0.0, drive=3.2):
    """Guitarra de shoegaze: serras desafinadas, saturação, filtro, entrada com alavanca (bend) e queda final (dive em semitons)."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * 2.0 ** (bend / 12 * np.exp(-t / 0.6))
    if dive:
        f = f * 2.0 ** (-dive / 12 * np.clip((t - dur * 0.5) / max(0.2, dur * 0.5 + r), 0, 1) ** 2)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det * 1.2), n) + 0.6 * S.saw(f * (1 + det * 2.4), n)) / 3.6
    y = np.tanh(y * drive) / np.tanh(drive)
    y = S.lp(y, cutoff, 2)
    return y * S.env_adsr(n, a, 0.3, 0.9, r) * _v(vel) * 0.55


def i_sinpad(song, midi, dur, vel=0.7, cutoff=700, a=0.6, r=1.0, det=0.006):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n)) / 3.0
    return S.lp(y, cutoff, 2) * S.env_adsr(n, a, 0.3, 0.85, r) * _v(vel) * 0.5


def i_metal(song, midi, dur, vel=0.9, tau=0.16, index=5.0, ratio=1.4142, cutoff=6000):
    """Stab metálico industrial: FM inarmônica com índice que cai rápido + serra, saturado."""
    n = int((dur + 0.25) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    ie = index * np.exp(-t / 0.09) + 0.8
    y = S.fm(f, n, ratio, 1.0, ie) + 0.5 * S.saw(np.asarray(f) * 1.004, n)
    y = np.tanh(y * 1.8)
    y = S.lp(y, cutoff, 1) * np.exp(-t / tau) * np.minimum(1, t / 0.002)
    return y * _v(vel) * 0.55


def i_acid(song, midi, dur, vel=0.9, cutoff=2400, tau=0.12, slide_from=None, drive=2.8, r=0.03):
    """Linha ácida: serra com filtro que abre e fecha em cada nota, ressonância (banda) e saturação."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * np.ones(n)
    if slide_from is not None:
        f = S.hz(midi) + (S.hz(slide_from) - S.hz(midi)) * np.exp(-t / 0.035)
    y = S.saw(f, n)
    lo, mid = S.lp(y, cutoff * 0.22), S.lp(y, cutoff)
    w = np.exp(-t / tau)
    out = lo * (1 - w) + mid * w + 0.7 * S.bp(y, cutoff * 0.75, cutoff * 1.25, 1) * w
    out = np.tanh(out * drive) / np.tanh(drive)
    return out * S.env_adsr(n, 0.002, 0.05, 0.9, r) * _v(vel) * 0.6


def i_rumble(song, midi, dur, vel=0.9, r=0.03, drive=3.5, cutoff=170):
    """Rumble do techno: subgrave com harmônicos saturados, passa-baixa."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = S.sine(f, n) + 0.5 * S.saw(f, n)
    y = np.tanh(y * drive) / np.tanh(drive)
    y = S.lp(y, cutoff, 2)
    return y * S.env_adsr(n, 0.004, 0.05, 0.95, r) * _v(vel) * 0.9


def i_808(song, midi, dur, vel=0.9, from_midi=None, glide=0.10, drive=2.4, decay=1.6, r=0.1):
    """808 com glide: a nota nasce em `from_midi` e escorrega até `midi` em ~`glide` s; soco de afinação, saturação e cauda longa."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f1 = float(S.hz(midi))
    f0 = float(S.hz(from_midi)) if from_midi is not None else f1
    f = f1 + (f0 - f1) * np.exp(-t / (glide / 3.0))
    f = f * (1 + 0.9 * np.exp(-t / 0.009))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR)
    y = np.tanh(y * drive) / np.tanh(drive)
    env = S.env_adsr(n, 0.002, 0.25, 0.85, r) * np.exp(-t / decay)
    return y * env * _v(vel) * 0.9


def i_cowbell(song, midi, dur, vel=0.9, tau=0.09, ratio=1.5047):
    """Cowbell sinistro: dois pulsos em quinta, banda estreita, ataque metálico."""
    n = int(0.5 * SR)
    t = S.tt(n)
    f = float(S.hz(midi))
    y = S.pulse(f, n, 0.5) + 0.9 * S.pulse(f * ratio, n, 0.5)
    y = S.bp(y, f * 0.8, f * 3.0, 1)
    env = np.exp(-t / tau) * (0.55 + 0.45 * np.exp(-t / 0.012))
    return y * env * _v(vel) * 0.75


def i_siren(song, midi, dur, vel=0.8, fall=12.0, r=0.05):
    """Sirene que cai: serra com glissando descendente (semitons) e saturação."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * 2.0 ** (-fall / 12 * (t / max(0.1, dur + r)) ** 1.3)
    y = np.tanh(S.saw(f, n) * 2.2) * 0.8
    return y * S.env_adsr(n, 0.01, 0.1, 0.9, r) * _v(vel) * 0.5


# ---------------------------------------------------------------- efeitos de queda / textura
def faller(rng, n, f0=3200.0, f1=110.0, noise=0.6, tone=0.6):
    """Assobio de bomba: tom e ruído filtrado que despencam em frequência enquanto ganham volume."""
    t = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** (t ** 0.8)
    tn = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    for c in np.geomspace(150, 9000, 12):
        out += S.bp(x, c / 1.35, c * 1.35, 1) * np.exp(-(np.log2(np.maximum(f, 20) / c) / 0.6) ** 2)
    env = t ** 1.8
    return (tn * tone + out * noise) * env


def fire(rng, n, level=0.2, density=70.0, rise=1.0):
    """Fogo: estalidos e chiado grave que crescem."""
    c = S.crackle(rng, n, density, level)
    c = S.hp(c, 600)
    wh = S.bp(rng.standard_normal(n), 300, 2200, 1) * 0.08
    env = np.linspace(0.15, 1.0, n) ** (1.4 * rise)
    return (c + wh) * env


# ---------------------------------------------------------------- kits
def kit_flam(ins, rng, v):
    """Flamenco: cajón (bumbo grave e 'slap'), palmas fuertes e sordas, taconeo e golpe do violão."""
    if ins == 'k':
        n = int(0.3 * SR)
        t = S.tt(n)
        f = 110 * (1 + 0.45 * np.exp(-t / 0.03))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11) + 0.3 * S.bp(rng.standard_normal(n), 120, 500, 1) * np.exp(-t / 0.02)
        return y * v * 1.1
    if ins == 's':
        n = int(0.18 * SR)
        t = S.tt(n)
        return (S.bp(rng.standard_normal(n), 1400, 6200, 1) * np.exp(-t / 0.035) * 0.9 + S.wood(700, n, 0.03) * 0.5) * v
    if ins == 'p':
        return S.clap(rng, int(0.22 * SR)) * v * 1.0
    if ins == 'q':
        n = int(0.12 * SR)
        t = S.tt(n)
        return (S.bp(rng.standard_normal(n), 500, 1900, 1) * np.exp(-t / 0.035) + 0.4 * np.sin(2 * np.pi * 680 * t) * np.exp(-t / 0.018)) * v * 0.9
    if ins == 'z':
        n = int(0.14 * SR)
        t = S.tt(n)
        return (S.wood(220, n, 0.045) * 0.9 + S.hp(rng.standard_normal(n), 1800) * np.exp(-t / 0.012) * 0.5) * v
    if ins == 'g':
        return S.wood(196, int(0.14 * SR), 0.05) * v * 0.9
    if ins == 'c':
        return S.crash(rng, None, 0.9) * v * 0.5
    raise KeyError(ins)


def kit_craft(ins, rng, v):
    """Recorte e colagem: pisada de caixa de papelão, palmas, estalar de dedos, pandeiro, farfalhar de papel, tesoura, carimbo."""
    if ins == 'k':
        n = int(0.2 * SR)
        t = S.tt(n)
        f = 78 * (1 + 0.6 * np.exp(-t / 0.025))
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.09) + 0.25 * S.wood(190, n, 0.03)) * v
    if ins == 'p':
        return S.clap(rng, int(0.2 * SR)) * v * 0.9
    if ins == 'f':
        n = int(0.06 * SR)
        t = S.tt(n)
        return (S.bp(rng.standard_normal(n), 1800, 6000, 1) * np.exp(-t / 0.01) * 0.8 + np.sin(2 * np.pi * 2300 * t) * np.exp(-t / 0.008) * 0.4) * v
    if ins == 'j':
        n = int(0.2 * SR)
        t = S.tt(n)
        y = S.hp(rng.standard_normal(n), 6200) * np.exp(-t / 0.05) * 0.35
        for d in (0.0, 0.011, 0.023, 0.034):
            k = int(d * SR)
            y[k:] += S.hp(rng.standard_normal(n - k), 6800) * np.exp(-t[: n - k] / 0.03) * 0.18
        return y * v
    if ins == 'x':
        return S.tom(185, int(0.16 * SR), 0.05) * v * 0.9
    if ins == 'h':
        n = int(0.07 * SR)
        return S.bp(rng.standard_normal(n), 3000, 9500, 1) * np.exp(-S.tt(n) / 0.02) * v * 0.7
    if ins == 'z':
        n = int(0.09 * SR)
        t = S.tt(n)
        return (S.hp(rng.standard_normal(n), 4500) * np.exp(-t / 0.012) + 0.4 * S.sine(3300, n) * np.exp(-t / 0.02)) * v * 0.8
    if ins == 't':
        n = int(0.22 * SR)
        t = S.tt(n)
        return (S.tom(130, n, 0.07) * 0.9 + S.hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.006) * 0.3) * v
    if ins == 'c':
        n = int(0.4 * SR)
        t = S.tt(n)
        g = np.zeros(n)
        for p in rng.integers(0, int(0.3 * SR), 14):
            L = int(rng.integers(120, 700))
            g[p:p + L] += np.hanning(L)[: n - p][:L] * rng.uniform(0.3, 1.0)
        return S.bp(rng.standard_normal(n), 1500, 7500, 1) * g[:n] * v * 0.8
    if ins == 'w':
        return S.wood(1250, None, 0.03) * v
    raise KeyError(ins)


def kit_fog(ins, rng, v):
    """Shoegaze: bateria na névoa: bumbo macio, caixa longa, pratos de lavagem."""
    if ins == 'k':
        return S.kick(None, 118, 46, 0.2, 0.05) * v * 1.0
    if ins == 's':
        n = int(0.4 * SR)
        t = S.tt(n)
        return (S.hp(rng.standard_normal(n), 900) * np.exp(-t / 0.13) * 0.7 + np.sin(2 * np.pi * 185 * t * (1 + 0.25 * np.exp(-t / 0.02))) * np.exp(-t / 0.07) * 0.5) * v
    if ins == 'h':
        n = int(0.09 * SR)
        return S.bp(rng.standard_normal(n), 4500, 11000, 1) * np.exp(-S.tt(n) / 0.03) * v * 0.7
    if ins == 'o':
        return S.hat(rng, int(0.35 * SR), 0.03, True) * v * 0.8
    if ins == 'c':
        return S.crash(rng, None, 1.6) * v * 0.7
    if ins == 'r':
        return S.ride(rng) * v
    if ins in ('t1', 't2', 't3'):
        return S.tom({'t1': 200, 't2': 150, 't3': 112}[ins], None, 0.3) * v
    raise KeyError(ins)


def kit_hard(ins, rng, v):
    """Hard techno: bumbo saturado e longo, palma seca, chimbais, prato aberto, ride, clank de metal e tons de queda."""
    if ins == 'k':
        n = int(0.36 * SR)
        t = S.tt(n)
        f = 46 + 190 * np.exp(-t / 0.028)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
        y = np.tanh(y * 3.6) * 0.95
        y[: int(0.003 * SR)] += 0.4 * np.hanning(int(0.006 * SR))[: int(0.003 * SR)]
        return y * v
    if ins == 'c':
        return S.clap(rng, int(0.22 * SR)) * v * 1.0
    if ins == 's':
        n = int(0.2 * SR)
        t = S.tt(n)
        y = S.hp(rng.standard_normal(n), 1500) * np.exp(-t / 0.07) * 0.8 + np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.04) * 0.5
        return np.tanh(y * 2.0) * v * 0.8
    if ins == 'h':
        return S.hat(rng, None, 0.018) * v * 0.9
    if ins == 'o':
        return S.hat(rng, int(0.2 * SR), 0.02, True) * v * 0.9
    if ins == 'r':
        return S.ride(rng, int(0.4 * SR)) * v * 1.0
    if ins == 'm':
        n = int(0.5 * SR)
        t = S.tt(n)
        y = S.modal(420, n, 'bell', 0.35) * 0.8 + S.hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.012) * 0.6
        return np.tanh(y * 1.5) * v * 0.7
    if ins == 'z':
        return S.crash(rng, None, 1.0) * v * 0.6
    if ins in ('t1', 't2', 't3'):
        return S.tom({'t1': 210, 't2': 150, 't3': 105}[ins], None, 0.22) * v * 1.1
    if ins == 'x':
        return S.rim(rng) * v * 0.9
    raise KeyError(ins)


def kit_trap(ins, rng, v):
    """Trap/phonk: bumbo curto (o grave é o 808), caixa+palma, chimbais apertados, rim, prato."""
    if ins == 'k':
        return S.kick(None, 170, 52, 0.07, 0.4) * v * 1.0
    if ins == 's':
        n = int(0.3 * SR)
        t = S.tt(n)
        y = S.hp(rng.standard_normal(n), 1300) * np.exp(-t / 0.11) * 0.7 + np.sin(2 * np.pi * 205 * t * (1 + 0.3 * np.exp(-t / 0.02))) * np.exp(-t / 0.05) * 0.55
        return (y + 0.6 * S.clap(rng, n)) * v * 0.85
    if ins == 'p':
        return S.clap(rng, int(0.24 * SR)) * v * 0.9
    if ins == 'h':
        n = int(0.05 * SR)
        return S.hp(rng.standard_normal(n), 8200) * np.exp(-S.tt(n) / 0.012) * v * 0.9
    if ins == 'o':
        return S.hat(rng, int(0.25 * SR), 0.03, True) * v * 0.8
    if ins == 'r':
        return S.rim(rng) * v * 0.9
    if ins == 'c':
        return S.crash(rng, None, 1.1) * v * 0.6
    if ins == 'w':
        return S.wood(900, None, 0.04) * v
    raise KeyError(ins)
