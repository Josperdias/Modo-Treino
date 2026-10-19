"""Gera todo o áudio do NEON STEP DX (músicas por parte do jogo + efeitos) em native/assets/arcade/audio/ e o relatório de medições.
Uso: python3 scripts/arcade_audio/build.py [musica|sfx|tudo] [id ...]
Requer numpy, scipy, pedalboard e ffmpeg (libvorbis)."""
import json, os, subprocess, sys, time, tempfile
import numpy as np
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import synth as S
from synth import SR
import compose as C
import tracks as T

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'native', 'assets', 'arcade', 'audio')
AUDIT = os.path.join(ROOT, 'docs', 'neon-step-dx', 'AUDIT_audio.json')


def to_ogg(wav_path, ogg_path, quality):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path, '-c:a', 'libvorbis', '-q:a', str(quality), '-ar', str(SR), ogg_path], check=True)


def write_ogg(x, path, quality=2.0):
    x = np.asarray(x)
    if x.ndim == 1:
        x = x[None, :]
    pcm = (np.clip(x.T, -1.0, 1.0) * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'a.wav')
        wavfile.write(w, SR, pcm)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        to_ogg(w, path, quality)
    return os.path.getsize(path)


T_KEYS = T.KEYS
name_hint = None


def measure_music(x, bpm, bars):
    mono = x.mean(axis=0).astype(np.float64)
    peak = float(np.max(np.abs(x)))
    rms = float(np.sqrt(np.mean(mono ** 2) + 1e-12))
    spec = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
    fr = np.fft.rfftfreq(len(mono), 1 / SR)
    def band(lo, hi):
        m = (fr >= lo) & (fr < hi)
        return float(spec[m].sum() / (spec.sum() + 1e-12))
    # andamento por fluxo de onset (autocorrelação do envelope)
    hop = 256
    env = np.array([np.sqrt(np.mean(mono[i:i + hop] ** 2)) for i in range(0, len(mono) - hop, hop)])
    d = np.maximum(0, np.diff(env))
    d -= d.mean()
    ac = np.correlate(d, d, 'full')[len(d) - 1:]
    lag_beat = 60.0 / bpm * SR / hop
    cand = [bpm]
    best = None
    for m in (0.5, 1.0, 2.0):
        k = int(round(lag_beat * m))
        if 3 < k < len(ac) - 2:
            v = float(ac[k - 1:k + 2].max() / (ac[0] + 1e-9))
            best = v if best is None or v > best else best
    seam = C.loop_score(x)
    # energia dos picos espectrais dentro da escala da faixa (checagem de afinação/teoria por FFT)
    chroma = np.zeros(12)
    m = (fr > 60) & (fr < 4200)
    pk = np.where(m)[0]
    midi = 69 + 12 * np.log2(np.maximum(fr[pk], 1e-3) / 440.0)
    for mi, w in zip(np.round(midi).astype(int), spec[pk]):
        chroma[mi % 12] += w
    chroma /= chroma.sum() + 1e-12
    key = T_KEYS.get(name_hint, None)
    in_scale = None
    if key:
        root, sc = key
        pcs = {(root + i) % 12 for i in C.SCALES[sc]}
        in_scale = float(sum(chroma[p] for p in pcs))
    return {
        'duracao_s': round(len(mono) / SR, 2), 'compassos': bars, 'bpm': bpm,
        'pico_dBFS': round(20 * np.log10(peak + 1e-9), 2), 'rms_dBFS': round(20 * np.log10(rms + 1e-9), 2),
        'graves_pct': round(100 * band(20, 200), 1), 'medios_pct': round(100 * band(200, 2500), 1), 'agudos_pct': round(100 * band(2500, 16000), 1),
        'pulso_autocorr': round(best or 0.0, 3), 'emenda_loop': round(seam, 3),
        'silencio_pct': round(100 * float(np.mean(np.abs(mono) < 1e-3)), 2),
        'energia_na_escala_pct': None if in_scale is None else round(100 * in_scale, 1),
    }


def build_music(ids):
    report = {}
    global name_hint
    for name in ids:
        t0 = time.time()
        song, fx = T.TRACKS[name]()
        name_hint = name
        out = song.finalize(fx)
        size = write_ogg(out, os.path.join(OUT, 'musica', f'{name}.ogg'), 2.0)
        m = measure_music(out, song.bpm, song.bars)
        m['bytes'] = size
        m['segundos_para_renderizar'] = round(time.time() - t0, 1)
        report[name] = m
        print(f"musica {name:8s} {m['duracao_s']:6.1f}s {size/1024:6.0f} KB pico {m['pico_dBFS']} rms {m['rms_dBFS']} emenda {m['emenda_loop']} ({m['segundos_para_renderizar']}s)", flush=True)
    return report


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else 'tudo'
    ids = sys.argv[2:]
    report = {}
    if os.path.exists(AUDIT):
        try:
            report = json.load(open(AUDIT))
        except Exception:
            report = {}
    if what in ('musica', 'tudo'):
        report.setdefault('musica', {}).update(build_music(ids or list(T.TRACKS)))
    if what in ('sfx', 'tudo'):
        import sfx
        report.setdefault('sfx', {}).update(sfx.build(ids or None, write_ogg, OUT))
    os.makedirs(os.path.dirname(AUDIT), exist_ok=True)
    json.dump(report, open(AUDIT, 'w'), indent=1, ensure_ascii=False)
    if what in ('sfx', 'tudo'):
        import sfx
        sfx.write_manifest(OUT)


if __name__ == '__main__':
    main()
