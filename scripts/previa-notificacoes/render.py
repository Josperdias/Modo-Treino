#!/usr/bin/env python3
"""Converte os layouts/drawables REAIS do módulo (res/) em HTML para conferir o visual no Chromium.
Aproximação: dp = 1 css px (renderizado com escala 3). Não substitui testar no aparelho."""
import re, sys, base64, json, pathlib, xml.etree.ElementTree as ET
RES = pathlib.Path(__file__).resolve().parents[2] / 'native' / 'modules' / 'modo-notif' / 'android' / 'src' / 'main' / 'res'
A = '{http://schemas.android.com/apk/res/android}'
COLORS = {m.group(1): m.group(2) for m in re.finditer(r'<color name="(\w+)">#([0-9A-Fa-f]{8})</color>', (RES/'values/colors.xml').read_text())}
def color(v):
    if v is None: return None
    if v.startswith('@color/'):
        h = COLORS[v[7:]]; return '#'+h[2:]   # AARRGGBB -> #RRGGBB (alpha ff)
    if v.startswith('#'):
        h = v[1:]
        if len(h) == 8: a = int(h[:2],16)/255; return f'rgba({int(h[2:4],16)},{int(h[4:6],16)},{int(h[6:8],16)},{a:.3f})'
        return v
    return v
def dp(v):
    if v is None: return None
    m = re.match(r'(-?[\d.]+)(dp|sp|px)?$', v); return float(m.group(1)) if m else None
FONTS = {'barlow_black': ("'Barlow Condensed'", 900), 'barlow_bold': ("'Barlow Condensed'", 700), 'dmsans_bold': ("'DM Sans'", 700), 'dmsans_regular': ("'DM Sans'", 400)}

def drawable_layers(name, size_px=None):
    """Devolve HTML interno (camadas posicionadas) que desenha o drawable @drawable/name preenchendo o elemento pai."""
    f = RES/f'drawable/{name}.xml'
    if not f.exists():
        p = RES/f'drawable-nodpi/{name}.png'
        if p.exists():
            return f'<img src="file://{p}" style="position:absolute;inset:0;width:100%;height:100%">'
        raise SystemExit(f'drawable não achado: {name}')
    root = ET.parse(f).getroot()
    tag = root.tag
    if tag == 'layer-list':
        out = []
        for it in root.findall('item'):
            inset = ''.join(f'{side}:{dp(it.get(A+side)) or 0}px;' for side in ('left','top','right','bottom'))
            inner = it.find('*')
            out.append(f'<div style="position:absolute;{inset}">{shape_or_other(inner, it)}</div>')
        return ''.join(out)
    return shape_or_other(root, None)

def shape_or_other(node, item):
    if node is None: return ''
    t = node.tag
    if t == 'shape':
        shape = node.get(A+'shape', 'rectangle')
        css = 'position:absolute;inset:0;box-sizing:border-box;'
        s = node.find('solid'); st = node.find('stroke'); c = node.find('corners')
        if s is not None: css += f'background:{color(s.get(A+"color"))};'
        if st is not None: css += f'border:{dp(st.get(A+"width"))}px solid {color(st.get(A+"color"))};'
        if shape == 'oval': css += 'border-radius:50%;'
        elif c is not None and c.get(A+'radius'): css += f'border-radius:{dp(c.get(A+"radius"))}px;'
        return f'<div style="{css}"></div>'
    if t == 'bitmap':
        src = node.get(A+'src').replace('@drawable/','')
        return f'<div style="position:absolute;inset:0;background:url(file://{RES}/drawable-nodpi/{src}.png) 0 0/40px 40px repeat"></div>'
    if t == 'clip':
        return f'<div style="position:absolute;left:0;top:0;bottom:0;width:{_P[0]*100}%">' + shape_or_other(node.find('*'), None) + '</div>'
    return ''

_P = [0.0]
def vector(name):
    root = ET.parse(RES/f'drawable/{name}.xml').getroot()
    vw, vh = root.get(A+'viewportWidth'), root.get(A+'viewportHeight')
    paths = []
    for p in root.findall('path'):
        d = p.get(A+'pathData'); fill = color(p.get(A+'fillColor')) or 'none'; sc = color(p.get(A+'strokeColor'))
        extra = ''
        if sc: extra += f' stroke="{sc}" stroke-width="{p.get(A+"strokeWidth")}" stroke-linejoin="round"'
        if p.get(A+'fillType') == 'evenOdd': extra += ' fill-rule="evenodd"'
        paths.append(f'<path d="{d}" fill="{fill}"{extra}/>')
    return f'<svg viewBox="0 0 {vw} {vh}" style="width:100%;height:100%;display:block">{"".join(paths)}</svg>'

class Ctx:
    def __init__(self, state): self.s = state
def render(node, ctx, parent_orient=None, parent_tag=None):
    tag = node.tag; get = lambda k, d=None: node.get(A+k, d)
    vid = (get('id') or '').replace('@+id/','').replace('@id/','')
    st = ctx.s.get(vid, {})
    if st.get('gone'): return ''
    css = ['box-sizing:border-box', 'position:relative', 'flex-shrink:0' if get('layout_weight') is None else 'min-width:0']
    w, h = get('layout_width'), get('layout_height'); weight = get('layout_weight')
    horiz = parent_orient == 'horizontal'
    def size(val, axis):
        if val == 'match_parent': return '100%'
        if val == 'wrap_content' or val is None: return 'auto'
        return f'{dp(val)}px'
    if weight:
        if horiz: css += [f'flex:{weight} 1 0', 'min-width:0']
        else: css += [f'flex:{weight} 1 0', 'min-height:0']
        if horiz: css.append('height:' + size(h, 'h'))
        else: css.append('width:' + size(w, 'w'))
    else:
        css += [f'width:{size(w,"w")}', f'height:{size(h,"h")}']
    for k, cssk in (('layout_margin','margin'),('layout_marginLeft','margin-left'),('layout_marginRight','margin-right'),('layout_marginTop','margin-top'),('layout_marginBottom','margin-bottom'),('padding','padding'),('paddingLeft','padding-left'),('paddingRight','padding-right'),('paddingTop','padding-top'),('paddingBottom','padding-bottom')):
        if get(k): css.append(f'{cssk}:{dp(get(k))}px')
    grav = get('gravity', '')
    inner_bg = ''
    bg = get('background') or get('progressDrawable')
    _P[0] = st.get('progress', 0)
    if st.get('bg'): bg = st['bg']
    if bg and bg.startswith('@drawable/'):
        inner_bg = f'<div style="position:absolute;inset:0;pointer-events:none;z-index:0">{drawable_layers(bg[10:])}</div>'
    if tag in ('LinearLayout',):
        orient = get('orientation', 'horizontal')
        css += ['display:flex', f'flex-direction:{"row" if orient=="horizontal" else "column"}']
        if 'center_vertical' in grav: css.append('align-items:center' if orient=='horizontal' else 'justify-content:center')
        if 'center_horizontal' in grav: css.append('align-items:center' if orient=='vertical' else 'justify-content:center')
        if grav == 'center': css += ['align-items:center','justify-content:center']
        if 'end' in grav and 'center' not in grav: css.append('justify-content:flex-end')
        return f'<div style="{";".join(css)}">{inner_bg}{wrap_kids(node, ctx, orient)}</div>'
    if tag == 'FrameLayout':
        kids = []
        for c in node:
            lg = c.get(A+'layout_gravity', '')
            k = render(c, ctx, None, tag)
            if lg:
                pos = 'position:absolute;'
                if 'top' in lg: pos += 'top:0;'
                if 'bottom' in lg: pos += 'bottom:0;'
                if 'end' in lg: pos += 'right:0;'
                if 'start' in lg: pos += 'left:0;'
                k = f'<div style="{pos}z-index:2">{k}</div>'
            kids.append(k)
        return f'<div style="{";".join(css)}">{inner_bg}{"".join(kids)}</div>'
    if tag == 'TextView' or tag == 'Chronometer':
        fam, wt = FONTS[get('fontFamily','@font/dmsans_regular')[6:]]
        text = st.get('text', get('text', ''))
        t = f'font-family:{fam};font-weight:{wt};font-size:{dp(get("textSize"))}px;color:{color(get("textColor"))};line-height:1.18'
        if get('textAllCaps') == 'true': text = text.upper()
        if get('letterSpacing'): t += f';letter-spacing:{float(get("letterSpacing"))}em'
        ml = get('maxLines'); one = get('singleLine') == 'true'
        if one: t += ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
        elif ml: t += f';display:-webkit-box;-webkit-line-clamp:{ml};-webkit-box-orient:vertical;overflow:hidden'
        return f'<div style="{";".join(css)};{t}">{inner_bg}<span style="position:relative;z-index:1">{text}</span></div>'
    if tag == 'ImageView':
        src = st.get('src', get('src'))
        if st.get('img'):  # png absoluto
            body = f'<img src="file://{st["img"]}" style="width:100%;height:100%;object-fit:contain;display:block">'
        elif src and src.startswith('@drawable/'): body = vector(src[10:])
        else: body = ''
        pad = ''
        return f'<div style="{";".join(css)}">{inner_bg}<div style="position:relative;z-index:1;width:100%;height:100%">{body}</div></div>'
    if tag == 'ProgressBar':
        return f'<div style="{";".join(css)}">{inner_bg}</div>'
    raise SystemExit('tag não tratada: ' + tag)

def wrap_kids(node, ctx, orient):
    return ''.join(render(c, ctx, orient, node.tag) for c in node)

def page(layout, state, width=328, fixed_h=None):
    root = ET.parse(RES/f'layout/{layout}.xml').getroot()
    body = render(root, Ctx(state))
    return body
