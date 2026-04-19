"""SQLite -> Neon Postgres + local filesystem -> R2 data migration.

Usage (from backend/ directory):
    python -m app.cli.manage migrate-to-cloud \\
        --sqlite-path ./data/resumate.db \\
        --target-url "postgresql+asyncpg://user:pw@host/db?ssl=require"

What it does:
- Runs alembic upgrade head against the target Postgres URL to create the schema.
- Copies every row from SQLite to Postgres in FK-safe order using raw INSERT.
- Already-encrypted setting values (enc:: prefix) are copied verbatim.
- Copies all user-scoped PDFs from local binary storage into R2 if
  STORAGE_BACKEND=r2 is configured (reads from data/users/<uid>/pdfs/).
- Fully idempotent: rows already present (by PK) are skipped with a warning.

Constraints:
- Requires asyncpg and (for R2 upload) boto3 to be installed.
- Target DB must be empty or at least at schema head.
"""
from __future__ import annotations

import asyncio
import sqlite3
import sys
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


# ---------------------------------------------------------------------------
# Table migration spec: (table_name, pk_column, columns_to_copy)
# Listed in FK-safe insertion order.
# ---------------------------------------------------------------------------

TABLES: list[tuple[str, str, list[str]]] = [
    ("users", "id", [
        "id", "email", "password_hash", "is_admin", "is_active",
        "created_at", "updated_at",
    ]),
    ("resume_templates", "id", [
        "id", "user_id", "name", "yaml_content", "is_master", "is_starred",
        "created_at", "updated_at",
    ]),
    ("applications", "id", [
        "id", "user_id", "company", "role", "status", "job_description",
        "location", "source_url", "notes", "applied_date",
        "status_changed_at", "ghosted_at", "ghost_disabled",
        "resume_template_id", "resume_snapshot_yaml", "color",
        "created_at", "updated_at",
    ]),
    ("resumes", "id", [
        "id", "application_id", "yaml_content", "current_version", "created_at", "updated_at",
    ]),
    ("resume_versions", "id", [
        "id", "resume_id", "version_number", "yaml_content", "change_summary",
        "source", "is_active", "label", "pdf_path", "pdf_rendered_at",
        "created_at", "updated_at",
    ]),
    ("user_settings", "id", [
        "id", "user_id", "setting_key", "setting_value",
        "created_at", "updated_at",
    ]),
    ("user_context", "id", [
        "id", "user_id", "key", "value", "category", "description",
        "created_at", "updated_at",
    ]),
    ("tailor_rules", "id", [
        "id", "user_id", "application_id", "rule_text", "is_enabled",
        "created_at", "updated_at",
    ]),
    ("chat_histories", "id", [
        "id", "user_id", "application_id", "module", "messages",
        "context_summary", "created_at", "updated_at",
    ]),
    ("interview_sessions", "id", [
        "id", "application_id", "interview_type", "persona",
        "created_at", "updated_at",
    ]),
    ("application_questions", "id", [
        "id", "application_id", "question", "answer", "category",
        "created_at", "updated_at",
    ]),
    ("application_credentials", "id", [
        "id", "application_id", "auth_method", "email", "username",
        "password", "oauth_email", "notes", "created_at", "updated_at",
    ]),
    ("master_resumes", "id", [
        "id", "user_id", "yaml_content", "created_at", "updated_at",
    ]),
    ("context_files", "id", [
        "id", "user_id", "filename", "content", "created_at", "updated_at",
    ]),
    ("tailor_helpers", "user_id", [
        "user_id", "content", "updated_at",
    ]),
]


def _sqlite_rows(conn: sqlite3.Connection, table: str, columns: list[str]) -> list[dict]:
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    # Only select columns that actually exist in SQLite (schema may differ slightly)
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    safe_cols = [c for c in columns if c in existing]
    if not safe_cols:
        return []
    cur.execute(f"SELECT {', '.join(safe_cols)} FROM {table}")
    return [dict(r) for r in cur.fetchall()]


async def _table_exists(conn: Any, table: str) -> bool:
    result = await conn.execute(
        sa.text("SELECT 1 FROM information_schema.tables WHERE table_name = :t"),
        {"t": table},
    )
    return result.scalar() is not None


async def _get_column_types(pg_conn: Any, table: str) -> dict[str, str]:
    """Return {column_name: data_type} for all columns in the Postgres table."""
    result = await pg_conn.execute(sa.text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name = :t"
    ), {"t": table})
    return {row[0]: row[1] for row in result}


def _parse_sqlite_datetime(val: str):
    """Parse SQLite datetime string to Python datetime or date."""
    from datetime import datetime, date
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    # Try date-only
    try:
        return date.fromisoformat(val)
    except ValueError:
        pass
    return val  # return as-is if unparseable


async def _migrate_table(
    pg_conn: Any,
    sqlite_conn: sqlite3.Connection,
    table: str,
    pk: str,
    columns: list[str],
) -> tuple[int, int]:
    """Copy rows. Returns (inserted, skipped)."""
    rows = _sqlite_rows(sqlite_conn, table, columns)
    if not rows:
        return 0, 0

    # Detect column types so we can coerce SQLite values to proper Python types
    col_types = await _get_column_types(pg_conn, table)
    bool_cols = {c for c, t in col_types.items() if t == "boolean"}
    ts_cols = {c for c, t in col_types.items() if "timestamp" in t or t == "date"}

    inserted = skipped = 0
    actual_cols = list(rows[0].keys())
    placeholders = ", ".join(f":{c}" for c in actual_cols)
    insert_sql = sa.text(
        f"INSERT INTO {table} ({', '.join(actual_cols)}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT ({pk}) DO NOTHING"
    )

    for row in rows:
        processed: dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, (list, dict)):
                import json
                processed[k] = json.dumps(v)
            elif k in bool_cols and isinstance(v, int):
                processed[k] = bool(v)
            elif k in ts_cols and isinstance(v, str) and v:
                processed[k] = _parse_sqlite_datetime(v)
            else:
                processed[k] = v
        result = await pg_conn.execute(insert_sql, processed)
        if result.rowcount == 0:
            skipped += 1
        else:
            inserted += 1

    return inserted, skipped


async def _migrate_pdfs(user_id: str) -> None:
    """Upload all user-scoped PDFs from local filesystem to R2."""
    try:
        from app.services.binary_storage_service import get_binary_storage, LocalBinaryStorage
        from app.utils.filesystem import get_data_dir
    except ImportError as e:
        print(f"  [SKIP] PDF migration unavailable: {e}")
        return

    storage = get_binary_storage()
    if isinstance(storage, LocalBinaryStorage):
        print("  [SKIP] STORAGE_BACKEND=local, PDF migration not needed.")
        return

    local_root = get_data_dir() / "users" / user_id / "pdfs"
    if not local_root.exists():
        print(f"  [SKIP] no local PDFs at {local_root}")
        return

    pdfs = list(local_root.glob("*.pdf"))
    print(f"  Uploading {len(pdfs)} PDF(s) to R2...")
    uploaded = skipped = 0
    for pdf_path in pdfs:
        key = f"pdfs/{pdf_path.name}"
        if await storage.exists(user_id, key):
            skipped += 1
            continue
        try:
            data = pdf_path.read_bytes()
            await storage.put(user_id, key, data)
            uploaded += 1
        except Exception as e:
            print(f"    [WARN] failed to upload {pdf_path.name}: {e}")
    print(f"  PDFs: {uploaded} uploaded, {skipped} already in R2.")


async def run_migration(sqlite_path: str, target_url: str) -> None:
    sqlite_path_obj = Path(sqlite_path).resolve()
    if not sqlite_path_obj.exists():
        print(f"[ERROR] SQLite file not found: {sqlite_path_obj}", file=sys.stderr)
        sys.exit(1)

    print(f"Source: {sqlite_path_obj}")
    print(f"Target: {target_url[:60]}...")
    print()

    # Step 1: Apply schema migrations on Postgres
    print("--- Step 1: applying alembic migrations to target DB ---")
    import subprocess, os
    env = os.environ.copy()
    env["DATABASE_URL"] = target_url
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True, text=True, env=env,
        cwd=Path(__file__).resolve().parent.parent.parent,
    )
    if result.returncode != 0:
        print("[ERROR] alembic upgrade failed:")
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)
    print("  alembic upgrade head: OK")
    print()

    # Step 2: Copy rows
    print("--- Step 2: copying rows ---")
    sqlite_conn = sqlite3.connect(str(sqlite_path_obj))
    engine = create_async_engine(target_url, echo=False)

    async with engine.begin() as pg_conn:
        for table, pk, columns in TABLES:
            ins, skp = await _migrate_table(pg_conn, sqlite_conn, table, pk, columns)
            total = ins + skp
            if total == 0:
                print(f"  {table}: (empty)")
            else:
                parts = []
                if ins:
                    parts.append(f"{ins} inserted")
                if skp:
                    parts.append(f"{skp} already existed (skipped)")
                print(f"  {table}: {', '.join(parts)}")

    sqlite_conn.close()
    await engine.dispose()
    print()

    # Step 3: Migrate PDFs to R2 (if configured)
    print("--- Step 3: PDF migration to R2 ---")
    sqlite_conn2 = sqlite3.connect(str(sqlite_path_obj))
    cur = sqlite_conn2.cursor()
    cur.execute("SELECT id FROM users")
    user_ids = [r[0] for r in cur.fetchall()]
    sqlite_conn2.close()

    for uid in user_ids:
        print(f"  user {uid[:8]}...")
        await _migrate_pdfs(uid)
    print()

    print("Migration complete.")
    print()
    print("Next steps:")
    print("  1. Verify: python -m app.cli.manage verify-migration --admin-email <email>")
    print("  2. Set STORAGE_BACKEND=r2 and DATABASE_URL in .env")
    print("  3. Restart the backend -- seed is idempotent, bootstrap admin will be found")
