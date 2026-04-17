from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationResponse, ApplicationListResponse, ApplicationUpdate, ColorUpdate, ApplicationDeleteResponse
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
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    items, total = await service.get_all(page, page_size, status)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=ApplicationResponse)
async def create_application(
    data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    return await service.create(data)


@router.get("/{id}", response_model=ApplicationResponse)
async def get_application(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.patch("/{id}", response_model=ApplicationResponse)
async def update_application(
    id: str,
    data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    app = await service.update(id, data)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.delete("/{id}", response_model=ApplicationDeleteResponse)
async def delete_application(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    try:
        saved_template_name = await service.delete(id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApplicationDeleteResponse(saved_template_name=saved_template_name)


@router.get("/{id}/resume", response_model=ResumeRead)
async def get_application_resume(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return await resume_service.get_resume_by_application_id(db, id)


@router.post("/{id}/resume", response_model=ResumeRead)
async def create_resume(
    id: str,
    data: ResumeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return await resume_service.create_resume(db, application_id=id, clone_from_id=data.clone_from_id)


@router.post("/{id}/analyze_job")
async def analyze_job_description(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    app = await service.get(id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if not app.job_description:
        raise HTTPException(status_code=400, detail="Application has no job description")

    resume_yaml = ""
    try:
        resume = await resume_service.get_resume_by_application_id(db, id)
        if resume:
            resume_yaml = resume.yaml_content or ""
    except Exception:
        pass

    if resume_yaml:
        return await tailor_service.analyze_job_with_resume(app.job_description, resume_yaml)
    else:
        return await tailor_service.parse_job_description(app.job_description)


@router.patch("/{id}/status", response_model=ApplicationResponse)
async def update_application_status(
    id: str,
    data: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    return await service.update_application_status(id, data.status)


@router.patch("/{id}/color", response_model=ApplicationResponse)
async def update_application_color(
    id: str,
    data: ColorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    app = await service.update_color(id, data.color)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.put("/{id}/resume-template", response_model=ApplicationResponse)
async def update_application_resume_template(
    id: str,
    data: ApplicationResumeTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApplicationService(db, current_user.id)
    return await service.update_application_resume_template(id, data.resume_template_id)
