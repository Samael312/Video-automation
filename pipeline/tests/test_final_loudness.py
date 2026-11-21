from pipeline.audio_common import ffmpeg
from pipeline.final_loudness import needs_fix


def test_on_target_is_ok():
    assert needs_fix(-14.0, -2) is False


def test_too_quiet():
    assert needs_fix(-15.2, -2) is True


def test_too_loud():
    assert needs_fix(-12.8, -2) is True


def test_peak_too_high():
    assert needs_fix(-14, -0.5) is True


def test_edges_are_ok():
    assert needs_fix(-13.1, -1.0) is False


def test_unmeasured_is_fixed():
    assert needs_fix(None, None) is True


def _durations(p):
    import subprocess
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "csv=p=0",
                          str(p)], capture_output=True, text=True, check=True).stdout.split()
    return {line.split(",")[0]: float(line.split(",")[1]) for line in out}


def test_fix_keeps_audio_as_long_as_video(tmp_path):
    """Recodificar a AAC mete relleno (~60 ms): el audio no debe pasar al video (voz IA a -22 LUFS con pico alto: loudnorm pasa a modo dinamico)."""
    from pipeline import final_loudness
    from pipeline.audio_common import run as frun
    video = tmp_path / "v.mp4"
    frun([ffmpeg(), "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=30:d=28.233",
          "-f", "lavfi", "-i", r"aevalsrc=if(lt(t\,0.3)\,0.6\,0.05)*sin(2*PI*440*t):s=48000:d=28.245",
          "-ac", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video])
    assert final_loudness.main([str(video)]) == 0
    d = _durations(video)
    assert d["audio"] - d["video"] <= 0.04
