"""User-scoped text storage for context files, master resume, and tailor helper.

All operations accept a user_id and enforce it on every query. The storage is
pure DB -- no filesystem, no network -- so Docker/local and cloud behave
identically once the tables exist.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.context_file import ContextFile
from app.models.master_resume import MasterResume
from app.models.tailor_helper import TailorHelper


@dataclass
class ContextFileRecord:
    filename: str
    content: str
    updated_at: datetime
    size_bytes: int


def _validate_filename(filename: str) -> None:
    """Filenames are treated as opaque keys; reject path traversal + empty names."""
    if not filename or any(c in filename for c in ("..", "/", "\\")):
        raise ValueError(f"Invalid filename: {filename!r}")


# ---------- context files ----------

async def list_context_files(db: AsyncSession, user_id: str) -> List[ContextFileRecord]:
    stmt = select(ContextFile).where(ContextFile.user_id == user_id).order_by(ContextFile.filename)
    result = await db.execute(stmt)
    return [
        ContextFileRecord(
            filename=row.filename,
            content=row.content,
            updated_at=row.updated_at,
            size_bytes=len(row.content.encode("utf-8")),
        )
        for row in result.scalars().all()
    ]


async def get_context_file(db: AsyncSession, user_id: str, filename: str) -> Optional[ContextFile]:
    _validate_filename(filename)
    stmt = select(ContextFile).where(
        ContextFile.user_id == user_id, ContextFile.filename == filename
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def put_context_file(
    db: AsyncSession, user_id: str, filename: str, content: str
) -> ContextFile:
    """Upsert: create if absent, update content if present."""
    _validate_filename(filename)
    row = await get_context_file(db, user_id, filename)
    if row is None:
        row = ContextFile(
            id=str(uuid4()),
            user_id=user_id,
            filename=filename,
            content=content,
        )
        db.add(row)
    else:
        row.content = content
    await db.commit()
    await db.refresh(row)
    return row


async def delete_context_file(db: AsyncSession, user_id: str, filename: str) -> bool:
    row = await get_context_file(db, user_id, filename)
    if row is None:
        return False
    await db.delete(row)
    await db.commit()
    return True


# ---------- master resume ----------

async def get_master_resume(db: AsyncSession, user_id: str) -> Optional[MasterResume]:
    stmt = select(MasterResume).where(MasterResume.user_id == user_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def put_master_resume(db: AsyncSession, user_id: str, yaml_content: str) -> MasterResume:
    row = await get_master_resume(db, user_id)
    if row is None:
        row = MasterResume(id=str(uuid4()), user_id=user_id, yaml_content=yaml_content)
        db.add(row)
    else:
        row.yaml_content = yaml_content
    await db.commit()
    await db.refresh(row)
    return row


# ---------- tailor helper ----------

async def get_tailor_helper(db: AsyncSession, user_id: str) -> Optional[TailorHelper]:
    return await db.get(TailorHelper, user_id)


async def put_tailor_helper(db: AsyncSession, user_id: str, content: str) -> TailorHelper:
    row = await get_tailor_helper(db, user_id)
    if row is None:
        row = TailorHelper(user_id=user_id, content=content)
        db.add(row)
    else:
        row.content = content
    await db.commit()
    await db.refresh(row)
    return row


async def append_tailor_helper(db: AsyncSession, user_id: str, extra: str) -> TailorHelper:
    row = await get_tailor_helper(db, user_id)
    new_content = ((row.content + "\n") if row and row.content else "") + extra
    return await put_tailor_helper(db, user_id, new_content)
