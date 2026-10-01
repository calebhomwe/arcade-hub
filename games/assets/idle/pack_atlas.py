#!/usr/bin/env python3
"""Pack rendered sprites (PNG, RGBA, ground centre = image centre) into one WebP atlas plus a JSON map.

    python3 pack_atlas.py <dir with PNGs> <out basename> [--scale 0.9] [--width 2048] [--names a,b,c]

The map is {name: [x, y, w, h, anchorX, anchorY]} where the anchor is where the model's footprint centre sits inside the trimmed
sprite, and "__size" is the atlas size. Faint alpha left by the shadow catcher is cleaned first so sprites trim tightly.
The PNGs come from the isometric Blender renderer described in RENDER.md (a golden-hour sun, cast shadows baked in)."""
import json, os, sys
import numpy as np
from PIL import Image

def clean(im):
    a = np.array(im)
    al = a[..., 3].astype(np.float32)
    al = np.clip((al - 7.0) * (255.0 / 248.0), 0, 255)
    al[al < 6] = 0
    a[..., 3] = al.astype(np.uint8)
    a[a[..., 3] == 0, :3] = 0
    return Image.fromarray(a)

def main():
    src, out = sys.argv[1], sys.argv[2]
    scale = float(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 1.0
    width = int(sys.argv[sys.argv.index('--width') + 1]) if '--width' in sys.argv else 2048
    names = sys.argv[sys.argv.index('--names') + 1].split(',') if '--names' in sys.argv else None
    items = []
    for f in sorted(os.listdir(src)):
        if not f.endswith('.png'): continue
        n = f[:-4]
        if names and n not in names: continue
        im = clean(Image.open(os.path.join(src, f)).convert('RGBA'))
        W, H = im.size
        bb = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
        if not bb: continue
        x0, y0, x1, y1 = max(0, bb[0] - 2), max(0, bb[1] - 2), min(W, bb[2] + 2), min(H, bb[3] + 2)
        cr = im.crop((x0, y0, x1, y1))
        ax, ay = W / 2 - x0, H / 2 - y0
        if scale != 1.0:
            cr = cr.resize((max(1, round(cr.width * scale)), max(1, round(cr.height * scale))), Image.LANCZOS); ax *= scale; ay *= scale
        items.append((n, cr, ax, ay))
    items.sort(key=lambda t: -t[1].height)
    x = y = rowh = 0; pos = {}
    for n, cr, ax, ay in items:
        if x + cr.width + 2 > width: x = 0; y += rowh + 2; rowh = 0
        pos[n] = (x, y); x += cr.width + 2; rowh = max(rowh, cr.height)
    H = y + rowh + 2
    atlas = Image.new('RGBA', (width, H), (0, 0, 0, 0))
    m = {}
    for n, cr, ax, ay in items:
        px, py = pos[n]; atlas.alpha_composite(cr, (px, py))
        m[n] = [px, py, cr.width, cr.height, round(ax, 1), round(ay, 1)]
    m['__size'] = [width, H]
    atlas.save(out + '.webp', 'WEBP', quality=86, alpha_quality=92, method=5)
    json.dump(m, open(out + '.json', 'w'), separators=(',', ':'))
    key = os.path.basename(out)
    open(out + '.js', 'w').write('window.IK_ATLAS=window.IK_ATLAS||{};window.IK_ATLAS["' + key + '"]=' + json.dumps(m, separators=(',', ':')) + ';\n')
    print(out, len(items), 'sprites', width, 'x', H, os.path.getsize(out + '.webp') // 1024, 'KB')

main()
