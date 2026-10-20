"""Kits de bateria da leva D. Mesma assinatura: kit(ins, rng, v)."""
import numpy as np
import synth as S
from synth import SR


def kit_kraut(ins, rng, v):
    """Motorik: bumbo seco e batido, caixa estreita, chimbal de oitavos constante."""
    if ins == 'k': return S.kick(None, 135, 52, 0.12, 0.22) * v * 1.05
    if ins == 's': return S.snare(rng, int(0.2 * SR), 205, 0.075, 0.74) * v * 0.95
    if ins == 'h': return S.hat(rng, None, 0.02) * v * 0.85
    if ins == 'o': return S.hat(rng, None, 0.02, True) * v * 0.7
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 205, 't2': 150, 't3': 108}[ins], None, 0.22) * v
    if ins == 'c': return S.crash(rng, None, 1.1) * v * 0.7
    if ins == 'x': return S.rim(rng) * v * 0.8
    raise KeyError(ins)


def kit_orch(ins, rng, v):
    """Percussão de orquestra: tímpanos afinados em ré (k = D2, t1 = A1, t2 = D3, t3 = E2), prato, caixa de marcha, triângulo e estrondo."""
    def timp(f, tau=0.55):
        return S.taiko(int(1.2 * SR), f * 1.12, f, tau) * v * 0.5
    if ins == 'k': return timp(73.4)
    if ins == 't1': return timp(55.0)
    if ins == 't2': return timp(146.8, 0.45)
    if ins == 't3': return timp(82.4)
    if ins == 'c': return S.crash(rng, int(2.6 * SR), 1.5) * v * 0.65
    if ins == 's': return S.snare(rng, int(0.14 * SR), 240, 0.045, 0.92) * v * 0.55
    if ins == 'tri': return S.modal(3300, int(1.2 * SR), 'bell', 0.5) * v * 0.45
    if ins == 'g':
        n = int(3.4 * SR)
        t = S.tt(n)
        y = np.sin(2 * np.pi * np.cumsum(S.sweep(70, 34, n)) / SR) * np.exp(-t / 1.4)
        y += 0.5 * S.lp(rng.standard_normal(n), 300, 2) * np.exp(-t / 0.7)
        return y * v * 0.9
    raise KeyError(ins)


def kit_surf(ins, rng, v):
    """Surf: caixa estalada (a mola do barramento cuida do resto), tons graves marcando, chimbal aberto, prato."""
    if ins == 'k': return S.kick(None, 145, 50, 0.14, 0.25) * v * 1.0
    if ins == 's': return S.snare(rng, int(0.24 * SR), 215, 0.1, 0.8) * v
    if ins == 'h': return S.hat(rng, None, 0.022) * v * 0.85
    if ins == 'o': return S.hat(rng, None, 0.02, True) * v * 0.8
    if ins == 'r': return S.ride(rng) * v * 1.1
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 165, 't2': 147, 't3': 110}[ins], int(0.45 * SR), 0.3) * v * 1.1  # afinados em mi, ré, lá (a faixa é em lá)
    if ins == 'c': return S.crash(rng, None, 1.2) * v * 0.75
    if ins == 'x': return S.rim(rng) * v * 0.9
    raise KeyError(ins)


def kit_celt(ins, rng, v):
    """Bodhran e companhia: b = batida grave no centro, h = ponta (aguda), r = aro, s = guizos, f = pisada de bota no convés, w = colheres, c = sino de bordo."""
    if ins == 'b':
        n = int(0.28 * SR)
        t = S.tt(n)
        body = np.sin(2 * np.pi * np.cumsum(S.sweep(128, 78, n)) / SR) * np.exp(-t / 0.13)
        skin = S.bp(rng.standard_normal(n), 220, 1100, 1) * np.exp(-t / 0.045) * 0.5
        return (body + skin) * v * 1.0
    if ins == 'h':
        n = int(0.16 * SR)
        t = S.tt(n)
        body = np.sin(2 * np.pi * np.cumsum(S.sweep(215, 160, n)) / SR) * np.exp(-t / 0.06)
        skin = S.bp(rng.standard_normal(n), 600, 3200, 1) * np.exp(-t / 0.028) * 0.55
        return (body + skin) * v * 0.8
    if ins == 'r': return S.rim(rng) * v * 0.8
    if ins == 's': return S.shaker(rng, int(0.16 * SR), 0.07) * v * 1.1
    if ins == 'f':
        return (S.wood(150, int(0.18 * SR), 0.07) * 1.1 + S.kick(int(0.2 * SR), 95, 48, 0.08, 0.3) * 0.6) * v
    if ins == 'w': return S.wood(1500, None, 0.03) * v * 0.9
    if ins == 'c': return S.modal(1180, int(1.5 * SR), 'bell', 0.7) * v * 0.45
    raise KeyError(ins)


def kit_doom(ins, rng, v):
    """Doom: bumbo enorme e longo, caixa de sala grande, tons de chão, china e crash que não acabam, gongo."""
    if ins == 'k': return S.kick(int(0.7 * SR), 120, 36, 0.3, 0.35) * v * 1.05
    if ins == 's':
        n = int(0.9 * SR)
        t = S.tt(n)
        nz = S.hp(rng.standard_normal(n), 900) * np.exp(-t / 0.2)
        tn = np.sin(2 * np.pi * 150 * t * (1 + 0.3 * np.exp(-t / 0.03))) * np.exp(-t / 0.12)
        return (nz * 0.55 + tn * 0.9) * v * 1.05
    if ins in ('t1', 't2', 't3'): return S.tom({'t1': 125, 't2': 96, 't3': 72}[ins], int(1.0 * SR), 0.45) * v * 1.1
    if ins == 'c': return S.crash(rng, int(3.2 * SR), 1.8) * v * 0.7
    if ins == 'x':
        n = int(2.4 * SR)
        t = S.tt(n)
        y = S.hp(rng.standard_normal(n), 2400) * np.exp(-t / 0.9) * np.minimum(1, t / 0.01)
        y += 0.25 * S.bp(rng.standard_normal(n), 3500, 7000, 1) * np.exp(-t / 1.4)
        return y * v * 0.55
    if ins == 'h': return S.ride(rng, int(0.7 * SR)) * v * 1.3
    if ins == 'g': return S.modal(78, int(4.5 * SR), 'bowl', 3.0) * v * 0.9
    raise KeyError(ins)
