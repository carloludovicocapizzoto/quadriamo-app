"""Voce narrante dei video: Kokoro (neurale, gira sul Mac, niente servizi esterni), voce italiana.

Lettura "da presentazione di prodotto" (guida: marketing/campagna/11-voce.md):
- ogni frase si genera da sola e i silenzi tra le frasi li decidiamo noi (pause naturali, mai frasi incollate);
- dentro lo script: «|» pausa breve, «||» pausa lunga (lascia respirare una parola importante prima o dopo);
- ritmo progressivo: il gancio un po' più svelto, la parte centrale più distesa, il finale deciso e un filo più lento;
- stile per tipo di video (reel, hero, spot, demo, educativo): velocità e pause diverse;
- catena da studio: taglio dei bassi, calore, presenza, de-esser, compressione morbida, un ambiente appena accennato,
  volume standard dei social (-14 LUFS). La musica sotto si abbassa mentre si parla (ducking, in make_reels.py).
Voce: QUADRIAMO_VOICE (if_sara, predefinita; alternativa maschile im_nicola).
Modelli: cartella .models di budget-planner (kokoro-v1.0.onnx, voices-v1.0.bin), oppure QUADRIAMO_MODELS.
Serve un Python con kokoro-onnx, soundfile e numpy, e espeak-ng di Homebrew.
"""
import os
import re
import subprocess

import numpy as np
import soundfile as sf

VOICE = os.environ.get('QUADRIAMO_VOICE', 'if_sara')
MODELS = os.environ.get('QUADRIAMO_MODELS', os.path.expanduser('~/GitHub/budget-planner/.models'))
ESPEAK_LIB = '/usr/local/opt/espeak-ng/lib/libespeak-ng.dylib'
ESPEAK_DATA = '/usr/local/opt/espeak-ng/share/espeak-ng-data'
SR = 24000

# velocità (1 = normale) del gancio, del corpo e del finale; pause in secondi
STYLES = {
    'reel':  dict(hook=1.05, body=1.0, end=0.96, sentence=0.26, short=0.11, long=0.3),
    'hero':  dict(hook=0.96, body=0.92, end=0.9, sentence=0.5, short=0.22, long=0.6),
    'spot':  dict(hook=1.03, body=0.99, end=0.95, sentence=0.3, short=0.15, long=0.4),
    'demo':  dict(hook=0.98, body=0.96, end=0.95, sentence=0.4, short=0.18, long=0.45),
    'edu':   dict(hook=0.99, body=0.95, end=0.94, sentence=0.42, short=0.2, long=0.5),
}

# EQ da studio: via il rimbombo, un po' di calore, presenza e aria; de-esser; compressione morbida; ambiente minimo; -14 LUFS
STUDIO = ('highpass=f=80,equalizer=f=180:t=q:w=0.9:g=1.2,equalizer=f=350:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.3:g=2,'
          'equalizer=f=10000:t=q:w=1:g=1.5,deesser=i=0.4,'
          'acompressor=threshold=-21dB:ratio=2.8:attack=6:release=140:makeup=2.5,'
          'aecho=0.85:0.5:28|46:0.06|0.04,loudnorm=I=-14:TP=-1.5:LRA=7')
_k = None


def _engine():
    global _k
    if _k is None:
        from kokoro_onnx import EspeakConfig, Kokoro
        _k = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'),
                    espeak_config=EspeakConfig(lib_path=ESPEAK_LIB, data_path=ESPEAK_DATA))
    return _k


def _trim(a, thr=0.006, pad=0.03):
    """Toglie il silenzio prima e dopo una frase (le pause le mettiamo noi)."""
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


def say(text, speed=1.0):
    """Una frase, così com'è (senza segni di pausa)."""
    audio, sr = _engine().create(text, voice=VOICE, speed=speed, lang='it')
    assert sr == SR
    return audio.astype(np.float32)


def perform(text, style='reel', part='body'):
    """Una battuta dello script: frasi e segni di pausa («|», «||») → audio con pause naturali e il ritmo della parte."""
    st = STYLES[style]
    speed = st[part]
    out = []
    # spezza su «||», «|» e sulla fine delle frasi; i segni restano come pause
    tokens = re.split(r'(\|\||\|)', text)
    for tok in tokens:
        if tok == '||':
            out.append(np.zeros(int(st['long'] * SR), np.float32)); continue
        if tok == '|':
            out.append(np.zeros(int(st['short'] * SR), np.float32)); continue
        sentences = [x.strip() for x in re.split(r'(?<=[.!?…])\s+', tok) if x.strip()]
        for i, s in enumerate(sentences):
            out.append(_fade(_trim(say(s, speed))))
            if i < len(sentences) - 1:
                out.append(np.zeros(int(st['sentence'] * SR), np.float32))
    return np.concatenate(out) if out else np.zeros(0, np.float32)


def studio(raw_wav, out_wav):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw_wav, '-af', STUDIO, '-ar', str(SR), out_wav], check=True)
