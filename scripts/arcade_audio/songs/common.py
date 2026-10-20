"""Peças comuns às trilhas: cadeias de efeitos, auxiliares e a 'fita que carrega a própria partitura'."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, Gain, LowpassFilter, HighpassFilter, Distortion, Bitcrush, Phaser
import synth as S
from synth import SR
import comp as K
import tape as TP


def aux_default(bpm, room=0.5, wet=1.0, delay_fb=0.3, delay_mix=1.0, delay_beats=0.75):
    return {
        'verb': [Reverb(room_size=room, damping=0.5, wet_level=wet, dry_level=0.0, width=1.0)],
        'echo': [Delay(delay_seconds=60.0 / bpm * delay_beats, feedback=delay_fb, mix=delay_mix), LowpassFilter(5200), Reverb(room_size=0.25, wet_level=0.25, dry_level=0.75)],
    }


def loader_in_gap(song, notes_abs, bar, step=0, gain=0.5, pan=0.0, pilot_s=0.35):
    """A fita 'carrega' a partitura da própria faixa: os bytes (passo, nota, duração) viram pulsos de loader.
    `notes_abs` = lista (passo, midi, dur, vel)."""
    data = TP.score_bytes([(s % 256, m, l) for (s, m, l, v) in notes_abs[:40]])
    sig = TP.loader(data, pilot_s=pilot_s, level=0.55)
    song.put('fx', sig, song.t_step(bar * song.spb + step), gain, pan)
    return len(sig) / SR


def coin_reboot(song, bar, step, root=69, gain=0.9):
    """Jingle de 'ligar': arpejo rápido de pulsos que sobe e uma moedinha no fim."""
    for k, m in enumerate([root, root + 3, root + 7, root + 12]):
        song.note('lead', K.i_nes, bar * song.spb + step + k, m + 12, 1, gain=gain, duty=0.125, vel=1.0, decay=0.08)
    song.note('lead', K.i_nes, bar * song.spb + step + 4, root + 24, 3, gain=gain, duty=0.5, vel=1.0, decay=0.2)


def corrupt(song, mix, bar0, bars, rng, bits=5, hold=5):
    """Corrupção do 'cartucho': reduz bits/taxa, trava e falha por alguns compassos (pós-mixagem)."""
    i0 = int(song.t_step(bar0 * song.spb) * SR)
    i1 = min(mix.shape[1], int(song.t_step((bar0 + bars) * song.spb) * SR))
    y = TP.crush(mix, i0, i1, bits, hold)
    seg = y[:, i0:i1]
    seg = TP.dropouts(seg, rng, count=max(4, bars * 3), ms=(12, 60), depth=0.95)
    y[:, i0:i1] = seg
    return y


def lp_post(sg, hz, order=1):
    """Corte de agudos no master (tira o 'sizzle' do ruído de chip e dos sinos muito altos)."""
    sg.post.append(lambda mix, song: np.stack([S.lp(ch, hz, order) for ch in mix]))
