"""versioning and tailor rules

Revision ID: a3f1b2c4d5e6
Revises: 02a8265e2e41
Create Date: 2026-02-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f1b2c4d5e6'
down_revision: Union[str, None] = '02a8265e2e41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to resume_versions
    op.add_column('resume_versions', sa.Column('source', sa.String(50), server_default='manual_edit', nullable=False))
    op.add_column('resume_versions', sa.Column('is_active', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('resume_versions', sa.Column('label', sa.String(100), nullable=True))

    # Back-fill: set is_active where version_number matches the resume's current_version
    op.execute("""
        UPDATE resume_versions
        SET is_active = TRUE
        WHERE id IN (
            SELECT rv.id FROM resume_versions rv
            JOIN resumes r ON rv.resume_id = r.id
            WHERE rv.version_number = r.current_version
        )
    """)

    # Create tailor_rules table
    op.create_table(
        'tailor_rules',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('application_id', sa.String(), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=True),
        sa.Column('rule_text', sa.Text(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('tailor_rules')
    op.drop_column('resume_versions', 'label')
    op.drop_column('resume_versions', 'is_active')
    op.drop_column('resume_versions', 'source')
