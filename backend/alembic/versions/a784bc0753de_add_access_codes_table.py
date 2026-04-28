"""Add access_codes table for invite-gated signup.

Revision ID: a784bc0753de
Revises: e1a2b3c4d5e6
Create Date: 2026-04-28 12:37:02.495144

Stores admin-issued access codes that gate the public signup endpoint.
A code can be shared (max_uses=None = unlimited) or single-use (max_uses=1).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a784bc0753de"
down_revision: Union[str, None] = "e1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "access_codes",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("max_uses", sa.Integer, nullable=True),
        sa.Column("use_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_access_codes_code"),
    )
    op.create_index("ix_access_codes_code", "access_codes", ["code"])


def downgrade() -> None:
    op.drop_index("ix_access_codes_code", table_name="access_codes")
    op.drop_table("access_codes")
