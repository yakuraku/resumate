"""Multi-user schema adjustments: chat_histories.user_id + composite uniques.

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
Create Date: 2026-04-16 00:00:00.000000

Adds user_id to chat_histories and swaps the per-column unique constraints on
user_settings / user_context / resume_templates for composite (user_id, key)
uniques so that each user owns a separate namespace.

SQLite note:
The original tables were created with inline UNIQUE (...) column-level
constraints that have no stable name. Alembic's batch_alter_table cannot drop
them by a guessed name. We reflect the live table, strip the unwanted unique
constraints, then pass the stripped Table as `copy_from` so batch_alter_table
rebuilds the table without those constraints. The new composite constraint is
added inside the batch block.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _reflect_without_uniques(table_name: str) -> sa.Table:
    """Return a reflected Table with every UniqueConstraint removed.

    batch_alter_table(copy_from=...) will rebuild the table from this schema,
    which effectively drops the unnamed inline UNIQUE clauses SQLAlchemy's
    CREATE TABLE emitted originally.
    """
    bind = op.get_bind()
    meta = sa.MetaData()
    table = sa.Table(table_name, meta, autoload_with=bind)
    for const in list(table.constraints):
        if isinstance(const, sa.UniqueConstraint):
            table.constraints.discard(const)
    return table


def _is_postgres() -> bool:
    return op.get_context().dialect.name == "postgresql"


def _drop_old_unique_pg(table: str, column: str) -> None:
    """Drop the single-column unique constraint using IF EXISTS to avoid transaction errors."""
    pg_auto_name = f"{table}_{column}_key"
    op.execute(sa.text(
        f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {pg_auto_name}"
    ))


def upgrade() -> None:
    dialect_is_pg = _is_postgres()

    # 1. chat_histories.user_id (nullable + FK + index)
    with op.batch_alter_table("chat_histories") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.String, nullable=True))
        batch_op.create_foreign_key(
            "fk_chat_histories_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("ix_chat_histories_user_id", ["user_id"])

    if dialect_is_pg:
        # Postgres: drop the old per-column unique, then add the composite one
        _drop_old_unique_pg("user_settings", "setting_key")
        with op.batch_alter_table("user_settings") as batch_op:
            batch_op.create_unique_constraint(
                "uq_user_settings_user_key", ["user_id", "setting_key"]
            )

        _drop_old_unique_pg("user_context", "key")
        with op.batch_alter_table("user_context") as batch_op:
            batch_op.create_unique_constraint(
                "uq_user_context_user_key", ["user_id", "key"]
            )

        _drop_old_unique_pg("resume_templates", "name")
        with op.batch_alter_table("resume_templates") as batch_op:
            batch_op.create_unique_constraint(
                "uq_resume_templates_user_name", ["user_id", "name"]
            )
    else:
        # SQLite: use copy_from to rebuild the table without the old inline unique
        user_settings = _reflect_without_uniques("user_settings")
        with op.batch_alter_table("user_settings", copy_from=user_settings) as batch_op:
            batch_op.create_unique_constraint(
                "uq_user_settings_user_key", ["user_id", "setting_key"]
            )

        user_context = _reflect_without_uniques("user_context")
        with op.batch_alter_table("user_context", copy_from=user_context) as batch_op:
            batch_op.create_unique_constraint(
                "uq_user_context_user_key", ["user_id", "key"]
            )

        resume_templates = _reflect_without_uniques("resume_templates")
        with op.batch_alter_table("resume_templates", copy_from=resume_templates) as batch_op:
            batch_op.create_unique_constraint(
                "uq_resume_templates_user_name", ["user_id", "name"]
            )


def downgrade() -> None:
    dialect_is_pg = _is_postgres()

    if dialect_is_pg:
        with op.batch_alter_table("resume_templates") as batch_op:
            batch_op.drop_constraint("uq_resume_templates_user_name", type_="unique")
            batch_op.create_unique_constraint("uq_resume_templates_name", ["name"])

        with op.batch_alter_table("user_context") as batch_op:
            batch_op.drop_constraint("uq_user_context_user_key", type_="unique")
            batch_op.create_unique_constraint("uq_user_context_key", ["key"])

        with op.batch_alter_table("user_settings") as batch_op:
            batch_op.drop_constraint("uq_user_settings_user_key", type_="unique")
            batch_op.create_unique_constraint("uq_user_settings_setting_key", ["setting_key"])
    else:
        resume_templates = _reflect_without_uniques("resume_templates")
        with op.batch_alter_table("resume_templates", copy_from=resume_templates) as batch_op:
            batch_op.create_unique_constraint("uq_resume_templates_name", ["name"])

        user_context = _reflect_without_uniques("user_context")
        with op.batch_alter_table("user_context", copy_from=user_context) as batch_op:
            batch_op.create_unique_constraint("uq_user_context_key", ["key"])

        user_settings = _reflect_without_uniques("user_settings")
        with op.batch_alter_table("user_settings", copy_from=user_settings) as batch_op:
            batch_op.create_unique_constraint("uq_user_settings_setting_key", ["setting_key"])

    with op.batch_alter_table("chat_histories") as batch_op:
        batch_op.drop_index("ix_chat_histories_user_id")
        batch_op.drop_constraint("fk_chat_histories_user_id_users", type_="foreignkey")
        batch_op.drop_column("user_id")
