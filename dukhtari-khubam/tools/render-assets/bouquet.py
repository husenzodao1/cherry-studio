"""Compose the flower art from real photographs and scanned leaves.

Inputs (see PROVENANCE.json for sources and licences):
  photos/cut/*.png   flower photographs (Wikimedia Commons) with the background removed (rembg, isnet-general-use)
  final/leaf-*.png   Poly Haven CC0 scanned leaves rendered by render.cjs (jobs-leaves.json)
  final/star-*.png   metallic stars rendered by render.cjs
Outputs: out-art/*.webp, copied to public/assets/3d by hand.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

PHOTOS, RENDERS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)


def clean(img, keep=1, close=0):
    """Keep the largest opaque component(s): drops specks and stray stems left by background removal."""
    a = np.asarray(img.getchannel('A')) > 24
    lab, n = ndimage.label(a)
    if n > keep:
        sizes = ndimage.sum(a, lab, range(1, n + 1))
        keep_ids = 1 + np.argsort(sizes)[::-1][:keep]
        mask = np.isin(lab, keep_ids)
        mask = ndimage.binary_dilation(mask, iterations=2)
        arr = np.asarray(img).copy()
        arr[..., 3] = np.where(mask, arr[..., 3], 0)
        img = Image.fromarray(arr)
    bb = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return img.crop(bb)


def load(path, **kw):
    return clean(Image.open(path).convert('RGBA'), **kw)


def fit(img, w):
    h = round(img.height * w / img.width)
    return img.resize((w, h), Image.LANCZOS)


def grade(img, lift=0.0, sat=1.0, warm=(1, 1, 1)):
    """Gentle colour grade so photographs sit in the lavender interface."""
    a = np.asarray(img).astype(np.float32) / 255
    rgb = a[..., :3]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    rgb = lum[..., None] + (rgb - lum[..., None]) * sat
    rgb = rgb * np.array(warm)
    rgb = rgb + (1 - rgb) * lift
    a[..., :3] = np.clip(rgb, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))


def contact_shadow(canvas, flower, x, y, strength=0.45, blur=18, dy=10):
    """A soft shadow of the flower onto what lies beneath, so it sits on its leaves."""
    sh = Image.new('RGBA', flower.size, (40, 28, 52, 0))
    sh.putalpha(flower.getchannel('A').point(lambda v: int(v * strength)))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh, (x, y + dy))


def place(canvas, img, cx, cy, angle=0):
    if angle:
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    x, y = round(cx - img.width / 2), round(cy - img.height / 2)
    canvas.alpha_composite(img, (x, y))
    return x, y, img


def save(canvas, name, max_w):
    bb = canvas.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
    img = canvas.crop(bb)
    if img.width > max_w:
        img = fit(img, max_w)
    img.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=88, method=6)
    print(name, img.size)


leaf = lambda n: grade(load(os.path.join(RENDERS, f'leaf-{n}.png')), lift=0.06, sat=0.92)
rose = grade(load(os.path.join(PHOTOS, 'rose.png')), sat=1.02, warm=(1.0, 0.8, 0.9))  # coral → soft red
lily_purple = grade(load(os.path.join(PHOTOS, 'lily-purple-pads.png')), sat=1.02)
lily_pink = grade(load(os.path.join(PHOTOS, 'lily-pink-pads.png')), sat=1.0)
periwinkle = load(os.path.join(PHOTOS, 'periwinkle.png'))
plumeria = load(os.path.join(PHOTOS, 'plumeria.png'))
plumeria = clean(plumeria.crop((int(plumeria.width * 0.33), 0, plumeria.width, plumeria.height)))  # the bloom, without its bud
stars = [grade(load(os.path.join(RENDERS, 'star-rosegold.png')), lift=0.12), grade(load(os.path.join(RENDERS, 'star-rosegold.png')), lift=0.3, sat=0.7)]

# rose: anthurium leaves radiate from beneath the bloom
c = Image.new('RGBA', (2000, 2000))
place(c, fit(leaf('ant-3'), 1500), 1000, 1060, angle=-18)
r = fit(rose, 980)
contact_shadow(c, r, 1000 - r.width // 2, 980 - r.height // 2)
place(c, r, 1000, 980)
save(c, 'rose', 900)

# water lily on round calathea leaves (they read as lily pads)
c = Image.new('RGBA', (2000, 2000))
place(c, fit(leaf('cal-2'), 1350), 1000, 1110, angle=8)
l = fit(lily_purple, 1000)
contact_shadow(c, l, 1000 - l.width // 2, 930 - l.height // 2)
place(c, l, 1000, 930)
save(c, 'flower-lotus', 760)

# small cluster: pink water lily, periwinkle and plumeria over anthurium leaves
c = Image.new('RGBA', (2400, 1800))
place(c, fit(leaf('ant-1'), 1500), 1180, 980, angle=12)
p = fit(lily_pink, 860)
contact_shadow(c, p, 1180 - p.width // 2, 820 - p.height // 2)
place(c, p, 1180, 820)
pw = fit(periwinkle, 520)
contact_shadow(c, pw, 1720 - pw.width // 2, 1080 - pw.height // 2, strength=0.35, blur=14)
place(c, pw, 1720, 1080, angle=-12)
pl = fit(plumeria, 560)
contact_shadow(c, pl, 640 - pl.width // 2, 1120 - pl.height // 2, strength=0.35, blur=14)
place(c, pl, 640, 1120, angle=10)
save(c, 'flower-cluster', 900)

# school icons: purple lily (religion), pink lily (health), each with a leaf beneath
for name, bloom, lf, ang in (('icon-religion', lily_purple, 'cal-1', 24), ('icon-health', lily_pink, 'cal-2', -14)):
    c = Image.new('RGBA', (1600, 1600))
    place(c, fit(leaf(lf), 1100), 800, 900, angle=ang)
    b = fit(bloom, 900)
    contact_shadow(c, b, 800 - b.width // 2, 760 - b.height // 2)
    place(c, b, 800, 760)
    save(c, name, 600)

# garland: five-petal flowers and stars hanging on fine threads, precise even spacing
W, H = 1000, 2200
c = Image.new('RGBA', (W, H))
threads = [(0.2, 0.7), (0.5, 1.0), (0.8, 0.84)]
step = 0.2
items = [periwinkle, stars[0], plumeria, stars[1]]
sizes = {id(periwinkle): 0.27, id(plumeria): 0.25, id(stars[0]): 0.15, id(stars[1]): 0.13}
k = 0
for tx, length in threads:
    x = tx * W
    ys = [y for y in np.arange(0.16 * H + (k % 2) * 0.05 * H, length * H, step * H)]
    end = int(ys[-1])
    # thread: hairline with a champagne sheen, ending at the last ornament
    g = np.linspace(0, 1, end)
    arr = np.zeros((end, 8, 4), np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = 214, 190, 160
    arr[:, 1:7, 3] = (170 + 50 * np.sin(g * 9)[:, None]).clip(0, 255).astype(np.uint8)
    arr[:, 3:5, 0:3] = (246, 236, 222)
    arr[:, 2:6, 3] = 250
    c.alpha_composite(Image.fromarray(arr), (int(x) - 4, 0))
    for j, y in enumerate(ys, start=k):
        it = items[j % len(items)]
        place(c, fit(it, int(sizes[id(it)] * W)), x, y, angle=((j * 37) % 30) - 15)
    k += 1
save(c, 'garland', 700)
