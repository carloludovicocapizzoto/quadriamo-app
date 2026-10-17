"""Voce narrante dei video: Kokoro (neurale, gira sul Mac, niente servizi esterni), italiano e inglese.

Interpretazione "da doppiatore" (guida: marketing/campagna/11-voce.md):
- la punteggiatura decide pause e intenzione: ogni frase (fino a . ? ! ; :) si genera da sola; dopo, una pausa diversa
  per ogni segno. Le virgole restano dentro la frase: lì la voce si appoggia senza fermarsi;
- nello script «|» è un respiro breve, «||» una pausa lunga;
- intenzione per frase: le domande salgono (curiosità), le frasi brevi affermative scendono (autorevolezza),
  l'invito finale è più energico, il corpo alterna frasi un po' più svelte e un po' più distese;
- ritmo progressivo del video: gancio, corpo, finale (STYLES);
- prima delle frasi lunghe dopo una pausa, un respiro appena udibile (mai una voce che non respira);
- catena da studio: taglio dei bassi, calore, presenza, de-esser, compressione, ambiente minimo, -14 LUFS.
perform() restituisce l'audio e i tempi di ogni frase: servono ai sottotitoli e al montaggio (la voce guida il video).
Voci: QUADRIAMO_VOICE (italiano, predefinita if_sara; maschile im_nicola), QUADRIAMO_VOICE_EN (predefinita af_heart).
Modelli: cartella .models di budget-planner, oppure QUADRIAMO_MODELS. Serve espeak-ng di Homebrew e ffmpeg con rubberband.
"""
import os
import re
import subprocess
import tempfile

import numpy as np
import soundfile as sf

VOICES = {'it': os.environ.get('QUADRIAMO_VOICE', 'if_sara'), 'en': os.environ.get('QUADRIAMO_VOICE_EN', 'af_heart')}
KOKORO_LANG = {'it': 'it', 'en': 'en-us'}
MODELS = os.environ.get('QUADRIAMO_MODELS', os.path.expanduser('~/GitHub/budget-planner/.models'))
ESPEAK_LIB = '/usr/local/opt/espeak-ng/lib/libespeak-ng.dylib'
ESPEAK_DATA = '/usr/local/opt/espeak-ng/share/espeak-ng-data'
SR = 24000

# velocità (1 = normale) di gancio, corpo e finale; pause in secondi dopo una frase, «|» e «||»
STYLES = {
    'reel':  dict(hook=1.05, body=1.0, end=0.97, sentence=0.28, short=0.12, long=0.34),
    'hero':  dict(hook=0.96, body=0.93, end=0.91, sentence=0.48, short=0.22, long=0.6),
    'spot':  dict(hook=1.04, body=0.99, end=0.96, sentence=0.28, short=0.13, long=0.36),
    'demo':  dict(hook=0.98, body=0.96, end=0.95, sentence=0.4, short=0.18, long=0.45),
    'edu':   dict(hook=0.99, body=0.95, end=0.94, sentence=0.42, short=0.2, long=0.5),
}
# pausa dopo ogni segno, rispetto alla pausa di frase
AFTER = {'.': 1.0, '?': 1.25, '!': 0.9, ';': 0.75, ':': 0.55, '…': 1.3}
RHYTHM = [1.0, 0.965, 1.03, 0.985]   # nel corpo le frasi alternano un passo più disteso e uno più svelto

STUDIO = ('highpass=f=80,equalizer=f=180:t=q:w=0.9:g=1.2,equalizer=f=350:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.3:g=2,'
          'equalizer=f=10000:t=q:w=1:g=1.5,deesser=i=0.4,'
          'acompressor=threshold=-21dB:ratio=2.8:attack=6:release=140:makeup=2.5,'
          'aecho=0.85:0.5:28|46:0.06|0.04,loudnorm=I=-14:TP=-1.5:LRA=8')
_k = None


def _engine():
    global _k
    if _k is None:
        from kokoro_onnx import EspeakConfig, Kokoro
        _k = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'),
                    espeak_config=EspeakConfig(lib_path=ESPEAK_LIB, data_path=ESPEAK_DATA))
    return _k


def _trim(a, thr=0.006, pad=0.03):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a[:0]
    p = int(pad * SR)
    return a[max(0, idx[0] - p): idx[-1] + p]


def _fade(a, ms=12):
    n = min(len(a) // 2, int(SR * ms / 1000))
    if n:
        a = a.copy(); r = np.linspace(0, 1, n, dtype=np.float32)
        a[:n] *= r; a[-n:] *= r[::-1]
    return a


def _pitch(a, semitones):
    """Sposta l'intonazione di pochi decimi di tono senza cambiare durata né timbro (rubberband, formanti preservate)."""
    if abs(semitones) < 0.05 or not len(a):
        return a
    with tempfile.TemporaryDirectory() as d:
        i, o = os.path.join(d, 'i.wav'), os.path.join(d, 'o.wav')
        sf.write(i, a, SR)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', i, '-af',
                        f'rubberband=pitch={2 ** (semitones / 12):.5f}:formant=preserved:pitchq=quality', o], check=True)
        b, _ = sf.read(o, dtype='float32')
    return b


def _breath(seconds=0.24, level=0.012):
    """Un respiro appena udibile: rumore morbido nella banda della voce, che sale e scende."""
    n = int(seconds * SR)
    noise = np.random.default_rng(3).standard_normal(n).astype(np.float32)
    k = np.hanning(41).astype(np.float32); k /= k.sum()
    soft = np.convolve(noise, k, mode='same') - np.convolve(noise, np.ones(301, np.float32) / 301, mode='same')
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    out = soft * env
    return (out / (np.abs(out).max() + 1e-9) * level).astype(np.float32)


def say(text, speed=1.0, lang='it'):
    audio, sr = _engine().create(text, voice=VOICES[lang], speed=speed, lang=KOKORO_LANG[lang])
    assert sr == SR
    return audio.astype(np.float32)


def clean(text):
    """Il testo da mostrare (sottotitoli): senza i segni di pausa."""
    return re.sub(r'\s*\|+\s*', ' ', text).replace('  ', ' ').strip()


def perform(text, style='reel', part='body', lang='it'):
    """Una battuta → (audio, frasi) dove frasi = [(inizio, fine, testo)] in secondi dall'inizio della battuta."""
    st = STYLES[style]
    base = st[part]
    pieces, cues, t = [], [], 0.0
    pending_pause = 0.0
    # gruppi separati da «|» o «||»; dentro, frasi che finiscono con . ? ! ; : …
    tokens = re.split(r'(\|\||\|)', text)
    sentences = []
    for tok in tokens:
        if tok in ('|', '||'):
            sentences.append(tok); continue
        sentences += [x.strip() for x in re.split(r'(?<=[.?!;:…])\s+', tok) if x.strip()]
    spoken = [s for s in sentences if s not in ('|', '||')]
    for idx, s in enumerate(sentences):
        if s == '|':
            pending_pause = max(pending_pause, st['short']); continue
        if s == '||':
            pending_pause = max(pending_pause, st['long']); continue
        k = spoken.index(s) if s in spoken else 0
        words = len(s.split())
        last = s[-1]
        speed, semis, gain = base, 0.0, 1.0
        if part == 'body':
            speed *= RHYTHM[k % len(RHYTHM)]
        if last == '?':
            speed *= 1.03; semis = 0.55                       # curiosità: l'intonazione sale
        elif words <= 3 and part != 'hook':
            speed *= 0.94; semis = -0.35                      # frase breve: più lenta, più bassa, autorevole
        if part == 'end':
            if k == 0:
                speed *= 0.95; semis = -0.25                  # il nome, deciso
            else:
                speed *= 1.03; semis = 0.2; gain = 1.12       # l'invito, più energico
        if last == '!':
            gain *= 1.08
        # un respiro prima delle frasi lunghe, dopo una pausa vera (o in apertura)
        if words >= 6 and (pending_pause >= 0.3 or not pieces):
            b = _breath(min(0.26, max(0.18, pending_pause * 0.7)))
            gap = max(0.0, pending_pause - len(b) / SR)
            pieces += [np.zeros(int(gap * SR), np.float32), b]
            t += gap + len(b) / SR
        elif pending_pause:
            pieces.append(np.zeros(int(pending_pause * SR), np.float32)); t += pending_pause
        a = _fade(_trim(_pitch(say(s, speed, lang), semis))) * gain
        cues.append((round(t, 3), round(t + len(a) / SR, 3), clean(s)))
        pieces.append(a.astype(np.float32)); t += len(a) / SR
        pending_pause = st['sentence'] * AFTER.get(last, 0.6)
    return (np.concatenate(pieces) if pieces else np.zeros(0, np.float32)), cues


def studio(raw_wav, out_wav):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw_wav, '-af', STUDIO, '-ar', str(SR), out_wav], check=True)
