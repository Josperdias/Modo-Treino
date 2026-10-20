"""Instrumentos e utilidades da leva D (cosmos3, cosmos4, ocean3, ocean4, volcano3). Mesma assinatura: fn(song, midi, dur, **kw)."""
import numpy as np
import synth as S
from synth import SR


def _v(v):
    return 0.35 + 0.65 * v


def _vibr(t, rate, depth, delay=0.15, ramp=0.3):
    x = np.maximum(0, t - delay)
    return 1 + depth * np.sin(2 * np.pi * rate * x) * np.minimum(1, x / ramp)


# ---------------------------------------------------------------- krautrock (cosmos3)

def i_kbass(song, midi, dur, vel=0.9, cutoff=900, r=0.04):
    """Baixo motorik: serra + quadrada, filtro que fecha rápido, sub senoidal."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    t = S.tt(n)
    y = S.saw(f, n) * 0.7 + S.pulse(f, n, 0.5) * 0.3
    lo, hi = S.lp(y, cutoff * 0.45), S.lp(y, cutoff)
    w = np.exp(-t / 0.07)
    y = lo * (1 - w) + hi * w + 0.55 * S.sine(f, n)
    return y * S.env_adsr(n, 0.004, 0.1, 0.85, r) * _v(vel) * 0.6


def i_eguitar(song, midi, dur, vel=0.85, drive=2.2, decay=0.9968, bright=0.5, cutoff=3600):
    """Guitarra elétrica limpa-suja: corda dedilhada saturada (o eco da faixa faz o resto)."""
    n = int((dur + 0.6) * SR)
    k = S.karplus(float(S.hz(midi)), n, song.rng, decay, bright)
    k = np.tanh(k * drive) / np.tanh(drive)
    k = S.lp(k, cutoff, 1)
    return k * _v(vel) * 0.75


def i_moog(song, midi, dur, vel=0.85, cutoff=2400, a=0.012, r=0.12, vib=0.003):
    """Monossintetizador analógico: serra + quadrada, filtro abrindo, vibrato tardio."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * _vibr(t, 5.0, vib, 0.2, 0.4)
    y = (S.saw(f, n) + 0.8 * S.pulse(f * 0.5, n, 0.5) + 0.5 * S.saw(f * 1.004, n)) / 2.3
    lo, hi = S.lp(y, cutoff * 0.3), S.lp(y, cutoff)
    w = np.minimum(1, t / 0.18)
    return (lo * (1 - w) + hi * w) * S.env_adsr(n, a, 0.12, 0.8, r) * _v(vel) * 0.6


# ---------------------------------------------------------------- orquestra sintética (cosmos4)

def i_strings(song, midi, dur, vel=0.8, a=0.28, r=0.45, cutoff=3400, vib=0.004):
    """Naipe de cordas: cinco serras desafinadas, ataque lento, vibrato coletivo."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * _vibr(t, 5.3, vib, 0.1, 0.6)
    y = np.zeros(n)
    for d in (-0.009, -0.0035, 0.0, 0.0035, 0.009):
        y += S.saw(f * (1 + d), n)
    y = S.lp(y / 5.0, cutoff)
    return y * S.env_adsr(n, a, 0.2, 0.9, r) * _v(vel) * 0.55


def i_spicc(song, midi, dur, vel=0.8, cutoff=3000):
    """Cordas em spiccato: serra curta com ataque rápido."""
    n = int((dur + 0.08) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * 1.006, n) + S.saw(f * 0.994, n)) / 3.0
    y = S.lp(y, cutoff)
    return y * np.exp(-t / max(0.05, dur * 0.8)) * np.minimum(1, t / 0.004) * _v(vel) * 0.6


def i_horn(song, midi, dur, vel=0.85, cutoff=1900, a=0.07, r=0.2):
    """Trompa/metal heroico: serras com filtro que abre devagar, vibrato leve."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * _vibr(t, 5.0, 0.0035, 0.3, 0.5)
    y = (S.saw(f, n) + 0.6 * S.saw(f * 1.003, n) + 0.4 * S.pulse(f, n, 0.3)) / 2.0
    lo, hi = S.lp(y, cutoff * 0.3), S.lp(y, cutoff)
    w = np.minimum(1, t / 0.28)
    return (lo * (1 - w) + hi * w) * S.env_adsr(n, a, 0.12, 0.88, r) * _v(vel) * 0.55


def i_harp(song, midi, dur, vel=0.85, decay=0.9955, bright=0.35):
    n = int((dur + 0.9) * SR)
    k = S.karplus(float(S.hz(midi)), n, song.rng, decay, bright)
    return S.lp(k, 5200, 1) * _v(vel) * 0.7


def i_celesta(song, midi, dur, vel=0.85, tilt=0.9):
    n = int((max(dur, 0.2) + 1.0) * SR)
    return S.modal(float(S.hz(midi)), n, 'bell', tilt) * _v(vel) * 0.55


def i_impact(song, midi, dur, vel=0.9):
    """Pancada cinematográfica: seno que cai de tom + ruído grave."""
    n = int(max(dur, 1.8) * SR)
    t = S.tt(n)
    f0 = float(S.hz(midi))
    y = np.sin(2 * np.pi * np.cumsum(S.sweep(f0 * 2.2, f0, n)) / SR) * np.exp(-t / 0.9)
    y += 0.7 * S.lp(song.rng.standard_normal(n), 220, 2) * np.exp(-t / 0.5)
    return y * _v(vel) * 0.8


# ---------------------------------------------------------------- surf (ocean3)

def i_trem(song, midi, dur, vel=0.9, rate=15.0, decay=0.9982, bright=0.55, cutoff=5400, drive=1.5, r=0.3):
    """Palhetada em tremolo: a mesma corda re-palhetada rapidamente (descendo/subindo), com saturação leve."""
    f = float(S.hz(midi))
    n = int((dur + r) * SR)
    pick = S.karplus(f, int(0.2 * SR), song.rng, decay, bright)
    out = np.zeros(n)
    dt = int(SR / rate)
    nd = int(dur * SR)
    k = 0
    while k * dt < max(nd, 1):
        g = (1.0 if k % 2 == 0 else 0.8) * (0.9 + 0.1 * song.rng.random())
        a0 = k * dt
        seg = pick[:max(0, min(len(pick), n - a0))]
        out[a0:a0 + len(seg)] += seg * g
        k += 1
    pk = np.max(np.abs(out)) + 1e-9
    out = np.tanh(out / pk * drive) / np.tanh(drive)
    out = S.lp(out, cutoff, 1)
    out[nd:] *= np.exp(-S.tt(n - nd) / 0.12)
    return out * _v(vel) * 0.75


def i_pbass(song, midi, dur, vel=0.9, tau=0.28):
    """Baixo de palheta: corda curta grave + corpo senoidal, ataque seco."""
    n = int((dur + 0.15) * SR)
    f = float(S.hz(midi))
    k = S.karplus(f, n, song.rng, 0.994, 0.3)
    y = 0.6 * S.lp(k, 520, 2) + 0.7 * S.sine(f, n) * np.exp(-S.tt(n) / tau)
    y[int(dur * SR + 0.05 * SR):] *= np.linspace(1, 0, max(1, n - int(dur * SR + 0.05 * SR)))
    return y * _v(vel) * 0.9


def i_chop(song, midi, dur, vel=0.8, cutoff=3200):
    """Guitarra rítmica abafada (palm mute) em acordes de duas notas."""
    n = int((dur + 0.1) * SR)
    k = S.karplus(float(S.hz(midi)), n, song.rng, 0.985, 0.4)
    k = np.tanh(k * 1.6)
    return S.lp(k, cutoff, 2) * np.exp(-S.tt(n) / 0.09) * _v(vel) * 0.7


def spring_ir(seconds=1.6):
    """Resposta ao impulso de mola de reverb: cadeia de 'boings' (chirps descendentes) com decaimento."""
    n = int(seconds * SR)
    ir = np.zeros(n)
    sp = int(0.034 * SR)
    L = int(0.022 * SR)
    f = np.geomspace(4600, 520, L)
    chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(L)
    k = 1
    while k * sp + L < n:
        ir[k * sp:k * sp + L] += chirp * (0.84 ** k) * (1 if k % 2 else -0.8)
        k += 1
    rng = np.random.default_rng(11)
    nz = S.bp(rng.standard_normal(n), 400, 3500, 1) * np.exp(-S.tt(n) / 0.35) * 0.05
    ir = ir * 0.9 + nz
    ir[0] = 1.0
    return (ir / (np.max(np.abs(ir)) + 1e-9)).astype(np.float32)


def ocean_wash(rng, dur_s, lo=250, hi=3200, peak=0.5, power=2.2):
    """Onda: ruído filtrado que enche, arrebenta e se arrasta na areia (mono)."""
    n = int(dur_s * SR)
    u = np.linspace(0, 1, n)
    env = np.sin(np.pi * u ** 0.8) ** power
    x = rng.standard_normal(n)
    a = S.bp(x, lo, hi, 1)
    b = S.bp(x, hi, hi * 2.5, 1) * u ** 2
    return (a + 0.4 * b) * env * peak


# ---------------------------------------------------------------- jig / marujos (ocean4)

def i_fiddle(song, midi, dur, vel=0.85, vib=0.006, a=0.035, r=0.09, bright=3900):
    """Rabeca: serra com leve 'raspada' de arco, vibrato tardio, ressonâncias de corpo e ruído de crina."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * _vibr(t, 5.6, vib, 0.16, 0.25) * (1 - 0.012 * np.exp(-t / 0.03))
    y = S.saw(f, n) * 0.8 + S.saw(f * 1.002, n) * 0.3
    y = S.lp(y, bright, 2)
    y = y + 0.35 * S.bp(y, 700, 1100, 1) + 0.22 * S.bp(y, 2000, 3000, 1)
    y = y + 0.025 * S.bp(song.rng.standard_normal(n), 2000, 6500, 1)
    return y * S.env_adsr(n, a, 0.05, 0.92, r) * _v(vel) * 0.55


def i_accordion(song, midi, dur, vel=0.8, a=0.022, r=0.06, musette=0.007, cutoff=3300):
    """Acordeão/concertina: palhetas retangulares com coro 'musette' (desafinação entre palhetas) e foles que respiram."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = (S.pulse(f, n, 0.32) + S.pulse(f * (1 + musette), n, 0.32) + 0.6 * S.pulse(f * (1 - musette), n, 0.45) + 0.4 * S.pulse(f * 0.5, n, 0.5)) / 3.0
    y = S.lp(y, cutoff, 2)
    bellows = 1 + 0.06 * np.sin(2 * np.pi * 0.9 * t)
    return y * bellows * S.env_adsr(n, a, 0.05, 0.92, r) * _v(vel) * 0.55


def i_whistle(song, midi, dur, vel=0.85, a=0.03, r=0.1):
    """Apito de lata: seno puro, harmônicos fracos, sopro e ataque 'tu'."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * _vibr(t, 5.5, 0.003, 0.25, 0.3)
    y = S.sine(f, n) + 0.12 * S.sine(f * 2, n) + 0.04 * S.sine(f * 3, n)
    y = y + S.bp(song.rng.standard_normal(n), 3000, 8000, 1) * 0.07
    y = y + S.bp(song.rng.standard_normal(n), 3000, 8000, 1) * 0.12 * np.exp(-t / 0.03)
    return y * S.env_adsr(n, a, 0.04, 0.9, r) * _v(vel) * 0.55


def i_shout(song, midi, dur, vel=1.0, vowel='e'):
    """Grito da tripulação ('HEY!'): vogal de formantes, sopro e queda de tom."""
    n = int((dur + 0.05) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + 0.1 * np.exp(-t / 0.06))
    y = S.formant(f, n, vowel, song.rng, breath=0.18)
    return y * np.minimum(1, t / 0.008) * np.exp(-t / max(0.06, dur * 0.5)) * _v(vel) * 0.9


# ---------------------------------------------------------------- doom (volcano3)

def i_pgtr(song, midi, dur, vel=0.9, det=0.004, a=0.008, r=0.3, cutoff=3000, fifth=True, oct_=True):
    """Acorde de potência (raiz + quinta + oitava) em serras gordas. A distorção vem do barramento."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n)
    if fifth:
        y += 0.8 * (S.saw(f * 1.4983, n) + S.saw(f * 1.4983 * (1 + det), n))
    if oct_:
        y += 0.5 * S.saw(f * 2.0 * (1 - det), n)
    y = S.lp(y / 4.0, cutoff, 1)
    return y * S.env_adsr(n, a, 0.4, 0.82, r) * _v(vel) * 0.6


def i_lgtr(song, midi, dur, vel=0.9, bend=0.0, cutoff=3400, r=0.3, vib=0.01):
    """Guitarra solo suja: serra + pulso, 'bend' de entrada em semitons (sobe até a nota), vibrato largo e lento."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * _vibr(t, 5.2, vib, 0.3, 0.5) * 2.0 ** (-bend / 12.0 * np.exp(-t / 0.25))
    y = (S.saw(f, n) + 0.5 * S.pulse(f, n, 0.35) + 0.3 * S.saw(f * 2.0, n)) / 1.8
    y = S.lp(y, cutoff, 1)
    return y * S.env_adsr(n, 0.02, 0.3, 0.85, r) * _v(vel) * 0.6


def i_feedback(song, midi, dur, vel=0.8, r=0.8):
    """Microfonia: seno que cresce devagar, com 2º/3º harmônicos saturados e tremolo lento."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * _vibr(t, 0.5, 0.004, 0.0, 1.0)
    y = np.tanh(2.4 * (S.sine(f, n) + 0.3 * S.sine(f * 2.0, n) + 0.12 * S.sine(f * 3.0, n)))
    return y * S.env_adsr(n, min(dur * 0.6, 2.5), 0.2, 0.9, r) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.3 * t)) * _v(vel) * 0.5


def i_sub2(song, midi, dur, vel=0.9, r=0.1):
    """Subgrave com harmônicos (para o baixo sujo ser ouvido em alto-falante pequeno)."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = np.tanh(1.8 * (S.sine(f, n) + 0.35 * S.sine(f * 2, n) + 0.2 * S.sine(f * 3, n)))
    return y * S.env_adsr(n, 0.01, 0.1, 0.95, r) * _v(vel) * 0.7


def glide(song, bus, step, dur_s, m0, m1, gain=0.5, pan=0.0, kind='sine', vel=0.8):
    """Varredura de tom (m0 -> m1 em midi) com envelope em sino: naves, uivos, quedas."""
    n = int(dur_s * SR)
    f = S.hz(np.linspace(m0, m1, n))
    ph = np.cumsum(f) / SR
    y = np.sin(2 * np.pi * ph) if kind == 'sine' else S.lp(S.saw(f, n), 2200, 1)
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.6
    song.sample(bus, y * env * vel, step, gain=gain, pan=pan)


def automate(sg, points):
    """Automação de volume do mestre: `points` = [(compasso, dB)] interpolados linearmente (valores fora ficam no primeiro/último).
    Entra no `post` (antes de igualar o volume final), então só dá FORMA à dinâmica (crescendo, quebra, saída)."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]

    def fn(mix, song):
        n = mix.shape[1]
        bar_n = song.spb * song.step_s * SR
        t = np.arange(n) / bar_n
        g = 10 ** (np.interp(t, xs, ys) / 20.0)
        return mix * g
    sg.post.append(fn)
