"""Herramientas de audio compartidas: localizar ffmpeg/DeepFilterNet, decodificar audio, medir volumen y sincronia.

Adaptado del plugin video-cleanup (MIT License, (c) 2026 Mehdi Ksibi), scripts/common.py y analyze.py.
"""
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

DF_VERSION = "0.5.6"
DF_BASE = f"https://github.com/Rikorose/DeepFilterNet/releases/download/v{DF_VERSION}/"
DF_ASSETS = {
    ("Windows", "AMD64"): f"deep-filter-{DF_VERSION}-x86_64-pc-windows-msvc.exe",
    ("Linux", "x86_64"): f"deep-filter-{DF_VERSION}-x86_64-unknown-linux-musl",
    ("Linux", "aarch64"): f"deep-filter-{DF_VERSION}-aarch64-unknown-linux-gnu",
    ("Darwin", "arm64"): f"deep-filter-{DF_VERSION}-aarch64-apple-darwin",
    ("Darwin", "x86_64"): f"deep-filter-{DF_VERSION}-x86_64-apple-darwin",
}
DF_DEST = Path.home() / ".video-cleanup" / "bin" / ("deep-filter.exe" if os.name == "nt" else "deep-filter")
TARGET_LUFS = -14


def _which(name, extra=()):
    found = shutil.which(name)
    if found:
        return found
    for p in extra:
        p = Path(os.path.expandvars(os.path.expanduser(str(p))))
        if p.is_file():
            return str(p)
    return None


def ffmpeg(tool="ffmpeg"):
    exe = tool + (".exe" if os.name == "nt" else "")
    path = _which(tool, [f"$LOCALAPPDATA/Microsoft/WinGet/Links/{exe}", f"/opt/homebrew/bin/{tool}", f"/usr/local/bin/{tool}"])
    if not path:
        sys.exit(f"ERROR: no se encontro {tool}. Instalalo (Windows: winget install Gyan.FFmpeg).")
    return path


def find_deep_filter():
    """Ruta del CLI de DeepFilterNet, o None si no esta instalado."""
    env = os.environ.get("DEEP_FILTER", "")
    if env and Path(env).is_file():
        return env
    for n in ("deep-filter.exe", "deep-filter"):
        if shutil.which(n):
            return shutil.which(n)
    return str(DF_DEST) if DF_DEST.is_file() else None


def run(cmd, capture=False):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        sys.exit(f"Fallo el comando ({r.returncode}): {' '.join(map(str, cmd))[:300]}\n{r.stderr[-2000:]}")
    return r.stderr + r.stdout if capture else None


def has_audio(path):
    out = subprocess.run([ffmpeg("ffprobe"), "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return bool(out.stdout.strip())


def decode_audio(path, sr=16000, channels=1):
    """Primera pista de audio a float32 numpy (frames x canales si channels > 1)."""
    r = subprocess.run([ffmpeg(), "-v", "error", "-i", str(path), "-map", "0:a:0", "-f", "f32le",
                        "-ac", str(channels), "-ar", str(sr), "-"], capture_output=True)
    if r.returncode != 0:
        sys.exit(f"No se pudo decodificar el audio de {path}: {r.stderr.decode(errors='replace')[-500:]}")
    x = np.frombuffer(r.stdout, dtype=np.float32)
    return x.reshape(-1, channels) if channels > 1 else x


def loudness(path):
    """Volumen integrado (LUFS) y pico (dBFS) con ebur128."""
    out = run([ffmpeg(), "-hide_banner", "-nostats", "-i", path, "-map", "0:a:0",
               "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture=True)
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", out)
    p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)
    return (float(i[-1]) if i else None), (float(p[-1]) if p else None)


def frame_db(x, sr=16000, frame_s=0.05):
    n = int(sr * frame_s)
    x = x[: len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((x ** 2).mean(1)) + 1e-9)


def speech_noise_gap(x, sr=16000):
    """p90 - p10 del nivel por frame: aproximacion de 'voz sobre fondo' en dB."""
    r = frame_db(x, sr)
    r = r[r > -120]
    if len(r) == 0:
        return None, None, None
    lo, hi = np.percentile(r, 10), np.percentile(r, 90)
    return float(lo), float(hi), float(hi - lo)


def sync_lag_ms(a, b, sr=16000, max_ms=120):
    """Desfase de b respecto de a en ms (positivo = b llega tarde), por envolventes de 1 ms."""
    hop = sr // 1000
    n = min(len(a), len(b))
    env = lambda y: np.sqrt((y[: n // hop * hop].reshape(-1, hop) ** 2).mean(1))
    ea, eb = env(a[:n]), env(b[:n])
    m = max_ms
    best, best_k = -2, 0
    for k in range(-m, m + 1):
        c = np.corrcoef(ea[m:-m], eb[m + k: len(eb) - m + k])[0, 1]
        if c > best:
            best, best_k = c, k
    return best_k, float(best)


def channel_advice(x):
    """Como pasar estereo a mono: canales desfasados o sin relacion adelgazan la voz si se mezclan."""
    if x.ndim < 2 or x.shape[1] < 2:
        return "mix", "fuente mono"
    L, R = x[:, 0], x[:, 1]
    if L.std() == 0 or R.std() == 0:
        return ("right" if L.std() == 0 else "left"), "un canal esta en silencio"
    corr = float(np.corrcoef(L, R)[0, 1])
    loss = 20 * np.log10(np.std(L + R) / (np.std(L) + np.std(R)) + 1e-12)
    if corr < 0.3 or loss < -2.5:
        gl = speech_noise_gap(L)[2] or 0
        gr = speech_noise_gap(R)[2] or 0
        pick = "left" if gl >= gr else "right"
        return pick, f"canales poco relacionados (corr {corr:.2f}): se usa el canal {pick}, el mas limpio"
    return "mix", f"canales compatibles (corr {corr:.2f})"


def parse_loudnorm(stderr):
    """JSON que imprime loudnorm=print_format=json en la primera pasada."""
    return json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", stderr, re.S).group(0))


def loudnorm_second_pass(m, target=TARGET_LUFS):
    return (f"loudnorm=I={target}:TP=-1.5:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
            f"offset={m['target_offset']}:linear=true")


def two_pass_loudnorm(src, chain, target=TARGET_LUFS):
    """Filtro de segunda pasada para llevar `src` (tras `chain`) a `target` LUFS."""
    pre = f"{chain}," if chain else ""
    out = run([ffmpeg(), "-hide_banner", "-nostats", "-i", src, "-af",
               f"{pre}loudnorm=I={target}:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture=True)
    return loudnorm_second_pass(parse_loudnorm(out), target)
