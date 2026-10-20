"""Fita cassete por código: wow/flutter, saturação, chiado, tape-stop, travadas, corrupção e o som de 'carregando' (pulsos de
loader de computador doméstico dos anos 80, formato público). Funciona em áudio estéreo (2, N)."""
import numpy as np
from synth import SR
import synth as S


def _read(x, pos):
    """Leitura circular com interpolação linear em posições fracionárias (x: (2,N))."""
    n = x.shape[1]
    p = np.mod(pos, n)
    i0 = np.floor(p).astype(np.int64)
    fr = p - i0
    i1 = (i0 + 1) % n
    return x[:, i0] * (1 - fr) + x[:, i1] * fr


def varispeed(x, rate):
    """Toca `x` com velocidade variável (rate=1 normal). A posição inicial é 0."""
    pos = np.concatenate([[0.0], np.cumsum(rate[:-1])])
    return _read(x, pos)


def wow_flutter(x, rng, wow=0.0022, flutter=0.0009, wow_hz=0.55, flutter_hz=6.3):
    """Oscilação lenta (wow) e rápida (flutter). As frequências são arredondadas para um número inteiro de ciclos por loop,
    então a posição volta a zero no fim e a emenda continua perfeita."""
    n = x.shape[1]
    T = n / SR
    t = np.arange(n) / SR
    fw = max(1, round(wow_hz * T)) / T
    ff = max(1, round(flutter_hz * T)) / T
    rate = 1 + wow * np.sin(2 * np.pi * fw * t + rng.uniform(0, 6.28)) + flutter * np.sin(2 * np.pi * ff * t + rng.uniform(0, 6.28))
    rate = rate - (rate.mean() - 1)  # média exatamente 1
    return varispeed(x, rate)


def tape_color(x, rng, drive=1.4, lp_hz=11500, hiss_level=0.006, crackle=0.0):
    """Saturação suave (cabeça magnética), queda de agudos, chiado e, se quiser, estalinhos."""
    y = np.tanh(x * drive) / np.tanh(drive)
    out = np.stack([S.lp(c, lp_hz, 1) for c in y])
    n = out.shape[1]
    out = out + np.stack([S.hiss(rng, n, hiss_level), S.hiss(rng, n, hiss_level)])
    if crackle:
        out = out + np.stack([S.crackle(rng, n, 10.0, crackle), S.crackle(rng, n, 10.0, crackle)])
    return out


def tape_stop(x, i0, length, power=1.6, tail_fade=0.18):
    """A fita desacelera até parar na região [i0, i0+length): o tom cai e o som some. Substitui a região (mesmo tamanho)."""
    u = np.linspace(0, 1, length)
    rate = (1 - u) ** power
    pos = i0 + np.concatenate([[0.0], np.cumsum(rate[:-1])])
    seg = _read(x, pos)
    fade = np.clip((1 - u) / tail_fade, 0, 1)
    seg = seg * fade
    y = x.copy()
    j = (i0 + np.arange(length)) % x.shape[1]
    y[:, j] = seg
    return y


def tape_start(x, i1, length, power=1.6):
    """O contrário: a fita acelera e chega à velocidade normal exatamente em i1 (região [i1-length, i1))."""
    u = np.linspace(0, 1, length)
    rate = u ** power
    cum = np.concatenate([[0.0], np.cumsum(rate[:-1])])
    pos = i1 - (cum[-1] - cum) - 1
    seg = _read(x, pos) * np.clip(u / 0.18, 0, 1)
    y = x.copy()
    j = (i1 - length + np.arange(length)) % x.shape[1]
    y[:, j] = seg
    return y


def stutter(x, i0, slice_len, reps, shrink=0.8):
    """Repete uma fatia que vai encurtando (trava de leitor)."""
    y = x.copy()
    n = x.shape[1]
    sl = x[:, i0:i0 + slice_len].copy()
    pos = i0
    L = slice_len
    for _ in range(reps):
        seg = sl[:, :max(16, int(L))]
        k = seg.shape[1]
        j = (pos + np.arange(k)) % n
        y[:, j] = seg
        pos += k
        L *= shrink
    return y


def crush(x, i0, i1, bits=5, hold=6):
    """Corrupção: reduz bits e taxa de amostragem numa região."""
    y = x.copy()
    seg = y[:, i0:i1]
    seg = np.repeat(seg[:, ::hold], hold, axis=1)[:, : i1 - i0]
    q = 2 ** (bits - 1)
    y[:, i0:i1] = np.round(seg * q) / q
    return y


def dropouts(x, rng, count=6, ms=(18, 70), depth=0.9):
    """Falhas de óxido: o som some por alguns milissegundos."""
    y = x.copy()
    n = x.shape[1]
    for _ in range(count):
        L = int(rng.uniform(*ms) / 1000 * SR)
        p = int(rng.integers(0, max(1, n - L)))
        env = np.ones(L)
        k = max(2, L // 6)
        env[:k] = np.linspace(1, 1 - depth, k)
        env[k:L - k] = 1 - depth
        env[L - k:] = np.linspace(1 - depth, 1, k)
        y[:, p:p + L] *= env
    return y


def bitflip_noise(rng, n, level=0.2):
    """Ruído de dados: rajadas de 1 bit amostradas devagar."""
    bits = rng.integers(0, 2, n // 24 + 1) * 2.0 - 1.0
    return np.repeat(bits, 24)[:n] * level


def loader(data, half0=855e-6, half1=1710e-6, pilot_half=2168e-6, pilot_s=0.5, level=0.5):
    """Sinal de carregamento de fita (estilo ZX): tom-piloto, sincronismo e bits (0 = pulsos curtos, 1 = pulsos longos).
    `data` = bytes. Devolve um sinal mono de onda quadrada (SR)."""
    out = []

    def pulse(half):
        k = max(1, int(round(half * SR)))
        return [1.0] * k + [-1.0] * k

    for _ in range(int(pilot_s / (2 * pilot_half))):
        out += pulse(pilot_half)
    out += pulse(667e-6) + pulse(735e-6)
    for byte in data:
        for b in range(7, -1, -1):
            out += pulse(half1 if (byte >> b) & 1 else half0)
    y = np.array(out, dtype=np.float64) * level
    return S.lp(y, 5200, 1)


def score_bytes(notes):
    """Bytes da partitura: cada nota vira (passo, nota MIDI, duração). Assim a fita 'carrega a própria música'."""
    b = bytearray()
    for (st, m, ln) in notes:
        b += bytes([int(st) & 255, int(m) & 255, int(ln) & 255])
    return bytes(b)
