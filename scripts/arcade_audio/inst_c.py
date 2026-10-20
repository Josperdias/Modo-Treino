"""Instrumentos e kits da leva C (neon4, crystal3, crystal4, clock3, clock4). Mesma assinatura: (song, midi, dur, **kw)."""
import numpy as np
import synth as S
from synth import SR


def _v(v):
    return 0.35 + 0.65 * v


def _dist(y, drive):
    return np.tanh(y * drive) / np.tanh(drive)


def _crush(y, bits=5, hold=4):
    y = np.repeat(y[::hold], hold)[:len(y)]
    q = 2 ** (bits - 1)
    return np.round(y * q) / q


# ============================== chip-metal ==============================

def i_riff(song, midi, dur, vel=0.9, mute=False, power=True, drive=3.5, cutoff=3400, trem=0.0, r=0.03, duty=0.25, mix_saw=0.5):
    """Guitarra de 'speed metal de cartucho': pulso + serra distorcidos, quinta empilhada, abafada (mute) ou em trêmolo."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)

    def one(fr):
        return (1 - mix_saw) * S.pulse(fr, n, duty) + mix_saw * S.saw(fr, n)

    y = one(f)
    if power:
        y = y + 0.5 * one(f * 1.4983) + 0.25 * S.saw(f * 2, n)
    y = _dist(y * 0.8, drive)
    y = S.lp(y, cutoff, 2)
    env = S.env_adsr(n, 0.002, 0.04, 0.9, r)
    if mute:
        env = env * (0.18 + 0.82 * np.exp(-t / 0.055))
    if trem:
        g = 0.5 + 0.5 * np.tanh(3.0 * np.sin(2 * np.pi * trem * t))
        env = env * (0.45 + 0.55 * g)
    return y * env * _v(vel) * 0.42


def i_solo(song, midi, dur, vel=0.9, duty=0.25, vib=0.011, vib_delay=0.12, pre=0.0, scoop=0.0, r=0.04, a=0.003, body=0.25):
    """Solo de pulso: pré-bend que sobe até a nota, vibrato tardio e, nas notas longas, um 'bend' final de `scoop` semitons."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    sem = -pre * np.exp(-t / 0.07)
    if scoop and dur > 0.3:
        u = np.clip((t - (dur - 0.22)) / 0.2, 0, 1)
        sem = sem + scoop * (u * u * (3 - 2 * u))
    tv = np.maximum(0, t - vib_delay)
    f = S.hz(midi) * 2.0 ** (sem / 12.0) * (1 + vib * np.sin(2 * np.pi * 6.0 * tv) * np.minimum(1, tv / 0.2))
    d = duty + 0.1 * np.sin(2 * np.pi * 0.7 * t)
    y = S.pulse(f, n, d) * 0.7 + body * S.lp(S.saw(f, n), 4200)
    y = _dist(y, 1.6)
    return y * S.env_adsr(n, a, 0.04, 0.9, r) * _v(vel) * 0.5


def i_pulsepad(song, midi, dur, vel=0.8, a=0.05, r=0.15, duty=0.5, cutoff=3000):
    """Cordas de cartucho (epicidade da ponte): serra VRC6 + pulso, ataque lento e leve ondulação."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = 0.6 * S.saw6(f, n) + 0.4 * S.pulse(f * 1.003, n, duty)
    y = S.lp(y, cutoff)
    return y * S.env_adsr(n, a, 0.1, 0.9, r) * (0.85 + 0.15 * np.sin(2 * np.pi * 5.2 * t)) * _v(vel) * 0.4


def kit_metal(ins, rng, v):
    """Bateria de speed metal de 8 bits: bumbo curtíssimo (pedal duplo), caixa de ruído LFSR, hat, prato, toms de triângulo."""
    if ins == 'k':
        n = int(0.09 * SR)
        y = S.tri(S.sweep(160, 48, n), n) * S.env_exp(n, 0.04)
        y[:int(0.003 * SR)] += 0.5 * np.hanning(int(0.006 * SR))[:int(0.003 * SR)]
        return y * v * 1.1
    if ins == 's':
        return (S.chip_snare(int(0.2 * SR)) * 0.6 + S.snare(rng, int(0.2 * SR), 210, 0.07, 0.8) * 0.5) * v
    if ins == 'h': return S.chip_hat() * v * 0.5
    if ins == 'o': return S.chip_hat(open_=True) * v * 0.45
    if ins == 'c':
        n = int(1.1 * SR)
        return (S.noise(24000, n) * 0.5 + S.hp(rng.standard_normal(n), 4000) * 0.4) * S.env_exp(n, 0.4) * v * 0.45
    if ins in ('t1', 't2', 't3'):
        n = int(0.22 * SR)
        f0 = {'t1': 260, 't2': 190, 't3': 140}[ins]
        return S.tri(S.sweep(f0, f0 * 0.5, n), n) * S.env_exp(n, 0.1) * v * 1.2
    if ins == 'r': return S.noise(30000, int(0.05 * SR), short=True) * S.env_exp(int(0.05 * SR), 0.015) * v * 0.5
    raise KeyError(ins)


# ============================== cristal: harpa, harmônica de vidro ==============================

def i_harp(song, midi, dur, vel=0.9, decay=0.9968, bright=0.3, cutoff=5400, tail=1.6):
    """Harpa macia: corda dedilhada (Karplus) com corpo de seno e queda de agudos."""
    f = float(S.hz(midi))
    n = int((max(dur, 0.2) + tail) * SR)
    t = S.tt(n)
    y = karplus_t(f, n, song.rng, decay, bright)
    y = S.lp(y, cutoff, 1)
    y = 0.8 * y + 0.22 * S.sine(f, n) * np.exp(-t / 0.7)
    y = y * np.minimum(1, t / 0.002)
    k = int(0.05 * SR)
    y[-k:] *= np.linspace(1, 0, k)
    return y * _v(vel) * 0.7


def i_hglass(song, midi, dur, vel=0.8, a=0.3, r=0.7, vib=0.0035):
    """Harmônica de vidro: senos que soam como dedo molhado no cálice, dois ligeiramente desafinados, respiração lenta."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 4.6 * t) * np.minimum(1, t / 0.8))
    y = (S.sine(f, n) + S.sine(f * 1.0016, n) + 0.28 * S.sine(f * 2.0, n) + 0.07 * S.sine(f * 3.0, n) + 0.04 * S.sine(f * 4.01, n)) / 2.4
    y = y * (0.88 + 0.12 * np.sin(2 * np.pi * 5.9 * t + 1.0))
    return y * S.env_adsr(n, a, 0.2, 0.9, r) * _v(vel) * 0.6


def i_aurora(song, midi, dur, vel=0.7, a=0.9, r=1.4, cutoff=2400, det=0.004):
    """Pad auroral: serras suaves desafinadas com um brilho de oitava que passa devagar (filtro respirando)."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n)) / 3.0
    lo, hi = S.lp(y, cutoff * 0.35), S.lp(y, cutoff)
    w = 0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t + midi)
    y = lo * (1 - w) + hi * w + 0.12 * S.sine(f * 2, n) * w
    return y * S.env_adsr(n, a, 0.4, 0.85, r) * _v(vel) * 0.45


def i_icebell(song, midi, dur, vel=0.8, tilt=0.8):
    """Sineta de gelo: vidro agudo, brilhante e curto."""
    n = int((max(dur, 0.15) + 0.9 * tilt) * SR)
    return S.modal(float(S.hz(midi)), n, 'glass', tilt) * _v(vel) * 0.8


# ============================== glitch / IDM ==============================

def i_bellg(song, midi, dur, vel=0.85, tilt=0.7, bits=0, hold=3):
    """Sino digital: sino modal, opcionalmente esmagado (bitcrush) para soar picotado."""
    n = int((max(dur, 0.15) + 0.9 * tilt) * SR)
    y = S.modal(float(S.hz(midi)), n, 'bell', tilt)
    if bits:
        y = _crush(y, bits, hold)
    return y * _v(vel) * 0.75


def i_slice(song, midi, dur, vel=0.8, gate=(1, 1, 0, 1, 0, 1, 1, 0), rate=22.0, tilt=1.4):
    """Voz de vidro fatiada: vidro sustentado com uma porta (gate) rítmica, bordas macias."""
    n = int((dur + 0.15) * SR)
    t = S.tt(n)
    y = S.modal(float(S.hz(midi)), n, 'glass', 6.0 * tilt)
    y = y + 0.5 * S.sine(S.hz(midi), n) * np.exp(-t / (1.2 * tilt))
    g = np.array(gate, dtype=float)
    idx = (t * rate).astype(int) % len(g)
    gt = g[idx]
    k = max(3, int(0.0025 * SR))
    gt = np.convolve(gt, np.ones(k) / k, mode='same')
    return y * gt * _v(vel) * 0.7


def i_blip(song, midi, dur, vel=0.8, bits=4, hold=2):
    """Bip de pulso esmagado (clique musical de IDM)."""
    n = int((dur + 0.02) * SR)
    t = S.tt(n)
    y = S.pulse(S.hz(midi), n, 0.25) * np.exp(-t / 0.05)
    y = _crush(y, bits, hold)
    return y * S.env_adsr(n, 0.001, 0.03, 0.5, 0.01) * _v(vel) * 0.5


def i_gsub(song, midi, dur, vel=0.9, r=0.04, drive=1.5):
    """Sub de seno com um toque de 2º harmônico saturado."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = S.sine(f, n) + 0.3 * S.sine(f * 2, n)
    y = _dist(y, 1 + drive)
    return y * S.env_adsr(n, 0.004, 0.05, 0.9, r) * _v(vel) * 0.8


def kit_glitch(ins, rng, v):
    """IDM: bumbo seco, caixa esmagada, cliques, hats minúsculos, bips, tictacs de vidro, estalo de ruído."""
    if ins == 'k': return S.kick(None, 135, 44, 0.12, 0.45) * v
    if ins == 'd': return S.kick(int(0.14 * SR), 190, 60, 0.05, 0.5) * v * 0.8
    if ins == 's':
        n = int(0.2 * SR)
        t = S.tt(n)
        y = S.bp(rng.standard_normal(n), 1400, 7000, 1) * np.exp(-t / 0.06) + 0.5 * np.sin(2 * np.pi * 240 * t * (1 + 0.5 * np.exp(-t / 0.02))) * np.exp(-t / 0.04)
        return _crush(y, 5, 2) * v * 0.9
    if ins == 'g':
        n = int(0.09 * SR)
        t = S.tt(n)
        y = S.bp(rng.standard_normal(n), 2000, 6000, 1) * np.exp(-t / 0.025)
        return _crush(y, 4, 3) * v * 0.8
    if ins == 'c':
        n = int(0.012 * SR)
        y = S.hp(rng.standard_normal(n), 3000) * np.exp(-S.tt(n) / 0.002)
        return y * v * 1.4
    if ins == 'h': return S.hat(rng, int(0.03 * SR), 0.01) * v * 0.9
    if ins == 'o': return S.hat(rng, int(0.12 * SR), 0.03, True) * v * 0.7
    if ins == 'q':
        n = int(0.06 * SR)
        t = S.tt(n)
        return np.sin(2 * np.pi * np.cumsum(1900 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.02) * v * 0.6
    if ins == 't':
        n = int(0.3 * SR)
        return S.modal(2600, n, 'glass', 0.18) * v * 0.7
    if ins == 'z':
        n = int(0.15 * SR)
        t = S.tt(n)
        f = S.sweep(6000, 300, n)
        return _crush(S.pulse(f, n, 0.5), 3, 2) * np.exp(-t / 0.05) * v * 0.45
    if ins == 'r': return S.rim(rng) * v * 0.9
    raise KeyError(ins)


# ============================== industrial / EBM ==============================

def i_seqbass(song, midi, dur, vel=0.9, cutoff=900, tau=0.11, drive=2.5, r=0.02, pw=0.35):
    """Baixo sequenciado de EBM: serra + pulso, filtro que fecha rápido a cada nota, saturado."""
    n = int((dur + r + 0.05) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = S.saw(f, n) * 0.7 + S.pulse(f, n, pw) * 0.5 + 0.6 * S.sine(f * 0.5, n)
    hi, lo = S.lp(y, cutoff * 2.3), S.lp(y, cutoff * 0.5)
    w = np.exp(-t / tau)
    y = _dist(lo * (1 - w) + hi * w, drive)
    return y * S.env_adsr(n, 0.002, 0.05, 0.9, r) * _v(vel) * 0.55


def i_robot(song, midi, dur, vel=0.9, vowel='a', bits=6, hold=2, r=0.05, ring=1.0):
    """Voz de robô: formantes de vogal, esmagadas e moduladas em anel (metálicas)."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = S.formant(f, n, vowel, None, 0)
    y = y * (1 - 0.35 * ring + 0.35 * ring * np.sign(np.sin(2 * np.pi * f * 1.5 * t)))
    y = _crush(y, bits, hold)
    return y * S.env_adsr(n, 0.006, 0.05, 0.9, r) * _v(vel) * 0.7


def i_dronec(song, midi, dur, vel=0.7, a=0.6, r=0.6, cutoff=700, det=0.01):
    """Zumbido industrial: serras muito desafinadas (batimento), passa-baixa."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det * 1.3), n) + 0.5 * S.pulse(f * 0.5, n, 0.5)) / 3.5
    y = S.lp(y, cutoff, 2)
    return y * S.env_adsr(n, a, 0.3, 0.9, r) * _v(vel) * 0.55


def i_stabc(song, midi, dur, vel=0.9, cutoff=2400, tau=0.1, det=0.008):
    n = int((dur + 0.15) * SR)
    f = S.hz(midi)
    t = S.tt(n)
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.pulse(f, n, 0.3)) / 3.0
    y = _dist(S.lp(y, cutoff), 2.0)
    return y * np.exp(-t / tau) * np.minimum(1, t / 0.002) * _v(vel) * 0.5


def _ratchet(rng, n_clicks, span, f0, sr_n):
    out = np.zeros(sr_n)
    for k in range(n_clicks):
        pos = int(span * SR * (k / n_clicks) ** 1.2)
        L = int(0.008 * SR)
        if pos + L >= sr_n:
            break
        out[pos:pos + L] += (1 - k / (n_clicks * 1.4)) * S.wood(f0, L, 0.003)[:L] * 1.0
    return out


def kit_ind(ins, rng, v):
    """Industrial: bumbo duro e saturado, caixa de cano, hats metálicos, canos afinados, bigorna, engrenagem (catraca), corrente, palma."""
    if ins == 'k':
        y = S.kick(None, 175, 46, 0.1, 0.55)
        return np.tanh(y * 2.4) * v * 0.95
    if ins == 's':
        n = int(0.35 * SR)
        t = S.tt(n)
        nz = S.hp(rng.standard_normal(n), 900) * np.exp(-t / 0.11)
        pipe = S.modal(330, n, 'bell', 0.16) * 0.8
        return np.tanh((nz * 0.7 + pipe) * 1.6) * v * 0.7
    if ins == 'h':
        n = int(0.06 * SR)
        t = S.tt(n)
        y = S.hat(rng, n, 0.014) + 0.25 * (np.sin(2 * np.pi * 7100 * t) + np.sin(2 * np.pi * 9300 * t)) * np.exp(-t / 0.012)
        return y * v * 0.8
    if ins == 'o':
        n = int(0.28 * SR)
        t = S.tt(n)
        return (S.hp(rng.standard_normal(n), 5200) * np.exp(-t / 0.1) * 0.5 + 0.12 * np.sin(2 * np.pi * 7400 * t) * np.exp(-t / 0.15)) * v
    if ins in ('p', 'q', 'n'):
        f = {'p': 392.0, 'q': 277.2, 'n': 554.4}[ins]
        n = int(1.0 * SR)
        return S.modal(f, n, 'bell', 0.4) * v * 0.8
    if ins == 'a':
        n = int(0.5 * SR)
        t = S.tt(n)
        return (S.modal(1480, n, 'box', 0.35) + S.hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.01) * 0.6) * v * 0.7
    if ins == 'g':
        return _ratchet(rng, 9, 0.11, 3100, int(0.2 * SR)) * v * 0.9
    if ins == 'G':
        return _ratchet(rng, 6, 0.09, 1800, int(0.2 * SR)) * v * 1.0
    if ins == 'ch':
        n = int(0.4 * SR)
        y = np.zeros(n)
        for k in range(14):
            pos = int(rng.uniform(0, 0.25) * SR)
            L = int(0.05 * SR)
            if pos + L >= n:
                continue
            y[pos:pos + L] += S.bp(rng.standard_normal(L), 2200, 9000, 1) * np.exp(-S.tt(L) / 0.012) * rng.uniform(0.3, 1.0)
        return y * v * 0.7
    if ins == 'cl': return S.clap(rng) * v * 0.9
    if ins == 'w': return S.crash(rng, None, 0.9) * v * 0.55
    if ins == 'r': return S.rim(rng) * v
    raise KeyError(ins)


# ============================== gamelan ==============================

def _gam(song, midi, n, partials, beat=0.0, detune_pair=True):
    """Soma de parciais com tau próprio; `beat` = diferença em Hz entre o par de lâminas (ombak, o batimento do gamelan)."""
    f = float(S.hz(midi))
    t = S.tt(n)
    y = np.zeros(n)
    for ratio, amp, tau in partials:
        fr = f * ratio
        if fr >= SR * 0.45:
            continue
        env = amp * np.exp(-t / tau)
        if detune_pair and beat:
            y += env * 0.5 * (np.sin(2 * np.pi * (fr - beat * ratio / 2) * t) + np.sin(2 * np.pi * (fr + beat * ratio / 2) * t))
        else:
            y += env * np.sin(2 * np.pi * fr * t)
    return y, t


def _strike(song, n, level=0.35, hz=3800):
    t = S.tt(n)
    k = int(0.012 * SR)
    c = np.zeros(n)
    c[:k] = S.bp(song.rng.standard_normal(k), hz * 0.6, hz * 1.6, 1) * np.exp(-S.tt(k) / 0.003)
    return c * level


def i_saron(song, midi, dur, vel=0.9, tilt=1.0, beat=0.7, tail=1.4):
    n = int((max(dur, 0.1) + tail * tilt) * SR)
    y, t = _gam(song, midi, n, [(1, 1.0, 0.9 * tilt), (2.0, 0.42, 0.45 * tilt), (3.0, 0.2, 0.25 * tilt), (5.4, 0.1, 0.1 * tilt)], beat)
    y = (y + _strike(song, n, 0.3)) * np.minimum(1, t / 0.0015)
    return y * _v(vel) * 0.55


def i_peking(song, midi, dur, vel=0.9, tilt=1.0, beat=1.2):
    return i_saron(song, midi, dur, vel, 0.45 * tilt, beat, 0.7)


def i_bonang(song, midi, dur, vel=0.9, tilt=1.0, beat=0.5):
    n = int((max(dur, 0.1) + 1.2 * tilt) * SR)
    y, t = _gam(song, midi, n, [(1, 0.9, 0.7 * tilt), (2.0, 0.7, 0.5 * tilt), (3.0, 0.28, 0.3 * tilt), (4.05, 0.2, 0.18 * tilt), (1.5, 0.15, 0.2 * tilt)], beat)
    y = (y + _strike(song, n, 0.35, 3000)) * np.minimum(1, t / 0.002)
    return y * _v(vel) * 0.5


def i_gender(song, midi, dur, vel=0.85, tilt=1.0, beat=0.8):
    """Gender: lâminas com ressoador de bambu (vibrato de amplitude lento)."""
    n = int((max(dur, 0.2) + 2.4 * tilt) * SR)
    y, t = _gam(song, midi, n, [(1, 1.0, 2.2 * tilt), (2.0, 0.3, 1.2 * tilt), (4.0, 0.1, 0.5 * tilt)], beat)
    y = y * (0.8 + 0.2 * np.sin(2 * np.pi * (6.2 + 0.07 * midi % 1) * t))
    y = (y + _strike(song, n, 0.15, 2500)) * np.minimum(1, t / 0.002)
    return y * _v(vel) * 0.6


def i_kenong(song, midi, dur, vel=0.9, tilt=1.0):
    """Pote grande afinado."""
    n = int((max(dur, 0.2) + 2.2 * tilt) * SR)
    y, t = _gam(song, midi, n, [(1, 1.0, 1.4 * tilt), (2.0, 0.5, 0.8 * tilt), (3.0, 0.2, 0.4 * tilt), (4.1, 0.1, 0.2 * tilt)], 0.4)
    y = (y + _strike(song, n, 0.25, 1800)) * np.minimum(1, t / 0.003)
    return y * _v(vel) * 0.6


def i_gongc(song, midi, dur, vel=0.9, tilt=1.0, tail=5.0):
    """Gongo grande: parciais inarmônicas lentas, pares em batimento, chicote de ruído grave no ataque."""
    n = int(tail * tilt * SR)
    parts = [(1, 1.0, 3.2 * tilt), (2.0, 0.55, 2.2 * tilt), (2.74, 0.25, 1.2 * tilt), (3.0, 0.3, 1.4 * tilt), (4.2, 0.12, 0.7 * tilt), (5.15, 0.08, 0.5 * tilt)]
    y, t = _gam(song, midi, n, parts, 0.35)
    sw = S.lp(song.rng.standard_normal(n), 400, 2) * np.exp(-t / 0.25) * 1.3 * np.minimum(1, t / 0.05)
    y = y + sw
    return y * _v(vel) * 0.6


def i_kethuk(song, midi, dur, vel=0.9):
    n = int(0.25 * SR)
    t = S.tt(n)
    f = float(S.hz(midi))
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.0 * t)) * np.exp(-t / 0.05) * _v(vel) * 0.5


def kit_kendang(ins, rng, v):
    """Tambor de pele (kendang): 'tung' grave aberto, 'dah' agudo seco, 'tak' de madeira, 'dlang' de ponta."""
    if ins == 'k': return S.tom(105, int(0.5 * SR), 0.26) * v * 0.9
    if ins == 'd': return S.tom(170, int(0.3 * SR), 0.12) * v * 0.7
    if ins == 't': return S.wood(1250, int(0.1 * SR), 0.03) * v * 0.9
    if ins == 'l': return S.tom(240, int(0.2 * SR), 0.06) * v * 0.55
    raise KeyError(ins)


# ============================== corda afinada (Karplus com atraso fracionário) ==============================

def karplus_t(freq, n, rng, decay=0.997, bright=0.3):
    """Karplus-Strong afinado: o synth.karplus usa atraso inteiro (desafina nos agudos); aqui um passa-tudo fecha o atraso fracionário."""
    from scipy import signal
    L = SR / float(freq)
    N = int(L - 0.9)
    d = L - 0.5 - N
    a_ap = (1 - d) / (1 + d)
    c = decay * 0.5
    den = np.zeros(N + 3)
    den[0] = 1.0
    den[1] += a_ap
    den[N] -= c * a_ap
    den[N + 1] -= c * (1 + a_ap)
    den[N + 2] -= c
    x = np.zeros(n)
    m = min(N + 2, n)
    burst = rng.uniform(-1, 1, m)
    burst = signal.lfilter([1 - bright, bright], [1], burst)
    x[:m] = burst
    y = signal.lfilter([1.0, a_ap], den, x)
    return y / (np.max(np.abs(y)) + 1e-9)
