"""Context files: user-scoped markdown snippets used by the AI tailor.

Post-Phase-2 this is fully DB-backed via text_storage_service. The legacy
/config endpoints remain for frontend compatibility but the folder_path
they return is a read-only display value -- there is no on-disk folder
anymore. Files are keyed by (user_id, filename).
"""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services import text_storage_service

router = APIRouter()


# ---------- helpers ----------

def _validate_filename(filename: str) -> None:
    if not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Filename must end with .md")
    if any(c in filename for c in ("..", "/", "\\")):
        raise HTTPException(status_code=400, detail="Filename contains invalid characters")


# ---------- schemas ----------

class ConfigResponse(BaseModel):
    folder_path: str


class ConfigUpdate(BaseModel):
    folder_path: str  # accepted but ignored post-Phase-2


class FileInfo(BaseModel):
    filename: str
    size_bytes: int
    modified_at: str
    preview: str


class FileContent(BaseModel):
    filename: str
    content: str
    modified_at: str


class FileCreate(BaseModel):
    filename: str
    content: str


class FileUpdate(BaseModel):
    content: str


# ---------- config (legacy shim for frontend) ----------

@router.get("/config", response_model=ConfigResponse)
async def get_config():
    # Display-only: frontend shows this to communicate where files "live".
    return ConfigResponse(folder_path="(stored in database)")


@router.put("/config", response_model=ConfigResponse)
async def update_config(body: ConfigUpdate):
    # Accepted for backward compat; DB-backed storage ignores folder paths.
    return ConfigResponse(folder_path="(stored in database)")


# ---------- file CRUD ----------

@router.get("/", response_model=List[FileInfo])
async def list_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await text_storage_service.list_context_files(db, current_user.id)
    return [
        FileInfo(
            filename=r.filename,
            size_bytes=r.size_bytes,
            modified_at=r.updated_at.replace(tzinfo=r.updated_at.tzinfo or timezone.utc).isoformat(),
            preview=r.content[:150],
        )
        for r in rows
    ]


@router.get("/{filename}", response_model=FileContent)
async def get_file(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_filename(filename)
    row = await text_storage_service.get_context_file(db, current_user.id, filename)
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")
    return FileContent(
        filename=filename,
        content=row.content,
        modified_at=row.updated_at.replace(tzinfo=row.updated_at.tzinfo or timezone.utc).isoformat(),
    )


@router.post("/", response_model=FileContent, status_code=201)
async def create_file(
    body: FileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_filename(body.filename)
    existing = await text_storage_service.get_context_file(db, current_user.id, body.filename)
    if existing is not None:
        raise HTTPException(status_code=409, detail="File already exists")
    row = await text_storage_service.put_context_file(
        db, current_user.id, body.filename, body.content
    )
    return FileContent(
        filename=body.filename,
        content=row.content,
        modified_at=row.updated_at.replace(tzinfo=row.updated_at.tzinfo or timezone.utc).isoformat(),
    )


@router.put("/{filename}", response_model=FileContent)
async def update_file(
    filename: str,
    body: FileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_filename(filename)
    existing = await text_storage_service.get_context_file(db, current_user.id, filename)
    if existing is None:
        raise HTTPException(status_code=404, detail="File not found")
    row = await text_storage_service.put_context_file(db, current_user.id, filename, body.content)
    return FileContent(
        filename=filename,
        content=row.content,
        modified_at=row.updated_at.replace(tzinfo=row.updated_at.tzinfo or timezone.utc).isoformat(),
    )


@router.delete("/{filename}")
async def delete_file(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_filename(filename)
    deleted = await text_storage_service.delete_context_file(db, current_user.id, filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "success"}


@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []
    for upload in files:
        name = upload.filename or ""
        if not name.endswith(".md") or any(c in name for c in ("..", "/", "\\")):
            results.append({"filename": name, "status": "skipped", "reason": "invalid filename"})
            continue
        existing = await text_storage_service.get_context_file(db, current_user.id, name)
        if existing is not None:
            results.append({"filename": name, "status": "skipped", "reason": "already exists"})
            continue
        raw = await upload.read()
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            content = raw.decode("utf-8", errors="replace")
        await text_storage_service.put_context_file(db, current_user.id, name, content)
        results.append({"filename": name, "status": "created"})
    return {"results": results}


# ---------- AI ingest ----------

class IngestRequest(BaseModel):
    text: str
    filename: str | None = None


@router.post("/ingest", status_code=201)
async def ingest_to_file(
    body: IngestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract structured context via LLM and save as a user-scoped markdown file."""
    from app.services.llm_service import llm_service
    from app.services.prompts import (
        CONTEXT_EXTRACTION_SYSTEM_PROMPT,
        CONTEXT_EXTRACTION_USER_PROMPT_TEMPLATE,
    )
    import json as _json
    from datetime import datetime as _dt

    if not body.text or len(body.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Input text too short")

    user_prompt = CONTEXT_EXTRACTION_USER_PROMPT_TEMPLATE.format(input_text=body.text[:5000])
    messages = [
        {"role": "system", "content": CONTEXT_EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response_json = await llm_service.get_completion(messages, json_mode=True)

    clean = response_json.strip()
    for prefix in ("```json", "```"):
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
    if clean.endswith("```"):
        clean = clean[:-3]

    try:
        data = _json.loads(clean)
        items = data.get("items", [])
    except _json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")

    lines = []
    for item in items:
        key = item.get("key", "")
        value = item.get("value", "")
        category = item.get("category", "general")
        if key and value:
            lines.append(f"## {key}\n**Category:** {category}\n\n{value}\n")

    md_content = "\n---\n\n".join(lines) if lines else "No context extracted."
    timestamp = _dt.now().strftime("%Y%m%d_%H%M%S")
    filename = body.filename or f"ingest-{timestamp}.md"
    if not filename.endswith(".md"):
        filename += ".md"

    _validate_filename(filename)
    existing = await text_storage_service.get_context_file(db, current_user.id, filename)
    if existing is not None:
        combined = existing.content + f"\n\n---\n\n{md_content}"
        row = await text_storage_service.put_context_file(
            db, current_user.id, filename, combined
        )
    else:
        row = await text_storage_service.put_context_file(
            db, current_user.id, filename, md_content
        )

    return FileContent(
        filename=filename,
        content=row.content,
        modified_at=row.updated_at.replace(tzinfo=row.updated_at.tzinfo or timezone.utc).isoformat(),
    )
