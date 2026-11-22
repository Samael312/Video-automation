"""Prepara las muestras para entrenar la voz profesional (ElevenLabs PVC) con videos viejos de la profe.

Uso: python pipeline/voice_samples.py [--raw media/voice/raw] [--samples media/voice/samples] [--force]

- Cada archivo de raw/ (video o audio) -> samples/<nombre>.mp3: voz limpia como audio_clean.py, mono 44.1 kHz,
  silencios > 0.7 s dejados en 0.7 s (los minutos cuentan solo voz).
- Si tras limpiar queda musica/ruido de fondo (voz sobre fondo < MIN_GAP_DB), no se guarda: se marca
  samples/<nombre>.descartado (la musica mete artefactos en el entrenamiento).
- Los ya procesados (mp3 o descartado) se saltan, asi se pueden ir anadiendo videos de a poco.
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.audio_clean import PANS, POST_CHAIN
from pipeline.audio_common import (channel_advice, decode_audio, ffmpeg, find_deep_filter, run, speech_noise_gap,
                                   two_pass_loudnorm)

INPUT_EXT = {".mp4", ".mov", ".m4a", ".mp3", ".wav", ".webm"}
MIN_S = 1800
IDEAL_S = 3600
MIN_GAP_DB = 20.0
SAMPLES_LABEL = "media/voice/samples/"


def pending(raw: Path, samples: Path, force: bool) -> list[Path]:
    files = sorted(p for p in raw.iterdir() if p.is_file() and p.suffix.lower() in INPUT_EXT) if raw.is_dir() else []
    if force:
        return files
    return [p for p in files
            if not (samples / f"{p.stem}.mp3").exists() and not (samples / f"{p.stem}.descartado").exists()]


def strip_silence_filter() -> str:
    return ("silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.7"
            ":stop_threshold=-45dB")  # ffmpeg 7+: pausas > 0.7 s quedan en 0.7 s


def fmt(s: float) -> str:
    s = int(round(s))
    return f"{s // 60}:{s % 60:02d}"


def summary(durations: list[float], discarded: list[str]) -> str:
    total = sum(durations)
    head = f"muestras: {len(durations)} archivos, {fmt(total)} de voz (minimo {fmt(MIN_S)}, ideal {fmt(IDEAL_S)}+)"
    lines = [head + (f" - faltan {fmt(MIN_S - total)}" if total < MIN_S else "")]
    if discarded:
        lines.append(f"descartados: {len(discarded)} (musica/ruido): {', '.join(discarded)}")
    if total >= MIN_S:
        lines.append(f"listo para subir: {SAMPLES_LABEL} (pasos en docs/MANUAL.md: voz clonada)")
    return "\n".join(lines)


def duration(p: Path) -> float:
    out = subprocess.run([ffmpeg("ffprobe"), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                          str(p)], capture_output=True, text=True).stdout.strip()
    return float(out) if out else 0.0


def clean_sample(src: Path, dst: Path, df: str) -> float | None:
    """Limpia `src` -> `dst` (mp3). Devuelve la voz sobre fondo en dB, o None si se descarta."""
    marker = dst.with_suffix(".descartado")
    ch, _ = channel_advice(decode_audio(src, 16000, channels=2))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        speech = tmp / "speech.wav"
        run([ffmpeg(), "-v", "error", "-y", "-i", src, "-map", "0:a:0", "-ac", "2", "-af",
             f"{PANS[ch]},highpass=f=80:poles=2", "-ar", "48000", "-c:a", "pcm_s16le", speech])
        run([df, "-D", "-a", 35, "-o", tmp / "df", speech])
        denoised = tmp / "df" / "speech.wav"
        clean = tmp / "clean.wav"
        run([ffmpeg(), "-v", "error", "-y", "-i", denoised, "-af",
             f"{POST_CHAIN},{two_pass_loudnorm(denoised, POST_CHAIN)}", "-ar", "44100", "-ac", "1", clean])
        gap = speech_noise_gap(decode_audio(clean))[2] or 0.0  # antes de quitar silencios: el fondo se mide ahi
        if gap < MIN_GAP_DB:
            dst.unlink(missing_ok=True)
            marker.write_text(f"voz sobre fondo {gap:.1f} dB\n", encoding="utf-8")
            return None
        part = tmp / "out.mp3"  # nunca un mp3 a medias en samples/: pending() lo saltaria para siempre
        run([ffmpeg(), "-v", "error", "-y", "-i", clean, "-af", strip_silence_filter(), "-ar", "44100", "-ac", "1",
             "-c:a", "libmp3lame", "-b:a", "192k", part])
        shutil.move(part, dst)
    marker.unlink(missing_ok=True)
    return gap


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Muestras de voz para ElevenLabs Professional Voice Clone")
    ap.add_argument("--raw", default="media/voice/raw")
    ap.add_argument("--samples", default="media/voice/samples")
    ap.add_argument("--force", action="store_true", help="rehace todas las muestras")
    a = ap.parse_args(argv)
    raw, samples = Path(a.raw), Path(a.samples)
    samples.mkdir(parents=True, exist_ok=True)

    todo = pending(raw, samples, a.force)
    if todo:
        df = find_deep_filter()
        if not df:
            print("ERROR: falta DeepFilterNet. Instalalo con: npm run setup-audio", file=sys.stderr)
            return 3
    for src in todo:
        dst = samples / f"{src.stem}.mp3"
        try:
            gap = clean_sample(src, dst, df)
        except SystemExit as e:  # run()/decode_audio salen con sys.exit al fallar ffmpeg
            dst.unlink(missing_ok=True)  # una muestra vieja o rota no debe contar ni subirse
            print(f"{src.name}: error, se salta ({str(e).splitlines()[0][:120] if e.code else ''})")
            continue
        if gap is None:
            print(f"{src.name}: descartado (voz sobre fondo bajo {MIN_GAP_DB:.0f} dB)")
        else:
            print(f"{src.name}: {fmt(duration(dst))} de voz (voz sobre fondo {gap:.1f} dB)")

    durations = [duration(p) for p in sorted(samples.glob("*.mp3"))]
    stems = {p.stem: p.name for p in raw.iterdir()} if raw.is_dir() else {}
    discarded = [stems.get(p.stem, p.stem) for p in sorted(samples.glob("*.descartado"))]
    print(summary(durations, discarded))
    return 0


if __name__ == "__main__":
    sys.exit(main())
