from pathlib import Path

import numpy as np
import pytest
from pipeline.matte_paths import behind_ranges, covers, downsample_ratio, head_top, resolve_paths

ROOT = Path("/proj")


@pytest.mark.parametrize("arg", ["ACTUALLY", "ACTUALLY.mp4", "ACTUALLY.mov", "public/ACTUALLY.mp4", "media/input/ACTUALLY.MOV"])
def test_resolve_paths_siempre_usa_el_video_normalizado_de_public(arg):
    src, out, info = resolve_paths(arg, ROOT)
    assert src == ROOT / "public" / "ACTUALLY.mp4"
    assert out == ROOT / "public" / "ACTUALLY.matte.webm"
    assert info == ROOT / "public" / "ACTUALLY.matte.json"


def test_downsample_ratio_apunta_a_512_px_en_el_lado_largo():
    assert downsample_ratio(1280, 720) == pytest.approx(0.4)
    assert downsample_ratio(400, 300) == 1.0


def plan(title_behind=False, items=()):
    p = {"overlays": [{"kind": "item", "start": s, "end": e, "behind": b} for s, e, b in items]}
    p["title"] = {"start": 0, "end": 2.6, "behind": title_behind}
    return p


def test_behind_ranges_solo_lo_que_va_detras_con_margen_y_unidos():
    r = behind_ranges(plan(True, [(2.6, 4.4, True), (7.9, 9.4, False), (12, 13, True)]), duration=20)
    # titulo 0-2.6 e item 2.6-4.4 se unen; el item sin behind no cuenta
    assert r == [(0.0, 4.6), (11.5, 13.2)]


def test_behind_ranges_vacio_y_recortado_a_la_duracion():
    assert behind_ranges(plan(), duration=20) == []
    assert behind_ranges(plan(False, [(19.5, 20, True)]), duration=19.8) == [(19.0, 19.8)]


def test_covers():
    assert covers([(0, 5), (10, 12)], [(1, 2), (10.5, 11)])
    assert not covers([(0, 5)], [(4, 6)])
    assert covers([(0, 5)], [])


def test_head_top_primera_fila_con_persona_en_el_centro():
    a = np.zeros((100, 40), np.uint8)
    a[30:, 15:25] = 255  # persona desde la fila 30, centrada
    a[5:8, 0:3] = 255  # ruido en el borde: no cuenta
    assert head_top(a) == 30
    assert head_top(np.zeros((100, 40), np.uint8)) is None
