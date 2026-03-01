
import pytest
from httpx import AsyncClient
from app.models.application import Application
from app.models.resume import Resume

@pytest.mark.asyncio
async def test_create_resume_endpoint(client: AsyncClient, db):
    # Setup Application
    app = Application(company="API Test Corp", role="Engineer")
    db.add(app)
    await db.commit()
    
    # Test POST /applications/{id}/resume
    response = await client.post(f"/api/v1/applications/{app.id}/resume", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["application_id"] == str(app.id)

@pytest.mark.asyncio
async def test_get_resume_endpoint(client: AsyncClient, db):
    # Setup App & Resume
    app = Application(company="Get Test", role="Dev")
    db.add(app)
    await db.commit()
    
    resume = Resume(application_id=str(app.id), yaml_content="tests: true", current_version=1)
    db.add(resume)
    await db.commit()
    
    # Test GET /applications/{id}/resume
    response = await client.get(f"/api/v1/applications/{app.id}/resume")
    assert response.status_code == 200
    assert response.json()["id"] == str(resume.id)

@pytest.mark.asyncio
async def test_tailor_resume_endpoint(client: AsyncClient, db):
    # Setup App, Resume & Job Description
    app = Application(company="Tailor Corp", role="Dev", job_description="Python Developer needed.")
    db.add(app)
    await db.commit()
    
    resume = Resume(application_id=str(app.id), yaml_content="cv: original", current_version=1)
    db.add(resume)
    await db.commit()

    # Mock LLM Service via override or patch?
    # Ideally integration tests might hit real services or we patch globally.
    # For now, let's patch the tailor service method to avoid LLM cost/latency
    from unittest.mock import patch
    
    with patch("app.services.resume_service.tailor_service.tailor_resume", return_value="cv: tailored"):
        response = await client.post(f"/api/v1/resumes/{resume.id}/tailor")
        
    assert response.status_code == 200
    assert response.json()["yaml_content"] == "cv: tailored"
