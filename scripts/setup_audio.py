"""Instala DeepFilterNet (limpieza de voz) para pipeline/audio_clean.py.

  npm run setup-audio -- --check   # solo dice si esta instalado (sale 0 si si, 1 si no)
  npm run setup-audio              # muestra que se descargaria y NO descarga
  npm run setup-audio -- --yes     # descarga y verifica (SHA-256) a ~/.video-cleanup/bin/

DeepFilterNet 0.5.6 CLI (MIT/Apache-2.0), release oficial de GitHub. Checksums tomados del plugin
video-cleanup (MIT License, (c) 2026 Mehdi Ksibi), scripts/setup_tools.py.
"""
import argparse
import hashlib
import os
import platform
import stat
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline.audio_common import DF_BASE, DF_DEST, find_deep_filter  # noqa: E402

DF_SHA256 = {
    "deep-filter-0.5.6-x86_64-pc-windows-msvc.exe": "75e11fa16445f560cb6b021521ddb89e89270d13b83089705d98776f58fd7915",
    "deep-filter-0.5.6-x86_64-unknown-linux-musl": "70775e251eee44c0f2451a1e833326cf8bcbbe304d3e7cd12851e6fce72ef7da",
    "deep-filter-0.5.6-aarch64-unknown-linux-gnu": "14e02a1c0028f3ca0bdf83b62b3336e56ba0556894ef295a95e8573f06557166",
    "deep-filter-0.5.6-aarch64-apple-darwin": "4601e7f4e4c03e59a4c5b5000216ef3add3e808799cfccd95e14e83ea4611081",
    "deep-filter-0.5.6-x86_64-apple-darwin": "d3be84003acb7c23e738ad7f70a158ec779a8d233a82e7fa3e717d112eb5b50f",
}


def main() -> int:
    from pipeline.audio_common import DF_ASSETS
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--yes", action="store_true", help="confirma la descarga")
    a = ap.parse_args()

    found = find_deep_filter()
    if found:
        print(f"DeepFilterNet: {found}")
        return 0
    if a.check:
        print("DeepFilterNet: FALTA (instalalo con: npm run setup-audio)")
        return 1

    key = (platform.system(), platform.machine())
    name = DF_ASSETS.get(key)
    if not name:
        print(f"No hay binario de DeepFilterNet para {key}. Ver https://github.com/Rikorose/DeepFilterNet/releases", file=sys.stderr)
        return 1
    if not a.yes:
        print("Se descargaria:")
        print(f"  archivo: {name} (~30 MB)")
        print(f"  origen:  {DF_BASE}{name}")
        print(f"  destino: {DF_DEST}")
        print("Corre de nuevo con --yes para confirmar: npm run setup-audio -- --yes")
        return 2

    DF_DEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = DF_DEST.with_suffix(".part")
    print(f"descargando {name} ...")
    urllib.request.urlretrieve(DF_BASE + name, tmp)
    got = hashlib.sha256(tmp.read_bytes()).hexdigest()
    if got != DF_SHA256[name]:
        tmp.unlink(missing_ok=True)
        print(f"ERROR: checksum distinto para {name}; no se instala.", file=sys.stderr)
        return 1
    tmp.replace(DF_DEST)
    if os.name != "nt":
        DF_DEST.chmod(DF_DEST.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    print(f"DeepFilterNet instalado en {DF_DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
