from pipeline.quality import low_confidence_ratio


def test_empty_list_is_zero():
    assert low_confidence_ratio([]) == 0.0


def test_half_below_threshold():
    words = [{"score": s} for s in (0.9, 0.2, 0.4, 0.8)]
    assert low_confidence_ratio(words, 0.5) == 0.5


def test_missing_score_counts_as_low():
    assert low_confidence_ratio([{"word": "x"}, {"score": 0.9}]) == 0.5
