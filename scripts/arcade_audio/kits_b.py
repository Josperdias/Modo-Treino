"""Kits de bateria da leva v4 (compositor B). Mesma assinatura: kit(ins, rng, v)."""
import numpy as np
import synth as S
from synth import SR


def _add(*xs):
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[:len(x)] += x
    return out


def kit_hyper(ins, rng, v):
    """Hyperpop: bumbo curto e estalado, caixa+palma em camadas, hats finíssimos, 'z' = caixa curta para rufos, 'g' = brilho de vidro."""
    if ins == 'k': return S.kick(None, 200, 46, 0.11, 0.55) * v * 1.05
    if ins == 's': return _add(S.snare(rng, int(0.3 * SR), 215, 0.1, 0.8) * 0.9, S.clap(rng, int(0.3 * SR)) * 0.8) * v
    if ins == 'p': return S.clap(rng) * v * 0.95
    if ins == 'z': return S.snare(rng, int(0.13 * SR), 235, 0.05, 0.85) * v * 0.85
    if ins == 'h': return S.hat(rng, None, 0.013) * v * 0.8
    if ins == 'o': return S.hat(rng, None, 0.02, True) * v * 0.75
    if ins == 'c': return S.crash(rng, None, 1.2) * v * 0.7
    if ins == 'r': return S.rim(rng) * v
    if ins == 'g':
        f = float(rng.choice([3520.0, 3951.0, 4435.0, 5274.0, 5919.0]))
        return S.modal(f, int(0.45 * SR), 'glass', 0.35) * v * 0.55
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 230, 't2': 170, 't3': 125}[ins], None, 0.2) * v
    raise KeyError(ins)


def kit_chalk(ins, rng, v):
    """Valsa de giz: bumbo de feltro, estalo de giz na lousa, riscos de giz e madeira."""
    if ins == 'k': return S.kick(None, 105, 52, 0.15, 0.04) * v * 0.85
    if ins == 's':
        n = int(0.07 * SR)
        t = S.tt(n)
        return _add(S.bp(rng.standard_normal(n), 2500, 9000, 1) * np.exp(-t / 0.018) * 0.9, S.wood(1900, n, 0.012) * 0.4) * v
    if ins == 'h':
        n = int(0.11 * SR)
        t = S.tt(n)
        return S.bp(rng.standard_normal(n), 3000, 10000, 1) * np.exp(-t / 0.035) * np.minimum(1, t / 0.012) * v * 0.6
    if ins == 'w': return S.wood(1500, None, 0.03) * v
    if ins == 'r': return S.rim(rng) * v * 0.8
    if ins == 'sh': return S.shaker(rng) * v * 0.8
    if ins == 'c': return S.crash(rng, None, 0.8) * v * 0.5
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 190, 't2': 145, 't3': 108}[ins], None, 0.25) * v
    raise KeyError(ins)


def kit_punk(ins, rng, v):
    """Garage/pop-punk: bumbo seco, caixa alta e estalada, hats abertos, prato de ataque, tons de virada."""
    if ins == 'k': return S.kick(None, 150, 54, 0.085, 0.45) * v * 1.05
    if ins == 's': return _add(S.snare(rng, int(0.26 * SR), 205, 0.1, 0.88), S.rim(rng, int(0.05 * SR)) * 0.35) * v * 1.05
    if ins == 'h': return S.hat(rng, None, 0.02) * v * 0.85
    if ins == 'o': return S.hat(rng, None, 0.02, True) * v * 0.85
    if ins == 'c': return S.crash(rng, None, 1.3) * v * 0.8
    if ins == 'r': return S.ride(rng) * v * 1.2
    if ins == 'x': return S.rim(rng) * v
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 215, 't2': 165, 't3': 118}[ins], None, 0.24) * v * 1.1
    raise KeyError(ins)


def kit_trip(ins, rng, v):
    """Trip-hop: bumbo fundo e longo, caixa pesada de sala (rabo longo), fantasma, chimbal empoeirado, aro."""
    if ins == 'k': return S.kick(None, 98, 40, 0.24, 0.1) * v * 1.0
    if ins == 's':
        n = int(0.55 * SR)
        t = S.tt(n)
        body = S.snare(rng, n, 165, 0.15, 0.72)
        room = S.bp(rng.standard_normal(n), 300, 5000, 1) * np.exp(-t / 0.2) * 0.35
        return (body + room) * v * 0.95
    if ins == 'g': return S.snare(rng, int(0.14 * SR), 170, 0.05, 0.85) * v * 0.45
    if ins == 'h': return S.hat(rng, None, 0.022) * v * 0.55
    if ins == 'o': return S.hat(rng, None, 0.03, True) * v * 0.5
    if ins == 'r': return S.rim(rng) * v * 0.8
    if ins == 'sh': return S.shaker(rng, None, 0.05) * v * 0.7
    if ins == 'w': return S.wood(1100) * v * 0.8
    raise KeyError(ins)


def kit_trance(ins, rng, v):
    """Eurodance/trance: bumbo cheio de quatro, palma, hat aberto no contratempo, prato e rufo."""
    if ins == 'k': return S.kick(None, 165, 47, 0.125, 0.4) * v * 1.05
    if ins == 'p': return S.clap(rng) * v
    if ins == 's': return _add(S.snare(rng, int(0.2 * SR), 220, 0.07, 0.85), S.clap(rng, int(0.2 * SR)) * 0.5) * v * 0.9
    if ins == 'z': return S.snare(rng, int(0.12 * SR), 240, 0.045, 0.88) * v * 0.85
    if ins == 'h': return S.hat(rng, None, 0.015) * v * 0.75
    if ins == 'o': return S.hat(rng, int(0.16 * SR), 0.02, True) * v * 0.95
    if ins == 'c': return S.crash(rng, None, 1.4) * v * 0.7
    if ins == 'sh': return S.shaker(rng, None, 0.04) * v * 0.9
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 215, 't2': 160, 't3': 118}[ins], None, 0.22) * v
    raise KeyError(ins)
