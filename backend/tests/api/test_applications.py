import pytest
from app.models import ApplicationStatus
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_application_endpoint(client: AsyncClient):
    response = await client.post("/api/v1/applications", json={
        "company": "Google",
        "role": "SRE",
        "status": "draft",
        "job_description": "Keep it running"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["company"] == "Google"
    assert "id" in data

@pytest.mark.asyncio
async def test_list_applications_endpoint(client: AsyncClient):
    # Create two
    await client.post("/api/v1/applications", json={"company": "A", "role": "R1"})
    await client.post("/api/v1/applications", json={"company": "B", "role": "R2"})
    
    response = await client.get("/api/v1/applications")
    assert response.status_code == 200
    data = response.json()
    # Note: total might be higher if other tests run, but at least 2
    assert len(data["items"]) >= 2
    assert data["total"] >= 2

@pytest.mark.asyncio
async def test_get_application_endpoint(client: AsyncClient):
    create_res = await client.post("/api/v1/applications", json={"company": "Target", "role": "Dev"})
    app_id = create_res.json()["id"]
    
    response = await client.get(f"/api/v1/applications/{app_id}")
    assert response.status_code == 200
    assert response.json()["company"] == "Target"

@pytest.mark.asyncio
async def test_update_application_endpoint(client: AsyncClient):
    create_res = await client.post("/api/v1/applications", json={"company": "Old", "role": "Dev"})
    app_id = create_res.json()["id"]
    
    response = await client.patch(f"/api/v1/applications/{app_id}", json={"company": "New"})
    assert response.status_code == 200
    assert response.json()["company"] == "New"

@pytest.mark.asyncio
async def test_delete_application_endpoint(client: AsyncClient):
    create_res = await client.post("/api/v1/applications", json={"company": "Del", "role": "Dev"})
    app_id = create_res.json()["id"]
    
    response = await client.delete(f"/api/v1/applications/{app_id}")
    assert response.status_code == 204
    
    get_res = await client.get(f"/api/v1/applications/{app_id}")
    assert get_res.status_code == 404
