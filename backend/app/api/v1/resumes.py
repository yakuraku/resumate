from datetime import datetime, timezone
from email.utils import formatdate
import hashlib
import json as _json
import re
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse, FileResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.resume import Resume, ResumeVersion
from app.models.user import User
from app.schemas.resume import ResumeRead, ResumeUpdate, ResumeVersionRead, ResumeVersionCreate
from app.services.resume_service import resume_service
from app.services.rendercv_service import rendercv_service
from app.services.llm_service import llm_service
from app.services.binary_storage_service import get_binary_storage
router = APIRouter()


# ---------- PDF key helpers ----------
# Post-Phase-2 every PDF lives at users/{user_id}/pdfs/<filename>. The filename
# encodes the resume (and version for non-active versions) so we can recover the
# owner + intent from the key alone.

def _active_key(resume_id: str) -> str:
    return f"pdfs/resume_{resume_id}.pdf"


def _version_key(resume_id: str, version_number: int) -> str:
    return f"pdfs/resume_{resume_id}_v{version_number}.pdf"


async def _record_pdf_render(db: AsyncSession, version_id: str, storage_key: str) -> None:
    """Persist the storage key + render time on the version row.

    The PDF is already uploaded by the caller, so a metadata-write failure
    here must not surface as a 500 on the preview request. Log and swallow
    instead; the next GET will still find the cached object in storage.
    """
    try:
        result = await db.execute(select(ResumeVersion).where(ResumeVersion.id == version_id))
        version = result.scalar_one_or_none()
        if version:
            version.pdf_path = storage_key  # stores the user-scoped key, not an absolute path
            version.pdf_rendered_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception as e:
        print(f"[PDF] Failed to record render metadata for version {version_id}: {e}")
        try:
            await db.rollback()
        except Exception:
            pass


async def _render_and_store(
    user_id: str,
    storage_key: str,
    yaml_content: str,
) -> tuple[bool, str]:
    """Render YAML and upload the bytes to user-scoped storage.

    Returns (True, "") on success, (False, error_log) on failure.
    """
    ok, payload = await rendercv_service.render_yaml_to_bytes(yaml_content)
    if not ok:
        return False, str(payload)
    storage = get_binary_storage()
    await storage.put(user_id, storage_key, payload)  # type: ignore[arg-type]
    return True, ""


# ---------- resume CRUD ----------

@router.get("", response_model=List[ResumeRead])
async def get_all_resumes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_service.get_all_resumes(db, current_user.id)


@router.get("/{resume_id}", response_model=ResumeRead)
async def get_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_service.get_resume_by_id(db, resume_id, current_user.id)


@router.put("/{resume_id}/yaml", response_model=ResumeRead)
async def update_resume_yaml(
    resume_id: str,
    resume_update: ResumeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update resume YAML (auto-save). Invalidates the cached active PDF."""
    updated = await resume_service.update_resume_yaml_content(db, resume_id, resume_update.yaml_content, current_user.id)
    await get_binary_storage().delete(current_user.id, _active_key(resume_id))
    return updated


# ---------- versions ----------

@router.get("/{resume_id}/versions", response_model=List[ResumeVersionRead])
async def get_resume_versions(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = await resume_service.get_resume_by_id(db, resume_id, current_user.id)
    return resume.versions


@router.post("/{resume_id}/versions", response_model=ResumeRead)
async def save_as_new_version(
    resume_id: str,
    body: ResumeVersionCreate = ResumeVersionCreate(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Explicitly snapshot current state as a new version."""
    return await resume_service.save_as_new_version(db, resume_id, body.change_summary, current_user.id)


@router.put("/{resume_id}/versions/{version_id}/activate", response_model=ResumeRead)
async def activate_version(
    resume_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set a specific version as active. Fast (no render). Invalidates cached active PDF."""
    updated = await resume_service.activate_version(db, resume_id, version_id, current_user.id)
    await get_binary_storage().delete(current_user.id, _active_key(resume_id))
    return updated


@router.put("/{resume_id}/versions/{version_id}/content", response_model=ResumeRead)
async def update_version_content(
    resume_id: str,
    version_id: str,
    resume_update: ResumeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing version's yaml_content in-place (active version only)."""
    updated = await resume_service.update_version_content(db, resume_id, version_id, resume_update.yaml_content, current_user.id)
    await get_binary_storage().delete(current_user.id, _active_key(resume_id))
    return updated


@router.get("/{resume_id}/versions/{version}/yaml", response_model=ResumeVersionRead)
async def get_resume_version_content(
    resume_id: str,
    version: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await resume_service.get_resume_by_id(db, resume_id, current_user.id)
    return await resume_service.get_version(db, resume_id, version)


@router.delete("/{resume_id}/versions/{version_id}", status_code=204)
async def delete_version(
    resume_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a non-active version and its cached PDF."""
    stored_key, version_number = await resume_service.delete_version(db, resume_id, version_id, current_user.id)
    storage = get_binary_storage()
    if stored_key:
        await storage.delete(current_user.id, stored_key)
    else:
        # Fall back to the deterministic key in case pdf_path was never recorded.
        await storage.delete(current_user.id, _version_key(resume_id, version_number))


@router.post("/cleanup-orphan-pdfs")
async def cleanup_orphan_pdfs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete version-PDF objects whose version_number is no longer in the DB."""
    result = await db.execute(select(ResumeVersion.resume_id, ResumeVersion.version_number))
    valid_pairs: set[tuple[str, int]] = {(str(row[0]), row[1]) for row in result.all()}

    storage = get_binary_storage()
    keys = await storage.list_keys(current_user.id, prefix="pdfs/")
    version_pdf_pattern = re.compile(r"^pdfs/resume_(.+)_v(\d+)\.pdf$")

    deleted: list[str] = []
    errors: list[str] = []
    for key in keys:
        m = version_pdf_pattern.match(key)
        if not m:
            continue
        resume_id = m.group(1)
        version_number = int(m.group(2))
        if (resume_id, version_number) not in valid_pairs:
            try:
                await storage.delete(current_user.id, key)
                deleted.append(key)
            except Exception as e:
                errors.append(f"{key}: {e}")

    return {"deleted": deleted, "errors": errors}


# ---------- tailor ----------

@router.post("/{resume_id}/tailor", response_model=ResumeRead)
async def tailor_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tailored = await resume_service.tailor_resume(db, resume_id, current_user.id)

    key = _active_key(resume_id)
    print(f"[PDF] Re-rendering after tailor for {resume_id}...")
    ok, err = await _render_and_store(current_user.id, key, tailored.yaml_content)
    if ok:
        active_version = next((v for v in tailored.versions if v.is_active), None)
        if active_version:
            await _record_pdf_render(db, active_version.id, key)
    else:
        print(f"[PDF] Render warning after tailor: {err[:200]}")

    return tailored


@router.post("/{resume_id}/tailor/stream")
async def tailor_resume_stream(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE endpoint for agentic resume tailoring. Streams progress events as JSON lines."""
    from app.services.agent_tailor_service import run_agentic_tailor
    from app.services.tailor_rule_service import tailor_rule_service
    from app.database import SessionLocal

    stmt = select(Resume).where(Resume.id == resume_id).options(
        selectinload(Resume.application)
    )
    result = await db.execute(stmt)
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not resume.application or resume.application.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not resume.application.job_description:
        raise HTTPException(status_code=400, detail="Application has no job description")

    rules = await tailor_rule_service.get_enabled_rule_texts(db, current_user.id, application_id=resume.application.id)

    original_yaml = resume.yaml_content
    job_description = resume.application.job_description
    resume_id_str = str(resume.id)
    user_id = current_user.id
    model = llm_service.default_model

    async def event_generator():
        tailored_yaml = None
        try:
            async for event in run_agentic_tailor(
                resume_yaml=original_yaml,
                job_description=job_description,
                rules=rules,
                system_prompt=None,
                model=model,
            ):
                yield f"data: {_json.dumps(event)}\n\n"

                if event.get("type") == "complete":
                    tailored_yaml = event.get("yaml_content", "")

        except Exception as e:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        if not tailored_yaml:
            return

        try:
            async with SessionLocal() as new_db:
                from app.models.resume import VersionSource

                r_stmt = select(Resume).where(Resume.id == resume_id_str).options(
                    selectinload(Resume.versions)
                )
                r_result = await new_db.execute(r_stmt)
                fresh_resume = r_result.scalar_one_or_none()
                if not fresh_resume:
                    yield f"data: {_json.dumps({'type': 'error', 'message': 'Resume not found during save'})}\n\n"
                    return

                for v in fresh_resume.versions:
                    v.is_active = False

                fresh_resume.yaml_content = tailored_yaml
                fresh_resume.current_version += 1

                new_version = ResumeVersion(
                    resume_id=fresh_resume.id,
                    version_number=fresh_resume.current_version,
                    yaml_content=tailored_yaml,
                    change_summary="AI Tailored (Agentic)",
                    source=VersionSource.AI_TAILORED,
                    is_active=True,
                    label=f"AI Tailored v{fresh_resume.current_version}",
                )
                new_db.add(new_version)
                await new_db.commit()

                key = _active_key(resume_id_str)
                storage = get_binary_storage()
                await storage.delete(user_id, key)

                ok, err = await _render_and_store(user_id, key, tailored_yaml)
                if ok:
                    await new_db.refresh(new_version)
                    await _record_pdf_render(new_db, str(new_version.id), key)

                final_resume = await resume_service.get_resume_by_id(new_db, resume_id_str, user_id)
                resume_data = ResumeRead.model_validate(final_resume)
                yield f"data: {_json.dumps({'type': 'persisted', 'resume': resume_data.model_dump(mode='json')})}\n\n"

        except Exception as e:
            yield f"data: {_json.dumps({'type': 'error', 'message': f'Failed to save: {str(e)}'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------- PDF preview / download ----------

@router.get("/{resume_id}/pdf")
async def get_resume_pdf(
    request: Request,
    resume_id: str,
    version_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the resume PDF. Renders on demand if not cached.

    Local backend: streams via FileResponse with ETag/Last-Modified.
    R2 backend: 302-redirects to a short-lived presigned URL (CDN handles caching).
    """
    resume = await resume_service.get_resume_by_id(db, resume_id, current_user.id)

    if version_id:
        target_version = next((v for v in resume.versions if v.id == version_id), None)
        if not target_version:
            raise HTTPException(status_code=404, detail="Version not found")
        if target_version.is_active:
            yaml_content = resume.yaml_content
            key = _active_key(resume_id)
        else:
            yaml_content = target_version.yaml_content
            key = _version_key(resume_id, target_version.version_number)
    else:
        target_version = next((v for v in resume.versions if v.is_active), None)
        yaml_content = resume.yaml_content
        key = _active_key(resume_id)

    storage = get_binary_storage()

    if not await storage.exists(current_user.id, key):
        print(f"[PDF] Rendering for {resume_id} (version_id={version_id})...")
        ok, err = await _render_and_store(current_user.id, key, yaml_content)
        if not ok:
            print(f"[PDF] Render failed: {err[:200]}")
            raise HTTPException(status_code=422, detail=f"RenderCV failed: {err[:1500]}")
        if target_version:
            await _record_pdf_render(db, target_version.id, key)

    # Cloud mode (R2): let the CDN serve the bytes via a presigned URL.
    presigned = await storage.url(current_user.id, key, expires_in=3600)
    if presigned:
        return RedirectResponse(url=presigned, status_code=302)

    # Local mode: stream from disk with conditional-GET caching.
    output_path = storage.local_path(current_user.id, key)
    if output_path is None or not output_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found after render")

    stat = output_path.stat()
    file_mtime = stat.st_mtime
    etag = f'"{hashlib.md5(f"{output_path}{file_mtime}".encode()).hexdigest()}"'
    last_modified = formatdate(file_mtime, usegmt=True)

    if_none_match = request.headers.get("if-none-match")
    if_modified_since = request.headers.get("if-modified-since")

    if if_none_match and if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag, "Last-Modified": last_modified})
    if if_modified_since and not if_none_match:
        from email.utils import parsedate_to_datetime
        try:
            client_dt = parsedate_to_datetime(if_modified_since).timestamp()
            if file_mtime <= client_dt:
                return Response(status_code=304, headers={"ETag": etag, "Last-Modified": last_modified})
        except Exception:
            pass

    return FileResponse(
        str(output_path),
        media_type="application/pdf",
        content_disposition_type="inline",
        filename=f"resume_{resume_id}.pdf",
        headers={
            "Cache-Control": "no-cache",
            "ETag": etag,
            "Last-Modified": last_modified,
        },
    )


# ---------- save to disk ----------

class SaveToDiskRequest(BaseModel):
    company_name: str  # e.g. "Acme Corp" -- used as folder name
    filename: str      # e.g. "acme_corp_engineer_resume.pdf"
    force: bool = False


@router.post("/{resume_id}/save-to-disk")
async def save_pdf_to_disk(
    resume_id: str,
    body: SaveToDiskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save or download the resume PDF.

    Folder mode: saves {folder}/{company}/{filename}.pdf on the server and
        returns {"mode": "folder", "saved_to": "<path>"}.
    Default: streams the PDF as a browser download.
    """
    from app.services.settings_service import settings_service as svc

    resume = await resume_service.get_resume_by_id(db, resume_id, current_user.id)

    key = _active_key(resume_id)
    storage = get_binary_storage()

    if not await storage.exists(current_user.id, key):
        ok, err = await _render_and_store(current_user.id, key, resume.yaml_content)
        if not ok:
            raise HTTPException(status_code=422, detail=f"RenderCV failed: {err[:500]}")

    # Fetch bytes once; used for both folder-save and streaming branches.
    pdf_bytes = await storage.get(current_user.id, key)

    current = await svc.get_settings(db)
    if current.save_pdf_folder_enabled and current.save_pdf_folder_path:
        folder_root = Path(current.save_pdf_folder_path)
        if not folder_root.exists():
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Configured PDF save folder does not exist: {folder_root}. "
                    "Update the path in Settings or create the folder."
                ),
            )

        safe_company = re.sub(r'[<>:"/\\|?*]', "", body.company_name).strip() or "Unknown"
        dest_dir = folder_root / safe_company
        dest_dir.mkdir(parents=True, exist_ok=True)

        safe_filename = re.sub(r'[<>:"/\\|?*]', "", body.filename).strip()
        if not safe_filename.endswith(".pdf"):
            safe_filename += ".pdf"

        dest_path = dest_dir / safe_filename
        if dest_path.exists() and not body.force:
            raise HTTPException(
                status_code=409,
                detail={"code": "file_exists", "path": str(dest_path)},
            )

        dest_path.write_bytes(pdf_bytes)
        return {"mode": "folder", "saved_to": str(dest_path)}

    safe_filename = re.sub(r'[<>:"/\\|?*]', "", body.filename).strip()
    if not safe_filename.endswith(".pdf"):
        safe_filename += ".pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
        },
    )
