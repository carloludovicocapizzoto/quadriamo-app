"""Logo di Quadriamo come file veri: icona (quattro blocchi 55-20-15-10), scritta "Quadriamo." e logo completo,
in versione chiara e scura, in SVG e PDF vettoriali (le lettere sono tracciati: non serve il font) e PNG.

Uso (dalla cartella quadriamo-app):  python3 brand/make_logo.py
Richiede: fonttools e Pillow  (pip install fonttools pillow)
"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'public', 'fonts', 'DMSerifDisplay-Regular.ttf')
OUT = HERE
INK, CREAM, ACCENT, ACCENT_DARK = '#1F2328', '#FAF7F2', '#C2410C', '#F07A42'
BLOCKS = [('#C2410C', 13, 13, 20, 18), ('#E89A6C', 36, 13, 15, 18), ('#E9C9A6', 13, 34, 20, 17), ('#8A8F98', 36, 34, 15, 17)]
font = TTFont(FONT)
glyphs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font['hmtx']
UPM = font['head'].unitsPerEm


def rgb(hexc):
    return tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5))


# ---------- scritta: lettere come tracciati ----------
def text_runs(word='Quadriamo', dot='.'):
    """[(nome glifo, x in unità del font, è il punto)]; larghezza totale."""
    runs, x = [], 0
    for ch in word + dot:
        g = cmap[ord(ch)]
        runs.append((g, x, ch == dot))
        x += hmtx[g][0]
    return runs, x


class PDFPen(BasePen):
    """Scrive gli operatori di disegno PDF (coordinate con y verso l'alto, come nel font)."""
    def __init__(self, glyphset, ops):
        super().__init__(glyphset)
        self.ops = ops

    def _moveTo(self, p): self.ops.append(f'{p[0]:.2f} {p[1]:.2f} m')
    def _lineTo(self, p): self.ops.append(f'{p[0]:.2f} {p[1]:.2f} l')
    def _curveToOne(self, a, b, c): self.ops.append(f'{a[0]:.2f} {a[1]:.2f} {b[0]:.2f} {b[1]:.2f} {c[0]:.2f} {c[1]:.2f} c')
    def _closePath(self): self.ops.append('h')


def rounded_rect_pdf(x, y, w, h, r):
    k = 0.5523 * r
    return [f'{x + r:.2f} {y:.2f} m', f'{x + w - r:.2f} {y:.2f} l', f'{x + w - r + k:.2f} {y:.2f} {x + w:.2f} {y + r - k:.2f} {x + w:.2f} {y + r:.2f} c',
            f'{x + w:.2f} {y + h - r:.2f} l', f'{x + w:.2f} {y + h - r + k:.2f} {x + w - r + k:.2f} {y + h:.2f} {x + w - r:.2f} {y + h:.2f} c',
            f'{x + r:.2f} {y + h:.2f} l', f'{x + r - k:.2f} {y + h:.2f} {x:.2f} {y + h - r + k:.2f} {x:.2f} {y + h - r:.2f} c',
            f'{x:.2f} {y + r:.2f} l', f'{x:.2f} {y + r - k:.2f} {x + r - k:.2f} {y:.2f} {x + r:.2f} {y:.2f} c', 'h']


def write_pdf(path, w, h, ops):
    stream = '\n'.join(ops).encode()
    objs = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w:.2f} {h:.2f}] /Contents 4 0 R >>'.encode(),
            b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream']
    out, offs = bytearray(b'%PDF-1.4\n'), []
    for i, o in enumerate(objs, 1):
        offs.append(len(out)); out += f'{i} 0 obj\n'.encode() + o + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode() + b''.join(f'{o:010d} 00000 n \n'.encode() for o in offs)
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    open(path, 'wb').write(out)


def fill_pdf(hexc):
    r, g, b = rgb(hexc)
    return f'{r / 255:.4f} {g / 255:.4f} {b / 255:.4f} rg'


# ---------- composizioni ----------
def build(kind, dark):
    """Restituisce (larghezza, altezza, elementi SVG, operatori PDF). Le misure sono in punti/pixel a 1x."""
    text_col = CREAM if dark else INK
    dot_col = ACCENT_DARK if dark else ACCENT
    H = 100                                   # altezza dell'icona
    size = 84                                 # corpo della scritta
    s = size / UPM
    runs, adv = text_runs()
    text_w = adv * s
    pad = 8
    if kind == 'mark':
        W, Ht = 64, 64
    elif kind == 'wordmark':
        W, Ht = text_w + 2 * pad, size * 1.05 + 2 * pad
    else:
        W, Ht = H + 28 + text_w + pad, H
    svg, pdf = [], []

    def mark(x0, y0, side):             # y0 = alto (coordinate SVG)
        k = side / 64
        svg.append(f'<rect x="{x0:.2f}" y="{y0:.2f}" width="{side:.2f}" height="{side:.2f}" rx="{14 * k:.2f}" fill="{INK}"/>')
        pdf.append(fill_pdf(INK)); pdf.extend(rounded_rect_pdf(x0, Ht - y0 - side, side, side, 14 * k)); pdf.append('f')
        for col, bx, by, bw, bh in BLOCKS:
            svg.append(f'<rect x="{x0 + bx * k:.2f}" y="{y0 + by * k:.2f}" width="{bw * k:.2f}" height="{bh * k:.2f}" rx="{2 * k:.2f}" fill="{col}"/>')
            pdf.append(fill_pdf(col)); pdf.extend(rounded_rect_pdf(x0 + bx * k, Ht - (y0 + by * k) - bh * k, bw * k, bh * k, 2 * k)); pdf.append('f')

    def word(x0, baseline):             # baseline in coordinate SVG (dall'alto)
        for g, gx, is_dot in runs:
            col = dot_col if is_dot else text_col
            sp = SVGPathPen(glyphs)
            glyphs[g].draw(TransformPen(sp, (s, 0, 0, -s, x0 + gx * s, baseline)))
            svg.append(f'<path d="{sp.getCommands()}" fill="{col}"/>')
            pdf.append(fill_pdf(col))
            glyphs[g].draw(TransformPen(PDFPen(glyphs, pdf), (s, 0, 0, s, x0 + gx * s, Ht - baseline)))
            pdf.append('f')

    if kind == 'mark':
        mark(0, 0, 64)
    elif kind == 'wordmark':
        word(pad, pad + size * 0.80)
    else:
        mark(0, 0, H)
        word(H + 28, H * 0.74)
    return W, Ht, svg, pdf


def png(kind, dark, path, scale=8):
    """PNG ad alta risoluzione disegnato con Pillow (stesse misure dell'SVG)."""
    W, Ht, _, _ = build(kind, dark)
    img = Image.new('RGBA', (round(W * scale), round(Ht * scale)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    def mark(x0, y0, side):
        k = side / 64 * scale
        d.rounded_rectangle([x0 * scale, y0 * scale, x0 * scale + 64 * k, y0 * scale + 64 * k], radius=14 * k, fill=INK)
        for col, bx, by, bw, bh in BLOCKS:
            d.rounded_rectangle([x0 * scale + bx * k, y0 * scale + by * k, x0 * scale + (bx + bw) * k, y0 * scale + (by + bh) * k], radius=2 * k, fill=col)
    def word(x0, baseline):
        f = ImageFont.truetype(FONT, round(84 * scale))
        d.text((x0 * scale, baseline * scale), 'Quadriamo', font=f, fill=CREAM if dark else INK, anchor='ls')
        w = d.textlength('Quadriamo', font=f)
        d.text((x0 * scale + w, baseline * scale), '.', font=f, fill=ACCENT_DARK if dark else ACCENT, anchor='ls')
    if kind == 'mark':
        mark(0, 0, 64)
    elif kind == 'wordmark':
        word(8, 8 + 84 * 0.80)
    else:
        mark(0, 0, 100)
        word(128, 100 * 0.74)
    img.save(path)


for kind in ('mark', 'wordmark', 'logo'):
    for dark in ((False, True) if kind != 'mark' else (False,)):
        name = f'quadriamo-{kind}' + ('-dark' if dark else '')
        W, Ht, svg, pdf = build(kind, dark)
        open(os.path.join(OUT, name + '.svg'), 'w').write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {Ht:.2f}" width="{W:.0f}" height="{Ht:.0f}">'
            f'<title>Quadriamo</title>{"".join(svg)}</svg>\n')
        write_pdf(os.path.join(OUT, name + '.pdf'), W, Ht, pdf)
        png(kind, dark, os.path.join(OUT, name + '.png'))
        print(name)
