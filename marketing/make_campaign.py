"""Campagna social dell'app Quadriamo (beta): carosello Instagram 1080x1350, storie 1080x1920, pin Pinterest 1000x1500
e due reel 1080x1920 con la voce narrante (voice.py); la musica, se vuoi, si aggiunge in Instagram/TikTok/CapCut.

Le schermate in marketing/shots/ sono fatte con i DATI DI ESEMPIO dell'app (nessun dato reale).
Uso (dalla cartella quadriamo-app):  <python con kokoro-onnx> marketing/make_campaign.py
Richiede Pillow, ffmpeg, kokoro-onnx e soundfile (python3 -m venv .venv && .venv/bin/pip install pillow kokoro-onnx soundfile).
"""
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
for d in ('instagram', 'stories', 'pinterest', 'video'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


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


# ---------- Carosello Instagram 1080x1350 ----------
W, H, T = 1080, 1350, 7
slides = []

img = canvas(W, H)
mark(img, 60, 70, 84)
ImageDraw.Draw(img).text((60, 205), 'BUDGET PERSONALE', font=sans(28, 700), fill=ACCENT)
d = ImageDraw.Draw(img)
d.text((60, 250), 'I tuoi soldi,', font=serif(104), fill=INK)
d.text((60, 360), 'in quattro.', font=serif(104), fill=ACCENT)
text_block(img, 60, 500, 'Dividi lo stipendio in 4 parti e sai sempre quanto puoi ancora spendere.', sans(38), MUTED, 520)
phone(img, '11-home.jpg', 830, 150, 450)
ImageDraw.Draw(img).rounded_rectangle([60, 700, 360, 770], radius=35, fill=ACCENT)
ImageDraw.Draw(img).text((210, 735), 'Beta gratuita', font=sans(32, 700), fill=(255, 255, 255), anchor='mm')
d.text((60, 1150), 'Scorri →', font=sans(36, 700), fill=INK)
footer(img, W, H, 1, T)
slides.append(save(img, 'instagram/01-copertina.jpg'))

img = canvas(W, H)
eyebrow(img, 60, 90, 'Il metodo')
y = text_block(img, 60, 150, 'Ogni euro ha un compito', serif(92), INK, 960)
text_block(img, 60, y + 20, 'Quando arriva lo stipendio, Quadriamo toglie l’affitto e divide il resto in quattro parti. La regola la puoi cambiare quando vuoi.', sans(36), MUTED, 940)
rule_bar(img, 60, 520, 960, 26)
rows = [('55%', 'Essenziali', 'Spesa, bollette, trasporti', ACCENT), ('20%', 'Qualità della vita', 'Uscite, hobby, viaggi, regali', B2),
        ('15%', 'Fondo di sicurezza', 'Il cuscinetto per gli imprevisti', B3), ('10%', 'Investimenti', 'Il tuo futuro: ETF, PAC', B4)]
d = ImageDraw.Draw(img)
for i, (p, n, s_, col) in enumerate(rows):
    y0 = 600 + i * 150
    d.rounded_rectangle([60, y0, 1020, y0 + 128], radius=24, fill=SURF, outline=LINE, width=2)
    d.text((100, y0 + 64), p, font=serif(64), fill=col if col != B3 else (200, 160, 110), anchor='lm')
    d.text((290, y0 + 44), n, font=sans(38, 700), fill=INK, anchor='lm')
    d.text((290, y0 + 90), s_, font=sans(30), fill=MUTED, anchor='lm')
footer(img, W, H, 2, T)
slides.append(save(img, 'instagram/02-metodo.jpg'))


def feature(n, ey, title, body, shot, crop_top=0, crop_h=None, name=''):
    img = canvas(W, H)
    eyebrow(img, 60, 90, ey)
    y = text_block(img, 60, 150, title, serif(76), INK, 450)
    text_block(img, 60, y + 24, body, sans(33), MUTED, 440)
    phone(img, shot, 785, 110, 510, crop_top, crop_h)
    footer(img, W, H, n, T)
    return save(img, f'instagram/{n:02d}-{name}.jpg')


slides.append(feature(3, 'Ogni giorno', 'Sai quanto puoi ancora spendere', 'Un numero chiaro al giorno per ogni parte, tenendo già da parte le bollette in arrivo.', '11-home.jpg', 0, 1500, 'oggi'))
slides.append(feature(4, 'A colpo d’occhio', 'Il tuo mese in un grafico', 'Tocca una parte della ciambella: vedi quanto ti resta e quanto hai già usato. Sotto, le spese giorno per giorno.', '13-month.jpg', 0, 1500, 'grafici'))
slides.append(feature(5, 'Veloce', 'Una spesa in 5 secondi', 'Importo, categoria, fatto. Oppure importi l’estratto conto e le regole smistano tutto da sole.', '16-add.jpg', 205, 1419, 'spesa'))

img = canvas(W, H)
eyebrow(img, 60, 90, 'Privacy')
y = text_block(img, 60, 150, 'I tuoi soldi sono affari tuoi', serif(92), INK, 960)
d = ImageDraw.Draw(img)
points = ['Funziona anche senza account: i dati restano sul telefono', 'Server nell’Unione europea, connessioni cifrate',
          'Entrate e investimenti li vedi solo tu', 'Niente pubblicità, niente vendita di dati', 'Esporti o cancelli tutto quando vuoi']
for i, p in enumerate(points):
    y0 = 470 + i * 140
    d.ellipse([60, y0, 124, y0 + 64], fill=ACCENT)
    d.text((92, y0 + 32), '✓', font=sans(36, 700), fill=(255, 255, 255), anchor='mm')
    text_block(img, 156, y0 + 6, p, sans(38, 600), INK, 860)
footer(img, W, H, 6, T)
slides.append(save(img, 'instagram/06-privacy.jpg'))

img = Image.new('RGBA', (W, H), INK + (255,))
mark(img, W / 2 - 70, 150, 140)
wordmark(img, W / 2, 440, 110, color=CREAM, dot=(240, 122, 66), anchor='ms')
d = ImageDraw.Draw(img)
d.text((W / 2, 530), 'Gratis durante la beta', font=sans(44, 700), fill=CREAM, anchor='mm')
text_block(img, W / 2, 600, 'Si installa dal browser in un minuto: iPhone, Android, Mac e Windows. Niente App Store.', sans(36), (210, 205, 198), 760, anchor='ma')
d.rounded_rectangle([W / 2 - 300, 800, W / 2 + 300, 900], radius=50, fill=ACCENT)
d.text((W / 2, 850), 'Link nella bio →', font=sans(42, 700), fill=(255, 255, 255), anchor='mm')
d.text((W / 2, 980), SITE, font=sans(30), fill=(180, 175, 168), anchor='mm')
rule_bar(img, W / 2 - 240, 1110, 480, 16)
d.text((W - 60, H - 78), f'{T}/{T}', font=sans(30, 600), fill=(150, 150, 150), anchor='rm')
slides.append(save(img, 'instagram/07-scarica.jpg'))

# ---------- Storie 1080x1920 ----------
W2, H2 = 1080, 1920
stories = []
img = canvas(W2, H2)
mark(img, W2 / 2 - 80, 260, 160)
wordmark(img, W2 / 2, 620, 130, anchor='ms')
d = ImageDraw.Draw(img)
d.text((W2 / 2, 720), 'I tuoi soldi, in quattro.', font=serif(70), fill=INK, anchor='mm')
text_block(img, W2 / 2, 800, 'Dividi lo stipendio in 4 parti e sai sempre quanto puoi ancora spendere.', sans(42), MUTED, 820, anchor='ma')
rule_bar(img, W2 / 2 - 330, 1000, 660, 22)
phone(img, '10-welcome.jpg', W2 / 2, 1100, 520, 300, 1000)
stories.append(save(img, 'stories/01-intro.jpg'))

img = canvas(W2, H2)
eyebrow(img, W2 / 2, 200, 'Ogni giorno', anchor='ma')
text_block(img, W2 / 2, 260, 'Quanto puoi ancora spendere oggi?', serif(96), INK, 900, anchor='ma')
phone(img, '11-home.jpg', W2 / 2, 560, 640, 0, 1300)
stories.append(save(img, 'stories/02-oggi.jpg'))

img = Image.new('RGBA', (W2, H2), INK + (255,))
mark(img, W2 / 2 - 90, 420, 180)
wordmark(img, W2 / 2, 800, 130, color=CREAM, dot=(240, 122, 66), anchor='ms')
d = ImageDraw.Draw(img)
d.text((W2 / 2, 900), 'Gratis durante la beta', font=sans(52, 700), fill=CREAM, anchor='mm')
text_block(img, W2 / 2, 980, 'iPhone · Android · Mac · Windows', sans(42), (210, 205, 198), 900, anchor='ma')
d.rounded_rectangle([W2 / 2 - 340, 1180, W2 / 2 + 340, 1300], radius=60, fill=ACCENT)
d.text((W2 / 2, 1240), 'Scarica dal link ↑', font=sans(48, 700), fill=(255, 255, 255), anchor='mm')
rule_bar(img, W2 / 2 - 300, 1480, 600, 18)
stories.append(save(img, 'stories/03-scarica.jpg'))

# ---------- Pinterest 1000x1500 ----------
W3, H3 = 1000, 1500
for i, (title, body, shot, ct, ch, name) in enumerate([
        ('Il metodo 55-20-15-10 per gestire lo stipendio', 'Essenziali, qualità della vita, fondo di sicurezza, investimenti: ogni euro ha un compito.', '11-home.jpg', 0, 1490, 'metodo'),
        ('Sai sempre quanto puoi spendere oggi', 'Un numero al giorno per ogni parte del budget, con le bollette già tenute da parte.', '11-home.jpg', 0, 1260, 'oggi'),
        ('Registra una spesa in 5 secondi', 'Importo, categoria, fatto. Oppure importa l’estratto conto della banca.', '16-add.jpg', 205, 1419, 'spesa')], 1):
    img = canvas(W3, H3)
    y = text_block(img, 70, 90, title, serif(76), INK, 860)
    y = text_block(img, 70, y + 16, body, sans(34), MUTED, 860)
    phone(img, shot, W3 / 2, y + 40, 520, ct, ch)
    d = ImageDraw.Draw(img)
    d.rectangle([0, H3 - 150, W3, H3], fill=INK)
    mark(img, 70, H3 - 118, 86)
    wordmark(img, 180, H3 - 52, 58, color=CREAM, dot=(240, 122, 66))
    d.text((W3 - 70, H3 - 75), 'Gratis · beta', font=sans(32, 700), fill=CREAM, anchor='rm')
    save(img, f'pinterest/{i:02d}-{name}.jpg')

# ---------- Reel con la voce narrante (1080x1920): ogni scena dura quanto la sua frase ----------
FPS = 30
WORK = os.path.join(OUT, 'video', '_work')
os.makedirs(WORK, exist_ok=True)


def clip(src, seconds, out, w=1080, h=1920):
    frames = int(seconds * FPS)
    vf = (f"scale={w * 2}:{h * 2},zoompan=z='min(1+0.0008*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={FPS},"
          f"fade=t=in:st=0:d=0.3,fade=t=out:st={seconds - 0.3:.2f}:d=0.3,format=yuv420p")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', src, '-vf', vf, '-t', str(seconds), '-r', str(FPS),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-an', out], check=True)
    return out


def pad_story(src, name):
    """Una slide 1080x1350 dentro un fotogramma verticale 1080x1920."""
    im = Image.open(src).convert('RGB')
    bg = canvas(1080, 1920).convert('RGB')
    bg.paste(im, (0, 285))
    p = os.path.join(WORK, name)
    bg.save(p, quality=95)
    return p




from voice import narrated_reel
# reel 1: storia completa (intro, oggi, grafici, spesa, scarica)
narrated_reel([(stories[0], 'Quadriamo. I tuoi soldi, in quattro.'),
               (stories[1], 'Ogni giorno sai quanto puoi ancora spendere.'),
               (pad_story(slides[3], 'g.jpg'), 'E vedi il tuo mese in un grafico.'),
               (pad_story(slides[4], 's.jpg'), 'Una spesa si segna in cinque secondi.'),
               (stories[2], 'È gratis durante la beta. Il link è nella bio.')],
              os.path.join(OUT, 'video', 'reel-01-quadriamo.mp4'), os.path.join(WORK, 'r1'), clip)
# reel 2: il metodo (metodo, oggi, privacy, scarica)
narrated_reel([(pad_story(slides[1], 'm.jpg'), 'Cinquantacinque, venti, quindici, dieci: ogni euro ha un compito, fino a fine mese.'),
               (stories[1], 'I conti li fa l’app: ogni giorno sai quanto puoi spendere.'),
               (pad_story(slides[5], 'p.jpg'), 'E i tuoi soldi restano affari tuoi.'),
               (stories[2], 'Gratis durante la beta. Link nella bio.')],
              os.path.join(OUT, 'video', 'reel-02-metodo.mp4'), os.path.join(WORK, 'r2'), clip)
