"""Logica comun de transcripcion (linea de comandos y trabajador en memoria).

Transcriptor guarda los modelos cargados: Whisper por nombre y el alineador por idioma.
La diarizacion (pyannote) solo se importa si se pide.
"""
import dataclasses
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quality import low_confidence_ratio, needs_retry, pick_plain  # noqa: E402

SIN_HABLANTE = "SPEAKER_00"


class Transcriptor:
    def __init__(self, whisperx_mod=None, device="cpu", compute="int8", log=None):
        if whisperx_mod is None:
            import whisperx as whisperx_mod  # import pesado: solo si no lo inyectan
        self.wx = whisperx_mod
        self.device = device
        self.compute = compute
        self._t0 = time.time()
        self.log = log or (lambda msg: print(f"[{time.time() - self._t0:6.1f}s] {msg}", flush=True))
        self._modelos = {}
        self._alineadores = {}
        self.ultimo_ratio = None  # fraccion de palabras de baja confianza de la ultima transcripcion

    def modelos(self):
        return sorted(self._modelos)

    def modelo(self, nombre, prompt=None):
        m = self._modelos.get(nombre)
        if m is None:
            self._modelos.clear()  # un solo modelo en memoria: otro tamano libera el anterior (1-3 GB)
            self.log(f"cargando Whisper '{nombre}' ({self.device}/{self.compute})")
            m = self.wx.load_model(nombre, self.device, compute_type=self.compute, asr_options={"initial_prompt": prompt})
            self._modelos[nombre] = m
            return m
        if getattr(m.options, "initial_prompt", None) != prompt:
            try:
                m.options = dataclasses.replace(m.options, initial_prompt=prompt)
            except Exception:  # version sin opciones reemplazables: recargar
                del self._modelos[nombre]
                return self.modelo(nombre, prompt)
        return m

    def alineador(self, lang):
        if lang not in self._alineadores:
            self.log(f"cargando alineador '{lang}'")
            self._alineadores[lang] = self.wx.load_align_model(language_code=lang, device=self.device)
        return self._alineadores[lang]

    def _pase(self, nombre, audio, prompt):
        self.log(f"transcribiendo con '{nombre}'{'' if prompt else ' sin prompt de vocabulario'}")
        raw = self.modelo(nombre, prompt).transcribe(audio, batch_size=4)
        lang = raw["language"]
        self.log(f"idioma detectado: {lang}")
        self.log("alineando palabras")
        am, meta = self.alineador(lang)
        aligned = self.wx.align(raw["segments"], am, meta, audio, self.device)
        ratio = low_confidence_ratio([w for s in aligned["segments"] for w in s.get("words", []) if "start" in w])
        return lang, aligned, ratio

    def transcribir(self, video, out, model="medium", prompt=None, diarize=False, speakers=None, token=None):
        video, out = Path(video), Path(out)
        self.log("cargando audio")
        audio = self.wx.load_audio(str(video))
        lang, result, ratio = self._pase(model, audio, prompt)
        used_prompt = prompt is not None
        if used_prompt and needs_retry(ratio):
            # el prompt de vocabulario (ingles) a veces traduce o se salta frases: se prueba sin el y se queda la mejor
            self.log(f"{ratio:.0%} de palabras con baja confianza con el prompt de vocabulario: reintento sin prompt")
            lang2, result2, ratio2 = self._pase(model, audio, None)
            if pick_plain(ratio, ratio2):
                self.log(f"uso la version sin prompt ({ratio2:.0%} baja confianza vs {ratio:.0%})")
                lang, result, ratio, used_prompt = lang2, result2, ratio2, False
            else:
                self.log(f"me quedo con la version con prompt ({ratio:.0%} vs {ratio2:.0%} sin prompt)")

        if diarize:
            from whisperx.diarize import DiarizationPipeline  # solo aqui: pyannote es lento de importar
            self.log("diarizando (pyannote)")
            diar = DiarizationPipeline(token=token, device=self.device)(audio, num_speakers=speakers)
            result = self.wx.assign_word_speakers(diar, result)
            por_defecto = "UNKNOWN"
        else:
            por_defecto = SIN_HABLANTE

        words = []
        for seg in result["segments"]:
            for w in seg.get("words", []):
                if "start" not in w:  # palabras sin alinear (numeros, simbolos)
                    continue
                words.append({
                    "word": w["word"],
                    "start": round(w["start"], 3),
                    "end": round(w["end"], 3),
                    "speaker": (w.get("speaker") or seg.get("speaker") or por_defecto) if diarize else SIN_HABLANTE,
                    "score": round(w.get("score", 0), 3),
                })
        payload = {
            "video": video.name,
            "language": lang,
            "model": model,
            "vocab_prompt": used_prompt,
            "duration": round(len(audio) / 16000, 3),
            "speakers": sorted({w["speaker"] for w in words}) if words else ([] if diarize else [SIN_HABLANTE]),
            "segments": [
                {"start": round(s["start"], 3), "end": round(s["end"], 3),
                 "speaker": s.get("speaker", por_defecto) if diarize else SIN_HABLANTE, "text": s["text"].strip()}
                for s in result["segments"]
            ],
            "words": words,
        }
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.log(f"OK -> {out}  ({len(words)} palabras, hablantes: {payload['speakers']})")
        self.ultimo_ratio = low_confidence_ratio(words)
        if needs_retry(self.ultimo_ratio):
            self.log(f"AVISO: {self.ultimo_ratio:.0%} de palabras con baja confianza; revisa {out} antes de renderizar")
        return payload
