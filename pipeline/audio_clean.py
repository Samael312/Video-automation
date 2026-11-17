"""Limpia la voz de public/<NOMBRE>.mp4: DeepFilterNet + EQ suave + compresion ligera + -14 LUFS.

Uso: python pipeline/audio_clean.py public/NOMBRE.mp4 [--strength 35]

- El audio original se guarda una sola vez en public/NOMBRE.raw.wav; cada corrida limpia SIEMPRE desde ahi,
  asi correrlo dos veces no limpia lo ya limpio.
- El video se copia sin recodificar; solo se reemplaza la pista de audio.
- Si el resultado queda desfasado mas de 20 ms, no se reemplaza nada y sale con codigo 1.

Receta adaptada de video-cleanup (MIT License, (c) 2026 Mehdi Ksibi), scripts/audiofix.py.
En sus pruebas, gates y denoise FFT agresivo sonaban "corruptos": no meter mas filtros.
"""
import argparse
import os
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.audio_common import (channel_advice, decode_audio, ffmpeg, find_deep_filter, has_audio, loudness, run,
                                   speech_noise_gap, sync_lag_ms, two_pass_loudnorm)

PANS = {"mix": "pan=mono|c0=0.5*c0+0.5*c1", "left": "pan=mono|c0=c0", "right": "pan=mono|c0=c1"}
# En float: en 16 bit el realce de 3.2 kHz recorta una voz que ya pica cerca de 0 dBFS (clics).
# El agudo es highshelf: en la receta original `equalizer ... t=h:w=0.7` era un pico de 0.7 Hz a 7 kHz.
POST_CHAIN = ("aformat=sample_fmts=fltp,"
              "equalizer=f=220:t=q:w=1.2:g=-2,"
              "equalizer=f=3200:t=q:w=1.0:g=2.5,"
              "highshelf=f=7000:g=1.5,"
              "acompressor=threshold=-24dB:ratio=3:attack=8:release=150:makeup=2")
MAX_LAG_MS = 20


def raw_path(video: Path) -> Path:
    return video.with_name(f"{video.stem}.raw.wav")


def source_for(video: Path, raw: Path) -> Path:
    """Audio de partida: el original guardado si existe, si no el propio video."""
    return raw if raw.exists() else video


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Limpia la voz de un video (DeepFilterNet + -14 LUFS)")
    ap.add_argument("video")
    ap.add_argument("--strength", type=float, default=35, help="dB maximos de reduccion de ruido (35 natural, 25 suave)")
    a = ap.parse_args(argv)
    video = Path(a.video)

    if not has_audio(video):
        print(f"{video.name}: sin audio, no hay nada que limpiar")
        return 0
    df = find_deep_filter()
    if not df:
        print("ERROR: falta DeepFilterNet. Instalalo con: npm run setup-audio  (o salta este paso con --no-clean)", file=sys.stderr)
        return 3

    raw = raw_path(video)
    if not raw.exists():
        run([ffmpeg(), "-v", "error", "-y", "-i", video, "-map", "0:a:0", "-ar", "48000", "-c:a", "pcm_s16le", raw])
        print(f"audio original guardado en {raw}")
    src = source_for(video, raw)

    ch, why = channel_advice(decode_audio(src, 16000, channels=2))
    print(f"canal: {ch} ({why})")
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        speech = tmp / "speech.wav"
        run([ffmpeg(), "-v", "error", "-y", "-i", src, "-map", "0:a:0", "-af", f"{PANS[ch]},highpass=f=80:poles=2",
             "-ar", "48000", "-c:a", "pcm_s16le", speech])
        run([df, "-D", "-a", a.strength, "-o", tmp / "df", speech])  # -D compensa el retardo: sincronia labial
        clean = tmp / "df" / "speech.wav"
        ln = two_pass_loudnorm(clean, POST_CHAIN)
        out = tmp / f"out{video.suffix}"
        run([ffmpeg(), "-v", "error", "-y", "-i", video, "-i", clean, "-map", "0:v?", "-map", "1:a", "-c:v", "copy",
             "-af", f"{POST_CHAIN},{ln},aresample=48000", "-c:a", "aac", "-b:a", "192k", "-ac", "1", "-shortest",
             "-movflags", "+faststart", out])

        before = decode_audio(raw)
        after = decode_audio(out)
        lag, corr = sync_lag_ms(before, after)
        g0, g1 = speech_noise_gap(before)[2], speech_noise_gap(after)[2]
        if abs(lag) > MAX_LAG_MS:
            print(f"ERROR: el audio limpio queda desfasado {lag} ms (max {MAX_LAG_MS}); no se reemplaza {video}", file=sys.stderr)
            return 1
        os.replace(out, video)
    I, peak = loudness(video)
    print(f"volumen {I} LUFS, pico {peak} dBFS | voz sobre fondo {g0:.1f} -> {g1:.1f} dB | desfase {lag} ms (coincidencia {corr:.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
