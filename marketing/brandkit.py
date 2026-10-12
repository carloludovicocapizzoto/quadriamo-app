"""Funzioni grafiche comuni dei contenuti social di Quadriamo (palette, font, logo, telefono, testo)."""
import os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots')
OUT = os.path.join(HERE, 'out')
FONTS = os.path.join(HERE, '..', 'public', 'fonts')
QR = os.path.join(HERE, '..', 'public', 'qr.svg')
SITE = 'carloludovicocapizzoto.github.io/quadriamo-app'
INK, CREAM, SURF, LINE = (31, 35, 40), (250, 247, 242), (255, 253, 249), (230, 223, 211)
ACCENT, B2, B3, B4, MUTED = (194, 65, 12), (232, 154, 108), (233, 201, 166), (138, 143, 152), (91, 96, 104)
BLOCKS = [(ACCENT, 13, 13, 20, 18), (B2, 36, 13, 15, 18), (B3, 13, 34, 20, 17), (B4, 36, 34, 15, 17)]


def serif(size):
    return ImageFont.truetype(os.path.join(FONTS, 'DMSerifDisplay-Regular.ttf'), size)


def sans(size, weight=400):
    f = ImageFont.truetype(os.path.join(FONTS, 'DMSans.ttf'), size)
    try:
        f.set_variation_by_axes([min(max(size * 0.75, 9), 40), weight])
    except Exception:
        pass
    return f


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
    """Telefono con la schermata (ritagliata) e ombra morbida."""
    s = Image.open(os.path.join(SHOTS, shot)).convert('RGB')
    if crop_h:
        s = s.crop((0, crop_top, s.width, min(s.height, crop_top + crop_h)))
    bezel = int(width * 0.045)
    sw = width - 2 * bezel
    sh = int(s.height * sw / s.width)
    s = s.resize((sw, sh), Image.LANCZOS)
    h = sh + 2 * bezel
    x, top = int(cx - width / 2), int(top)
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x + 10, top + 30, x + width + 10, top + h + 30], radius=int(width * 0.12), fill=(31, 35, 40, 70))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x, top, x + width, top + h], radius=int(width * 0.12), fill=INK)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=int(width * 0.09), fill=255)
    img.paste(s, (x + bezel, top + bezel), mask)
    return top + h


def canvas(w, h, bg=CREAM):
    img = Image.new('RGBA', (w, h), bg + (255,))
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([-w * 0.3, -h * 0.2, w * 0.6, h * 0.35], fill=ACCENT + (38,))
    g.ellipse([w * 0.5, h * 0.62, w * 1.3, h * 1.2], fill=B2 + (46,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.12)))
    return img


def rule_bar(img, x, y, w, h):
    d = ImageDraw.Draw(img)
    gap, cx = 8, x
    for share, col in ((55, ACCENT), (20, B2), (15, B3), (10, B4)):
        seg = (w - 3 * gap) * share / 100
        d.rounded_rectangle([cx, y, cx + seg, y + h], radius=h / 2, fill=col)
        cx += seg + gap


def eyebrow(img, x, y, text, color=ACCENT, anchor='la'):
    ImageDraw.Draw(img).text((x, y), text.upper(), font=sans(30, 700), fill=color, anchor=anchor)


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


