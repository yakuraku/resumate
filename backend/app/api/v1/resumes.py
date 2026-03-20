from datetime import datetime, timezone
from email.utils import formatdate
import hashlib
import json as _json
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.models.resume import Resume, ResumeVersion
from app.schemas.resume import ResumeRead, ResumeUpdate, ResumeVersionRead, ResumeVersionCreate
from app.services.resume_service import resume_service
from app.services.rendercv_service import rendercv_service
from app.services.llm_service import llm_service
from app.utils.filesystem import get_tailored_resumes_dir
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter()


def _resume_output_dir(resume_id: str) -> Path:
    return get_tailored_resumes_dir() / resume_id


def _stale_pdf_path(resume_id: str) -> Path:
    return _resume_output_dir(resume_id) / f"resume_{resume_id}.pdf"


async def _record_pdf_render(db: AsyncSession, version_id: str, pdf_path: Path) -> None:
    """Persist pdf_path and pdf_rendered_at on the version row after a successful render."""
    result = await db.execute(select(ResumeVersion).where(ResumeVersion.id == version_id))
    version = result.scalar_one_or_none()
    if version:
        version.pdf_path = str(pdf_path)
        version.pdf_rendered_at = datetime.now(timezone.utc)
        await db.commit()


@router.get("", response_model=List[ResumeRead])
async def get_all_resumes(
    db: AsyncSession = Depends(get_db)
):
    return await resume_service.get_all_resumes(db)

@router.get("/{resume_id}", response_model=ResumeRead)
async def get_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db)
):
    return await resume_service.get_resume_by_id(db, resume_id)

@router.put("/{resume_id}/yaml", response_model=ResumeRead)
async def update_resume_yaml(
    resume_id: str,
    resume_update: ResumeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update resume YAML content only (auto-save). No version creation, no synchronous PDF render.
    Deletes the stale PDF so the next GET /pdf re-renders fresh on demand."""
    updated = await resume_service.update_resume_yaml_content(db, resume_id, resume_update.yaml_content)

    # Invalidate cached PDF — GET /pdf will re-render on next request
    stale = _stale_pdf_path(resume_id)
    stale.unlink(missing_ok=True)

    return updated

@router.get("/{resume_id}/versions", response_model=List[ResumeVersionRead])
async def get_resume_versions(
    resume_id: str,
    db: AsyncSession = Depends(get_db)
):
    resume = await resume_service.get_resume_by_id(db, resume_id)
    return resume.versions

@router.post("/{resume_id}/versions", response_model=ResumeRead)
async def save_as_new_version(
    resume_id: str,
    body: ResumeVersionCreate = ResumeVersionCreate(),
    db: AsyncSession = Depends(get_db)
):
    """Explicitly save current state as a new version."""
    return await resume_service.save_as_new_version(db, resume_id, body.change_summary)

@router.put("/{resume_id}/versions/{version_id}/activate", response_model=ResumeRead)
async def activate_version(
    resume_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Set a specific version as active and sync Resume.yaml_content.
    Fast DB-only operation — no PDF rendering. Deletes stale PDF so next GET /pdf re-renders."""
    updated = await resume_service.activate_version(db, resume_id, version_id)

    # Invalidate cached PDF — frontend will refresh and GET /pdf will re-render
    stale = _stale_pdf_path(resume_id)
    stale.unlink(missing_ok=True)

    return updated

@router.put("/{resume_id}/versions/{version_id}/content", response_model=ResumeRead)
async def update_version_content(
    resume_id: str,
    version_id: str,
    resume_update: ResumeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing version's yaml_content in-place (active version only).
    Invalidates the cached PDF so the next GET /pdf re-renders fresh."""
    updated = await resume_service.update_version_content(db, resume_id, version_id, resume_update.yaml_content)

    stale = _stale_pdf_path(resume_id)
    stale.unlink(missing_ok=True)

    return updated

@router.get("/{resume_id}/versions/{version}/yaml", response_model=ResumeVersionRead)
async def get_resume_version_content(
    resume_id: str,
    version: int,
    db: AsyncSession = Depends(get_db)
):
    return await resume_service.get_version(db, resume_id, version)

@router.delete("/{resume_id}/versions/{version_id}", status_code=204)
async def delete_version(
    resume_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a non-active version and its associated PDF file from disk."""
    pdf_path_str, version_number = await resume_service.delete_version(db, resume_id, version_id)

    # Delete the version-specific PDF if it exists
    if pdf_path_str:
        Path(pdf_path_str).unlink(missing_ok=True)
    else:
        # Fall back to the deterministic path in case pdf_path was never recorded
        fallback = _resume_output_dir(resume_id) / f"resume_{resume_id}_v{version_number}.pdf"
        fallback.unlink(missing_ok=True)

@router.post("/cleanup-orphan-pdfs")
async def cleanup_orphan_pdfs(db: AsyncSession = Depends(get_db)):
    """Delete PDF files on disk that have no corresponding version in the DB.

    Scans every resume subdirectory in tailored_resumes/ and removes any
    _v{n}.pdf file whose version_number does not exist in resume_versions.
    Returns a summary of what was deleted.
    """
    base = get_tailored_resumes_dir()
    if not base.exists():
        return {"deleted": [], "errors": []}

    # Load all (resume_id, version_number) pairs that exist in DB
    result = await db.execute(select(ResumeVersion.resume_id, ResumeVersion.version_number))
    valid_pairs: set[tuple[str, int]] = {(str(row[0]), row[1]) for row in result.all()}

    deleted: list[str] = []
    errors: list[str] = []

    import re
    version_pdf_pattern = re.compile(r"^resume_(.+)_v(\d+)\.pdf$")

    for resume_dir in base.iterdir():
        if not resume_dir.is_dir():
            continue
        resume_id = resume_dir.name
        for pdf_file in resume_dir.glob("*_v*.pdf"):
            m = version_pdf_pattern.match(pdf_file.name)
            if not m:
                continue
            version_number = int(m.group(2))
            if (resume_id, version_number) not in valid_pairs:
                try:
                    pdf_file.unlink()
                    deleted.append(str(pdf_file))
                except Exception as e:
                    errors.append(f"{pdf_file}: {e}")

    return {"deleted": deleted, "errors": errors}

@router.post("/{resume_id}/tailor", response_model=ResumeRead)
async def tailor_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db)
):
    tailored = await resume_service.tailor_resume(db, resume_id)

    output_dir = _resume_output_dir(resume_id)
    output_path = output_dir / f"resume_{resume_id}.pdf"
    print(f"[PDF] Re-rendering after tailor for {resume_id}...")
    success, msg = await rendercv_service.render_yaml_to_pdf(tailored.yaml_content, output_path)
    if success:
        active_version = next((v for v in tailored.versions if v.is_active), None)
        if active_version:
            await _record_pdf_render(db, active_version.id, output_path)
    else:
        print(f"[PDF] Render warning after tailor: {msg[:200]}")

    return tailored

@router.post("/{resume_id}/tailor/stream")
async def tailor_resume_stream(
    resume_id: str,
    db: AsyncSession = Depends(get_db)
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
    if not resume.application or not resume.application.job_description:
        raise HTTPException(status_code=400, detail="Application has no job description")

    rules = await tailor_rule_service.get_enabled_rule_texts(db, application_id=resume.application.id)

    # Capture plain values before the injected `db` session expires.
    # StreamingResponse runs the generator outside the request's greenlet context,
    # so the injected session cannot be used inside event_generator().
    original_yaml = resume.yaml_content
    job_description = resume.application.job_description
    resume_id_str = str(resume.id)
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

        # Open a fresh session — the request-scoped `db` is no longer usable here.
        try:
            async with SessionLocal() as new_db:
                from app.models.resume import VersionSource

                # Load the resume fresh in this new session
                r_stmt = select(Resume).where(Resume.id == resume_id_str).options(
                    selectinload(Resume.versions)
                )
                r_result = await new_db.execute(r_stmt)
                fresh_resume = r_result.scalar_one_or_none()
                if not fresh_resume:
                    yield f"data: {_json.dumps({'type': 'error', 'message': 'Resume not found during save'})}\n\n"
                    return

                # Deactivate all existing versions
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

                # Render PDF
                output_dir = _resume_output_dir(resume_id_str)
                output_path = output_dir / f"resume_{resume_id_str}.pdf"
                _stale_pdf_path(resume_id_str).unlink(missing_ok=True)

                success, msg = await rendercv_service.render_yaml_to_pdf(tailored_yaml, output_path)
                if success:
                    await new_db.refresh(new_version)
                    await _record_pdf_render(new_db, str(new_version.id), output_path)

                # Re-fetch with all relations for the final payload
                final_resume = await resume_service.get_resume_by_id(new_db, resume_id_str)
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


@router.get("/{resume_id}/pdf")
async def get_resume_pdf(
    request: Request,
    resume_id: str,
    version_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Serve the resume PDF. Renders on demand if not cached.

    - No version_id: renders from Resume.yaml_content (the active version).
    - version_id provided: renders from that version's yaml_content. Non-active versions
      are cached in a version-specific file (their yaml is immutable once created).
    """
    resume = await resume_service.get_resume_by_id(db, resume_id)

    output_dir = _resume_output_dir(resume_id)

    if version_id:
        target_version = next((v for v in resume.versions if v.id == version_id), None)
        if not target_version:
            raise HTTPException(status_code=404, detail="Version not found")

        if target_version.is_active:
            # Active version — use the main PDF path (always fresh)
            yaml_content = resume.yaml_content
            output_path = output_dir / f"resume_{resume_id}.pdf"
        else:
            # Non-active version — use a version-specific cached file
            yaml_content = target_version.yaml_content
            output_path = output_dir / f"resume_{resume_id}_v{target_version.version_number}.pdf"
    else:
        target_version = next((v for v in resume.versions if v.is_active), None)
        yaml_content = resume.yaml_content
        output_path = output_dir / f"resume_{resume_id}.pdf"

    if not output_path.exists():
        print(f"[PDF] Rendering for {resume_id} (version_id={version_id})...")
        success, msg = await rendercv_service.render_yaml_to_pdf(yaml_content, output_path)
        if not success:
            print(f"[PDF] Render failed: {msg[:200]}")
            raise HTTPException(status_code=422, detail=f"RenderCV failed: {msg[:500]}")
        if target_version:
            await _record_pdf_render(db, target_version.id, output_path)

    if not output_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found after render")

    # --- ETag / Last-Modified caching ---
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
        }
    )
