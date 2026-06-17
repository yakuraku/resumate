"""Router for ResumeTemplate endpoints."""
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
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


class _RenderPdfBody(BaseModel):
    yaml_content: Optional[str] = None


def _template_pdf_path(template_id: str) -> Path:
    return get_tailored_resumes_dir() / "templates" / f"template_{template_id}.pdf"


@router.get("", response_model=List[ResumeTemplateResponse])
async def list_resume_templates(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_template_service.get_all_templates(db, current_user.id, search=search)


@router.post("", response_model=ResumeTemplateDetailResponse, status_code=201)
async def create_resume_template(
    data: ResumeTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_template_service.create_template(db, current_user.id, data)


@router.get("/{template_id}", response_model=ResumeTemplateDetailResponse)
async def get_resume_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_template_service.get_template(db, current_user.id, template_id)


@router.put("/{template_id}", response_model=ResumeTemplateDetailResponse)
async def update_resume_template(
    template_id: str,
    data: ResumeTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_template_service.update_template(db, current_user.id, template_id, data)


@router.delete("/{template_id}", status_code=204)
async def delete_resume_template(
    template_id: str,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await resume_template_service.delete_template(db, current_user.id, template_id, force=force)


@router.put("/{template_id}/yaml", response_model=ResumeTemplateDetailResponse)
async def quick_save_template_yaml(
    template_id: str,
    body: ResumeTemplateYamlUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_template_service.quick_save_yaml(db, current_user.id, template_id, body.yaml_content)


@router.post("/{template_id}/duplicate", response_model=ResumeTemplateDetailResponse, status_code=201)
async def duplicate_resume_template(
    template_id: str,
    data: ResumeTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await resume_template_service.duplicate_template(db, current_user.id, template_id, data.name)


@router.post("/{template_id}/render-pdf")
async def render_template_pdf(
    template_id: str,
    body: Optional[_RenderPdfBody] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Render a resume template to PDF.

    If `yaml_content` is provided in the request body it is rendered directly
    (live preview of unsaved edits). If omitted, the saved DB content is used.
    Either way the template must be owned by the calling user.
    """
    detail = await resume_template_service.get_template(db, current_user.id, template_id)

    # Use caller-supplied YAML when present (live editor preview); fall back to DB.
    provided = body.yaml_content.strip() if body and body.yaml_content else None
    yaml_to_render = provided or detail.yaml_content

    output_path = _template_pdf_path(template_id)
    if output_path.exists():
        output_path.unlink()

    success, log = await rendercv_service.render_yaml_to_pdf(yaml_to_render, output_path)
    if not success:
        # Return the full RenderCV error (banner already stripped by the service)
        # so the user can read the exact Location/Error table and copy it for
        # debugging. Cap generously to avoid an unbounded response body.
        raise HTTPException(
            status_code=422,
            detail=(log or "RenderCV failed to render the resume.").strip()[:6000],
        )

    return FileResponse(
        str(output_path),
        media_type="application/pdf",
        content_disposition_type="inline",
        filename=f"template_{template_id}.pdf",
    )
