import pytest
from httpx import AsyncClient
from app.models.interview import InterviewType

@pytest.mark.asyncio
async def test_interview_flow(client: AsyncClient):
    # 1. Create Application
    app_res = await client.post("/api/v1/applications", json={
        "company": "Tech Corp",
        "role": "Senior Engineer",
        "job_description": "We need Python and React skills."
    })
    assert app_res.status_code == 200
    app_id = app_res.json()["id"]

    # 2. Create Interview Session
    session_res = await client.post("/api/v1/interviews/", json={
        "application_id": app_id,
        "interview_type": "technical",
        "persona": "Tech Lead"
    })
    assert session_res.status_code == 200
    session_data = session_res.json()
    assert session_data["interview_type"] == "technical"
    assert session_data["persona"] == "Tech Lead"
    session_id = session_data["id"]

    # 3. Get Session
    get_res = await client.get(f"/api/v1/interviews/{session_id}")
    assert get_res.status_code == 200
    assert get_res.json()["questions"] == []

    # 4. Generate Questions (Mock LLM response expected if no key)
    # To avoid actual API call cost or dependency, we rely on LLMService returning mock or error.
    # But generate_questions calls LLMService. 
    # If API key is missing, LLMService returns "Note: OpenRouter API Key not configured..."
    # My parsing logic might fail on that string if it expects JSON.
    # "Could not generate questions. Please try again." is the fallback.
    
    gen_res = await client.post(f"/api/v1/interviews/{session_id}/generate", json={
        "num_questions": 2
    })
    
    # It might return 200 with empty list or fallback question, OR 404/500 if I didn't handle exceptions well.
    # My code handles JSONDecodeError -> fallback list.
    assert gen_res.status_code == 200 
    questions = gen_res.json()
    assert isinstance(questions, list)
    
    # 5. Submit Answer (if we have a question)
    if questions:
        q_id = questions[0]["id"]
        ans_res = await client.post(f"/api/v1/interviews/questions/{q_id}/answer", json={
            "answer_text": "I utilize TDD and clean architecture."
        })
        assert ans_res.status_code == 200
        assert ans_res.json()["answer_text"] == "I utilize TDD and clean architecture."
        
        # Verify it shows up in session
        get_res_2 = await client.get(f"/api/v1/interviews/{session_id}")
        assert get_res_2.json()["questions"][0]["answer"]["answer_text"] == "I utilize TDD and clean architecture."
