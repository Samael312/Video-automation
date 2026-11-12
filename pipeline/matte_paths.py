"""Rutas y parametros del matte (sin dependencias pesadas, para poder testearlo)."""
from pathlib import Path

TARGET_LONG_SIDE = 512  # RobustVideoMatting rinde bien procesando ~512 px en el lado largo


def resolve_paths(arg: str, root: Path) -> tuple[Path, Path]:
    """"ACTUALLY", "ACTUALLY.mp4" o cualquier ruta -> (public/ACTUALLY.mp4, public/ACTUALLY.matte.webm).
    Siempre usa el video normalizado de public/ (mismos frames que el render)."""
    name = Path(arg).stem
    return root / "public" / f"{name}.mp4", root / "public" / f"{name}.matte.webm"


def downsample_ratio(h: int, w: int) -> float:
    return min(1.0, TARGET_LONG_SIDE / max(h, w))
