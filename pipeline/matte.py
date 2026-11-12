r"""Recorta a la persona (fondo transparente) para el efecto "texto detras" (`behind` en edit.json).

Uso (desde la raiz):  npm run matte -- NOMBRE
                      .venv\Scripts\python pipeline/matte.py NOMBRE
Entrada: public/NOMBRE.mp4 (normalizado). Salida: public/NOMBRE.matte.webm (VP9 con alfa, mismos frames).
Modelo: RobustVideoMatting mobilenetv3 (GPL-3.0, CPU). La primera vez descarga el modelo (~15 MB) de GitHub.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from matte_paths import downsample_ratio, resolve_paths

ROOT = Path(__file__).resolve().parent.parent
if len(sys.argv) < 2:
    sys.exit("Uso: npm run matte -- NOMBRE")
src, out = resolve_paths(sys.argv[1], ROOT)
if not src.exists():
    sys.exit(f"ERROR: no existe {src}; corre primero: npm run edit -- media/input/{src.name} --plan-only")

probe = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
    "-show_entries", "stream=width,height,r_frame_rate,nb_read_packets", "-of", "json", str(src)]))["streams"][0]
W, H, FPS, N = probe["width"], probe["height"], probe["r_frame_rate"], int(probe["nb_read_packets"])

t0 = time.time()
torch.set_num_threads(os.cpu_count() or 4)
model = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3", trust_repo=True, verbose=False).eval()
ratio = downsample_ratio(H, W)

reader = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
tmp = out.with_suffix(".tmp.webm")
writer = subprocess.Popen([
    "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", FPS, "-i", "-",
    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "32", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
    "-auto-alt-ref", "0", str(tmp)], stdin=subprocess.PIPE)

frame_bytes = W * H * 3
rec = [None] * 4
i = 0
with torch.no_grad():
    while True:
        buf = reader.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            break
        rgb = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        x = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).float().div_(255)
        _fgr, pha, *rec = model(x, *rec, downsample_ratio=ratio)
        alpha = (pha[0, 0].clamp(0, 1).mul(255).round().byte().numpy())
        writer.stdin.write(np.dstack([rgb, alpha]).tobytes())
        i += 1
        if i % 60 == 0 or i == N:
            el = time.time() - t0
            print(f"[{el:6.1f}s] {i}/{N} frames ({i / el:.1f} fps)", flush=True)

writer.stdin.close()
writer.wait()
reader.wait()
if writer.returncode != 0 or i == 0:
    tmp.unlink(missing_ok=True)
    sys.exit("ERROR: fallo al codificar el matte")
tmp.replace(out)
print(f"OK -> {out}  ({i} frames, {time.time() - t0:.0f} s)")
