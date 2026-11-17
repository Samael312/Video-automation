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
