from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.application import ApplicationCreate, ApplicationResponse, ApplicationListResponse, ApplicationUpdate, ColorUpdate
from app.schemas.resume import ResumeCreateRequest, ResumeRead
from app.schemas.resume_template import ApplicationStatusUpdate, ApplicationResumeTemplateUpdate
from app.services.application_service import ApplicationService
from app.services.resume_service import resume_service
from app.services.tailor_service import tailor_service

router = APIRouter()

@router.get("", response_model=ApplicationListResponse)
async def list_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    status: str =  None,
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    items, total = await service.get_all(page, page_size, status)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("", response_model=ApplicationResponse)
async def create_application(
    data: ApplicationCreate,
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    return await service.create(data)

@router.get("/{id}", response_model=ApplicationResponse)
async def get_application(
    id: str,
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app

@router.patch("/{id}", response_model=ApplicationResponse)
async def update_application(
    id: str,
    data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    app = await service.update(id, data)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app

@router.delete("/{id}", status_code=204)
async def delete_application(
    id: str,
    db: AsyncSession = Depends(get_db)
):
    service = ApplicationService(db)
    success = await service.delete(id)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")

@router.get("/{id}/resume", response_model=ResumeRead)
async def get_application_resume(
    id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the resume for a specific application.
    """
    # Check if app exists
    service = ApplicationService(db)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    return await resume_service.get_resume_by_application_id(db, id)

@router.post("/{id}/resume", response_model=ResumeRead)
async def create_resume(
    id: str,
    data: ResumeCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a resume for an application.
    If clone_from_id is provided, clones that resume.
    Otherwise, creates from Master Resume.
    """
    # Verify application exists
    service = ApplicationService(db)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    return await resume_service.create_resume(db, application_id=id, clone_from_id=data.clone_from_id)

@router.post("/{id}/analyze_job")
async def analyze_job_description(
    id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Analyze the job description for key insights, categorized keywords, and match scores.
    If the application has a resume, compute keyword match scores against it.
    """
    service = ApplicationService(db)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if not app.job_description:
        raise HTTPException(status_code=400, detail="Application has no job description")

    # Try to load resume for match scoring
    resume_yaml = ""
    try:
        resume = await resume_service.get_resume_by_application_id(db, id)
        if resume:
            resume_yaml = resume.yaml_content or ""
    except Exception:
        pass  # No resume yet, analyze without match scores

    if resume_yaml:
        return await tailor_service.analyze_job_with_resume(app.job_description, resume_yaml)
    else:
        return await tailor_service.parse_job_description(app.job_description)


@router.patch("/{id}/status", response_model=ApplicationResponse)
async def update_application_status(
    id: str,
    data: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update the status of an application. Snapshots resume YAML when transitioning to 'applied'."""
    service = ApplicationService(db)
    return await service.update_application_status(id, data.status)


@router.patch("/{id}/color", response_model=ApplicationResponse)
async def update_application_color(
    id: str,
    data: ColorUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update color for an application and all others at the same company."""
    service = ApplicationService(db)
    app = await service.update_color(id, data.color)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.put("/{id}/resume-template", response_model=ApplicationResponse)
async def update_application_resume_template(
    id: str,
    data: ApplicationResumeTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Link or unlink a resume template for a draft application."""
    service = ApplicationService(db)
    return await service.update_application_resume_template(id, data.resume_template_id)
