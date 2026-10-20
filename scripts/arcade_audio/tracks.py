"""Registro das trilhas do NEON STEP DX (v2). Cada módulo em `songs/` escreve a partitura e devolve (Song, efeitos por barramento, auxiliares)."""
from songs import neon2, clock2, cosmos2, inverse2, ocean2, volcano2, crystal2, paper2
from songs import menu, neon, crystal, clock, cosmos, ocean, volcano, paper, sketch, inverse, bonus

TRACKS = {
    'menu': menu.build, 'neon': neon.build, 'crystal': crystal.build, 'clock': clock.build, 'cosmos': cosmos.build, 'ocean': ocean.build,
    'neon2': neon2.build, 'clock2': clock2.build, 'cosmos2': cosmos2.build, 'inverse2': inverse2.build, 'ocean2': ocean2.build, 'volcano2': volcano2.build, 'crystal2': crystal2.build, 'paper2': paper2.build, 'volcano': volcano.build, 'paper': paper.build, 'sketch': sketch.build, 'inverse': inverse.build, 'bonus': bonus.build,
}

# tônica (midi) e escala principal de cada faixa, só para a conferência "energia dentro da escala" por FFT
KEYS = {
    'menu': (62, 'major'), 'neon': (57, 'harmonic'), 'crystal': (64, 'lydian'), 'clock': (59, 'dorian'), 'cosmos': (60, 'lydian'),
    'neon2': (62, 'minor'), 'clock2': (55, 'minor'), 'cosmos2': (65, 'minor'), 'inverse2': (54, 'minor'), 'ocean2': (62, 'minor'), 'volcano2': (62, 'phrygdom'), 'crystal2': (60, 'lydian'), 'paper2': (57, 'minor'), 'ocean': (64, 'minor'), 'volcano': (62, 'phrygdom'), 'paper': (62, 'minor'), 'sketch': (57, 'minor'), 'inverse': (59, 'minor'), 'bonus': (60, 'major'),
}


# Registros extras: cada `songs/reg_*.py` expõe TRACKS = {id: build} e KEYS = {id: (tônica midi, escala)}. Um registro com erro não derruba os outros.
import importlib
import os
import traceback

_here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'songs')
for _f in sorted(os.listdir(_here)):
    if _f.startswith('reg_') and _f.endswith('.py'):
        try:
            _m = importlib.import_module('songs.' + _f[:-3])
            TRACKS.update(_m.TRACKS)
            KEYS.update(_m.KEYS)
        except Exception:
            print('AVISO: registro', _f, 'não carregou:\n' + traceback.format_exc())
