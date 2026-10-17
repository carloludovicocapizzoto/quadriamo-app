"""Reel della campagna (1080x1920, 30 fps), in italiano e in inglese, con voce, sottotitoli, tappeto musicale e suoni.

Ogni scena è disegnata fotogramma per fotogramma con Pillow e passata a ffmpeg:
  title  — testo cinetico: le parole salgono e compaiono una dopo l'altra (la misura si adatta alla riga più lunga)
  phone  — il telefono entra dal basso con una molla; zoom lento su un dettaglio (focus), scorrimento di una pagina intera
           (stack) o dissolvenza tra il prima e il dopo (swap)
  end    — il marchio, «Gratis durante la beta», «Link nella bio»
LA VOCE GUIDA IL VIDEO: ogni scena dura quanto la sua battuta (voice.perform, stile reel o hero, ritmo gancio-corpo-finale);
zoom e dissolvenze partono quando la voce arriva alla frase che li nomina (la seconda frase della battuta).
Sottotitoli: dai tempi esatti di ogni frase, a blocchi logici (mai una frase spezzata a caso), su una lastra scura discreta;
in più un file .srt per caricarli sulle piattaforme. Nelle battute «|» è un respiro, «||» una pausa lunga.
Musica e suoni sono generati qui (niente diritti); la musica si abbassa sotto la voce.
Uso (dalla cartella quadriamo-app): <python con Pillow, numpy, kokoro-onnx, soundfile> marketing/make_reels.py [nome…] [--lang it|en]
Escono: out/video/<nome>.mp4 e .srt (italiano), out/video/en/<nome>.mp4 e .srt (inglese, schermate in inglese).
"""
import math, os, re, subprocess, sys
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw
from brandkit import CAMPAIGN_SHOTS, CREAM, OUT, SITE, SOFT, glass, mark, sans, scene, title as headline, wordmark
from voice import SR, perform, studio

W, H, FPS = 1080, 1920, 30
DST = os.path.join(OUT, 'video')
WORK = os.path.join(DST, '_work')
os.makedirs(WORK, exist_ok=True)
LEAD, TAIL, MIN_SCENE = 0.25, 0.45, 2.0
THEME = {'it': 'dark', 'en': 'en-dark'}
END = {'it': ('Gratis durante la beta', 'iPhone · Android · computer', 'Link nella bio ↑'),
       'en': ('Free during the beta', 'iPhone · Android · desktop', 'Link in bio ↑')}


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


def wrap(d, text, font, width):
    lines, line = [], ''
    for w_ in text.split():
        t = (line + ' ' + w_).strip()
        if d.textlength(t, font=font) <= width:
            line = t
        else:
            lines.append(line); line = w_
    return lines + [line] if line else lines


def caption(img, text, alpha=1.0, y=170):
    if not text or alpha <= 0:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = headline(78)
    rise = int((1 - alpha) * 24)
    for i, ln in enumerate(wrap(d, text, f, W - 160)):
        d.text((W / 2, y + i * 86 + rise), ln, font=f, fill=CREAM + (int(255 * alpha),), anchor='ma')
    img.alpha_composite(layer)


# ---------- sottotitoli ----------
SUB_FONT, SUB_W, SUB_Y = sans(42, 600), 840, 1440


def sub_blocks(cues):
    """Frasi → blocchi da leggere: al massimo due righe; le frasi lunghe si dividono a una virgola o ai due punti,
    mai a metà di un gruppo di parole; i tempi dei pezzi sono proporzionali alle lettere."""
    d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    merged = []   # un pezzo che finisce con virgola o due punti resta con il seguito, se ci sta (mai «Lo salvi,» da solo)
    for t0, t1, text in cues:
        if merged and merged[-1][2][-1] in ',:' and len(merged[-1][2]) + len(text) < 44 and t0 - merged[-1][1] < 0.4:
            merged[-1] = (merged[-1][0], t1, merged[-1][2] + ' ' + text)
        else:
            merged.append((t0, t1, text))
    out = []
    for t0, t1, text in merged:
        parts = [text]
        if len(wrap(d, text, SUB_FONT, SUB_W)) > 2:
            pieces = re.split(r'(?<=[,:;])\s+', text)
            parts, cur = [], ''
            for p in pieces:
                cand = (cur + ' ' + p).strip()
                if cur and len(wrap(d, cand, SUB_FONT, SUB_W)) > 2:
                    parts.append(cur); cur = p
                else:
                    cur = cand
            parts.append(cur)
        total = sum(len(p) for p in parts)
        t = t0
        for p in parts:
            dt = (t1 - t0) * len(p) / total
            out.append([t, t + dt, p]); t += dt
    for i, b in enumerate(out):   # resta un attimo dopo la fine della frase, senza sovrapporsi alla successiva
        nxt = out[i + 1][0] if i + 1 < len(out) else b[1] + 0.6
        b[1] = min(b[1] + 0.25, nxt - 0.04)
    return out


def balanced(d, text):
    """Due righe di lunghezza simile (mai una parola sola a capo), spezzando di preferenza dopo una virgola."""
    lines = wrap(d, text, SUB_FONT, SUB_W)
    if len(lines) != 2:
        return lines
    ws = text.split()
    best = None
    for k in range(1, len(ws)):
        a, b = ' '.join(ws[:k]), ' '.join(ws[k:])
        wa, wb = d.textlength(a, font=SUB_FONT), d.textlength(b, font=SUB_FONT)
        if max(wa, wb) > SUB_W:
            continue
        cost = abs(wa - wb) - (120 if a[-1] in ',:;' else 0)
        if best is None or cost < best[0]:
            best = (cost, [a, b])
    return best[1] if best else lines


def draw_sub(img, text, alpha):
    if alpha <= 0:
        return
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lines = balanced(d, text)
    lh = 54
    w_ = max(d.textlength(ln, font=SUB_FONT) for ln in lines)
    h_ = lh * len(lines)
    x0, y0 = W / 2 - w_ / 2 - 26, SUB_Y - h_ / 2 - 16
    d.rounded_rectangle([x0, y0, W / 2 + w_ / 2 + 26, SUB_Y + h_ / 2 + 16], radius=20, fill=(10, 12, 16, int(222 * alpha)))
    for i, ln in enumerate(lines):
        d.text((W / 2, SUB_Y - h_ / 2 + i * lh + lh / 2 + 1), ln, font=SUB_FONT, fill=(250, 248, 244, int(255 * alpha)), anchor='mm')
    img.alpha_composite(layer)


def words(text):
    return re.findall(r"\w+", text.lower())


def shown(block, opts):
    """Il sottotitolo è già scritto grande sulla scena (titolo cinetico)? Allora non si ripete."""
    on = set(words(' '.join(opts.get('lines', [])) + ' ' + (opts.get('sub') or '')))
    w = words(block)
    return bool(w) and sum(x in on for x in w) / len(w) >= 0.5


def srt(blocks, path):
    ts = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round((s % 1) * 1000)) % 1000:03d}'
    with open(path, 'w') as f:
        for i, (a, b, text) in enumerate(blocks, 1):
            f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{text}\n\n')


# ---------- scene ----------
def render_title(lines, section, seconds, sub=None, **_):
    bg = scene(W, H, section)
    words = [(li, w_) for li, ln in enumerate(lines) for w_ in ln.split()]
    tmp = ImageDraw.Draw(bg)
    size = 104
    while size > 64 and max(tmp.textlength(ln, font=headline(size)) for ln in lines) > W - 140:
        size -= 4
    f = headline(size)
    lh = int(size * 1.19)
    widths = [tmp.textlength(ln, font=f) for ln in lines]
    top = H / 2 - len(lines) * lh / 2 - 60 - (40 if sub else 0)
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
                d.text((x[li], top + li * lh + (1 - a) * 30), w_, font=f, fill=CREAM + (int(255 * a),))
            x[li] += d.textlength(w_ + ' ', font=f)
        if sub:
            a = ease_out((t - 0.3 - len(words) * 0.11) / 0.5)
            d.text((W / 2, top + len(lines) * lh + 40 + (1 - a) * 20), sub, font=sans(44), fill=SOFT + (int(255 * a),), anchor='ma')
        img.alpha_composite(layer)
        frames.append(img)
    return frames


def render_phone(shot, section, seconds, text=None, focus=None, stack=None, swap=None, theme='dark', cue=0.9, **_):
    """focus=(x, y, zoom) in proporzione dello schermo; stack=pagina intera da far scorrere; swap=shot2: dissolvenza.
    cue: il secondo in cui la voce arriva al dettaglio (lì partono zoom e dissolvenza)."""
    bg = scene(W, H, section)
    if stack:
        name, start = stack if isinstance(stack, tuple) else (stack, 0)
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
    for n in range(int(seconds * FPS)):
        t = n / FPS
        img = bg.copy()
        caption(img, text, ease_out((t - 0.05) / 0.45))
        if stack:   # lo schermo scorre come un dito che sale
            p = ease_in_out((t - 0.7) / max(0.8, seconds - 1.2))
            y0 = int(p * (tall.height - view_h))
            phone = device_frame(tall.crop((0, y0, tall.width, y0 + view_h)))
        elif swap:
            p = ease_out((t - cue) / 0.5)
            phone = Image.blend(phone_a, phone_b, p) if p > 0 else phone_a
        else:
            phone = phone_a
        enter = spring(t / 0.9)
        y = top0 + (1 - enter) * 900
        scale = 1.0
        cx, cy = W / 2, y + phone.height / 2
        if focus:   # zoom lento verso il dettaglio, da quando la voce lo nomina
            fx, fy, z = focus
            p = ease_out((t - cue) / max(0.6, seconds - cue - 0.4))
            scale = 1 + (z - 1) * p
            cx = W / 2 + (0.5 - fx) * phone.width * (scale - 1)
            cy = y + phone.height / 2 + (0.5 - fy) * phone.height * (scale - 1)
        ph = phone if scale == 1 else phone.resize((int(phone.width * scale), int(phone.height * scale)), Image.BILINEAR)
        img.alpha_composite(ph, (int(cx - ph.width / 2), int(cy - ph.height / 2)))
        frames.append(img)
    return frames


def render_end(seconds, section='home', lang='it', **_):
    bg = scene(W, H, section)
    free, devices, link = END[lang]
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
        d.text((W / 2, 1010), free, font=sans(54, 600), fill=CREAM, anchor='mm')
        d.text((W / 2, 1085), devices, font=sans(40), fill=SOFT, anchor='mm')
        alpha = layer.split()[3].point(lambda v: int(v * a))
        layer.putalpha(alpha)
        img.alpha_composite(layer)
        b = ease_out((t - 0.5) / 0.5)
        if b > 0:
            glass(img, (240, 1250, W - 240, 1390), radius=44)
            ImageDraw.Draw(img).text((W / 2, 1320), link, font=sans(46, 600), fill=CREAM, anchor='mm')
        ImageDraw.Draw(img).text((W / 2, 1480), SITE, font=sans(30), fill=SOFT, anchor='mm')
        frames.append(img)
    return frames


# ---------- audio: tappeto, fruscio, ducking ----------
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


def duck(voice, bed, depth=0.4, attack=0.06, release=0.35):
    """La musica scende (a `depth` del volume) mentre la voce parla e risale piano nelle pause."""
    env = np.abs(voice[:len(bed)])
    win = int(0.05 * SR)
    env = np.convolve(env, np.ones(win) / win, mode='same') > 0.01
    gain, g = np.ones(len(bed), np.float32), 1.0
    a, r = 1 / (attack * SR), 1 / (release * SR)
    for i in range(0, len(bed), 64):
        target = depth if env[i] else 1.0
        g = max(target, g - a * 64) if target < g else min(target, g + r * 64)
        gain[i:i + 64] = g
    return bed * gain


def pick(v, lang):
    return v[lang] if isinstance(v, dict) and lang in v else v


def build(name, scenes, style='reel', lang='it'):
    """scenes: [(tipo, battuta {it, en}, opzioni)]. Scrive il video e i sottotitoli (.srt)."""
    work = os.path.join(WORK, f'{name}-{lang}')
    os.makedirs(work, exist_ok=True)
    voice_track, durations, all_cues, scene_cues = [], [], [], []
    start = 0.0
    for k, (kind, line, opts) in enumerate(scenes):
        part = 'hook' if k == 0 else 'end' if k == len(scenes) - 1 else 'body'
        text = pick(line, lang)
        v, cues = perform(text, style, part, lang) if text else (np.zeros(0, np.float32), [])
        sec = max(opts.get('min', MIN_SCENE), LEAD + len(v) / SR + TAIL)
        seg = np.zeros(int(round(sec * SR)), np.float32)
        s0 = int(LEAD * SR)
        seg[s0:s0 + len(v)] = v[:len(seg) - s0]
        voice_track.append(seg); durations.append(sec); scene_cues.append(cues)
        all_cues += [(start + LEAD + a, start + LEAD + b, t) for a, b, t in cues]
        start += sec
    total = sum(durations)
    raw = os.path.join(work, 'voce.raw.wav')
    sf.write(raw, np.concatenate(voice_track), SR)
    voice = os.path.join(work, 'voce.wav')
    studio(raw, voice)
    v, _ = sf.read(voice, dtype='float32')
    bed = duck(v, pad(total)[:len(v)] * 1.6)
    fx = np.zeros_like(bed)
    pos = 0.0
    for sec in durations[:-1]:
        pos += sec
        w_ = whoosh()
        i = max(0, int((pos - 0.22) * SR))
        fx[i:i + len(w_)] += w_[:len(fx) - i]
    mix = os.path.join(work, 'mix.wav')
    sf.write(mix, np.clip(v[:len(bed)] + bed + fx, -1, 1), SR)

    folder = DST if lang == 'it' else os.path.join(DST, lang)
    os.makedirs(folder, exist_ok=True)
    out = os.path.join(folder, f'{name}.mp4')
    blocks = sub_blocks(all_cues)
    srt(blocks, out[:-4] + '.srt')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-i', mix, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                           '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    prev, t_scene = None, 0.0
    for (kind, line, opts), sec, cues in zip(scenes, durations, scene_cues):
        o = {k: pick(v_, lang) for k, v_ in opts.items() if k != 'min'}
        cue = LEAD + cues[1][0] if len(cues) > 1 else 0.9   # la voce arriva al dettaglio: lì parte lo zoom
        if kind == 'title':
            frames = render_title(seconds=sec, **o)
        elif kind == 'end':
            frames = render_end(sec, lang=lang, **o)
        else:
            frames = render_phone(seconds=sec, theme=THEME[lang], cue=cue, **o)
        for j, fr in enumerate(frames):
            if prev is not None and j < 8:   # dissolvenza di 8 fotogrammi dalla scena prima
                fr = Image.blend(prev, fr, (j + 1) / 9)
            if kind != 'end':   # nella scena finale il marchio e l'invito sono già scritti
                tg = t_scene + j / FPS
                for a, b, text in blocks:
                    if a - 0.08 <= tg <= b + 0.12 and not (kind == 'title' and shown(text, o)):
                        draw_sub(fr, text, min(1, (tg - a + 0.08) / 0.12, (b + 0.12 - tg) / 0.12))
                        break
            ff.stdin.write(fr.convert('RGB').tobytes())
        prev = frames[-1]
        t_scene += sec
    ff.stdin.close(); ff.wait()
    print(out, f'{total:.1f} s')
    return out


def T(it, en):
    return {'it': it, 'en': en}


REELS = {
    'reel-01-adesso': [
        ('title', T('Ogni mattina, | la stessa domanda: || cosa devo sapere, oggi?', 'Every morning, | the same question: || what do I need to know today?'),
         dict(lines=T(['Cosa devo sapere', 'oggi?'], ['What do I need', 'to know today?']), section='home', sub=T('Sono le 8:12.', 'It’s 8:12.'))),
        ('phone', T('Quadriamo ti risponde con un numero: | quanto puoi spendere oggi.', 'Quadriamo answers with a single number: | what you can spend today.'),
         dict(shot='01-home.png', section='home', text=T('Quanto puoi spendere oggi.', 'What you can spend today.'), focus=(0.3, 0.12, 1.35))),
        ('phone', T('E subito sotto, | quello che conta. | Una bolletta da segnare. | Un pagamento domani. | Un abbonamento che è aumentato.',
                    'And right below it, | what matters. | A bill to mark as paid. | A payment due tomorrow. | A subscription that just went up.'),
         dict(shot='01-home.png', section='home', text=T('E cosa conta, in fila.', 'And what matters, in order.'), focus=(0.5, 0.36, 1.45))),
        ('phone', T('Tutto il resto? | Lo trovi scorrendo. || Niente di più.', 'Everything else? | Just scroll. || Nothing more.'),
         dict(shot='01-home.png', section='home', text=T('Il resto, quando vuoi.', 'The rest, when you want it.'), stack='40-tall-home.png')),
        ('end', T('Quadriamo. || Gratis, durante la beta. | Il link è nella bio.', 'Quadriamo. || Free during the beta. | Link in bio.'), dict()),
    ],
    'reel-02-costo-annuale': [
        ('title', T('Quanto spendi di abbonamenti in un anno? || Prova a indovinare.', 'How much do you spend on subscriptions in a year? || Take a guess.'),
         dict(lines=T(['Quanto spendi', 'di abbonamenti', 'in un anno?'], ['How much do', 'subscriptions', 'cost you a year?']), section='profile')),
        ('phone', T('Aggiungerli è un attimo: | cerchi il servizio, lo tocchi, scrivi il prezzo.', 'Adding them takes seconds: | find the service, tap it, type the price.'),
         dict(shot='11-service-picker.png', section='profile', text=T('Ottanta servizi, in un attimo.', '80 services, in seconds.'))),
        ('phone', T('E se un prezzo sale, te ne accorgi. || Netflix? | Più trentotto per cento.', 'And when a price goes up, you’ll know. || Netflix? | Up thirty-eight percent.'),
         dict(shot='10-subscriptions.png', section='profile', text=T('Gli aumenti, in evidenza.', 'Price rises, in plain sight.'), focus=(0.8, 0.5, 1.55))),
        ('phone', T('Poi ogni abbonamento diventa un blocco, | grande quanto ti costa in un anno.', 'Then every subscription becomes a block, | sized by what it costs you in a year.'),
         dict(shot='13-year-cost.png', section='profile', text=T('Ogni blocco, un anno.', 'Each block, one year.'))),
        ('phone', T('Adesso, togline uno. || Senza DAZN, | risparmieresti quasi quattrocentoventi euro l’anno.',
                    'Now, take one away. || Without DAZN, | you’d save almost four hundred and twenty euros a year.'),
         dict(shot='13-year-cost.png', section='profile', text=T('Prova senza.', 'Try without it.'), swap='15-year-cost-without.png')),
        ('end', T('Quadriamo. || Gratis, durante la beta.', 'Quadriamo. || Free during the beta.'), dict()),
    ],
    'reel-03-ricevuta': [
        ('title', T('Ottobre è finito. || Ecco il tuo scontrino.', 'October’s over. || Here’s your receipt.'),
         dict(lines=T(['Ottobre è finito.', 'Ecco lo scontrino.'], ['October’s over.', 'Here’s your receipt.']), section='analysis')),
        ('phone', T('Dove sono finiti i soldi. | Com’è andata rispetto a settembre. | Il giorno più caro.', 'Where the money went. | How it compares with September. | Your most expensive day.'),
         dict(shot='16-receipt.png', section='analysis', text=T('Il mese, in uno scontrino.', 'Your month, on one receipt.'), stack=('41-tall-receipt.png', 0.615))),
        ('phone', T('Lo salvi, | o lo condividi. || Lo crea il tuo telefono: | nessun server.', 'Save it, | or share it. || Your phone makes it: | no server involved.'),
         dict(shot='41-tall-receipt.png@0.985', section='analysis', text=T('Da condividere.', 'Made to share.'), focus=(0.5, 0.62, 1.35))),
        ('end', T('Quadriamo. || Il mese, in uno scontrino. | Gratis, durante la beta.', 'Quadriamo. || Your month, on one receipt. | Free during the beta.'), dict(section='analysis')),
    ],
    'reel-04-niente-sorprese': [
        ('title', T('Il giorno prima del volo, | scopri che la carta d’identità… | è scaduta.', 'The day before your flight, | you find out your ID card… | has expired.'),
         dict(lines=T(['Il giorno prima', 'del volo.'], ['The day before', 'your flight.']), section='profile', sub=T('La carta d’identità è scaduta.', 'Your ID card has expired.'))),
        ('phone', T('Con Quadriamo lo sai un mese prima. | Vale anche per patente e assicurazione.', 'With Quadriamo, you know a month ahead. | Same for your driving licence and car insurance.'),
         dict(shot='18-documents.png', section='profile', text=T('Le scadenze, prima.', 'Deadlines, ahead of time.'))),
        ('phone', T('E nel calendario vedi cosa hai già pagato, | cosa manca, | e quanto ti resta a fine mese.',
                    'And the calendar shows what you’ve already paid, | what’s still due, | and what’s left at the end of the month.'),
         dict(shot='04-calendar.png', section='analysis', text=T('Il mese, giorno per giorno.', 'Your month, day by day.'), focus=(0.5, 0.2, 1.3))),
        ('phone', T('I promemoria arrivano al momento giusto. || E mai troppi.', 'Reminders arrive right when you need them. || And never too many.'),
         dict(shot='09-inbox.png', section='profile', text=T('Promemoria discreti.', 'Quiet reminders.'))),
        ('end', T('Quadriamo. || Niente sorprese. | Gratis, durante la beta.', 'Quadriamo. || No surprises. | Free during the beta.'), dict()),
    ],
    'reel-05-parti-da-dove-sei': [
        ('title', T('Hai dei risparmi da parte. || Ma quanto puoi davvero toccare?', 'You’ve put some money aside. || But how much can you actually touch?'),
         dict(lines=T(['Hai dei risparmi.', 'Quanto puoi toccare?'], ['You have savings.', 'How much can you touch?']), section='invest')),
        ('phone', T('Dividili per uso: | fondo di emergenza, | liquidità, | soldi da far crescere. || Ognuno, con la sua regola.',
                    'Split it by purpose: | emergency fund, | spending money, | money to grow. || Each with its own rule.'),
         dict(shot='19-capital.png', section='invest', text=T('Ogni euro con la sua regola.', 'Every euro, its own rule.'))),
        ('phone', T('Così il tuo budget | parte da dove sei davvero.', 'So your budget starts | from where you really are.'),
         dict(shot='01-home.png', section='home', text=T('Il budget parte da qui.', 'Your budget starts here.'))),
        ('end', T('Quadriamo. || Gratis, durante la beta.', 'Quadriamo. || Free during the beta.'), dict()),
    ],
    'hero-01-quadriamo-adesso': [
        ('title', T('I tuoi soldi, || in quattro.', 'Your money, || in four.'), dict(lines=T(['I tuoi soldi,', 'in quattro.'], ['Your money,', 'in four.']), section='home', min=3.0)),
        ('phone', T('Ogni mattina, un numero: | quanto puoi spendere oggi.', 'Every morning, one number: | what you can spend today.'),
         dict(shot='01-home.png', section='home', text=T('Oggi.', 'Today.'), focus=(0.3, 0.12, 1.3))),
        ('phone', T('E quello che conta, | prima che tu lo chieda.', 'And what matters, | before you even ask.'),
         dict(shot='01-home.png', section='home', text=T('Adesso.', 'Now.'), focus=(0.5, 0.36, 1.4))),
        ('phone', T('Il mese, giorno per giorno. | Cosa hai pagato, | cosa arriva, | quanto resta.', 'Your month, day by day. | What you’ve paid, | what’s coming, | what’s left.'),
         dict(shot='04-calendar.png', section='analysis', text=T('Niente sorprese.', 'No surprises.'))),
        ('phone', T('I promemoria arrivano quando servono. || E non di più.', 'Reminders, right when you need them. || And no more.'),
         dict(shot='09-inbox.png', section='profile', text=T('Discreto.', 'Quiet.'))),
        ('phone', T('Gli abbonamenti, | grandi quanto costano davvero.', 'Subscriptions, | as big as they really are.'),
         dict(shot='13-year-cost.png', section='profile', text=T('Quello che non vedi.', 'What you don’t see.'), swap='15-year-cost-without.png')),
        ('phone', T('I documenti, | prima che scadano.', 'Documents, | before they expire.'),
         dict(shot='18-documents.png', section='profile', text=T('In tempo.', 'On time.'))),
        ('phone', T('I risparmi che hai già, | ognuno con la sua regola.', 'The savings you already have, | each with its own rule.'),
         dict(shot='19-capital.png', section='invest', text=T('Parti da dove sei.', 'Start where you are.'))),
        ('phone', T('E a fine mese, | il mese in uno scontrino.', 'And at the end of the month, | your month on a single receipt.'),
         dict(shot='16-receipt.png', section='analysis', text=T('Il mese, stampato.', 'Your month, printed.'), stack=('41-tall-receipt.png', 0.615))),
        ('title', T('Tutto calcolato sul tuo telefono. || I tuoi dati? | Li vedi solo tu.', 'All worked out on your phone. || Your data? | Only you can see it.'),
         dict(lines=T(['I tuoi soldi', 'sono affari tuoi.'], ['Your money is', 'your business.']), section='home')),
        ('end', T('Quadriamo. || Gratis, durante la beta.', 'Quadriamo. || Free during the beta.'), dict()),
    ],
}

if __name__ == '__main__':
    args = sys.argv[1:]
    langs = ['it', 'en']
    if '--lang' in args:
        i = args.index('--lang'); langs = [args[i + 1]]; args = args[:i] + args[i + 2:]
    for name, sc in REELS.items():
        if not args or name in args:
            for lang in langs:
                build(name, sc, 'hero' if name.startswith('hero') else 'reel', lang)
