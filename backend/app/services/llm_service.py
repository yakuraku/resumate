
import httpx
import json
from typing import AsyncIterator, List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

# Models that require max_completion_tokens instead of max_tokens and do NOT
# accept temperature or max_tokens. Matched by prefix (case-insensitive).
# Sources: OpenAI API docs - all o-series and all GPT-5 family.
REASONING_MODEL_PREFIXES = (
    "o1",
    "o3",
    "o4-mini",
    "gpt-5",
)

# Providers that do NOT reliably support response_format: {type: "json_object"}
# via the OpenAI-compatible chat completions endpoint.
JSON_MODE_UNSUPPORTED_PROVIDERS = {"gemini"}

PROVIDER_DEFAULT_MODELS = {
    "openai": "gpt-5-mini",
    "openrouter": "anthropic/claude-sonnet-4-5",
    "gemini": "gemini-2.5-flash",
}


def _is_reasoning_model(model: str) -> bool:
    """Return True if the model requires reasoning-style API parameters."""
    model_lower = model.lower()
    return any(model_lower.startswith(p.lower()) for p in REASONING_MODEL_PREFIXES)


def truncate_text(text: str, max_tokens: int = 2000) -> str:
    """Rough truncation of text to fit within token limit (1 token ~= 4 chars)."""
    if not text:
        return ""
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "...[truncated]"


class LLMService:
    """Per-request LLM client. Configuration is fixed at construction time so
    concurrent requests from different users never share credentials."""

    def __init__(
        self,
        provider: str,
        api_key: str,
        base_url: str,
        default_model: str,
        headers: Dict[str, str],
    ):
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url
        self.default_model = default_model
        self.headers = headers

    @classmethod
    def mock(cls) -> "LLMService":
        return cls(provider="mock", api_key="", base_url="", default_model="", headers={})

    def _build_payload(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        json_mode: bool,
        stream: bool,
    ) -> Dict[str, Any]:
        is_reasoning = _is_reasoning_model(model)
        supports_json_mode = self.provider not in JSON_MODE_UNSUPPORTED_PROVIDERS

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }

        if is_reasoning:
            payload["max_completion_tokens"] = max(max_tokens, 4000)
        else:
            payload["temperature"] = temperature
            payload["max_tokens"] = max_tokens
            if json_mode and supports_json_mode:
                payload["response_format"] = {"type": "json_object"}

        return payload

    async def get_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        json_mode: bool = False
    ) -> str:
        if not self.api_key:
            if json_mode:
                return '{"mock": "response", "questions": ["Mock Question 1", "Mock Question 2"], "tailored_yaml_content": "mocked_yaml", "items": [], "feedback": "Mock Feedback", "score": 5, "next_question": "Mock Next Question"}'
            return "Note: API Key not configured. This is a mock response."

        resolved_model = model or self.default_model
        payload = self._build_payload(resolved_model, messages, temperature, max_tokens, json_mode, stream=False)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.base_url,
                    headers=self.headers,
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()

                usage = data.get("usage", {})
                if usage:
                    print(f"[LLM Usage] Prompt: {usage.get('prompt_tokens')}, Completion: {usage.get('completion_tokens')}, Total: {usage.get('total_tokens')}")

                content = data["choices"][0]["message"]["content"]
                if content is None or (isinstance(content, str) and content.strip() == ""):
                    return "[The model produced reasoning but no visible output. Try again or increase max_tokens.]"
                return content

            except httpx.HTTPStatusError as e:
                print(f"LLM API Error ({e.response.status_code}): {e.response.text}")
                raise e
            except httpx.HTTPError as e:
                print(f"LLM API Error: {e}")
                raise e

    async def get_completion_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.5,
    ) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "mock_call_1",
                        "type": "function",
                        "function": {
                            "name": "submit_tailored_resume",
                            "arguments": '{"yaml_content": "cv:\\n  name: Mock\\n", "reasoning": "Mock run - no API key configured."}'
                        }
                    }]
                }
            }

        import asyncio as _asyncio

        resolved_model = model or self.default_model
        is_reasoning = _is_reasoning_model(resolved_model)

        payload: Dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
        }
        if is_reasoning:
            payload["max_completion_tokens"] = 32000
        else:
            payload["temperature"] = temperature
            payload["max_tokens"] = 8000

        max_retries = 2
        last_exc: Exception | None = None
        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        self.base_url,
                        headers=self.headers,
                        json=payload,
                        timeout=180.0,
                    )
                    response.raise_for_status()
                    data = response.json()
                    usage = data.get("usage", {})
                    if usage:
                        print(f"[LLM Tool Usage] Prompt: {usage.get('prompt_tokens')}, Completion: {usage.get('completion_tokens')}")
                    choice = data["choices"][0]
                    return {
                        "finish_reason": choice.get("finish_reason"),
                        "message": choice.get("message", {}),
                    }
            except httpx.RemoteProtocolError as e:
                last_exc = e
                if attempt < max_retries:
                    wait = 2 ** attempt
                    print(f"[LLM Tool] RemoteProtocolError (attempt {attempt + 1}/{max_retries + 1}), retrying in {wait}s: {e}")
                    await _asyncio.sleep(wait)
                    continue
                print(f"[LLM Tool] RemoteProtocolError after {max_retries + 1} attempts: {e}")
                raise
            except httpx.HTTPStatusError as e:
                print(f"[LLM Tool] API Error ({e.response.status_code}): {e.response.text[:300]}")
                raise
            except httpx.HTTPError as e:
                print(f"[LLM Tool] HTTP Error: {e}")
                raise
        raise last_exc  # unreachable

    def truncate_text(self, text: str, max_tokens: int = 2000) -> str:
        """Instance shim kept for backward-compat. Prefer the module-level
        truncate_text() since it does not depend on credentials."""
        return truncate_text(text, max_tokens)

    async def stream_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7
    ) -> AsyncIterator[str]:
        if not self.api_key:
            yield "Note: API Key not configured. "
            yield "This is a mock stream."
            return

        resolved_model = model or self.default_model
        payload = self._build_payload(resolved_model, messages, temperature, max_tokens=4000, json_mode=False, stream=True)

        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    self.base_url,
                    headers=self.headers,
                    json=payload,
                    timeout=60.0
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            line = line[6:]
                            if line == "[DONE]":
                                break
                            try:
                                data = json.loads(line)
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
            except httpx.HTTPError as e:
                print(f"LLM Stream Error: {e}")
                raise


def _make_client(api_key: str, provider: str, model: str) -> LLMService:
    """Construct an LLMService for a given provider/key/model triple."""
    if not api_key:
        return LLMService.mock()

    resolved_model = model or PROVIDER_DEFAULT_MODELS.get(provider, "gpt-5-mini")

    if provider == "openai":
        return LLMService(
            provider="openai",
            api_key=api_key,
            base_url="https://api.openai.com/v1/chat/completions",
            default_model=resolved_model,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
    if provider == "gemini":
        return LLMService(
            provider="gemini",
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            default_model=resolved_model,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
    # Default to openrouter for any unknown provider string.
    return LLMService(
        provider="openrouter",
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1/chat/completions",
        default_model=resolved_model,
        headers={
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": settings.APP_URL,
            "X-Title": settings.PROJECT_NAME,
            "Content-Type": "application/json",
        },
    )


async def build_llm_client(db: AsyncSession, user_id: str) -> LLMService:
    """Per-request factory: resolves the user's effective LLM credentials
    (DB settings, with .env fallback) and returns a fresh client. Each request
    gets its own instance, so concurrent users never share state."""
    from app.services.settings_service import settings_service
    api_key, provider, model = await settings_service.get_effective_api_key(db, user_id)
    return _make_client(api_key, provider, model)
