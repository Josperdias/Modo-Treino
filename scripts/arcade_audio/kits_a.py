"""Kits de bateria/percussão da leva v4 / compositor A. Mesma assinatura: kit(ins, rng, v)."""
import numpy as np
import synth as S
from synth import SR


def _add(*xs):
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[:len(x)] += x
    return out


def kit_chill(ins, rng, v):
    """Caixa-de-ritmos de fita (chillwave): bumbo redondo, caixa com 'sala' curta cortada, chimbal fosco, shaker."""
    if ins == 'k': return S.kick(None, 118, 46, 0.2, 0.1) * v * 0.95
    if ins == 's':
        n = int(0.4 * SR)
        t = S.tt(n)
        core = S.snare(rng, n, 178, 0.1, 0.62)
        room = S.bp(rng.standard_normal(n), 300, 5200, 1) * np.exp(-t / 0.16) * 0.25
        return S.lp(_add(core, room, 0.35 * S.clap(rng, n)), 7000, 1) * v * 0.9
    if ins == 'h': return S.lp(S.hat(rng, None, 0.028), 9000, 1) * v * 0.8
    if ins == 'o': return S.lp(S.hat(rng, None, 0.03, True), 8500, 1) * v * 0.7
    if ins == 'sh': return S.shaker(rng, None, 0.035) * v * 0.7
    if ins == 'r': return S.rim(rng) * v * 0.7
    if ins == 'c': return S.crash(rng, None, 0.9) * v * 0.5
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 190, 't2': 145, 't3': 108}[ins], None, 0.3) * v
    raise KeyError(ins)


def kit_disco(ins, rng, v):
    """Disco-funk: bumbo seco de quatro, caixa + palma, chimbal aberto no contratempo, pandeiro de 16, cowbell."""
    if ins == 'k': return S.kick(None, 165, 50, 0.115, 0.38) * v * 1.05
    if ins == 's': return _add(S.snare(rng, int(0.22 * SR), 215, 0.075, 0.8) * 0.9, 0.5 * S.clap(rng, int(0.22 * SR))) * v
    if ins == 'p': return S.clap(rng) * v * 0.95
    if ins == 'h': return S.hat(rng, None, 0.018) * v * 0.85
    if ins == 'o':
        n = int(0.22 * SR)
        return S.hp(rng.standard_normal(n), 6500) * np.exp(-S.tt(n) / 0.075) * v * 0.4
    if ins == 'sh':
        n = int(0.08 * SR)
        t = S.tt(n)
        y = S.bp(rng.standard_normal(n), 5200, 12000, 1) * np.exp(-t / 0.025)
        for f in (5400, 7100, 8800):
            y = y + 0.12 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.03)
        return y * v * 0.55
    if ins == 'cb':
        n = int(0.22 * SR)
        t = S.tt(n)
        sq = np.sign(np.sin(2 * np.pi * 560 * t)) + np.sign(np.sin(2 * np.pi * 845 * t))
        return S.lp(S.hp(sq * np.exp(-t / 0.07), 400), 3600) * v * 0.28
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 230, 't2': 170, 't3': 125}[ins], None, 0.2) * v * 1.1
    if ins == 'c': return S.crash(rng, None, 1.2) * v * 0.6
    raise KeyError(ins)


def kit_arc(ins, rng, v):
    """Fliperama barroco: timpano pequeno, tick de chip, triângulo, bloco de madeira e caixa seca de 8 bits."""
    if ins == 'k': return S.tom(105, int(0.5 * SR), 0.2) * v * 0.9
    if ins == 'b': return S.chip_kick() * v * 0.8
    if ins == 's': return S.chip_snare() * v * 0.45
    if ins == 'h': return S.chip_hat() * v * 0.3
    if ins == 'w': return S.wood(1400, None, 0.03) * v * 0.9
    if ins == 'tr':
        n = int(1.2 * SR)
        return S.modal(4300, n, 'bell', 0.5) * v * 0.35
    if ins == 'r': return S.rim(rng) * v * 0.7
    if ins == 'c': return S.crash(rng, None, 0.9) * v * 0.45
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 160, 't2': 125, 't3': 95}[ins], None, 0.25) * v
    raise KeyError(ins)


def kit_rag(ins, rng, v):
    """Ragtime: bloco de madeira (cascos), tábua de lavar (washboard), prato pequeno e bumbo de marcha."""
    if ins == 'k': return S.kick(None, 100, 55, 0.14, 0.1) * v * 0.85
    if ins == 'w': return S.wood(1250, int(0.08 * SR), 0.035) * v
    if ins == 'x': return S.wood(940, int(0.08 * SR), 0.035) * v * 0.9
    if ins == 'wb':
        n = int(0.11 * SR)
        t = S.tt(n)
        gate = (np.sin(2 * np.pi * 95 * t) > -0.2).astype(float)
        return S.bp(rng.standard_normal(n), 2600, 9000, 1) * np.exp(-t / 0.05) * gate * v * 0.7
    if ins == 's':
        n = int(0.2 * SR)
        t = S.tt(n)
        return S.bp(rng.standard_normal(n), 1800, 8500, 1) * np.exp(-t / 0.07) * np.minimum(1, t / 0.01) * v * 0.6
    if ins == 'h': return S.hat(rng, None, 0.02) * v * 0.6
    if ins == 'c': return S.crash(rng, None, 0.8) * v * 0.55
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 200, 't2': 150, 't3': 110}[ins], None, 0.2) * v
    raise KeyError(ins)


def kit_samba(ins, rng, v):
    """Bateria de escola: surdo (aberto/abafado), tamborim, pandeiro (batida + platinelas), ganzá, agogô, tantã, reco-reco."""
    if ins == 'su': return S.tom(72, int(0.8 * SR), 0.3) * v * 1.25
    if ins == 'sm': return S.tom(82, int(0.3 * SR), 0.07) * v * 0.9
    if ins == 'ta': return _add(S.wood(2250, int(0.07 * SR), 0.022) * 0.9, S.rim(rng) * 0.25) * v
    if ins == 'pd': return _add(S.tom(235, int(0.22 * SR), 0.06) * 0.9, S.bp(rng.standard_normal(int(0.1 * SR)), 5500, 12500, 1) * 0.35) * v
    if ins == 'pj':
        n = int(0.12 * SR)
        t = S.tt(n)
        y = S.bp(rng.standard_normal(n), 4800, 13500, 1) * np.exp(-t / 0.04)
        for f in (5200, 6600, 8300):
            y = y + 0.1 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.05)
        return y * v * 0.55
    if ins == 'sh': return S.shaker(rng, None, 0.03) * v * 0.8
    if ins == 'ag': return S.modal(920, int(0.35 * SR), 'box', 0.5) * v * 0.55
    if ins == 'ag2': return S.modal(690, int(0.35 * SR), 'box', 0.5) * v * 0.55
    if ins == 'tt': return _add(S.tom(150, int(0.3 * SR), 0.09), S.bp(rng.standard_normal(int(0.06 * SR)), 1500, 5000, 1) * 0.3) * v * 0.9
    if ins == 'rc':
        n = int(0.14 * SR)
        t = S.tt(n)
        gate = (np.sin(2 * np.pi * 70 * t) > 0).astype(float)
        return S.bp(rng.standard_normal(n), 2200, 7500, 1) * gate * np.exp(-t / 0.08) * v * 0.55
    if ins == 'c': return S.crash(rng, None, 0.9) * v * 0.5
    raise KeyError(ins)
