"""One-shot seed: copy existing on-disk user data into the new user-scoped layout.

Run during startup for the bootstrap admin. After the first successful seed,
the filesystem copies become snapshots -- the app reads and writes through
text_storage (DB) and binary_storage (user-scoped PDF tree). Subsequent
startups are no-ops because the seed only runs when the DB rows are missing.

Migrates:
  - master-resume_CV.yaml (root or data/)  ->  master_resumes row
  - data/resume-tailor-helper.md           ->  tailor_helpers row
  - my_info/*.md                           ->  context_files rows
  - data/tailored_resumes/{rid}/*.pdf      ->  data/users/{uid}/pdfs/*.pdf
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import update, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import text_storage_service
from app.services.binary_storage_service import get_binary_storage
from app.utils.filesystem import (
    get_master_resume_path,
    get_tailor_helper_path,
    get_context_folder,
    get_tailored_resumes_dir,
)


async def seed_user_from_filesystem(db: AsyncSession, user_id: str) -> None:
    await _seed_master_resume(db, user_id)
    await _seed_tailor_helper(db, user_id)
    await _seed_context_files(db, user_id)
    await _seed_pdfs(user_id)
    await _backfill_legacy_user_ids(db, user_id)


async def _backfill_legacy_user_ids(db: AsyncSession, user_id: str) -> None:
    """Assign the bootstrap admin as owner of any legacy rows missing user_id.

    Idempotent: rows already scoped to a user are untouched. Master
    ResumeTemplate (is_master=True) is intentionally left with user_id=NULL so
    it remains globally readable.
    """
    from app.models.application import Application
    from app.models.user_setting import UserSetting
    from app.models.user_context import UserContext
    from app.models.resume_template import ResumeTemplate
    from app.models.tailor_rule import TailorRule
    from app.models.chat_history import ChatHistory

    tables: list[tuple[str, object, object]] = [
        ("applications", Application, Application.user_id.is_(None)),
        ("user_settings", UserSetting, UserSetting.user_id.is_(None)),
        ("user_context", UserContext, UserContext.user_id.is_(None)),
        (
            "resume_templates",
            ResumeTemplate,
            and_(ResumeTemplate.user_id.is_(None), ResumeTemplate.is_master.is_(False)),
        ),
        ("tailor_rules", TailorRule, TailorRule.user_id.is_(None)),
        ("chat_histories", ChatHistory, ChatHistory.user_id.is_(None)),
    ]

    total = 0
    for label, model, where_clause in tables:
        count_stmt = select(model).where(where_clause)
        rows = (await db.execute(count_stmt)).scalars().all()
        if not rows:
            continue
        for row in rows:
            row.user_id = user_id
        print(f"[Seed] Backfilled {len(rows)} {label} row(s) to user {user_id[:8]}...")
        total += len(rows)
    if total:
        await db.commit()


async def _seed_master_resume(db: AsyncSession, user_id: str) -> None:
    existing = await text_storage_service.get_master_resume(db, user_id)
    if existing is not None:
        return  # already seeded or user set their own
    path = get_master_resume_path()
    if not path.exists():
        return
    content = path.read_text(encoding="utf-8", errors="replace")
    await text_storage_service.put_master_resume(db, user_id, content)
    print(f"[Seed] Imported master resume from {path.name} ({len(content)} chars)")


async def _seed_tailor_helper(db: AsyncSession, user_id: str) -> None:
    existing = await text_storage_service.get_tailor_helper(db, user_id)
    if existing is not None:
        return
    path = get_tailor_helper_path()
    if not path.exists():
        return
    content = path.read_text(encoding="utf-8", errors="replace")
    await text_storage_service.put_tailor_helper(db, user_id, content)
    print(f"[Seed] Imported tailor helper ({len(content)} chars)")


async def _seed_context_files(db: AsyncSession, user_id: str) -> None:
    existing = await text_storage_service.list_context_files(db, user_id)
    if existing:
        return  # never re-seed once there are any rows
    folder = get_context_folder()
    if not folder.exists():
        return
    count = 0
    for path in sorted(folder.glob("*.md")):
        # Skip .example companions and files that would collide on the DB unique key.
        if path.name.endswith(".example"):
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        await text_storage_service.put_context_file(db, user_id, path.name, content)
        count += 1
    if count:
        print(f"[Seed] Imported {count} context file(s) from {folder.name}/")


async def _seed_pdfs(user_id: str) -> None:
    """Copy every legacy PDF into users/{user_id}/pdfs/ keeping the same filename.

    Idempotent: skipped when the destination already exists. Runs through
    binary_storage so the same code works for local and R2 future migrations.
    """
    legacy_root = get_tailored_resumes_dir()
    if not legacy_root.exists():
        return
    storage = get_binary_storage()
    copied = 0
    for pdf in legacy_root.rglob("*.pdf"):
        key = f"pdfs/{pdf.name}"
        if await storage.exists(user_id, key):
            continue
        await storage.put(user_id, key, pdf.read_bytes())
        copied += 1
    if copied:
        print(f"[Seed] Copied {copied} legacy PDF(s) into users/{user_id}/pdfs/")
