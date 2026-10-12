from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
web=json.loads((ROOT/'site/exercises.json').read_text())
native=json.loads((ROOT/'native/exercises.json').read_text())
assert web == native
assert len(web)==14 and {x['id'] for x in web} == {'a1','a2','a3','a4','a5','a6','b1','b2','b3','b4','b5','b6','b7','b8'}
assert len({x['id'] for x in web}) == len(web)
assert sum(x['treino']=='A' for x in web)==6 and sum(x['treino']=='B' for x in web)==8
assert next(x for x in web if x['id']=='b3')['imagem'] is None
for ex in web:
    if ex['imagem']:
        assert (ROOT/'site'/ex['imagem']).is_file(),ex
    if ex['imagemAlternativa']:
        assert (ROOT/'site'/ex['imagemAlternativa']).is_file(),ex
for f in ['index.html','app.js','data.js','music.js','sounds.js','updates.js','styles.css','sw.js','manifest.webmanifest']:
    assert (ROOT/'site'/f).exists(),f
for f in ['App.tsx','SoundFX.ts','package.json','app.json','eas.json','src/store.tsx','src/data.ts','src/ui.tsx','src/ZoomView.tsx','src/music/MusicProvider.tsx','src/music/device.ts','src/music/MiniPlayer.tsx','src/screens/HomeScreen.tsx','src/screens/TrainScreen.tsx','src/screens/WorkoutScreen.tsx','src/screens/MusicScreen.tsx','src/screens/ProgressScreen.tsx']:
    assert (ROOT/'native'/f).exists(),f
assert 'a ruivinha' in (ROOT/'site/app.js').read_text()
assert 'MiniPlayer' in (ROOT/'native/App.tsx').read_text()
assert 'crossfade' in (ROOT/'site/music.js').read_text()
assert json.loads((ROOT/'native/app.json').read_text())['expo']['name']=='Modo Treino'
for f in [ROOT/'native/App.tsx', *(ROOT/'native/src').rglob('*.tsx')]:
    assert 'resizeMode="cover"' not in f.read_text(),f'{f}: arte de exercício nunca com cover (CLAUDE.md)'
print('OK: 14 exercícios, arquivos de imagem, cópia nativa, Modo Música e identidade.')

for style in ('suave','arcade','minimal'):
    for event in ('button','series','finish','rest','count'):
        for platform in ('site','native'):
            f=ROOT/platform/'assets'/'sounds'/style/(event+'.wav')
            assert f.exists() and f.stat().st_size>1000,f
for n in (1,2,3):
    assert (ROOT/'site/assets/sounds/voice'/f'{n}.wav').exists()
assert 'enabled:false' in (ROOT/'site/sounds.js').read_text()
assert 'enabled:false' in (ROOT/'native/SoundFX.ts').read_text()
print('OK: 3 estilos de som, contagem 3-2-1 e opções sonoras desativadas por padrão.')


# ---------------- v1.1.0: consistência, segurança e infraestrutura ----------------
import subprocess, os

# 1) lógica compartilhada idêntica nas três cópias
shared=(ROOT/'shared/logic.js').read_text()
for t in ('site/logic.js','native/logic.js'):
    assert (ROOT/t).read_text()==shared, f'{t} diverge de shared/logic.js — rode: node scripts/sync-shared.mjs'
print('OK: shared/logic.js idêntico em site/ e native/.')

# 2) uma única versão em todo lugar
def grab(path,pattern):
    m=re.search(pattern,(ROOT/path).read_text()); assert m,(path,pattern); return m.group(1)
versions={
 'native/package.json':json.loads((ROOT/'native/package.json').read_text())['version'],
 'native/app.json':json.loads((ROOT/'native/app.json').read_text())['expo']['version'],
 'package.json':json.loads((ROOT/'package.json').read_text())['version'],
 'native/App.tsx':grab('native/App.tsx',r"APP_VERSION='([^']+)'"),
 'site/updates.js':grab('site/updates.js',r"APP_VERSION='([^']+)'"),
 'site/sw.js':grab('site/sw.js',r"VERSION = '([^']+)'"),
}
assert len(set(versions.values()))==1, f'versões divergentes: {versions}'
print('OK: versão única', next(iter(versions.values())))

# 3) site sem dependência externa de fontes/CDN e com fontes OFL + licenças
for f in ['site/index.html','site/styles.css','site/baixar/index.html','site/baixar/baixar.css']:
    txt=(ROOT/f).read_text()
    assert 'googleapis' not in txt and 'gstatic' not in txt, f'{f} ainda depende do Google Fonts'
fonts=sorted(p.name for p in (ROOT/'site/assets/fonts').iterdir())
assert any(n.startswith('LICENSE-DMSans') for n in fonts) and any(n.startswith('LICENSE-BarlowCondensed') for n in fonts), fonts
assert not any('cartoonie' in n.lower() for n in fonts), 'Le Cartoonie não pode ser distribuída sem licença'
print('OK: tipografia local (OFL) e sem Le Cartoonie embutida.')

# 4) service worker precarrega todos os arquivos do núcleo que existem
sw=(ROOT/'site/sw.js').read_text()
for f in ['logic.js','updates.js','sounds.js','music.js','data.js','styles.css','manifest.webmanifest','baixar/index.html','baixar/baixar.js','baixar/baixar.css']:
    assert f"'./{f}'" in sw, f'sw.js não precarrega {f}'
    assert (ROOT/'site'/f).is_file(), f
manifest=json.loads((ROOT/'site/manifest.webmanifest').read_text())
for ic in manifest['icons']: assert (ROOT/'site'/ic['src']).is_file(), ic
print('OK: service worker e manifesto consistentes.')

# 5) segredos: nada de tokens/chaves em arquivos de texto versionados
PATTERNS=[r'ghp_[A-Za-z0-9]{30,}',r'github_pat_[A-Za-z0-9_]{30,}',r'gh[oprsu]_[A-Za-z0-9]{30,}',r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',r'AKIA[0-9A-Z]{16}',r'AIza[0-9A-Za-z_\-]{35}',r'xox[baprs]-[0-9A-Za-z-]{10,}']
SKIP_DIRS={'node_modules','.git','assets','dist-web','.expo'}
hits=[]
for path in ROOT.rglob('*'):
    if not path.is_file() or any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts): continue
    if path.suffix.lower() in {'.png','.jpg','.wav','.woff2','.apk','.zip'} or path.name=='package-lock.json': continue
    try: txt=path.read_text(encoding='utf-8')
    except Exception: continue
    for pat in PATTERNS:
        if re.search(pat,txt): hits.append((str(path.relative_to(ROOT)),pat))
assert not hits, f'possível segredo versionado: {hits}'
print('OK: nenhum padrão de token/chave privada encontrado.')

# 6) workflows existem e o APK é standalone (release), não debug sem JS
wf=(ROOT/'.github/workflows/android-apk.yml').read_text()
assert 'assembleRelease' in wf and 'assembleDebug' not in wf, 'APK de teste deve ser standalone (assembleRelease)'
for f in ['check.yml','android-apk.yml','pages.yml']: assert (ROOT/'.github/workflows'/f).is_file(), f
print('OK: workflows de CI, APK e Pages presentes.')


# 7) assets do app: a EXTENSÃO tem que ser o formato real. O aapt2 do Android recusa JPEG com nome .png
#    ("AAPT: error: file failed to compile") e derruba o APK. (Navegadores toleram; o app nativo não.)
def sniff(path):
    head=path.read_bytes()[:12]
    if head[:8]==b'\x89PNG\r\n\x1a\n': return 'png'
    if head[:3]==b'\xff\xd8\xff': return 'jpg'
    if head[:4]==b'RIFF' and head[8:12]==b'WAVE': return 'wav'
    return 'outro'
wrong=[]
for path in (ROOT/'native/assets').rglob('*'):
    if not path.is_file(): continue
    ext=path.suffix.lower().lstrip('.'); ext='jpg' if ext=='jpeg' else ext
    if ext in ('png','jpg','wav') and sniff(path)!=ext: wrong.append((str(path.relative_to(ROOT)),ext,sniff(path)))
assert not wrong, f'extensão não confere com o formato real (quebra o APK): {wrong[:5]}'
print('OK: extensões dos assets do app conferem com o formato real.')
