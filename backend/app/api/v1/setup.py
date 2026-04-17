"""
Setup API -- first-run wizard support.

Endpoints:
  GET  /setup/status                  -- overall readiness (master resume, context, api key, wizard dismissed)
  GET  /setup/master-resume           -- read current master resume YAML
  POST /setup/master-resume           -- save + validate master resume YAML (RenderCV render + preview PDF)
  GET  /setup/master-resume/pdf       -- serve the rendered preview PDF
  POST /setup/generate-resume-yaml    -- call the configured LLM to draft a master resume YAML
  POST /setup/wizard/dismiss          -- mark wizard as dismissed in DB settings
"""

import re
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.utils.filesystem import get_context_folder, get_data_dir, get_master_resume_path

router = APIRouter()


# ── Prompt templates ───────────────────────────────────────────────────────────

_GENERATION_SYSTEM = (
    "You are an expert resume writer specialising in RenderCV 2.3 YAML format. "
    "Always return only valid YAML with no markdown fences, no prose, and no explanation."
)

_GENERATION_PROMPT = """\
Generate a professional master resume in RenderCV 2.3 YAML format using the information provided.
RenderCV renders with Typst (not LaTeX). Return ONLY valid YAML -- no markdown fences, no explanation.

Required structure (include only sections for which real data exists):

cv:
  name: "Full Name"
  location: "City, State"
  email: email@example.com
  phone: "+1 555 000 0000"
  social_networks:
    - network: LinkedIn
      username: handle-only-not-full-url
    - network: GitHub
      username: handle-only-not-full-url

  sections:
    summary:
      - "One concise professional summary sentence."

    skills:
      - label: "Category Name"
        details: "skill1, skill2, skill3"

    experience:
      - company: "Company Name"
        position: "Job Title"
        location: "City, State"
        start_date: "YYYY-MM"
        end_date: "present"
        highlights:
          - "Action verb + what you achieved + measurable result"

    projects:
      - name: "Project Name"
        date: "YYYY"
        highlights:
          - "What it does and its impact"
        url: "https://..."

    education:
      - institution: "University Name"
        area: "Field of Study"
        degree: "BS"
        start_date: "YYYY-MM"
        end_date: "YYYY-MM"
        highlights:
          - "GPA: 3.9 / 4.0"

design:
  theme: classic
  page:
    show_last_updated_date: false

RULES:
1. Return ONLY the YAML. No ``` fences. No text before or after.
2. Dates must be quoted strings: "YYYY-MM" (e.g. "2022-03") or "present".
3. Quote strings that contain colons, commas, hashes, or start with special characters.
4. social_networks: username/handle only -- never full URLs or domain names.
5. Only include sections that have real data. Never invent or guess information.
6. skills must always use label+details pairs -- never plain strings.
7. For certifications, awards, or publications: use the projects format (name + date + highlights).
8. The design block is required -- always include it exactly as shown above.
9. Write bullet points as concise, specific, and metric-driven statements where possible.

Here is the information to use:

"""

_FIX_PROMPT = """\
The YAML below failed RenderCV 2.3 validation with the following error.

ERROR:
{error}

FAILED YAML:
{yaml}

Fix only the structural issues causing this error. Do not change any personal information or content.
Return ONLY the corrected YAML -- no markdown fences, no explanation.
"""

# Prompt shown to users who want to use an external LLM (Path B -- no API key).
# The frontend appends the user's raw content to this before copying to clipboard.
EXTERNAL_COPY_PROMPT = _GENERATION_PROMPT


# ── Schemas ────────────────────────────────────────────────────────────────────

class SetupStatus(BaseModel):
    master_resume_exists: bool
    context_files_exist: bool
    api_key_configured: bool
    wizard_dismissed: bool


class MasterResumeContent(BaseModel):
    content: str


class MasterResumeSaveRequest(BaseModel):
    content: str


class ValidationResult(BaseModel):
    valid: bool
    error: Optional[str] = None


class GenerateResumeRequest(BaseModel):
    raw_content: str
    previous_yaml: Optional[str] = None
    previous_error: Optional[str] = None


class GenerateResumeResponse(BaseModel):
    yaml_content: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    """
    Extract YAML from LLM output that may be wrapped in markdown code fences.

    Handles:
      ```yaml ... ```
      ```yml  ... ```
      ```     ... ```

    If no fences are found the text is returned as-is (already clean YAML).
    """
    text = text.strip()
    match = re.search(r"```(?:ya?ml)?\s*\n([\s\S]*?)\n```", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status", response_model=SetupStatus)
async def get_setup_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.config import settings as app_settings
    from app.services.settings_service import settings_service

    master = get_master_resume_path()
    master_exists = master.exists() and master.stat().st_size > 10

    ctx_folder = get_context_folder()
    context_exists = False
    if ctx_folder.exists():
        context_exists = any(
            p.stat().st_size > 0
            for p in ctx_folder.glob("*.md")
        )

    raw = await settings_service._get_all_raw(db, current_user.id)
    provider = raw.get("llm_provider", "openai")
    provider_key_map = {
        "openai": "llm_api_key_openai",
        "openrouter": "llm_api_key_openrouter",
        "gemini": "llm_api_key_gemini",
    }
    api_key = (
        raw.get(provider_key_map.get(provider, "llm_api_key"), "")
        or raw.get("llm_api_key", "")
    )
    if not api_key:
        api_key = (
            app_settings.OPENAI_API_KEY
            or app_settings.OPENROUTER_API_KEY
            or app_settings.GEMINI_API_KEY
            or ""
        )

    wizard_dismissed = raw.get("wizard_dismissed", "false").lower() == "true"

    return SetupStatus(
        master_resume_exists=master_exists,
        context_files_exist=context_exists,
        api_key_configured=bool(api_key),
        wizard_dismissed=wizard_dismissed,
    )


@router.get("/master-resume", response_model=MasterResumeContent)
async def get_master_resume(current_user: User = Depends(get_current_user)):
    master = get_master_resume_path()
    if not master.exists():
        return MasterResumeContent(content="")
    return MasterResumeContent(content=master.read_text(encoding="utf-8"))


@router.post("/master-resume", response_model=ValidationResult)
async def save_master_resume(
    body: MasterResumeSaveRequest,
    current_user: User = Depends(get_current_user),
):
    # Strip markdown fences that LLMs commonly add around YAML output.
    content = _strip_markdown_fences(body.content)
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    # Quick YAML syntax check before the expensive RenderCV call.
    try:
        import yaml
        yaml.safe_load(content)
    except Exception as exc:
        return ValidationResult(valid=False, error=f"Invalid YAML syntax: {exc}")

    # Full RenderCV validation via rendercv_service.validate_yaml (clean error messages).
    from app.services.rendercv_service import rendercv_service
    valid, error_msg = await rendercv_service.validate_yaml(content)
    if not valid:
        return ValidationResult(valid=False, error=error_msg)

    # Validation passed -- render to PDF and save the preview file.
    preview_path = get_data_dir() / "master-resume-preview.pdf"
    render_ok, render_err = await rendercv_service.render_yaml_to_pdf(content, preview_path)
    if not render_ok:
        # The YAML is structurally valid but PDF generation failed (fonts, etc.).
        # Still save the YAML -- just report the render error without blocking.
        print(f"[Setup] Warning: preview PDF render failed after validation: {render_err[:200]}")

    # Persist the YAML.
    master = get_master_resume_path()
    master.parent.mkdir(parents=True, exist_ok=True)
    master.write_text(content, encoding="utf-8")

    return ValidationResult(valid=True)


@router.get("/master-resume/pdf")
async def get_master_resume_pdf(current_user: User = Depends(get_current_user)):
    """Serve the most recently rendered master resume preview PDF."""
    preview_path = get_data_dir() / "master-resume-preview.pdf"
    if not preview_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Preview PDF not yet generated. Validate your master resume first.",
        )
    return FileResponse(
        path=str(preview_path),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )


@router.post("/generate-resume-yaml", response_model=GenerateResumeResponse)
async def generate_resume_yaml(
    body: GenerateResumeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Call the configured LLM to draft (or fix) a master resume YAML.

    On the first attempt (no previous_yaml) the full generation prompt is sent.
    On retry attempts (previous_yaml + previous_error provided) a targeted fix
    prompt is used so the LLM corrects only the structural issues.
    """
    from app.services.llm_service import llm_service

    if not llm_service.api_key:
        raise HTTPException(
            status_code=400,
            detail="No LLM API key is configured. Complete the AI Connection step first.",
        )

    if body.previous_yaml and body.previous_error:
        user_message = _FIX_PROMPT.format(
            error=body.previous_error,
            yaml=body.previous_yaml,
        )
    else:
        user_message = _GENERATION_PROMPT + body.raw_content

    messages = [
        {"role": "system", "content": _GENERATION_SYSTEM},
        {"role": "user",   "content": user_message},
    ]

    try:
        yaml_content = await llm_service.get_completion(
            messages=messages,
            temperature=0.2,   # low temperature for deterministic structured output
            max_tokens=4000,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"LLM call failed: {exc}",
        )

    if not yaml_content or yaml_content.strip().startswith("["):
        raise HTTPException(
            status_code=500,
            detail="The model returned an empty or invalid response. Try again.",
        )

    return GenerateResumeResponse(yaml_content=yaml_content)


@router.post("/wizard/dismiss")
async def dismiss_wizard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.schemas.settings import SettingsUpdate
    from app.services.settings_service import settings_service
    await settings_service.update_settings(db, current_user.id, SettingsUpdate(wizard_dismissed=True))
    return {"status": "ok"}
