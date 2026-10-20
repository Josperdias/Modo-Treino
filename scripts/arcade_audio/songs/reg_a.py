"""Registro do compositor A (trilhas v4): menu2, menu3, menu4, bonus2, bonus3."""
from songs import menu2, menu3, menu4, bonus2

TRACKS = {'menu2': menu2.build, 'menu3': menu3.build, 'menu4': menu4.build, 'bonus2': bonus2.build}
KEYS = {'menu2': (63, 'major'), 'menu3': (66, 'dorian'), 'menu4': (59, 'minor'), 'bonus2': (60, 'major')}
