"""Add resume_templates table and link to applications

Revision ID: f1a2b3c4d5e6
Revises: e2f3a4b5c6d7
Create Date: 2026-02-22 00:00:00.000000
"""
from typing import Sequence, Union
from pathlib import Path

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _read_master_yaml() -> str:
    """Read the master-resume_CV.yaml from project root."""
    # Walk up from this file to find the project root
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    master_path = project_root / "master-resume_CV.yaml"
    if master_path.exists():
        return master_path.read_text(encoding="utf-8")
    # Fallback minimal YAML
    return "cv:\n  name: Master Resume\nsections: {}\n"


def upgrade() -> None:
    # 1. Create resume_templates table
    op.create_table(
        'resume_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('yaml_content', sa.Text(), nullable=False),
        sa.Column('is_master', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_starred', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    # 2. Add new columns to applications
    op.add_column('applications',
        sa.Column('resume_template_id', sa.String(), nullable=True)
    )
    op.add_column('applications',
        sa.Column('resume_snapshot_yaml', sa.Text(), nullable=True)
    )

    # Note: 'status' column already exists from the initial migration

    # 3. Seed the Master ResumeTemplate
    conn = op.get_bind()
    import uuid
    from datetime import datetime

    master_yaml = _read_master_yaml()
    master_id = str(uuid.uuid4())
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    conn.execute(
        text(
            "INSERT INTO resume_templates (id, name, yaml_content, is_master, is_starred, created_at, updated_at) "
            "VALUES (:id, :name, :yaml_content, 1, 0, :created_at, :updated_at)"
        ),
        {
            "id": master_id,
            "name": "Master Resume",
            "yaml_content": master_yaml,
            "created_at": now,
            "updated_at": now,
        }
    )

    # 4. Data migration: for each Application that has a Resume, create a
    #    ResumeTemplate (cloned from master content) and link it back.
    apps_with_resumes = conn.execute(
        text(
            "SELECT a.id, r.yaml_content "
            "FROM applications a "
            "JOIN resumes r ON r.application_id = a.id"
        )
    ).fetchall()

    for app_id, yaml_content in apps_with_resumes:
        template_id = str(uuid.uuid4())
        # Derive a name from the application
        app_row = conn.execute(
            text("SELECT company, role FROM applications WHERE id = :id"),
            {"id": app_id}
        ).fetchone()
        template_name = f"{app_row[0]} - {app_row[1]}" if app_row else f"Template for {app_id}"

        conn.execute(
            text(
                "INSERT INTO resume_templates (id, name, yaml_content, is_master, is_starred, created_at, updated_at) "
                "VALUES (:id, :name, :yaml_content, 0, 0, :created_at, :updated_at)"
            ),
            {
                "id": template_id,
                "name": template_name,
                "yaml_content": yaml_content,
                "created_at": now,
                "updated_at": now,
            }
        )

        conn.execute(
            text(
                "UPDATE applications SET resume_template_id = :template_id WHERE id = :app_id"
            ),
            {"template_id": template_id, "app_id": app_id}
        )

    # 5. Create FK index (SQLite doesn't enforce FK by name but good practice)
    op.create_index(
        'ix_applications_resume_template_id',
        'applications',
        ['resume_template_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_applications_resume_template_id', table_name='applications')
    op.drop_column('applications', 'resume_snapshot_yaml')
    op.drop_column('applications', 'resume_template_id')
    op.drop_table('resume_templates')
