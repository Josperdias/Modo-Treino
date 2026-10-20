"""Instrumentos e ajudantes da leva v4 / compositor A (menu2, menu3, menu4, bonus2, bonus3). Mesma assinatura: (song, midi, dur, **kw)."""
import numpy as np
import synth as S
from synth import SR
import comp as K
from comp import parse, voice


def _v(v):
    return 0.35 + 0.65 * v


def _gate(n, dur, r):
    """Porta de liberação: 1 até `dur`, cai linear em `r` segundos e fica 0."""
    g = np.ones(n)
    i0 = int(dur * SR)
    k = max(2, int(r * SR))
    if i0 < n:
        e = min(n, i0 + k)
        g[i0:e] = np.linspace(1, 0, e - i0)
        g[e:] = 0
    return g


# ---------------------------------------------------------------- synth lead "chillwave": serras desafinadas, vibrato tardio, escorregada na entrada
def i_cwlead(song, midi, dur, vel=0.85, a=0.035, r=0.35, cutoff=2300, vib=0.006, det=0.007, scoop=0.3):
    n = int((dur + r) * SR)
    t = S.tt(n)
    v = np.maximum(0, t - 0.22)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 4.8 * v) * np.minimum(1, v / 0.3)) * 2 ** (-scoop / 12 * np.exp(-t / 0.06))
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n)) / 3.0 + 0.35 * S.tri(f * 0.5, n)
    lo, hi = S.lp(y, cutoff * 0.5), S.lp(y, cutoff)
    w = np.clip(t / 0.4, 0, 1)
    return (lo * (1 - w) + hi * w) * S.env_adsr(n, a, 0.15, 0.82, r) * _v(vel) * 0.55


# ---------------------------------------------------------------- clavinet com "wah" (filtro abre no ataque e fecha)
def i_clav(song, midi, dur, vel=0.9, tau=0.16, wah=0.07, r=0.03, top=5200, base=700):
    n = int((dur + r + 0.05) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = 0.7 * S.pulse(f, n, 0.2) + 0.45 * S.saw(f, n) + 0.12 * S.pulse(f * 2, n, 0.5)
    lo, mid, hi = S.lp(y, base), S.lp(y, (base + top) * 0.4), S.lp(y, top)
    w = np.exp(-t / wah)
    w2 = np.exp(-t / (wah * 3.5))
    y = hi * w + mid * (w2 - w) * 0.9 + lo * (1 - w2)
    env = np.exp(-t / tau) * np.minimum(1, t / 0.0012)
    click = S.bp(song.rng.standard_normal(n), 2500, 7000, 1) * np.exp(-t / 0.006) * 0.12
    return (y * env + click) * _gate(n, dur, r) * _v(vel) * 0.7


# ---------------------------------------------------------------- cordas de orquestra / disco (conjunto de serras com vibrato lento)
def i_strings(song, midi, dur, vel=0.8, a=0.14, r=0.35, cutoff=3300, vib=0.004, det=0.006):
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.1 * np.maximum(0, t - 0.25)) * np.minimum(1, np.maximum(0, t - 0.25) / 0.4))
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n) + S.saw(f * (1 + 2.4 * det), n)) / 4.0
    cut = cutoff * (0.45 + 0.55 * np.minimum(1, t / 0.5))
    y = 0.5 * S.lp(y, cutoff * 0.45) + 0.5 * S.lp(y, cutoff)
    return y * S.env_adsr(n, a, 0.2, 0.9, r) * _v(vel) * 0.5


def i_cello(song, midi, dur, vel=0.85, a=0.06, r=0.2, cutoff=1500):
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + 0.003 * np.sin(2 * np.pi * 5.0 * np.maximum(0, t - 0.2)))
    y = (S.saw(f, n) + S.saw(f * 1.004, n)) / 2.0
    y = S.lp(y, cutoff) + 0.4 * S.sine(f, n)
    return y * S.env_adsr(n, a, 0.1, 0.9, r) * _v(vel) * 0.5


# ---------------------------------------------------------------- cravo: duas cordas (8' + 4') Karplus brilhantes, estalo do "jack", sem sustentação
def i_harpsi(song, midi, dur, vel=0.9, bright=0.09, decay=0.9968, r=0.07, reg=0.45):
    f = float(S.hz(midi))
    n = int((dur + r + 0.08) * SR)
    k1 = S.karplus(f, n, song.rng, decay, bright)
    k2 = S.karplus(f * 2, n, song.rng, decay - 0.002, bright) * reg
    y = k1 + k2
    y = y + 0.55 * S.bp(y, 1100, 3800, 1)
    t = S.tt(n)
    y = y + S.bp(song.rng.standard_normal(n), 3000, 9000, 1) * np.exp(-t / 0.004) * 0.18
    y = y * np.exp(-t / (1.1 + 0.0 * f)) * _gate(n, dur + 0.02, r)
    y = y / (np.max(np.abs(y)) + 1e-9)
    return y * _v(vel) * 0.6


def i_pizz(song, midi, dur, vel=0.85, decay=0.988, bright=0.28, tau=0.2):
    f = float(S.hz(midi))
    n = int((max(dur, 0.1) + 0.3) * SR)
    k = S.karplus(f, n, song.rng, decay, bright)
    return S.lp(k, 4500, 1) * np.exp(-S.tt(n) / tau) * _v(vel) * 0.8


# ---------------------------------------------------------------- piano "honky-tonk" de ragtime: três cordas desafinadas FM, martelo brilhante
def i_honky(song, midi, dur, vel=0.9, honk=0.0042, bright=1.0, r=0.06, tau=None):
    f0 = float(S.hz(midi))
    n = int((dur + r + 0.1) * SR)
    t = S.tt(n)
    ie = np.exp(-t / 0.16) + 0.14
    y = np.zeros(n)
    for d in (-honk, 0.0, honk):
        y += S.fm(f0 * (1 + d), n, 1.0, 1.9 * bright, ie)
    y = y / 3.0 + 0.2 * S.fm(f0, n, 4.0, 1.1 * bright, np.exp(-t / 0.04))
    tn = tau or float(np.clip(1.15 * (261.6 / f0) ** 0.55, 0.22, 1.6))
    y = y * np.exp(-t / tn) * np.minimum(1, t / 0.0012) * _gate(n, dur, r)
    return y * _v(vel) * 0.62


def i_tuba(song, midi, dur, vel=0.9, cutoff=620, r=0.05):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = S.lp((S.saw(f, n) + 0.7 * S.pulse(f, n, 0.35)) / 1.7, cutoff, 2) + 0.35 * S.sine(f, n)
    return y * S.env_adsr(n, 0.012, 0.08, 0.7, r) * _v(vel) * 0.7


# ---------------------------------------------------------------- cavaquinho (aço, brilhante e curtinho)
def i_cavaco(song, midi, dur, vel=0.85, decay=0.9905, bright=0.07):
    f = float(S.hz(midi))
    n = int((dur + 0.25) * SR)
    k = S.karplus(f, n, song.rng, decay, bright)
    k = S.lp(k, 8000, 1)
    k = k * np.exp(-S.tt(n) / 0.28)
    return k * _v(vel) * 0.7


# ---------------------------------------------------------------- clarineta/flauta de choro para a melodia de samba
def i_choro(song, midi, dur, vel=0.85, a=0.03, r=0.1, vib=0.0045):
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.6 * np.maximum(0, t - 0.15)) * np.minimum(1, np.maximum(0, t - 0.15) / 0.2))
    y = S.sine(f, n) + 0.28 * S.sine(f * 2, n) + 0.1 * S.sine(f * 3, n) + 0.04 * S.sine(f * 4, n)
    br = S.bp(song.rng.standard_normal(n), 2400, 7500, 1) * 0.05 * np.exp(-t / 0.07)
    return (y + br) * S.env_adsr(n, a, 0.05, 0.9, r) * _v(vel) * 0.55


# ---------------------------------------------------------------- ajudantes de escrita
def score(spb, nbars, bars):
    """Monta uma linha a partir de {compasso: 'fichas'}; compassos que faltam viram pausa. (compasso = índice a partir de 0)"""
    rest = ' '.join(['.'] * spb)
    txt = ' | '.join(bars.get(b, rest) for b in range(nbars))
    return parse(txt, spb)


def comp_chords(sg, bus, fn, harm, bar0, steps, lo, hi, gain=1.0, n=4, pan=0.0, spread=0.0, **kw):
    """Acordes tocados nos passos `steps` (dict passo -> duração) de cada compasso, com a condução de vozes mais próxima."""
    evs = harm.events()
    prev = None
    for bi in range(len(harm)):
        for st, ln in steps.items():
            sa = bi * harm.spb + st
            cur = [e for e in evs if e[0] <= sa < e[0] + e[1]][-1]
            v = voice(prev, cur[2], cur[3], lo, hi, n)
            prev = v
            for k, m in enumerate(v):
                sg.note(bus, fn, (bar0 + bi) * sg.spb + st + k * spread, m, ln, gain=gain / len(v) ** 0.5, pan=pan + (k - (len(v) - 1) / 2) * 0.18,
                        vel=0.9 if st == 0 else 0.75, **kw)


def strum(sg, bus, fn, tones, step, ln, gain=1.0, spread=0.1, up=False, pan=0.0, vel=0.85, **kw):
    ts = list(reversed(tones)) if up else list(tones)
    for k, m in enumerate(ts):
        sg.note(bus, fn, step + k * spread, m, ln, gain=gain / len(ts) ** 0.5, pan=pan + (k - (len(ts) - 1) / 2) * 0.12, vel=vel, **kw)
