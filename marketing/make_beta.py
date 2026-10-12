"""Contenuti social per lanciare la BETA di Quadriamo, costruiti sul posizionamento:
"oggi puoi spendere", lo stipendio diviso da solo in quattro parti, la previsione di fine mese, lo slancio, la privacy.

Escono in marketing/out/beta/: 6 post 1080x1350 (carosello o post singoli), 6 storie 1080x1920 e un reel da 18 secondi.
Le schermate (marketing/shots/1*.jpg) sono fatte con i DATI DI ESEMPIO dell'app: node marketing/shoot.mjs
Uso (dalla cartella quadriamo-app):  python3 marketing/make_beta.py      Richiede Pillow e ffmpeg.
"""
import os, subprocess
from PIL import Image, ImageDraw, ImageFilter
from brandkit import (ACCENT, B2, B3, B4, CREAM, INK, LINE, MUTED, OUT, SHOTS, SITE, SURF, canvas, eyebrow, mark, phone,
                      rule_bar, sans, serif, text_block, wordmark)

DST = os.path.join(OUT, 'beta')
WORK = os.path.join(DST, '_work')
os.makedirs(WORK, exist_ok=True)
WHITE, SOFT = (255, 255, 255), (210, 205, 198)


def save(img, name):
    p = os.path.join(DST, name)
    img.convert('RGB').save(p, quality=93)
    print(p)
    return p


def shadow(img, box, radius, blur=30, alpha=60, dy=24):
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    ImageDraw.Draw(sh).rounded_rectangle([x0 + 6, y0 + dy, x1 + 6, y1 + dy], radius=radius, fill=(31, 35, 40, alpha))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))


def card_from_shot(img, shot, box, x, y, width):
    """Una card dell'app ritagliata dalla schermata e ingrandita, con ombra: il dettaglio diventa il protagonista."""
    x, y = int(x), int(y)
    s = Image.open(os.path.join(SHOTS, shot)).convert('RGB').crop(box)
    h = int(s.height * width / s.width)
    s = s.resize((width, h), Image.LANCZOS)
    r = int(width * 0.05)
    shadow(img, (x, y, x + width, y + h), r)
    m = Image.new('L', s.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s.width - 1, s.height - 1], radius=r, fill=255)
    img.paste(s, (x, y), m)
    return y + h


def notification(img, x, y, w, title, body, when='ora'):
    x, y = int(x), int(y)
    """Notifica come sulla schermata di blocco dell'iPhone (disegnata, non una foto)."""
    h = 210
    shadow(img, (x, y, x + w, y + h), 44, blur=26, alpha=45, dy=16)
    ImageDraw.Draw(img).rounded_rectangle([x, y, x + w, y + h], radius=44, fill=(255, 255, 255, 236), outline=LINE, width=2)
    mark(img, x + 34, y + 38, 74)
    d = ImageDraw.Draw(img)
    d.text((x + 132, y + 44), 'QUADRIAMO', font=sans(25, 600), fill=MUTED)
    d.text((x + w - 36, y + 44), when, font=sans(25), fill=MUTED, anchor='ra')
    d.text((x + 132, y + 82), title, font=sans(38, 700), fill=INK)
    text_block(img, x + 132, y + 134, body, sans(31), INK, w - 170)
    return y + h


def check(img, cx, cy, r, color=ACCENT):
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    d.line([(cx - r * .42, cy + r * .02), (cx - r * .1, cy + r * .34), (cx + r * .45, cy - r * .3)], fill=WHITE, width=max(4, int(r * .2)), joint='curve')


def foot(img, w, h, light=True):
    mark(img, 60, h - 108, 52)
    wordmark(img, 128, h - 66, 40, color=INK if light else CREAM, dot=ACCENT if light else (240, 122, 66))
    ImageDraw.Draw(img).text((w - 60, h - 78), 'Beta gratuita', font=sans(28, 600), fill=MUTED if light else SOFT, anchor='rm')


PARTS = [('55%', 'Essenziali', 'Affitto, spesa, bollette, trasporti', ACCENT), ('20%', 'Qualità della vita', 'Uscite, hobby, viaggi, regali', B2),
         ('15%', 'Fondo di sicurezza', 'Il cuscinetto per gli imprevisti', (200, 160, 110)), ('10%', 'Investimenti', 'Il tuo futuro: ETF, PAC', B4)]
PRIVACY = ['Funziona anche senza account: i dati restano sul telefono', 'Server nell’Unione europea, connessioni cifrate',
           'Gli importi delle notifiche li calcola il tuo telefono', 'Niente pubblicità, niente vendita di dati', 'Esporti o cancelli tutto quando vuoi']


def build(W, H, story=False):
    """I sei contenuti nel formato richiesto (post 1080x1350 o storia 1080x1920)."""
    tag = 'storia' if story else 'post'
    top = 230 if story else 90
    out = []

    # 1. ogni mattina, un numero
    img = canvas(W, H)
    eyebrow(img, 60, top, 'Ogni mattina alle 7:30')
    y = text_block(img, 60, top + 60, 'Sai quanto puoi spendere oggi.', serif(96 if story else 84), INK, 960)
    y = text_block(img, 60, y + 14, 'Non quanto hai speso: quanto puoi ancora spendere, ogni giorno, per ogni parte.', sans(36), MUTED, 900)
    y = notification(img, 60, y + 50, 960, 'Oggi puoi spendere', 'Essenziali 18,13 € · Qualità della vita 38,21 €')
    phone(img, '11-home.jpg', W / 2, y + 60, 640 if story else 560, 160, 1300)   # esce dal bordo in basso, come in mano
    out.append(save(img, f'{tag}-01-oggi.jpg'))

    # 2. lo stipendio si divide da solo
    img = canvas(W, H)
    eyebrow(img, 60, top, 'Il metodo')
    y = text_block(img, 60, top + 60, 'Lo stipendio si divide da solo.', serif(96 if story else 84), INK, 960)
    y = text_block(img, 60, y + 14, 'Quattro parti, ognuna con un compito. La regola 55-20-15-10 è di partenza: la cambi quando vuoi.', sans(36), MUTED, 940)
    rule_bar(img, 60, y + 40, 960, 26)
    d = ImageDraw.Draw(img)
    for i, (p, n, s_, col) in enumerate(PARTS):
        y0 = y + 110 + i * (170 if story else 148)
        d.rounded_rectangle([60, y0, 1020, y0 + 128], radius=24, fill=SURF, outline=LINE, width=2)
        d.text((100, y0 + 64), p, font=serif(64), fill=col, anchor='lm')
        d.text((290, y0 + 44), n, font=sans(38, 700), fill=INK, anchor='lm')
        d.text((290, y0 + 90), s_, font=sans(30), fill=MUTED, anchor='lm')
    out.append(save(img, f'{tag}-02-metodo.jpg'))

    # 3. previsione di fine mese
    img = canvas(W, H)
    eyebrow(img, 60, top, 'Previsione di fine mese')
    y = text_block(img, 60, top + 60, 'Sai già come finisce il mese.', serif(96 if story else 84), INK, 960)
    y = text_block(img, 60, y + 14, 'Al ritmo di oggi, con le bollette in arrivo già contate. Se rischi di sforare lo vedi a metà mese, non alla fine.', sans(36), MUTED, 940)
    card_from_shot(img, '12-forecast.jpg', (20, 40, 730, 560), 90, y + 60, 900)
    out.append(save(img, f'{tag}-03-previsione.jpg'))

    # 4. slancio
    img = canvas(W, H)
    eyebrow(img, 60, top, 'Slancio')
    y = text_block(img, 60, top + 60, 'Un minuto al giorno. E non vuoi più fermarti.', serif(96 if story else 84), INK, 960)
    y = text_block(img, 60, y + 14, 'Ogni giorno in cui segni le spese, la fiamma cresce. Niente spese? Basta un tocco su “Oggi niente spese”.', sans(36), MUTED, 940)
    card_from_shot(img, '11-home.jpg', (20, 292, 730, 636), 90, y + 70, 900)
    out.append(save(img, f'{tag}-04-slancio.jpg'))

    # 5. privacy
    img = canvas(W, H)
    eyebrow(img, 60, top, 'Privacy')
    y = text_block(img, 60, top + 60, 'I tuoi soldi sono affari tuoi.', serif(96 if story else 84), INK, 960)
    for i, p in enumerate(PRIVACY):
        y0 = y + 70 + i * (170 if story else 140)
        check(img, 92, y0 + 32, 32)
        text_block(img, 156, y0 + 6, p, sans(38, 600), INK, 860)
    out.append(save(img, f'{tag}-05-privacy.jpg'))

    # 6. cerco tester
    img = Image.new('RGBA', (W, H), INK + (255,))
    cy = H / 2 - (330 if story else 300)
    mark(img, W / 2 - 70, cy, 140)
    wordmark(img, W / 2, cy + 290, 110, color=CREAM, dot=(240, 122, 66), anchor='ms')
    d = ImageDraw.Draw(img)
    d.text((W / 2, cy + 390), 'Cerco 50 tester', font=serif(76), fill=CREAM, anchor='mm')
    text_block(img, W / 2, cy + 460, 'Gratis durante la beta. Si installa dal browser in un minuto: iPhone, Android, Mac e Windows.', sans(36), SOFT, 800, anchor='ma')
    d.rounded_rectangle([W / 2 - 300, cy + 640, W / 2 + 300, cy + 740], radius=50, fill=ACCENT)
    d.text((W / 2, cy + 690), 'Link nella bio' if not story else 'Tocca il link', font=sans(42, 700), fill=WHITE, anchor='mm')
    d.text((W / 2, cy + 810), SITE, font=sans(28), fill=(170, 165, 158), anchor='mm')
    rule_bar(img, W / 2 - 240, cy + 880, 480, 16)
    out.append(save(img, f'{tag}-06-tester.jpg'))
    return out


posts = build(1080, 1350)
stories = build(1080, 1920, story=True)

# ---------- reel 18 secondi (le sei storie, 3 secondi l'una, con un lento zoom) ----------
FPS = 30


def clip(src, seconds, out):
    frames = int(seconds * FPS)
    vf = (f"scale=2160:3840,zoompan=z='min(1+0.0009*on,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1080x1920:fps={FPS},"
          f"fade=t=in:st=0:d=0.25,fade=t=out:st={seconds - 0.25:.2f}:d=0.25,format=yuv420p")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', src, '-vf', vf, '-t', str(seconds), '-r', str(FPS),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-an', out], check=True)
    return out


parts = [clip(s, 3, os.path.join(WORK, f'b{i}.mp4')) for i, s in enumerate(stories)]
lst = os.path.join(WORK, 'list.txt')
with open(lst, 'w') as f:
    f.writelines(f"file '{p}'\n" for p in parts)
reel = os.path.join(DST, 'reel-beta.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', reel], check=True)
print(reel)
import shutil
shutil.rmtree(WORK, ignore_errors=True)   # i pezzi intermedi del video non servono
