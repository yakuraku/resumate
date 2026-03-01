
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.tailor_service import TailorService, tailor_service

@pytest.mark.asyncio
async def test_parse_job_description():
    mock_llm = AsyncMock()
    mock_llm.get_completion.return_value = '{"job_title": "Engineer", "key_skills": ["Python"]}'
    
    with patch("app.services.tailor_service.llm_service", mock_llm):
        result = await tailor_service.parse_job_description("Looking for a Python Engineer")
        
    assert result["job_title"] == "Engineer"
    assert "Python" in result["key_skills"]

@pytest.mark.asyncio
async def test_tailor_resume():
    mock_llm = AsyncMock()
    mock_llm.get_completion.return_value = '{"tailored_yaml_content": "cv:\n  name: Tailored"}'
    
    with patch("app.services.tailor_service.llm_service", mock_llm):
        result = await tailor_service.tailor_resume("cv: original", "Job Description")
        
    assert "Tailored" in result
