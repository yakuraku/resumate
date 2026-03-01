"""Service layer for ResumeTemplate CRUD and business logic."""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func, case, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.resume_template import ResumeTemplate
from app.models.application import Application
from app.schemas.resume_template import (
    ResumeTemplateCreate,
    ResumeTemplateUpdate,
    ResumeTemplateResponse,
    ResumeTemplateDetailResponse,
    LinkedApplicationSummary,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _project_root() -> Path:
    """Return the project root (two levels above backend/)."""
    return Path(__file__).resolve().parent.parent.parent.parent


def _read_master_yaml() -> str:
    master_path = _project_root() / "master-resume_CV.yaml"
    if master_path.exists():
        return master_path.read_text(encoding="utf-8")
    return "cv:\n  name: Master Resume\nsections: {}\n"


def _template_to_response(
    template: ResumeTemplate,
    count: int,
) -> ResumeTemplateResponse:
    return ResumeTemplateResponse(
        id=template.id,
        name=template.name,
        yaml_content=template.yaml_content,
        is_master=template.is_master,
        is_starred=template.is_starred,
        created_at=template.created_at,
        updated_at=template.updated_at,
        linked_application_count=count,
    )


def _template_to_detail(
    template: ResumeTemplate,
    apps: list[Application],
) -> ResumeTemplateDetailResponse:
    linked = [
        LinkedApplicationSummary(
            id=a.id,
            job_title=a.role,
            company=a.company,
            status=a.status,
        )
        for a in apps
    ]
    return ResumeTemplateDetailResponse(
        id=template.id,
        name=template.name,
        yaml_content=template.yaml_content,
        is_master=template.is_master,
        is_starred=template.is_starred,
        created_at=template.created_at,
        updated_at=template.updated_at,
        linked_application_count=len(linked),
        linked_applications=linked,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_or_create_master(db: AsyncSession) -> ResumeTemplate:
    """Return the master template, creating it if absent."""
    result = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.is_master == True)  # noqa: E712
    )
    master = result.scalars().first()
    if master:
        return master

    master_yaml = _read_master_yaml()
    master = ResumeTemplate(
        id=str(uuid.uuid4()),
        name="Master Resume",
        yaml_content=master_yaml,
        is_master=True,
        is_starred=False,
    )
    db.add(master)
    await db.commit()
    await db.refresh(master)
    return master


async def ensure_master_exists(db: AsyncSession) -> None:
    """Called on startup to guarantee at least one master template exists."""
    await get_or_create_master(db)


async def _count_linked_apps(db: AsyncSession, template_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(Application).where(
            Application.resume_template_id == template_id
        )
    )
    return result.scalar() or 0


async def get_all_templates(
    db: AsyncSession,
    search: Optional[str] = None,
) -> list[ResumeTemplateResponse]:
    """Return all templates ordered: master first, then starred, then updated_at desc."""
    query = select(ResumeTemplate).order_by(
        desc(ResumeTemplate.is_master),
        desc(ResumeTemplate.is_starred),
        desc(ResumeTemplate.updated_at),
    )
    if search:
        query = query.where(ResumeTemplate.name.ilike(f"%{search}%"))

    result = await db.execute(query)
    templates = result.scalars().all()

    responses = []
    for t in templates:
        count = await _count_linked_apps(db, t.id)
        responses.append(_template_to_response(t, count))
    return responses


async def get_template(db: AsyncSession, template_id: str) -> ResumeTemplateDetailResponse:
    """Return a single template with linked application details."""
    result = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.id == template_id)
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="ResumeTemplate not found")

    apps_result = await db.execute(
        select(Application).where(Application.resume_template_id == template_id)
    )
    apps = apps_result.scalars().all()

    return _template_to_detail(template, list(apps))


async def create_template(
    db: AsyncSession,
    data: ResumeTemplateCreate,
) -> ResumeTemplateDetailResponse:
    """Create a new template. Clones from master YAML if yaml_content not provided."""
    # Uniqueness check
    existing = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.name == data.name)
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=409,
            detail=f"A template named '{data.name}' already exists."
        )

    if data.yaml_content:
        yaml_content = data.yaml_content
    else:
        master = await get_or_create_master(db)
        yaml_content = master.yaml_content

    template = ResumeTemplate(
        id=str(uuid.uuid4()),
        name=data.name,
        yaml_content=yaml_content,
        is_master=False,
        is_starred=False,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_to_detail(template, [])


async def update_template(
    db: AsyncSession,
    template_id: str,
    data: ResumeTemplateUpdate,
) -> ResumeTemplateDetailResponse:
    """Update name, yaml_content, or is_starred. Master template name is protected."""
    result = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.id == template_id)
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="ResumeTemplate not found")

    if template.is_master and data.name is not None and data.name != template.name:
        raise HTTPException(
            status_code=403,
            detail="The master template name cannot be changed."
        )

    if data.name is not None and data.name != template.name:
        dup = await db.execute(
            select(ResumeTemplate).where(ResumeTemplate.name == data.name)
        )
        if dup.scalars().first():
            raise HTTPException(
                status_code=409,
                detail=f"A template named '{data.name}' already exists."
            )
        template.name = data.name

    if data.yaml_content is not None:
        template.yaml_content = data.yaml_content

    if data.is_starred is not None:
        if template.is_master:
            raise HTTPException(
                status_code=403,
                detail="The master template cannot be starred/unstarred."
            )
        template.is_starred = data.is_starred

    await db.commit()
    await db.refresh(template)

    apps_result = await db.execute(
        select(Application).where(Application.resume_template_id == template_id)
    )
    apps = apps_result.scalars().all()
    return _template_to_detail(template, list(apps))


async def delete_template(
    db: AsyncSession,
    template_id: str,
    force: bool = False,
) -> None:
    """
    Delete a template.
    - Raises 403 if the template is_master.
    - Raises 409 if draft applications are linked and force=False.
    - If force=True, reassigns linked draft applications to the master template.
    """
    result = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.id == template_id)
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="ResumeTemplate not found")

    if template.is_master:
        raise HTTPException(
            status_code=403,
            detail="The master template cannot be deleted."
        )

    # Check for linked draft applications
    draft_apps_result = await db.execute(
        select(Application).where(
            Application.resume_template_id == template_id,
            Application.status == "draft",
        )
    )
    draft_apps = draft_apps_result.scalars().all()

    if draft_apps and not force:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Template is linked to {len(draft_apps)} draft application(s). "
                "Use force=true to reassign them to the master template and delete."
            )
        )

    if draft_apps and force:
        master = await get_or_create_master(db)
        for app in draft_apps:
            app.resume_template_id = master.id
        await db.flush()

    # Nullify template link on non-draft apps
    all_apps_result = await db.execute(
        select(Application).where(Application.resume_template_id == template_id)
    )
    for app in all_apps_result.scalars().all():
        app.resume_template_id = None

    await db.delete(template)
    await db.commit()


async def quick_save_yaml(
    db: AsyncSession,
    template_id: str,
    yaml_content: str,
) -> ResumeTemplateDetailResponse:
    """Quick-save only the yaml_content of a template."""
    result = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.id == template_id)
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="ResumeTemplate not found")

    template.yaml_content = yaml_content
    await db.commit()
    await db.refresh(template)

    apps_result = await db.execute(
        select(Application).where(Application.resume_template_id == template_id)
    )
    apps = apps_result.scalars().all()
    return _template_to_detail(template, list(apps))


async def duplicate_template(
    db: AsyncSession,
    template_id: str,
    name: str,
) -> ResumeTemplateDetailResponse:
    """Duplicate an existing template under a new name."""
    result = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.id == template_id)
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="ResumeTemplate not found")

    # Uniqueness check
    dup = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.name == name)
    )
    if dup.scalars().first():
        raise HTTPException(
            status_code=409,
            detail=f"A template named '{name}' already exists."
        )

    new_template = ResumeTemplate(
        id=str(uuid.uuid4()),
        name=name,
        yaml_content=template.yaml_content,
        is_master=False,
        is_starred=False,
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return _template_to_detail(new_template, [])
