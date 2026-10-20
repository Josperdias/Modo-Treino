"""Registro da leva C (trilhas v4): neon4, crystal3, crystal4, clock3, clock4."""
from songs import neon4, crystal3, crystal4, clock3, clock4

TRACKS = {'neon4': neon4.build, 'crystal3': crystal3.build, 'crystal4': crystal4.build, 'clock3': clock3.build, 'clock4': clock4.build}
KEYS = {'neon4': (59, 'minor'), 'crystal3': (70, 'major'), 'crystal4': (56, 'minor'), 'clock3': (61, 'phrygian'), 'clock4': (59, 'phrygian')}
