"""Add ghost tracking fields to applications

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-08 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Timestamp of the last status change — used as the primary ghost timer baseline.
    # NULL for existing apps; the service falls back to applied_date then created_at.
    op.add_column('applications', sa.Column(
        'status_changed_at',
        sa.DateTime(timezone=True),
        nullable=True,
    ))
    # Timestamp of when the app was most recently ghosted (auto or manual).
    op.add_column('applications', sa.Column(
        'ghosted_at',
        sa.DateTime(timezone=True),
        nullable=True,
    ))
    # Per-application opt-out of auto-ghosting.
    op.add_column('applications', sa.Column(
        'ghost_disabled',
        sa.Boolean(),
        nullable=False,
        server_default=sa.text('false'),
    ))


def downgrade() -> None:
    op.drop_column('applications', 'ghost_disabled')
    op.drop_column('applications', 'ghosted_at')
    op.drop_column('applications', 'status_changed_at')
