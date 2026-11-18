"""Launcher icons and splash screens for the Android app from the rendered glass flower (public/assets/3d/glass-flower.webp).

Usage: python3 tools/android/make-icons.py   (writes into android/app/src/main/res)
"""
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
LOTUS = Image.open(os.path.join(ROOT, 'public', 'assets', '3d', 'glass-flower.webp')).convert('RGBA')
TOP, BOTTOM = (246, 240, 251), (224, 207, 238)  # interface lavender → lilac


def gradient(w, h):
    img = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,))
    return img


def lotus(width):
    art = LOTUS.copy()
    art.thumbnail((width, width), Image.LANCZOS)
    shadow = Image.new('RGBA', (art.width + 40, art.height + 40), (0, 0, 0, 0))
    shadow.alpha_composite(Image.new('RGBA', art.size, (60, 40, 90, 70)), (20, 26))
    shadow.putalpha(Image.eval(shadow.getchannel('A'), lambda a: a))
    mask = Image.new('L', shadow.size, 0)
    mask.paste(art.getchannel('A'), (20, 26))
    shadow.putalpha(mask.point(lambda a: a * 70 // 255).filter(ImageFilter.GaussianBlur(10)))
    shadow.alpha_composite(art, (20, 20))
    return shadow


def place(canvas, item):
    canvas.alpha_composite(item, ((canvas.width - item.width) // 2, (canvas.height - item.height) // 2))
    return canvas


DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENSITIES.items():
    folder = os.path.join(RES, f'mipmap-{name}')
    size = round(48 * k)
    # legacy square and round icons
    icon = place(gradient(size, size), lotus(round(size * 0.8)))
    rounded = Image.new('L', (size, size), 0)
    ImageDraw.Draw(rounded).rounded_rectangle([0, 0, size - 1, size - 1], radius=round(size * 0.22), fill=255)
    sq = Image.new('RGBA', (size, size)); sq.paste(icon, (0, 0), rounded); sq.save(os.path.join(folder, 'ic_launcher.png'))
    circle = Image.new('L', (size, size), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, size - 1, size - 1], fill=255)
    rd = Image.new('RGBA', (size, size)); rd.paste(icon, (0, 0), circle); rd.save(os.path.join(folder, 'ic_launcher_round.png'))
    # adaptive foreground: 108dp canvas, art inside the 66dp safe zone
    fg_size = round(108 * k)
    place(Image.new('RGBA', (fg_size, fg_size)), lotus(round(66 * k))).save(os.path.join(folder, 'ic_launcher_foreground.png'))

with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#EFE6F7</color>\n</resources>\n')

for folder in os.listdir(RES):
    path = os.path.join(RES, folder, 'splash.png')
    if os.path.exists(path):
        w, h = Image.open(path).size
        place(gradient(w, h), lotus(round(min(w, h) * 0.42))).convert('RGB').save(path)
print('icons and splash written')
