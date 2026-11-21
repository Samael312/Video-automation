from pipeline.quality import low_confidence_ratio


def test_empty_list_is_zero():
    assert low_confidence_ratio([]) == 0.0


def test_half_below_threshold():
    words = [{"score": s} for s in (0.9, 0.2, 0.4, 0.8)]
    assert low_confidence_ratio(words, 0.5) == 0.5


def test_missing_score_counts_as_low():
    assert low_confidence_ratio([{"word": "x"}, {"score": 0.9}]) == 0.5


from pipeline.quality import RETRY_RATIO, needs_retry, pick_plain


def test_needs_retry_only_when_many_words_are_low_confidence():
    assert not needs_retry(0.10)
    assert not needs_retry(RETRY_RATIO)
    assert needs_retry(0.45)  # TOP5_PALABRAS con prompt: salio traducido al ingles
    assert needs_retry(1.0)  # RUN con prompt: solo la primera frase


def test_pick_plain_when_it_is_more_confident():
    assert pick_plain(0.45, 0.08)
    assert not pick_plain(0.30, 0.40)


def test_pick_plain_keeps_prompt_on_tie():
    assert not pick_plain(0.30, 0.30)
