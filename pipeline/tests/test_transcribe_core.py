import dataclasses
import json
import sys
import types

import numpy as np

from pipeline.transcribe_core import Transcriptor


@dataclasses.dataclass
class Opts:
    initial_prompt: str | None = None


class FakeModel:
    def __init__(self, fake, prompt):
        self.fake = fake
        self.options = Opts(prompt)

    def transcribe(self, audio, batch_size=4):
        self.fake.prompts_usados.append(self.options.initial_prompt)
        return {"language": self.fake.lang, "segments": [{"start": 0.0, "end": 1.0, "text": " hola there"}]}


class FakeWhisperx(types.SimpleNamespace):
    """whisperx falso: cuenta cargas y devuelve palabras fijas (score bajo si low=True y hay prompt)."""

    def __init__(self, lang="es", low_con_prompt=False, siempre_bajo=False):
        super().__init__()
        self.siempre_bajo = siempre_bajo
        self.lang = lang
        self.low_con_prompt = low_con_prompt
        self.cargas_modelo = 0
        self.cargas_align = []
        self.prompts_usados = []

    def load_audio(self, path):
        return np.zeros(16000 * 2, dtype=np.float32)

    def load_model(self, name, device, compute_type=None, asr_options=None):
        self.cargas_modelo += 1
        return FakeModel(self, (asr_options or {}).get("initial_prompt"))

    def load_align_model(self, language_code, device):
        self.cargas_align.append(language_code)
        return object(), {}

    def align(self, segments, model, meta, audio, device):
        score = 0.1 if self.siempre_bajo or (self.low_con_prompt and self.prompts_usados[-1]) else 0.9
        words = [{"word": "hola", "start": 0.1, "end": 0.4, "score": score}, {"word": "there", "start": 0.5, "end": 0.9, "score": score}]
        return {"segments": [{"start": 0.0, "end": 1.0, "text": " hola there", "words": words}]}


def run(tmp_path, fake, **kw):
    video = tmp_path / "v.mp4"
    video.write_bytes(b"x")
    out = tmp_path / "out.json"
    t = kw.pop("t", None) or Transcriptor(whisperx_mod=fake, log=lambda *_: None)
    args = {"model": "medium", "prompt": None, "diarize": False, **kw}
    payload = t.transcribir(video, out, **args)
    return t, payload, json.loads(out.read_text(encoding="utf-8"))


def test_sin_diarizar_todo_speaker_00_y_sin_pyannote(tmp_path):
    sys.modules.pop("whisperx.diarize", None)
    _, payload, escrito = run(tmp_path, FakeWhisperx())
    assert payload == escrito
    assert payload["speakers"] == ["SPEAKER_00"]
    assert all(w["speaker"] == "SPEAKER_00" for w in payload["words"])
    assert all(s["speaker"] == "SPEAKER_00" for s in payload["segments"])
    assert "whisperx.diarize" not in sys.modules


def test_claves_del_payload(tmp_path):
    _, payload, _ = run(tmp_path, FakeWhisperx())
    assert set(payload) == {"video", "language", "model", "vocab_prompt", "duration", "speakers", "segments", "words"}
    assert payload["video"] == "v.mp4" and payload["duration"] == 2.0
    assert payload["words"][0] == {"word": "hola", "start": 0.1, "end": 0.4, "speaker": "SPEAKER_00", "score": 0.9}


def test_modelo_en_cache_y_prompt_sin_recargar(tmp_path):
    fake = FakeWhisperx()
    t, _, _ = run(tmp_path, fake, prompt="vocab uno")
    run(tmp_path, fake, t=t, prompt="vocab dos")
    run(tmp_path, fake, t=t, prompt=None)
    assert fake.cargas_modelo == 1
    assert fake.prompts_usados == ["vocab uno", "vocab dos", None]


def test_alineador_una_vez_por_idioma(tmp_path):
    fake = FakeWhisperx(lang="es")
    t, _, _ = run(tmp_path, fake)
    run(tmp_path, fake, t=t)
    fake.lang = "en"
    run(tmp_path, fake, t=t)
    assert fake.cargas_align == ["es", "en"]


def test_reintento_sin_prompt_con_baja_confianza(tmp_path):
    fake = FakeWhisperx(low_con_prompt=True)
    _, payload, _ = run(tmp_path, fake, prompt="vocab")
    assert fake.prompts_usados == ["vocab", None]
    assert payload["vocab_prompt"] is False


def test_aviso_de_baja_confianza(tmp_path):
    logs = []
    t = Transcriptor(whisperx_mod=FakeWhisperx(siempre_bajo=True), log=logs.append)
    _, payload, _ = run(tmp_path, None, t=t)
    assert any(m.startswith("AVISO: 100% de palabras con baja confianza") for m in logs)
    assert t.ultimo_ratio == 1.0
    assert "baja_confianza" not in payload  # el JSON no cambia de forma


def test_sin_aviso_con_buena_confianza(tmp_path):
    logs = []
    t = Transcriptor(whisperx_mod=FakeWhisperx(), log=logs.append)
    run(tmp_path, None, t=t)
    assert not any("AVISO" in m for m in logs) and t.ultimo_ratio == 0.0


def test_solo_un_modelo_en_memoria(tmp_path):
    fake = FakeWhisperx()
    t, _, _ = run(tmp_path, fake, model="medium")
    run(tmp_path, fake, t=t, model="small")
    assert t.modelos() == ["small"]
    run(tmp_path, fake, t=t, model="medium")
    assert t.modelos() == ["medium"] and fake.cargas_modelo == 3
