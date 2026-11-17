import re
from pathlib import Path

from pipeline import audio_clean
from pipeline.audio_common import ffmpeg, loudnorm_second_pass, parse_loudnorm, run

# Receta de video-cleanup con dos arreglos: se procesa en float (en 16 bit el realce de 3.2 kHz
# recortaba una voz que ya pica cerca de 0 dBFS -> clics) y el agudo es un shelf de verdad
# (en ffmpeg `t=h` es "ancho en Hz": era un pico de 0.7 Hz a 7 kHz).
PROVEN = ("aformat=sample_fmts=fltp,"
          "equalizer=f=220:t=q:w=1.2:g=-2,"
          "equalizer=f=3200:t=q:w=1.0:g=2.5,"
          "highshelf=f=7000:g=1.5,"
          "acompressor=threshold=-24dB:ratio=3:attack=8:release=150:makeup=2")

STDERR = """[Parsed_loudnorm_0 @ 000001]
{
	"input_i" : "-23.4",
	"input_tp" : "-5.1",
	"input_lra" : "6.0",
	"input_thresh" : "-33.9",
	"output_i" : "-14.1",
	"output_tp" : "-1.6",
	"output_lra" : "5.0",
	"output_thresh" : "-24.5",
	"normalization_type" : "dynamic",
	"target_offset" : "0.2"
}
"""


def test_post_chain_is_the_proven_recipe():
    assert audio_clean.POST_CHAIN == PROVEN


def test_post_chain_does_not_clip_hot_16bit_voice(tmp_path):
    """Un tono de 3.2 kHz a -0.1 dBFS en 16 bit no debe recortar al pasar por la cadena."""
    src = tmp_path / "hot.wav"
    run([ffmpeg(), "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=3200:d=1:sample_rate=48000",
         "-af", "volume=7.8", "-c:a", "pcm_s16le", src])  # sine sale a 1/8: x7.8 = -0.2 dBFS
    eq = audio_clean.POST_CHAIN.split(",acompressor")[0]
    out = run([ffmpeg(), "-hide_banner", "-nostats", "-i", src, "-af", f"{eq},astats",
               "-f", "null", "-"], capture=True)
    peak = float(re.search(r"Peak level dB:\s*(-?[\d.]+)", out).group(1))
    assert peak > 1  # +2.5 dB sobre -0.2 dBFS: en float pasa de 0; en 16 bit se quedaba en 0 (recorte)


def test_parse_loudnorm_reads_json():
    assert parse_loudnorm(STDERR)["input_i"] == "-23.4"


def test_second_pass_has_measured_values():
    s = loudnorm_second_pass(parse_loudnorm(STDERR))
    assert "I=-14:TP=-1.5:LRA=9" in s
    assert "measured_I=-23.4" in s
    assert "offset=0.2" in s
    assert "linear=true" in s


def test_source_uses_raw_when_present(tmp_path):
    raw = tmp_path / "X.raw.wav"
    raw.write_bytes(b"x")
    assert audio_clean.source_for(tmp_path / "X.mp4", raw) == raw


def test_source_uses_video_first_time(tmp_path):
    assert audio_clean.source_for(tmp_path / "X.mp4", tmp_path / "X.raw.wav") == tmp_path / "X.mp4"


def test_raw_path_sits_next_to_video():
    assert audio_clean.raw_path(Path("public/X.mp4")) == Path("public/X.raw.wav")


def test_no_audio_stream_is_skipped(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(audio_clean, "has_audio", lambda p: False)
    assert audio_clean.main([str(tmp_path / "X.mp4")]) == 0
    assert "sin audio" in capsys.readouterr().out


def test_missing_deep_filter_exits_with_setup_hint(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(audio_clean, "has_audio", lambda p: True)
    monkeypatch.setattr(audio_clean, "find_deep_filter", lambda: None)
    assert audio_clean.main([str(tmp_path / "X.mp4")]) == 3
    assert "npm run setup-audio" in capsys.readouterr().err
