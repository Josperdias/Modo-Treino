#!/usr/bin/env python3
"""NEON STEP DX — prepara as artes do menu de seleção (WebP) para o app.

Entrada: pasta com as artes extraídas do menu V3.5 "Fluido" (pacote NEON_MENU_09 do Drive do dono).
Saída: native/assets/arcade/menu/*.webp — só recompressão: nenhuma arte é recortada, pintada ou redimensionada.
Uso: python3 scripts/preparar-menu-arcade.py <pasta com asset_00..asset_11 do V3.5>
"""
import os, sys, glob
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(RAIZ, 'native/assets/arcade/menu')
# índice do asset no HTML V3.5 → nome no app
NOMES = {0: 'bg_josperd', 1: 'bg_camila', 2: 'ghost_josperd', 3: 'ghost_camila', 4: 'hero_josperd', 5: 'hero_camila',
         6: 'info_josperd', 7: 'info_camila', 8: 'ray', 9: 'swap', 10: 'logo', 11: 'swipe'}
src = sys.argv[1] if len(sys.argv) > 1 else None
if not src: sys.exit(__doc__)
os.makedirs(DST, exist_ok=True)
total = 0
for i, nome in NOMES.items():
    f = glob.glob(os.path.join(src, f'asset_{i:02d}_*'))[0]
    im = Image.open(f)
    out = os.path.join(DST, nome + '.webp')
    im.save(out, 'WEBP', quality=90, method=6, alpha_quality=100) if im.mode == 'RGBA' else im.save(out, 'WEBP', quality=90, method=6)
    total += os.path.getsize(out)
    print(f'{nome:14s} {im.size} {os.path.getsize(out)//1024} KB')
print('total', total // 1024, 'KB')
