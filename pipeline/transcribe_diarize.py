r"""Transcribe + alinea palabras (+ diariza si no se pasa --no-diarize) en CPU y exporta JSON para Remotion.

Uso (desde la raiz del proyecto):
  .venv\Scripts\python pipeline/transcribe_diarize.py [video] [--model tiny|base|small|medium|large-v3] [--prompt vocab.txt] [--out ruta.json] [--speakers N] [--no-diarize]
La logica vive en transcribe_core.py (la comparte el trabajador en memoria, transcribe_worker.py).
"""
import argparse, os, sys, warnings
from pathlib import Path

warnings.filterwarnings("ignore")
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))
from transcribe_core import Transcriptor

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
ap.add_argument("--no-diarize", action="store_true", help="sin pyannote: todo SPEAKER_00 (mas rapido)")
args = ap.parse_args()

token = os.getenv("HF_TOKEN")
if not args.no_diarize and not token:
    sys.exit("ERROR: falta HF_TOKEN en .env")
video = Path(args.video)
if not video.exists():
    sys.exit(f"ERROR: no existe {video}")
out = Path(args.out) if args.out else ROOT / "public" / f"{video.stem}.transcript.json"
prompt_file = Path(args.prompt)
initial_prompt = prompt_file.read_text(encoding="utf-8").strip() if args.prompt and prompt_file.is_file() else None  # --prompt "" = sin prompt

Transcriptor().transcribir(video, out, model=args.model, prompt=initial_prompt,
                           diarize=not args.no_diarize, speakers=args.speakers, token=token)
