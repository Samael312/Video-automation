"""Transcribe + alinea palabras + diariza (CPU) y exporta JSON para Remotion.

Uso (desde la raiz del proyecto):
  .venv\Scripts\python pipeline/transcribe_diarize.py [video] [--model tiny|base|small] [--out ruta.json] [--speakers N]
"""
import argparse, json, os, sys, time, warnings
from pathlib import Path

warnings.filterwarnings("ignore")
from dotenv import load_dotenv
import whisperx
from whisperx.diarize import DiarizationPipeline

ROOT = Path(__file__).resolve().parent.parent
# Acepta .env y .env.txt (Windows suele anadir .txt sin avisar)
for name in (".env", ".env.txt"):
    if (ROOT / name).exists():
        load_dotenv(ROOT / name)
        break

ap = argparse.ArgumentParser()
ap.add_argument("video", nargs="?", default=str(ROOT / "media" / "input" / "ACTUALLY.mp4"))
ap.add_argument("--model", default="base", choices=["tiny", "base", "small"])
ap.add_argument("--out", default=None)
ap.add_argument("--speakers", type=int, default=None, help="numero de hablantes si lo sabes")
args = ap.parse_args()

token = os.getenv("HF_TOKEN")
if not token:
    sys.exit("ERROR: falta HF_TOKEN en .env")
video = Path(args.video)
if not video.exists():
    sys.exit(f"ERROR: no existe {video}")
out = Path(args.out) if args.out else ROOT / "media" / "output" / f"{video.stem}.transcript.json"
out.parent.mkdir(parents=True, exist_ok=True)

DEVICE, COMPUTE = "cpu", "int8"  # CPU estricta
t0 = time.time()
def step(msg): print(f"[{time.time()-t0:6.1f}s] {msg}", flush=True)

step("cargando audio")
audio = whisperx.load_audio(str(video))          # ffmpeg -> numpy 16 kHz
step(f"transcribiendo con '{args.model}' (cpu/int8)")
model = whisperx.load_model(args.model, DEVICE, compute_type=COMPUTE)
result = model.transcribe(audio, batch_size=4)
lang = result["language"]
step(f"idioma detectado: {lang}")

step("alineando palabras")
align_model, meta = whisperx.load_align_model(language_code=lang, device=DEVICE)
result = whisperx.align(result["segments"], align_model, meta, audio, DEVICE)

step("diarizando (pyannote)")
diarizer = DiarizationPipeline(token=token, device=DEVICE)
diar = diarizer(audio, num_speakers=args.speakers)
result = whisperx.assign_word_speakers(diar, result)

words = []
for seg in result["segments"]:
    for w in seg.get("words", []):
        if "start" not in w:   # palabras sin alinear (numeros, simbolos)
            continue
        words.append({
            "word": w["word"],
            "start": round(w["start"], 3),
            "end": round(w["end"], 3),
            "speaker": w.get("speaker") or seg.get("speaker") or "UNKNOWN",
            "score": round(w.get("score", 0), 3),
        })

payload = {
    "video": video.name,
    "language": lang,
    "model": args.model,
    "duration": round(len(audio) / 16000, 3),
    "speakers": sorted({w["speaker"] for w in words}),
    "segments": [
        {"start": round(s["start"], 3), "end": round(s["end"], 3),
         "speaker": s.get("speaker", "UNKNOWN"), "text": s["text"].strip()}
        for s in result["segments"]
    ],
    "words": words,
}
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
step(f"OK -> {out}  ({len(words)} palabras, hablantes: {payload['speakers']})")
