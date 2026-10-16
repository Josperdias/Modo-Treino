#!/usr/bin/env python3
"""NEON STEP DX — metadados dos sprites (pivô, caixa, SHA-256).

Lê os 16 PNG oficiais em arcade/fonte/legado-web/assets/sprites e:
  1. copia-os BYTE A BYTE para native/assets/arcade/sprites (nunca recorta nem redesenha);
  2. grava native/src/arcade/data/sprites.json com pivô por quadro.

Pivô X = centro de massa dos pixels opacos (mantém cabeça/tronco no mesmo ponto entre
quadros; o centro da caixa oscila até ~7 px). Pivô Y = base da caixa opaca (pés).
Rode: python3 scripts/gerar-atlas-arcade.py   (idempotente)
"""
import glob, hashlib, json, os, shutil
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, 'arcade/fonte/legado-web/assets/sprites')
DST = os.path.join(RAIZ, 'native/assets/arcade/sprites')
OUT = os.path.join(RAIZ, 'native/src/arcade/data/sprites.json')
# Orientação de base da arte (Camila foi desenhada olhando para a esquerda).
NATIVE_FACING = {'josperd': 1, 'camila': -1}

os.makedirs(DST, exist_ok=True)
saida = {'version': 1, 'nativeFacing': NATIVE_FACING, 'characters': {}}
for who in ('josperd', 'camila'):
    frames = []
    for f in sorted(glob.glob(os.path.join(SRC, f'{who}_*.png'))):
        nome = os.path.basename(f)
        shutil.copyfile(f, os.path.join(DST, nome))
        data = open(f, 'rb').read()
        im = Image.open(f).convert('RGBA')
        w, h = im.size
        a = im.split()[3].load()
        sx = n = 0
        x0, y0, x1, y1 = w, h, 0, 0
        for y in range(h):
            for x in range(w):
                if a[x, y] > 40:
                    sx += x + 0.5; n += 1
                    x0 = min(x0, x); x1 = max(x1, x + 1); y0 = min(y0, y); y1 = max(y1, y + 1)
        frames.append({
            'file': nome, 'w': w, 'h': h,
            'pivotX': round(sx / n, 1), 'pivotY': y1,
            'bbox': [x0, y0, x1, y1],
            'sha256': hashlib.sha256(data).hexdigest(),
        })
    saida['characters'][who] = {'frames': frames}
json.dump(saida, open(OUT, 'w'), indent=1, ensure_ascii=False)
print('ok', OUT, {k: len(v['frames']) for k, v in saida['characters'].items()})
