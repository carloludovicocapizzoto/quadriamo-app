"""Campagna di Quadriamo (app 0.20, 17/10/2026): sostituisce la campagna di lancio e quella della beta.

Escono in marketing/out/:
  carosello/  10 slide 1080x1350 «Quadriamo, adesso»
  post/        8 post singoli 1080x1350 (uno per funzione)
  storie/      8 storie 1080x1920
  pinterest/   4 pin 1000x1500
  video/       i reel con la voce narrante (make_reels.py)
Le schermate vengono da marketing/shots-campaign/ (dati di esempio): THEME=light|dark node marketing/shoot-campaign.mjs
Uso (dalla cartella quadriamo-app): <python con Pillow> marketing/make_campaign.py
Testi e didascalie: marketing/TESTI.md. Cosa si può dire e cosa no: marketing/BRIEF.md (sezione 12).
"""
import os
from PIL import Image, ImageDraw
from brandkit import (ACCENT, CREAM, INK, MUTED, OUT, SITE, SOFT, check, device, glass, lockup, sans, scene,
                      text_block, title as headline, wordmark, mark)

for d in ('carosello', 'post', 'storie', 'pinterest'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))


def save(img, name):
    path = os.path.join(OUT, name)
    img.convert('RGB').save(path, quality=93)
    print(path)
    return path


def card(w, h, section, light, ey, title, body, shot, crop=None, phone_w=None, n=None, total=None, tsize=86):
    """La slide tipo: sfondo della sezione, riga sopra il titolo, titolo grande, testo, il telefono che esce dal basso."""
    img = scene(w, h, section, light)
    ink, soft = (INK, MUTED) if light else (CREAM, SOFT)
    d = ImageDraw.Draw(img)
    d.text((72, 96), ey.upper(), font=sans(28, 600), fill=(ACCENT if light else (240, 150, 105)))
    y = text_block(img, 72, 142, title, headline(tsize), ink, w - 144, gap=1.08)
    y = text_block(img, 72, y + 18, body, sans(36), soft, w - 160, gap=1.3)
    device(img, shot, w / 2, y + 56, phone_w or int(w * 0.6), 'light' if light else 'dark', crop)
    if n:
        d = ImageDraw.Draw(img)
        d.rectangle([0, h - 120, w, h], fill=(CREAM if light else (12, 14, 18)))
        lockup(img, 72, h - 44, color=ink if light else CREAM, size=34)
        d.text((w - 72, h - 56), f'{n}/{total}', font=sans(28, 600), fill=soft, anchor='rm')
    return img


# ---------- Carosello «Quadriamo, adesso» (10 slide) ----------
W, H, T = 1080, 1350, 10
img = scene(W, H, 'home')
lockup(img, 72, 150, size=46)
d = ImageDraw.Draw(img)
d.text((72, 230), 'I tuoi soldi,', font=headline(118), fill=CREAM)
d.text((72, 345), 'in quattro.', font=headline(118), fill=CREAM)
y = 480
text_block(img, 72, y + 20, 'Cosa devo sapere oggi? Quadriamo te lo dice, prima che tu lo chieda.', sans(40), SOFT, 900, gap=1.3)
device(img, '01-home.png', W / 2, 700, 640, 'dark')
d = ImageDraw.Draw(img)
d.rectangle([0, H - 120, W, H], fill=(12, 14, 18))
d.text((72, H - 58), 'Scorri ›', font=sans(34, 600), fill=CREAM, anchor='lm')
d.text((W - 72, H - 58), f'1/{T}', font=sans(28, 600), fill=SOFT, anchor='rm')
save(img, 'carosello/01-copertina.jpg')

SLIDES = [
    ('home', 'Adesso', 'Ogni mattina, la risposta.', 'Quello che conta oggi, in fila: cosa pagare, cosa arriva, cosa è cambiato. Un tocco e sei dove serve.', '01-home.png', (0.17, 1), 'adesso'),
    ('analysis', 'Calendario', 'Il mese, giorno per giorno.', 'Già pagato, da pagare e quanto resta a fine mese. I giorni più pesanti, in rosso.', '04-calendar.png', None, 'calendario'),
    ('profile', 'Promemoria', 'Ti avvisa prima. Mai troppo.', 'Giorni prima, ore prima, o finché non è fatto. Con le ore di silenzio e un massimo al giorno.', '09-inbox.png', None, 'promemoria'),
    ('profile', 'Abbonamenti', 'Tutti in un posto. Anche gli aumenti.', '80 servizi da trovare in un attimo. Quando un prezzo sale, lo vedi: Netflix +38%.', '10-subscriptions.png', None, 'abbonamenti'),
    ('profile', 'Costo annuale', 'Quanto ti costano davvero.', 'Ogni blocco è un abbonamento, grande quanto costa in un anno. Togline uno e guarda cosa succede.', '13-year-cost.png', None, 'costo-annuale'),
    ('analysis', 'Ricevuta del mese', 'Il mese, in uno scontrino.', 'Dove sono andati i soldi, il confronto col mese prima e qualche curiosità. Da condividere.', '16-receipt.png', (0.08, 1), 'ricevuta'),
    ('profile', 'Documenti', 'Nessuna scadenza ti sorprende.', 'Carta d’identità, patente, assicurazioni. Ti avvisa in tempo. Solo nome e date.', '18-documents.png', None, 'documenti'),
    ('invest', 'Capitale', 'Parti da dove sei.', 'I risparmi che hai già, divisi per uso: emergenza, liquidità, da far crescere.', '19-capital.png', None, 'capitale'),
]
for i, (sec, ey, t, b, shot, crop, name) in enumerate(SLIDES, 2):
    save(card(W, H, sec, False, ey, t, b, shot, crop, phone_w=600, n=i, total=T, tsize=80), f'carosello/{i:02d}-{name}.jpg')

img = scene(W, H, 'home')
d = ImageDraw.Draw(img)
mark(img, W / 2 - 70, 170, 140)
wordmark(img, W / 2, 460, 110, color=CREAM, dot=(240, 122, 66), anchor='ms')
d.text((W / 2, 545), 'Gratis durante la beta', font=sans(48, 600), fill=CREAM, anchor='mm')
text_block(img, W / 2, 615, 'iPhone · Android · computer. Si installa dal browser in 30 secondi.', sans(36), SOFT, 820, anchor='ma')
glass(img, (110, 760, W - 110, 1090), radius=40)
d = ImageDraw.Draw(img)
for k, line in enumerate(['I tuoi dati li vedi solo tu', 'Server nell’Unione europea', 'Niente pubblicità, nessuna banca collegata']):
    yy = 830 + k * 92
    check(img, 180, yy + 2, 24, color=CREAM)
    d.text((222, yy), line, font=sans(34, 600), fill=CREAM, anchor='lm')
d.text((W / 2, 1170), 'Link nella bio ›', font=sans(40, 600), fill=CREAM, anchor='mm')
d.text((W / 2, 1225), SITE, font=sans(26), fill=SOFT, anchor='mm')
d.text((W - 72, H - 58), f'{T}/{T}', font=sans(28, 600), fill=SOFT, anchor='rm')
save(img, f'carosello/{T:02d}-provala.jpg')

# ---------- Post singoli (tema chiaro, uno per funzione) ----------
POSTS = [
    ('home', 'Adesso', 'Cosa devo sapere oggi?', 'Il numero del giorno e, sotto, quello che conta. Nient’altro.', '01-home.png', None, 'adesso'),
    ('analysis', 'Calendario', 'Niente sorprese a fine mese.', 'Il calendario dei tuoi soldi: già pagato, da pagare, quanto resta.', '04-calendar.png', None, 'calendario'),
    ('profile', 'Abbonamenti', 'Netflix è aumentato del 38%.', 'Te ne accorgi solo se qualcuno te lo dice. Quadriamo te lo dice.', '10-subscriptions.png', None, 'aumenti'),
    ('profile', 'Costo annuale', 'Senza DAZN: 419,88 € l’anno.', 'Togli un blocco e guarda quanto risparmieresti. È solo una prova: decidi tu.', '15-year-cost-without.png', None, 'costo-annuale'),
    ('analysis', 'Ricevuta del mese', 'Il tuo ottobre, stampato.', 'Una ricevuta a fine mese: categorie, confronti, curiosità. Salvala o condividila.', '16-receipt.png', (0.08, 1), 'ricevuta'),
    ('profile', 'Documenti', 'La patente scade tra 22 giorni.', 'Meglio saperlo adesso che al controllo. Solo nome e date, nessuna scansione.', '18-documents.png', None, 'documenti'),
    ('invest', 'Capitale', 'Quanto dei tuoi risparmi puoi toccare?', 'Protetto, utilizzabile, da far crescere. Ogni euro con la sua regola.', '19-capital.png', None, 'capitale'),
]
for i, (sec, ey, t, b, shot, crop, name) in enumerate(POSTS, 1):
    img = card(W, H, sec, True, ey, t, b, shot, crop, phone_w=600, tsize=78)
    lockup(img, W - 262, 120, color=INK, size=28)
    save(img, f'post/{i:02d}-{name}.jpg')
# l'ultimo: il computer accanto al telefono
img = scene(W, H, 'home', True)
d = ImageDraw.Draw(img)
d.text((72, 96), 'OVUNQUE', font=sans(28, 600), fill=ACCENT)
y = text_block(img, 72, 142, 'Telefono, tablet, computer.', headline(78), INK, 936, gap=1.08)
text_block(img, 72, y + 18, 'La stessa calma su ogni schermo. Si installa dal browser.', sans(36), MUTED, 920, gap=1.3)
desk = Image.open(os.path.join(HERE, 'shots-campaign', 'light', '30-desktop-home.png')).convert('RGB').resize((1000, 625), Image.LANCZOS)
d.rounded_rectangle([30, 470, 1050, 1115], radius=26, fill=(30, 31, 34))
mask = Image.new('L', desk.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, desk.width - 1, desk.height - 1], radius=18, fill=255)
img.paste(desk, (40, 480), mask)
device(img, '01-home.png', 905, 760, 250, 'light')
lockup(img, W - 262, 120, color=INK, size=28)
save(img, 'post/08-ovunque.jpg')

# ---------- Storie 1080x1920 (scure, telefono grande, spazio per gli adesivi in alto) ----------
W2, H2 = 1080, 1920
STORIES = [
    ('home', 'A che punto sei con il mese?', '01-home.png', None, 'sondaggio'),
    ('home', 'Ogni mattina, la risposta.', '01-home.png', (0.17, 1), 'adesso'),
    ('analysis', 'Il mese, giorno per giorno.', '04-calendar.png', None, 'calendario'),
    ('profile', 'Quanti abbonamenti paghi?', '11-service-picker.png', None, 'abbonamenti'),
    ('profile', 'Indovina quanto costano in un anno.', '13-year-cost.png', None, 'costo-annuale'),
    ('analysis', 'Il tuo mese, in uno scontrino.', '16-receipt.png', (0.08, 1), 'ricevuta'),
    ('profile', 'Quando scade la tua carta d’identità?', '18-documents.png', None, 'documenti'),
    ('home', 'Gratis durante la beta.', '01-home.png', None, 'provala'),
]
for i, (sec, t, shot, crop, name) in enumerate(STORIES, 1):
    img = scene(W2, H2, sec)
    y = text_block(img, W2 / 2, 250, t, headline(92), CREAM, 920, gap=1.06, anchor='ma')
    device(img, shot, W2 / 2, max(y + 60, 560), 700, 'dark', crop)
    d = ImageDraw.Draw(img)
    d.rectangle([0, H2 - 230, W2, H2], fill=(12, 14, 18))
    lockup(img, W2 / 2 - 170, H2 - 100, size=46)
    if name == 'provala':
        glass(img, (190, H2 - 470, W2 - 190, H2 - 300), radius=40)
        ImageDraw.Draw(img).text((W2 / 2, H2 - 385), 'Scarica dal link ↑', font=sans(46, 600), fill=CREAM, anchor='mm')
    save(img, f'storie/{i:02d}-{name}.jpg')

# ---------- Pinterest 1000x1500 (chiari) ----------
W3, H3 = 1000, 1500
PINS = [
    ('analysis', 'Il calendario dei tuoi soldi', 'Cosa hai pagato, cosa devi pagare e quanto ti resta a fine mese, in una pagina.', '04-calendar.png', None, 'calendario'),
    ('profile', 'Quanto ti costano gli abbonamenti in un anno?', 'Ogni blocco è grande quanto un abbonamento costa in un anno. Togline uno e vedi quanto risparmi.', '13-year-cost.png', None, 'abbonamenti'),
    ('analysis', 'La ricevuta del mese', 'Il riepilogo del mese come uno scontrino: categorie, confronti e curiosità.', '16-receipt.png', (0.08, 1), 'ricevuta'),
    ('profile', 'Documenti con le scadenze', 'Carta d’identità, patente, assicurazioni: un promemoria prima che scadano.', '18-documents.png', None, 'documenti'),
]
for i, (sec, t, b, shot, crop, name) in enumerate(PINS, 1):
    img = card(W3, H3, sec, True, 'Quadriamo', t, b, shot, crop, phone_w=560, tsize=72)
    d = ImageDraw.Draw(img)
    d.rectangle([0, H3 - 140, W3, H3], fill=INK)
    lockup(img, 70, H3 - 52, size=44)
    d.text((W3 - 70, H3 - 70), 'Gratis · beta', font=sans(30, 600), fill=CREAM, anchor='rm')
    save(img, f'pinterest/{i:02d}-{name}.jpg')
