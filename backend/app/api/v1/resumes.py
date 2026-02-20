from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.schemas.resume import ResumeRead, ResumeUpdate, ResumeVersionRead, ResumeVersionCreate
from app.services.resume_service import resume_service
from app.services.rendercv_service import rendercv_service
from app.utils.filesystem import get_tailored_resumes_dir
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter()


def _resume_output_dir(resume_id: str) -> Path:
    return get_tailored_resumes_dir() / resume_id


def _stale_pdf_path(resume_id: str) -> Path:
    return _resume_output_dir(resume_id) / f"resume_{resume_id}.pdf"


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
    if not success:
        print(f"[PDF] Render warning after tailor: {msg[:200]}")

    return tailored

@router.get("/{resume_id}/pdf")
async def get_resume_pdf(
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
        yaml_content = resume.yaml_content
        output_path = output_dir / f"resume_{resume_id}.pdf"

    if not output_path.exists():
        print(f"[PDF] Rendering for {resume_id} (version_id={version_id})...")
        success, msg = await rendercv_service.render_yaml_to_pdf(yaml_content, output_path)
        if not success:
            print(f"[PDF] Render failed: {msg[:200]}")
            raise HTTPException(status_code=422, detail=f"RenderCV failed: {msg[:500]}")

    if not output_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found after render")

    return FileResponse(
        str(output_path),
        media_type="application/pdf",
        content_disposition_type="inline",
        filename=f"resume_{resume_id}.pdf",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )
