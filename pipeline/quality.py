"""Control de calidad de la transcripcion."""


def low_confidence_ratio(words: list[dict], threshold: float = 0.5) -> float:
    """Fraccion de palabras con score < threshold (sin score = baja). 0.0 si no hay palabras."""
    if not words:
        return 0.0
    low = sum(1 for w in words if w.get("score", 0.0) < threshold)
    return low / len(words)
