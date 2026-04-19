"""Merge branch A (resume-templates/credentials) with branch B (multi-user)

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9, f1a2b3c4d5e6
Create Date: 2026-04-18 00:00:00.000000

Branch A: ...b1c2d3e4f5a6 -> d4e5f6a7b8c9 -> e2f3a4b5c6d7 -> f1a2b3c4d5e6
Branch B: ...a1b2c3d4e5f6 -> b2c3d4e5f6a7 -> c4d5e6f7a8b9 (multi-user)

Both branches were applied to the DB independently; this migration merges
the two Alembic heads so the history is linear again.
"""
from typing import Sequence, Union

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, tuple, None] = ("c4d5e6f7a8b9", "f1a2b3c4d5e6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
