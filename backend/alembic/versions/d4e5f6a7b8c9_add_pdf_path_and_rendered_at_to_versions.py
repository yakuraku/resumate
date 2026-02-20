"""Add pdf_path and pdf_rendered_at to resume_versions

Revision ID: d4e5f6a7b8c9
Revises: c0ea2c519fe7
Create Date: 2026-02-20 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c0ea2c519fe7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('resume_versions',
        sa.Column('pdf_path', sa.String(length=500), nullable=True)
    )
    op.add_column('resume_versions',
        sa.Column('pdf_rendered_at', sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('resume_versions', 'pdf_rendered_at')
    op.drop_column('resume_versions', 'pdf_path')
