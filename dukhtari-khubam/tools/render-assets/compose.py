import sys, os
from PIL import Image, ImageChops
os.makedirs('final', exist_ok=True)
names = sys.argv[1].split(',')
# diamonds: combine colour with the mask as alpha
for n in names:
    p = f'out/{n}.png'
    img = Image.open(p).convert('RGBA')
    if os.path.exists(f'out/{n}.mask.png'):
        m = Image.open(f'out/{n}.mask.png').convert('L')
        img.putalpha(m)
    bbox = img.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox()
    if bbox:
        pad = 12
        bbox = (max(bbox[0]-pad,0), max(bbox[1]-pad,0), min(bbox[2]+pad,img.width), min(bbox[3]+pad,img.height))
        img = img.crop(bbox)
    img.save(f'final/{n}.png')
# contact sheet on the page colour
tiles = [Image.open(f'final/{n}.png') for n in names]
W = 300
sheet = Image.new('RGB', (W * 5, W * ((len(tiles) + 4) // 5)), (241, 238, 245))
for i, t in enumerate(tiles):
    t = t.copy(); t.thumbnail((W - 10, W - 10))
    x, y = (i % 5) * W + (W - t.width) // 2, (i // 5) * W + (W - t.height) // 2
    sheet.paste(t, (x, y), t)
sheet.save('final/sheet.jpg', quality=88)
print('ok', [Image.open(f'final/{n}.png').size for n in names])
