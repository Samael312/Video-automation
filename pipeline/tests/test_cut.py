import pytest
from pipeline.cut import compute_keep_segments


def w(start, end):
    return {"word": "x", "start": start, "end": end}


def test_no_words_keeps_everything():
    assert compute_keep_segments([], 6.0) == [{"start": 0, "end": 6.0}]


def test_no_long_pauses_single_segment():
    words = [w(0.0, 1.0), w(1.3, 2.0), w(2.5, 3.0)]
    assert compute_keep_segments(words, 3.0) == [{"start": 0, "end": 3.0}]


def test_long_pauses_are_cut_with_padding():
    words = [w(1.0, 2.0), w(4.0, 5.0)]
    segs = compute_keep_segments(words, 6.0, gap_threshold=0.7, pad=0.1)
    assert segs == [{"start": 0.9, "end": 2.1}, {"start": 3.9, "end": 5.1}]


def test_short_leading_pause_is_kept():
    words = [w(0.5, 1.0)]
    segs = compute_keep_segments(words, 1.2, gap_threshold=0.7)
    assert segs[0]["start"] == 0


def test_gap_equal_to_threshold_is_kept():
    words = [w(0.0, 1.0), w(1.7, 2.0)]
    assert compute_keep_segments(words, 2.0, gap_threshold=0.7) == [{"start": 0, "end": 2.0}]


def test_segments_are_valid_and_inside_duration():
    words = [w(0.05, 0.5), w(3.0, 3.5), w(8.0, 9.9)]
    segs = compute_keep_segments(words, 10.0)
    for s in segs:
        assert 0 <= s["start"] < s["end"] <= 10.0
    assert all(a["end"] <= b["start"] for a, b in zip(segs, segs[1:]))
