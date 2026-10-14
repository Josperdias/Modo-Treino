#!/usr/bin/env python3
"""Gera as capas (512x512) que o player do Android mostra na notificação/tela de bloqueio quando o Media3 toca:
cada fita (cassete colorido) sobre o azul-céu pontilhado do app, e a rádio (planeta) sobre o espaço.
Entrada: as artes do módulo modo-notif. Saída: native/modules/modo-playback/.../drawable-nodpi/capa_fita_0..7.png e capa_radio.png
   python3 scripts/gerar-capas-media3.py
"""
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'native' / 'modules'
SRC = ROOT / 'modo-notif' / 'android' / 'src' / 'main' / 'res' / 'drawable-nodpi'
OUT = ROOT / 'modo-playback' / 'android' / 'src' / 'main' / 'res' / 'drawable-nodpi'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 512
SKY = (0xAA, 0xC8, 0xF8, 255)
INK = (0x14, 0x1B, 0x34, 255)

def tile(base: Image.Image, tile_img: Image.Image) -> None:
    for y in range(0, SIZE, tile_img.height):
        for x in range(0, SIZE, tile_img.width):
            base.alpha_composite(tile_img, (x, y))

def vertical_gradient(top, bottom) -> Image.Image:
    img = Image.new('RGBA', (SIZE, SIZE))
    d = ImageDraw.Draw(img)
    for y in range(SIZE):
        t = y / (SIZE - 1)
        d.line([(0, y), (SIZE, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return img

def place(base: Image.Image, art: Image.Image, scale: float, shadow: bool) -> None:
    w = int(SIZE * scale)
    h = int(art.height * w / art.width)
    a = art.resize((w, h), Image.LANCZOS)
    x, y = (SIZE - w) // 2, (SIZE - h) // 2
    if shadow:  # sombra dura do estilo "adesivo"
        sh = Image.new('RGBA', a.size, INK)
        sh.putalpha(a.getchannel('A'))
        base.alpha_composite(sh, (x + 10, y + 12))
    base.alpha_composite(a, (x, y))

def main() -> None:
    dots = Image.open(SRC / 'dots_sky.png').convert('RGBA')
    for n in range(8):
        img = Image.new('RGBA', (SIZE, SIZE), SKY)
        tile(img, dots)
        place(img, Image.open(SRC / f'art_fita_{n}.png').convert('RGBA'), 0.82, True)
        img.convert('RGB').save(OUT / f'capa_fita_{n}.png', optimize=True)
    img = vertical_gradient((0x2B, 0x1D, 0x7C), (0x0A, 0x10, 0x33))
    tile(img, Image.open(SRC / 'dots_space.png').convert('RGBA'))
    place(img, Image.open(SRC / 'art_planet.png').convert('RGBA'), 0.78, False)
    img.convert('RGB').save(OUT / 'capa_radio.png', optimize=True)
    print('capas geradas em', OUT)

if __name__ == '__main__':
    main()
