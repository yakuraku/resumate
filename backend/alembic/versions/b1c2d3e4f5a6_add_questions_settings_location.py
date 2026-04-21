"""add questions settings location

Revision ID: b1c2d3e4f5a6
Revises: a3f1b2c4d5e6
Create Date: 2026-02-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a3f1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add location column to applications
    op.add_column('applications', sa.Column('location', sa.String(255), nullable=True))

    # Create application_questions table
    op.create_table(
        'application_questions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('application_id', sa.String(), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('answer_text', sa.Text(), nullable=True),
        sa.Column('is_ai_generated', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Create user_settings table
    op.create_table(
        'user_settings',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('setting_key', sa.String(100), unique=True, nullable=False),
        sa.Column('setting_value', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('user_settings')
    op.drop_table('application_questions')
    op.drop_column('applications', 'location')
