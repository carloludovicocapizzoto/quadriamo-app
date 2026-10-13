"""Voce narrante per i reel: Kokoro (neurale, gira sul Mac, niente servizi esterni), voce italiana.

Ogni scena del reel ha la sua frase: la scena dura quanto la frase più una pausa, così voce e immagini restano allineate.
Modelli: cartella .models di budget-planner (kokoro-v1.0.onnx, voices-v1.0.bin), oppure QUADRIAMO_MODELS.
Serve un Python con kokoro-onnx, soundfile e numpy (es. il .venv di budget-planner) e espeak-ng di Homebrew.
"""
import os
import subprocess

import numpy as np
import soundfile as sf

VOICE = os.environ.get('QUADRIAMO_VOICE', 'if_sara')   # alternativa maschile: im_nicola
MODELS = os.environ.get('QUADRIAMO_MODELS', os.path.expanduser('~/GitHub/budget-planner/.models'))
ESPEAK_LIB = '/usr/local/opt/espeak-ng/lib/libespeak-ng.dylib'
ESPEAK_DATA = '/usr/local/opt/espeak-ng/share/espeak-ng-data'
SR = 24000
LEAD, TAIL, MIN_SCENE = 0.25, 0.55, 2.4     # secondi: respiro prima della frase, pausa dopo, scena più corta

# EQ morbida, un po' di presenza, compressione leggera, volume standard per i social (-14 LUFS)
STUDIO = ('highpass=f=75,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.5,'
          'equalizer=f=9000:t=q:w=1:g=1.5,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,'
          'loudnorm=I=-14:TP=-1.5:LRA=9')
_k = None


def _engine():
    global _k
    if _k is None:
        from kokoro_onnx import EspeakConfig, Kokoro
        _k = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'),
                    espeak_config=EspeakConfig(lib_path=ESPEAK_LIB, data_path=ESPEAK_DATA))
    return _k


def say(text, speed=1.0):
    audio, sr = _engine().create(text, voice=VOICE, speed=speed, lang='it')
    assert sr == SR
    return audio.astype(np.float32)


def narrated_reel(scenes, out, work, clip):
    """scenes: [(immagine, frase), ...]; clip(immagine, secondi, mp4) fa il video di una scena. Scrive il reel con la voce."""
    os.makedirs(work, exist_ok=True)
    track, parts = [], []
    for i, (img, line) in enumerate(scenes):
        voice = say(line)
        seconds = max(MIN_SCENE, LEAD + len(voice) / SR + TAIL)
        n = int(round(seconds * SR))
        seg = np.zeros(n, dtype=np.float32)
        start = int(LEAD * SR)
        seg[start:start + len(voice)] = voice[:n - start]
        track.append(seg)
        parts.append(clip(img, round(seconds, 2), os.path.join(work, f'v{i}.mp4')))
    raw, wav = os.path.join(work, 'voce.raw.wav'), os.path.join(work, 'voce.wav')
    sf.write(raw, np.concatenate(track), SR)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', STUDIO, '-ar', '48000', wav], check=True)
    lst = os.path.join(work, 'list.txt')
    with open(lst, 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    silent = os.path.join(work, 'muto.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', silent], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
    print(out)
    return out
