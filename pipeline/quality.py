"""Control de calidad de la transcripcion."""


def low_confidence_ratio(words: list[dict], threshold: float = 0.5) -> float:
    """Fraccion de palabras con score < threshold (sin score = baja). 0.0 si no hay palabras."""
    if not words:
        return 0.0
    low = sum(1 for w in words if w.get("score", 0.0) < threshold)
    return low / len(words)


# Por encima de esto la transcripcion con prompt de vocabulario es sospechosa: el prompt (solo ingles)
# a veces hace que Whisper traduzca al ingles o se salte frases en audios que mezclan idiomas.
RETRY_RATIO = 0.25


def needs_retry(ratio: float) -> bool:
    """True si conviene repetir la transcripcion sin prompt."""
    return ratio > RETRY_RATIO


def pick_plain(prompt_ratio: float, plain_ratio: float) -> bool:
    """True si la version sin prompt es mejor (menos palabras de baja confianza); empate = se queda con prompt."""
    return plain_ratio < prompt_ratio
