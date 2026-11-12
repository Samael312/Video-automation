from pathlib import Path

import pytest
from pipeline.matte_paths import downsample_ratio, resolve_paths

ROOT = Path("/proj")


@pytest.mark.parametrize("arg", ["ACTUALLY", "ACTUALLY.mp4", "public/ACTUALLY.mp4", "media/input/ACTUALLY.mp4"])
def test_resolve_paths_siempre_usa_el_video_normalizado_de_public(arg):
    src, out = resolve_paths(arg, ROOT)
    assert src == ROOT / "public" / "ACTUALLY.mp4"
    assert out == ROOT / "public" / "ACTUALLY.matte.webm"


def test_downsample_ratio_apunta_a_512_px_en_el_lado_largo():
    assert downsample_ratio(1280, 720) == pytest.approx(0.4)
    assert downsample_ratio(400, 300) == 1.0
