r"""Transcribe + alinea palabras + diariza (CPU) y exporta JSON para Remotion.

Uso (desde la raiz del proyecto):
  .venv\Scripts\python pipeline/transcribe_diarize.py [video] [--model tiny|base|small|medium|large-v3] [--prompt vocab.txt] [--out ruta.json] [--speakers N]
"""
import argparse, json, os, sys, time, warnings
from pathlib import Path

warnings.filterwarnings("ignore")
from dotenv import load_dotenv
import whisperx
from whisperx.diarize import DiarizationPipeline

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quality import low_confidence_ratio, needs_retry, pick_plain

ROOT = Path(__file__).resolve().parent.parent
# Acepta .env y .env.txt (Windows suele anadir .txt sin avisar)
for name in (".env", ".env.txt"):
    if (ROOT / name).exists():
        load_dotenv(ROOT / name)
        break

ap = argparse.ArgumentParser()
ap.add_argument("video", nargs="?", default=str(ROOT / "media" / "input" / "ACTUALLY.mp4"))
ap.add_argument("--model", default="medium", choices=["tiny", "base", "small", "medium", "large-v3"])
ap.add_argument("--prompt", default=str(ROOT / "pipeline" / "vocab.txt"), help="texto de vocabulario para initial_prompt")
ap.add_argument("--out", default=None)
ap.add_argument("--speakers", type=int, default=None, help="numero de hablantes si lo sabes")
args = ap.parse_args()

token = os.getenv("HF_TOKEN")
if not token:
    sys.exit("ERROR: falta HF_TOKEN en .env")
video = Path(args.video)
if not video.exists():
    sys.exit(f"ERROR: no existe {video}")
out = Path(args.out) if args.out else ROOT / "public" / f"{video.stem}.transcript.json"
out.parent.mkdir(parents=True, exist_ok=True)

DEVICE, COMPUTE = "cpu", "int8"  # CPU estricta
t0 = time.time()
def step(msg): print(f"[{time.time()-t0:6.1f}s] {msg}", flush=True)

step("cargando audio")
audio = whisperx.load_audio(str(video))          # ffmpeg -> numpy 16 kHz
prompt_file = Path(args.prompt)
initial_prompt = prompt_file.read_text(encoding="utf-8").strip() if args.prompt and prompt_file.is_file() else None  # --prompt "" = sin prompt


def transcribe_align(prompt):
    """Transcribe y alinea; devuelve (idioma, resultado alineado, fraccion de palabras de baja confianza)."""
    step(f"transcribiendo con '{args.model}' (cpu/int8){'' if prompt else ' sin prompt de vocabulario'}")
    model = whisperx.load_model(args.model, DEVICE, compute_type=COMPUTE, asr_options={"initial_prompt": prompt})
    raw = model.transcribe(audio, batch_size=4)
    lang = raw["language"]
    step(f"idioma detectado: {lang}")
    step("alineando palabras")
    align_model, meta = whisperx.load_align_model(language_code=lang, device=DEVICE)
    aligned = whisperx.align(raw["segments"], align_model, meta, audio, DEVICE)
    ratio = low_confidence_ratio([w for s in aligned["segments"] for w in s.get("words", []) if "start" in w])
    return lang, aligned, ratio


lang, result, ratio = transcribe_align(initial_prompt)
used_prompt = initial_prompt is not None
if used_prompt and needs_retry(ratio):
    # el prompt de vocabulario (ingles) a veces traduce o se salta frases: se prueba sin el y se queda la mejor
    step(f"{ratio:.0%} de palabras con baja confianza con el prompt de vocabulario: reintento sin prompt")
    lang2, result2, ratio2 = transcribe_align(None)
    if pick_plain(ratio, ratio2):
        step(f"uso la version sin prompt ({ratio2:.0%} baja confianza vs {ratio:.0%})")
        lang, result, ratio, used_prompt = lang2, result2, ratio2, False
    else:
        step(f"me quedo con la version con prompt ({ratio:.0%} vs {ratio2:.0%} sin prompt)")

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
    "vocab_prompt": used_prompt,
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

ratio = low_confidence_ratio(words)
if ratio > 0.25:
    step(f"AVISO: {ratio:.0%} de palabras con baja confianza; revisa {out} antes de renderizar")
