"""Post a meme «Giorno 1 / 12 / 19 / 27» (ispirato a un formato molto condiviso, rifatto con i nostri contenuti), 2 slide 1080x1350:
  1. «Io ogni volta che arriva lo stipendio:» — quattro riquadri con le battute
  2. «Io, da quando uso Quadriamo:» — gli stessi giorni, con le schermate vere dell'app

Immagini della slide 1: se in marketing/meme/foto/ ci sono 1.jpg 2.jpg 3.jpg 4.jpg (foto TUE o con licenza libera, es.
Unsplash/Pexels), si usano quelle; altrimenti un'illustrazione con un'emoji. Mai foto di film o di campagne altrui.
Uso (dalla cartella quadriamo-app): <python con Pillow> marketing/make_meme.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps
from brandkit import CAMPAIGN_SHOTS, CREAM, FONTS, INK, OUT, lockup, sans, scene

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(HERE, 'meme', 'foto')
DST = os.path.join(OUT, 'meme')
os.makedirs(DST, exist_ok=True)
W, H = 1080, 1350
HIGHLIGHT, CAPTION = (232, 145, 95), (246, 178, 128)   # l'arancio chiaro delle parti, per l'evidenziatore e le battute
EMOJI = '/System/Library/Fonts/Apple Color Emoji.ttc'


def bold(size):
    """Inter più pesante del solito: i meme vivono di titoli forti."""
    f = ImageFont.truetype(os.path.join(FONTS, 'Inter-latin.woff2'), size)
    f.set_variation_by_axes([780])
    return f


def paper():
    """Carta crema con una griglia leggerissima (da quaderno)."""
    img = Image.new('RGBA', (W, H), CREAM + (255,))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 54):
        d.line([(x, 0), (x, H)], fill=(232, 229, 222), width=1)
    for y in range(0, H, 54):
        d.line([(0, y), (W, y)], fill=(232, 229, 222), width=1)
    return img


def heading(img, line1, line2):
    d = ImageDraw.Draw(img)
    f = bold(78)
    d.text((54, 175), line1, font=f, fill=INK)
    w = d.textlength(line2, font=f)
    d.rectangle([46, 270, 54 + w + 12, 346], fill=HIGHLIGHT)
    d.text((54, 262), line2, font=f, fill=INK)
    lockup(img, W - 300, 110, color=INK, size=34)


def boxed(img, cx, y, text, font, fill, color, width, pad=14, anchor_bottom=False):
    """Testo su un riquadro nero, riga per riga (come le didascalie dei meme)."""
    d = ImageDraw.Draw(img)
    lines, line = [], ''
    for w_ in text.split(' '):   # solo lo spazio normale: lo spazio unificatore (\u00a0) tiene insieme numero e €
        t = (line + ' ' + w_).strip()
        if d.textlength(t, font=font) <= width:
            line = t
        else:
            lines.append(line); line = w_
    lines.append(line)
    lh = int(font.size * 1.12)
    y0 = y - len(lines) * lh - pad * 2 if anchor_bottom else y
    for i, ln in enumerate(lines):
        tw = d.textlength(ln, font=font)
        yy = y0 + i * lh
        d.rectangle([cx - tw / 2 - pad, yy, cx + tw / 2 + pad, yy + lh + pad * (2 if i == len(lines) - 1 else 1)], fill=fill)
    for i, ln in enumerate(lines):
        d.text((cx, y0 + pad / 2 + i * lh + lh / 2 + 2), ln, font=font, fill=color, anchor='mm')


def panel_emoji(size, emoji, section):
    img = scene(size[0], size[1], section, light=True).convert('RGBA')
    try:
        f = ImageFont.truetype(EMOJI, 160)
        layer = Image.new('RGBA', (220, 220), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((110, 110), emoji, font=f, embedded_color=True, anchor='mm')
        layer = layer.resize((300, 300), Image.LANCZOS)
        img.alpha_composite(layer, (size[0] // 2 - 150, size[1] // 2 - 170))
    except OSError:
        ImageDraw.Draw(img).text((size[0] / 2, size[1] / 2), emoji, font=sans(120), fill=INK, anchor='mm')
    return img


def panel_shot(size, shot, y0, y1, theme='light'):
    """Un riquadro con un pezzo di schermata dell'app (y0–y1 in proporzione), riempito senza deformare."""
    s = Image.open(os.path.join(CAMPAIGN_SHOTS, theme, shot)).convert('RGB')
    s = s.crop((0, int(s.height * y0), s.width, int(s.height * y1)))
    return ImageOps.fit(s, size, Image.LANCZOS, centering=(0.5, 0.0)).convert('RGBA')


def grid(img, panels, captions):
    pw, ph, gap, top = 513, 428, 18, 396
    for k, (p, (day, cap)) in enumerate(zip(panels, captions)):
        x, y = 18 + (k % 2) * (pw + gap), top + (k // 2) * (ph + gap)
        img.paste(p, (x, y), p)
        boxed(img, x + pw / 2, y + 24, f'GIORNO {day}', bold(34), INK, (255, 255, 255), 400, pad=10)
        boxed(img, x + pw / 2, y + ph - 22, cap, bold(32), INK, CAPTION, pw - 40, pad=10, anchor_bottom=True)


DAYS = [1, 12, 19, 27]
# slide 1: il problema (senza Quadriamo)
img = paper()
heading(img, 'Io ogni volta che', 'arriva lo stipendio:')
caps = ['«quest’anno metto da parte, giuro»', '«stasera esco, ma solo una birra»',
        '«chi ha attivato 9 abbonamenti a mio nome?»', '«mamma, da 1 a 50\u00a0€ quanto mi vuoi bene?»']
emojis = [('💸', 'home'), ('🍻', 'profile'), ('📺', 'analysis'), ('📞', 'news')]
panels = []
for k, (e, sec) in enumerate(emojis, 1):
    photo = os.path.join(PHOTOS, f'{k}.jpg')
    panels.append(ImageOps.fit(Image.open(photo).convert('RGB'), (513, 428), Image.LANCZOS).convert('RGBA') if os.path.exists(photo)
                  else panel_emoji((513, 428), e, sec))
grid(img, panels, list(zip(DAYS, caps)))
d = ImageDraw.Draw(img)
d.text((W - 54, H - 30), 'Scorri ›', font=sans(30, 600), fill=INK, anchor='rs')
img.convert('RGB').save(os.path.join(DST, '01-stipendio.jpg'), quality=93)

# slide 2: la risposta (con Quadriamo, schermate vere)
img = paper()
heading(img, 'Io, da quando uso', 'Quadriamo:')
caps = ['«36,97\u00a0€ al giorno. Fine dei dubbi.»', '«la birra ci sta: è già nel budget»',
        '«Netflix +38%. Visto in tempo.»', '«avanzano 193\u00a0€ a fine mese»']
panels = [panel_shot((513, 428), '01-home.png', 0.0, 0.42), panel_shot((513, 428), '02-home-widgets.png', 0.33, 0.69),
          panel_shot((513, 428), '10-subscriptions.png', 0.34, 0.7), panel_shot((513, 428), '04-calendar.png', 0.08, 0.45)]
grid(img, panels, list(zip(DAYS, caps)))
d = ImageDraw.Draw(img)
d.text((W - 54, H - 30), 'Gratis in beta · link in bio', font=sans(30, 600), fill=INK, anchor='rs')
img.convert('RGB').save(os.path.join(DST, '02-con-quadriamo.jpg'), quality=93)
print(DST)
