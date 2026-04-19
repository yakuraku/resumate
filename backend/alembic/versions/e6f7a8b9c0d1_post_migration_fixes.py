"""Post-migration fixes: indexes, interview CASCADE, user_context unique, orphan templates

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-04-18 00:00:00.000000

Fixes applied:
1. Drop the dangerous single-column UNIQUE index on user_context.key (blocks
   multi-user: two users can't have the same key). The composite
   uq_user_context_user_key (user_id, key) remains and is sufficient.
2. Add missing ix_applications_user_id index (ORM model declares index=True
   but the column was added by a migration that omitted CREATE INDEX).
3. Add ix_tailor_rules_user_id index (same omission).
4. Fix interview FK cascade: interview_sessions, interview_questions,
   interview_answers all had ON DELETE NO ACTION; change to CASCADE so
   deleting an application/session cleans up child rows automatically.
5. Assign any resume_templates rows with NULL user_id to the first admin
   user so composite unique constraint (user_id, name) works correctly.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Drop single-column unique index on user_context.key
    # (ix_user_context_key was never dropped by c4d5e6f7a8b9 because that
    # migration targeted a constraint name, not an index name)
    conn.execute(text("DROP INDEX IF EXISTS ix_user_context_key"))

    # 2. Add missing user_id indexes
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_applications_user_id ON applications (user_id)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_tailor_rules_user_id ON tailor_rules (user_id)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_resume_templates_user_id ON resume_templates (user_id)"
    ))

    # 3. Fix interview FK cascade (drop + recreate with ON DELETE CASCADE)
    conn.execute(text(
        "ALTER TABLE interview_sessions "
        "DROP CONSTRAINT IF EXISTS interview_sessions_application_id_fkey"
    ))
    conn.execute(text(
        "ALTER TABLE interview_sessions "
        "ADD CONSTRAINT interview_sessions_application_id_fkey "
        "FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE"
    ))

    conn.execute(text(
        "ALTER TABLE interview_questions "
        "DROP CONSTRAINT IF EXISTS interview_questions_session_id_fkey"
    ))
    conn.execute(text(
        "ALTER TABLE interview_questions "
        "ADD CONSTRAINT interview_questions_session_id_fkey "
        "FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE"
    ))

    conn.execute(text(
        "ALTER TABLE interview_answers "
        "DROP CONSTRAINT IF EXISTS interview_answers_question_id_fkey"
    ))
    conn.execute(text(
        "ALTER TABLE interview_answers "
        "ADD CONSTRAINT interview_answers_question_id_fkey "
        "FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE"
    ))

    # 4. Assign orphaned resume_templates (null user_id) to the first admin user.
    # These are templates seeded before multi-user was introduced (e.g. "Master Resume").
    result = conn.execute(text(
        "SELECT id FROM users WHERE is_admin = true ORDER BY created_at LIMIT 1"
    )).fetchone()
    if result:
        admin_id = result[0]
        conn.execute(text(
            "UPDATE resume_templates SET user_id = :uid WHERE user_id IS NULL"
        ), {"uid": admin_id})


def downgrade() -> None:
    conn = op.get_bind()

    # Restore single-column unique index on user_context.key
    conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_context_key ON user_context (key)"
    ))

    # Drop added indexes
    conn.execute(text("DROP INDEX IF EXISTS ix_applications_user_id"))
    conn.execute(text("DROP INDEX IF EXISTS ix_tailor_rules_user_id"))
    conn.execute(text("DROP INDEX IF EXISTS ix_resume_templates_user_id"))

    # Revert interview FK cascade back to NO ACTION
    conn.execute(text(
        "ALTER TABLE interview_answers "
        "DROP CONSTRAINT IF EXISTS interview_answers_question_id_fkey"
    ))
    conn.execute(text(
        "ALTER TABLE interview_answers "
        "ADD CONSTRAINT interview_answers_question_id_fkey "
        "FOREIGN KEY (question_id) REFERENCES interview_questions(id)"
    ))

    conn.execute(text(
        "ALTER TABLE interview_questions "
        "DROP CONSTRAINT IF EXISTS interview_questions_session_id_fkey"
    ))
    conn.execute(text(
        "ALTER TABLE interview_questions "
        "ADD CONSTRAINT interview_questions_session_id_fkey "
        "FOREIGN KEY (session_id) REFERENCES interview_sessions(id)"
    ))

    conn.execute(text(
        "ALTER TABLE interview_sessions "
        "DROP CONSTRAINT IF EXISTS interview_sessions_application_id_fkey"
    ))
    conn.execute(text(
        "ALTER TABLE interview_sessions "
        "ADD CONSTRAINT interview_sessions_application_id_fkey "
        "FOREIGN KEY (application_id) REFERENCES applications(id)"
    ))
