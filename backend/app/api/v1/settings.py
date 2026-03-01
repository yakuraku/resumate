import time
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings as app_settings
from app.schemas.settings import SettingsResponse, SettingsUpdate, PromptInfo, PromptsResponse, PromptUpdate, LLMTestRequest, LLMTestResponse
from app.services.settings_service import settings_service
from app.services.llm_service import _is_reasoning_model, JSON_MODE_UNSUPPORTED_PROVIDERS

router = APIRouter()

PROMPT_KEYS = ["resume_tailoring", "qa_generate", "qa_rewrite", "qa_saved"]


@router.get("", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Get all user settings. Seeds defaults if not yet set."""
    return await settings_service.get_settings(db)


@router.put("", response_model=SettingsResponse)
async def update_settings(
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Upsert provided settings keys."""
    return await settings_service.update_settings(db, data)


@router.post("/test-llm", response_model=LLMTestResponse)
async def test_llm_connection(data: LLMTestRequest):
    """Test an LLM provider connection without saving settings."""
    provider = data.provider.lower()
    api_key = data.api_key.strip()
    model = data.model.strip()

    if not api_key:
        return LLMTestResponse(success=False, message="API key is required.", response_time_ms=0)
    if not model:
        return LLMTestResponse(success=False, message="Model name is required.", response_time_ms=0)

    if provider == "openai":
        base_url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    elif provider == "gemini":
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    elif provider == "openrouter":
        base_url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": app_settings.PROJECT_NAME,
            "Content-Type": "application/json",
        }
    else:
        return LLMTestResponse(success=False, message=f"Unknown provider: {provider}", response_time_ms=0)

    # Use correct parameter names based on model type (reasoning vs standard)
    is_reasoning = _is_reasoning_model(model)
    payload: dict = {
        "model": model,
        "messages": [{"role": "user", "content": "Respond with exactly: OK"}],
        "stream": False,
    }
    if is_reasoning:
        payload["max_completion_tokens"] = 50
    else:
        payload["max_tokens"] = 10
        payload["temperature"] = 0

    start = time.monotonic()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(base_url, headers=headers, json=payload, timeout=20.0)
            elapsed_ms = int((time.monotonic() - start) * 1000)
            if response.status_code != 200:
                try:
                    err = response.json()
                    msg = err.get("error", {}).get("message", response.text)
                except Exception:
                    msg = response.text
                return LLMTestResponse(success=False, message=f"API error ({response.status_code}): {msg}", response_time_ms=elapsed_ms)
            content = response.json()["choices"][0]["message"]["content"] or ""
            return LLMTestResponse(success=True, message=f'Connected. Response: "{content.strip()}"', response_time_ms=elapsed_ms)
    except httpx.TimeoutException:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return LLMTestResponse(success=False, message="Request timed out after 20s.", response_time_ms=elapsed_ms)
    except Exception as e:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return LLMTestResponse(success=False, message=str(e), response_time_ms=elapsed_ms)


@router.get("/prompts", response_model=PromptsResponse)
async def get_prompts(db: AsyncSession = Depends(get_db)):
    """Get all system prompts with default, custom, and active values."""
    from app.services.prompts import (
        RESUME_TAILORING_SYSTEM_PROMPT,
        QA_CHAT_GENERATE_SYSTEM_PROMPT,
        QA_CHAT_REWRITE_SYSTEM_PROMPT,
        APPLICATION_QA_SYSTEM_PROMPT,
        get_active_prompt,
    )

    defaults = {
        "resume_tailoring": RESUME_TAILORING_SYSTEM_PROMPT,
        "qa_generate": QA_CHAT_GENERATE_SYSTEM_PROMPT,
        "qa_rewrite": QA_CHAT_REWRITE_SYSTEM_PROMPT,
        "qa_saved": APPLICATION_QA_SYSTEM_PROMPT,
    }

    raw = await settings_service._get_all_raw(db)
    prompts = {}
    for key in PROMPT_KEYS:
        custom_key = f"custom_prompt_{key}"
        custom_val = raw.get(custom_key, "")
        active = await get_active_prompt(db, key)
        prompts[key] = PromptInfo(
            key=key,
            default=defaults[key],
            custom=custom_val if custom_val else None,
            active=active,
        )

    return PromptsResponse(prompts=prompts)


@router.put("/prompts/{prompt_key}")
async def update_prompt(
    prompt_key: str,
    data: PromptUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Save a custom prompt override."""
    if prompt_key not in PROMPT_KEYS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown prompt key: {prompt_key}")

    from app.schemas.settings import SettingsUpdate as SU
    await settings_service.update_settings(db, SU(**{f"custom_prompt_{prompt_key}": data.value}))
    return {"ok": True}


@router.delete("/prompts/{prompt_key}")
async def reset_prompt(
    prompt_key: str,
    db: AsyncSession = Depends(get_db),
):
    """Reset a prompt to its hardcoded default by clearing the custom override."""
    if prompt_key not in PROMPT_KEYS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown prompt key: {prompt_key}")

    from app.schemas.settings import SettingsUpdate as SU
    await settings_service.update_settings(db, SU(**{f"custom_prompt_{prompt_key}": ""}))
    return {"ok": True}
