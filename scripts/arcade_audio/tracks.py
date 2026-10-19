"""Trilhas do NEON STEP DX: uma por parte do jogo. Tudo composto por regras de teoria + síntese (sem amostras, sem trechos de música existente).
Técnicas herdadas das faixas SPEEDRUN.TAP (chips NES/VRC6), CORPOS (síntese modal e fases de Reich), A Chuva que Aprendeu a Cantar (bolhas de Minnaert)
e A Escada sem Fim (Shepard)."""
import numpy as np
from pedalboard import Reverb, Delay, Chorus, Distortion, Gain, LowpassFilter, HighpassFilter, Phaser, Bitcrush
import synth as S
from synth import SR
import compose as C
from compose import Song, deg, chords_of, roots_of, motif, shift_notes


def beat(bpm):
    return 60.0 / bpm


def sections_melody(song, prog_bars, root, scale, bus, inst, seed, lo, hi, rhythms, gain, bar0, pan=0.0, arch=0.55, kw=None, answer_octave=0):
    """Melodia de 8 compassos: A (2) + resposta (2) + B (2) + resposta cadencial (2)."""
    kw = kw or {}
    seeds = [seed, seed, seed + 7, seed]
    for k in range(4):
        degs = prog_bars[k * 2:k * 2 + 2]
        notes = motif(seeds[k], scale, root, degs, lo, hi, rhythms, arch=arch)
        if k == 3:  # cadência: fecha no acorde final
            pass
        C.lay_melody(song, bus, inst, notes, bar0 + k * 2, gain=gain, pan=pan, **kw)


def sparkle_rain(song, bus, inst, root, scale, bars, bar0, density, lo, hi, gain, seed, **kw):
    rng = np.random.default_rng(seed)
    for st in range(bar0 * 16, (bar0 + bars) * 16):
        if rng.random() < density:
            d = int(rng.integers(lo, hi))
            song.note(bus, inst, st, deg(root, scale, d), 2, gain=gain * (0.5 + 0.5 * rng.random()), pan=float(rng.uniform(-0.8, 0.8)), vel=float(rng.uniform(0.4, 1.0)), **kw)


def noise_swell(song, bus, bar0, bars, gain, lo_hz=400, hi_hz=5000, up=True):
    n = int(bars * 16 * song.step_s * SR)
    t = np.linspace(0, 1, n)
    x = song.rng.standard_normal(n)
    env = (t if up else 1 - t) ** 2
    y = S.bp(x, lo_hz, hi_hz) * env * 0.5
    song.put(bus, y, bar0 * 16 * song.step_s, gain)


def build_standard(cfg):
    song = Song(cfg['bpm'], cfg.get('bars', 32), swing=cfg.get('swing', 0.0), seed=cfg.get('seed', 1), name=cfg['name'])
    root, scale = cfg['root'], cfg['scale']
    nsec = song.bars // 8
    layers = cfg['layers']
    for s in range(nsec):
        prog = cfg['progA'] if cfg['form'][s % len(cfg['form'])] == 'A' else cfg['progB']
        bar0 = s * 8
        on = layers[min(s, len(layers) - 1)]
        chords = chords_of(root, scale, prog, cfg.get('seventh', False))
        roots = roots_of(root, scale, prog, cfg.get('bass_oct', -24))
        isB = cfg['form'][s % len(cfg['form'])] == 'B'
        if 'bass' in on and cfg.get('bass'):
            b = cfg['bass']
            for i, r in enumerate(roots):
                for (st, kind, ln) in C.BASS[b['style_B'] if isB and 'style_B' in b else b['style']]:
                    m = r + (12 if kind == 'o' else 7 if kind == 'f' else 0)
                    song.note(b.get('bus', 'bass'), b['inst'], (bar0 + i) * 16 + st, m, ln, gain=b.get('gain', 1.0), **b.get('kw', {}))
        if 'arp' in on and cfg.get('arp'):
            a = cfg['arp']
            pat = C.ARPS[a['style_B'] if isB and 'style_B' in a else a['style']]
            for i, ch in enumerate(chords):
                for k, ix in enumerate(pat):
                    if ix is None:
                        continue
                    m = ch[ix % len(ch)] + (12 if ix >= len(ch) else 0) + a.get('lift', 12)
                    song.note(a.get('bus', 'arp'), a['inst'], (bar0 + i) * 16 + k, m, a.get('step_len', 1), gain=a.get('gain', 0.6), pan=0.35 * (1 if k % 2 else -1), vel=0.55 + 0.45 * (k % 4 == 0), **a.get('kw', {}))
        if 'pad' in on and cfg.get('pad'):
            p = cfg['pad']
            for i, ch in enumerate(chords):
                for m in ch:
                    song.note(p.get('bus', 'pad'), p['inst'], (bar0 + i) * 16, m + p.get('lift', 0), 16, gain=p.get('gain', 0.5) / len(ch) ** 0.5, pan=p.get('pan', 0.0), **p.get('kw', {}))
        if 'lead' in on and cfg.get('lead'):
            l = cfg['lead']
            sections_melody(song, prog, root, scale, l.get('bus', 'lead'), l['inst'], l.get('seed', 11) + s * (0 if l.get('same', True) else 3), l.get('lo', 7), l.get('hi', 14),
                            l.get('rhythms_B', C.BUSY) if isB else l.get('rhythms', C.RHYTHMS), l.get('gain', 0.9), bar0, pan=l.get('pan', 0.0), arch=l.get('arch', 0.55), kw=l.get('kw', {}))
        if 'counter' in on and cfg.get('counter'):
            c2 = cfg['counter']
            sections_melody(song, prog, root, scale, c2.get('bus', 'counter'), c2['inst'], c2.get('seed', 29), c2.get('lo', 14), c2.get('hi', 18), c2.get('rhythms', C.CALM), c2.get('gain', 0.5), bar0, pan=c2.get('pan', 0.3), kw=c2.get('kw', {}))
        if 'drums' in on and cfg.get('drums'):
            d = cfg['drums']
            C.lay_drums(song, d['style_B'] if isB and 'style_B' in d else d['style'], bar0, 8, gain=d.get('gain', 1.0), kit=d.get('kit', 'chip'), fills=d.get('fills', True), hat_gain=d.get('hat', 1.0))
        if cfg.get('extras'):
            cfg['extras'](song, cfg, s, bar0, prog, chords, roots, isB, on)
    return song


def fx_default(bpm, lead_delay=0.75, room=0.25, wet=0.12):
    b = beat(bpm)
    return {
        'lead': [Chorus(rate_hz=0.8, depth=0.1, mix=0.22), Delay(delay_seconds=b * lead_delay, feedback=0.28, mix=0.2), Reverb(room_size=room, wet_level=wet, dry_level=0.9)],
        'arp': [Delay(delay_seconds=b * 0.5, feedback=0.3, mix=0.22), Reverb(room_size=0.3, wet_level=0.14, dry_level=0.9)],
        'counter': [Delay(delay_seconds=b * 1.5, feedback=0.35, mix=0.25), Reverb(room_size=0.4, wet_level=0.2, dry_level=0.9)],
        'pad': [Chorus(rate_hz=0.4, depth=0.2, mix=0.35), Reverb(room_size=0.6, wet_level=0.3, dry_level=0.8)],
        'bass': [LowpassFilter(900)],
        'drums': [Reverb(room_size=0.12, wet_level=0.06, dry_level=1.0)],
        'fx': [Reverb(room_size=0.5, wet_level=0.25, dry_level=0.85)],
    }


# ---------------------------------------------------------------- 1. MENU (PRESS START)

def track_menu():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        # faísca de marimba no 4º tempo de compassos alternados + glissando de moeda no começo de cada seção
        if s >= 1:
            for i in range(0, 8, 2):
                ch = chords[i]
                song.note('fx', C.i_bell, (bar0 + i) * 16 + 12, ch[2] + 24, 2, gain=0.45, kind='marimba', vel=0.8, pan=0.4)
        for k, m in enumerate([0, 4, 7, 12, 16]):
            song.note('fx', C.i_bell, bar0 * 16 + k, cfg['root'] + 36 + [0, 4, 7, 12, 16][k], 2, gain=0.25, kind='glass', vel=0.9, pan=-0.3 + 0.15 * k)

    cfg = dict(name='menu', bpm=132, root=57, scale='minor', progA=[0, 5, 2, 6, 0, 5, 3, 4], progB=[3, 4, 0, 0, 3, 4, 5, 6], form='ABAB',
               layers=[{'bass', 'drums', 'arp'}, {'bass', 'drums', 'arp', 'lead'}, {'bass', 'drums', 'arp', 'lead', 'counter'}, {'bass', 'drums', 'arp', 'lead', 'counter'}],
               bass=dict(inst=C.i_tri, style='octave', gain=1.0, kw=dict(bits=4)),
               arp=dict(inst=C.i_pulse, style='updown', gain=0.42, step_len=1, lift=12, kw=dict(duty=0.125, d=0.05, s=0.45)),
               lead=dict(inst=C.i_pulse, gain=0.75, lo=7, hi=14, seed=21, kw=dict(duty=0.25, vib=0.012)),
               counter=dict(inst=C.i_pulse, gain=0.4, kw=dict(duty=0.5, s=0.5)),
               drums=dict(style='four', style_B='break', kit='chip', gain=0.9), extras=extras)
    song = build_standard(cfg)
    return song, fx_default(132)


# ---------------------------------------------------------------- 2. NEON

def track_neon():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        # stabs de acorde fora do tempo (funk de arcade)
        if s >= 1:
            for i, ch in enumerate(chords):
                for st in ((3, 6, 10, 13) if not isB else (2, 5, 9, 12, 14)):
                    for m in ch:
                        song.note('arp', C.i_pulse, (bar0 + i) * 16 + st, m + 12, 1, gain=0.16, duty=0.125, d=0.03, s=0.2, vel=0.8, pan=0.25)
        if s % 2 == 1:  # sirene de neon (glissando de pulso) no fim da seção
            n = int(2.0 * song.step_s * 8 * SR)
            f = S.sweep(S.hz(cfg['root'] + 24), S.hz(cfg['root'] + 36), n)
            song.put('fx', S.pulse(f, n, 0.5) * np.hanning(n) * 0.12, (bar0 + 6) * 16 * song.step_s, 1.0, pan=0.0)

    cfg = dict(name='neon', bpm=148, root=52, scale='dorian', progA=[0, 0, 3, 3, 0, 0, 6, 4], progB=[2, 2, 3, 3, 4, 4, 6, 6], form='ABAB', swing=0.12,
               layers=[{'bass', 'drums', 'arp'}, {'bass', 'drums', 'arp', 'lead'}, {'bass', 'drums', 'arp', 'lead', 'counter'}, {'bass', 'drums', 'arp', 'lead', 'counter'}],
               bass=dict(inst=C.i_saw, style='funk', style_B='bounce', gain=1.0, kw=dict(cutoff=900, d=0.08, s=0.5)),
               arp=dict(inst=C.i_pulse, style='sixt', gain=0.3, step_len=1, lift=12, kw=dict(duty=0.125, d=0.04, s=0.3)),
               lead=dict(inst=C.i_pulse, gain=0.7, lo=7, hi=15, seed=5, kw=dict(duty=0.25, vib=0.015, slide=0.03)),
               counter=dict(inst=C.i_fm, gain=0.45, lo=14, hi=19, seed=33, kw=dict(ratio=3.0, index=1.6, tau=0.12)),
               drums=dict(style='funk', style_B='break', kit='chip', gain=1.0), extras=extras)
    song = build_standard(cfg)
    return song, fx_default(148, 0.75, 0.2, 0.1)


# ---------------------------------------------------------------- 3. CRISTAL

def track_crystal():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        sparkle_rain(song, 'fx', C.i_bell, cfg['root'] + 12, 'lydian', 8, bar0, 0.18 + 0.05 * s, 14, 24, 0.22, 100 + s, kind='glass', tilt=0.9)
        if s >= 1:
            noise_swell(song, 'fx', bar0 + 4, 4, 0.12, 2500, 9000, up=True)

    cfg = dict(name='crystal', bpm=124, root=50, scale='lydian', progA=[0, 1, 0, 1, 3, 4, 1, 0], progB=[4, 3, 1, 0, 4, 3, 5, 0], form='ABAB',
               layers=[{'bass', 'drums', 'pad', 'arp'}, {'bass', 'drums', 'pad', 'arp', 'lead'}, {'bass', 'drums', 'pad', 'arp', 'lead', 'counter'}, {'bass', 'drums', 'pad', 'arp', 'lead'}],
               bass=dict(inst=C.i_tri, style='half', gain=0.95, kw=dict(bits=0)),
               arp=dict(inst=C.i_bell, style='wide', gain=0.5, step_len=2, lift=12, kw=dict(kind='glass', tilt=0.7)),
               pad=dict(inst=C.i_pad, gain=0.55, lift=0, kw=dict(cutoff=1900, a=0.5, r=0.8)),
               lead=dict(inst=C.i_bell, gain=0.85, lo=9, hi=16, seed=41, rhythms=C.CALM, rhythms_B=C.CALM, kw=dict(kind='vibes', tilt=1.0)),
               counter=dict(inst=C.i_bell, gain=0.35, kw=dict(kind='bell', tilt=0.9)),
               drums=dict(style='light', style_B='half', kit='real', gain=0.7, hat=0.8, fills=False), extras=extras)
    song = build_standard(cfg)
    fx = fx_default(124, 1.5, 0.8, 0.35)
    fx['lead'] = [Delay(delay_seconds=beat(124) * 0.75, feedback=0.35, mix=0.3), Reverb(room_size=0.85, wet_level=0.4, dry_level=0.7)]
    fx['arp'] = [Delay(delay_seconds=beat(124) * 0.75, feedback=0.4, mix=0.35), Reverb(room_size=0.85, wet_level=0.4, dry_level=0.7)]
    fx['fx'] = [Reverb(room_size=0.9, wet_level=0.5, dry_level=0.6)]
    return song, fx


# ---------------------------------------------------------------- 4. MECÂNICO (relógio)

def track_clock():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        # tique-taque: duas madeiras de alturas diferentes, esquerda e direita, em colcheias
        for i in range(8):
            for k in range(8):
                st = (bar0 + i) * 16 + k * 2
                low = (k % 2 == 0)
                song.note('fx', C.i_bell, st, 79 if low else 86, 1, gain=0.16 if low else 0.12, kind='wood', vel=0.8, pan=-0.55 if low else 0.55)
        # engrenagem: pancada grave no 1º tempo a cada 2 compassos
        for i in range(0, 8, 2):
            song.note('fx', C.i_bell, (bar0 + i) * 16, cfg['root'] - 12, 3, gain=0.3, kind='drum', tilt=1.0, vel=1.0)
        if s >= 2:  # sino de hora no fim da seção
            song.note('fx', C.i_bell, (bar0 + 7) * 16, cfg['root'] + 24, 8, gain=0.4, kind='bell', tilt=1.8, vel=1.0)

    cfg = dict(name='clock', bpm=112, root=55, scale='harmonic', progA=[0, 0, 3, 3, 4, 4, 0, 0], progB=[5, 5, 6, 6, 4, 4, 0, 0], form='ABAB', swing=0.22,
               layers=[{'bass', 'drums', 'arp', 'pad'}, {'bass', 'drums', 'arp', 'pad', 'lead'}, {'bass', 'drums', 'arp', 'pad', 'lead', 'counter'}, {'bass', 'drums', 'arp', 'pad', 'lead'}],
               bass=dict(inst=C.i_ks, style='bounce', style_B='walk', gain=1.1, kw=dict(decay=0.99, bright=0.35)),
               arp=dict(inst=C.i_bell, style='sixt', gain=0.4, step_len=1, lift=12, kw=dict(kind='box', tilt=0.6)),
               pad=dict(inst=C.i_organ, gain=0.35, kw=dict()),
               lead=dict(inst=C.i_ks, gain=0.95, lo=7, hi=14, seed=64, rhythms=C.BUSY, rhythms_B=C.RHYTHMS, kw=dict(decay=0.994, bright=0.85)),
               counter=dict(inst=C.i_bell, gain=0.4, kw=dict(kind='box', tilt=1.2)),
               drums=dict(style='tick', style_B='break', kit='real', gain=0.75, hat=0.6), extras=extras)
    song = build_standard(cfg)
    return song, fx_default(112, 0.5, 0.35, 0.18)


# ---------------------------------------------------------------- 5. COSMOS

def track_cosmos():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        if isB:  # escada de Shepard sobe devagar na seção B
            n = int(8 * 16 * song.step_s * SR)
            y = S.shepard(n, start_oct=0.0, rate=0.06, f0=40.0, voices=9)
            song.put('pad', y * np.hanning(n) ** 0.5, bar0 * 16 * song.step_s, 0.35)
        sparkle_rain(song, 'fx', C.i_fm, cfg['root'] + 24, 'phrygian', 8, bar0, 0.07, 7, 16, 0.18, 200 + s, ratio=3.5, index=1.2, tau=0.4)

    cfg = dict(name='cosmos', bpm=100, root=54, scale='phrygian', progA=[0, 1, 0, 6, 0, 1, 5, 6], progB=[3, 3, 5, 5, 6, 6, 1, 0], form='ABAB',
               layers=[{'bass', 'pad', 'arp'}, {'bass', 'pad', 'arp', 'drums', 'lead'}, {'bass', 'pad', 'arp', 'drums', 'lead', 'counter'}, {'bass', 'pad', 'arp', 'drums', 'lead'}],
               bass=dict(inst=C.i_saw, style='half', gain=0.9, kw=dict(cutoff=520, a=0.01)),
               arp=dict(inst=C.i_fm, style='slow', gain=0.5, step_len=3, lift=12, kw=dict(ratio=2.0, index=1.8, tau=0.5, r=0.3)),
               pad=dict(inst=C.i_pad, gain=0.75, lift=0, kw=dict(cutoff=1700, a=0.8, r=1.2, det=0.009)),
               lead=dict(inst=C.i_fm, gain=0.55, lo=8, hi=15, seed=77, rhythms=C.CALM, rhythms_B=C.CALM, kw=dict(ratio=3.01, index=1.4, tau=0.6, r=0.3)),
               counter=dict(inst=C.i_bell, gain=0.3, kw=dict(kind='glass', tilt=1.6)),
               drums=dict(style='half', style_B='light', kit='real', gain=0.65, fills=False, hat=0.6), extras=extras)
    song = build_standard(cfg)
    fx = fx_default(100, 1.5, 0.9, 0.45)
    fx['lead'] = [Delay(delay_seconds=beat(100) * 1.5, feedback=0.45, mix=0.4), Reverb(room_size=0.9, wet_level=0.45, dry_level=0.6)]
    fx['arp'] = [Delay(delay_seconds=beat(100) * 0.75, feedback=0.5, mix=0.4), Reverb(room_size=0.9, wet_level=0.5, dry_level=0.6)]
    fx['pad'] = [Chorus(rate_hz=0.25, depth=0.3, mix=0.5), Reverb(room_size=0.95, wet_level=0.5, dry_level=0.6)]
    return song, fx


# ---------------------------------------------------------------- 6. FUNDO DO MAR (bolhas)

def track_ocean():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        # bolhas espontâneas nas notas da escala (acima da melodia)
        sparkle_rain(song, 'fx', C.i_bubble, cfg['root'] + 24, 'mixolydian', 8, bar0, 0.22 + 0.04 * s, 0, 9, 0.38, 300 + s, rise=0.22, tau=0.05)
        # ondas: ruído filtrado com swell lento
        noise_swell(song, 'fx', bar0, 4, 0.18, 200, 1600, up=True)
        noise_swell(song, 'fx', bar0 + 4, 4, 0.18, 200, 1600, up=False)

    cfg = dict(name='ocean', bpm=92, root=48, scale='mixolydian', progA=[0, 0, 3, 3, 6, 6, 0, 0], progB=[5, 5, 3, 3, 1, 1, 4, 4], form='ABAB',
               layers=[{'bass', 'pad', 'arp'}, {'bass', 'pad', 'arp', 'lead', 'drums'}, {'bass', 'pad', 'arp', 'lead', 'drums', 'counter'}, {'bass', 'pad', 'arp', 'lead', 'drums'}],
               bass=dict(inst=C.i_tri, style='half', gain=0.95, kw=dict(bits=0)),
               arp=dict(inst=C.i_ks, style='updown', gain=0.5, step_len=2, lift=12, kw=dict(decay=0.997, bright=0.3)),
               pad=dict(inst=C.i_pad, gain=0.6, kw=dict(cutoff=900, a=0.9, r=1.0)),
               lead=dict(inst=C.i_bubble, gain=0.9, lo=7, hi=13, seed=88, rhythms=C.CALM, rhythms_B=C.CALM, kw=dict(rise=0.12, tau=0.11)),
               counter=dict(inst=C.i_bell, gain=0.3, kw=dict(kind='marimba', tilt=1.2)),
               drums=dict(style='half', style_B='light', kit='real', gain=0.55, fills=False, hat=0.5), extras=extras)
    song = build_standard(cfg)
    fx = fx_default(92, 1.0, 0.7, 0.3)
    fx['lead'] = [Delay(delay_seconds=beat(92) * 0.75, feedback=0.3, mix=0.3), Reverb(room_size=0.7, wet_level=0.35, dry_level=0.75)]
    fx['fx'] = [Reverb(room_size=0.8, wet_level=0.4, dry_level=0.7)]
    return song, fx


# ---------------------------------------------------------------- 7. VULCÃO

def track_volcano():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        for i in range(8):  # taiko
            if i % 2 == 0:
                song.note('fx', C.i_bell, (bar0 + i) * 16, cfg['root'] - 24, 3, gain=0.6, kind='drum', tilt=1.4, vel=1.0)
                song.note('fx', C.i_bell, (bar0 + i) * 16 + 8, cfg['root'] - 24, 3, gain=0.4, kind='drum', tilt=1.2, vel=0.8)
        # rumor grave contínuo (rumble)
        n = int(8 * 16 * song.step_s * SR)
        rum = S.lp(song.rng.standard_normal(n), 90) * 1.4
        song.put('fx', rum, bar0 * 16 * song.step_s, 0.35)

    cfg = dict(name='volcano', bpm=164, root=50, scale='phrygdom', progA=[0, 0, 1, 1, 0, 0, 6, 5], progB=[3, 3, 1, 1, 0, 0, 4, 4], form='ABAB',
               layers=[{'bass', 'drums', 'arp'}, {'bass', 'drums', 'arp', 'lead'}, {'bass', 'drums', 'arp', 'lead', 'counter'}, {'bass', 'drums', 'arp', 'lead', 'counter'}],
               bass=dict(inst=C.i_saw, style='gallop', style_B='octave', gain=1.0, kw=dict(cutoff=1300, d=0.05, s=0.55)),
               arp=dict(inst=C.i_pulse, style='sixt', gain=0.3, step_len=1, lift=12, kw=dict(duty=0.125, d=0.03, s=0.35)),
               lead=dict(inst=C.i_brass, gain=0.75, lo=7, hi=14, seed=99, rhythms=C.BUSY, rhythms_B=C.RHYTHMS, kw=dict(cutoff=3200)),
               counter=dict(inst=C.i_pulse, gain=0.35, kw=dict(duty=0.5, vib=0.02)),
               drums=dict(style='double', style_B='break', kit='chip', gain=1.0), extras=extras)
    song = build_standard(cfg)
    fx = fx_default(164, 0.75, 0.25, 0.12)
    fx['bass'] = [Distortion(drive_db=14), LowpassFilter(2200)]
    fx['lead'] = [Distortion(drive_db=6), Delay(delay_seconds=beat(164) * 0.75, feedback=0.25, mix=0.18), Reverb(room_size=0.25, wet_level=0.1, dry_level=0.9)]
    return song, fx


# ---------------------------------------------------------------- 8. PAPEL

def track_paper():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        # farfalhar de papel: rajadas curtas de ruído agudo fora do tempo
        for i in range(8):
            for st in (6, 14):
                n = int(0.09 * SR)
                y = S.hp(song.rng.standard_normal(n), 4000) * np.exp(-S.tt(n) / 0.03) * 0.28
                song.put('fx', y, song.t_step((bar0 + i) * 16 + st), 0.5, pan=float(song.rng.uniform(-0.6, 0.6)))
        if s >= 1:
            for k in range(4):  # glockenspiel no fim da seção
                song.note('fx', C.i_bell, (bar0 + 7) * 16 + 8 + k * 2, cfg['root'] + 36 + [0, 4, 7, 12][k], 2, gain=0.3, kind='box', tilt=1.1, vel=0.9)

    cfg = dict(name='paper', bpm=108, root=53, scale='major', progA=[0, 5, 3, 4, 0, 5, 1, 4], progB=[3, 4, 2, 5, 3, 4, 0, 0], form='ABAB', swing=0.1,
               layers=[{'bass', 'pad', 'arp'}, {'bass', 'pad', 'arp', 'lead', 'drums'}, {'bass', 'pad', 'arp', 'lead', 'drums', 'counter'}, {'bass', 'pad', 'arp', 'lead', 'drums'}],
               bass=dict(inst=C.i_ks, style='walk', style_B='half', gain=1.15, kw=dict(decay=0.99, bright=0.3)),
               arp=dict(inst=C.i_ks, style='updown', gain=0.5, step_len=2, lift=12, kw=dict(decay=0.995, bright=0.6)),
               pad=dict(inst=C.i_organ, gain=0.3, lift=0, kw=dict()),
               lead=dict(inst=C.i_bell, gain=0.9, lo=7, hi=14, seed=55, rhythms=C.CALM + [C.RHYTHMS[1]], rhythms_B=C.CALM, kw=dict(kind='box', tilt=1.0)),
               counter=dict(inst=C.i_bell, gain=0.35, kw=dict(kind='marimba', tilt=0.9)),
               drums=dict(style='light', style_B='tick', kit='real', gain=0.5, fills=False, hat=0.7), extras=extras)
    song = build_standard(cfg)
    return song, fx_default(108, 0.75, 0.3, 0.16)


# ---------------------------------------------------------------- 9. RASCUNHO (fases de Reich)

def track_sketch():
    bpm = 96
    song = Song(bpm, 18, swing=0.0, seed=7, name='sketch')
    root = 55  # G3
    scale = 'dorian'
    prog6 = [0, 3, 0, 4, 5, 3]  # seis compassos, repetidos 3x (acordes mudam a cada compasso)
    prog = prog6 * 3
    chords = chords_of(root, scale, prog)
    roots = roots_of(root, scale, prog, -24)
    # célula de 12 passos (3 tempos): graus da escala; None = pausa. Duas marimbas, a 2ª anda 1 passo a cada 2 repetições.
    cell = [0, None, 2, 4, None, 7, 4, 2, None, 0, 4, None]
    steps_total = 18 * 16
    reps = steps_total // 12  # 24
    for v, (pan, shift_on) in enumerate([(-0.55, False), (0.55, True)]):
        for r in range(reps):
            rot = (r // 2) % 12 if shift_on else 0
            for k in range(12):
                d = cell[(k + rot) % 12]
                if d is None:
                    continue
                st = r * 12 + k
                song.note('lead', C.i_bell, st, deg(root + 12, scale, d), 2, gain=0.5, kind='marimba', tilt=0.8, vel=0.9 if k % 3 == 0 else 0.65, pan=pan)
    # pad de vibrafone e baixo pedal
    for i, ch in enumerate(chords):
        for m in ch:
            song.note('pad', C.i_bell, i * 16, m + 12, 16, gain=0.3, kind='vibes', tilt=2.2, vel=0.7)
        song.note('bass', C.i_tri, i * 16, roots[i], 16, gain=0.9, bits=0)
        song.note('bass', C.i_tri, i * 16 + 8, roots[i] + 7, 8, gain=0.6, bits=0)
    # seção final: melodia curta em vibrafone, só da metade para frente
    for k in range(3):
        degs = prog[6 + k * 4:6 + k * 4 + 4]
        notes = motif(300 + k, scale, root, degs, 7, 13, C.CALM, arch=0.5)
        C.lay_melody(song, 'counter', C.i_bell, notes, 6 + k * 4, gain=0.45, kind='vibes', tilt=1.4)
    # batida mínima: bumbo no 1 e hat quase nada a partir do 4º compasso
    C.lay_drums(song, 'light', 6, 12, gain=0.55, kit='real', fills=False, hat_gain=0.5)
    fx = fx_default(bpm, 1.5, 0.5, 0.22)
    fx['lead'] = [Reverb(room_size=0.45, wet_level=0.22, dry_level=0.85)]
    fx['pad'] = [Reverb(room_size=0.8, wet_level=0.4, dry_level=0.7)]
    return song, fx


# ---------------------------------------------------------------- 10. QUEDA LIVRE (Shepard descendo)

def track_descent():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        n = int(8 * 16 * song.step_s * SR)
        y = S.shepard(n, start_oct=2.0 - 0.1 * (s % 2), rate=-0.13, f0=36.0, voices=9)
        song.put('pad', y * 0.55, bar0 * 16 * song.step_s, 0.5)
        for i in range(0, 8, 4):  # whoosh de vento (alto → baixo) a cada 4 compassos
            n2 = int(4 * 16 * song.step_s * SR)
            tt_ = np.linspace(0, 1, n2)
            z = S.bp(song.rng.standard_normal(n2), 300, 7000) * (np.sin(np.pi * tt_) ** 2) * 0.35
            song.put('fx', z, (bar0 + i) * 16 * song.step_s, 0.55)

    cfg = dict(name='descent', bpm=170, root=47, scale='minor', progA=[0, 5, 2, 6, 0, 5, 3, 4], progB=[3, 4, 0, 0, 5, 6, 3, 4], form='ABAB',
               layers=[{'bass', 'drums', 'arp'}, {'bass', 'drums', 'arp', 'lead'}, {'bass', 'drums', 'arp', 'lead', 'counter'}, {'bass', 'drums', 'arp', 'lead', 'counter'}],
               bass=dict(inst=C.i_saw, style='octave', style_B='gallop', gain=0.95, kw=dict(cutoff=1100)),
               arp=dict(inst=C.i_pulse, style='down', gain=0.4, step_len=1, lift=12, kw=dict(duty=0.125, d=0.04, s=0.4)),
               lead=dict(inst=C.i_pulse, gain=0.7, lo=8, hi=15, seed=111, rhythms=C.BUSY, rhythms_B=C.BUSY, arch=0.12, kw=dict(duty=0.5, vib=0.012)),
               counter=dict(inst=C.i_fm, gain=0.35, kw=dict(ratio=2.0, index=1.5, tau=0.15)),
               drums=dict(style='four', style_B='double', kit='chip', gain=1.0), extras=extras)
    song = build_standard(cfg)
    fx = fx_default(170, 0.75, 0.3, 0.14)
    fx['pad'] = [Reverb(room_size=0.7, wet_level=0.3, dry_level=0.8)]
    return song, fx


# ---------------------------------------------------------------- 11. BÔNUS

def track_bonus():
    def extras(song, cfg, s, bar0, prog, chords, roots, isB, on):
        sparkle_rain(song, 'fx', C.i_bell, cfg['root'] + 24, 'major', 8, bar0, 0.45, 0, 10, 0.3, 400 + s, kind='marimba', tilt=0.5)
        for i in range(8):  # "caça-níquel": tique-taque de triângulos
            for st in (0, 4, 8, 12):
                song.note('fx', C.i_bell, (bar0 + i) * 16 + st, cfg['root'] + 48, 1, gain=0.12, kind='glass', tilt=0.3, vel=0.7, pan=0.5 if st % 8 else -0.5)

    cfg = dict(name='bonus', bpm=176, root=60, scale='major', bars=16, progA=[0, 3, 4, 0, 0, 5, 3, 4], progB=[3, 4, 0, 5, 3, 4, 0, 0], form='AB',
               layers=[{'bass', 'drums', 'arp', 'lead', 'counter'}],
               bass=dict(inst=C.i_tri, style='octave', gain=1.0, kw=dict(bits=4)),
               arp=dict(inst=C.i_fm, style='sixt', gain=0.35, step_len=1, lift=12, kw=dict(ratio=4.0, index=1.2, tau=0.1)),
               lead=dict(inst=C.i_pulse, gain=0.75, lo=7, hi=14, seed=123, rhythms=C.BUSY, rhythms_B=C.BUSY, kw=dict(duty=0.25, vib=0.01)),
               counter=dict(inst=C.i_pulse, gain=0.35, lo=14, hi=19, kw=dict(duty=0.125)),
               drums=dict(style='four', style_B='double', kit='chip', gain=0.95), extras=extras)
    song = build_standard(cfg)
    return song, fx_default(176, 0.75, 0.2, 0.1)


TRACKS = {
    'menu': track_menu, 'neon': track_neon, 'crystal': track_crystal, 'clock': track_clock, 'cosmos': track_cosmos,
    'ocean': track_ocean, 'volcano': track_volcano, 'paper': track_paper, 'sketch': track_sketch, 'inverse': track_descent, 'bonus': track_bonus,
}


# tonalidade de cada faixa (para o relatório de afinação por FFT)
KEYS = {'menu': (57, 'minor'), 'neon': (52, 'dorian'), 'crystal': (50, 'lydian'), 'clock': (55, 'harmonic'), 'cosmos': (54, 'phrygian'),
        'ocean': (48, 'mixolydian'), 'volcano': (50, 'phrygdom'), 'paper': (53, 'major'), 'sketch': (55, 'dorian'), 'inverse': (47, 'minor'), 'bonus': (60, 'major')}
