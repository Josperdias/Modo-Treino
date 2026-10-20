"""Instrumentos da segunda leva de trilhas (mesma assinatura: song, midi, dur, **kw)."""
import numpy as np
import synth as S
from synth import SR


def _v(v):
    return 0.35 + 0.65 * v


def i_sawpluck(song, midi, dur, cutoff=3400, tau=0.16, vel=0.9, det=0.006, r=0.04):
    """Serra dupla com filtro que fecha rápido (arpejo de synthwave)."""
    n = int((dur + r + 0.15) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n)) / 3.0
    t = S.tt(n)
    hi, lo = S.lp(y, cutoff), S.lp(y, cutoff * 0.3)
    w = np.exp(-t / 0.05)
    out = (lo * (1 - w) + hi * w) * np.exp(-t / tau)
    return out * np.minimum(1, t / 0.002) * _v(vel) * 0.55


def i_reese(song, midi, dur, cutoff=700, wob_hz=0.0, det=0.011, vel=0.9, r=0.05):
    """Baixo 'reese' de drum & bass: duas serras desafinadas que batem uma contra a outra, passa-baixa com ondulação."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det * 0.8), n)) / 3.0
    t = S.tt(n)
    lo, hi = S.lp(y, cutoff * 0.45), S.lp(y, cutoff * 1.6)
    w = 0.5 + 0.5 * np.sin(2 * np.pi * (wob_hz or 0.0) * t) if wob_hz else np.full(n, 0.5)
    out = lo * (1 - w) + hi * w
    out += 0.6 * S.sine(f, n)
    return out * S.env_adsr(n, 0.004, 0.08, 0.9, r) * _v(vel) * 0.6


def i_walk(song, midi, dur, vel=0.9, tau=0.5):
    """Contrabaixo acústico: corda dedilhada grave com corpo senoidal."""
    n = int((dur + 0.25) * SR)
    f = float(S.hz(midi))
    k = S.karplus(f, n, song.rng, 0.992, 0.18)
    body = S.sine(f, n) * np.exp(-S.tt(n) / tau)
    y = 0.55 * S.lp(k, 900, 1) + 0.6 * body
    y = y * np.minimum(1, S.tt(n) / 0.004)
    y[int(dur * SR + 0.06 * SR):] *= np.linspace(1, 0, max(1, n - int(dur * SR + 0.06 * SR)))
    return y * _v(vel) * 0.9


def i_stab(song, midi, dur, cutoff=1900, tau=0.14, vel=0.9, det=0.01):
    """Acorde curto de serra filtrada (dub / house)."""
    n = int((dur + 0.2) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n)) / 2.0
    t = S.tt(n)
    out = S.lp(y, cutoff) * np.exp(-t / tau) * np.minimum(1, t / 0.003)
    return out * _v(vel) * 0.55


def i_sub(song, midi, dur, vel=0.9, r=0.05, drive=0.0):
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = S.sine(f, n) + 0.25 * S.sine(f * 2, n)
    if drive:
        y = np.tanh(y * (1 + drive)) / np.tanh(1 + drive)
    return y * S.env_adsr(n, 0.006, 0.05, 0.95, r) * _v(vel) * 0.85


def i_gtr(song, midi, dur, vel=0.9, decay=0.995, bright=0.3):
    """Violão de nylon (bossa): corda dedilhada macia."""
    n = int((dur + 0.5) * SR)
    k = S.karplus(float(S.hz(midi)), n, song.rng, decay, bright)
    return S.lp(k, 4200, 1) * _v(vel) * 0.75


def i_flute(song, midi, dur, vel=0.85, vib=0.005, a=0.06, r=0.12):
    """Flauta: seno com um pouco de segundo harmônico, sopro e vibrato que entra depois."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.2 * np.maximum(0, t - 0.18)) * np.minimum(1, np.maximum(0, t - 0.18) / 0.25))
    y = S.sine(f, n) + 0.18 * S.sine(f * 2, n) + 0.05 * S.sine(f * 3, n)
    breath = S.bp(song.rng.standard_normal(n), 2500, 7000, 1) * 0.05 * np.exp(-t / 0.08)
    return (y + breath) * S.env_adsr(n, a, 0.05, 0.9, r) * _v(vel) * 0.6


def i_chime(song, midi, dur, vel=0.9, tilt=1.2):
    n = int((max(dur, 0.2) + 1.2) * SR)
    return S.modal(float(S.hz(midi)), n, 'glass', tilt) * _v(vel) * 0.85


def i_drone(song, midi, dur, cutoff=420, vel=0.8, r=0.5, a=0.8):
    """Zumbido grave de serras (vulcão): bordão que respira."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * 1.006, n) + S.saw(f * 0.994, n) + 0.7 * S.pulse(f * 0.5, n, 0.5)) / 3.7
    y = S.lp(y, cutoff, 2)
    return y * S.env_adsr(n, a, 0.3, 0.9, r) * _v(vel) * 0.7


def i_clar(song, midi, dur, vel=0.85, vib=0.004, a=0.025, r=0.1, cutoff=2600):
    """Clarinete: quadrada filtrada (só harmônicos ímpares), sopro e vibrato tardio."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.0 * np.maximum(0, t - 0.2)) * np.minimum(1, np.maximum(0, t - 0.2) / 0.3))
    y = S.lp(S.pulse(f, n, 0.5), cutoff, 2) * 0.8 + 0.25 * S.sine(f, n)
    y = y + S.bp(song.rng.standard_normal(n), 1800, 5000, 1) * 0.03 * np.exp(-t / 0.06)
    return y * S.env_adsr(n, a, 0.05, 0.9, r) * _v(vel) * 0.6
