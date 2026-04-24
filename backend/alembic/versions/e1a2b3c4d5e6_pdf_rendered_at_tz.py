"""Make pdf_rendered_at TIMESTAMPTZ to match the rest of the schema

Revision ID: e1a2b3c4d5e6
Revises: f2b3c4d5e6a7
Create Date: 2026-04-24 03:00:00.000000

The column was originally added as plain TIMESTAMP (no tz). Every other
datetime in the schema inherits from BaseModel which uses
DateTime(timezone=True). The serving code writes datetime.now(timezone.utc),
so on Postgres the tz-aware value fails to bind against the tz-naive column
with asyncpg's "can't subtract offset-naive and offset-aware datetimes"
error. This migration realigns the column with the rest of the schema.

Existing naive values were written by the app in UTC, so the cast
`USING pdf_rendered_at AT TIME ZONE 'UTC'` preserves the instant.
SQLite ignores the tz flag entirely, so batch_alter_table is a no-op there.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1a2b3c4d5e6"
down_revision: Union[str, None] = "f2b3c4d5e6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE resume_versions "
            "ALTER COLUMN pdf_rendered_at TYPE TIMESTAMP WITH TIME ZONE "
            "USING pdf_rendered_at AT TIME ZONE 'UTC'"
        )
    else:
        with op.batch_alter_table("resume_versions") as batch_op:
            batch_op.alter_column(
                "pdf_rendered_at",
                existing_type=sa.DateTime(),
                type_=sa.DateTime(timezone=True),
                existing_nullable=True,
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE resume_versions "
            "ALTER COLUMN pdf_rendered_at TYPE TIMESTAMP WITHOUT TIME ZONE "
            "USING pdf_rendered_at AT TIME ZONE 'UTC'"
        )
    else:
        with op.batch_alter_table("resume_versions") as batch_op:
            batch_op.alter_column(
                "pdf_rendered_at",
                existing_type=sa.DateTime(timezone=True),
                type_=sa.DateTime(),
                existing_nullable=True,
            )
