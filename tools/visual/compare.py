"""Controllo visivo: confronta due cartelle di schermate (prima/dopo) e dice quali sono cambiate e quanto.
Uso: python3 tools/visual/compare.py PRIMA DOPO [soglia%]   — crea DOPO/_diff/ con le differenze evidenziate in rosso."""
import os, sys
from PIL import Image, ImageChops

a, b = sys.argv[1], sys.argv[2]
limit = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
out = os.path.join(b, '_diff'); os.makedirs(out, exist_ok=True)
bad = 0
for name in sorted(f for f in os.listdir(a) if f.endswith('.jpg')):
    pb = os.path.join(b, name)
    if not os.path.exists(pb): print(f'MANCA   {name}'); bad += 1; continue
    x, y = Image.open(os.path.join(a, name)).convert('RGB'), Image.open(pb).convert('RGB')
    if x.size != y.size: print(f'MISURA  {name} {x.size} -> {y.size}'); bad += 1; continue
    d = ImageChops.difference(x, y).convert('L').point(lambda v: 255 if v > 40 else 0)
    pct = 100 * sum(d.histogram()[255:]) / (x.size[0] * x.size[1])
    flag = 'DIVERSA' if pct > limit else 'uguale '
    if pct > limit:
        bad += 1
        red = Image.new('RGB', x.size, (230, 30, 30))
        Image.composite(red, y.point(lambda v: v // 2 + 100), d).save(os.path.join(out, name), quality=80)
    print(f'{flag} {name:28s} {pct:6.2f}%')
print(f'\n{bad} schermate diverse su {len([f for f in os.listdir(a) if f.endswith(".jpg")])}')
