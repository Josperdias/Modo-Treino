// Gera uma folha de prévia (PNG) de todos os sprites de pixel do jogo, para conferir o desenho.
// Uso: node scripts/prever-pixelart.mjs <saida.png> [escala]   (precisa de Python + Pillow)
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import * as art from '../native/src/arcade/render/pixelart.ts';

const out = process.argv[2] || 'pixelart.png';
const scale = Number(process.argv[3] || 6);
const list = [];
for (const [name, v] of Object.entries(art)) {
  if (typeof v === 'function' || name === 'ENEMY_SPRITES') continue;
  (Array.isArray(v) ? v : [v]).forEach((s, i) => list.push({name: name + (Array.isArray(v) ? i : ''), pal: s.pal, grid: art.expand(s)}));
}
const py = `
import json,sys
from PIL import Image
data=json.load(sys.stdin); scale=${scale}
sheet=Image.new('RGBA',(1400,1000),(60,40,90,255)); x=y=8; rowh=0
for s in data:
    g=s['grid']; w=max(len(r) for r in g); h=len(g)
    if x+w*scale>1390: x=8; y+=rowh+14; rowh=0
    for j,r in enumerate(g):
        for i,ch in enumerate(r):
            if ch!='.':
                c=s['pal'].get(ch,'#ff00ff').lstrip('#'); rgb=tuple(int(c[k:k+2],16) for k in (0,2,4))
                for dy in range(scale):
                    for dx in range(scale): sheet.putpixel((x+i*scale+dx,y+j*scale+dy),rgb+(255,))
    x+=w*scale+14; rowh=max(rowh,h*scale)
sheet.crop((0,0,1400,y+rowh+8)).save(sys.argv[1])
`;
const r = spawnSync('python3', ['-c', py, out], {input: JSON.stringify(list), encoding: 'utf8'});
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log('prévia em', out, '·', list.length, 'quadros');
