"""PNG screenshots (shots.spec.ts) -> the small WebP pictures the app ships: python3 tools/ai-screens/webp.py [IN] [OUT]"""
import pathlib
import sys

from PIL import Image

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/ai-screens')
dst = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'public/assets/ai-screens')
dst.mkdir(parents=True, exist_ok=True)
WIDTH = 540
for png in sorted(src.glob('*.png')):
    im = Image.open(png).convert('RGB')
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    out = dst / f'{png.stem}.webp'
    im.save(out, 'WEBP', quality=70, method=6)
    print(out, out.stat().st_size)
