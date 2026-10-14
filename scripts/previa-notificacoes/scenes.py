"""Prévia dos cartões das notificações: converte os layouts REAIS (res/layout + drawables) em HTML e tira print no Chromium.
Uso: python3 scripts/previa-notificacoes/scenes.py /tmp/previa  &&  node scripts/previa-notificacoes/shoot.mjs /tmp/previa '["music_big","workout_big"]'
É uma aproximação (dp = px, fontes do módulo, sem o cabeçalho real do Android); não substitui testar no aparelho."""
import sys, pathlib, json, subprocess
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from render import page, RES
EX = str(RES.parents[5] / 'assets' / 'exercicios' / 'barra_w_vinho.jpg')
NODP = RES/'drawable-nodpi'
def pct(p, total=1000): return p
def music(big, fita=2, playing=True, live=False, title='Fita 03 – Ritmo de treino', sub='Bag Treino A · Mix genérico', kicker='Fita', pos=84, dur=198, fav=False):
    art = NODP/('art_planet.png' if live else f'art_fita_{fita}.png')
    st = {'art': {'img': str(art)}, 'title': {'text': title}, 'subtitle': {'text': sub},
          'play': {'src': '@drawable/ic_pause' if playing else '@drawable/ic_play'}}
    if big:
        st.update({'kicker': {'text': kicker}, 'fav': {'src': '@drawable/ic_heart_fill' if fav else '@drawable/ic_heart'}})
        if not live:
            st.update({'pos': {'text': f'{pos//60}:{pos%60:02d}'}, 'dur': {'text': f'{dur//60}:{dur%60:02d}'}, 'bar': {'progress': pos/dur if dur else 0}})
    layout = ('card_radio_' if live else 'card_music_') + ('big' if big else 'small')
    return page(layout, st)
def workout(big, resting=False, paused=False, title='Rosca direta na barra W', kicker='A1 · Bíceps', pill='Séries feitas: 2/5', image=True, persona='vinho', left='00:42'):
    st = {'title': {'text': title}, 'pill_text': {'text': pill, 'gone': resting}, 'clock': {'text': 'Descanso ' + left, 'gone': not resting},
          'primary': {'src': ('@drawable/ic_play' if paused else '@drawable/ic_pause') if resting else '@drawable/ic_check'},
          'art': {'img': EX} if image else {'src': '@drawable/ic_flower' if persona == 'loira' else '@drawable/ic_star'}}
    if big: st.update({'kicker': {'text': kicker}})
    return page('card_workout_big' if big else 'card_workout_small', st)

def wrap(inner, header, navy=True, h=None, w=328):
    bg = '#141B34' if navy else '#fff'; fg = '#fff' if navy else '#444'
    ht = f'height:{h}px;' if h else ''
    return f'''<div style="width:360px;background:{bg};padding:0 16px 14px;margin-bottom:14px;border-radius:0">
      <div style="height:32px;display:flex;align-items:center;font:600 12px 'DM Sans';color:{fg}">● &nbsp;{header}</div>
      <div style="width:{w}px;{ht}">{inner}</div></div>'''
scenes = [
 ('music_big', wrap(music(True, fav=True), 'Modo Treino • Tocando agora • agora')),
 ('music_big_estreito', wrap(music(True, fav=True), 'Modo Treino • Tocando agora • agora', w=272)),
 ('music_small', wrap(music(False), 'Modo Treino • Tocando agora • agora', h=48)),
 ('music_paused', wrap(music(True, fita=5, playing=False, title='Eye of the Tiger', sub='Todas as fitas · Survivor'), 'Modo Treino • Tocando agora • agora')),
 ('radio_big', wrap(music(True, live=True, playing=True, title='Billie Eilish – Bad Guy', sub='Rádio Nova Brasil · 🇧🇷 Brasil', kicker='Rádio ao vivo'), 'Modo Treino • Tocando agora • agora')),
 ('radio_small', wrap(music(False, live=True, title='Billie Eilish – Bad Guy', sub='Rádio Nova Brasil · 🇧🇷 Brasil'), 'Modo Treino • Tocando agora • agora', h=48)),
 ('workout_big', wrap(workout(True), 'Modo Treino • Treino em andamento • agora')),
 ('workout_small', wrap(workout(False), 'Modo Treino • Treino em andamento • agora', h=48)),
 ('workout_rest', wrap(workout(True, resting=True), 'Modo Treino • Treino em andamento • agora')),
 ('workout_rest_small', wrap(workout(False, resting=True), 'Modo Treino • Treino em andamento • agora', h=48)),
 ('workout_long', wrap(workout(True, title='Elevação frontal na polia baixa', kicker='B3 · Peito', pill='Séries feitas: 0/4', image=False, persona='loira'), 'Modo Treino • Treino em andamento • agora')),
]
fonts = ''.join(f"@font-face{{font-family:'{n}';font-weight:{w};src:url('file://{p}')}}" for n,w,p in [
  ('Barlow Condensed',900,RES/'font/barlow_black.ttf'),('Barlow Condensed',700,RES/'font/barlow_bold.ttf'),('DM Sans',700,RES/'font/dmsans_bold.ttf'),('DM Sans',400,RES/'font/dmsans_regular.ttf')])
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
for name, html in scenes:
    (out/f'{name}.html').write_text(f'<!doctype html><meta charset=utf-8><style>{fonts} body{{margin:0;background:#141B34}}</style>{html}')
print(json.dumps([n for n,_ in scenes]))
