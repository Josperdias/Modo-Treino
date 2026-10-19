"""Inspeção visual (não dá para ouvir aqui): espectrograma + energia por compasso e por banda de uma trilha renderizada."""
import sys, numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.io import wavfile
import subprocess, tempfile, os
from synth import SR

def show(x, bpm, spb, name, path):
    mono = x.mean(axis=0)
    fig, ax = plt.subplots(3, 1, figsize=(16, 9), gridspec_kw={'height_ratios': [3, 1.3, 1.3]})
    ax[0].specgram(mono, NFFT=2048, Fs=SR, noverlap=1536, cmap='magma', vmin=-120, vmax=-30)
    ax[0].set_ylim(0, 12000); ax[0].set_title(name)
    bar_s = spb * 60.0 / bpm / 4.0
    nb = int(len(mono) / SR / bar_s)
    rms = [np.sqrt(np.mean(mono[int(i*bar_s*SR):int((i+1)*bar_s*SR)]**2)) for i in range(nb)]
    ax[1].bar(range(nb), rms); ax[1].set_xlim(-0.5, nb)
    bands = [(20, 200), (200, 1200), (1200, 5000), (5000, 15000)]
    for lo, hi in bands:
        e = []
        for i in range(nb):
            seg = mono[int(i*bar_s*SR):int((i+1)*bar_s*SR)]
            sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
            fr = np.fft.rfftfreq(len(seg), 1/SR)
            e.append(sp[(fr >= lo) & (fr < hi)].sum())
        ax[2].plot(10*np.log10(np.array(e)+1e-12), label=f'{lo}-{hi}')
    ax[2].legend(ncol=4); ax[2].set_xlim(0, nb)
    fig.tight_layout(); fig.savefig(path, dpi=70); plt.close(fig)


def thumb(x, bpm, spb, name, path):
    """Espectrograma pequeno (a 'forma' da faixa) para a página de audição."""
    mono = x.mean(axis=0)
    fig, ax = plt.subplots(figsize=(11, 2.1))
    ax.specgram(mono, NFFT=2048, Fs=SR, noverlap=1536, cmap='magma', vmin=-115, vmax=-35)
    ax.set_ylim(0, 9000)
    bar_s = spb * 60.0 / bpm / 4.0
    dur = len(mono) / SR
    ticks = np.arange(0, dur, bar_s * 8)
    ax.set_xticks(ticks); ax.set_xticklabels([str(int(t / bar_s) + 1) for t in ticks], fontsize=7)
    ax.set_yticks([0, 3000, 6000, 9000]); ax.set_yticklabels(['0', '3k', '6k', '9k'], fontsize=7)
    ax.set_xlabel('compasso', fontsize=7)
    fig.patch.set_facecolor('#140a24'); ax.set_facecolor('#140a24')
    for sp in ax.spines.values(): sp.set_visible(False)
    ax.tick_params(colors='#b3a3d6', length=2)
    ax.xaxis.label.set_color('#b3a3d6')
    fig.tight_layout(pad=0.3); fig.savefig(path, dpi=80); plt.close(fig)
