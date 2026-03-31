
"""
Prompts for the Resume Tailoring Agent.

All prompt text lives in backend/app/prompts/*.md — edit those files to change prompts.
This module loads them at import time so the rest of the codebase can use them as string constants.
"""

from __future__ import annotations
from pathlib import Path
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load(filename: str) -> str:
    """Load a prompt file and return its contents stripped of leading/trailing whitespace."""
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8").strip()


JOB_PARSING_SYSTEM_PROMPT = _load("job_parsing_system.md")
JOB_PARSING_USER_PROMPT_TEMPLATE = _load("job_parsing_user.md")

JOB_ANALYSIS_WITH_RESUME_SYSTEM_PROMPT = _load("job_analysis_resume_system.md")
JOB_ANALYSIS_WITH_RESUME_USER_PROMPT_TEMPLATE = _load("job_analysis_resume_user.md")

APPLICATION_QA_SYSTEM_PROMPT = _load("application_qa_system.md")
APPLICATION_QA_USER_PROMPT_TEMPLATE = _load("application_qa_user.md")

RESUME_TAILORING_SYSTEM_PROMPT = _load("resume_tailoring_system.md")
RESUME_TAILORING_USER_PROMPT_TEMPLATE = _load("resume_tailoring_user.md")

INTERVIEW_QUESTION_GENERATION_SYSTEM_PROMPT = _load("interview_gen_system.md")
INTERVIEW_QUESTION_GENERATION_USER_PROMPT_TEMPLATE = _load("interview_gen_user.md")

INTERVIEW_SIMULATION_SYSTEM_PROMPT = _load("interview_sim_system.md")
INTERVIEW_SIMULATION_USER_PROMPT_TEMPLATE = _load("interview_sim_user.md")

CONTEXT_EXTRACTION_SYSTEM_PROMPT = _load("context_extraction_system.md")
CONTEXT_EXTRACTION_USER_PROMPT_TEMPLATE = _load("context_extraction_user.md")

QA_CHAT_GENERATE_SYSTEM_PROMPT = _load("qa_chat_generate_system.md")
QA_CHAT_REWRITE_SYSTEM_PROMPT = _load("qa_chat_rewrite_system.md")
QA_CHAT_CONTEXT_TEMPLATE = _load("qa_chat_context.md")

AGENT_SYSTEM_PROMPT = _load("agent_system.md")
REFINE_ANSWER_SYSTEM_PROMPT = _load("refine_answer_system.md")


async def get_active_prompt(db: "AsyncSession", prompt_key: str) -> str:
    """Return custom prompt if set in settings, otherwise return the hardcoded default."""
    from app.services.settings_service import settings_service
    raw = await settings_service._get_all_raw(db)

    custom_key = f"custom_prompt_{prompt_key}"
    custom_value = raw.get(custom_key, "")

    if custom_value and custom_value.strip():
        return custom_value

    defaults = {
        "resume_tailoring": RESUME_TAILORING_SYSTEM_PROMPT,
        "qa_generate": QA_CHAT_GENERATE_SYSTEM_PROMPT,
        "qa_rewrite": QA_CHAT_REWRITE_SYSTEM_PROMPT,
        "qa_saved": APPLICATION_QA_SYSTEM_PROMPT,
    }
    return defaults.get(prompt_key, "")
