"""Funzioni grafiche comuni dei contenuti social di Quadriamo, con il design system dell'app (1.0):
carta e inchiostro, i quattro blocchi come uniche tinte, Inter per il testo (il serif solo nel marchio),
niente ombre, aloni o pillole: la profondità viene da spazio, tipografia e contrasto."""
import os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots')
OUT = os.path.join(HERE, 'out')
FONTS = os.path.join(HERE, '..', 'public', 'fonts')
QR = os.path.join(HERE, '..', 'public', 'qr.svg')
SITE = 'carloludovicocapizzoto.github.io/quadriamo-app'
# gli stessi valori di src/design/tokens.css
INK, CREAM, SURF, LINE, FILL = (23, 24, 26), (246, 244, 239), (246, 244, 239), (226, 223, 216), (234, 232, 226)
ACCENT, B2, B3, B4, MUTED = (194, 65, 12), (232, 145, 95), (217, 190, 154), (140, 143, 148), (107, 110, 115)
BLOCKS = [(ACCENT, 13, 13, 20, 18), (B2, 36, 13, 15, 18), (B3, 13, 34, 20, 17), (B4, 36, 34, 15, 17)]


def serif(size):
    return ImageFont.truetype(os.path.join(FONTS, 'DMSerifDisplay-Regular.ttf'), size)


def sans(size, weight=400):
    """Inter, come l'app: due pesi soli (400 testo, 600 titoli e numeri)."""
    f = ImageFont.truetype(os.path.join(FONTS, 'Inter-latin.woff2'), size)
    f.set_variation_by_axes([600 if weight >= 600 else 400])
    return f


def title(size):
    """Titoli: Inter 600 (il serif resta solo nel marchio). Un po' più piccolo del serif di prima, che era più stretto."""
    return sans(int(size * 0.82), 600)


def mark(img, x, y, side):
    d, k = ImageDraw.Draw(img), side / 64
    d.rounded_rectangle([x, y, x + side, y + side], radius=14 * k, fill=INK)
    for col, bx, by, bw, bh in BLOCKS:
        d.rounded_rectangle([x + bx * k, y + by * k, x + (bx + bw) * k, y + (by + bh) * k], radius=2 * k, fill=col)


def wordmark(img, x, y, size, color=INK, dot=ACCENT, anchor='ls'):
    d = ImageDraw.Draw(img)
    f = serif(size)
    w = d.textlength('Quadriamo', font=f)
    if anchor == 'ms':
        x -= (w + d.textlength('.', font=f)) / 2
    d.text((x, y), 'Quadriamo', font=f, fill=color, anchor='ls')
    d.text((x + w, y), '.', font=f, fill=dot, anchor='ls')


def wrap(d, text, font, width):
    lines, line = [], ''
    for word in text.split():
        t = (line + ' ' + word).strip()
        if d.textlength(t, font=font) <= width:
            line = t
        else:
            lines.append(line); line = word
    return lines + [line] if line else lines


def text_block(img, x, y, text, font, color, width, gap=1.18, anchor='la'):
    d = ImageDraw.Draw(img)
    for line in wrap(d, text, font, width):
        d.text((x, y), line, font=font, fill=color, anchor=anchor)
        y += font.size * gap
    return y


def phone(img, shot, cx, top, width, crop_top=0, crop_h=None):
    """Telefono con la schermata (ritagliata). Niente ombra: il telefono sta sulla superficie."""
    s = Image.open(os.path.join(SHOTS, shot)).convert('RGB')
    if crop_h:
        s = s.crop((0, crop_top, s.width, min(s.height, crop_top + crop_h)))
    bezel = int(width * 0.045)
    sw = width - 2 * bezel
    sh = int(s.height * sw / s.width)
    s = s.resize((sw, sh), Image.LANCZOS)
    h = sh + 2 * bezel
    x, top = int(cx - width / 2), int(top)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x, top, x + width, top + h], radius=int(width * 0.12), fill=INK)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=int(width * 0.09), fill=255)
    img.paste(s, (x + bezel, top + bezel), mask)
    return top + h


def canvas(w, h, bg=CREAM):
    """Carta piena, senza aloni."""
    return Image.new('RGBA', (w, h), bg + (255,))


def rule_bar(img, x, y, w, h):
    d = ImageDraw.Draw(img)
    gap, cx = 8, x
    for share, col in ((55, ACCENT), (20, B2), (15, B3), (10, B4)):
        seg = (w - 3 * gap) * share / 100
        d.rounded_rectangle([cx, y, cx + seg, y + h], radius=min(6, h / 4), fill=col)   # blocchi, non pillole
        cx += seg + gap


def eyebrow(img, x, y, text, color=MUTED, anchor='la'):
    """La riga sopra il titolo: in minuscolo e grigia, come i titoli di sezione dell'app."""
    ImageDraw.Draw(img).text((x, y), text, font=sans(32, 600), fill=color, anchor=anchor)


def button(img, cx, cy, w, h, text, fill=INK, color=CREAM, size=40):
    """L'azione: un blocco d'inchiostro (raggio dei controlli dell'app), non una pillola arancione."""
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=int(h * 0.22), fill=fill)
    d.text((cx, cy), text, font=sans(size, 600), fill=color, anchor='mm')


def check(img, cx, cy, r, color=INK):
    """Spunta d'inchiostro disegnata (il font dell'app non ha il simbolo ✓), senza cerchio colorato."""
    ImageDraw.Draw(img).line([(cx - r * .55, cy + r * .02), (cx - r * .15, cy + r * .42), (cx + r * .6, cy - r * .4)],
                             fill=color, width=max(4, int(r * .18)), joint='curve')


def footer(img, w, h, n=None, total=None):
    d = ImageDraw.Draw(img)
    mark(img, 60, h - 108, 52)
    wordmark(img, 128, h - 66, 40)
    if n:
        d.text((w - 60, h - 78), f'{n}/{total}', font=sans(30, 600), fill=MUTED, anchor='rm')


def save(img, name):
    path = os.path.join(OUT, name)
    img.convert('RGB').save(path, quality=93)
    print(path)
    return path


