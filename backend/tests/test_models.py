import pytest
from sqlalchemy import select
from app.models import Application, Resume, ResumeVersion, ApplicationStatus, ChatHistory

@pytest.mark.asyncio
async def test_create_application(db):
    app = Application(
        company="Test Corp",
        role="Engineer",
        status=ApplicationStatus.DRAFT,
        job_description="Do work"
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    
    assert app.id is not None
    assert app.company == "Test Corp"
    assert app.status == "draft"

@pytest.mark.asyncio
async def test_application_resume_relationship(db):
    app = Application(company="A", role="B")
    db.add(app)
    await db.commit()
    
    resume = Resume(application_id=app.id, yaml_content="key: value")
    db.add(resume)
    await db.commit()
    
    # Reload app with relationship
    result = await db.execute(select(Application).where(Application.id == app.id))
    loaded_app = result.scalars().first()
    
    await db.refresh(loaded_app, ["resume"])
    assert loaded_app.resume.id == resume.id

@pytest.mark.asyncio
async def test_resume_versioning(db):
    app = Application(company="C", role="D")
    db.add(app)
    await db.commit()
    
    resume = Resume(application_id=app.id, yaml_content="v1")
    db.add(resume)
    await db.commit()
    
    version = ResumeVersion(
        resume_id=resume.id,
        version_number=1,
        yaml_content="v1",
        change_summary="Initial"
    )
    db.add(version)
    await db.commit()
    
    await db.refresh(resume, ["versions"])
    assert len(resume.versions) == 1
    assert resume.versions[0].yaml_content == "v1"

@pytest.mark.asyncio
async def test_chat_history(db):
    app = Application(company="E", role="F")
    db.add(app)
    await db.commit()
    
    chat = ChatHistory(
        application_id=app.id,
        module="drafting",
        messages=[{"role": "user", "content": "hi"}],
        context_summary="summary"
    )
    db.add(chat)
    await db.commit()
    
    await db.refresh(app, ["chat_histories"])
    assert len(app.chat_histories) == 1
    assert app.chat_histories[0].messages[0]["content"] == "hi"
