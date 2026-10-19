"""Efeitos sonoros do NEON STEP DX (mono, curtos). Chip + FM + corpos modais; tudo por código."""
import json
import os
import numpy as np
import synth as S
from synth import SR
import compose as C
import tape as TP


class Sig(np.ndarray):
    """Sinal que soma outro de tamanho diferente completando com silêncio."""
    def _pad(self, o):
        o = np.asarray(o)
        if o.ndim == 0 or o.shape == self.shape:
            return np.asarray(self), o
        m = max(len(self), len(o))
        a = np.zeros(m); a[:len(self)] = self
        b = np.zeros(m); b[:len(o)] = o
        return a, b

    def __add__(self, o):
        a, b = self._pad(o)
        return (a + b).view(Sig)

    __radd__ = __add__


def sg(x):
    return np.asarray(x, dtype=np.float64).view(Sig)


def n_of(d):
    return int(d * SR)


def blip(f0, f1, dur, wave='pulse', duty=0.5, tau=None, a=0.002):
    n = n_of(dur)
    f = S.sweep(f0, f1, n) if f0 != f1 else np.full(n, float(f0))
    if wave == 'pulse':
        y = S.pulse(f, n, duty)
    elif wave == 'tri':
        y = S.tri(f, n)
    elif wave == 'saw':
        y = S.saw(f, n) * 0.8
    else:
        y = S.sine(f, n)
    env = np.exp(-S.tt(n) / (tau or dur * 0.45)) * np.minimum(1.0, S.tt(n) / a)
    return sg(y * env * np.minimum(1.0, (n - np.arange(n)) / (0.004 * SR)))


def seq(notes, step, fn):
    """Sequência de notas: notes = [midi,...]; fn(midi, dur) -> sinal."""
    total = int((step * len(notes) + 0.6) * SR)
    out = np.zeros(total)
    for i, m in enumerate(notes):
        y = fn(m, step * 1.6)
        k = int(i * step * SR)
        out[k:k + len(y)] += y[: total - k]
    return out


def place(out, y, t):
    k = int(t * SR)
    if k < len(out):
        out[k:k + len(y)] += y[: len(out) - k]


def whoosh(dur, f0, f1, rng, level=0.5, q=1.0):
    """Ruído filtrado cujo centro varre de f0 a f1 (mistura de bandas em escala logarítmica)."""
    n = n_of(dur)
    x = rng.standard_normal(n)
    fc = S.sweep(f0, f1, n)
    centers = np.geomspace(150, 7000, 10)
    out = np.zeros(n)
    for c in centers:
        band = S.bp(x, c / 1.35, c * 1.35, 1)
        w = np.exp(-(np.log2(fc / c) / 0.6) ** 2)
        out += band * w
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    return sg(out * env * level * 1.5)


def coin(m, dur):
    n = n_of(dur)
    ie = np.exp(-S.tt(n) / 0.05)
    return sg(S.fm(S.hz(m), n, 2.0, 2.2, ie) * np.exp(-S.tt(n) / 0.12) * 0.7)


def bellf(m, dur, kind='glass', tilt=0.6):
    return sg(S.modal(S.hz(m), n_of(max(dur, 0.2) + 0.3), kind, tilt) * 0.9)


def pulsef(m, dur, duty=0.25):
    n = n_of(dur)
    return sg(S.pulse(S.hz(m), n, duty) * S.env_adsr(n, 0.002, 0.04, 0.5, 0.03) * 0.5)


# ------------------------------------------------------------------ definições

def sfx_defs():
    D = {}

    # interface
    D['ui_click'] = lambda r: blip(1500, 1500, 0.04, 'pulse', 0.25, tau=0.02) * 0.8
    D['ui_start'] = lambda r: _ui_start()
    D['ui_pause'] = lambda r: seq([79, 72], 0.07, lambda m, d: pulsef(m, d, 0.5))
    D['ui_resume'] = lambda r: seq([72, 79], 0.07, lambda m, d: pulsef(m, d, 0.5))

    # pousos (um por tipo de plataforma)
    D['land_normal'] = lambda r: blip(260, 120, 0.07, 'sine', tau=0.03) * 0.8 + 0.12 * blip(1800, 900, 0.015, 'pulse', 0.5, tau=0.008)
    D['land_moving'] = lambda r: blip(300, 150, 0.07, 'sine', tau=0.03) * 0.7 + 0.2 * blip(900, 1300, 0.07, 'tri', tau=0.04)
    D['land_conveyor'] = lambda r: _land_conveyor()
    D['land_fragile'] = lambda r: _crack(r)
    D['land_ghost'] = lambda r: _ghost(r)
    D['land_spring'] = lambda r: _boing()

    # coletáveis (fita sobe a nota com o combo)
    for k, step in enumerate([0, 2, 4, 7, 9]):
        D[f'tape{k + 1}'] = (lambda st: (lambda r: seq([76 + st, 83 + st], 0.055, coin)))(step)
    D['star'] = lambda r: seq([84, 88, 91, 96, 100, 103], 0.045, lambda m, d: bellf(m, d, 'glass', 0.4))
    D['shield'] = lambda r: _shield()
    D['boost'] = lambda r: _boost()
    D['jet'] = lambda r: _jet(r)
    D['heart'] = lambda r: seq([67, 74, 79], 0.09, lambda m, d: blip(S.hz(m), S.hz(m), d, 'tri', tau=0.2) * 0.9)
    D['flag'] = lambda r: seq([72, 76, 79, 84, 79, 84], 0.085, lambda m, d: pulsef(m, d, 0.25))
    D['magnet'] = lambda r: _magnet()

    # tiros e combate
    D['shoot'] = lambda r: blip(1500, 380, 0.09, 'pulse', 0.25, tau=0.045)
    D['enemy_shoot'] = lambda r: blip(700, 210, 0.14, 'pulse', 0.5, tau=0.08) * 0.8 + 0.25 * S.noise(7000, n_of(0.14)) * np.exp(-S.tt(n_of(0.14)) / 0.05)
    D['enemy_warn'] = lambda r: _warn()
    D['hit'] = lambda r: _hit(r)
    D['shield_block'] = lambda r: bellf(81, 0.35, 'bell', 0.25) + 0.3 * blip(1800, 600, 0.05, 'pulse', 0.5, tau=0.03)
    D['kill'] = lambda r: _kill(r, False)
    D['kill_big'] = lambda r: _kill(r, True)
    D['stomp'] = lambda r: blip(380, 70, 0.1, 'sine', tau=0.04) + 0.3 * S.noise(5000, n_of(0.1)) * np.exp(-S.tt(n_of(0.1)) / 0.03)

    # portais
    D['portal_world'] = lambda r: _portal_world(r)
    D['portal_paper'] = lambda r: _portal_paper(r)
    D['portal_bonus'] = lambda r: seq([72, 76, 79, 84, 88, 91, 96, 100, 103, 108], 0.05, coin)
    D['portal_warp'] = lambda r: _portal_warp(r)
    D['portal_back'] = lambda r: seq([84, 79, 72, 67], 0.09, lambda m, d: bellf(m, d, 'glass', 0.5))
    D['portal_time'] = lambda r: _portal_time()
    D['portal_leap'] = lambda r: seq([67, 72, 76, 79, 84, 88], 0.045, lambda m, d: pulsef(m, d, 0.125))
    D['portal_flip'] = lambda r: _portal_flip(r)
    D['portal_sketch'] = lambda r: _portal_sketch(r)
    D['portal_tele'] = lambda r: _portal_tele()

    # sala do portal / rascunho / mundo
    D['press'] = lambda r: blip(1100, 1100, 0.02, 'pulse', 0.5, tau=0.01) + seq([84, 91], 0.07, lambda m, d: bellf(m, d, 'glass', 0.45))
    D['bonk'] = lambda r: _bonk(r)
    D['swap'] = lambda r: _swap()
    D['revive'] = lambda r: seq([60, 67, 72, 76, 79, 84, 88, 91], 0.075, lambda m, d: bellf(m, d, 'glass', 0.9)) + 0.5 * whoosh(0.7, 500, 3000, r, 0.4)
    D['crush'] = lambda r: _crush(r)
    D['lava_warn'] = lambda r: _lava(r)
    D['life_low'] = lambda r: _heartbeat()
    D['fall'] = lambda r: blip(1500, 120, 0.7, 'sine', tau=0.5) * 0.9

    # fita: carregamento (começo da partida) e parada (fim das vidas)
    D['tape_load'] = lambda r: _tape_load()
    D['tape_stop'] = lambda r: _tape_stop()

    # vinhetas (música curta)
    D['over'] = lambda r: _over()
    D['record'] = lambda r: _record()
    return D


def _ui_start():
    y = seq([72, 76, 79, 84], 0.07, lambda m, d: pulsef(m, d, 0.25))
    out = np.zeros(n_of(1.1))
    out[: len(y)] += y[: len(out)]
    place(out, bellf(96, 0.5, 'glass', 0.5) * 0.7, 0.26)
    return out


def _land_conveyor():
    out = np.zeros(n_of(0.09))
    place(out, blip(220, 140, 0.05, 'sine', tau=0.02), 0.0)
    place(out, 0.3 * blip(2400, 2400, 0.012, 'pulse', 0.125, tau=0.006), 0.0)
    place(out, 0.25 * blip(2000, 2000, 0.012, 'pulse', 0.125, tau=0.006), 0.045)
    return out


def _crack(r):
    n = n_of(0.2)
    nz = S.hp(r.standard_normal(n), 1500) * np.exp(-S.tt(n) / 0.025)
    nz2 = np.zeros(n)
    k = n_of(0.06)
    nz2[k:] = S.hp(r.standard_normal(n - k), 1800) * np.exp(-S.tt(n - k) / 0.03)
    low = blip(180, 70, 0.12, 'sine', tau=0.05)
    out = np.zeros(n)
    out += 0.6 * nz + 0.5 * nz2
    out[: len(low)] += low[:n]
    return out


def _ghost(r):
    n = n_of(0.3)
    air = S.bp(r.standard_normal(n), 1500, 6000) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.25
    return air + 0.5 * blip(660, 880, 0.3, 'sine', tau=0.2)


def _boing():
    n = n_of(0.42)
    t = S.tt(n)
    f = 180 + 700 * (1 - np.exp(-t / 0.08)) + 40 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.2)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18) * np.minimum(1, t / 0.004)
    return y * 0.85 + 0.2 * S.pulse(f * 2, n, 0.25) * np.exp(-t / 0.08)


def _shield():
    n = n_of(0.6)
    t = S.tt(n)
    sweep = np.sin(2 * np.pi * np.cumsum(S.sweep(500, 2400, n)) / SR) * np.exp(-t / 0.25) * 0.5
    out = sweep
    place(out, bellf(88, 0.5, 'glass', 0.6) * 0.7, 0.12)
    return out


def _boost():
    out = np.zeros(n_of(0.5))
    for i, f in enumerate([300, 520]):
        n = n_of(0.22)
        t = S.tt(n)
        fr = f + 500 * (1 - np.exp(-t / 0.05))
        y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.1)
        place(out, y, i * 0.14)
    return out


def _jet(r):
    n = n_of(0.8)
    t = S.tt(n)
    nz = whoosh(0.8, 300, 3500, r, 0.5)
    prop = S.saw(S.sweep(120, 380, n), n) * 0.25 * np.sin(np.pi * np.linspace(0, 1, n)) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t))
    return nz + prop


def _magnet():
    n = n_of(0.5)
    t = S.tt(n)
    f = S.sweep(140, 330, n)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 24 * t)) * np.sin(np.pi * np.linspace(0, 1, n))
    return y * 0.85


def _warn():
    out = np.zeros(n_of(0.22))
    place(out, blip(1100, 1100, 0.05, 'pulse', 0.25, tau=0.03) * 0.8, 0.0)
    place(out, blip(1100, 1100, 0.05, 'pulse', 0.25, tau=0.03) * 0.8, 0.09)
    return out


def _hit(r):
    n = n_of(0.35)
    t = S.tt(n)
    nz = S.lp(r.standard_normal(n), 3500) * np.exp(-t / 0.06)
    low = np.sin(2 * np.pi * np.cumsum(S.sweep(180, 45, n)) / SR) * np.exp(-t / 0.12)
    dis = S.pulse(S.sweep(520, 330, n), n, 0.5) * np.exp(-t / 0.08) * 0.3
    return 0.55 * nz + 0.9 * low + dis


def _kill(r, big):
    n = n_of(0.7 if big else 0.28)
    t = S.tt(n)
    nz = S.bp(r.standard_normal(n), 700, 5000) * np.exp(-t / (0.14 if big else 0.05))
    pop = S.pulse(S.sweep(900, 150, n), n, 0.25) * np.exp(-t / (0.12 if big else 0.06)) * 0.5
    out = 0.7 * nz + pop
    if big:
        out += np.sin(2 * np.pi * np.cumsum(S.sweep(120, 35, n)) / SR) * np.exp(-t / 0.3) * 0.9
        place(out, bellf(60, 0.4, 'drum', 1.4) * 0.5, 0.0)
    return out


def _portal_world(r):
    n = n_of(1.0)
    t = S.tt(n)
    out = np.zeros(n)
    for k, f in enumerate([220, 330, 440, 660]):
        fr = S.sweep(f, f * 3.2, n)
        out += np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5 * 0.2
    place(out, 0.4 * whoosh(0.9, 400, 4000, r, 0.5), 0.0)
    place(out, seq([84, 88, 91, 96], 0.05, lambda m, d: bellf(m, d, 'glass', 0.6)), 0.55)
    return out


def _portal_paper(r):
    n = n_of(1.0)
    out = np.zeros(n)
    for k in range(10):
        m = int(r.integers(1500, 4000))
        y = S.hp(r.standard_normal(n_of(0.06)), 3500) * np.exp(-S.tt(n_of(0.06)) / 0.02) * 0.35
        place(out, y, 0.04 * k + float(r.uniform(0, 0.03)))
    place(out, seq([72, 76, 79, 84], 0.12, lambda m, d: bellf(m, d, 'box', 1.0)), 0.3)
    return out


def _portal_warp(r):
    n = n_of(1.3)
    t = S.tt(n)
    y = S.saw(S.sweep(80, 1400, n), n) * 0.35 * (t / t[-1]) ** 1.2
    return y * np.exp(-((t - 1.3) / 1.3) ** 2 * 0.2) + whoosh(1.2, 300, 6000, r, 0.7)


def _portal_time():
    n = n_of(1.0)
    t = S.tt(n)
    wow = 1 + 0.02 * np.sin(2 * np.pi * 7 * t)
    f = S.sweep(900, 90, n) * wow
    y = S.saw(f, n) * 0.4 * np.exp(-t / 0.5) * np.minimum(1, t / 0.01)
    out = y
    for k in range(5):
        place(out, blip(2200, 2200, 0.02, 'pulse', 0.5, tau=0.01) * 0.35, 0.15 * k + 0.05 * k * k * 0.05)
    return out


def _portal_flip(r):
    n = n_of(0.9)
    t = S.tt(n)
    y = np.sin(2 * np.pi * np.cumsum(S.sweep(2400, 220, n)) / SR) * np.exp(-t / 0.5) * 0.7
    y = y + 0.5 * whoosh(0.8, 5000, 300, r, 0.8)
    return y


def _portal_sketch(r):
    n = n_of(0.9)
    out = np.zeros(n)
    t = S.tt(n)
    scr = S.hp(r.standard_normal(n), 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 17 * t)) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.3
    out += scr
    place(out, seq([79, 83, 86], 0.1, lambda m, d: bellf(m, d, 'box', 0.9)), 0.35)
    return out


def _portal_tele():
    n = n_of(0.45)
    t = S.tt(n)
    idx = 6 * np.exp(-t / 0.15)
    y = S.fm(S.sweep(300, 1800, n), n, 1.5, 1.0, idx) * np.exp(-t / 0.2) * 0.7
    return y + 0.3 * np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.3)


def _bonk(r):
    n = n_of(0.2)
    t = S.tt(n)
    buzz = S.saw(np.full(n, 95.0), n) * 0.7 * np.exp(-t / 0.1)
    thump = np.sin(2 * np.pi * np.cumsum(S.sweep(160, 60, n)) / SR) * np.exp(-t / 0.06)
    return buzz + thump


def _swap():
    out = np.zeros(n_of(0.6))
    place(out, seq([79, 84], 0.1, lambda m, d: bellf(m, d, 'glass', 0.6)), 0.0)
    place(out, seq([84, 79], 0.1, lambda m, d: bellf(m, d, 'glass', 0.6)) * 0.7, 0.05)
    return out


def _crush(r):
    n = n_of(1.1)
    t = S.tt(n)
    rum = S.lp(r.standard_normal(n), 140) * np.exp(-t / 0.5) * 2.0
    crack = np.zeros(n)
    for k in range(6):
        place(crack, S.hp(r.standard_normal(n_of(0.05)), 2000) * np.exp(-S.tt(n_of(0.05)) / 0.015), 0.04 * k)
    low = np.sin(2 * np.pi * np.cumsum(S.sweep(110, 28, n)) / SR) * np.exp(-t / 0.4)
    return 0.6 * rum + 0.5 * crack + 0.9 * low


def _lava(r):
    n = n_of(0.6)
    t = S.tt(n)
    return np.sin(2 * np.pi * 68 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.8 + 0.2 * S.lp(r.standard_normal(n), 400)


def _heartbeat():
    out = np.zeros(n_of(0.55))
    place(out, np.sin(2 * np.pi * np.cumsum(S.sweep(95, 50, n_of(0.12))) / SR) * np.exp(-S.tt(n_of(0.12)) / 0.05), 0.0)
    place(out, 0.8 * np.sin(2 * np.pi * np.cumsum(S.sweep(85, 45, n_of(0.12))) / SR) * np.exp(-S.tt(n_of(0.12)) / 0.05), 0.16)
    return out


def _over():
    out = np.zeros(n_of(2.2))
    for k, m in enumerate([69, 67, 64, 57]):
        place(out, pulsef(m, 0.3, 0.5) * 0.9 + 0.5 * bellf(m + 12, 0.3, 'vibes', 0.6), 0.22 * k)
    place(out, blip(220, 55, 0.9, 'tri', tau=0.5) * 0.9, 0.9)
    return out


def _record():
    out = np.zeros(n_of(3.4))
    mel = [(72, 0.0), (76, 0.12), (79, 0.24), (84, 0.36), (79, 0.6), (84, 0.72), (88, 0.9), (91, 1.1), (96, 1.5)]
    for m, t in mel:
        place(out, pulsef(m, 0.28, 0.25) * 0.8 + 0.4 * bellf(m + 12, 0.3, 'glass', 0.8), t)
    for k, m in enumerate([60, 64, 67, 72]):
        place(out, S.tri(S.hz(m), n_of(1.6), 4) * S.env_adsr(n_of(1.6), 0.01, 0.2, 0.7, 0.8) * 0.4, 1.5 + 0.0 * k)
    place(out, bellf(100, 1.2, 'bell', 1.8) * 0.6, 1.5)
    return out


# ------------------------------------------------------------------ construção

LEVEL = {'land_normal': 0.5, 'land_moving': 0.5, 'land_conveyor': 0.5, 'land_fragile': 0.7, 'land_ghost': 0.6, 'land_spring': 0.8,
         'ui_click': 0.6, 'shoot': 0.55, 'enemy_shoot': 0.6, 'life_low': 0.7, 'lava_warn': 0.7, 'tape1': 0.7, 'tape2': 0.7, 'tape3': 0.7, 'tape4': 0.7, 'tape5': 0.7}


def build(ids, write_ogg, out_dir):
    D = sfx_defs()
    report = {}
    for name in (ids or list(D)):
        if name not in D:
            continue
        r = np.random.default_rng(sum(ord(c) * (i + 3) for i, c in enumerate(name)))
        y = np.asarray(D[name](r), dtype=np.float64)
        y = np.nan_to_num(y)
        # tira silêncio do começo, normaliza para -3 dBFS e aplica fade curto
        pk = float(np.max(np.abs(y)) + 1e-9)
        y = y / pk * 0.7
        k = int(0.002 * SR)
        y[:k] *= np.linspace(0, 1, k)
        k2 = int(0.006 * SR)
        y[-k2:] *= np.linspace(1, 0, k2)
        # corta cauda silenciosa
        env = np.abs(y)
        idx = np.where(env > 0.004)[0]
        if len(idx):
            y = y[: min(len(y), idx[-1] + int(0.02 * SR))]
        size = write_ogg(y, os.path.join(out_dir, 'sfx', f'{name}.ogg'), 3.0)
        report[name] = {'duracao_s': round(len(y) / SR, 3), 'bytes': size, 'pico_dBFS': round(20 * np.log10(np.max(np.abs(y)) + 1e-9), 2), 'nivel': LEVEL.get(name, 0.85)}
        print(f"sfx {name:14s} {len(y)/SR:5.2f}s {size/1024:5.1f} KB", flush=True)
    return report


def write_manifest(out_dir):
    """Gera native/src/arcade/audio/assets.ts com `require` estáticos (o Metro precisa deles) + duração/nível de cada som."""
    root = os.path.abspath(os.path.join(out_dir, '..', '..', '..'))
    ts_dir = os.path.join(root, 'src', 'arcade', 'audio')
    os.makedirs(ts_dir, exist_ok=True)
    mus = sorted(f[:-4] for f in os.listdir(os.path.join(out_dir, 'musica')) if f.endswith('.ogg'))
    sfx = sorted(f[:-4] for f in os.listdir(os.path.join(out_dir, 'sfx')) if f.endswith('.ogg'))
    meta = {}
    repo = os.path.abspath(os.path.join(root, '..'))
    try:
        rep = json.load(open(os.path.join(repo, 'docs', 'neon-step-dx', 'AUDIT_audio.json')))
        meta = rep.get('sfx', {})
    except Exception:
        pass
    lines = ['// GERADO por scripts/arcade_audio/build.py — não edite à mão.', '/* eslint-disable */', '', 'export const MUSIC = {']
    for n in mus:
        lines.append(f"  {n}: require('../../../assets/arcade/audio/musica/{n}.ogg'),")
    lines += ['} as const;', '', 'export const SFX = {']
    for n in sfx:
        lines.append(f"  {n}: require('../../../assets/arcade/audio/sfx/{n}.ogg'),")
    lines += ['} as const;', '', 'export type MusicId = keyof typeof MUSIC;', 'export type SfxId = keyof typeof SFX;', '',
              '/** Duração (s) e nível relativo (0..1) de cada efeito. */', 'export const SFX_META: Record<SfxId, {dur: number; level: number}> = {']
    for n in sfx:
        m = meta.get(n, {})
        lines.append(f"  {n}: {{dur: {m.get('duracao_s', 0.5)}, level: {m.get('nivel', 0.85)}}},")
    lines += ['};', '']
    open(os.path.join(ts_dir, 'assets.ts'), 'w').write('\n'.join(lines))


def _tape_load():
    data = bytes([69, 72, 76, 81, 76, 72, 69, 64, 67, 71, 74, 79, 74, 71, 67, 62, 65, 69, 72, 77])
    y = TP.loader(data, pilot_s=0.3, level=0.8)
    y = y[: n_of(1.3)]
    out = np.zeros(len(y) + n_of(0.1))
    out[: len(y)] = y
    place(out, blip(1800, 1800, 0.012, 'pulse', 0.5, tau=0.006), 0.0)
    return sg_(out * np.minimum(1.0, S.tt(len(out)) / 0.01))


def _tape_stop():
    n = n_of(1.4)
    notes = [57, 60, 64, 69]
    x = np.zeros(n)
    for k, m in enumerate(notes):
        y = S.pulse(S.hz(m), n_of(0.9), 0.25) * np.exp(-S.tt(n_of(0.9)) / 0.5) * 0.25
        x[n_of(0.0): n_of(0.9)] += y
    st = np.stack([x, x])
    st = TP.tape_stop(st, n_of(0.18), n_of(1.1), power=1.5)
    return sg_(st[0])


def sg_(x):
    return np.asarray(x, dtype=np.float64).view(Sig)
