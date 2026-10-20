"""Kits de bateria da segunda leva de trilhas (synthwave, drum & bass, swing, dub, ritual). Mesma assinatura: kit(ins, rng, v)."""
import numpy as np
import synth as S
from synth import SR


def _gate(n, hold, fall=0.012):
    g = np.ones(n)
    h = int(hold * SR)
    g[h:] = 0
    f = int(fall * SR)
    if h - f > 0:
        g[h - f:h] = np.linspace(1, 0, f)
    return g


def kit_wave(ins, rng, v):
    """Synthwave: bumbo redondo, caixa com reverb 'gated' (o rabo é cortado seco), palmas, hats de 16 e tons de fill."""
    if ins == 'k': return S.kick(None, 150, 44, 0.16, 0.3) * v * 1.0
    if ins == 's':
        n = int(0.5 * SR)
        t = S.tt(n)
        core = S.snare(rng, n, 200, 0.1, 0.75) + 0.7 * S.clap(rng, n)
        wash = S.bp(rng.standard_normal(n), 250, 6500, 1) * 0.5 * _gate(n, 0.21) * np.exp(-t / 0.3)
        return (core * 0.8 + wash) * v * 0.9
    if ins == 'p': return S.clap(rng) * v * 0.9
    if ins == 'h': return S.hat(rng, None, 0.022) * v * 0.9
    if ins == 'o': return S.hat(rng, None, 0.02, True) * v * 0.9
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 220, 't2': 165, 't3': 120}[ins], None, 0.26) * v * 1.1
    if ins == 'c': return S.crash(rng, None, 1.1) * v * 0.7
    raise KeyError(ins)


def kit_dnb(ins, rng, v):
    """Drum & bass: bumbo seco, caixa estalada com 'crack', caixa fantasma, hats finos e prato de condução."""
    if ins == 'k': return S.kick(None, 210, 50, 0.085, 0.45) * v * 1.05
    if ins == 's': return S.snare(rng, int(0.22 * SR), 235, 0.075, 0.82) * v
    if ins == 'g': return S.snare(rng, int(0.12 * SR), 260, 0.04, 0.9) * v * 0.45
    if ins == 'h': return S.hat(rng, None, 0.016) * v * 0.8
    if ins == 'o': return S.hat(rng, None, 0.02, True) * v * 0.75
    if ins == 'r': return S.ride(rng) * v * 1.1
    if ins == 'c': return S.crash(rng, None, 0.9) * v * 0.7
    if ins == 'x': return S.rim(rng) * v * 0.9
    raise KeyError(ins)


def kit_swing(ins, rng, v):
    """Combo de jazz: prato de condução, chimbal de pé, escova na caixa, bumbo macio de 'quatro', rim."""
    if ins == 'k': return S.kick(None, 105, 52, 0.15, 0.05) * v * 0.75
    if ins == 'h': return S.ride(rng, int(0.32 * SR)) * v * 1.2
    if ins == 'f': return S.hat(rng, int(0.05 * SR), 0.018) * v * 0.9
    if ins == 's':
        n = int(0.28 * SR)
        t = S.tt(n)
        return S.bp(rng.standard_normal(n), 1800, 9000, 1) * np.exp(-t / 0.11) * np.minimum(1, t / 0.02) * v * 0.55
    if ins == 'r': return S.rim(rng) * v * 0.9
    if ins == 'w': return S.wood(1500, None, 0.03) * v
    if ins == 'c': return S.crash(rng, None, 1.0) * v * 0.55
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 210, 't2': 160, 't3': 118}[ins], None, 0.3) * v
    raise KeyError(ins)


def kit_dub(ins, rng, v):
    """Dub techno: bumbo longo e macio, 'rim' no contratempo, chimbais de ruído, shaker."""
    if ins == 'k': return S.kick(None, 112, 42, 0.24, 0.08) * v * 1.0
    if ins == 'r': return S.rim(rng) * v * 0.8
    if ins == 'h': return S.hat(rng, None, 0.03) * v * 0.7
    if ins == 'o': return S.hat(rng, None, 0.03, True) * v * 0.6
    if ins == 'sh': return S.shaker(rng) * v * 0.8
    if ins == 'c': return S.crash(rng, None, 1.4) * v * 0.45
    if ins == 'w': return S.wood(1200) * v * 0.8
    raise KeyError(ins)


def kit_ritual(ins, rng, v):
    """Ritual do vulcão: taikos graves, toms de pele, batida de metal (cano) e gongo."""
    if ins == 'k': return S.taiko(None, 100, 48, 0.4) * v * 0.55
    if ins == 'd': return S.taiko(None, 135, 62, 0.28) * v * 0.6
    if ins in ('t1', 't2', 't3'): return S.taiko(None, {'t1': 170, 't2': 140, 't3': 112}[ins], 66, 0.28) * v * 0.6
    if ins == 'p':
        n = int(1.4 * SR)
        return S.modal(310, n, 'bell', 0.55) * v * 0.7
    if ins == 'g':
        n = int(3.2 * SR)
        return S.modal(92, n, 'bowl', 2.2) * v * 0.9
    if ins == 'w': return S.wood(900) * v
    if ins == 'sh': return S.shaker(rng, None, 0.06) * v
    if ins == 'c': return S.crash(rng, None, 1.3) * v * 0.7
    if ins == 'r': return S.rim(rng) * v
    raise KeyError(ins)
