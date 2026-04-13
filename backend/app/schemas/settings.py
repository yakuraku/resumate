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
    llm_model: str = "gpt-5-mini"
    theme: str = "dark"
    default_master_resume_path: str = "master-resume_CV.yaml"
    autosave_enabled: bool = True
    tailor_mode: str = "agentic"
    bg_animation_enabled: bool = True
    bg_animation_type: str = "particles"
    ghost_auto_enabled: bool = True
    ghost_applied_days: int = 21
    ghost_screening_days: int = 21
    ghost_interviewing_days: int = 60
    # PDF saving
    save_pdf_folder_enabled: bool = False
    save_pdf_folder_path: str = ""
    # Onboarding
    wizard_dismissed: bool = False
    # Profile
    preferred_name: str = ""


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
    ghost_auto_enabled: Optional[bool] = None
    ghost_applied_days: Optional[int] = None
    ghost_screening_days: Optional[int] = None
    ghost_interviewing_days: Optional[int] = None
    save_pdf_folder_enabled: Optional[bool] = None
    save_pdf_folder_path: Optional[str] = None
    wizard_dismissed: Optional[bool] = None
    preferred_name: Optional[str] = None
    custom_prompt_resume_tailoring: Optional[str] = None
    custom_prompt_qa_generate: Optional[str] = None
    custom_prompt_qa_rewrite: Optional[str] = None
    custom_prompt_qa_saved: Optional[str] = None
