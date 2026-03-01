
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.resume_service import ResumeService
from app.models.resume import Resume
from app.models.application import Application
from app.schemas.resume import ResumeUpdate

@pytest.fixture
def resume_service():
    return ResumeService()

@pytest.mark.asyncio
async def test_create_resume(resume_service, db):
    # Setup
    application = Application(company="Test Corp", role="Engineer")
    db.add(application)
    await db.commit()
    await db.refresh(application)
    
    # Mock filesystem read for master resume
    with patch("app.services.resume_service.read_file", return_value="cv:\n  name: Test"):
        with patch("app.services.resume_service.get_master_resume_path", return_value="path"):
             resume = await resume_service.create_resume(db, str(application.id))
             
    assert resume.id is not None
    assert resume.application_id == str(application.id)
    assert "cv" in resume.yaml_content
    assert resume.current_version == 1

@pytest.mark.asyncio
async def test_update_resume(resume_service, db):
    # Setup
    application = Application(company="Test Corp", role="Engineer")
    db.add(application)
    await db.commit()
    
    with patch("app.services.resume_service.read_file", return_value="cv: test"):
         resume = await resume_service.create_resume(db, str(application.id))
    
    update_data = ResumeUpdate(yaml_content="cv: updated", change_summary="Test update")
    updated_resume = await resume_service.update_resume(db, str(resume.id), update_data)
    
    assert updated_resume.yaml_content == "cv: updated"
    assert updated_resume.current_version == 2
