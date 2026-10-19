"""
Síntese do áudio do NEON STEP DX (tudo por código, sem amostras de terceiros).
Técnicas: pulsos/triângulo/ruído LFSR estilo NES, serra VRC6, FM, Karplus-Strong, corpos modais (marimba, vibrafone, sino),
bolhas de Minnaert, escada de Shepard. Nada aqui reproduz música ou som de terceiros.
"""
import numpy as np
from scipy import signal

SR = 32000


def hz(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def tt(n):
    return np.arange(n, dtype=np.float64) / SR


def env_adsr(n, a=0.004, d=0.06, s=0.7, r=0.05):
    """ADSR vetorizado dentro de `n` amostras (a liberação ocupa o fim)."""
    a_n, d_n, r_n = max(1, int(a * SR)), max(1, int(d * SR)), max(1, int(r * SR))
    r_n = min(r_n, n // 2 if n > 4 else 1)
    out = np.empty(n)
    sustain_end = max(0, n - r_n)
    i = np.arange(n)
    att = np.minimum(1.0, i / a_n)
    dec = 1.0 - (1.0 - s) * np.clip((i - a_n) / d_n, 0, 1)
    out = att * dec
    if r_n > 0:
        rel = np.clip((n - i) / r_n, 0, 1)
        out = out * rel
    return out


def env_exp(n, tau):
    return np.exp(-tt(n) / max(1e-4, tau))


def _blep(t, dt):
    out = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    out[m] = x + x - x * x - 1.0
    m2 = t > 1.0 - dt
    x2 = (t[m2] - 1.0) / dt[m2]
    out[m2] = x2 * x2 + x2 + x2 + 1.0
    return out


def phase_of(freq, n):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,)).copy()
    return (np.cumsum(f) / SR) % 1.0, np.clip(f / SR, 1e-6, 0.45)


def pulse(freq, n, duty=0.5):
    ph, dt = phase_of(freq, n)
    d = np.broadcast_to(np.asarray(duty, dtype=np.float64), (n,))
    y = np.where(ph < d, 1.0, -1.0)
    y += _blep(ph, dt) - _blep((ph - d) % 1.0, dt)
    return y * 0.9


def saw(freq, n):
    ph, dt = phase_of(freq, n)
    return (2.0 * ph - 1.0 - _blep(ph, dt)) * 0.9


def tri(freq, n, bits=0):
    ph, _ = phase_of(freq, n)
    y = 2.0 * np.abs(2.0 * ph - 1.0) - 1.0
    if bits:
        q = 2 ** bits
        y = np.round((y * 0.5 + 0.5) * (q - 1)) / (q - 1) * 2.0 - 1.0
    return y


def sine(freq, n):
    ph, _ = phase_of(freq, n)
    return np.sin(2 * np.pi * ph)


def _lfsr(short):
    reg, out = 1, []
    n = 93 if short else 32767
    for _ in range(n):
        bit = (reg ^ (reg >> (6 if short else 1))) & 1
        reg = (reg >> 1) | (bit << 14)
        out.append(1.0 if (reg & 1) else -1.0)
    return np.array(out)


_LFSR = {False: _lfsr(False), True: _lfsr(True)}


def noise(rate, n, short=False):
    """Ruído LFSR do NES: `rate` = troca de valor por segundo (maior = mais agudo)."""
    seq = _LFSR[short]
    r = np.broadcast_to(np.asarray(rate, dtype=np.float64), (n,))
    idx = (np.cumsum(r) / SR).astype(np.int64) % len(seq)
    return seq[idx]


def white(n, rng):
    return rng.standard_normal(n)


def fm(freq, n, ratio=2.0, index=3.0, index_env=None, fb=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    idx = index * (index_env if index_env is not None else 1.0)
    ph = np.cumsum(f) / SR
    mod = np.sin(2 * np.pi * ph * ratio)
    return np.sin(2 * np.pi * ph + idx * mod)


def karplus(freq, n, rng, decay=0.996, bright=0.5):
    """Corda dedilhada (Karplus-Strong) por filtro recursivo."""
    N = max(2, int(round(SR / float(freq))))
    x = np.zeros(n)
    burst = rng.uniform(-1, 1, N)
    burst = signal.lfilter([1 - bright, bright], [1], burst)
    x[:N] = burst[:min(N, n)]
    a = np.zeros(N + 2)
    a[0] = 1.0
    a[N] = -decay * 0.5
    a[N + 1] = -decay * 0.5
    y = signal.lfilter([1.0], a, x)
    return y / (np.max(np.abs(y)) + 1e-9)


MODES = {
    'marimba': ([1.0, 3.93, 9.2], [1.0, 0.35, 0.12], [0.55, 0.10, 0.04]),
    'vibes': ([1.0, 4.0, 10.0], [1.0, 0.28, 0.08], [1.6, 0.35, 0.12]),
    'bell': ([1.0, 2.76, 5.40, 8.93, 13.34], [1.0, 0.6, 0.45, 0.3, 0.2], [1.8, 1.2, 0.8, 0.5, 0.3]),
    'glass': ([1.0, 2.32, 4.25, 6.63], [1.0, 0.5, 0.35, 0.2], [1.4, 0.9, 0.6, 0.35]),
    'box': ([1.0, 2.0, 4.1, 6.2], [1.0, 0.4, 0.25, 0.1], [0.45, 0.25, 0.12, 0.08]),
    'bowl': ([1.0, 2.71, 5.17, 8.45], [1.0, 0.6, 0.35, 0.2], [3.0, 2.0, 1.2, 0.8]),
    'wood': ([1.0, 2.4, 5.0], [1.0, 0.5, 0.2], [0.06, 0.04, 0.02]),
    'drum': ([1.0, 1.59, 2.14, 2.30], [1.0, 0.6, 0.4, 0.3], [0.25, 0.18, 0.12, 0.1]),
}


def modal(freq, n, kind='marimba', tilt=1.0):
    ratios, amps, taus = MODES[kind]
    t = tt(n)
    y = np.zeros(n)
    for r, a, tau in zip(ratios, amps, taus):
        f = freq * r
        if f >= SR * 0.45:
            continue
        y += a * np.exp(-t / (tau * tilt)) * np.sin(2 * np.pi * f * t)
    return y / (len(ratios) * 0.6)


def bubble(freq, n, rise=0.18, tau=0.05):
    """Bolha de Minnaert: seno que sobe de tom ao esvaziar e some rápido."""
    t = tt(n)
    f = freq * (1.0 + rise * (1 - np.exp(-t / (tau * 2))))
    ph = np.cumsum(f) / SR
    return np.sin(2 * np.pi * ph) * np.exp(-t / tau) * np.minimum(1.0, t / 0.002)


def shepard(n, start_oct=0.0, rate=0.25, f0=55.0, voices=9, base_mid=None):
    """Escada de Shepard: oitavas empilhadas sob um envelope em sino; rate>0 sobe, <0 desce (oitavas/s)."""
    t = tt(n)
    pos = start_oct + rate * t  # em oitavas
    y = np.zeros(n)
    center = voices / 2.0
    for k in range(voices):
        o = (pos + k) % voices  # oitava circular
        f = f0 * 2.0 ** o
        loud = np.exp(-0.5 * ((o - center) / (voices * 0.17)) ** 2)
        ph = np.cumsum(f) / SR
        y += loud * np.sin(2 * np.pi * ph)
    return y / voices * 2.2


# ---------- filtros / utilidades ----------

def lp(x, cutoff, order=2):
    sos = signal.butter(order, np.clip(cutoff, 30, SR * 0.45) / (SR / 2), 'low', output='sos')
    return signal.sosfilt(sos, x)


def hp(x, cutoff, order=2):
    sos = signal.butter(order, np.clip(cutoff, 20, SR * 0.45) / (SR / 2), 'high', output='sos')
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [max(20, lo) / (SR / 2), min(SR * 0.45, hi) / (SR / 2)], 'band', output='sos')
    return signal.sosfilt(sos, x)


def sweep(f0, f1, n, curve='exp'):
    t = np.linspace(0.0, 1.0, n)
    if curve == 'exp':
        return f0 * (f1 / f0) ** t
    return f0 + (f1 - f0) * t


# ---------- percussão ----------

def kick(n=None, f0=170.0, f1=46.0, tau=0.11, click=0.25):
    n = n or int(0.3 * SR)
    f = sweep(f0, f1, n)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, tau)
    y[: int(0.004 * SR)] += click * np.hanning(int(0.008 * SR))[: int(0.004 * SR)]
    return y


def snare(rng, n=None, tone=190.0, tau=0.09, noise_mix=0.8):
    n = n or int(0.25 * SR)
    t = tt(n)
    nz = hp(white(n, rng), 1200) * np.exp(-t / tau)
    tn = np.sin(2 * np.pi * tone * t * (1 + 0.3 * np.exp(-t / 0.02))) * np.exp(-t / 0.05)
    return noise_mix * nz * 0.7 + (1 - noise_mix) * tn + 0.25 * tn


def hat(rng, n=None, tau=0.025, open_=False):
    n = n or int((0.25 if open_ else 0.08) * SR)
    t = tt(n)
    return hp(white(n, rng), 6500) * np.exp(-t / (0.12 if open_ else tau)) * 0.55


def chip_hat(n=None, open_=False):
    n = n or int((0.2 if open_ else 0.05) * SR)
    return noise(18000, n, short=True) * env_exp(n, 0.12 if open_ else 0.02) * 0.45


def chip_snare(n=None):
    n = n or int(0.18 * SR)
    return (noise(9000, n) * 0.8 + pulse(sweep(320, 140, n), n, 0.5) * 0.3) * env_exp(n, 0.06)


def chip_kick(n=None):
    n = n or int(0.16 * SR)
    return tri(sweep(150, 42, n), n) * env_exp(n, 0.09)


def clap(rng, n=None):
    n = n or int(0.25 * SR)
    t = tt(n)
    y = bp(white(n, rng), 900, 3500) * np.exp(-t / 0.07)
    for d in (0.012, 0.024):  # várias palmas coladas
        k = int(d * SR)
        y[k:] += 0.6 * bp(white(n - k, rng), 900, 3500) * np.exp(-t[: n - k] / 0.05)
    return y * 0.6
