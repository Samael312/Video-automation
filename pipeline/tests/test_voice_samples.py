import subprocess
from pathlib import Path

from pipeline import voice_samples as vs
from pipeline.audio_common import ffmpeg, run


def touch(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"x")


def test_pending_skips_done(tmp_path):
    raw, samples = tmp_path / "raw", tmp_path / "samples"
    for n in ["a.mp4", "b.MOV", "c.txt", "clase día 3.mp4"]:
        touch(raw / n)
    touch(samples / "a.mp3")
    touch(samples / "b.descartado")
    assert [p.name for p in vs.pending(raw, samples, False)] == ["clase día 3.mp4"]
    assert [p.name for p in vs.pending(raw, samples, True)] == ["a.mp4", "b.MOV", "clase día 3.mp4"]


def test_fmt():
    assert vs.fmt(1122.4) == "18:42"
    assert vs.fmt(0) == "0:00"
    assert vs.fmt(3600) == "60:00"


def test_summary_missing():
    s = vs.summary([600, 522.4], ["viejo_3.mp4"])
    assert "2 archivos" in s
    assert "18:42 de voz" in s
    assert "faltan 11:18" in s
    assert "descartados: 1 (musica/ruido): viejo_3.mp4" in s


def test_summary_ready():
    s = vs.summary([1900], [])
    assert "listo para subir: media/voice/samples/" in s
    assert "faltan" not in s


def duration(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def test_strip_silence(tmp_path):
    src = tmp_path / "con espacio.wav"
    run([ffmpeg(), "-v", "error", "-y",
         "-f", "lavfi", "-i", "sine=f=440:d=2:sample_rate=44100",
         "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=3",
         "-f", "lavfi", "-i", "sine=f=440:d=2:sample_rate=44100",
         "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", src])
    out = tmp_path / "salida día.wav"
    run([ffmpeg(), "-v", "error", "-y", "-i", src, "-af", vs.strip_silence_filter(), out])
    assert 4.6 <= duration(out) <= 4.85  # ffmpeg 7+: la pausa larga queda en stop_duration (0.7 s)


def test_failed_sample_leaves_no_mp3(tmp_path, monkeypatch):
    """Si ffmpeg falla, no queda un mp3 roto que pending() saltaria para siempre."""
    raw, samples = tmp_path / "raw", tmp_path / "samples"
    (raw).mkdir()
    (raw / "bad.mp4").write_bytes(b"no es un video")
    touch(samples / "bad.mp3")  # muestra truncada de una corrida anterior
    monkeypatch.setattr(vs, "find_deep_filter", lambda: "deep-filter")
    assert vs.main(["--raw", str(raw), "--samples", str(samples), "--force"]) == 0
    assert not (samples / "bad.mp3").exists()
