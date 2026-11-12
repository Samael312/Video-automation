r"""Detecta pausas largas y escribe public/<video>.cuts.json con los tramos a conservar (tiempo original).

Uso: .venv\Scripts\python pipeline/cut.py public/<video>.transcript.json [--gap 0.7] [--pad 0.1]
"""
import argparse
import json
from pathlib import Path


def compute_keep_segments(words: list[dict], duration: float, gap_threshold: float = 0.7, pad: float = 0.1) -> list[dict]:
    """Tramos [{start,end}] a conservar. Pausas > gap_threshold se cortan dejando `pad` a cada lado."""
    if not words:
        return [{"start": 0, "end": duration}]
    words = sorted(words, key=lambda x: x["start"])

    first, last = words[0], words[-1]
    start = max(0.0, first["start"] - pad) if first["start"] > gap_threshold else 0.0
    segs: list[list[float]] = []
    for prev, nxt in zip(words, words[1:]):
        if round(nxt["start"] - prev["end"], 3) > gap_threshold:
            segs.append([start, min(duration, prev["end"] + pad)])
            start = max(0.0, nxt["start"] - pad)
    tail = duration - last["end"]
    end = min(duration, last["end"] + pad) if round(tail, 3) > gap_threshold else duration
    segs.append([start, end])

    merged: list[list[float]] = []
    for s, e in segs:
        if e <= s:
            continue
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return [{"start": round(s, 3), "end": round(e, 3)} for s, e in merged]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript")
    ap.add_argument("--gap", type=float, default=0.7)
    ap.add_argument("--pad", type=float, default=0.1)
    args = ap.parse_args()
    src = Path(args.transcript)
    data = json.loads(src.read_text(encoding="utf-8"))
    keeps = compute_keep_segments(data["words"], data["duration"], args.gap, args.pad)
    out = src.with_name(src.name.replace(".transcript.json", ".cuts.json"))
    out.write_text(json.dumps({"video": data["video"], "duration": data["duration"], "keeps": keeps}, indent=2), encoding="utf-8")
    kept = sum(k["end"] - k["start"] for k in keeps)
    print(f"OK -> {out}  ({len(keeps)} tramos, {kept:.2f}s de {data['duration']}s)")


if __name__ == "__main__":
    main()
