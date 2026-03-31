from pydantic import BaseModel
from typing import Any, Dict, Optional


class PromptInfo(BaseModel):
    key: str
    default: str
    custom: Optional[str]
    active: str


class PromptsResponse(BaseModel):
    prompts: Dict[str, PromptInfo]


class PromptUpdate(BaseModel):
    value: str


class SettingsResponse(BaseModel):
    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_api_key_openai: str = ""
    llm_api_key_openrouter: str = ""
    llm_api_key_gemini: str = ""
    llm_model: str = "gpt-4o-mini"
    theme: str = "dark"
    default_master_resume_path: str = "master-resume_CV.yaml"
    autosave_enabled: bool = True
    tailor_mode: str = "agentic"
    bg_animation_enabled: bool = True
    bg_animation_type: str = "particles"


class LLMTestRequest(BaseModel):
    provider: str
    api_key: str
    model: str


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: int


class SettingsUpdate(BaseModel):
    llm_provider: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_api_key_openai: Optional[str] = None
    llm_api_key_openrouter: Optional[str] = None
    llm_api_key_gemini: Optional[str] = None
    llm_model: Optional[str] = None
    theme: Optional[str] = None
    default_master_resume_path: Optional[str] = None
    autosave_enabled: Optional[bool] = None
    tailor_mode: Optional[str] = None
    bg_animation_enabled: Optional[bool] = None
    bg_animation_type: Optional[str] = None
    custom_prompt_resume_tailoring: Optional[str] = None
    custom_prompt_qa_generate: Optional[str] = None
    custom_prompt_qa_rewrite: Optional[str] = None
    custom_prompt_qa_saved: Optional[str] = None
