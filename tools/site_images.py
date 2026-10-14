"""Schermate dell'app per il sito: da marketing/site-shots.mjs (JPG 750x1624) a WebP leggeri in public/site/.
Uso: python3 tools/site_images.py <cartella delle schermate>"""
import os, sys
from PIL import Image

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'site')
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.endswith('.jpg'):
        continue
    im = Image.open(os.path.join(src, name)).convert('RGB')
    im = im.resize((540, round(im.height * 540 / im.width)), Image.LANCZOS)
    im.save(os.path.join(out, name.replace('.jpg', '.webp')), 'WEBP', quality=78, method=6)
print(len(os.listdir(out)), 'immagini in public/site')
