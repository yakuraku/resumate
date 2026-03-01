"""Router for ResumeTemplate endpoints."""
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.resume_template import (
    ResumeTemplateCreate,
    ResumeTemplateUpdate,
    ResumeTemplateYamlUpdate,
    ResumeTemplateResponse,
    ResumeTemplateDetailResponse,
)
from app.services import resume_template_service
from app.services.rendercv_service import rendercv_service
from app.utils.filesystem import get_tailored_resumes_dir

router = APIRouter()


def _template_pdf_path(template_id: str) -> Path:
    return get_tailored_resumes_dir() / "templates" / f"template_{template_id}.pdf"


# ---------------------------------------------------------------------------
# ResumeTemplate CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=List[ResumeTemplateResponse])
async def list_resume_templates(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await resume_template_service.get_all_templates(db, search=search)


@router.post("", response_model=ResumeTemplateDetailResponse, status_code=201)
async def create_resume_template(
    data: ResumeTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    return await resume_template_service.create_template(db, data)


@router.get("/{template_id}", response_model=ResumeTemplateDetailResponse)
async def get_resume_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await resume_template_service.get_template(db, template_id)


@router.put("/{template_id}", response_model=ResumeTemplateDetailResponse)
async def update_resume_template(
    template_id: str,
    data: ResumeTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await resume_template_service.update_template(db, template_id, data)


@router.delete("/{template_id}", status_code=204)
async def delete_resume_template(
    template_id: str,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    await resume_template_service.delete_template(db, template_id, force=force)


@router.put("/{template_id}/yaml", response_model=ResumeTemplateDetailResponse)
async def quick_save_template_yaml(
    template_id: str,
    body: ResumeTemplateYamlUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Quick-save only the YAML content of a template (no metadata change)."""
    return await resume_template_service.quick_save_yaml(db, template_id, body.yaml_content)


@router.post("/{template_id}/duplicate", response_model=ResumeTemplateDetailResponse, status_code=201)
async def duplicate_resume_template(
    template_id: str,
    data: ResumeTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    """Duplicate a template under a new name."""
    return await resume_template_service.duplicate_template(db, template_id, data.name)


@router.post("/{template_id}/render-pdf")
async def render_template_pdf(
    template_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Render the template's YAML to PDF using RenderCV and return the file."""
    detail = await resume_template_service.get_template(db, template_id)

    output_path = _template_pdf_path(template_id)
    # Always re-render on explicit request
    if output_path.exists():
        output_path.unlink()

    success, log = await rendercv_service.render_yaml_to_pdf(detail.yaml_content, output_path)
    if not success:
        raise HTTPException(
            status_code=422,
            detail=f"RenderCV failed: {log[:500]}"
        )

    return FileResponse(
        str(output_path),
        media_type="application/pdf",
        content_disposition_type="inline",
        filename=f"template_{template_id}.pdf",
    )
