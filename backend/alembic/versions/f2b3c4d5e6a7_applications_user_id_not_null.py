"""Set applications.user_id NOT NULL

Revision ID: f2b3c4d5e6a7
Revises: e6f7a8b9c0d1
Create Date: 2026-04-21 00:00:00.000000

Any existing rows with NULL user_id are assigned to the first admin user
before the NOT NULL constraint is applied so the migration is safe on
production databases that were seeded before multi-user was introduced.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = "f2b3c4d5e6a7"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Assign any orphaned applications (user_id IS NULL) to the first admin.
    result = conn.execute(
        text("SELECT id FROM users WHERE is_admin = true ORDER BY created_at LIMIT 1")
    ).fetchone()
    if result:
        admin_id = result[0]
        conn.execute(
            text("UPDATE applications SET user_id = :uid WHERE user_id IS NULL"),
            {"uid": admin_id},
        )

    # 2. Set NOT NULL constraint on user_id.
    op.alter_column(
        "applications",
        "user_id",
        existing_type=sa.String(),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "applications",
        "user_id",
        existing_type=sa.String(),
        nullable=True,
    )
