"""Turns the painted halves (species.cjs) into the app's sprites and a preview sheet."""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '..', 'public', 'assets', '3d')
preview = sys.argv[1] if len(sys.argv) > 1 else None
sheet = Image.new('RGBA', (3 * 460, 420), (233, 224, 250, 255))
for i, s in enumerate(['morpho', 'rose', 'pearl']):
    wing = Image.open(os.path.join(HERE, f'{s}-wing.png')).convert('RGBA')
    body = Image.open(os.path.join(HERE, f'{s}-body.png')).convert('RGBA')
    r = wing.resize((192, 208), Image.LANCZOS)
    r.save(os.path.join(OUT, f'butterfly-{s}-wing-r.webp'), quality=90, method=6)
    r.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(OUT, f'butterfly-{s}-wing-l.webp'), quality=90, method=6)
    body.resize((48, 114), Image.LANCZOS).save(os.path.join(OUT, f'butterfly-{s}-body.webp'), quality=90, method=6)
    if preview:
        # open butterfly at 2× the 192 px sprite: wings meet at the body axis
        big = wing.resize((210, 228), Image.LANCZOS)
        x0 = i * 460 + 230
        sheet.alpha_composite(big, (x0, 40))
        sheet.alpha_composite(big.transpose(Image.FLIP_LEFT_RIGHT), (x0 - 210, 40))
        bb = body.resize((52, 124), Image.LANCZOS)
        sheet.alpha_composite(bb, (x0 - 26, 40 + int(228 * 300 / 760) - 70))
if preview:
    sheet.save(preview)
