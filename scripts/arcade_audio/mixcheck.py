"""Confere a mixagem de uma ou mais faixas: RMS por barramento ANTES do mestre (com `Song.trim` já aplicado).
Uso: python3 scripts/arcade_audio/mixcheck.py <id> [<id> ...]
Alvos (dB RMS por barramento): melodia principal ≈ -16 · baixo ≈ -17 · bateria ≈ -16 · segunda voz ≈ -22 · pads/coro ≈ -23 · arpejos ≈ -20 · efeitos ≈ -26.
Ajuste `sg.trim = {barramento: dB}` na partitura até chegar perto; depois rode o build e confira pico, escala e emenda."""
import sys, numpy as np
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tracks as T
for name in sys.argv[1:]:
    sg,fx,aux=T.TRACKS[name]()
    sg.finalize(fx,aux)
    print(name)
    tot=0
    for b,buf in sg.buses.items():
        r=float(np.sqrt(np.mean(buf**2)))
        print(f'  {b:8s} rms {20*np.log10(r+1e-9):6.1f} dB')
