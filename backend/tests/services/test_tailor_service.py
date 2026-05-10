
import pytest
from unittest.mock import AsyncMock
from app.services.tailor_service import tailor_service

@pytest.mark.asyncio
async def test_parse_job_description():
    mock_client = AsyncMock()
    mock_client.get_completion.return_value = '{"job_title": "Engineer", "key_skills": ["Python"]}'

    result = await tailor_service.parse_job_description(mock_client, "Looking for a Python Engineer")

    assert result["job_title"] == "Engineer"
    assert "Python" in result["key_skills"]

@pytest.mark.asyncio
async def test_tailor_resume():
    mock_client = AsyncMock()
    mock_client.get_completion.return_value = '{"tailored_yaml_content": "cv:\n  name: Tailored"}'

    result = await tailor_service.tailor_resume(mock_client, "cv: original", "Job Description")

    assert "Tailored" in result
