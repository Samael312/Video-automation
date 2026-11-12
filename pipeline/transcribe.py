"""Uso: .venv\Scripts\python pipeline/transcribe.py video.mp4 [modelo] -> imprime JSON con palabras y tiempos."""
import sys, json, whisperx
path = sys.argv[1]; model_name = sys.argv[2] if len(sys.argv) > 2 else "tiny"
device, ctype = "cpu", "int8"   # sin GPU NVIDIA
audio = whisperx.load_audio(path)
model = whisperx.load_model(model_name, device, compute_type=ctype)
res = model.transcribe(audio, batch_size=4)
align, meta = whisperx.load_align_model(language_code=res["language"], device=device)
res = whisperx.align(res["segments"], align, meta, audio, device)
print(json.dumps(res["word_segments"], ensure_ascii=False, indent=2))
