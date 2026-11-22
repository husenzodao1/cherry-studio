"""Recover RGBA from a black-backdrop and a white-backdrop render of the same scene.
Transmission is taken per channel: the least-transmitted channel defines alpha and the extra tint is baked
against the page's lavender, so coloured glass keeps its colour when composited on the app background."""
import sys, numpy as np
from PIL import Image
REF = np.array([0.80, 0.74, 0.93])  # linear-ish lavender page reference
def lin(a): a = a / 255.0; return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
def enc(a): a = np.clip(a, 0, 1); return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)
def matte(name, out, crop=True, pad=12, width=None):
    b = lin(np.asarray(Image.open(f'out/{name}.b.png').convert('RGB')).astype(np.float64))
    w = lin(np.asarray(Image.open(f'out/{name}.w.png').convert('RGB')).astype(np.float64))
    T = np.clip(w - b, 0, 1)
    tmin = T.min(axis=2, keepdims=True)
    a = np.clip(1 - tmin, 0, 1)
    premul = b + (T - tmin) * REF
    c = np.where(a > 1e-4, premul / np.maximum(a, 1e-4), 0)
    rgba = np.concatenate([enc(c) * 255, a * 255], axis=2).round().astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    if crop:
        al = np.asarray(im)[:, :, 3]
        ys, xs = np.where(al > 6)
        x0, y0, x1, y1 = max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, im.width), min(ys.max() + pad, im.height)
        im = im.crop((x0, y0, x1, y1))
    if width and im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(out)
    return im.size
if __name__ == '__main__':
    for n in sys.argv[1:]: print(n, matte(n, f'out/{n}.png'))
