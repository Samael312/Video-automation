r"""Trabajador de transcripcion en memoria: carga Whisper una vez y atiende peticiones HTTP locales.

Uso: .venv\Scripts\python pipeline/transcribe_worker.py --port 0 --parent-pid <pid> [--model medium] [--warm]
Imprime "LISTO <puerto>" cuando escucha. Solo 127.0.0.1, solo rutas dentro del proyecto, una peticion a la vez.
  GET  /salud        -> {"ok": true, "ocupado": bool, "modelos": [...]}
  POST /transcribir  {"video", "out", "model", "prompt", "diarize": false} -> {"ok": true, "palabras": n} | {"ok": false, "error"}
Se cierra solo si muere el proceso padre (la web).
"""
import argparse
import json
import os
import sys
import threading
import time
import traceback
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def dentro_del_proyecto(ruta, root):
    """True si `ruta` (resuelta) cae dentro de `root`; sin distinguir mayusculas (Windows)."""
    try:
        r = os.path.normcase(str(Path(ruta).resolve()))
        base = os.path.normcase(str(Path(root).resolve()))
    except (OSError, ValueError):
        return False
    return r == base or r.startswith(base.rstrip("\\/") + os.sep)


def rutas_validas(video, out, root):
    """video dentro de public/; out = public/<algo>.transcript.json (no puede pisar codigo ni planes)."""
    pub = Path(root) / "public"
    return bool(video and out) and dentro_del_proyecto(video, pub) and dentro_del_proyecto(out, pub)         and Path(out).name.lower().endswith(".transcript.json")


def crear_servidor(transcriptor, root, port=0, candado=None):
    candado = candado or threading.Lock()
    estado = {"ocupado": False}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):  # sin ruido en la consola
            pass

        def _json(self, code, obj):
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path != "/salud":
                return self._json(404, {"ok": False, "error": "no existe"})
            self._json(200, {"ok": True, "ocupado": estado["ocupado"], "modelos": transcriptor.modelos()})

        def do_POST(self):
            if self.path != "/transcribir":
                return self._json(404, {"ok": False, "error": "no existe"})
            inicio = time.time()
            # solo JSON: un formulario o fetch "simple" desde una pagina web no puede llegar aqui sin preflight
            if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
                return self._json(415, {"ok": False, "error": "solo application/json"})
            try:
                n = int(self.headers.get("Content-Length") or 0)
                p = json.loads(self.rfile.read(n) or b"{}")
                video, out = p.get("video"), p.get("out")
                if not rutas_validas(video, out, root):
                    return self._json(400, {"ok": False, "error": "rutas no validas (video y out en public/, out *.transcript.json)"})
            except Exception as e:
                return self._json(400, {"ok": False, "error": f"peticion invalida: {e}"})
            out = Path(out)
            tmp = out.with_name(out.name + ".worker.tmp")
            with candado:
                estado["ocupado"] = True
                try:
                    payload = transcriptor.transcribir(Path(video), tmp, model=p.get("model") or "medium",
                                                       prompt=p.get("prompt") or None, diarize=bool(p.get("diarize")))
                    # si mientras tanto otro (la linea de comandos tras un timeout) escribio el transcript, no se pisa
                    if out.exists() and out.stat().st_mtime > inicio:
                        tmp.unlink(missing_ok=True)
                        return self._json(409, {"ok": False, "error": "descartado: ya hay un transcript mas nuevo"})
                    os.replace(tmp, out)
                    self._json(200, {"ok": True, "palabras": len(payload["words"]),
                                     "baja_confianza": getattr(transcriptor, "ultimo_ratio", None)})
                except Exception as e:
                    traceback.print_exc()
                    self._json(500, {"ok": False, "error": str(e) or type(e).__name__})
                finally:
                    tmp.unlink(missing_ok=True)
                    estado["ocupado"] = False

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def proceso_vivo(pid):
    if sys.platform == "win32":
        import ctypes
        k = ctypes.windll.kernel32
        h = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        try:
            code = ctypes.c_ulong()
            return bool(k.GetExitCodeProcess(h, ctypes.byref(code))) and code.value == 259  # STILL_ACTIVE
        finally:
            k.CloseHandle(h)
    try:
        os.kill(pid, 0)  # en POSIX solo comprueba; en Windows mataria el proceso
        return True
    except OSError:
        return False


def main():
    warnings.filterwarnings("ignore")
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--parent-pid", type=int, default=None)
    ap.add_argument("--model", default="medium")
    ap.add_argument("--warm", action="store_true", help="cargar Whisper y alineadores es/en al arrancar")
    args = ap.parse_args()

    if args.parent_pid:
        def vigilar():
            while True:
                time.sleep(5)
                if not proceso_vivo(args.parent_pid):
                    os._exit(0)
        threading.Thread(target=vigilar, daemon=True).start()

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from transcribe_core import Transcriptor
    t = Transcriptor()
    candado = threading.Lock()
    srv = crear_servidor(t, ROOT, args.port, candado)
    print(f"LISTO {srv.server_address[1]}", flush=True)
    if args.warm:
        def calentar():
            with candado:  # una peticion que llegue ahora espera a que termine la carga
                t.modelo(args.model)
                for lang in ("es", "en"):
                    t.alineador(lang)
                t.log("trabajador caliente")
        threading.Thread(target=calentar, daemon=True).start()
    srv.serve_forever()


if __name__ == "__main__":
    main()
