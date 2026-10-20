"""Instrumentos da leva v4 (compositor B): hyperpop, valsa de giz, pop-punk, trip-hop e eurodance.
Mesma assinatura de sempre: fn(song, midi, dur, **kw) -> sinal mono."""
import numpy as np
import synth as S
from synth import SR

VOW = {'a': (800, 1150, 2900), 'e': (400, 1600, 2700), 'i': (270, 2140, 2950), 'o': (450, 800, 2830), 'u': (325, 700, 2700)}


def _v(v):
    return 0.35 + 0.65 * v


def _formant(f, n, vowel, rng, shift=1.0, breath=0.04, vowel2=None):
    """Coro de formantes com deslocamento de formantes (shift > 1 = voz 'de esquilo' do hyperpop) e vogal que se transforma no meio."""
    src = S.saw(f, n)

    def mk(vw):
        y = np.zeros(n)
        for fc, a in zip(VOW[vw], (1.0, 0.55, 0.3)):
            c = fc * shift
            y += a * S.bp(src, c * 0.88, c * 1.12, 1)
        return y
    y = mk(vowel)
    if vowel2 and vowel2 != vowel:
        w = np.clip(np.linspace(-0.4, 1.4, n), 0, 1)
        y = y * (1 - w) + mk(vowel2) * w
    if breath:
        y = y + breath * S.bp(rng.standard_normal(n), 1500, 5500, 1)
    return y * 0.6


def i_vox(song, midi, dur, vel=0.9, vowel=None, vowel2=None, shift=1.0, scoop=0.0, a=0.006, r=0.04, vib=0.0, breath=0.05, d=0.05, s=0.85):
    """Pedaço de voz (vocal chop). Sem `vowel`, a sílaba depende da nota (mesma nota = mesma sílaba: o gancho fica coerente)."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    if vowel is None:
        vowel = 'aeoiu'[int(midi) % 5]
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.6 * np.maximum(0, t - 0.12)) * np.minimum(1, np.maximum(0, t - 0.12) / 0.25))
    if scoop:
        f = f * 2.0 ** (-scoop / 12.0 * np.exp(-t / 0.045))
    y = _formant(f, n, vowel, song.rng, shift, breath, vowel2)
    return y * S.env_adsr(n, a, d, s, r) * _v(vel) * 0.75


def i_hsaw(song, midi, dur, vel=0.9, cutoff=7000, spread=0.02, voices=7, drive=0.0, a=0.004, d=0.15, s=0.8, r=0.08, bend=0.0, open_t=0.0):
    """Supersaw de future bass. `bend` = semitons de partida (negativo = sobe 'rasgando' até a nota); `open_t` = o filtro abre em open_t s."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (2.0 ** (bend / 12.0 * np.exp(-t / 0.05))) if bend else S.hz(midi)
    y = S.supersaw(f, n, spread, voices)
    if open_t:
        lo, hi = S.lp(y, cutoff * 0.3), S.lp(y, cutoff)
        w = np.clip(t / open_t, 0, 1)
        y = lo * (1 - w) + hi * w
    elif cutoff:
        y = S.lp(y, cutoff)
    if drive:
        y = np.tanh(y * (1 + drive)) / np.tanh(1 + drive)
    return y * S.env_adsr(n, a, d, s, r) * _v(vel) * 0.5


def i_hoover(song, midi, dur, vel=0.9, cutoff=4200, tau=0.22, fall=5.0, det=0.012, r=0.04):
    """Stab de rave ('hoover'): serras desafinadas cujo tom despenca nos primeiros 70 ms, mais um pulso estreito."""
    n = int((dur + r + 0.1) * SR)
    t = S.tt(n)
    f = S.hz(midi) * 2.0 ** (fall / 12.0 * np.exp(-t / 0.07))
    y = (S.saw(f, n) + S.saw(f * (1 + det), n) + S.saw(f * (1 - det), n) + S.saw(f * (1 + 2.1 * det), n)
         + 0.7 * S.pulse(f * 0.5, n, 0.3)) / 4.4
    y = S.lp(y, cutoff)
    y = np.tanh(y * 2.2) / np.tanh(2.2)
    return y * np.exp(-t / tau) * np.minimum(1, t / 0.002) * _v(vel) * 0.6


def i_pwr(song, midi, dur, vel=0.9, drive=7.0, cutoff=3600, tau=0.0, r=0.04, fifth=True):
    """Acorde de força (raiz, quinta, oitava) de guitarra: serras, distorção forte e caixa passa-baixa. `tau` > 0 = abafado (palm mute)."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = S.saw(f, n) + 0.8 * S.saw(f * 1.0035, n) + 0.9 * S.saw(f * 2.0, n)
    if fifth:
        y = y + S.saw(f * 1.4983, n) + 0.7 * S.saw(f * 1.4983 * 0.997, n)
    y = y / (4.4 if fifth else 2.7)
    y = np.tanh(y * drive)
    y = S.lp(y, cutoff, 2)
    y = S.hp(y, 85, 1)
    env = S.env_adsr(n, 0.002, 0.06, 0.88, r)
    if tau:
        env = env * np.exp(-t / tau)
    pick = S.bp(song.rng.standard_normal(n), 1500, 6000, 1) * np.exp(-t / 0.006) * 0.25
    return (y + pick) * env * _v(vel) * 0.55


def i_pbass(song, midi, dur, vel=0.9, tau=0.0, r=0.04, cutoff=1500):
    """Baixo de palheta: serra + quadrada filtradas, corpo senoidal e 'clique' da palheta."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = S.lp(0.6 * S.saw(f, n) + 0.5 * S.pulse(f, n, 0.35), cutoff, 2) + 0.7 * S.sine(f, n)
    y = np.tanh(y * 1.6) / np.tanh(1.6)
    env = S.env_adsr(n, 0.002, 0.07, 0.85, r)
    if tau:
        env = env * np.exp(-t / tau)
    click = S.bp(song.rng.standard_normal(n), 900, 3000, 1) * np.exp(-t / 0.008) * 0.2
    return (y + click) * env * _v(vel) * 0.7


def i_dirty(song, midi, dur, vel=0.9, drive=2.4, cutoff=520, slide=0.0, a=0.012, r=0.1, grit=0.0):
    """Baixo sujo de trip-hop: serra + quadrada saturadas, sub senoidal e deslize opcional vindo de baixo."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi) * (2.0 ** (-slide / 12.0 * np.exp(-t / 0.06)) if slide else 1.0)
    y = S.lp(0.6 * S.saw(f, n) + 0.5 * S.pulse(f, n, 0.42), cutoff, 2)
    y = np.tanh(y * (1 + drive)) / np.tanh(1 + drive)
    if grit:
        q = 2 ** 6
        y = np.round(y * q) / q * grit + y * (1 - grit)
    y = y + 0.75 * S.sine(f, n)
    return y * S.env_adsr(n, a, 0.12, 0.88, r) * _v(vel) * 0.7


def i_piano(song, midi, dur, vel=0.9, tau=0.55, bright=1.0, hammer=0.22, r=0.07, det=0.0014):
    """Piano 'seco': parciais levemente inarmônicos, duas cordas desafinadas, ataque de martelo e liberação de abafador."""
    f = float(S.hz(midi))
    n = int((dur + r + 0.25) * SR)
    t = S.tt(n)
    y = np.zeros(n)
    nh = int(max(2, min(9, (SR * 0.45) / f)))
    for k in range(1, nh + 1):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        a = bright ** (k - 1) / (k ** 1.15)
        dec = tau / (1 + 0.45 * (k - 1))
        e = np.exp(-t / dec)
        y += a * np.sin(2 * np.pi * fk * t) * e
        y += 0.55 * a * np.sin(2 * np.pi * fk * (1 + det) * t + 0.9) * e
    y += S.bp(song.rng.standard_normal(n), 700, 3200, 1) * np.exp(-t / 0.012) * hammer
    gate = np.ones(n)
    i0 = int(dur * SR)
    gate[i0:] = np.exp(-(np.arange(n - i0) / SR) / (r * 0.8))
    return y * gate * np.minimum(1, t / 0.0015) * _v(vel) * 0.32


def i_pizz(song, midi, dur, vel=0.9, decay=0.972, bright=0.55, cutoff=5200):
    """Pizzicato de cordas: Karplus curto e seco."""
    n = int((min(dur, 0.5) + 0.3) * SR)
    k = S.karplus(float(S.hz(midi)), n, song.rng, decay, bright)
    return S.lp(k, cutoff, 1) * _v(vel) * 0.8


def i_bow(song, midi, dur, vel=0.85, a=0.14, r=0.25, vib=0.006, cutoff=3000, vib_delay=0.22):
    """Arco (violino/viola): serras com vibrato que entra devagar e um sopro de arco."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    tv = np.maximum(0, t - vib_delay)
    f = S.hz(midi) * (1 + vib * np.sin(2 * np.pi * 5.4 * tv) * np.minimum(1, tv / 0.3))
    y = (S.saw(f, n) + 0.7 * S.saw(f * 1.003, n)) / 1.7
    y = S.lp(y, cutoff, 2)
    y = y + S.bp(song.rng.standard_normal(n), 2000, 6000, 1) * 0.03
    return y * S.env_adsr(n, a, 0.1, 0.92, r) * _v(vel) * 0.6


def i_strings(song, midi, dur, vel=0.8, a=0.7, r=0.9, cutoff=2100, det=0.008):
    """Cordas lentas (naipe): 4 serras desafinadas filtradas, ataque lento."""
    n = int((dur + r) * SR)
    f = S.hz(midi)
    y = (S.saw(f * (1 - det), n) + S.saw(f * (1 + det), n) + S.saw(f * 1.0021, n) + 0.6 * S.saw(f * 0.5, n)) / 3.6
    return S.lp(y, cutoff, 2) * S.env_adsr(n, a, 0.3, 0.9, r) * _v(vel) * 0.5


def i_offbass(song, midi, dur, vel=0.9, cutoff=900, r=0.02):
    """Baixo de trance no contratempo: serra filtrada curta com sub."""
    n = int((dur + r) * SR)
    t = S.tt(n)
    f = S.hz(midi)
    y = S.lp(S.saw(f, n) * 0.7 + S.pulse(f, n, 0.5) * 0.3, cutoff, 2) + 0.6 * S.sine(f, n)
    return y * S.env_adsr(n, 0.002, 0.05, 0.9, r) * _v(vel) * 0.75


def i_chalk_line(song, midi, dur, vel=0.8, r=0.05):
    """Traço de giz tonal: ruído estreito centrado na nota, com ataque e fim ásperos (sem altura clara, só cor)."""
    n = int((dur + r) * SR)
    f = float(S.hz(midi))
    y = S.bp(song.rng.standard_normal(n), f * 0.85, f * 1.15, 1) * 3.0
    t = S.tt(n)
    y = y * (0.7 + 0.3 * np.sin(2 * np.pi * 37 * t))
    return y * S.env_adsr(n, 0.03, 0.05, 0.9, r) * _v(vel) * 0.5
