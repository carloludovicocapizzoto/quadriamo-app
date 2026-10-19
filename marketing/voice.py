"""Voce narrante dei video: Kokoro (neurale, gira sul Mac, niente servizi esterni), italiano e inglese.

Interpretazione "da doppiatore" (guida: marketing/campagna/11-voce.md):
- la punteggiatura decide pause e intenzione: ogni frase (fino a . ? ! ; :) si genera da sola; dopo, una pausa diversa
  per ogni segno. Le virgole restano dentro la frase: lì la voce si appoggia senza fermarsi;
- nello script «|» è un respiro breve, «||» una pausa lunga;
- intenzione per frase: le domande salgono (curiosità), le frasi brevi affermative scendono (autorevolezza),
  l'invito finale è più energico, il corpo alterna frasi un po' più svelte e un po' più distese;
- ritmo progressivo del video: gancio, corpo, finale (STYLES);
- dizione: le vocali finali restano piene (il fonemizzatore italiano le rende «rilassate» all'inglese: ogni → ognɪ,
  più → pjʊ; qui si correggono), sigle e nomi con la pronuncia giusta (LEXICON), finali di parola mai tagliati;
- niente respiri aggiunti né suoni aspirati: l'intonazione si fa con velocità, volume e pause, senza spostare il tono
  (lo spostamento del tono aggiungeva "aria");
- catena da studio: riduzione del rumore, controllo dei respiri (espansore: il fiato tra le parole scende di ~14 dB),
  calore e corpo, meno aria sopra i 6 kHz, presenza, de-esser, compressione leggera, limitatore, -14 LUFS.
perform() restituisce l'audio e i tempi di ogni frase: servono ai sottotitoli e al montaggio (la voce guida il video).
Voci: QUADRIAMO_VOICE (italiano: miscela maschile im_nicola + em_alex; femminile if_sara), QUADRIAMO_VOICE_EN (miscela am_echo + am_puck; femminile af_heart).
Modelli: cartella .models di budget-planner, oppure QUADRIAMO_MODELS. Serve espeak-ng di Homebrew e ffmpeg con rubberband.
"""
import os
import re
import subprocess

import numpy as np
import soundfile as sf

# una voce o una miscela di timbri («im_nicola:0.35,em_alex:0.65»): la firma maschile è una miscela originale, non la copia di nessuno
VOICES = {'it': os.environ.get('QUADRIAMO_VOICE', 'im_nicola:0.35,em_alex:0.65'), 'en': os.environ.get('QUADRIAMO_VOICE_EN', 'am_echo:0.6,am_puck:0.4')}
CLOSE_FALL = os.environ.get('QUADRIAMO_CLOSE', '0') == '1'   # 1: punto finale nella fonetica (discesa più lunga sulle code)
KOKORO_LANG = {'it': 'it', 'en': 'en-us'}
MODELS = os.environ.get('QUADRIAMO_MODELS', os.path.expanduser('~/GitHub/budget-planner/.models'))
ESPEAK_LIB = '/usr/local/opt/espeak-ng/lib/libespeak-ng.dylib'
ESPEAK_DATA = '/usr/local/opt/espeak-ng/share/espeak-ng-data'
SR = 24000

# velocità (1 = normale) di gancio, corpo e finale; pause in secondi dopo una frase, «|» e «||»
STYLES = {
    'reel':  dict(hook=1.1, body=1.06, end=1.02, sentence=0.26, short=0.1, long=0.3),
    'hero':  dict(hook=1.0, body=0.98, end=0.96, sentence=0.42, short=0.18, long=0.5),
    'spot':  dict(hook=1.09, body=1.05, end=1.01, sentence=0.26, short=0.11, long=0.32),
    'demo':  dict(hook=1.03, body=1.01, end=0.99, sentence=0.36, short=0.15, long=0.4),
    'edu':   dict(hook=1.03, body=1.0, end=0.98, sentence=0.38, short=0.17, long=0.45),
}
# pausa dopo ogni segno, rispetto alla pausa di frase
AFTER = {'.': 1.0, '?': 1.25, '!': 0.9, ';': 0.75, ':': 0.55, '…': 1.3}
RHYTHM = [1.0, 0.965, 1.03, 0.985]   # nel corpo le frasi alternano un passo più disteso e uno più svelto

STUDIO = ('highpass=f=85,afftdn=nr=10:nf=-48,'
          'agate=threshold=0.012:ratio=2:range=0.2:attack=4:release=140:knee=4,'        # il fiato tra le parole si abbassa
          'equalizer=f=250:t=q:w=1:g=-2,'                                                 # niente rimbombo: voce chiara, non cupa
          'equalizer=f=3000:t=q:w=1.1:g=2.5,equalizer=f=7500:t=q:w=1.4:g=-2,'             # presenza e dizione; meno fiato
          'lowpass=f=14000,deesser=i=0.5:m=0.5:f=0.5,'
          'acompressor=threshold=-22dB:ratio=2.5:attack=6:release=140:makeup=2.5,'
          'alimiter=limit=0.84:attack=5:release=60,loudnorm=I=-14:TP=-1.5:LRA=7')
# pronunce da correggere prima della fonetica (parola → come si scrive per dirla bene)
LEXICON = {'it': {'DAZN': 'Dazòn', 'PAC': 'Pac', 'iCloud': 'aiclaud'}, 'en': {'DAZN': 'Da Zone'}}
_k = None


def _engine():
    global _k
    if _k is None:
        from kokoro_onnx import EspeakConfig, Kokoro
        _k = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'),
                    espeak_config=EspeakConfig(lib_path=ESPEAK_LIB, data_path=ESPEAK_DATA))
    return _k


def _trim(a, thr=0.004, pad=0.03, tail=0.045):
    """Toglie il silenzio ai lati senza mai tagliare la coda dell'ultima sillaba."""
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a[:0]
    return a[max(0, idx[0] - int(pad * SR)): idx[-1] + int(tail * SR)]


def _fade(a, ms_in=6, ms_out=25):
    """Attacco netto (consonanti definite), uscita morbida (nessun clic, nessuna finale troncata)."""
    a = a.copy()
    n, m = min(len(a) // 2, int(SR * ms_in / 1000)), min(len(a) // 2, int(SR * ms_out / 1000))
    if n: a[:n] *= np.linspace(0, 1, n, dtype=np.float32)
    if m: a[-m:] *= np.linspace(1, 0, m, dtype=np.float32) ** 2
    return a


def phonemes(text, lang='it'):
    """La fonetica della frase, corretta: in italiano le vocali finali restano piene (ɪ → i, ʊ → u)."""
    for w, say_as in LEXICON.get(lang, {}).items():
        text = re.sub(rf'\b{re.escape(w)}\b', say_as, text)
    ph = _engine().tokenizer.phonemize(text, KOKORO_LANG[lang])
    if lang == 'it':
        ph = ph.replace('ɪ', 'i').replace('ʊ', 'u')
    if not CLOSE_FALL:
        ph = ph.rstrip(' .;:')
    return ph


def _voice(spec):
    if ':' not in spec:
        return spec
    k = _engine()
    return sum(k.voices[n] * float(w) for n, w in (x.split(':') for x in spec.split(',')))


def say(text, speed=1.0, lang='it'):
    audio, sr = _engine().create(phonemes(text, lang), voice=_voice(VOICES[lang]), speed=speed, is_phonemes=True)
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
        speed, gain = base, 1.0
        if part == 'body':
            speed *= RHYTHM[k % len(RHYTHM)]
        if last == '?':
            speed *= 1.02; gain = 1.04                        # curiosità: un filo più viva (la domanda sale da sé)
        elif words <= 3 and part != 'hook':
            speed *= 0.97                                     # frase breve: un filo più posata, autorevole
        if part == 'end':
            if k == 0:
                speed *= 0.97                                 # il nome, deciso
            else:
                speed *= 1.02; gain = 1.1                     # l'invito, più energico
        elif part == 'body' and words >= 7:
            gain *= 0.97                                      # le spiegazioni, calme
        if last == '!':
            gain *= 1.08
        if pending_pause:
            pieces.append(np.zeros(int(pending_pause * SR), np.float32)); t += pending_pause
        a = _fade(_trim(say(s, speed, lang))) * gain
        cues.append((round(t, 3), round(t + len(a) / SR, 3), clean(s)))
        pieces.append(a.astype(np.float32)); t += len(a) / SR
        pending_pause = st['sentence'] * AFTER.get(last, 0.6)
    return (np.concatenate(pieces) if pieces else np.zeros(0, np.float32)), cues


def studio(raw_wav, out_wav):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw_wav, '-af', STUDIO, '-ar', str(SR), out_wav], check=True)
