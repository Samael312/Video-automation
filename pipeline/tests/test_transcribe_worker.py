import json
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from pipeline.transcribe_worker import crear_servidor, dentro_del_proyecto


class FakeT:
    def __init__(self, falla=None, espera=0.0):
        self.llamadas = []
        self.activos = 0
        self.solapes = 0
        self.falla = falla
        self.espera = espera

    def modelos(self):
        return ["medium"]

    def transcribir(self, video, out, model="medium", prompt=None, diarize=False, **kw):
        self.activos += 1
        if self.activos > 1:
            self.solapes += 1
        time.sleep(self.espera)
        self.activos -= 1
        if self.falla:
            raise RuntimeError(self.falla)
        self.llamadas.append({"video": str(video), "out": str(out), "model": model, "prompt": prompt, "diarize": diarize})
        Path(out).write_text("del trabajador", encoding="utf-8")
        self.ultimo_ratio = 0.4
        return {"words": [1, 2, 3]}


@pytest.fixture
def servidor(tmp_path):
    hechos = []

    def lanzar(t):
        srv = crear_servidor(t, tmp_path, port=0)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        hechos.append(srv)
        return f"http://127.0.0.1:{srv.server_address[1]}"

    (tmp_path / "public").mkdir()
    yield lanzar
    for s in hechos:
        s.shutdown()
        s.server_close()


def pedir(url, body=None, ctype="application/json"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def test_salud(servidor):
    st, j = pedir(servidor(FakeT()) + "/salud")
    assert st == 200 and j["ok"] is True and j["ocupado"] is False and j["modelos"] == ["medium"]


def test_transcribir_ok(servidor, tmp_path):
    t = FakeT()
    st, j = pedir(servidor(t) + "/transcribir", {"video": str(tmp_path / "public" / "v.mp4"), "out": str(tmp_path / "public" / "v.transcript.json"), "model": "medium", "prompt": "vocab"})
    assert st == 200 and j == {"ok": True, "palabras": 3, "baja_confianza": 0.4}
    assert t.llamadas[0]["diarize"] is False and t.llamadas[0]["prompt"] == "vocab"


def test_ruta_fuera_del_proyecto(servidor, tmp_path):
    t = FakeT()
    st, j = pedir(servidor(t) + "/transcribir", {"video": str(tmp_path.parent / "x.mp4"), "out": str(tmp_path / "public" / "v.transcript.json")})
    assert st == 400 and j["ok"] is False and t.llamadas == []


def test_error_del_transcriptor(servidor, tmp_path):
    st, j = pedir(servidor(FakeT(falla="sin memoria")) + "/transcribir", {"video": str(tmp_path / "public" / "v.mp4"), "out": str(tmp_path / "public" / "v.transcript.json")})
    assert st == 500 and j["ok"] is False and "sin memoria" in j["error"]


def test_peticiones_en_serie(servidor, tmp_path):
    t = FakeT(espera=0.3)
    url = servidor(t) + "/transcribir"
    body = {"video": str(tmp_path / "public" / "v.mp4"), "out": str(tmp_path / "public" / "v.transcript.json")}
    hilos = [threading.Thread(target=pedir, args=(url, body)) for _ in range(3)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()
    assert len(t.llamadas) == 3 and t.solapes == 0


def test_dentro_del_proyecto(tmp_path):
    root = tmp_path / "Proyecto"
    root.mkdir()
    assert dentro_del_proyecto(str(root / "public" / "a.mp4"), root)
    assert dentro_del_proyecto(str(root).upper() + "\\public\\a.mp4", root)
    assert not dentro_del_proyecto(str(root / ".." / ".." / "x.mp4"), root)
    assert not dentro_del_proyecto(str(Path(str(root) + "_otro") / "x.mp4"), root)


def test_proceso_vivo_no_mata_y_detecta_muertos():
    import os
    import subprocess
    import sys

    from pipeline.transcribe_worker import proceso_vivo

    p = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    try:
        assert proceso_vivo(p.pid) is True
        assert p.poll() is None  # comprobarlo no lo mato
    finally:
        p.kill()
        p.wait()
    assert proceso_vivo(p.pid) is False
    assert proceso_vivo(os.getpid()) is True


def test_solo_json(servidor, tmp_path):
    t = FakeT()
    body = {"video": str(tmp_path / "public" / "v.mp4"), "out": str(tmp_path / "public" / "v.transcript.json")}
    st, j = pedir(servidor(t) + "/transcribir", body, ctype="text/plain")
    assert st == 415 and t.llamadas == []


def test_out_solo_transcript_en_public(servidor, tmp_path):
    t = FakeT()
    url = servidor(t) + "/transcribir"
    for video, out in [("public/v.mp4", "src/index.ts"), ("public/v.mp4", "public/v.edit.json"), ("src/v.mp4", "public/v.transcript.json")]:
        st, _ = pedir(url, {"video": str(tmp_path / video), "out": str(tmp_path / out)})
        assert st == 400, (video, out)
    assert t.llamadas == []


def test_no_pisa_un_transcript_mas_nuevo(servidor, tmp_path):
    t = FakeT(espera=0.5)
    out = tmp_path / "public" / "v.transcript.json"
    res = {}
    h = threading.Thread(target=lambda: res.update(r=pedir(servidor(t) + "/transcribir", {"video": str(tmp_path / "public" / "v.mp4"), "out": str(out)})))
    h.start()
    time.sleep(0.2)
    out.write_text("de la linea de comandos", encoding="utf-8")  # el fallback escribio mientras tanto
    h.join()
    st, j = res["r"]
    assert st == 409 and j["ok"] is False
    assert out.read_text(encoding="utf-8") == "de la linea de comandos"
    assert not list((tmp_path / "public").glob("*.tmp"))
