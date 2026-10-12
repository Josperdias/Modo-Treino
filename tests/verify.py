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
for f in ['App.tsx','MusicPlayer.tsx','SoundFX.ts','package.json','app.json','eas.json']:
    assert (ROOT/'native'/f).exists(),f
assert 'a ruivinha' in (ROOT/'site/app.js').read_text()
assert 'MusicDock' in (ROOT/'native/App.tsx').read_text()
assert 'crossfade' in (ROOT/'site/music.js').read_text()
assert json.loads((ROOT/'native/app.json').read_text())['expo']['name']=='Modo Treino'
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
