"""Funzioni grafiche comuni dei contenuti social di Quadriamo, con il design system dell'app (17/10/2026):
contenuti piatti e tipografici, Inter per il testo (il serif solo nel marchio), i quattro blocchi come tinte;
sfondi dinamici per sezione (luce diffusa SOLO sullo sfondo, come nell'app) e vetro discreto solo sulle superfici
protagoniste (glass). Niente ombre sui contenuti."""
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




# ---------- design 17/10: sfondi per sezione, vetro, schermate nuove (shots-campaign) ----------
CAMPAIGN_SHOTS = os.path.join(HERE, 'shots-campaign')
NIGHT, PAPER_D, SOFT = (14, 17, 22), (236, 233, 226), (205, 210, 216)
# i colori di sfondo delle sezioni, come src/design/backgrounds.css (tema scuro)
SECTION = {
    'home': ((13, 27, 38), (20, 58, 66)),        # blu notte e petrolio
    'analysis': ((20, 18, 46), (52, 34, 86)),    # indaco e viola scuro
    'invest': ((8, 26, 22), (14, 52, 44)),       # smeraldo scurissimo e petrolio
    'news': ((24, 26, 30), (46, 58, 70)),        # antracite e ghiaccio
    'profile': ((22, 24, 28), (38, 44, 54)),     # grafite e ardesia
}


def scene(w, h, section='home', light=False):
    """Lo sfondo di una sezione: un colore di base e una luce diffusa in alto a destra (come nell'app). Chiaro: crema tinta."""
    a, b = SECTION[section]
    if light:
        a, b = tuple(int(244 - (244 - c) * 0.06) for c in a), tuple(int(246 - (246 - c) * 0.16) for c in b)
    img = Image.new('RGB', (w, h), a)
    glow = Image.new('L', (w, h), 0)
    ImageDraw.Draw(glow).ellipse([w * 0.25, -h * 0.35, w * 1.45, h * 0.55], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.22))
    img.paste(Image.new('RGB', (w, h), b), (0, 0), glow)
    low = Image.new('L', (w, h), 0)
    ImageDraw.Draw(low).ellipse([-w * 0.5, h * 0.62, w * 0.7, h * 1.4], fill=150)
    img.paste(Image.new('RGB', (w, h), b), (0, 0), low.filter(ImageFilter.GaussianBlur(min(w, h) * 0.25)))
    return img.convert('RGBA')


def glass(img, box, radius=36, light=False):
    """Vetro discreto: lo sfondo sfocato dietro, un velo e un filo sottile. Solo per le superfici protagoniste."""
    x0, y0, x1, y1 = map(int, box)
    region = img.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(28))
    veil = Image.new('RGBA', region.size, (255, 255, 255, 150) if light else (255, 255, 255, 22))
    region = Image.alpha_composite(region.convert('RGBA'), veil)
    mask = Image.new('L', region.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, region.width - 1, region.height - 1], radius=radius, fill=255)
    img.paste(region, (x0, y0), mask)
    ImageDraw.Draw(img).rounded_rectangle([x0, y0, x1, y1], radius=radius, outline=(255, 255, 255, 40) if not light else (23, 24, 26, 26), width=2)


def device(img, shot, cx, top, width, theme='dark', crop=None, frame=(30, 31, 34)):
    """Telefono con una schermata di shots-campaign/<tema>/ (PNG 1125x2436). crop=(y0, y1) in proporzione 0–1."""
    s = Image.open(os.path.join(CAMPAIGN_SHOTS, theme, shot)).convert('RGB')
    if crop:
        s = s.crop((0, int(s.height * crop[0]), s.width, int(s.height * crop[1])))
    bezel = int(width * 0.035)
    sw = width - 2 * bezel
    sh = int(s.height * sw / s.width)
    s = s.resize((sw, sh), Image.LANCZOS)
    x, top = int(cx - width / 2), int(top)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x, top, x + width, top + sh + 2 * bezel], radius=int(width * 0.13), fill=frame)
    d.rounded_rectangle([x + 2, top + 2, x + width - 2, top + sh + 2 * bezel - 2], radius=int(width * 0.13) - 2, outline=(70, 72, 78), width=2)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=int(width * 0.105), fill=255)
    img.paste(s, (x + bezel, top + bezel), mask)
    return top + sh + 2 * bezel


def lockup(img, x, y, color=CREAM, size=44):
    """Marchio piccolo: i quattro quadrati e «Quadriamo.»"""
    mark(img, x, y - size * 1.05, size * 1.25)
    wordmark(img, x + size * 1.55, y, size, color=color, dot=(240, 122, 66))
