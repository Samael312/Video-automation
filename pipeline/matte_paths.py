"""Logica del matte sin dependencias pesadas (testeable): rutas, tramos a recortar y altura de la cabeza."""
from pathlib import Path

import numpy as np

TARGET_LONG_SIDE = 512  # RobustVideoMatting rinde bien procesando ~512 px en el lado largo
PRE_ROLL = 0.5  # s antes de cada tramo: el modelo es recurrente y necesita unos frames para asentarse
POST_ROLL = 0.2


def resolve_paths(arg: str, root: Path) -> tuple[Path, Path, Path]:
    """"ACTUALLY", "X.mov" o cualquier ruta -> (public/X.mp4, public/X.matte.webm, public/X.matte.json).
    Siempre usa el video normalizado de public/ (mismos frames que el render)."""
    name = Path(arg.replace("\\", "/")).stem
    pub = root / "public"
    return pub / f"{name}.mp4", pub / f"{name}.matte.webm", pub / f"{name}.matte.json"


def downsample_ratio(h: int, w: int) -> float:
    return min(1.0, TARGET_LONG_SIDE / max(h, w))


def behind_ranges(plan: dict, duration: float) -> list[tuple[float, float]]:
    """Tramos (s del video original) con `behind`, con margen, unidos y dentro de [0, duration]."""
    spans = []
    title = plan.get("title") or {}
    if title.get("behind"):
        spans.append((title["start"], title["end"]))
    for o in plan.get("overlays", []):
        if o.get("kind") == "item" and o.get("behind"):
            spans.append((o["start"], o["end"]))
    out: list[list[float]] = []
    for s, e in sorted(spans):
        s, e = max(0.0, s - PRE_ROLL), min(duration, e + POST_ROLL)
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [(round(s, 3), round(e, 3)) for s, e in out]


def covers(have: list, need: list) -> bool:
    """True si cada tramo de `need` cae entero dentro de alguno de `have`."""
    return all(any(hs <= s and e <= he for hs, he in have) for s, e in need)


def head_top(alpha: np.ndarray, threshold: int = 128) -> int | None:
    """Primera fila (px desde arriba) con persona en la franja central (25 %–75 % del ancho); None si no hay."""
    w = alpha.shape[1]
    center = alpha[:, w // 4: w - w // 4]
    rows = np.nonzero(center.max(axis=1) >= threshold)[0]
    return int(rows[0]) if rows.size else None
