"""Make master templates per-user

Revision ID: c5d6e7f8a9b0
Revises: a784bc0753de
Create Date: 2026-06-16 00:00:00.000000

Previously the master ResumeTemplate had user_id=NULL and was shared globally.
This migration assigns each existing user their own master so saves are no
longer blocked and the master can be edited independently per user.
"""
from typing import Sequence, Union
import uuid
from datetime import datetime

from alembic import op
from sqlalchemy import text

revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'a784bc0753de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Find the global master (user_id IS NULL, is_master = true).
    global_master = conn.execute(
        text("SELECT id, yaml_content FROM resume_templates WHERE is_master = :val AND user_id IS NULL"),
        {"val": True},
    ).fetchone()

    users = conn.execute(text("SELECT id FROM users")).fetchall()

    if not users or not global_master:
        # Nothing to migrate (fresh install or no users yet).
        return

    master_id, master_yaml = global_master[0], global_master[1]
    now = datetime.utcnow()

    # Assign the existing master row to the first user.
    first_user_id = users[0][0]
    conn.execute(
        text("UPDATE resume_templates SET user_id = :uid WHERE id = :id"),
        {"uid": first_user_id, "id": master_id},
    )

    # For any additional users create a fresh copy.
    for row in users[1:]:
        uid = row[0]
        conn.execute(
            text(
                "INSERT INTO resume_templates "
                "(id, user_id, name, yaml_content, is_master, is_starred, created_at, updated_at) "
                "VALUES (:id, :uid, :name, :yaml, :is_master, :is_starred, :created_at, :updated_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "uid": uid,
                "name": "Master Resume",
                "yaml": master_yaml,
                "is_master": True,
                "is_starred": False,
                "created_at": now,
                "updated_at": now,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    # Revert all user-owned masters back to the global (user_id=NULL) state.
    # If there are multiple per-user masters, delete the extras and keep one.
    masters = conn.execute(
        text("SELECT id FROM resume_templates WHERE is_master = :val ORDER BY created_at ASC"),
        {"val": True},
    ).fetchall()

    if not masters:
        return

    # Keep the first master as the global one.
    keep_id = masters[0][0]
    conn.execute(
        text("UPDATE resume_templates SET user_id = NULL WHERE id = :id"),
        {"id": keep_id},
    )
    # Remove any additional per-user masters.
    for row in masters[1:]:
        conn.execute(
            text("DELETE FROM resume_templates WHERE id = :id"),
            {"id": row[0]},
        )
