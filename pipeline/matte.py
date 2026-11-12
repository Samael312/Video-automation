r"""Recorta a la persona (fondo transparente) para el efecto "texto detras" (`behind` en edit.json).

Uso (desde la raiz):  npm run matte -- NOMBRE [--all] [--force]
Entrada: public/NOMBRE.mp4 (normalizado) + public/NOMBRE.edit.json (para saber que tramos llevan `behind`).
Salida:  public/NOMBRE.matte.webm  VP9 con alfa, mismos frames que el video; fuera de los tramos va transparente.
         public/NOMBRE.matte.json  tramos cubiertos + altura de la cabeza por frame (para colocar el texto solo).
Solo procesa los tramos con `behind` (+0.5 s antes). --all: todo el video. Si ya cubre lo pedido no repite (salvo --force).
Modelo: RobustVideoMatting mobilenetv3 (GPL-3.0, CPU). La primera vez descarga el modelo (~15 MB) de GitHub.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from matte_paths import behind_ranges, covers, downsample_ratio, head_top, resolve_paths

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args:
    sys.exit("Uso: npm run matte -- NOMBRE [--all] [--force]")
src, out, info_file = resolve_paths(args[0], ROOT)
if not src.exists():
    sys.exit(f"ERROR: no existe {src}; corre primero: npm run edit -- media/input/{src.stem}.mp4 --plan-only")

probe = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
    "-show_entries", "stream=width,height,r_frame_rate,nb_read_packets:format=duration", "-of", "json", str(src)]))
st = probe["streams"][0]
W, H, N = st["width"], st["height"], int(st["nb_read_packets"])
num, den = (int(x) for x in st["r_frame_rate"].split("/"))
FPS = num / den
duration = float(probe["format"]["duration"])

plan_file = src.with_suffix(".edit.json")
if "--all" in sys.argv:
    ranges = [(0.0, round(duration, 3))]
else:
    plan = json.loads(plan_file.read_text(encoding="utf-8")) if plan_file.exists() else {}
    ranges = behind_ranges(plan, duration)
    if not ranges:
        sys.exit(f'Nada que recortar: {plan_file.name} no tiene "behind": true (usa --all para todo el video)')

if info_file.exists() and out.exists() and "--force" not in sys.argv:
    old = json.loads(info_file.read_text(encoding="utf-8"))
    if covers(old.get("ranges", []), ranges):
        print(f"Ya al dia: {out.name} cubre {ranges}")
        sys.exit(0)

in_range = lambda t: any(s <= t < e for s, e in ranges)
todo = sum(in_range(i / FPS) for i in range(N))
print(f"Recortando {todo}/{N} frames en tramos {ranges}", flush=True)

import torch  # noqa: E402 (lento de importar: solo si hay trabajo)

t0 = time.time()
torch.set_num_threads(os.cpu_count() or 4)
model = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3", trust_repo=True, verbose=False).eval()
ratio = downsample_ratio(H, W)

reader = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
tmp = out.with_suffix(".tmp.webm")
writer = subprocess.Popen([
    "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", st["r_frame_rate"], "-i", "-",
    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "32", "-row-mt", "1", "-deadline", "good", "-cpu-used", "5",
    "-auto-alt-ref", "0", str(tmp)], stdin=subprocess.PIPE)

frame_bytes = W * H * 3
empty_frame = bytes(W * H * 4)
rec = [None] * 4
tops: dict[str, int] = {}
i = done = 0
with torch.no_grad():
    while True:
        buf = reader.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            break
        if in_range(i / FPS):
            rgb = np.frombuffer(bytearray(buf), np.uint8).reshape(H, W, 3)
            x = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).float().div_(255)
            _fgr, pha, *rec = model(x, *rec, downsample_ratio=ratio)
            alpha = pha[0, 0].clamp(0, 1).mul(255).round().byte().numpy()
            top = head_top(alpha)
            if top is not None:
                tops[str(i)] = top
            done += 1
            if done % 60 == 0 or done == todo:
                el = time.time() - t0
                print(f"[{el:6.1f}s] {done}/{todo} frames ({done / el:.1f} fps)", flush=True)
            writer.stdin.write(np.dstack([rgb, alpha]).tobytes())
        else:
            rec = [None] * 4  # el siguiente tramo arranca limpio
            writer.stdin.write(empty_frame)  # negro transparente: casi no cuesta codificarlo
        i += 1

writer.stdin.close()
writer.wait()
reader.wait()
if writer.returncode != 0 or i == 0:
    tmp.unlink(missing_ok=True)
    sys.exit("ERROR: fallo al codificar el matte")
tmp.replace(out)
info_file.write_text(json.dumps({"version": 1, "video": src.name, "fps": FPS, "ranges": ranges, "top": tops}), encoding="utf-8")
print(f"OK -> {out}  ({done} de {i} frames recortados, {time.time() - t0:.0f} s)")
