"""Tests for ResumeTemplate service and API endpoints."""
import uuid
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume_template import ResumeTemplate
from app.models.application import Application
from app.schemas.resume_template import (
    ResumeTemplateCreate,
    ResumeTemplateUpdate,
)
from app.schemas.application import ApplicationCreate
from app.services import resume_template_service
from app.services.application_service import ApplicationService


SAMPLE_YAML = "cv:\n  name: Test User\nsections: {}\n"
SAMPLE_YAML_2 = "cv:\n  name: Another User\nsections: {}\n"

# Synthetic user ID -- SQLite does not enforce FK by default so no User row needed.
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


def _unique_name(prefix: str = "Template") -> str:
    return f"{prefix} {uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def master_template(db: AsyncSession) -> ResumeTemplate:
    """Ensure a per-user master template exists and return it."""
    return await resume_template_service.get_or_create_master(db, TEST_USER_ID)


@pytest_asyncio.fixture
async def plain_template(db: AsyncSession, master_template) -> ResumeTemplate:
    """A non-master template for use in tests (unique name per invocation)."""
    data = ResumeTemplateCreate(name=_unique_name("Plain"), yaml_content=SAMPLE_YAML)
    result = await resume_template_service.create_template(db, TEST_USER_ID, data)
    from sqlalchemy import select
    row = await db.execute(
        select(ResumeTemplate).where(ResumeTemplate.id == result.id)
    )
    return row.scalars().first()


@pytest_asyncio.fixture
async def draft_application(db: AsyncSession) -> Application:
    """A draft application with no template."""
    service = ApplicationService(db, TEST_USER_ID)
    return await service.create(
        ApplicationCreate(company="Acme Corp", role="Engineer")
    )


# ---------------------------------------------------------------------------
# get_or_create_master
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_or_create_master_creates_once(db: AsyncSession):
    master1 = await resume_template_service.get_or_create_master(db, TEST_USER_ID)
    master2 = await resume_template_service.get_or_create_master(db, TEST_USER_ID)
    assert master1.id == master2.id
    assert master1.is_master is True
    assert master1.name == "Master Resume"
    assert master1.user_id == TEST_USER_ID


@pytest.mark.asyncio
async def test_get_or_create_master_is_per_user(db: AsyncSession):
    other_user = "00000000-0000-0000-0000-000000000002"
    m1 = await resume_template_service.get_or_create_master(db, TEST_USER_ID)
    m2 = await resume_template_service.get_or_create_master(db, other_user)
    assert m1.id != m2.id


# ---------------------------------------------------------------------------
# CRUD -- create
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_template_with_yaml(db: AsyncSession, master_template):
    name = _unique_name("My")
    data = ResumeTemplateCreate(name=name, yaml_content=SAMPLE_YAML)
    result = await resume_template_service.create_template(db, TEST_USER_ID, data)
    assert result.name == name
    assert result.yaml_content == SAMPLE_YAML
    assert result.is_master is False
    assert result.linked_application_count == 0


@pytest.mark.asyncio
async def test_create_template_clones_master_when_no_yaml(db: AsyncSession, master_template):
    data = ResumeTemplateCreate(name=_unique_name("Cloned"))
    result = await resume_template_service.create_template(db, TEST_USER_ID, data)
    assert result.yaml_content == master_template.yaml_content


@pytest.mark.asyncio
async def test_create_template_name_uniqueness(db: AsyncSession, master_template):
    name = _unique_name("Unique")
    data = ResumeTemplateCreate(name=name, yaml_content=SAMPLE_YAML)
    await resume_template_service.create_template(db, TEST_USER_ID, data)

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.create_template(db, TEST_USER_ID, data)
    assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# CRUD -- read
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_all_templates_ordering(db: AsyncSession, master_template):
    data1 = ResumeTemplateCreate(name=_unique_name("Starred"), yaml_content=SAMPLE_YAML)
    t1 = await resume_template_service.create_template(db, TEST_USER_ID, data1)

    data2 = ResumeTemplateCreate(name=_unique_name("Plain"), yaml_content=SAMPLE_YAML)
    await resume_template_service.create_template(db, TEST_USER_ID, data2)

    await resume_template_service.update_template(
        db, TEST_USER_ID, t1.id, ResumeTemplateUpdate(is_starred=True)
    )

    all_templates = await resume_template_service.get_all_templates(db, TEST_USER_ID)
    assert all_templates[0].name == "Master Resume"
    starred_idx = next(i for i, t in enumerate(all_templates) if t.id == t1.id)
    assert starred_idx > 0
    assert all_templates[starred_idx].is_starred is True


@pytest.mark.asyncio
async def test_get_template_detail(db: AsyncSession, plain_template):
    detail = await resume_template_service.get_template(db, TEST_USER_ID, plain_template.id)
    assert detail.id == plain_template.id
    assert isinstance(detail.linked_applications, list)


@pytest.mark.asyncio
async def test_get_template_not_found(db: AsyncSession):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.get_template(db, TEST_USER_ID, "nonexistent-id")
    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# CRUD -- update
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_template_name_and_yaml(db: AsyncSession, plain_template):
    updated = await resume_template_service.update_template(
        db,
        TEST_USER_ID,
        plain_template.id,
        ResumeTemplateUpdate(name="Renamed", yaml_content=SAMPLE_YAML_2),
    )
    assert updated.name == "Renamed"
    assert updated.yaml_content == SAMPLE_YAML_2


@pytest.mark.asyncio
async def test_update_master_name_is_protected(db: AsyncSession, master_template):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.update_template(
            db,
            TEST_USER_ID,
            master_template.id,
            ResumeTemplateUpdate(name="Hacked Name"),
        )
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_update_master_yaml_is_allowed(db: AsyncSession, master_template):
    """Master YAML can now be saved -- this is the core fix."""
    updated = await resume_template_service.update_template(
        db,
        TEST_USER_ID,
        master_template.id,
        ResumeTemplateUpdate(yaml_content=SAMPLE_YAML_2),
    )
    assert updated.yaml_content == SAMPLE_YAML_2
    assert updated.is_master is True


@pytest.mark.asyncio
async def test_update_template_name_uniqueness(db: AsyncSession, plain_template, master_template):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.update_template(
            db,
            TEST_USER_ID,
            plain_template.id,
            ResumeTemplateUpdate(name="Master Resume"),
        )
    assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# CRUD -- delete
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_template(db: AsyncSession, master_template):
    data = ResumeTemplateCreate(name=_unique_name("Delete"), yaml_content=SAMPLE_YAML)
    created = await resume_template_service.create_template(db, TEST_USER_ID, data)
    await resume_template_service.delete_template(db, TEST_USER_ID, created.id)

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.get_template(db, TEST_USER_ID, created.id)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_master_is_protected(db: AsyncSession, master_template):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.delete_template(db, TEST_USER_ID, master_template.id)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_delete_template_with_draft_apps_raises_409(
    db: AsyncSession, plain_template, draft_application
):
    svc = ApplicationService(db, TEST_USER_ID)
    await svc.update_application_resume_template(draft_application.id, plain_template.id)

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.delete_template(db, TEST_USER_ID, plain_template.id, force=False)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_force_delete_reassigns_draft_apps_to_master(
    db: AsyncSession, master_template
):
    """Force-deleting a template reassigns linked draft apps to the master."""
    data = ResumeTemplateCreate(name=_unique_name("ForceDelete"), yaml_content=SAMPLE_YAML)
    tmpl = await resume_template_service.create_template(db, TEST_USER_ID, data)

    svc = ApplicationService(db, TEST_USER_ID)
    from app.schemas.application import ApplicationCreate
    app = await svc.create(ApplicationCreate(company="X", role="Y"))
    await svc.update_application_resume_template(app.id, tmpl.id)

    await resume_template_service.delete_template(db, TEST_USER_ID, tmpl.id, force=True)

    refreshed = await svc.get(app.id)
    assert refreshed.resume_template_id == master_template.id


# ---------------------------------------------------------------------------
# quick_save_yaml
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_quick_save_yaml(db: AsyncSession, plain_template):
    new_yaml = "cv:\n  name: Updated\nsections: {}\n"
    result = await resume_template_service.quick_save_yaml(db, TEST_USER_ID, plain_template.id, new_yaml)
    assert result.yaml_content == new_yaml


@pytest.mark.asyncio
async def test_quick_save_yaml_master_allowed(db: AsyncSession, master_template):
    """Saving the master resume via quick_save_yaml must succeed -- core bug fix."""
    new_yaml = "cv:\n  name: Updated Master\nsections: {}\n"
    result = await resume_template_service.quick_save_yaml(
        db, TEST_USER_ID, master_template.id, new_yaml
    )
    assert result.yaml_content == new_yaml
    assert result.is_master is True


# ---------------------------------------------------------------------------
# duplicate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_duplicate_template(db: AsyncSession, plain_template):
    dup = await resume_template_service.duplicate_template(db, TEST_USER_ID, plain_template.id, "Duplicated Name")
    assert dup.name == "Duplicated Name"
    assert dup.yaml_content == plain_template.yaml_content
    assert dup.is_master is False


@pytest.mark.asyncio
async def test_duplicate_name_conflict(db: AsyncSession, plain_template):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await resume_template_service.duplicate_template(
            db, TEST_USER_ID, plain_template.id, plain_template.name
        )
    assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# Application status + snapshot
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_status_change_to_applied_snapshots_yaml(
    db: AsyncSession, plain_template, draft_application
):
    svc = ApplicationService(db, TEST_USER_ID)
    await svc.update_application_resume_template(draft_application.id, plain_template.id)

    updated = await svc.update_application_status(draft_application.id, "applied")
    assert updated.status == "applied"
    assert updated.resume_snapshot_yaml == plain_template.yaml_content


@pytest.mark.asyncio
async def test_status_change_invalid(db: AsyncSession, draft_application):
    from fastapi import HTTPException
    svc = ApplicationService(db, TEST_USER_ID)
    with pytest.raises(HTTPException) as exc_info:
        await svc.update_application_status(draft_application.id, "unknown_status")
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_resume_template_link_blocked_on_non_draft(
    db: AsyncSession, plain_template, draft_application
):
    svc = ApplicationService(db, TEST_USER_ID)
    await svc.update_application_status(draft_application.id, "applied")

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await svc.update_application_resume_template(draft_application.id, plain_template.id)  # type: ignore[arg-type]
    assert exc_info.value.status_code == 409
