"""Control final de volumen de un render: si se aleja de -14 LUFS (mas de 1 LU) o el pico pasa -1 dBTP,
normaliza solo el audio (video copiado sin recodificar) y reemplaza el archivo.

Uso: python pipeline/final_loudness.py media/output/edited/NOMBRE/NOMBRE_edited.mp4
"""
import os
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.audio_common import TARGET_LUFS, ffmpeg, has_audio, loudness, run, two_pass_loudnorm

TOLERANCE_LU = 1.0
MAX_PEAK = -1.0


def needs_fix(i, tp) -> bool:
    if i is None or tp is None:
        return True
    return abs(i - TARGET_LUFS) > TOLERANCE_LU or tp > MAX_PEAK


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print("Uso: python pipeline/final_loudness.py VIDEO.mp4", file=sys.stderr)
        return 2
    video = Path(argv[0])
    if not has_audio(video):
        print("volumen final: sin audio")
        return 0
    i, tp = loudness(video)
    if not needs_fix(i, tp):
        print(f"volumen final: {i} LUFS, pico {tp} dBTP")
        return 0
    ln = two_pass_loudnorm(video, "")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / video.name
        run([ffmpeg(), "-v", "error", "-y", "-i", video, "-map", "0:v?", "-map", "0:a:0", "-c:v", "copy",
             "-af", f"{ln},aresample=48000", "-c:a", "aac", "-b:a", "192k",
             "-shortest", "-movflags", "+faststart", out])  # loudnorm dinamico rellena ~60 ms al final
        os.replace(out, video)
    i2, tp2 = loudness(video)
    print(f"volumen final: {i2} LUFS, pico {tp2} dBTP (corregido desde {i} LUFS, pico {tp})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
