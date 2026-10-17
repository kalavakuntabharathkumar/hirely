"""Stage rules: valid moves, invalid jumps, Hired is final, Rejected, reopen."""
import pytest

from app.stages import STAGES, allowed_moves, can_move

VALID = [
    ("Applied", "Screening"), ("Screening", "Interview"), ("Interview", "Offer"), ("Offer", "Hired"),
    ("Screening", "Applied"), ("Interview", "Screening"), ("Offer", "Interview"),
    ("Rejected", "Applied"),
]
INVALID = [
    ("Applied", "Interview"), ("Applied", "Offer"), ("Applied", "Hired"), ("Screening", "Hired"),
    ("Applied", "Applied"), ("Applied", "Nonsense"), ("Offer", "Applied"), ("Rejected", "Screening"),
    ("Rejected", "Rejected"), ("Hired", "Offer"), ("Hired", "Applied"), ("Hired", "Rejected"),
]


@pytest.mark.parametrize("current,target", VALID)
def test_valid_moves(current, target):
    assert can_move(current, target)


@pytest.mark.parametrize("current,target", INVALID)
def test_invalid_moves(current, target):
    assert not can_move(current, target)


@pytest.mark.parametrize("stage", ["Applied", "Screening", "Interview", "Offer"])
def test_rejected_allowed_from_every_stage_except_hired(stage):
    assert can_move(stage, "Rejected")


def test_hired_is_final():
    assert allowed_moves("Hired") == []


def test_rejected_can_only_reopen_to_applied():
    assert allowed_moves("Rejected") == ["Applied"]


def test_unknown_stage_has_no_moves():
    assert allowed_moves("Nonsense") == []


def test_every_known_stage_returns_known_targets():
    for stage in STAGES:
        assert set(allowed_moves(stage)) <= set(STAGES)
