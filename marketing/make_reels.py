"""Reel della campagna (1080x1920, 30 fps) con la voce narrante, un tappeto musicale morbido e i suoni delle transizioni.

Ogni scena è disegnata fotogramma per fotogramma con Pillow e passata a ffmpeg:
  title  — testo cinetico: le parole salgono e compaiono una dopo l'altra
  phone  — il telefono entra dal basso con una molla; zoom lento su un dettaglio (focus) o scorrimento tra due
           schermate (stack); dissolvenza tra il prima e il dopo (swap)
  end    — il marchio, «Gratis durante la beta», «Link nella bio»
La durata di ogni scena segue la sua frase (voice.py). Musica e suoni sono generati qui (niente diritti): si possono
sostituire in CapCut/Instagram con un brano della libreria, tenendolo basso sotto la voce.
Uso (dalla cartella quadriamo-app): <python con Pillow, numpy, kokoro-onnx, soundfile> marketing/make_reels.py [nome]
"""
import math, os, subprocess, sys
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw
from brandkit import CAMPAIGN_SHOTS, CREAM, OUT, SITE, SOFT, glass, lockup, mark, sans, scene, title as headline, wordmark
from voice import SR, STUDIO, say

W, H, FPS = 1080, 1920, 30
DST = os.path.join(OUT, 'video')
WORK = os.path.join(DST, '_work')
os.makedirs(WORK, exist_ok=True)
LEAD, TAIL, MIN_SCENE = 0.35, 0.6, 2.2


def ease_out(t):
    return 1 - (1 - min(max(t, 0), 1)) ** 3


def ease_in_out(t):
    t = min(max(t, 0), 1)
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def spring(t):
    """Una molla leggera: arriva, supera di poco e si ferma (come le transizioni dell'app)."""
    t = min(max(t, 0), 1)
    return 1 - math.exp(-6 * t) * math.cos(7.5 * t)


# ---------- telefono ----------
PHONE_W = 760


def screen(shot, theme='dark'):
    """Una schermata; «pagina.png@0.8» = la finestra di una pagina intera che finisce all'80% della sua altezza."""
    name, _, end = shot.partition('@')
    img = Image.open(os.path.join(CAMPAIGN_SHOTS, theme, name)).convert('RGB')
    if end:
        view = int(img.width * 2436 / 1125)
        y1 = int(img.height * float(end))
        img = img.crop((0, max(0, y1 - view), img.width, y1))
    return img


def device_frame(screen_img, width=PHONE_W):
    """Telefono (cornice + schermo) come immagine RGBA alla larghezza data."""
    bezel = int(width * 0.035)
    sw = width - 2 * bezel
    sh = int(screen_img.height * sw / screen_img.width)
    s = screen_img.resize((sw, sh), Image.LANCZOS)
    img = Image.new('RGBA', (width, sh + 2 * bezel), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, width - 1, sh + 2 * bezel - 1], radius=int(width * 0.13), fill=(30, 31, 34, 255))
    d.rounded_rectangle([2, 2, width - 3, sh + 2 * bezel - 3], radius=int(width * 0.13) - 2, outline=(78, 80, 86, 255), width=2)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=int(width * 0.105), fill=255)
    img.paste(s, (bezel, bezel), mask)
    return img


def caption(img, text, alpha=1.0, y=170):
    if not text or alpha <= 0:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = headline(78)
    lines, line = [], ''
    for w_ in text.split():
        t = (line + ' ' + w_).strip()
        if d.textlength(t, font=f) <= W - 160:
            line = t
        else:
            lines.append(line); line = w_
    lines.append(line)
    rise = int((1 - alpha) * 24)
    for i, ln in enumerate(lines):
        d.text((W / 2, y + i * 86 + rise), ln, font=f, fill=CREAM + (int(255 * alpha),), anchor='ma')
    img.alpha_composite(layer)


# ---------- scene ----------
def render_title(lines, section, seconds, sub=None):
    bg = scene(W, H, section)
    words = [(li, w_) for li, ln in enumerate(lines) for w_ in ln.split()]
    f = headline(104)
    tmp = ImageDraw.Draw(bg)
    widths = [tmp.textlength(ln, font=f) for ln in lines]
    top = H / 2 - len(lines) * 62 - (40 if sub else 0)
    frames = []
    for n in range(int(seconds * FPS)):
        t = n / FPS
        img = bg.copy()
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        x = {li: W / 2 - widths[li] / 2 for li in range(len(lines))}
        for k, (li, w_) in enumerate(words):
            a = ease_out((t - 0.15 - k * 0.11) / 0.45)
            if a > 0:
                d.text((x[li], top + li * 124 + (1 - a) * 30), w_, font=f, fill=CREAM + (int(255 * a),))
            x[li] += d.textlength(w_ + ' ', font=f)
        if sub:
            a = ease_out((t - 0.3 - len(words) * 0.11) / 0.5)
            d.text((W / 2, top + len(lines) * 124 + 40 + (1 - a) * 20), sub, font=sans(44), fill=SOFT + (int(255 * a),), anchor='ma')
        img.alpha_composite(layer)
        frames.append(img)
    return frames


def render_phone(shot, section, seconds, text=None, focus=None, stack=None, swap=None, theme='dark'):
    """focus=(x, y, zoom) in proporzione dello schermo; stack=(shot2,): scorre dalla prima alla seconda; swap=shot2: dissolvenza."""
    bg = scene(W, H, section)
    if stack:   # una pagina intera (shots-campaign/*/4*-tall-*.png): lo schermo è una finestra che scorre
        name, start = stack if isinstance(stack, tuple) else (stack, 0)   # start: da dove parte, in proporzione
        tall = screen(name, theme)
        tall = tall.crop((0, int(tall.height * start), tall.width, tall.height))
        view_h = int(tall.width * 2436 / 1125)
        base = tall.crop((0, 0, tall.width, view_h))
    else:
        base = screen(shot, theme)
    phone_a = device_frame(base)
    phone_b = device_frame(screen(swap, theme)) if swap else None
    top0 = 330
    frames = []
    total = int(seconds * FPS)
    for n in range(total):
        t = n / FPS
        img = bg.copy()
        caption(img, text, ease_out((t - 0.05) / 0.45))
        if stack:   # lo schermo scorre come un dito che sale
            p = ease_in_out((t - 0.7) / max(0.8, seconds - 1.2))
            y0 = int(p * (tall.height - view_h))
            phone = device_frame(tall.crop((0, y0, tall.width, y0 + view_h)))
        elif swap:
            p = ease_out((t - seconds * 0.45) / 0.5)
            phone = Image.blend(phone_a, phone_b, p) if p > 0 else phone_a
        else:
            phone = phone_a
        enter = spring(t / 0.9)
        y = top0 + (1 - enter) * 900
        scale = 1.0
        cx, cy = W / 2, y + phone.height / 2
        if focus:   # zoom lento verso il dettaglio
            fx, fy, z = focus
            p = ease_out((t - 0.9) / max(0.6, seconds - 1.4))
            scale = 1 + (z - 1) * p
            cx = W / 2 + (0.5 - fx) * phone.width * (scale - 1)
            cy = y + phone.height / 2 + (0.5 - fy) * phone.height * (scale - 1)
        ph = phone if scale == 1 else phone.resize((int(phone.width * scale), int(phone.height * scale)), Image.BILINEAR)
        img.alpha_composite(ph, (int(cx - ph.width / 2), int(cy - ph.height / 2)))
        frames.append(img)
    return frames


def render_end(seconds, section='home'):
    bg = scene(W, H, section)
    frames = []
    for n in range(int(seconds * FPS)):
        t = n / FPS
        img = bg.copy()
        a = ease_out(t / 0.6)
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        k = spring(t / 0.9)
        mark(layer, W / 2 - 90 * k, 560 + (1 - k) * 60, 180 * max(k, 0.01))
        wordmark(layer, W / 2, 900, 130, color=CREAM, dot=(240, 122, 66), anchor='ms')
        d = ImageDraw.Draw(layer)
        d.text((W / 2, 1010), 'Gratis durante la beta', font=sans(54, 600), fill=CREAM, anchor='mm')
        d.text((W / 2, 1085), 'iPhone · Android · computer', font=sans(40), fill=SOFT, anchor='mm')
        alpha = layer.split()[3].point(lambda v: int(v * a))
        layer.putalpha(alpha)
        img.alpha_composite(layer)
        b = ease_out((t - 0.5) / 0.5)
        if b > 0:
            glass(img, (240, 1250, W - 240, 1390), radius=44)
            ImageDraw.Draw(img).text((W / 2, 1320), 'Link nella bio ↑', font=sans(46, 600), fill=CREAM, anchor='mm')
        ImageDraw.Draw(img).text((W / 2, 1480), SITE, font=sans(30), fill=SOFT, anchor='mm')
        frames.append(img)
    return frames


# ---------- audio: tappeto, fruscio, voce ----------
def pad(seconds):
    """Accordo morbido (La maggiore 7, filtrato), con un lento respiro di volume: discreto, mai protagonista."""
    t = np.arange(int(seconds * SR)) / SR
    notes = [110.0, 164.81, 220.0, 277.18, 329.63, 415.30]
    sig = sum(np.sin(2 * np.pi * f * t + i) * (0.6 if f < 200 else 0.35) for i, f in enumerate(notes))
    sig *= 0.55 + 0.45 * np.sin(2 * np.pi * t / 8.0) ** 2
    env = np.minimum(1, t / 1.5) * np.minimum(1, (seconds - t) / 1.2)
    return (sig * env * 0.022).astype(np.float32)


def whoosh(n=0.45):
    """Un fruscio corto e morbido per le transizioni (rumore filtrato che sale e scende)."""
    k = int(n * SR)
    noise = np.random.default_rng(7).standard_normal(k).astype(np.float32)
    smooth = np.convolve(noise, np.ones(18) / 18, mode='same')
    env = np.sin(np.linspace(0, np.pi, k)) ** 2
    return (smooth * env * 0.05).astype(np.float32)


def build(name, scenes):
    """scenes: [(tipo, frase, opzioni)]. Scrive out/video/<name>.mp4."""
    work = os.path.join(WORK, name)
    os.makedirs(work, exist_ok=True)
    voice_track, durations = [], []
    for kind, line, opts in scenes:
        v = say(line) if line else np.zeros(0, np.float32)
        sec = max(opts.get('min', MIN_SCENE), LEAD + len(v) / SR + TAIL)
        seg = np.zeros(int(round(sec * SR)), np.float32)
        s0 = int(LEAD * SR)
        seg[s0:s0 + len(v)] = v[:len(seg) - s0]
        voice_track.append(seg); durations.append(sec)
    total = sum(durations)
    raw = os.path.join(work, 'voce.raw.wav')
    sf.write(raw, np.concatenate(voice_track), SR)
    voice = os.path.join(work, 'voce.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', STUDIO, '-ar', str(SR), voice], check=True)
    v, _ = sf.read(voice, dtype='float32')
    bed = pad(total)[:len(v)]
    fx = np.zeros_like(bed)
    pos = 0.0
    for sec in durations[:-1]:
        pos += sec
        w_ = whoosh()
        i = max(0, int((pos - 0.22) * SR))
        fx[i:i + len(w_)] += w_[:len(fx) - i]
    mix = os.path.join(work, 'mix.wav')
    sf.write(mix, np.clip(v[:len(bed)] + bed + fx, -1, 1), SR)

    out = os.path.join(DST, f'{name}.mp4')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-i', mix, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                           '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    prev = None
    for (kind, line, opts), sec in zip(scenes, durations):
        o = {k: v_ for k, v_ in opts.items() if k != 'min'}
        frames = render_title(seconds=sec, **o) if kind == 'title' else render_end(sec, **o) if kind == 'end' else render_phone(seconds=sec, **o)
        for j, fr in enumerate(frames):
            if prev is not None and j < 8:   # dissolvenza di 8 fotogrammi dalla scena prima
                fr = Image.blend(prev, fr, (j + 1) / 9)
            ff.stdin.write(fr.convert('RGB').tobytes())
        prev = frames[-1]
    ff.stdin.close(); ff.wait()
    print(out, f'{total:.1f} s')
    return out


REELS = {
    'reel-01-adesso': [
        ('title', 'Ogni mattina, la stessa domanda: cosa devo sapere oggi?', dict(lines=['Cosa devo sapere', 'oggi?'], section='home', sub='Sono le 8:12.')),
        ('phone', 'Quadriamo te lo dice con un numero: quanto puoi spendere oggi.', dict(shot='01-home.png', section='home', text='Quanto puoi spendere oggi.', focus=(0.3, 0.12, 1.35))),
        ('phone', 'E sotto, quello che conta: una bolletta da segnare, un pagamento domani, un abbonamento aumentato.', dict(shot='01-home.png', section='home', text='E cosa conta, in fila.', focus=(0.5, 0.36, 1.45))),
        ('phone', 'Il resto lo trovi scorrendo. Niente di più.', dict(shot='01-home.png', section='home', text='Il resto, quando vuoi.', stack='40-tall-home.png')),
        ('end', 'Quadriamo. Gratis durante la beta. Link nella bio.', dict()),
    ],
    'reel-02-costo-annuale': [
        ('title', 'Quanto paghi di abbonamenti in un anno? Indovina.', dict(lines=['Quanto paghi', 'di abbonamenti', 'in un anno?'], section='profile')),
        ('phone', 'Li aggiungi in pochi secondi: cerchi il servizio, lo tocchi, scrivi il prezzo.', dict(shot='11-service-picker.png', section='profile', text='Ottanta servizi, in un attimo.')),
        ('phone', 'Se un prezzo sale, lo vedi. Netflix: più trentotto per cento.', dict(shot='10-subscriptions.png', section='profile', text='Gli aumenti, in evidenza.', focus=(0.8, 0.5, 1.55))),
        ('phone', 'Poi ogni abbonamento diventa un blocco, grande quanto costa in un anno.', dict(shot='13-year-cost.png', section='profile', text='Ogni blocco, un anno.')),
        ('phone', 'Togline uno. Senza DAZN risparmieresti quattrocentodiciannove euro l’anno.', dict(shot='13-year-cost.png', section='profile', text='Prova senza.', swap='15-year-cost-without.png')),
        ('end', 'Quadriamo. Gratis durante la beta.', dict()),
    ],
    'reel-03-ricevuta': [
        ('title', 'Ottobre è finito. Ecco lo scontrino.', dict(lines=['Ottobre è finito.', 'Ecco lo scontrino.'], section='analysis')),
        ('phone', 'Dove sono andati i soldi, il confronto con settembre, il giorno più caro.', dict(shot='16-receipt.png', section='analysis', text='Il mese, in uno scontrino.', stack=('41-tall-receipt.png', 0.615))),
        ('phone', 'Lo salvi o lo condividi. Lo crea il tuo telefono, nessun server.', dict(shot='41-tall-receipt.png@0.985', section='analysis', text='Da condividere.', focus=(0.5, 0.62, 1.35))),
        ('end', 'Quadriamo. La ricevuta del mese. Gratis durante la beta.', dict(section='analysis')),
    ],
    'reel-04-niente-sorprese': [
        ('title', 'Il giorno prima del volo, scopri che la carta d’identità è scaduta.', dict(lines=['Il giorno prima', 'del volo.'], section='profile', sub='La carta d’identità è scaduta.')),
        ('phone', 'Quadriamo te lo dice un mese prima. Anche per patente e assicurazioni.', dict(shot='18-documents.png', section='profile', text='Le scadenze, prima.')),
        ('phone', 'E nel calendario vedi cosa hai pagato, cosa devi pagare e quanto resta a fine mese.', dict(shot='04-calendar.png', section='analysis', text='Il mese, giorno per giorno.', focus=(0.5, 0.2, 1.3))),
        ('phone', 'I promemoria arrivano al momento giusto. Mai troppi.', dict(shot='09-inbox.png', section='profile', text='Promemoria discreti.')),
        ('end', 'Quadriamo. Niente sorprese. Gratis durante la beta.', dict()),
    ],
    'reel-05-parti-da-dove-sei': [
        ('title', 'Hai dei risparmi. Ma quanto puoi davvero toccare?', dict(lines=['Hai dei risparmi.', 'Quanto puoi toccare?'], section='invest')),
        ('phone', 'Dividili per uso: fondo di emergenza, liquidità, da far crescere. Ognuno con la sua regola.', dict(shot='19-capital.png', section='invest', text='Ogni euro con la sua regola.')),
        ('phone', 'Il tuo budget parte dalla tua situazione reale.', dict(shot='01-home.png', section='home', text='Il budget parte da qui.')),
        ('end', 'Quadriamo. Gratis durante la beta.', dict()),
    ],
    'hero-01-quadriamo-adesso': [
        ('title', 'I tuoi soldi, in quattro.', dict(lines=['I tuoi soldi,', 'in quattro.'], section='home', min=3.0)),
        ('phone', 'Ogni mattina, un numero: quanto puoi spendere oggi.', dict(shot='01-home.png', section='home', text='Oggi.', focus=(0.3, 0.12, 1.3))),
        ('phone', 'E quello che conta, prima che tu lo chieda.', dict(shot='01-home.png', section='home', text='Adesso.', focus=(0.5, 0.36, 1.4))),
        ('phone', 'Il mese, giorno per giorno: cosa hai pagato, cosa arriva, quanto resta.', dict(shot='04-calendar.png', section='analysis', text='Niente sorprese.')),
        ('phone', 'I promemoria arrivano al momento giusto, e non di più.', dict(shot='09-inbox.png', section='profile', text='Discreto.')),
        ('phone', 'Gli abbonamenti, grandi quanto costano davvero.', dict(shot='13-year-cost.png', section='profile', text='Quello che non vedi.', swap='15-year-cost-without.png')),
        ('phone', 'I documenti, prima che scadano.', dict(shot='18-documents.png', section='profile', text='In tempo.')),
        ('phone', 'I risparmi che hai già, ognuno con la sua regola.', dict(shot='19-capital.png', section='invest', text='Parti da dove sei.')),
        ('phone', 'E a fine mese, il mese in uno scontrino.', dict(shot='16-receipt.png', section='analysis', text='Il mese, stampato.', stack=('41-tall-receipt.png', 0.615))),
        ('title', 'Calcolato sul tuo telefono. I tuoi dati li vedi solo tu.', dict(lines=['I tuoi soldi', 'sono affari tuoi.'], section='home')),
        ('end', 'Quadriamo. Gratis durante la beta.', dict()),
    ],
}

if __name__ == '__main__':
    only = sys.argv[1:]
    for name, sc in REELS.items():
        if not only or name in only:
            build(name, sc)
