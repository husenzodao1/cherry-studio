"""Launcher icons and splash screens for the Android app: "Гули шишагӣ" — the rendered glass crocus
(public/assets/3d/glass-flower.webp) on a lavender sky with a soft white glow and two glints.

Writes into android/app/src/main/res:
  mipmap-*/ic_launcher.png, ic_launcher_round.png   legacy square and round icons
  mipmap-*/ic_launcher_background.png               adaptive background (sky, glow, glints)
  mipmap-*/ic_launcher_foreground.png               adaptive foreground (the flower, inside the safe zone)
  drawable*/splash.png                              splash screens
and the website's icons (src/app/icon.png, src/app/apple-icon.png).

Usage: python3 tools/android/make-icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
FLOWER = Image.open(os.path.join(ROOT, 'public', 'assets', '3d', 'glass-flower.webp')).convert('RGBA')
TOP, BOTTOM = (246, 240, 254), (214, 196, 246)  # lavender sky
SHADOW = (70, 40, 130)


def sky(w, h):
    """Vertical lavender gradient with a soft white glow above the centre and two small glints."""
    img = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,))
    s = min(w, h)
    glow = Image.new('L', (w, h), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy, r = w * 0.5, h * 0.42, s * 0.5
    for i in range(40, 0, -1):
        rr = r * i / 40
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=round(200 * (1 - i / 40) ** 1.6))
    white = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    white.putalpha(glow.filter(ImageFilter.GaussianBlur(max(1, r / 12))))
    img.alpha_composite(white)
    for gx, gy, gr in [(0.74, 0.24, 0.009), (0.24, 0.32, 0.006)]:
        glint(img, w * 0.5 + (gx - 0.5) * s, h * 0.5 + (gy - 0.5) * s, max(1.0, s * gr))
    return img


def glint(img, x, y, r):
    d = ImageDraw.Draw(img)
    for k in range(3, 0, -1):
        rr = r * k / 3
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255, 230 // (k * 2)))
    width = max(1, round(r / 4))
    d.line([(x - r * 2.2, y), (x + r * 2.2, y)], fill=(255, 255, 255, 230), width=width)
    d.line([(x, y - r * 2.2), (x, y + r * 2.2)], fill=(255, 255, 255, 230), width=width)


def flower(width):
    """The glass crocus at `width`, with its soft violet shadow below; returns (image, shadow offset)."""
    art = FLOWER.resize((width, round(FLOWER.height * width / FLOWER.width)), Image.LANCZOS)
    pad = max(4, width // 12)
    out = Image.new('RGBA', (art.width + pad * 2, art.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', art.size, SHADOW + (0,))
    sh.putalpha(art.getchannel('A').point(lambda v: v * 90 // 255))
    out.alpha_composite(sh, (pad, pad + max(1, width // 36)))
    blurred = out.filter(ImageFilter.GaussianBlur(max(1, width / 36)))
    blurred.alpha_composite(art, (pad, pad))
    return blurred


def put(canvas, item, cx, cy):
    canvas.alpha_composite(item, (round(cx - item.width / 2), round(cy - item.height / 2)))
    return canvas


def icon(size):
    return put(sky(size, size), flower(round(size * 0.92)), size * 0.52, size * 0.53)


def masked(img, mask_fn):
    size = img.width
    big = Image.new('L', (size * 4, size * 4), 0)
    mask_fn(ImageDraw.Draw(big), size * 4)
    out = Image.new('RGBA', (size, size))
    out.paste(img, (0, 0), big.resize((size, size), Image.LANCZOS))
    return out


DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, k in DENSITIES.items():
    folder = os.path.join(RES, f'mipmap-{name}')
    size = round(48 * k)
    full = icon(size)
    masked(full, lambda d, s: d.rounded_rectangle([0, 0, s - 1, s - 1], radius=round(s * 0.22), fill=255)).save(os.path.join(folder, 'ic_launcher.png'))
    masked(full, lambda d, s: d.ellipse([0, 0, s - 1, s - 1], fill=255)).save(os.path.join(folder, 'ic_launcher_round.png'))
    # adaptive icon: 108dp layers, the launcher shows the inner 72dp; the flower spans 92% of that
    layer = round(108 * k)
    sky(layer, layer).save(os.path.join(folder, 'ic_launcher_background.png'))
    put(Image.new('RGBA', (layer, layer)), flower(round(72 * k * 0.92)), layer * 0.5 + 1.4 * k, layer * 0.5 + 2.2 * k).save(
        os.path.join(folder, 'ic_launcher_foreground.png'))

for xml in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    with open(os.path.join(RES, 'mipmap-anydpi-v26', xml), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n')

for folder in os.listdir(RES):
    path = os.path.join(RES, folder, 'splash.png')
    if os.path.exists(path):
        w, h = Image.open(path).size
        put(sky(w, h), flower(round(min(w, h) * 0.5)), w * 0.51, h * 0.5).convert('RGB').save(path)
# the same icon for the website: browser tab and iPhone home screen
masked(icon(512), lambda d, s: d.rounded_rectangle([0, 0, s - 1, s - 1], radius=round(s * 0.22), fill=255)).save(os.path.join(ROOT, 'src', 'app', 'icon.png'))
icon(180).convert('RGB').save(os.path.join(ROOT, 'src', 'app', 'apple-icon.png'))
print('icons and splash written')
