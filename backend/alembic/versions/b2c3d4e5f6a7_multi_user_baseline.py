"""Multi-user baseline: users + owner tables + nullable user_id on ownable tables.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-15 00:00:00.000000

This is the first of a two-step migration. This baseline creates the auth
tables and adds user_id as NULLABLE to the five ownable tables, so existing
rows can coexist until the data migration runs. A follow-up migration
(multi_user_enforce) flips user_id to NOT NULL and installs RLS.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OWNABLE_TABLES = [
    "applications",
    "user_settings",
    "user_context",
    "resume_templates",
]

# tailor_rules already has a nullable user_id column (legacy); we only add the FK.
TAILOR_RULES_FK = "fk_tailor_rules_user_id_users"


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_admin", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # 2. master_resumes (1 per user)
    op.create_table(
        "master_resumes",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column(
            "user_id",
            sa.String,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("yaml_content", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_master_resumes_user_id"),
    )
    op.create_index("ix_master_resumes_user_id", "master_resumes", ["user_id"])

    # 3. context_files (N per user, unique filename per user)
    op.create_table(
        "context_files",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column(
            "user_id",
            sa.String,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "filename", name="uq_context_files_user_filename"),
    )
    op.create_index("ix_context_files_user_id", "context_files", ["user_id"])

    # 4. tailor_helpers (1 per user, user_id is the PK)
    op.create_table(
        "tailor_helpers",
        sa.Column(
            "user_id",
            sa.String,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 5. Add nullable user_id to every ownable table. Backfill + NOT NULL + RLS
    #    land in multi_user_enforce after the data migration confirms everything
    #    belongs to the expected admin.
    for table in OWNABLE_TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.String, nullable=True))
            batch_op.create_foreign_key(
                f"fk_{table}_user_id_users",
                "users",
                ["user_id"],
                ["id"],
                ondelete="CASCADE",
            )

    # tailor_rules already had user_id (nullable, no FK). Attach the FK now.
    with op.batch_alter_table("tailor_rules") as batch_op:
        batch_op.create_foreign_key(
            TAILOR_RULES_FK,
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("tailor_rules") as batch_op:
        batch_op.drop_constraint(TAILOR_RULES_FK, type_="foreignkey")

    for table in reversed(OWNABLE_TABLES):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(f"fk_{table}_user_id_users", type_="foreignkey")
            batch_op.drop_column("user_id")

    op.drop_table("tailor_helpers")
    op.drop_index("ix_context_files_user_id", table_name="context_files")
    op.drop_table("context_files")
    op.drop_index("ix_master_resumes_user_id", table_name="master_resumes")
    op.drop_table("master_resumes")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
