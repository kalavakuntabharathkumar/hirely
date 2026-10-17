"""Stage-move rules. This is the ONLY place that decides which moves are legal.

The Advance button, the stepper and the Kanban board all ask the server, and the
server asks this file, so the screens can never disagree.
"""
PIPELINE = ("Applied", "Screening", "Interview", "Offer", "Hired")
REJECTED = "Rejected"
STAGES = PIPELINE + (REJECTED,)


def allowed_moves(stage: str) -> list[str]:
    """Forward one step, back one step, or Rejected (never from Hired).

    Hired is final. A Rejected candidate can only be reopened to Applied.
    """
    if stage not in STAGES or stage == "Hired":
        return []
    if stage == REJECTED:
        return ["Applied"]
    i = PIPELINE.index(stage)
    moves = [PIPELINE[i + 1], REJECTED]
    if i > 0:
        moves.insert(0, PIPELINE[i - 1])
    return moves


def can_move(current: str, target: str) -> bool:
    return target in allowed_moves(current)
