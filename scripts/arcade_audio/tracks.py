"""Registro das trilhas do NEON STEP DX (v2). Cada módulo em `songs/` escreve a partitura e devolve (Song, efeitos por barramento, auxiliares)."""
from songs import menu, neon, crystal, clock, cosmos, ocean, volcano, paper, sketch, inverse, bonus

TRACKS = {
    'menu': menu.build, 'neon': neon.build, 'crystal': crystal.build, 'clock': clock.build, 'cosmos': cosmos.build, 'ocean': ocean.build,
    'volcano': volcano.build, 'paper': paper.build, 'sketch': sketch.build, 'inverse': inverse.build, 'bonus': bonus.build,
}

# tônica (midi) e escala principal de cada faixa, só para a conferência "energia dentro da escala" por FFT
KEYS = {
    'menu': (62, 'major'), 'neon': (57, 'harmonic'), 'crystal': (64, 'lydian'), 'clock': (59, 'dorian'), 'cosmos': (60, 'lydian'),
    'ocean': (64, 'minor'), 'volcano': (62, 'phrygdom'), 'paper': (62, 'minor'), 'sketch': (57, 'minor'), 'inverse': (59, 'minor'), 'bonus': (60, 'major'),
}
